/**
 * Ollama Provider - Implements LLMProvider interface for Ollama integration
 * Optimized for complex analysis, architecture, and security tasks requiring deep reasoning
 */

import { logger } from '../../infrastructure/logging/logger.js';
import {
  LLMCapabilities,
  LLMProvider,
  LLMResponse,
  LLMStatus,
} from '../../domain/interfaces/llm-interfaces.js';
import {
  generateContextualSystemPrompt,
} from '../../domain/prompts/system-prompt.js';

// Ollama-specific interfaces to replace unsafe 'any' types
export interface OllamaOptions {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  num_ctx?: number;
  num_predict?: number;
  repeat_penalty?: number;
  seed?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: OllamaTool[];
  format?: 'json';
  raw?: boolean;
  taskType?: string;
  timeout?: number;
  model?: string;
  contextLength?: number;
  [key: string]: unknown; // Allow additional options
}

export interface OllamaRequest {
  model?: string;
  prompt?: string;
  messages?: OllamaMessage[];
  options?: OllamaOptions;
  tools?: OllamaTool[];
  format?: 'json';
  stream?: boolean;
  id?: string;
  onStreamingToken?: (token: string, metadata?: OllamaStreamingMetadata | undefined) => void;
  taskType?: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  num_ctx?: number;
  timeout?: number;
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  images?: string[];
  tool_calls?: OllamaToolCall[];
}

export interface OllamaToolCall {
  id?: string;
  type?: 'function';
  function: {
    name: string;
    arguments: string | Record<string, unknown>;
  };
}

