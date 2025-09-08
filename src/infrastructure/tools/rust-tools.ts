/**
 * Unified Rust Tools Module
 * 
 * Consolidates all Rust-related tool functionality into a single, coherent module
 * Eliminates duplication between rust-bridge and rust-execution-backend
 */

import { createLogger } from '../logging/logger-adapter.js';
import { toErrorOrUndefined } from '../../utils/type-guards.js';
import { loadRustExecutorSafely } from '../../utils/rust-module-loader.js';
import type {
  ToolExecutionArgs,
  ToolExecutionContext,
  ToolExecutionResult,
} from '../../domain/interfaces/tool-execution.js';

const logger = createLogger('RustTools');

// Unified Rust execution options
export interface RustToolsOptions {
  enableProfiling?: boolean;
  maxConcurrency?: number;
  timeoutMs?: number;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

// Unified Rust execution result
export interface RustToolExecutionResult extends ToolExecutionResult {
  execution_time_ms: number;
  performance_metrics?: string;
}

// Native Rust executor interface (unified from both implementations)
interface NativeRustExecutor {
  initialize(): boolean;
  executeFilesystem(operation: string, path: string, content?: string, options?: unknown): Promise<RustToolExecutionResult>;
  executeCommand(command: string, args: string[], options?: unknown): Promise<RustToolExecutionResult>;
  execute(toolId: string, args: string, options?: unknown): Promise<RustToolExecutionResult>;
  getPerformanceMetrics(): string;
  resetPerformanceMetrics(): void;
  healthCheck(): Promise<string>;
  getSupportedTools(): string[];
  cleanup(): Promise<void>;
  id: string;
}

// Tool execution metrics
export interface RustToolMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageExecutionTimeMs: number;
  lastExecutionTime?: number;
}

/**
 * Unified Rust Tools implementation
 * Consolidates functionality from multiple Rust modules
 */
