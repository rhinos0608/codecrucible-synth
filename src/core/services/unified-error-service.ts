/**
 * Unified Error Service - Consolidates all error handling functionality
 * Combines features from:
 * - core/error-handling/enterprise-error-handler.ts (enterprise error management)
 * - core/error-handling/structured-error-system.ts (structured errors)
 * - core/search/error-handler.ts (search-specific error handling)
 *
 * Provides:
 * - Centralized error handling with structured error types
 * - Enterprise features (audit logging, metrics, alerting)
 * - Intelligent fallback and retry mechanisms
 * - Context-aware error categorization and severity assessment
 * - Circuit breaker and rate limiting patterns
 * - Comprehensive error recovery strategies
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { resourceManager } from '../../infrastructure/performance/resource-cleanup-manager.js';

// Core error types
export enum ErrorSeverity {
  LOW = 'low', // Recoverable, continue with degraded performance
  MEDIUM = 'medium', // Significant issue, attempt fallback
  HIGH = 'high', // Critical failure, immediate fallback required
  CRITICAL = 'critical', // System failure, emergency fallback only
}

export enum ErrorCategory {
  // System errors
  TOOL_NOT_FOUND = 'tool_not_found',
  PERMISSION_DENIED = 'permission_denied',
  TIMEOUT = 'timeout',
  MEMORY_LIMIT = 'memory_limit',
  DISK_IO_ERROR = 'disk_io_error',
  PROCESS_ERROR = 'process_error',
  NETWORK_ERROR = 'network_error',

  // Application errors
  VALIDATION_ERROR = 'validation_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  AUTHORIZATION_ERROR = 'authorization_error',
  CONFIGURATION_ERROR = 'configuration_error',
  PARSING_ERROR = 'parsing_error',

  // Business logic errors
  INVALID_INPUT = 'invalid_input',
  INVALID_PATTERN = 'invalid_pattern',
  RESOURCE_NOT_FOUND = 'resource_not_found',
  OPERATION_FAILED = 'operation_failed',
  CONCURRENT_MODIFICATION = 'concurrent_modification',

  // Service errors
  SERVICE_UNAVAILABLE = 'service_unavailable',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CIRCUIT_BREAKER_OPEN = 'circuit_breaker_open',
  DEPENDENCY_FAILURE = 'dependency_failure',

  // Unknown
  UNKNOWN = 'unknown',
}

export interface ErrorContext {
  // Request context
  requestId?: string;
  sessionId?: string;
  userId?: string;

  // Operation context
  operation?: string;
  service?: string;
  resource?: string;
  method?: string;

  // Network context
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;

  // Runtime context
  attempt?: number;
  maxAttempts?: number;
  startTime?: number;
  fallbacksUsed?: string[];

  // Platform context
  platform?: string;
  shell?: string;
  environment?: Record<string, any>;

  // Additional metadata
  metadata?: Record<string, any>;
}

export interface ErrorMetadata {
  timestamp: number;
  stackTrace?: string;
  errorCode?: string;
  causedBy?: StructuredError[];
  relatedErrors?: StructuredError[];
  tags?: string[];
  fingerprint?: string;
}

export class StructuredError extends Error {
  public readonly id: string;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly metadata: ErrorMetadata;
  public readonly isRetryable: boolean;
  public readonly originalError?: Error;

  constructor(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context: ErrorContext = {},
    options: {
      originalError?: Error;
      isRetryable?: boolean;
      errorCode?: string;
      tags?: string[];
      metadata?: Record<string, any>;
    } = {}
  ) {
    super(message);
    this.name = 'StructuredError';

    this.id = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.category = category;
    this.severity = severity;
    this.context = context;
    this.isRetryable = options.isRetryable ?? this.determineRetryability(category);
    this.originalError = options.originalError;

    this.metadata = {
      timestamp: Date.now(),
      stackTrace: this.stack,
      errorCode: options.errorCode,
      tags: options.tags,
      fingerprint: this.generateFingerprint(),
      ...options.metadata,
    };
  }

  private determineRetryability(category: ErrorCategory): boolean {
    const nonRetryableCategories = [
      ErrorCategory.VALIDATION_ERROR,
      ErrorCategory.AUTHENTICATION_ERROR,
      ErrorCategory.AUTHORIZATION_ERROR,
      ErrorCategory.INVALID_INPUT,
      ErrorCategory.INVALID_PATTERN,
      ErrorCategory.PARSING_ERROR,
    ];

    return !nonRetryableCategories.includes(category);
  }

  private generateFingerprint(): string {
    const key = `${this.category}:${this.message}:${this.context.operation || 'unknown'}`;
    // Simple hash function for fingerprinting
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      context: this.context,
      metadata: this.metadata,
      isRetryable: this.isRetryable,
      originalError: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
            stack: this.originalError.stack,
          }
        : undefined,
    };
  }
}

// Fallback strategy interface
export interface FallbackStrategy {
  name: string;
  description: string;
  condition: (error: StructuredError) => boolean;
  execute: (context: ErrorContext, originalOperation: () => Promise<any>) => Promise<any>;
  priority: number; // Lower numbers = higher priority
  maxAttempts: number;
  delayMs: number;
  requiredResources?: string[];
  platforms?: string[];
}

// Circuit breaker state
export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  successCount: number;
}

// Rate limiter state
export interface RateLimiterState {
  requests: number;
  windowStart: number;
  isLimited: boolean;
}

// Error metrics
export interface ErrorMetrics {
  category: ErrorCategory;
  count: number;
  lastOccurrence: Date;
  severity: ErrorSeverity;
  avgResolutionTime: number;
  retrySuccessRate: number;
  fallbackSuccessRate: number;
}

// Configuration
export interface UnifiedErrorConfig {
  // Feature flags
  enableAuditLogging: boolean;
  enableMetrics: boolean;
  enableAlerts: boolean;
  enableCircuitBreaker: boolean;
  enableRateLimiting: boolean;
  enableRetry: boolean;
  enableFallbacks: boolean;

  // Retry configuration
  maxRetryAttempts: number;
  retryDelayMs: number;
  retryBackoffMultiplier: number;
  maxRetryDelayMs: number;

  // Circuit breaker configuration
  circuitBreakerThreshold: number;
  circuitBreakerTimeoutMs: number;
  circuitBreakerRecoveryThreshold: number;

  // Rate limiting configuration
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;

  // Alerting configuration
  alertThreshold: number;
  alertCooldownMs: number;

  // Performance configuration
  metricsRetentionDays: number;
  maxErrorHistorySize: number;
}

/**
 * Unified Error Service - Main Implementation
 */
