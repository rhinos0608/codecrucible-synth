/**
 * Resilient CLI Wrapper - Iteration 5: Enhanced Error Handling & Resilience
 * Wraps CLI operations with comprehensive error handling and graceful degradation
 */

import { EventEmitter } from 'events';
import { createLogger } from '../logging/logger-adapter.js';
import { ILogger } from '../../domain/interfaces/logger.js';
import { ErrorRecoverySystem, ErrorContext, RecoveryAction } from './error-recovery-system.js';
import chalk from 'chalk';

export interface ResilientOptions {
  enableGracefulDegradation: boolean;
  retryAttempts: number;
  timeoutMs: number;
  fallbackMode: 'safe' | 'basic' | 'minimal';
  errorNotification: boolean;
}

export interface OperationResult {
  success: boolean;
  data?: any;
  error?: string;
  warnings?: string[];
  degraded?: boolean;
  fallbackUsed?: boolean;
  metrics?: {
    attempts: number;
    duration: number;
    recoveryActions: number;
  };
}

export class ResilientCLIWrapper extends EventEmitter {
  private logger: ILogger;
  private errorRecovery: ErrorRecoverySystem;
  private operationCount = 0;
  private defaultOptions: ResilientOptions;

  constructor(options: Partial<ResilientOptions> = {}) {
    super();
    this.logger = createLogger('ResilientCLI');
    this.errorRecovery = new ErrorRecoverySystem();

    this.defaultOptions = {
      enableGracefulDegradation: true,
      retryAttempts: 3,
      timeoutMs: 120000, // 2 minutes for complex AI operations
      fallbackMode: 'basic',
      errorNotification: true,
      ...options,
    };

    this.setupErrorRecoveryListeners();
  }

