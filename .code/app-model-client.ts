import { EventEmitter } from 'events';
import {
  IModelClient,
  ModelInfo,
  ModelRequest,
  ModelResponse,
  StreamToken,
} from '../../domain/interfaces/model-client.js';
import { ProviderAdapter } from './provider-adapters/index.js';
import { BasicRequestProcessor, RequestProcessor } from './request-processor.js';
import { BasicResponseHandler, ResponseHandler } from './response-handler.js';
import { IStreamingManager, StreamingManager } from './streaming-manager.js';
import { ILogger } from '../../domain/interfaces/logger.js';
import { logger as defaultLogger } from '../../infrastructure/logging/unified-logger.js';
import {
  EnterpriseErrorHandler,
  enterpriseErrorHandler,
} from '../../infrastructure/error-handling/enterprise-error-handler.js';
import {
  ErrorCategory,
  ErrorSeverity,
} from '../../infrastructure/error-handling/structured-error-system.js';

export interface ModelClientOptions {
  adapters: ProviderAdapter[];
  defaultProvider?: string;
  providers?: ProviderAdapter[];
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
  private readonly adapters: Map<string, ProviderAdapter>;
  private readonly requestProcessor: RequestProcessor;
  private readonly responseHandler: ResponseHandler;
  private readonly streamingManager: IStreamingManager;
  private readonly logger: ILogger;

  public constructor(options: Readonly<ModelClientOptions>) {
    super();
    this.adapters = new Map((options.adapters as readonly ProviderAdapter[]).map(a => [a.name, a]));
    this.requestProcessor = options.requestProcessor ?? new BasicRequestProcessor();
    this.responseHandler = options.responseHandler ?? new BasicResponseHandler();
    this.streamingManager = options.streamingManager ?? new StreamingManager();
    this.logger = options.logger ?? (defaultLogger as ILogger);
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
        throw new Error(error.message);
      }
      this.logger.debug(`🔧 Using fallback adapter: ${first.name}`);
      return first;
    }

    // If specific provider requested, fail fast if not found
    if (this.adapters.has(name)) {
      const adapter = this.adapters.get(name);
      if (adapter) {
        return adapter;
      } else {
        throw new Error(`Provider adapter '${name}' is undefined.`);
      }
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
    throw new Error(error.message);
  }

  public async request(request: Readonly<ModelRequest>): Promise<ModelResponse> {
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
          promptLength: request.prompt.length || 0,
          provider: 'unknown',
        },
      });

      // Always throw the structured error to prevent undefined returns
      throw new Error(structuredError.message);
    }
  }

  public async generate(prompt: string, options: Partial<ModelRequest> = {}): Promise<string> {
    try {
      const requestObj: Readonly<ModelRequest> = { prompt, ...options };
      const response = await this.request(requestObj);
      return response.content || '';
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

      throw new Error(structuredError.message);
    }
  }

  public async *stream(request: Readonly<ModelRequest>): AsyncIterableIterator<StreamToken> {
    const processed = this.requestProcessor.process(request);
    const adapter = this.getAdapter(processed.provider);
    for await (const tokenRaw of this.streamingManager.stream(adapter, processed)) {
      const token: StreamToken = tokenRaw as StreamToken;
      yield {
        ...token,
        // Safely assign isComplete if it exists, otherwise default to false
        isComplete: typeof token.isComplete === 'boolean' ? token.isComplete : false,
        // index and timestamp are assumed to exist on StreamToken, so no need for nullish coalescing
        index: token.index,
        timestamp: token.timestamp,
      };
    }
  }

  public async getAvailableModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];
    for (const adapter of this.adapters.values()) {
      const list = adapter.getModels ? await adapter.getModels() : [];
      for (const id of list) {
        models.push({ id, name: id, provider: adapter.name, capabilities: [] });
      }
    }
    return models;
  }

  public async isHealthy(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public async initialize(): Promise<void> {
    this.logger.info('ModelClient initialized');
    await Promise.resolve();
  }

  public async shutdown(): Promise<void> {
    this.logger.info('ModelClient shutdown');
    await Promise.resolve();
  }

  public async destroy(): Promise<void> {
    await this.shutdown();
  }

  // Core interfaces compatibility methods
  public async processRequest(request: Readonly<ModelRequest>, _context?: Readonly<unknown>): Promise<ModelResponse> {
    return this.request(request);
  }

  public async streamRequest(
    request: Readonly<ModelRequest>,
    onToken: (token: Readonly<StreamToken>) => void,
    _context?: unknown
  ): Promise<ModelResponse> {
    const tokens: Readonly<StreamToken>[] = [];

    // CRITICAL FIX: We need to get the full response including tool calls
    // First, make a non-streaming request to get the complete response with tool calls
    const fullResponse = await this.request({ ...request, stream: false });

    // Then stream the tokens for display
    if (request.stream && fullResponse.content) {
      // If there's content to stream, simulate streaming for UX
      const chunks = fullResponse.content.split(' ');
      for (let i = 0; i < chunks.length; i++) {
        const token: StreamToken = {
          content: chunks[i] + (i < chunks.length - 1 ? ' ' : ''),
          isComplete: i === chunks.length - 1,
          index: i,
          timestamp: Date.now(),
        };
        tokens.push(token);
        onToken(token);
        // Add small delay to simulate streaming
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    }

    // Return the full response (including tool calls) but with any streamed content updates
    const streamedContent = tokens.map((t: Readonly<StreamToken>) => t.content).join('');
    return {
      ...fullResponse, // Preserve tool calls, usage, etc.
      content: streamedContent || fullResponse.content, // Use streamed content if available
    };
  }

  public async generateText(prompt: Readonly<string>, options?: Readonly<Record<string, unknown>>): Promise<string> {
    return this.generate(prompt, options);
  }

  public async synthesize(request: Readonly<ModelRequest>): Promise<ModelResponse> {
    return this.request(request);
  }

  public async healthCheck(): Promise<Readonly<Record<string, boolean>>> {
    const isHealthy = await this.isHealthy();
    return { healthy: isHealthy };
  }

  public getProviders(): Map<string, unknown> {
    return new Map(Array.from(this.adapters.entries()));
  }
}

export { ModelClient as UnifiedModelClient };

