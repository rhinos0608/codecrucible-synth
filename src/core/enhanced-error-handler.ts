/**
 * Enhanced Error Handler inspired by Archon's robust error handling
 * Provides comprehensive error recovery, retry mechanisms, and graceful degradation
 */

import { logger } from './logger.js';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  NETWORK = 'network',
  API = 'api',
  VALIDATION = 'validation',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  FILE_SYSTEM = 'file_system',
  TOOL_EXECUTION = 'tool_execution',
  PARSING = 'parsing',
  SYSTEM = 'system'
}

export interface ErrorContext {
  operation: string;
  timestamp: number;
  metadata?: Record<string, any>;
  stackTrace?: string;
  userId?: string;
  sessionId?: string;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: ErrorCategory[];
  retryCondition?: (error: EnhancedError) => boolean;
}

export interface FallbackStrategy {
  name: string;
  condition: (error: EnhancedError) => boolean;
  execute: (error: EnhancedError, context: ErrorContext) => Promise<any>;
}

export class EnhancedError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly isRetryable: boolean;
  public readonly originalError?: Error;

  constructor(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context: ErrorContext,
    isRetryable: boolean = false,
    originalError?: Error
  ) {
    super(message);
    this.name = 'EnhancedError';
    this.category = category;
    this.severity = severity;
    this.context = context;
    this.isRetryable = isRetryable;
    this.originalError = originalError;
    
    // Capture stack trace if not provided
    if (!context.stackTrace && Error.captureStackTrace) {
      Error.captureStackTrace(this, EnhancedError);
      this.context.stackTrace = this.stack;
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      context: this.context,
      isRetryable: this.isRetryable,
      originalError: this.originalError?.message
    };
  }
}

