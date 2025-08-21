/**
 * Rate Limiting and Timeout Handling System
 *
 * Provides comprehensive rate limiting, timeout management, and
 * external API call optimization with retry mechanisms.
 */

import { logger } from '../logger.js';
import {
  ErrorFactory,
  ErrorCategory,
  ErrorSeverity,
  ServiceResponse,
  ErrorResponse,
  ErrorHandler,
} from '../error-handling/structured-error-system.js';

// Rate limiting configuration
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDuration?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (identifier: string) => string;
}

// Timeout configuration
export interface TimeoutConfig {
  connectionTimeout: number;
  responseTimeout: number;
  totalTimeout: number;
  retryTimeout: number;
}

// Retry configuration
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: any) => boolean;
}

// API call configuration
export interface APICallConfig {
  identifier: string;
  rateLimit?: RateLimitConfig;
  timeout?: TimeoutConfig;
  retry?: RetryConfig;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  cacheEnabled?: boolean;
  cacheTTL?: number;
}

// Rate limit bucket
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  blocked: boolean;
  blockExpiry?: number;
}

// Request queue item
interface QueuedRequest {
  id: string;
  config: APICallConfig;
  requestFn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  priority: number;
  timestamp: number;
  timeoutHandle?: NodeJS.Timeout;
}

// Cache entry
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

/**
 * Rate Limiting Manager
 */
export class RateLimitManager {
  private buckets = new Map<string, RateLimitBucket>();
  private defaultConfig: RateLimitConfig = {
    maxRequests: 60,
    windowMs: 60000, // 1 minute
    blockDuration: 300000, // 5 minutes
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  };

  /**
   * Check if request is allowed under rate limit
   */
  async checkRateLimit(
    identifier: string,
    config?: Partial<RateLimitConfig>
  ): Promise<ServiceResponse<boolean>> {
    const rateLimitConfig = { ...this.defaultConfig, ...config };
    const key = rateLimitConfig.keyGenerator
      ? rateLimitConfig.keyGenerator(identifier)
      : identifier;

    try {
      const bucket = this.getBucket(key, rateLimitConfig);

      // Check if currently blocked
      if (bucket.blocked && bucket.blockExpiry && Date.now() < bucket.blockExpiry) {
        const remainingTime = bucket.blockExpiry - Date.now();

        return ErrorHandler.createErrorResponse(
          ErrorFactory.createError(
            `Rate limit exceeded for ${identifier}`,
            ErrorCategory.SYSTEM,
            ErrorSeverity.MEDIUM,
            {
              context: {
                identifier,
                remainingBlockTime: remainingTime,
                rateLimitConfig,
              },
              userMessage: 'Too many requests, please wait before trying again',
              suggestedActions: [`Wait ${Math.ceil(remainingTime / 1000)} seconds before retrying`],
              retryable: true,
            }
          )
        );
      }

      // Refill tokens based on time elapsed
      this.refillBucket(bucket, rateLimitConfig);

      // Check if tokens available
      if (bucket.tokens < 1) {
        // Block if no tokens available
        bucket.blocked = true;
        bucket.blockExpiry = Date.now() + (rateLimitConfig.blockDuration || 300000);

        logger.warn(`Rate limit bucket exhausted for ${identifier}`, {
          bucket: { ...bucket },
          config: rateLimitConfig,
        });

        return ErrorHandler.createErrorResponse(
          ErrorFactory.createError(
            `Rate limit bucket exhausted for ${identifier}`,
            ErrorCategory.SYSTEM,
            ErrorSeverity.MEDIUM,
            {
              context: { identifier, rateLimitConfig },
              userMessage: 'Request rate limit exceeded',
              suggestedActions: ['Reduce request frequency', 'Wait before retrying'],
              retryable: true,
            }
          )
        );
      }

      // Consume token
      bucket.tokens -= 1;

      return ErrorHandler.createSuccessResponse(true);
    } catch (error) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `Rate limit check failed: ${(error as Error).message}`,
          ErrorCategory.SYSTEM,
          ErrorSeverity.HIGH,
          {
            context: { identifier },
            originalError: error as Error,
            userMessage: 'Rate limiting system error',
            suggestedActions: ['Try again', 'Contact support if issue persists'],
          }
        )
      );
    }
  }

  /**
   * Record request completion (for rate limit adjustment)
   */
  recordRequest(identifier: string, success: boolean, config?: Partial<RateLimitConfig>): void {
    const rateLimitConfig = { ...this.defaultConfig, ...config };

    // Skip recording based on configuration
    if (
      (success && rateLimitConfig.skipSuccessfulRequests) ||
      (!success && rateLimitConfig.skipFailedRequests)
    ) {
      return;
    }

    // This could be used for adaptive rate limiting
    logger.debug(`Request recorded for ${identifier}`, { success, timestamp: Date.now() });
  }

  /**
   * Reset rate limit for identifier
   */
  resetRateLimit(identifier: string): void {
    const key = identifier;
    this.buckets.delete(key);
    logger.info(`Rate limit reset for ${identifier}`);
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(identifier: string): {
    tokens: number;
    blocked: boolean;
    blockExpiry?: number;
    nextRefill: number;
  } {
    const bucket = this.buckets.get(identifier);
    if (!bucket) {
      return {
        tokens: this.defaultConfig.maxRequests,
        blocked: false,
        nextRefill: Date.now() + this.defaultConfig.windowMs,
      };
    }

    return {
      tokens: bucket.tokens,
      blocked: bucket.blocked,
      blockExpiry: bucket.blockExpiry,
      nextRefill: bucket.lastRefill + this.defaultConfig.windowMs,
    };
  }

  private getBucket(key: string, config: RateLimitConfig): RateLimitBucket {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: config.maxRequests,
        lastRefill: Date.now(),
        blocked: false,
      };
      this.buckets.set(key, bucket);
    }

    return bucket;
  }

  private refillBucket(bucket: RateLimitBucket, config: RateLimitConfig): void {
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;

    if (timePassed >= config.windowMs) {
      // Full refill
      bucket.tokens = config.maxRequests;
      bucket.lastRefill = now;
      bucket.blocked = false;
      bucket.blockExpiry = undefined;
    } else {
      // Partial refill based on time passed
      const tokensToAdd = (timePassed / config.windowMs) * config.maxRequests;
      bucket.tokens = Math.min(config.maxRequests, bucket.tokens + tokensToAdd);

      if (bucket.tokens >= 1) {
        bucket.blocked = false;
        bucket.blockExpiry = undefined;
      }
    }
  }
}

