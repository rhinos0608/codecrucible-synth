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
  metadata?: Record<string, any>;
  toolCalls?: ToolCall[];
  // Additional properties for compatibility
  tokens_used?: number;
  cached?: boolean;
  tokensUsed?: number;
  text?: string;
  response?: string;
  confidence?: number;
  error?: string;
}

export interface ModelTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
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
  userPreferences?: Record<string, any>;
}

export interface StreamToken {
  content: string;
  isComplete: boolean;
  metadata?: Record<string, any>;
}

/**
 * Core Model Client Interface
 */
export interface IModelClient {
  /**
   * Send a request to the model
   */
  request(request: ModelRequest): Promise<ModelResponse>;
  
  /**
   * Send a streaming request to the model
   */
  stream(request: ModelRequest): AsyncIterableIterator<StreamToken>;
  
  /**
   * Get available models
   */
  getAvailableModels(): Promise<ModelInfo[]>;
  
  /**
   * Check if the client is healthy and ready
   */
  isHealthy(): Promise<boolean>;
  
  /**
   * Initialize the client
   */
  initialize(): Promise<void>;
  
  /**
   * Shutdown the client
   */
  shutdown(): Promise<void>;
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
  request(request: ModelRequest): Promise<ModelResponse>;
  
  /**
   * Check if provider is available
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Get supported models
   */
  getSupportedModels(): Promise<ModelInfo[]>;
}

/**
 * Model Router Interface for provider selection
 */
export interface IModelRouter {
  /**
   * Route a request to the best available provider
   */
  route(request: ModelRequest): Promise<{ provider: IModelProvider; model: string }>;
  
  /**
   * Get fallback chain for a request
   */
  getFallbackChain(request: ModelRequest): IModelProvider[];
}