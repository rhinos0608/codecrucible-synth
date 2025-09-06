/**
 * Circuit Breaker System - Production Implementation
 * Provides comprehensive circuit breaker functionality with monitoring and metrics
 */

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  successThreshold?: number; // Number of successes needed in half-open to close
  timeout?: number; // Timeout for individual operations
  onStateChange?: (state: CircuitBreakerState, breaker: string) => void;
  onSuccess?: (breaker: string) => void;
  onFailure?: (error: Error, breaker: string) => void;
}

export interface CircuitBreakerStats {
  totalCalls: number;
  successCalls: number;
  failureCalls: number;
  rejectedCalls: number; // Calls rejected due to open circuit
  successRate: number;
  averageResponseTime: number;
  lastFailureTime?: number;
  state: CircuitBreakerState;
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly breakerName: string,
    public readonly state: CircuitBreakerState
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private lastStateChange = Date.now();

  // Metrics tracking
  private totalCalls = 0;
  private successCalls = 0;
  private failureCalls = 0;
  private rejectedCalls = 0;
  private responseTimes: number[] = [];

  constructor(
    private config: CircuitBreakerConfig,
    private name: string = 'unnamed'
  ) {}

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;
    const startTime = Date.now();

    // Check if circuit is open
    if (this.state === CircuitBreakerState.OPEN) {
      const now = Date.now();
      if (this.lastFailureTime && now - this.lastFailureTime < this.config.resetTimeout) {
        this.rejectedCalls++;
        throw new CircuitBreakerError(
          `Circuit breaker '${this.name}' is OPEN. Calls rejected until reset timeout.`,
          this.name,
          this.state
        );
      }
      // Transition to half-open
      this.setState(CircuitBreakerState.HALF_OPEN);
    }

    try {
      // Apply timeout if configured
      let result: T;
      if (this.config.timeout) {
        result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) => {
            setTimeout(() => { reject(new Error('Operation timeout')); }, this.config.timeout);
          }),
        ]);
      } else {
        result = await fn();
      }

      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);
      this.onSuccess();
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);
      this.onFailure(error as Error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.successCalls++;
    this.successCount++;
    this.failureCount = 0;

    if (this.config.onSuccess) {
      this.config.onSuccess(this.name);
    }

    // Handle half-open to closed transition
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      const successThreshold = this.config.successThreshold || 1;
      if (this.successCount >= successThreshold) {
        this.setState(CircuitBreakerState.CLOSED);
        this.successCount = 0;
      }
    } else if (this.state !== CircuitBreakerState.CLOSED) {
      this.setState(CircuitBreakerState.CLOSED);
    }
  }

  private onFailure(error: Error): void {
    this.failureCalls++;
    this.failureCount++;
    this.successCount = 0;
    this.lastFailureTime = Date.now();

    if (this.config.onFailure) {
      this.config.onFailure(error, this.name);
    }

    // Handle transition to open
    if (
      this.failureCount >= this.config.failureThreshold &&
      this.state !== CircuitBreakerState.OPEN
    ) {
      this.setState(CircuitBreakerState.OPEN);
    }
  }

  private setState(newState: CircuitBreakerState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.lastStateChange = Date.now();

      if (this.config.onStateChange) {
        this.config.onStateChange(newState, this.name);
      }
    }
  }

  private recordResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);
    // Keep only last 100 response times for memory efficiency
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getStats(): CircuitBreakerStats {
    const avgResponseTime =
      this.responseTimes.length > 0
        ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
        : 0;

    return {
      totalCalls: this.totalCalls,
      successCalls: this.successCalls,
      failureCalls: this.failureCalls,
      rejectedCalls: this.rejectedCalls,
      successRate: this.totalCalls > 0 ? (this.successCalls / this.totalCalls) * 100 : 0,
      averageResponseTime: avgResponseTime,
      lastFailureTime: this.lastFailureTime,
      state: this.state,
    };
  }

  reset(): void {
    this.setState(CircuitBreakerState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
  }

  forceOpen(): void {
    this.setState(CircuitBreakerState.OPEN);
  }

  forceClose(): void {
    this.setState(CircuitBreakerState.CLOSED);
    this.failureCount = 0;
  }
}

export class CircuitBreakerSystem {
  protected breakers: Map<string, CircuitBreaker> = new Map();

  createBreaker(name: string, config: CircuitBreakerConfig): CircuitBreaker {
    const breaker = new CircuitBreaker(config, name);
    this.breakers.set(name, breaker);
    return breaker;
  }

  getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  getBreakerNames(): string[] {
    return Array.from(this.breakers.keys());
  }

  removeBreaker(name: string): boolean {
    return this.breakers.delete(name);
  }

  getSystemStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  resetAllBreakers(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

export class CircuitBreakerManager extends CircuitBreakerSystem {
  private static instance: CircuitBreakerManager;

  private constructor() {
    super();
  }

  public static getInstance(): CircuitBreakerManager {
    if (typeof CircuitBreakerManager.instance === 'undefined') {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  public getCircuitBreaker(
    name: string,
    config?: Partial<{
      failureThreshold: number;
      recoveryTimeout: number;
      timeout: number;
      successThreshold?: number;
      operationTimeout?: number;
      onStateChange?: (state: CircuitBreakerState, breaker: string) => void;
      onSuccess?: (breaker: string) => void;
      onFailure?: (error: Error, breaker: string) => void;
    }>
  ): CircuitBreaker | undefined {
    // If config is provided, create a new breaker with that config
    if (config && !this.breakers.has(name)) {
      const breakerConfig: CircuitBreakerConfig = {
        failureThreshold: config.failureThreshold ?? 5,
        resetTimeout: config.recoveryTimeout ?? 30000,
        monitoringPeriod: config.timeout ?? 30000,
        successThreshold: config.successThreshold ?? 1,
        timeout: config.operationTimeout,
        onStateChange: config.onStateChange,
        onSuccess: config.onSuccess,
        onFailure: config.onFailure,
      };
      return this.createBreaker(name, breakerConfig);
    }

    return this.getBreaker(name);
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async executeWithBreaker<T>(
    breakerName: string,
    operation: () => Promise<T>,
    config?: CircuitBreakerConfig
  ): Promise<T> {
    let breaker = this.getBreaker(breakerName);

    if (!breaker && config) {
      breaker = this.createBreaker(breakerName, config);
    }

    if (!breaker) {
      throw new Error(`Circuit breaker '${breakerName}' not found and no config provided`);
    }

    return breaker.execute(operation);
  }
}
