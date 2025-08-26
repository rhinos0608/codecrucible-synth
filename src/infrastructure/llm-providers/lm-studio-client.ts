/**
 * Pure LM Studio Infrastructure Client
 * Handles only connection management and API communication
 * 
 * Architecture Compliance:
 * - Infrastructure layer: concrete implementation only
 * - No business logic for model selection or optimization
 * - Pure WebSocket/HTTP client with error handling and retry logic
 * - No module-level mutable state
 */

import { LMStudioClient as SDK } from '@lmstudio/sdk';
import { EventEmitter } from 'events';
import { logger } from '../../core/logger.js';

export interface LMStudioConnectionConfig {
  baseUrl?: string;
  host?: string;
  port?: number;
  timeout: number;
  retryAttempts: number;
  retryDelayMs: number;
  connectionTimeout: number;
  healthCheckInterval: number;
  websocketReconnectDelay: number;
}

export interface LMStudioModelInfo {
  path: string;
  identifier: string;
  isLoaded: boolean;
  loadProgress?: number;
  architecture?: string;
  size?: string;
  quantization?: string;
}

export interface LMStudioCompletionRequest {
  modelPath: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
    seed?: number;
    [key: string]: any;
  };
}

export interface LMStudioChatRequest {
  modelPath: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  options?: Record<string, any>;
}

export interface LMStudioAgentRequest {
  modelPath: string;
  task: string;
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>;
  options?: {
    maxSteps?: number;
    temperature?: number;
    [key: string]: any;
  };
}

