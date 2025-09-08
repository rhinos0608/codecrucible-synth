/**
 * Unified Cache System - Consolidates all cache implementations
 *
 * Architecture:
 * - Uses cache-manager.ts as the foundation (multi-layer: memory/redis/disk)
 * - Adds semantic search capabilities for AI responses
 * - Provides type-based routing for different data types
 * - Supports migration from legacy cache systems
 *
 * Based on audit findings: Consolidates 8 different cache systems into unified implementation
 */

import { EventEmitter } from 'events';
import { CacheConfig, CacheEntry, CacheManager } from './cache-manager.js';
import { logger } from '../logging/logger.js';
import { toErrorOrUndefined, toReadonlyRecord } from '../../utils/type-guards.js';
import { createHash } from 'crypto';

// Unified cache interfaces
export interface UnifiedCacheConfig extends CacheConfig {
  semantic: {
    enabled: boolean;
    similarityThreshold: number;
    embeddingDimension: number;
    maxVectorResults: number;
  };
  routing: {
    strategies: CacheRoutingStrategy[];
  };
}

export interface CacheRoutingStrategy {
  name: string;
  pattern: RegExp;
  strategy: 'semantic' | 'standard' | 'security' | 'performance';
  ttl?: number;
  layer?: 'memory' | 'redis' | 'disk';
}

export interface SemanticCacheEntry<T = unknown> extends CacheEntry<T> {
  embedding?: number[];
  similarity?: number;
  semanticKey?: string;
}

export interface CacheResult<T = unknown, M = unknown> {
  value: T;
  hit: boolean;
  source: 'exact' | 'semantic' | 'miss';
  similarity?: number;
  metadata?: Record<string, M>;
}

/**
 * Unified Cache System - Single interface for all caching needs
 */
export class UnifiedCacheSystem extends EventEmitter {
  private readonly cacheManager: CacheManager;
  private readonly config: UnifiedCacheConfig;
  private readonly vectorIndex: Map<string, number[]> = new Map();
  private readonly embeddingCache: Map<string, number[]> = new Map();

  // Migration support - adapters for legacy cache systems
  private readonly legacyAdapters: Map<string, LegacyCacheAdapter> = new Map();

  public constructor(config: Readonly<UnifiedCacheConfig>) {
    super();
    this.config = config;
    this.cacheManager = new CacheManager(config);

    // Set up event forwarding
    this.cacheManager.on('hit', (data: unknown) => this.emit('hit', data));
    this.cacheManager.on('miss', (data: unknown) => this.emit('miss', data));
    this.cacheManager.on('error', (error: unknown) => this.emit('error', error));

    logger.info('Unified Cache System initialized', {
      semanticEnabled: config.semantic.enabled,
      strategies: config.routing.strategies.length,
    });
  }

  /**
   * Main cache interface - routes to appropriate strategy based on key pattern
   */
  public async get<T = unknown>(key: string, context?: Readonly<Record<string, unknown>>): Promise<CacheResult<T> | null> {
    const strategy = this.determineStrategy(key);

    try {
      switch (strategy.strategy) {
        case 'semantic':
          return await this.getWithSemanticSearch<T>(key, context);
        case 'security':
          return this.getSecure<T>(key);
        case 'performance':
          return this.getPerformant<T>(key);
        default:
          return this.getStandard<T>(key);
      }
    } catch (error) {
      logger.error('Unified cache get error:', toErrorOrUndefined(error), { key, strategy: strategy.name });
      return null;
    }
  }

  /**
   * Main cache set interface - routes to appropriate strategy
   */
  public async set<T = unknown>(
    key: string,
    value: T,
    options?: Readonly<{
      ttl?: number;
      tags?: readonly string[];
      metadata?: Readonly<Record<string, unknown>>;
      embedding?: readonly number[];
    }>
  ): Promise<boolean> {
    const strategy = this.determineStrategy(key);

    try {
      // Convert readonly arrays/objects to mutable for downstream compatibility
      const mutableOptions = options
        ? {
            ...options,
            tags: options.tags ? Array.from(options.tags) : undefined,
            metadata: options.metadata ? { ...options.metadata } : undefined,
            embedding: options.embedding ? Array.from(options.embedding) : undefined,
          }
        : undefined;

      switch (strategy.strategy) {
        case 'semantic':
          return await this.setWithSemanticIndex(key, value, mutableOptions);
        case 'security':
          return this.setSecure(key, value, mutableOptions);
        case 'performance':
          return this.setPerformant(key, value, mutableOptions);
        default:
          return this.setStandard(key, value, mutableOptions);
      }
    } catch (error) {
      logger.error('Unified cache set error:', { key, strategy: strategy.name, error });
      return false;
    }
  }

