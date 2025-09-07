/**
 * Enterprise Rate Limiting System
 * Implements sliding window, fixed window, and token bucket algorithms with Redis backend
 */

import { EventEmitter } from 'events';
// Removed unused crypto import
import { logger } from '../logging/logger.js';

export interface RateLimitConfig {
  algorithm: 'sliding-window' | 'fixed-window' | 'token-bucket';
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Readonly<{ ip?: string }>) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  skipIf?: (req: Readonly<{ ip?: string }>) => boolean;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  store?: RateLimitStore;
  onLimitReached?: (req: Readonly<{ ip?: string }>, res: { status: (code: number) => void }) => void;
}

export interface RateLimitInfo {
  totalHits: number;
  totalHitsLimit: number;
  remainingHits: number;
  msBeforeNext: number;
  resetTime: Date;
}

export interface RateLimitStore {
  get: (key: Readonly<string>) => Promise<RateLimitInfo | null>;
  set: (key: Readonly<string>, info: RateLimitInfo, ttl: number) => Promise<void>;
  increment: (key: Readonly<string>) => Promise<RateLimitInfo>;
  reset: (key: Readonly<string>) => Promise<void>;
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
  private readonly store = new Map<string, { info: RateLimitInfo; expiry: number }>();
  private readonly cleanupInterval!: NodeJS.Timeout;

  public constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  public async get(key: Readonly<string>): Promise<RateLimitInfo | null> {
    const entry = this.store.get(key);
    if (!entry || entry.expiry < Date.now()) {
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.info);
  }

  public async set(key: Readonly<string>, info: RateLimitInfo, ttl: number): Promise<void> {
    this.store.set(key, {
      info,
      expiry: Date.now() + ttl,
    });
  }

  public async increment(key: string): Promise<RateLimitInfo> {
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

  public async reset(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiry < now) {
        this.store.delete(key);
      }
    }
  }

  public stop(): void {
    this.store.clear();
  }
}

