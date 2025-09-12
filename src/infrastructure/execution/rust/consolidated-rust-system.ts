/**
 * Consolidated Rust System - Integration Module
 *
 * Provides a unified interface that consolidates all Rust execution patterns
 * and eliminates duplication between RustExecutionBackend, RustProviderClient,
 * RustBridgeManager, and RustStreamingClient.
 *
 * This serves as the single entry point for all Rust-based operations.
 */

import { EventEmitter } from 'events';
import { logger } from '../../logging/logger.js';
import { UnifiedRustExecutor, type UnifiedRustExecutorConfig } from './unified-rust-executor.js';
import { UnifiedRustProvider } from './unified-rust-provider.js';
import type {
  ToolExecutionRequest,
  ToolExecutionResult,
  IToolExecutor,
} from '@/domain/interfaces/tool-system.js';
import { toErrorOrUndefined } from '../../../utils/type-guards.js';

/**
 * Consolidated execution modes
 */
export type RustExecutionMode =
  | 'tool-execution' // For ToolExecutionRequest/Result pattern
  | 'provider-service' // For provider-style service operations
  | 'streaming' // For streaming operations
  | 'bridge-management'; // For direct NAPI bridge operations

export interface ConsolidatedRustConfig extends UnifiedRustExecutorConfig {
  mode: RustExecutionMode;
  fallbackToTypescript?: boolean;
  typescriptOrchestrator?: IToolExecutor;
}

/**
 * Consolidated Rust System - Single interface for all Rust operations
 */
export class ConsolidatedRustSystem extends EventEmitter {
  private executor: UnifiedRustExecutor;
  private provider: UnifiedRustProvider;
  private config: ConsolidatedRustConfig;
  private fallbackOrchestrator?: IToolExecutor;

  constructor(config: ConsolidatedRustConfig) {
    super();
    this.config = config;
    this.fallbackOrchestrator = config.typescriptOrchestrator;

    // Initialize based on execution mode
    switch (config.mode) {
      case 'provider-service':
      case 'streaming':
        this.provider = new UnifiedRustProvider(config.moduleName);
        this.executor = this.provider;
        break;

      case 'tool-execution':
      case 'bridge-management':
      default:
        this.executor = new ConsolidatedRustExecutor(config);
        this.provider = new UnifiedRustProvider(`${config.moduleName}-provider`);
        break;
    }

    // Forward events
    this.executor.on('initialized', () => this.emit('initialized'));
    this.executor.on('error', error => this.emit('error', error));
  }

  /**
   * Initialize all components
   */
  public async initialize(): Promise<boolean> {
    try {
      const executorReady = await this.executor.initialize();

      if (this.provider !== this.executor) {
        const providerReady = await this.provider.initialize();
        return executorReady && providerReady;
      }

      return executorReady;
    } catch (error) {
      logger.error('Failed to initialize ConsolidatedRustSystem:', toErrorOrUndefined(error));
      return false;
    }
  }

  /**
   * Execute tool request (IToolExecutor interface compatibility)
   */
  public async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    return this.executeTool(request);
  }

  /**
   * Execute tool request (replaces RustExecutionBackend.execute)
   */
  public async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    if (
      !this.executor.isAvailable() &&
      this.config.fallbackToTypescript &&
      this.fallbackOrchestrator
    ) {
      logger.debug('🔄 Using TypeScript fallback for tool execution');
      return this.fallbackOrchestrator.execute(request);
    }

    if (!this.executor.isAvailable()) {
      return {
        success: false,
        result: undefined,
        error: {
          code: 'RUST_EXECUTOR_UNAVAILABLE',
          message: 'Rust executor is not available',
        },
        metadata: {
          executionTimeMs: 0,
          executor: 'rust-unavailable',
        },
        executionTimeMs: 0,
      };
    }

    // Route to appropriate execution method
    if (this.executor instanceof ConsolidatedRustExecutor) {
      return (this.executor as ConsolidatedRustExecutor).executeTool(request);
    }

    // Fallback to provider execution
    try {
      const result = await this.provider.execute({
        type: request.toolId,
        ...request.arguments,
      });

      return {
        success: true,
        result,
        metadata: {
          executionTimeMs: 0,
          executor: 'rust-provider',
        },
        executionTimeMs: 0,
      };
    } catch (error) {
      return {
        success: false,
        result: undefined,
        error: {
          code: 'RUST_PROVIDER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown provider error',
        },
        metadata: {
          executionTimeMs: 0,
          executor: 'rust-provider',
        },
        executionTimeMs: 0,
      };
    }
  }

  /**
   * Execute provider request (replaces RustProviderClient.execute)
   */
  public async executeProvider(request: any): Promise<unknown> {
    return this.provider.execute(request);
  }

  /**
   * Stream file content (replaces RustStreamingClient functionality)
   */
  public async streamFile(
    filePath: string,
    callback: (chunk: unknown) => void,
    options?: { chunkSize?: number }
  ): Promise<string> {
    return this.provider.streamFile(filePath, options?.chunkSize, callback);
  }

  /**
   * Get health status
   */
  public getHealth() {
    return {
      executor: this.executor.getHealth(),
      provider: this.provider !== this.executor ? this.provider.getHealth() : null,
    };
  }

  /**
   * Get performance metrics
   */
  public getMetrics() {
    return {
      executor: this.executor.getMetrics(),
      provider: this.provider !== this.executor ? this.provider.getMetrics() : null,
    };
  }

  /**
   * Get performance statistics (compatibility method)
   */
  public getPerformanceStats() {
    const metrics = this.getMetrics();
    return {
      ...metrics.executor,
      rustExecutorAvailable: this.isAvailable(),
      supportedTools: [],
    };
  }

  /**
   * Get executor strategy (compatibility method)
   */
  public getStrategy(): string {
    return 'consolidated-rust';
  }

  /**
   * Check if system is available
   */
  public isAvailable(): boolean {
    return this.executor.isAvailable();
  }

  /**
   * Cleanup all resources
   */
  public async destroy(): Promise<void> {
    await this.executor.destroy();

    if (this.provider !== this.executor) {
      await this.provider.destroy();
    }

    this.removeAllListeners();
  }
}

