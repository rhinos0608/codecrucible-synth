/**
 * Unified Rust Executor Base Class
 *
 * Consolidates common initialization, logging, and execution logic shared between
 * RustExecutionBackend, RustProviderClient, RustBridgeManager, and RustStreamingClient.
 *
 * Eliminates duplication and provides consistent Rust module management.
 */

import { EventEmitter } from 'events';
import { logger } from '../../logging/logger.js';
import {
  loadRustExecutorSafely,
  type RustExecutorModule,
} from '../../../utils/rust-module-loader.js';
import { toErrorOrUndefined, toReadonlyRecord } from '../../../utils/type-guards.js';

export interface UnifiedRustExecutorConfig {
  moduleName: string;
  enableHealthChecks?: boolean;
  healthCheckInterval?: number;
  autoRecover?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
  enableMetrics?: boolean;
}

export interface RustExecutorHealth {
  status: 'healthy' | 'degraded' | 'failed' | 'initializing';
  lastCheck: Date;
  errorCount: number;
  uptime: number;
  responseTime?: number;
  availableMethods?: string[];
}

export interface RustExecutorMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageExecutionTime: number;
  lastOperationTime?: number;
}

/**
 * Base class for all Rust executor implementations
 */
export abstract class UnifiedRustExecutor extends EventEmitter {
  protected readonly config: Required<UnifiedRustExecutorConfig>;
  protected rustModule: RustExecutorModule | null = null;
  protected rustExecutor: any = null;
  protected initialized = false;
  protected initializationPromise: Promise<boolean> | null = null;
  protected health: RustExecutorHealth;
  protected metrics: RustExecutorMetrics;
  protected healthCheckTimer: NodeJS.Timeout | null = null;
  protected startTime: number;

  constructor(config: UnifiedRustExecutorConfig) {
    super();
    this.config = {
      enableHealthChecks: true,
      healthCheckInterval: 30000,
      autoRecover: true,
      maxRetries: 3,
      timeoutMs: 30000,
      enableMetrics: true,
      ...config,
    };

    this.startTime = Date.now();
    this.health = {
      status: 'initializing',
      lastCheck: new Date(),
      errorCount: 0,
      uptime: 0,
    };

    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageExecutionTime: 0,
    };

