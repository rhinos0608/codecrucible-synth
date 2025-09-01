/**
 * ProviderRepository - Extracted from UnifiedModelClient
 * Manages LLM provider lifecycle and selection following Living Spiral methodology
 *
 * Council Perspectives Applied:
 * - Maintainer: Clean provider abstraction and lifecycle management
 * - Security Guardian: Safe provider initialization and validation
 * - Performance Engineer: Optimized provider selection and caching
 * - Explorer: Extensible for new provider types
 * - Architect: Clean separation between provider management and client logic
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';

// Provider interfaces and types
export type ProviderType = 'ollama' | 'lm-studio' | 'huggingface' | 'auto';

export interface ProviderConfig {
  type: ProviderType;
  endpoint?: string;
  apiKey?: string;
  model?: string;
  timeout?: number;
  maxRetries?: number;
  enabled?: boolean;
  fallbackOrder?: number;
}

export interface ProviderStatus {
  type: ProviderType;
  isHealthy: boolean;
  isInitialized: boolean;
  lastHealthCheck: Date;
  errorCount: number;
  models: string[];
  endpoint: string;
}

export interface ProviderInitResult {
  success: boolean;
  error?: Error;
  duration: number;
  provider?: any;
}

export interface IProviderRepository {
  // Lifecycle management
  initialize(configs?: ProviderConfig[]): Promise<void>;
  setDeferredConfig(configs: ProviderConfig[]): void;
  shutdown(): Promise<void>;

  // Provider access
  getProvider(type: ProviderType): any | undefined;
  getAvailableProviders(): Map<ProviderType, any>;
  getAllProviders(): ProviderType[];

  // Health monitoring
  checkProviderHealth(type: ProviderType): Promise<boolean>;
  getProviderStatus(type: ProviderType): ProviderStatus | undefined;
  getAllProviderStatuses(): Map<ProviderType, ProviderStatus>;

  // Provider management
  enableProvider(type: ProviderType): Promise<void>;
  disableProvider(type: ProviderType): Promise<void>;
  switchProvider(from: ProviderType, to: ProviderType): Promise<void>;

  // Model management
  getAvailableModels(providerType?: ProviderType): Promise<string[]>;
  switchModel(providerType: ProviderType, modelName: string): Promise<void>;

  // Configuration
  updateProviderConfig(type: ProviderType, config: Partial<ProviderConfig>): Promise<void>;
  getProviderConfig(type: ProviderType): ProviderConfig | undefined;
}

/**
 * ProviderRepository Implementation
 * Centralized provider management with health monitoring
 */
export class ProviderRepository extends EventEmitter implements IProviderRepository {
  private providers: Map<ProviderType, any> = new Map();
  private configs: Map<ProviderType, ProviderConfig> = new Map();
  private statuses: Map<ProviderType, ProviderStatus> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private deferredConfigs: ProviderConfig[] | null = null;

  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MAX_ERROR_COUNT = 5;
  private readonly PROVIDER_TIMEOUT = 10000; // 10 seconds

  constructor() {
    super();
    this.setupHealthMonitoring();
  }

  /**
   * Set deferred configuration for lazy initialization
   */
  setDeferredConfig(configs: ProviderConfig[]): void {
    this.deferredConfigs = configs;
    logger.debug('Provider configurations deferred for lazy initialization', {
      configCount: configs.length,
      types: configs.map(c => c.type),
    });
  }

  /**
   * Initialize all providers from configuration
   */
  async initialize(configs?: ProviderConfig[]): Promise<void> {
    if (this.isInitialized) {
      logger.warn('ProviderRepository already initialized');
      return;
    }

    // Use deferred configs if no configs provided
    const actualConfigs = configs || this.deferredConfigs || [];
    if (actualConfigs.length === 0) {
      logger.warn('No provider configurations available for initialization');
      return;
    }

    logger.info('Initializing provider repository', {
      providerCount: actualConfigs.length,
      providers: actualConfigs.map(c => c.type),
      deferred: !configs && !!this.deferredConfigs,
    });

    const initPromises = actualConfigs.map(async config => this.initializeProvider(config));
    const results = await Promise.allSettled(initPromises);

    // Process initialization results
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const config = actualConfigs[i];

      if (result.status === 'fulfilled') {
        successCount++;
        logger.info(`Provider ${config.type} initialized successfully`);
      } else {
        failureCount++;
        logger.error(`Provider ${config.type} initialization failed`, result.reason);
        this.updateProviderStatus(config.type, {
          isHealthy: false,
          isInitialized: false,
          errorCount: 1,
        });
      }
    }

    this.isInitialized = true;
    this.emit('initialized', { successCount, failureCount });

