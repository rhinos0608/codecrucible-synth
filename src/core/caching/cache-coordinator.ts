/**
 * CacheCoordinator - Extracted from UnifiedModelClient
 * Centralizes all caching logic following Living Spiral methodology
 *
 * Council Perspectives Applied:
 * - Performance Engineer: Intelligent TTL and hit rate optimization
 * - Maintainer: Clean abstraction for cache operations
 * - Security Guardian: Safe key generation and data validation
 * - Explorer: Extensible cache strategies and storage backends
 * - Architect: Clear separation between caching logic and client operations
 */

import { unifiedCache } from '../cache/unified-cache-system.js';
import { logger } from '../logger.js';

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  hitRate: string;
  totalRequests: number;
}

export interface EnhancedCacheStats {
  basic: any;
  intelligence: CacheStats;
}

export interface CacheMetadata {
  cachedAt: number;
  requestType: string;
  hitCount: number;
}

export interface CacheOptions {
  ttl?: number;
  metadata?: CacheMetadata;
}

export interface ICacheCoordinator {
  // Core cache operations
  get(key: string): Promise<any>;
  set(key: string, value: any, options?: CacheOptions): void;
  clear(): void;
  destroy(): void;

  // Intelligent caching
  generateIntelligentCacheKey(request: any, context?: any): string;
  shouldUseIntelligentCache(request: any): boolean;
  getIntelligentTTL(request?: any): number;

  // Statistics and monitoring
  getCacheStats(): any;
  getIntelligentCacheStats(): EnhancedCacheStats;

  // Health check caching
  getHealthCheckCache(): Map<string, { healthy: boolean; timestamp: number }>;
  setHealthCheck(key: string, healthy: boolean): void;
  isHealthCheckCached(key: string, ttl: number): boolean;
}

/**
 * CacheCoordinator Implementation
 * Centralizes all caching operations with intelligent strategies
 */
export class CacheCoordinator implements ICacheCoordinator {
  private cache = unifiedCache;
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 500;
  private readonly HEALTH_CACHE_TTL = 30000; // 30 seconds

