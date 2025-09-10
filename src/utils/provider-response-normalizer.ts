/**
 * Provider Response Normalizer
 * 
 * Standardizes responses from different AI providers into a consistent format.
 * Eliminates the need for adapter-specific parsing logic and reduces maintenance overhead.
 */

export interface NormalizedProviderResponse {
  content: string;
  toolCalls?: NormalizedToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata: Record<string, unknown>;
  model?: string;
  finishReason?: string;
  id?: string;
  responseTime?: number;
}

export interface NormalizedToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // Always a JSON string for consistency
  };
}

/**
 * Comprehensive response normalizer that handles all provider response formats
 */
export class ProviderResponseNormalizer {
  
  /**
   * Main normalization method - handles any response type
   */
  public static normalize(
    response: unknown, 
    defaultModel?: string,
    providerName?: string
  ): NormalizedProviderResponse {
    // Handle null/undefined
    if (!response) {
      return this.createEmptyResponse(defaultModel, providerName);
    }

    // Handle string responses (simple completion)
    if (typeof response === 'string') {
      return this.normalizeStringResponse(response, defaultModel, providerName);
    }

    // Handle array responses (take first element or aggregate)
    if (Array.isArray(response)) {
      return this.normalizeArrayResponse(response, defaultModel, providerName);
    }

    // Handle object responses (most common case)
    if (typeof response === 'object') {
      return this.normalizeObjectResponse(response as Record<string, unknown>, defaultModel, providerName);
    }

    // Fallback: convert to string
    return this.normalizeStringResponse(String(response), defaultModel, providerName);
  }

  /**
   * Handle string responses
   */
  private static normalizeStringResponse(
    response: string, 
    defaultModel?: string,
    providerName?: string
  ): NormalizedProviderResponse {
    return {
      content: response,
      metadata: {
        originalType: 'string',
        provider: providerName
      },
      model: defaultModel,
      usage: {
        promptTokens: 0,
        completionTokens: this.estimateTokenCount(response),
        totalTokens: this.estimateTokenCount(response)
      }
    };
  }

  /**
   * Handle array responses - aggregate or take first
   */
  private static normalizeArrayResponse(
    response: unknown[], 
    defaultModel?: string,
    providerName?: string
  ): NormalizedProviderResponse {
    if (response.length === 0) {
      return this.createEmptyResponse(defaultModel, providerName);
    }

    // If single element, normalize it
    if (response.length === 1) {
      const normalized = this.normalize(response[0], defaultModel, providerName);
      normalized.metadata.originalType = 'array_single';
      return normalized;
    }

    // Multiple elements - aggregate content, merge tool calls
    const aggregated: NormalizedProviderResponse = {
      content: '',
      toolCalls: [],
      metadata: {
        originalType: 'array_multiple',
        provider: providerName,
        elementCount: response.length
      },
      model: defaultModel,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      }
    };

    for (const item of response) {
      const normalized = this.normalize(item, defaultModel, providerName);
      
      // Aggregate content
      if (normalized.content) {
        aggregated.content += (aggregated.content ? '\n' : '') + normalized.content;
      }

      // Merge tool calls
      if (normalized.toolCalls?.length) {
        aggregated.toolCalls!.push(...normalized.toolCalls);
      }

      // Aggregate usage
      if (normalized.usage) {
        aggregated.usage!.promptTokens += normalized.usage.promptTokens;
        aggregated.usage!.completionTokens += normalized.usage.completionTokens;
        aggregated.usage!.totalTokens += normalized.usage.totalTokens;
      }
    }

