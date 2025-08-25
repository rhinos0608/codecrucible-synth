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
  timeouts?: {
    connection: number;
    coldStart: number;
    generation: number;
    healthCheck: number;
  };
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

    // CRITICAL FIX: Removed socket timeout to prevent 472ms context canceled errors
    const httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: 5,      // Reduced concurrent connections for stability
      maxFreeSockets: 2,  // Fewer idle connections to prevent stale issues
      keepAliveMsecs: 30000, // 30s keepalive interval
      // timeout removed - let axios handle timeouts to prevent conflicts
    });

    const httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 5,
      maxFreeSockets: 2,
      keepAliveMsecs: 30000,
      // timeout removed - prevents socket timeout conflicts
    });

    this.httpClient = axios.create({
      baseURL: this.config.endpoint,
      // Remove global timeout - use per-request timeouts instead to avoid conflicts
      httpAgent, // Connection pooling for HTTP
      httpsAgent, // Connection pooling for HTTPS
      headers: {
        'Content-Type': 'application/json',
        Connection: 'keep-alive', // Explicitly request keep-alive
      },
    });
    
    // CRITICAL DEBUG: Add axios interceptors to trace actual network calls
    this.httpClient.interceptors.request.use(
      (config) => {
        logger.info('🌐 AXIOS REQUEST INTERCEPTOR: About to make REAL network call', {
          url: config.url,
          baseURL: config.baseURL,
          method: config.method,
          fullURL: `${config.baseURL}${config.url}`,
          hasAdapter: !!config.adapter,
          adapterType: config.adapter ? config.adapter.constructor.name : 'default',
          timeout: config.timeout
        });
        return config;
      },
      (error) => {
        logger.error('🌐 AXIOS REQUEST ERROR INTERCEPTOR', error);
        return Promise.reject(error);
      }
    );
    
    this.httpClient.interceptors.response.use(
      (response) => {
        logger.info('🌐 AXIOS RESPONSE INTERCEPTOR: Received REAL network response', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url,
          fullURL: `${response.config.baseURL}${response.config.url}`,
          responseTime: 'calculated_after_request',
          hasData: !!response.data,
          dataKeys: response.data ? Object.keys(response.data) : []
        });
        return response;
      },
      (error) => {
        logger.error('🌐 AXIOS RESPONSE ERROR INTERCEPTOR', {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          url: error.config?.url,
          isNetworkError: !error.response,
          isTimeout: error.code === 'ECONNABORTED'
        });
        return Promise.reject(error);
      }
    );

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

    // CRITICAL FIX: Removed redundant timeout handling - let axios manage timeouts
    // This prevents conflicting timeout layers that cause "context canceled" errors

    try {
      const hasTools = request.tools && request.tools.length > 0;
      const endpoint = hasTools ? '/api/chat' : '/api/generate';
      
      // CRITICAL FIX 3: Connection health validation
      const connectionHealth = await this.validateConnectionHealth();
      if (!connectionHealth.isHealthy) {
        logger.warn('Connection health check failed, refreshing connection', {
          reason: connectionHealth.reason,
          lastSuccessfulRequest: connectionHealth.lastSuccessfulRequest
        });
        
        // Force new connection by clearing any potential stale state
        this.refreshConnection();
      }

      // CRITICAL: Context window validation to prevent 500 errors
      if (hasTools) {
        const contextValidation = this.validateRequestContext(request);
        if (!contextValidation.isValid) {
          logger.warn('Request exceeds context limits, reducing tools', {
            originalToolCount: request.tools?.length || 0,
            estimatedTokens: contextValidation.estimatedTokens,
            maxContext: contextValidation.maxContext,
            reason: contextValidation.reason
          });
          
          // Progressively reduce tools to fit context
          request.tools = this.reduceToolsForContext(request.tools || [], contextValidation.maxContext);
          logger.info('Tools reduced for context compatibility', {
            newToolCount: request.tools.length
          });
        }
      }
      
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
            num_predict: Math.min(request.maxTokens || 2048, 1024),
            // Simplified options to prevent ollama timeouts
            top_p: 0.9,
            top_k: 40
          }
        };
        
        logger.debug('Sending function-calling request to Ollama API', {
          url: `${this.config.endpoint}${endpoint}`,
          model: this.model,
          toolCount: request.tools.length,
          messageContent: `${request.prompt?.substring(0, 100)  }...`,
        });
      } else {
        // Use generate format for regular text
        requestBody = {
          model: this.model,
          prompt: request.prompt,
          stream: false,
          options: {
            temperature: request.temperature || 0.1,
            num_predict: Math.min(request.maxTokens || 2048, 1024),
            // Simplified options to prevent ollama timeouts
            top_p: 0.9,
            top_k: 40
          },
        };
        
        logger.debug('Sending regular request to Ollama API', {
          url: `${this.config.endpoint}${endpoint}`,
          model: this.model,
          promptLength: request.prompt?.length || 0,
        });
      }

      // Use tiered timeout based on request type and model state
      const isModelWarmed = modelPreloader.isModelWarmed(this.model, 'ollama');
      const timeoutToUse = isModelWarmed ? 
        (this.config.timeouts?.generation || this.config.timeout || 120000) : 
        (this.config.timeouts?.coldStart || 30000);
      
      logger.debug('Using tiered timeout strategy', {
        isModelWarmed,
        timeoutUsed: timeoutToUse,
        coldStartTimeout: this.config.timeouts?.coldStart || 30000,
        generationTimeout: this.config.timeouts?.generation || 120000
      });
      
      logger.info('🔥 CRITICAL DEBUG: About to make HTTP request to ollama', {
        endpoint,
        url: `${this.config.endpoint}${endpoint}`,
        timeoutUsed: timeoutToUse,
        model: this.model,
        hasTools: hasTools,
        requestBodyKeys: Object.keys(requestBody)
      });
      
      // Add metadata for request timing in interceptors
      const startTime = Date.now();
      const requestConfig = {
        signal: effectiveAbortSignal,
        timeout: timeoutToUse
      };
      
      const response = await this.httpClient.post(endpoint, requestBody, requestConfig);

      // Timeout cleanup removed - axios handles timeout cleanup automatically
      logger.info('🔥 CRITICAL DEBUG: Received response from Ollama API', {
        status: response.status,
        statusText: response.statusText,
        hasData: !!response.data,
        responseDataKeys: response.data ? Object.keys(response.data) : []
      });

      const responseData = response.data;

      // Handle chat response format (with tools)
      if (responseData.message) {
        const message = responseData.message;
        
        if (message.tool_calls && message.tool_calls.length > 0) {
          logger.debug('Ollama tool calls detected (chat format)', {
            toolCallCount: message.tool_calls.length,
            toolNames: message.tool_calls.map((call: any) => call.function?.name),
            messageContent: `${message.content?.substring(0, 100)  }...`
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

      // CRITICAL FIX 2: Enhanced tool call detection from response content
      // Local LLMs often return tool calls as JSON in the content instead of structured toolCalls
      const rawContent = responseData.response || '';
      const detectedToolCalls: any[] = [];
      
      // Try to parse tool calls from content using multiple patterns
      if (rawContent && typeof rawContent === 'string') {
        const cleanContent = rawContent.trim();
        
        // Pattern 1: Direct JSON object {"name": "...", "arguments": {...}}
        if (cleanContent.startsWith('{') && cleanContent.includes('"name"') && cleanContent.includes('"arguments"')) {
          try {
            const parsed = JSON.parse(cleanContent);
            if (parsed.name) {
              detectedToolCalls.push({
                name: parsed.name,
                arguments: parsed.arguments || {},
                function: {
                  name: parsed.name,
                  arguments: parsed.arguments || {}
                }
              });
              logger.debug('Ollama: Parsed tool call from JSON content', {
                toolName: parsed.name,
                content: `${cleanContent.substring(0, 100)  }...`
              });
            }
          } catch (error) {
            logger.debug('Failed to parse JSON tool call from content', { content: cleanContent.substring(0, 100) });
          }
        }
        
        // Pattern 2: Markdown code block with JSON
        const codeBlockMatch = cleanContent.match(/```json\s*(\{[^}]+\})\s*```/);
        if (codeBlockMatch && !detectedToolCalls.length) {
          try {
            const parsed = JSON.parse(codeBlockMatch[1]);
            if (parsed.name) {
              detectedToolCalls.push({
                name: parsed.name,
                arguments: parsed.arguments || {},
                function: {
                  name: parsed.name,
                  arguments: parsed.arguments || {}
                }
              });
              logger.debug('Ollama: Parsed tool call from markdown JSON block', {
                toolName: parsed.name
              });
            }
          } catch (error) {
            logger.debug('Failed to parse markdown JSON tool call');
          }
        }
      }
      
      // If we detected tool calls from content, return them in the expected format
      if (detectedToolCalls.length > 0) {
        logger.debug('Ollama: Enhanced tool call detection successful', {
          toolCallCount: detectedToolCalls.length,
          toolNames: detectedToolCalls.map(call => call.name),
          originalContent: `${rawContent.substring(0, 100)  }...`
        });
        
        return {
          content: rawContent,
          toolCalls: detectedToolCalls,
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
        content: rawContent,
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
      // Enhanced error handling with specific timeout and connection error messages
      const responseTime = Date.now() - startTime;
      const errorMessage = getErrorMessage(error);
      
      logger.error('Ollama API error', {
        error: errorMessage,
        responseTime,
        model: this.model,
        endpoint: this.config.endpoint
      });
      
      // Record failed request metrics
      modelPreloader.recordModelUsage(this.model, 'ollama', responseTime, false);

      // Enhanced timeout error handling
      if ((error as any)?.name === 'AbortError' || (error as any)?.code === 'ECONNABORTED') {
        const isModelWarmed = modelPreloader.isModelWarmed(this.model, 'ollama');
        const timeoutUsed = isModelWarmed ? (this.config.timeouts?.generation || 120000) : (this.config.timeouts?.coldStart || 30000);
        
        throw new Error(
          `Ollama API request timed out after ${timeoutUsed}ms. ` +
          `${isModelWarmed ? 'Model was warmed' : 'Cold start detected - this is normal for first requests'}. ` +
          `Try increasing ${isModelWarmed ? 'generation' : 'coldStart'} timeout in configuration.`
        );
      }

      // Connection error with retry suggestion
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
    }, this.config.timeouts?.healthCheck || 5000); // Use health check timeout for status checks

    try {
      const response = await this.httpClient.get('/api/tags', {
        signal: abortController.signal,
        timeout: this.config.timeouts?.healthCheck || 5000,
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
    }, this.config.timeouts?.healthCheck || 5000);

    try {
      const response = await this.httpClient.get('/api/tags', {
        signal: abortController.signal,
        timeout: this.config.timeouts?.healthCheck || 5000,
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

  async generateText(prompt: string, options: any = {}): Promise<string> {
    logger.debug('OllamaProvider.generateText called', { 
      promptLength: prompt.length,
      options: { model: options.model, temperature: options.temperature } 
    });

    const response = await this.processRequest({
      prompt,
      model: options.model || this.model,
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 4096,
      stream: options.stream || false,
      tools: options.tools || []
    });

    const content = response?.content || response?.text || response?.response || '';
    logger.debug('OllamaProvider.generateText completed', { contentLength: content.length });
    return content;
  }

  private getGPUConfig(): any {
    return {
      num_gpu: 0,
      num_thread: 4,
      num_batch: 64,
      num_ctx: 8192,
    };
  }

  /**
   * CRITICAL: Validate request context to prevent Ollama 500 errors
   * This addresses the root cause of 6.25-second failures
   */
  private validateRequestContext(request: any): {
    isValid: boolean;
    estimatedTokens: number;
    maxContext: number;
    reason?: string;
  } {
    // Model-specific context limits (conservative estimates)
    const contextLimits: Record<string, number> = {
      'gemma:latest': 6000,     // Conservative limit for 9B Gemma
      'llama2:latest': 3000,    // 7B model
      'llama3:latest': 6000,    // 8B model  
      'qwen2.5-coder:7b': 6000, // Coding model
      'default': 4000           // Safe default
    };

    const maxContext = contextLimits[this.model] || contextLimits['default'];
    
    // Estimate token usage
    const promptTokens = Math.ceil((request.prompt || '').length / 4); // Rough 4 chars = 1 token
    const toolTokens = (request.tools || []).length * 150; // ~150 tokens per tool definition
    const systemTokens = 100; // System prompt overhead
    const bufferTokens = 500; // Safety buffer for response
    
    const estimatedTokens = promptTokens + toolTokens + systemTokens + bufferTokens;
    
    if (estimatedTokens > maxContext) {
      return {
        isValid: false,
        estimatedTokens,
        maxContext,
        reason: `Estimated ${estimatedTokens} tokens exceeds ${maxContext} limit for ${this.model}`
      };
    }

    return {
      isValid: true,
      estimatedTokens,
      maxContext
    };
  }

  /**
   * Progressively reduce tools to fit within context limits
   */
  private reduceToolsForContext(tools: any[], maxContext: number): any[] {
    if (tools.length <= 1) return tools; // Can't reduce further
    
    // Prioritize essential file operations
    const essentialTools = ['filesystem_write_file', 'filesystem_read_file', 'filesystem_list_directory'];
    
    const prioritizedTools = [
      ...tools.filter(tool => {
        const name = tool.function?.name || tool.name;
        return essentialTools.includes(name);
      }),
      ...tools.filter(tool => {
        const name = tool.function?.name || tool.name;
        return !essentialTools.includes(name);
      })
    ];
    
    // Keep reducing until we fit in context (max 2 tools for reliability)
    for (let i = Math.min(2, prioritizedTools.length); i >= 1; i--) {
      const reducedTools = prioritizedTools.slice(0, i);
      const toolTokens = reducedTools.length * 150;
      
      if (toolTokens + 1000 < maxContext) { // Leave room for prompt + buffer
        return reducedTools;
      }
    }
    
    // Fallback: single most essential tool
    return prioritizedTools.slice(0, 1);
  }

  /**
   * CRITICAL FIX 3: Validate connection health to prevent stale connections
   */
  private async validateConnectionHealth(): Promise<{
    isHealthy: boolean;
    reason?: string;
    lastSuccessfulRequest?: number;
  }> {
    try {
      // Quick health check with minimal timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeouts?.healthCheck || 3000);

      const response = await this.httpClient.get('/api/tags', {
        signal: controller.signal,
        timeout: this.config.timeouts?.healthCheck || 5000,
      });

      clearTimeout(timeoutId);

      if (response.status === 200) {
        return { isHealthy: true };
      }

      return {
        isHealthy: false,
        reason: `Health check returned status ${response.status}`
      };

    } catch (error: any) {
      return {
        isHealthy: false,
        reason: `Health check failed: ${error.message || 'Connection error'}`
      };
    }
  }

  /**
   * CRITICAL FIX 3: Refresh connection to clear stale state
   */
  private refreshConnection(): void {
    // Recreate HTTP client with fresh connection pool
    const httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: 5,      // Reduced concurrent connections for stability
      maxFreeSockets: 2,  // Fewer idle connections to prevent stale issues
      keepAliveMsecs: 30000, // 30s keepalive interval
      // timeout removed - let axios handle timeouts to prevent conflicts
    });

    this.httpClient = axios.create({
      baseURL: this.config.endpoint,
      // Remove global timeout - use per-request timeouts instead to avoid conflicts
      httpAgent,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.debug('Connection refreshed with new HTTP client');
  }
}
