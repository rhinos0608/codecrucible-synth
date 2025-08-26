/**
 * Enterprise Caching System
 * Implements multi-layer caching with Redis, memory, and intelligent invalidation
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import { logger } from '../logger.js';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  expiresAt: number;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  tags: string[];
  metadata?: Record<string, any>;
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  checkInterval: number;
  enableCompression: boolean;
  enableEncryption: boolean;
  encryptionKey?: string;
  layers: {
    memory: {
      enabled: boolean;
      maxSize: number;
      algorithm: 'lru' | 'lfu' | 'fifo';
    };
    redis: {
      enabled: boolean;
      host: string;
      port: number;
      password?: string;
      db: number;
      keyPrefix: string;
    };
    disk: {
      enabled: boolean;
      path: string;
      maxSize: string;
    };
  };
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  hitRate: number;
  memoryUsage: number;
  keyCount: number;
  lastCleanup: Date;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  compress?: boolean;
  encrypt?: boolean;
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, any>;
}

/**
 * LRU Cache implementation
 */
class LRUCache<T> {
  private maxSize: number;
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>();
  private currentTime = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiration
    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }

    // Update access tracking
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.accessOrder.set(key, ++this.currentTime);

    return entry;
  }

  set(key: string, entry: CacheEntry<T>): void {
    // Remove existing entry
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }

    // Evict if necessary
    while (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // Add new entry
    this.cache.set(key, entry);
    this.accessOrder.set(key, ++this.currentTime);
  }

  delete(key: string): boolean {
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  entries(): Array<[string, CacheEntry<T>]> {
    return Array.from(this.cache.entries());
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, time] of this.accessOrder.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }
}

/**
 * Redis Cache Layer - Real Redis implementation with fallback
 */
class RedisCache {
  private client: any = null;
  private mockStorage = new Map<string, string>();
  private config: CacheConfig['layers']['redis'];
  private isConnected = false;
  private useRealRedis = false;

  constructor(config: CacheConfig['layers']['redis']) {
    this.config = config;
    this.initializeRedis().catch(() => {
      console.warn('Redis connection failed, using in-memory fallback');
    });
  }

  private async initializeRedis(): Promise<void> {
    try {
      const { createClient } = await import('redis');

      const redisUrl = `redis://${this.config.host || 'localhost'}:${this.config.port || 6379}`;

      this.client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
        },
      });

      this.client.on('error', (err: Error) => {
        console.warn('Redis connection error, falling back to in-memory cache:', err.message);
        this.isConnected = false;
        this.useRealRedis = false;
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.useRealRedis = true;
      });

      await this.client.connect();
    } catch (error) {
      console.warn('Redis initialization failed, using in-memory fallback:', error);
      this.useRealRedis = false;
    }
  }

  async get(key: string): Promise<string | null> {
    const fullKey = `${this.config.keyPrefix}${key}`;

    if (this.useRealRedis && this.isConnected && this.client) {
      try {
        return await this.client.get(fullKey);
      } catch (error) {
        console.warn('Redis get failed, using fallback:', error);
        this.useRealRedis = false;
      }
    }

    // Fallback to in-memory storage
    return this.mockStorage.get(fullKey) || null;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const fullKey = `${this.config.keyPrefix}${key}`;

    if (this.useRealRedis && this.isConnected && this.client) {
      try {
        if (ttl) {
          await this.client.setEx(fullKey, ttl, value);
        } else {
          await this.client.set(fullKey, value);
        }
        return;
      } catch (error) {
        console.warn('Redis set failed, using fallback:', error);
        this.useRealRedis = false;
      }
    }

    // Fallback to in-memory storage
    this.mockStorage.set(fullKey, value);
    if (ttl) {
      setTimeout(() => {
        this.mockStorage.delete(fullKey);
      }, ttl * 1000);
    }
  }

  async delete(key: string): Promise<boolean> {
    const fullKey = `${this.config.keyPrefix}${key}`;

    if (this.useRealRedis && this.isConnected && this.client) {
      try {
        const result = await this.client.del(fullKey);
        return result > 0;
      } catch (error) {
        console.warn('Redis delete failed, using fallback:', error);
        this.useRealRedis = false;
      }
    }

    // Fallback to in-memory storage
    return this.mockStorage.delete(fullKey);
  }

  async clear(): Promise<void> {
    if (this.useRealRedis && this.isConnected && this.client) {
      try {
        const keys = await this.client.keys(`${this.config.keyPrefix}*`);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
        return;
      } catch (error) {
        console.warn('Redis clear failed, using fallback:', error);
        this.useRealRedis = false;
      }
    }

    // Fallback to in-memory storage
    this.mockStorage.clear();
  }

  async keys(pattern: string): Promise<string[]> {
    if (this.useRealRedis && this.isConnected && this.client) {
      try {
        const fullPattern = `${this.config.keyPrefix}${pattern}`;
        return await this.client.keys(fullPattern);
      } catch (error) {
        console.warn('Redis keys failed, using fallback:', error);
        this.useRealRedis = false;
      }
    }

    // Fallback to in-memory storage
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.mockStorage.keys()).filter(key => regex.test(key));
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        await this.client.disconnect();
      } catch (error) {
        console.warn('Error disconnecting from Redis:', error);
      }
    }
    this.isConnected = false;
    this.useRealRedis = false;
  }
}

