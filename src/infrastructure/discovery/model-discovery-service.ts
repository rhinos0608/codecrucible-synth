/**
 * Model Discovery Service
 *
 * Dynamically discovers available models from various providers
 * Replaces hard-coded model lists with real-time provider queries
 * Supports Ollama, LM Studio, and other model providers
 */

import { logger } from '../logging/unified-logger.js';
import { ProviderType } from '../../domain/types/unified-types.js';

export interface ModelInfo {
  name: string;
  provider: ProviderType;
  size?: string;
  family?: string;
  capabilities?: string[];
  isAvailable: boolean;
  lastChecked?: Date;
  metadata?: {
    parametersSize?: string;
    quantization?: string;
    createdAt?: Date;
    modifiedAt?: Date;
  };
}

export interface ModelDiscoveryOptions {
  includeUnavailable?: boolean;
  timeout?: number;
  cache?: boolean;
  providers?: ProviderType[];
}

/**
 * Service for discovering available models across different providers
 */
export class ModelDiscoveryService {
  private modelCache: Map<ProviderType, ModelInfo[]> = new Map();
  private cacheExpiry: Map<ProviderType, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Discover all available models from all providers
   */
  public async discoverModels(options: Readonly<ModelDiscoveryOptions> = {}): Promise<ModelInfo[]> {
    const {
      includeUnavailable = false,
      timeout = 10000,
      cache = true,
      providers = ['ollama', 'lm-studio', 'anthropic', 'huggingface', 'openai', 'google'],
    } = options;

    const allModels: ModelInfo[] = [];

    for (const provider of providers) {
      try {
        const models = await this.discoverModelsFromProvider(provider, { timeout, cache });
        allModels.push(...models);
      } catch (error: unknown) {
        logger.warn(`Failed to discover models from ${provider}:`, {
          error: error instanceof Error ? error.message : String(error),
        });
        // Add fallback models for failed providers
        allModels.push(...this.getFallbackModels(provider));
      }
    }

    // Filter based on availability preference
    const filteredModels = includeUnavailable
      ? allModels
      : allModels.filter((model: Readonly<ModelInfo>) => model.isAvailable);

    logger.info(`Discovered ${filteredModels.length} models from ${providers.length} providers`, {
      providers: providers.join(', '),
      includeUnavailable,
      totalFound: allModels.length,
      available: filteredModels.length,
    });

    return filteredModels;
  }

  /**
   * Discover models from a specific provider
   */
  public async discoverModelsFromProvider(
    provider: ProviderType,
    options: Readonly<{ timeout?: number; cache?: boolean }> = {}
  ): Promise<ModelInfo[]> {
    const { timeout = 10000, cache = true } = options;

    // Check cache first
    if (cache && this.isValidCache(provider)) {
      const cached = this.modelCache.get(provider);
      if (cached) {
        logger.debug(`Using cached models for ${provider}`, { count: cached.length });
        return cached;
      }
    }

    logger.info(`Discovering models from ${provider}...`);
    let models: ModelInfo[] = [];

    try {
      switch (provider) {
        case 'ollama':
          models = await this.discoverOllamaModels(timeout);
          break;
        case 'lm-studio':
          models = await this.discoverLMStudioModels(timeout);
          break;
        case 'huggingface':
          models = await this.discoverHuggingFaceModels(timeout);
          break;
        default:
          logger.warn(`Unknown provider: ${provider}`);
          models = this.getFallbackModels(provider);
      }

      // Cache the results
      if (cache) {
        this.modelCache.set(provider, models);
        this.cacheExpiry.set(provider, Date.now() + this.CACHE_TTL);
      }

      logger.debug(`Discovered ${models.length} models from ${provider}`);
      return models;
    } catch (error: unknown) {
      logger.error(
        `Error discovering models from ${provider}:`,
        error instanceof Error ? error : new Error(String(error))
      );
      return this.getFallbackModels(provider);
    }
  }

  /**
   * Discover models from Ollama
   */
  private async discoverOllamaModels(timeout: number): Promise<ModelInfo[]> {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        throw new Error(`Ollama API returned ${response.status}: ${response.statusText}`);
      }

      const data: unknown = await response.json();
      const models: ModelInfo[] = [];