/**
 * Token bucket implementation for rate limiting
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly config: TokenBucketConfig;

  public constructor(config: Readonly<TokenBucketConfig>) {
    this.config = config;
    this.tokens = config.capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume tokens
   */
  public consume(tokens: number = 1): boolean {
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
  public getAvailableTokens(): number {
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
  private readonly windows = new Map<string, number[]>();
  private readonly config: SlidingWindowConfig;

  public constructor(config: Readonly<SlidingWindowConfig>) {
    this.config = config;
  }

  /**
   * Check if request is allowed
   */
  public isAllowed(key: string, limit: number): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowSize;

    // Get or create window for this key
    let timestamps = this.windows.get(key) ?? [];

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
  public getCurrentCount(key: string): number {
    const now = Date.now();
    const windowStart = now - this.config.windowSize;
    const timestamps = this.windows.get(key) ?? [];

    return timestamps.filter(timestamp => timestamp > windowStart).length;
  }

  /**
   * Clean up old entries
   */
  public cleanup(): void {
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
  private readonly config: RateLimitConfig;
  private readonly store: RateLimitStore;
  private readonly tokenBuckets = new Map<string, TokenBucket>();
  private readonly slidingWindows = new Map<string, SlidingWindow>();
  private readonly cleanupInterval?: NodeJS.Timeout;

  public constructor(config: Readonly<RateLimitConfig>) {
    super();

    this.config = {
      keyGenerator: (req: Readonly<{ ip?: string }>): string => RateLimiter.defaultKeyGenerator(req),
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      message: 'Too many requests, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
      ...config,
    };

    this.store = config.store ?? new MemoryStore();

    // Start cleanup for sliding windows
    if (this.config.algorithm === 'sliding-window') {
      this.cleanupInterval = setInterval(() => {
        this.cleanupSlidingWindows();
      }, 60000);
    }
  }
  /**
   * Express middleware for rate limiting
   */
  public middleware(): (
    req: Readonly<{ ip?: string; get: (header: string) => string | undefined; path: string; method: string }>,
    res: Readonly<{ setHeader: (name: string, value: string | number) => void; status: (code: number) => { json: (body: object) => void } }>,
    next: () => void
  ) => Promise<void> {
    return async (req, res, next) => {
      const key = this.config.keyGenerator ? this.config.keyGenerator(req) : `rate_limit:${req.ip ?? 'unknown'}`;
      try {
        const allowedResult = await this.checkLimit(key, req);

        if (!allowedResult.allowed) {
          res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
          res.setHeader('X-RateLimit-Remaining', allowedResult.info.remainingHits);
          res.setHeader('X-RateLimit-Reset', Math.ceil(allowedResult.info.resetTime.getTime() / 1000) || 0);

          if (this.config.legacyHeaders) {
            res.setHeader('X-Rate-Limit-Limit', this.config.maxRequests);
            res.setHeader('X-Rate-Limit-Remaining', allowedResult.info.remainingHits);
            res.setHeader('X-Rate-Limit-Reset', Math.ceil(allowedResult.info.resetTime.getTime() / 1000) || 0);
          }

        if (this.config.onLimitReached) {
          this.config.onLimitReached(req, res);
          return;
        }

        this.emit('limit-reached', { key, ip: req.ip, info: allowedResult.info });

        logger.warn('Rate limit exceeded', {
          key,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method,
          limit: this.config.maxRequests,
          window: this.config.windowMs,
        });

        res.status(429).json({
          error: this.config.message,
          retryAfter: Math.ceil(allowedResult.info.msBeforeNext / 1000),
          limit: this.config.maxRequests,
          remaining: allowedResult.info.remainingHits,
          resetTime: allowedResult.info.resetTime.toISOString(),
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Rate limiter error', error as Error);
      next();
    }
  };
}

  /**
   * Check if a request is allowed under the current rate limit.
   */
  public async checkLimit(key: string, req?: { ip?: string }): Promise<{ allowed: boolean; info: RateLimitInfo }> {
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
  public checkTokenBucket(key: string): { allowed: boolean; info: RateLimitInfo } {
    let bucket = this.tokenBuckets.get(key) ?? null;
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
  private checkSlidingWindow(
    key: string
  ): { allowed: boolean; info: RateLimitInfo } {
    let window = this.slidingWindows.get(key);

    if (!window) {
      window = new SlidingWindow({
        windowSize: this.config.windowMs,
        subWindows: 10,
      });
      this.slidingWindows.set(key, window);
    }

    // window is guaranteed to be defined here
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
  private static defaultKeyGenerator(req: { ip?: string }): string {
    return `rate_limit:${req.ip ?? 'unknown'}`;
  }

  /**
   * Cleanup sliding windows (removes old entries)
   */
  private cleanupSlidingWindows(): void {
    for (const window of this.slidingWindows.values()) {
      window.cleanup();
    }
  }

  /**
   * Get rate limit status for a key
  public async getStatus(key: string): Promise<RateLimitInfo | null> {
    switch (this.config.algorithm) {
      case 'token-bucket': {
        const bucket = this.tokenBuckets.get(key);
        if (!bucket) return null;

        return {
          totalHits: this.config.maxRequests - bucket.getAvailableTokens(),
          totalHitsLimit: this.config.maxRequests,
          remainingHits: bucket.getAvailableTokens(),
          msBeforeNext: 0,
          resetTime: new Date(Date.now() + this.config.windowMs),
        };
      }

      case 'sliding-window': {
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
      }

      case 'fixed-window':
      default:
        return this.store.get(key);
    }
  }
  }

  /**
   * Reset rate limit for a key
  public async reset(key: string): Promise<void> {
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
    logger.info('Rate limit reset', { key });
  }

  /**
   * Supported key generator fields
   */
  }

  // --- Type and function declarations moved outside the class ---

/**
 * Supported key generator fields
 */
export type KeyGeneratorField = 'ip' | 'userId' | 'sessionId';

/**
 * Minimal request type for key generator
 */
export interface KeyGenRequest {
  ip?: string;
  user?: { userId?: string };
  sessionId?: string;
  [key: string]: unknown;
}

/**
 * Create key generator for specific field
 */
export function createKeyGenerator(field: KeyGeneratorField | (string & {})): (req: KeyGenRequest) => string {
  return (req: KeyGenRequest) => {
    switch (field) {
      case 'ip':
        return `rate_limit:ip:${req.ip ?? 'unknown'}`;
      case 'userId':
        return `rate_limit:user:${req.user && typeof req.user === 'object' && 'userId' in req.user ? (req.user.userId ?? 'anonymous') : 'anonymous'}`;
      case 'sessionId':
        return `rate_limit:session:${req.sessionId ?? 'no-session'}`;
      default:
        return `rate_limit:${field}:${req[field] ?? 'unknown'}`;
    }
  };
}

/**
 * Create different rate limiters for different endpoints
 */
export function createTieredLimiters(): Record<string, RateLimiter> {
  return {
    // Strict limits for auth endpoints
    auth: new RateLimiter({
      algorithm: 'fixed-window',
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
      keyGenerator: createKeyGenerator('ip'),
      message: 'Too many authentication attempts',
    }),

    // Moderate limits for API endpoints
    api: new RateLimiter({
      algorithm: 'sliding-window',
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      keyGenerator: createKeyGenerator('userId'),
      message: 'API rate limit exceeded',
    }),

    // Generous limits for general requests
    general: new RateLimiter({
      algorithm: 'token-bucket',
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 1000,
      keyGenerator: createKeyGenerator('ip'),
      message: 'Rate limit exceeded',
    }),

    // Very strict for admin operations
    admin: new RateLimiter({
      algorithm: 'fixed-window',
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 10,
      keyGenerator: createKeyGenerator('userId'),
      message: 'Admin operation rate limit exceeded',
    }),
  };
}
