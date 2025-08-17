import axios, { AxiosInstance } from 'axios';
import { logger } from './logger.js';
import { timeoutManager } from './timeout-manager.js';
import { connectionManager } from './connection-manager.js';
import { dynamicTimeoutManager } from './dynamic-timeout-manager.js';

export interface LMStudioConfig {
  endpoint: string;
  enabled: boolean;
  models: string[];
  maxConcurrent: number;
  streamingEnabled: boolean;
  taskTypes: string[];
  performance?: {
    gpuMemoryFraction?: number;
    gpuLayers?: number;
    maxLoadedModels?: number;
    jitLoading?: boolean;
    modelTtl?: number;
    autoEvict?: boolean;
    batchSize?: number;
    flashAttention?: boolean;
    keyCacheQuantization?: string;
    valueCacheQuantization?: string;
    streamBufferSize?: number;
    streamTimeout?: number;
    contextLength?: number;
    temperature?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    keepAliveInterval?: number;
    keepAliveEnabled?: boolean;
    modelWarmupEnabled?: boolean;
  };
}

export interface LMStudioResponse {
  code: string;
  explanation: string;
  confidence: number;
  latency: number;
  model: string;
  fromCache: boolean;
  content: string;  // For backward compatibility
  tokens_used: number;
}

export interface LLMCapabilities {
  strengths: string[];
  optimalFor: string[];
  responseTime: string;
  contextWindow: number;
}

export interface LLMInterface {
  generateCode(prompt: string, context: string[]): Promise<LMStudioResponse>;
  getCapabilities(): Promise<LLMCapabilities>;
}

/**
 * LM Studio Client for high-performance local inference
 * Provides OpenAI-compatible API integration with streaming support
 */
export class LMStudioClient implements LLMInterface {
  private client: AxiosInstance;
  private config: LMStudioConfig;
  private activeRequests = new Map<string, AbortController>();
  private healthStatus: boolean = false;
  private lastHealthCheck: number = 0;
  private modelCache = new Map<string, any>();
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private currentModel: string | null = null;
  private modelWarmupCache = new Map<string, number>(); // Track model warmup times
  private requestQueue: Array<{ resolve: Function; reject: Function; fn: Function }> = [];
  private isProcessingQueue: boolean = false;

  constructor(config: LMStudioConfig) {
    this.config = config;
    
    this.client = axios.create({
      baseURL: config.endpoint,
      timeout: 180000, // 3 minute timeout for JIT model loading
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CodeCrucible-Synth/1.0'
      }
    });

    logger.info('LM Studio client initialized', {
      endpoint: config.endpoint,
      enabled: config.enabled,
      maxConcurrent: config.maxConcurrent,
      streaming: config.streamingEnabled
    });

    // Initialize health monitoring
    this.initializeHealthMonitoring();
    
    // Initialize model keep-alive system
    this.initializeKeepAlive();
    
