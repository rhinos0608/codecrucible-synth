/**
 * Efficient LRU (Least Recently Used) cache implementation
 * Addresses memory leak vulnerability in core/client.ts
 */

export interface CacheEntry<T> {
  value: T;
  expires: number;
  accessCount: number;
  lastAccessed: number;
}

export interface LRUCacheOptions {
  maxSize: number;
  ttl: number; // Time to live in milliseconds
  checkInterval?: number; // Cleanup interval in milliseconds
}

export class LRUCache<T> {
  protected cache = new Map<string, CacheEntry<T>>();
  protected accessOrder: string[] = [];
  private maxSize: number;
  private readonly ttl: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    cleanupRuns: 0,
  };

  constructor(options: LRUCacheOptions) {
    this.maxSize = Math.max(1, options.maxSize);
    this.ttl = Math.max(1000, options.ttl); // Minimum 1 second TTL

    // Set up automatic cleanup with proper cleanup handling
    const checkInterval = options.checkInterval || Math.min(this.ttl / 4, 60000);
    this.cleanupInterval = setInterval(() => {
      try {
        this.cleanup();
      } catch (error) {
        console.error('LRU Cache cleanup error:', error);
      }
    }, checkInterval);

    // Ensure cleanup interval doesn't keep process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.delete(key);
      this.stats.misses++;
      return undefined;
    }

    // Update access tracking for LRU
    this.updateAccess(key, entry);
    this.stats.hits++;

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, customTtl?: number): void {
    const now = Date.now();
    const ttl = customTtl || this.ttl;

    const entry: CacheEntry<T> = {
      value,
      expires: now + ttl,
      accessCount: 1,
      lastAccessed: now,
    };

    // If key already exists, update it
    if (this.cache.has(key)) {
      this.cache.set(key, entry);
      this.updateAccess(key, entry);
      return;
    }

    // Check if we need to evict before adding
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // Add new entry
    this.cache.set(key, entry);
    this.accessOrder.push(key);
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
    }
    return deleted;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expires) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.evictions += this.cache.size;
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate =
      this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
        : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expires) {
        this.delete(key);
        cleaned++;
      }
    }

    this.stats.cleanupRuns++;

    // Log if significant cleanup occurred
    if (cleaned > 0) {
      console.debug(`LRU Cache: Cleaned up ${cleaned} expired entries`);
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    // Find LRU entry (earliest in access order)
    const lruKey = this.accessOrder[0];
    this.delete(lruKey);
    this.stats.evictions++;
  }

  /**
   * Update access tracking for LRU ordering
   */
  private updateAccess(key: string, entry: CacheEntry<T>): void {
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    // Move to end of access order (most recently used)
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order array
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Estimate memory usage (rough calculation)
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;

    for (const [key, entry] of this.cache) {
      // Rough estimation: key size + entry overhead
      totalSize += key.length * 2; // UTF-16 encoding
      totalSize += JSON.stringify(entry.value).length * 2;
      totalSize += 64; // Entry metadata overhead
    }

    return totalSize;
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.clear();
  }

  /**
   * Get keys sorted by access order (debugging)
   */
  getAccessOrder(): string[] {
    return [...this.accessOrder];
  }

  /**
   * Force eviction of multiple entries to free memory
   */
  evict(count: number): number {
    let evicted = 0;

    while (evicted < count && this.accessOrder.length > 0) {
      this.evictLRU();
      evicted++;
    }

    return evicted;
  }

  /**
   * Set new maximum size and evict if necessary
   */
  resize(newMaxSize: number): void {
    this.maxSize = Math.max(1, newMaxSize);

    // Evict entries if current size exceeds new max
    while (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }
}
