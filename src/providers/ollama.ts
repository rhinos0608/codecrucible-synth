import { Ollama } from 'ollama';
import { logger } from '../core/logger.js';
import { readFileSync, existsSync } from 'fs';
import { load as loadYaml } from 'js-yaml';
import { join } from 'path';
import { getErrorMessage } from '../utils/error-utils.js';
import { responseCache } from '../infrastructure/performance/response-cache-manager.js';
import { modelPreloader } from '../infrastructure/performance/model-preloader.js';

export interface OllamaConfig {
  endpoint?: string;
  model?: string;
  timeout?: number;
  timeouts?: {
    connection: number;
    coldStart: number;
    generation: number;
    healthCheck: number;
  };
}

export class OllamaProvider {
  private client: Ollama;
  private config: OllamaConfig;
  private model: string;
  private isAvailable: boolean = false;

  constructor(config: OllamaConfig) {
    logger.debug('OllamaProvider constructor called', { config });

    this.config = {
      endpoint: config.endpoint || 'http://localhost:11434',
      model: config.model, // Will be set by autonomous detection
      timeout: config.timeout || 110000, // 110s - legacy timeout for backwards compatibility
      timeouts: config.timeouts || {
        connection: 5000,      // 5s for connection establishment
        coldStart: 60000,      // 60s for cold model loading with function calling
        generation: 120000,    // 2 minutes for complex generation
        healthCheck: 3000      // 3s for quick health checks
      }
    };

    this.model = this.config.model || 'auto-detect'; // Mark for autonomous detection
    logger.debug('OllamaProvider model state', { model: this.model });

    // Initialize official Ollama client
    this.client = new Ollama({
      host: this.config.endpoint || 'http://localhost:11434'
    });

    logger.debug('OllamaProvider initialized successfully', {
      endpoint: this.config.endpoint,
      model: this.model
    });
  }

  async isServiceAvailable(): Promise<boolean> {
    try {
      logger.debug('OllamaProvider checking service availability');
      
      // Use official Ollama client to check availability
      const models = await this.client.list();
      this.isAvailable = models.models.length > 0;
      
      logger.info('OllamaProvider availability check result', {
        available: this.isAvailable,
        modelCount: models.models.length
      });

      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      logger.warn('OllamaProvider service availability check failed', {
        error: getErrorMessage(error),
        endpoint: this.config.endpoint
      });
      return false;
    }
  }

  async generateText(prompt: string, options: any = {}): Promise<string> {
    try {
      logger.debug('OllamaProvider generateText called', {
        promptLength: prompt.length,
        model: this.model,
        hasOptions: Object.keys(options).length > 0
      });

      // Determine model to use
      const modelToUse = this.model === 'auto-detect' ? await this.detectBestModel() : this.model;
      
      if (!modelToUse) {
        throw new Error('No model available for text generation');
      }

      // Use official Ollama client for generation
      const response = await this.client.generate({
        model: modelToUse,
        prompt: prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          num_ctx: options.num_ctx || 4096,
          ...options
        }
      });

      logger.info('OllamaProvider generateText completed', {
        model: modelToUse,
        responseLength: response.response.length,
        promptTokens: response.prompt_eval_count,
        responseTokens: response.eval_count,
        totalDuration: response.total_duration
      });

      return response.response;
    } catch (error) {
      logger.error('OllamaProvider generateText failed', {
        error: getErrorMessage(error),
        model: this.model,
        endpoint: this.config.endpoint
      });
      throw error;
    }
  }

  async generateTextStreaming(prompt: string, options: any = {}): Promise<AsyncIterable<string>> {
    try {
      logger.debug('OllamaProvider generateTextStreaming called', {
        promptLength: prompt.length,
        model: this.model
      });

      const modelToUse = this.model === 'auto-detect' ? await this.detectBestModel() : this.model;
      
      if (!modelToUse) {
        throw new Error('No model available for streaming generation');
      }

      // Use official Ollama client streaming
      const stream = await this.client.generate({
        model: modelToUse,
        prompt: prompt,
        stream: true,
        options: {
          temperature: options.temperature || 0.7,
          num_ctx: options.num_ctx || 4096,
          ...options
        }
      });

      return (async function* () {
        for await (const chunk of stream) {
          if (chunk.response) {
            yield chunk.response;
          }
        }
      })();
    } catch (error) {
      logger.error('OllamaProvider generateTextStreaming failed', {
        error: getErrorMessage(error),
        model: this.model
      });
      throw error;
    }
  }

  async chat(messages: any[], options: any = {}): Promise<string> {
    try {
      logger.debug('OllamaProvider chat called', {
        messageCount: messages.length,
        model: this.model
      });

      const modelToUse = this.model === 'auto-detect' ? await this.detectBestModel() : this.model;
      
      if (!modelToUse) {
        throw new Error('No model available for chat');
      }

      const response = await this.client.chat({
        model: modelToUse,
        messages: messages,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          num_ctx: options.num_ctx || 4096,
          ...options
        }
      });

      logger.info('OllamaProvider chat completed', {
        model: modelToUse,
        responseLength: response.message.content.length
      });

      return response.message.content;
    } catch (error) {
      logger.error('OllamaProvider chat failed', {
        error: getErrorMessage(error),
        model: this.model
      });
      throw error;
    }
  }

  private async detectBestModel(): Promise<string> {
    try {
      const models = await this.client.list();
      
      if (models.models.length === 0) {
        throw new Error('No models available');
      }

      // Prefer coding models for CodeCrucible
      const codingModels = models.models.filter(m => 
        m.name.toLowerCase().includes('coder') || 
        m.name.toLowerCase().includes('code')
      );

      if (codingModels.length > 0) {
        return codingModels[0].name;
      }

      // Fallback to first available model
      return models.models[0].name;
    } catch (error) {
      logger.error('OllamaProvider model detection failed', {
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const models = await this.client.list();
      return models.models.length > 0;
    } catch (error) {
      logger.debug('OllamaProvider health check failed', {
        error: getErrorMessage(error)
      });
      return false;
    }
  }

  getConfig(): OllamaConfig {
    return { ...this.config };
  }

  getModel(): string {
    return this.model;
  }

  setModel(model: string): void {
    this.model = model;
    logger.debug('OllamaProvider model updated', { model: this.model });
  }

  // Legacy compatibility methods
  async processRequest(request: any): Promise<any> {
    logger.debug('OllamaProvider processRequest called (legacy compatibility)');
    
    if (request.messages) {
      return this.chat(request.messages, request.options || {});
    } else if (request.prompt) {
      return this.generateText(request.prompt, request.options || {});
    } else {
      throw new Error('Invalid request format');
    }
  }

  async checkStatus(): Promise<boolean> {
    return this.healthCheck();
  }
}