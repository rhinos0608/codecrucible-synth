/**
 * Enterprise Rate Limiting System
 * Implements sliding window, fixed window, and token bucket algorithms with Redis backend
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { logger } from '../logger.js';

export interface RateLimitConfig {
  algorithm: 'sliding-window' | 'fixed-window' | 'token-bucket';
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  skipIf?: (req: any) => boolean;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  store?: RateLimitStore;
  onLimitReached?: (req: any, res: any) => void;
}

export interface RateLimitInfo {
  totalHits: number;
  totalHitsLimit: number;
  remainingHits: number;
  msBeforeNext: number;
  resetTime: Date;
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitInfo | null>;
  set(key: string, info: RateLimitInfo, ttl: number): Promise<void>;
  increment(key: string): Promise<RateLimitInfo>;
  reset(key: string): Promise<void>;
}

export interface TokenBucketConfig {
  capacity: number;
  refillRate: number;
  refillInterval: number;
}

export interface SlidingWindowConfig {
  windowSize: number;
  subWindows: number;
}

/**
 * In-memory rate limit store (for development)
 */
class MemoryStore implements RateLimitStore {
  private store = new Map<string, { info: RateLimitInfo; expiry: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async get(key: string): Promise<RateLimitInfo | null> {
    const entry = this.store.get(key);
    if (!entry || entry.expiry < Date.now()) {
      return null;
    }
    return entry.info;
  }

  async set(key: string, info: RateLimitInfo, ttl: number): Promise<void> {
    this.store.set(key, {
      info,
      expiry: Date.now() + ttl,
    });
  }

  async increment(key: string): Promise<RateLimitInfo> {
    const existing = await this.get(key);
    if (existing) {
      existing.totalHits++;
      existing.remainingHits = Math.max(0, existing.totalHitsLimit - existing.totalHits);
      await this.set(key, existing, existing.resetTime.getTime() - Date.now());
      return existing;
    }

    const newInfo: RateLimitInfo = {
      totalHits: 1,
      totalHitsLimit: 100, // Default, should be overridden
      remainingHits: 99,
      msBeforeNext: 0,
      resetTime: new Date(Date.now() + 60000), // Default 1 minute
    };

    await this.set(key, newInfo, 60000);
    return newInfo;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiry < now) {
        this.store.delete(key);
      }
    }
  }

  stop(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

/**
 * Token bucket implementation for rate limiting
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private config: TokenBucketConfig;

  constructor(config: TokenBucketConfig) {
    this.config = config;
    this.tokens = config.capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume tokens
   */
  consume(tokens: number = 1): boolean {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Get available tokens
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const intervalsElapsed = Math.floor(timePassed / this.config.refillInterval);

    if (intervalsElapsed > 0) {
      const tokensToAdd = intervalsElapsed * this.config.refillRate;
      this.tokens = Math.min(this.config.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }
}

/**
 * Sliding window rate limiter
 */
class SlidingWindow {
  private windows = new Map<string, number[]>();
  private config: SlidingWindowConfig;

  constructor(config: SlidingWindowConfig) {
    this.config = config;
  }

  /**
   * Check if request is allowed
   */
  isAllowed(key: string, limit: number): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowSize;

    // Get or create window for this key
    let timestamps = this.windows.get(key) || [];

    // Remove old timestamps
    timestamps = timestamps.filter(timestamp => timestamp > windowStart);

    // Check if under limit
    if (timestamps.length < limit) {
      timestamps.push(now);
      this.windows.set(key, timestamps);
      return true;
    }

    return false;
  }

  /**
   * Get current count for key
   */
  getCurrentCount(key: string): number {
    const now = Date.now();
    const windowStart = now - this.config.windowSize;
    const timestamps = this.windows.get(key) || [];

    return timestamps.filter(timestamp => timestamp > windowStart).length;
  }

  /**
   * Clean up old entries
   */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.config.windowSize;

    for (const [key, timestamps] of this.windows.entries()) {
      const filtered = timestamps.filter(timestamp => timestamp > cutoff);

      if (filtered.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, filtered);
      }
    }
  }
}

/**
 * Main rate limiter class
 */
export class RateLimiter extends EventEmitter {
  private config: RateLimitConfig;
  private store: RateLimitStore;
  private tokenBuckets = new Map<string, TokenBucket>();
  private slidingWindows = new Map<string, SlidingWindow>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    super();

    this.config = {
      algorithm: 'sliding-window',
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      keyGenerator: this.defaultKeyGenerator,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      message: 'Too many requests, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
      ...config,
    };

    this.store = config.store || new MemoryStore();

