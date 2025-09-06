import {
  ModelRequest,
  ModelResponse,
  StreamToken,
} from '../../../domain/interfaces/model-client.js';
import { OllamaProvider } from '../../../providers/hybrid/ollama-provider.js';
import { logger } from '../../../infrastructure/logging/unified-logger.js';
import { ProviderAdapter } from './provider-adapter.js';

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
      const providerResponse = await this.provider.request({
        ...req,
        model: req.model || cfg.defaultModel,
      });

      let content = '';
      if (typeof providerResponse === 'string') {
        content = providerResponse;
      } else if (providerResponse && typeof providerResponse === 'object') {
        content =
          providerResponse.content ||
          providerResponse.response ||
          providerResponse.message ||
          providerResponse.output ||
          providerResponse.text ||
          '';
      }

      if (!content) {
        logger.warn('OllamaAdapter received empty content from provider', {
          responseType: typeof providerResponse,
          responseKeys:
            providerResponse && typeof providerResponse === 'object'
              ? Object.keys(providerResponse)
              : [],
          hasToolCalls: !!providerResponse?.toolCalls?.length,
        });

        if (!providerResponse?.toolCalls?.length) {
          logger.error('No content and no tool calls in Ollama response');
          throw new Error(
            'Ollama returned empty response with no content and no tool calls. This indicates a provider failure.'
          );
        }

        logger.debug('Empty content but tool calls present - proceeding');
      }

      return {
        id: providerResponse?.id || `ollama_${Date.now()}`,
        content: content,
        model: providerResponse?.model || req.model || cfg.defaultModel,
        provider: this.name,
        usage: providerResponse?.usage || {
          promptTokens: providerResponse?.prompt_eval_count || 0,
          completionTokens: providerResponse?.eval_count || 0,
          totalTokens:
            (providerResponse?.prompt_eval_count || 0) + (providerResponse?.eval_count || 0),
        },
        responseTime: providerResponse?.total_duration || undefined,
        finishReason: providerResponse?.done ? 'stop' : undefined,
        toolCalls: providerResponse?.toolCalls ? providerResponse.toolCalls.map(tc => ({
          id: tc.id,
          type: tc.type as 'function',
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        })) : undefined,
      };
    } catch (error) {
      logger.error('OllamaAdapter request failed:', error);
      throw new Error(
        `Ollama request failed: ${error instanceof Error ? error.message : String(error)}`
      );
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
