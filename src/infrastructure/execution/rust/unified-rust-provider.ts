/**
 * Unified Rust Provider - Refactored Implementation
 *
 * Demonstrates how to use the UnifiedRustExecutor base class to eliminate
 * duplication and provide consistent Rust module management.
 *
 * Replaces the original RustProviderClient with cleaner, unified approach.
 */

import { logger } from '../../logging/logger.js';
import { UnifiedRustExecutor } from './unified-rust-executor.js';
import { toErrorOrUndefined } from '../../../utils/type-guards.js';

export interface RustProviderRequest {
  type: string;
  operation?: string;
  path?: string;
  content?: string;
  options?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RustProviderCapabilities {
  fileOperations: boolean;
  codeAnalysis: boolean;
  computeTasks: boolean;
  streaming: boolean;
  commands: boolean;
}

/**
 * Unified Rust Provider using the base class
 */
export class UnifiedRustProvider extends UnifiedRustExecutor {
  private capabilities: RustProviderCapabilities = {
    fileOperations: false,
    codeAnalysis: false,
    computeTasks: false,
    streaming: false,
    commands: false,
  };

  constructor(name: string = 'rust-provider') {
    super({
      moduleName: name,
      enableHealthChecks: true,
      healthCheckInterval: 30000,
      autoRecover: true,
      maxRetries: 3,
      enableMetrics: true,
    });
  }

  /**
   * Hook called after successful initialization
   */
  protected async onInitialized(): Promise<void> {
    // Detect capabilities
    this.detectCapabilities();

    logger.info(`🦀 ${this.config.moduleName} capabilities detected:`, {
      capabilities: this.capabilities,
    });
  }

  /**
   * Detect available capabilities from the Rust executor
   */
  private detectCapabilities(): void {
    if (!this.rustExecutor) return;

    this.capabilities = {
      fileOperations: typeof this.rustExecutor.executeFilesystem === 'function',
      codeAnalysis: typeof this.rustExecutor.analyzeCode === 'function',
      computeTasks: typeof this.rustExecutor.execute === 'function',
      streaming: typeof this.rustExecutor.stream_file === 'function',
      commands: typeof this.rustExecutor.executeCommand === 'function',
    };
  }

  /**
   * Get supported capabilities
   */
  public getCapabilities(): RustProviderCapabilities {
    return { ...this.capabilities };
  }

  /**
   * Check if a specific capability is supported
   */
  public hasCapability(capability: keyof RustProviderCapabilities): boolean {
    return this.capabilities[capability];
  }

  /**
   * Execute a provider request with automatic routing
   */
  public async execute(request: RustProviderRequest): Promise<unknown> {
    if (!this.isAvailable()) {
      throw new Error(`${this.config.moduleName} is not available`);
    }

    return this.executeWithMetrics(async () => {
      switch (request.type) {
        case 'file-operation':
          return this.executeFileOperation(request);
        case 'code-analysis':
          return this.executeCodeAnalysis(request);
        case 'compute-task':
          return this.executeComputeTask(request);
        case 'command':
          return this.executeCommand(request);
        default:
          return this.executeGeneric(request);
      }
    });
  }

  /**
   * Execute file operation
   */
  private async executeFileOperation(request: RustProviderRequest): Promise<unknown> {
    if (!this.capabilities.fileOperations) {
      throw new Error('File operations not supported');
    }

    const { operation, path, content, options } = request;

    if (typeof operation !== 'string' || typeof path !== 'string') {
      throw new Error('Invalid operation or path for file operation');
    }

    return this.rustExecutor.executeFilesystem(
      operation,
      path,
      typeof content === 'string' ? content : undefined,
      options
    );
  }

  /**
   * Execute code analysis
   */
  private async executeCodeAnalysis(request: RustProviderRequest): Promise<unknown> {
    if (!this.capabilities.codeAnalysis) {
      throw new Error('Code analysis not supported');
    }

    return this.rustExecutor.analyzeCode(JSON.stringify(request), request.options);
  }

  /**
   * Execute compute task
   */
  private async executeComputeTask(request: RustProviderRequest): Promise<unknown> {
    if (!this.capabilities.computeTasks) {
      throw new Error('Compute tasks not supported');
    }

    return this.rustExecutor.execute('compute-task', JSON.stringify(request), request.options);
  }

  /**
   * Execute command
   */
  private async executeCommand(request: RustProviderRequest): Promise<unknown> {
    if (!this.capabilities.commands) {
      throw new Error('Command execution not supported');
    }

    const { operation: command, options } = request;
    const args = Array.isArray(request.args) ? request.args : [];

    if (typeof command !== 'string') {
      throw new Error('Invalid command');
    }

    return this.rustExecutor.executeCommand(command, args, options);
  }

  /**
   * Execute generic request
   */
  private async executeGeneric(request: RustProviderRequest): Promise<unknown> {
    if (!this.capabilities.computeTasks) {
      throw new Error('Generic execution not supported');
    }

    const result = await this.rustExecutor.execute(
      'generic',
      JSON.stringify(request),
      request.options
    );

    // Try to parse JSON result
    if (typeof result === 'string') {
      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    }

    return result;
  }

  /**
   * Stream file content (if supported)
   */
  public async streamFile(
    filePath: string,
    chunkSize: number = 8192,
    callback: (chunk: unknown) => void
  ): Promise<string> {
    if (!this.capabilities.streaming) {
      throw new Error('Streaming not supported');
    }

    if (!this.isAvailable()) {
      throw new Error(`${this.config.moduleName} is not available for streaming`);
    }

    return this.executeWithMetrics(async () => {
      const streamId = this.rustExecutor.stream_file(filePath, chunkSize, 'fileAnalysis', callback);

      logger.info(`✅ Started streaming ${filePath} with ID: ${streamId}`);
      return streamId;
    });
  }
}

// Export singleton instance
export const unifiedRustProvider = new UnifiedRustProvider('unified-rust-provider');