    logger.info('Provider repository initialization complete', {
      successCount,
      failureCount,
      totalProviders: actualConfigs.length,
    });
  }

  /**
   * Initialize a single provider with timeout optimization
   */
  private async initializeProvider(config: ProviderConfig): Promise<ProviderInitResult> {
    const startTime = Date.now();

    try {
      logger.debug(`Initializing provider: ${config.type}`);

      // Store configuration
      this.configs.set(config.type, config);

      // Create provider instance with timeout
      const provider = await Promise.race([
        this.createProvider(config),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Provider ${config.type} initialization timeout`)),
            config.timeout || this.PROVIDER_TIMEOUT
          )
        ),
      ]);

      // Test provider health with timeout
      const isHealthy = await Promise.race([
        this.testProviderHealth(provider, config),
        new Promise<boolean>(
          resolve => setTimeout(() => resolve(false), 3000) // 3s health check timeout
        ),
      ]);

      if (isHealthy) {
        this.providers.set(config.type, provider);
        this.updateProviderStatus(config.type, {
          isHealthy: true,
          isInitialized: true,
          errorCount: 0,
        });

        this.emit('provider-initialized', config.type);

        return {
          success: true,
          duration: Date.now() - startTime,
          provider,
        };
      } else {
        throw new Error(`Provider ${config.type} failed health check`);
      }
    } catch (error) {
      const result: ProviderInitResult = {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - startTime,
      };

      this.updateProviderStatus(config.type, {
        isHealthy: false,
        isInitialized: false,
        errorCount: 1,
      });

      this.emit('provider-failed', config.type, error);
      return result;
    }
  }

  /**
   * Create provider instance based on type
   */
  private async createProvider(config: ProviderConfig): Promise<any> {
    try {
      switch (config.type) {
        case 'ollama': {
          const { OllamaProvider } = await import('../hybrid/ollama-provider.js');
          return new (OllamaProvider as any)(config);
        }

        case 'lm-studio': {
          const { LMStudioProvider } = await import('../../providers/lm-studio.js');
          return new (LMStudioProvider as any)(config);
        }

        case 'huggingface': {
          // HuggingFace provider fallback to Ollama for now
          logger.warn('HuggingFace provider not implemented, falling back to Ollama');
          const { OllamaProvider } = await import('../hybrid/ollama-provider.js');
          return new (OllamaProvider as any)({ ...config, type: 'ollama' });
        }

        default:
          throw new Error(`Unknown provider type: ${config.type}`);
      }
    } catch (error) {
      logger.error(`Failed to create provider ${config.type}`, error);
      throw error;
    }
  }

  /**
   * Test provider health
   */
  private async testProviderHealth(provider: any, config: ProviderConfig): Promise<boolean> {
    try {
      // Use provider's health check method if available
      if (typeof provider.healthCheck === 'function') {
        return await Promise.race([
          provider.healthCheck(),
          new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), this.PROVIDER_TIMEOUT)
          ),
        ]);
      }

      // Basic connectivity test
      if (typeof provider.testConnection === 'function') {
        return await provider.testConnection();
      }

      // Assume healthy if no test methods available
      return true;
    } catch (error) {
      logger.warn(`Provider ${config.type} health check failed`, error);
      return false;
    }
  }

  /**
   * Get provider instance
   */
  getProvider(type: ProviderType): any | undefined {
    return this.providers.get(type);
  }

  /**
   * Get all available (healthy) providers
   */
  getAvailableProviders(): Map<ProviderType, any> {
    const available = new Map<ProviderType, any>();

    for (const [type, provider] of this.providers.entries()) {
      const status = this.statuses.get(type);
      if (status?.isHealthy && status?.isInitialized) {
        available.set(type, provider);
      }
    }

    return available;
  }

  /**
   * Get all provider types
   */
  getAllProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check provider health
   */
  async checkProviderHealth(type: ProviderType): Promise<boolean> {
    const provider = this.providers.get(type);
    const config = this.configs.get(type);

    if (!provider || !config) {
      return false;
    }

    const isHealthy = await this.testProviderHealth(provider, config);
    this.updateProviderStatus(type, { isHealthy });

    return isHealthy;
  }

  /**
   * Get provider status
   */
  getProviderStatus(type: ProviderType): ProviderStatus | undefined {
    return this.statuses.get(type);
  }

  /**
   * Get all provider statuses
   */
  getAllProviderStatuses(): Map<ProviderType, ProviderStatus> {
    return new Map(this.statuses);
  }

  /**
   * Enable a provider
   */
  async enableProvider(type: ProviderType): Promise<void> {
    const config = this.configs.get(type);
    if (!config) {
      throw new Error(`Provider ${type} not configured`);
    }

    config.enabled = true;
    await this.initializeProvider(config);
    this.emit('provider-enabled', type);
  }

  /**
   * Disable a provider
   */
  async disableProvider(type: ProviderType): Promise<void> {
    const provider = this.providers.get(type);
    if (provider && typeof provider.shutdown === 'function') {
      await provider.shutdown();
    }

    this.providers.delete(type);
    this.updateProviderStatus(type, {
      isHealthy: false,
      isInitialized: false,
    });

    const config = this.configs.get(type);
    if (config) {
      config.enabled = false;
    }

    this.emit('provider-disabled', type);
  }

  /**
   * Switch from one provider to another
   */
  async switchProvider(from: ProviderType, to: ProviderType): Promise<void> {
    const toProvider = this.providers.get(to);
    if (!toProvider) {
      throw new Error(`Target provider ${to} not available`);
    }

    const fromProvider = this.providers.get(from);
    if (fromProvider && typeof fromProvider.pause === 'function') {
      await fromProvider.pause();
    }

    this.emit('provider-switched', { from, to });
  }

  /**
   * Get available models for a provider
   */
  async getAvailableModels(providerType?: ProviderType): Promise<string[]> {
    if (providerType) {
      const provider = this.providers.get(providerType);
      if (provider && typeof provider.listModels === 'function') {
        return await provider.listModels();
      }
      return [];
    }

    // Get models from all providers
    const allModels: string[] = [];
    for (const [type, provider] of this.providers.entries()) {
      if (typeof provider.listModels === 'function') {
        try {
          const models = await provider.listModels();
          allModels.push(...models.map((m: string) => `${type}:${m}`));
        } catch (error) {
          logger.warn(`Failed to list models for ${type}`, error);
        }
      }
    }

    return allModels;
  }

  /**
   * Switch model for a provider
   */
  async switchModel(providerType: ProviderType, modelName: string): Promise<void> {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Provider ${providerType} not available`);
    }

    if (typeof provider.switchModel === 'function') {
      await provider.switchModel(modelName);
      this.emit('model-switched', { providerType, modelName });
    } else {
      throw new Error(`Provider ${providerType} does not support model switching`);
    }
  }

  /**
   * Update provider configuration
   */
  async updateProviderConfig(type: ProviderType, config: Partial<ProviderConfig>): Promise<void> {
    const currentConfig = this.configs.get(type);
    if (!currentConfig) {
      throw new Error(`Provider ${type} not configured`);
    }

    const newConfig = { ...currentConfig, ...config };
    this.configs.set(type, newConfig);

    // Reinitialize if provider is active
    if (this.providers.has(type)) {
      await this.disableProvider(type);
      await this.initializeProvider(newConfig);
    }

    this.emit('config-updated', type, newConfig);
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(type: ProviderType): ProviderConfig | undefined {
    return this.configs.get(type);
  }

  /**
   * Shutdown all providers
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down provider repository');

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Shutdown all providers
    const shutdownPromises = Array.from(this.providers.entries()).map(async ([type, provider]) => {
      try {
        if (typeof provider.shutdown === 'function') {
          await provider.shutdown();
        }
      } catch (error) {
        logger.error(`Error shutting down provider ${type}`, error);
      }
    });

    await Promise.allSettled(shutdownPromises);

    // Clear all data
    this.providers.clear();
    this.configs.clear();
    this.statuses.clear();
    this.isInitialized = false;

    this.emit('shutdown');
    this.removeAllListeners();
  }

  /**
   * Setup periodic health monitoring
   */
  private setupHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      // TODO: Store interval ID and call clearInterval in cleanup
      if (!this.isInitialized) return;

      for (const type of this.providers.keys()) {
        try {
          await this.checkProviderHealth(type);
        } catch (error) {
          logger.error(`Health check failed for provider ${type}`, error);
          this.incrementErrorCount(type);
        }
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Update provider status
   */
  private updateProviderStatus(
    type: ProviderType,
    updates: Partial<Omit<ProviderStatus, 'type' | 'lastHealthCheck'>>
  ): void {
    const current = this.statuses.get(type) || {
      type,
      isHealthy: false,
      isInitialized: false,
      lastHealthCheck: new Date(),
      errorCount: 0,
      models: [],
      endpoint: this.configs.get(type)?.endpoint || '',
    };

    const updated: ProviderStatus = {
      ...current,
      ...updates,
      lastHealthCheck: new Date(),
    };

    this.statuses.set(type, updated);
    this.emit('status-updated', type, updated);
  }

  /**
   * Increment error count for a provider
   */
  private incrementErrorCount(type: ProviderType): void {
    const status = this.statuses.get(type);
    if (status) {
      status.errorCount++;

      // Disable provider if error count exceeds threshold
      if (status.errorCount >= this.MAX_ERROR_COUNT) {
        status.isHealthy = false;
        this.emit('provider-unhealthy', type, status);
      }

      this.statuses.set(type, status);
    }
  }
}

// Factory function for easy instantiation
export function createProviderRepository(): IProviderRepository {
  return new ProviderRepository();
}

// Default export for convenience
export default ProviderRepository;
