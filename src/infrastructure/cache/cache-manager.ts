/**
 * Cache Manager - Infrastructure Cache Module
 * Basic cache management functionality
 */

import { logger } from '../../core/logger.js';

export interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  enableCleanup: boolean;
  cleanupInterval: number;
}

export class CacheManager {
  private cache: Map<string, { value: any; timestamp: number; ttl: number }> = new Map();
  private config: CacheConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      defaultTTL: 300000, // 5 minutes
      maxSize: 1000,
      enableCleanup: true,
      cleanupInterval: 60000, // 1 minute
      ...config
    };

    if (this.config.enableCleanup) {
      this.startCleanup();
    }
  }

  set(key: string, value: any, ttl?: number): void {
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  private evictOldest(): void {
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
        }
      }
    }, this.config.cleanupInterval);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}