    // Start cleanup for sliding windows
    if (this.config.algorithm === 'sliding-window') {
      this.cleanupInterval = setInterval(() => this.cleanupSlidingWindows(), 60000);
    }
  }

  /**
   * Create Express middleware
   */
  middleware() {
    return async (req: any, res: any, next: any) => {
      try {
        const key = this.config.keyGenerator!(req);
        const allowed = await this.checkLimit(key, req);

        if (!allowed.allowed) {
          // Set rate limit headers
          if (this.config.standardHeaders) {
            res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
            res.setHeader('X-RateLimit-Remaining', allowed.info.remainingHits);
            res.setHeader('X-RateLimit-Reset', Math.ceil(allowed.info.resetTime.getTime() / 1000));
          }

          if (this.config.legacyHeaders) {
            res.setHeader('X-Rate-Limit-Limit', this.config.maxRequests);
            res.setHeader('X-Rate-Limit-Remaining', allowed.info.remainingHits);
            res.setHeader('X-Rate-Limit-Reset', Math.ceil(allowed.info.resetTime.getTime() / 1000));
          }

          // Call custom handler if provided
          if (this.config.onLimitReached) {
            this.config.onLimitReached(req, res);
            return;
          }

          // Emit event
          this.emit('limit-reached', {
            key,
            ip: req.ip,
            info: allowed.info,
          });

          // Log rate limit hit
          logger.warn('Rate limit exceeded', {
            key,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method,
            limit: this.config.maxRequests,
            window: this.config.windowMs,
          });

          return res.status(429).json({
            error: this.config.message,
            retryAfter: Math.ceil(allowed.info.msBeforeNext / 1000),
            limit: this.config.maxRequests,
            remaining: allowed.info.remainingHits,
            resetTime: allowed.info.resetTime.toISOString(),
          });
        }

        // Set success headers
        if (this.config.standardHeaders) {
          res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
          res.setHeader('X-RateLimit-Remaining', allowed.info.remainingHits);
          res.setHeader('X-RateLimit-Reset', Math.ceil(allowed.info.resetTime.getTime() / 1000));
        }

        // Track the request for potential cleanup
        req.rateLimitInfo = allowed.info;

        next();
      } catch (error) {
        logger.error('Rate limiter error', error as Error);
        // Fail open - allow request if rate limiter fails
        next();
      }
    };
  }

  /**
   * Check if request is within rate limit
   */
  async checkLimit(key: string, req?: any): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    // Check skip conditions
    if (req && this.config.skipIf && this.config.skipIf(req)) {
      return {
        allowed: true,
        info: {
          totalHits: 0,
          totalHitsLimit: this.config.maxRequests,
          remainingHits: this.config.maxRequests,
          msBeforeNext: 0,
          resetTime: new Date(Date.now() + this.config.windowMs),
        },
      };
    }

    switch (this.config.algorithm) {
      case 'token-bucket':
        return this.checkTokenBucket(key);
      case 'sliding-window':
        return this.checkSlidingWindow(key);
      case 'fixed-window':
      default:
        return this.checkFixedWindow(key);
    }
  }

  /**
   * Check token bucket rate limit
   */
  private async checkTokenBucket(key: string): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    let bucket = this.tokenBuckets.get(key);

    if (!bucket) {
      bucket = new TokenBucket({
        capacity: this.config.maxRequests,
        refillRate: Math.ceil(this.config.maxRequests / (this.config.windowMs / 1000)),
        refillInterval: 1000, // Refill every second
      });
      this.tokenBuckets.set(key, bucket);
    }

    const allowed = bucket.consume(1);
    const availableTokens = bucket.getAvailableTokens();

    const info: RateLimitInfo = {
      totalHits: this.config.maxRequests - availableTokens,
      totalHitsLimit: this.config.maxRequests,
      remainingHits: availableTokens,
      msBeforeNext: allowed ? 0 : 1000,
      resetTime: new Date(Date.now() + this.config.windowMs),
    };

    return { allowed, info };
  }

  /**
   * Check sliding window rate limit
   */
  private async checkSlidingWindow(
    key: string
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    let window = this.slidingWindows.get(key);

    if (!window) {
      window = new SlidingWindow({
        windowSize: this.config.windowMs,
        subWindows: 10,
      });
      this.slidingWindows.set(key, window);
    }

    const allowed = window.isAllowed(key, this.config.maxRequests);
    const currentCount = window.getCurrentCount(key);

    const info: RateLimitInfo = {
      totalHits: currentCount,
      totalHitsLimit: this.config.maxRequests,
      remainingHits: Math.max(0, this.config.maxRequests - currentCount),
      msBeforeNext: allowed ? 0 : this.config.windowMs,
      resetTime: new Date(Date.now() + this.config.windowMs),
    };

    return { allowed, info };
  }

  /**
   * Check fixed window rate limit
   */
  private async checkFixedWindow(key: string): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    const now = Date.now();
    const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
    const windowKey = `${key}:${windowStart}`;

    let info = await this.store.get(windowKey);

    if (!info) {
      info = {
        totalHits: 0,
        totalHitsLimit: this.config.maxRequests,
        remainingHits: this.config.maxRequests,
        msBeforeNext: this.config.windowMs,
        resetTime: new Date(windowStart + this.config.windowMs),
      };
    }

    const allowed = info.totalHits < this.config.maxRequests;

    if (allowed) {
      info = await this.store.increment(windowKey);
      info.totalHitsLimit = this.config.maxRequests;
      info.remainingHits = Math.max(0, this.config.maxRequests - info.totalHits);
      info.resetTime = new Date(windowStart + this.config.windowMs);
      info.msBeforeNext = windowStart + this.config.windowMs - now;

      await this.store.set(windowKey, info, this.config.windowMs);
    }

    return { allowed, info };
  }

  /**
   * Default key generator (IP-based)
   */
  private defaultKeyGenerator(req: any): string {
    return `rate_limit:${req.ip || 'unknown'}`;
  }

  /**
   * Get rate limit status for a key
   */
  async getStatus(key: string): Promise<RateLimitInfo | null> {
    switch (this.config.algorithm) {
      case 'token-bucket':
        const bucket = this.tokenBuckets.get(key);
        if (!bucket) return null;

        return {
          totalHits: this.config.maxRequests - bucket.getAvailableTokens(),
          totalHitsLimit: this.config.maxRequests,
          remainingHits: bucket.getAvailableTokens(),
          msBeforeNext: 0,
          resetTime: new Date(Date.now() + this.config.windowMs),
        };

      case 'sliding-window':
        const window = this.slidingWindows.get(key);
        if (!window) return null;

        const currentCount = window.getCurrentCount(key);
        return {
          totalHits: currentCount,
          totalHitsLimit: this.config.maxRequests,
          remainingHits: Math.max(0, this.config.maxRequests - currentCount),
          msBeforeNext: 0,
          resetTime: new Date(Date.now() + this.config.windowMs),
        };

      case 'fixed-window':
      default:
        return await this.store.get(key);
    }
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    switch (this.config.algorithm) {
      case 'token-bucket':
        this.tokenBuckets.delete(key);
        break;

      case 'sliding-window':
        this.slidingWindows.delete(key);
        break;

      case 'fixed-window':
      default:
        await this.store.reset(key);
        break;
    }

    this.emit('rate-limit-reset', { key });
    logger.info('Rate limit reset', { key });
  }

  /**
   * Create key generator for specific field
   */
  static createKeyGenerator(field: 'ip' | 'userId' | 'sessionId' | string): (req: any) => string {
    return (req: any) => {
      switch (field) {
        case 'ip':
          return `rate_limit:ip:${req.ip || 'unknown'}`;
        case 'userId':
          return `rate_limit:user:${req.user?.userId || 'anonymous'}`;
        case 'sessionId':
          return `rate_limit:session:${req.sessionId || 'no-session'}`;
        default:
          return `rate_limit:${field}:${req[field] || 'unknown'}`;
      }
    };
  }

  /**
   * Create different rate limiters for different endpoints
   */
  static createTieredLimiters(): Record<string, RateLimiter> {
    return {
      // Strict limits for auth endpoints
      auth: new RateLimiter({
        algorithm: 'fixed-window',
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5,
        keyGenerator: RateLimiter.createKeyGenerator('ip'),
        message: 'Too many authentication attempts',
      }),

      // Moderate limits for API endpoints
      api: new RateLimiter({
        algorithm: 'sliding-window',
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100,
        keyGenerator: RateLimiter.createKeyGenerator('userId'),
        message: 'API rate limit exceeded',
      }),

      // Generous limits for general requests
      general: new RateLimiter({
        algorithm: 'token-bucket',
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 1000,
        keyGenerator: RateLimiter.createKeyGenerator('ip'),
        message: 'Rate limit exceeded',
      }),

      // Very strict for admin operations
      admin: new RateLimiter({
        algorithm: 'fixed-window',
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 10,
        keyGenerator: RateLimiter.createKeyGenerator('userId'),
        message: 'Admin operation rate limit exceeded',
      }),
    };
  }

  /**
   * Clean up sliding windows
   */
  private cleanupSlidingWindows(): void {
    for (const window of this.slidingWindows.values()) {
      window.cleanup();
    }
  }

  /**
   * Stop rate limiter and clean up resources
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.tokenBuckets.clear();
    this.slidingWindows.clear();

    if (this.store instanceof MemoryStore) {
      this.store.stop();
    }

    logger.info('Rate limiter stopped');
  }
}
