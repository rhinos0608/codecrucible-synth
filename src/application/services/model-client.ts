import { EventEmitter } from 'events';
import {
  IModelClient,
  ModelRequest,
  ModelResponse,
  StreamToken,
  ModelInfo,
} from '../../domain/interfaces/model-client.js';
import { ProviderAdapter } from './provider-adapters/index.js';
import { RequestProcessor, BasicRequestProcessor } from './request-processor.js';
import { ResponseHandler, BasicResponseHandler } from './response-handler.js';
import { IStreamingManager, StreamingManager } from './streaming-manager.js';
import { ILogger } from '../../domain/interfaces/logger.js';
import { logger as defaultLogger } from '../../infrastructure/logging/unified-logger.js';
import {
  enterpriseErrorHandler,
  EnterpriseErrorHandler,
} from '../../infrastructure/error-handling/enterprise-error-handler.js';
import {
  ErrorCategory,
  ErrorSeverity,
} from '../../infrastructure/error-handling/structured-error-system.js';

export interface ModelClientOptions {
  adapters: ProviderAdapter[];
  defaultProvider?: string;
  providers?: any[];
  fallbackStrategy?: string;
  executionMode?: string;
  fallbackChain?: string[];
  timeout?: number;
  retryAttempts?: number;
  enableCaching?: boolean;
  enableMetrics?: boolean;
  performanceThresholds?: {
    maxLatency?: number;
    maxTokensPerSecond?: number;
    maxMemoryUsage?: number;
    fastModeMaxTokens?: number;
    timeoutMs?: number;
    maxConcurrentRequests?: number;
  };
  security?: {
    enableSandbox?: boolean;
    maxInputLength?: number;
    allowedCommands?: string[];
    enableRateLimit?: boolean;
    maxRequestsPerMinute?: number;
    enableCors?: boolean;
    corsOrigins?: string[];
  };
  requestProcessor?: RequestProcessor;
  responseHandler?: ResponseHandler;
  streamingManager?: IStreamingManager;
  logger?: ILogger;
}

export class ModelClient extends EventEmitter implements IModelClient {
  private adapters: Map<string, ProviderAdapter>;
  private requestProcessor: RequestProcessor;
  private responseHandler: ResponseHandler;
  private streamingManager: IStreamingManager;
  private logger: ILogger;

  constructor(options: ModelClientOptions) {
    super();
    this.adapters = new Map(options.adapters.map(a => [a.name, a]));
    this.requestProcessor = options.requestProcessor ?? new BasicRequestProcessor();
    this.responseHandler = options.responseHandler ?? new BasicResponseHandler();
    this.streamingManager = options.streamingManager ?? new StreamingManager();
    this.logger = options.logger ?? defaultLogger;
  }

  private getAdapter(name?: string): ProviderAdapter {
    // If no specific provider requested, return first available
    if (!name) {
      // CRITICAL FIX: Instead of blindly returning first adapter, try to be smart about it
      // Check if we have an ollama adapter and prefer it for common models
      for (const adapter of this.adapters.values()) {
        if (adapter.name === 'ollama') {
          this.logger.debug('🔧 Auto-selected Ollama adapter as no provider specified');
          return adapter;
        }
      }

      // Fallback to first available if no ollama adapter found
      const first = this.adapters.values().next().value;
      if (!first) {
        const error = EnterpriseErrorHandler.createEnterpriseError(
          'No provider adapters configured for AI models',
          ErrorCategory.SYSTEM,
          ErrorSeverity.CRITICAL,
          {
            operation: 'model_adapter_selection',
            resource: 'ai_providers',
            context: { configuredProviders: 0, systemPhase: 'initialization' },
          }
        );
        throw error;
      }
      this.logger.debug(`🔧 Using fallback adapter: ${first.name}`);
      return first;
    }

    // If specific provider requested, fail fast if not found
    if (this.adapters.has(name)) {
      return this.adapters.get(name)!;
    }

    // Fail fast instead of silent fallback
    const availableProviders = Array.from(this.adapters.keys());
    const error = EnterpriseErrorHandler.createEnterpriseError(
      `Requested provider '${name}' not found. Available providers: ${availableProviders.join(', ')}`,
      ErrorCategory.CONFIGURATION,
      ErrorSeverity.HIGH,
      {
        operation: 'model_adapter_selection',
        resource: 'ai_provider',
        context: {
          requestedProvider: name,
          availableProviders,
          configuredProviders: this.adapters.size,
        },
      }
    );
    throw error;
  }