  /**
   * Execute an operation with comprehensive error handling
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    context: {
      name: string;
      component: string;
      critical?: boolean;
      timeout?: number;
    },
    options: Partial<ResilientOptions> = {}
  ): Promise<OperationResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const operationId = `op_${++this.operationCount}_${Date.now()}`;
    const startTime = Date.now();

    let attempts = 0;
    const warnings: string[] = [];
    let lastError: Error | null = null;

    this.logger.info(`Starting operation: ${context.name}`, { operationId });

    try {
      // Setup timeout if specified
      const timeoutPromise =
        mergedOptions.timeoutMs > 0
          ? this.createTimeoutPromise(mergedOptions.timeoutMs, context.name)
          : null;

      for (attempts = 1; attempts <= mergedOptions.retryAttempts; attempts++) {
        try {
          // Execute operation with optional timeout
          const operationPromise = operation();
          const result = timeoutPromise
            ? await Promise.race([operationPromise, timeoutPromise])
            : await operationPromise;

          // Success case
          return {
            success: true,
            data: result,
            metrics: {
              attempts,
              duration: Date.now() - startTime,
              recoveryActions: 0,
            },
          };
        } catch (error) {
          lastError = error as Error;
          attempts++;

          // Create error context
          const errorContext: ErrorContext = {
            error: lastError,
            operation: context.name,
            component: context.component || 'unknown',
            severity: context.critical ? 'critical' : 'medium',
            recoverable: attempts < mergedOptions.retryAttempts,
            metadata: { operationId, attempt: attempts },
            timestamp: new Date(),
          };

          // Attempt error recovery
          try {
            const recoveryResult = await this.errorRecovery.handleError(lastError, errorContext);

            if (recoveryResult && !recoveryResult.error) {
              // Recovery successful
              warnings.push(`Recovered from error using fallback: ${lastError.message}`);
              return {
                success: true,
                data: recoveryResult,
                warnings,
                fallbackUsed: true,
                metrics: {
                  attempts,
                  duration: Date.now() - startTime,
                  recoveryActions: 1,
                },
              };
            }
          } catch (recoveryError) {
            this.logger.warn(`Recovery failed for ${context.name}:`, recoveryError);
          }

          // If not last attempt, add delay before retry
          if (attempts < mergedOptions.retryAttempts) {
            const delay = this.calculateBackoffDelay(attempts);
            this.logger.debug(`Retrying ${context.name} in ${delay}ms (attempt ${attempts + 1})`);
            await this.sleep(delay);
          }
        }
      }

      // All attempts failed - try graceful degradation
      if (mergedOptions.enableGracefulDegradation && !context.critical) {
        const degradedResult = await this.attemptGracefulDegradation(
          context,
          lastError!,
          mergedOptions.fallbackMode
        );

        if (degradedResult) {
          warnings.push(`Operation degraded due to: ${lastError!.message}`);
          return {
            success: true,
            data: degradedResult,
            warnings,
            degraded: true,
            metrics: {
              attempts,
              duration: Date.now() - startTime,
              recoveryActions: 1,
            },
          };
        }
      }

      // Complete failure
      return {
        success: false,
        error: `Operation failed after ${attempts} attempts: ${lastError?.message}`,
        warnings,
        metrics: {
          attempts,
          duration: Date.now() - startTime,
          recoveryActions: 0,
        },
      };
    } catch (error) {
      // Unexpected error in wrapper itself
      this.logger.error(`Unexpected error in resilient wrapper:`, error);
      return {
        success: false,
        error: `System error: ${(error as Error).message}`,
        metrics: {
          attempts: attempts || 1,
          duration: Date.now() - startTime,
          recoveryActions: 0,
        },
      };
    }
  }

  /**
   * Execute with simple retry logic (for basic operations)
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxAttempts = 3
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        this.logger.warn(`${operationName} failed (attempt ${attempt}):`, error);

        if (attempt === maxAttempts) {
          throw error;
        }

        await this.sleep(Math.min(1000 * attempt, 5000));
      }
    }
    return null;
  }

  /**
   * Safe execution with fallback value
   */
  async executeSafely<T>(
    operation: () => Promise<T>,
    fallback: T,
    operationName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger.warn(`${operationName} failed, using fallback:`, error);

      if (this.defaultOptions.errorNotification) {
        console.warn(chalk.yellow(`⚠️  ${operationName} unavailable, using defaults`));
      }

      return fallback;
    }
  }

  /**
   * Batch execution with partial failure tolerance
   */
  async executeBatch<T>(
    operations: (() => Promise<T>)[],
    context: {
      name: string;
      component: string;
      tolerateFailures?: boolean;
      maxFailures?: number;
    }
  ): Promise<OperationResult> {
    const results: T[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let successCount = 0;

    const maxFailures = context.maxFailures ?? Math.floor(operations.length / 2);
    const startTime = Date.now();

    for (let i = 0; i < operations.length; i++) {
      try {
        const result = await operations[i]();
        results.push(result);
        successCount++;
      } catch (error) {
        const errorMsg = `Batch operation ${i + 1} failed: ${(error as Error).message}`;
        errors.push(errorMsg);

        if (!context.tolerateFailures || errors.length > maxFailures) {
          return {
            success: false,
            error: `Batch failed: too many errors (${errors.length})`,
            data: { results, errors },
            metrics: {
              attempts: 1,
              duration: Date.now() - startTime,
              recoveryActions: 0,
            },
          };
        }

        warnings.push(errorMsg);
      }
    }

    const success = successCount > 0;
    return {
      success,
      data: results,
      warnings: warnings.length > 0 ? warnings : undefined,
      degraded: errors.length > 0,
      metrics: {
        attempts: 1,
        duration: Date.now() - startTime,
        recoveryActions: 0,
      },
    };
  }

  /**
   * Attempt graceful degradation
   */
  private async attemptGracefulDegradation(
    context: { name: string; component: string },
    error: Error,
    mode: ResilientOptions['fallbackMode']
  ): Promise<any> {
    this.logger.info(`Attempting graceful degradation for ${context.name} in ${mode} mode`);

    switch (mode) {
      case 'minimal':
        return this.createMinimalFallback(context, error);
      case 'basic':
        return this.createBasicFallback(context, error);
      case 'safe':
        return this.createSafeFallback(context, error);
      default:
        return null;
    }
  }

  /**
   * Create minimal fallback response
   */
  private async createMinimalFallback(
    context: { name: string; component: string },
    error: Error
  ): Promise<any> {
    return {
      mode: 'minimal',
      message: `${context.name} is running in minimal mode`,
      limitations: ['Limited functionality due to error'],
      originalError: error.message,
    };
  }

  /**
   * Create basic fallback response
   */
  private async createBasicFallback(
    context: { name: string; component: string },
    error: Error
  ): Promise<any> {
    return {
      mode: 'basic',
      message: `${context.name} is running with basic functionality`,
      availableFeatures: ['core operations only'],
      originalError: error.message,
    };
  }

  /**
   * Create safe fallback response
   */
  private async createSafeFallback(
    context: { name: string; component: string },
    error: Error
  ): Promise<any> {
    return {
      mode: 'safe',
      message: `${context.name} is running in safe mode`,
      status: 'degraded but functional',
      originalError: error.message,
    };
  }

  /**
   * Create timeout promise with cleanup
   */
  private async createTimeoutPromise(timeoutMs: number, operationName: string): Promise<never> {
    return new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation '${operationName}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Prevent timeout from keeping process alive during tests
      timeoutId.unref();

      // Store timeout ID for potential cleanup (though in this case it auto-cleans when Promise resolves)
      return timeoutId;
    });
  }

  /**
   * Calculate backoff delay for retries
   */
  private calculateBackoffDelay(attempt: number): number {
    // Exponential backoff with jitter
    const base = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
    const jitter = Math.random() * 0.3 * base;
    return Math.floor(base + jitter);
  }

  /**
   * Setup error recovery event listeners
   */
  private setupErrorRecoveryListeners(): void {
    this.errorRecovery.on('recovery:success', event => {
      this.logger.info('Error recovery successful:', {
        operation: event.context.operation,
        action: event.action.description,
      });
    });

    this.errorRecovery.on('error:critical', event => {
      console.error(chalk.red(`🚨 Critical Error: ${event.error.message}`));
      this.emit('critical_error', event);
    });

    this.errorRecovery.on('error:overload', event => {
      console.error(chalk.red(`🛑 System Overload: Too many errors (${event.errorCount})`));
      this.emit('system_overload', event);
    });
  }

  /**
   * Get system health and error statistics
   */
  getSystemHealth(): any {
    const errorStats = this.errorRecovery.getErrorStats();
    const systemHealth = this.errorRecovery.getSystemHealth();

    return {
      ...systemHealth,
      operationCount: this.operationCount,
      errorStats,
      configuration: this.defaultOptions,
    };
  }

  /**
   * Utility sleep function
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  shutdown(): void {
    this.errorRecovery.clearHistory();
    this.removeAllListeners();
  }
}

export default ResilientCLIWrapper;
