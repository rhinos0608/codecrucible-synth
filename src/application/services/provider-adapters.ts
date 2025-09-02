import { ModelRequest, ModelResponse, StreamToken } from '../../domain/interfaces/model-client.js';
import { OllamaProvider } from '../../core/hybrid/ollama-provider.js';
import { LMStudioProvider } from '../../core/hybrid/lm-studio-provider.js';
import { logger } from '../../infrastructure/logging/unified-logger.js';

export interface ProviderAdapter {
  readonly name: string;
  request(req: ModelRequest): Promise<ModelResponse>;
  stream?(req: ModelRequest): AsyncIterable<StreamToken>;
  getModels?(): Promise<string[]>;
}

export class OllamaAdapter implements ProviderAdapter {
  readonly name = 'ollama';
  private provider: OllamaProvider;

  constructor(endpoint: string, defaultModel: string) {
    this.provider = new OllamaProvider({ endpoint, defaultModel, timeout: 60_000, maxRetries: 2 });
  }

  async request(req: ModelRequest): Promise<ModelResponse> {
    logger.debug('OllamaAdapter.request', { model: req.model });
    const cfg = (this.provider as any).config;
    return this.provider.request({ ...req, model: req.model || cfg.defaultModel });
  }

  async *stream(req: ModelRequest): AsyncIterable<StreamToken> {
    const streamFn = (this.provider as any).stream;
    if (!streamFn) return;
    const iterator = await streamFn.call(this.provider, req);
    let index = 0;
    for await (const token of iterator as any) {
      yield {
        content: (token as any).content ?? String(token),
        isComplete: false,
        index,
        timestamp: Date.now(),
      };
      index++;
    }
    yield {
      content: '',
      isComplete: true,
      index,
      timestamp: Date.now(),
    };
  }

  async getModels(): Promise<string[]> {
    const listFn = (this.provider as any).listModels;
    if (listFn) {
      const models = await listFn.call(this.provider);
      return models.map((m: any) => m.id || m.name);
    }
    return [];
  }
}

export class LMStudioAdapter implements ProviderAdapter {
  readonly name = 'lm-studio';
  private provider: LMStudioProvider;

  constructor(endpoint: string, defaultModel: string) {
    this.provider = new LMStudioProvider({
      endpoint,
      defaultModel,
      timeout: 60_000,
      maxRetries: 2,
    });
  }

  async request(req: ModelRequest): Promise<ModelResponse> {
    logger.debug('LMStudioAdapter.request', { model: req.model });
    const cfg = (this.provider as any).config;
    return this.provider.request({ ...req, model: req.model || cfg.defaultModel });
  }

  async *stream(req: ModelRequest): AsyncIterable<StreamToken> {
    const streamFn = (this.provider as any).stream;
    if (!streamFn) return;
    const iterator = await streamFn.call(this.provider, req);
    for await (const token of iterator as any) {
      yield { content: (token as any).content ?? String(token), isComplete: false };
    }
    yield { content: '', isComplete: true };
  }

  async getModels(): Promise<string[]> {
    const listFn = (this.provider as any).listModels;
    if (listFn) {
      const models = await listFn.call(this.provider);
      return models.map((m: any) => m.id || m.name);
    }
    return [];
  }
}

export class ClaudeAdapter implements ProviderAdapter {
  readonly name = 'claude';
  constructor(
    private apiKey: string,
    private endpoint = 'https://api.anthropic.com/v1/messages'
  ) {}

  async request(req: ModelRequest): Promise<ModelResponse> {
    const body = {
      model: req.model || 'claude-3-sonnet-20240229',
      max_tokens: req.maxTokens || 1024,
      messages: req.messages ?? [{ role: 'user', content: req.prompt }],
      temperature: req.temperature ?? 0.7,
    };
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Claude request failed: ${response.status}`);
    const data: any = await response.json();
    return {
      id: data.id,
      content: data.content?.map((c: any) => c.text).join('') ?? '',
      model: data.model,
      provider: this.name,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
    };
  }
}
