/**
 * Unified Model Client - Application Layer Service
 * 
 * Replaces the missing UnifiedModelClient from the refactor directory.
 * Implements the IModelClient interface and coordinates multiple model providers.
 */

import { EventEmitter } from 'events';
import { 
  IModelClient, 
  IModelProvider, 
  IModelRouter,
  ModelRequest, 
  ModelResponse, 
  ModelInfo, 
  StreamToken,
  ModelCapability
} from '../../domain/interfaces/model-client.js';
import { UnifiedConfiguration } from '../../domain/interfaces/configuration.js';
import { logger } from '../../infrastructure/logging/unified-logger.js';
import { OllamaClient } from '../../infrastructure/llm-providers/ollama-client.js';
import { LMStudioClient } from '../../infrastructure/llm-providers/lm-studio-client.js';

export interface UnifiedModelClientConfig {
  defaultProvider: string;
  providers: ProviderConfig[];
  fallbackStrategy: 'fail-fast' | 'round-robin' | 'priority';
  timeout: number;
  retryAttempts: number;
  enableCaching: boolean;
  enableMetrics: boolean;
}

export interface ProviderConfig {
  type: 'ollama' | 'lm-studio' | 'openai' | 'anthropic';
  name: string;
  endpoint: string;
  enabled: boolean;
  priority: number;
  models: string[];
  apiKey?: string;
  timeout?: number;
}

/**
 * Unified Model Client that provides a single interface to multiple AI model providers.
 * Handles provider selection, fallbacks, and coordination.
 */
export class UnifiedModelClient extends EventEmitter implements IModelClient {
  private config: UnifiedModelClientConfig;
  private providers: Map<string, IModelProvider> = new Map();
  private router: IModelRouter;
  private initialized = false;
  private requestCount = 0;
  private cache = new Map<string, { response: ModelResponse; timestamp: number }>();
  
  constructor(config: UnifiedModelClientConfig | UnifiedConfiguration) {
    super();
    
    // Handle both config types for backward compatibility
    if ('model' in config) {
      // UnifiedConfiguration format
      this.config = this.convertUnifiedConfig(config);
    } else {
      // Direct UnifiedModelClientConfig
      this.config = config;
    }
    
    this.setupProviders();
    this.setupRouter();
  }
  
  private convertUnifiedConfig(unifiedConfig: UnifiedConfiguration): UnifiedModelClientConfig {
    return {
      defaultProvider: unifiedConfig.model.defaultProvider,
      providers: unifiedConfig.model.providers.map(p => ({
        type: p.type as any,
        name: p.name,
        endpoint: p.endpoint,
        enabled: p.enabled,
        priority: p.priority || 1,
        models: p.models,
        apiKey: p.apiKey,
        timeout: p.timeout
      })),
      fallbackStrategy: 'priority',
      timeout: unifiedConfig.model.timeout,
      retryAttempts: 3,
      enableCaching: true,
      enableMetrics: true
    };
  }
  
  private setupProviders(): void {
    for (const providerConfig of this.config.providers) {
      if (!providerConfig.enabled) continue;
      
      try {
        let provider: IModelProvider;
        
        switch (providerConfig.type) {
          case 'ollama':
            provider = new OllamaProvider(providerConfig);
            break;
          case 'lm-studio':
            provider = new LMStudioProvider(providerConfig);
            break;
          default:
            logger.warn(`Unknown provider type: ${providerConfig.type}`);
            continue;
        }
        
        this.providers.set(providerConfig.name, provider);
        logger.info(`Registered provider: ${providerConfig.name} (${providerConfig.type})`);
        
      } catch (error) {
        logger.error(`Failed to setup provider ${providerConfig.name}:`, error);
      }
    }
  }
  
  private setupRouter(): void {
    this.router = new SimpleModelRouter(this.providers, this.config);
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    logger.info('Initializing Unified Model Client...');
    
    // Initialize all providers
    const initPromises = Array.from(this.providers.values()).map(async (provider) => {
      try {
        if ('initialize' in provider && typeof provider.initialize === 'function') {
          await provider.initialize();
        }
      } catch (error) {
        logger.error(`Failed to initialize provider:`, error);
      }
    });
    
    await Promise.allSettled(initPromises);
    
    // Verify at least one provider is available
    const availableProviders = await this.getAvailableProviders();
    if (availableProviders.length === 0) {
      throw new Error('No model providers are available');
    }
    
    this.initialized = true;
    this.emit('initialized', { availableProviders: availableProviders.length });
    logger.info(`Unified Model Client initialized with ${availableProviders.length} providers`);
  }
  
