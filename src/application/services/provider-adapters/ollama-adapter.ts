import {
  ModelRequest,
  ModelResponse,
  StreamToken,
  ModelTool,
} from '../../../domain/interfaces/model-client.js';
import { OllamaProvider } from '../../../providers/hybrid/ollama-provider.js';
import { logger } from '../../../infrastructure/logging/unified-logger.js';
import { toErrorOrUndefined } from '../../../utils/type-guards.js';
import { ProviderAdapter } from './provider-adapter.js';

export class OllamaAdapter implements ProviderAdapter {
  readonly name = 'ollama';
  private provider: OllamaProvider;

  constructor(endpoint: string, defaultModel: string) {
    this.provider = new OllamaProvider({ endpoint, defaultModel, timeout: 60_000, maxRetries: 2 });
  }

  async request(req: ModelRequest): Promise<ModelResponse> {
    logger.debug('OllamaAdapter.request', { model: req.model, hasTools: !!req.tools?.length });
    const cfg = (this.provider as any).config;

    try {
      // Map tools (if any) to provider format (OpenAI/Ollama style)
      const mappedTools = Array.isArray(req.tools)
        ? req.tools.map((t: Readonly<ModelTool>) => ({
            type: 'function' as const,
            function: {
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters,
            },
          }))
        : [];

      // Use structured messages if available, otherwise fall back to prompt
      let messages;
      if (req.messages && req.messages.length > 0) {
        messages = req.messages;
      } else if (req.prompt) {
        messages = [{ role: 'user', content: req.prompt }];
      } else {
        messages = [{ role: 'user', content: 'How can I help you?' }];
      }
      
      logger.info('🔧 OllamaAdapter: Using structured messages for Llama 3.1', {
        messageCount: messages.length,
        toolCount: mappedTools.length,
        toolNames: mappedTools.map(t => t.function.name),
        firstMessage: messages[0]?.content?.substring(0, 100)
      });

      // Call provider with structured messages instead of flattened prompt
      const providerResponse = await this.provider.generateCode('', {
        model: req.model || cfg.defaultModel,
        messages: messages, // Pass structured messages to provider
        tools: mappedTools,
        // Remove tool_choice as it's not documented by Ollama
        availableTools: mappedTools.map(t => t.function.name),
        onStreamingToken: req.stream ? (token: any) => {
          // Handle streaming if needed
        } : undefined,
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
      logger.error('OllamaAdapter request failed:', toErrorOrUndefined(error));
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
