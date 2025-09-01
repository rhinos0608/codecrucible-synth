/**
 * Advanced Search Cache Manager for CodeCrucible Synth
 * Implements file-hash based cache invalidation and performance optimization
 * Based on research findings from RIPGREP_FIND_SEARCH_RESEARCH_2025-08-25
 */

import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import { createLogger } from '../logger.js';
import { ILogger } from '../../domain/interfaces/logger.js';

export interface CacheEntry {
  query: string;
  queryHash: string;
  results: unknown; // Generic type for search results
  timestamp: number;
  fileHashes: Record<string, string>;
  searchMethod: 'ripgrep' | 'rag' | 'hybrid' | 'find';
  queryType: string;
  confidence: number;
  performance: {
    duration: number;
    memoryUsage: number;
    resultCount: number;
  };
}

export interface CacheConfig {
  maxCacheSize: number; // Maximum number of cache entries
  maxCacheAge: number; // Maximum age in milliseconds
  enableFileHashTracking: boolean; // Track file modifications
  enablePerformanceMetrics: boolean;
  compactionInterval: number; // Cache cleanup interval
  compressionThreshold: number; // Result size threshold for compression
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  averageHitTime: number;
  averageMissTime: number;
  memoryUsage: number;
  oldestEntry: Date;
  newestEntry: Date;
  invalidationRate: number;
  compressionRatio: number;
}

/**
 * Advanced caching system with file-hash based invalidation
 */
export class AdvancedSearchCacheManager {
  private logger: ILogger;
  private config: CacheConfig;
  private cache = new Map<string, CacheEntry>();
  private accessTimes = new Map<string, number>();
  private hitCount = 0;
  private missCount = 0;
  private invalidationCount = 0;
  private compactionTimer?: NodeJS.Timeout;
  private fileWatchMap = new Map<string, string>(); // file -> last hash

  constructor(config: Partial<CacheConfig> = {}) {
    this.logger = createLogger('AdvancedSearchCache');
    this.config = {
      maxCacheSize: config.maxCacheSize ?? 1000,
      maxCacheAge: config.maxCacheAge ?? 5 * 60 * 1000, // 5 minutes
      enableFileHashTracking: config.enableFileHashTracking ?? true,
      enablePerformanceMetrics: config.enablePerformanceMetrics ?? true,
      compactionInterval: config.compactionInterval ?? 60000, // 1 minute
      compressionThreshold: config.compressionThreshold ?? 10000, // 10KB
    };

    this.startCompactionTimer();
    this.logger.info('🧠 Advanced search cache initialized');
  }

  /**
   * Get cached results with sophisticated invalidation logic
   */
  async getCachedResults<T>(
    queryKey: string,
    options: {
      checkFileModifications?: boolean;
      maxAge?: number;
      includePartialMatches?: boolean;
    } = {}
  ): Promise<T | null> {
    const startTime = Date.now();

    try {
      const entry = this.cache.get(queryKey);
      if (!entry) {
        this.recordMiss(Date.now() - startTime);
        return null;
      }

      // Check age-based expiration
      const maxAge = options.maxAge ?? this.config.maxCacheAge;
      if (Date.now() - entry.timestamp > maxAge) {
        this.logger.debug(`Cache entry expired: ${queryKey}`);
        this.cache.delete(queryKey);
        this.recordMiss(Date.now() - startTime);
        return null;
      }

      // Check file modifications if enabled
      if (this.config.enableFileHashTracking && options.checkFileModifications) {
        const filesChanged = await this.haveFilesChanged(entry.fileHashes);
        if (filesChanged) {
          this.logger.debug(`Files changed, invalidating cache: ${queryKey}`);
          this.cache.delete(queryKey);
          this.invalidationCount++;
          this.recordMiss(Date.now() - startTime);
          return null;
        }
      }

      // Update access time for LRU
      this.accessTimes.set(queryKey, Date.now());
      this.recordHit(Date.now() - startTime);

      this.logger.debug(`Cache hit: ${queryKey}`);
      return entry.results as T;
    } catch (error) {
      this.logger.error('Error retrieving from cache:', error);
      this.recordMiss(Date.now() - startTime);
      return null;
    }
  }

