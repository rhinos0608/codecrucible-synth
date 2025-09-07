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
        messages: req.messages?.map(msg => ({
          role: msg.role,
          content: msg.content,
          tool_calls: msg.tool_calls?.map(tc => ({
            id: (tc as any).id,
            type: 'function' as const,
            function: {
              name: (tc as any).function?.name || '',
              arguments: (tc as any).function?.arguments || '{}',
            },
          })),
        })),
      }) as any;  // Provider response type varies

      let content = '';
      if (typeof providerResponse === 'string') {
        content = providerResponse;
      } else if (providerResponse && typeof providerResponse === 'object') {
        // Ensure we only assign string values to content
        const extractContent = (resp: any): string => {
          if (typeof resp.content === 'string') return resp.content;
          if (typeof resp.response === 'string') return resp.response;
          if (typeof resp.message === 'string') return resp.message;
          if (typeof resp.output === 'string') return resp.output;
          if (typeof resp.text === 'string') return resp.text;
          return '';
        };
        content = extractContent(providerResponse);
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
        toolCalls: providerResponse?.toolCalls
          ? providerResponse.toolCalls.map((tc: any) => ({
              id: tc.id,
              type: tc.type as 'function',
              function: {
                name: tc.name,
                arguments: tc.arguments,
              },
            }))
          : undefined,
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