      if (
        typeof data === 'object' &&
        data !== null &&
        'models' in data &&
        Array.isArray((data as { models: unknown }).models)
      ) {
        for (const modelRaw of (data as { models: unknown[] }).models) {
          if (typeof modelRaw === 'object' && modelRaw !== null && 'name' in modelRaw) {
            const model = modelRaw as {
              name: string;
              size?: string;
              details?: {
                parameter_size?: string;
                family?: string;
                quantization_level?: string;
              };
              created_at?: string | number | Date;
              modified_at?: string | number | Date;
            };
            models.push({
              name: model.name,
              provider: 'ollama',
              size: model.details?.parameter_size ?? model.size,
              family: model.details?.family,
              isAvailable: true,
              lastChecked: new Date(),
              metadata: {
                parametersSize: model.details?.parameter_size,
                quantization: model.details?.quantization_level,
                createdAt: model.created_at
                  ? new Date(
                      typeof model.created_at === 'string' || typeof model.created_at === 'number'
                        ? model.created_at
                        : Date.now()
                    )
                  : undefined,
                modifiedAt: model.modified_at
                  ? new Date(
                      typeof model.modified_at === 'string' || typeof model.modified_at === 'number'
                        ? model.modified_at
                        : Date.now()
                    )
                  : undefined,
              },
            });
          }
        }
      }

