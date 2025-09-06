import { ModelRequest, ModelResponse, StreamToken } from '../../domain/interfaces/model-client.js';
import { OllamaProvider } from '../../providers/hybrid/ollama-provider.js';
import { LMStudioProvider } from '../../providers/hybrid/lm-studio-provider.js';
import { HuggingFaceProvider } from '../../providers/hybrid/huggingface-provider.js';
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
    
    try {
      const providerResponse = await this.provider.request({ ...req, model: req.model || cfg.defaultModel });
      
      // Extract content with multiple fallbacks
      let content = '';
      if (typeof providerResponse === 'string') {
        content = providerResponse;
      } else if (providerResponse && typeof providerResponse === 'object') {
        content = providerResponse.content || 
                 providerResponse.response || 
                 providerResponse.message?.content ||
                 providerResponse.output ||
                 providerResponse.text || 
                 '';
      }
      
      // Validate response content - fail fast instead of returning empty content
      if (!content) {
        logger.warn('OllamaAdapter received empty content from provider', {
          responseType: typeof providerResponse,
          responseKeys: providerResponse && typeof providerResponse === 'object' ? Object.keys(providerResponse) : [],
          hasToolCalls: !!providerResponse?.toolCalls?.length,
        });
        
        // If we have tool calls but no content, that might be intentional
        if (!providerResponse?.toolCalls?.length) {
          logger.error('No content and no tool calls in Ollama response');
          throw new Error('Ollama returned empty response with no content and no tool calls. This indicates a provider failure.');
        }
        
        // If we have tool calls, empty content might be acceptable
        logger.debug('Empty content but tool calls present - proceeding');
      }
      
      // Transform OllamaProvider response to ModelResponse format
      return {
        id: providerResponse?.id || `ollama_${Date.now()}`,
        content: content,
        model: providerResponse?.model || req.model || cfg.defaultModel,
        provider: this.name,
        usage: providerResponse?.usage || {
          promptTokens: providerResponse?.prompt_eval_count || 0,
          completionTokens: providerResponse?.eval_count || 0,
          totalTokens: (providerResponse?.prompt_eval_count || 0) + (providerResponse?.eval_count || 0),
        },
        responseTime: providerResponse?.total_duration || undefined,
        finishReason: providerResponse?.done ? 'stop' : undefined,
        toolCalls: providerResponse?.toolCalls,
      };
    } catch (error) {
      logger.error('OllamaAdapter request failed:', error);
      throw new Error(`Ollama request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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

    // LMStudioProvider doesn't have request method, use generateCode instead
    if ('request' in this.provider && typeof this.provider.request === 'function') {
      return this.provider.request({ ...req, model: req.model || cfg.defaultModel });
    } else {
      // Fallback to generateCode method
      const response = await this.provider.generateCode(req.prompt, {
        model: req.model || cfg.defaultModel,
      });
      return {
        id: `${this.name}_${Date.now()}`,
        content: response.content,
        model: response.model || req.model || cfg.defaultModel,
        provider: this.name,
        usage: {
          promptTokens: response.metadata?.promptTokens || 0,
          completionTokens: response.metadata?.completionTokens || 0,
          totalTokens: response.metadata?.tokens || 0,
        },
        responseTime: response.responseTime,
        finishReason: response.metadata?.finishReason || 'stop',
      };
    }
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
        index: index++,
        timestamp: Date.now(),
      };
    }
    yield {
      content: '',
      isComplete: true,
      index: index++,
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

export class HuggingFaceAdapter implements ProviderAdapter {
  readonly name = 'huggingface';
  private provider: HuggingFaceProvider;

  constructor(apiKey: string, defaultModel: string, endpoint?: string) {
    this.provider = new HuggingFaceProvider({
      apiKey,
      endpoint,
      defaultModel,
      timeout: 60_000,
      maxRetries: 2,
    });
  }

  async request(req: ModelRequest): Promise<ModelResponse> {
    logger.debug('HuggingFaceAdapter.request', { model: req.model });
    const cfg = (this.provider as any).config;
    
    try {
      const providerResponse = await this.provider.generateCode(req.prompt, {
        model: req.model || cfg.defaultModel,
        maxTokens: req.maxTokens,
        temperature: req.temperature,
        context: req.context,
      });
      
      // Transform HuggingFaceProvider response to ModelResponse format
      return {
        id: `hf_${Date.now()}`,
        content: providerResponse.content,
        model: providerResponse.model,
        provider: this.name,
        usage: {
          promptTokens: providerResponse.metadata?.promptTokens || 0,
          completionTokens: providerResponse.metadata?.completionTokens || 0,
          totalTokens: providerResponse.metadata?.tokens || 0,
        },
        responseTime: providerResponse.responseTime,
        finishReason: providerResponse.metadata?.finishReason || 'stop',
      };
    } catch (error) {
      logger.error('HuggingFaceAdapter request failed:', error);
      throw new Error(`HuggingFace request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getModels(): Promise<string[]> {
    // HuggingFace has thousands of models, return common ones
    return [
      'microsoft/CodeGPT-small-py',
      'microsoft/DialoGPT-medium',
      'gpt2',
      'google/flan-t5-base',
      'facebook/blenderbot-400M-distill',
    ];
  }
}
