import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import axios from 'axios';
import { logger } from './logger.js';

const execAsync = promisify(exec);

/**
 * Model configuration interface
 */
export interface ModelConfig {
  id: string;
  name: string;
  provider: 'ollama' | 'openai' | 'anthropic' | 'google' | 'azure' | 'huggingface';
  type: 'local' | 'api';
  endpoint?: string;
  apiKey?: string;
  model: string;
  contextWindow?: number;
  capabilities: ModelCapabilities;
  status: 'available' | 'unavailable' | 'unknown';
  performance?: ModelPerformance;
}

/**
 * Model capabilities
 */
export interface ModelCapabilities {
  codeGeneration: boolean;
  codeAnalysis: boolean;
  multiLanguage: boolean;
  functionCalling: boolean;
  streaming: boolean;
  largeContext: boolean;
  reasoning: boolean;
}

/**
 * Model performance metrics
 */
export interface ModelPerformance {
  speed: 'fast' | 'medium' | 'slow';
  quality: 'high' | 'medium' | 'low';
  memoryUsage: 'low' | 'medium' | 'high';
  diskSpace?: number; // MB
}

/**
 * Ollama model information
 */
interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    families?: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

/**
 * Intelligent Model Manager that can detect and manage both local and API models
 */
export class IntelligentModelManager {
  private configPath: string;
  private models: Map<string, ModelConfig> = new Map();
  private activeModel: ModelConfig | null = null;
  private ollamaEndpoint = 'http://localhost:11434';

  constructor(configDir: string) {
    this.configPath = join(configDir, 'models.json');
    this.loadSavedModels();
  }

