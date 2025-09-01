/**
 * Ollama Provider - Implements LLMProvider interface for Ollama integration
 * Optimized for complex analysis, architecture, and security tasks requiring deep reasoning
 */

import { logger } from '../logger.js';
import {
  LLMProvider,
  LLMResponse,
  LLMCapabilities,
  LLMStatus,
} from '../../domain/interfaces/llm-interfaces.js';

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
      const timeoutId = setTimeout(() => controller.abort(), parseInt(process.env.OLLAMA_HEALTH_CHECK_TIMEOUT || '5000'));

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
        top_p: parseFloat(process.env.MODEL_TOP_P || '0.9'),
        top_k: parseInt(process.env.MODEL_TOP_K || '40'),
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
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
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
    const baseTemp = parseFloat(process.env.MODEL_TEMPERATURE || '0.7');
    const temperatures: Record<string, number> = {
      analysis: Math.min(baseTemp * 0.14, 0.1), // Low temperature for analytical tasks
      security: Math.min(baseTemp * 0.07, 0.05), // Very low for security analysis
      architecture: Math.min(baseTemp * 0.43, 0.3), // Moderate creativity for design
      'multi-file': Math.min(baseTemp * 0.29, 0.2), // Low for systematic approaches
      debugging: Math.min(baseTemp * 0.14, 0.1), // Low for systematic debugging
      review: Math.min(baseTemp * 0.29, 0.2), // Low-moderate for consistent reviews
      default: Math.min(baseTemp * 0.57, 0.4),
    };

    return temperatures[taskType] || temperatures.default;
  }

  /**
   * Get context length based on task type
   */
  private getContextLength(taskType: string): number {
    const defaultContext = parseInt(process.env.MODEL_CONTEXT_WINDOW || '131072');
    const contextLengths: Record<string, number> = {
      analysis: defaultContext, // Large context for analysis
      security: defaultContext, // Large context for security review
      architecture: Math.floor(defaultContext / 2), // Moderate context for design
      'multi-file': defaultContext, // Large context for multiple files
      debugging: Math.floor(defaultContext / 2), // Moderate context for debugging
      review: defaultContext, // Large context for code review
      default: Math.floor(defaultContext / 2),
    };

    return contextLengths[taskType] || contextLengths.default;
  }

  /**
   * Calculate confidence score based on response characteristics
   */
  private calculateConfidence(content: string, responseTime: number, taskType?: string): number {
    let confidence = parseFloat(process.env.MODEL_BASE_CONFIDENCE || '0.9'); // Base confidence for Ollama (higher quality)

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
   * CRITICAL FIX: Implement IModelProvider interface with proper tool support
   * This method is called by UnifiedModelClient and must handle function calling
   */
  async request(request: any): Promise<any> {
    logger.debug('OllamaProvider.request() method entry', { 
      requestId: request.id,
      hasPrompt: !!request.prompt,
      promptLength: request.prompt?.length || 0
    });
    logger.info('OllamaProvider.request() called', {
      hasTools: !!request.tools,
      toolCount: request.tools?.length || 0,
      requestKeys: Object.keys(request),
    });

    // For requests with tools, use function calling support
    if (request.tools && request.tools.length > 0) {
      logger.info(`Ollama function calling: Processing ${request.tools.length} tools`);
      
      try {
        // Validate and transform tools safely
        const validatedTools = this.validateAndTransformTools(request.tools);
        
        if (validatedTools.length === 0) {
          logger.warn('No valid tools found after validation, falling back to prompt-only mode');
          return await this.generateCode(request.prompt, request.options || {});
        }
        
        const ollamaRequest = {
          model: request.model || this.config.defaultModel,
          messages: [
            {
              role: 'user',
              content: request.prompt,
            }
          ],
          tools: validatedTools,
          stream: false,
          options: {
            temperature: request.temperature || parseFloat(process.env.MODEL_TEMPERATURE || '0.7'),
            num_ctx: request.num_ctx || parseInt(process.env.OLLAMA_NUM_CTX || '131072'),
            ...request.options,
          },
        };

        logger.debug('Sending request to Ollama with tools', {
          model: ollamaRequest.model,
          toolCount: ollamaRequest.tools.length,
        });

        const response = await fetch(`${this.endpoint}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ollamaRequest),
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.warn('Ollama function calling failed, attempting fallback', {
            status: response.status,
            error: errorText,
          });
          
          // Check for memory constraint errors first
          const isMemoryError = errorText.includes('requires more system memory') || 
                               errorText.includes('insufficient memory') ||
                               errorText.includes('not enough memory') ||
                               errorText.includes('memory limit');
          
          if (isMemoryError) {
            // Preserve the original memory error message for UnifiedModelClient to handle
            throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
          }
          
          // If function calling failed, try without tools (fallback mode)
          if (response.status === 500 || errorText.includes('does not support tools')) {
            logger.info('Ollama fallback: Model does not support tools, using prompt-based approach');
            return await this.generateCode(request.prompt, request.options || {});
          }
          
          throw new Error(`Ollama request failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        logger.debug('Ollama function calling response received', {
          hasToolCalls: !!result.message?.tool_calls,
          toolCallCount: result.message?.tool_calls?.length || 0,
        });

        // Return response in expected format
        return {
          id: request.id,
          content: result.message?.content || '',
          toolCalls: result.message?.tool_calls?.map((toolCall: any) => ({
            id: toolCall.function?.name || `tool_${Date.now()}`,
            function: {
              name: toolCall.function?.name,
              // CRITICAL FIX: Check if arguments are already a string to prevent double-encoding
              arguments: typeof toolCall.function?.arguments === 'string' 
                ? toolCall.function.arguments 
                : JSON.stringify(toolCall.function?.arguments || {}),
            },
          })) || [],
          usage: {
            promptTokens: result.prompt_eval_count || 0,
            completionTokens: result.eval_count || 0,
            totalTokens: (result.prompt_eval_count || 0) + (result.eval_count || 0),
          },
          model: this.config.defaultModel,
          provider: this.name,
        };
      } catch (error) {
        logger.error('Ollama function calling failed:', error);
        throw error;
      }
    }

    // Fallback to regular generateCode for non-tool requests
    return await this.generateCode(request.prompt, request.options || {});
  }

  /**
   * Validate and transform tools to prevent runtime errors
   * Fixes the issue where invalid tool shapes can produce runtime errors
   */
  private validateAndTransformTools(tools: any[]): any[] {
    if (!Array.isArray(tools)) {
      logger.warn('Tools parameter is not an array, returning empty array');
      return [];
    }

    const validTools: any[] = [];
    
    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      
      try {
        // Validate tool structure - handle both ModelTool and ToolInfo formats
        let transformedTool: any;
        
        if (tool && typeof tool === 'object') {
          // Handle ModelTool format (with nested function object)
          if (tool.type === 'function' && tool.function) {
            if (this.isValidFunctionSpec(tool.function)) {
              transformedTool = {
                type: 'function',
                function: {
                  name: tool.function.name,
                  description: tool.function.description || '',
                  parameters: tool.function.parameters || { type: 'object', properties: {} },
                }
              };
            }
          }
          // Handle ToolInfo format (flat structure)
          else if (tool.name && typeof tool.name === 'string') {
            transformedTool = {
              type: 'function',
              function: {
                name: tool.name,
                description: tool.description || '',
                parameters: tool.inputSchema || tool.parameters || { type: 'object', properties: {} },
              }
            };
          }
        }
        
        if (transformedTool) {
          validTools.push(transformedTool);
          logger.debug(`Validated tool: ${transformedTool.function.name}`);
        } else {
          logger.warn(`Invalid tool at index ${i}, skipping`, { 
            toolKeys: tool ? Object.keys(tool) : 'null/undefined',
            toolType: typeof tool
          });
        }
      } catch (error) {
        logger.warn(`Failed to validate tool at index ${i}:`, error);
      }
    }
    
    logger.info(`Tool validation complete: ${validTools.length}/${tools.length} tools valid`);
    return validTools;
  }

  /**
   * Check if a function specification is valid
   */
  private isValidFunctionSpec(func: any): boolean {
    return func && 
           typeof func === 'object' && 
           typeof func.name === 'string' && 
           func.name.length > 0 &&
           typeof func.description === 'string';
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