/**
 * Timeout and Retry Manager
 */
export class TimeoutRetryManager {
  private defaultTimeoutConfig: TimeoutConfig = {
    connectionTimeout: 10000,
    responseTimeout: 30000,
    totalTimeout: 60000,
    retryTimeout: 5000,
  };

  private defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryCondition: (error: any) => {
      // Retry on network errors, timeouts, and 5xx HTTP errors
      return (
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED' ||
        (error.response && error.response.status >= 500) ||
        error.timeout === true
      );
    },
  };

  /**
   * Execute request with timeout and retry logic
   */
  async executeWithTimeoutAndRetry<T>(
    requestFn: () => Promise<T>,
    config: {
      timeout?: Partial<TimeoutConfig>;
      retry?: Partial<RetryConfig>;
      identifier?: string;
    } = {}
  ): Promise<ServiceResponse<T>> {
    const timeoutConfig = { ...this.defaultTimeoutConfig, ...config.timeout };
    const retryConfig = { ...this.defaultRetryConfig, ...config.retry };
    const identifier = config.identifier || 'anonymous';

    let lastError: any = null;
    let attempt = 0;

    while (attempt <= retryConfig.maxRetries) {
      try {
        const result = await this.executeWithTimeout(requestFn, timeoutConfig, identifier);

        logger.debug(`Request succeeded for ${identifier}`, {
          attempt: attempt + 1,
          totalAttempts: retryConfig.maxRetries + 1,
        });

        return ErrorHandler.createSuccessResponse(result);
      } catch (error) {
        lastError = error;
        attempt++;

        logger.warn(`Request attempt ${attempt} failed for ${identifier}`, {
          error: (error as Error).message,
          attempt,
          maxRetries: retryConfig.maxRetries,
        });

        // Check if we should retry
        if (
          attempt <= retryConfig.maxRetries &&
          retryConfig.retryCondition &&
          retryConfig.retryCondition(error)
        ) {
          const delay = this.calculateDelay(attempt, retryConfig);

          logger.info(`Retrying request for ${identifier} in ${delay}ms`, {
            attempt: attempt + 1,
            delay,
          });

          await this.sleep(delay);
        } else {
          break;
        }
      }
    }

    // All retries exhausted
    return ErrorHandler.createErrorResponse(
      ErrorFactory.createError(
        `Request failed after ${attempt} attempts: ${lastError?.message || 'Unknown error'}`,
        ErrorCategory.NETWORK,
        ErrorSeverity.HIGH,
        {
          context: {
            identifier,
            attempts: attempt,
            lastError: lastError?.message,
            timeoutConfig,
            retryConfig,
          },
          originalError: lastError,
          userMessage: 'Network request failed after multiple attempts',
          suggestedActions: [
            'Check network connection',
            'Verify service availability',
            'Try again later',
          ],
          retryable: true,
        }
      )
    );
  }

  private async executeWithTimeout<T>(
    requestFn: () => Promise<T>,
    config: TimeoutConfig,
    identifier: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(
          ErrorFactory.createError(
            `Request timeout after ${config.totalTimeout}ms`,
            ErrorCategory.NETWORK,
            ErrorSeverity.MEDIUM,
            {
              context: { identifier, timeout: config.totalTimeout },
              userMessage: 'Request timed out',
              suggestedActions: ['Try again with longer timeout', 'Check network connection'],
              retryable: true,
              metadata: { timeout: true },
            }
          )
        );
      }, config.totalTimeout);

      requestFn()
        .then(result => {
          clearTimeout(timeoutHandle);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutHandle);
          reject(error);
        });
    });
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
    return Math.min(delay + jitter, config.maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * API Call Queue Manager with Priority Handling
 */
export class APICallQueue {
  private queue: QueuedRequest[] = [];
  private cache = new Map<string, CacheEntry>();
  private processing = false;
  private rateLimitManager = new RateLimitManager();
  private timeoutRetryManager = new TimeoutRetryManager();
  private requestCounter = 0;

  /**
   * Queue an API call with configuration
   */
  async queueAPICall<T>(requestFn: () => Promise<T>, config: APICallConfig): Promise<T> {
    // Check cache first
    if (config.cacheEnabled) {
      const cached = this.getCachedResult(config.identifier);
      if (cached) {
        logger.debug(`Cache hit for ${config.identifier}`);
        return cached;
      }
    }

    // Check rate limit
    const rateLimitCheck = await this.rateLimitManager.checkRateLimit(
      config.identifier,
      config.rateLimit
    );

    if (!rateLimitCheck.success) {
      throw (rateLimitCheck as ErrorResponse).error;
    }

    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `req_${++this.requestCounter}_${Date.now()}`,
        config,
        requestFn,
        resolve,
        reject,
        priority: this.getPriorityValue(config.priority || 'normal'),
        timestamp: Date.now(),
      };

      this.queue.push(request);
      this.sortQueue();

      logger.debug(`Queued API call: ${config.identifier}`, {
        requestId: request.id,
        queueLength: this.queue.length,
        priority: config.priority,
      });

      this.processQueue();
    });
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    queueLength: number;
    processing: boolean;
    cacheSize: number;
    queuedRequests: Array<{
      id: string;
      identifier: string;
      priority: string;
      age: number;
    }>;
  } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      cacheSize: this.cache.size,
      queuedRequests: this.queue.map(req => ({
        id: req.id,
        identifier: req.config.identifier,
        priority: req.config.priority || 'normal',
        age: Date.now() - req.timestamp,
      })),
    };
  }

  /**
   * Clear queue and cache
   */
  clear(): void {
    // Cancel pending requests
    this.queue.forEach(req => {
      if (req.timeoutHandle) {
        clearTimeout(req.timeoutHandle);
      }
      req.reject(new Error('Queue cleared'));
    });

    this.queue = [];
    this.cache.clear();
    this.processing = false;

    logger.info('API call queue cleared');
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const request = this.queue.shift()!;

        try {
          await this.executeRequest(request);
        } catch (error) {
          logger.error(`Failed to execute request ${request.id}`, error);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async executeRequest(request: QueuedRequest): Promise<void> {
    const { config, requestFn, resolve, reject } = request;

    try {
      logger.debug(`Executing API call: ${config.identifier}`, {
        requestId: request.id,
      });

      const result = await this.timeoutRetryManager.executeWithTimeoutAndRetry(requestFn, {
        timeout: config.timeout,
        retry: config.retry,
        identifier: config.identifier,
      });

      if (!result.success) {
        // Record failed request for rate limiting
        this.rateLimitManager.recordRequest(config.identifier, false, config.rateLimit);
        reject((result as ErrorResponse).error);
        return;
      }

      // Record successful request
      this.rateLimitManager.recordRequest(config.identifier, true, config.rateLimit);

      // Cache result if enabled
      if (config.cacheEnabled && config.cacheTTL) {
        this.setCachedResult(config.identifier, result.data, config.cacheTTL);
      }

      resolve(result.data);
    } catch (error) {
      this.rateLimitManager.recordRequest(config.identifier, false, config.rateLimit);
      reject(error);
    }
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // Sort by priority (higher first), then by timestamp (older first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });
  }

  private getPriorityValue(priority: string): number {
    const priorities = {
      low: 1,
      normal: 2,
      high: 3,
      critical: 4,
    };
    return priorities[priority as keyof typeof priorities] || 2;
  }

  private getCachedResult(identifier: string): any | null {
    const entry = this.cache.get(identifier);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(identifier);
      return null;
    }

    return entry.data;
  }

  private setCachedResult(identifier: string, data: any, ttl: number): void {
    this.cache.set(identifier, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Clean up old cache entries periodically
    if (this.cache.size % 100 === 0) {
      this.cleanupCache();
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Global instances
export const globalRateLimitManager = new RateLimitManager();
export const globalTimeoutRetryManager = new TimeoutRetryManager();
export const globalAPICallQueue = new APICallQueue();

// Convenience function for making rate-limited API calls
export async function makeRateLimitedAPICall<T>(
  requestFn: () => Promise<T>,
  config: APICallConfig
): Promise<T> {
  return globalAPICallQueue.queueAPICall(requestFn, config);
}
