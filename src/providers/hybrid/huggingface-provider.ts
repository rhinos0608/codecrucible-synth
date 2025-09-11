/**
 * HuggingFace Provider - Implements LLMProvider interface for HuggingFace Inference API integration
 * Optimized for wide model access, research tasks, and specialized model capabilities
 */

import { logger } from '../../infrastructure/logging/logger.js';
import { toErrorOrUndefined } from '../../utils/type-guards.js';
import {
  LLMCapabilities,
  LLMProvider,
  LLMResponse,
  LLMStatus,
} from '../../domain/interfaces/llm-interfaces.js';
import { generateSystemPrompt } from '../../domain/prompts/system-prompt.js';

export interface HuggingFaceConfig {
  apiKey: string;
  endpoint?: string;
  defaultModel: string;
  timeout: number;
  maxRetries: number;
  useInferenceApi?: boolean;
}

export class HuggingFaceProvider implements LLMProvider {
  public readonly name = 'huggingface';
  public readonly endpoint: string;
  private readonly config: HuggingFaceConfig;
  private currentLoad = 0;
  private lastError?: string;
  private responseTimeHistory: number[] = [];
  private errorCount = 0;
  private requestCount = 0;

  // Rate limiting state
  private requestTimestamps: number[] = [];
  private readonly maxRequestsPerMinute: number;
  private readonly rateLimitWindow = 60000; // 1 minute in milliseconds

  public constructor(config: Readonly<HuggingFaceConfig>) {
    this.config = config;
    this.endpoint = config.endpoint ?? 'https://api-inference.huggingface.co/models';
    this.maxRequestsPerMinute = parseInt(
      process.env.HUGGINGFACE_MAX_REQUESTS_PER_MINUTE ?? '30',
      10
    );

    if (!config.apiKey) {
      logger.warn('HuggingFace API key not provided - provider will be unavailable');
    }
  }

  /**
   * Check if HuggingFace is available and responding
   */
  public async isAvailable(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        logger.debug('HuggingFace API key not configured');
        return false;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 5000);

