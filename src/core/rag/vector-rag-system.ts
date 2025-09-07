import { CommandLineSearchEngine } from '../search/command-line-search-engine.js';
import type { RAGQuery, RAGResult } from '../search/types.js';

/**
 * Robust VectorRAGSystem
 *
 * - Defensively calls lifecycle methods on the underlying search engine if available.
 * - Enhances raw search results with:
 *   - Deduplication
 *   - Confidence/ranking normalization (uses embeddings when available, otherwise token overlap)
 *   - Extracted context snippets
 *   - Provenance normalization
 *
 * This implementation intentionally avoids assuming a large surface area on CommandLineSearchEngine:
 * it uses searchEngine.search(query) as the primary interaction point and checks for common
 * lifecycle helpers (initialize, shutdown, warmup/index) before calling them.
 */
export class VectorRAGSystem {
  private readonly searchEngine: CommandLineSearchEngine;

  public constructor(workspace: string) {
    this.searchEngine = new CommandLineSearchEngine(workspace);
  }

  /**
   * Enrich raw documents returned by the search engine.
   *
   * @param docs - Array of raw documents to enrich.
   * @param query - The query used for the search.
   * @returns An array of enriched documents.
   */
  private enrichDocuments(docs: ReadonlyArray<MinimalDoc>, query: Readonly<ExtendedRAGQuery>): EnrichedDoc[] {
    return docs.map((doc) => {
      const content = extractContent(doc);
      const embedding = extractEmbedding(doc);
      const confidence = embedding
        ? cosineSimilarity(query.embedding ?? [], embedding)
        : tokenOverlapScore(tokenize(query.query), tokenize(content));
      return {
        id: doc.id ?? doc._id,
        text: content,
        raw: doc,
        metadata: {
          ...doc.metadata,
          provenance: normalizeProvenance(doc),
        },
        confidence: clamp(confidence, 0, 1),
        snippet: makeSnippet(content, query.query),
      };
    });
  }

  /**
   * Initialize the system. If the underlying search engine exposes an initialize/warmup method,
   * call it. This method is defensive: it will not fail if the engine doesn't implement the helper.
   */
  public async initialize(): Promise<void> {
    try {
      const engine = this.searchEngine as unknown;

      if (
        typeof engine === 'object' &&
        engine !== null &&
        'initialize' in engine &&
        typeof (engine as { initialize: () => Promise<void> }).initialize === 'function'
      ) {
        await (engine as { initialize: () => Promise<void> }).initialize();
      }

      // If engine supports a warmup or pre-index step, call it to reduce first-search latency.
      if (
        typeof engine === 'object' &&
        engine !== null &&
        'warmup' in engine &&
        typeof (engine as { warmup: () => Promise<void> }).warmup === 'function'
      ) {
        await (engine as { warmup: () => Promise<void> }).warmup();
      } else if (
        typeof engine === 'object' &&
        engine !== null &&
        'preIndex' in engine &&
        typeof (engine as { preIndex: () => Promise<void> }).preIndex === 'function'
      ) {
        await (engine as { preIndex: () => Promise<void> }).preIndex();
      }
    } catch (err) {
      // Initialization should not blow up the host app; log and continue.
      // Replace console with a project logger if available.
      // eslint-disable-next-line no-console
      console.warn('VectorRAGSystem.initialize: underlying engine reported error', err);
    }
  }

