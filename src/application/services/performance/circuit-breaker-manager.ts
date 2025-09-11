/**
 * Circuit Breaker Manager
 * Implements adaptive circuit breakers for performance protection
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../infrastructure/logging/logger-adapter.js';
import type {
  CircuitBreakerState,
  CircuitBreakerConfig,
  ICircuitBreakerManager,
  CircuitBreakerEvent,
} from './performance-types.js';

const logger = createLogger('CircuitBreakerManager');

interface CircuitBreakerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastExecutionTime: number;
}

export class CircuitBreakerManager extends EventEmitter implements ICircuitBreakerManager {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private metrics: Map<string, CircuitBreakerMetrics> = new Map();
  private checkInterval?: NodeJS.Timeout;

  private readonly DEFAULT_CONFIG: CircuitBreakerConfig = {
    threshold: 5,
    timeout: 60000, // 1 minute
    resetTimeout: 30000, // 30 seconds
  };

  constructor(private configs: Record<string, CircuitBreakerConfig> = {}) {
    super();
    this.initializeDefaultBreakers();
    this.startPeriodicChecks();

    logger.info('CircuitBreakerManager initialized', {
      breakerCount: this.circuitBreakers.size,
    });
  }

  /**
   * Initialize default circuit breakers
   */
  private initializeDefaultBreakers(): void {
    const defaultBreakers = [
      'routing-coordinator',
      'cli-processing',
      'spiral-processing',
      'analytics',
      'external-api',
      'model-client',
      'cache-operations',
      'database-operations',
    ];

    defaultBreakers.forEach(name => {
      const config = this.configs[name] || this.DEFAULT_CONFIG;
      this.createCircuitBreaker(name, config);
    });
  }

  /**
   * Create a new circuit breaker
   */
  private createCircuitBreaker(name: string, config: CircuitBreakerConfig): void {
    const breaker: CircuitBreakerState = {
      name,
      state: 'CLOSED',
      failures: 0,
      successes: 0,
      threshold: config.threshold,
      timeout: config.timeout,
      resetTimeout: config.resetTimeout,
    };

    const metrics: CircuitBreakerMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastExecutionTime: Date.now(),
    };

    this.circuitBreakers.set(name, breaker);
    this.metrics.set(name, metrics);

    logger.debug('Circuit breaker created', { name, config });
  }

  /**
   * Get circuit breaker state
   */
  public getState(name: string): CircuitBreakerState | undefined {
    return this.circuitBreakers.get(name);
  }

  /**
   * Get all circuit breaker states
   */
  public getAllStates(): CircuitBreakerState[] {
    return Array.from(this.circuitBreakers.values());
  }

  /**
   * Execute operation with circuit breaker protection
   */
  public async executeWithBreaker<T>(name: string, operation: () => Promise<T>): Promise<T> {
    let breaker = this.circuitBreakers.get(name);

    // Create breaker if it doesn't exist
    if (!breaker) {
      this.createCircuitBreaker(name, this.DEFAULT_CONFIG);
      breaker = this.circuitBreakers.get(name)!;
    }

    const metrics = this.metrics.get(name)!;
    const startTime = Date.now();

    // Check if circuit breaker should allow the request
    if (!this.shouldAllowRequest(breaker)) {
      const error = new Error(`Circuit breaker '${name}' is OPEN - request blocked`);
      logger.warn('Request blocked by circuit breaker', { name, state: breaker.state });
      throw error;
    }

    try {
      // Execute the operation
      const result = await operation();

      // Record success
      const responseTime = Date.now() - startTime;
      this.recordSuccess(name, responseTime);

      logger.debug('Circuit breaker operation succeeded', {
        name,
        responseTime,
        state: breaker.state,
      });

      return result;
    } catch (error) {
      // Record failure
      const responseTime = Date.now() - startTime;
      this.recordFailure(name, responseTime);

      logger.warn('Circuit breaker operation failed', {
        name,
        error: error instanceof Error ? error.message : String(error),
        responseTime,
        failures: breaker.failures,
      });

      throw error;
    }
  }

  /**
   * Check if request should be allowed
   */
  private shouldAllowRequest(breaker: CircuitBreakerState): boolean {
    const now = Date.now();

    switch (breaker.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        // Check if timeout period has passed
        if (breaker.lastFailure && now - breaker.lastFailure >= breaker.resetTimeout) {
          this.transitionTo(breaker, 'HALF_OPEN');
          return true;
        }
        return false;

      case 'HALF_OPEN':
        // Allow limited requests in half-open state
        return true;

      default:
        return false;
    }
  }

  /**
   * Record successful operation
   */
  private recordSuccess(name: string, responseTime: number): void {
    const breaker = this.circuitBreakers.get(name)!;
    const metrics = this.metrics.get(name)!;

    breaker.successes++;
    breaker.failures = 0; // Reset failure count on success

    // Update metrics
    metrics.totalRequests++;
    metrics.successfulRequests++;
    metrics.lastExecutionTime = Date.now();
    this.updateAverageResponseTime(metrics, responseTime);

    // Handle state transitions
    if (breaker.state === 'HALF_OPEN') {
      // If we have enough successes in half-open state, close the circuit
      if (breaker.successes >= Math.ceil(breaker.threshold / 2)) {
        this.transitionTo(breaker, 'CLOSED');
        breaker.successes = 0;
      }
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(name: string, responseTime: number): void {
    const breaker = this.circuitBreakers.get(name)!;
    const metrics = this.metrics.get(name)!;

    breaker.failures++;
    breaker.lastFailure = Date.now();
    breaker.successes = 0; // Reset success count on failure

    // Update metrics
    metrics.totalRequests++;
    metrics.failedRequests++;
    metrics.lastExecutionTime = Date.now();
    this.updateAverageResponseTime(metrics, responseTime);

    // Check if we should open the circuit
    if (breaker.failures >= breaker.threshold) {
      if (breaker.state === 'CLOSED' || breaker.state === 'HALF_OPEN') {
        this.transitionTo(breaker, 'OPEN');
      }
    }
  }

  /**
   * Transition circuit breaker to new state
   */
  private transitionTo(breaker: CircuitBreakerState, newState: CircuitBreakerState['state']): void {
    const oldState = breaker.state;
    breaker.state = newState;

    logger.info('Circuit breaker state transition', {
      name: breaker.name,
      from: oldState,
      to: newState,
      failures: breaker.failures,
      successes: breaker.successes,
    });

    // Emit state change event
    const event: CircuitBreakerEvent = {
      timestamp: Date.now(),
      type: 'circuit-breaker',
      data: {
        name: breaker.name,
        oldState,
        newState,
        reason: this.getTransitionReason(oldState, newState, breaker),
      },
    };

    this.emit('state-change', event);
  }

  /**
   * Get reason for state transition
   */
  private getTransitionReason(
    oldState: CircuitBreakerState['state'],
    newState: CircuitBreakerState['state'],
    breaker: CircuitBreakerState
  ): string {
    if (oldState === 'CLOSED' && newState === 'OPEN') {
      return `Failure threshold exceeded (${breaker.failures}/${breaker.threshold})`;
    }
    if (oldState === 'OPEN' && newState === 'HALF_OPEN') {
      return `Reset timeout elapsed (${breaker.resetTimeout}ms)`;
    }
    if (oldState === 'HALF_OPEN' && newState === 'CLOSED') {
      return `Sufficient successes in half-open state (${breaker.successes})`;
    }
    if (oldState === 'HALF_OPEN' && newState === 'OPEN') {
      return `Failure in half-open state`;
    }
    return 'Manual transition';
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(metrics: CircuitBreakerMetrics, responseTime: number): void {
    const totalTime = metrics.averageResponseTime * (metrics.totalRequests - 1);
    metrics.averageResponseTime = (totalTime + responseTime) / metrics.totalRequests;
  }

  /**
   * Reset circuit breaker manually
   */
  public async resetBreaker(name: string): Promise<void> {
    const breaker = this.circuitBreakers.get(name);

    if (!breaker) {
      throw new Error(`Circuit breaker '${name}' not found`);
    }

    const oldState = breaker.state;
    breaker.state = 'CLOSED';
    breaker.failures = 0;
    breaker.successes = 0;
    delete breaker.lastFailure;

    logger.info('Circuit breaker manually reset', { name, oldState });

    // Emit reset event
    const event: CircuitBreakerEvent = {
      timestamp: Date.now(),
      type: 'circuit-breaker',
      data: {
        name: breaker.name,
        oldState,
        newState: 'CLOSED',
        reason: 'Manual reset',
      },
    };

    this.emit('state-change', event);
  }

  /**
   * Update circuit breaker configuration
   */
  public async updateConfig(name: string, config: Partial<CircuitBreakerConfig>): Promise<void> {
    const breaker = this.circuitBreakers.get(name);

    if (!breaker) {
      throw new Error(`Circuit breaker '${name}' not found`);
    }

    // Update configuration
    if (config.threshold !== undefined) {
      breaker.threshold = config.threshold;
    }
    if (config.timeout !== undefined) {
      breaker.timeout = config.timeout;
    }
    if (config.resetTimeout !== undefined) {
      breaker.resetTimeout = config.resetTimeout;
    }

    logger.info('Circuit breaker configuration updated', { name, config });
  }

  /**
   * Start periodic checks for circuit breaker states
   */
  private startPeriodicChecks(): void {
    this.checkInterval = setInterval(() => {
      this.performPeriodicChecks();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Perform periodic checks on circuit breakers
   */
  private performPeriodicChecks(): void {
    const now = Date.now();

    this.circuitBreakers.forEach(breaker => {
      // Check for stale breakers (no activity for long time)
      const metrics = this.metrics.get(breaker.name);
      if (metrics && now - metrics.lastExecutionTime > 300000) {
        // 5 minutes
        logger.debug('Circuit breaker stale', {
          name: breaker.name,
          lastActivity: now - metrics.lastExecutionTime,
        });
      }

      // Auto-reset open breakers after extended periods
      if (breaker.state === 'OPEN' && breaker.lastFailure) {
        const timeOpen = now - breaker.lastFailure;
        if (timeOpen > breaker.timeout) {
          logger.info('Auto-resetting circuit breaker after timeout', {
            name: breaker.name,
            timeOpen,
          });
          this.resetBreaker(breaker.name).catch(err => {
            logger.error('Failed to auto-reset circuit breaker', {
              name: breaker.name,
              error: err,
            });
          });
        }
      }
    });
  }

  /**
   * Get circuit breaker metrics
   */
  public getMetrics(name: string): CircuitBreakerMetrics | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get all circuit breaker metrics
   */
  public getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const result: Record<string, CircuitBreakerMetrics> = {};
    this.metrics.forEach((metrics, name) => {
      result[name] = { ...metrics };
    });
    return result;
  }

  /**
   * Get health status of all circuit breakers
   */
  public getHealthStatus(): {
    healthy: string[];
    degraded: string[];
    unhealthy: string[];
    totalBreakers: number;
  } {
    const healthy: string[] = [];
    const degraded: string[] = [];
    const unhealthy: string[] = [];

    this.circuitBreakers.forEach(breaker => {
      const metrics = this.metrics.get(breaker.name);

      if (breaker.state === 'OPEN') {
        unhealthy.push(breaker.name);
      } else if (breaker.state === 'HALF_OPEN') {
        degraded.push(breaker.name);
      } else if (metrics && metrics.totalRequests > 0) {
        const errorRate = metrics.failedRequests / metrics.totalRequests;
        if (errorRate > 0.1) {
          // 10% error rate
          degraded.push(breaker.name);
        } else {
          healthy.push(breaker.name);
        }
      } else {
        healthy.push(breaker.name);
      }
    });

    return {
      healthy,
      degraded,
      unhealthy,
      totalBreakers: this.circuitBreakers.size,
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }

    this.circuitBreakers.clear();
    this.metrics.clear();
    this.removeAllListeners();

    logger.info('CircuitBreakerManager destroyed');
  }
}