export class UnifiedErrorService extends EventEmitter {
  private static instance: UnifiedErrorService | null = null;
  private config: UnifiedErrorConfig;

  // Error tracking
  private errorMetrics: Map<string, ErrorMetrics> = new Map();
  private errorHistory: StructuredError[] = [];
  private fallbackStrategies: FallbackStrategy[] = [];

  // Circuit breaker states
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  // Rate limiting states
  private rateLimiters: Map<string, RateLimiterState> = new Map();

  // Cleanup management
  private cleanupIntervalId: string | null = null;
  private metricsIntervalId: string | null = null;

  constructor(config: Partial<UnifiedErrorConfig> = {}) {
    super();

    this.config = {
      // Feature flags
      enableAuditLogging: true,
      enableMetrics: true,
      enableAlerts: true,
      enableCircuitBreaker: true,
      enableRateLimiting: true,
      enableRetry: true,
      enableFallbacks: true,

      // Retry configuration
      maxRetryAttempts: 3,
      retryDelayMs: 1000,
      retryBackoffMultiplier: 2,
      maxRetryDelayMs: 30000,

      // Circuit breaker configuration
      circuitBreakerThreshold: 5,
      circuitBreakerTimeoutMs: 60000,
      circuitBreakerRecoveryThreshold: 3,

      // Rate limiting configuration
      rateLimitWindowMs: 60000,
      rateLimitMaxRequests: 100,

      // Alerting configuration
      alertThreshold: 10,
      alertCooldownMs: 300000,

      // Performance configuration
      metricsRetentionDays: 7,
      maxErrorHistorySize: 1000,

      ...config,
    };

    this.initializeDefaultFallbackStrategies();
    this.startCleanupTasks();
  }

