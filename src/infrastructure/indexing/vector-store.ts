import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { createHash } from 'crypto';
import { ProjectPaths } from '../../utils/project-paths.js';
import { logger } from '../logging/logger.js';

export interface VectorRecordMeta {
  filePath: string; // relative to project root
  chunkIndex: number;
  chunkStart: number;
  chunkEnd: number;
  lang?: string;
  mtimeMs?: number;
  fileSize?: number;
  fileHash: string; // sha256 of file
  chunkHash: string; // sha256 of chunk text
  commit?: string; // last indexed commit
}

export interface VectorRecord {
  id: string; // `${filePath}#${chunkIndex}:${chunkHash}`
  embedding: number[];
  text: string;
  meta: VectorRecordMeta;
}

export interface QueryResult extends VectorRecord {
  similarity: number;
}

export interface VectorStore {
  initialize(): Promise<void>;
  upsert(records: Readonly<VectorRecord[]>): Promise<void>;
  deleteByFile(filePath: string): Promise<void>;
  query(embedding: readonly number[], k: number): Promise<QueryResult[]>;
  count(): Promise<number>;
}

function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Simple JSONL-backed vector store to avoid native deps. Suitable for mid-size repos.
 * Layout: .crucible/index/vectors.jsonl (one JSON record per line)
 * Also maintains an index.json for quick deletions by file.
 */
export class JsonVectorStore implements VectorStore {
  private baseDir: string;
  private dataFile: string;
  private mapFile: string;
  private inMemory: Map<string, VectorRecord> = new Map();
  private fileToIds: Map<string, Set<string>> = new Map();

  public constructor(relativeDir = '.crucible/index') {
    this.baseDir = ProjectPaths.resolveFromRoot(relativeDir);
    this.dataFile = join(this.baseDir, 'vectors.jsonl');
    this.mapFile = join(this.baseDir, 'index.json');
  }

  public async initialize(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    await this.load();
  }

  private async load(): Promise<void> {
    this.inMemory.clear();
    this.fileToIds.clear();
    try {
      const text = await fs.readFile(this.dataFile, 'utf-8');
      const lines = text.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const rec = JSON.parse(line) as VectorRecord;
        this.inMemory.set(rec.id, rec);
        const set = this.fileToIds.get(rec.meta.filePath) ?? new Set<string>();
        set.add(rec.id);
        this.fileToIds.set(rec.meta.filePath, set);
      }
    } catch {
      // ignore if missing
    }
    try {
      const mapRaw = await fs.readFile(this.mapFile, 'utf-8');
      const mapObj = JSON.parse(mapRaw) as Record<string, string[]>;
      for (const [fp, ids] of Object.entries(mapObj)) {
        this.fileToIds.set(fp, new Set(ids));
      }
    } catch {
      // ignore
    }
  }

  private async persist(): Promise<void> {
    // Write vectors.jsonl atomically
    const tmp = this.dataFile + '.tmp';
    const lines = Array.from(this.inMemory.values()).map(v => JSON.stringify(v));
    await fs.mkdir(dirname(this.dataFile), { recursive: true });
    await fs.writeFile(tmp, lines.join('\n') + '\n', 'utf-8');
    await fs.rename(tmp, this.dataFile);

    // Write index.json (file -> [ids])
    const obj: Record<string, string[]> = {};
    for (const [fp, set] of this.fileToIds.entries()) {
      obj[fp] = Array.from(set);
    }
    await fs.writeFile(this.mapFile, JSON.stringify(obj, null, 2), 'utf-8');
  }

  public async upsert(records: Readonly<VectorRecord[]>): Promise<void> {
    for (const r of records) {
      this.inMemory.set(r.id, r);
      const set = this.fileToIds.get(r.meta.filePath) ?? new Set<string>();
      set.add(r.id);
      this.fileToIds.set(r.meta.filePath, set);
    }
    await this.persist();
  }

  public async deleteByFile(filePath: string): Promise<void> {
    const set = this.fileToIds.get(filePath);
    if (set) {
      for (const id of set) this.inMemory.delete(id);
      this.fileToIds.delete(filePath);
      await this.persist();
    }
  }

  public async query(embedding: readonly number[], k: number): Promise<QueryResult[]> {
    const results: QueryResult[] = [];
    for (const rec of this.inMemory.values()) {
      const sim = cosine(embedding, rec.embedding);
      results.push({ ...rec, similarity: sim });
    }
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, Math.max(1, k));
  }

  public async count(): Promise<number> {
    return this.inMemory.size;
  }

  public static makeId(meta: Readonly<VectorRecordMeta>, text: string): string {
    const chunkHash = createHash('sha256').update(text).digest('hex');
    return `${meta.filePath}#${meta.chunkIndex}:${chunkHash}`;
  }
}

export default JsonVectorStore;