  /**
   * Set cached results with comprehensive metadata
   */
  async setCachedResults<T>(
    queryKey: string,
    results: T,
    metadata: {
      searchMethod: 'ripgrep' | 'rag' | 'hybrid' | 'find';
      queryType: string;
      confidence: number;
      duration: number;
      filePaths?: string[];
    }
  ): Promise<void> {
    try {
      // Generate file hashes for cache invalidation
      const fileHashes: Record<string, string> = {};
      if (this.config.enableFileHashTracking && metadata.filePaths) {
        for (const filePath of metadata.filePaths) {
          try {
            const hash = await this.hashFile(filePath);
            fileHashes[filePath] = hash;
            this.fileWatchMap.set(filePath, hash);
          } catch (error) {
            this.logger.debug(`Failed to hash file ${filePath}:`, error);
          }
        }
      }

      // Create cache entry
      const entry: CacheEntry = {
        query: queryKey,
        queryHash: this.hashQuery(queryKey),
        results,
        timestamp: Date.now(),
        fileHashes,
        searchMethod: metadata.searchMethod,
        queryType: metadata.queryType,
        confidence: metadata.confidence,
        performance: {
          duration: metadata.duration,
          memoryUsage: process.memoryUsage().heapUsed,
          resultCount: this.getResultCount(results),
        },
      };

      // Compress large results if configured
      if (this.shouldCompressEntry(entry)) {
        entry.results = await this.compressResults(entry.results);
      }

      // Store in cache
      this.cache.set(queryKey, entry);
      this.accessTimes.set(queryKey, Date.now());

      // Trigger cleanup if needed
      if (this.cache.size > this.config.maxCacheSize) {
        await this.performMaintenance();
      }

      this.logger.debug(`Cached results: ${queryKey} (${metadata.searchMethod})`);
    } catch (error) {
      this.logger.error('Error caching results:', error);
    }
  }

  /**
   * Intelligent cache invalidation based on file patterns
   */
  async invalidateByPattern(pattern: {
    filePattern?: RegExp;
    queryPattern?: RegExp;
    searchMethod?: string;
    olderThan?: number;
  }): Promise<number> {
    let invalidatedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      let shouldInvalidate = false;

      // Check file pattern
      if (pattern.filePattern && entry.fileHashes) {
        for (const filePath of Object.keys(entry.fileHashes)) {
          if (pattern.filePattern.test(filePath)) {
            shouldInvalidate = true;
            break;
          }
        }
      }

      // Check query pattern
      if (pattern.queryPattern && pattern.queryPattern.test(entry.query)) {
        shouldInvalidate = true;
      }

      // Check search method
      if (pattern.searchMethod && entry.searchMethod === pattern.searchMethod) {
        shouldInvalidate = true;
      }

      // Check age
      if (pattern.olderThan && Date.now() - entry.timestamp > pattern.olderThan) {
        shouldInvalidate = true;
      }

      if (shouldInvalidate) {
        this.cache.delete(key);
        this.accessTimes.delete(key);
        invalidatedCount++;
      }
    }

    if (invalidatedCount > 0) {
      this.logger.info(`Invalidated ${invalidatedCount} cache entries by pattern`);
    }

