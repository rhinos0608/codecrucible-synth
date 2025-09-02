/**
 * LM Studio Provider - Implements LLMProvider interface for LM Studio integration
 * Optimized for fast code generation, templates, and quick edits
 */

import { logger } from '../logger.js';
import {
  LLMProvider,
  LLMResponse,
  LLMCapabilities,
  LLMStatus,
} from '../../domain/interfaces/llm-interfaces.js';

export interface LMStudioConfig {
  endpoint: string;
  defaultModel: string;
  timeout: number;
  maxRetries: number;
}

export class LMStudioProvider implements LLMProvider {
  readonly name = 'lm-studio';
  readonly endpoint: string;
  private config: LMStudioConfig;
  private currentLoad = 0;
  private lastError?: string;
  private responseTimeHistory: number[] = [];
  private errorCount = 0;
  private requestCount = 0;

  constructor(config: LMStudioConfig) {
    this.config = config;
    this.endpoint = config.endpoint;
  }

  /**
   * Check if LM Studio is available and responding
   */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.endpoint}/v1/models`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      logger.debug('LM Studio availability check failed:', error);
      return false;
    }
  }

  /**
   * Generate code using LM Studio
   */
  async generateCode(prompt: string, options: any = {}): Promise<LLMResponse> {
    const startTime = Date.now();
    this.currentLoad++;
    this.requestCount++;

    try {
      const response = await this.makeRequest(prompt, options);
      const responseTime = Date.now() - startTime;

      // Track response time
      this.responseTimeHistory.push(responseTime);
      if (this.responseTimeHistory.length > 100) {
        this.responseTimeHistory = this.responseTimeHistory.slice(-50);
      }

      // Calculate confidence based on response quality indicators
      const confidence = this.calculateConfidence(response.content, responseTime, options.taskType);

      return {
        content: response.content,
        confidence,
        responseTime,
        model: response.model || this.config.defaultModel,
        provider: this.name,
        metadata: {
          tokens: response.usage?.total_tokens,
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          finishReason: response.choices?.[0]?.finish_reason,
        },
      };
    } catch (error) {
      this.errorCount++;
      this.lastError = (error as Error).message;
      throw error;
    } finally {
      this.currentLoad--;
    }
  }

  /**
   * Make HTTP request to LM Studio API
   */
  private async makeRequest(prompt: string, options: any): Promise<any> {
    const payload = {
      model: options.model || this.config.defaultModel,
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(options.taskType),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: this.getTemperature(options.taskType),
      max_tokens: this.getMaxTokens(options.taskType),
      stream: false,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || this.config.timeout);

    try {
      const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response choices returned from LM Studio');
      }

      return {
        content: data.choices[0].message.content,
        model: data.model,
        usage: data.usage,
        choices: data.choices,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Get system prompt based on task type
   */
  private getSystemPrompt(taskType: string): string {
    const prompts: Record<string, string> = {
      template:
        'You are a code template generator. Create clean, well-structured code templates quickly.',
      format: 'You are a code formatter. Format the provided code cleanly and consistently.',
      edit: 'You are a code editor. Make precise, minimal edits to improve the code.',
      boilerplate: 'You are a boilerplate generator. Create standard code patterns and structures.',
      documentation: 'You are a documentation generator. Create clear, concise documentation.',
      default: 'You are a helpful coding assistant. Generate clean, efficient code.',
    };

    return prompts[taskType] || prompts.default;
  }

  /**
   * Get temperature based on task type
   */
  private getTemperature(taskType: string): number {
    const temperatures: Record<string, number> = {
      template: 0.1, // Very deterministic for templates
      format: 0.0, // Completely deterministic for formatting
      edit: 0.2, // Low creativity for edits
      boilerplate: 0.1, // Consistent boilerplate
      documentation: 0.3, // Slightly more creative for docs
      default: 0.4,
    };

    return temperatures[taskType] || temperatures.default;
  }

  /**
   * Get max tokens based on task type
   */
  private getMaxTokens(taskType: string): number {
    const maxTokens: Record<string, number> = {
      template: 1000,
      format: 2000,
      edit: 800,
      boilerplate: 1500,
      documentation: 2000,
      default: 1500,
    };

    return maxTokens[taskType] || maxTokens.default;
  }

  /**
   * Calculate confidence score based on response characteristics
   */
  private calculateConfidence(content: string, responseTime: number, taskType?: string): number {
    let confidence = 0.8; // Base confidence for LM Studio

    // Adjust based on response characteristics
    if (content.length < 10) {
      confidence -= 0.3; // Very short responses are suspicious
    }

    if (content.includes('error') || content.includes('Error')) {
      confidence -= 0.2; // Error mentions reduce confidence
    }

    if (content.includes('```')) {
      confidence += 0.1; // Code blocks indicate good structure
    }

    // Adjust based on response time (LM Studio should be fast)
    if (responseTime > 5000) {
      confidence -= 0.2; // Slow responses for LM Studio are concerning
    } else if (responseTime < 1000) {
      confidence += 0.1; // Very fast responses are good
    }

    // Task-specific adjustments
    if (taskType === 'template' || taskType === 'format') {
      confidence += 0.1; // LM Studio is great at these
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): LLMCapabilities {
    return {
      strengths: ['speed', 'templates', 'formatting', 'boilerplate', 'quick-edits'],
      optimalFor: [
        'template-generation',
        'code-formatting',
        'simple-edits',
        'boilerplate-creation',
      ],
      responseTime: '<1s',
      contextWindow: 32768,
      supportsStreaming: true,
      maxConcurrent: 4,
    };
  }

  /**
   * Get current provider status
   */
  async getStatus(): Promise<LLMStatus> {
    const isAvailable = await this.isAvailable();
    const avgResponseTime =
      this.responseTimeHistory.length > 0
        ? this.responseTimeHistory.reduce((sum, time) => sum + time, 0) /
          this.responseTimeHistory.length
        : 0;

    const errorRate = this.requestCount > 0 ? this.errorCount / this.requestCount : 0;

    return {
      available: isAvailable,
      currentLoad: this.currentLoad,
      maxLoad: 4, // Based on capabilities
      responseTime: avgResponseTime,
      errorRate,
      lastError: this.lastError,
    };
  }

  /**
   * Reset statistics (for testing or maintenance)
   */
  resetStats(): void {
    this.responseTimeHistory = [];
    this.errorCount = 0;
    this.requestCount = 0;
    this.lastError = undefined;
  }
}
