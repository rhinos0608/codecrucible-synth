/**
 * Response Cache Manager
 *
 * Hybrid L1 (in-memory, sync) + optional L2 (Redis) write-through cache
 *
 * - Maintains synchronous API for compatibility with existing callers
 * - If Redis is configured (via REDIS_URL), writes are mirrored to Redis
 * - On cache miss, asynchronously prefetches from Redis to warm L1
 */

import { createClient } from 'redis';

interface CacheEntry {
  data: any;
  expiresAt: number; // epoch ms
}

class ResponseCacheManager {
  private cache = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

  private redis?: ReturnType<typeof createClient>;
  private readonly namespace = 'responseCache';

  constructor() {
    // Lazy init Redis only if configured
    const url = process.env.REDIS_URL || '';
    if (url) {
      try {
        this.redis = createClient({ url });
        // Connect in background; ignore failures, fallback to memory only
        this.redis.connect().catch(() => {
          this.redis = undefined;
        });
      } catch {
        this.redis = undefined;
      }
    }
  }

  private now(): number {
    return Date.now();
  }

  private k(key: string): string {
    return `${this.namespace}:${key}`;
  }

  set(key: string, data: any, ttl: number = 300_000): void {
    const expiresAt = this.now() + ttl;
    this.cache.set(key, { data, expiresAt });

    // Asynchronously mirror to Redis if available
    if (this.redis) {
      const payload = JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
      const rkey = this.k(key);
      void this.redis.set(rkey, payload, { EX: Math.ceil(ttl / 1000) }).catch(() => {});
      // Optionally track keys in a set for size estimation
      void this.redis.sAdd(`${this.namespace}:keys`, rkey).catch(() => {});
    }
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > this.now()) {
      this.hits++;
      return entry.data;
    }

    // L1 miss: clean up and report miss
    if (entry) this.cache.delete(key);
    this.misses++;

    // Attempt async L2 prefetch without blocking the caller
    if (this.redis) {
      const rkey = this.k(key);
      void this.redis
        .get(rkey)
        .then(val => {
          if (!val) return;
          try {
            const parsed = JSON.parse(val);
            // Default warm TTL of 60s when prefetched
            this.cache.set(key, { data: parsed, expiresAt: this.now() + 60_000 });
          } catch {
            // ignore parse error
          }
        })
        .catch(() => {});
    }

    return null;
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;

    if (this.redis) {
      const ns = this.namespace;
      // Best-effort cleanup of namespaced keys tracked in the set
      void this.redis
        .sMembers(`${ns}:keys`)
        .then(keys => (keys.length ? this.redis!.del(keys) : undefined))
        .then(() => this.redis!.del(`${ns}:keys`))
        .catch(() => {});
    }
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    return !!entry && entry.expiresAt > this.now();
  }

  getStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

// Export singleton instance for backward compatibility
export const responseCache = new ResponseCacheManager();