    return invalidatedCount;
  }

  /**
   * Preload cache with common search patterns
   */
  async preloadCommonPatterns(
    patterns: {
      query: string;
      searchMethod: 'ripgrep' | 'rag' | 'hybrid';
      executor: () => Promise<unknown>;
    }[]
  ): Promise<void> {
    this.logger.info(`Preloading ${patterns.length} common search patterns`);

    const preloadPromises = patterns.map(async pattern => {
      const queryKey = this.generateQueryKey(pattern.query, { type: 'preload' });

      // Skip if already cached
      if (this.cache.has(queryKey)) {
        return;
      }

      try {
        const startTime = Date.now();
        const results = await pattern.executor();
        const duration = Date.now() - startTime;

        await this.setCachedResults(queryKey, results, {
          searchMethod: pattern.searchMethod,
          queryType: 'preload',
          confidence: 0.8,
          duration,
        });
      } catch (error) {
        this.logger.debug(`Failed to preload pattern "${pattern.query}":`, error);
      }
    });

    await Promise.allSettled(preloadPromises);
    this.logger.info('Cache preloading completed');
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    const totalQueries = this.hitCount + this.missCount;
    const hitRate = totalQueries > 0 ? this.hitCount / totalQueries : 0;
    const missRate = totalQueries > 0 ? this.missCount / totalQueries : 0;

    let memoryUsage = 0;
    let oldestTimestamp = Date.now();
    let newestTimestamp = 0;
    let totalResultSize = 0;
    let compressedSize = 0;

    for (const entry of this.cache.values()) {
      memoryUsage += this.estimateEntrySize(entry);
      oldestTimestamp = Math.min(oldestTimestamp, entry.timestamp);
      newestTimestamp = Math.max(newestTimestamp, entry.timestamp);

      const resultSize = JSON.stringify(entry.results).length;
      totalResultSize += resultSize;
      // Simplified compression ratio calculation
      compressedSize += resultSize * 0.7; // Assume 30% compression
    }

    const invalidationRate = totalQueries > 0 ? this.invalidationCount / totalQueries : 0;
    const compressionRatio = totalResultSize > 0 ? compressedSize / totalResultSize : 0;

    return {
      totalEntries: this.cache.size,
      hitRate,
      missRate,
      averageHitTime: 0, // Would need to track this
      averageMissTime: 0, // Would need to track this
      memoryUsage: memoryUsage / 1024 / 1024, // MB
      oldestEntry: new Date(oldestTimestamp),
      newestEntry: new Date(newestTimestamp),
      invalidationRate,
      compressionRatio,
    };
  }

  /**
   * Export cache for analysis or backup
   */
  async exportCache(filePath: string): Promise<void> {
    const cacheData = {
      metadata: {
        exportTime: new Date().toISOString(),
        totalEntries: this.cache.size,
        config: this.config,
      },
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        ...entry,
        results: 'REDACTED', // Don't export actual results for privacy
      })),
      stats: this.getStats(),
    };

    await fs.writeFile(filePath, JSON.stringify(cacheData, null, 2));
    this.logger.info(`Cache exported to ${filePath}`);
  }

  /**
   * Clear all cache entries
   */
  async clearCache(): Promise<void> {
    const entriesCleared = this.cache.size;
    this.cache.clear();
    this.accessTimes.clear();
    this.fileWatchMap.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.invalidationCount = 0;

    this.logger.info(`Cache cleared (${entriesCleared} entries removed)`);
  }

  /**
   * Shutdown cache manager
   */
  async shutdown(): Promise<void> {
    if (this.compactionTimer) {
      clearInterval(this.compactionTimer);
    }

    this.logger.info('Advanced search cache shut down');
  }

  /**
   * Private helper methods
   */

  private async haveFilesChanged(fileHashes: Record<string, string>): Promise<boolean> {
    for (const [filePath, expectedHash] of Object.entries(fileHashes)) {
      try {
        const currentHash = await this.hashFile(filePath);
        if (currentHash !== expectedHash) {
          this.logger.debug(`File modified: ${filePath}`);
          return true;
        }
      } catch (error) {
        // File might have been deleted
        this.logger.debug(`File access error: ${filePath}`);
        return true;
      }
    }
    return false;
  }

  private async hashFile(filePath: string): Promise<string> {
    try {
      const stats = await fs.stat(filePath);
      // Use modification time and size as a fast hash
      return `${stats.mtime.getTime()}-${stats.size}`;
    } catch (error) {
      return 'not-found';
    }
  }

  private hashQuery(query: string): string {
    return createHash('md5').update(query).digest('hex');
  }

  private generateQueryKey(query: string, options: Record<string, unknown>): string {
    const queryObj = {
      query,
      ...options,
      timestamp: Math.floor(Date.now() / 60000), // 1-minute granularity
    };
    return this.hashQuery(JSON.stringify(queryObj));
  }

  private shouldCompressEntry(entry: CacheEntry): boolean {
    const resultSize = JSON.stringify(entry.results).length;
    return resultSize > this.config.compressionThreshold;
  }

  private async compressResults<T>(results: T): Promise<T> {
    // Simplified compression - in production, use actual compression
    // For now, just return as-is
    return results;
  }

  private getResultCount(results: unknown): number {
    if (Array.isArray(results)) {
      return results.length;
    }
    if (results && typeof results === 'object' && 'documents' in results) {
      const documentsArray = (results as any).documents;
      return Array.isArray(documentsArray) ? documentsArray.length : 0;
    }
    return 1;
  }

  private estimateEntrySize(entry: CacheEntry): number {
    // Rough estimation of entry memory usage
    return JSON.stringify(entry).length * 2; // Factor for object overhead
  }

  private recordHit(_duration: number): void {
    this.hitCount++;
    if (this.config.enablePerformanceMetrics) {
      // Could store hit duration metrics here
    }
  }

  private recordMiss(_duration: number): void {
    this.missCount++;
    if (this.config.enablePerformanceMetrics) {
      // Could store miss duration metrics here
    }
  }

  private startCompactionTimer(): void {
    this.compactionTimer = setInterval(() => {
      // TODO: Store interval ID and call clearInterval in cleanup
      this.performMaintenance().catch(error => this.logger.error('Maintenance error:', error));
    }, this.config.compactionInterval);
  }

  private async performMaintenance(): Promise<void> {
    const beforeSize = this.cache.size;

    // Remove expired entries
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.maxCacheAge) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries
    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.accessTimes.delete(key);
    }

    // If still over limit, remove least recently used entries
    if (this.cache.size > this.config.maxCacheSize) {
      const sortedByAccess = Array.from(this.accessTimes.entries()).sort(([, a], [, b]) => a - b);

      const toRemove = this.cache.size - this.config.maxCacheSize;
      for (let i = 0; i < toRemove && i < sortedByAccess.length; i++) {
        const [key] = sortedByAccess[i];
        this.cache.delete(key);
        this.accessTimes.delete(key);
      }
    }

    const afterSize = this.cache.size;
    if (beforeSize !== afterSize) {
      this.logger.debug(`Cache maintenance: ${beforeSize} -> ${afterSize} entries`);
    }
  }
}