/**
 * Main Cache Manager
 */
export class CacheManager extends EventEmitter {
  private config: CacheConfig;
  private memoryCache: LRUCache<any>;
  private redisCache?: RedisCache;
  private stats: CacheStats;
  private cleanupInterval?: NodeJS.Timeout;
  private encryptionKey?: Buffer;

  constructor(config: Partial<CacheConfig> = {}) {
    super();

    this.config = {
      maxSize: 1000,
      defaultTTL: 3600, // 1 hour
      checkInterval: 60000, // 1 minute
      enableCompression: true,
      enableEncryption: false,
      layers: {
        memory: {
          enabled: true,
          maxSize: 1000,
          algorithm: 'lru',
        },
        redis: {
          enabled: false,
          host: 'localhost',
          port: 6379,
          db: 0,
          keyPrefix: 'codecrucible:',
        },
        disk: {
          enabled: false,
          path: './cache',
          maxSize: '1GB',
        },
      },
      ...config,
    };

    this.memoryCache = new LRUCache(this.config.layers.memory.maxSize);

    if (this.config.layers.redis.enabled) {
      this.redisCache = new RedisCache(this.config.layers.redis);
    }

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      hitRate: 0,
      memoryUsage: 0,
      keyCount: 0,
      lastCleanup: new Date(),
    };

    if (this.config.enableEncryption && this.config.encryptionKey) {
      this.encryptionKey = Buffer.from(this.config.encryptionKey, 'hex');
    }

    this.startCleanupTimer();
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const cacheKey = this.generateCacheKey(key);

      // Try memory cache first
      if (this.config.layers.memory.enabled) {
        const memoryEntry = this.memoryCache.get(cacheKey);
        if (memoryEntry) {
          this.stats.hits++;
          this.updateHitRate();

          logger.debug('Cache hit (memory)', { key: cacheKey });
          this.emit('cache-hit', { key: cacheKey, layer: 'memory' });

          return this.deserializeValue(memoryEntry.value);
        }
      }

      // Try Redis cache
      if (this.config.layers.redis.enabled && this.redisCache) {
        const redisValue = await this.redisCache.get(cacheKey);
        if (redisValue) {
          const entry: CacheEntry<T> = JSON.parse(redisValue);

          // Check expiration
          if (entry.expiresAt === 0 || Date.now() < entry.expiresAt) {
            this.stats.hits++;
            this.updateHitRate();

            // Promote to memory cache
            if (this.config.layers.memory.enabled) {
              this.memoryCache.set(cacheKey, entry);
            }

            logger.debug('Cache hit (redis)', { key: cacheKey });
            this.emit('cache-hit', { key: cacheKey, layer: 'redis' });

            return this.deserializeValue(entry.value);
          } else {
            // Expired, remove from Redis
            await this.redisCache.delete(cacheKey);
          }
        }
      }

      // Cache miss
      this.stats.misses++;
      this.updateHitRate();

      logger.debug('Cache miss', { key: cacheKey });
      this.emit('cache-miss', { key: cacheKey });

