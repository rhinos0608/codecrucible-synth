/**
 * LLM Provider Adapter
 * Translates between application layer and infrastructure layer
 * 
 * Architecture Compliance:
 * - Adapter layer: translates between application and infrastructure
 * - Imports from Application & Domain layers
 * - Provides clean interface for application use cases
 * - Handles error translation and response mapping
 */

import { EventEmitter } from 'events';
import { Model } from '../domain/entities/model.js';
import { ProcessingRequest } from '../domain/entities/request.js';
import { ModelSelectionService, ModelSelection } from '../domain/services/model-selection-service.js';
import { OllamaClient } from '../infrastructure/llm-providers/ollama-client.js';
import { LMStudioClient } from '../infrastructure/llm-providers/lm-studio-client.js';

// Application layer interfaces
export interface LLMProviderCapabilities {
  textGeneration: boolean;
  chatCompletion: boolean;
  streamingSupport: boolean;
  agentTasks: boolean;
  multimodal: boolean;
  functionCalling: boolean;
}

export interface GenerationRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  stopSequences?: string[];
  seed?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  stopSequences?: string[];
  seed?: number;
}

export interface GenerationResponse {
  content: string;
  finishReason?: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  modelUsed: string;
}

export interface ProviderStatus {
  available: boolean;
  modelCount: number;
  loadedModels: string[];
  lastHealthCheck: Date;
  consecutiveFailures: number;
  capabilities: LLMProviderCapabilities;
}

export interface ProviderConfiguration {
  endpoint?: string;
  timeout: number;
  retryAttempts: number;
  healthCheckInterval: number;
  maxConcurrentRequests: number;
}

/**
 * Base LLM Provider Adapter Interface
 * Defines the contract for all LLM provider adapters
 */
export interface ILLMProviderAdapter extends EventEmitter {
  // Connection management
  initialize(): Promise<void>;
  testConnection(): Promise<boolean>;
  getStatus(): Promise<ProviderStatus>;
  updateConfiguration(config: Partial<ProviderConfiguration>): void;
  close(): Promise<void>;

  // Model management
  listAvailableModels(): Promise<string[]>;
  getModelCapabilities(modelName: string): Promise<LLMProviderCapabilities>;
  loadModel(modelName: string): Promise<void>;
  unloadModel(modelName: string): Promise<void>;

  // Text generation
  generateText(modelName: string, request: GenerationRequest): Promise<GenerationResponse>;
  generateTextStream(modelName: string, request: GenerationRequest): Promise<AsyncIterable<string>>;

  // Chat completion
  chatComplete(modelName: string, request: ChatRequest): Promise<GenerationResponse>;
  chatCompleteStream(modelName: string, request: ChatRequest): Promise<AsyncIterable<string>>;
  
  // Alias methods for compatibility
  chatCompletion(modelName: string, request: ChatRequest): Promise<GenerationResponse>;
  chatCompletionStream(modelName: string, request: ChatRequest): Promise<AsyncIterable<string>>;

  // Provider-specific features
  supportsFeature(feature: keyof LLMProviderCapabilities): boolean;
}

/**
 * Ollama Provider Adapter
 * Adapts Ollama infrastructure client for application use
 */
export class OllamaProviderAdapter extends EventEmitter implements ILLMProviderAdapter {
  private client: OllamaClient;
  private config: ProviderConfiguration;
  private capabilities: LLMProviderCapabilities;

  constructor(client: OllamaClient, config: ProviderConfiguration) {
    super();
    this.client = client;
    this.config = config;
    
    // Ollama capabilities
    this.capabilities = {
      textGeneration: true,
      chatCompletion: true,
      streamingSupport: true,
      agentTasks: false,
      multimodal: false, // Depends on model
      functionCalling: false, // Depends on model
    };

    // Forward events from infrastructure layer
    this.setupEventForwarding();
  }