/**
 * Cache-aware search wrapper that handles caching automatically
 */
export class CachedSearchExecutor {
  private cache: AdvancedSearchCacheManager;
  private logger: ILogger;

  constructor(cache: AdvancedSearchCacheManager) {
    this.cache = cache;
    this.logger = createLogger('CachedSearchExecutor');
  }

  /**
   * Execute search with automatic caching
   */
  async executeWithCache<T>(
    searchKey: string,
    searchFunction: () => Promise<T>,
    options: {
      searchMethod: 'ripgrep' | 'rag' | 'hybrid' | 'find';
      queryType: string;
      filePaths?: string[];
      confidence?: number;
      maxAge?: number;
      bypassCache?: boolean;
    }
  ): Promise<T> {
    // Check cache first unless bypassed
    if (!options.bypassCache) {
      const cached = await this.cache.getCachedResults<T>(searchKey, {
        checkFileModifications: true,
        maxAge: options.maxAge,
      });

      if (cached) {
        this.logger.debug(`Cache hit for: ${searchKey}`);
        return cached;
      }
    }

    // Execute search
    const startTime = Date.now();
    const results = await searchFunction();
    const duration = Date.now() - startTime;

    // Cache results
    await this.cache.setCachedResults(searchKey, results, {
      searchMethod: options.searchMethod,
      queryType: options.queryType,
      confidence: options.confidence ?? 0.8,
      duration,
      filePaths: options.filePaths,
    });

    this.logger.debug(`Executed and cached: ${searchKey} (${duration}ms)`);
    return results;
  }
}