export interface LMStudioCompletionResponse {
  content: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LMStudioChatResponse {
  content: string;
  role: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LMStudioConnectionStatus {
  connected: boolean;
  modelCount: number;
  loadedModelCount: number;
  sdkVersion?: string;
  lastHealthCheck: Date;
  consecutiveFailures: number;
  websocketConnected?: boolean;
}

/**
 * Pure LM Studio SDK Client
 * Handles only connection management and API communication
 */
export class LMStudioClient extends EventEmitter {
  private client: SDK;
  private config: LMStudioConnectionConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private connectionStatus: LMStudioConnectionStatus;
  private reconnectTimer?: NodeJS.Timeout;

  constructor(config: LMStudioConnectionConfig) {
    super();
    this.config = config;
    
    // Initialize SDK client  
    const baseUrl = config.baseUrl || `http://${config.host || 'localhost'}:${config.port || 1234}`;
    this.client = new SDK({
      baseUrl
    });
    
    // Initialize connection status
    this.connectionStatus = {
      connected: false,
      modelCount: 0,
      loadedModelCount: 0,
      lastHealthCheck: new Date(),
      consecutiveFailures: 0,
    };

    // Initialize LM Studio client
    this.initializeClient();

    // Start health monitoring if interval is configured
    if (config.healthCheckInterval > 0) {
      this.startHealthMonitoring();
    }
  }

  /**
   * Initialize the LM Studio SDK client
   */
  private initializeClient(): void {
    try {
      if (this.config.baseUrl) {
        this.client = new SDK({
          baseUrl: this.config.baseUrl
        });
      } else {
        // Use default SDK behavior (auto-detection)
        this.client = new SDK();
      }

      // Set up event listeners for the SDK client
      this.setupSDKEventListeners();
    } catch (error) {
      this.emit('initializationError', error);
    }
  }

  /**
   * Set up event listeners for SDK client
   */
  private setupSDKEventListeners(): void {
    // Note: LM Studio SDK may not expose these events directly
    // These are placeholders for when they become available
    
    try {
      // Check if client has event handling capabilities
      if (typeof (this.client as any).on === 'function') {
        (this.client as any).on('connect', () => {
          this.connectionStatus.connected = true;
          this.connectionStatus.consecutiveFailures = 0;
          this.emit('connected', this.connectionStatus);
        });

        (this.client as any).on('disconnect', () => {
          this.connectionStatus.connected = false;
          this.emit('disconnected');
          this.scheduleReconnect();
        });

        (this.client as any).on('error', (error: Error) => {
          this.connectionStatus.consecutiveFailures++;
          this.emit('connectionError', error);
        });
      }
    } catch (error) {
      // SDK doesn't support event handling, which is fine
      logger.debug('LM Studio SDK does not support direct event handling');
    }
  }

  /**
   * Test connection to LM Studio
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test basic SDK connectivity
      if (!this.client.llm) {
        throw new Error('LM Studio SDK not properly initialized');
      }

      // Try to list models as a connection test
      const models = await this.withTimeout(
        this.getModelList(),
        this.config.connectionTimeout
      );
      
      this.connectionStatus.connected = true;
      this.connectionStatus.modelCount = models.length;
      this.connectionStatus.consecutiveFailures = 0;
      this.connectionStatus.lastHealthCheck = new Date();
      
      // Count loaded models
      const loadedModels = await this.withTimeout(
        this.getLoadedModelList(),
        this.config.connectionTimeout
      );
      this.connectionStatus.loadedModelCount = loadedModels.length;
      
      this.emit('connected', this.connectionStatus);
      return true;
    } catch (error) {
      this.connectionStatus.connected = false;
      this.connectionStatus.consecutiveFailures++;
      this.connectionStatus.lastHealthCheck = new Date();
      
      this.emit('connectionError', error);
      return false;
    }
  }

  /**
   * Helper method to get model list with proper error handling
   */
  private async getModelList(): Promise<any[]> {
    try {
      // Try the expected API first
      if ((this.client as any).llm && typeof (this.client as any).llm.list === 'function') {
        return await (this.client as any).llm.list();
      }
      
      // Fallback to alternative API patterns
      if ((this.client as any).models && typeof (this.client as any).models.list === 'function') {
        return await this.client.models.list();
      }
      
      // If no list method is available, return empty array
      logger.warn('No model listing method available in LM Studio SDK');
      return [];
    } catch (error) {
      logger.error('Error listing models from LM Studio:', error);
      return [];
    }
  }

  /**
   * Helper method to get loaded model list with proper error handling
   */
  private async getLoadedModelList(): Promise<any[]> {
    try {
      // Try the expected API first
      if (this.client.llm && typeof this.client.llm.listLoaded === 'function') {
        return await this.client.llm.listLoaded();
      }
      
      // Fallback to alternative API patterns
      if (this.client.llm && typeof this.client.llm.getLoadedModels === 'function') {
        return await this.client.llm.getLoadedModels();
      }
      
      // If no loaded model method is available, return empty array
      logger.warn('No loaded model listing method available in LM Studio SDK');
      return [];
    } catch (error) {
      logger.error('Error listing loaded models from LM Studio:', error);
      return [];
    }
  }

  /**
   * List all available models
   */
  async listAllModels(): Promise<LMStudioModelInfo[]> {
    const operation = async () => {
      const models = await this.getModelList();
      return models.map(model => ({
        path: model.path || 'unknown',
        identifier: model.identifier || model.path || 'unknown',
        isLoaded: false, // Will be determined by listLoadedModels
        architecture: (model as any).architecture || 'unknown',
        size: (model as any).size || 'unknown',
        quantization: (model as any).quantization || 'unknown',
      }));
    };

    return this.executeWithRetry(operation);
  }

  /**
   * List currently loaded models
   */
  async listLoadedModels(): Promise<LMStudioModelInfo[]> {
    const operation = async () => {
      const models = await this.getLoadedModelList();
      return models.map(model => ({
        path: model.path,
        identifier: model.identifier || model.path,
        isLoaded: true,
        loadProgress: 100,
        architecture: model.architecture,
        size: model.size,
        quantization: model.quantization,
      }));
    };

    return this.executeWithRetry(operation);
  }

  /**
   * Complete text using specified model
   */
  async complete(request: LMStudioCompletionRequest): Promise<LMStudioCompletionResponse> {
    const operation = async () => {
      const model = await this.client.llm.model(request.modelPath);
      
      const response = await model.complete(request.prompt, {
        temperature: request.options?.temperature || 0.7,
        maxTokens: request.options?.maxTokens || 1000,
        topP: request.options?.topP,
        topK: request.options?.topK,
        frequencyPenalty: request.options?.frequencyPenalty,
        presencePenalty: request.options?.presencePenalty,
        stop: request.options?.stop,
        seed: request.options?.seed,
        ...request.options,
      });

      return {
        content: response.content,
        finishReason: response.finishReason,
        usage: response.usage ? {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
        } : undefined,
      };
    };

    return this.executeWithRetry(operation);
  }

  /**
   * Stream text completion using specified model
   */
  async completeStream(request: LMStudioCompletionRequest): Promise<AsyncIterable<LMStudioCompletionResponse>> {
    const operation = async () => {
      const model = await this.client.llm.model(request.modelPath);
      
      const stream = model.complete(request.prompt, {
        temperature: request.options?.temperature || 0.7,
        maxTokens: request.options?.maxTokens || 1000,
        ...request.options,
      });

      return this.transformStream(stream);
    };

    return this.executeWithRetry(operation);
  }

  /**
   * Chat with specified model
   */
  async chat(request: LMStudioChatRequest): Promise<LMStudioChatResponse> {
    const operation = async () => {
      const model = await this.client.llm.model(request.modelPath);
      
      const response = await model.respond(request.messages, {
        temperature: request.options?.temperature || 0.7,
        maxTokens: request.options?.maxTokens || 1000,
        ...request.options,
      });

      return {
        content: response.content,
        role: 'assistant',
        finishReason: response.finishReason,
        usage: response.usage ? {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
        } : undefined,
      };
    };

    return this.executeWithRetry(operation);
  }

  /**
   * Stream chat with specified model
   */
  async chatStream(request: LMStudioChatRequest): Promise<AsyncIterable<LMStudioChatResponse>> {
    const operation = async () => {
      const model = await this.client.llm.model(request.modelPath);
      
      const stream = model.respond(request.messages, {
        temperature: request.options?.temperature || 0.7,
        maxTokens: request.options?.maxTokens || 1000,
        ...request.options,
      });

      return this.transformChatStream(stream);
    };

    return this.executeWithRetry(operation);
  }

  /**
   * Use model for autonomous agent tasks (if supported)
   */
  async performAgentTask(request: LMStudioAgentRequest): Promise<any> {
    const operation = async () => {
      const model = await this.client.llm.model(request.modelPath);
      
      // Check if model supports .act() method
      if (typeof (model as any).act === 'function') {
        return await (model as any).act(request.task, request.tools || [], {
          maxSteps: request.options?.maxSteps || 10,
          temperature: request.options?.temperature || 0.7,
          ...request.options,
        });
      } else {
        throw new Error('Model does not support agent tasks');
      }
    };

    return this.executeWithRetry(operation);
  }

  /**
   * Load a model
   */
  async loadModel(modelPath: string): Promise<void> {
    const operation = async () => {
      const model = await this.client.llm.model(modelPath);
      
      // Try different load methods based on what's available
      if (typeof (model as any).load === 'function') {
        await (model as any).load();
      } else if (typeof (model as any).loadModel === 'function') {
        await (model as any).loadModel();
      } else {
        logger.warn(`No load method available for model: ${modelPath}`);
      }
    };

    await this.executeWithRetry(operation);
  }

  /**
   * Unload a model
   */
  async unloadModel(modelPath: string): Promise<void> {
    const operation = async () => {
      const model = await this.client.llm.model(modelPath);
      await model.unload?.();
    };

    await this.executeWithRetry(operation);
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): LMStudioConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Get client configuration
   */
  getConfig(): LMStudioConnectionConfig {
    return { ...this.config };
  }

  /**
   * Close connection and cleanup resources
   */
  async close(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.connectionStatus.connected = false;
    this.emit('disconnected');
  }

  /**
   * Update connection configuration
   */
  updateConfig(newConfig: Partial<LMStudioConnectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize client if baseUrl changed
    if (newConfig.baseUrl !== undefined) {
      this.initializeClient();
    }

    // Restart health monitoring if interval changed
    if (newConfig.healthCheckInterval !== undefined) {
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }
      
      if (newConfig.healthCheckInterval > 0) {
        this.startHealthMonitoring();
      }
    }

    this.emit('configUpdated', this.config);
  }

  // Private helper methods

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error = new Error('Operation failed with no attempts');
    
    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const result = await this.withTimeout(operation(), this.config.timeout);
        
        // Reset failure count on success
        if (this.connectionStatus.consecutiveFailures > 0) {
          this.connectionStatus.consecutiveFailures = 0;
          this.emit('recoverySuccess');
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        this.connectionStatus.consecutiveFailures++;
        
        this.emit('operationError', {
          error,
          attempt,
          maxAttempts: this.config.retryAttempts,
        });
        
        // Don't retry on the last attempt
        if (attempt === this.config.retryAttempts) {
          break;
        }
        
        // Wait before retrying with exponential backoff
        await this.delay(this.config.retryDelayMs * Math.pow(2, attempt));
      }
    }
    
