import { logger } from '../../infrastructure/logging/logger.js';
import { toErrorOrUndefined } from '../../utils/type-guards.js';
import {
  LLMCapabilities,
  LLMProvider,
  LLMResponse,
  LLMStatus,
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

  private readonly currentLoad = 0;
  private lastError?: string;

  public constructor(config: Readonly<OllamaConfig>) {
    this.config = config;
    this.endpoint = config.endpoint;
    this.http = new OllamaHttpClient(this.endpoint);
  }

  public async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => { controller.abort(); },
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
    options: Readonly<Record<string, unknown>> = {}
  ): Promise<LLMResponse> {
    const model = (options.model as string) || this.config.defaultModel;

    // Provide required arguments for generateContextualSystemPrompt
    const availableTools: readonly string[] = Array.isArray(options.availableTools)
      ? (options.availableTools as readonly string[])
      : [];
    const userContext: string | undefined = typeof options.userContext === 'string'
      ? options.userContext
      : undefined;

    const messages: import('./ollama-config.js').OllamaMessage[] = [
      { role: 'system', content: generateContextualSystemPrompt(availableTools, userContext) },
      { role: 'user', content: prompt },
    ];

    const onStreamingToken = typeof options.onStreamingToken === 'function'
      ? options.onStreamingToken as (token: string, metadata?: unknown) => void
      : undefined;

    const request: OllamaRequest = {
      model,
      messages,
      stream: !!onStreamingToken,
      options: {
        num_ctx: parseEnvInt('MODEL_MAX_CONTEXT_WINDOW', 131072, 1024, 131072),
        temperature: typeof options.temperature === 'number' ? options.temperature : 0.7,
        top_p: typeof options.top_p === 'number' ? options.top_p : 0.9,
      },
    };
    // If tools were provided by the adapter, include them in the chat request
    if (Array.isArray((options as any).tools) && (options as any).tools.length > 0) {
      (request as any).tools = (options as any).tools;
      // Support tool_choice when present; default to 'auto' if adapter set it
      if ((options as any).tool_choice) {
        (request as any).tool_choice = (options as any).tool_choice;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, this.config.timeout);

    try {
      const response = await this.http.post('/api/chat', request, controller.signal);
      let text = '';
      let metadata: Record<string, unknown> = {};
      let toolCalls: Array<{ id?: string; function: { name: string; arguments: string } }> = [];

      if (request.stream && onStreamingToken) {
        const { text: streamedText, metadata: streamedMetadata, toolCalls: streamedToolCalls } =
          await handleStreaming(response, onStreamingToken);
        text = streamedText;
        metadata = streamedMetadata as Record<string, unknown>;
        toolCalls = extractToolCalls(streamedToolCalls);
        // Map to required type
        toolCalls = toolCalls.map(tc => ({
          id: tc.id,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
      } else {
        const json = await parseResponse(response);
        text = json.message?.content ?? json.response ?? '';
        toolCalls = extractToolCalls(json.message?.tool_calls);
        // Map to required type
        toolCalls = toolCalls.map(tc => ({
          id: tc.id,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
        metadata = {
          model: json.model,
          totalDuration: json.total_duration,
          promptEvalCount: json.prompt_eval_count,
          evalCount: json.eval_count,
          context: json.context,
        };
      }

      return {
        content: text,
        confidence: 1,
        responseTime: 0,
        model,
        provider: this.name,
        toolCalls: toolCalls.map(tc => ({
          id: tc.id ?? '',
          type: 'function',
          name: tc.function.name,
          arguments: tc.function.arguments,
        })),
        metadata,
      };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      logger.error('Ollama generateCode failed', toErrorOrUndefined(err));
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