  static getInstance(config?: Partial<UnifiedErrorConfig>): UnifiedErrorService {
    if (!UnifiedErrorService.instance) {
      UnifiedErrorService.instance = new UnifiedErrorService(config);
    }
    return UnifiedErrorService.instance;
  }

  /**
   * Main error handling entry point
   */
  async handleError(
    error: Error | StructuredError,
    context: ErrorContext = {}
  ): Promise<StructuredError> {
    // Convert to structured error if needed
    const structuredError =
      error instanceof StructuredError ? error : this.createStructuredError(error, context as any);

    // Update context with runtime information
    structuredError.context.startTime = structuredError.context.startTime || Date.now();
    structuredError.context.attempt = (structuredError.context.attempt || 0) + 1;

    try {
      // Process error through pipeline
      await this.processError(structuredError);
      return structuredError;
    } catch (processingError) {
      // Even error processing failed - log and return original
      logger.error('Error processing failed:', processingError);
      return structuredError;
    }
  }

  /**
   * Handle error with automatic retry and fallback
   */
  async handleErrorWithRecovery<T>(
    operation: () => Promise<T>,
    context: ErrorContext = {},
    options: {
      maxAttempts?: number;
      fallbackStrategies?: string[];
      circuitBreakerKey?: string;
      rateLimiterKey?: string;
    } = {}
  ): Promise<T> {
    const maxAttempts = options.maxAttempts || this.config.maxRetryAttempts;
    let lastError: StructuredError | null = null;

    // Check circuit breaker
    if (options.circuitBreakerKey && this.config.enableCircuitBreaker) {
      const circuitBreaker = this.getCircuitBreaker(options.circuitBreakerKey);
      if (circuitBreaker.isOpen && Date.now() < circuitBreaker.nextAttemptTime) {
        throw this.createStructuredError(
          new Error('Circuit breaker is open'),
          ErrorCategory.CIRCUIT_BREAKER_OPEN,
          ErrorSeverity.HIGH,
          context
        );
      }
    }

    // Check rate limit
    if (options.rateLimiterKey && this.config.enableRateLimiting) {
      if (this.isRateLimited(options.rateLimiterKey)) {
        throw this.createStructuredError(
          new Error('Rate limit exceeded'),
          ErrorCategory.RATE_LIMIT_EXCEEDED,
          ErrorSeverity.MEDIUM,
          context
        );
      }
    }

    // Attempt operation with retries
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        context.attempt = attempt;
        context.maxAttempts = maxAttempts;

        const result = await operation();

        // Reset circuit breaker on success
        if (options.circuitBreakerKey) {
          this.resetCircuitBreaker(options.circuitBreakerKey);
        }

        return result;
      } catch (error) {
        lastError = await this.handleError(error as any, context);

        // Update circuit breaker
        if (options.circuitBreakerKey) {
          this.recordCircuitBreakerFailure(options.circuitBreakerKey);
        }

        // Don't retry if not retryable or on last attempt
        if (!lastError.isRetryable || attempt >= maxAttempts) {
          break;
        }

        // Apply retry delay
        if (this.config.enableRetry && attempt < maxAttempts) {
          const delay = this.calculateRetryDelay(attempt);
          await this.delay(delay);
        }
      }
    }

    // Try fallback strategies
    if (this.config.enableFallbacks && lastError) {
      const applicableStrategies = this.getApplicableFallbackStrategies(
        lastError,
        options.fallbackStrategies
      );

      for (const strategy of applicableStrategies) {
        try {
          logger.info(`Attempting fallback strategy: ${strategy.name}`);
          const result = await strategy.execute(context, operation);

          // Update fallback success metrics
          this.updateFallbackMetrics(strategy.name, true);
          this.emit('fallback-success', strategy, context);

          return result;
        } catch (fallbackError) {
          this.updateFallbackMetrics(strategy.name, false);
          logger.warn(`Fallback strategy failed: ${strategy.name}`, fallbackError);
          this.emit('fallback-failure', strategy, fallbackError);
        }
      }
    }

    // All attempts and fallbacks failed
    if (lastError) {
      this.emit('recovery-exhausted', lastError, context);
      throw lastError;
    }

    throw this.createStructuredError(
      new Error('Operation failed with unknown error'),
      ErrorCategory.UNKNOWN,
      ErrorSeverity.HIGH,
      context
    );
  }

  /**
   * Create structured error from regular error
   */
  createStructuredError(
    error: Error,
    category?: ErrorCategory,
    severity?: ErrorSeverity,
    context: ErrorContext = {}
  ): StructuredError {
    return new StructuredError(
      error.message,
      category || this.categorizeError(error),
      severity || this.assessSeverity(error, category),
      context,
      { originalError: error }
    );
  }

  /**
   * Register custom fallback strategy
   */
  registerFallbackStrategy(strategy: FallbackStrategy): void {
    // Validate strategy
    if (!strategy.name || !strategy.execute) {
      throw new Error('Invalid fallback strategy: name and execute function are required');
    }

    // Remove existing strategy with same name
    this.fallbackStrategies = this.fallbackStrategies.filter(s => s.name !== strategy.name);

    // Add new strategy
    this.fallbackStrategies.push(strategy);
    this.fallbackStrategies.sort((a, b) => a.priority - b.priority);

    logger.info(`Fallback strategy registered: ${strategy.name}`);
    this.emit('fallback-strategy-registered', strategy);
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    avgResolutionTime: number;
    retrySuccessRate: number;
    fallbackSuccessRate: number;
    circuitBreakerStats: Array<{ key: string; state: CircuitBreakerState }>;
    rateLimiterStats: Array<{ key: string; state: RateLimiterState }>;
  } {
    const categoryStats: Record<string, number> = {};
    const severityStats: Record<string, number> = {};
    let totalResolutionTime = 0;
    let successfulRetries = 0;
    let totalRetries = 0;

    for (const [key, metrics] of this.errorMetrics) {
      categoryStats[metrics.category] = (categoryStats[metrics.category] || 0) + metrics.count;
      severityStats[metrics.severity] = (severityStats[metrics.severity] || 0) + metrics.count;
      totalResolutionTime += metrics.avgResolutionTime * metrics.count;
      successfulRetries += Math.floor((metrics.retrySuccessRate * metrics.count) / 100);
      totalRetries += metrics.count;
    }

    return {
      totalErrors: this.errorHistory.length,
      errorsByCategory: categoryStats,
      errorsBySeverity: severityStats,
      avgResolutionTime: totalResolutionTime / Math.max(this.errorHistory.length, 1),
      retrySuccessRate: totalRetries > 0 ? (successfulRetries / totalRetries) * 100 : 0,
      fallbackSuccessRate: this.calculateOverallFallbackSuccessRate(),
      circuitBreakerStats: Array.from(this.circuitBreakers.entries()).map(([key, state]) => ({
        key,
        state,
      })),
      rateLimiterStats: Array.from(this.rateLimiters.entries()).map(([key, state]) => ({
        key,
        state,
      })),
    };
  }

  /**
   * Private methods
   */
  private async processError(error: StructuredError): Promise<void> {
    // Update metrics
    if (this.config.enableMetrics) {
      this.updateErrorMetrics(error);
    }

    // Audit logging
    if (this.config.enableAuditLogging) {
      this.auditError(error);
    }

    // Alert if necessary
    if (this.config.enableAlerts) {
      await this.checkAlertConditions(error);
    }

    // Emit events
    this.emit('error-processed', error);
  }

  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // System errors
    if (message.includes('enoent') || message.includes('not found')) {
      return ErrorCategory.TOOL_NOT_FOUND;
    }
    if (message.includes('eacces') || message.includes('permission denied')) {
      return ErrorCategory.PERMISSION_DENIED;
    }
    if (message.includes('timeout') || name.includes('timeout')) {
      return ErrorCategory.TIMEOUT;
    }
    if (message.includes('out of memory') || message.includes('memory limit')) {
      return ErrorCategory.MEMORY_LIMIT;
    }
    if (message.includes('eio') || message.includes('disk') || message.includes('file system')) {
      return ErrorCategory.DISK_IO_ERROR;
    }

    // Network errors
    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('econnrefused')
    ) {
      return ErrorCategory.NETWORK_ERROR;
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid input')) {
      return ErrorCategory.VALIDATION_ERROR;
    }
    if (message.includes('auth') && message.includes('failed')) {
      return ErrorCategory.AUTHENTICATION_ERROR;
    }
    if (message.includes('unauthorized') || message.includes('forbidden')) {
      return ErrorCategory.AUTHORIZATION_ERROR;
    }

    return ErrorCategory.UNKNOWN;
  }

  private assessSeverity(error: Error, category?: ErrorCategory): ErrorSeverity {
    const cat = category || this.categorizeError(error);

    // Critical errors
    if (
      [
        ErrorCategory.MEMORY_LIMIT,
        ErrorCategory.DISK_IO_ERROR,
        ErrorCategory.PROCESS_ERROR,
      ].includes(cat)
    ) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors
    if (
      [
        ErrorCategory.AUTHENTICATION_ERROR,
        ErrorCategory.AUTHORIZATION_ERROR,
        ErrorCategory.SERVICE_UNAVAILABLE,
        ErrorCategory.DEPENDENCY_FAILURE,
      ].includes(cat)
    ) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity errors
    if (
      [
        ErrorCategory.TIMEOUT,
        ErrorCategory.NETWORK_ERROR,
        ErrorCategory.RATE_LIMIT_EXCEEDED,
        ErrorCategory.CONFIGURATION_ERROR,
      ].includes(cat)
    ) {
      return ErrorSeverity.MEDIUM;
    }

    // Low severity errors (default)
    return ErrorSeverity.LOW;
  }

  private updateErrorMetrics(error: StructuredError): void {
    const key = error.metadata.fingerprint || error.category;
    const existing = this.errorMetrics.get(key);

    if (existing) {
      existing.count++;
      existing.lastOccurrence = new Date();
    } else {
      this.errorMetrics.set(key, {
        category: error.category,
        count: 1,
        lastOccurrence: new Date(),
        severity: error.severity,
        avgResolutionTime: 0,
        retrySuccessRate: 0,
        fallbackSuccessRate: 0,
      });
    }

    // Add to history
    this.errorHistory.push(error);

    // Limit history size
    if (this.errorHistory.length > this.config.maxErrorHistorySize) {
      this.errorHistory.shift();
    }
  }

  private auditError(error: StructuredError): void {
    const auditData = {
      errorId: error.id,
      category: error.category,
      severity: error.severity,
      message: error.message,
      context: error.context,
      timestamp: error.metadata.timestamp,
    };

    // This would integrate with audit logging system
    logger.info('Error audit log', auditData);
    this.emit('error-audited', auditData);
  }

  private async checkAlertConditions(error: StructuredError): Promise<void> {
    // Check if error frequency exceeds threshold
    const recentErrors = this.errorHistory.filter(
      e => Date.now() - e.metadata.timestamp < this.config.alertCooldownMs
    );

    if (recentErrors.length >= this.config.alertThreshold) {
      this.emit('alert-triggered', {
        type: 'error-threshold-exceeded',
        count: recentErrors.length,
        threshold: this.config.alertThreshold,
        timeWindow: this.config.alertCooldownMs,
        latestError: error,
      });
    }

    // Check for critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      this.emit('alert-triggered', {
        type: 'critical-error',
        error,
      });
    }
  }

  private getApplicableFallbackStrategies(
    error: StructuredError,
    requestedStrategies?: string[]
  ): FallbackStrategy[] {
    let strategies = this.fallbackStrategies.filter(strategy => strategy.condition(error));

    // Filter by requested strategies if provided
    if (requestedStrategies) {
      strategies = strategies.filter(s => requestedStrategies.includes(s.name));
    }

    return strategies;
  }

  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.retryDelayMs;
    const backoffDelay = baseDelay * Math.pow(this.config.retryBackoffMultiplier, attempt - 1);
    return Math.min(backoffDelay, this.config.maxRetryDelayMs);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Circuit breaker methods
  private getCircuitBreaker(key: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, {
        isOpen: false,
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
        successCount: 0,
      });
    }
    return this.circuitBreakers.get(key)!;
  }

  private recordCircuitBreakerFailure(key: string): void {
    const breaker = this.getCircuitBreaker(key);
    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    if (breaker.failureCount >= this.config.circuitBreakerThreshold) {
      breaker.isOpen = true;
      breaker.nextAttemptTime = Date.now() + this.config.circuitBreakerTimeoutMs;
      logger.warn(`Circuit breaker opened for ${key}`);
      this.emit('circuit-breaker-opened', key, breaker);
    }
  }

  private resetCircuitBreaker(key: string): void {
    const breaker = this.getCircuitBreaker(key);
    breaker.successCount++;

    if (breaker.successCount >= this.config.circuitBreakerRecoveryThreshold) {
      breaker.isOpen = false;
      breaker.failureCount = 0;
      breaker.successCount = 0;
      breaker.nextAttemptTime = 0;
      logger.info(`Circuit breaker closed for ${key}`);
      this.emit('circuit-breaker-closed', key, breaker);
    }
  }

  // Rate limiting methods
  private isRateLimited(key: string): boolean {
    const now = Date.now();

    if (!this.rateLimiters.has(key)) {
      this.rateLimiters.set(key, {
        requests: 0,
        windowStart: now,
        isLimited: false,
      });
    }

    const limiter = this.rateLimiters.get(key)!;

    // Reset window if needed
    if (now - limiter.windowStart >= this.config.rateLimitWindowMs) {
      limiter.requests = 0;
      limiter.windowStart = now;
      limiter.isLimited = false;
    }

    limiter.requests++;
    limiter.isLimited = limiter.requests > this.config.rateLimitMaxRequests;

    return limiter.isLimited;
  }

  private updateFallbackMetrics(strategyName: string, success: boolean): void {
    // Update fallback metrics in error metrics
    for (const [key, metrics] of this.errorMetrics) {
      if (success) {
        metrics.fallbackSuccessRate = (metrics.fallbackSuccessRate + 100) / 2;
      } else {
        metrics.fallbackSuccessRate = metrics.fallbackSuccessRate * 0.9;
      }
    }
  }

  private calculateOverallFallbackSuccessRate(): number {
    const rates = Array.from(this.errorMetrics.values()).map(m => m.fallbackSuccessRate);
    return rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  }

  private initializeDefaultFallbackStrategies(): void {
    // Retry strategy
    this.registerFallbackStrategy({
      name: 'simple-retry',
      description: 'Simple retry with exponential backoff',
      condition: error => error.isRetryable && error.severity !== ErrorSeverity.CRITICAL,
      execute: async (context, operation) => {
        const delay = this.calculateRetryDelay(context.attempt || 1);
        await this.delay(delay);
        return await operation();
      },
      priority: 1,
      maxAttempts: 3,
      delayMs: 1000,
    });

    // Graceful degradation strategy
    this.registerFallbackStrategy({
      name: 'graceful-degradation',
      description: 'Return partial or cached results when possible',
      condition: error =>
        [
          ErrorCategory.TIMEOUT,
          ErrorCategory.SERVICE_UNAVAILABLE,
          ErrorCategory.NETWORK_ERROR,
        ].includes(error.category),
      execute: async (context, operation) => {
        // This would return cached or partial results
        return {
          message: 'Partial results due to service degradation',
          context,
          degraded: true,
        };
      },
      priority: 2,
      maxAttempts: 1,
      delayMs: 0,
    });

    // Alternative method strategy
    this.registerFallbackStrategy({
      name: 'alternative-method',
      description: 'Use alternative implementation when primary fails',
      condition: error =>
        [ErrorCategory.TOOL_NOT_FOUND, ErrorCategory.PROCESS_ERROR].includes(error.category),
      execute: async (context, operation) => {
        // This would use alternative implementation
        return {
          message: 'Used alternative method',
          context,
          alternative: true,
        };
      },
      priority: 3,
      maxAttempts: 1,
      delayMs: 0,
    });
  }

  private startCleanupTasks(): void {
    // Cleanup old metrics and history
    const cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 60000 * 60); // Every hour

    this.cleanupIntervalId = resourceManager.registerInterval(
      cleanupInterval,
      'UnifiedErrorService-cleanup',
      'metrics and history cleanup'
    );

    // Update metrics periodically
    const metricsInterval = setInterval(() => {
      this.emit('metrics-updated', this.getErrorStats());
    }, 60000); // Every minute

    this.metricsIntervalId = resourceManager.registerInterval(
      metricsInterval,
      'UnifiedErrorService-metrics',
      'metrics reporting'
    );
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.config.metricsRetentionDays * 24 * 60 * 60 * 1000;

    // Clean error history
    this.errorHistory = this.errorHistory.filter(error => error.metadata.timestamp > cutoff);

    // Clean metrics that haven't been updated recently
    for (const [key, metrics] of this.errorMetrics) {
      if (metrics.lastOccurrence.getTime() < cutoff) {
        this.errorMetrics.delete(key);
      }
    }

    logger.debug(`Cleaned up old error metrics, ${this.errorHistory.length} errors in history`);
  }

  /**
   * Destroy and cleanup
   */
  async destroy(): Promise<void> {
    // Stop cleanup tasks
    if (this.cleanupIntervalId) {
      resourceManager.cleanup(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    if (this.metricsIntervalId) {
      resourceManager.cleanup(this.metricsIntervalId);
      this.metricsIntervalId = null;
    }

    // Clear all data
    this.errorMetrics.clear();
    this.errorHistory.length = 0;
    this.fallbackStrategies.length = 0;
    this.circuitBreakers.clear();
    this.rateLimiters.clear();

    // Remove all listeners
    this.removeAllListeners();

    logger.info('Unified Error Service destroyed');
  }
}

// Global instance and factory functions
export const unifiedErrorService = UnifiedErrorService.getInstance();

export function createStructuredError(
  message: string,
  category: ErrorCategory,
  severity: ErrorSeverity,
  context: ErrorContext = {}
): StructuredError {
  return new StructuredError(message, category, severity, context);
}

export async function handleError(
  error: Error | StructuredError,
  context: ErrorContext = {}
): Promise<StructuredError> {
  return unifiedErrorService.handleError(error, context);
}

export async function handleErrorWithRecovery<T>(
  operation: () => Promise<T>,
  context: ErrorContext = {},
  options: {
    maxAttempts?: number;
    fallbackStrategies?: string[];
    circuitBreakerKey?: string;
    rateLimiterKey?: string;
  } = {}
): Promise<T> {
  return unifiedErrorService.handleErrorWithRecovery(operation, context, options);
}
