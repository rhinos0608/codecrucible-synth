/**
 * Rust Provider Client - Phase 4 Implementation
 *
 * Provides a client interface for interacting with Rust-backed services,
 * integrating with the existing provider system architecture.
 */

import { logger } from '../../core/logger.js';
import { RustBridgeManager } from '../../core/execution/rust-executor/rust-bridge-manager.js';
import type { ProviderClient } from '../../domain/interfaces/provider-interfaces.js';

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
 * Client for interacting with Rust-based provider services
 */
export class RustProviderClient implements ProviderClient {
  private config: RustProviderConfig;
  private bridgeManager: RustBridgeManager;
  private stats: RustProviderStats;
  private startTime: number;

  constructor(config: Partial<RustProviderConfig> = {}) {
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
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Rust provider client...', {
        name: this.config.name,
        capabilities: this.config.capabilities,
      });

      const success = await this.bridgeManager.initialize();
      if (!success) {
        throw new Error('Failed to initialize Rust bridge');
      }

      logger.info('Rust provider client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Rust provider client:', error);
      throw error;
    }
  }

  /**
   * Check if the provider is available and healthy
   */
  async isAvailable(): Promise<boolean> {
    return this.bridgeManager.isHealthy();
  }

  /**
   * Get provider configuration
   */
  getConfig(): RustProviderConfig {
    return { ...this.config };
  }

  /**
   * Get provider statistics
   */
  getStats(): RustProviderStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Execute a request through the Rust provider
   */
  async execute(request: any): Promise<any> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      if (!this.bridgeManager.isHealthy()) {
        throw new Error('Rust provider is not healthy');
      }

      const rustModule = this.bridgeManager.getRustModule();

      // Execute the request through the Rust module
      const result = await this.executeRequest(rustModule, request);

      // Update statistics
      const responseTime = Date.now() - startTime;
      this.updateStats(true, responseTime);

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateStats(false, responseTime);
      this.stats.lastError = error instanceof Error ? error : new Error(String(error));

      logger.error('Rust provider execution failed:', error);
      throw error;
    }
  }

  /**
   * Get supported capabilities
   */
  getCapabilities(): string[] {
    return [...this.config.capabilities];
  }

  /**
   * Check if a specific capability is supported
   */
  hasCapability(capability: string): boolean {
    return this.config.capabilities.includes(capability);
  }

  /**
   * Shutdown the provider client
   */
  async shutdown(): Promise<void> {
    try {
      await this.bridgeManager.shutdown();
      logger.info('Rust provider client shut down successfully');
    } catch (error) {
      logger.error('Error during Rust provider shutdown:', error);
    }
  }

  // Private methods

  private async executeRequest(rustModule: any, request: any): Promise<any> {
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

  private async executeFileOperation(rustModule: any, request: any): Promise<any> {
    if (typeof rustModule.executeFilesystem !== 'function') {
      throw new Error('File operation not supported by Rust module');
    }

    const { operation, path, content, options } = request;
    return await rustModule.executeFilesystem(operation, path, content, options);
  }

  private async executeCodeAnalysis(rustModule: any, request: any): Promise<any> {
    if (typeof rustModule.execute !== 'function') {
      throw new Error('Code analysis not supported by Rust module');
    }

    const args = JSON.stringify(request);
    return await rustModule.execute('code-analysis', args, request.options);
  }

  private async executeComputeTask(rustModule: any, request: any): Promise<any> {
    if (typeof rustModule.execute !== 'function') {
      throw new Error('Compute task not supported by Rust module');
    }

    const args = JSON.stringify(request);
    return await rustModule.execute('compute-task', args, request.options ?? undefined);
  }

  private async executeGenericRequest(rustModule: any, request: any): Promise<any> {
    // Generic request execution through Rust executor
    if (rustModule.execute) {
      const result = await rustModule.execute(JSON.stringify(request));
      return JSON.parse(result);
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
