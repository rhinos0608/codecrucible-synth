/**
 * Simple Model Router - Basic provider selection and load balancing
 * Enterprise-grade fallback routing with performance analytics based on research findings
 */

import { logger } from '../logger.js';
import {
  IModelRouter,
  IModelProvider,
  ModelRequest,
  ModelResponse,
} from '../../domain/interfaces/model-client.js';
import { UnifiedModelClientConfig } from '../../application/services/model-client.js';

export class SimpleModelRouter implements IModelRouter {
  private providers: Map<string, IModelProvider>;
  private config: UnifiedModelClientConfig;
  private failureCount: Map<string, number> = new Map();
  private lastUsed: Map<string, number> = new Map();

  constructor(providers: Map<string, IModelProvider>, config: UnifiedModelClientConfig) {
    this.providers = providers;
    this.config = config;
  }

  /**
   * Route request to best available provider - implements IModelRouter interface
   */
  async route(request: ModelRequest): Promise<{ provider: IModelProvider; model: string }> {
    const availableProviders = await this.getAvailableProviders();

    if (availableProviders.length === 0) {
      throw new Error('No available providers for request routing');
    }

    let selectedProvider: IModelProvider;

    switch (this.config.fallbackStrategy) {
      case 'priority':
        selectedProvider = this.selectByPriority(availableProviders);
        break;
      case 'round-robin':
        selectedProvider = this.selectRoundRobin(availableProviders);
        break;
      case 'fail-fast':
      default:
        selectedProvider = availableProviders[0];
        break;
    }

    return {
      provider: selectedProvider,
      model: request.model || 'default',
    };
  }

  /**
   * Get fallback chain for a request - implements IModelRouter interface
   */
  getFallbackChain(request: ModelRequest): IModelProvider[] {
    return Array.from(this.providers.values()).sort(
      (a, b) => this.getProviderPriority(a) - this.getProviderPriority(b)
    );
  }

  /**
   * Route request to best available provider using enterprise patterns from research
   */
  async routeRequest(request: ModelRequest): Promise<ModelResponse> {
    const routeResult = await this.route(request);
    const selectedProvider = routeResult.provider;

    try {
      logger.info(`Routing request to provider: ${selectedProvider.type}`);
      this.lastUsed.set(selectedProvider.type, Date.now());

      // Use the IModelProvider interface request method
      return await selectedProvider.request(request);
    } catch (error) {
      logger.error(`Provider ${selectedProvider.type} failed:`, error);
      this.recordFailure(selectedProvider.type);

      // Attempt failover using research-backed fallback patterns
      return await this.attemptFailover(request, selectedProvider);
    }
  }

  /**
   * Get list of currently available providers
   */
  private async getAvailableProviders(): Promise<IModelProvider[]> {
    const available: IModelProvider[] = [];

    for (const [name, provider] of this.providers) {
      try {
        if (await provider.isAvailable()) {
          available.push(provider);
        }
      } catch (error) {
        logger.debug(`Provider ${name} availability check failed:`, error);
      }
    }

    return available.sort((a, b) => this.getProviderPriority(a) - this.getProviderPriority(b));
  }

  /**
   * Select provider by configured priority
   */
  private selectByPriority(providers: IModelProvider[]): IModelProvider {
    return providers.reduce((best, current) =>
      this.getProviderPriority(current) < this.getProviderPriority(best) ? current : best
    );
  }

  /**
   * Round-robin selection with failure awareness
   */
  private selectRoundRobin(providers: IModelProvider[]): IModelProvider {
    const healthyProviders = providers.filter(p => (this.failureCount.get(p.type) || 0) < 3);

    if (healthyProviders.length === 0) {
      // Reset failure counts and try again
      this.failureCount.clear();
      return providers[0];
    }

    // Select least recently used
    return healthyProviders.reduce((lru, current) =>
      (this.lastUsed.get(current.type) || 0) < (this.lastUsed.get(lru.type) || 0) ? current : lru
    );
  }

  /**
   * Attempt failover using remaining providers
   */
  private async attemptFailover(
    request: ModelRequest,
    failedProvider: IModelProvider
  ): Promise<ModelResponse> {
    const remainingProviders = await this.getAvailableProviders();
    const fallbackProviders = remainingProviders.filter(p => p.type !== failedProvider.type);

    if (fallbackProviders.length === 0) {
      throw new Error(`All providers failed. Last error from ${failedProvider.type}`);
    }

    for (const provider of fallbackProviders) {
      try {
        logger.info(`Attempting failover to provider: ${provider.type}`);
        return await provider.request(request);
      } catch (error) {
        logger.warn(`Failover to ${provider.type} also failed:`, error);
        this.recordFailure(provider.type);
        continue;
      }
    }

    throw new Error('All failover attempts exhausted');
  }

  /**
   * Get provider priority from configuration
   */
  private getProviderPriority(provider: IModelProvider): number {
    // Find provider config by type
    const providerConfig = this.config.providers.find(p => p.name === provider.type);
    return providerConfig?.priority || 999;
  }

  /**
   * Record provider failure for health tracking
   */
  private recordFailure(providerName: string): void {
    const currentCount = this.failureCount.get(providerName) || 0;
    this.failureCount.set(providerName, currentCount + 1);
  }

  /**
   * Get router health status
   */
  getHealthStatus(): any {
    return {
      availableProviders: Array.from(this.providers.values()).map(p => p.type),
      failureCounts: Object.fromEntries(this.failureCount),
      lastUsed: Object.fromEntries(this.lastUsed),
    };
  }
}