  // Cache statistics tracking
  private cacheStats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    hitRate: '0%',
    totalRequests: 0,
  };

  // Health check caching
  private healthCheckCache: Map<string, { healthy: boolean; timestamp: number }> = new Map();

  constructor() {
    this.updateCacheStats();
  }

  /**
   * Enhanced cache getter with hit tracking
   */
  async get(key: string): Promise<any> {
    const cached = await this.cache.get(key);

    if (cached?.hit) {
      this.cacheStats.hits++;

      // Update hit count for intelligence
      if (cached.metadata?.cachedAt) {
        const age = Math.round((Date.now() - cached.metadata.cachedAt) / 1000);
        console.log(
          `🧠 Cache hit! (source: ${cached.source}, age: ${age}s, similarity: ${cached.similarity || 'exact'})`
        );
      }

      this.updateCacheStats();
      return cached.value;
    } else {
      this.cacheStats.misses++;
      console.log('🧠 Cache miss');
      this.updateCacheStats();
      return null;
    }
  }

  /**
   * Enhanced cache setter with intelligent TTL and monitoring
   */
  set(key: string, value: any, options?: CacheOptions): void {
    try {
      const ttl = options?.ttl || this.getIntelligentTTL();

      // Store with metadata in unified cache system
      this.cache.set(key, value, {
        ttl: ttl,
        metadata: options?.metadata || {
          cachedAt: Date.now(),
          requestType: 'general',
          hitCount: 0,
        },
      });
      this.cacheStats.sets++;

      console.log(`🧠 Response cached with intelligent TTL: ${Math.round(ttl / 1000)}s`);
    } catch (error) {
      // Fallback to basic caching
      this.cache.set(key, value, { ttl: options?.ttl || this.CACHE_TTL });
      this.cacheStats.sets++;
      logger.warn('Fallback to basic caching due to error:', error);
    }

    this.updateCacheStats();
  }

  /**
   * Generate intelligent cache key based on request content and context
   */
  generateIntelligentCacheKey(request: any, context?: any): string {
    // Create content fingerprint for cache key
    const contextFingerprint = context
      ? JSON.stringify({
          files: Array.isArray(context.files) ? context.files.map((f: any) => f.path) : [],
          projectType: context.projectType || 'unknown',
          timestamp: Math.floor(Date.now() / 300000), // 5-minute time buckets
        })
      : '';

    const requestFingerprint = JSON.stringify({
      prompt: this.normalizePromptForCaching(request.prompt || ''),
      model: request.model || 'default',
      temperature: request.temperature || 0.7,
      maxTokens: request.maxTokens || 4000,
    });

    // Create base64 hash for efficient storage
    const combinedContent = requestFingerprint + contextFingerprint;
    const cacheKey = Buffer.from(combinedContent).toString('base64').slice(0, 32);

    console.log(
      `🧠 Cache key generated: ${cacheKey.slice(0, 16)}... (prompt: ${(request.prompt || '').slice(0, 50)}...)`
    );
    return cacheKey;
  }

  /**
   * Normalize prompt for consistent caching
   */
  private normalizePromptForCaching(prompt: string): string {
    return prompt
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s]/g, '') // Remove special characters
      .slice(0, 500); // Limit length for cache key efficiency
  }

  /**
   * Determine intelligent TTL based on request characteristics
   */
  getIntelligentTTL(request?: any): number {
    if (!request) return this.CACHE_TTL;

    const prompt = request.prompt || '';
    const promptLength = prompt.length;

    // Longer, more complex prompts get longer cache time
    if (promptLength > 1000) return 1800000; // 30 minutes
    if (promptLength > 500) return 900000; // 15 minutes
    if (promptLength > 200) return 600000; // 10 minutes

    // Code-related requests get longer cache time
    if (/code|function|class|implement|debug/.test(prompt.toLowerCase())) {
      return 900000; // 15 minutes
    }

    // Real-time or time-sensitive requests get shorter cache time
    if (/now|current|today|latest|realtime|live/.test(prompt.toLowerCase())) {
      return 60000; // 1 minute
    }

    return this.CACHE_TTL; // Default 5 minutes
  }

  /**
   * Check if request should be cached
   */
  shouldUseIntelligentCache(request: any): boolean {
    const prompt = request.prompt || '';

    // Don't cache very short prompts or streaming requests
    if (prompt.length < 20 || request.stream) {
      return false;
    }

    // Don't cache real-time or time-sensitive requests
    if (/now|current|today|latest|realtime|live/.test(prompt.toLowerCase())) {
      return false;
    }

    return true;
  }

  /**
   * Classify request type for intelligent caching
   */
  private classifyRequestType(request?: any): string {
    if (!request?.prompt) return 'unknown';

    const prompt = request.prompt.toLowerCase();

    if (/code|function|class|implement|debug|fix|refactor/.test(prompt)) {
      return 'code_generation';
    }
    if (/explain|describe|what|how|why/.test(prompt)) {
      return 'explanation';
    }
    if (/analyze|review|assess|evaluate/.test(prompt)) {
      return 'analysis';
    }
    if (/create|generate|write|build|make/.test(prompt)) {
      return 'creation';
    }

    return 'general';
  }

  /**
   * Update cache statistics with hit rate calculation
   */
  private updateCacheStats(): void {
    this.cacheStats.totalRequests = this.cacheStats.hits + this.cacheStats.misses;
    this.cacheStats.hitRate =
      this.cacheStats.totalRequests > 0
        ? ((this.cacheStats.hits / this.cacheStats.totalRequests) * 100).toFixed(1) + '%'
        : '0%';
  }

  /**
   * Get basic cache statistics
   */
  getCacheStats(): any {
    return this.cache.getStats();
  }

  /**
   * Get intelligent cache statistics with hit rates and persistence info
   */
  getIntelligentCacheStats(): EnhancedCacheStats {
    const enhancedStats = this.cache.getStats();

    return {
      basic: enhancedStats,
      intelligence: {
        ...this.cacheStats,
      },
    };
  }

  /**
   * Health check cache management
   */
  getHealthCheckCache(): Map<string, { healthy: boolean; timestamp: number }> {
    return this.healthCheckCache;
  }

  setHealthCheck(key: string, healthy: boolean): void {
    this.healthCheckCache.set(key, { healthy, timestamp: Date.now() });
  }

  isHealthCheckCached(key: string, ttl: number = this.HEALTH_CACHE_TTL): boolean {
    const cached = this.healthCheckCache.get(key);
    return cached ? Date.now() - cached.timestamp < ttl : false;
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.cache.clear();
    this.healthCheckCache.clear();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      hitRate: '0%',
      totalRequests: 0,
    };
  }

  /**
   * Destroy cache coordinator and persist data
   */
  destroy(): void {
    console.log('🗃️ Saving cache before shutdown...');
    this.cache.destroy();
    this.healthCheckCache.clear();
  }
}