      // Test with a simple model status check
      const response = await fetch(`${this.endpoint}/${this.config.defaultModel}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        logger.debug(`HuggingFace provider available at ${this.endpoint}`);
        return true;
      } else {
        this.lastError = `HuggingFace availability check failed: ${response.status} ${response.statusText}`;
        logger.warn(this.lastError);
        return false;
      }
    } catch (error) {
      this.lastError = `HuggingFace connection failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(this.lastError);
      return false;
    }
  }

  /**
   * Generate code using HuggingFace Inference API
   */
  public async generateCode(
    prompt: string,
    options: Readonly<{
      model?: string;
      maxTokens?: number;
      temperature?: number;
      topP?: number;
      systemPrompt?: string;
      context?: unknown;
    }> = {}
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      this.requestCount++;
      this.currentLoad++;

      // Check rate limiting
      await this.enforceRateLimit();

      const model: string =
        typeof options.model === 'string' ? options.model : this.config.defaultModel;
      const systemPrompt: string =
        typeof options.systemPrompt === 'string'
          ? options.systemPrompt
          : generateSystemPrompt() ||
            'You are a helpful coding assistant. Generate clean, well-documented code.';

      // Format messages for text generation models
      const messages: ReadonlyArray<{
        readonly role: 'system' | 'user' | 'assistant';
        readonly content: string;
      }> = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ];

      const requestBody = {
        inputs: this.formatPromptForModel(messages, model),
        parameters: {
          max_new_tokens: typeof options.maxTokens === 'number' ? options.maxTokens : 1000,
          temperature: typeof options.temperature === 'number' ? options.temperature : 0.7,
          top_p: typeof options.topP === 'number' ? options.topP : 0.9,
          do_sample: true,
          return_full_text: false,
        },
        options: {
          wait_for_model: true,
          use_cache: false,
        },
      };

      logger.debug('HuggingFace request', { model, promptLength: prompt.length });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, this.config.timeout);

      const response = await fetch(`${this.endpoint}/${model}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HuggingFace API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const result: unknown = await response.json();

      // Handle different response formats from HuggingFace
      let content = '';
      if (Array.isArray(result)) {
        const first = result[0] as { generated_text?: string } | undefined;
        content = typeof first?.generated_text === 'string' ? first.generated_text : '';
      } else if (
        typeof result === 'object' &&
        result !== null &&
        'generated_text' in result &&
        typeof (result as { generated_text?: unknown }).generated_text === 'string'
      ) {
        content = (result as { generated_text: string }).generated_text;
      } else if (typeof result === 'string') {
        content = result;
      } else {
        throw new Error(`Unexpected HuggingFace response format: ${JSON.stringify(result)}`);
      }

      const responseTime = Date.now() - startTime;
      this.responseTimeHistory.push(responseTime);

      // Keep history manageable
      if (this.responseTimeHistory.length > 100) {
        this.responseTimeHistory = this.responseTimeHistory.slice(-50);
      }

      const llmResponse: LLMResponse = {
        content,
        confidence: this.calculateConfidence(content),
        responseTime,
        model,
        provider: this.name,
        metadata: {
          tokens: content.split(/\s+/).length, // Rough token estimate
          promptTokens: prompt.split(/\s+/).length,
          completionTokens: content.split(/\s+/).length,
          finishReason: 'stop',
          modelInfo:
            typeof result === 'object' &&
            result !== null &&
            !Array.isArray(result) &&
            'model_version' in result
              ? (result as { model_version: string }).model_version
              : 'unknown',
        },
      };

      logger.debug('HuggingFace response generated', {
        contentLength: content.length,
        responseTime,
        model,
      });

      return llmResponse;
    } catch (error) {
      this.errorCount++;
      const responseTime = Date.now() - startTime;
      this.lastError = error instanceof Error ? error.message : String(error);

      logger.error('HuggingFace code generation failed', {
        responseTime,
        model: options.model || this.config.defaultModel,
      });

      throw new Error(`HuggingFace generation failed: ${this.lastError}`);
    } finally {
      this.currentLoad = Math.max(0, this.currentLoad - 1);
    }
  }

  /**
   * Process a generic request with tool support
   */

  // Define a type for the request parameter
  public async request(request: unknown): Promise<LLMResponse> {
    // Cast to expected shape
    const req = request as {
      prompt?: string;
      messages?: { content: string }[];
      model?: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
      context?: unknown;
    };

    // Safely extract the prompt
    const prompt: string =
      typeof req.prompt === 'string'
        ? req.prompt
        : Array.isArray(req.messages) && typeof req.messages[0]?.content === 'string'
          ? req.messages[0].content
          : '';

    return this.generateCode(prompt, {
      model: typeof req.model === 'string' ? req.model : undefined,
      maxTokens: typeof req.maxTokens === 'number' ? req.maxTokens : undefined,
      temperature: typeof req.temperature === 'number' ? req.temperature : undefined,
      systemPrompt: typeof req.systemPrompt === 'string' ? req.systemPrompt : undefined,
      context: req.context,
    });
  }

  /**
   * Get provider capabilities
   */
  public getCapabilities(): LLMCapabilities {
    return {
      strengths: [
        'Wide model selection',
        'Research models',
        'Specialized tasks',
        'Multi-modal capabilities',
        'Community models',
      ],
      optimalFor: [
        'Experimental workflows',
        'Specialized model access',
        'Research and prototyping',
        'Multi-language generation',
        'Domain-specific tasks',
      ],
      responseTime: 'variable (2-30s depending on model)',
      contextWindow: 4096, // Varies by model
      supportsStreaming: false, // HuggingFace Inference API doesn't support streaming by default
      maxConcurrent: 5,
    };
  }

  /**
   * Get current provider status
   */
  public async getStatus(): Promise<LLMStatus> {
    const isOnline = await this.isAvailable();
    const avgResponseTime =
      this.responseTimeHistory.length > 0
        ? this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length
        : 0;

    return {
      available: isOnline,
      currentLoad: this.currentLoad,
      maxLoad: 10,
      responseTime: avgResponseTime,
      errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      lastError: this.lastError,
    };
  }

  /**
   * Health check for the provider
   */
  public async healthCheck(): Promise<void> {
    const available = await this.isAvailable();
    if (!available) {
      throw new Error(`HuggingFace provider health check failed: ${this.lastError}`);
    }
  }

  /**
   * Reset provider statistics
   */
  public resetStats(): void {
    this.errorCount = 0;
    this.requestCount = 0;
    this.responseTimeHistory = [];
    this.lastError = undefined;
    this.currentLoad = 0;
    this.requestTimestamps = [];
    logger.info('HuggingFace provider stats reset');
  }

  /**
   * Format prompt for different model types
   */
  private formatPromptForModel(
    messages: ReadonlyArray<{
      readonly role: 'system' | 'user' | 'assistant';
      readonly content: string;
    }>,
    model: string
  ): string {
    // Check if it's a chat model (contains 'chat' in name)
    if (model.toLowerCase().includes('chat') || model.toLowerCase().includes('instruct')) {
      // Format as conversation for chat models
      const formatted = messages.map(msg => {
        switch (msg.role) {
          case 'system':
            return `### System\n${msg.content}`;
          case 'user':
            return `### Human\n${msg.content}`;
          case 'assistant':
            return `### Assistant\n${msg.content}`;
          default:
            return `${msg.content}`;
        }
      });
      return `${formatted.join('\n\n')}\n\n### Assistant\n`;
    } else {
      // For non-chat models, combine all content
      return messages.map(msg => msg.content).join('\n');
    }
  }

  /**
   * Calculate confidence score based on response characteristics
   */
  private calculateConfidence(content: string): number {
    let confidence = 0.7; // Base confidence

    // Length factor
    if (content.length > 100) confidence += 0.1;
    if (content.length > 500) confidence += 0.1;

    // Structure indicators
    if (content.includes('```')) confidence += 0.05; // Code blocks
    if (content.includes('function') || content.includes('class')) confidence += 0.05; // Code keywords

    // Error indicators
    if (content.includes('error') || content.includes('Error')) confidence -= 0.1;
    if (content.includes('sorry') || content.includes('cannot')) confidence -= 0.1;

    return Math.min(Math.max(confidence, 0.1), 1.0);
  }

  /**
   * Enforce rate limiting
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();

    // Remove timestamps older than the rate limit window
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.rateLimitWindow
    );

    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      const oldestRequest = Math.min(...this.requestTimestamps);
      const waitTime = this.rateLimitWindow - (now - oldestRequest);

      if (waitTime > 0) {
        logger.debug(`HuggingFace rate limit reached, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    this.requestTimestamps.push(now);
  }
}