  /**
   * Main search entrypoint. Enhances the raw result set from the underlying search engine.
   *
   * Behavior:
   *  - Validates the query shape.
   *  - Calls the underlying searchEngine.search(query).
   *  - Deduplicates documents by content hash or id.
   *  - Computes per-document confidence:
   *      - If both query and document embeddings are present, uses cosine similarity.
    const enriched = this.enrichDocuments(docs as ReadonlyArray<MinimalDoc>, query as Readonly<ExtendedRAGQuery>);
   *  - Normalizes confidence into [0,1].
   *  - Adds a short snippet of context for each document.
    const confidences = enriched.map((d: Readonly<EnrichedDoc>) => (typeof d.confidence === 'number' ? d.confidence : 0));
   */
  public async search(query: Readonly<RAGQuery>): Promise<RAGResult> {
    if (!query || typeof query !== 'object') {
      throw new TypeError('search expects a RAGQuery object');
    }

    // Defensive: attempt the search, but catch and wrap errors.
    let rawResult: RAGResult;
    try {
      rawResult = await this.searchEngine.search(query);
    } catch (err) {
      // normalize failure into an empty RAGResult
      // eslint-disable-next-line no-console
      console.error('VectorRAGSystem.search: underlying engine search failed', err);
      // fallback to 'rag' as the searchMethod to match the allowed type
      return {
        documents: [],
        metadata: { searchMethod: 'rag', confidence: 0 },
      };
    }

    const docs = Array.isArray(rawResult.documents) ? rawResult.documents : [];

    // Enrich each document
    const enriched = this.enrichDocuments(docs, query);

    // Compute aggregate confidence: maximum doc confidence (conservative)
    const confidences = enriched.map((d: Readonly<{ confidence?: number }>) => (typeof d.confidence === 'number' ? d.confidence : 0));
    const aggregateConfidence = confidences.length > 0 ? Math.max(...confidences) : 0;

    const finalResult: RAGResult = {
      ...rawResult,
      documents: enriched.map(doc => ({
        filePath: doc.metadata.provenance.path ?? '',
        content: doc.text,
        ...doc,
      })) as RAGResult['documents'],
      metadata: {
        ...(rawResult.metadata ?? {}),
        searchMethod: 'rag',
        confidence: clamp(aggregateConfidence, 0, 1),
      },
    };

    return finalResult;
  }

  /**
   * Shutdown the system. If the underlying search engine exposes a shutdown/close method, call it.
  public async shutdown(): Promise<void> {
    try {
      const engine = this.searchEngine as Partial<{
        shutdown: () => Promise<void>;
        close: () => Promise<void>;
      }>;
      if (typeof engine.shutdown === 'function') {
        await engine.shutdown();
      } else if (typeof engine.close === 'function') {
        await engine.close();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('VectorRAGSystem.shutdown: underlying engine reported error', err);
    }
  }
  }

  /**
     * Enrich raw documents returned by the search engine.
     *
     * Expectations about each document:
     *  - Might have text in .text, .content, or .body
     *  - Might have an id in .id
     *  - Might include vector embeddings in metadata.embedding or embedding
     *  - Might include provenance in .metadata (path, file, line)
     *
     * This function is intentionally defensive about field names.
     */
  
    // Define a minimal document and query type for safety
  }
  
  // Move these interfaces to the top-level (outside the class)
  interface MinimalDoc {
    id?: string;
    _id?: string;
    text?: string;
    content?: string;
    body?: string;
    embedding?: number[];
    vector?: number[];
    metadata?: {
      [key: string]: unknown;
      embedding?: number[];
      path?: string;
      file?: string;
      filename?: string;
      line?: number;
      lineno?: number;
      startLine?: number;
      position?: number;
      score?: number;
    };
    score?: number;
    relevance?: number;
    rank?: number;
    document?: string;
    source?: string;
    path?: string;
    file?: string;
  }
  
  interface EnrichedDoc {
    id?: string;
    text: string;
    raw: Readonly<MinimalDoc>;
    metadata: {
      [key: string]: unknown;
      provenance: ReturnType<typeof normalizeProvenance>;
    };
    score?: number;
    confidence: number;
    snippet: string;
  }
  
  // Fix the type to match RAGQuery (query must be string, not string | undefined)
  interface ExtendedRAGQuery extends RAGQuery {
    embedding?: number[];
    vector?: number[];
    text?: string;
    // Remove the optional modifier to match RAGQuery
    query: string;
  }
  
  // Add the method to the class (not nested)
