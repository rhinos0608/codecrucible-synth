import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../logger.js';
import { UnifiedModelClient } from "../client.js";

export interface ModelInfo {
  id: string;
  name: string;
  provider: 'ollama' | 'lmstudio' | 'openai' | 'anthropic';
  path: string;
  size: number;
  capabilities: ModelCapabilities;
  status: 'available' | 'loading' | 'error';
  metadata: ModelMetadata;
}

export interface ModelCapabilities {
  maxTokens: number;
  contextWindow: number;
  streaming: boolean;
  codeGeneration: boolean;
  reasoning: boolean;
  multimodal: boolean;
  languages: string[];
}

export interface ModelMetadata {
  family: string;
  version: string;
  quantization?: string;
  parameters: string;
  license: string;
  description: string;
  tags: string[];
}

export interface SyncResult {
  synchronized: number;
  providers: number;
  symlinks: number;
  errors: string[];
  recommendations: string[];
}

export interface ModelProvider {
  name: string;
  endpoint: string;
  enabled: boolean;
  discoverModels(): Promise<ModelInfo[]>;
  isHealthy(): Promise<boolean>;
  getModelDetails(modelId: string): Promise<ModelInfo | null>;
}

export interface ProviderHealth {
  provider: string;
  healthy: boolean;
  latency: number;
  modelsAvailable: number;
  error?: string;
}

/**
 * Model Bridge Manager for cross-provider model synchronization and management
 * Inspired by LM Studio Ollama Bridge patterns with intelligent routing
 */
export class ModelBridgeManager {
  private providers: Map<string, ModelProvider>;
  private modelCache: Map<string, ModelInfo>;
  private symlinkDir: string;
  private configPath: string;
  private syncInterval?: NodeJS.Timeout;

  constructor(workspaceRoot: string) {
    this.providers = new Map();
    this.modelCache = new Map();
    this.symlinkDir = path.join(workspaceRoot, '.codecrucible', 'models');
    this.configPath = path.join(workspaceRoot, 'config', 'model-bridge.yaml');
    
    logger.info('Model bridge manager initialized', {
      symlinkDir: this.symlinkDir,
      configPath: this.configPath
    });
  }

  /**
   * Initialize model bridge with providers
   */
  async initialize(): Promise<void> {
    await this.ensureDirectoryExists(this.symlinkDir);
    await this.loadConfiguration();
    await this.initializeProviders();
    await this.startPeriodicSync();
    
    logger.info('Model bridge manager fully initialized');
  }

  /**
   * Register a model provider
   */
  registerProvider(provider: ModelProvider): void {
    this.providers.set(provider.name, provider);
    logger.info(`Registered model provider: ${provider.name}`);
  }