      return models;
    } catch (error: unknown) {
      logger.warn('Ollama not available or models not accessible:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Discover models from LM Studio
   */
  private async discoverLMStudioModels(timeout: number): Promise<ModelInfo[]> {
    try {
      const response = await fetch('http://localhost:1234/v1/models', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        throw new Error(`LM Studio API returned ${response.status}: ${response.statusText}`);
      }

      const dataUnknown: unknown = await response.json();
      const models: ModelInfo[] = [];

      if (
        typeof dataUnknown === 'object' &&
        dataUnknown !== null &&
        'data' in dataUnknown &&
        Array.isArray((dataUnknown as { data: unknown }).data)
      ) {
        const dataArr = (dataUnknown as { data: unknown[] }).data;
        for (const modelRaw of dataArr) {
          if (typeof modelRaw === 'object' && modelRaw !== null && 'id' in modelRaw) {
            const model = modelRaw as { id: string; created?: number };
            models.push({
              name: model.id,
              provider: 'lm-studio',
              isAvailable: true,
              lastChecked: new Date(),
              capabilities: ['chat', 'completion'],
              metadata: {
                createdAt:
                  typeof model.created === 'number' ? new Date(model.created * 1000) : undefined,
              },
            });
          }
        }
      }

      return models;
    } catch (error: unknown) {
      logger.warn('LM Studio not available or models not accessible:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Discover models from HuggingFace using real API queries
   */
  private async discoverHuggingFaceModels(timeout: number): Promise<ModelInfo[]> {
    try {
      // Dynamic import to avoid circular dependencies
      const { HuggingFaceTool } = await import('../../mcp-tools/huggingface-tool.js');

      const hfTool = new HuggingFaceTool({
        enabled: true,
        timeout,
        baseUrl: 'https://huggingface.co/api',
      });

      // Search for popular coding and chat models
      const searchQueries = [
        { query: 'code', task: 'text-generation', limit: 10 },
        { query: 'chat', task: 'conversational', limit: 8 },
        { query: 'assistant', task: 'text-generation', limit: 5 },
      ];

      const allModels: ModelInfo[] = [];

      for (const searchQuery of searchQueries) {
        try {
          const models = await hfTool.searchModels(searchQuery.query, {
            task: searchQuery.task,
            sort: 'downloads',
            direction: 'desc',
            limit: searchQuery.limit,
          });

          allModels.push(
            ...models.map(model => ({
              ...model,
              provider: 'huggingface' as ProviderType,
              isAvailable: true,
              lastChecked: new Date(),
              capabilities: this.inferCapabilities(model.name, searchQuery.task),
            }))
          );
        } catch (searchError) {
          logger.debug(`HF search failed for query "${searchQuery.query}":`, {
            error: searchError instanceof Error ? searchError.message : String(searchError),
          });
        }
      }

      // Remove duplicates and limit results
      const uniqueModels = allModels
        .filter(
          (model: Readonly<ModelInfo>, index: number, self: ReadonlyArray<Readonly<ModelInfo>>) =>
            index === self.findIndex((m: Readonly<ModelInfo>) => m.name === model.name)
        )
        .slice(0, 20);

      logger.info(`Discovered ${uniqueModels.length} HuggingFace models dynamically`);
      return uniqueModels;
    } catch (error) {
      logger.warn('Dynamic HuggingFace discovery failed, using fallback models:', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to curated list if API fails
      return [
        {
          name: 'microsoft/DialoGPT-medium',
          provider: 'huggingface',
          family: 'DialoGPT',
          capabilities: ['chat', 'conversation'],
          isAvailable: true,
          lastChecked: new Date(),
        },
        {
          name: 'microsoft/CodeBERT-base',
          provider: 'huggingface',
          family: 'CodeBERT',
          capabilities: ['code-completion', 'code-understanding'],
          isAvailable: true,
          lastChecked: new Date(),
        },
        {
          name: 'codellama/CodeLlama-7b-Instruct-hf',
          provider: 'huggingface',
          family: 'CodeLlama',
          capabilities: ['code-generation', 'instruct'],
          isAvailable: true,
          lastChecked: new Date(),
        },
      ];
    }
  }

  /**
   * Infer model capabilities from name and task
   */
  private inferCapabilities(modelName: string, task?: string): string[] {
    const capabilities = [];

    if (task === 'text-generation') capabilities.push('text-generation');
    if (task === 'conversational') capabilities.push('chat', 'conversation');

    // Infer from model name patterns
    if (modelName.toLowerCase().includes('code'))
      capabilities.push('code-generation', 'code-completion');
    if (modelName.toLowerCase().includes('chat') || modelName.toLowerCase().includes('dialog'))
      capabilities.push('chat');
    if (modelName.toLowerCase().includes('instruct')) capabilities.push('instruct', 'assistant');
    if (modelName.toLowerCase().includes('embed')) capabilities.push('embedding');

    return capabilities.length > 0 ? capabilities : ['general'];
  }

  /**
   * Get fallback models when discovery fails
   */
  private getFallbackModels(provider: ProviderType): ModelInfo[] {
    const fallbacks: Record<ProviderType, ModelInfo[]> = {
      ollama: [
        {
          name: 'llama3.1:8b',
          provider: 'ollama',
          size: '8B',
          family: 'Llama',
          capabilities: ['function-calling', 'code-generation', 'chat'],
          isAvailable: false,
          lastChecked: new Date(),
        },
        {
          name: 'deepseek-coder:8b',
          provider: 'ollama',
          size: '8B',
          family: 'DeepSeek',
          capabilities: ['code-generation', 'chat'],
          isAvailable: false,
          lastChecked: new Date(),
        },
      ],
      'lm-studio': [
        {
          name: 'local-model',
          provider: 'lm-studio',
          capabilities: ['chat', 'completion'],
          isAvailable: false,
          lastChecked: new Date(),
        },
      ],
      anthropic: [
        {
          name: 'claude-3-sonnet-20240229',
          provider: 'anthropic',
          capabilities: ['chat', 'tool-calling'],
          isAvailable: false,
          lastChecked: new Date(),
        },
      ],
      huggingface: [
        {
          name: 'microsoft/DialoGPT-medium',
          provider: 'huggingface',
          capabilities: ['chat'],
          isAvailable: false,
          lastChecked: new Date(),
        },
      ],
      openai: [
        {
          name: 'gpt-4',
          provider: 'openai',
          capabilities: ['chat', 'tool-calling', 'code-generation'],
          isAvailable: false,
          lastChecked: new Date(),
        },
      ],
      google: [
        {
          name: 'gemini-pro',
          provider: 'google',
          capabilities: ['chat', 'code-generation'],
          isAvailable: false,
          lastChecked: new Date(),
        },
      ],
    };

    return fallbacks[provider] || [];
  }

  /**
   * Check if cached models are still valid
   */
  private isValidCache(provider: ProviderType): boolean {
    const expiry = this.cacheExpiry.get(provider);
    return expiry ? Date.now() < expiry : false;
  }

  /**
   * Clear model cache for all providers
   */
  clearCache(): void {
    this.modelCache.clear();
    this.cacheExpiry.clear();
    logger.info('Model discovery cache cleared');
  }

  /**
   * Clear cache for specific provider
   */
  clearProviderCache(provider: ProviderType): void {
    this.modelCache.delete(provider);
    this.cacheExpiry.delete(provider);
    logger.info(`Model cache cleared for ${provider}`);
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    totalCachedProviders: number;
    totalCachedModels: number;
    cacheStatus: Array<{
      provider: ProviderType;
      modelCount: number;
      expiresIn: number;
      isValid: boolean;
    }>;
  } {
    const cacheStatus = Array.from(this.modelCache.entries()).map(
      ([provider, models]: readonly [ProviderType, readonly ModelInfo[]]) => ({
        provider,
        modelCount: models.length,
        expiresIn: Math.max(0, (this.cacheExpiry.get(provider) ?? 0) - Date.now()),
        isValid: this.isValidCache(provider),
      })
    );

    return {
      totalCachedProviders: this.modelCache.size,
      totalCachedModels: Array.from(this.modelCache.values()).reduce(
        (total: number, models: readonly ModelInfo[]) => total + models.length,
        0
      ),
      cacheStatus,
    };
  }
}

// Export singleton instance
export const modelDiscoveryService = new ModelDiscoveryService();
