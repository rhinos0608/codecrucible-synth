import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';
import { logger } from '../core/logger.js';
import { readFileSync, existsSync } from 'fs';
import { load as loadYaml } from 'js-yaml';
import { join } from 'path';
import { getErrorMessage } from '../utils/error-utils.js';
import { responseCache } from '../core/performance/response-cache-manager.js';
import { modelPreloader } from '../core/performance/model-preloader.js';

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
    logger.debug('OllamaProvider constructor called', { config });

    this.config = {
      endpoint: config.endpoint || 'http://localhost:11434',
      model: config.model, // Will be set by autonomous detection
      timeout: config.timeout || 30000, // Reduced timeout for better responsiveness
    };

    this.model = this.config.model || 'auto-detect'; // Mark for autonomous detection
    logger.debug('OllamaProvider model state', { model: this.model });

    // Create HTTP agents with connection pooling for performance optimization
    const httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: 10, // Max concurrent connections
      maxFreeSockets: 5, // Keep 5 idle connections
      timeout: 5000, // Socket timeout
    });

    const httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 5000,
    });

    this.httpClient = axios.create({
      baseURL: this.config.endpoint,
      timeout: this.config.timeout,
      httpAgent, // Connection pooling for HTTP
      httpsAgent, // Connection pooling for HTTPS
      headers: {
        'Content-Type': 'application/json',
        Connection: 'keep-alive', // Explicitly request keep-alive
      },
    });

    logger.debug('Ollama HTTP connection pooling configured', { maxSockets: 10, keepAlive: '30s' });
  }

  async processRequest(request: any, _context?: any): Promise<any> {
    logger.debug('OllamaProvider.processRequest called');
    logger.debug('OllamaProvider request object', {
      prompt: `${(request.prompt || '').substring(0, 200)}...`,
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      hasTools: !!request.tools?.length,
    });

    try {
      // Check status and perform autonomous model detection
      logger.debug('Checking Ollama availability and detecting models');

      // Check status and perform autonomous model detection
      if (!this.isAvailable || this.model === 'auto-detect') {
        logger.debug('Performing model detection and status check');
        await this.checkStatus();
      }
      logger.debug('Ollama is available', { model: this.model });

      const result = await this.generate(request);
      logger.debug('OllamaProvider response received', { contentLength: result?.content?.length });
      return result;
    } catch (error: unknown) {
      logger.error('OllamaProvider error', error);
      throw error;
    }
  }

  async generate(request: any): Promise<any> {
    const startTime = Date.now();
    logger.debug('OllamaProvider generate method started');

    // Check cache first (skip for streaming and function calls with dynamic data)
    const shouldCache = !request.stream && (!request.tools || request.tools.length === 0);
    if (shouldCache) {
      const cachedResponse = responseCache.get(
        request.prompt,
        this.model,
        'ollama',
        request.tools
      );
      
      if (cachedResponse) {
        const responseTime = Date.now() - startTime;
        logger.debug('Using cached response', {
          hitCount: cachedResponse.metadata.hitCount,
          cacheAge: Date.now() - cachedResponse.metadata.timestamp,
          responseTime
        });
        
        // Record cache hit as successful usage
        modelPreloader.recordModelUsage(this.model, 'ollama', responseTime, true);
        
        return {
          content: cachedResponse.response.content,
          finishReason: cachedResponse.response.finishReason || 'cached',
          usage: cachedResponse.response.usage,
          fromCache: true
        };
      }
    }

    // Check if model is warmed up
    const isWarmed = modelPreloader.isModelWarmed(this.model, 'ollama');
    if (isWarmed) {
      logger.debug(`Using pre-warmed model: ${this.model}`);
    }

    // Use external AbortSignal if provided, otherwise create our own
    const externalAbortSignal = request.abortSignal;
    const abortController = externalAbortSignal ? undefined : new AbortController();
    const effectiveAbortSignal = externalAbortSignal || abortController?.signal;

    let timeoutId: NodeJS.Timeout | undefined;
    if (!externalAbortSignal && abortController) {
      timeoutId = setTimeout(() => {
        logger.debug('Ollama request timeout, aborting');
        abortController.abort();
      }, this.config.timeout || 30000);
    }

    try {
      const hasTools = request.tools && request.tools.length > 0;
      const endpoint = hasTools ? '/api/chat' : '/api/generate';
      
      let requestBody: any;
      
      if (hasTools) {
        // Use chat format for function calling (required for tools)
        requestBody = {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: request.prompt
            }
          ],
          tools: request.tools,
          stream: false,
          options: {
            temperature: request.temperature || 0.1,
            num_predict: request.maxTokens || 2048,
            top_p: 0.9,
            top_k: 40,
            ...this.getGPUConfig(),
          }
        };
        
        logger.debug('Sending function-calling request to Ollama API', {
          url: `${this.config.endpoint}${endpoint}`,
          model: this.model,
          toolCount: request.tools.length,
          messageContent: request.prompt?.substring(0, 100) + '...',
        });
      } else {
        // Use generate format for regular text
        requestBody = {
          model: this.model,
          prompt: request.prompt,
          stream: false,
          options: {
            temperature: request.temperature || 0.1,
            num_predict: request.maxTokens || 2048,
            top_p: 0.9,
            top_k: 40,
            ...this.getGPUConfig(),
          },
        };
        
        logger.debug('Sending regular request to Ollama API', {
          url: `${this.config.endpoint}${endpoint}`,
          model: this.model,
          promptLength: request.prompt?.length || 0,
        });
      }

      const response = await this.httpClient.post(endpoint, requestBody, {
        signal: effectiveAbortSignal,
        timeout: this.config.timeout,
      });

      if (timeoutId) clearTimeout(timeoutId);
      logger.debug('Received response from Ollama API');

      const responseData = response.data;

      // Handle chat response format (with tools)
      if (responseData.message) {
        const message = responseData.message;
        
        if (message.tool_calls && message.tool_calls.length > 0) {
          logger.debug('Ollama tool calls detected (chat format)', {
            toolCallCount: message.tool_calls.length,
            toolNames: message.tool_calls.map((call: any) => call.function?.name),
            messageContent: message.content?.substring(0, 100) + '...'
          });
          
          return {
            content: message.content || '',
            toolCalls: message.tool_calls.map((call: any) => ({
              name: call.function?.name,
              function: call.function,
              arguments: typeof call.function?.arguments === 'string' 
                ? JSON.parse(call.function.arguments)
                : call.function?.arguments
            })),
            usage: {
              totalTokens: (responseData.prompt_eval_count || 0) + (responseData.eval_count || 0),
              promptTokens: responseData.prompt_eval_count || 0,
              completionTokens: responseData.eval_count || 0,
            },
            done: responseData.done || true,
            model: this.model,
            provider: 'ollama',
          };
        }
        
        // Regular chat response without tools
        const chatResponse = {
          content: message.content || '',
          usage: {
            totalTokens: (responseData.prompt_eval_count || 0) + (responseData.eval_count || 0),
            promptTokens: responseData.prompt_eval_count || 0,
            completionTokens: responseData.eval_count || 0,
          },
          done: responseData.done || true,
          model: this.model,
          provider: 'ollama',
        };
        
        // Store in cache if caching is enabled
        if (shouldCache && chatResponse.content) {
          responseCache.set(
            request.prompt,
            this.model,
            'ollama',
            {
              content: chatResponse.content,
              usage: chatResponse.usage,
              finishReason: 'stop'
            },
            request.tools
          );
        }
        
        // Record performance metrics
        const responseTime = Date.now() - startTime;
        modelPreloader.recordModelUsage(this.model, 'ollama', responseTime, true);
        
        return chatResponse;
      }

      // Handle generate response format (no tools) - LEGACY FORMAT
      if (responseData.tool_calls && responseData.tool_calls.length > 0) {
        logger.debug('Ollama tool calls detected (generate format)', {
          toolCallCount: responseData.tool_calls.length,
          toolNames: responseData.tool_calls.map((call: any) => call.function?.name)
        });
        
        return {
          content: responseData.response || '',
          toolCalls: responseData.tool_calls.map((call: any) => ({
            name: call.function?.name,
            function: call.function,
            arguments: call.function?.arguments
          })),
          usage: {
            totalTokens: (responseData.prompt_eval_count || 0) + (responseData.eval_count || 0),
            promptTokens: responseData.prompt_eval_count || 0,
            completionTokens: responseData.eval_count || 0,
          },
          done: responseData.done || true,
          model: this.model,
          provider: 'ollama',
        };
      }

      // Regular generate response without tools
      const finalResponse = {
        content: responseData.response || '',
        usage: {
          totalTokens: (responseData.prompt_eval_count || 0) + (responseData.eval_count || 0),
          promptTokens: responseData.prompt_eval_count || 0,
          completionTokens: responseData.eval_count || 0,
        },
        done: responseData.done || true,
        model: this.model,
        provider: 'ollama',
      };
      
      // Store in cache if caching is enabled
      if (shouldCache && finalResponse.content) {
        responseCache.set(
          request.prompt,
          this.model,
          'ollama',
          {
            content: finalResponse.content,
            usage: finalResponse.usage,
            finishReason: 'stop'
          },
          request.tools
        );
      }
      
      // Record performance metrics
      const responseTime = Date.now() - startTime;
      modelPreloader.recordModelUsage(this.model, 'ollama', responseTime, true);
      
      return finalResponse;
    } catch (error: unknown) {
      if (timeoutId) clearTimeout(timeoutId);
      logger.error('Ollama API error', error);
      
      // Record failed request metrics
      const responseTime = Date.now() - startTime;
      modelPreloader.recordModelUsage(this.model, 'ollama', responseTime, false);

      if ((error as any)?.name === 'AbortError') {
        throw new Error('Ollama API request timed out');
      }

      // Fallback response for debugging
      if ((error as any)?.code === 'ECONNREFUSED') {
        logger.warn('Ollama not available, using fallback response');
        return {
          content: `I understand you want to work with this code, but I'm unable to connect to Ollama right now. The request was: "${request.prompt?.substring(0, 100)}..."`,
          usage: { totalTokens: 20, promptTokens: 10, completionTokens: 10 },
          done: true,
          model: this.model,
          provider: 'ollama-fallback',
        };
      }

      throw error;
    }
  }

  async checkStatus(): Promise<boolean> {
    logger.debug('Checking Ollama status');

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      logger.debug('Status check timeout, aborting');
      abortController.abort();
    }, 5000); // Shorter timeout for status checks

    try {
      const response = await this.httpClient.get('/api/tags', {
        signal: abortController.signal,
        timeout: 5000,
      });

      clearTimeout(timeoutId);

      if (response.data?.models) {
        const availableModels = response.data.models.map((m: any) => m.name);
        logger.debug('Available Ollama models', { availableModels });

        // Set model based on configuration or auto-detect capabilities
        if (!this.model || this.model === 'auto-detect') {
          this.model = await this.selectOptimalModel(availableModels);
          logger.debug('Selected model', { model: this.model });
        }

        this.isAvailable = true;
        return true;
      }

      return false;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      logger.warn('Ollama not available', error);
      this.isAvailable = false;
      // Set fallback model for offline scenarios
      if (!this.model || this.model === 'auto-detect') {
        this.model = 'auto-detect'; // Will be resolved when connection restored
      }
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    logger.debug('Listing Ollama models');

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 5000);

    try {
      const response = await this.httpClient.get('/api/tags', {
        signal: abortController.signal,
        timeout: 5000,
      });

      clearTimeout(timeoutId);

      if (response.data?.models) {
        const models = response.data.models.map((m: any) => m.name);
        logger.debug('Found models', { models });
        return models;
      }

      return [];
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      logger.warn('Could not list models', error);
      return []; // Return empty array to force re-detection
    }
  }

  /**
   * Dynamically select optimal model based on capabilities and requirements
   * Prioritizes function-calling capable models when tools are needed
   */
  private async selectOptimalModel(availableModels: string[]): Promise<string> {
    if (availableModels.length === 0) {
      logger.warn('No models available, using fallback');
      return 'auto-detect';
    }

    // Detect function-calling capabilities by model patterns and test if needed
    const functionCallingModels = this.detectFunctionCallingModels(availableModels);
    const codingModels = this.detectCodingModels(availableModels);
    const generalModels = this.detectGeneralPurposeModels(availableModels);

    // Prioritize function-calling models when tools are available
    if (functionCallingModels.length > 0) {
      const selected = functionCallingModels[0];
      logger.info(`🛠️ Selected function-calling capable model: ${selected}`);
      return selected;
    }

    // Fallback to coding models
    if (codingModels.length > 0) {
      const selected = codingModels[0];
      logger.info(`💻 Selected coding model: ${selected} (limited tool support)`);
      return selected;
    }

    // Final fallback to any general model
    if (generalModels.length > 0) {
      const selected = generalModels[0];
      logger.info(`🤖 Selected general model: ${selected} (no tool support)`);
      return selected;
    }

    // Use first available as last resort
    const selected = availableModels[0];
    logger.info(`⚠️ Using first available model: ${selected} (capabilities unknown)`);
    return selected;
  }

  /**
   * Detect models with function-calling capabilities based on known patterns
   */
  private detectFunctionCallingModels(models: string[]): string[] {
    const functionCallingPatterns = [
      /^llama3\.1/i,      // Llama 3.1 series has strong function calling
      /^mistral.*instruct/i, // Mistral Instruct models support tools
      /^qwen2\.5.*instruct/i, // Qwen 2.5 Instruct models
      /^codellama.*instruct/i, // CodeLlama Instruct
      /^openchat/i,        // OpenChat models
      /^hermes/i,         // Nous Hermes series
      /^yi.*chat/i,       // Yi Chat models
    ];

    return models.filter(model => 
      functionCallingPatterns.some(pattern => pattern.test(model))
    ).sort((a, b) => {
      // Prefer larger models (assuming better capabilities)
      const sizeA = this.extractModelSize(a);
      const sizeB = this.extractModelSize(b);
      return sizeB - sizeA;
    });
  }

  /**
   * Detect coding-focused models
   */
  private detectCodingModels(models: string[]): string[] {
    const codingPatterns = [
      /coder/i,
      /code/i,
      /programming/i,
      /deepseek/i,
      /wizard.*coder/i,
      /starcoder/i,
    ];

    return models.filter(model => 
      codingPatterns.some(pattern => pattern.test(model))
    ).sort((a, b) => {
      const sizeA = this.extractModelSize(a);
      const sizeB = this.extractModelSize(b);
      return sizeB - sizeA;
    });
  }

  /**
   * Detect general purpose models
   */
  private detectGeneralPurposeModels(models: string[]): string[] {
    return models.filter(model => 
      !this.detectFunctionCallingModels([model]).length &&
      !this.detectCodingModels([model]).length
    ).sort((a, b) => {
      const sizeA = this.extractModelSize(a);
      const sizeB = this.extractModelSize(b);
      return sizeB - sizeA;
    });
  }

  /**
   * Extract model size from model name (e.g., "7b", "13b")
   */
  private extractModelSize(modelName: string): number {
    const sizeMatch = modelName.match(/(\d+\.?\d*)b/i);
    return sizeMatch ? parseFloat(sizeMatch[1]) : 0;
  }

  /**
   * Set model manually (for slash command support)
   */
  async setModel(modelName: string): Promise<boolean> {
    const availableModels = await this.listModels();
    
    if (!availableModels.includes(modelName)) {
      logger.error(`Model ${modelName} not available. Available models:`, availableModels);
      return false;
    }

    this.model = modelName;
    logger.info(`🔄 Switched to model: ${modelName}`);
    
    // Test if model supports function calling
    const functionCallingCapable = this.detectFunctionCallingModels([modelName]).length > 0;
    if (functionCallingCapable) {
      logger.info(`✅ Model ${modelName} supports function calling`);
    } else {
      logger.warn(`⚠️ Model ${modelName} may not support function calling`);
    }
    
    return true;
  }

  /**
   * Get current model info
   */
  getCurrentModelInfo(): { name: string; supportsFunctionCalling: boolean; type: 'function-calling' | 'coding' | 'general' | 'unknown' } {
    const functionCalling = this.detectFunctionCallingModels([this.model]).length > 0;
    const coding = this.detectCodingModels([this.model]).length > 0;
    
    let type: 'function-calling' | 'coding' | 'general' | 'unknown';
    if (functionCalling) type = 'function-calling';
    else if (coding) type = 'coding';
    else if (this.model !== 'auto-detect') type = 'general';
    else type = 'unknown';

    return {
      name: this.model,
      supportsFunctionCalling: functionCalling,
      type
    };
  }

  async warmModel(): Promise<void> {
    logger.info('Model is ready', { model: this.model });
  }

  private getGPUConfig(): any {
    return {
      num_gpu: 0,
      num_thread: 4,
      num_batch: 64,
      num_ctx: 8192,
    };
  }
}
