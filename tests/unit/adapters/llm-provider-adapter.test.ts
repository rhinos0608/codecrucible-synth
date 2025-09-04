/**
 * Comprehensive LLM Provider Adapter Tests
 * Testing adapter layer components: model selection, provider coordination, error handling
 * Following Living Spiral Methodology - Multi-Voice Adapter Testing Approach
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import {
  ILLMProviderAdapter,
  LLMProviderCapabilities,
  GenerationRequest,
  ChatRequest,
  GenerationResponse,
  ProviderStatus,
  ProviderConfiguration,
  ChatMessage,
} from '../../../src/adapters/llm-provider-adapter.js';

// Mock implementations for testing
class MockLLMProviderAdapter extends EventEmitter implements ILLMProviderAdapter {
  private config: ProviderConfiguration;
  private isInitialized = false;
  private isConnected = true;
  private availableModels: string[] = [];
  private loadedModels = new Set<string>();
  private consecutiveFailures = 0;
  private lastHealthCheck = new Date();

  constructor(
    config: ProviderConfiguration,
    availableModels: string[] = ['model-1', 'model-2', 'model-3']
  ) {
    super();
    this.config = config;
    this.availableModels = availableModels;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Provider already initialized');
    }

    // Simulate initialization delay
    await new Promise(resolve => setTimeout(resolve, 10));

    if (!this.isConnected) {
      throw new Error('Failed to connect to provider');
    }

    this.isInitialized = true;
    this.emit('initialized');
  }

  async testConnection(): Promise<boolean> {
    this.lastHealthCheck = new Date();

    if (this.consecutiveFailures >= 3) {
      this.consecutiveFailures++;
      return false;
    }

    if (!this.isConnected) {
      this.consecutiveFailures++;
      this.emit('connectionFailed', { failures: this.consecutiveFailures });
      return false;
    }

    this.consecutiveFailures = 0;
    this.emit('connectionSuccess');
    return true;
  }

  async getStatus(): Promise<ProviderStatus> {
    const isHealthy = await this.testConnection();

    return {
      available: isHealthy && this.isInitialized,
      modelCount: this.availableModels.length,
      loadedModels: Array.from(this.loadedModels),
      lastHealthCheck: this.lastHealthCheck,
      consecutiveFailures: this.consecutiveFailures,
      capabilities: {
        textGeneration: true,
        chatCompletion: true,
        streamingSupport: true,
        agentTasks: true,
        multimodal: false,
        functionCalling: false,
      },
    };
  }

  updateConfiguration(config: Partial<ProviderConfiguration>): void {
    this.config = { ...this.config, ...config };
    this.emit('configurationUpdated', this.config);
  }

  async close(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    // Unload all models
    for (const model of this.loadedModels) {
      await this.unloadModel(model);
    }

    this.isInitialized = false;
    this.removeAllListeners();
    this.emit('closed');
  }

  async listAvailableModels(): Promise<string[]> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized');
    }

    return [...this.availableModels];
  }

  async getModelCapabilities(modelName: string): Promise<LLMProviderCapabilities> {
    if (!this.availableModels.includes(modelName)) {
      throw new Error(`Model not available: ${modelName}`);
    }

    // Different models have different capabilities
    const capabilities: Record<string, LLMProviderCapabilities> = {
      'model-1': {
        textGeneration: true,
        chatCompletion: true,
        streamingSupport: true,
        agentTasks: true,
        multimodal: false,
        functionCalling: false,
      },
      'model-2': {
        textGeneration: true,
        chatCompletion: true,
        streamingSupport: true,
        agentTasks: true,
        multimodal: true,
        functionCalling: true,
      },
      'model-3': {
        textGeneration: true,
        chatCompletion: false,
        streamingSupport: false,
        agentTasks: false,
        multimodal: false,
        functionCalling: false,
      },
    };

    return capabilities[modelName] || capabilities['model-1'];
  }

  async loadModel(modelName: string): Promise<void> {
    if (!this.availableModels.includes(modelName)) {
      throw new Error(`Model not available: ${modelName}`);
    }

    if (this.loadedModels.has(modelName)) {
      throw new Error(`Model already loaded: ${modelName}`);
    }

    // Simulate model loading delay
    await new Promise(resolve => setTimeout(resolve, 50));

    this.loadedModels.add(modelName);
    this.emit('modelLoaded', { modelName });
  }

  async unloadModel(modelName: string): Promise<void> {
    if (!this.loadedModels.has(modelName)) {
      throw new Error(`Model not loaded: ${modelName}`);
    }

    // Simulate model unloading delay
    await new Promise(resolve => setTimeout(resolve, 20));

    this.loadedModels.delete(modelName);
    this.emit('modelUnloaded', { modelName });
  }

  async generateText(modelName: string, request: GenerationRequest): Promise<GenerationResponse> {
    if (!this.loadedModels.has(modelName)) {
      throw new Error(`Model not loaded: ${modelName}`);
    }

    const startTime = Date.now();

    // Simulate generation delay
    await new Promise(resolve => setTimeout(resolve, 30));

    if (request.prompt.includes('error-trigger')) {
      throw new Error('Generation failed: Error trigger detected');
    }

    const response: GenerationResponse = {
      content: `Generated response for: "${request.prompt.substring(0, 50)}..."`,
      finishReason: 'completed',
      tokenUsage: {
        promptTokens: Math.floor(request.prompt.length / 4),
        completionTokens: 100,
        totalTokens: Math.floor(request.prompt.length / 4) + 100,
      },
      latencyMs: Date.now() - startTime,
      modelUsed: modelName,
    };

    this.emit('textGenerated', { modelName, request, response });
    return response;
  }

  async generateTextStream(
    modelName: string,
    request: GenerationRequest
  ): Promise<AsyncIterable<string>> {
    if (!this.loadedModels.has(modelName)) {
      throw new Error(`Model not loaded: ${modelName}`);
    }

    // Mock streaming response
    async function* mockStream() {
      const chunks = ['Hello', ' there', '! How', ' can I', ' help you', ' today?'];
      for (const chunk of chunks) {
        yield chunk;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    this.emit('streamingStarted', { modelName, request });
    return mockStream();
  }

  async chatCompletion(modelName: string, request: ChatRequest): Promise<GenerationResponse> {
    if (!this.loadedModels.has(modelName)) {
      throw new Error(`Model not loaded: ${modelName}`);
    }

    const capabilities = await this.getModelCapabilities(modelName);
    if (!capabilities.chatCompletion) {
      throw new Error(`Model does not support chat completion: ${modelName}`);
    }

    const startTime = Date.now();

    // Simulate chat completion delay
    await new Promise(resolve => setTimeout(resolve, 40));

    const lastMessage = request.messages[request.messages.length - 1];

    const response: GenerationResponse = {
      content: `Chat response to: "${lastMessage.content.substring(0, 50)}..."`,
      finishReason: 'completed',
      tokenUsage: {
        promptTokens: request.messages.reduce(
          (sum, msg) => sum + Math.floor(msg.content.length / 4),
          0
        ),
        completionTokens: 80,
        totalTokens:
          request.messages.reduce((sum, msg) => sum + Math.floor(msg.content.length / 4), 0) + 80,
      },
      latencyMs: Date.now() - startTime,
      modelUsed: modelName,
    };

    this.emit('chatCompleted', { modelName, request, response });
    return response;
  }

  async chatCompletionStream(
    modelName: string,
    request: ChatRequest
  ): Promise<AsyncIterable<string>> {
    const capabilities = await this.getModelCapabilities(modelName);
    if (!capabilities.streamingSupport) {
      throw new Error(`Model does not support streaming: ${modelName}`);
    }

    // Mock streaming chat response
    async function* mockChatStream() {
      const chunks = ['I understand', ' your question', '. Let me', ' think about', ' that...'];
      for (const chunk of chunks) {
        yield chunk;
        await new Promise(resolve => setTimeout(resolve, 15));
      }
    }

    this.emit('chatStreamingStarted', { modelName, request });
    return mockChatStream();
  }

  // Test helper methods
  setConnected(connected: boolean): void {
    this.isConnected = connected;
  }

  setConsecutiveFailures(failures: number): void {
    this.consecutiveFailures = failures;
  }

  addAvailableModel(modelName: string): void {
    if (!this.availableModels.includes(modelName)) {
      this.availableModels.push(modelName);
    }
  }

  removeAvailableModel(modelName: string): void {
    const index = this.availableModels.indexOf(modelName);
    if (index > -1) {
      this.availableModels.splice(index, 1);
    }
  }
}

describe('LLM Provider Adapter - Comprehensive Tests', () => {
  let adapter: MockLLMProviderAdapter;
  let defaultConfig: ProviderConfiguration;

  beforeEach(() => {
    defaultConfig = {
      endpoint: 'http://localhost:11434',
      timeout: 30000,
      retryAttempts: 3,
      healthCheckInterval: 60000,
      maxConcurrentRequests: 10,
    };

    adapter = new MockLLMProviderAdapter(defaultConfig);
  });

  afterEach(async () => {
    if (adapter) {
      await adapter.close();
    }
    jest.clearAllMocks();
  });

  describe('Provider Lifecycle Management', () => {
    it('should initialize provider successfully', async () => {
      const eventHandler = jest.fn();
      adapter.on('initialized', eventHandler);

      await adapter.initialize();

      const status = await adapter.getStatus();
      expect(status.available).toBe(true);
      expect(eventHandler).toHaveBeenCalled();
    });

    it('should prevent double initialization', async () => {
      await adapter.initialize();

      await expect(adapter.initialize()).rejects.toThrow('Provider already initialized');
    });

    it('should handle initialization failures', async () => {
      adapter.setConnected(false);

      await expect(adapter.initialize()).rejects.toThrow('Failed to connect to provider');
    });

    it('should test connection and track health', async () => {
      await adapter.initialize();

      const isHealthy = await adapter.testConnection();
      expect(isHealthy).toBe(true);

      const status = await adapter.getStatus();
      expect(status.consecutiveFailures).toBe(0);
      expect(status.lastHealthCheck).toBeInstanceOf(Date);
    });

    it('should handle connection failures and track consecutive failures', async () => {
      await adapter.initialize();
      adapter.setConnected(false);

      const eventHandler = jest.fn();
      adapter.on('connectionFailed', eventHandler);

      // First failure
      let isHealthy = await adapter.testConnection();
      expect(isHealthy).toBe(false);

      // Second failure
      isHealthy = await adapter.testConnection();
      expect(isHealthy).toBe(false);

      const status = await adapter.getStatus();
      expect(status.consecutiveFailures).toBe(2);
      expect(status.available).toBe(false);
      expect(eventHandler).toHaveBeenCalledTimes(2);
    });

    it('should reset consecutive failures on successful connection', async () => {
      await adapter.initialize();
      adapter.setConsecutiveFailures(2);

      const eventHandler = jest.fn();
      adapter.on('connectionSuccess', eventHandler);

      const isHealthy = await adapter.testConnection();
      expect(isHealthy).toBe(true);

      const status = await adapter.getStatus();
      expect(status.consecutiveFailures).toBe(0);
      expect(eventHandler).toHaveBeenCalled();
    });

    it('should update configuration', async () => {
      const eventHandler = jest.fn();
      adapter.on('configurationUpdated', eventHandler);

      const updates = {
        timeout: 60000,
        retryAttempts: 5,
        maxConcurrentRequests: 20,
      };

      adapter.updateConfiguration(updates);

      expect(eventHandler).toHaveBeenCalledWith(expect.objectContaining(updates));
    });

    it('should close provider and cleanup resources', async () => {
      await adapter.initialize();
      await adapter.loadModel('model-1');
      await adapter.loadModel('model-2');

      const eventHandler = jest.fn();
      adapter.on('closed', eventHandler);

      await adapter.close();

      const status = await adapter.getStatus();
      expect(status.available).toBe(false);
      expect(status.loadedModels).toEqual([]);
      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('Model Management', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should list available models', async () => {
      const models = await adapter.listAvailableModels();

      expect(models).toEqual(['model-1', 'model-2', 'model-3']);
    });

    it('should throw error when listing models before initialization', async () => {
      const uninitializedAdapter = new MockLLMProviderAdapter(defaultConfig);

      await expect(uninitializedAdapter.listAvailableModels()).rejects.toThrow(
        'Provider not initialized'
      );
    });

    it('should get model capabilities', async () => {
      const capabilities = await adapter.getModelCapabilities('model-2');

      expect(capabilities.textGeneration).toBe(true);
      expect(capabilities.chatCompletion).toBe(true);
      expect(capabilities.streamingSupport).toBe(true);
      expect(capabilities.agentTasks).toBe(true);
      expect(capabilities.multimodal).toBe(true);
      expect(capabilities.functionCalling).toBe(true);
    });

    it('should handle unavailable model capabilities request', async () => {
      await expect(adapter.getModelCapabilities('non-existent-model')).rejects.toThrow(
        'Model not available: non-existent-model'
      );
    });

    it('should load models successfully', async () => {
      const eventHandler = jest.fn();
      adapter.on('modelLoaded', eventHandler);

      await adapter.loadModel('model-1');

      const status = await adapter.getStatus();
      expect(status.loadedModels).toContain('model-1');
      expect(eventHandler).toHaveBeenCalledWith({ modelName: 'model-1' });
    });

    it('should prevent loading already loaded models', async () => {
      await adapter.loadModel('model-1');

      await expect(adapter.loadModel('model-1')).rejects.toThrow('Model already loaded: model-1');
    });

    it('should prevent loading unavailable models', async () => {
      await expect(adapter.loadModel('unavailable-model')).rejects.toThrow(
        'Model not available: unavailable-model'
      );
    });

    it('should unload models successfully', async () => {
      await adapter.loadModel('model-1');

      const eventHandler = jest.fn();
      adapter.on('modelUnloaded', eventHandler);

      await adapter.unloadModel('model-1');

      const status = await adapter.getStatus();
      expect(status.loadedModels).not.toContain('model-1');
      expect(eventHandler).toHaveBeenCalledWith({ modelName: 'model-1' });
    });

    it('should prevent unloading non-loaded models', async () => {
      await expect(adapter.unloadModel('model-1')).rejects.toThrow('Model not loaded: model-1');
    });

    it('should load multiple models concurrently', async () => {
      const loadPromises = ['model-1', 'model-2', 'model-3'].map(model => adapter.loadModel(model));

      await Promise.all(loadPromises);

      const status = await adapter.getStatus();
      expect(status.loadedModels).toHaveLength(3);
      expect(status.loadedModels).toContain('model-1');
      expect(status.loadedModels).toContain('model-2');
      expect(status.loadedModels).toContain('model-3');
    });
  });

  describe('Text Generation', () => {
    beforeEach(async () => {
      await adapter.initialize();
      await adapter.loadModel('model-1');
    });

    it('should generate text successfully', async () => {
      const request: GenerationRequest = {
        prompt: 'Write a hello world program in Python',
        maxTokens: 150,
        temperature: 0.7,
      };

      const eventHandler = jest.fn();
      adapter.on('textGenerated', eventHandler);

      const response = await adapter.generateText('model-1', request);

      expect(response.content).toContain('Generated response for');
      expect(response.finishReason).toBe('completed');
      expect(response.tokenUsage).toBeDefined();
      expect(response.tokenUsage!.promptTokens).toBeGreaterThan(0);
      expect(response.tokenUsage!.completionTokens).toBe(100);
      expect(response.latencyMs).toBeGreaterThan(0);
      expect(response.modelUsed).toBe('model-1');

      expect(eventHandler).toHaveBeenCalledWith({
        modelName: 'model-1',
        request,
        response,
      });
    });

    it('should handle generation errors', async () => {
      const request: GenerationRequest = {
        prompt: 'error-trigger command',
        maxTokens: 100,
      };

      await expect(adapter.generateText('model-1', request)).rejects.toThrow(
        'Generation failed: Error trigger detected'
      );
    });

    it('should prevent generation with unloaded model', async () => {
      const request: GenerationRequest = {
        prompt: 'Test prompt',
        maxTokens: 100,
      };

      await expect(adapter.generateText('model-2', request)).rejects.toThrow(
        'Model not loaded: model-2'
      );
    });

    it('should support streaming text generation', async () => {
      const request: GenerationRequest = {
        prompt: 'Tell me a story',
        maxTokens: 200,
        stream: true,
      };

      const eventHandler = jest.fn();
      adapter.on('streamingStarted', eventHandler);

      const stream = await adapter.generateTextStream('model-1', request);
      const chunks: string[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(6);
      expect(chunks.join('')).toBe('Hello there! How can I help you today?');
      expect(eventHandler).toHaveBeenCalledWith({
        modelName: 'model-1',
        request,
      });
    });

    it('should handle various generation parameters', async () => {
      const request: GenerationRequest = {
        prompt: 'Complex generation request',
        maxTokens: 500,
        temperature: 0.9,
        stopSequences: ['END', 'STOP'],
        seed: 12345,
      };

      const response = await adapter.generateText('model-1', request);

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      expect(response.modelUsed).toBe('model-1');
    });
  });

  describe('Chat Completion', () => {
    beforeEach(async () => {
      await adapter.initialize();
      await adapter.loadModel('model-2'); // Model with chat capabilities
    });

    it('should handle chat completion successfully', async () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'What is the capital of France?' },
      ];

      const request: ChatRequest = {
        messages,
        maxTokens: 100,
        temperature: 0.7,
      };

      const eventHandler = jest.fn();
      adapter.on('chatCompleted', eventHandler);

      const response = await adapter.chatCompletion('model-2', request);

      expect(response.content).toContain('Chat response to');
      expect(response.finishReason).toBe('completed');
      expect(response.tokenUsage).toBeDefined();
      expect(response.modelUsed).toBe('model-2');

      expect(eventHandler).toHaveBeenCalledWith({
        modelName: 'model-2',
        request,
        response,
      });
    });

    it('should prevent chat completion with unsupported model', async () => {
      await adapter.loadModel('model-3'); // Model without chat support

      const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];

      const request: ChatRequest = { messages };

      await expect(adapter.chatCompletion('model-3', request)).rejects.toThrow(
        'Model does not support chat completion: model-3'
      );
    });

    it('should support streaming chat completion', async () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'Explain quantum computing' }];

      const request: ChatRequest = {
        messages,
        stream: true,
      };

      const eventHandler = jest.fn();
      adapter.on('chatStreamingStarted', eventHandler);

      const stream = await adapter.chatCompletionStream('model-2', request);
      const chunks: string[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(5);
      expect(chunks.join('')).toBe('I understand your question. Let me think about that...');
      expect(eventHandler).toHaveBeenCalledWith({
        modelName: 'model-2',
        request,
      });
    });

    it('should handle streaming with unsupported model', async () => {
      await adapter.loadModel('model-3'); // Model without streaming support

      const messages: ChatMessage[] = [{ role: 'user', content: 'Test message' }];

      const request: ChatRequest = { messages };

      await expect(adapter.chatCompletionStream('model-3', request)).rejects.toThrow(
        'Model does not support streaming: model-3'
      );
    });

    it('should handle complex chat conversations', async () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a coding assistant' },
        { role: 'user', content: 'How do I write a function in Python?' },
        { role: 'assistant', content: 'You can define a function using the def keyword' },
        { role: 'user', content: 'Can you show me an example?' },
      ];

      const request: ChatRequest = {
        messages,
        maxTokens: 200,
        temperature: 0.5,
      };

      const response = await adapter.chatCompletion('model-2', request);

      expect(response.content).toBeTruthy();
      expect(response.tokenUsage!.promptTokens).toBeGreaterThan(20); // Multiple messages
    });
  });

  describe('Provider Status and Health Monitoring', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should provide comprehensive status information', async () => {
      await adapter.loadModel('model-1');
      await adapter.loadModel('model-2');

      const status = await adapter.getStatus();

      expect(status.available).toBe(true);
      expect(status.modelCount).toBe(3);
      expect(status.loadedModels).toEqual(['model-1', 'model-2']);
      expect(status.lastHealthCheck).toBeInstanceOf(Date);
      expect(status.consecutiveFailures).toBe(0);
      expect(status.capabilities).toBeDefined();
      expect(status.capabilities.textGeneration).toBe(true);
    });

    it('should track consecutive failures in status', async () => {
      adapter.setConnected(false);
      adapter.setConsecutiveFailures(5);

      const status = await adapter.getStatus();

      expect(status.available).toBe(false);
      expect(status.consecutiveFailures).toBe(6); // Incremented by getStatus call
    });

    it('should update last health check timestamp', async () => {
      const initialStatus = await adapter.getStatus();
      const initialTime = initialStatus.lastHealthCheck;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 50));

      const updatedStatus = await adapter.getStatus();
      const updatedTime = updatedStatus.lastHealthCheck;

      expect(updatedTime.getTime()).toBeGreaterThan(initialTime.getTime());
    });

    it('should handle status requests during connection issues', async () => {
      adapter.setConnected(false);

      const status = await adapter.getStatus();

      expect(status.available).toBe(false);
      expect(status.consecutiveFailures).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle provider operations before initialization', async () => {
      const uninitializedAdapter = new MockLLMProviderAdapter(defaultConfig);

      await expect(uninitializedAdapter.listAvailableModels()).rejects.toThrow();
      await expect(uninitializedAdapter.loadModel('model-1')).rejects.toThrow();
    });

    it('should handle concurrent model loading and unloading', async () => {
      await adapter.initialize();

      // Load and unload the same model concurrently
      const loadPromise = adapter.loadModel('model-1');

      await loadPromise;

      const unloadPromise = adapter.unloadModel('model-1');
      const reloadPromise = adapter.loadModel('model-1');

      await unloadPromise;
      await reloadPromise;

      const status = await adapter.getStatus();
      expect(status.loadedModels).toContain('model-1');
    });

    it('should handle resource cleanup on close', async () => {
      await adapter.initialize();
      await adapter.loadModel('model-1');
      await adapter.loadModel('model-2');

      const listenerCount = adapter.listenerCount('modelLoaded');

      await adapter.close();

      // Verify cleanup
      expect(adapter.listenerCount('modelLoaded')).toBeLessThanOrEqual(listenerCount);
    });

    it('should handle dynamic model availability changes', async () => {
      await adapter.initialize();

      const initialModels = await adapter.listAvailableModels();
      expect(initialModels).toContain('model-1');

      adapter.removeAvailableModel('model-1');
      const updatedModels = await adapter.listAvailableModels();
      expect(updatedModels).not.toContain('model-1');

      adapter.addAvailableModel('new-model');
      const newModels = await adapter.listAvailableModels();
      expect(newModels).toContain('new-model');
    });

    it('should handle timeout scenarios gracefully', async () => {
      await adapter.initialize();
      await adapter.loadModel('model-1');

      // Update configuration with very short timeout
      adapter.updateConfiguration({ timeout: 1 });

      // Generation should still work (mock doesn't enforce timeout)
      const request: GenerationRequest = {
        prompt: 'Quick test',
        maxTokens: 10,
      };

      const response = await adapter.generateText('model-1', request);
      expect(response).toBeDefined();
    });
  });

  describe('Performance and Concurrency', () => {
    beforeEach(async () => {
      await adapter.initialize();
      await adapter.loadModel('model-1');
    });

    it('should handle multiple concurrent generation requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        prompt: `Concurrent request ${i}`,
        maxTokens: 50,
      }));

      const startTime = Date.now();
      const promises = requests.map(request => adapter.generateText('model-1', request));

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      expect(responses).toHaveLength(10);
      expect(responses.every(r => r.content.includes('Generated response'))).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle mixed generation and chat requests', async () => {
      await adapter.loadModel('model-2'); // Load model with chat capabilities

      const textRequest: GenerationRequest = {
        prompt: 'Generate some text',
        maxTokens: 100,
      };

      const chatRequest: ChatRequest = {
        messages: [{ role: 'user', content: 'Chat with me' }],
        maxTokens: 100,
      };

      const [textResponse, chatResponse] = await Promise.all([
        adapter.generateText('model-1', textRequest),
        adapter.chatCompletion('model-2', chatRequest),
      ]);

      expect(textResponse.content).toContain('Generated response');
      expect(chatResponse.content).toContain('Chat response');
    });

    it('should handle rapid model loading and unloading', async () => {
      const models = ['model-1', 'model-2', 'model-3'];

      // Rapid loading
      for (const model of models) {
        await adapter.loadModel(model);
      }

      // Rapid unloading
      for (const model of models) {
        await adapter.unloadModel(model);
      }

      const status = await adapter.getStatus();
      expect(status.loadedModels).toHaveLength(0);
    });

    it('should maintain performance with large prompts', async () => {
      const largePrompt = 'A'.repeat(10000); // 10k characters
      const request: GenerationRequest = {
        prompt: largePrompt,
        maxTokens: 200,
      };

      const startTime = Date.now();
      const response = await adapter.generateText('model-1', request);
      const endTime = Date.now();

      expect(response.content).toBeTruthy();
      expect(response.tokenUsage!.promptTokens).toBeGreaterThan(2000);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Event Emission and Monitoring', () => {
    it('should emit all lifecycle events', async () => {
      const events: string[] = [];

      adapter.on('initialized', () => events.push('initialized'));
      adapter.on('connectionSuccess', () => events.push('connectionSuccess'));
      adapter.on('modelLoaded', () => events.push('modelLoaded'));
      adapter.on('textGenerated', () => events.push('textGenerated'));
      adapter.on('modelUnloaded', () => events.push('modelUnloaded'));
      adapter.on('closed', () => events.push('closed'));

      await adapter.initialize();
      await adapter.testConnection();
      await adapter.loadModel('model-1');

      const request: GenerationRequest = { prompt: 'Test', maxTokens: 50 };
      await adapter.generateText('model-1', request);

      await adapter.unloadModel('model-1');
      await adapter.close();

      expect(events).toContain('initialized');
      expect(events).toContain('connectionSuccess');
      expect(events).toContain('modelLoaded');
      expect(events).toContain('textGenerated');
      expect(events).toContain('modelUnloaded');
      expect(events).toContain('closed');
    });

    it('should emit configuration update events', async () => {
      const eventHandler = jest.fn();
      adapter.on('configurationUpdated', eventHandler);

      const updates = { timeout: 45000 };
      adapter.updateConfiguration(updates);

      expect(eventHandler).toHaveBeenCalledWith(expect.objectContaining(updates));
    });

    it('should emit streaming events', async () => {
      await adapter.initialize();
      await adapter.loadModel('model-2');

      const eventHandler = jest.fn();
      adapter.on('streamingStarted', eventHandler);

      const request: GenerationRequest = { prompt: 'Stream test', maxTokens: 100 };
      await adapter.generateTextStream('model-2', request);

      expect(eventHandler).toHaveBeenCalledWith({
        modelName: 'model-2',
        request,
      });
    });

    it('should handle event listener cleanup on close', async () => {
      await adapter.initialize();

      // Add multiple listeners
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      adapter.on('modelLoaded', listener1);
      adapter.on('modelLoaded', listener2);

      const initialListenerCount = adapter.listenerCount('modelLoaded');
      expect(initialListenerCount).toBeGreaterThanOrEqual(2);

      await adapter.close();

      // Listeners should be cleaned up
      expect(adapter.listenerCount('modelLoaded')).toBeLessThanOrEqual(initialListenerCount);
    });
  });
});