  async initialize(): Promise<void> {
    const connected = await this.client.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Ollama service');
    }
    this.emit('initialized');
  }

  async testConnection(): Promise<boolean> {
    return await this.client.testConnection();
  }

  async getStatus(): Promise<ProviderStatus> {
    const connectionStatus = this.client.getConnectionStatus();
    const models = await this.listAvailableModels();

    return {
      available: connectionStatus.connected,
      modelCount: connectionStatus.modelCount,
      loadedModels: models, // Ollama models are loaded by default when available
      lastHealthCheck: connectionStatus.lastHealthCheck,
      consecutiveFailures: connectionStatus.consecutiveFailures,
      capabilities: this.capabilities,
    };
  }

  updateConfiguration(config: Partial<ProviderConfiguration>): void {
    this.config = { ...this.config, ...config };
    
    // Update infrastructure client configuration
    this.client.updateConfig({
      endpoint: config.endpoint,
      timeout: config.timeout,
      retryAttempts: config.retryAttempts,
      healthCheckInterval: config.healthCheckInterval,
    });

    this.emit('configurationUpdated', this.config);
  }

  async close(): Promise<void> {
    await this.client.close();
    this.emit('closed');
  }

  async listAvailableModels(): Promise<string[]> {
    try {
      const models = await this.client.listModels();
      return models.map(model => model.name);
    } catch (error) {
      this.emit('error', new Error(`Failed to list models: ${error}`));
      return [];
    }
  }

  async getModelCapabilities(modelName: string): Promise<LLMProviderCapabilities> {
    // For Ollama, capabilities are largely model-dependent
    // This would need to be enhanced with model-specific capability detection
    return {
      ...this.capabilities,
      multimodal: modelName.toLowerCase().includes('vision') || modelName.toLowerCase().includes('llava'),
      functionCalling: modelName.toLowerCase().includes('function') || modelName.toLowerCase().includes('tool'),
    };
  }

  async loadModel(modelName: string): Promise<void> {
    // Ollama auto-loads models on first use
    // We can trigger loading by making a minimal request
    try {
      await this.client.generateText({
        model: modelName,
        prompt: 'test',
        options: { num_predict: 1 }
      });
    } catch (error) {
      throw new Error(`Failed to load model ${modelName}: ${error}`);
    }
  }

  async unloadModel(modelName: string): Promise<void> {
    // Ollama doesn't have explicit unload, but we can try to delete if needed
    // This is mainly for completeness of interface
    this.emit('warning', `Ollama does not support explicit model unloading for ${modelName}`);
  }

  async generateText(modelName: string, request: GenerationRequest): Promise<GenerationResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.client.generateText({
        model: modelName,
        prompt: request.prompt,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
          top_p: 0.9,
          stop: request.stopSequences,
          seed: request.seed,
        },
      });

      const latencyMs = Date.now() - startTime;

      return {
        content: response.response || '',
        finishReason: response.done ? 'stop' : 'length',
        tokenUsage: {
          promptTokens: response.prompt_eval_count || 0,
          completionTokens: response.eval_count || 0,
          totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
        },
        latencyMs,
        modelUsed: modelName,
      };
    } catch (error) {
      this.emit('generationError', { modelName, error, request });
      throw new Error(`Text generation failed: ${error}`);
    }
  }

  async generateTextStream(modelName: string, request: GenerationRequest): Promise<AsyncIterable<string>> {
    try {
      const stream = await this.client.generateTextStream({
        model: modelName,
        prompt: request.prompt,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
          stop: request.stopSequences,
          seed: request.seed,
        },
      });

      return this.transformOllamaStream(stream);
    } catch (error) {
      this.emit('streamError', { modelName, error, request });
      throw new Error(`Streaming generation failed: ${error}`);
    }
  }

  async chatComplete(modelName: string, request: ChatRequest): Promise<GenerationResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.client.chat({
        model: modelName,
        messages: request.messages,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
          stop: request.stopSequences,
          seed: request.seed,
        },
      });

      const latencyMs = Date.now() - startTime;

      return {
        content: response.message.content,
        finishReason: response.done ? 'stop' : 'length',
        tokenUsage: {
          promptTokens: response.prompt_eval_count || 0,
          completionTokens: response.eval_count || 0,
          totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
        },
        latencyMs,
        modelUsed: modelName,
      };
    } catch (error) {
      this.emit('chatError', { modelName, error, request });
      throw new Error(`Chat completion failed: ${error}`);
    }
  }

  async chatCompleteStream(modelName: string, request: ChatRequest): Promise<AsyncIterable<string>> {
    try {
      const stream = await this.client.chatStream({
        model: modelName,
        messages: request.messages,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
          stop: request.stopSequences,
          seed: request.seed,
        },
      });

      return this.transformOllamaChatStream(stream);
    } catch (error) {
      this.emit('chatStreamError', { modelName, error, request });
      throw new Error(`Chat streaming failed: ${error}`);
    }
  }

  supportsFeature(feature: keyof LLMProviderCapabilities): boolean {
    return this.capabilities[feature];
  }

  // Alias methods for compatibility
  async chatCompletion(modelName: string, request: ChatRequest): Promise<GenerationResponse> {
    return await this.chatComplete(modelName, request);
  }

  async chatCompletionStream(modelName: string, request: ChatRequest): Promise<AsyncIterable<string>> {
    return await this.chatCompleteStream(modelName, request);
  }

  // Private helper methods
  
  private setupEventForwarding(): void {
    this.client.on('connected', (status) => this.emit('connected', status));
    this.client.on('disconnected', () => this.emit('disconnected'));
    this.client.on('connectionError', (error) => this.emit('connectionError', error));
    this.client.on('operationError', (data) => this.emit('operationError', data));
    this.client.on('operationFailed', (error) => this.emit('operationFailed', error));
    this.client.on('recoverySuccess', () => this.emit('recoverySuccess'));
  }

  private async* transformOllamaStream(stream: AsyncIterable<any>): AsyncIterable<string> {
    for await (const chunk of stream) {
      if (chunk.response) {
        yield chunk.response;
      }
    }
  }

  private async* transformOllamaChatStream(stream: AsyncIterable<any>): AsyncIterable<string> {
    for await (const chunk of stream) {
      if (chunk.message?.content) {
        yield chunk.message.content;
      }
    }
  }
}

