/**
 * Rust Provider Client - Phase 4 Implementation
 *
 * Provides a client interface for interacting with Rust-backed services,
 * integrating with the existing provider system architecture.
 */

import { logger } from '../../infrastructure/logging/logger.js';
import { RustBridgeManager } from '../execution/rust-executor/rust-bridge-manager.js';
import { toErrorOrUndefined, toReadonlyRecord } from '../../utils/type-guards.js';

export interface RustProviderConfig {
  name: string;
  version: string;
  capabilities: string[];
  maxConcurrency: number;
  healthCheckInterval: number;
}

export interface RustProviderStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  uptime: number;
  lastError?: Error;
}

/**
 * Types for Rust provider requests and modules
 */
export interface RustProviderRequest {
  type: string;
  operation?: string;
  path?: string;
  content?: string;
  options?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RustModule {
  executeFilesystem?: (
    operation: string,
    path: string,
    content?: string,
    options?: Record<string, unknown>
  ) => Promise<unknown>;
  execute?: (type: string, args: string, options?: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Client for interacting with Rust-based provider services
 */
export class RustProviderClient {
  private readonly config: RustProviderConfig;
  private readonly bridgeManager: RustBridgeManager;
  private readonly stats: RustProviderStats;
  private readonly startTime: number;

  public constructor(config: Readonly<Partial<RustProviderConfig>> = {}) {
    this.config = {
      name: 'rust-provider',
      version: '1.0.0',
      capabilities: ['file-operations', 'code-analysis', 'high-performance-compute'],
      maxConcurrency: 4,
      healthCheckInterval: 30000,
      ...config,
    };

    this.bridgeManager = new RustBridgeManager();
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      uptime: 0,
    };
    this.startTime = Date.now();
  }

  /**
   * Initialize the provider client
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing Rust provider client...', {
        name: this.config.name,
        capabilities: this.config.capabilities,
      });

      const success = await this.bridgeManager.initialize();
      if (!success) {
        throw new Error('Failed to initialize Rust bridge');
      }
    } catch (error) {
      logger.error('Error initializing Rust provider client:', toErrorOrUndefined(error));
      throw error;
    }
  }

  public getStats(): RustProviderStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Execute a request through the Rust provider
   */
  public async execute(request: Readonly<RustProviderRequest>): Promise<unknown> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      if (!this.bridgeManager.isHealthy()) {
        throw new Error('Rust provider is not healthy');
      }

      const rustModule = this.bridgeManager.getRustModule() as RustModule;

      // Execute the request through the Rust module
      const result: unknown = await this.executeRequest(rustModule, request);

      // Update statistics
      const responseTime = Date.now() - startTime;
      this.updateStats(true, responseTime);

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateStats(false, responseTime);
      this.stats.lastError = error instanceof Error ? error : new Error(String(error));

      logger.error('Rust provider execution failed:', toErrorOrUndefined(error));
      throw error;
    }
  }

  /**
   * Get supported capabilities
   */
  public getCapabilities(): string[] {
    return [...this.config.capabilities];
  }

  /**
   * Check if a specific capability is supported
   */
  public hasCapability(capability: string): boolean {
    return this.config.capabilities.includes(capability);
  }

  /**
   * Shutdown the provider client
   */
  public async shutdown(): Promise<void> {
    try {
      await this.bridgeManager.shutdown();
      logger.info('Rust provider client shut down successfully');
    } catch (error) {
      logger.error('Error during Rust provider shutdown:', toErrorOrUndefined(error));
    }
  }

  // Private methods

  private async executeRequest(
    rustModule: Readonly<RustModule>,
    request: Readonly<RustProviderRequest>
  ): Promise<unknown> {
    // Route request based on type
    switch (request.type) {
      case 'file-operation':
        return this.executeFileOperation(rustModule, request);
      case 'code-analysis':
        return this.executeCodeAnalysis(rustModule, request);
      case 'compute-task':
        return this.executeComputeTask(rustModule, request);
      default:
        return this.executeGenericRequest(rustModule, request);
    }
  }

  private async executeFileOperation(
    rustModule: RustModule,
    request: RustProviderRequest
  ): Promise<unknown> {
    if (typeof rustModule.executeFilesystem !== 'function') {
      throw new Error('File operation not supported by Rust module');
    }

    const { operation, path, content, options } = request;
    // Ensure operation and path are strings
    if (typeof operation !== 'string' || typeof path !== 'string') {
      throw new Error('Invalid operation or path for file operation');
    }
    return rustModule.executeFilesystem(
      operation,
      path,
      typeof content === 'string' ? content : undefined,
      options
    );
  }

  private async executeCodeAnalysis(
    rustModule: Readonly<RustModule>,
    request: Readonly<RustProviderRequest>
  ): Promise<unknown> {
    if (typeof rustModule.execute !== 'function') {
      throw new Error('Code analysis not supported by Rust module');
    }

    const args = JSON.stringify(request);
    return rustModule.execute(
      'code-analysis',
      args,
      typeof request.options === 'object' && request.options !== null ? request.options : undefined
    );
  }

  private async executeComputeTask(
    rustModule: RustModule,
    request: RustProviderRequest
  ): Promise<unknown> {
    if (typeof rustModule.execute !== 'function') {
      throw new Error('Compute task not supported by Rust module');
    }

    const args = JSON.stringify(request);
    const options =
      typeof request.options === 'object' && request.options !== null ? request.options : undefined;
    return rustModule.execute('compute-task', args, options);
  }

  private async executeGenericRequest(
    rustModule: Readonly<RustModule>,
    request: Readonly<RustProviderRequest>
  ): Promise<unknown> {
    if (typeof rustModule.execute === 'function') {
      const result = await rustModule.execute('generic', JSON.stringify(request), request.options);
      // If result is a string, try to parse as JSON, otherwise return as is
      if (typeof result === 'string') {
        try {
          return JSON.parse(result) as unknown;
        } catch {
          return result;
        }
      }
      return result;
    }

    throw new Error('Generic request execution not supported');
  }

  private updateStats(success: boolean, responseTime: number): void {
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }

    // Update average response time using exponential moving average
    const alpha = 0.1;
    this.stats.averageResponseTime =
      alpha * responseTime + (1 - alpha) * this.stats.averageResponseTime;
  }
}
