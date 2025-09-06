import type { RAGResult } from './types.js';

interface CacheEntry {
  result: RAGResult;
  timestamp: number;
}

interface CacheConfig {
  maxCacheSize: number;
  maxCacheAge: number;
}

export class AdvancedSearchCacheManager {
  private cache = new Map<string, CacheEntry>();

  constructor(private config: CacheConfig) {}

  async get(key: string): Promise<RAGResult | undefined> {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    const age = Date.now() - entry.timestamp;
    if (age > this.config.maxCacheAge) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.result;
  }

  async set(key: string, result: RAGResult): Promise<void> {
    if (this.cache.size >= this.config.maxCacheSize) {
      const firstKey = this.cache.keys().next().value as string | undefined;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, { result, timestamp: Date.now() });
  }

  async clearCache(): Promise<void> {
    this.cache.clear();
  }

  async shutdown(): Promise<void> {
    this.cache.clear();
  }
}
