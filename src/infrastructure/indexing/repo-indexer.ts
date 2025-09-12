import { promises as fs } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';
import { glob } from 'glob';
import { ProjectPaths } from '../../utils/project-paths.js';
import { logger } from '../logging/logger.js';
import EmbeddingService from '../embeddings/embedding-service.js';
import JsonVectorStore, { VectorRecord, VectorRecordMeta } from './vector-store.js';
import LanceVectorStore from './vector-store-lancedb.js';
import { chunkByLanguage, chunkByLanguageAsync } from './chunker.js';
import GitChangeDetector from '../git/git-change-detector.js';

export interface RepoIndexerOptions {
  includeGlobs?: string[];
  excludeGlobs?: string[];
  chunkSize?: number;
  chunkOverlap?: number;
}

export class RepoIndexer {
  private root = ProjectPaths.resolveProjectRoot();
  private manifestPath = ProjectPaths.resolveFromRoot('.crucible/index/manifest.json');
  private manifest: Record<string, { hash: string; mtimeMs: number; size: number }> = {};
  private vectorStore = new LanceVectorStore();
  private embedder = new EmbeddingService();
  private git = new GitChangeDetector();

  public async initialize(): Promise<void> {
    await this.vectorStore.initialize();
    try {
      const raw = await fs.readFile(this.manifestPath, 'utf-8');
      this.manifest = JSON.parse(raw);
    } catch {
      this.manifest = {};
    }
  }

  private shouldIndex(path: string, options?: Readonly<RepoIndexerOptions>): boolean {
    const rel = relative(this.root, path).replace(/\\/g, '/');
    const excludes = options?.excludeGlobs ?? [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.cache/**',
      '**/*.png',
      '**/*.jpg',
      '**/*.jpeg',
      '**/*.gif',
      '**/*.ico',
      '**/*.lock',
      '**/*.svg',
      '**/*.pdf',
      '**/*.zip',
      '**/*.tar',
      '**/*.gz',
    ];
    const includes = options?.includeGlobs ?? ['**/*.{ts,js,tsx,jsx,md,mdx,json,yaml,yml}'];
    // glob has sync matching helper
    const micromatch = (pattern: string) => glob.hasMagic(pattern) ? glob.sync(pattern, { cwd: this.root, nodir: true }).includes(rel) : rel.endsWith(pattern);
    const included = includes.some(p => micromatch(p));
    const excluded = excludes.some(p => micromatch(p));
    return included && !excluded;
  }

  private async fileHashAndStats(absPath: string): Promise<{ hash: string; mtimeMs: number; size: number }> {
    const buf = await fs.readFile(absPath);
    const stat = await fs.stat(absPath);
    const hash = createHash('sha256').update(buf).digest('hex');
    return { hash, mtimeMs: stat.mtimeMs, size: stat.size };
  }

  private async chunk(filePath: string, text: string, size = 1200, overlap = 200): Promise<Array<{ text: string; start: number; end: number }>> {
    // Try language-aware chunking first, then fallback to size-based if necessary
    try {
      const astChunks = await chunkByLanguageAsync(filePath, text);
      if (astChunks && astChunks.length > 0) {
        // Re-chunk large AST chunks by size
        const normalized: Array<{ text: string; start: number; end: number }> = [];
        for (const c of astChunks) {
          if (c.text.length <= size * 1.5) {
            normalized.push({ text: c.text, start: c.start, end: c.end });
          } else {
            // split large chunk
            let i = 0;
            while (i < c.text.length) {
              const end = Math.min(c.text.length, i + size);
              const chunkText = c.text.slice(i, end);
              normalized.push({ text: chunkText, start: c.start + i, end: c.start + end });
              if (end === c.text.length) break;
              i = Math.max(0, end - overlap);
            }
          }
        }
        return normalized;
      }
    } catch {}
    // Fallback to simple windowed chunks
    const chunks: Array<{ text: string; start: number; end: number }> = [];
    let i = 0;
    while (i < text.length) {
      const end = Math.min(text.length, i + size);
      const chunkText = text.slice(i, end);
      chunks.push({ text: chunkText, start: i, end });
      if (end === text.length) break;
      i = Math.max(0, end - overlap);
    }
    return chunks;
  }