  /**
   * Synchronize models across all providers
   */
  async synchronizeModels(): Promise<SyncResult> {
    const startTime = Date.now();
    const allModels = new Map<string, ModelInfo>();
    const errors: string[] = [];
    let symlinksCreated = 0;

    logger.info('Starting model synchronization across providers...');

    // Discover models from all providers
    for (const [name, provider] of this.providers) {
      if (!provider.enabled) {
        logger.debug(`Skipping disabled provider: ${name}`);
        continue;
      }

      try {
        const isHealthy = await provider.isHealthy();
        if (!isHealthy) {
          errors.push(`Provider ${name} is not healthy`);
          continue;
        }

        const models = await provider.discoverModels();
        logger.info(`Discovered ${models.length} models from ${name}`);

        models.forEach(model => {
          const key = this.generateModelKey(model);
          if (!allModels.has(key) || this.isModelBetter(model, allModels.get(key)!)) {
            allModels.set(key, { ...model, provider: model.provider });
          }
        });

      } catch (error) {
        const errorMsg = `Failed to discover models from ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        logger.error(errorMsg, error);
      }
    }

    // Create cross-provider symlinks
    try {
      symlinksCreated = await this.createModelSymlinks(allModels);
    } catch (error) {
      const errorMsg = `Failed to create symlinks: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      logger.error(errorMsg, error);
    }

    // Update cache
    this.modelCache.clear();
    allModels.forEach((model, key) => {
      this.modelCache.set(key, model);
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations(allModels, errors);

    const result: SyncResult = {
      synchronized: allModels.size,
      providers: Array.from(this.providers.values()).filter(p => p.enabled).length,
      symlinks: symlinksCreated,
      errors,
      recommendations
    };

    const duration = Date.now() - startTime;
    logger.info(`Model synchronization completed in ${duration}ms`, result);

    return result;
  }

  /**
   * Get all available models
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    if (this.modelCache.size === 0) {
      await this.synchronizeModels();
    }

    return Array.from(this.modelCache.values());
  }

  /**
   * Find best model for a specific task
   */
  async findBestModel(
    requirements: {
      task: 'code-generation' | 'reasoning' | 'chat' | 'analysis';
      language?: string;
      maxLatency?: number;
      minQuality?: number;
      provider?: string;
    }
  ): Promise<ModelInfo | null> {
    const models = await this.getAvailableModels();
    
    let candidates = models.filter(model => {
      // Filter by provider if specified
      if (requirements.provider && model.provider !== requirements.provider) {
        return false;
      }

      // Filter by capabilities
      switch (requirements.task) {
        case 'code-generation':
          return model.capabilities.codeGeneration;
        case 'reasoning':
          return model.capabilities.reasoning;
        case 'chat':
          return true; // All models can chat
        case 'analysis':
          return model.capabilities.reasoning || model.capabilities.codeGeneration;
        default:
          return true;
      }
    });

    // Filter by language if specified
    if (requirements.language) {
      candidates = candidates.filter(model => 
        model.capabilities.languages.includes(requirements.language!) ||
        model.capabilities.languages.includes('*') // Universal language support
      );
    }

    // Score models based on requirements
    const scored = candidates.map(model => ({
      model,
      score: this.calculateModelScore(model, requirements)
    }));

    // Sort by score and return best
    scored.sort((a, b) => b.score - a.score);
    
    return scored.length > 0 ? scored[0].model : null;
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(): Promise<ProviderHealth[]> {
    const healthChecks = Array.from(this.providers.entries()).map(async ([name, provider]) => {
      const startTime = Date.now();
      
      try {
        const healthy = await provider.isHealthy();
        const latency = Date.now() - startTime;
        
        let modelsAvailable = 0;
        if (healthy) {
          try {
            const models = await provider.discoverModels();
            modelsAvailable = models.length;
          } catch (error) {
            logger.warn(`Failed to count models for ${name}:`, error);
          }
        }

        return {
          provider: name,
          healthy,
          latency,
          modelsAvailable
        };

      } catch (error) {
        return {
          provider: name,
          healthy: false,
          latency: Date.now() - startTime,
          modelsAvailable: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    return Promise.all(healthChecks);
  }

  /**
   * Create symbolic links for cross-provider model access
   */
  private async createModelSymlinks(models: Map<string, ModelInfo>): Promise<number> {
    let created = 0;

    // Clean up existing symlinks first
    await this.cleanupOldSymlinks();

    for (const [key, model] of models) {
      try {
        const symlinkName = this.generateSymlinkName(model);
        const symlinkPath = path.join(this.symlinkDir, symlinkName);
        
        // Create descriptive symlink pointing to model file
        if (await this.isValidModelPath(model.path)) {
          await fs.symlink(model.path, symlinkPath);
          created++;
          
          logger.debug(`Created symlink: ${symlinkName} -> ${model.path}`);
          
          // Create metadata file alongside symlink
          await this.createModelMetadataFile(symlinkPath, model);
        }

      } catch (error) {
        logger.warn(`Failed to create symlink for ${model.name}:`, error);
      }
    }

    return created;
  }

  /**
   * Generate descriptive symlink name
   */
  private generateSymlinkName(model: ModelInfo): string {
    const safeName = model.name
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '_')
      .replace(/_+/g, '_');
    
    const provider = model.provider;
    const family = model.metadata.family?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown';
    const params = model.metadata.parameters?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
    
    return `${provider}_${family}_${params}_${safeName}`;
  }

  /**
   * Create metadata file for model
   */
  private async createModelMetadataFile(symlinkPath: string, model: ModelInfo): Promise<void> {
    const metadataPath = symlinkPath + '.metadata.json';
    const metadata = {
      model: {
        id: model.id,
        name: model.name,
        provider: model.provider,
        size: model.size,
        capabilities: model.capabilities,
        metadata: model.metadata
      },
      bridge: {
        created: new Date().toISOString(),
        symlinkTarget: model.path,
        bridgeVersion: '1.0.0'
      }
    };

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Clean up old symlinks and metadata files
   */
  private async cleanupOldSymlinks(): Promise<void> {
    try {
      const files = await fs.readdir(this.symlinkDir);
      
      for (const file of files) {
        const filePath = path.join(this.symlinkDir, file);
        const stats = await fs.lstat(filePath);
        
        if (stats.isSymbolicLink() || file.endsWith('.metadata.json')) {
          await fs.unlink(filePath);
        }
      }
      
      logger.debug('Cleaned up old symlinks and metadata files');
      
    } catch (error) {
      logger.warn('Failed to cleanup old symlinks:', error);
    }
  }

  /**
   * Generate unique key for model
   */
  private generateModelKey(model: ModelInfo): string {
    return `${model.provider}:${model.id}`;
  }

  /**
   * Check if one model is better than another
   */
  private isModelBetter(newModel: ModelInfo, existingModel: ModelInfo): boolean {
    // Prefer models with better capabilities
    const newScore = this.calculateModelCapabilityScore(newModel);
    const existingScore = this.calculateModelCapabilityScore(existingModel);
    
    return newScore > existingScore;
  }

  /**
   * Calculate model capability score
   */
  private calculateModelCapabilityScore(model: ModelInfo): number {
    let score = 0;
    
    // Context window size
    score += model.capabilities.contextWindow / 1000;
    
    // Capabilities
    if (model.capabilities.codeGeneration) score += 10;
    if (model.capabilities.reasoning) score += 10;
    if (model.capabilities.streaming) score += 5;
    if (model.capabilities.multimodal) score += 8;
    
    // Language support
    score += model.capabilities.languages.length;
    
    // Provider preference (can be configured)
    const providerPreference = { ollama: 1.2, lmstudio: 1.1, openai: 1.0, anthropic: 1.0 };
    score *= providerPreference[model.provider] || 1.0;
    
    return score;
  }

  /**
   * Calculate model score for specific requirements
   */
  private calculateModelScore(
    model: ModelInfo, 
    requirements: { task: string; language?: string; maxLatency?: number; minQuality?: number }
  ): number {
    let score = this.calculateModelCapabilityScore(model);
    
    // Task-specific scoring
    switch (requirements.task) {
      case 'code-generation':
        if (model.capabilities.codeGeneration) score *= 1.5;
        if (model.name.toLowerCase().includes('code')) score *= 1.2;
        break;
      case 'reasoning':
        if (model.capabilities.reasoning) score *= 1.5;
        if (model.capabilities.contextWindow > 8000) score *= 1.2;
        break;
      case 'analysis':
        if (model.capabilities.reasoning) score *= 1.3;
        if (model.capabilities.contextWindow > 4000) score *= 1.1;
        break;
    }
    
    // Language preference
    if (requirements.language && model.capabilities.languages.includes(requirements.language)) {
      score *= 1.3;
    }
    
    // Size considerations (smaller can be faster)
    if (model.size < 4 * 1024 * 1024 * 1024) { // < 4GB
      score *= 1.1;
    }
    
    return score;
  }

  /**
   * Validate model path exists and is accessible
   */
  private async isValidModelPath(modelPath: string): Promise<boolean> {
    try {
      await fs.access(modelPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate recommendations based on sync results
   */
  private generateRecommendations(models: Map<string, ModelInfo>, errors: string[]): string[] {
    const recommendations: string[] = [];
    
    // Check for missing providers
    if (models.size === 0) {
      recommendations.push('No models found. Check that LM Studio and Ollama are running with models loaded.');
    }
    
    // Check for capability gaps
    const hasCodeGeneration = Array.from(models.values()).some(m => m.capabilities.codeGeneration);
    const hasReasoning = Array.from(models.values()).some(m => m.capabilities.reasoning);
    
    if (!hasCodeGeneration) {
      recommendations.push('Consider loading a code-generation model for better programming assistance.');
    }
    
    if (!hasReasoning) {
      recommendations.push('Consider loading a reasoning-capable model for complex analysis tasks.');
    }
    
    // Check for size variety
    const sizes = Array.from(models.values()).map(m => m.size);
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    
    if (sizes.every(size => size > 4 * 1024 * 1024 * 1024)) {
      recommendations.push('Consider adding smaller models for faster responses to simple queries.');
    }
    
    // Error-based recommendations
    if (errors.length > 0) {
      recommendations.push('Some providers had errors. Check logs and provider configurations.');
    }
    
    return recommendations;
  }

  /**
   * Load configuration from file
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf-8');
      const yaml = await import('js-yaml');
      const config = yaml.load(configContent) as any;
      
      // Apply configuration settings
      logger.debug('Loaded model bridge configuration', { config });
      
    } catch (error) {
      logger.debug('No model bridge configuration found, using defaults');
    }
  }

  /**
   * Initialize providers (Ollama, LM Studio, etc.)
   */
  private async initializeProviders(): Promise<void> {
    // Register Ollama provider
    const ollamaProvider = new OllamaModelProvider();
    this.registerProvider(ollamaProvider);
    
    // Register LM Studio provider
    const lmStudioProvider = new LMStudioModelProvider();
    this.registerProvider(lmStudioProvider);
    
    logger.info('Initialized model providers');
  }

  /**
   * Start periodic synchronization
   */
  private async startPeriodicSync(): Promise<void> {
    // Sync every 5 minutes
    this.syncInterval = setInterval(async () => {
      try {
        await this.synchronizeModels();
      } catch (error) {
        logger.error('Periodic sync failed:', error);
      }
    }, 5 * 60 * 1000);
    
    logger.debug('Started periodic model synchronization');
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.providers.clear();
    this.modelCache.clear();
    
    logger.info('Model bridge manager disposed');
  }
}

/**
 * Ollama provider implementation
 */
class OllamaModelProvider implements ModelProvider {
  name = 'ollama';
  endpoint = 'http://localhost:11434';
  enabled = true;

  async discoverModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`);
      const data = await response.json();
      
      return data.models?.map((model: any) => this.mapOllamaModel(model)) || [];
    } catch (error) {
      logger.warn('Failed to discover Ollama models:', error);
      return [];
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getModelDetails(modelId: string): Promise<ModelInfo | null> {
    try {
      const response = await fetch(`${this.endpoint}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelId })
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return this.mapOllamaModel(data);
    } catch {
      return null;
    }
  }

  private mapOllamaModel(model: any): ModelInfo {
    return {
      id: model.name,
      name: model.name,
      provider: 'ollama',
      path: model.digest || model.name, // Ollama uses digest/name as path
      size: model.size || 0,
      capabilities: {
        maxTokens: 4096, // Default for Ollama
        contextWindow: 8192,
        streaming: true,
        codeGeneration: model.name.toLowerCase().includes('code'),
        reasoning: model.name.toLowerCase().includes('qwq') || model.name.toLowerCase().includes('reasoning'),
        multimodal: model.name.toLowerCase().includes('vision') || model.name.toLowerCase().includes('llava'),
        languages: ['*'] // Assume universal language support
      },
      status: 'available',
      metadata: {
        family: model.details?.family || 'unknown',
        version: model.details?.version || '1.0',
        quantization: model.details?.quantization_level,
        parameters: model.details?.parameter_size || 'unknown',
        license: 'unknown',
        description: model.details?.description || '',
        tags: model.name.split(':')
      }
    };
  }
}

/**
 * LM Studio provider implementation
 */
class LMStudioModelProvider implements ModelProvider {
  name = 'lmstudio';
  endpoint = 'http://localhost:1234';
  enabled = true;

  async discoverModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.endpoint}/v1/models`);
      const data = await response.json();
      
      return data.data?.map((model: any) => this.mapLMStudioModel(model)) || [];
    } catch (error) {
      logger.warn('Failed to discover LM Studio models:', error);
      return [];
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/v1/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getModelDetails(modelId: string): Promise<ModelInfo | null> {
    const models = await this.discoverModels();
    return models.find(model => model.id === modelId) || null;
  }

  private mapLMStudioModel(model: any): ModelInfo {
    return {
      id: model.id,
      name: model.id,
      provider: 'lmstudio',
      path: model.id, // LM Studio uses model ID as path
      size: 0, // LM Studio doesn't provide size in API
      capabilities: {
        maxTokens: 2048, // Default for LM Studio
        contextWindow: 4096,
        streaming: true,
        codeGeneration: model.id.toLowerCase().includes('code'),
        reasoning: true, // Assume reasoning capability
        multimodal: false, // Most LM Studio models are text-only
        languages: ['*'] // Assume universal language support
      },
      status: 'available',
      metadata: {
        family: 'unknown',
        version: '1.0',
        parameters: 'unknown',
        license: 'unknown',
        description: `LM Studio model: ${model.id}`,
        tags: model.id.split('-')
      }
    };
  }
}