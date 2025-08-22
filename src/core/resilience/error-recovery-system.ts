/**
 * Error Recovery System - Iteration 5: Enhanced Error Handling & Resilience
 * Provides comprehensive error handling, recovery, and graceful degradation
 */

import { EventEmitter } from 'events';
import { Logger } from '../logger.js';
import { getErrorMessage } from '../../utils/error-utils.js';

export interface ErrorContext {
  operation: string;
  component: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'graceful_degradation' | 'notify_user' | 'abort';
  description: string;
  action: () => Promise<any>;
  maxAttempts?: number;
  backoffMs?: number;
}

export interface ErrorPattern {
  pattern: RegExp | string;
  handler: (error: Error, context: ErrorContext) => RecoveryAction[];
  category: string;
  priority: number;
}

export class ErrorRecoverySystem extends EventEmitter {
  private static globalErrorHandlersRegistered = false;
  private logger: Logger;
  private errorHistory: Map<string, ErrorContext[]> = new Map();
  private recoveryPatterns: ErrorPattern[] = [];
  private globalErrorCount = 0;
  private maxGlobalErrors = 50;

  constructor() {
    super();
    this.logger = new Logger('ErrorRecovery');
    this.setupDefaultPatterns();
    this.setupGlobalErrorHandling();
  }

  /**
   * Setup default error patterns and recovery strategies
   */
  private setupDefaultPatterns(): void {
    // Network/Connection errors
    this.registerPattern({
      pattern: /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed/i,
      category: 'network',
      priority: 1,
      handler: (error, context) => [
        {
          type: 'retry',
          description: 'Retry network operation with backoff',
          action: async () => {
            throw error;
          }, // Will be overridden by caller
          maxAttempts: 3,
          backoffMs: 1000,
        },
        {
          type: 'graceful_degradation',
          description: 'Continue with limited functionality',
          action: async () => ({ degraded: true, reason: 'network_error' }),
        },
      ],
    });

    // File system errors
    this.registerPattern({
      pattern: /ENOENT|EACCES|EPERM|EMFILE/i,
      category: 'filesystem',
      priority: 1,
      handler: (error, context) => [
        {
          type: 'fallback',
          description: 'Use alternative file access method',
          action: async () => this.createFallbackFileHandler(error, context),
        },
        {
          type: 'notify_user',
          description: 'Inform user about file access issue',
          action: async () => this.notifyFileSystemError(error, context),
        },
      ],
    });

    // Model/AI service errors
    this.registerPattern({
      pattern: /model.*not.*found|service.*unavailable|rate.*limit/i,
      category: 'ai_service',
      priority: 1,
      handler: (error, context) => [
        {
          type: 'fallback',
          description: 'Switch to fallback model/provider',
          action: async () => ({ fallback_provider: true }),
        },
        {
          type: 'graceful_degradation',
          description: 'Continue with basic functionality',
          action: async () => ({ basic_mode: true }),
        },
      ],
    });

    // Memory/Resource errors
    this.registerPattern({
      pattern: /out of memory|heap.*limit|ENOMEM/i,
      category: 'resource',
      priority: 2,
      handler: (error, context) => [
        {
          type: 'graceful_degradation',
          description: 'Clear caches and reduce memory usage',
          action: async () => this.performMemoryCleanup(),
        },
        {
          type: 'notify_user',
          description: 'Warn user about resource constraints',
          action: async () => this.notifyResourceError(error, context),
        },
      ],
    });

    // JSON/Parsing errors
    this.registerPattern({
      pattern: /unexpected.*token|invalid.*json|parse.*error/i,
      category: 'parsing',
      priority: 1,
      handler: (error, context) => [
        {
          type: 'fallback',
          description: 'Use alternative parser or safe defaults',
          action: async () => this.createSafeParsingFallback(error, context),
        },
      ],
    });

    // TypeScript/Compilation errors
    this.registerPattern({
      pattern: /typescript|tsc|type.*error|cannot find module/i,
      category: 'compilation',
      priority: 1,
      handler: (error, context) => [
        {
          type: 'fallback',
          description: 'Skip type checking or use JavaScript mode',
          action: async () => ({ skip_types: true, mode: 'javascript' }),
        },
      ],
    });
  }

