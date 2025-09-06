/**
 * Pure Ollama Infrastructure Client
 * Handles only connection management and API communication
 *
 * Architecture Compliance:
 * - Infrastructure layer: concrete implementation only
 * - No business logic for model selection or optimization
 * - Pure HTTP client with error handling and retry logic
 * - No module-level mutable state
 */

import { Ollama } from 'ollama';
import { EventEmitter } from 'events';

export interface OllamaConnectionConfig {
  endpoint: string;
  timeout: number;
  retryAttempts: number;
  retryDelayMs: number;
  connectionTimeout: number;
  healthCheckInterval: number;
}

export interface OllamaModelInfo {
  name: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
  modified_at: string;
}

export interface OllamaGenerationRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    num_ctx?: number;
    num_predict?: number;
    top_k?: number;
    top_p?: number;
    repeat_penalty?: number;
    seed?: number;
    [key: string]: unknown;
  };
}

export interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  options?: Record<string, unknown>;
}

export interface OllamaResponse {
  response?: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaChatResponse {
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaConnectionStatus {
  connected: boolean;
  modelCount: number;
  serverVersion?: string;
  lastHealthCheck: Date;
  consecutiveFailures: number;
}

/**
 * Pure Ollama HTTP Client
 * Handles only connection management and API communication
 */
export class OllamaClient extends EventEmitter {
  private client: Ollama;
  private config: OllamaConnectionConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private readonly connectionStatus: OllamaConnectionStatus;

  public constructor(config: Readonly<OllamaConnectionConfig>) {
    super();
    this.config = config;

    // Initialize connection status
    this.connectionStatus = {
      connected: false,
      modelCount: 0,
      lastHealthCheck: new Date(),
      consecutiveFailures: 0,
    };

    // Initialize Ollama client with timeout configuration
    this.client = new Ollama({
      host: config.endpoint,
    });

    // Start health monitoring if interval is configured
    if (config.healthCheckInterval > 0) {
      this.startHealthMonitoring();
    }
  }

  /**
   * Test connection to Ollama server
   */
  public async testConnection(): Promise<boolean> {
    try {
      const models = await this.withTimeout(this.client.list(), this.config.connectionTimeout);

      this.connectionStatus.connected = true;
      this.connectionStatus.modelCount = models.models.length;
      this.connectionStatus.consecutiveFailures = 0;
      this.connectionStatus.lastHealthCheck = new Date();

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
   * List available models from Ollama server
   */
  public async listModels(): Promise<OllamaModelInfo[]> {
    const operation = async (): Promise<OllamaModelInfo[]> => {
      const response = await this.client.list();

      // Transform ModelResponse to OllamaModelInfo format
      return response.models.map((model: unknown) => {
        // Type guard to check if model is OllamaModelInfo-like
        if (
          typeof model === 'object' &&
          model !== null &&
          'name' in model &&
          'size' in model &&
          'digest' in model &&
          'details' in model &&
          'modified_at' in model
        ) {
          const m = model as {
            name: string;
            size: number;
            digest: string;
            details: {
              format: string;
              family: string;
              families: string[];
              parameter_size: string;
              quantization_level: string;
            };
            modified_at: unknown;
          };
          let modifiedAt: string;
          if (m.modified_at instanceof Date) {
            modifiedAt = m.modified_at.toISOString();
          } else if (typeof m.modified_at === 'string') {
            modifiedAt = m.modified_at;
          } else {
            modifiedAt = new Date(String(m.modified_at)).toISOString();
          }
          return {
            name: m.name,
            size: m.size,
            digest: m.digest,
            details: m.details,
            modified_at: modifiedAt,
          } as OllamaModelInfo;
        }
        throw new Error('Invalid model format received from Ollama server');
      });
    };

    return this.executeWithRetry(operation);
  }

  /**
   * Generate text using specified model
   */
  public async generateText(request: Readonly<OllamaGenerationRequest>): Promise<OllamaResponse> {
    const operation = async (): Promise<OllamaResponse> => {
      return this.client.generate({
        model: request.model,
        prompt: request.prompt,
        stream: false,
        options: request.options ?? {},
      });
    };

    return this.executeWithRetry(operation);
  }

  /**
   * Generate streaming text using specified model
   */
  public async generateTextStream(
    request: Readonly<OllamaGenerationRequest>
  ): Promise<AsyncIterable<OllamaResponse>> {
    const operation = async (): Promise<AsyncIterable<OllamaResponse>> => {
      return this.client.generate({
        model: request.model,
        prompt: request.prompt,
        stream: true,
        options: request.options ?? {},
      });
    };

    const stream = await this.executeWithRetry(operation);
    return stream;
  }

  /**
   * Chat with specified model
   */
  public async chat(request: Readonly<OllamaChatRequest>): Promise<OllamaChatResponse> {
    const operation = async (): Promise<OllamaChatResponse> => {
      return this.client.chat({
        model: request.model,
        messages: request.messages,
        stream: false,
        options: request.options ?? {},
      });
    };

    return this.executeWithRetry(operation);
  }

  /**
   * Chat streaming with specified model
   */
  public async chatStream(request: Readonly<OllamaChatRequest>): Promise<AsyncIterable<OllamaChatResponse>> {
    const operation = async (): Promise<AsyncIterable<OllamaChatResponse>> => {
      return this.client.chat({
        model: request.model,
        messages: request.messages,
        stream: true,
        options: request.options ?? {},
      });
    };

    const stream = await this.executeWithRetry(operation);
    return stream;
  }

  /**
   * Pull a model from Ollama registry
   */
  public async pullModel(modelName: string): Promise<void> {
    const operation = async (): Promise<void> => {
      await this.client.pull({ model: modelName });
    };

    await this.executeWithRetry(operation);
  }

  /**
   * Delete a model from Ollama server
   */
  public async deleteModel(modelName: string): Promise<void> {
    const operation: () => Promise<void> = async () => {
      await this.client.delete({ model: modelName });
    };

    await this.executeWithRetry(operation);
  }

  /**
   * Get current connection status
   */
  public getConnectionStatus(): OllamaConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Get server configuration
   */
  public getConfig(): OllamaConnectionConfig {
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

    this.connectionStatus.connected = false;
    this.emit('disconnected');
  }

  /**
   * Update connection configuration
   */
  public updateConfig(newConfig: Readonly<Partial<OllamaConnectionConfig>>): void {
    this.config = { ...this.config, ...newConfig };

    // Reinitialize client if endpoint changed
    if (newConfig.endpoint) {
      this.client = new Ollama({
        host: newConfig.endpoint,
      });
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

        // Wait before retrying
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

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      // Fire and forget, do not return a Promise
      void this.testConnection();
    }, this.config.healthCheckInterval);
  }
}

// Factory function for creating configured Ollama clients
export function createOllamaClient(config: Readonly<Partial<OllamaConnectionConfig>> = {}): OllamaClient {
  const defaultConfig: OllamaConnectionConfig = {
    endpoint: 'http://localhost:11434',
    timeout: 30000,
    retryAttempts: 3,
    retryDelayMs: 1000,
    connectionTimeout: 5000,
    healthCheckInterval: 60000, // 1 minute
  };

  return new OllamaClient({ ...defaultConfig, ...config });
}