export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters?: {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
  // Legacy properties for backward compatibility
  name?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message?: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  response?: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaStreamingMetadata {
  model?: string;
  totalDuration?: number;
  loadDuration?: number;
  promptEvalCount?: number;
  promptEvalDuration?: number;
  evalCount?: number;
  evalDuration?: number;
  context?: number[];
  [key: string]: unknown;
}

export interface ParsedToolCall {
  id?: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface FunctionSpec {
  name: string;
  description: string;
  parameters?: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface OllamaModel {
  name: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: {
    format?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaModelList {
  models: OllamaModel[];
}

export interface OllamaConfig {
  endpoint: string;
  defaultModel: string;
  timeout: number;
  maxRetries: number;
}

export class OllamaProvider implements LLMProvider {
  public readonly name = 'ollama';
  public readonly endpoint: string;
  private readonly config: Readonly<OllamaConfig>;
  private currentLoad = 0;
  private lastError?: string;
  private responseTimeHistory: number[] = [];
  private errorCount = 0;
  private requestCount = 0;

  // Rate limiting state
  private requestTimestamps: number[] = [];
  private readonly maxRequestsPerMinute: number;
  private readonly rateLimitWindow = 60000; // 1 minute in milliseconds

  public constructor(config: Readonly<OllamaConfig>) {
    this.config = config;
    this.endpoint = config.endpoint;
    // Initialize rate limiting after methods are available
    this.maxRequestsPerMinute = parseInt(process.env.MAX_REQUESTS_PER_MINUTE ?? '60', 10);
  }

  /**
   * Check if Ollama is available and responding
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => { controller.abort(); }, this.parseEnvInt('OLLAMA_HEALTH_CHECK_TIMEOUT', 5000, 1000, 30000));

      const response = await fetch(`${this.endpoint}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(`Ollama service check failed: ${response.status} ${response.statusText}`);
        return false;
      }

      // Check if at least one model is available
      try {
        const data: unknown = await response.json();
        if (
          typeof data === 'object' &&
          data !== null &&
          'models' in data &&
          Array.isArray((data as { models: unknown }).models)
        ) {
          const { models } = data as { models: unknown[] };
          if (models.length === 0) {
            logger.warn('Ollama service is running but no models are available');
            logger.info('To fix: Run "ollama pull llama3.1:8b" or "ollama pull deepseek-coder:8b"');
            return false;
          }
          logger.debug(`Ollama service available with ${models.length} models`);
        } else {
          logger.warn('Ollama service response does not contain a valid models array');
          return false;
        }
      } catch (jsonError) {
        logger.debug('Could not parse model list, but service is responsive');
      }

      return true;
    } catch (error) {
      logger.error('Ollama connectivity check failed:', error);
      logger.info('Ensure Ollama is running: "ollama serve" or check http://localhost:11434');
      return false;
    }
  }

  /**
   * Check rate limiting to prevent abuse
   */
  private checkRateLimit(): void {
    const now = Date.now();

    // Remove timestamps older than the rate limit window
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.rateLimitWindow
    );

    // Check if we're at the limit
    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      const oldestRequest = Math.min(...this.requestTimestamps);
      const resetTime = oldestRequest + this.rateLimitWindow;
      const waitTime = Math.ceil((resetTime - now) / 1000);

      throw new Error(
        `Rate limit exceeded: ${this.maxRequestsPerMinute} requests per minute. Try again in ${waitTime} seconds.`
      );
    }

    // Record this request
    this.requestTimestamps.push(now);
  }

  /**
   * Validate input prompt length to prevent DoS attacks
   */
  private validateInputLength(prompt: string): void {
    const maxLength = this.parseEnvInt('MAX_PROMPT_LENGTH', 128000, 1000, 1000000);

    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt: must be a non-empty string');
    }

    if (prompt.length > maxLength) {
      throw new Error(
        `Prompt too long: ${prompt.length} characters exceeds maximum of ${maxLength}`
      );
    }

    // Check for potential injection attempts
    const suspiciousPatterns = [
      /<!--[\s\S]*?-->/g, // HTML comments
      /<script[\s\S]*?\/script>/gi, // Script tags
      /javascript:/gi, // JavaScript protocol
      /data:text\/html/gi, // Data URLs
    ];

    suspiciousPatterns.forEach((pattern: Readonly<RegExp>) => {
      if (pattern.test(prompt)) {
        throw new Error('Prompt contains potentially unsafe content');
      }
    });
  }

  /**
   * Generate code using Ollama
   */
  public async generateCode(prompt: Readonly<string>, options: Readonly<OllamaOptions> = {}): Promise<LLMResponse> {
    this.checkRateLimit();
    this.validateInputLength(prompt);

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
      const content = response.message?.content ?? response.response ?? '';
      const confidence = this.calculateConfidence(
        content,
        responseTime,
        options.taskType ?? 'default'
      );

      return {
        content,
        confidence,
        responseTime,
        model: response.model ?? this.config.defaultModel,
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
   * Make HTTP request to Ollama API with full tool and context support
   */
  private async makeRequest(prompt: string, options: OllamaOptions): Promise<OllamaResponse> {
    // If tools are provided, delegate to the request method for function calling
    if (options.tools && options.tools.length > 0) {
      logger.debug('makeRequest delegating to request method for tool support', {
        toolCount: options.tools.length,
      });

      const requestObj = {
        prompt,
        tools: options.tools,
        model: options.model || this.config.defaultModel,
        temperature: options.temperature || this.getTemperature(options.taskType ?? 'default'),
        num_ctx:
          options.num_ctx ||
          options.contextLength ||
          this.getContextLength(options.taskType ?? 'default', prompt?.length),
        options: {
          top_p: this.parseEnvFloat('MODEL_TOP_P', 0.9, 0.0, 1.0),
          top_k: this.parseEnvInt('MODEL_TOP_K', 40, 1, 200),
          ...options,
        },
      };

      const result = await this.request(requestObj) as LLMResponse;
      // Adapt LLMResponse to OllamaResponse shape
      const toolCalls: OllamaToolCall[] | undefined = result.toolCalls
        ? result.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          }))
        : undefined;

      return {
        model: result.model || this.config.defaultModel,
        created_at: new Date().toISOString(),
        message: {
          role: 'assistant',
          content: result.content,
          tool_calls: toolCalls,
        },
        response: result.content,
        done: true,
        total_duration: result.total_duration,
        prompt_eval_count: result.prompt_eval_count,
        eval_count: result.eval_count,
      };
    }

    // Sanitize options to only include Ollama-supported parameters
    const sanitizedOptions = this.sanitizeOllamaOptions(options);

    // Build payload with proper context and option propagation
    const builtPrompt = this.buildPrompt(prompt, options.taskType ?? 'default');
    const payload = {
      model: options.model || this.config.defaultModel,
      prompt: builtPrompt,
      stream: options.stream ?? false,
      options: {
        temperature: options.temperature || this.getTemperature(options.taskType ?? 'default'),
        top_p: options.top_p || this.parseEnvFloat('MODEL_TOP_P', 0.9, 0.0, 1.0),
        top_k: options.top_k || this.parseEnvInt('MODEL_TOP_K', 40, 1, 200),
        num_ctx:
          options.num_ctx ||
          options.contextLength ||
          this.getContextLength(options.taskType ?? 'default', builtPrompt.length),
        // Enable GPU offloading if available
        num_gpu: this.getGPULayers(),
        // Only include sanitized Ollama options (exclude num_ctx to prevent override)
        ...Object.fromEntries(
          Object.entries(sanitizedOptions).filter(([key]) => key !== 'num_ctx')
        ),
      },
    };

    logger.debug('Ollama makeRequest payload', {
      model: payload.model,
      contextLength: payload.options.num_ctx,
      temperature: payload.options.temperature,
      hasAdditionalOptions: Object.keys(options).length > 5,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, options.timeout ?? this.config.timeout);

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
        throw new Error(
          `Ollama API error: ${response.status} ${response.statusText} - ${this.sanitizeErrorMessage(errorText)}`
        );
      }

      // Robust JSON parsing with multiple fallback strategies
      const dataUnknown = await this.parseRobustJSON(response);
      const data = dataUnknown as Partial<OllamaResponse>;

      logger.debug('Ollama response structure:', {
        keys: Object.keys(data),
        hasResponse: !!data.response,
        hasContent: !!data.response,
        responseLength: typeof data.response === 'string' ? data.response.length : 0,
        contentLength: typeof data.response === 'string' ? data.response.length : 0,
        model: data.model,
        done: data.done,
      });

      if (!data.response) {
        // Check if Ollama is actually running and the model exists
        const isOllamaAvailable = await this.isAvailable();
        if (!isOllamaAvailable) {
          throw new Error(
            'Ollama service is not available or no models are loaded. Run "ollama serve" and "ollama pull llama3.1:8b"'
          );
        }

        // Log the full response for debugging
        logger.error('Ollama returned empty response:', {
          model: payload.model,
          promptLength: builtPrompt.length,
          responseData: JSON.stringify(data).substring(0, 500),
        });

        throw new Error(
          `No response content from Ollama model ${payload.model}. The model may be loading or unavailable.`
        );
      }

      // Safely extract response and content fields
      const responseField = typeof data.response === 'string' ? data.response : '';
      const contentField = (typeof data === 'object' && data !== null && 'content' in data && typeof (data as { content?: unknown }).content === 'string')
        ? (data as { content: string }).content
        : '';
      const finalContent: string = typeof responseField === 'string' ? responseField : (typeof contentField === 'string' ? contentField : '');

      if (finalContent.length === 0) {
        const errorMessage = `Ollama returned zero-length content from model ${payload.model}. Model may be initializing or prompt may be inappropriate.`;

        // Check if there are ACTUAL tool calls with meaningful data
        const toolCallsFromData = (data as { tool_calls?: unknown }).tool_calls;
        const toolCallsFromMessage = data.message && typeof data.message === 'object'
          ? (data.message as { tool_calls?: unknown }).tool_calls
          : undefined;
        const hasValidToolCalls =
          (Array.isArray(toolCallsFromData) &&
            toolCallsFromData.length > 0 &&
            typeof (toolCallsFromData[0]) === 'object' &&
            toolCallsFromData[0] !== null &&
            'function' in toolCallsFromData[0] &&
            typeof (toolCallsFromData[0] as { function?: { name?: unknown } }).function?.name === 'string') ||
          (Array.isArray(toolCallsFromMessage) &&
            toolCallsFromMessage.length > 0 &&
            typeof (toolCallsFromMessage[0]) === 'object' &&
                toolCallsFromMessage[0] !== null &&
                'function' in toolCallsFromMessage[0] &&
                typeof (toolCallsFromMessage[0] as { function?: { name?: unknown } }).function?.name === 'string'
            );

        logger.error(errorMessage, {
          model: payload.model,
          promptLength: builtPrompt.length,
          hasValidToolCalls,
          toolCallsCount:
            (Array.isArray(toolCallsFromData) ? toolCallsFromData.length : 0) +
            (Array.isArray(toolCallsFromMessage) ? toolCallsFromMessage.length : 0),
          responseKeys: Object.keys(data),
        });

        // Only allow zero-length content if there are VALID tool calls with function names
        if (!hasValidToolCalls) {
          throw new Error(
            `${errorMessage} No valid tool calls found to compensate for empty content.`
          );
        } else {
          logger.debug('Empty content allowed due to valid tool calls being present');
        }
      }

      return {
        model: data.model ?? this.config.defaultModel,
        created_at: new Date().toISOString(),
        message: {
          role: 'assistant',
          content: finalContent,
          tool_calls: (typeof data === 'object' && data !== null && 'tool_calls' in data && Array.isArray((data as { tool_calls?: unknown }).tool_calls)
            ? (data as { tool_calls?: OllamaToolCall[] }).tool_calls
            : data.message?.tool_calls),
        },
        response: typeof data.response === 'string' ? data.response : finalContent,
        done: !!data.done,
        context: data.context,
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
    const baseTemp = this.parseEnvFloat('MODEL_TEMPERATURE', 0.7, 0.0, 2.0);
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
   * Get context length with adaptive sliding window from 131K down based on available memory
   */
  private getContextLength(taskType: string, promptLength?: number): number {
    const maxContext = this.parseEnvInt('MODEL_MAX_CONTEXT_WINDOW', 131072, 1024, 131072);

    // Get optimal context size based on memory availability and sliding algorithm
    const optimalContext = this.calculateAdaptiveContext(maxContext, taskType, promptLength);

    // Apply task-specific multipliers while respecting memory constraints
    const taskMultipliers: Record<string, number> = {
      analysis: 1.0, // Full available context for analysis
      security: 1.0, // Full available context for security
      architecture: 0.8, // 80% for architecture tasks
      'multi-file': 1.0, // Full context for multi-file operations
      debugging: 0.6, // 60% for debugging (more focused)
      review: 0.8, // 80% for code reviews
      template: 0.3, // 30% for simple templates
      edit: 0.4, // 40% for edits
      format: 0.3, // 30% for formatting
      default: 0.5, // 50% default
    };

    const multiplier = taskMultipliers[taskType] || taskMultipliers.default;
    const taskAdjustedContext = Math.floor(optimalContext * multiplier);

    // Ensure minimum context for functionality
    return Math.max(taskAdjustedContext, 8192);
  }

  /**
   * Calculate adaptive context size using sliding window algorithm
   * Starts at 131K and slides down based on available memory
   */
  private calculateAdaptiveContext(
    maxDesired: number,
    taskType: string,
    promptLength?: number
  ): number {
    // Context size tiers for sliding algorithm
    const contextTiers = [131072, 96000, 64000, 48000, 32000, 24000, 16000, 12000, 8192];

    // Get current memory status
    const memoryProfile = this.getMemoryProfile();

    // If prompt length provided, adjust desired context
    let desiredContext = maxDesired;
    if (promptLength && promptLength > 0) {
      const estimatedTokens = Math.ceil(promptLength / 4);
      // Use 2.5x input length as desired context (balanced approach)
      desiredContext = Math.min(estimatedTokens * 2.5, maxDesired);
    }

    // Find the largest context tier that fits in available memory
    for (const contextSize of contextTiers) {
      if (contextSize > desiredContext) continue; // Skip if larger than desired

      const memoryRequired = this.estimateMemoryForContext(contextSize);
      const isMemorySufficient = memoryRequired <= memoryProfile.availableGPU * 0.8; // Use 80% threshold

      if (isMemorySufficient) {
        logger.debug(
          `Selected context size: ${contextSize} tokens (memory: ${memoryRequired.toFixed(1)}GB/${memoryProfile.availableGPU.toFixed(1)}GB available)`,
          {
            taskType,
            promptLength,
            memoryProfile,
          }
        );
        return contextSize;
      }
    }

    // Fallback to minimum safe context
    logger.warn(`Memory constraints force minimum context window`, {
      memoryProfile,
      desiredContext,
    });
    return 8192;
  }

  /**
   * Get comprehensive memory profile for adaptive decisions
   */
  private getMemoryProfile(): {
    totalGPU: number;
    availableGPU: number;
    totalRAM: number;
    availableRAM: number;
    memoryPressure: 'low' | 'medium' | 'high';
  } {
    // Detect GPU memory (RTX 4070 SUPER has ~12GB, but ~10.7GB available after driver overhead)
    const totalGPU = 12.0; // GB - could be detected dynamically
    const availableGPU = 10.7; // GB - from your Ollama logs

    // System RAM detection (you have 31.6GB total)
    const totalRAM = 32.0; // GB
    const availableRAM = 12.0; // GB - approximate based on your logs

    // Calculate memory pressure
    const gpuUtilization = (totalGPU - availableGPU) / totalGPU;
    const ramUtilization = (totalRAM - availableRAM) / totalRAM;

    let memoryPressure: 'low' | 'medium' | 'high';
    if (gpuUtilization < 0.5 && ramUtilization < 0.6) {
      memoryPressure = 'low';
    } else if (gpuUtilization < 0.8 && ramUtilization < 0.8) {
      memoryPressure = 'medium';
    } else {
      memoryPressure = 'high';
    }

    return {
      totalGPU,
      availableGPU,
      totalRAM,
      availableRAM,
      memoryPressure,
    };
  }

  /**
   * Estimate GPU memory required for a given context size
   * Based on llama3.1:8b model requirements (more realistic estimation)
   */
  private estimateMemoryForContext(contextSize: number): number {
    // Model base memory: ~4.4GB for llama3.1:8b
    const modelBaseMemory = 4.4;

    // KV cache memory calculation (more accurate approximation)
    // For llama3.1:8b: roughly 16 bytes per token in KV cache
    // This is based on observed Ollama behavior: 131K context ≈ 16GB total, 8K context ≈ 1GB KV cache
    const kvCacheMemoryGB = (contextSize / 8192) * 1.0; // 1GB per 8K tokens KV cache

    // Compute buffer overhead (estimated 10% of model + KV cache)
    const computeOverhead = (modelBaseMemory + kvCacheMemoryGB) * 0.1;

    const totalMemory = modelBaseMemory + kvCacheMemoryGB + computeOverhead;

    logger.debug(
      `Memory estimation for ${contextSize} tokens: ${totalMemory.toFixed(2)}GB (base: ${modelBaseMemory}GB, KV: ${kvCacheMemoryGB.toFixed(2)}GB, overhead: ${computeOverhead.toFixed(2)}GB)`
    );

    return totalMemory;
  }

  /**
   * Calculate confidence score based on response characteristics
   */
  private calculateConfidence(content: string, responseTime: number, taskType?: string): number {
    let confidence = this.parseEnvFloat('MODEL_BASE_CONFIDENCE', 0.9, 0.1, 1.0); // Base confidence for Ollama

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
  public getCapabilities(): LLMCapabilities {
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
  public async getStatus(): Promise<LLMStatus> {
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
  public async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = (await response.json()) as OllamaModelList;
      return data.models.map((model: Readonly<OllamaModel>) => model.name);
    } catch (error) {
      logger.error('Failed to get available Ollama models:', error);
      return [];
    }
  }

  /**
   * CRITICAL FIX: Implement IModelProvider interface with proper tool support
   * This method is called by UnifiedModelClient and must handle function calling
   */
  public async request(request: unknown): Promise<unknown> {
    // Type guard to ensure request is OllamaRequest
    if (!request || typeof request !== 'object') {
      throw new Error('Invalid request: expected an object');
    }
    const typedRequest = request as OllamaRequest;
    
    // Check rate limiting and validate input before processing
    this.checkRateLimit();
    if (typedRequest.prompt) {
      this.validateInputLength(typedRequest.prompt);
    }
    const startTime = Date.now();

    logger.debug('OllamaProvider.request() method entry', {
      requestId: typedRequest.id,
      hasPrompt: !!typedRequest.prompt,
      promptLength: typedRequest.prompt?.length ?? 0,
    });
    logger.info('OllamaProvider.request() called', {
      hasTools: !!typedRequest.tools,
      toolCount: typedRequest.tools?.length ?? 0,
      requestKeys: Object.keys(request),
    });

    // For requests with tools, use function calling support
    if (typedRequest.tools && typedRequest.tools.length > 0) {
      logger.info(`Ollama function calling: Processing ${typedRequest.tools.length} tools`);

      try {
        // Validate and transform tools safely
        const validatedTools = this.validateAndTransformTools(typedRequest.tools);

        if (validatedTools.length === 0) {
          logger.warn('No valid tools found after validation, falling back to prompt-only mode');
          return await this.generateCode(typedRequest.prompt ?? '', typedRequest.options ?? {});
        }

        // Sanitize options to only include Ollama-supported parameters
        const sanitizedOptions = this.sanitizeOllamaOptions(typedRequest.options ?? {});

        // Generate comprehensive system prompt with tool context
        const availableToolNames = validatedTools
          .map((tool: Readonly<OllamaTool>) => tool.function.name ?? 'unknown')
          .filter((name: string) => name !== 'unknown');
        const systemPrompt = generateContextualSystemPrompt(
          availableToolNames,
          `Working with model: ${typedRequest.model ?? this.config.defaultModel}`
        );

        const ollamaRequest = {
          model: typedRequest.model ?? this.config.defaultModel,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: typedRequest.prompt,
            },
          ],
          tools: validatedTools,
          stream: typedRequest.stream ?? false,
          options: {
            temperature:
              typedRequest.temperature ?? this.parseEnvFloat('MODEL_TEMPERATURE', 0.7, 0.0, 2.0),
            num_ctx: typedRequest.num_ctx ?? this.parseEnvInt('OLLAMA_NUM_CTX', 131072, 1024, 1048576),
            // Enable GPU offloading if available
            num_gpu: this.getGPULayers(),
            // Only include sanitized Ollama options (exclude conflicting keys)
            ...Object.fromEntries(
              Object.entries(sanitizedOptions).filter(
                ([key]: readonly [string, unknown]) => !['num_ctx', 'num_gpu', 'temperature'].includes(key)
              )
            ),
          },
        };

        logger.debug('Sending request to Ollama with tools', {
          model: ollamaRequest.model,
          toolCount: ollamaRequest.tools.length,
        });

        // CRITICAL DEBUG: Log the exact request being sent to Ollama
        logger.info('🔍 DEBUGGING: Complete Ollama request payload:', {
          endpoint: `${this.endpoint}/api/chat`,
          payload: JSON.stringify(ollamaRequest, null, 2),
        });

        const response = await fetch(`${this.endpoint}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ollamaRequest),
        });

        // CRITICAL DEBUG: Log response status and headers
        logger.info('🔍 DEBUGGING: Ollama response received:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length'),
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error('🔍 DEBUGGING: Ollama error response:', {
            status: response.status,
            statusText: response.statusText,
            errorText,
            errorTextLength: errorText.length,
          });

          logger.warn('Ollama function calling failed, attempting fallback', {
            status: response.status,
            error: errorText,
          });

          // Check for memory constraint errors first
          const isMemoryError =
            errorText.includes('requires more system memory') ||
            errorText.includes('insufficient memory') ||
            errorText.includes('not enough memory') ||
            errorText.includes('memory limit');

          if (isMemoryError) {
            // Preserve the original memory error message for UnifiedModelClient to handle (but sanitized)
            throw new Error(
              `Ollama API error: ${response.status} ${response.statusText} - ${this.sanitizeErrorMessage(errorText)}`
            );
          }

          // If function calling failed, try without tools (fallback mode)
          if (response.status === 500 || errorText.includes('does not support tools')) {
            logger.info(
              'Ollama fallback: Model does not support tools, using prompt-based approach'
            );
            return await this.generateCode(typedRequest.prompt ?? '', typedRequest.options || {});
          }

          throw new Error(
            `Ollama request failed: ${response.status} - ${this.sanitizeErrorMessage(errorText)}`
          );
        }

        // Handle streaming vs non-streaming responses
        let result;
        if (typedRequest.stream && typedRequest.onStreamingToken) {
          // For streaming requests, process the stream and collect chunks
          logger.debug('Processing streaming response for function calling');
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response body reader available for streaming');
          }

          const decoder = new TextDecoder();
          let buffer = '';
          let accumulatedContent = '';
          let toolCalls: ParsedToolCall[] = [];
          let lastMetadata: OllamaStreamingMetadata = {};

          let streamDone = false;
          while (!streamDone) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.trim()) continue;

              try {
                const chunk: unknown = JSON.parse(line);
                if (typeof chunk === 'object' && chunk !== null) {
                  const obj = chunk as {
                    message?: { content?: unknown; tool_calls?: unknown };
                    response?: unknown;
                    model?: unknown;
                    done?: unknown;
                  };

                  // Emit streaming token if content is present
                  if (obj.message && typeof obj.message === 'object' && obj.message.content && typeof obj.message.content === 'string') {
                    accumulatedContent += obj.message.content;
                    typedRequest.onStreamingToken(String(obj.message.content), {
                      isComplete: false,
                      model: typeof obj.model === 'string' ? obj.model : undefined,
                    });
                  } else if (obj.response && typeof obj.response === 'string') {
                    accumulatedContent += obj.response;
                    typedRequest.onStreamingToken(String(obj.response), {
                      isComplete: false,
                      model: typeof obj.model === 'string' ? obj.model : undefined,
                    });
                  }

                  // Collect tool calls
                  if (
                    obj.message &&
                    typeof obj.message === 'object' &&
                    Array.isArray((obj.message as { tool_calls?: ParsedToolCall[] }).tool_calls)
                  ) {
                    toolCalls = toolCalls.concat(
                      (obj.message as { tool_calls: ParsedToolCall[] }).tool_calls
                    );
                  }

                  // Keep metadata from chunks with done flag
                  if (obj.done === true) {
                    lastMetadata = { ...(obj as OllamaStreamingMetadata) };
                    // Emit final token
                    typedRequest.onStreamingToken('', {
                      isComplete: true,
                      model: typeof obj.model === 'string'
                        ? obj.model
                        : ollamaRequest.model ?? this.config.defaultModel,
                    });
                    streamDone = true;
                  }
                }
              } catch (e) {
                // Skip malformed JSON lines
                continue;
              }
            }
          }

          // Process any remaining buffer
          if (buffer.trim()) {
            try {
              const chunk: unknown = JSON.parse(buffer);
              if (typeof chunk === 'object' && chunk !== null) {
                const obj = chunk as {
                  message?: { content?: unknown; tool_calls?: unknown };
                  response?: unknown;
                  done?: unknown;
                };
                if (obj.message && typeof obj.message === 'object' && obj.message.content && typeof obj.message.content === 'string') {
                  accumulatedContent += obj.message.content;
                } else if (obj.response && typeof obj.response === 'string') {
                  accumulatedContent += obj.response;
                }
                if (
                  obj.message &&
                  typeof obj.message === 'object' &&
                  Array.isArray((obj.message as { tool_calls?: ParsedToolCall[] }).tool_calls)
                ) {
                  toolCalls = toolCalls.concat(
                    (obj.message as { tool_calls: ParsedToolCall[] }).tool_calls
                  );
                }
                if (obj.done === true) {
                  lastMetadata = { ...(obj as OllamaStreamingMetadata) };
                }
              }
            } catch (e) {
              // Skip malformed final buffer
            }
          }

          // Construct result from accumulated data
          result = {
            message: {
              content: accumulatedContent,
              tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
            },
            content: accumulatedContent,
            response: accumulatedContent,
            ...lastMetadata,
          };
        } else {
          // For non-streaming requests, use the existing text parsing
          logger.debug('About to parse JSON for function calling');
          const responseText = await response.text();
          logger.debug('Raw response text length:', responseText.length);
          logger.debug('Raw response preview:', responseText.substring(0, 300));

          // Reset response for parseRobustJSON (since we already consumed the text)
          const mockResponse = {
            text: async () => {
              // Add an await expression to satisfy the async requirement
              await Promise.resolve();
              return responseText;
            },
          };
          await this.parseRobustJSON(mockResponse as Response);

        }

        // CRITICAL DEBUG: Log the parsed result structure
        if (result && typeof result === 'object') {
          const { message } = result;
          const messageContent = message && typeof message === 'object' ? (message as { content?: string }).content : undefined;
          const toolCalls = message && typeof message === 'object' ? (message as { tool_calls?: unknown[] }).tool_calls : undefined;
          logger.info('🔍 DEBUGGING: Ollama parsed result:', {
            resultKeys: Object.keys(result),
            hasMessage: !!message,
            messageKeys: message ? Object.keys(message) : [],
            messageContent: typeof messageContent === 'string' ? messageContent : 'NO MESSAGE CONTENT',
            messageContentLength: typeof messageContent === 'string' ? messageContent.length : 0,
            hasToolCalls: Array.isArray(toolCalls) && toolCalls.length > 0,
            toolCallsLength: Array.isArray(toolCalls) ? toolCalls.length : 0,
            rawResultPreview: JSON.stringify(result).substring(0, 500),
          });

          logger.debug('Ollama function calling response received', {
            hasToolCalls: Array.isArray(toolCalls) && toolCalls.length > 0,
            toolCallCount: Array.isArray(toolCalls) ? toolCalls.length : 0,
          });

          logger.debug('OllamaProvider function calling: result keys:', Object.keys(result));
          logger.debug(
            'OllamaProvider function calling: result.message keys:',
            message ? Object.keys(message) : 'no message'
          );
          logger.debug(
            'OllamaProvider function calling: result.message.tool_calls exists:',
            Array.isArray(toolCalls) && toolCalls.length > 0
          );
          logger.debug(
            'OllamaProvider function calling: result.message.tool_calls length:',
            Array.isArray(toolCalls) ? toolCalls.length : 0
          );
          if (Array.isArray(toolCalls) && toolCalls.length > 0) {
            logger.debug(
              'OllamaProvider function calling: first tool call:',
              JSON.stringify(toolCalls[0], null, 2)
            );
          }
        }

        // Return response in expected format
        // Validate content before returning - fail fast if no content and no valid tool calls
        if (!result) {
          throw new Error(
            `Ollama request ${typedRequest.id} returned undefined result. This indicates a provider failure.`
          );
        }

        const finalContent = result.message?.content || result.content || result.response;
        const hasValidToolCalls =
          Array.isArray(result.message?.tool_calls) &&
          result.message.tool_calls.length > 0 &&
          !!result.message.tool_calls[0].function?.name;

        if (!finalContent && !hasValidToolCalls) {
          throw new Error(
            `Ollama request ${typedRequest.id} returned no content and no valid tool calls. This indicates a provider failure.`
          );
        }

        // CRITICAL FIX: Try multiple sources for tool calls
        let extractedToolCalls: ParsedToolCall[] = [];

        // First, try structured tool_calls from result.message.tool_calls
        if (
          Array.isArray(result.message?.tool_calls) &&
          result.message.tool_calls.length > 0
        ) {
          logger.debug('Using structured tool_calls from Ollama response');
          extractedToolCalls = result.message.tool_calls.map((toolCall: Readonly<OllamaToolCall>) => ({
            id: toolCall.function.name || `tool_${Date.now()}`,
            function: {
              name: toolCall.function.name,
              // CRITICAL FIX: Check if arguments are already a string to prevent double-encoding
              arguments:
                typeof toolCall.function.arguments === 'string'
                  ? toolCall.function.arguments
                  : JSON.stringify(toolCall.function.arguments),
            },
          }));
        } else {
          // Fallback: Try to parse tool calls from content field
          logger.debug('No structured tool_calls found, trying to parse from content field');
          const contentToolCalls = this.parseToolCallsFromContent(finalContent);
          if (contentToolCalls.length > 0) {
            extractedToolCalls = contentToolCalls.map((toolCall: ParsedToolCall) => ({
              id: toolCall.function?.name || `tool_${Date.now()}`,
              function: {
                name: toolCall.function?.name,
                arguments:
                  typeof toolCall.function?.arguments === 'string'
                    ? toolCall.function.arguments
                    : JSON.stringify(toolCall.function?.arguments || {}),
              },
            }));
          }
        }

        const responseTime = Date.now() - startTime;
        const confidence = this.calculateConfidence(
          finalContent || '',
          responseTime,
          typedRequest.taskType || 'default'
        );

        return {
          id: typedRequest.id || `ollama_${Date.now()}`,
          content: finalContent || '',
          confidence,
          responseTime,
          toolCalls: extractedToolCalls,
          usage: {
            promptTokens: Number((result as OllamaStreamingMetadata).promptEvalCount ?? 0),
            completionTokens: Number((result as OllamaStreamingMetadata).evalCount ?? 0),
            totalTokens:
              Number((result as OllamaStreamingMetadata).promptEvalCount ?? 0) +
              Number((result as OllamaStreamingMetadata).evalCount ?? 0),
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
    return this.generateCode(typedRequest.prompt ?? '', typedRequest.options ?? {});
  }

  /**
   * CRITICAL FIX: Parse tool calls from content field
   * Ollama often returns tool calls as JSON text in content instead of structured tool_calls
   */
  private parseToolCallsFromContent(content: string): ParsedToolCall[] {
    if (!content || typeof content !== 'string') {
      return [];
    }

    try {
      // Try to parse the entire content as JSON first
      const parsedRaw: unknown = JSON.parse(content.trim());

      // Type guard to ensure parsed is an object with expected properties
      if (
        parsedRaw &&
        typeof parsedRaw === 'object' &&
        'name' in parsedRaw &&
        typeof (parsedRaw as { name: unknown }).name === 'string' &&
        (
          ('arguments' in parsedRaw && typeof (parsedRaw as { arguments?: unknown }).arguments !== 'undefined') ||
          ('parameters' in parsedRaw && typeof (parsedRaw as { parameters?: unknown }).parameters !== 'undefined')
        )
      ) {
        const { name } = parsedRaw as { name: string };
        const args = 'arguments' in parsedRaw
          ? (parsedRaw as { arguments?: unknown }).arguments
          : ('parameters' in parsedRaw ? (parsedRaw as { parameters?: unknown }).parameters : {});
        logger.info('🔧 Detected tool call in content field - converting to structured format');
        return [
          {
            function: {
              name,
              arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {}),
            },
          },
        ];
      }
    } catch (error) {
      // Content is not JSON, check if it contains JSON-like patterns
      const jsonPattern = /\{\s*"name"\s*:\s*"[^"]+"/;
      if (jsonPattern.test(content)) {
        logger.debug('Content contains JSON pattern but failed to parse - might be embedded JSON');

        // Try to extract JSON objects from text
        const jsonMatches = content.match(/\{[^}]*"name"[^}]*\}/g);
        if (jsonMatches) {
          const toolCalls: ParsedToolCall[] = [];
          for (const match of jsonMatches) {
            try {
              const parsed = JSON.parse(match) as { name?: string; arguments?: unknown; parameters?: unknown };
              if (typeof parsed?.name === 'string') {
                toolCalls.push({
                  id: `tool_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                  function: {
                    name: parsed.name,
                    arguments: typeof parsed.arguments === 'string'
                      ? parsed.arguments
                      : typeof parsed.parameters === 'string'
                        ? parsed.parameters
                        : JSON.stringify(parsed.arguments ?? parsed.parameters ?? {}),
                  },
                });
              }
            } catch (e) {
              continue; // Skip invalid JSON matches
            }
          }
          if (toolCalls.length > 0) {
            logger.info(`🔧 Extracted ${toolCalls.length} tool calls from content text`);
            return toolCalls;
          }
        }
      }
    }

    return [];
  }

  /**
   * Validate and normalize tool calls to prevent double-encoded JSON
   */
  private validateAndNormalizeToolCalls(toolCalls: ParsedToolCall[]): ParsedToolCall[] {
    if (!Array.isArray(toolCalls)) {
      return toolCalls; // Return as-is if not an array (could be undefined/null)
    }

    return toolCalls.map(toolCall => {
      if (!toolCall || typeof toolCall !== 'object') {
        logger.warn('Invalid tool call structure:', toolCall);
        return toolCall;
      }

      const normalizedCall = { ...toolCall };

      // Validate and normalize arguments if present
      if (normalizedCall.function?.arguments) {
        const args = normalizedCall.function.arguments;

        // Handle double-encoded JSON arguments
        if (typeof args === 'string') {
          try {
            let parsedArgs: unknown = JSON.parse(args);

            // Check for additional levels of encoding
            let parseAttempts = 0;
            while (typeof parsedArgs === 'string' && parseAttempts < 3) {
              parseAttempts++;
              try {
                parsedArgs = JSON.parse(parsedArgs);
              } catch {
                break; // Stop if parsing fails
              }
            }

            // Ensure arguments is always a string
            normalizedCall.function.arguments = typeof parsedArgs === 'string'
              ? parsedArgs
              : JSON.stringify(parsedArgs ?? {});

            if (parseAttempts > 0) {
              logger.debug(
                `Normalized ${parseAttempts}-level JSON encoded tool arguments for ${normalizedCall.function.name}`
              );
            }
          } catch (error) {
            logger.warn(
              `Failed to parse tool call arguments for ${normalizedCall.function.name}:`,
              error
            );
            // Keep original arguments if parsing fails
          }
        }
      }

      return normalizedCall;
    });
  }

  /**
   * Validate and transform tools to prevent runtime errors
   * Fixes the issue where invalid tool shapes can produce runtime errors
   */
  private validateAndTransformTools(tools: OllamaTool[]): OllamaTool[] {
    if (!Array.isArray(tools)) {
      logger.warn('Tools parameter is not an array, returning empty array');
      return [];
    }

    const validTools: OllamaTool[] = [];

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];

      try {
        // Validate tool structure - handle both ModelTool and ToolInfo formats
        let transformedTool: OllamaTool | undefined;

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
                },
              };
            }
          }
          // Handle ToolInfo format (flat structure)
          else if (tool.name && typeof tool.name === 'string') {
            transformedTool = {
              type: 'function',
              function: {
                name: tool.name,
                description: tool.description ?? '',
                parameters: (tool.inputSchema && typeof tool.inputSchema === 'object'
                  ? tool.inputSchema as { type: string; properties: Record<string, unknown>; required?: string[] }
                  : (tool.parameters && typeof tool.parameters === 'object'
                    ? tool.parameters as { type: string; properties: Record<string, unknown>; required?: string[] }
                    : { type: 'object', properties: {} })),
              },
            };
          }
        }

        if (transformedTool) {
          validTools.push(transformedTool);
          logger.debug(`Validated tool: ${transformedTool.function.name}`);
        } else {
          logger.warn(`Invalid tool at index ${i}, skipping`, {
            toolKeys: Object.keys(tool),
            toolType: typeof tool,
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
  private isValidFunctionSpec(func: Readonly<FunctionSpec>): boolean {
    return (
      typeof func === 'object' &&
      typeof func.name === 'string' &&
      func.name.length > 0 &&
      typeof func.description === 'string'
    );
  }

  /**
   * Sanitize options to only include Ollama-supported parameters
   * Prevents CLI-specific options from being sent to Ollama API
   */
  private sanitizeOllamaOptions(options: OllamaOptions): OllamaOptions {
    const validOllamaOptions = new Set([
      'temperature',
      'top_p',
      'top_k',
      'num_ctx',
      'num_gpu',
      'num_thread',
      'repeat_penalty',
      'repeat_last_n',
      'mirostat',
      'mirostat_eta',
      'mirostat_tau',
      'tfs_z',
      'typical_p',
      'seed',
      'num_predict',
      'stop',
      'numa',
      'low_vram',
      'f16_kv',
      'logits_all',
      'vocab_only',
      'use_mmap',
      'use_mlock',
      'num_batch',
    ]);

    const sanitized: OllamaOptions = {};
    for (const [key, value] of Object.entries(options)) {
      if (validOllamaOptions.has(key)) {
        sanitized[key] = value;
      }
    }

    // Include ollamaOptions if present (nested options)
    if (options.ollamaOptions && typeof options.ollamaOptions === 'object') {
      Object.assign(sanitized, options.ollamaOptions);
    }

    return sanitized;
  }

  /**
   * Get GPU layer count for offloading
   * Enables GPU acceleration when available
   */
  private getGPULayers(): number {
    // Check for explicit configuration first
    const explicitLayers = process.env.OLLAMA_NUM_GPU;
    if (explicitLayers) {
      const layers = parseInt(explicitLayers, 10);
      if (!isNaN(layers) && layers >= 0) {
        return layers;
      }
    }

    // Auto-detect GPU availability
    if (this.hasGPUAvailable()) {
      // Use maximum GPU layers for optimal performance
      // Most models have 30-35 layers, use 33 as safe default
      return 33;
    }

    // No GPU available, use CPU only
    return 0;
  }

  /**
   * Detect if GPU is available for model acceleration
   */
  private hasGPUAvailable(): boolean {
    // FIXED: On Windows with CUDA, assume GPU is available unless explicitly disabled
    if (process.platform === 'win32') {
      // Check if explicitly disabled
      if (process.env.OLLAMA_NO_GPU === '1' || process.env.CUDA_VISIBLE_DEVICES === '') {
        return false;
      }
      // Default to true for Windows (assume NVIDIA GPU available)
      return true;
    }

    // Check CUDA environment variables (only for non-Windows)
    if (process.env.CUDA_VISIBLE_DEVICES !== undefined) {
      return process.env.CUDA_VISIBLE_DEVICES !== '';
    }

    // Check ROCm/HIP environment variables
    if (process.env.HIP_VISIBLE_DEVICES !== undefined) {
      return process.env.HIP_VISIBLE_DEVICES !== '';
    }

    // Check for Metal on macOS
    if (process.platform === 'darwin' && process.env.METAL_DEVICE_WRAPPER_TYPE !== undefined) {
      return true;
    }

    // Check for OpenCL environment
    if (process.env.OPENCL_DEVICE_TYPE !== undefined) {
      return true;
    }

    // Default to true on modern systems (let Ollama auto-detect)
    // This is safer than returning false and missing GPU acceleration
    return true;
  }

  /**
   * Safely parse environment variables with validation
   */
  private parseEnvInt(envVar: string, defaultValue: number, min?: number, max?: number): number {
    const value = process.env[envVar];
    if (!value) return defaultValue;

    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      logger.warn(
        `Invalid environment variable ${envVar}=${value}, using default: ${defaultValue}`
      );
      return defaultValue;
    }

    if (min !== undefined && parsed < min) {
      logger.warn(`Environment variable ${envVar}=${parsed} below minimum ${min}, using minimum`);
      return min;
    }

    if (max !== undefined && parsed > max) {
      logger.warn(`Environment variable ${envVar}=${parsed} above maximum ${max}, using maximum`);
      return max;
    }

    return parsed;
  }

  /**
   * Safely parse environment float variables with validation
   */
  private parseEnvFloat(envVar: string, defaultValue: number, min?: number, max?: number): number {
    const value = process.env[envVar];
    if (!value) return defaultValue;

    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      logger.warn(
        `Invalid environment variable ${envVar}=${value}, using default: ${defaultValue}`
      );
      return defaultValue;
    }

    if (min !== undefined && parsed < min) {
      logger.warn(`Environment variable ${envVar}=${parsed} below minimum ${min}, using minimum`);
      return min;
    }

    if (max !== undefined && parsed > max) {
      logger.warn(`Environment variable ${envVar}=${parsed} above maximum ${max}, using maximum`);
      return max;
    }

    return parsed;
  }

  /**
   * Robust JSON parsing with multiple fallback strategies
   * Handles malformed responses, memory errors, and streaming issues
   */
  private async parseRobustJSON(response: Readonly<Response>): Promise<unknown> {
    const responseText = await response.text();

    try {
      // Strategy 1: Standard JSON parsing
      return JSON.parse(responseText) as unknown;
    } catch (primaryError) {
      const errorMessage =
        primaryError instanceof Error ? primaryError.message : String(primaryError);
      logger.debug('Standard JSON parsing failed, trying fallback strategies', {
        error: errorMessage,
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 200),
      });

      // Strategy 2: Handle streaming JSON - accumulate all chunks
      try {
        const lines = responseText.split('\n').filter(line => line.trim());

        // Check if this looks like streaming response (multiple JSON objects)
        if (lines.length > 1) {
          let accumulatedContent = '';
          let toolCalls: ParsedToolCall[] = [];
          let lastMetadata: OllamaStreamingMetadata = {};

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line) as Partial<{
                message?: { content?: unknown; tool_calls?: unknown };
                response?: unknown;
                content?: unknown;
                done?: unknown;
                [key: string]: unknown;
              }>;

              // Accumulate content from streaming chunks
              if (
                parsed.message &&
                typeof parsed.message === 'object' &&
                'content' in parsed.message &&
                typeof parsed.message.content === 'string'
              ) {
                accumulatedContent += parsed.message.content;
              } else if (typeof parsed.response === 'string') {
                accumulatedContent += parsed.response;
              } else if (typeof parsed.content === 'string') {
                accumulatedContent += parsed.content;
              }

              // Collect tool calls
              if (
                parsed.message &&
                typeof parsed.message === 'object' &&
                Array.isArray((parsed.message as { tool_calls?: unknown }).tool_calls)
              ) {
                toolCalls = toolCalls.concat(
                  (parsed.message as { tool_calls: ParsedToolCall[] }).tool_calls
                );
              }

              // Keep metadata from last chunk (usually has timing info)
              if ('done' in parsed && parsed.done) {
                lastMetadata = parsed as OllamaStreamingMetadata;
              }
            } catch (lineError) {
              // Continue to next line
              continue;
            }
          }

          // If we accumulated content, return it
          if (accumulatedContent || toolCalls.length > 0) {
            logger.info('Accumulated streaming response', {
              contentLength: accumulatedContent.length,
              toolCallCount: toolCalls.length,
              lineCount: lines.length,
            });

            return {
              message: {
                content: accumulatedContent,
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
              },
              response: accumulatedContent,
              content: accumulatedContent,
              model: lastMetadata.model || this.config.defaultModel,
              total_duration: lastMetadata.total_duration,
              load_duration: lastMetadata.load_duration,
              prompt_eval_count: lastMetadata.prompt_eval_count,
              eval_count: lastMetadata.eval_count,
              eval_duration: lastMetadata.eval_duration,
              done: true,
            };
          }
        }

        // Fallback to single-line extraction if not streaming format
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as unknown;
            // Type guard for expected structure
            if (
              typeof parsed === 'object' &&
              parsed !== null &&
              'message' in parsed &&
              typeof (parsed as { message?: unknown }).message === 'object'
            ) {
              const { message } = parsed as { message: { tool_calls?: unknown; content?: unknown } };
              if (message.tool_calls || message.content) {
                logger.info('Extracted single JSON response', {
                  hasToolCalls: !!message.tool_calls,
                  hasContent: !!message.content,
                });
                return parsed as Record<string, unknown>;
              }
            }
          } catch (lineError) {
            continue;
          }
        }

        // Fallback to original strategy if no tool calls found
        const jsonMatch = responseText.match(/^({.*?})\s*[\s\S]*$/);
        if (jsonMatch) {
          const [, extractedJson] = jsonMatch;
          logger.info('Extracted JSON from mixed content (fallback)', {
            originalLength: responseText.length,
            extractedLength: extractedJson.length,
          });
          return JSON.parse(extractedJson) as Record<string, unknown>;
        }
      } catch (extractError) {
        const errorMessage =
          extractError instanceof Error ? extractError.message : String(extractError);
        logger.debug('JSON extraction failed', { error: errorMessage });
      }

      // Strategy 3: Handle streaming/partial JSON responses (single response format)
      try {
        const lines = responseText.split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as unknown;
            if (
              parsed &&
              typeof parsed === 'object'
            ) {
              const obj = parsed as {
                response?: unknown;
                content?: unknown;
                model?: unknown;
                total_duration?: unknown;
                load_duration?: unknown;
                prompt_eval_count?: unknown;
                eval_count?: unknown;
                eval_duration?: unknown;
                message?: {
                  response?: unknown;
                  content?: unknown;
                };
              };

              // Check for various response formats with safe property access
              const hasResponse =
                typeof obj.response === 'string' ||
                typeof obj.content === 'string' ||
                (obj.message &&
                  (typeof obj.message.response === 'string' ||
                    typeof obj.message.content === 'string'));

              if (hasResponse) {
                logger.info('Parsed JSON from streaming response line');
                return {
                  response:
                    (typeof obj.response === 'string'
                      ? obj.response
                      : typeof obj.content === 'string'
                        ? obj.content
                        : obj.message && typeof obj.message.response === 'string'
                          ? obj.message.response
                          : obj.message && typeof obj.message.content === 'string'
                            ? obj.message.content
                            : undefined),
                  content:
                    (typeof obj.content === 'string'
                      ? obj.content
                      : typeof obj.response === 'string'
                        ? obj.response
                        : obj.message && typeof obj.message.content === 'string'
                          ? obj.message.content
                          : obj.message && typeof obj.message.response === 'string'
                            ? obj.message.response
                            : undefined),
                  model: typeof obj.model === 'string' ? obj.model : this.config.defaultModel,
                  total_duration: typeof obj.total_duration === 'number' ? obj.total_duration : undefined,
                  load_duration: typeof obj.load_duration === 'number' ? obj.load_duration : undefined,
                  prompt_eval_count: typeof obj.prompt_eval_count === 'number' ? obj.prompt_eval_count : undefined,
                  eval_count: typeof obj.eval_count === 'number' ? obj.eval_count : undefined,
                  eval_duration: typeof obj.eval_duration === 'number' ? obj.eval_duration : undefined,
                };
              }
            }
          } catch (lineError) {
            // Continue to next line
            continue;
          }
        }
      } catch (streamError) {
        const errorMessage =
          streamError instanceof Error ? streamError.message : String(streamError);
        logger.debug('Streaming JSON parsing failed', { error: errorMessage });
      }

      // Strategy 4: Check for memory allocation errors and handle gracefully
      if (
        responseText.includes('cudaMalloc failed') ||
        responseText.includes('out of memory') ||
        responseText.includes('memory limit')
      ) {
        logger.warn('Detected memory allocation error in response');
        throw new Error('Insufficient GPU memory - consider reducing context size');
      }

      // Strategy 5: Extract any meaningful content using regex patterns
      try {
        const patterns = [
          // Look for response field in malformed JSON
          /"response"\s*:\s*"([^"]+)"/,
          /"content"\s*:\s*"([^"]+)"/,
          // Look for message content in function calling responses
          /"message"\s*:\s*{[^}]*"content"\s*:\s*"([^"]+)"/,
        ];

        for (const pattern of patterns) {
          const match = responseText.match(pattern);
          if (match?.[1]) {
            logger.info('Extracted content using regex fallback');
            return {
              response: match[1],
              content: match[1],
              model: this.config.defaultModel,
              // Provide default values for missing fields
              total_duration: null,
              load_duration: null,
              prompt_eval_count: null,
              eval_count: null,
              eval_duration: null,
            };
          }
        }
      } catch (regexError) {
        const errorMessage = regexError instanceof Error ? regexError.message : String(regexError);
        logger.debug('Regex content extraction failed', { error: errorMessage });
      }

      // Strategy 6: Final fallback - extract message content from JSON if possible
      if (responseText.trim().length > 10 && !responseText.includes('error')) {
        logger.warn('Using raw text as fallback response', {
          textLength: responseText.length,
        });

        let actualContent = responseText.trim();

        // Try to extract message content from JSON response
        try {
          const jsonResponse = JSON.parse(responseText.trim()) as unknown;
          if (
            typeof jsonResponse === 'object' &&
            jsonResponse !== null &&
            'message' in jsonResponse &&
            typeof (jsonResponse as { message?: unknown }).message === 'object' &&
            'content' in (jsonResponse as { message: object }).message &&
            typeof ((jsonResponse as { message: { content?: unknown } }).message as { content?: unknown }).content === 'string'
          ) {
            actualContent = ((jsonResponse as { message: { content: string } }).message).content;
            logger.debug(
              'OllamaProvider: extracted message.content:',
              actualContent.substring(0, 100)
            );
          } else if (
            typeof jsonResponse === 'object' &&
            jsonResponse !== null &&
            'response' in jsonResponse &&
            typeof (jsonResponse as { response?: unknown }).response === 'string'
          ) {
            actualContent = (jsonResponse as { response: string }).response;
            logger.debug(
              'OllamaProvider: extracted response field:',
              actualContent.substring(0, 100)
            );
          }
        } catch (parseError) {
          // If JSON parsing fails, use the raw text
          logger.debug('OllamaProvider: JSON parse failed, using raw text');
        }

        const fallbackResponse = {
          response: actualContent,
          content: actualContent,
          model: this.config.defaultModel,
          total_duration: null,
          load_duration: null,
          prompt_eval_count: null,
          eval_count: null,
          eval_duration: null,
        };

        logger.debug('OllamaProvider: final content length:', actualContent.length);

        return fallbackResponse;
      }

      // If all strategies fail, throw the original error with context
      const primaryErrorMessage =
        primaryError instanceof Error ? primaryError.message : String(primaryError);
      logger.error('All JSON parsing strategies failed', {
        primaryError: primaryErrorMessage,
        responseLength: responseText.length,
        responseStart: responseText.substring(0, 100),
        responseEnd: responseText.substring(Math.max(0, responseText.length - 100)),
      });

      throw new Error(
        `JSON parsing failed: ${primaryErrorMessage}. Response: ${responseText.substring(0, 200)}...`
      );
    }
  }

  /**
   * Sanitize error messages to prevent information leakage
   */
  private sanitizeErrorMessage(error: string): string {
    // List of sensitive patterns to remove or replace
    const sensitivePatterns = [
      /api[_-]?key[s]?[:\s=][^\s\n]*/gi,
      /token[s]?[:\s=][^\s\n]*/gi,
      /password[s]?[:\s=][^\s\n]*/gi,
      /secret[s]?[:\s=][^\s\n]*/gi,
      /authorization[:\s=][^\s\n]*/gi,
      /bearer\s+[^\s\n]*/gi,
      /file:\/\/[^\s\n]*/gi, // Local file paths
      /\/Users\/[^\s\n]*/gi, // User paths
      /\/home\/[^\s\n]*/gi, // Home paths
      /C:\\[^\s\n]*/gi, // Windows paths
    ];

    let sanitized = error;

    // Replace sensitive information
    sensitivePatterns.forEach((pattern: Readonly<RegExp>) => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    // Truncate very long error messages
    if (sanitized.length > 500) {
      sanitized = `${sanitized.substring(0, 500)}... [TRUNCATED]`;
    }

    return sanitized;
  }

  /**
   * Stream method for OllamaAdapter compatibility
   */
  public async *stream(request: Readonly<OllamaRequest>): AsyncIterable<string> {
    this.checkRateLimit();
    if (request.prompt) {
      this.validateInputLength(request.prompt);
    }

    this.currentLoad++;
    this.requestCount++;

    try {
      // Build payload similar to makeRequest but with streaming enabled
      const builtPrompt = this.buildPrompt(request.prompt ?? '', request.taskType ?? 'default');
      const payload = {
        model: request.model ?? this.config.defaultModel,
        prompt: builtPrompt,
        stream: true, // Enable streaming
        options: {
          temperature: request.temperature ?? this.getTemperature(request.taskType ?? 'default'),
          top_p: request.top_p ?? this.parseEnvFloat('MODEL_TOP_P', 0.9, 0.0, 1.0),
          top_k: request.top_k ?? this.parseEnvInt('MODEL_TOP_K', 40, 1, 200),
          num_ctx:
            request.num_ctx ??
            this.getContextLength(request.taskType ?? 'default', builtPrompt.length),
          num_gpu: this.getGPULayers(),
        },
      };

      logger.debug('Ollama streaming request', {
        model: payload.model,
        contextLength: payload.options.num_ctx,
        promptLength: builtPrompt.length,
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => { controller.abort(); }, request.timeout ?? this.config.timeout);

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
          throw new Error(
            `Ollama API error: ${response.status} ${response.statusText} - ${this.sanitizeErrorMessage(errorText)}`
          );
        }

        clearTimeout(timeout);

        // Process streaming response line by line
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body reader available');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              try {
                const parsedLine: unknown = JSON.parse(line.trim());
                const data: { response?: unknown; done?: unknown } = parsedLine as { response?: unknown; done?: unknown };
                if (data.response !== undefined) {
                  yield String(data.response);
                }
                if (data.done) {
                  return; // Stream complete
                }
              } catch (parseError) {
                logger.debug('Failed to parse streaming JSON line:', line);
                continue;
              }
            }
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      this.errorCount++;
      this.lastError = (error as Error).message;
      logger.error('Ollama streaming failed:', error);
      throw error;
    } finally {
      this.currentLoad--;
    }
  }

  /**
   * Reset statistics (for testing or maintenance)
   */
  public resetStats(): void {
    this.responseTimeHistory = [];
    this.errorCount = 0;
    this.requestCount = 0;
    this.lastError = undefined;
  }
}