  public async indexChanged(options: Readonly<RepoIndexerOptions> = {}): Promise<{ indexed: number; deleted: number; head: string | null }> {
    await this.initialize();
    const head = await this.git.getHead();
    const last = await this.git.readLastIndexedCommit();
    const changes = await this.git.getChangedSince(last);

    const fileList = new Set<string>();
    // Include git-detected changes
    for (const f of [...changes.added, ...changes.modified]) fileList.add(f);
    // Also scan fs to cover uncommitted changes
    const all = glob.sync('**/*', { cwd: this.root, nodir: true, dot: false });
    for (const rel of all) {
      const abs = join(this.root, rel);
      if (!this.shouldIndex(abs, options)) continue;
      const stats = await this.fileHashAndStats(abs);
      const prior = this.manifest[rel];
      if (!prior || prior.hash !== stats.hash) fileList.add(rel);
    }

    // Handle deletions
    let deleted = 0;
    for (const d of changes.deleted) {
      await this.vectorStore.deleteByFile(d);
      delete this.manifest[d];
      deleted++;
    }

    // Index changed/new files
    let indexed = 0;
    for (const rel of fileList) {
      const abs = join(this.root, rel);
      try {
        if (!this.shouldIndex(abs, options)) continue;
        const { hash, mtimeMs, size } = await this.fileHashAndStats(abs);
        const text = await fs.readFile(abs, 'utf-8');
        const chunks = await this.chunk(rel, text, options.chunkSize ?? 1200, options.chunkOverlap ?? 200);
        const lang = rel.split('.').pop();
        const records: VectorRecord[] = [];
        let cidx = 0;
        for (const { text: chunkText, start, end } of chunks) {
          const meta: VectorRecordMeta = {
            filePath: rel,
            chunkIndex: cidx++,
            chunkStart: start,
            chunkEnd: end,
            lang,
            mtimeMs,
            fileSize: size,
            fileHash: hash,
            chunkHash: createHash('sha256').update(chunkText).digest('hex'),
            commit: head ?? undefined,
          };
          const embedding = await this.embedder.embed(chunkText);
          records.push({ id: JsonVectorStore.makeId(meta, chunkText), embedding, text: chunkText, meta });
        }
        await this.vectorStore.deleteByFile(rel); // replace on update
        await this.vectorStore.upsert(records);
        this.manifest[rel] = { hash, mtimeMs, size };
        indexed += records.length;
      } catch (e) {
        logger.warn('Indexing failed for file', { file: rel, error: (e as any)?.message });
      }
    }

    const idxDir = join(this.root, '.crucible/index');
    await fs.mkdir(idxDir, { recursive: true });
    await fs.writeFile(this.manifestPath, JSON.stringify(this.manifest, null, 2), 'utf-8');
    await this.git.writeLastIndexedCommit(head);
    // Persist session change summary for AI/context tools
    const summary = {
      head,
      base: last,
      added: changes.added,
      modified: changes.modified,
      deleted: changes.deleted,
      indexedFiles: Array.from(fileList),
      timestamp: Date.now(),
    };
    await fs.writeFile(join(idxDir, 'last_changes.json'), JSON.stringify(summary, null, 2), 'utf-8');
    return { indexed, deleted, head };
  }

  public async query(text: string, k = 8): Promise<ReadonlyArray<{ similarity: number; text: string; meta: VectorRecordMeta }>> {
    await this.initialize();
    const embedding = await this.embedder.embed(text);
    const results = await this.vectorStore.query(embedding, k);
    return results.map(r => ({ similarity: r.similarity, text: r.text, meta: r.meta }));
  }

  public async stats(): Promise<{ vectors: number; head: string | null }> {
    await this.initialize();
    const count = await this.vectorStore.count();
    const head = await this.git.readLastIndexedCommit();
    return { vectors: count, head };
  }
}

export default RepoIndexer;