    // Preload first configured model
    this.preloadModels();
  }

  /**
   * Initialize health monitoring for LM Studio
   */
  private async initializeHealthMonitoring(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      await this.checkHealth();
      // Set up periodic health checks every 5 minutes
      setInterval(() => {
        this.checkHealth().catch(error => {
          logger.debug('Periodic health check failed:', error);
        });
      }, 300000);
    } catch (error) {
      logger.warn('Initial LM Studio health check failed:', error);
    }
  }

  /**
   * Check LM Studio health and availability
   */
  async checkHealth(): Promise<boolean> {
    try {
      const now = Date.now();
      
      // Use cached health status if recent (within 30 seconds)
      if (this.healthStatus && (now - this.lastHealthCheck) < 30000) {
        return this.healthStatus;
      }

      const response = await this.client.get('/v1/models', { timeout: 10000 });
      this.healthStatus = response.status === 200 && response.data?.data?.length > 0;
      this.lastHealthCheck = now;

      if (this.healthStatus) {
        logger.debug('LM Studio health check: OK');
        // Cache available models
        this.modelCache.set('available_models', response.data.data);
      } else {
        logger.warn('LM Studio health check: No models available');
      }

      return this.healthStatus;
    } catch (error) {
      this.healthStatus = false;
      this.lastHealthCheck = Date.now();
      logger.debug('LM Studio health check failed:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get available models from LM Studio
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      if (!await this.checkHealth()) {
        return [];
      }

      const cachedModels = this.modelCache.get('available_models');
      if (cachedModels) {
        return cachedModels.map((model: any) => model.id || model.name);
      }

      const response = await this.client.get('/v1/models');
      const models = response.data?.data || [];
      
      this.modelCache.set('available_models', models);
      return models.map((model: any) => model.id || model.name);
    } catch (error) {
      logger.warn('Failed to get LM Studio models:', error);
      return [];
    }
  }

  /**
   * Queue a request for sequential processing
   */
  private async queueRequest<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, fn });
      this.processQueue();
    });
  }

  /**
   * Process the request queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    logger.debug(`Processing request queue (${this.requestQueue.length} requests)`);

    while (this.requestQueue.length > 0) {
      const { resolve, reject, fn } = this.requestQueue.shift()!;
      
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
      
      // Small delay between requests to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessingQueue = false;
    logger.debug('Request queue processing complete');
  }

  /**
   * Generate code response using LM Studio (queued for sequential processing)
   */
  async generateCode(prompt: string, context: string[] = [], taskMetadata?: { taskType?: string; complexity?: string }): Promise<LMStudioResponse> {
    return this.queueRequest(() => this.generateCodeInternal(prompt, context, taskMetadata));
  }

  /**
   * Internal code generation method (runs sequentially) with enhanced connection management
   */
  private async generateCodeInternal(prompt: string, context: string[] = [], taskMetadata?: { taskType?: string; complexity?: string }): Promise<LMStudioResponse> {
    if (!this.config.enabled) {
      throw new Error('LM Studio client is disabled');
    }

    const startTime = Date.now();
    const requestId = `lms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Check concurrent request limit
      if (this.activeRequests.size >= this.config.maxConcurrent) {
        throw new Error(`Maximum concurrent requests reached (${this.config.maxConcurrent})`);
      }

      // Check connection health first
      const isHealthy = await connectionManager.isHealthy(this.config.endpoint);
      if (!isHealthy) {
        logger.warn('LM Studio connection unhealthy, proceeding with caution');
      }

      // Create abort controller for this request
      const abortController = new AbortController();
      this.activeRequests.set(requestId, abortController);

      // Get best available model based on task characteristics
      const model = await this.selectBestModel(taskMetadata?.taskType, taskMetadata?.complexity);
      
      // Warm up the model if it's different from current or not recently used
      if (model !== this.currentModel) {
        logger.info(`Switching to model: ${model}`);
        await this.warmupModel(model);
      }
      
      // Build enhanced prompt with context
      const enhancedPrompt = this.buildEnhancedPrompt(prompt, context);
      
      // Build request payload with performance optimizations
      const perf = this.config.performance || {};
      const requestPayload = {
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful coding assistant. Provide clear, concise, and practical solutions. Focus on working code examples and actionable advice.'
          },
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        max_tokens: Math.min(perf.contextLength || 4096, 2048),
        temperature: perf.temperature || 0.3,
        top_p: perf.topP || 0.8,
        frequency_penalty: perf.frequencyPenalty || 0.1,
        presence_penalty: perf.presencePenalty || 0.1,
        stream: this.config.streamingEnabled,
        stop: ['</code>', 'Human:', 'Assistant:'],
        // Performance optimizations
        ...(perf.batchSize && { batch_size: perf.batchSize }),
        ...(perf.flashAttention && { flash_attention: perf.flashAttention }),
        ...(perf.keyCacheQuantization && { key_cache_quantization: perf.keyCacheQuantization }),
        ...(perf.valueCacheQuantization && { value_cache_quantization: perf.valueCacheQuantization })
      };

      logger.debug(`LM Studio request: ${requestId} using model: ${model}`);

      // Use enhanced connection manager for the request
      const response = await connectionManager.executeWithRetry(
        this.config.endpoint,
        async (client) => {
          if (this.config.streamingEnabled) {
            return this.handleStreamingRequestWithClient(client, requestPayload, abortController);
          } else {
            return this.handleStandardRequestWithClient(client, requestPayload, abortController);
          }
        },
        {
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 10000,
          exponentialBackoff: true
        }
      );

      const responseTime = Date.now() - startTime;
      
      // Record performance for adaptive learning
      dynamicTimeoutManager.recordPerformance(
        'lmstudio',
        taskMetadata?.taskType || 'general',
        taskMetadata?.complexity === 'complex' ? 'complex' : 
        taskMetadata?.complexity === 'simple' ? 'simple' : 'medium',
        responseTime,
        true
      );
      
      // Parse response to extract code and explanation
      const parsed = this.parseCodeResponse(response.content);
      
      const result: LMStudioResponse = {
        code: parsed.code,
        explanation: parsed.explanation,
        confidence: this.calculateConfidence(response.content, responseTime),
        latency: responseTime,
        model: model,
        fromCache: false,
        content: response.content,  // For backward compatibility
        tokens_used: response.tokens_used || 0
      };

      logger.info(`LM Studio response completed: ${requestId} (${responseTime}ms)`);
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error(`LM Studio request failed: ${requestId} (${responseTime}ms)`, error);
      throw new Error(`LM Studio generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Handle standard (non-streaming) request
   */
  private async handleStandardRequest(payload: any, abortController: AbortController): Promise<any> {
    const response = await this.client.post('/v1/chat/completions', payload, {
      signal: abortController.signal,
      timeout: 180000 // 3 minute timeout for JIT model loading + generation
    });

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from LM Studio');
    }

    return {
      content: response.data.choices[0].message.content.trim(),
      tokens_used: response.data.usage?.total_tokens || 0
    };
  }

  /**
   * Handle standard request with provided client (for connection manager)
   */
  private async handleStandardRequestWithClient(client: any, payload: any, abortController: AbortController): Promise<any> {
    const response = await client.post('/v1/chat/completions', payload, {
      signal: abortController.signal,
      timeout: 180000 // 3 minute timeout for JIT model loading + generation
    });

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from LM Studio');
    }

    return {
      content: response.data.choices[0].message.content.trim(),
      tokens_used: response.data.usage?.total_tokens || 0
    };
  }

  /**
   * Handle streaming request with provided client (for connection manager)
   */
  private async handleStreamingRequestWithClient(client: any, payload: any, abortController: AbortController): Promise<any> {
    return new Promise((resolve, reject) => {
      let content = '';
      let tokens_used = 0;

      const request = client.post('/v1/chat/completions', payload, {
        signal: abortController.signal,
        timeout: 180000, // 3 minute timeout for JIT model loading + streaming
        responseType: 'stream'
      });

      request.then((response: any) => {
        response.data.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                resolve({ content: content.trim(), tokens_used });
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                
                if (delta) {
                  content += delta;
                }

                if (parsed.usage?.total_tokens) {
                  tokens_used = parsed.usage.total_tokens;
                }
              } catch (parseError) {
                // Ignore JSON parse errors for streaming chunks
              }
            }
          }
        });

        response.data.on('end', () => {
          resolve({ content: content.trim(), tokens_used });
        });

        response.data.on('error', (error: any) => {
          reject(new Error(`Streaming error: ${error.message}`));
        });

      }).catch(reject);

      // Configurable timeout fallback
      const streamTimeout = this.config.performance?.streamTimeout || 60000;
      setTimeout(() => {
        if (!abortController.signal.aborted) {
          abortController.abort();
          reject(new Error('Streaming request timeout'));
        }
      }, streamTimeout);
    });
  }

  /**
   * Handle streaming request
   */
  private async handleStreamingRequest(payload: any, abortController: AbortController): Promise<any> {
    return new Promise((resolve, reject) => {
      let content = '';
      let tokens_used = 0;

      const request = this.client.post('/v1/chat/completions', payload, {
        signal: abortController.signal,
        timeout: 180000, // 3 minute timeout for JIT model loading + streaming
        responseType: 'stream'
      });

      request.then((response: any) => {
        response.data.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                resolve({ content: content.trim(), tokens_used });
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                
                if (delta) {
                  content += delta;
                }

                if (parsed.usage?.total_tokens) {
                  tokens_used = parsed.usage.total_tokens;
                }
              } catch (parseError) {
                // Ignore JSON parse errors for streaming chunks
              }
            }
          }
        });

        response.data.on('end', () => {
          resolve({ content: content.trim(), tokens_used });
        });

        response.data.on('error', (error: any) => {
          reject(new Error(`Streaming error: ${error.message}`));
        });

      }).catch(reject);

      // Configurable timeout fallback
      const streamTimeout = this.config.performance?.streamTimeout || 60000;
      setTimeout(() => {
        if (!abortController.signal.aborted) {
          abortController.abort();
          reject(new Error('Streaming request timeout'));
        }
      }, streamTimeout);
    });
  }

  /**
   * Select best available model for the task
   */
  private async selectBestModel(taskType?: string, complexity?: string): Promise<string> {
    const availableModels = await this.getAvailableModels();
    
    if (availableModels.length === 0) {
      throw new Error('No models available in LM Studio');
    }

    // Smart model selection based on task characteristics
    const modelPreferences = this.getModelPreferences(taskType, complexity, availableModels);
    
    // Try preferred models in order
    for (const preferredModel of modelPreferences) {
      if (availableModels.includes(preferredModel)) {
        logger.debug(`Selected model: ${preferredModel} for task: ${taskType} (${complexity})`);
        return preferredModel;
      }
    }

    // Fallback to configured models
    for (const configModel of this.config.models) {
      if (availableModels.includes(configModel)) {
        logger.debug(`Fallback to configured model: ${configModel}`);
        return configModel;
      }
    }

    // Final fallback
    logger.warn('Using first available model as last resort');
    return availableModels[0];
  }

  /**
   * Get model preferences based on task characteristics
   */
  private getModelPreferences(taskType?: string, complexity?: string, availableModels: string[] = []): string[] {
    const preferences: string[] = [];
    
    // DeepSeek R1 is excellent for reasoning and complex tasks
    if (complexity === 'complex' || taskType === 'analysis' || taskType === 'planning') {
      preferences.push('deepseek/deepseek-r1-0528-qwen3-8b');
    }
    
    // Qwen3 30B for large context and comprehensive tasks
    if (taskType === 'multi-file' || complexity === 'complex') {
      preferences.push('qwen/qwen3-30b-a3b');
    }
    
    // Gemma for balanced performance and templates
    if (taskType === 'template' || taskType === 'format' || taskType === 'edit') {
      preferences.push('google/gemma-3-12b');
    }
    
    // DeepSeek R1 for coding and quick generation
    if (taskType === 'template' || taskType === 'boilerplate' || taskType === 'simple-generation') {
      preferences.push('deepseek/deepseek-r1-0528-qwen3-8b');
    }
    
    // Add all configured models as fallbacks
    preferences.push(...this.config.models);
    
    // Remove duplicates while preserving order
    return [...new Set(preferences)];
  }

  /**
   * Initialize model keep-alive system
   */
  private initializeKeepAlive(): void {
    if (!this.config.enabled || !this.config.performance?.keepAliveEnabled) {
      return;
    }

    // Use configurable keep-alive interval with fallback to 30 seconds
    const interval = this.config.performance?.keepAliveInterval || 30000;
    
    this.keepAliveInterval = setInterval(async () => {
      if (this.currentModel && !this.isProcessingQueue) {
        try {
          await this.sendKeepAliveRequest(this.currentModel);
          logger.debug(`Keep-alive sent for model: ${this.currentModel}`);
        } catch (error) {
          logger.debug('Keep-alive failed:', error);
        }
      }
    }, interval);

    logger.debug(`Model keep-alive system initialized with ${interval}ms interval`);
  }

  /**
   * Send a minimal request to keep model loaded
   */
  private async sendKeepAliveRequest(model: string): Promise<void> {
    try {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), 10000); // 10 second timeout

      await this.client.post('/v1/chat/completions', {
        model: model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0
      }, {
        signal: abortController.signal,
        timeout: 10000
      });

      clearTimeout(timeout);
    } catch (error) {
      // Keep-alive failures are expected and not critical
      logger.debug(`Keep-alive request failed for ${model}:`, error);
    }
  }

  /**
   * Preload configured models at startup
   */
  private async preloadModels(): Promise<void> {
    if (!this.config.enabled || this.config.models.length === 0) {
      return;
    }

    // Preload the first configured model asynchronously
    setTimeout(async () => {
      try {
        const primaryModel = this.config.models[0];
        logger.info(`Preloading primary model: ${primaryModel}`);
        await this.warmupModel(primaryModel);
      } catch (error) {
        logger.warn('Failed to preload primary model:', error);
      }
    }, 1000);
  }

  /**
   * Warm up a model to ensure it's loaded and ready
   */
  private async warmupModel(model: string): Promise<boolean> {
    if (this.modelWarmupCache.has(model)) {
      // Model was recently warmed up - use configurable TTL
      const lastWarmup = this.modelWarmupCache.get(model)!;
      const ttl = (this.config.performance?.modelTtl || 300) * 1000; // Convert to milliseconds
      if (Date.now() - lastWarmup < ttl) {
        logger.debug(`Model ${model} already warm (TTL: ${ttl}ms)`);
        return true;
      }
    }

    try {
      logger.debug(`Warming up model: ${model}`);
      const start = Date.now();
      
      await this.sendKeepAliveRequest(model);
      
      const warmupTime = Date.now() - start;
      this.modelWarmupCache.set(model, Date.now());
      this.currentModel = model;
      
      logger.info(`Model ${model} warmed up in ${warmupTime}ms`);
      return true;
    } catch (error) {
      logger.warn(`Failed to warm up model ${model}:`, error);
      return false;
    }
  }

  /**
   * Build enhanced prompt with context
   */
  private buildEnhancedPrompt(prompt: string, context: string[]): string {
    let enhanced = prompt;

    if (context.length > 0) {
      enhanced = `Context:\n${context.join('\n\n')}\n\nTask:\n${prompt}`;
    }

    // Add coding-specific instructions for better results
    enhanced += '\n\nInstructions:\n- Provide working, tested code examples\n- Include necessary imports and dependencies\n- Add brief explanations for complex logic\n- Use proper formatting and indentation\n- Focus on practical, implementable solutions';

    return enhanced;
  }

  /**
   * Parse code response to extract code and explanation
   */
  private parseCodeResponse(content: string): { code: string; explanation: string } {
    // Look for code blocks first
    const codeBlockRegex = /```(?:[\w]*\n)?([\s\S]*?)```/g;
    const codeBlocks = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push(match[1].trim());
    }

    if (codeBlocks.length > 0) {
      const code = codeBlocks.join('\n\n');
      const explanation = content.replace(/```[\s\S]*?```/g, '').trim();
      return { code, explanation };
    }

    // If no code blocks, look for inline code patterns
    const lines = content.split('\n');
    const codeLines = [];
    const explanationLines = [];

    for (const line of lines) {
      // Consider lines with common code patterns as code
      if (line.match(/^\s*(function|const|let|var|class|import|export|if|for|while|async|return)/)) {
        codeLines.push(line);
      } else if (line.trim() && !line.match(/^(Here|This|The|You|To|In|For|When|By)/)) {
        // Simple heuristic: lines starting with common explanation words are explanations
        explanationLines.push(line);
      } else {
        explanationLines.push(line);
      }
    }

    if (codeLines.length > 0) {
      return {
        code: codeLines.join('\n'),
        explanation: explanationLines.join('\n').trim()
      };
    }

    // Fallback: treat entire content as code if it looks like code
    if (content.includes('function') || content.includes('=>') || content.includes('const ')) {
      return {
        code: content,
        explanation: 'Generated code (no explicit explanation provided)'
      };
    }

    // Last resort: treat as explanation with no code
    return {
      code: '',
      explanation: content
    };
  }

  /**
   * Calculate confidence based on response characteristics
   */
  private calculateConfidence(content: string, responseTime: number): number {
    let confidence = 0.7; // Base confidence for LM Studio

    // Response time factor (faster = higher confidence for LM Studio)
    if (responseTime < 1000) confidence += 0.2;
    else if (responseTime < 3000) confidence += 0.1;
    else if (responseTime > 10000) confidence -= 0.1;

    // Content quality factors
    if (content.length > 100) confidence += 0.05;
    if (content.length > 500) confidence += 0.05;

    // Code block presence
    const codeBlocks = (content.match(/```/g) || []).length / 2;
    confidence += Math.min(codeBlocks * 0.05, 0.1);

    // Technical content
    const technicalTerms = /\b(function|class|const|let|var|import|export|async|await|return|if|else|for|while)\b/g;
    const matches = content.match(technicalTerms);
    if (matches) {
      confidence += Math.min(matches.length * 0.01, 0.1);
    }

    return Math.min(Math.max(confidence, 0.1), 1.0);
  }

  /**
   * Get LM Studio capabilities
   */
  async getCapabilities(): Promise<LLMCapabilities> {
    return {
      strengths: ['speed', 'templates', 'streaming', 'windows-optimized', 'local-inference'],
      optimalFor: ['quick-edits', 'boilerplate', 'formatting', 'simple-generation', 'templates'],
      responseTime: '<1s',
      contextWindow: 4096
    };
  }

  /**
   * Cancel all active requests
   */
  cancelAllRequests(): void {
    logger.info(`Cancelling ${this.activeRequests.size} active LM Studio requests`);
    
    for (const [requestId, controller] of this.activeRequests.entries()) {
      controller.abort();
      logger.debug(`Cancelled LM Studio request: ${requestId}`);
    }
    
    this.activeRequests.clear();
  }

  /**
   * Check if LM Studio can handle a specific task type
   */
  canHandleTaskType(taskType: string): boolean {
    return this.config.taskTypes.includes(taskType);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LMStudioConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.endpoint) {
      this.client = axios.create({
        baseURL: newConfig.endpoint,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CodeCrucible-Synth/1.0'
        }
      });
    }

    logger.info('LM Studio config updated:', newConfig);
  }

  /**
   * Get current status and metrics
   */
  getStatus(): any {
    const availableModels = this.modelCache.get('available_models') || [];
    
    return {
      enabled: this.config.enabled,
      endpoint: this.config.endpoint,
      available: this.healthStatus,
      healthy: this.healthStatus,
      lastHealthCheck: new Date(this.lastHealthCheck).toISOString(),
      activeRequests: this.activeRequests.size,
      maxConcurrent: this.config.maxConcurrent,
      modelsAvailable: availableModels.length,
      streamingEnabled: this.config.streamingEnabled,
      taskTypes: this.config.taskTypes
    };
  }

  /**
   * Test model with a simple prompt
   */
  async testModel(modelName?: string): Promise<boolean> {
    try {
      if (!this.config.enabled) {
        return false;
      }

      const testPrompt = 'Test: respond with "LM Studio working"';
      const result = await this.generateCode(testPrompt);
      
      const isWorking = result.content.toLowerCase().includes('working') || 
                       result.content.toLowerCase().includes('lm studio') ||
                       result.content.toLowerCase().includes('correctly');
      
      logger.info(`LM Studio model test: ${isWorking ? 'PASSED' : 'FAILED'}`, {
        model: result.model,
        responseTime: result.latency,
        confidence: result.confidence
      });

      return isWorking;
    } catch (error) {
      logger.error('LM Studio model test failed:', error);
      return false;
    }
  }


  /**
   * Cleanup resources
   */
  dispose(): void {
    this.cancelAllRequests();
    
    // Clear keep-alive interval
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    
    // Clear caches
    this.modelCache.clear();
    this.modelWarmupCache.clear();
    this.currentModel = null;
    
    logger.info('LM Studio client disposed');
  }
}