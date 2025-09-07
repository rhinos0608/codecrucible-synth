import { logger } from '../../infrastructure/logging/logger.js';
import {
  LLMProvider,
  LLMCapabilities,
  LLMStatus,
  LLMResponse,
} from '../../domain/interfaces/llm-interfaces.js';
import { OllamaConfig, OllamaRequest, parseEnvInt } from './ollama-config.js';
import { OllamaHttpClient } from './ollama-http-client.js';
import { handleStreaming } from './ollama-streaming-handler.js';
import { extractToolCalls } from './ollama-tool-processor.js';
import { parseResponse } from './ollama-response-parser.js';
import { generateContextualSystemPrompt } from '../../domain/prompts/system-prompt.js';

export class OllamaProvider implements LLMProvider {
  public readonly name = 'ollama';
  public readonly endpoint: string;
  private readonly config: OllamaConfig;
  private readonly http: OllamaHttpClient;

  private currentLoad = 0;
  private lastError?: string;

  public constructor(config: OllamaConfig) {
    this.config = config;
    this.endpoint = config.endpoint;
    this.http = new OllamaHttpClient(this.endpoint);
  }

  public async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        parseEnvInt('OLLAMA_HEALTH_CHECK_TIMEOUT', 5000, 1000, 30000)
      );
      await this.http.get('/api/tags', controller.signal);
      clearTimeout(timeout);
      return true;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      return false;
    }
  }

  public async generateCode(
    prompt: string,
    options: Record<string, unknown> = {}
  ): Promise<LLMResponse> {
    const model = (options.model as string) ?? this.config.defaultModel;
    const messages = [
      { role: 'system', content: generateContextualSystemPrompt() },
      { role: 'user', content: prompt },
    ];

    const request: OllamaRequest = {
      model,
      messages,
      stream: typeof (options as any).onStreamingToken === 'function',
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await this.http.post('/api/chat', request, controller.signal);
      let text = '';
      let metadata = {} as Record<string, unknown>;
      let toolCalls = [] as Array<{ id?: string; function: { name: string; arguments: string } }>;

      if (request.stream) {
        const result = await handleStreaming(response, (options as any).onStreamingToken as any);
        text = result.text;
        metadata = result.metadata as Record<string, unknown>;
        toolCalls = extractToolCalls(result.toolCalls) as any;
      } else {
        const json = await parseResponse(response);
        text = json.message?.content ?? json.response ?? '';
        metadata = {
          model: json.model,
          totalDuration: json.total_duration,
          promptEvalCount: json.prompt_eval_count,
          evalCount: json.eval_count,
          context: json.context,
        };
        toolCalls = extractToolCalls(json.message?.tool_calls);
      }

      return {
        content: text,
        confidence: 1,
        responseTime: 0,
        model,
        provider: this.name,
        toolCalls: toolCalls as any,
        metadata,
      };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      logger.error('Ollama generateCode failed', { err: this.lastError });
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  public getCapabilities(): LLMCapabilities {
    return {
      strengths: ['general-purpose'],
      optimalFor: ['chat'],
      responseTime: 'variable',
      contextWindow: parseEnvInt('MODEL_MAX_CONTEXT_WINDOW', 131072, 1024, 131072),
      supportsStreaming: true,
      maxConcurrent: parseEnvInt('OLLAMA_MAX_CONCURRENT', 4, 1, 32),
    };
  }

  public async getStatus(): Promise<LLMStatus> {
    return {
      available: await this.isAvailable(),
      currentLoad: this.currentLoad,
      maxLoad: parseEnvInt('OLLAMA_MAX_CONCURRENT', 4, 1, 32),
      responseTime: 0,
      errorRate: 0,
      lastError: this.lastError,
    };
  }
}
