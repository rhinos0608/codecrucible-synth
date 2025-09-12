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
  private readonly cache = new Map<string, CacheEntry>();

  public constructor(private readonly config: Readonly<CacheConfig>) {}

  public get(key: string): RAGResult | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    const age = Date.now() - entry.timestamp;
    if (age > this.config.maxCacheAge) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.result;
  }

  public set(key: string, result: Readonly<RAGResult>): void {
    if (this.cache.size >= this.config.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, { result, timestamp: Date.now() });
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public shutdown(): void {
    this.cache.clear();
  }
}
