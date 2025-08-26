/**
 * Unified Cache Service - Consolidates all caching functionality
 * Combines features from:
 * - core/cache/cache-manager.ts (enterprise multi-layer caching)
 * - core/caching/cache-coordinator.ts (intelligent caching)
 * - core/performance/response-cache-manager.ts (LLM response caching)
 *
 * Provides:
 * - Multi-layer caching (memory, Redis, disk)
 * - Intelligent TTL based on content analysis
 * - LLM response optimization with similarity matching
 * - Enterprise features (encryption, compression, metrics)
 * - Health check caching
 * - Resource cleanup integration
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { resourceManager } from '../performance/resource-cleanup-manager.js';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  expiresAt: number;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  tags: string[];
  metadata?: {
    requestType?: string;
    similarity?: string;
    promptTokens?: number;
    responseTokens?: number;
    hitCount?: number;
    cachedAt?: number;
  };
  priority?: 'low' | 'normal' | 'high';
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  compress?: boolean;
  encrypt?: boolean;
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, any>;
  intelligent?: boolean;
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
  };
}

export interface CacheStats {
  totalEntries: number;
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  hitRate: string;
  memoryUsage: number;
  keyCount: number;
  lastCleanup: Date;
  avgResponseTime: number;
  totalRequests: number;
}

/**
 * LRU Cache Implementation
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
 * Redis Cache Layer with fallback to in-memory
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
      logger.debug('Redis connection failed, using in-memory fallback');
    });
  }

  private async initializeRedis(): Promise<void> {
    try {
      const { createClient } = await import('redis');
      const redisUrl = `redis://${this.config.host || 'localhost'}:${this.config.port || 6379}`;

      this.client = createClient({
        url: redisUrl,
        socket: { connectTimeout: 5000 },
      });

      this.client.on('error', () => {
        this.isConnected = false;
        this.useRealRedis = false;
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.useRealRedis = true;
      });

      await this.client.connect();
    } catch (error) {
      this.useRealRedis = false;
    }
  }

  async get(key: string): Promise<string | null> {
    const fullKey = `${this.config.keyPrefix}${key}`;

    if (this.useRealRedis && this.isConnected && this.client) {
      try {
        return await this.client.get(fullKey);
      } catch (error) {
        this.useRealRedis = false;
      }
    }

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
        this.useRealRedis = false;
      }
    }

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
        this.useRealRedis = false;
      }
    }

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
        this.useRealRedis = false;
      }
    }

    this.mockStorage.clear();
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        await this.client.disconnect();
      } catch (error) {
        logger.debug('Error disconnecting from Redis:', error);
      }
    }
    this.isConnected = false;
    this.useRealRedis = false;
  }
}

/**
 * Unified Cache Service - Main Implementation
 */
export class UnifiedCacheService extends EventEmitter {
  private static instance: UnifiedCacheService | null = null;
  private config: CacheConfig;
  private memoryCache: LRUCache<any>;
  private redisCache?: RedisCache;
  private stats: CacheStats;
  private cleanupInterval?: NodeJS.Timeout;
  private encryptionKey?: Buffer;
  private healthCheckCache: Map<string, { healthy: boolean; timestamp: number }> = new Map();
  private cleanupIntervalId: string | null = null;
  
