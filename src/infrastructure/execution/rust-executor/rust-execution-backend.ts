/**
 * Rust Execution Backend - Production Implementation
 *
 * Integrates the complete Rust executor with comprehensive security, performance,
 * and tool execution capabilities. Replaces TypeScript executors with blazing-fast Rust.
 */

import { logger } from '../../logging/logger.js';
import { BridgeAdapter, type IRustExecutionBridge } from './bridge-adapter.js';
import * as path from 'path';
import { toErrorOrUndefined, toReadonlyRecord } from '../../../utils/type-guards.js';
import type {
  ToolExecutionRequest,
  ToolExecutionResult,
  IToolExecutor,
} from '@/domain/interfaces/tool-system.js';
import { ModelRequest, ModelResponse } from '@/domain/interfaces/model-client.js';
import { ProjectContext } from '@/domain/types/unified-types.js';

// Type definitions for complete Rust integration
export interface RustExecutorOptions {
  enableProfiling?: boolean;
  maxConcurrency?: number;
  timeoutMs?: number;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

export interface RustExecutionContext {
  sessionId: string;
  workingDirectory: string;
  securityLevel: 'low' | 'medium' | 'high';
  capabilities: string[];
  environment: Record<string, string>;
}

export interface RustExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  execution_time_ms: number;
  performance_metrics?: string;
}

// Import the actual NAPI module types
interface NativeRustExecutor {
  initialize(): boolean;
  executeFilesystem(
    operation: string,
    path: string,
    content?: string,
    options?: any
  ): Promise<RustExecutionResult>;
  executeCommand(command: string, args: string[], options?: any): Promise<RustExecutionResult>;
  execute(toolId: string, args: string, options?: any): Promise<RustExecutionResult>;
  getPerformanceMetrics(): string;
  resetPerformanceMetrics(): void;
  healthCheck(): Promise<string>;
  getSupportedTools(): string[];
  getFilesystemOperations(): string[];
  getSupportedCommands(): string[];
  cleanup(): Promise<void>;
  id: string; // This is a property, not a method
}

/**
 * Production Rust-backed execution backend replacing all TypeScript executors
 */
