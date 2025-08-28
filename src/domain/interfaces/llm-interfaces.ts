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