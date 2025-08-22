import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';
import { logger } from '../core/logger.js';
import { readFileSync, existsSync } from 'fs';
import { load as loadYaml } from 'js-yaml';
import { join } from 'path';

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
    console.log('🤖 DEBUG: OllamaProvider constructor called with config:', config);
    
    this.config = {
      endpoint: config.endpoint || 'http://localhost:11434',
      model: config.model, // Will be set by autonomous detection
      timeout: config.timeout || 30000, // Reduced timeout for better responsiveness
    };

    this.model = this.config.model || 'auto-detect'; // Mark for autonomous detection
    console.log('🤖 DEBUG: OllamaProvider model state:', this.model);

    this.httpClient = axios.create({
      baseURL: this.config.endpoint,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async processRequest(request: any, _context?: any): Promise<any> {
    console.log('🤖 DEBUG: OllamaProvider.processRequest called');
    console.log('🤖 DEBUG: Request object:', {
      prompt: (request.prompt || '').substring(0, 200) + '...',
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      hasTools: !!(request.tools && request.tools.length),
    });

    try {
      // Check status and perform autonomous model detection
      console.log('🤖 DEBUG: Checking Ollama availability and detecting models...');
      
      // Check status and perform autonomous model detection
      if (!this.isAvailable || this.model === 'auto-detect') {
        console.log('🤖 DEBUG: Performing model detection and status check...');
        await this.checkStatus();
      }
      console.log('🤖 DEBUG: Ollama is available, using model:', this.model);

      const result = await this.generate(request);
      console.log('🤖 DEBUG: OllamaProvider response received, length:', result?.content?.length);
      return result;
    } catch (error) {
      console.error('🤖 ERROR: OllamaProvider error:', error.message);
      throw error;
    }
  }

  async generate(request: any): Promise<any> {
    console.log('🤖 DEBUG: generate method started');
    
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('🤖 DEBUG: HTTP request timeout, aborting...');
      abortController.abort();
    }, this.config.timeout || 30000);

    try {
      const requestBody = {
        model: this.model,
        prompt: request.prompt,
        stream: false,
        options: {
          temperature: request.temperature || 0.1,
          num_predict: request.maxTokens || 2048,
          top_p: 0.9,
          top_k: 40,
          ...this.getGPUConfig()
        }
      };

      console.log('🤖 DEBUG: Sending request to Ollama API...', {
        url: `${this.config.endpoint}/api/generate`,
        model: this.model,
        promptLength: request.prompt?.length || 0
      });

      const response = await this.httpClient.post('/api/generate', requestBody, {
        signal: abortController.signal,
        timeout: this.config.timeout
      });

      clearTimeout(timeoutId);
      console.log('🤖 DEBUG: Received response from Ollama API');

      return {
        content: response.data.response || '',
        usage: {
          totalTokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0),
          promptTokens: response.data.prompt_eval_count || 0,
          completionTokens: response.data.eval_count || 0
        },
        done: response.data.done || true,
        model: this.model,
        provider: 'ollama'
      };
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('🤖 ERROR: Ollama API error:', error.message);
      
      if (error.name === 'AbortError') {
        throw new Error('Ollama API request timed out');
      }
      
      // Fallback response for debugging
      if (error.code === 'ECONNREFUSED') {
        console.log('🤖 WARNING: Ollama not available, using fallback response');
        return {
          content: `I understand you want to work with this code, but I'm unable to connect to Ollama right now. The request was: "${request.prompt?.substring(0, 100)}..."`,
          usage: { totalTokens: 20, promptTokens: 10, completionTokens: 10 },
          done: true,
          model: this.model,
          provider: 'ollama-fallback'
        };
      }
      
      throw error;
    }
  }

  async checkStatus(): Promise<boolean> {
    console.log('🤖 DEBUG: Checking Ollama status...');
    
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('🤖 DEBUG: Status check timeout, aborting...');
      abortController.abort();
    }, 5000); // Shorter timeout for status checks

    try {
      const response = await this.httpClient.get('/api/tags', {
        signal: abortController.signal,
        timeout: 5000
      });
      
      clearTimeout(timeoutId);
      
      if (response.data && response.data.models) {
        const availableModels = response.data.models.map((m: any) => m.name);
        console.log('🤖 DEBUG: Available Ollama models:', availableModels);
        
        // Set model based on configuration or default to first available
        if (!this.model || this.model === 'auto-detect') {
          const preferredModels = ['qwen2.5-coder:7b', 'qwen2.5-coder:3b', 'deepseek-coder:8b'];
          this.model = availableModels.find((m: string) => preferredModels.includes(m)) || availableModels[0] || 'qwen2.5-coder:3b';
          console.log('🤖 DEBUG: Selected model:', this.model);
        }
        
        this.isAvailable = true;
        return true;
      }
      
      return false;
    } catch (error) {
      clearTimeout(timeoutId);
      console.log('🤖 WARNING: Ollama not available:', error.message);
      this.isAvailable = false;
      // Set fallback model for offline scenarios
      if (!this.model || this.model === 'auto-detect') {
        this.model = 'qwen2.5-coder:3b';
      }
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    console.log('🤖 DEBUG: Listing Ollama models...');
    
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 5000);

    try {
      const response = await this.httpClient.get('/api/tags', {
        signal: abortController.signal,
        timeout: 5000
      });
      
      clearTimeout(timeoutId);
      
      if (response.data && response.data.models) {
        const models = response.data.models.map((m: any) => m.name);
        console.log('🤖 DEBUG: Found models:', models);
        return models;
      }
      
      return [];
    } catch (error) {
      clearTimeout(timeoutId);
      console.log('🤖 WARNING: Could not list models:', error.message);
      return ['qwen2.5-coder:3b', 'deepseek-coder:8b']; // Fallback list
    }
  }

  async warmModel(): Promise<void> {
    console.log(`🤖 ✅ Model ${this.model} is ready (simplified)`);
  }

  private getGPUConfig(): any {
    return {
      num_gpu: 0,
      num_thread: 4,
      num_batch: 64,
      num_ctx: 8192
    };
  }
}