    this.emit('operationFailed', lastError);
    throw lastError;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.testConnection();
    }, this.config.healthCheckInterval);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.initializeClient();
    }, this.config.websocketReconnectDelay);
  }

  private async* transformStream(stream: AsyncIterable<any>): AsyncIterable<LMStudioCompletionResponse> {
    for await (const chunk of stream) {
      yield {
        content: chunk.content || chunk.delta || '',
        finishReason: chunk.finishReason,
        usage: chunk.usage ? {
          promptTokens: chunk.usage.promptTokens,
          completionTokens: chunk.usage.completionTokens,
          totalTokens: chunk.usage.totalTokens,
        } : undefined,
      };
    }
  }

  private async* transformChatStream(stream: AsyncIterable<any>): AsyncIterable<LMStudioChatResponse> {
    for await (const chunk of stream) {
      yield {
        content: chunk.content || chunk.delta || '',
        role: 'assistant',
        finishReason: chunk.finishReason,
        usage: chunk.usage ? {
          promptTokens: chunk.usage.promptTokens,
          completionTokens: chunk.usage.completionTokens,
          totalTokens: chunk.usage.totalTokens,
        } : undefined,
      };
    }
  }
}

// Factory function for creating configured LM Studio clients
export function createLMStudioClient(config: Partial<LMStudioConnectionConfig> = {}): LMStudioClient {
  const defaultConfig: LMStudioConnectionConfig = {
    timeout: 30000,
    retryAttempts: 3,
    retryDelayMs: 1000,
    connectionTimeout: 5000,
    healthCheckInterval: 60000, // 1 minute
    websocketReconnectDelay: 5000,
  };

  return new LMStudioClient({ ...defaultConfig, ...config });
}