export class RustTools {
  private executor: NativeRustExecutor | null = null;
  private initialized = false;
  private initializationPromise: Promise<boolean> | null = null;
  private metrics: RustToolMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageExecutionTimeMs: 0,
  };

  public constructor(private readonly options: RustToolsOptions = {}) {}

  /**
   * Initialize the Rust executor with proper error handling
   */
  public async initialize(): Promise<boolean> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      logger.info('Initializing Rust tools module');

      // Initialize logging first
      await this.initializeRustLogging();

      // Load the Rust executor
      const { RustExecutor, createRustExecutor } = await this.loadRustModule();
      // Create executor instance
      this.executor = createRustExecutor ? createRustExecutor() : new RustExecutor();

      // Initialize the executor
      const initSuccess = this.executor!.initialize();
      if (!initSuccess) {
        throw new Error('Failed to initialize Rust executor');
      }

      // Ensure Tokio runtime is available for metrics aggregation
      await this.ensureTokioRuntimeForMetrics();

      // Start metrics aggregation if available
      await this.startMetricsAggregation();

      this.initialized = true;
      logger.info('Rust tools module initialized successfully', {
        supportedTools: this.executor!.getSupportedTools(),
        executorId: this.executor!.id,
        tokioRuntimeAvailable: this.isTokioRuntimeAvailable()
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize Rust tools module', toErrorOrUndefined(error));
      this.initialized = false;
      this.initializationPromise = null;
      return false;
    }
  }

  /**
   * Check if Rust tools are available and initialized
   */
  public isAvailable(): boolean {
    return this.initialized && this.executor !== null;
  }

  /**
   * Execute a filesystem operation using Rust tools
   */
  public async executeFilesystem(
    operation: string,
    path: string,
    content?: string,
    context?: ToolExecutionContext
  ): Promise<RustToolExecutionResult> {
    await this.ensureInitialized();

    if (!this.executor) {
      throw new Error('Rust executor not available');
    }

    const startTime = Date.now();

    try {
      const options = this.buildExecutionOptions(context);
      const result = await this.executor.executeFilesystem(operation, path, content, options);
      
      this.updateMetrics(true, Date.now() - startTime);
      
      logger.debug('Filesystem operation completed', {
        operation,
        path,
        success: result.success,
        executionTime: result.execution_time_ms
      });

      return result;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      
      logger.error('Filesystem operation failed', {
        operation,
        path,
        error: toErrorOrUndefined(error)
      });

      throw error;
    }
  }

  /**
   * Execute a command using Rust tools
   */
  public async executeCommand(
    command: string,
    args: string[],
    context?: ToolExecutionContext
  ): Promise<RustToolExecutionResult> {
    await this.ensureInitialized();

    if (!this.executor) {
      throw new Error('Rust executor not available');
    }

    const startTime = Date.now();

    try {
      const options = this.buildExecutionOptions(context);
      const result = await this.executor.executeCommand(command, args, options);
      
      this.updateMetrics(true, Date.now() - startTime);
      
      logger.debug('Command executed', {
        command,
        args,
        success: result.success,
        executionTime: result.execution_time_ms
      });

      return result;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      
      logger.error('Command execution failed', {
        command,
        args,
        error: toErrorOrUndefined(error)
      });

      throw error;
    }
  }

  /**
   * Execute a generic tool using Rust tools
   */
  public async execute(
    toolId: string,
    args: ToolExecutionArgs,
    context?: ToolExecutionContext
  ): Promise<RustToolExecutionResult> {
    await this.ensureInitialized();

    if (!this.executor) {
      throw new Error('Rust executor not available');
    }

    const startTime = Date.now();

    try {
      const serializedArgs = JSON.stringify(args);
      const options = this.buildExecutionOptions(context);
      const result = await this.executor.execute(toolId, serializedArgs, options);
      
      this.updateMetrics(true, Date.now() - startTime);
      
      logger.debug('Tool executed', {
        toolId,
        success: result.success,
        executionTime: result.execution_time_ms
      });

      return result;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      
      logger.error('Tool execution failed', {
        toolId,
        error: toErrorOrUndefined(error)
      });

      throw error;
    }
  }

  /**
   * Get supported tools from Rust executor
   */
  public getSupportedTools(): string[] {
    if (!this.executor) {
      return [];
    }
    return this.executor.getSupportedTools();
  }

  /**
   * Get performance metrics from Rust executor
   */
  public getPerformanceMetrics(): { rust: string; js: RustToolMetrics; runtime?: any } {
    const rustMetrics = this.executor?.getPerformanceMetrics() || '{}';
    
    // Try to get Tokio runtime statistics
    let runtimeStats;
    try {
      if (this.executor && typeof (this.executor as any).getRuntimeStats === 'function') {
        runtimeStats = (this.executor as any).getRuntimeStats();
      }
    } catch (error) {
      logger.debug('Could not retrieve runtime stats', toErrorOrUndefined(error));
    }
    
    return {
      rust: rustMetrics,
      js: { ...this.metrics },
      runtime: runtimeStats
    };
  }

  /**
   * Reset performance metrics
   */
  public resetPerformanceMetrics(): void {
    this.executor?.resetPerformanceMetrics();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageExecutionTimeMs: 0,
    };
  }

  /**
   * Perform health check
   */
  public async healthCheck(): Promise<{ status: string; details: string }> {
    if (!this.isAvailable()) {
      return {
        status: 'unhealthy',
        details: 'Rust executor not available'
      };
    }

    try {
      const healthMessage = await this.executor!.healthCheck();
      return {
        status: 'healthy',
        details: healthMessage
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: `Health check failed: ${toErrorOrUndefined(error)?.message || 'Unknown error'}`
      };
    }
  }

  /**
   * Start metrics aggregation task if Tokio runtime is available
   */
  public async startMetricsAggregation(): Promise<boolean> {
    try {
      if (this.executor && typeof (this.executor as any).startMetricsAggregation === 'function') {
        await (this.executor as any).startMetricsAggregation();
        logger.info('Metrics aggregation started');
        return true;
      } else {
        logger.debug('Metrics aggregation not available on this executor');
        return false;
      }
    } catch (error) {
      logger.warn('Failed to start metrics aggregation', toErrorOrUndefined(error));
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    if (this.executor) {
      try {
        await this.executor.cleanup();
        logger.info('Rust tools cleanup completed');
      } catch (error) {
        logger.warn('Error during Rust tools cleanup', toErrorOrUndefined(error));
      }
    }

    this.executor = null;
    this.initialized = false;
    this.initializationPromise = null;
  }

  /**
   * Get executor ID
   */
  public getId(): string | undefined {
    return this.executor?.id;
  }

  // Private helper methods

  private async ensureTokioRuntimeForMetrics(): Promise<void> {
    try {
      // Check if we can call the Rust executor's method to ensure Tokio runtime
      if (this.executor && typeof (this.executor as any).ensureTokioRuntime === 'function') {
        await (this.executor as any).ensureTokioRuntime();
        logger.debug('Tokio runtime ensured for Rust executor');
      } else {
        // Fallback: try to trigger any async operation to ensure runtime is available
        if (this.executor && typeof (this.executor as any).healthCheck === 'function') {
          await (this.executor as any).healthCheck();
          logger.debug('Tokio runtime verified through health check');
        }
      }
    } catch (error) {
      logger.warn('Could not ensure Tokio runtime for metrics aggregation', toErrorOrUndefined(error));
    }
  }

  private isTokioRuntimeAvailable(): boolean {
    try {
      // Check if the executor has runtime information
      if (this.executor && typeof (this.executor as any).getRuntimeStats === 'function') {
        const stats = (this.executor as any).getRuntimeStats();
        return !!stats;
      }
      // Assume available if executor is initialized
      return this.initialized && !!this.executor;
    } catch {
      return false;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('Failed to initialize Rust tools');
      }
    }
  }

  private async initializeRustLogging(): Promise<void> {
    try {
      const { initLogging } = await this.loadRustModule();
      if (initLogging) {
        await initLogging(this.options.logLevel || 'info');
      }
    } catch (error) {
      logger.warn('Failed to initialize Rust logging', toErrorOrUndefined(error));
    }
  }

  private async loadRustModule(): Promise<any> {
    // Try to load from rust-native-module first
    try {
      return await import('../execution/rust-executor/rust-native-module.js');
    } catch {
      // Fallback to direct NAPI import
      const napiModule = await import('codecrucible-rust-executor' as any).catch(() => {
        throw new Error('Unable to load Rust executor - neither rust-native-module nor codecrucible-rust-executor available');
      });
      
      return {
        RustExecutor: napiModule.RustExecutor,
        createRustExecutor: napiModule.createRustExecutor,
        initLogging: napiModule.initLogging,
      };
    }
  }

  private buildExecutionOptions(context?: ToolExecutionContext): unknown {
    return {
      timeoutMs: this.options.timeoutMs || context?.timeout || 30000,
      workingDirectory: context?.workingDirectory,
      environment: context?.environment || {},
      securityLevel: context?.riskLevel || 'medium',
      sessionId: context?.sessionId,
      requestId: context?.requestId,
    };
  }

  private updateMetrics(success: boolean, executionTime: number): void {
    this.metrics.totalRequests++;
    this.metrics.lastExecutionTime = Date.now();

    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update rolling average
    const totalTime = this.metrics.averageExecutionTimeMs * (this.metrics.totalRequests - 1) + executionTime;
    this.metrics.averageExecutionTimeMs = totalTime / this.metrics.totalRequests;
  }
}

// Global instance for convenient access
let globalRustTools: RustTools | null = null;

/**
 * Get or create the global Rust tools instance
 */
export function getRustTools(options?: RustToolsOptions): RustTools {
  if (!globalRustTools) {
    globalRustTools = new RustTools(options);
  }
  return globalRustTools;
}

/**
 * Initialize the global Rust tools instance
 */
export async function initializeGlobalRustTools(options?: RustToolsOptions): Promise<boolean> {
  const rustTools = getRustTools(options);
  return await rustTools.initialize();
}

/**
 * Cleanup the global Rust tools instance
 */
export async function cleanupGlobalRustTools(): Promise<void> {
  if (globalRustTools) {
    await globalRustTools.cleanup();
    globalRustTools = null;
  }
}