    // Initialize asynchronously to avoid blocking constructor
    setImmediate(() => {
      this.initialize().catch(error => {
        logger.error(
          `Failed to initialize ${this.config.moduleName}:`,
          toReadonlyRecord(toErrorOrUndefined(error))
        );
      });
    });
  }

  /**
   * Initialize the Rust executor with race condition protection
   */
  public async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();

    try {
      const result = await this.initializationPromise;
      return result;
    } catch (error) {
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Internal initialization logic
   */
  private async doInitialize(): Promise<boolean> {
    this.health.status = 'initializing';

    try {
      logger.info(`Initializing ${this.config.moduleName}...`);

      // Load Rust module safely
      const moduleResult = loadRustExecutorSafely();
      if (!moduleResult.available || !moduleResult.module) {
        throw new Error(`Rust module not available: ${moduleResult.error}`);
      }

      this.rustModule = moduleResult.module;
      logger.info(
        `🦀 ${this.config.moduleName} loaded Rust module from: ${moduleResult.binaryPath}`
      );

      // Create executor instance
      if (this.rustModule.RustExecutor) {
        this.rustExecutor = this.rustModule.createRustExecutor
          ? this.rustModule.createRustExecutor()
          : new this.rustModule.RustExecutor();
      } else {
        throw new Error('RustExecutor class not found in module');
      }

      // Initialize the executor
      if (typeof this.rustExecutor.initialize === 'function') {
        const initResult = this.rustExecutor.initialize();
        if (!initResult) {
          throw new Error('Rust executor initialization returned false');
        }
      }

      this.initialized = true;
      this.health.status = 'healthy';
      this.health.errorCount = 0;

      // Start health monitoring if enabled
      if (this.config.enableHealthChecks) {
        this.startHealthMonitoring();
      }

      // Call abstract initialization hook
      await this.onInitialized();

      logger.info(`✅ ${this.config.moduleName} initialized successfully`);
      this.emit('initialized');
      return true;
    } catch (error) {
      const errorObj = toErrorOrUndefined(error);
      logger.error(
        `❌ ${this.config.moduleName} initialization failed:`,
        toReadonlyRecord(errorObj)
      );

      this.health.status = 'failed';
      this.health.errorCount++;
      this.initialized = false;
      this.rustModule = null;
      this.rustExecutor = null;

      this.emit('error', errorObj);
      return false;
    }
  }

  /**
   * Abstract method called after successful initialization
   */
  protected abstract onInitialized(): Promise<void>;

  /**
   * Check if Rust executor is available and healthy
   */
  public isAvailable(): boolean {
    return this.initialized && this.rustExecutor !== null && this.health.status === 'healthy';
  }

  /**
   * Get current health status
   */
  public getHealth(): RustExecutorHealth {
    return {
      ...this.health,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Get performance metrics
   */
  public getMetrics(): RustExecutorMetrics {
    // Try to get metrics from Rust executor if available
    if (this.rustExecutor && typeof this.rustExecutor.getPerformanceMetrics === 'function') {
      try {
        const rustMetrics = JSON.parse(this.rustExecutor.getPerformanceMetrics());
        return {
          totalOperations: rustMetrics.total_requests ?? this.metrics.totalOperations,
          successfulOperations:
            rustMetrics.successful_requests ?? this.metrics.successfulOperations,
          failedOperations: rustMetrics.failed_requests ?? this.metrics.failedOperations,
          averageExecutionTime:
            rustMetrics.average_execution_time_ms ?? this.metrics.averageExecutionTime,
          lastOperationTime: this.metrics.lastOperationTime,
        };
      } catch (error) {
        logger.debug(
          `Failed to get Rust metrics for ${this.config.moduleName}:`,
          toReadonlyRecord(toErrorOrUndefined(error))
        );
      }
    }

    return { ...this.metrics };
  }

  /**
   * Perform health check
   */
  public async performHealthCheck(): Promise<boolean> {
    if (!this.rustExecutor) {
      this.health.status = 'failed';
      return false;
    }

    const startTime = Date.now();

    try {
      // Try to call a simple method to verify health
      let isHealthy = false;

      if (typeof this.rustExecutor.healthCheck === 'function') {
        await this.rustExecutor.healthCheck();
        isHealthy = true;
      } else if (typeof this.rustExecutor.getVersion === 'function') {
        this.rustExecutor.getVersion();
        isHealthy = true;
      } else {
        // Assume healthy if we can access the executor
        isHealthy = true;
      }

      this.health.responseTime = Date.now() - startTime;
      this.health.lastCheck = new Date();

      if (isHealthy) {
        this.health.status = 'healthy';
        return true;
      } else {
        this.health.status = 'degraded';
        this.health.errorCount++;
        return false;
      }
    } catch (error) {
      logger.debug(
        `Health check failed for ${this.config.moduleName}:`,
        toReadonlyRecord(toErrorOrUndefined(error))
      );

      this.health.status = 'failed';
      this.health.errorCount++;
      this.health.lastCheck = new Date();
      this.health.responseTime = Date.now() - startTime;

      // Auto-recovery attempt if enabled
      if (this.config.autoRecover && this.health.errorCount <= this.config.maxRetries) {
        logger.info(`Attempting auto-recovery for ${this.config.moduleName}...`);
        return this.initialize();
      }

      return false;
    }
  }

  /**
   * Execute operation with metrics tracking
   */
  protected async executeWithMetrics<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalOperations++;

    try {
      const result = await operation();

      const executionTime = Date.now() - startTime;
      this.metrics.successfulOperations++;
      this.metrics.lastOperationTime = executionTime;

      // Update average execution time using exponential moving average
      const alpha = 0.1;
      this.metrics.averageExecutionTime =
        alpha * executionTime + (1 - alpha) * this.metrics.averageExecutionTime;

      return result;
    } catch (error) {
      this.metrics.failedOperations++;
      throw error;
    }
  }

  /**
   * Start health monitoring timer
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);

    logger.debug(
      `Health monitoring started for ${this.config.moduleName} (${this.config.healthCheckInterval}ms interval)`
    );
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Reset performance metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageExecutionTime: 0,
    };

    // Reset Rust-side metrics if available
    if (this.rustExecutor && typeof this.rustExecutor.resetPerformanceMetrics === 'function') {
      this.rustExecutor.resetPerformanceMetrics();
    }
  }

  /**
   * Cleanup resources
   */
  public async destroy(): Promise<void> {
    this.stopHealthMonitoring();

    if (this.rustExecutor) {
      try {
        if (typeof this.rustExecutor.cleanup === 'function') {
          await this.rustExecutor.cleanup();
        }
      } catch (error) {
        logger.warn(
          `Error during ${this.config.moduleName} cleanup:`,
          toReadonlyRecord(toErrorOrUndefined(error))
        );
      }
    }

    this.rustExecutor = null;
    this.rustModule = null;
    this.initialized = false;
    this.initializationPromise = null;
    this.health.status = 'failed';

    this.removeAllListeners();
    logger.info(`🧹 ${this.config.moduleName} cleaned up successfully`);
  }
}