/**
 * LM Studio Provider Adapter
 * Adapts LM Studio infrastructure client for application use
 */
export class LMStudioProviderAdapter extends EventEmitter implements ILLMProviderAdapter {
  private client: LMStudioClient;
  private config: ProviderConfiguration;
  private capabilities: LLMProviderCapabilities;

  constructor(client: LMStudioClient, config: ProviderConfiguration) {
    super();
    this.client = client;
    this.config = config;
    
    // LM Studio capabilities
    this.capabilities = {
      textGeneration: true,
      chatCompletion: true,
      streamingSupport: true,
      agentTasks: true, // LM Studio supports .act() method
      multimodal: false, // Depends on model
      functionCalling: true, // Better support for function calling
    };

    this.setupEventForwarding();
  }

  async initialize(): Promise<void> {
    const connected = await this.client.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to LM Studio service');
    }
    this.emit('initialized');
  }

  async testConnection(): Promise<boolean> {
    return await this.client.testConnection();
  }

  async getStatus(): Promise<ProviderStatus> {
    const connectionStatus = this.client.getConnectionStatus();
    const loadedModels = await this.getLoadedModels();

    return {
      available: connectionStatus.connected,
      modelCount: connectionStatus.modelCount,
      loadedModels,
      lastHealthCheck: connectionStatus.lastHealthCheck,
      consecutiveFailures: connectionStatus.consecutiveFailures,
      capabilities: this.capabilities,
    };
  }

  updateConfiguration(config: Partial<ProviderConfiguration>): void {
    this.config = { ...this.config, ...config };
    
    this.client.updateConfig({
      baseUrl: config.endpoint,
      timeout: config.timeout,
      retryAttempts: config.retryAttempts,
      healthCheckInterval: config.healthCheckInterval,
    });

    this.emit('configurationUpdated', this.config);
  }

  async close(): Promise<void> {
    await this.client.close();
    this.emit('closed');
  }

  async listAvailableModels(): Promise<string[]> {
    try {
      const models = await this.client.listAllModels();
      return models.map(model => model.path);
    } catch (error) {
      this.emit('error', new Error(`Failed to list models: ${error}`));
      return [];
    }
  }

  async getModelCapabilities(modelName: string): Promise<LLMProviderCapabilities> {
    return {
      ...this.capabilities,
      multimodal: modelName.toLowerCase().includes('vision') || modelName.toLowerCase().includes('multimodal'),
      functionCalling: !modelName.toLowerCase().includes('base'), // Most instruct models support functions
    };
  }

  async loadModel(modelName: string): Promise<void> {
    try {
      await this.client.loadModel(modelName);
    } catch (error) {
      throw new Error(`Failed to load model ${modelName}: ${error}`);
    }
  }

  async unloadModel(modelName: string): Promise<void> {
    try {
      await this.client.unloadModel(modelName);
    } catch (error) {
      throw new Error(`Failed to unload model ${modelName}: ${error}`);
    }
  }

  async generateText(modelName: string, request: GenerationRequest): Promise<GenerationResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.client.complete({
        modelPath: modelName,
        prompt: request.prompt,
        options: {
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          stop: request.stopSequences,
          seed: request.seed,
        },
      });

      const latencyMs = Date.now() - startTime;

      return {
        content: response.content,
        finishReason: response.finishReason,
        tokenUsage: response.usage,
        latencyMs,
        modelUsed: modelName,
      };
    } catch (error) {
      this.emit('generationError', { modelName, error, request });
      throw new Error(`Text generation failed: ${error}`);
    }
  }

  async generateTextStream(modelName: string, request: GenerationRequest): Promise<AsyncIterable<string>> {
    try {
      const stream = await this.client.completeStream({
        modelPath: modelName,
        prompt: request.prompt,
        options: {
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          stop: request.stopSequences,
          seed: request.seed,
        },
      });

      return this.transformLMStudioStream(stream);
    } catch (error) {
      this.emit('streamError', { modelName, error, request });
      throw new Error(`Streaming generation failed: ${error}`);
    }
  }

  async chatComplete(modelName: string, request: ChatRequest): Promise<GenerationResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.client.chat({
        modelPath: modelName,
        messages: request.messages,
        options: {
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          stop: request.stopSequences,
          seed: request.seed,
        },
      });

      const latencyMs = Date.now() - startTime;

      return {
        content: response.content,
        finishReason: response.finishReason,
        tokenUsage: response.usage,
        latencyMs,
        modelUsed: modelName,
      };
    } catch (error) {
      this.emit('chatError', { modelName, error, request });
      throw new Error(`Chat completion failed: ${error}`);
    }
  }

  async chatCompleteStream(modelName: string, request: ChatRequest): Promise<AsyncIterable<string>> {
    try {
      const stream = await this.client.chatStream({
        modelPath: modelName,
        messages: request.messages,
        options: {
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          stop: request.stopSequences,
          seed: request.seed,
        },
      });

      return this.transformLMStudioChatStream(stream);
    } catch (error) {
      this.emit('chatStreamError', { modelName, error, request });
      throw new Error(`Chat streaming failed: ${error}`);
    }
  }

  supportsFeature(feature: keyof LLMProviderCapabilities): boolean {
    return this.capabilities[feature];
  }

  // Alias methods for compatibility
  async chatCompletion(modelName: string, request: ChatRequest): Promise<GenerationResponse> {
    return await this.chatComplete(modelName, request);
  }

  async chatCompletionStream(modelName: string, request: ChatRequest): Promise<AsyncIterable<string>> {
    return await this.chatCompleteStream(modelName, request);
  }

  // LM Studio specific methods

  async performAgentTask(modelName: string, task: string, tools: any[] = []): Promise<any> {
    try {
      return await this.client.performAgentTask({
        modelPath: modelName,
        task,
        tools,
      });
    } catch (error) {
      this.emit('agentTaskError', { modelName, error, task });
      throw new Error(`Agent task failed: ${error}`);
    }
  }

  // Private helper methods
  
  private setupEventForwarding(): void {
    this.client.on('connected', (status) => this.emit('connected', status));
    this.client.on('disconnected', () => this.emit('disconnected'));
    this.client.on('connectionError', (error) => this.emit('connectionError', error));
    this.client.on('operationError', (data) => this.emit('operationError', data));
    this.client.on('operationFailed', (error) => this.emit('operationFailed', error));
    this.client.on('recoverySuccess', () => this.emit('recoverySuccess'));
  }

  private async getLoadedModels(): Promise<string[]> {
    try {
      const models = await this.client.listLoadedModels();
      return models.map(model => model.path);
    } catch (error) {
      return [];
    }
  }

  private async* transformLMStudioStream(stream: AsyncIterable<any>): AsyncIterable<string> {
    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content;
      }
    }
  }

  private async* transformLMStudioChatStream(stream: AsyncIterable<any>): AsyncIterable<string> {
    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content;
      }
    }
  }
}

