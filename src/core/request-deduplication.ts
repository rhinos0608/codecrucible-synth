import { logger } from './logger.js';
import { createHash } from 'crypto';

export interface RequestCache {
  hash: string;
  response: any;
  timestamp: number;
  hitCount: number;
  provider: string;
  model: string;
}

export interface DeduplicationConfig {
  enabled: boolean;
  cacheSize: number;
  cacheTtl: number; // Time to live in ms
  similarityThreshold: number; // 0-1, how similar requests need to be
  enableSimilarityDedup: boolean;
}

/**
 * Advanced request deduplication system
 * Prevents duplicate requests and caches similar responses
 */
export class RequestDeduplicationManager {
  private cache = new Map<string, RequestCache>();
  private pendingRequests = new Map<string, Promise<any>>();
  private config: DeduplicationConfig;

  constructor(config: Partial<DeduplicationConfig> = {}) {
    this.config = {
      enabled: config.enabled !== false,
      cacheSize: config.cacheSize || 1000,
      cacheTtl: config.cacheTtl || 300000, // 5 minutes
      similarityThreshold: config.similarityThreshold || 0.85,
      enableSimilarityDedup: config.enableSimilarityDedup !== false
    };

    logger.info('Request deduplication manager initialized', this.config);
    
    // Start cache cleanup
    this.startCacheCleanup();
  }

  /**
   * Process a request with deduplication
   */
  async processRequest<T>(
    requestKey: string,
    requestFn: () => Promise<T>,
    context: {
      provider: string;
      model?: string;
      taskType?: string;
      complexity?: string;
    }
  ): Promise<T> {
    if (!this.config.enabled) {
      return requestFn();
    }

    const hash = this.generateRequestHash(requestKey, context);

    // Check exact cache hit
    const cachedResponse = this.getCachedResponse(hash);
    if (cachedResponse) {
      logger.debug(`Cache hit for request: ${hash.substring(0, 8)}`);
      this.updateHitCount(hash);
      return cachedResponse.response;
    }

    // Check similarity deduplication
    if (this.config.enableSimilarityDedup) {
      const similarResponse = this.findSimilarRequest(requestKey, context);
      if (similarResponse) {
        logger.debug(`Similar cache hit for request: ${hash.substring(0, 8)}`);
        this.updateHitCount(similarResponse.hash);
        return similarResponse.response;
      }
    }

    // Check if same request is already pending
    const pendingRequest = this.pendingRequests.get(hash);
    if (pendingRequest) {
      logger.debug(`Joining pending request: ${hash.substring(0, 8)}`);
      return pendingRequest;
    }

    // Execute the request
    const requestPromise = this.executeRequest(hash, requestFn, context);
    this.pendingRequests.set(hash, requestPromise);

    try {
      const response = await requestPromise;
      this.cacheResponse(hash, response, context);
      return response;
    } finally {
      this.pendingRequests.delete(hash);
    }
  }