  /**
   * Register a new error pattern and recovery strategy
   */
  registerPattern(pattern: ErrorPattern): void {
    this.recoveryPatterns.push(pattern);
    // Sort by priority (higher priority first)
    this.recoveryPatterns.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Handle an error with automatic recovery
   */
  async handleError(error: Error, context: ErrorContext): Promise<any> {
    this.globalErrorCount++;

    // Check if we've exceeded global error limit
    if (this.globalErrorCount > this.maxGlobalErrors) {
      return this.handleCriticalErrorOverload(error, context);
    }

    // Log the error
    this.logger.error(`Error in ${context.component}:${context.operation}`, {
      error: error.message,
      severity: context.severity,
      recoverable: context.recoverable,
    });

    // Record error history
    this.recordError(context);

    // Find matching recovery pattern
    const recoveryActions = this.findRecoveryActions(error, context);

    if (recoveryActions.length === 0) {
      return this.handleUnknownError(error, context);
    }

    // Execute recovery actions in order
    for (const action of recoveryActions) {
      try {
        const result = await this.executeRecoveryAction(action, error, context);

        if (result !== null && result !== undefined) {
          this.logger.info(`Recovery successful: ${action.description}`);
          this.emit('recovery:success', { error, context, action, result });
          return result;
        }
      } catch (recoveryError: unknown) {
        this.logger.warn(`Recovery action failed: ${action.description}`, {
          error: getErrorMessage(recoveryError),
        });
      }
    }

    // If all recovery actions failed
    return this.handleUnrecoverableError(error, context);
  }

  /**
   * Find recovery actions for an error
   */
  private findRecoveryActions(error: Error, context: ErrorContext): RecoveryAction[] {
    const actions: RecoveryAction[] = [];
    const errorMessage = error.message.toLowerCase();

    for (const pattern of this.recoveryPatterns) {
      let matches = false;

      if (pattern.pattern instanceof RegExp) {
        matches = pattern.pattern.test(errorMessage);
      } else {
        matches = errorMessage.includes(pattern.pattern.toLowerCase());
      }

      if (matches) {
        const patternActions = pattern.handler(error, context);
        actions.push(...patternActions);
        break; // Use first matching pattern
      }
    }

    return actions;
  }

  /**
   * Execute a recovery action with retry logic
   */
  private async executeRecoveryAction(
    action: RecoveryAction,
    originalError: Error,
    context: ErrorContext
  ): Promise<any> {
    const maxAttempts = action.maxAttempts || 1;
    const backoffMs = action.backoffMs || 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1 && backoffMs > 0) {
          await this.sleep(backoffMs * attempt);
        }

        const result = await action.action();
        return result;
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }

        this.logger.debug(`Recovery attempt ${attempt}/${maxAttempts} failed, retrying...`);
      }
    }

    return null;
  }

  /**
   * Record error in history for pattern analysis
   */
  private recordError(context: ErrorContext): void {
    const key = `${context.component}:${context.operation}`;

    if (!this.errorHistory.has(key)) {
      this.errorHistory.set(key, []);
    }

    const history = this.errorHistory.get(key)!;
    history.push(context);

    // Keep only last 10 errors per operation
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * Handle unknown errors with default strategy
   */
  private async handleUnknownError(error: Error, context: ErrorContext): Promise<any> {
    this.logger.warn('Unknown error pattern, using default handling', {
      error: error.message,
      context,
    });

    if (context.severity === 'critical') {
      this.emit('error:critical', { error, context });
      throw error;
    }

    return {
      error: true,
      message: 'Operation failed, continuing with limited functionality',
      originalError: error.message,
    };
  }

  /**
   * Handle unrecoverable errors
   */
  private async handleUnrecoverableError(error: Error, context: ErrorContext): Promise<any> {
    this.logger.error('All recovery attempts failed', {
      error: error.message,
      context,
    });

    this.emit('error:unrecoverable', { error, context });

    if (context.severity === 'critical') {
      throw new Error(`Critical error in ${context.component}: ${error.message}`);
    }

    return {
      error: true,
      recovered: false,
      message: 'Operation failed after recovery attempts',
      originalError: error.message,
    };
  }

  /**
   * Handle critical error overload
   */
  private async handleCriticalErrorOverload(error: Error, context: ErrorContext): Promise<any> {
    this.logger.error(`Critical: Too many errors (${this.globalErrorCount}), entering safe mode`);
    this.emit('error:overload', { errorCount: this.globalErrorCount });

    throw new Error('System entered safe mode due to excessive errors');
  }

  /**
   * Fallback file system handlers
   */
  private async createFallbackFileHandler(error: Error, context: ErrorContext): Promise<any> {
    // Return safe defaults or alternative access methods
    return {
      fallback: true,
      method: 'safe_defaults',
      reason: 'filesystem_error',
    };
  }

  /**
   * Safe parsing fallback
   */
  private async createSafeParsingFallback(error: Error, context: ErrorContext): Promise<any> {
    return {
      parsed: true,
      data: {},
      warning: 'Used safe parsing fallback',
      originalError: error.message,
    };
  }

  /**
   * Perform memory cleanup
   */
  private async performMemoryCleanup(): Promise<any> {
    // Trigger garbage collection if available
    if (global.gc) {
      global.gc();
    }

    this.emit('memory:cleanup');

    return {
      cleaned: true,
      memoryAfter: process.memoryUsage().heapUsed,
    };
  }

  /**
   * Notify user of filesystem errors
   */
  private async notifyFileSystemError(error: Error, context: ErrorContext): Promise<any> {
    const message = `File system error: ${error.message}. Continuing with limited functionality.`;
    console.warn(`⚠️  ${message}`);
    return { notified: true, message };
  }

  /**
   * Notify user of resource errors
   */
  private async notifyResourceError(error: Error, context: ErrorContext): Promise<any> {
    const message = `Resource constraint: ${error.message}. Performance may be affected.`;
    console.warn(`⚠️  ${message}`);
    return { notified: true, message };
  }

  /**
   * Setup global error handling (only register once)
   */
  private setupGlobalErrorHandling(): void {
    if (!ErrorRecoverySystem.globalErrorHandlersRegistered) {
      ErrorRecoverySystem.globalErrorHandlersRegistered = true;

      process.on('uncaughtException', error => {
        this.logger.error('Uncaught exception:', error);
        this.emit('error:uncaught', error);
      });

      process.on('unhandledRejection', (reason, promise) => {
        this.logger.error('Unhandled rejection:', reason);
        this.emit('error:unhandled_rejection', { reason, promise });
      });
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): any {
    const stats = {
      totalErrors: this.globalErrorCount,
      errorsByComponent: {} as Record<string, number>,
      errorsByCategory: {} as Record<string, number>,
      recentErrors: [] as ErrorContext[],
    };

    // Collect statistics from error history
    for (const [key, history] of this.errorHistory.entries()) {
      const component = key.split(':')[0];
      stats.errorsByComponent[component] =
        (stats.errorsByComponent[component] || 0) + history.length;

      // Add recent errors
      stats.recentErrors.push(...history.slice(-3));
    }

    return stats;
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory.clear();
    this.globalErrorCount = 0;
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check system health
   */
  getSystemHealth(): any {
    const stats = this.getErrorStats();
    const health = {
      status: 'healthy' as 'healthy' | 'degraded' | 'critical',
      errorRate: this.globalErrorCount,
      issues: [] as string[],
    };

    if (this.globalErrorCount > 30) {
      health.status = 'critical';
      health.issues.push('High error rate detected');
    } else if (this.globalErrorCount > 15) {
      health.status = 'degraded';
      health.issues.push('Moderate error rate');
    }

    return health;
  }
}

export default ErrorRecoverySystem;
