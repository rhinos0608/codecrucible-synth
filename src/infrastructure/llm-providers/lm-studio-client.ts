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
import { logger } from '../../infrastructure/logging/logger.js';

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
    [key: string]: unknown;
  };
}

export interface LMStudioChatRequest {
  modelPath: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  options?: Record<string, unknown>;
}

export interface LMStudioAgentRequest {
  modelPath: string;
  task: string;
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  options?: {
    maxSteps?: number;
    temperature?: number;
    [key: string]: unknown;
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

// Define a type for loaded models (moved from inside the class)
interface LoadedModel {
  path: string;
  identifier?: string;
  architecture?: string;
  size?: string;
  quantization?: string;
  [key: string]: unknown;
}

/**
 * Pure LM Studio SDK Client
 * Handles only connection management and API communication
 */
export class LMStudioClient extends EventEmitter {
  private client: SDK;
  private config: LMStudioConnectionConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private readonly connectionStatus: LMStudioConnectionStatus;
  private reconnectTimer?: NodeJS.Timeout;

  public constructor(config: Readonly<LMStudioConnectionConfig>) {
    super();
    this.config = config;

    // Initialize SDK client
    const baseUrl = config.baseUrl ?? `http://${config.host ?? 'localhost'}:${config.port ?? 1234}`;
    this.client = new SDK({
      baseUrl,
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
     * Start periodic health monitoring
     */
    private startHealthMonitoring(): void {
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }
      this.healthCheckTimer = setInterval(() => {
        // Call the async function but don't return the Promise
        this.testConnection().catch((error) => {
          logger.error('Health check failed:', error instanceof Error ? error : new Error(String(error)));
        });
      }, this.config.healthCheckInterval);
    }

  /**
   * Initialize the LM Studio SDK client
   */
  private initializeClient(): void {
    try {
      if (this.config.baseUrl) {
        this.client = new SDK({
          baseUrl: this.config.baseUrl,
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

    // Define a minimal EventEmitter-like interface for type safety
    interface SDKEventEmitter {
      on: (event: 'connect' | 'disconnect' | 'error', listener: (...args: readonly unknown[]) => void) => this;
    }

    try {
      const sdkClient = this.client as unknown;
      if (
        sdkClient &&
        typeof (sdkClient as SDKEventEmitter).on === 'function'
      ) {
        (sdkClient as SDKEventEmitter).on('connect', () => {
          this.connectionStatus.connected = true;
          this.connectionStatus.consecutiveFailures = 0;
          this.emit('connected', this.connectionStatus);
        });

        (sdkClient as SDKEventEmitter).on('disconnect', () => {
          this.connectionStatus.connected = false;
          this.emit('disconnected');
          this.scheduleReconnect();
        });

        (sdkClient as SDKEventEmitter).on('error', (...args: readonly unknown[]) => {
          this.connectionStatus.consecutiveFailures++;
          const [error] = args;
          this.emit('connectionError', error);
        });
      }
    } catch (error) {
      // SDK doesn't support event handling, which is fine
      logger.debug('LM Studio SDK does not support direct event handling');
    }
  }


  /**
   * Helper to add a timeout to a promise
   */

  /**
   * Test connection to LM Studio
   */
  public async testConnection(): Promise<boolean> {
    try {
      // Try to list models as a connection test
      const models = await this.withTimeout(this.getModelList(), this.config.connectionTimeout);

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
  private async getModelList(): Promise<Record<string, unknown>[]> {
    try {
      // Define minimal interfaces for type safety
      interface LLMClient {
        list: () => Promise<Record<string, unknown>[]>;
      }
      interface ModelsClient {
        list: () => Promise<Record<string, unknown>[]>;
      }
      // Try the expected API first
      const { llm } = this.client as unknown as { llm?: LLMClient };
      if (llm && typeof llm.list === 'function') {
        return await llm.list();
      }

      // Fallback to alternative API patterns
      const { models } = this.client as unknown as { models?: ModelsClient };
      if (models && typeof models.list === 'function') {
        return await models.list();
      }

      // If no list method is available, return empty array
      return [];
    } catch (error) {
      logger.error('Error listing models from LM Studio:', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  private async getLoadedModelList(): Promise<LoadedModel[]> {
    try {
      // Try the expected API first
      if (typeof this.client.llm?.listLoaded === 'function') {
        const result = await this.client.llm.listLoaded();
        return Array.isArray(result) ? (result as unknown as LoadedModel[]) : [];
      }

      // Fallback to alternative API patterns
      const llmAny = this.client.llm as unknown as { getLoadedModels?: () => Promise<LoadedModel[]> };
      if (typeof llmAny?.getLoadedModels === 'function') {
        const result = await llmAny.getLoadedModels();
        return Array.isArray(result) ? result : [];
      }

      // If no loaded model method is available, return empty array
      logger.warn('No loaded model listing method available in LM Studio SDK');
      return [];
    } catch (error) {
      logger.error('Error listing loaded models from LM Studio:', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * List all available models
   */
  public async listAllModels(): Promise<LMStudioModelInfo[]> {
    const operation = async (): Promise<LMStudioModelInfo[]> => {
      const models = await this.getModelList();
      return models.map((model: Readonly<Record<string, unknown>>) => {
        // Use type assertion or type guard to ensure safe property access
        const m = model as Partial<LMStudioModelInfo>;
        return {
          path: typeof m.path === 'string' ? m.path : 'unknown',
          identifier: typeof m.identifier === 'string'
            ? m.identifier
            : typeof m.path === 'string'
            ? m.path
            : 'unknown',
          isLoaded: false, // Will be determined by listLoadedModels
          architecture: typeof m.architecture === 'string' ? m.architecture : 'unknown',
          size: typeof m.size === 'string' ? m.size : 'unknown',
          quantization: typeof m.quantization === 'string' ? m.quantization : 'unknown',
        };
      });
    };

    return this.executeWithRetry(operation);
  }

  /**
   * List currently loaded models
   */
  public async listLoadedModels(): Promise<LMStudioModelInfo[]> {
    const operation = async (): Promise<LMStudioModelInfo[]> => {
      const models = await this.getLoadedModelList();
      return models.map((model: Readonly<LoadedModel>) => ({
        path: model.path,
        identifier: model.identifier ?? model.path,
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
  public async complete(
    request: Readonly<LMStudioCompletionRequest>
  ): Promise<LMStudioCompletionResponse> {
    interface SDKCompletionResponse {
      content: string;
      finishReason?: string;
      usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    }

    const operation = async (): Promise<LMStudioCompletionResponse> => {
      const model = await this.client.llm.model(request.modelPath);

      const response: SDKCompletionResponse = await model.complete(request.prompt, {
        temperature: request.options?.temperature ?? 0.7,
        maxTokens: request.options?.maxTokens ?? 1000,
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
        usage: response.usage
          ? {
              promptTokens: response.usage.promptTokens,
              completionTokens: response.usage.completionTokens,
              totalTokens: response.usage.totalTokens,
            }
          : undefined,
      };
    };

    return this.executeWithRetry(operation);
  }

  /**
   * Stream text completion using specified model
   */
  public async completeStream(
    request: Readonly<LMStudioCompletionRequest>
  ): Promise<AsyncIterable<LMStudioCompletionResponse>> {
    const operation = async (): Promise<AsyncIterable<LMStudioCompletionResponse>> => {
      const model = await this.client.llm.model(request.modelPath);

      const stream = model.complete(request.prompt, {
        temperature: request.options?.temperature ?? 0.7,
        maxTokens: request.options?.maxTokens ?? 1000,
        ...request.options,
      });

      return this.transformStream(stream);
    };

    return this.executeWithRetry(operation);
  }

  /**
   * Chat with specified model
   */
  public async chat(request: Readonly<LMStudioChatRequest>): Promise<LMStudioChatResponse> {
    interface SDKChatResponse {
      content: string;
      finishReason?: string;
      usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    }

    const operation = async (): Promise<LMStudioChatResponse> => {
      const model = await this.client.llm.model(request.modelPath);

      const temperature =
        typeof request.options?.temperature === 'number'
          ? request.options.temperature
          : 0.7;
      const maxTokens =
        typeof request.options?.maxTokens === 'number'
          ? request.options.maxTokens
          : 1000;

      const response: SDKChatResponse = await model.respond(request.messages, {
        temperature,
        maxTokens,
        ...request.options,
      });

      return {
        content: response.content,
        role: 'assistant',
        finishReason: response.finishReason,
        usage: response.usage
          ? {
              promptTokens: response.usage.promptTokens,
              completionTokens: response.usage.completionTokens,
              totalTokens: response.usage.totalTokens,
            }
          : undefined,
      };
    };

    return this.executeWithRetry(operation);
  }

  /**
   * Stream chat with specified model
   */
  public async chatStream(
    request: Readonly<LMStudioChatRequest>
  ): Promise<AsyncIterable<LMStudioChatResponse>> {
    const operation = async (): Promise<AsyncIterable<LMStudioChatResponse>> => {
      const model = await this.client.llm.model(request.modelPath);

      const temperature =
        typeof request.options?.temperature === 'number'
          ? request.options.temperature
          : 0.7;
      const maxTokens =
        typeof request.options?.maxTokens === 'number'
          ? request.options.maxTokens
          : 1000;

      const stream = model.respond(request.messages, {
        temperature,
        maxTokens,
        ...request.options,
      });

      return this.transformChatStream(stream);
    };

    return this.executeWithRetry(operation);
  }

  /**
   * Use model for autonomous agent tasks (if supported)
   */
  public async performAgentTask(
    request: Readonly<LMStudioAgentRequest>
  ): Promise<unknown> {
    // Define an interface for models supporting act with readonly parameters
    interface AgentCapableModel {
      act: (
        task: string,
        tools: ReadonlyArray<{
          readonly name: string;
          readonly description: string;
          readonly parameters: Readonly<Record<string, unknown>>;
        }>,
        options: Readonly<{ maxSteps?: number; temperature?: number; [key: string]: unknown }>
      ) => Promise<unknown>;
    }

    const operation = async (): Promise<unknown> => {
      const model = await this.client.llm.model(request.modelPath);

      const maybeAgentModel = model as unknown as AgentCapableModel;
      if (typeof maybeAgentModel.act === 'function') {
        return maybeAgentModel.act(
          request.task,
          (request.tools ?? []) as ReadonlyArray<{
            readonly name: string;
            readonly description: string;
            readonly parameters: Readonly<Record<string, unknown>>;
          }>,
          {
            maxSteps: request.options?.maxSteps ?? 10,
            temperature: request.options?.temperature ?? 0.7,
            ...request.options,
          }
        );
      } else {
        throw new Error('Model does not support agent tasks');
      }
    };

    return this.executeWithRetry(operation);
  }

  /**
   * Load a model
   */
  public async loadModel(modelPath: string): Promise<void> {
    interface LoadableModel {
      load?: () => Promise<void>;
      loadModel?: () => Promise<void>;
    }

    const operation = async (): Promise<void> => {
      const model = await this.client.llm.model(modelPath) as LoadableModel;

      // Try different load methods based on what's available
      if (typeof model.load === 'function') {
        await model.load();
      } else if (typeof model.loadModel === 'function') {
        await model.loadModel();
      } else {
        logger.warn(`No load method available for model: ${modelPath}`);
      }
    };

    await this.executeWithRetry(operation);
  }

  /**
   * Unload a model
   */
  public async unloadModel(modelPath: string): Promise<void> {
    const operation = async (): Promise<void> => {
      const model = await this.client.llm.model(modelPath);
      await model.unload();
    };

    await this.executeWithRetry(operation);
  }

  /**
   * Get current connection status
   */
  public getConnectionStatus(): LMStudioConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Get client configuration
   */
  public getConfig(): LMStudioConnectionConfig {
    return { ...this.config };
  }

  /**
   * Close connection and cleanup resources
   */
  public close(): void {
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
  public updateConfig(newConfig: Readonly<Partial<LMStudioConnectionConfig>>): void {
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

  private async withTimeout<T>(promise: Readonly<Promise<T>>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => { reject(new Error(`Operation timed out after ${timeoutMs}ms`)); }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  /**
   * Schedule a reconnect attempt after a delay
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.initializeClient();
    }, this.config.websocketReconnectDelay);
  }

  /**
   * Transform a completion stream to LMStudioCompletionResponse
   */
  private async *transformStream(
    stream: Readonly<AsyncIterable<{
      content?: string;
      delta?: string;
      finishReason?: string;
      usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    }>>
  ): AsyncIterable<LMStudioCompletionResponse> {
    for await (const chunk of stream) {
      const content = typeof chunk.content === 'string'
        ? chunk.content
        : typeof chunk.delta === 'string'
        ? chunk.delta
        : '';
      const finishReason = typeof chunk.finishReason === 'string' ? chunk.finishReason : undefined;
      const usage =
        chunk.usage &&
        typeof chunk.usage.promptTokens === 'number' &&
        typeof chunk.usage.completionTokens === 'number' &&
        typeof chunk.usage.totalTokens === 'number'
          ? {
              promptTokens: chunk.usage.promptTokens,
              completionTokens: chunk.usage.completionTokens,
              totalTokens: chunk.usage.totalTokens,
            }
          : undefined;

      yield {
        content,
        finishReason,
        usage,
      };
    }
  }

  /**
   * Transform a chat stream to LMStudioChatResponse
   */
  private async *transformChatStream(
    stream: Readonly<AsyncIterable<{
      readonly content?: string;
      readonly delta?: string;
      readonly finishReason?: string;
      readonly usage?: {
        readonly promptTokens: number;
        readonly completionTokens: number;
        readonly totalTokens: number;
      };
    }>>
  ): AsyncIterable<LMStudioChatResponse> {
    for await (const chunk of stream) {
      const content =
        typeof chunk.content === 'string'
          ? chunk.content
          : typeof chunk.delta === 'string'
          ? chunk.delta
          : '';
      const finishReason =
        typeof chunk.finishReason === 'string' ? chunk.finishReason : undefined;
      const usage =
        chunk.usage &&
        typeof chunk.usage.promptTokens === 'number' &&
        typeof chunk.usage.completionTokens === 'number' &&
        typeof chunk.usage.totalTokens === 'number'
          ? {
              promptTokens: chunk.usage.promptTokens,
              completionTokens: chunk.usage.completionTokens,
              totalTokens: chunk.usage.totalTokens,
            }
          : undefined;

      yield {
        content,
        role: 'assistant',
        finishReason,
        usage,
      };
    }
  }
}

// Factory function for creating configured LM Studio clients
export function createLMStudioClient(
  config: Readonly<Partial<LMStudioConnectionConfig>> = {}
): LMStudioClient {
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