  /**
   * Semantic search implementation - extends standard caching with vector similarity
   */
  private async getWithSemanticSearch<T>(
    key: string,
    context?: Readonly<{ prompt?: string; context?: readonly string[] }>
  ): Promise<CacheResult<T> | null> {
    // Try exact match first (fastest)
    const exactResult = this.getStandard<T>(key);
    if (exactResult?.hit) {
      return { ...exactResult, source: 'exact' };
    }

    // If semantic search is enabled and we have context for embedding generation
    if (this.config.semantic.enabled && typeof context?.prompt === 'string') {
      const semanticResult = await this.searchSemantically<T>(
        context.prompt,
        Array.isArray(context.context) ? [...context.context as string[]] : []
      );
      if (semanticResult) {
        return { ...semanticResult, source: 'semantic' };
      }
    }

    return { value: null as T, hit: false, source: 'miss' };
  }

  /**
   * Semantic similarity search using vector embeddings
   */
  private async searchSemantically<T>(
    prompt: string,
    context: readonly string[]
  ): Promise<CacheResult<T> | null> {
    const queryEmbedding = await this.getEmbedding(`${prompt} ${context.join(' ')}`);
    const similarResults: Array<{ key: string; similarity: number }> = [];

    // Search through vector index
    for (const [cacheKey, embedding] of this.vectorIndex.entries()) {
      const similarity = this.cosineSimilarity(queryEmbedding, embedding);
      if (similarity >= this.config.semantic.similarityThreshold) {
        similarResults.push({ key: cacheKey, similarity });
      }
    }

    // Get best match
    if (similarResults.length > 0) {
      const [bestMatch] = similarResults.sort(
        (a: Readonly<{ key: string; similarity: number }>, b: Readonly<{ key: string; similarity: number }>) =>
          b.similarity - a.similarity
      );
      const cached = this.cacheManager.get<T>(bestMatch.key);

      if (cached) {
        logger.debug('Semantic cache hit', {
          similarity: bestMatch.similarity,
          threshold: this.config.semantic.similarityThreshold,
        });

        return {
          value: cached,
          hit: true,
          source: 'semantic',
          similarity: bestMatch.similarity,
        };
      }
    }

    return null;
  }

  /**
   * Set with semantic indexing for AI responses
   *
   * @param key The cache key.
   * @param value The value to cache.
   * @param options Optional settings for cache entry.
   * @param options.ttl Time to live in seconds.
   * @param options.tags Tags for the cache entry.
   * @param options.metadata Additional metadata, such as prompt/context for embedding.
   * @param options.embedding Precomputed embedding vector for semantic indexing.
   */
  private async setWithSemanticIndex<T>(
    key: string,
    value: T,
    options?: Readonly<{
      ttl?: number;
      tags?: readonly string[];
      metadata?: Readonly<Record<string, unknown>>;
      embedding?: readonly number[];
    }>
  ): Promise<boolean> {
    // Convert readonly arrays/objects to mutable for downstream compatibility
    const mutableOptions = options
      ? {
          ...options,
          tags: options.tags ? Array.from(options.tags) : undefined,
          metadata: options.metadata ? { ...options.metadata } : undefined,
        }
      : undefined;

    // Store in standard cache first
    const success = this.setStandard(key, value, mutableOptions);

    if (success && this.config.semantic.enabled) {
      // Index for semantic search if embedding provided or can be generated
      let embedding = options?.embedding ? Array.from(options.embedding) : undefined;
      const metadata = options?.metadata;
      let prompt: string | undefined;
      let contextArr: string[] = [];
      if (
        metadata &&
        typeof (metadata as Record<string, unknown>).prompt === 'string'
      ) {
        prompt = (metadata as Record<string, unknown>).prompt as string;
        const contextVal = (metadata as Record<string, unknown>).context;
        if (Array.isArray(contextVal)) {
          contextArr = contextVal.filter((v): v is string => typeof v === 'string');
        }
      }
      if (!embedding && prompt) {
        embedding = await this.getEmbedding(
          `${prompt} ${contextArr.join(' ')}`
        );
      }

      if (embedding) {
        this.vectorIndex.set(key, embedding);
        logger.debug('Semantic index updated', { key });
      }
    }

    return success;
  }