  async request(request: ModelRequest): Promise<ModelResponse> {
    try {
      const processed = this.requestProcessor.process(request);
      const adapter = this.getAdapter(processed.provider);
      const raw = await adapter.request(processed);
      return this.responseHandler.parse(raw, adapter.name);
    } catch (err) {
      // Use enterprise error handler for AI provider failures
      const structuredError = await enterpriseErrorHandler.handleEnterpriseError(err as Error, {
        operation: 'ai_model_generation',
        resource: 'ai_provider',
        context: {
          modelName: request.model,
          promptLength: request.prompt?.length || 0,
          provider: 'unknown',
        },
      });

      // Always throw the structured error to prevent undefined returns
      throw structuredError;
    }
  }

  async generate(prompt: string, options: any = {}): Promise<string> {
    try {
      const response = await this.request({ prompt, ...options });
      return response?.content || '';
    } catch (err) {
      // Use enterprise error handler for generation failures
      const structuredError = await enterpriseErrorHandler.handleEnterpriseError(err as Error, {
        operation: 'ai_text_generation',
        resource: 'ai_provider',
        context: {
          prompt: prompt.substring(0, 100),
          options: JSON.stringify(options).substring(0, 100),
        },
      });

      this.logger.error('ModelClient.generate() failed:', {
        errorId: structuredError.id,
        message: structuredError.message,
        category: structuredError.category,
        severity: structuredError.severity,
        retryable: structuredError.retryable,
      });

      throw structuredError;
    }
  }

  async *stream(request: ModelRequest): AsyncIterableIterator<StreamToken> {
    const processed = this.requestProcessor.process(request);
    const adapter = this.getAdapter(processed.provider);
    for await (const token of this.streamingManager.stream(adapter, processed)) {
      yield {
        ...token,
        isComplete: token.isComplete ?? false,
        index: token.index ?? 0,
        timestamp: token.timestamp ?? Date.now(),
      };
    }
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];
    for (const adapter of this.adapters.values()) {
      const list = adapter.getModels ? await adapter.getModels() : [];
      for (const id of list) {
        models.push({ id, name: id, provider: adapter.name, capabilities: [] });
      }
    }
    return models;
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  async initialize(): Promise<void> {
    this.logger.info('ModelClient initialized');
  }

  async shutdown(): Promise<void> {
    this.logger.info('ModelClient shutdown');
  }

  async destroy(): Promise<void> {
    await this.shutdown();
  }

  // Core interfaces compatibility methods
  async processRequest(request: ModelRequest, context?: any): Promise<ModelResponse> {
    return this.request(request);
  }

  async streamRequest(
    request: ModelRequest,
    onToken: (token: StreamToken) => void,
    context?: any
  ): Promise<ModelResponse> {
    const tokens: StreamToken[] = [];
    for await (const token of this.stream(request)) {
      tokens.push(token);
      onToken(token);
    }

    // Reconstruct response from tokens
    const content = tokens.map(t => t.content).join('');
    return {
      id: `stream_${Date.now()}`,
      content,
      model: request.model || 'unknown',
      provider: 'stream',
    };
  }

  async generateText(prompt: string, options?: Record<string, unknown>): Promise<string> {
    return this.generate(prompt, options);
  }

  async synthesize(request: ModelRequest): Promise<ModelResponse> {
    return this.request(request);
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const isHealthy = await this.isHealthy();
    return { healthy: isHealthy };
  }

  getProviders(): Map<string, unknown> {
    return new Map(Array.from(this.adapters.entries()));
  }
}

export { ModelClient as UnifiedModelClient };
