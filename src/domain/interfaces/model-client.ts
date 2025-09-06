/**
 * Model Client Interfaces
 *
 * These interfaces define contracts for AI model interaction,
 * breaking the circular dependency between UnifiedModelClient and other components.
 */

export interface ModelRequest {
  id?: string;
  prompt: string;
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: ModelTool[];
  context?: RequestContext;
  // Streaming callback for token-level observability
  onStreamingToken?: (token: string, metadata?: Record<string, unknown>) => void;
  // Structured message format for tool results
  messages?: Array<{
    role: 'user' | 'assistant' | 'tool';
    content: string;
    tool_calls?: Record<string, unknown>[];
    tool_call_id?: string;
  }>;
  // FIXED: Add missing properties for LM Studio adapter
  tool_choice?: 'auto' | 'none';
  timeout?: number;
  // Ollama-specific parameters
  num_ctx?: number;
  options?: Record<string, unknown>;
}

export interface ModelResponse {
  id: string;
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, unknown>;
  toolCalls?: ToolCall[];
  // Additional properties for compatibility
  tokens_used?: number;
  cached?: boolean;
  tokensUsed?: number;
  text?: string;
  response?: string;
  confidence?: number;
  error?: string;
  responseTime?: number;
  finishReason?: string;
}

export interface ModelTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface RequestContext {
  sessionId: string;
  workingDirectory: string;
  files?: string[];
  securityLevel: 'low' | 'medium' | 'high';
  userPreferences?: Record<string, unknown>;
}

export interface StreamToken {
  content: string;
  isComplete: boolean;
  index: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Core Model Client Interface
 */
export interface IModelClient {
  /**
   * Send a request to the model
   */
  request: (request: Readonly<ModelRequest>) => Promise<ModelResponse>;

  /**
   * Generate text from a prompt - legacy compatibility method
   */
  generate: (prompt: string, options?: Record<string, unknown>) => Promise<string>;

  /**
   * Send a streaming request to the model
   */
  stream: (request: Readonly<ModelRequest>) => AsyncIterableIterator<StreamToken>;

  /**
   * Send a streaming request to the model with callback
   */
  streamRequest: (
    request: Readonly<ModelRequest>,
    onToken: (token: Readonly<StreamToken>) => void,
    context?: unknown
  ) => Promise<ModelResponse>;

  /**
   * Get available models
   */
  getAvailableModels: () => Promise<ModelInfo[]>;

  /**
   * Check if the client is healthy and ready
   */
  isHealthy: () => Promise<boolean>;

  /**
   * Initialize the client
   */
  initialize: () => Promise<void>;

  /**
   * Shutdown the client
   */
  shutdown: () => Promise<void>;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description?: string;
  contextLength?: number;
  capabilities: ModelCapability[];
}

export interface ModelCapability {
  type: 'completion' | 'chat' | 'tools' | 'vision' | 'code';
  supported: boolean;
}

/**
 * Model Provider Interface
 */
export interface IModelProvider {
  readonly type: string;
  readonly endpoint: string;

  /**
   * Send a request to this provider
   */
  request: (request: Readonly<ModelRequest>) => Promise<ModelResponse>;

  /**
   * Check if provider is available
   */
  isAvailable: () => Promise<boolean>;

  /**
   * Get supported models
   */
  getSupportedModels: () => Promise<ModelInfo[]>;
}

/**
 * Model Router Interface for provider selection
 */
export interface IModelRouter {
  /**
   * Route a request to the best available provider
   */
  route: (request: Readonly<ModelRequest>) => Promise<{ provider: IModelProvider; model: string }>;

  /**
   * Get fallback chain for a request
   */
  getFallbackChain: (request: Readonly<ModelRequest>) => IModelProvider[];
}