// Removed duplicate class definition

/* --------------------------
   Helper functions
   -------------------------- */

function extractContent(doc: MinimalDoc): string {
  if (!doc) return '';
  if (typeof doc.text === 'string' && doc.text.length > 0) return doc.text;
  if (typeof doc.content === 'string' && doc.content.length > 0) return doc.content;
  if (typeof doc.body === 'string' && doc.body.length > 0) return doc.body;
  // try common nested shapes
  if (typeof doc.document === 'string') return doc.document;
  if (typeof doc.source === 'string') return doc.source;
  return '';
}

function extractEmbedding(doc: MinimalDoc): number[] | undefined {
  if (!doc) return undefined;
  if (Array.isArray(doc.embedding)) return doc.embedding;
  if (Array.isArray(doc.vector)) return doc.vector;
  if (doc.metadata && Array.isArray(doc.metadata.embedding)) return doc.metadata.embedding;
  return undefined;
}

function _normalizeRawScore(doc: Readonly<MinimalDoc>): number | undefined {
  // many search engines use "score" or "rank" or "relevance"
  const cand = doc.score ?? doc.relevance ?? doc.rank ?? doc.metadata?.score;
  if (typeof cand === 'number') return cand;
  const parsed = Number(cand);
  if (!Number.isNaN(parsed)) return parsed;
  return undefined;
}

function normalizeProvenance(doc: Readonly<MinimalDoc>): { path?: string; line?: number; original: MinimalDoc['metadata'] } {
  const md = doc.metadata ?? {};
  // common fields: path, file, filename
  const path = md.path ?? md.file ?? md.filename ?? doc.path ?? doc.file;
  const line = md.line ?? md.lineno ?? md.startLine ?? md.position;
  return { path, line, original: md };
}

function tokenize(text: string): string[] {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function tokenOverlapScore(qTokens: string[], docTokens: string[]) {
  if (qTokens.length === 0 || docTokens.length === 0) return 0;
  const docSet = new Set(docTokens);
  let matches = 0;
  for (const t of qTokens) {
    if (docSet.has(t)) matches++;
  }
  // recall-style overlap: matches / qTokens
  return matches / qTokens.length;
}

function makeSnippet(content: string, queryText: string) {
  if (!content) return '';
  const q = String(queryText ?? '').trim();
  if (!q) {
    // return first 240 chars
    return truncateWhitespace(content.slice(0, 240));
  }
  const idx = content.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) {
    // return start
    return truncateWhitespace(content.slice(0, 240));
  }
  const start = Math.max(0, idx - 80);
  const end = Math.min(content.length, idx + q.length + 80);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';
  return prefix + truncateWhitespace(content.slice(start, end)) + suffix;
}

function truncateWhitespace(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

function cosineSimilarity(a: number[], b: number[]) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = Number(a[i]) || 0;
    const bi = Number(b[i]) || 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function clamp(x: number, lo = 0, hi = 1) {
  if (Number.isNaN(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function _mix(a: number, b: number, weightB = 0.5): number {
  return clamp(a * (1 - weightB) + b * weightB, 0, 1);
}

async function _sha1(input: string): Promise<string> {
  // lightweight, synchronous SHA-1 implementation using built-in crypto if available
  try {
    // Node / modern environments
    const hash = await createCustomHash('sha1');
    hash.update(String(input));
    return hash.digest('hex');
  } catch (e) {
    // Fallback: simple hash (not cryptographic) to avoid throwing — good enough for dedupe keys
    let h = 0;
    for (let i = 0; i < input.length; i++) {
      h = (h << 5) - h + input.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  }
}
async function createCustomHash(algorithm: string): Promise<ReturnType<typeof import('crypto').createHash>> {
  if (typeof algorithm !== 'string' || algorithm.length === 0) {
    throw new Error('Invalid algorithm specified for createHash');
  }
  const crypto = await import('crypto');
  return crypto.createHash(algorithm);
}

