import {
  ModelRequest,
  ModelResponse,
  StreamToken,
} from '../../../domain/interfaces/model-client.js';
import { LMStudioProvider } from '../../../providers/hybrid/lm-studio-provider.js';
import { logger } from '../../../infrastructure/logging/unified-logger.js';
import { ProviderAdapter } from './provider-adapter.js';

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
    logger.debug('LMStudioAdapter.request', {
      model: req.model,
      hasTools: req.tools && req.tools.length > 0,
      toolCount: req.tools?.length || 0,
    });
    const cfg = (this.provider as any).config;

    try {
      const requestOptions = {
        model: req.model || cfg.defaultModel,
        messages: req.messages,
        prompt: req.prompt,
        maxTokens: req.maxTokens,
        temperature: req.temperature,
        tools: req.tools,
        tool_choice: req.tool_choice,
        timeout: req.timeout,
      };

      const response = await this.provider.request(requestOptions);

      return {
        id: response.id || `${this.name}_${Date.now()}`,
        content: response.content || '',
        model: response.model || req.model || cfg.defaultModel,
        provider: this.name,
        usage: response.usage || {
          promptTokens: response.metadata?.promptTokens || 0,
          completionTokens: response.metadata?.completionTokens || 0,
          totalTokens: response.metadata?.tokens || 0,
        },
        responseTime: response.responseTime,
        finishReason: response.finishReason || response.metadata?.finishReason || 'stop',
        toolCalls: response.toolCalls,
      };
    } catch (error) {
      logger.error('LMStudioAdapter request failed:', error);

      logger.warn('Falling back to generateCode method due to request failure');
      try {
        const response = await this.provider.generateCode(req.prompt || '', {
          model: req.model || cfg.defaultModel,
          maxTokens: req.maxTokens,
          temperature: req.temperature,
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
          toolCalls: response.toolCalls
            ? response.toolCalls.map(tc => ({
                id: tc.id,
                type: tc.type as 'function',
                function: {
                  name: tc.name,
                  arguments: tc.arguments,
                },
              }))
            : undefined,
        };
      } catch (fallbackError) {
        logger.error('LMStudioAdapter fallback also failed:', fallbackError);
        throw new Error(
          `LM Studio request failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
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
