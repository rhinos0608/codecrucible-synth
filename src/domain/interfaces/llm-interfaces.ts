/**
 * LLM Provider Interfaces
 * Common interfaces for LLM provider implementations
 */

export interface LLMResponse {
  content: string;
  confidence: number;
  responseTime: number;
  model: string;
  provider: string;
  // Properties used by provider adapters
  id?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  // Provider-specific properties
  response?: string;
  message?: any;
  output?: string;
  text?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  done?: boolean;
  // FIXED: Add tool calls support for function calling models
  toolCalls?: Array<{
    id: string;
    type: string;
    name: string;
    arguments: string;
  }>;
  metadata?: {
    tokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    finishReason?: string;
    [key: string]: any;
  };
}

export interface LLMCapabilities {
  strengths: string[];
  optimalFor: string[];
  responseTime: string;
  contextWindow: number;
  supportsStreaming: boolean;
  maxConcurrent: number;
}

export interface LLMStatus {
  available: boolean;
  currentLoad: number;
  maxLoad: number;
  responseTime: number;
  errorRate: number;
  lastError?: string;
}

export interface LLMProvider {
  readonly name: string;
  readonly endpoint: string;

  /**
   * Check if the provider is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Generate code using the provider
   */
  generateCode(prompt: string, options?: any): Promise<LLMResponse>;

  /**
   * Process a generic request with tool support (optional for function calling)
   */
  request?(request: any): Promise<any>;

  /**
   * Get provider capabilities
   */
  getCapabilities(): LLMCapabilities;

  /**
   * Get current provider status
   */
  getStatus(): Promise<LLMStatus>;

  /**
   * Optional health check method
   */
  healthCheck?(): Promise<void>;

  /**
   * Reset statistics
   */
  resetStats?(): void;
}
