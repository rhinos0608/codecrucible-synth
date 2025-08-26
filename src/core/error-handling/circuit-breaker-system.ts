/**
 * Circuit Breaker System - Advanced Resilience Pattern
 * 
 * Implements circuit breaker patterns for:
 * - External service protection
 * - Automatic retry with exponential backoff
 * - Fallback mechanism activation
 * - Service health monitoring
 * - Recovery state management
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { TimeoutManager, TimeoutLevel } from './timeout-manager.js';

export enum CircuitState {
  CLOSED = 'closed',       // Normal operation
  OPEN = 'open',          // Circuit tripped, failing fast
  HALF_OPEN = 'half_open' // Testing recovery
}

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;      // Number of failures to trip circuit
  recoveryTimeout: number;       // Time to wait before trying recovery
  successThreshold: number;      // Successes needed in HALF_OPEN to close
  timeout: number;              // Individual operation timeout
  maxRetries: number;           // Max retries before circuit opens
  backoffMultiplier: number;    // Exponential backoff multiplier
  maxBackoffTime: number;       // Maximum backoff time
  fallbackEnabled: boolean;     // Whether fallback is available
  healthCheckInterval?: number; // Health check interval when open
}

export interface CircuitMetrics {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  circuitOpenCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  averageResponseTime: number;
  errorRate: number;
}

export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  fromFallback?: boolean;
  metrics: {
    duration: number;
    attempts: number;
    circuitState: CircuitState;
  };
}

export class CircuitBreaker<T = any> extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private nextAttemptTime = 0;
  private metrics: CircuitMetrics;
  private timeoutManager: TimeoutManager;
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(
    private config: CircuitBreakerConfig,
    private operation: (...args: any[]) => Promise<T>,
    private fallback?: (...args: any[]) => Promise<T>
  ) {
    super();
    
    this.metrics = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      timeoutCount: 0,
      circuitOpenCount: 0,
      averageResponseTime: 0,
      errorRate: 0
    };

    this.timeoutManager = TimeoutManager.getInstance();
    this.setupHealthCheck();
  }

  /**
   * Execute the operation with circuit breaker protection
   */
  async execute(...args: any[]): Promise<OperationResult<T>> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        // Circuit is open, try fallback if available
        if (this.config.fallbackEnabled && this.fallback) {
          return this.executeFallback(args, startTime);
        }
        
        // No fallback, fail fast
        const error = new CircuitBreakerError(
          `Circuit breaker is OPEN for ${this.config.name}`,
          this.state
        );
        
        this.emit('circuit-open-reject', { config: this.config, error });
        
        return {
          success: false,
          error,
          metrics: {
            duration: Date.now() - startTime,
            attempts: 0,
            circuitState: this.state
          }
        };
      } else {
        // Try to recover - move to HALF_OPEN
        this.transitionTo(CircuitState.HALF_OPEN);
      }
    }

    // Execute with retry logic
    return this.executeWithRetry(args, startTime);
  }

  /**
   * Execute operation with retry and backoff logic
   */
  private async executeWithRetry(args: any[], startTime: number): Promise<OperationResult<T>> {
    let lastError: Error | undefined;
    let attempts = 0;
    let backoffTime = 1000; // Start with 1 second

    while (attempts < this.config.maxRetries) {
      attempts++;

      try {
        // Execute with timeout
        const result = await this.timeoutManager.withTimeout(
          () => this.operation(...args),
          `${this.config.name}-operation`,
          {
            level: TimeoutLevel.OPERATION,
            duration: this.config.timeout
          }
        );

        // Success - handle state transitions
        await this.onSuccess(result, startTime, attempts);

        return {
          success: true,
          data: result,
          metrics: {
            duration: Date.now() - startTime,
            attempts,
            circuitState: this.state
          }
        };

      } catch (error) {
        lastError = error as Error;
        
        // Handle timeout specifically
        if (this.isTimeoutError(error)) {
          this.metrics.timeoutCount++;
        }

        // Check if this is the last attempt
        if (attempts >= this.config.maxRetries) {
          break;
        }

        // Wait before retry with exponential backoff
        logger.warn(`Attempt ${attempts} failed for ${this.config.name}, retrying in ${backoffTime}ms`, {
          error: (error as Error).message,
          backoffTime
        });

        await new Promise(resolve => setTimeout(resolve, backoffTime));
        backoffTime = Math.min(
          backoffTime * this.config.backoffMultiplier,
          this.config.maxBackoffTime
        );
      }
    }

    // All attempts failed
    await this.onFailure(lastError!, startTime, attempts);

    // Try fallback if available and circuit allows it
    if (this.config.fallbackEnabled && this.fallback && this.state !== CircuitState.OPEN) {
      logger.info(`Trying fallback for ${this.config.name} after ${attempts} failed attempts`);
      return this.executeFallback(args, startTime, attempts);
    }

    return {
      success: false,
      error: lastError,
      metrics: {
        duration: Date.now() - startTime,
        attempts,
        circuitState: this.state
      }
    };
  }

  /**
   * Execute fallback operation
   */
  private async executeFallback(
    args: any[], 
    startTime: number, 
    previousAttempts: number = 0
  ): Promise<OperationResult<T>> {
    if (!this.fallback) {
      throw new Error(`No fallback available for ${this.config.name}`);
    }

    try {
      logger.info(`Executing fallback for ${this.config.name}`);
      const result = await this.fallback(...args);
      
      this.emit('fallback-success', { config: this.config, result });
      
      return {
        success: true,
        data: result,
        fromFallback: true,
        metrics: {
          duration: Date.now() - startTime,
          attempts: previousAttempts + 1,
          circuitState: this.state
        }
      };
    } catch (error) {
      logger.error(`Fallback failed for ${this.config.name}`, error);
      
      this.emit('fallback-failure', { config: this.config, error });
      
      return {
        success: false,
        error: error as Error,
        fromFallback: true,
        metrics: {
          duration: Date.now() - startTime,
          attempts: previousAttempts + 1,
          circuitState: this.state
        }
      };
    }
  }

  /**
   * Handle successful operation
   */
  private async onSuccess(result: T, startTime: number, attempts: number): Promise<void> {
    const duration = Date.now() - startTime;
    
    this.updateMetrics(true, duration);
    this.successCount++;
    this.failureCount = 0; // Reset failure count on success
    this.metrics.lastSuccessTime = Date.now();

    // Update average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.successCount - 1) + duration) / 
      this.metrics.successCount;

    // Handle state transitions
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.OPEN) {
      // Should not happen, but handle gracefully
      this.transitionTo(CircuitState.HALF_OPEN);
    }

    this.emit('operation-success', { 
      config: this.config, 
      result, 
      duration, 
      attempts, 
      state: this.state 
    });
  }

  /**
   * Handle failed operation
   */
  private async onFailure(error: Error, startTime: number, attempts: number): Promise<void> {
    const duration = Date.now() - startTime;
    
    this.updateMetrics(false, duration);
    this.failureCount++;
    this.successCount = 0; // Reset success count on failure
    this.lastFailureTime = Date.now();
    this.metrics.lastFailureTime = Date.now();

    // Check if we should open the circuit
    if (this.failureCount >= this.config.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
    }

    this.emit('operation-failure', { 
      config: this.config, 
      error, 
      duration, 
      attempts, 
      state: this.state,
      failureCount: this.failureCount
    });
  }

  /**
   * Transition to a new circuit state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitState.OPEN) {
      this.metrics.circuitOpenCount++;
      this.startHealthCheck();
    } else if (newState === CircuitState.CLOSED) {
      this.stopHealthCheck();
      this.failureCount = 0;
      this.successCount = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.stopHealthCheck();
      this.successCount = 0; // Reset for recovery testing
    }

    logger.info(`Circuit breaker ${this.config.name} transitioned from ${oldState} to ${newState}`);
    
    this.emit('state-change', {
      config: this.config,
      oldState,
      newState,
      metrics: this.metrics
    });
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(success: boolean, duration: number): void {
    if (success) {
      this.metrics.successCount++;
    } else {
      this.metrics.failureCount++;
    }

    // Calculate error rate
    const totalOperations = this.metrics.successCount + this.metrics.failureCount;
    this.metrics.errorRate = totalOperations > 0 ? 
      (this.metrics.failureCount / totalOperations) * 100 : 0;
  }

  /**
   * Setup health check for OPEN state
   */
  private setupHealthCheck(): void {
    if (this.config.healthCheckInterval) {
      // Health check will be started when circuit opens
    }
  }

  /**
   * Start health checking when circuit is OPEN
   */
  private startHealthCheck(): void {
    if (!this.config.healthCheckInterval) return;

    this.healthCheckTimer = setInterval(async () => {
      if (this.state === CircuitState.OPEN) {
        try {
          // Perform a lightweight health check
          logger.debug(`Health check for circuit breaker ${this.config.name}`);
          
          // This could be customized per circuit breaker
          // For now, we just check if it's time to try recovery
          if (Date.now() >= this.nextAttemptTime) {
            logger.info(`Health check suggests recovery attempt for ${this.config.name}`);
            // The next actual request will trigger the HALF_OPEN transition
          }
        } catch (error) {
          logger.debug(`Health check failed for ${this.config.name}`, error);
        }
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health checking
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Check if error is a timeout error
   */
  private isTimeoutError(error: any): boolean {
    return error?.name === 'TimeoutError' || 
           error?.code === 'TIMEOUT' ||
           error?.message?.includes('timeout');
  }

  /**
   * Get current circuit breaker status
   */
  getStatus(): {
    name: string;
    state: CircuitState;
    metrics: CircuitMetrics;
    config: CircuitBreakerConfig;
    nextAttemptTime?: number;
  } {
    return {
      name: this.config.name,
      state: this.state,
      metrics: { ...this.metrics },
      config: { ...this.config },
      nextAttemptTime: this.state === CircuitState.OPEN ? this.nextAttemptTime : undefined
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = 0;
    
    // Reset metrics
    this.metrics = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      timeoutCount: 0,
      circuitOpenCount: 0,
      averageResponseTime: 0,
      errorRate: 0
    };

    this.emit('circuit-reset', { config: this.config });
  }

  /**
   * Force circuit to specific state (for testing)
   */
  forceState(state: CircuitState): void {
    this.transitionTo(state);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopHealthCheck();
    this.removeAllListeners();
  }
}

/**
 * Circuit Breaker Manager for managing multiple circuit breakers
 */
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  private constructor() {}

  public static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  /**
   * Create or get a circuit breaker
   */
  getCircuitBreaker<T>(
    name: string,
    operation: (...args: any[]) => Promise<T>,
    config?: Partial<CircuitBreakerConfig>,
    fallback?: (...args: any[]) => Promise<T>
  ): CircuitBreaker<T> {
    if (this.circuitBreakers.has(name)) {
      return this.circuitBreakers.get(name)!;
    }

    const defaultConfig: CircuitBreakerConfig = {
      name,
      failureThreshold: 5,
      recoveryTimeout: 60000,
      successThreshold: 3,
      timeout: 30000,
      maxRetries: 3,
      backoffMultiplier: 2,
      maxBackoffTime: 30000,
      fallbackEnabled: !!fallback,
      healthCheckInterval: 30000
    };

    const finalConfig = { ...defaultConfig, ...config, name };
    const circuitBreaker = new CircuitBreaker(finalConfig, operation, fallback);
    
    this.circuitBreakers.set(name, circuitBreaker);
    return circuitBreaker;
  }

  /**
   * Get all circuit breaker statuses
   */
  getAllStatuses(): Record<string, any> {
    const statuses: Record<string, any> = {};
    
    this.circuitBreakers.forEach((cb, name) => {
      statuses[name] = cb.getStatus();
    });
    
    return statuses;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.circuitBreakers.forEach((cb) => {
      cb.reset();
    });
  }

  /**
   * Remove a circuit breaker
   */
  remove(name: string): boolean {
    const cb = this.circuitBreakers.get(name);
    if (cb) {
      cb.destroy();
      return this.circuitBreakers.delete(name);
    }
    return false;
  }

  /**
   * Cleanup all circuit breakers
   */
  destroy(): void {
    this.circuitBreakers.forEach((cb) => {
      cb.destroy();
    });
    this.circuitBreakers.clear();
  }
}

/**
 * Circuit Breaker Error class
 */
export class CircuitBreakerError extends Error {
  constructor(message: string, public circuitState: CircuitState) {
    super(message);
    this.name = 'CircuitBreakerError';
    Error.captureStackTrace(this, CircuitBreakerError);
  }
}

/**
 * Utility function to wrap operations with circuit breaker
 */
export function withCircuitBreaker<T>(
  name: string,
  config?: Partial<CircuitBreakerConfig>,
  fallback?: (...args: any[]) => Promise<T>
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const manager = CircuitBreakerManager.getInstance();

    descriptor.value = async function (...args: any[]) {
      const circuitBreaker = manager.getCircuitBreaker(
        `${target.constructor.name}.${propertyName}`,
        () => method.apply(this, args),
        config,
        fallback ? () => fallback.apply(this, args) : undefined
      );

      const result = await circuitBreaker.execute(...args);
      
      if (!result.success) {
        throw result.error;
      }
      
      return result.data;
    };

    return descriptor;
  };
}