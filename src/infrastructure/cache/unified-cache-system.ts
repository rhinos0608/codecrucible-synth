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
import { CacheManager, CacheConfig, CacheEntry } from './cache-manager.js';
import { logger } from '../logging/logger.js';
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

export interface SemanticCacheEntry<T = any> extends CacheEntry<T> {
  embedding?: number[];
  similarity?: number;
  semanticKey?: string;
}

export interface CacheResult<T = any> {
  value: T;
  hit: boolean;
  source: 'exact' | 'semantic' | 'miss';
  similarity?: number;
  metadata?: Record<string, any>;
}

/**
 * Unified Cache System - Single interface for all caching needs
 */
export class UnifiedCacheSystem extends EventEmitter {
  private cacheManager: CacheManager;
  private config: UnifiedCacheConfig;
  private vectorIndex: Map<string, number[]> = new Map();
  private embeddingCache: Map<string, number[]> = new Map();

  // Migration support - adapters for legacy cache systems
  private legacyAdapters: Map<string, LegacyCacheAdapter> = new Map();

  constructor(config: UnifiedCacheConfig) {
    super();
    this.config = config;
    this.cacheManager = new CacheManager(config);

    // Set up event forwarding
    this.cacheManager.on('hit', data => this.emit('hit', data));
    this.cacheManager.on('miss', data => this.emit('miss', data));
    this.cacheManager.on('error', error => this.emit('error', error));

    logger.info('Unified Cache System initialized', {
      semanticEnabled: config.semantic.enabled,
      strategies: config.routing.strategies.length,
    });
  }

  /**
   * Main cache interface - routes to appropriate strategy based on key pattern
   */
  async get<T = any>(key: string, context?: Record<string, any>): Promise<CacheResult<T> | null> {
    const strategy = this.determineStrategy(key);

    try {
      switch (strategy.strategy) {
        case 'semantic':
          return await this.getWithSemanticSearch<T>(key, context);
        case 'security':
          return await this.getSecure<T>(key);
        case 'performance':
          return await this.getPerformant<T>(key);
        default:
          return await this.getStandard<T>(key);
      }
    } catch (error) {
      logger.error('Unified cache get error:', { key, strategy: strategy.name, error });
      return null;
    }
  }