/**
 * Consolidated Rust Executor - Tool execution specialization
 */
class ConsolidatedRustExecutor extends UnifiedRustExecutor implements IToolExecutor {
  private fallbackOrchestrator?: IToolExecutor;

  constructor(config: ConsolidatedRustConfig) {
    super(config);
    this.fallbackOrchestrator = config.typescriptOrchestrator;
  }

  protected async onInitialized(): Promise<void> {
    logger.info(`🔧 ${this.config.moduleName} configured for tool execution mode`);
  }

  /**
   * Execute tool request with full ToolExecutionResult support
   */
  public async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    return this.executeWithMetrics(async () => {
      const startTime = Date.now();

      try {
        // Route based on tool type
        let result: any;

        if (request.toolId === 'filesystem' || request.toolId?.startsWith('file')) {
          result = await this.executeFileOperation(request);
        } else if (request.toolId === 'command' || request.toolId?.startsWith('cmd')) {
          result = await this.executeCommandOperation(request);
        } else {
          result = await this.executeGenericOperation(request);
        }

        return {
          success: true,
          result: result.result || result,
          metadata: {
            executionTimeMs: Date.now() - startTime,
            executor: 'consolidated-rust',
            performanceMetrics: result.performance_metrics
              ? JSON.parse(result.performance_metrics)
              : undefined,
          },
          executionTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        return {
          success: false,
          result: undefined,
          error: {
            code: 'CONSOLIDATED_RUST_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            details: error instanceof Error ? { stack: error.stack } : error,
          },
          metadata: {
            executionTimeMs: Date.now() - startTime,
            executor: 'consolidated-rust',
          },
          executionTimeMs: Date.now() - startTime,
        };
      }
    });
  }

  /**
   * IToolExecutor interface method
   */
  public async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    return this.executeTool(request);
  }

  /**
   * IToolExecutor interface - Execute tools in sequence
   */
  public async executeSequence(
    requests: readonly Readonly<ToolExecutionRequest>[]
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];
    for (const request of requests) {
      const result = await this.executeTool(request);
      results.push(result);
      // Stop on failure if needed
      if (!result.success) {
        break;
      }
    }
    return results;
  }

  /**
   * IToolExecutor interface - Execute tools in parallel
   */
  public async executeParallel(
    requests: readonly Readonly<ToolExecutionRequest>[]
  ): Promise<ToolExecutionResult[]> {
    return Promise.all(requests.map(request => this.executeTool(request)));
  }

  // Private execution methods (similar to RustExecutionBackend)
  private async executeFileOperation(request: ToolExecutionRequest): Promise<any> {
    const operation = String(request.arguments?.operation || 'read');
    const filePath = request.arguments?.path || request.arguments?.filePath || '';
    const content = typeof request.arguments?.content === 'string' ? request.arguments.content : '';

    return this.rustExecutor.executeFilesystem(operation, filePath, content, {
      workingDirectory: request.context?.workingDirectory || process.cwd(),
    });
  }

  private async executeCommandOperation(request: ToolExecutionRequest): Promise<any> {
    const command = String(request.arguments?.command || '');
    const args = Array.isArray(request.arguments?.args) ? request.arguments.args : [];

    return this.rustExecutor.executeCommand(command, args, {
      workingDirectory: request.context?.workingDirectory || process.cwd(),
      environment: request.context?.environment || {},
    });
  }

  private async executeGenericOperation(request: ToolExecutionRequest): Promise<any> {
    return this.rustExecutor.execute(request.toolId, JSON.stringify(request.arguments || {}), {
      workingDirectory: request.context?.workingDirectory || process.cwd(),
    });
  }
}

/**
 * Factory function to create appropriate consolidated system
 */
export function createConsolidatedRustSystem(
  config: Partial<ConsolidatedRustConfig> = {}
): ConsolidatedRustSystem {
  const defaultConfig: ConsolidatedRustConfig = {
    moduleName: 'consolidated-rust-system',
    mode: 'tool-execution',
    enableHealthChecks: true,
    healthCheckInterval: 30000,
    autoRecover: true,
    maxRetries: 3,
    enableMetrics: true,
    fallbackToTypescript: true,
    ...config,
  };

  return new ConsolidatedRustSystem(defaultConfig);
}

// Export singleton for backward compatibility
export const consolidatedRustSystem = createConsolidatedRustSystem();