export class RustExecutionBackend {
  private rustExecutor: NativeRustExecutor | null = null;
  private bridge?: IRustExecutionBridge;
  private initialized = false;
  private initializationPromise: Promise<boolean> | null = null; // Prevent concurrent initialization
  private options: RustExecutorOptions;
  private tsOrchestrator?: IToolExecutor;
  private performanceStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageExecutionTime: 0,
  };

  constructor(
    options: RustExecutorOptions = {},
    tsOrchestrator?: IToolExecutor,
    bridge?: IRustExecutionBridge
  ) {
    this.options = {
      enableProfiling: true,
      maxConcurrency: 4,
      timeoutMs: 30000,
      logLevel: 'info',
      ...options,
    };
    this.tsOrchestrator = tsOrchestrator;
    this.bridge = bridge ?? new BridgeAdapter();
  }

  /**
   * Inject TypeScript tool orchestrator for fallback execution
   */
  setTypescriptOrchestrator(orchestrator: IToolExecutor): void {
    this.tsOrchestrator = orchestrator;
  }

  /**
   * Initialize the Rust executor NAPI module with race condition protection
   */
  async initialize(): Promise<boolean> {
    // Return existing initialization if already completed
    if (this.initialized) {
      return true;
    }

    // Return existing initialization promise if already in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Create initialization promise once and reuse it
    this.initializationPromise = this.doInitialize();

    try {
      const result = await this.initializationPromise;
      return result;
    } catch (error) {
      // Reset promise on failure to allow retry
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Internal initialization method
   */
  private async doInitialize(): Promise<boolean> {
    try {
      // Prefer bridge path first
      try {
        if (this.bridge) {
          const ok = await this.bridge.initialize();
          if (ok) {
            this.initialized = true;
            logger.info('RustExecutionBackend initialized via bridge', {
              executorId: this.bridge.getId(),
            });
            return true;
          }
        }
      } catch {
        // fall through to direct NAPI attempt
      }
      // Initialize logging for Rust module
      if (typeof global !== 'undefined') {
        const { initLogging } = await import('./rust-native-module.js').catch(async () => {
          try {
            // Try alternative import paths
            const napiModule = await import('codecrucible-rust-executor' as any).catch(() => {
              // Try direct NAPI build output
              const directPath = path.join(process.cwd(), 'rust-executor.node');
              return import(directPath);
            });
            return napiModule;
          } catch {
            // Return empty module as fallback
            return {};
          }
        });

        if (initLogging) {
          await initLogging(this.options.logLevel);
          logger.info('🚀 Rust executor logging initialized');
        }
      }

      // Load the Rust executor NAPI module
      const { RustExecutor, createRustExecutor } = await import('./rust-native-module.js').catch(
        async () => {
          try {
            // Try the NAPI module name from package.json
            const napiModule = await import('codecrucible-rust-executor' as any).catch(() => {
              // Try direct build output path
              const directPath = path.join(process.cwd(), 'rust-executor.node');
              return import(directPath);
            });
            return napiModule;
          } catch {
            // Return empty module as fallback
            return {};
          }
        }
      );

      if (RustExecutor || createRustExecutor) {
        this.rustExecutor = RustExecutor ? new RustExecutor() : createRustExecutor();

        // Initialize the Rust executor atomically
        const initResult = this.rustExecutor?.initialize();
        if (initResult) {
          // Only set initialized flag after successful initialization
          this.initialized = true;
          logger.info('🚀 RustExecutionBackend initialized successfully', {
            executorId: this.rustExecutor?.id || 'unknown',
            supportedTools: this.rustExecutor?.getSupportedTools || [],
            performanceMetrics: this.options.enableProfiling,
          });
        } else {
          logger.error('❌ Rust executor initialization failed');
          this.initialized = false;
          // Clean up partially initialized state
          this.rustExecutor = null;
          throw new Error('Rust executor initialization failed');
        }
        return true;
      }

      logger.warn('Rust module not found or invalid - falling back to TypeScript');
      this.initialized = false;
      return false;
    } catch (error) {
      logger.error('RustExecutionBackend initialization error:', toErrorOrUndefined(error));
      this.initialized = false;
      return false;
    }
  }

  /**
   * Execute a tool request using Rust backend with comprehensive error handling
   */
  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    this.performanceStats.totalRequests++;

    // Fallback to TypeScript if neither bridge nor direct executor is available
    if (!this.initialized || (!this.rustExecutor && !(this.bridge && this.bridge.isAvailable()))) {
      logger.debug('🔄 Using TypeScript fallback for tool execution');
      return this.executeTypescriptFallback(request);
    }

    try {
      // Determine execution strategy based on request
      let result: RustExecutionResult;

      if (request.toolId === 'filesystem' || request.toolId?.startsWith('file')) {
        // File system operations
        result = await this.executeFilesystemOperation(request);
      } else if (request.toolId === 'command' || request.toolId?.startsWith('cmd')) {
        // Command operations
        result = await this.executeCommandOperation(request);
      } else {
        // Generic tool execution
        result = await this.executeGenericOperation(request);
      }

      // Sync performance metrics from bridge (preferred) or direct executor
      let parsedMetrics: any = undefined;
      try {
        const metrics =
          this.bridge && this.bridge.isAvailable()
            ? JSON.parse(this.bridge.getPerformanceMetrics())
            : JSON.parse(this.rustExecutor?.getPerformanceMetrics() ?? '{}');
        this.performanceStats = {
          totalRequests: metrics.total_requests ?? 0,
          successfulRequests: metrics.successful_requests ?? 0,
          failedRequests: metrics.failed_requests ?? 0,
          averageExecutionTime: metrics.average_execution_time_ms ?? 0,
        };
      } catch (err) {
        logger.warn(
          'Failed to parse Rust executor global performance metrics',
          toReadonlyRecord(err)
        );
      }

      if (result.performance_metrics) {
        try {
          parsedMetrics = JSON.parse(result.performance_metrics);
        } catch (err) {
          logger.warn('Failed to parse Rust execution performance_metrics', toReadonlyRecord(err));
          parsedMetrics = result.performance_metrics;
        }
      } else {
        parsedMetrics = undefined;
      }
      const execMs = (result as any).executionTimeMs ?? (result as any).execution_time_ms ?? 0;
      logger.debug('✅ Rust execution completed', {
        toolId: request.toolId,
        executionTime: execMs,
        success: result.success,
      });

      return {
        success: result.success,
        result: result.result,
        error: result.error
          ? {
              code: 'RUST_EXECUTION_ERROR',
              message: result.error,
            }
          : undefined,
        metadata: {
          executionTimeMs: execMs,
          executor: 'rust',
          performanceMetrics: parsedMetrics,
          ...request.metadata,
        },
        executionTimeMs: execMs,
      };
    } catch (error) {
      this.performanceStats.failedRequests++;
      logger.error('Rust execution failed:', toErrorOrUndefined(error));

      return {
        success: false,
        result: undefined,
        error: {
          code: 'RUST_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown Rust execution error',
          details: error instanceof Error ? { stack: error.stack } : error,
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          executor: 'rust',
          ...request.metadata,
        },
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if Rust backend is available
   */
  isAvailable(): boolean {
    // Check both direct executor and bridge paths
    return this.initialized && (this.rustExecutor !== null || this.bridge?.isAvailable() === true);
  }

  /**
   * Get executor strategy identifier
   */
  getStrategy(): string {
    return 'rust';
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.rustExecutor) {
      try {
        // Call cleanup method if it exists on the Rust executor
        if (typeof (this.rustExecutor as any).cleanup === 'function') {
          await (this.rustExecutor as any).cleanup();
        } else if (typeof (this.rustExecutor as any).destroy === 'function') {
          await (this.rustExecutor as any).destroy();
        }

        // Reset performance stats
        this.performanceStats = {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageExecutionTime: 0,
        };

        // Clear executor and state
        this.rustExecutor = null;
        this.initialized = false;
        this.initializationPromise = null;

        logger.info('RustExecutionBackend cleaned up successfully');
      } catch (error) {
        logger.error('Error cleaning up Rust executor:', toErrorOrUndefined(error));
        // Still reset state even if cleanup fails
        this.rustExecutor = null;
        this.initialized = false;
        this.initializationPromise = null;
      }
    }
  }

  // Private helper methods

  private async executeTypescriptFallback(
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    if (!this.tsOrchestrator) {
      this.performanceStats.failedRequests++;
      return {
        success: false,
        result: undefined,
        error: {
          code: 'TYPESCRIPT_ORCHESTRATOR_UNAVAILABLE',
          message: 'No TypeScript tool orchestrator provided',
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          executor: 'typescript-fallback',
          ...request.metadata,
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      const result = await this.tsOrchestrator.execute(request);

      this.performanceStats.successfulRequests++;
      this.updateAverageExecutionTime(Date.now() - startTime);

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executor: 'typescript-fallback',
          ...request.metadata,
        },
        executionTimeMs: result.executionTimeMs ?? Date.now() - startTime,
      };
    } catch (error) {
      this.performanceStats.failedRequests++;

      return {
        success: false,
        result: undefined,
        error: {
          code: 'TYPESCRIPT_FALLBACK_ERROR',
          message: error instanceof Error ? error.message : 'TypeScript fallback failed',
          details: error instanceof Error ? { stack: error.stack } : error,
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          executor: 'typescript-fallback',
          ...request.metadata,
        },
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private mapSecurityLevel(level: string | undefined): 'low' | 'medium' | 'high' {
    switch (level) {
      case 'low':
      case 'medium':
      case 'high':
        return level;
      default:
        return 'medium';
    }
  }

  private extractCapabilities(request: ToolExecutionRequest): string[] {
    // Extract capabilities from request context or permissions
    const capabilities: string[] = [];

    if (request.context?.permissions) {
      capabilities.push(...request.context.permissions.map(p => `${p.type}:${p.resource}`));
    }

    return capabilities;
  }

  private async executeFilesystemOperation(
    request: ToolExecutionRequest
  ): Promise<RustExecutionResult> {
    if (!this.rustExecutor) {
      throw new Error('Rust executor not initialized');
    }

    const operation = String(request.arguments?.operation || 'read');
    const filePath = request.arguments?.path || request.arguments?.filePath || '';
    const content =
      typeof request.arguments?.content === 'string'
        ? request.arguments.content
        : request.arguments?.content
          ? String(request.arguments.content)
          : '';
    const options = {
      securityLevel: this.mapSecurityLevel(request.context?.securityLevel),
      capabilities: this.extractCapabilities(request),
      workingDirectory: request.context?.workingDirectory || process.cwd(),
    };

    return await (this.rustExecutor as any).executeFilesystem(
      operation,
      filePath,
      content,
      options
    );
  }

  private async executeCommandOperation(
    request: ToolExecutionRequest
  ): Promise<RustExecutionResult> {
    if (!this.rustExecutor) {
      throw new Error('Rust executor not initialized');
    }

    const command = String(request.arguments?.command || request.arguments?.cmd || '');
    const args = Array.isArray(request.arguments?.args)
      ? request.arguments.args
      : Array.isArray(request.arguments?.arguments)
        ? request.arguments.arguments
        : [];
    const options = {
      securityLevel: this.mapSecurityLevel(request.context?.securityLevel),
      capabilities: this.extractCapabilities(request),
      workingDirectory: request.context?.workingDirectory || process.cwd(),
      environment: request.context?.environment || ({} as Record<string, string>),
      timeoutMs: this.options.timeoutMs,
    };

    return await this.rustExecutor.executeCommand(command, args, options as any);
  }

  private async executeGenericOperation(
    request: ToolExecutionRequest
  ): Promise<RustExecutionResult> {
    if (!this.rustExecutor) {
      throw new Error('Rust executor not initialized');
    }

    const toolId = request.toolId;
    const argsStr = JSON.stringify(request.arguments || {});
    const options = {
      securityLevel: this.mapSecurityLevel(request.context?.securityLevel),
      capabilities: this.extractCapabilities(request),
      workingDirectory: request.context?.workingDirectory || process.cwd(),
      environment: request.context?.environment || ({} as Record<string, string>),
      timeoutMs: this.options.timeoutMs,
    };

    return await this.rustExecutor.execute(toolId, argsStr, options);
  }

  private updateAverageExecutionTime(executionTime: number): void {
    const totalTime =
      this.performanceStats.averageExecutionTime * this.performanceStats.successfulRequests;
    this.performanceStats.averageExecutionTime =
      (totalTime + executionTime) / (this.performanceStats.successfulRequests + 1);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    if (this.rustExecutor) {
      try {
        const metricsStr = this.rustExecutor.getPerformanceMetrics();
        const metrics = JSON.parse(metricsStr);
        this.performanceStats = {
          totalRequests: metrics.total_requests ?? 0,
          successfulRequests: metrics.successful_requests ?? 0,
          failedRequests: metrics.failed_requests ?? 0,
          averageExecutionTime: metrics.average_execution_time_ms ?? 0,
        };
      } catch (err) {
        logger.warn('Failed to fetch Rust performance metrics', toReadonlyRecord(err));
      }
    }
    return {
      ...this.performanceStats,
      rustExecutorAvailable: this.isAvailable(),
      supportedTools: this.rustExecutor?.getSupportedTools() || [],
    };
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics(): void {
    this.performanceStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageExecutionTime: 0,
    };

    if (this.rustExecutor) {
      this.rustExecutor.resetPerformanceMetrics();
    }
  }
}