  /**
   * Determine cache strategy based on key pattern
   */
  private determineStrategy(key: string): CacheRoutingStrategy {
    for (const strategy of this.config.routing.strategies) {
      if (strategy.pattern.test(key)) {
        return strategy;
      }
    }

    // Default strategy
    return {
      name: 'default',
      pattern: /.*/,
      strategy: 'standard',
    };
  }

  /**
   * Standard cache operations (delegates to cache-manager)
   */
  private getStandard<T>(key: string): CacheResult<T> | null {
    const value = this.cacheManager.get<T>(key);
    return value ? { value, hit: true, source: 'exact' } : null;
  }

  private setStandard<T>(
    key: string,
    value: T,
    options?: Readonly<{ ttl?: number; tags?: readonly string[]; metadata?: Readonly<Record<string, unknown>> }>
  ): boolean {
    try {
      this.cacheManager.set(key, value, {
        ttl: options?.ttl,
        tags: options?.tags ? Array.from(options.tags) : undefined,
        metadata: options?.metadata ? { ...options.metadata } : undefined,
      });
      return true;
    } catch (error) {
      logger.error('Cache set error:', toErrorOrUndefined(error));
      return false;
    }
  }

  /**
   * Security-focused cache operations (encrypted, shorter TTL)
   */
  private getSecure<T>(key: string): CacheResult<T> | null {
    // Force encryption and use shorter TTL for security data
    const value = this.cacheManager.get<T>(key);
    return value ? { value, hit: true, source: 'exact' } : null;
  }

  private setSecure<T>(
    key: string,
    value: T,
    options?: Readonly<{ ttl?: number; tags?: readonly string[]; metadata?: Readonly<Record<string, unknown>> }>
  ): boolean {
    try {
      // Force shorter TTL for security data
      const securityTTL = Math.min(options?.ttl ?? 300, 300); // Max 5 minutes for security data
      this.cacheManager.set(key, value, {
        ttl: securityTTL,
        tags: [...(options?.tags ?? []), 'security'],
        metadata: options?.metadata,
      });
      return true;
    } catch (error) {
      logger.error('Secure cache set error:', toErrorOrUndefined(error));
      return false;
    }
  }

  /**
   * Performance-optimized cache operations (memory-only, longer TTL)
   */
  private getPerformant<T>(key: string): CacheResult<T> | null {
    // Use memory layer only for performance data
    const value = this.cacheManager.get<T>(key);
    return value ? { value, hit: true, source: 'exact' } : null;
  }

  private setPerformant<T>(
    key: string,
    value: T,
    options?: Readonly<{ ttl?: number; tags?: readonly string[]; metadata?: Readonly<Record<string, unknown>> }>
  ): boolean {
    try {
      // Use longer TTL for performance data
      const performanceTTL = options?.ttl ?? 3600; // Default 1 hour
      this.cacheManager.set(key, value, {
        ttl: performanceTTL,
        tags: [...(options?.tags ?? []), 'performance'],
        metadata: options?.metadata ? { ...options.metadata } : undefined,
      });
      return true;
    } catch (error) {
      logger.error('Performance cache set error:', toErrorOrUndefined(error));
      return false;
    }
  }

