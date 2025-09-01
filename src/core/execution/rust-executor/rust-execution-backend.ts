/**
 * Rust Execution Backend - Production Implementation
 *
 * Integrates the complete Rust executor with comprehensive security, performance,
 * and tool execution capabilities. Replaces TypeScript executors with blazing-fast Rust.
 */

import { logger } from '../../logger.js';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type {
  ToolExecutionRequest,
  ToolExecutionResult,
  IToolExecutor,
} from '../../../domain/interfaces/tool-system.js';
import { ModelRequest, ModelResponse } from '../../../domain/interfaces/model-client.js';
import { ProjectContext } from '../../../domain/types/unified-types.js';

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
  initialize(): Promise<boolean>;
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
  getId(): string;
}

/**
 * Production Rust-backed execution backend replacing all TypeScript executors
 */
export class RustExecutionBackend {
  private rustExecutor: NativeRustExecutor | null = null;
  private initialized = false;
  private options: RustExecutorOptions;
  private tsOrchestrator?: IToolExecutor;
  private performanceStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageExecutionTime: 0,
  };

  constructor(options: RustExecutorOptions = {}, tsOrchestrator?: IToolExecutor) {
    this.options = {
      enableProfiling: true,
      maxConcurrency: 4,
      timeoutMs: 30000,
      logLevel: 'info',
      ...options,
    };
    this.tsOrchestrator = tsOrchestrator;
  }

  /**
   * Inject TypeScript tool orchestrator for fallback execution
   */
  setTypescriptOrchestrator(orchestrator: IToolExecutor): void {
    this.tsOrchestrator = orchestrator;
  }

  /**
   * Initialize the Rust executor NAPI module
   */
  async initialize(): Promise<boolean> {
    try {
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
        this.rustExecutor = RustExecutor ? RustExecutor.create() : createRustExecutor();

        // Initialize the Rust executor
        const initResult = await this.rustExecutor.initialize();
        if (initResult) {
          this.initialized = true;
          logger.info('🚀 RustExecutionBackend initialized successfully', {
            executorId: this.rustExecutor.getId(),
            supportedTools: this.rustExecutor.getSupportedTools(),
            performanceMetrics: this.options.enableProfiling,
          });
        } else {
          logger.error('❌ Rust executor initialization failed');
          this.initialized = false;
          throw new Error('Rust executor initialization failed');
        }

        this.initialized = true;
        logger.info('🚀 RustExecutionBackend initialized successfully', {
          executorId: this.rustExecutor.getId(),
          supportedTools: this.rustExecutor.getSupportedTools(),
          performanceMetrics: this.options.enableProfiling,
        });
        return true;
      }

      logger.warn('Rust module not found or invalid - falling back to TypeScript');
      this.initialized = false;
      return false;
    } catch (error) {
      logger.error('RustExecutionBackend initialization error:', error);
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

    // Fallback to TypeScript if Rust not available
    if (!this.initialized || !this.rustExecutor) {
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

      // Sync performance metrics from Rust executor
      let parsedMetrics: any = undefined;
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
        logger.warn('Failed to parse Rust executor global performance metrics', err);
      }

      if (result.performance_metrics) {
        try {
          parsedMetrics = JSON.parse(result.performance_metrics);
        } catch (err) {
          logger.warn('Failed to parse Rust execution performance_metrics', err);
          parsedMetrics = result.performance_metrics;
        }
      } else {
        parsedMetrics = undefined;
      }
      logger.debug('✅ Rust execution completed', {
        toolId: request.toolId,
        executionTime: result.execution_time_ms,
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
          executionTimeMs: result.execution_time_ms,
          executor: 'rust',
          performanceMetrics: parsedMetrics,
          ...request.metadata,
        },
        executionTimeMs: result.execution_time_ms,
      };
    } catch (error) {
      this.performanceStats.failedRequests++;
      logger.error('Rust execution failed:', error);

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
    return this.initialized && this.rustExecutor !== null;
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
        // Cleanup Rust resources if needed
        this.rustExecutor = null;
        this.initialized = false;
        logger.info('RustExecutionBackend cleaned up');
      } catch (error) {
        logger.error('Error cleaning up Rust executor:', error);
      }
    }
  }

  // Private helper methods

  private async executeTypescriptFallback(
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    this.performanceStats.totalRequests++;

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

    const operation = request.arguments?.operation || 'read';
    const path = request.arguments?.path || request.arguments?.filePath || '';
    const content = request.arguments?.content;
    const options = {
      securityLevel: this.mapSecurityLevel(request.context?.securityLevel),
      capabilities: this.extractCapabilities(request),
      workingDirectory: request.context?.workingDirectory || process.cwd(),
    };

    return await this.rustExecutor.executeFilesystem(operation, path, content, options);
  }

  private async executeCommandOperation(
    request: ToolExecutionRequest
  ): Promise<RustExecutionResult> {
    if (!this.rustExecutor) {
      throw new Error('Rust executor not initialized');
    }

    const command = request.arguments?.command || request.arguments?.cmd || '';
    const args = request.arguments?.args || request.arguments?.arguments || [];
    const options = {
      securityLevel: this.mapSecurityLevel(request.context?.securityLevel),
      capabilities: this.extractCapabilities(request),
      workingDirectory: request.context?.workingDirectory || process.cwd(),
      environment: request.context?.environment || {},
      timeoutMs: this.options.timeoutMs,
    };

    return await this.rustExecutor.executeCommand(command, args, options);
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
      environment: request.context?.environment || {},
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
        logger.warn('Failed to fetch Rust performance metrics', err);
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
