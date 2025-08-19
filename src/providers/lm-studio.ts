
import axios, { AxiosInstance } from 'axios';
import { logger } from '../core/logger.js';

export interface LMStudioConfig {
  endpoint?: string;
  model?: string;
  timeout?: number;
  apiKey?: string;
}

export class LMStudioProvider {
  private httpClient: AxiosInstance;
  private config: LMStudioConfig;
  private model: string;
  private isAvailable: boolean = false;

  constructor(config: LMStudioConfig) {
    this.config = {
      endpoint: config.endpoint || 'http://localhost:1234',
      model: config.model || 'auto',
      timeout: config.timeout || 30000
    };
    
    this.model = this.config.model;
    
    this.httpClient = axios.create({
      baseURL: this.config.endpoint,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
      }
    });
  }
  
  async processRequest(request: Record<string, unknown>, _context?: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Check status first
    if (!this.isAvailable) {
      const available = await this.checkStatus();
      if (!available) {
        throw new Error('LM Studio service is not available');
      }
    }
    
    return this.generate(request);
  }
  
  async generate(request: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      // Get available models first if model is 'auto'
      if (this.model === 'auto') {
        await this.selectOptimalModel();
      }
      
      const response = await this.httpClient.post('/v1/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: request.prompt || request.text || request.content
          }
        ],
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || request.max_tokens || 2048,
        stream: false
      });
      
      const choice = response.data.choices?.[0];
      if (!choice) {
        throw new Error('No response choices returned from LM Studio');
      }
      
      return {
        content: choice.message?.content || choice.text || '',
        model: this.model,
        provider: 'lm-studio',
        metadata: {
          tokens: response.data.usage?.total_tokens || 0,
          latency: Date.now(), // Will be calculated by caller
          quality: 0.85 // LM Studio generally provides good quality
        },
        usage: {
          totalTokens: response.data.usage?.total_tokens || 0,
          promptTokens: response.data.usage?.prompt_tokens || 0,
          completionTokens: response.data.usage?.completion_tokens || 0
        },
        finished: choice.finish_reason === 'stop'
      };
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ECONNREFUSED') {
        this.isAvailable = false;
        throw new Error('LM Studio server is not running. Please start LM Studio and enable the local server.');
      }
      logger.error('LM Studio generation failed:', error.message);
      throw new Error(`LM Studio generation failed: ${error.message}`);
    }
  }
  
  async checkStatus(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/v1/models', { timeout: 5000 });
      this.isAvailable = response.status === 200;
      
      if (this.isAvailable && response.data.data) {
        const models = response.data.data.map((m: Record<string, unknown>) => m.id);
        logger.info(`LM Studio available with ${models.length} models:`, models.slice(0, 3));
        
        // Auto-select first available model if not specified
        if (this.model === 'auto' && models.length > 0) {
          this.model = models[0];
          logger.info(`Auto-selected LM Studio model: ${this.model}`);
        }
      }
      
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      if (error.code !== 'ECONNREFUSED') {
        logger.warn('LM Studio status check failed:', error.message);
      }
      return false;
    }
  }
  
  async listModels(): Promise<string[]> {
    try {
      const response = await this.httpClient.get('/v1/models');
      if (response.data.data) {
        return response.data.data.map((m: Record<string, unknown>) => m.id);
      }
      return [];
    } catch (error) {
      logger.error('Failed to list LM Studio models:', error);
      return [];
    }
  }
  
  private async selectOptimalModel(): Promise<void> {
    try {
      const models = await this.listModels();
      if (models.length === 0) {
        throw new Error('No models available in LM Studio');
      }
      
      // Prefer fast, efficient models for LM Studio
      const preferredModels = [
        'tinyllama',
        'phi-2',
        'codellama-7b',
        'mistral-7b',
        'zephyr-7b'
      ];
      
      let selectedModel = models[0]; // fallback
      
      for (const preferred of preferredModels) {
        const match = models.find(m => m.toLowerCase().includes(preferred));
        if (match) {
          selectedModel = match;
          break;
        }
      }
      
      this.model = selectedModel;
      logger.info(`Selected optimal LM Studio model: ${this.model}`);
      
    } catch (error) {
      logger.warn('Could not select optimal model, using first available');
    }
  }
  
  async healthCheck(): Promise<boolean> {
    return this.checkStatus();
  }
  
  supportsModel(_modelName: string): boolean {
    // LM Studio supports any model loaded in it
    return true;
  }
  
  getModelName(): string {
    return this.model;
  }
}
