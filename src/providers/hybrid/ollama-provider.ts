import { logger } from '../../infrastructure/logging/logger.js';
import {
  LLMCapabilities,
  LLMProvider,
  LLMResponse,
  LLMStatus,
} from '../../domain/interfaces/llm-interfaces.js';
import {
  OllamaConfig,
  OllamaMessage,
  OllamaRequest,
  OllamaResponse,
  OllamaStreamingMetadata,
  ParsedToolCall,
  parseEnvInt,
} from './ollama-config.js';
import { OllamaHttpClient } from './ollama-http-client.js';
import { handleStreaming } from './ollama-streaming-handler.js';
import { extractToolCalls } from './ollama-tool-processor.js';
import { parseResponse } from './ollama-response-parser.js';
import { generateContextualSystemPrompt } from '../../domain/prompts/system-prompt.js';

interface GenerateCodeOptions {
  model?: string;
  onStreamingToken?: (token: string, metadata?: OllamaStreamingMetadata) => void;
}

type LLMToolCall = NonNullable<LLMResponse['toolCalls']>[number];

function toLLMToolCall(call: ParsedToolCall): LLMToolCall {
  return {
    id: call.id ?? '',
    type: 'function',
    name: call.function.name,
    arguments: call.function.arguments,
  };
}

export class OllamaProvider implements LLMProvider {
  public readonly name = 'ollama';
  public readonly endpoint: string;
  private readonly config: OllamaConfig;
  private readonly http: OllamaHttpClient;

  private readonly currentLoad = 0;
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
        () => {
          controller.abort();
        },
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
    options: GenerateCodeOptions = {}
  ): Promise<LLMResponse> {
    const model = options.model ?? this.config.defaultModel;
    const messages: OllamaMessage[] = [
      { role: 'system', content: generateContextualSystemPrompt() },
      { role: 'user', content: prompt },
    ];

    const stream = typeof options.onStreamingToken === 'function';
    const request: OllamaRequest = {
      model,
      messages,
      stream,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.config.timeout);

    try {
      const response = await this.http.post('/api/chat', request, controller.signal);
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Ollama API request failed with status ${response.status}: ${errText}`);
      }
      let text = '';
      let metadata: OllamaStreamingMetadata = {};
      let toolCalls: LLMToolCall[] = [];

      if (stream && options.onStreamingToken) {
        const {
          text: resultText,
          metadata: resultMetadata,
          toolCalls: resultToolCalls,
        } = await handleStreaming(response, options.onStreamingToken);
        text = resultText;
        metadata = resultMetadata;
        toolCalls = extractToolCalls(resultToolCalls).map(toLLMToolCall);
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
        toolCalls = extractToolCalls(json.message?.tool_calls).map(toLLMToolCall);
      }

      return {
        content: text,
        confidence: 1,
        responseTime: 0,
        model,
        provider: this.name,
        toolCalls,
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

  public async request(request: unknown): Promise<unknown> {
    const req = request as OllamaRequest;
    const response = await this.http.post('/api/chat', req);
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Ollama API request failed with status ${response.status}: ${errText}`);
    }
    if (req.stream && req.onStreamingToken) {
      const result = await handleStreaming(response, req.onStreamingToken);
      return {
        model: result.metadata.model ?? this.config.defaultModel,
        message: { role: 'assistant', content: result.text, tool_calls: result.toolCalls },
        done: true,
        total_duration: result.metadata.totalDuration,
        load_duration: result.metadata.loadDuration,
        prompt_eval_count: result.metadata.promptEvalCount,
        prompt_eval_duration: result.metadata.promptEvalDuration,
        eval_count: result.metadata.evalCount,
        eval_duration: result.metadata.evalDuration,
        context: result.metadata.context,
      } as OllamaResponse;
    }
    return parseResponse(response);
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