export class EnhancedErrorHandler {
  private retryConfig: RetryConfig;
  private fallbackStrategies: FallbackStrategy[] = [];
  private errorMetrics: Map<string, { count: number; lastOccurrence: number }> = new Map();

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.retryConfig = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableErrors: [
        ErrorCategory.NETWORK,
        ErrorCategory.TIMEOUT,
        ErrorCategory.RATE_LIMIT
      ],
      ...retryConfig
    };

    this.setupDefaultFallbackStrategies();
  }

  /**
   * Execute an operation with comprehensive error handling and retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customRetryConfig };
    let lastError: EnhancedError | null = null;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        logger.debug(`Executing operation: ${context.operation}, attempt ${attempt}/${config.maxAttempts}`);
        return await operation();
      } catch (error) {
        lastError = this.enhanceError(error, context);
        
        // Record error metrics
        this.recordErrorMetrics(lastError);
        
        // Check if error is retryable
        if (!this.shouldRetry(lastError, config, attempt)) {
          break;
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt - 1, config);
        logger.warn(
          `Operation failed (attempt ${attempt}/${config.maxAttempts}): ${lastError.message}. ` +
          `Retrying in ${delay}ms...`,
          { error: lastError.toJSON() }
        );
        
        if (attempt < config.maxAttempts) {
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted, try fallback strategies
    if (lastError) {
      return await this.executeWithFallback(lastError, context);
    }

    throw new EnhancedError(
      'Operation failed with unknown error',
      ErrorCategory.SYSTEM,
      ErrorSeverity.CRITICAL,
      context
    );
  }

  /**
   * Execute fallback strategies when primary operation fails
   */
  private async executeWithFallback<T>(error: EnhancedError, context: ErrorContext): Promise<T> {
    for (const strategy of this.fallbackStrategies) {
      if (strategy.condition(error)) {
        try {
          logger.info(`Executing fallback strategy: ${strategy.name}`, { error: error.toJSON() });
          return await strategy.execute(error, context);
        } catch (fallbackError) {
          logger.warn(`Fallback strategy ${strategy.name} failed:`, fallbackError);
          continue;
        }
      }
    }

    // No fallback strategy worked, throw the original error
    logger.error(`All retry attempts and fallback strategies failed for operation: ${context.operation}`, {
      error: error.toJSON(),
      metrics: this.getErrorMetrics()
    });
    
    throw error;
  }

  /**
   * Enhance a generic error with structured information
   */
  enhanceError(error: any, context: ErrorContext): EnhancedError {
    if (error instanceof EnhancedError) {
      return error;
    }

    const message = error?.message || 'Unknown error';
    let category = ErrorCategory.SYSTEM;
    let severity = ErrorSeverity.MEDIUM;
    let isRetryable = false;

    // Categorize error based on message and type
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND') {
      category = ErrorCategory.NETWORK;
      severity = ErrorSeverity.HIGH;
      isRetryable = true;
    } else if (error?.code === 'ETIMEDOUT' || message.includes('timeout')) {
      category = ErrorCategory.TIMEOUT;
      severity = ErrorSeverity.MEDIUM;
      isRetryable = true;
    } else if (error?.response?.status === 429 || message.includes('rate limit')) {
      category = ErrorCategory.RATE_LIMIT;
      severity = ErrorSeverity.LOW;
      isRetryable = true;
    } else if (error?.response?.status === 401 || error?.response?.status === 403) {
      category = ErrorCategory.AUTHENTICATION;
      severity = ErrorSeverity.HIGH;
      isRetryable = false;
    } else if (error?.response?.status >= 500) {
      category = ErrorCategory.API;
      severity = ErrorSeverity.HIGH;
      isRetryable = true;
    } else if (message.includes('validation') || message.includes('invalid')) {
      category = ErrorCategory.VALIDATION;
      severity = ErrorSeverity.MEDIUM;
      isRetryable = false;
    } else if (message.includes('file') || message.includes('directory')) {
      category = ErrorCategory.FILE_SYSTEM;
      severity = ErrorSeverity.MEDIUM;
      isRetryable = false;
    } else if (message.includes('tool') || message.includes('execute')) {
      category = ErrorCategory.TOOL_EXECUTION;
      severity = ErrorSeverity.MEDIUM;
      isRetryable = true;
    } else if (message.includes('parse') || message.includes('JSON')) {
      category = ErrorCategory.PARSING;
      severity = ErrorSeverity.LOW;
      isRetryable = true;
    }

    return new EnhancedError(
      message,
      category,
      severity,
      context,
      isRetryable,
      error instanceof Error ? error : undefined
    );
  }

  /**
   * Determine if an error should be retried
   */
  private shouldRetry(error: EnhancedError, config: RetryConfig, attempt: number): boolean {
    if (attempt >= config.maxAttempts) {
      return false;
    }

    if (!error.isRetryable) {
      return false;
    }

    if (!config.retryableErrors.includes(error.category)) {
      return false;
    }

    if (config.retryCondition && !config.retryCondition(error)) {
      return false;
    }

    return true;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter
    return Math.min(exponentialDelay + jitter, config.maxDelayMs);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Record error metrics for monitoring
   */
  private recordErrorMetrics(error: EnhancedError): void {
    const key = `${error.category}:${error.context.operation}`;
    const existing = this.errorMetrics.get(key) || { count: 0, lastOccurrence: 0 };
    
    this.errorMetrics.set(key, {
      count: existing.count + 1,
      lastOccurrence: Date.now()
    });
  }

  /**
   * Add a custom fallback strategy
   */
  addFallbackStrategy(strategy: FallbackStrategy): void {
    this.fallbackStrategies.push(strategy);
    logger.info(`Added fallback strategy: ${strategy.name}`);
  }

  /**
   * Get error metrics for monitoring and debugging
   */
  getErrorMetrics(): Record<string, { count: number; lastOccurrence: number }> {
    return Object.fromEntries(this.errorMetrics);
  }

  /**
   * Clear error metrics
   */
  clearErrorMetrics(): void {
    this.errorMetrics.clear();
  }

  /**
   * Setup default fallback strategies
   */
  private setupDefaultFallbackStrategies(): void {
    // Network error fallback
    this.addFallbackStrategy({
      name: 'network-error-fallback',
      condition: (error) => error.category === ErrorCategory.NETWORK,
      execute: async (error, context) => {
        logger.info('Network error detected, attempting with different endpoint or cached data');
        throw error; // Default implementation - subclasses can override
      }
    });

    // Rate limit fallback
    this.addFallbackStrategy({
      name: 'rate-limit-fallback',
      condition: (error) => error.category === ErrorCategory.RATE_LIMIT,
      execute: async (error, context) => {
        logger.info('Rate limit detected, using cached response or simplified operation');
        throw error; // Default implementation - subclasses can override
      }
    });

    // Tool execution fallback
    this.addFallbackStrategy({
      name: 'tool-execution-fallback',
      condition: (error) => error.category === ErrorCategory.TOOL_EXECUTION,
      execute: async (error, context) => {
        logger.info('Tool execution failed, attempting with alternative tool or manual operation');
        throw error; // Default implementation - subclasses can override
      }
    });
  }
}

/**
 * Global error handler instance
 */
export const globalErrorHandler = new EnhancedErrorHandler();

/**
 * Convenience function to execute operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: Partial<ErrorContext>,
  retryConfig?: Partial<RetryConfig>
): Promise<T> {
  const fullContext: ErrorContext = {
    operation: context.operation || 'unknown',
    timestamp: Date.now(),
    ...context
  };

  return globalErrorHandler.executeWithRetry(operation, fullContext, retryConfig);
}

/**
 * Create a custom error handler with specific configuration
 */
export function createErrorHandler(config: Partial<RetryConfig>): EnhancedErrorHandler {
  return new EnhancedErrorHandler(config);
}