// Factory functions for creating adapter instances
export function createOllamaAdapter(config: Partial<ProviderConfiguration> = {}): OllamaProviderAdapter {
  const defaultConfig: ProviderConfiguration = {
    timeout: 30000,
    retryAttempts: 3,
    healthCheckInterval: 60000,
    maxConcurrentRequests: 3,
  };

  const finalConfig = { ...defaultConfig, ...config };
  
  const client = new OllamaClient({
    endpoint: config.endpoint || 'http://localhost:11434',
    timeout: finalConfig.timeout,
    retryAttempts: finalConfig.retryAttempts,
    retryDelayMs: 1000,
    connectionTimeout: 5000,
    healthCheckInterval: finalConfig.healthCheckInterval,
  });

  return new OllamaProviderAdapter(client, finalConfig);
}

export function createLMStudioAdapter(config: Partial<ProviderConfiguration> = {}): LMStudioProviderAdapter {
  const defaultConfig: ProviderConfiguration = {
    timeout: 30000,
    retryAttempts: 3,
    healthCheckInterval: 60000,
    maxConcurrentRequests: 3,
  };

  const finalConfig = { ...defaultConfig, ...config };
  
  const client = new LMStudioClient({
    baseUrl: config.endpoint,
    timeout: finalConfig.timeout,
    retryAttempts: finalConfig.retryAttempts,
    retryDelayMs: 1000,
    connectionTimeout: 5000,
    healthCheckInterval: finalConfig.healthCheckInterval,
    websocketReconnectDelay: 5000,
  });

  return new LMStudioProviderAdapter(client, finalConfig);
}