      return null;
    } catch (error) {
      logger.error('Cache get error', error as Error, { key });
      this.emit('cache-error', { operation: 'get', key, error });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(key);
      const now = Date.now();
      const ttl = options.ttl || this.config.defaultTTL;
      const expiresAt = ttl > 0 ? now + ttl * 1000 : 0;

      const entry: CacheEntry<T> = {
        key: cacheKey,
        value: await this.serializeValue(value, options),
        expiresAt,
        createdAt: now,
        lastAccessed: now,
        accessCount: 0,
        tags: options.tags || [],
        metadata: options.metadata,
      };

      // Store in memory cache
      if (this.config.layers.memory.enabled) {
        this.memoryCache.set(cacheKey, entry);
      }

      // Store in Redis cache
      if (this.config.layers.redis.enabled && this.redisCache) {
        const serialized = JSON.stringify(entry);
        await this.redisCache.set(cacheKey, serialized, ttl);
      }

      this.stats.sets++;
      this.updateStats();

      logger.debug('Cache set', {
        key: cacheKey,
        ttl,
        tags: options.tags,
        compressed: options.compress,
        encrypted: options.encrypt,
      });

      this.emit('cache-set', { key: cacheKey, ttl, options });
    } catch (error) {
      logger.error('Cache set error', error as Error, { key });
      this.emit('cache-error', { operation: 'set', key, error });
      throw error;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(key);
      let deleted = false;

      // Delete from memory cache
      if (this.config.layers.memory.enabled) {
        deleted = this.memoryCache.delete(cacheKey) || deleted;
      }

      // Delete from Redis cache
      if (this.config.layers.redis.enabled && this.redisCache) {
        deleted = (await this.redisCache.delete(cacheKey)) || deleted;
      }

      if (deleted) {
        this.stats.deletes++;
        this.updateStats();

        logger.debug('Cache delete', { key: cacheKey });
        this.emit('cache-delete', { key: cacheKey });
      }

      return deleted;
    } catch (error) {
      logger.error('Cache delete error', error as Error, { key });
      this.emit('cache-error', { operation: 'delete', key, error });
      return false;
    }
  }

  /**
   * Clear cache by tags
   */
  async deleteByTags(tags: string[]): Promise<number> {
    try {
      let deletedCount = 0;

      // Clear from memory cache
      if (this.config.layers.memory.enabled) {
        const entries = this.memoryCache.entries();
        for (const [key, entry] of entries) {
          if (entry.tags.some(tag => tags.includes(tag))) {
            this.memoryCache.delete(key);
            deletedCount++;
          }
        }
      }

      // Clear from Redis cache
      if (this.config.layers.redis.enabled && this.redisCache) {
        const keys = await this.redisCache.keys('*');
        for (const key of keys) {
          const value = await this.redisCache.get(key);
          if (value) {
            try {
              const entry = JSON.parse(value);
              if (entry.tags?.some((tag: string) => tags.includes(tag))) {
                await this.redisCache.delete(key);
                deletedCount++;
              }
            } catch {
              // Invalid JSON, skip
            }
          }
        }
      }

      logger.info('Cache cleared by tags', { tags, deletedCount });
      this.emit('cache-clear-tags', { tags, deletedCount });

      return deletedCount;
    } catch (error) {
      logger.error('Cache clear by tags error', error as Error, { tags });
      this.emit('cache-error', { operation: 'clear-tags', tags, error });
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      // Clear memory cache
      if (this.config.layers.memory.enabled) {
        this.memoryCache.clear();
      }

      // Clear Redis cache
      if (this.config.layers.redis.enabled && this.redisCache) {
        await this.redisCache.clear();
      }

      // Reset stats
      this.stats = {
        ...this.stats,
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        hitRate: 0,
        keyCount: 0,
      };

      logger.info('Cache cleared');
      this.emit('cache-clear');
    } catch (error) {
      logger.error('Cache clear error', error as Error);
      this.emit('cache-error', { operation: 'clear', error });
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get or set value with function
   */
  async getOrSet<T = any>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Generate value
      const value = await factory();

      // Store in cache
      await this.set(key, value, options);

      return value;
    } catch (error) {
      logger.error('Cache getOrSet error', error as Error, { key });
      throw error;
    }
  }

  /**
   * Warm up cache with data
   */
  async warmUp(data: Array<{ key: string; value: any; options?: CacheOptions }>): Promise<void> {
    try {
      const promises = data.map(async ({ key, value, options }) => this.set(key, value, options));

      await Promise.allSettled(promises);

      logger.info('Cache warmed up', { entries: data.length });
      this.emit('cache-warmup', { entries: data.length });
    } catch (error) {
      logger.error('Cache warmup error', error as Error);
      throw error;
    }
  }

  /**
   * Generate cache key with namespace
   */
  private generateCacheKey(key: string): string {
    // Create hash for very long keys
    if (key.length > 250) {
      return crypto.createHash('sha256').update(key).digest('hex');
    }

    return key.replace(/[^a-zA-Z0-9_:-]/g, '_');
  }

  /**
   * Serialize value for storage
   */
  private async serializeValue(value: any, options: CacheOptions): Promise<any> {
    let serialized = value;

    // JSON serialize non-primitives
    if (typeof value === 'object' && value !== null) {
      serialized = JSON.stringify(value);
    }

    // Compress if enabled
    if (this.config.enableCompression && options.compress !== false) {
      // In production, use gzip compression
      serialized = `compressed:${serialized}`;
    }

    // Encrypt if enabled
    if (this.config.enableEncryption && options.encrypt !== false && this.encryptionKey) {
      serialized = this.encrypt(serialized);
    }

    return serialized;
  }

  /**
   * Deserialize value from storage
   */
  private async deserializeValue(value: any): Promise<any> {
    let deserialized = value;

    // Decrypt if encrypted
    if (typeof value === 'string' && value.startsWith('encrypted:')) {
      deserialized = this.decrypt(value);
    }

    // Decompress if compressed
    if (typeof deserialized === 'string' && deserialized.startsWith('compressed:')) {
      deserialized = deserialized.substring(11); // Remove 'compressed:' prefix
      // In production, use gzip decompression
    }

    // Parse JSON if it looks like JSON
    if (typeof deserialized === 'string') {
      try {
        if (deserialized.startsWith('{') || deserialized.startsWith('[')) {
          deserialized = JSON.parse(deserialized);
        }
      } catch {
        // Not JSON, return as string
      }
    }

    return deserialized;
  }

  /**
   * Encrypt value
   */
  private encrypt(value: string): string {
    if (!this.encryptionKey) return value;

    const iv = crypto.randomBytes(16);
    // Use secure AES-256-CBC with proper IV instead of deprecated createCipher
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(this.encryptionKey).subarray(0, 32),
      iv
    );

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `encrypted:${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt value
   */
  private decrypt(encryptedValue: string): string {
    if (!this.encryptionKey) return encryptedValue;

    const parts = encryptedValue.split(':');
    if (parts.length !== 3) return encryptedValue;

    const iv = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    // Use secure AES-256-CBC with proper IV instead of deprecated createDecipher
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(this.encryptionKey).subarray(0, 32),
      iv
    );

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    this.stats.keyCount = this.memoryCache.size();
    this.stats.memoryUsage = this.estimateMemoryUsage();
    this.updateHitRate();
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    let total = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      total += key.length * 2; // Approximate string size
      total += JSON.stringify(entry).length * 2; // Approximate entry size
    }

    return total;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.checkInterval);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    try {
      let cleaned = 0;
      const now = Date.now();

      // Clean memory cache
      if (this.config.layers.memory.enabled) {
        const entries = this.memoryCache.entries();
        for (const [key, entry] of entries) {
          if (entry.expiresAt > 0 && now > entry.expiresAt) {
            this.memoryCache.delete(key);
            cleaned++;
          }
        }
      }

      this.stats.evictions += cleaned;
      this.stats.lastCleanup = new Date();
      this.updateStats();

      if (cleaned > 0) {
        logger.debug('Cache cleanup completed', { cleanedEntries: cleaned });
        this.emit('cache-cleanup', { cleanedEntries: cleaned });
      }
    } catch (error) {
      logger.error('Cache cleanup error', error as Error);
    }
  }

  /**
   * Create Express caching middleware
   */
  middleware(
    options: {
      ttl?: number;
      keyGenerator?: (req: any) => string;
      skipIf?: (req: any) => boolean;
      tags?: string[];
    } = {}
  ) {
    return async (req: any, res: any, next: any) => {
      try {
        // Skip caching if specified
        if (options.skipIf && options.skipIf(req)) {
          return next();
        }

        // Generate cache key
        const keyGenerator = options.keyGenerator || this.defaultKeyGenerator;
        const cacheKey = keyGenerator(req);

        // Try to get from cache
        const cached = await this.get(cacheKey);
        if (cached) {
          logger.debug('Serving from cache', { key: cacheKey });
          return res.json(cached);
        }

        // Intercept response
        const originalJson = res.json;
        res.json = async (data: any) => {
          // Cache the response
          try {
            await this.set(cacheKey, data, {
              ttl: options.ttl,
              tags: options.tags,
            });
          } catch (error) {
            logger.error('Failed to cache response', error as Error, { key: cacheKey });
          }

          return originalJson.call(res, data);
        };

        next();
      } catch (error) {
        logger.error('Cache middleware error', error as Error);
        next(); // Continue without caching
      }
    };
  }

  /**
   * Default key generator for middleware
   */
  private defaultKeyGenerator(req: any): string {
    return `${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;
  }

  /**
   * Stop cache manager and cleanup
   */
  async stop(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    await this.clear();

    // Remove all event listeners to prevent memory leaks
    this.removeAllListeners();

    logger.info('Cache manager stopped');
  }
}