    return aggregated;
  }

  /**
   * Handle object responses - the most complex case
   */
  private static normalizeObjectResponse(
    response: Record<string, unknown>, 
    defaultModel?: string,
    providerName?: string
  ): NormalizedProviderResponse {
    const normalized: NormalizedProviderResponse = {
      content: this.extractContent(response),
      toolCalls: this.extractToolCalls(response),
      usage: this.extractUsage(response),
      metadata: {
        originalType: 'object',
        provider: providerName,
        originalKeys: Object.keys(response)
      },
      model: this.extractModel(response, defaultModel),
      finishReason: this.extractFinishReason(response),
      id: this.extractId(response),
      responseTime: this.extractResponseTime(response)
    };

    // Include any additional metadata from the original response
    normalized.metadata.original = response;

    return normalized;
  }

  /**
   * Extract content from various possible field names
   */
  private static extractContent(response: Record<string, unknown>): string {
    // Try common content field names in order of preference
    const contentFields = [
      'content', 'response', 'message', 'output', 'text', 'data', 'result'
    ];

    for (const field of contentFields) {
      const value = response[field];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
      
      // Handle nested content (e.g., response.message.content)
      if (value && typeof value === 'object') {
        const nestedContent = this.extractContent(value as Record<string, unknown>);
        if (nestedContent) {
          return nestedContent;
        }
      }
    }

    return '';
  }

  /**
   * Extract and normalize tool calls from response
   */
  private static extractToolCalls(response: Record<string, unknown>): NormalizedToolCall[] | undefined {
    // Try different field names for tool calls
    const toolCallFields = [
      'toolCalls', 'tool_calls', 'tools', 'function_calls', 'functions'
    ];

    for (const field of toolCallFields) {
      const value = response[field];
      if (Array.isArray(value)) {
        return this.normalizeToolCalls(value);
      }
    }

    // Check nested objects (e.g., message.tool_calls)
    const nestedObjects = ['message', 'response', 'data'];
    for (const nestedField of nestedObjects) {
      const nested = response[nestedField];
      if (nested && typeof nested === 'object') {
        const nestedToolCalls = this.extractToolCalls(nested as Record<string, unknown>);
        if (nestedToolCalls?.length) {
          return nestedToolCalls;
        }
      }
    }

    return undefined;
  }

  /**
   * Normalize tool calls array to consistent format
   */
  private static normalizeToolCalls(toolCalls: unknown[]): NormalizedToolCall[] {
    return toolCalls.map((tc, index) => {
      if (!tc || typeof tc !== 'object') {
        return this.createEmptyToolCall(index);
      }

      const call = tc as Record<string, unknown>;
      
      // Extract tool call components with fallbacks
      const id = this.extractToolCallId(call, index);
      const functionData = this.extractToolCallFunction(call);

      return {
        id,
        type: 'function' as const,
        function: {
          name: functionData.name,
          arguments: functionData.arguments
        }
      };
    }).filter(tc => tc.function.name); // Filter out empty tool calls
  }

  /**
   * Extract tool call ID with fallback generation
   */
  private static extractToolCallId(call: Record<string, unknown>, index: number): string {
    const id = call.id || call.call_id || call.toolCallId;
    if (typeof id === 'string') {
      return id;
    }
    return `tool_call_${index}_${Date.now()}`;
  }

  /**
   * Extract function data from tool call
   */
  private static extractToolCallFunction(call: Record<string, unknown>): { name: string; arguments: string } {
    // Direct function field
    if (call.function && typeof call.function === 'object') {
      const func = call.function as Record<string, unknown>;
      return {
        name: String(func.name || ''),
        arguments: this.normalizeToolArguments(func.arguments)
      };
    }

    // Flat structure (name and arguments at top level)
    if (call.name) {
      return {
        name: String(call.name),
        arguments: this.normalizeToolArguments(call.arguments || call.args)
      };
    }

    return { name: '', arguments: '{}' };
  }

  /**
   * Normalize tool arguments to consistent JSON string format
   */
  private static normalizeToolArguments(args: unknown): string {
    if (!args) {
      return '{}';
    }

    if (typeof args === 'string') {
      // Verify it's valid JSON, if not wrap it
      try {
        JSON.parse(args);
        return args;
      } catch {
        return JSON.stringify({ raw_arguments: args });
      }
    }

    if (typeof args === 'object') {
      try {
        return JSON.stringify(args);
      } catch {
        return JSON.stringify({ serialization_error: 'Failed to serialize arguments' });
      }
    }

    // Primitive types
    return JSON.stringify({ value: args });
  }

  /**
   * Extract usage/token information
   */
  private static extractUsage(response: Record<string, unknown>): { promptTokens: number; completionTokens: number; totalTokens: number } {
    const usage = response.usage || response.token_usage || response.tokens;
    
    if (usage && typeof usage === 'object') {
      const u = usage as Record<string, unknown>;
      const promptTokens = Number(u.prompt_tokens || u.promptTokens || u.input_tokens || 0);
      const completionTokens = Number(u.completion_tokens || u.completionTokens || u.output_tokens || u.eval_count || 0);
      
      return {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens || Number(u.total_tokens || u.totalTokens || 0)
      };
    }

    // Fallback: estimate from content
    const content = this.extractContent(response);
    const estimated = this.estimateTokenCount(content);
    
    return {
      promptTokens: 0,
      completionTokens: estimated,
      totalTokens: estimated
    };
  }

  /**
   * Extract model information
   */
  private static extractModel(response: Record<string, unknown>, defaultModel?: string): string | undefined {
    const model = response.model || response.model_name || response.modelName;
    return typeof model === 'string' ? model : defaultModel;
  }

  /**
   * Extract finish reason
   */
  private static extractFinishReason(response: Record<string, unknown>): string | undefined {
    const reason = response.finish_reason || response.finishReason || response.stop_reason;
    if (typeof reason === 'string') {
      return reason;
    }
    
    // Check if done/finished flags indicate completion
    if (response.done === true || response.finished === true) {
      return 'stop';
    }
    
    return undefined;
  }

  /**
   * Extract response ID
   */
  private static extractId(response: Record<string, unknown>): string | undefined {
    const id = response.id || response.response_id || response.requestId;
    return typeof id === 'string' ? id : undefined;
  }

  /**
   * Extract response time information
   */
  private static extractResponseTime(response: Record<string, unknown>): number | undefined {
    const time = response.response_time || response.responseTime || response.total_duration;
    return typeof time === 'number' ? time : undefined;
  }

  /**
   * Create empty tool call with generated ID
   */
  private static createEmptyToolCall(index: number): NormalizedToolCall {
    return {
      id: `empty_tool_call_${index}_${Date.now()}`,
      type: 'function',
      function: {
        name: '',
        arguments: '{}'
      }
    };
  }

  /**
   * Create empty response for null/undefined inputs
   */
  private static createEmptyResponse(defaultModel?: string, providerName?: string): NormalizedProviderResponse {
    return {
      content: '',
      metadata: {
        originalType: 'empty',
        provider: providerName
      },
      model: defaultModel,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      }
    };
  }

  /**
   * Rough token count estimation (4 chars per token average)
   */
  private static estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}