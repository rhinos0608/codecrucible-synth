import { createHash } from 'crypto';
import { logger } from '../logging/logger.js';
import { toErrorOrUndefined } from '../../utils/type-guards.js';

export interface EmbeddingServiceOptions {
  dimension?: number;
  provider?: 'openai' | 'huggingface' | 'hf';
  model?: string; // e.g., 'BAAI/bge-small-en-v1.5' or 'hkunlp/instructor-large'
}

/**
 * Lightweight embedding service that uses OpenAI or HuggingFace based on env.
 * Caches embeddings in-memory by sha256(text) for the process lifetime.
 */
export class EmbeddingService {
  private cache = new Map<string, number[]>();
  private dimension: number;
  private provider: 'openai' | 'huggingface';
  private model?: string;
  private prefix?: string;

  public constructor(options: Readonly<EmbeddingServiceOptions> = {}) {
    this.dimension = options.dimension ?? 1536;
    const envProv = (process.env.EMBEDDING_PROVIDER || '').toLowerCase();
    const rawProvider = options.provider || envProv || 'openai';
    // Handle 'hf' shorthand for huggingface
    const normalizedProvider = rawProvider === 'hf' ? 'huggingface' : rawProvider;
    this.provider = normalizedProvider as 'openai' | 'huggingface';
    this.model = options.model || process.env.EMBEDDING_MODEL || undefined;
    this.prefix = process.env.EMBEDDING_PREFIX || undefined;
  }

  private hash(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  public async embed(text: string): Promise<number[]> {
    const key = this.hash(text);
    const cached = this.cache.get(key);
    if (cached) return cached;

    try {
      const inputText = this.prefix ? `${this.prefix} ${text}` : text;
      if (this.provider === 'huggingface' && process.env.HUGGINGFACE_API_KEY) {
        const modelId = this.model || 'sentence-transformers/all-MiniLM-L6-v2';
        const response = await fetch(
          `https://api-inference.huggingface.co/models/${modelId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            },
            body: JSON.stringify({ inputs: inputText }),
          }
        );
        if (!response.ok) {
          throw new Error(`HuggingFace error: ${response.status} ${response.statusText}`);
        }
        const data: unknown = await response.json();
        let emb: number[] | undefined;
        if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
          [emb] = data as number[][];
        } else if (
          typeof data === 'object' &&
          data !== null &&
          'data' in data &&
          Array.isArray((data as { data: unknown }).data) &&
          (data as { data: unknown[] }).data.length > 0 &&
          Array.isArray((data as { data: unknown[] }).data[0])
        ) {
          [emb] = (data as { data: number[][] }).data;
        }
        if (!emb) throw new Error('HuggingFace API returned no embedding');
        this.cache.set(key, emb);
        return emb;
      }

      if (this.provider === 'openai' && process.env.OPENAI_API_KEY) {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            input: inputText,
            model: this.model || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
          }),
        });
        if (!response.ok) {
          throw new Error(`OpenAI error: ${response.status} ${response.statusText}`);
        }
        const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
        const emb = data?.data?.[0]?.embedding;
        if (!emb) throw new Error('OpenAI response missing embedding');
        this.cache.set(key, emb);
        return emb;
      }

      throw new Error('No embedding provider configured');
    } catch (error) {
      logger.error('Embedding generation failed', toErrorOrUndefined(error));
      // Fallback to zero-vector to keep pipeline resilient
      const zero = new Array(this.dimension).fill(0) as number[];
      this.cache.set(key, zero);
      return zero;
    }
  }
}

export default EmbeddingService;