  async request(request: ModelRequest): Promise<ModelResponse> {
    if (!this.initialized) {
      throw new Error('Model client not initialized');
    }
    
    const requestId = request.id || `req-${Date.now()}-${++this.requestCount}`;
    const startTime = Date.now();
    
    // Check cache first
    if (this.config.enableCaching) {
      const cacheKey = this.getCacheKey(request);
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 300000) { // 5 minute cache
        logger.debug(`Cache hit for request: ${requestId}`);
        return { ...cached.response, id: requestId };
      }
    }
    
    try {
      logger.debug(`Processing request: ${requestId}`);
      
      // Route to appropriate provider
      const { provider, model } = await this.router.route(request);
      
      // Execute request with the selected provider
      const requestWithId = { ...request, id: requestId, model };
      const response = await provider.request(requestWithId);
      
      // Cache successful responses
      if (this.config.enableCaching && response) {
        const cacheKey = this.getCacheKey(request);
        this.cache.set(cacheKey, { response, timestamp: Date.now() });
      }
      
      const duration = Date.now() - startTime;
      this.emit('request-completed', { requestId, duration, provider: provider.type });
      logger.debug(`Request completed: ${requestId} (${duration}ms)`);
      
      return response;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.emit('request-failed', { requestId, duration, error });
      logger.error(`Request failed: ${requestId}`, error);
      throw error;
    }
  }
  
  async *stream(request: ModelRequest): AsyncIterableIterator<StreamToken> {
    if (!this.initialized) {
      throw new Error('Model client not initialized');
    }
    
    const requestId = request.id || `stream-${Date.now()}-${++this.requestCount}`;
    
    try {
      logger.debug(`Processing stream request: ${requestId}`);
      
      // Route to appropriate provider
      const { provider, model } = await this.router.route(request);
      
      // Execute streaming request
      const requestWithId = { ...request, id: requestId, model, stream: true };
      
      if ('stream' in provider && typeof provider.stream === 'function') {
        yield* provider.stream(requestWithId);
      } else {
        // Fallback to regular request for non-streaming providers
        const response = await provider.request(requestWithId);
        yield {
          content: response.content,
          isComplete: true,
          metadata: response.metadata
        };
      }
      
      this.emit('stream-completed', { requestId });
      
    } catch (error) {
      this.emit('stream-failed', { requestId, error });
      logger.error(`Stream request failed: ${requestId}`, error);
      throw error;
    }
  }
  
  async getAvailableModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];
    
    for (const provider of this.providers.values()) {
      try {
        if (await provider.isAvailable()) {
          const providerModels = await provider.getSupportedModels();
          models.push(...providerModels);
        }
      } catch (error) {
        logger.warn(`Failed to get models from provider:`, error);
      }
    }
    
    return models;
  }
  
  async isHealthy(): Promise<boolean> {
    const availableProviders = await this.getAvailableProviders();
    return availableProviders.length > 0;
  }
  
  async shutdown(): Promise<void> {
    logger.info('Shutting down Unified Model Client...');
    
    // Shutdown all providers
    const shutdownPromises = Array.from(this.providers.values()).map(async (provider) => {
      try {
        if ('shutdown' in provider && typeof provider.shutdown === 'function') {
          await provider.shutdown();
        }
      } catch (error) {
        logger.error('Error shutting down provider:', error);
      }
    });
    
    await Promise.allSettled(shutdownPromises);
    
    this.providers.clear();
    this.cache.clear();
    this.initialized = false;
    this.removeAllListeners();
    
    logger.info('Unified Model Client shut down');
  }
  
  // Utility methods
  private getCacheKey(request: ModelRequest): string {
    return `${request.model || 'default'}:${request.prompt}:${JSON.stringify(request.tools || [])}`;
  }
  
  private async getAvailableProviders(): Promise<IModelProvider[]> {
    const available: IModelProvider[] = [];
    
    for (const provider of this.providers.values()) {
      try {
        if (await provider.isAvailable()) {
          available.push(provider);
        }
      } catch (error) {
        // Provider not available
      }
    }
    
    return available;
  }
  
  // Public utility methods for backward compatibility
  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }
  
  getConfiguration(): UnifiedModelClientConfig {
    return { ...this.config };
  }
  
  async testConnection(): Promise<{ provider: string; available: boolean; latency?: number }[]> {
    const results = [];
    
    for (const [name, provider] of this.providers.entries()) {
      const startTime = Date.now();
      try {
        const available = await provider.isAvailable();
        const latency = Date.now() - startTime;
        results.push({ provider: name, available, latency });
      } catch (error) {
        results.push({ provider: name, available: false });
      }
    }
    
    return results;
  }
}