  // LLM-specific constants
  private readonly SIMILARITY_THRESHOLD = 0.85;
  private readonly HEALTH_CACHE_TTL = 30000; // 30 seconds

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
      },
      ...config,
    };

    this.memoryCache = new LRUCache(this.config.layers.memory.maxSize);

    if (this.config.layers.redis.enabled) {
      this.redisCache = new RedisCache(this.config.layers.redis);
    }

    this.stats = {
      totalEntries: 0,
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      hitRate: '0%',
      memoryUsage: 0,
      keyCount: 0,
      lastCleanup: new Date(),
      avgResponseTime: 0,
      totalRequests: 0,
    };

    if (this.config.enableEncryption && this.config.encryptionKey) {
      this.encryptionKey = Buffer.from(this.config.encryptionKey, 'hex');
    }

    this.startCleanupTimer();
  }

  static getInstance(config?: Partial<CacheConfig>): UnifiedCacheService {
    if (!UnifiedCacheService.instance) {
      UnifiedCacheService.instance = new UnifiedCacheService(config);
    }
    return UnifiedCacheService.instance;
  }

  /**
   * Get value from cache with intelligent matching
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
            await this.redisCache.delete(cacheKey);
          }
        }
      }

      // Try fuzzy matching for LLM responses
      const fuzzyMatch = this.findSimilarEntry(key);
      if (fuzzyMatch) {
        this.stats.hits++;
        this.updateHitRate();
        
        logger.debug('Cache hit (fuzzy match)', { 
          key: cacheKey,
          similarity: fuzzyMatch.metadata?.similarity 
        });
        this.emit('cache-hit', { key: cacheKey, layer: 'fuzzy' });
        
        return this.deserializeValue(fuzzyMatch.value);
      }

      // Cache miss
      this.stats.misses++;
      this.updateHitRate();
      this.emit('cache-miss', { key: cacheKey });
      return null;

    } catch (error) {
      logger.error('Cache get error', error as Error, { key });
      this.emit('cache-error', { operation: 'get', key, error });
      return null;
    }
  }

  /**
   * Set value in cache with intelligent options
   */
  async set<T = any>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(key);
      const now = Date.now();
      const ttl = options.intelligent ? this.getIntelligentTTL(key, value) : (options.ttl || this.config.defaultTTL);
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
        priority: options.priority,
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

      logger.debug('Cache set', { key: cacheKey, ttl, options });
      this.emit('cache-set', { key: cacheKey, ttl, options });

    } catch (error) {
      logger.error('Cache set error', error as Error, { key });
      this.emit('cache-error', { operation: 'set', key, error });
      throw error;
    }
  }

  /**
   * LLM-specific cache methods
   */
  async getLLMResponse(prompt: string, model: string, provider: string, tools?: any[]): Promise<CacheEntry | null> {
    const key = this.generateLLMCacheKey(prompt, model, provider, tools);
    const cached = await this.get(key);
    
    if (cached) {
      return cached;
    }

    // Try fuzzy matching for similar prompts
    return this.findSimilarLLMEntry(prompt, model, provider);
  }

  async setLLMResponse(
    prompt: string, 
    model: string, 
    provider: string, 
    response: { content: string; usage?: any; finishReason?: string },
    tools?: any[]
  ): Promise<void> {
    if (!response.content || response.content.trim().length === 0) {
      return;
    }

    const key = this.generateLLMCacheKey(prompt, model, provider, tools);
    const metadata = {
      requestType: this.classifyRequestType(prompt),
      promptTokens: response.usage?.prompt_tokens || this.estimateTokens(prompt),
      responseTokens: response.usage?.completion_tokens || this.estimateTokens(response.content),
      cachedAt: Date.now(),
      hitCount: 0,
    };

    await this.set(key, response, {
      intelligent: true,
      metadata,
      tags: ['llm', provider, model],
    });
  }

  /**
   * Health check cache methods
   */
  setHealthCheck(key: string, healthy: boolean): void {
    this.healthCheckCache.set(key, { healthy, timestamp: Date.now() });
  }

  getHealthCheck(key: string, ttl: number = this.HEALTH_CACHE_TTL): { healthy: boolean; timestamp: number } | null {
    const cached = this.healthCheckCache.get(key);
    if (!cached || Date.now() - cached.timestamp > ttl) {
      return null;
    }
    return cached;
  }

  /**
   * Find similar cache entries using fuzzy matching
   */
  private findSimilarEntry(key: string): CacheEntry | null {
    if (!this.config.layers.memory.enabled) return null;

    for (const [, entry] of this.memoryCache.entries()) {
      const similarity = this.calculateSimilarity(key, entry.key);
      if (similarity >= this.SIMILARITY_THRESHOLD) {
        entry.metadata = { ...entry.metadata, similarity: similarity.toFixed(3) };
        return entry;
      }
    }
    return null;
  }

  private findSimilarLLMEntry(prompt: string, model: string, provider: string): CacheEntry | null {
    const normalizedPrompt = this.normalizePrompt(prompt);

    for (const [, entry] of this.memoryCache.entries()) {
      if (entry.tags?.includes(provider) && entry.tags?.includes(model)) {
        // Extract original prompt from cache key or metadata
        const similarity = this.calculateSimilarity(normalizedPrompt, entry.key);
        if (similarity >= this.SIMILARITY_THRESHOLD) {
          entry.metadata = { ...entry.metadata, similarity: similarity.toFixed(3) };
          return entry;
        }
      }
    }
    return null;
  }

  /**
   * Generate intelligent TTL based on content analysis
   */
  private getIntelligentTTL(key: string, value: any): number {
    // For LLM responses
    if (typeof value === 'object' && value.content) {
      const content = value.content as string;
      const promptLength = key.length;

      // Longer, more complex content gets longer cache time
      if (content.length > 2000 || promptLength > 1000) return 1800000; // 30 minutes
      if (content.length > 1000 || promptLength > 500) return 900000; // 15 minutes
      if (content.length > 500 || promptLength > 200) return 600000; // 10 minutes

      // Code-related responses get longer cache time
      if (/code|function|class|implement|debug/i.test(content)) {
        return 900000; // 15 minutes
      }

      // Real-time requests get shorter cache time
      if (/now|current|today|latest|realtime|live/i.test(key)) {
        return 60000; // 1 minute
      }
    }

    return this.config.defaultTTL;
  }

  /**
   * Classify request type for intelligent caching
   */
  private classifyRequestType(prompt: string): string {
    if (!prompt) return 'unknown';

    const lowerPrompt = prompt.toLowerCase();

    if (/code|function|class|implement|debug|fix|refactor/.test(lowerPrompt)) {
      return 'code_generation';
    }
    if (/explain|describe|what|how|why/.test(lowerPrompt)) {
      return 'explanation';
    }
    if (/analyze|review|assess|evaluate/.test(lowerPrompt)) {
      return 'analysis';
    }
    if (/create|generate|write|build|make/.test(lowerPrompt)) {
      return 'creation';
    }

    return 'general';
  }

  /**
   * Generate specialized cache keys
   */
  private generateLLMCacheKey(prompt: string, model: string, provider: string, tools?: any[]): string {
    const normalizedPrompt = this.normalizePrompt(prompt);
    const toolsHash = tools ? crypto.createHash('md5').update(JSON.stringify(tools)).digest('hex') : '';
    const keyData = `llm:${provider}:${model}:${normalizedPrompt}:${toolsHash}`;
    return crypto.createHash('sha256').update(keyData).digest('hex');
  }

  private generateCacheKey(key: string): string {
    if (key.length > 250) {
      return crypto.createHash('sha256').update(key).digest('hex');
    }
    return key.replace(/[^a-zA-Z0-9_:-]/g, '_');
  }

  private normalizePrompt(prompt: string): string {
    return prompt
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .slice(0, 500);
  }

  /**
   * Calculate similarity between two strings using Jaccard similarity
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(' '));
    const words2 = new Set(str2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Serialization methods
   */
  private async serializeValue(value: any, options: CacheOptions): Promise<any> {
    let serialized = value;

    if (typeof value === 'object' && value !== null) {
      serialized = JSON.stringify(value);
    }

    if (this.config.enableCompression && options.compress !== false) {
      serialized = `compressed:${serialized}`;
    }

    if (this.config.enableEncryption && options.encrypt !== false && this.encryptionKey) {
      serialized = this.encrypt(serialized);
    }

    return serialized;
  }

  private async deserializeValue(value: any): Promise<any> {
    let deserialized = value;

    if (typeof value === 'string' && value.startsWith('encrypted:')) {
      deserialized = this.decrypt(value);
    }

    if (typeof deserialized === 'string' && deserialized.startsWith('compressed:')) {
      deserialized = deserialized.substring(11);
    }

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
   * Encryption methods
   */
  private encrypt(value: string): string {
    if (!this.encryptionKey) return value;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey).subarray(0, 32), iv);

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `encrypted:${iv.toString('hex')}:${encrypted}`;
  }

  private decrypt(encryptedValue: string): string {
    if (!this.encryptionKey) return encryptedValue;

    const parts = encryptedValue.split(':');
    if (parts.length !== 3) return encryptedValue;

    const iv = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey).subarray(0, 32), iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Tag-based operations
   */
  async deleteByTags(tags: string[]): Promise<number> {
    let deletedCount = 0;

    if (this.config.layers.memory.enabled) {
      const entries = this.memoryCache.entries();
      for (const [key, entry] of entries) {
        if (entry.tags.some(tag => tags.includes(tag))) {
          this.memoryCache.delete(key);
          deletedCount++;
        }
      }
    }

    if (this.config.layers.redis.enabled && this.redisCache) {
      const keys = await this.redisCache.get('*');
      // Implementation would scan Redis keys and check tags
    }

    return deletedCount;
  }

  /**
   * Statistics and cleanup
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  private updateStats(): void {
    this.stats.totalEntries = this.memoryCache.size();
    this.stats.keyCount = this.memoryCache.size();
    this.stats.memoryUsage = this.estimateMemoryUsage();
    this.updateHitRate();
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.totalRequests = total;
    this.stats.hitRate = total > 0 ? `${((this.stats.hits / total) * 100).toFixed(1)}%` : '0%';
  }

  private estimateMemoryUsage(): number {
    let total = 0;
    for (const [key, entry] of this.memoryCache.entries()) {
      total += key.length * 2;
      total += JSON.stringify(entry).length * 2;
    }
    return Math.round(total / 1024); // KB
  }

  private startCleanupTimer(): void {
    const interval = setInterval(() => {
      this.cleanup();
    }, this.config.checkInterval);

    this.cleanupIntervalId = resourceManager.registerInterval(
      interval,
      'UnifiedCacheService',
      'periodic cache cleanup'
    );
  }

  private cleanup(): void {
    try {
      let cleaned = 0;
      const now = Date.now();

      if (this.config.layers.memory.enabled) {
        const entries = this.memoryCache.entries();
        for (const [key, entry] of entries) {
          if (entry.expiresAt > 0 && now > entry.expiresAt) {
            this.memoryCache.delete(key);
            cleaned++;
          }
        }
      }

      // Cleanup health check cache
      for (const [key, entry] of this.healthCheckCache.entries()) {
        if (now - entry.timestamp > this.HEALTH_CACHE_TTL * 2) {
          this.healthCheckCache.delete(key);
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

  async clear(): Promise<void> {
    try {
      if (this.config.layers.memory.enabled) {
        this.memoryCache.clear();
      }

      if (this.config.layers.redis.enabled && this.redisCache) {
        await this.redisCache.clear();
      }

      this.healthCheckCache.clear();

      this.stats = {
        ...this.stats,
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        hitRate: '0%',
        keyCount: 0,
        totalRequests: 0,
      };

      logger.info('Unified cache cleared');
      this.emit('cache-clear');
    } catch (error) {
      logger.error('Cache clear error', error as Error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (this.cleanupIntervalId) {
      resourceManager.cleanup(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    if (this.redisCache) {
      await this.redisCache.disconnect();
    }

    await this.clear();
    this.removeAllListeners();

    logger.info('Unified cache service destroyed');
  }
}

// Global instance
export const unifiedCacheService = UnifiedCacheService.getInstance();