  /**
   * Generate embedding for semantic search using external provider
   */
  private async getEmbedding(text: string): Promise<number[]> {
    const hash = createHash('sha256').update(text).digest('hex');

    if (this.embeddingCache.has(hash)) {
      const cachedEmbedding = this.embeddingCache.get(hash);
      if (Array.isArray(cachedEmbedding)) {
        return cachedEmbedding;
      }
      // If not an array, fall through to fetch
    }

    try {
      let embedding: number[] | undefined;
      const provider = process.env.EMBEDDING_PROVIDER ?? 'openai';

      if (provider === 'huggingface' && process.env.HUGGINGFACE_API_KEY) {
        const response = await fetch(
          'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            },
            body: JSON.stringify({ inputs: text }),
          }
        );
        if (!response.ok) {
          throw new Error(`HuggingFace error: ${response.status} ${response.statusText}`);
        }
        const data: unknown = await response.json();
        if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
          [embedding] = data as number[][];
        } else if (
          typeof data === 'object' &&
          data !== null &&
          'data' in data &&
          Array.isArray((data as { data: unknown }).data) &&
          (data as { data: unknown[] }).data.length > 0 &&
          Array.isArray((data as { data: unknown[] }).data[0])
        ) {
          [embedding] = (data as { data: number[][] }).data;
        } else if (
          typeof data === 'object' &&
          data !== null &&
          'embeddings' in data &&
          Array.isArray((data as { embeddings: unknown }).embeddings) &&
          (data as { embeddings: unknown[] }).embeddings.length > 0 &&
          Array.isArray((data as { embeddings: unknown[] }).embeddings[0])
        ) {
          [embedding] = (data as { embeddings: number[][] }).embeddings;
        } else {
          throw new Error('HuggingFace API returned no embedding data.');
        }
      } else if (process.env.OPENAI_API_KEY) {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            input: text,
            model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI error: ${response.status} ${response.statusText}`);
        }

        interface OpenAIEmbeddingResponse {
          data: Array<{ embedding: number[] }>;
        }
        const data = (await response.json()) as OpenAIEmbeddingResponse;
        if (
          Array.isArray(data.data) &&
          data.data.length > 0 &&
          data.data[0] &&
          Array.isArray(data.data[0].embedding) // OpenAI embeddings are arrays
        ) {
          const [{ embedding: openAIEmbedding }] = data.data;
          embedding = openAIEmbedding;
        } else {
          throw new Error('OpenAI API response missing expected embedding data');
        }
      } else {
        throw new Error('No embedding provider configured');
      }

      this.embeddingCache.set(hash, embedding);
      if (this.embeddingCache.size > 1000) {
        const firstKey = this.embeddingCache.keys().next().value;
        if (firstKey) {
          this.embeddingCache.delete(firstKey);
        }
      }
      return embedding;
    } catch (error) {
      logger.error('Embedding provider error:', toErrorOrUndefined(error));
    }

    // Fallback to zero vector on error
    return new Array(this.config.semantic.embeddingDimension).fill(0) as number[];
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: readonly number[], b: readonly number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
     * Legacy cache system migration support
     */
    public async migrateLegacyCache(
      legacySystemName: string,
      adapter: Readonly<LegacyCacheAdapter>
    ): Promise<void> {
      this.legacyAdapters.set(legacySystemName, adapter);
  
      // Migrate existing data
      const legacyData = await adapter.exportData();
      let migratedCount = 0;
  
      for (const item of legacyData) {
        const success = await this.set(item.key, item.value, {
          ttl: item.ttl,
          tags: item.tags,
          metadata: item.metadata,
        });
  
        if (success) migratedCount++;
      }
  
      logger.info(`Migrated ${migratedCount}/${legacyData.length} entries from ${legacySystemName}`);
      this.emit('migration-complete', { system: legacySystemName, migrated: migratedCount });
    }
  
    /**
     * Get comprehensive cache statistics
     */
    public async getStats(): Promise<{
      [key: string]: unknown;
      semantic: {
      vectorIndexSize: number;
      embeddingCacheSize: number;
      enabled: boolean;
      };
      routing: {
      strategies: number;
      adapters: number;
      };
    }> {
      const baseStats = await Promise.resolve(this.cacheManager.getStats()) as Record<string, unknown>;
      return {
      ...baseStats,
      semantic: {
        vectorIndexSize: this.vectorIndex.size,
        embeddingCacheSize: this.embeddingCache.size,
        enabled: this.config.semantic.enabled,
      },
      routing: {
        strategies: this.config.routing.strategies.length,
        adapters: this.legacyAdapters.size,
      },
      };
    }

      /**
       * Delete a specific cache entry
       */
      public delete(key: string): boolean {
        const result = this.cacheManager.delete(key);
        
        // Also remove from vector index if present
        if (this.vectorIndex.has(key)) {
          this.vectorIndex.delete(key);
          logger.debug('Removed vector index entry', { key });
        }
        
        // Remove from embedding cache if it's related to this key
        const keyHash = createHash('sha256').update(key).digest('hex');
        if (this.embeddingCache.has(keyHash)) {
          this.embeddingCache.delete(keyHash);
          logger.debug('Removed embedding cache entry', { key, keyHash });
        }
        
        this.emit('cache-deleted', { key, success: result });
        return result;
      }

      /**
       * Clear cache entries by tags with proper tag tracking
       */
      public async clearByTags(tags: readonly string[]): Promise<number> {
        const tagSet = new Set(tags);
        const deletedKeys: string[] = [];
        let deletedCount = 0;

        try {
          // Get all cache entries and check their tags
          const allEntries = await this.getAllEntriesWithMetadata();
          
          for (const { key, metadata } of allEntries) {
            const entryTags = metadata?.tags as string[] | undefined;
            if (entryTags && Array.isArray(entryTags)) {
              // Check if any entry tag matches any of the target tags
              const hasMatchingTag = entryTags.some(tag => tagSet.has(tag));
              if (hasMatchingTag) {
                if (this.delete(key)) {
                  deletedKeys.push(key);
                  deletedCount++;
                }
              }
            }
          }

          logger.info(`Cleared ${deletedCount} cache entries with tags`, { 
            tags: Array.from(tags), 
            deletedCount,
            deletedKeys: deletedKeys.slice(0, 10) // Log first 10 keys only
          });
          
          this.emit('cache-cleared-by-tags', { 
            tags: Array.from(tags), 
            deletedCount, 
            deletedKeys 
          });
          
          return deletedCount;
        } catch (error) {
          logger.error('Error clearing cache by tags', { tags: Array.from(tags), error });
          this.emit('error', error);
          return 0;
        }
      }

      /**
       * Clear cache entries by pattern matching
       */
      public async clearByPattern(pattern: Readonly<RegExp>): Promise<number> {
        const deletedKeys: string[] = [];
        let deletedCount = 0;

        try {
          const allEntries = await this.getAllEntriesWithMetadata();
          
          for (const { key } of allEntries) {
            if (pattern.test(key)) {
              if (this.delete(key)) {
                deletedKeys.push(key);
                deletedCount++;
              }
            }
          }

          logger.info(`Cleared ${deletedCount} cache entries by pattern`, { 
            pattern: pattern.toString(), 
            deletedCount,
            deletedKeys: deletedKeys.slice(0, 10)
          });
          
          this.emit('cache-cleared-by-pattern', { 
            pattern: pattern.toString(), 
            deletedCount, 
            deletedKeys 
          });
          
          return deletedCount;
        } catch (error) {
          logger.error('Error clearing cache by pattern', { pattern: pattern.toString(), error });
          this.emit('error', error);
          return 0;
        }
      }

      /**
       * Clear cache entries by strategy
       */
      public async clearByStrategy(strategyName: string): Promise<number> {
        const strategy = this.config.routing.strategies.find(s => s.name === strategyName);
        if (!strategy) {
          logger.warn(`Strategy '${strategyName}' not found`);
          return 0;
        }

        return this.clearByPattern(strategy.pattern);
      }

      /**
       * Clear expired entries across all cache layers
       */
      public async clearExpired(): Promise<number> {
        let deletedCount = 0;

        try {
          const allEntries = await this.getAllEntriesWithMetadata();
          const now = Date.now();
          
          for (const { key, metadata } of allEntries) {
            const expiresAt = metadata?.expiresAt as number | undefined;
            if (expiresAt && expiresAt < now) {
              if (this.delete(key)) {
                deletedCount++;
              }
            }
          }

          logger.info(`Cleared ${deletedCount} expired cache entries`);
          this.emit('cache-cleared-expired', { deletedCount });
          
          return deletedCount;
        } catch (error) {
          logger.error('Error clearing expired cache entries', { error });
          this.emit('error', error);
          return 0;
        }
      }

      /**
       * Clear all caches (unified operation)
       */
      public clear(): void {
        try {
          const stats = {
            cacheManagerSize: typeof this.cacheManager.size === 'function' ? this.cacheManager.size() : 0,
            vectorIndexSize: this.vectorIndex.size,
            embeddingCacheSize: this.embeddingCache.size
          };

          this.cacheManager.clear();
          this.vectorIndex.clear();
          this.embeddingCache.clear();
          
          logger.info('Unified cache system cleared', stats);
          this.emit('cache-cleared', stats);
        } catch (error) {
          logger.error('Error clearing unified cache system', { error });
          this.emit('error', error);
        }
      }

      /**
       * Get all cache entries with their metadata (helper method)
       */
      private async getAllEntriesWithMetadata(): Promise<Array<{
        key: string;
        value: unknown;
        metadata?: Record<string, unknown>;
      }>> {
        // This would need to be implemented based on the cache-manager's capabilities
        // For now, we'll use the cache manager's getAllKeys method if available
        try {
          const entries: Array<{ key: string; value: unknown; metadata?: Record<string, unknown> }> = [];
          
          // Define a type guard for cache managers with getAllKeys and getMetadata
          interface CacheManagerWithMetadata {
            getAllKeys?: () => Promise<string[]> | string[];
            getMetadata?: (key: string) => Record<string, unknown> | undefined;
          }
          const cacheManagerWithMeta = this.cacheManager as CacheManagerWithMetadata;

          if (typeof cacheManagerWithMeta.getAllKeys === 'function') {
            const keys = await cacheManagerWithMeta.getAllKeys();
            for (const key of keys) {
              const value = this.cacheManager.get(key);
              const metadata =
                typeof cacheManagerWithMeta.getMetadata === 'function'
                  ? cacheManagerWithMeta.getMetadata(key)
                  : undefined;
              if (value !== undefined) {
                entries.push({ key, value, metadata });
              }
            }
          } else {
            // Fallback: iterate through known keys (vector index and any tracked keys)
            const knownKeys = new Set([
              ...this.vectorIndex.keys(),
              ...Array.from(this.embeddingCache.keys())
            ]);
            
            for (const key of knownKeys) {
              const value = this.cacheManager.get(key);
              let metadata: Record<string, unknown> | undefined = undefined;
              if (
                typeof (cacheManagerWithMeta.getMetadata) === 'function'
              ) {
                metadata = cacheManagerWithMeta.getMetadata(key);
              }
              if (value !== undefined) {
                entries.push({ key, value, metadata });
              }
            }
          }
          
          return entries;
        } catch (error) {
          logger.error('Error getting all cache entries', { error });
          return [];
        }
      }

      /**
       * Optimize vector index by removing orphaned entries
       */
      public optimizeVectorIndex(): { removed: number; remaining: number } {
        const orphanedKeys: string[] = [];
        
        for (const key of this.vectorIndex.keys()) {
          const exists = typeof this.cacheManager.has === 'function'
            ? this.cacheManager.has(key)
            : this.cacheManager.get(key) !== undefined;
          if (!exists) {
            orphanedKeys.push(key);
          }
        }
        
        for (const key of orphanedKeys) {
          this.vectorIndex.delete(key);
        }
        
        const stats = {
          removed: orphanedKeys.length,
          remaining: this.vectorIndex.size
        };
        
        if (orphanedKeys.length > 0) {
          logger.info('Vector index optimized', stats);
          this.emit('vector-index-optimized', stats);
        }
        
        return stats;
      }

      /**
       * Cleanup embedding cache by removing least recently used entries
       */
      public cleanupEmbeddingCache(maxSize: number = 1000): number {
        const currentSize = this.embeddingCache.size;
        let removedCount = 0;
        
        if (currentSize > maxSize) {
          // Convert to array to be able to slice
          const entries = Array.from(this.embeddingCache.entries());
          const toRemove = currentSize - maxSize;
          
          // Remove oldest entries (first in the map)
          for (let i = 0; i < toRemove; i++) {
            const [key] = entries[i];
            this.embeddingCache.delete(key);
            removedCount++;
          }
          
          logger.debug('Embedding cache cleaned up', { 
            removed: removedCount, 
            remaining: this.embeddingCache.size 
          });
        }
        
        return removedCount;
      }

      /**
       * Perform comprehensive cache maintenance
       */
      public async performMaintenance(): Promise<{
        expiredCleared: number;
        vectorIndexOptimized: { removed: number; remaining: number };
        embeddingCacheCleaned: number;
      }> {
        logger.info('Starting cache maintenance');
        
        const results = {
          expiredCleared: await this.clearExpired(),
          vectorIndexOptimized: this.optimizeVectorIndex(),
          embeddingCacheCleaned: this.cleanupEmbeddingCache()
        };
        
        logger.info('Cache maintenance completed', results);
        this.emit('maintenance-completed', results);
        
        return results;
      }

      /**
       * Cleanup and destroy with proper resource management
       */
      public async destroy(): Promise<void> {
        try {
          logger.info('Destroying unified cache system');
          
          // Stop any periodic maintenance
          await this.performMaintenance();
          
          // Clear all caches
          this.clear();
          
          // Stop the underlying cache manager
          if (typeof this.cacheManager.stop === 'function') {
            this.cacheManager.stop();
          } else if (typeof this.cacheManager.destroy === 'function') {
            this.cacheManager.destroy();
          }
          
          // Clear legacy adapters
          this.legacyAdapters.clear();
          
          // Remove all event listeners
          this.removeAllListeners();
          
          logger.info('Unified cache system destroyed successfully');
          this.emit('destroyed');
        } catch (error) {
          logger.error('Error during cache system destruction', { error });
          this.emit('error', error);
          throw error;
        }
      }
    }

    /**
     * Interface for migrating legacy cache systems
     */
    export interface LegacyCacheAdapter {
      readonly name: string;
      
      /**
       * Export all data from legacy cache system
       */
      exportData: () => Promise<Array<{
        key: string;
        value: unknown;
        ttl?: number;
        tags?: string[];
        metadata?: Record<string, unknown>;
        createdAt?: number;
        accessedAt?: number;
      }>>;

      /**
       * Clear all data from legacy cache system
       */
      clear: () => Promise<void>;

      /**
       * Validate data integrity before migration
       */
      validateData?: () => Promise<{
        isValid: boolean;
        errors: string[];
        totalEntries: number;
        validEntries: number;
      }>;

      /**
       * Cleanup legacy cache system resources
       */
      destroy?: () => Promise<void>;

      /**
       * Get statistics about the legacy cache system
       */
      getStats?: () => Promise<{
        totalEntries: number;
        totalSize: number;
        oldestEntry?: number;
        newestEntry?: number;
      }>;
    }

    /**
     * Built-in adapter for migrating from simple Map-based caches
     */
    export class MapCacheAdapter implements LegacyCacheAdapter {
      public readonly name: string;
      private readonly cache: Map<string, { value: unknown; metadata?: Record<string, unknown> }>;

      public constructor(
        name: string, 
        cache: Map<string, { value: unknown; metadata?: Record<string, unknown> }>
      ) {
        this.name = name;
        this.cache = cache;
      }

      public async exportData(): Promise<Array<{
        key: string;
        value: unknown;
        ttl?: number;
        tags?: string[];
        metadata?: Record<string, unknown>;
        createdAt?: number;
        accessedAt?: number;
      }>> {
        const entries: Array<{
          key: string;
          value: unknown;
          ttl?: number;
          tags?: string[];
          metadata?: Record<string, unknown>;
          createdAt?: number;
          accessedAt?: number;
        }> = [];

        for (const [key, { value, metadata }] of this.cache.entries()) {
          entries.push({
        key,
        value,
        ttl: metadata?.ttl as number | undefined,
        tags: metadata?.tags as string[] | undefined,
        metadata,
        createdAt: metadata?.createdAt as number | undefined,
        accessedAt: metadata?.accessedAt as number | undefined,
          });
        }

        return entries;
      }

      public async clear(): Promise<void> {
        this.cache.clear();
      }

      public async validateData(): Promise<{
        isValid: boolean;
        errors: string[];
        totalEntries: number;
        validEntries: number;
      }> {
        const errors: string[] = [];
        let validEntries = 0;
        const totalEntries = this.cache.size;

        for (const [key, entry] of this.cache.entries()) {
          if (!key || typeof key !== 'string') {
            errors.push(`Invalid key: ${key}`);
            continue;
          }

          if (!entry || typeof entry !== 'object') {
            errors.push(`Invalid entry for key ${key}`);
            continue;
          }

          if (!('value' in entry)) {
            errors.push(`Missing value for key ${key}`);
            continue;
          }

          validEntries++;
        }

        return {
          isValid: errors.length === 0,
          errors,
          totalEntries,
          validEntries,
        };
      }

      public async getStats(): Promise<{
        totalEntries: number;
        totalSize: number;
        oldestEntry?: number;
        newestEntry?: number;
      }> {
        let totalSize = 0;
        let oldestEntry: number | undefined;
        let newestEntry: number | undefined;

        for (const [, { metadata }] of this.cache.entries()) {
          // Rough size estimation
          totalSize += JSON.stringify(metadata).length;

          const createdAt = metadata?.createdAt as number | undefined;
          if (createdAt) {
            if (!oldestEntry || createdAt < oldestEntry) {
              oldestEntry = createdAt;
            }
            if (!newestEntry || createdAt > newestEntry) {
              newestEntry = createdAt;
            }
          }
        }

        return {
          totalEntries: this.cache.size,
          totalSize,
          oldestEntry,
          newestEntry,
        };
      }

      public async destroy(): Promise<void> {
        this.cache.clear();
      }
    }


/**
 * Default configuration for unified cache system
 */
export const defaultUnifiedCacheConfig: UnifiedCacheConfig = {
  maxSize: 10000,
  defaultTTL: 3600,
  checkInterval: 300,
  enableCleanup: true,
  cleanupInterval: 300,
  enableCompression: true,
  enableEncryption: false,
  layers: {
    memory: {
      enabled: true,
      maxSize: 1000,
      algorithm: 'lru',
    },
    redis: {
      enabled: false,
      host: 'localhost',
      port: 6379,
      db: 0,
      keyPrefix: 'codecrucible:',
    },
    disk: {
      enabled: true,
      path: './cache',
      maxSize: '100MB',
    },
  },
  semantic: {
    enabled: true,
    similarityThreshold: 0.85,
    embeddingDimension: 1536,
    maxVectorResults: 5,
  },
  routing: {
    strategies: [
      {
        name: 'ai-responses',
        pattern: /^ai:(prompt|response|analysis):/,
        strategy: 'semantic',
        ttl: 3600,
      },
      {
        name: 'security-tokens',
        pattern: /^(auth|token|session):/,
        strategy: 'security',
        ttl: 300,
      },
      {
        name: 'performance-data',
        pattern: /^(perf|metrics|stats):/,
        strategy: 'performance',
        ttl: 1800,
      },
      {
        name: 'default',
        pattern: /.*/,
        strategy: 'standard',
        ttl: 3600,
      },
    ],
  },
};

// Export lazy-loaded singleton instance to prevent performance issues
let _unifiedCache: UnifiedCacheSystem | null = null;

export function getUnifiedCache(): UnifiedCacheSystem {
  if (!_unifiedCache) {
    _unifiedCache = new UnifiedCacheSystem(defaultUnifiedCacheConfig);
  }
  return _unifiedCache;
}

// Legacy export for backward compatibility - but now lazy-loaded
export const unifiedCache = new Proxy({} as UnifiedCacheSystem, {
  get(target, prop) {
    return getUnifiedCache()[prop as keyof UnifiedCacheSystem];
  },
});
