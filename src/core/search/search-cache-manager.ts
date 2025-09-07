/**
 * Search Cache Manager Module
 * 
 * Manages caching of search results with TTL and smart invalidation.
 */

import type { ParsedSearchResult } from './search-result-parser.js';
import type { RAGQuery } from './types.js';

export interface CacheEntry {
  result: ParsedSearchResult;
  timestamp: number;
  ttl: number;
  queryHash: string;
  accessCount: number;
  lastAccess: number;
}

export interface CacheOptions {
  maxEntries?: number;
  defaultTtl?: number;
  enableCompression?: boolean;
  persistToDisk?: boolean;
}

export class SearchCacheManager {
  private cache = new Map<string, CacheEntry>();
  private readonly options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxEntries: 1000,
      defaultTtl: 300000, // 5 minutes
      enableCompression: false,
      persistToDisk: false,
      ...options,
    };
  }

  public get(query: RAGQuery): ParsedSearchResult | null {
    const key = this.generateKey(query);
    const entry = this.cache.get(key);

    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    entry.accessCount++;
    entry.lastAccess = Date.now();
    return entry.result;
  }

  public set(query: RAGQuery, result: ParsedSearchResult): void {
    const key = this.generateKey(query);
    const entry: CacheEntry = {
      result,
      timestamp: Date.now(),
      ttl: this.options.defaultTtl,
      queryHash: key,
      accessCount: 0,
      lastAccess: Date.now(),
    };

    this.cache.set(key, entry);
    this.cleanup();
  }

  private generateKey(query: RAGQuery): string {
    return `${query.query}_${query.queryType}_${query.maxResults || 'default'}_${query.useRegex || false}`;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private cleanup(): void {
    if (this.cache.size <= this.options.maxEntries) return;

    // Remove expired entries first
    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      }
    }

    // If still over limit, remove least recently used
    if (this.cache.size > this.options.maxEntries) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
      
      const toRemove = entries.slice(0, entries.length - this.options.maxEntries);
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }
}