  /**
   * Execute the actual request with error handling
   */
  private async executeRequest<T>(
    hash: string,
    requestFn: () => Promise<T>,
    context: any
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const response = await requestFn();
      const duration = Date.now() - startTime;
      
      logger.debug(`Request completed: ${hash.substring(0, 8)} (${duration}ms)`);
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.debug(`Request failed: ${hash.substring(0, 8)} (${duration}ms)`, error);
      throw error;
    }
  }

  /**
   * Generate a hash for the request
   */
  private generateRequestHash(requestKey: string, context: any): string {
    const normalizedKey = this.normalizeRequestKey(requestKey);
    const contextString = JSON.stringify({
      provider: context.provider,
      model: context.model,
      taskType: context.taskType,
      complexity: context.complexity
    });
    
    const combined = `${normalizedKey}:${contextString}`;
    return createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Normalize request key for better matching
   */
  private normalizeRequestKey(key: string): string {
    return key
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s]/g, '') // Remove special characters
      .substring(0, 500); // Limit length
  }

  /**
   * Get cached response if valid
   */
  private getCachedResponse(hash: string): RequestCache | null {
    const cached = this.cache.get(hash);
    if (!cached) return null;

    // Check if cache is still valid
    const age = Date.now() - cached.timestamp;
    if (age > this.config.cacheTtl) {
      this.cache.delete(hash);
      return null;
    }

    return cached;
  }

  /**
   * Find similar request using text similarity
   */
  private findSimilarRequest(requestKey: string, context: any): RequestCache | null {
    const normalizedKey = this.normalizeRequestKey(requestKey);
    
    for (const [hash, cached] of this.cache.entries()) {
      // Only compare within same provider and context
      if (cached.provider !== context.provider) continue;
      
      // Skip if cache is stale
      const age = Date.now() - cached.timestamp;
      if (age > this.config.cacheTtl) continue;

      // Calculate similarity (simple word overlap for now)
      const similarity = this.calculateSimilarity(normalizedKey, cached.hash);
      if (similarity >= this.config.similarityThreshold) {
        logger.debug(`Found similar request (${similarity.toFixed(2)} similarity)`);
        return cached;
      }
    }

    return null;
  }

  /**
   * Calculate text similarity between two requests
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(' '));
    const words2 = new Set(text2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Cache a response
   */
  private cacheResponse(hash: string, response: any, context: any): void {
    // Enforce cache size limit
    if (this.cache.size >= this.config.cacheSize) {
      this.evictOldestEntries();
    }

    const cacheEntry: RequestCache = {
      hash,
      response,
      timestamp: Date.now(),
      hitCount: 0,
      provider: context.provider,
      model: context.model || 'unknown'
    };

    this.cache.set(hash, cacheEntry);
    logger.debug(`Cached response: ${hash.substring(0, 8)}`);
  }

  /**
   * Update hit count for cache entry
   */
  private updateHitCount(hash: string): void {
    const cached = this.cache.get(hash);
    if (cached) {
      cached.hitCount++;
      cached.timestamp = Date.now(); // Refresh timestamp on hit
      this.cache.set(hash, cached);
    }
  }

  /**
   * Evict oldest cache entries to make room
   */
  private evictOldestEntries(): void {
    const entriesToRemove = Math.ceil(this.config.cacheSize * 0.1); // Remove 10%
    
    // Sort by timestamp (oldest first) and hit count (least used first)
    const sortedEntries = Array.from(this.cache.entries())
      .sort((a, b) => {
        const timeScore = a[1].timestamp - b[1].timestamp;
        const hitScore = a[1].hitCount - b[1].hitCount;
        return timeScore + (hitScore * 1000); // Prioritize by time, then by usage
      });

    for (let i = 0; i < entriesToRemove && i < sortedEntries.length; i++) {
      const [hash] = sortedEntries[i];
      this.cache.delete(hash);
      logger.debug(`Evicted cache entry: ${hash.substring(0, 8)}`);
    }

    logger.info(`Evicted ${entriesToRemove} cache entries`);
  }

  /**
   * Start periodic cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Clean every minute

    logger.debug('Cache cleanup started');
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [hash, cached] of this.cache.entries()) {
      const age = now - cached.timestamp;
      if (age > this.config.cacheTtl) {
        this.cache.delete(hash);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Clear specific cache entries
   */
  clearCache(provider?: string, model?: string): void {
    if (!provider && !model) {
      this.cache.clear();
      logger.info('Cleared entire cache');
      return;
    }

    let cleanedCount = 0;
    for (const [hash, cached] of this.cache.entries()) {
      let shouldDelete = false;
      
      if (provider && cached.provider === provider) {
        shouldDelete = true;
      }
      
      if (model && cached.model === model) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        this.cache.delete(hash);
        cleanedCount++;
      }
    }

    logger.info(`Cleared ${cleanedCount} cache entries`, { provider, model });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    totalHits: number;
    oldestEntry: number;
    newestEntry: number;
    pendingRequests: number;
  } {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
    const totalRequests = entries.length + totalHits;
    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

    const timestamps = entries.map(e => e.timestamp);
    const oldestEntry = timestamps.length > 0 ? Math.min(...timestamps) : 0;
    const newestEntry = timestamps.length > 0 ? Math.max(...timestamps) : 0;

    return {
      size: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100,
      totalHits,
      oldestEntry,
      newestEntry,
      pendingRequests: this.pendingRequests.size
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DeduplicationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Deduplication configuration updated', newConfig);
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.cache.clear();
    this.pendingRequests.clear();
    logger.info('Request deduplication manager disposed');
  }
}

// Global instance
export const requestDeduplicationManager = new RequestDeduplicationManager({
  enabled: true,
  cacheSize: 500,
  cacheTtl: 300000, // 5 minutes
  similarityThreshold: 0.85,
  enableSimilarityDedup: true
});