import { EventEmitter } from 'events';
import {
  IModelClient,
  ModelRequest,
  ModelResponse,
  StreamToken,
  ModelInfo,
} from '../../domain/interfaces/model-client.js';
import { ProviderAdapter } from './provider-adapters.js';
import { RequestProcessor, BasicRequestProcessor } from './request-processor.js';
import { ResponseHandler, BasicResponseHandler } from './response-handler.js';
import { StreamingManager, BasicStreamingManager } from './streaming-manager.js';
import { ILogger } from '../../domain/interfaces/logger.js';
import { logger as defaultLogger } from '../../infrastructure/logging/unified-logger.js';

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
  streamingManager?: StreamingManager;
  logger?: ILogger;
}

export class ModelClient extends EventEmitter implements IModelClient {
  private adapters: Map<string, ProviderAdapter>;
  private requestProcessor: RequestProcessor;
  private responseHandler: ResponseHandler;
  private streamingManager: StreamingManager;
  private logger: ILogger;

  constructor(options: ModelClientOptions) {
    super();
    this.adapters = new Map(options.adapters.map(a => [a.name, a]));
    this.requestProcessor = options.requestProcessor ?? new BasicRequestProcessor();
    this.responseHandler = options.responseHandler ?? new BasicResponseHandler();
    this.streamingManager = options.streamingManager ?? new BasicStreamingManager();
    this.logger = options.logger ?? defaultLogger;
  }

  private getAdapter(name?: string): ProviderAdapter {
    if (name && this.adapters.has(name)) return this.adapters.get(name)!;
    const first = this.adapters.values().next().value;
    if (!first) throw new Error('No provider adapters configured');
    return first;
  }

  async request(request: ModelRequest): Promise<ModelResponse> {
    try {
      const processed = this.requestProcessor.process(request);
      const adapter = this.getAdapter(processed.provider);
      const raw = await adapter.request(processed);
      return this.responseHandler.parse(raw, adapter.name);
    } catch (err) {
      this.responseHandler.handleError(err);
    }
  }

  async generate(prompt: string, options: any = {}): Promise<string> {
    const response = await this.request({ prompt, ...options });
    return response.content;
  }

  async *stream(request: ModelRequest): AsyncIterableIterator<StreamToken> {
    const processed = this.requestProcessor.process(request);
    const adapter = this.getAdapter(processed.provider);
    for await (const token of this.streamingManager.stream(adapter, processed)) {
      yield token;
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
      provider: 'stream'
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
