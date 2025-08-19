
import axios, { AxiosInstance } from 'axios';
import { logger } from '../core/logger.js';

export interface OllamaConfig {
  endpoint?: string;
  model?: string;
  timeout?: number;
}

export class OllamaProvider {
  private httpClient: AxiosInstance;
  private config: OllamaConfig;
  private model: string;
  private isAvailable: boolean = false;

  constructor(config: OllamaConfig) {
    this.config = {
      endpoint: config.endpoint || 'http://localhost:11434',
      model: config.model || 'gemma:latest', // Default to gemma which works on most systems
      timeout: config.timeout || 180000  // Default to 3 minutes
    };
    
    this.model = this.config.model;
    
    this.httpClient = axios.create({
      baseURL: this.config.endpoint,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  async processRequest(request: any, context?: any): Promise<any> {
    // Check status first
    if (!this.isAvailable) {
      const available = await this.checkStatus();
      if (!available) {
        throw new Error('Ollama service is not available');
      }
    }
    
    return this.generate(request);
  }
  
  async generate(request: any): Promise<any> {
    try {
      // Get GPU configuration from config if available
      const gpuConfig = this.getGPUConfig();
      
      const response = await this.httpClient.post('/api/generate', {
        model: this.model,
        prompt: request.prompt || request.text || request.content,
        stream: false,
        options: {
          temperature: request.temperature || 0.7,
          top_p: request.top_p || 0.9,
          num_predict: request.maxTokens || request.max_tokens || 2048,
          num_ctx: gpuConfig.num_ctx || 4096,
          num_gpu: gpuConfig.num_gpu || 10,
          num_thread: gpuConfig.num_thread || 4,
          num_batch: gpuConfig.num_batch || 256
          // Removed invalid options: max_tokens, numa, mmap
        }
      });
      
      return {
        content: response.data.response,
        model: this.model,
        provider: 'ollama',
        metadata: {
          tokens: response.data.eval_count || 0,
          latency: response.data.total_duration ? Math.round(response.data.total_duration / 1000000) : 0,
          quality: 0.8
        },
        usage: {
          totalTokens: response.data.eval_count || 0,
          promptTokens: response.data.prompt_eval_count || 0,
          completionTokens: response.data.eval_count || 0
        },
        done: response.data.done,
        total_duration: response.data.total_duration,
        load_duration: response.data.load_duration,
        prompt_eval_duration: response.data.prompt_eval_duration,
        eval_duration: response.data.eval_duration
      };
    } catch (error: any) {
      logger.error('Ollama generation failed:', error.message);
      throw new Error(`Ollama generation failed: ${error.message}`);
    }
  }
  
  async checkStatus(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/api/tags', { timeout: 5000 });
      this.isAvailable = response.status === 200;
      
      if (this.isAvailable && response.data.models) {
        const models = response.data.models.map((m: any) => m.name);
        
        // Check if our configured model exists
        if (!models.includes(this.model)) {
          // Try to find a suitable model - prefer smaller ones for better performance
          const preferredModels = ['gemma:latest', 'mistral:7b', 'llama2:7b', 'codellama:7b', 'gemma3n:e4b'];
          
          let modelFound = false;
          for (const preferred of preferredModels) {
            if (models.includes(preferred)) {
              this.model = preferred;
              logger.info(`Using available model: ${this.model}`);
              modelFound = true;
              break;
            }
          }
          
          if (!modelFound) {
            // Fallback to any available model
            if (models.length > 0) {
              // Prefer models without large sizes in the name
              const smallModels = models.filter((m: string) => !m.includes('34b') && !m.includes('70b'));
              this.model = smallModels.length > 0 ? smallModels[0] : models[0];
              logger.info(`Using available model: ${this.model}`);
            } else {
              this.isAvailable = false;
              logger.warn('No models available in Ollama');
            }
          }
        }
      }
      
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      return false;
    }
  }
  
  async listModels(): Promise<string[]> {
    try {
      const response = await this.httpClient.get('/api/tags');
      if (response.data.models) {
        return response.data.models.map((m: any) => m.name);
      }
      return [];
    } catch (error) {
      logger.error('Failed to list Ollama models:', error);
      return [];
    }
  }
  
  /**
   * Get GPU configuration for optimal performance
   */
  private getGPUConfig(): Record<string, any> {
    try {
      // Try to read configuration from config manager
      const config = this.loadConfigFromFile();
      
      if (config?.model?.gpu?.enabled) {
        const gpuConfig: Record<string, any> = {};
        
        // GPU layers
        if (config.model.gpu.layers !== undefined) {
          gpuConfig.num_gpu = config.model.gpu.layers;
        }
        
        // CPU threads for non-GPU operations
        if (config.model.gpu.threads) {
          gpuConfig.num_thread = config.model.gpu.threads;
        }
        
        // Batch size for GPU processing
        if (config.model.gpu.batch_size) {
          gpuConfig.num_batch = config.model.gpu.batch_size;
        }
        
        // Context length
        if (config.model.gpu.context_length) {
          gpuConfig.num_ctx = config.model.gpu.context_length;
        }
        
        // Removed invalid options: numa, mmap
        
        logger.info('🎮 GPU optimization enabled', gpuConfig);
        return gpuConfig;
      }
    } catch (error) {
      logger.warn('Could not load GPU config, using defaults:', error instanceof Error ? error.message : String(error));
    }
    
    // Conservative GPU configuration for stability
    return {
      num_gpu: 10,        // Conservative GPU layers
      num_thread: 4,      // CPU threads
      num_batch: 256,     // Conservative batch size
      num_ctx: 4096       // Conservative context length
      // Removed invalid options: numa, mmap
    };
  }
  
  /**
   * Load configuration from file
   */
  private loadConfigFromFile(): any {
    try {
      const fs = require('fs');
      const yaml = require('js-yaml');
      const path = require('path');
      
      const configPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.codecrucible', 'config.yaml');
      
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        return yaml.load(configContent);
      }
    } catch (error) {
      // Silently fail and use defaults
    }
    
    return null;
  }
}