// Provider Implementations
class OllamaProvider implements IModelProvider {
  readonly type = 'ollama';
  readonly endpoint: string;
  private client: OllamaClient;
  
  constructor(private config: ProviderConfig) {
    this.endpoint = config.endpoint;
    this.client = new OllamaClient({
      endpoint: config.endpoint,
      timeout: config.timeout || 30000,
      retryAttempts: 3,
      retryDelayMs: 1000,
      connectionTimeout: 10000,
      healthCheckInterval: 60000
    });
  }
  
  async initialize(): Promise<void> {
    await this.client.initialize();
  }
  
  async request(request: ModelRequest): Promise<ModelResponse> {
    return await this.client.generate({
      model: request.model || 'default',
      prompt: request.prompt,
      stream: false,
      options: {
        temperature: request.temperature,
        num_predict: request.maxTokens
      }
    }) as ModelResponse;
  }
  
  async isAvailable(): Promise<boolean> {
    return await this.client.isHealthy();
  }
  
  async getSupportedModels(): Promise<ModelInfo[]> {
    const models = await this.client.listModels();
    return models.map(model => ({
      id: model.name,
      name: model.name,
      provider: 'ollama',
      description: `Ollama model: ${model.name}`,
      capabilities: [
        { type: 'completion', supported: true },
        { type: 'chat', supported: true }
      ] as ModelCapability[]
    }));
  }
  
  async shutdown(): Promise<void> {
    await this.client.shutdown();
  }
}

class LMStudioProvider implements IModelProvider {
  readonly type = 'lm-studio';
  readonly endpoint: string;
  private client: LMStudioClient;
  
  constructor(private config: ProviderConfig) {
    this.endpoint = config.endpoint;
    this.client = new LMStudioClient({
      endpoint: config.endpoint,
      timeout: config.timeout || 30000
    });
  }
  
  async initialize(): Promise<void> {
    await this.client.initialize();
  }
  
  async request(request: ModelRequest): Promise<ModelResponse> {
    return await this.client.generateCompletion({
      prompt: request.prompt,
      temperature: request.temperature,
      max_tokens: request.maxTokens
    }) as ModelResponse;
  }
  
  async isAvailable(): Promise<boolean> {
    return await this.client.isConnected();
  }
  
  async getSupportedModels(): Promise<ModelInfo[]> {
    const models = await this.client.getLoadedModels();
    return models.map(model => ({
      id: model.id,
      name: model.name,
      provider: 'lm-studio',
      description: model.description,
      capabilities: [
        { type: 'completion', supported: true },
        { type: 'chat', supported: true }
      ] as ModelCapability[]
    }));
  }
  
  async shutdown(): Promise<void> {
    await this.client.shutdown();
  }
}

// Simple Router Implementation
class SimpleModelRouter implements IModelRouter {
  constructor(
    private providers: Map<string, IModelProvider>,
    private config: UnifiedModelClientConfig
  ) {}
  
  async route(request: ModelRequest): Promise<{ provider: IModelProvider; model: string }> {
    // Try to use the specified provider first
    if (request.provider) {
      const provider = this.providers.get(request.provider);
      if (provider && await provider.isAvailable()) {
        return { provider, model: request.model || 'default' };
      }
    }
    
    // Use default provider
    const defaultProvider = this.providers.get(this.config.defaultProvider);
    if (defaultProvider && await defaultProvider.isAvailable()) {
      return { provider: defaultProvider, model: request.model || 'default' };
    }
    
    // Fallback to any available provider
    for (const provider of this.providers.values()) {
      if (await provider.isAvailable()) {
        return { provider, model: request.model || 'default' };
      }
    }
    
    throw new Error('No available model providers');
  }
  
  getFallbackChain(request: ModelRequest): IModelProvider[] {
    const providers = Array.from(this.providers.values());
    return providers.sort((a, b) => {
      const aConfig = this.config.providers.find(p => p.name === a.type);
      const bConfig = this.config.providers.find(p => p.name === b.type);
      return (bConfig?.priority || 0) - (aConfig?.priority || 0);
    });
  }
}

// Factory function for easy creation
export function createUnifiedModelClient(config: UnifiedConfiguration): UnifiedModelClient {
  return new UnifiedModelClient(config);
}