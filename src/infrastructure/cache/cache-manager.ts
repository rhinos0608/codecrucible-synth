/**
 * Cache Manager - Infrastructure Cache Module
 * Basic cache management functionality with EventEmitter support
 */

import { EventEmitter } from 'events';
import { logger } from '../../infrastructure/logging/logger.js';

export interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  enableCleanup: boolean;
  cleanupInterval: number;
  checkInterval?: number;
  enableCompression?: boolean;
  enableEncryption?: boolean;
  layers?: {
    memory?: {
      enabled: boolean;
      maxSize: number;
      algorithm: 'lru' | 'lfu';
    };
    redis?: {
      enabled: boolean;
      host: string;
      port: number;
      db: number;
      keyPrefix: string;
    };
    disk?: {
      enabled: boolean;
      path: string;
      maxSize: string;
    };
  };
}

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export class CacheManager extends EventEmitter {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(config?: Partial<CacheConfig>) {
    super();
    this.config = {
      defaultTTL: 300000, // 5 minutes
      maxSize: 1000,
      enableCleanup: true,
      cleanupInterval: 60000, // 1 minute
      checkInterval: 300,
      enableCompression: false,
      enableEncryption: false,
      ...config,
    };

    if (this.config.enableCleanup) {
      this.startCleanup();
    }
  }

  public set<T>(
    key: string,
    value: T,
    options?: { ttl?: number; tags?: string[]; metadata?: Record<string, unknown> }
  ): void {
    try {
      if (this.cache.size >= this.config.maxSize) {
        this.evictOldest();
      }

      const entry: CacheEntry = {
        key,
        value,
        timestamp: Date.now(),
        ttl: options?.ttl || this.config.defaultTTL,
        tags: options?.tags,
        metadata: options?.metadata,
      };

      this.cache.set(key, entry);
      this.emit('set', { key, value });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  public get<T = unknown>(key: string): T | null {
    try {
      const entry = this.cache.get(key);
      if (!entry) {
        this.missCount++;
        this.emit('miss', { key });
        return null;
      }

      if (Date.now() - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        this.missCount++;
        this.emit('miss', { key });
        return null;
      }

      this.hitCount++;
      this.emit('hit', { key, value: entry.value });
      return entry.value as T;
    } catch (error) {
      this.emit('error', error);
      return null;
    }
  }

  public has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  public delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      this.emit('delete', { key });
    }
    return result;
  }

  public clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.emit('clear');
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

  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.emit('stop');
    logger.info('CacheManager stopped');
  }

  public destroy(): void {
    this.stop();
    this.cache.clear();
    this.removeAllListeners();
    logger.info('CacheManager destroyed');
  }

  public getStats(): {
    size: number;
    hitCount: number;
    missCount: number;
    hitRate: number;
    maxSize: number;
    memoryUsage: string;
  } {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate,
      maxSize: this.config.maxSize,
      memoryUsage: `${Math.round((this.cache.size / this.config.maxSize) * 100)}%`,
    };
  }
}