  /**
   * Detect all available models on the system
   */
  async detectAvailableModels(): Promise<{
    success: boolean;
    discovered: number;
    updated: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let discovered = 0;
    let updated = 0;

    try {
      logger.info('Starting model detection...');

      // Detect Ollama models
      try {
        const ollamaModels = await this.detectOllamaModels();
        discovered += ollamaModels.length;
        logger.info(`Detected ${ollamaModels.length} Ollama models`);
      } catch (error) {
        const errorMsg = `Ollama detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        logger.warn(errorMsg);
      }

      // Check existing API configurations
      for (const [id, model] of this.models) {
        if (model.type === 'api') {
          try {
            const isAvailable = await this.testModelConnection(model);
            model.status = isAvailable ? 'available' : 'unavailable';
            updated++;
          } catch (error) {
            model.status = 'unavailable';
            errors.push(`API model ${id} test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      this.saveModels();

      logger.info('Model detection completed', { 
        discovered, 
        updated, 
        totalModels: this.models.size,
        errors: errors.length 
      });

      return {
        success: true,
        discovered,
        updated,
        errors
      };

    } catch (error) {
      const errorMsg = `Model detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMsg);
      return {
        success: false,
        discovered: 0,
        updated: 0,
        errors: [errorMsg]
      };
    }
  }

  /**
   * Detect Ollama models
   */
  private async detectOllamaModels(): Promise<ModelConfig[]> {
    // First check if Ollama is running
    const isRunning = await this.isOllamaRunning();
    if (!isRunning) {
      throw new Error('Ollama is not running. Please start Ollama service.');
    }

    try {
      const response = await axios.get(`${this.ollamaEndpoint}/api/tags`, {
        timeout: 5000
      });

      const ollamaModels: OllamaModel[] = response.data.models || [];
      const detectedModels: ModelConfig[] = [];

      for (const ollamaModel of ollamaModels) {
        const modelConfig = this.createOllamaModelConfig(ollamaModel);
        this.models.set(modelConfig.id, modelConfig);
        detectedModels.push(modelConfig);
      }

      return detectedModels;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Cannot connect to Ollama. Is it running on localhost:11434?');
        }
        throw new Error(`Ollama API error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Check if Ollama is running
   */
  private async isOllamaRunning(): Promise<boolean> {
    try {
      await axios.get(`${this.ollamaEndpoint}/api/tags`, { timeout: 2000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create model configuration from Ollama model
   */
  private createOllamaModelConfig(ollamaModel: OllamaModel): ModelConfig {
    const id = `ollama-${ollamaModel.name.replace(/[^a-zA-Z0-9-]/g, '-')}`;
    
    // Determine capabilities based on model name
    const capabilities = this.determineModelCapabilities(ollamaModel.name);
    const performance = this.estimateModelPerformance(ollamaModel);

    return {
      id,
      name: ollamaModel.name,
      provider: 'ollama',
      type: 'local',
      endpoint: this.ollamaEndpoint,
      model: ollamaModel.name,
      contextWindow: this.getContextWindow(ollamaModel.name),
      capabilities,
      status: 'available',
      performance
    };
  }

  /**
   * Determine model capabilities based on name
   */
  private determineModelCapabilities(modelName: string): ModelCapabilities {
    const name = modelName.toLowerCase();
    
    return {
      codeGeneration: true, // Most modern models support code generation
      codeAnalysis: true,
      multiLanguage: true,
      functionCalling: name.includes('llama3') || name.includes('qwen') || name.includes('mistral'),
      streaming: true, // Ollama supports streaming
      largeContext: name.includes('32k') || name.includes('128k') || name.includes('1m'),
      reasoning: name.includes('qwq') || name.includes('o1') || name.includes('reasoning')
    };
  }

  /**
   * Estimate model performance
   */
  private estimateModelPerformance(ollamaModel: OllamaModel): ModelPerformance {
    const sizeGB = ollamaModel.size / (1024 * 1024 * 1024);
    const name = ollamaModel.name.toLowerCase();
    
    // Determine quality based on model size and name
    let quality: 'high' | 'medium' | 'low' = 'medium';
    if (sizeGB > 30 || name.includes('70b') || name.includes('72b')) {
      quality = 'high';
    } else if (sizeGB < 5 || name.includes('1b') || name.includes('3b')) {
      quality = 'low';
    }

    // Determine speed based on size (larger = slower)
    let speed: 'fast' | 'medium' | 'slow' = 'medium';
    if (sizeGB > 20) {
      speed = 'slow';
    } else if (sizeGB < 8) {
      speed = 'fast';
    }

    // Memory usage estimation
    let memoryUsage: 'low' | 'medium' | 'high' = 'medium';
    if (sizeGB > 30) {
      memoryUsage = 'high';
    } else if (sizeGB < 8) {
      memoryUsage = 'low';
    }

    return {
      speed,
      quality,
      memoryUsage,
      diskSpace: Math.round(sizeGB * 1024) // Convert to MB
    };
  }

  /**
   * Get context window size for known models
   */
  private getContextWindow(modelName: string): number {
    const name = modelName.toLowerCase();
    
    if (name.includes('32k')) return 32768;
    if (name.includes('128k')) return 131072;
    if (name.includes('1m')) return 1000000;
    if (name.includes('qwq')) return 32768;
    if (name.includes('llama3')) return 8192;
    if (name.includes('mistral')) return 32768;
    if (name.includes('codestral')) return 32768;
    
    return 4096; // Default context window
  }

  /**
   * Add an API model configuration
   */
  async addApiModel(config: {
    name: string;
    provider: 'openai' | 'anthropic' | 'google' | 'azure' | 'huggingface';
    apiKey: string;
    model: string;
    endpoint?: string;
  }): Promise<{
    success: boolean;
    modelId?: string;
    error?: string;
  }> {
    try {
      const id = `${config.provider}-${config.model.replace(/[^a-zA-Z0-9-]/g, '-')}`;
      
      const modelConfig: ModelConfig = {
        id,
        name: `${config.provider} - ${config.model}`,
        provider: config.provider,
        type: 'api',
        endpoint: config.endpoint || this.getDefaultEndpoint(config.provider),
        apiKey: config.apiKey,
        model: config.model,
        contextWindow: this.getApiModelContextWindow(config.provider, config.model),
        capabilities: this.getApiModelCapabilities(config.provider, config.model),
        status: 'unknown'
      };

      // Test the connection
      const isAvailable = await this.testModelConnection(modelConfig);
      modelConfig.status = isAvailable ? 'available' : 'unavailable';

      if (!isAvailable) {
        return {
          success: false,
          error: 'Failed to connect to API model. Please check your API key and configuration.'
        };
      }

      this.models.set(id, modelConfig);
      this.saveModels();

      logger.info('API model added successfully', { id, provider: config.provider, model: config.model });

      return {
        success: true,
        modelId: id
      };

    } catch (error) {
      const errorMsg = `Failed to add API model: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Get default endpoint for API providers
   */
  private getDefaultEndpoint(provider: string): string {
    switch (provider) {
      case 'openai':
        return 'https://api.openai.com/v1';
      case 'anthropic':
        return 'https://api.anthropic.com/v1';
      case 'google':
        return 'https://generativelanguage.googleapis.com/v1';
      case 'azure':
        return 'https://your-resource.openai.azure.com/';
      case 'huggingface':
        return 'https://api-inference.huggingface.co/models';
      default:
        return '';
    }
  }

  /**
   * Get context window for API models
   */
  private getApiModelContextWindow(provider: string, model: string): number {
    if (provider === 'anthropic') {
      if (model.includes('claude-3-5')) return 200000;
      if (model.includes('claude-3')) return 200000;
      return 100000;
    }
    
    if (provider === 'openai') {
      if (model.includes('gpt-4')) return 128000;
      if (model.includes('gpt-3.5')) return 16385;
      return 4096;
    }
    
    if (provider === 'google') {
      if (model.includes('gemini-1.5')) return 1000000;
      if (model.includes('gemini-pro')) return 32768;
      return 8192;
    }

    return 8192; // Default
  }

  /**
   * Get capabilities for API models
   */
  private getApiModelCapabilities(provider: string, model: string): ModelCapabilities {
    return {
      codeGeneration: true,
      codeAnalysis: true,
      multiLanguage: true,
      functionCalling: provider !== 'huggingface', // Most APIs support function calling
      streaming: true,
      largeContext: provider === 'anthropic' || provider === 'google',
      reasoning: provider === 'anthropic' || (provider === 'openai' && model.includes('o1'))
    };
  }

  /**
   * Test connection to a model
   */
  private async testModelConnection(model: ModelConfig): Promise<boolean> {
    try {
      if (model.type === 'local') {
        // Test Ollama model
        const response = await axios.post(`${model.endpoint}/api/generate`, {
          model: model.model,
          prompt: 'Hello',
          stream: false
        }, { timeout: 10000 });
        
        return response.status === 200;
      } else {
        // Test API model
        return await this.testApiModel(model);
      }
    } catch (error) {
      logger.warn(`Model connection test failed for ${model.id}`, { error });
      return false;
    }
  }

  /**
   * Test API model connection
   */
  private async testApiModel(model: ModelConfig): Promise<boolean> {
    try {
      switch (model.provider) {
        case 'anthropic':
          return await this.testAnthropicModel(model);
        case 'openai':
          return await this.testOpenAIModel(model);
        case 'google':
          return await this.testGoogleModel(model);
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Test Anthropic model
   */
  private async testAnthropicModel(model: ModelConfig): Promise<boolean> {
    const response = await axios.post(
      `${model.endpoint}/messages`,
      {
        model: model.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      },
      {
        headers: {
          'x-api-key': model.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        timeout: 10000
      }
    );
    
    return response.status === 200;
  }

  /**
   * Test OpenAI model
   */
  private async testOpenAIModel(model: ModelConfig): Promise<boolean> {
    const response = await axios.post(
      `${model.endpoint}/chat/completions`,
      {
        model: model.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      },
      {
        headers: {
          'Authorization': `Bearer ${model.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    return response.status === 200;
  }

  /**
   * Test Google model
   */
  private async testGoogleModel(model: ModelConfig): Promise<boolean> {
    const response = await axios.post(
      `${model.endpoint}/models/${model.model}:generateContent?key=${model.apiKey}`,
      {
        contents: [{ parts: [{ text: 'Hi' }] }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    return response.status === 200;
  }

  /**
   * Select the best model for a given task
   */
  selectBestModel(requirements: {
    taskType: 'code_generation' | 'code_analysis' | 'general' | 'reasoning';
    preferLocal?: boolean;
    minContextWindow?: number;
    maxLatency?: 'fast' | 'medium';
  }): ModelConfig | null {
    const availableModels = Array.from(this.models.values())
      .filter(model => model.status === 'available');

    if (availableModels.length === 0) {
      return null;
    }

    // Filter by requirements
    let candidates = availableModels.filter(model => {
      // Check context window
      if (requirements.minContextWindow && model.contextWindow && model.contextWindow < requirements.minContextWindow) {
        return false;
      }

      // Check task capabilities
      switch (requirements.taskType) {
        case 'code_generation':
          return model.capabilities.codeGeneration;
        case 'code_analysis':
          return model.capabilities.codeAnalysis;
        case 'reasoning':
          return model.capabilities.reasoning;
        default:
          return true;
      }
    });

    if (candidates.length === 0) {
      candidates = availableModels; // Fallback to any available model
    }

    // Prefer local models if requested
    if (requirements.preferLocal) {
      const localCandidates = candidates.filter(m => m.type === 'local');
      if (localCandidates.length > 0) {
        candidates = localCandidates;
      }
    }

    // Filter by performance requirements
    if (requirements.maxLatency) {
      candidates = candidates.filter(model => {
        if (!model.performance) return true;
        
        if (requirements.maxLatency === 'fast') {
          return model.performance.speed === 'fast';
        }
        return model.performance.speed !== 'slow';
      });
    }

    // Sort by quality and preference (local first if not specifically requested otherwise)
    candidates.sort((a, b) => {
      // Prefer local models for development tasks
      if (a.type === 'local' && b.type === 'api') return -1;
      if (a.type === 'api' && b.type === 'local') return 1;
      
      // Then by quality
      if (a.performance && b.performance) {
        const qualityOrder = { high: 3, medium: 2, low: 1 };
        return qualityOrder[b.performance.quality] - qualityOrder[a.performance.quality];
      }
      
      return 0;
    });

    return candidates[0] || null;
  }

  /**
   * Set active model
   */
  setActiveModel(modelId: string): boolean {
    const model = this.models.get(modelId);
    if (model && model.status === 'available') {
      this.activeModel = model;
      this.saveModels();
      logger.info('Active model set', { modelId, modelName: model.name });
      return true;
    }
    return false;
  }

  /**
   * Get active model
   */
  getActiveModel(): ModelConfig | null {
    return this.activeModel;
  }

  /**
   * List all models
   */
  listModels(): ModelConfig[] {
    return Array.from(this.models.values());
  }

  /**
   * Remove a model
   */
  removeModel(modelId: string): boolean {
    if (this.models.has(modelId)) {
      this.models.delete(modelId);
      if (this.activeModel?.id === modelId) {
        this.activeModel = null;
      }
      this.saveModels();
      return true;
    }
    return false;
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): ModelConfig | null {
    return this.models.get(modelId) || null;
  }

  /**
   * Load saved models from config
   */
  private loadSavedModels(): void {
    try {
      if (existsSync(this.configPath)) {
        const data = JSON.parse(readFileSync(this.configPath, 'utf-8'));
        
        if (data.models) {
          for (const model of data.models) {
            this.models.set(model.id, model);
          }
        }
        
        if (data.activeModelId) {
          this.activeModel = this.models.get(data.activeModelId) || null;
        }
        
        logger.info('Loaded saved models', { count: this.models.size });
      }
    } catch (error) {
      logger.warn('Failed to load saved models', { error });
    }
  }

  /**
   * Save models to config
   */
  private saveModels(): void {
    try {
      const data = {
        models: Array.from(this.models.values()),
        activeModelId: this.activeModel?.id || null,
        lastUpdated: new Date().toISOString()
      };
      
      writeFileSync(this.configPath, JSON.stringify(data, null, 2));
      logger.debug('Models saved to config');
    } catch (error) {
      logger.error('Failed to save models', { error });
    }
  }

  /**
   * Get model statistics
   */
  getModelStatistics(): {
    total: number;
    available: number;
    local: number;
    api: number;
    providers: Record<string, number>;
  } {
    const models = Array.from(this.models.values());
    
    return {
      total: models.length,
      available: models.filter(m => m.status === 'available').length,
      local: models.filter(m => m.type === 'local').length,
      api: models.filter(m => m.type === 'api').length,
      providers: models.reduce((acc, model) => {
        acc[model.provider] = (acc[model.provider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  /**
   * Auto-select best model if none is active
   */
  autoSelectModel(): ModelConfig | null {
    if (this.activeModel && this.activeModel.status === 'available') {
      return this.activeModel;
    }

    // Try to find the best general-purpose model
    const bestModel = this.selectBestModel({
      taskType: 'general',
      preferLocal: true // Prefer local models for privacy and speed
    });

    if (bestModel) {
      this.setActiveModel(bestModel.id);
      logger.info('Auto-selected model', { modelId: bestModel.id, modelName: bestModel.name });
    }

    return bestModel;
  }

  /**
   * Check for model updates (for Ollama models)
   */
  async checkForUpdates(): Promise<{
    hasUpdates: boolean;
    updates: Array<{ modelId: string; currentVersion: string; latestVersion: string }>;
  }> {
    const updates: Array<{ modelId: string; currentVersion: string; latestVersion: string }> = [];
    
    try {
      // This is a placeholder for future Ollama update checking functionality
      // Currently Ollama doesn't provide version comparison APIs
      
      return {
        hasUpdates: updates.length > 0,
        updates
      };
    } catch (error) {
      logger.warn('Failed to check for model updates', { error });
      return {
        hasUpdates: false,
        updates: []
      };
    }
  }
}