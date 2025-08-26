/**
 * Timeout Manager - Comprehensive Timeout Handling System
 * 
 * Provides hierarchical timeout management with:
 * - Operation-level timeouts
 * - Request-level timeouts  
 * - Session-level timeouts
 * - Timeout warnings and recovery
 * - Configurable timeout strategies
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { BootstrapErrorSystem, BootstrapErrorType, BootstrapPhase } from './bootstrap-error-system.js';

export enum TimeoutLevel {
  OPERATION = 'operation',     // Individual async operation (e.g., file read)
  REQUEST = 'request',         // Full request processing
  SESSION = 'session',         // Entire user session
  SYSTEM = 'system'           // System-wide operations
}

export enum TimeoutStrategy {
  STRICT = 'strict',           // Hard timeout, immediate cancellation
  GRACEFUL = 'graceful',       // Allow completion with warning
  EXPONENTIAL = 'exponential', // Exponential backoff retry
  PROGRESSIVE = 'progressive'  // Progressive timeout extension
}

export interface TimeoutConfig {
  level: TimeoutLevel;
  duration: number;
  strategy: TimeoutStrategy;
  warningThreshold?: number;    // Percentage of timeout to warn at
  maxRetries?: number;
  backoffMultiplier?: number;
  maxBackoffTime?: number;
  onWarning?: (remaining: number) => void;
  onTimeout?: (context: TimeoutContext) => Promise<TimeoutAction>;
}

export interface TimeoutContext {
  id: string;
  operation: string;
  startTime: number;
  config: TimeoutConfig;
  attempts: number;
  metadata?: Record<string, any>;
}

export enum TimeoutAction {
  CANCEL = 'cancel',
  RETRY = 'retry',
  EXTEND = 'extend',
  CONTINUE = 'continue'
}

export class TimeoutManager extends EventEmitter {
  private static instance: TimeoutManager;
  private activeTimeouts: Map<string, TimeoutContext> = new Map();
  private timeoutHandles: Map<string, NodeJS.Timeout> = new Map();
  private warningHandles: Map<string, NodeJS.Timeout> = new Map();
  private bootstrapErrorSystem: BootstrapErrorSystem;

  // Default timeout configurations
  private defaultConfigs: Record<TimeoutLevel, TimeoutConfig> = {
    [TimeoutLevel.OPERATION]: {
      level: TimeoutLevel.OPERATION,
      duration: 10000,      // 10 seconds
      strategy: TimeoutStrategy.GRACEFUL,
      warningThreshold: 0.8, // Warn at 80%
      maxRetries: 3,
      backoffMultiplier: 1.5
    },
    [TimeoutLevel.REQUEST]: {
      level: TimeoutLevel.REQUEST,
      duration: 60000,      // 60 seconds
      strategy: TimeoutStrategy.PROGRESSIVE,
      warningThreshold: 0.75,
      maxRetries: 2,
      maxBackoffTime: 30000
    },
    [TimeoutLevel.SESSION]: {
      level: TimeoutLevel.SESSION,
      duration: 1800000,    // 30 minutes
      strategy: TimeoutStrategy.GRACEFUL,
      warningThreshold: 0.9
    },
    [TimeoutLevel.SYSTEM]: {
      level: TimeoutLevel.SYSTEM,
      duration: 300000,     // 5 minutes
      strategy: TimeoutStrategy.STRICT,
      warningThreshold: 0.85
    }
  };

  private constructor() {
    super();
    this.bootstrapErrorSystem = BootstrapErrorSystem.getInstance();
    this.setupProcessHandlers();
  }

  public static getInstance(): TimeoutManager {
    if (!TimeoutManager.instance) {
      TimeoutManager.instance = new TimeoutManager();
    }
    return TimeoutManager.instance;
  }

  /**
   * Create a timeout for an async operation
   */
  async withTimeout<T>(
    operation: () => Promise<T>,
    operationName: string,
    config?: Partial<TimeoutConfig>
  ): Promise<T> {
    const finalConfig = this.mergeConfig(config);
    const context = this.createTimeoutContext(operationName, finalConfig);
    
    try {
      this.startTimeout(context);
      const result = await operation();
      this.clearTimeout(context.id);
      return result;
    } catch (error) {
      this.clearTimeout(context.id);
      
      if (this.isTimeoutError(error)) {
        return this.handleTimeoutError(context, error);
      }
      
      throw error;
    }
  }

  /**
   * Create an AbortController with timeout
   */
  createAbortController(
    operationName: string,
    config?: Partial<TimeoutConfig>
  ): { controller: AbortController; timeoutId: string } {
    const finalConfig = this.mergeConfig(config);
    const context = this.createTimeoutContext(operationName, finalConfig);
    const controller = new AbortController();
    
    this.startTimeout(context, () => {
      controller.abort();
    });

    return { controller, timeoutId: context.id };
  }

  /**
   * Wrap a Promise with timeout and cancellation
   */
  wrapWithTimeout<T>(
    promise: Promise<T>,
    operationName: string,
    config?: Partial<TimeoutConfig>
  ): Promise<T> {
    const finalConfig = this.mergeConfig(config);
    const context = this.createTimeoutContext(operationName, finalConfig);

    return new Promise<T>((resolve, reject) => {
      let completed = false;

      // Set up timeout
      const timeoutHandle = setTimeout(async () => {
        if (completed) return;
        completed = true;
        
        const action = await this.handleTimeout(context);
        
        switch (action) {
          case TimeoutAction.CANCEL:
            reject(new TimeoutError(`Operation '${operationName}' timed out after ${finalConfig.duration}ms`));
            break;
          case TimeoutAction.RETRY:
            // Retry logic would be handled by the caller
            reject(new TimeoutError(`Operation '${operationName}' timed out, retry suggested`));
            break;
          case TimeoutAction.EXTEND:
            // This would extend the timeout - implementation depends on strategy
            reject(new TimeoutError(`Operation '${operationName}' timeout extended`));
            break;
          case TimeoutAction.CONTINUE:
            // Allow operation to continue
            break;
        }
      }, finalConfig.duration);

      // Set up warning
      if (finalConfig.warningThreshold && finalConfig.onWarning) {
        const warningTime = finalConfig.duration * finalConfig.warningThreshold;
        const warningHandle = setTimeout(() => {
          if (!completed && finalConfig.onWarning) {
            const remaining = finalConfig.duration - warningTime;
            finalConfig.onWarning(remaining);
          }
        }, warningTime);
        
        this.warningHandles.set(context.id, warningHandle);
      }

      this.timeoutHandles.set(context.id, timeoutHandle);

      // Handle promise resolution
      promise
        .then((result) => {
          if (!completed) {
            completed = true;
            this.clearTimeout(context.id);
            resolve(result);
          }
        })
        .catch((error) => {
          if (!completed) {
            completed = true;
            this.clearTimeout(context.id);
            reject(error);
          }
        });
    });
  }

  /**
   * Create a timeout for bootstrap operations
   */
  async withBootstrapTimeout<T>(
    operation: () => Promise<T>,
    phase: BootstrapPhase,
    component: string,
    config?: Partial<TimeoutConfig>
  ): Promise<T> {
    const operationName = `${phase}:${component}`;
    
    try {
      return await this.withTimeout(operation, operationName, {
        ...config,
        onTimeout: async (context) => {
          // Create bootstrap error for timeout
          const error = this.bootstrapErrorSystem.createBootstrapError(
            `Timeout during ${phase} phase in ${component}`,
            phase,
            BootstrapErrorType.TIMEOUT,
            component,
            { 
            context: { 
              phase,
              component,
              startTime: Date.now(),
              timeout: context.config.duration,
              environment: { operation: operationName }
            } 
          }
          );

          // Handle the bootstrap error
          const result = await this.bootstrapErrorSystem.handleBootstrapError(error);
          
          if (result.canContinue) {
            return TimeoutAction.CONTINUE;
          } else if (result.retryAfter) {
            return TimeoutAction.RETRY;
          }
          
          return TimeoutAction.CANCEL;
        }
      });
    } catch (error) {
      if (error instanceof TimeoutError) {
        // Convert to bootstrap error
        const bootstrapError = this.bootstrapErrorSystem.createBootstrapError(
          `Bootstrap timeout: ${error.message}`,
          phase,
          BootstrapErrorType.TIMEOUT,
          component
        );
        
        await this.bootstrapErrorSystem.handleBootstrapError(bootstrapError);
      }
      throw error;
    }
  }

  /**
   * Get active timeouts for monitoring
   */
  getActiveTimeouts(): TimeoutContext[] {
    return Array.from(this.activeTimeouts.values());
  }

  /**
   * Cancel a specific timeout
   */
  cancelTimeout(timeoutId: string): boolean {
    return this.clearTimeout(timeoutId);
  }

  /**
   * Cancel all active timeouts
   */
  cancelAllTimeouts(): void {
    const timeoutIds = Array.from(this.activeTimeouts.keys());
    timeoutIds.forEach(id => this.clearTimeout(id));
  }

  /**
   * Update timeout configuration
   */
  updateConfig(level: TimeoutLevel, config: Partial<TimeoutConfig>): void {
    this.defaultConfigs[level] = { ...this.defaultConfigs[level], ...config };
  }

  /**
   * Get timeout statistics
   */
  getStatistics(): {
    activeCount: number;
    totalTimeouts: number;
    averageDuration: number;
    byLevel: Record<TimeoutLevel, number>;
  } {
    const active = this.getActiveTimeouts();
    const byLevel = active.reduce((acc, context) => {
      acc[context.config.level] = (acc[context.config.level] || 0) + 1;
      return acc;
    }, {} as Record<TimeoutLevel, number>);

    return {
      activeCount: active.length,
      totalTimeouts: this.activeTimeouts.size,
      averageDuration: active.reduce((sum, ctx) => sum + ctx.config.duration, 0) / (active.length || 1),
      byLevel
    };
  }

  // Private methods

  private createTimeoutContext(operationName: string, config: TimeoutConfig): TimeoutContext {
    const id = `timeout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const context: TimeoutContext = {
      id,
      operation: operationName,
      startTime: Date.now(),
      config,
      attempts: 0
    };

    this.activeTimeouts.set(id, context);
    return context;
  }

  private startTimeout(context: TimeoutContext, customHandler?: () => void): void {
    // Set up warning if configured
    if (context.config.warningThreshold && context.config.onWarning) {
      const warningTime = context.config.duration * context.config.warningThreshold;
      const warningHandle = setTimeout(() => {
        const remaining = context.config.duration - warningTime;
        context.config.onWarning!(remaining);
        this.emit('timeout-warning', context, remaining);
      }, warningTime);
      
      this.warningHandles.set(context.id, warningHandle);
    }

    // Set up main timeout
    const timeoutHandle = setTimeout(async () => {
      if (customHandler) {
        customHandler();
      } else {
        await this.handleTimeout(context);
      }
    }, context.config.duration);

    this.timeoutHandles.set(context.id, timeoutHandle);
  }

  private async handleTimeout(context: TimeoutContext): Promise<TimeoutAction> {
    this.emit('timeout', context);
    
    logger.warn(`Timeout occurred for operation: ${context.operation}`, {
      duration: context.config.duration,
      strategy: context.config.strategy,
      attempts: context.attempts
    });

    // Handle based on strategy
    switch (context.config.strategy) {
      case TimeoutStrategy.STRICT:
        return TimeoutAction.CANCEL;
        
      case TimeoutStrategy.GRACEFUL:
        // Allow some grace period
        logger.info(`Graceful timeout for ${context.operation}, allowing completion`);
        return TimeoutAction.CONTINUE;
        
      case TimeoutStrategy.EXPONENTIAL:
        if (context.attempts < (context.config.maxRetries || 3)) {
          const backoffTime = Math.min(
            context.config.duration * Math.pow(context.config.backoffMultiplier || 2, context.attempts),
            context.config.maxBackoffTime || 60000
          );
          
          logger.info(`Exponential backoff retry for ${context.operation}, waiting ${backoffTime}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          
          context.attempts++;
          return TimeoutAction.RETRY;
        }
        return TimeoutAction.CANCEL;
        
      case TimeoutStrategy.PROGRESSIVE:
        // Extend timeout progressively
        const extension = context.config.duration * 0.5; // 50% extension
        context.config.duration += extension;
        
        logger.info(`Progressive timeout extension for ${context.operation}, extended by ${extension}ms`);
        return TimeoutAction.EXTEND;
        
      default:
        return TimeoutAction.CANCEL;
    }
  }

  private async handleTimeoutError<T>(context: TimeoutContext, error: any): Promise<T> {
    const action = await this.handleTimeout(context);
    
    switch (action) {
      case TimeoutAction.RETRY:
        // This would typically be handled by retry logic in the caller
        throw new TimeoutError(`Retry suggested for ${context.operation}`);
      case TimeoutAction.CONTINUE:
        // Return a default or partial result if possible
        throw error;
      default:
        throw error;
    }
  }

  private mergeConfig(config?: Partial<TimeoutConfig>): TimeoutConfig {
    const level = config?.level || TimeoutLevel.OPERATION;
    const baseConfig = this.defaultConfigs[level];
    
    return {
      ...baseConfig,
      ...config,
      level
    };
  }

  private clearTimeout(timeoutId: string): boolean {
    const timeoutHandle = this.timeoutHandles.get(timeoutId);
    const warningHandle = this.warningHandles.get(timeoutId);
    
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.timeoutHandles.delete(timeoutId);
    }
    
    if (warningHandle) {
      clearTimeout(warningHandle);
      this.warningHandles.delete(timeoutId);
    }
    
    const existed = this.activeTimeouts.delete(timeoutId);
    
    if (existed) {
      this.emit('timeout-cleared', timeoutId);
    }
    
    return existed;
  }

  private isTimeoutError(error: any): boolean {
    return error instanceof TimeoutError || 
           error?.name === 'TimeoutError' ||
           error?.code === 'TIMEOUT' ||
           error?.message?.includes('timeout');
  }

  private setupProcessHandlers(): void {
    // Clean up timeouts on process exit
    const cleanup = () => {
      this.cancelAllTimeouts();
    };

    process.once('SIGTERM', cleanup);
    process.once('SIGINT', cleanup);
    process.once('exit', cleanup);
  }
}

/**
 * Custom timeout error class
 */
export class TimeoutError extends Error {
  constructor(message: string, public duration?: number) {
    super(message);
    this.name = 'TimeoutError';
    Error.captureStackTrace(this, TimeoutError);
  }
}

/**
 * Utility function to create timeout decorators
 */
export function withTimeout(
  operationName: string,
  config?: Partial<TimeoutConfig>
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const timeoutManager = TimeoutManager.getInstance();
      return timeoutManager.withTimeout(
        () => method.apply(this, args),
        `${target.constructor.name}.${propertyName}`,
        config
      );
    };

    return descriptor;
  };
}