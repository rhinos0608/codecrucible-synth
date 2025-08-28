/**
 * Ollama Provider - Implements LLMProvider interface for Ollama integration
 * Optimized for complex analysis, architecture, and security tasks requiring deep reasoning
 */

import { logger } from '../logger.js';
import { LLMProvider, LLMResponse, LLMCapabilities, LLMStatus } from '../../domain/interfaces/llm-interfaces.js';

export interface OllamaConfig {
  endpoint: string;
  defaultModel: string;
  timeout: number;
  maxRetries: number;
}

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  readonly endpoint: string;
  private config: OllamaConfig;
  private currentLoad = 0;
  private lastError?: string;
  private responseTimeHistory: number[] = [];
  private errorCount = 0;
  private requestCount = 0;

  constructor(config: OllamaConfig) {
    this.config = config;
    this.endpoint = config.endpoint;
  }

  /**
   * Check if Ollama is available and responding
   */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.endpoint}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      logger.debug('Ollama availability check failed:', error);
      return false;
    }
  }

  /**
   * Generate code using Ollama
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
          totalDuration: response.total_duration,
          loadDuration: response.load_duration,
          promptEvalCount: response.prompt_eval_count,
          evalCount: response.eval_count,
          evalDuration: response.eval_duration,
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
   * Make HTTP request to Ollama API
   */
  private async makeRequest(prompt: string, options: any): Promise<any> {
    const payload = {
      model: options.model || this.config.defaultModel,
      prompt: this.buildPrompt(prompt, options.taskType),
      stream: false,
      options: {
        temperature: this.getTemperature(options.taskType),
        top_p: 0.9,
        top_k: 40,
        num_ctx: this.getContextLength(options.taskType),
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || this.config.timeout);

    try {
      const response = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.response) {
        throw new Error('No response content returned from Ollama');
      }

      return {
        content: data.response,
        model: data.model,
        total_duration: data.total_duration,
        load_duration: data.load_duration,
        prompt_eval_count: data.prompt_eval_count,
        eval_count: data.eval_count,
        eval_duration: data.eval_duration,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Build prompt with system instructions based on task type
   */
  private buildPrompt(prompt: string, taskType: string): string {
    const systemPrompts: Record<string, string> = {
      analysis:
        'You are an expert code analyst. Provide thorough, detailed analysis with specific insights and recommendations.',
      security:
        'You are a security expert. Analyze code for vulnerabilities, security issues, and provide detailed security recommendations.',
      architecture:
        'You are a software architect. Design robust, scalable solutions with clear architectural decisions and trade-offs.',
      'multi-file':
        'You are working with multiple files. Consider relationships between files and provide comprehensive solutions.',
      debugging:
        'You are a debugging expert. Identify issues systematically and provide detailed troubleshooting steps.',
      review:
        'You are conducting a code review. Provide detailed feedback on code quality, performance, and best practices.',
      default:
        'You are an expert software engineer. Provide thoughtful, well-reasoned solutions with detailed explanations.',
    };

    const systemPrompt = systemPrompts[taskType] || systemPrompts.default;
    return `${systemPrompt}\n\n${prompt}`;
  }

  /**
   * Get temperature based on task type
   */
  private getTemperature(taskType: string): number {
    const temperatures: Record<string, number> = {
      analysis: 0.1, // Low temperature for analytical tasks
      security: 0.05, // Very low for security analysis
      architecture: 0.3, // Moderate creativity for design
      'multi-file': 0.2, // Low for systematic approaches
      debugging: 0.1, // Low for systematic debugging
      review: 0.2, // Low-moderate for consistent reviews
      default: 0.4,
    };

    return temperatures[taskType] || temperatures.default;
  }

  /**
   * Get context length based on task type
   */
  private getContextLength(taskType: string): number {
    const contextLengths: Record<string, number> = {
      analysis: 8192, // Large context for analysis
      security: 8192, // Large context for security review
      architecture: 4096, // Moderate context for design
      'multi-file': 8192, // Large context for multiple files
      debugging: 4096, // Moderate context for debugging
      review: 8192, // Large context for code review
      default: 4096,
    };

    return contextLengths[taskType] || contextLengths.default;
  }

  /**
   * Calculate confidence score based on response characteristics
   */
  private calculateConfidence(content: string, responseTime: number, taskType?: string): number {
    let confidence = 0.9; // Base confidence for Ollama (higher quality)

    // Adjust based on response characteristics
    if (content.length < 50) {
      confidence -= 0.4; // Very short responses are suspicious for complex tasks
    }

    if (content.length > 500) {
      confidence += 0.05; // Detailed responses are good for Ollama
    }

    if (content.includes('error') || content.includes('Error')) {
      confidence -= 0.2; // Error mentions reduce confidence
    }

    // Look for structured analysis indicators
    if (
      content.includes('Analysis:') ||
      content.includes('Recommendation:') ||
      content.includes('Issue:') ||
      content.includes('Solution:')
    ) {
      confidence += 0.05; // Structured responses are good
    }

    // Look for code quality indicators
    if (content.includes('```') && content.split('```').length > 2) {
      confidence += 0.05; // Multiple code blocks indicate thoroughness
    }

    // Adjust based on response time (Ollama is expected to be slower)
    if (responseTime < 5000) {
      confidence -= 0.1; // Too fast might indicate shallow analysis
    } else if (responseTime > 60000) {
      confidence -= 0.2; // Too slow might indicate issues
    }

    // Task-specific adjustments
    if (taskType === 'analysis' || taskType === 'security' || taskType === 'architecture') {
      confidence += 0.05; // Ollama excels at these
    }

    return Math.max(0.2, Math.min(1.0, confidence));
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): LLMCapabilities {
    return {
      strengths: [
        'analysis',
        'reasoning',
        'security',
        'architecture',
        'complex-tasks',
        'multi-file',
      ],
      optimalFor: [
        'code-analysis',
        'security-review',
        'architecture-design',
        'debugging',
        'code-review',
      ],
      responseTime: '5-30s',
      contextWindow: 128000,
      supportsStreaming: true,
      maxConcurrent: 2,
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
      maxLoad: 2, // Based on capabilities
      responseTime: avgResponseTime,
      errorRate,
      lastError: this.lastError,
    };
  }

  /**
   * Get available models from Ollama
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      logger.error('Failed to get available Ollama models:', error);
      return [];
    }
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
