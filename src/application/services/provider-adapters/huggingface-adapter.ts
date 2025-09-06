import { ModelRequest, ModelResponse } from '../../../domain/interfaces/model-client.js';
import { HuggingFaceProvider } from '../../../providers/hybrid/huggingface-provider.js';
import { logger } from '../../../infrastructure/logging/unified-logger.js';
import { ProviderAdapter } from './provider-adapter.js';

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
      throw new Error(
        `HuggingFace request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getModels(): Promise<string[]> {
    return [
      'microsoft/CodeGPT-small-py',
      'microsoft/DialoGPT-medium',
      'gpt2',
      'google/flan-t5-base',
      'facebook/blenderbot-400M-distill',
    ];
  }
}
