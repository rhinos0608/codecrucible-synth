import { cliOutput, CLIError } from './cli-output-manager.js';
import { logger } from './logger.js';

/**
 * Circuit Breaker State
 */
enum CircuitBreakerState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing fast
  HALF_OPEN = 'half_open' // Testing if service is back
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

/**
 * Timeout Manager for CLI operations
 * 
 * Provides consistent timeout handling across all CLI operations
 * with proper cleanup and user feedback
 */
export class TimeoutManager {
  private activeTimeouts = new Map<string, {
    timeout: NodeJS.Timeout;
    startTime: number;
    operation: string;
  }>();

  private circuitBreakers = new Map<string, {
    state: CircuitBreakerState;
    failureCount: number;
    lastFailureTime: number;
    lastSuccessTime: number;
    config: CircuitBreakerConfig;
  }>();

  private defaultCircuitConfig: CircuitBreakerConfig = {
    failureThreshold: 5,          // Open circuit after 5 failures
    resetTimeout: 30000,          // Try to close after 30 seconds
    monitoringPeriod: 60000       // Monitor for 1 minute
  };

  /**
   * Execute an operation with timeout
   */
  async withTimeout<T>(
    operation: () => Promise<T>,
    options: {
      timeoutMs: number;
      operationName: string;
      showProgress?: boolean;
      onProgress?: (elapsed: number) => void;
    }
  ): Promise<T> {
    const { timeoutMs, operationName, showProgress = false, onProgress } = options;
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    // Progress reporting
    let progressInterval: NodeJS.Timeout | null = null;
    let stopProgress: (() => void) | null = null;

    if (showProgress) {
      stopProgress = cliOutput.startProgress(`${operationName}...`);
      
      if (onProgress) {
        progressInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          onProgress(elapsed);
        }, 1000);
      }
    }

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeout = setTimeout(() => {
        this.cleanup(operationId);
        reject(CLIError.timeout(operationName));
      }, timeoutMs);

      this.activeTimeouts.set(operationId, {
        timeout,
        startTime,
        operation: operationName
      });
    });

    try {
      // Race between operation and timeout
      const result = await Promise.race([
        operation(),
        timeoutPromise
      ]);

      // Clean up on success
      this.cleanup(operationId);
      if (progressInterval) clearInterval(progressInterval);
      if (stopProgress) stopProgress();

      const elapsed = Date.now() - startTime;
      cliOutput.outputDebug(`${operationName} completed in ${elapsed}ms`);

      return result;

    } catch (error) {
      // Clean up on error
      this.cleanup(operationId);
      if (progressInterval) clearInterval(progressInterval);
      if (stopProgress) stopProgress();

      if (error instanceof CLIError && error.errorType === 'TimeoutError') {
        const elapsed = Date.now() - startTime;
        cliOutput.outputError(
          `${operationName} timed out after ${Math.round(elapsed / 1000)}s (limit: ${Math.round(timeoutMs / 1000)}s)`
        );
      }

      throw error;
    }
  }

  /**
   * Execute multiple operations with individual timeouts
   */
  async withTimeouts<T>(
    operations: Array<{
      operation: () => Promise<T>;
      timeoutMs: number;
      name: string;
    }>,
    options: {
      concurrency?: number;
      failFast?: boolean;
    } = {}
  ): Promise<Array<{ result?: T; error?: Error; name: string }>> {
    const { concurrency = 3, failFast = false } = options;
    const results: Array<{ result?: T; error?: Error; name: string }> = [];

    // Process operations in batches
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async ({ operation, timeoutMs, name }) => {
        try {
          const result = await this.withTimeout(operation, {
            timeoutMs,
            operationName: name,
            showProgress: false
          });
          return { result, name };
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          if (failFast) throw errorObj;
          return { error: errorObj, name };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const promiseResult of batchResults) {
        if (promiseResult.status === 'fulfilled') {
          results.push(promiseResult.value);
        } else {
          const error = promiseResult.reason instanceof Error 
            ? promiseResult.reason 
            : new Error(String(promiseResult.reason));
          
          if (failFast) throw error;
          results.push({ error, name: 'unknown' });
        }
      }
    }

    return results;
  }

  /**
   * Set up operation timeout with custom cleanup
   */
  async withCustomTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationName: string,
    onTimeout?: () => void | Promise<void>
  ): Promise<T> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeout = setTimeout(async () => {
        if (onTimeout) {
          try {
            await onTimeout();
          } catch (cleanupError) {
            logger.warn('Timeout cleanup failed:', cleanupError);
          }
        }
        
        this.cleanup(operationId);
        reject(CLIError.timeout(operationName));
      }, timeoutMs);

      this.activeTimeouts.set(operationId, {
        timeout,
        startTime,
        operation: operationName
      });
    });

    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      this.cleanup(operationId);
      return result;
    } catch (error) {
      this.cleanup(operationId);
      throw error;
    }
  }

  /**
   * Create a cancellable operation
   */
  createCancellableOperation<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    operationName: string
  ): {
    promise: Promise<T>;
    cancel: () => void;
  } {
    const controller = new AbortController();
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    const timeoutHandle = setTimeout(() => {
      controller.abort();
      this.cleanup(operationId);
    }, timeoutMs);

    this.activeTimeouts.set(operationId, {
      timeout: timeoutHandle,
      startTime,
      operation: operationName
    });

    const promise = operation(controller.signal)
      .then(result => {
        this.cleanup(operationId);
        return result;
      })
      .catch(error => {
        this.cleanup(operationId);
        
        if (error.name === 'AbortError') {
          throw CLIError.timeout(operationName);
        }
        throw error;
      });

    const cancel = () => {
      controller.abort();
      this.cleanup(operationId);
    };

    return { promise, cancel };
  }

  /**
   * Get status of active operations
   */
  getActiveOperations(): Array<{
    id: string;
    operation: string;
    elapsedMs: number;
    startTime: number;
  }> {
    const now = Date.now();
    return Array.from(this.activeTimeouts.entries()).map(([id, info]) => ({
      id,
      operation: info.operation,
      elapsedMs: now - info.startTime,
      startTime: info.startTime
    }));
  }

  /**
   * Cancel all active operations
   */
  cancelAllOperations(): void {
    const count = this.activeTimeouts.size;
    
    for (const [id] of this.activeTimeouts) {
      this.cleanup(id);
    }

    if (count > 0) {
      cliOutput.outputInfo(`Cancelled ${count} active operations`);
    }
  }

  /**
   * Cancel specific operation
   */
  cancelOperation(operationId: string): boolean {
    const operation = this.activeTimeouts.get(operationId);
    if (operation) {
      this.cleanup(operationId);
      cliOutput.outputInfo(`Cancelled operation: ${operation.operation}`);
      return true;
    }
    return false;
  }

  /**
   * Get recommended timeout for operation type
   */
  static getRecommendedTimeout(operationType: string): number {
    const timeouts: Record<string, number> = {
      'model_generation': 120000,     // 2 minutes
      'file_analysis': 30000,         // 30 seconds
      'project_scan': 60000,          // 1 minute
      'api_request': 30000,           // 30 seconds
      'file_operation': 10000,        // 10 seconds
      'database_operation': 5000,     // 5 seconds
      'network_request': 15000,       // 15 seconds
      'compilation': 300000,          // 5 minutes
      'test_execution': 300000,       // 5 minutes
      'download': 120000,             // 2 minutes
      'upload': 300000,               // 5 minutes
      'interactive_input': 300000,    // 5 minutes
      'agent_orchestration': 600000,  // 10 minutes
      'voice_synthesis': 180000,      // 3 minutes
    };

    return timeouts[operationType] || 60000; // Default 1 minute
  }

  /**
   * Create timeout with adaptive duration based on system load
   */
  async withAdaptiveTimeout<T>(
    operation: () => Promise<T>,
    baseTimeoutMs: number,
    operationName: string,
    options: {
      maxMultiplier?: number;
      loadFactor?: number;
    } = {}
  ): Promise<T> {
    const { maxMultiplier = 3, loadFactor = 1 } = options;
    
    // Adjust timeout based on current system load
    const activeOps = this.activeTimeouts.size;
    const loadMultiplier = Math.min(1 + (activeOps * 0.2 * loadFactor), maxMultiplier);
    const adjustedTimeout = Math.round(baseTimeoutMs * loadMultiplier);

    cliOutput.outputDebug(
      `Adaptive timeout: ${baseTimeoutMs}ms -> ${adjustedTimeout}ms (${activeOps} active ops)`
    );

    return this.withTimeout(operation, {
      timeoutMs: adjustedTimeout,
      operationName,
      showProgress: true
    });
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: {
      timeoutMs?: number;
      circuitConfig?: Partial<CircuitBreakerConfig>;
    } = {}
  ): Promise<T> {
    const { timeoutMs = 60000, circuitConfig } = options;
    
    // Check circuit breaker
    if (!this.canExecute(operationName)) {
      throw new Error(`Circuit breaker is OPEN for ${operationName}. Service appears to be down.`);
    }

    try {
      const result = await this.withTimeout(operation, {
        timeoutMs,
        operationName,
        showProgress: true
      });
      
      this.recordSuccess(operationName);
      return result;
    } catch (error) {
      this.recordFailure(operationName);
      throw error;
    }
  }

  /**
   * Execute with retry logic and exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: {
      maxRetries?: number;
      baseDelayMs?: number;
      maxDelayMs?: number;
      backoffMultiplier?: number;
      timeoutMs?: number;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelayMs = 1000,
      maxDelayMs = 10000,
      backoffMultiplier = 2,
      timeoutMs = 60000
    } = options;

    let lastError: Error;
    let delay = baseDelayMs;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Attempting ${operationName} (attempt ${attempt}/${maxRetries})`);
        
        return await this.executeWithCircuitBreaker(operation, operationName, { timeoutMs });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          logger.error(`${operationName} failed after ${attempt} attempts:`, lastError.message);
          break;
        }

        // Don't retry if circuit breaker is open
        if (lastError.message.includes('Circuit breaker is OPEN')) {
          break;
        }

        logger.warn(`${operationName} attempt ${attempt} failed: ${lastError.message}. Retrying in ${delay}ms...`);
        
        // Wait before retry
        await this.sleep(delay);
        
        // Exponential backoff
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }

    throw lastError!;
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(): Record<string, {
    state: string;
    failureCount: number;
    lastFailureTime: number;
    lastSuccessTime: number;
  }> {
    const status: Record<string, any> = {};
    
    for (const [name, breaker] of this.circuitBreakers.entries()) {
      status[name] = {
        state: breaker.state,
        failureCount: breaker.failureCount,
        lastFailureTime: breaker.lastFailureTime,
        lastSuccessTime: breaker.lastSuccessTime
      };
    }
    
    return status;
  }

  /**
   * Reset circuit breaker for a specific operation
   */
  resetCircuitBreaker(operationName: string): void {
    const circuitBreaker = this.circuitBreakers.get(operationName);
    if (circuitBreaker) {
      circuitBreaker.state = CircuitBreakerState.CLOSED;
      circuitBreaker.failureCount = 0;
      circuitBreaker.lastSuccessTime = Date.now();
      logger.info(`🔄 Manually reset circuit breaker for ${operationName}`);
    }
  }

  /**
   * Private helper methods
   */

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanup(operationId: string): void {
    const operation = this.activeTimeouts.get(operationId);
    if (operation) {
      clearTimeout(operation.timeout);
      this.activeTimeouts.delete(operationId);
    }
  }

  /**
   * Check if operation can execute (circuit breaker logic)
   */
  private canExecute(operationName: string): boolean {
    let circuitBreaker = this.circuitBreakers.get(operationName);
    
    if (!circuitBreaker) {
      circuitBreaker = {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        lastFailureTime: 0,
        lastSuccessTime: Date.now(),
        config: { ...this.defaultCircuitConfig }
      };
      this.circuitBreakers.set(operationName, circuitBreaker);
    }

    const now = Date.now();

    switch (circuitBreaker.state) {
      case CircuitBreakerState.CLOSED:
        return true;

      case CircuitBreakerState.OPEN:
        // Check if we should try to reset to half-open
        if (now - circuitBreaker.lastFailureTime >= circuitBreaker.config.resetTimeout) {
          circuitBreaker.state = CircuitBreakerState.HALF_OPEN;
          logger.info(`🔄 Circuit breaker for ${operationName} entering HALF_OPEN state`);
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        return true;

      default:
        return true;
    }
  }

  /**
   * Record successful operation
   */
  private recordSuccess(operationName: string): void {
    const circuitBreaker = this.circuitBreakers.get(operationName);
    if (circuitBreaker) {
      circuitBreaker.lastSuccessTime = Date.now();
      
      if (circuitBreaker.state === CircuitBreakerState.HALF_OPEN) {
        circuitBreaker.state = CircuitBreakerState.CLOSED;
        circuitBreaker.failureCount = 0;
        logger.info(`✅ Circuit breaker for ${operationName} reset to CLOSED state`);
      }
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(operationName: string): void {
    let circuitBreaker = this.circuitBreakers.get(operationName);
    
    if (!circuitBreaker) {
      circuitBreaker = {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        lastFailureTime: 0,
        lastSuccessTime: Date.now(),
        config: { ...this.defaultCircuitConfig }
      };
      this.circuitBreakers.set(operationName, circuitBreaker);
    }

    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = Date.now();

    // Open circuit if failure threshold reached
    if (circuitBreaker.failureCount >= circuitBreaker.config.failureThreshold) {
      circuitBreaker.state = CircuitBreakerState.OPEN;
      logger.warn(`🚨 Circuit breaker for ${operationName} opened after ${circuitBreaker.failureCount} failures`);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Global timeout manager instance
 */
export const timeoutManager = new TimeoutManager();

/**
 * Utility function for common timeout operations
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return timeoutManager.withTimeout(operation, {
    timeoutMs,
    operationName,
    showProgress: true
  });
}