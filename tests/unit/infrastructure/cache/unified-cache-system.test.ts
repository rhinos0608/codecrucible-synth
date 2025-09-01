import {
  UnifiedCacheSystem,
  defaultUnifiedCacheConfig,
} from '../../../../src/infrastructure/cache/unified-cache-system.js';

describe('UnifiedCacheSystem embeddings', () => {
  beforeEach(() => {
    process.env.EMBEDDING_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.EMBEDDING_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).fetch;
  });

  it('fetches and caches embeddings from provider', async () => {
    const dim = defaultUnifiedCacheConfig.semantic.embeddingDimension;
    const mockEmbedding = Array.from({ length: dim }, (_, i) => i / dim);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: mockEmbedding }] }),
    });

    const cache = new UnifiedCacheSystem(defaultUnifiedCacheConfig);
    // Access private method via casting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result1 = await (cache as any).getEmbedding('hello world');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result2 = await (cache as any).getEmbedding('hello world');

    expect(result1).toHaveLength(dim);
    expect(result1).toBe(result2);
    expect(result1.every(v => typeof v === 'number')).toBe(true);
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
  });

  it('returns zero vector on provider failure', async () => {
    const dim = defaultUnifiedCacheConfig.semantic.embeddingDimension;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('failure'));

    const cache = new UnifiedCacheSystem(defaultUnifiedCacheConfig);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (cache as any).getEmbedding('bad');

    expect(result).toHaveLength(dim);
    expect(result.every(v => v === 0)).toBe(true);
  });
});