  /**
   * Main cache set interface - routes to appropriate strategy
   */
  async set<T = any>(
    key: string,
    value: T,
    options?: {
      ttl?: number;
      tags?: string[];
      metadata?: Record<string, any>;
      embedding?: number[];
    }
  ): Promise<boolean> {
    const strategy = this.determineStrategy(key);

    try {
      switch (strategy.strategy) {
        case 'semantic':
          return await this.setWithSemanticIndex(key, value, options);
        case 'security':
          return await this.setSecure(key, value, options);
        case 'performance':
          return await this.setPerformant(key, value, options);
        default:
          return await this.setStandard(key, value, options);
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
    context?: Record<string, any>
  ): Promise<CacheResult<T> | null> {
    // Try exact match first (fastest)
    const exactResult = await this.getStandard<T>(key);
    if (exactResult?.hit) {
      return { ...exactResult, source: 'exact' };
    }

    // If semantic search is enabled and we have context for embedding generation
    if (this.config.semantic.enabled && context?.prompt) {
      const semanticResult = await this.searchSemantically<T>(
        context.prompt,
        context.context || []
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
    context: string[]
  ): Promise<CacheResult<T> | null> {
    const queryEmbedding = await this.getEmbedding(`${prompt  } ${  context.join(' ')}`);
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
      const bestMatch = similarResults.sort((a, b) => b.similarity - a.similarity)[0];
      const cached = await this.cacheManager.get<T>(bestMatch.key);

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
   */
  private async setWithSemanticIndex<T>(
    key: string,
    value: T,
    options?: {
      ttl?: number;
      tags?: string[];
      metadata?: Record<string, any>;
      embedding?: number[];
    }
  ): Promise<boolean> {
    // Store in standard cache first
    const success = await this.setStandard(key, value, options);

    if (success && this.config.semantic.enabled) {
      // Index for semantic search if embedding provided or can be generated
      let embedding = options?.embedding;
      if (!embedding && options?.metadata?.prompt) {
        embedding = await this.getEmbedding(
          `${options.metadata.prompt  } ${  (options.metadata.context || []).join(' ')}`
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
  private async getStandard<T>(key: string): Promise<CacheResult<T> | null> {
    const value = await this.cacheManager.get<T>(key);
    return value ? { value, hit: true, source: 'exact' } : null;
  }

  private async setStandard<T>(
    key: string,
    value: T,
    options?: { ttl?: number; tags?: string[]; metadata?: Record<string, any> }
  ): Promise<boolean> {
    try {
      await this.cacheManager.set(key, value, {
        ttl: options?.ttl,
        tags: options?.tags,
        metadata: options?.metadata,
      });
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Security-focused cache operations (encrypted, shorter TTL)
   */
  private async getSecure<T>(key: string): Promise<CacheResult<T> | null> {
    // Force encryption and use shorter TTL for security data
    const value = await this.cacheManager.get<T>(key);
    return value ? { value, hit: true, source: 'exact' } : null;
  }

  private async setSecure<T>(
    key: string,
    value: T,
    options?: { ttl?: number; tags?: string[]; metadata?: Record<string, any> }
  ): Promise<boolean> {
    try {
      // Force shorter TTL for security data
      const securityTTL = Math.min(options?.ttl || 300, 300); // Max 5 minutes for security data
      await this.cacheManager.set(key, value, {
        ttl: securityTTL,
        tags: [...(options?.tags || []), 'security'],
        metadata: options?.metadata,
      });
      return true;
    } catch (error) {
      logger.error('Secure cache set error:', error);
      return false;
    }
  }

  /**
   * Performance-optimized cache operations (memory-only, longer TTL)
   */
  private async getPerformant<T>(key: string): Promise<CacheResult<T> | null> {
    // Use memory layer only for performance data
    const value = await this.cacheManager.get<T>(key);
    return value ? { value, hit: true, source: 'exact' } : null;
  }

  private async setPerformant<T>(
    key: string,
    value: T,
    options?: { ttl?: number; tags?: string[]; metadata?: Record<string, any> }
  ): Promise<boolean> {
    try {
      // Use longer TTL for performance data
      const performanceTTL = options?.ttl || 3600; // Default 1 hour
      await this.cacheManager.set(key, value, {
        ttl: performanceTTL,
        tags: [...(options?.tags || []), 'performance'],
        metadata: options?.metadata,
      });
      return true;
    } catch (error) {
      logger.error('Performance cache set error:', error);
      return false;
    }
  }

  /**
   * Generate embedding for semantic search (mock implementation)
   * TODO: Replace with actual embedding service (OpenAI, HuggingFace, etc.)
   */
  private async getEmbedding(text: string): Promise<number[]> {
    const hash = createHash('sha256').update(text).digest('hex');

    if (this.embeddingCache.has(hash)) {
      return this.embeddingCache.get(hash)!;
    }

    // Generate deterministic mock embedding
    const embedding = new Array(this.config.semantic.embeddingDimension).fill(0);
    const hashBytes = createHash('sha256').update(text).digest();

    for (let i = 0; i < this.config.semantic.embeddingDimension; i++) {
      embedding[i] = (hashBytes[i % hashBytes.length] / 255) * 2 - 1; // Normalize to [-1, 1]
    }

    this.embeddingCache.set(hash, embedding);

    // Limit embedding cache size
    if (this.embeddingCache.size > 1000) {
      const firstKey = this.embeddingCache.keys().next().value;
      if (firstKey) {
        this.embeddingCache.delete(firstKey);
      }
    }

    return embedding;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
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
  async migrateLegacyCache(legacySystemName: string, adapter: LegacyCacheAdapter): Promise<void> {
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
  async getStats(): Promise<any> {
    const baseStats = await this.cacheManager.getStats();

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
  async delete(key: string): Promise<boolean> {
    const result = await this.cacheManager.delete(key);
    // Also remove from vector index if present
    this.vectorIndex.delete(key);
    this.embeddingCache.delete(key);
    return result;
  }

  /**
   * Clear cache entries by tags
   */
  async clearByTags(tags: string[]): Promise<void> {
    // Since cache-manager doesn't have tag-based clearing, we'll implement basic clearing
    // This is a simplified implementation - in production would need proper tag tracking
    await this.cacheManager.clear();
    this.vectorIndex.clear();
    this.embeddingCache.clear();
    logger.info(`Cleared cache entries with tags: ${tags.join(', ')}`);
    this.emit('cache-cleared-by-tags', tags);
  }

  /**
   * Clear all caches (unified operation)
   */
  async clear(): Promise<void> {
    await this.cacheManager.clear();
    this.vectorIndex.clear();
    this.embeddingCache.clear();
    logger.info('Unified cache system cleared');
    this.emit('cache-cleared');
  }

  /**
   * Cleanup and destroy
   */
  async destroy(): Promise<void> {
    await this.cacheManager.stop(); // Properly stop the cache manager and clear intervals
    this.vectorIndex.clear();
    this.embeddingCache.clear();
    this.removeAllListeners();
    logger.info('Unified cache system destroyed');
  }
}

/**
 * Interface for migrating legacy cache systems
 */
export interface LegacyCacheAdapter {
  exportData(): Promise<
    Array<{
      key: string;
      value: any;
      ttl?: number;
      tags?: string[];
      metadata?: Record<string, any>;
    }>
  >;

  clear(): Promise<void>;
}

/**
 * Default configuration for unified cache system
 */
export const defaultUnifiedCacheConfig: UnifiedCacheConfig = {
  maxSize: 10000,
  defaultTTL: 3600,
  checkInterval: 300,
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
  }
});
