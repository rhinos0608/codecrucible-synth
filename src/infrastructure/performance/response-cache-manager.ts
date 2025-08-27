/**
 * Response Cache Manager - Compatibility Stub
 * 
 * This is a minimal stub to maintain backward compatibility
 * during the architectural migration.
 * 
 * @deprecated Use UnifiedPerformanceSystem caching instead
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class ResponseCacheManager {
  private cache = new Map<string, CacheEntry>();

  set(key: string, data: any, ttl: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    return this.cache.has(key) && this.get(key) !== null;
  }

  getStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: 0, // Stub values
      misses: 0
    };
  }
}

// Export singleton instance for backward compatibility
export const responseCache = new ResponseCacheManager();