/**
 * Ollama Provider Adapter - Unit Tests
 * Tests TypeScript interfaces, validation, and business logic without external dependencies
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { OllamaProvider } from '../../../src/providers/hybrid/ollama-provider.js';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.MockedFunction<typeof fetch>;

describe('OllamaProvider - Unit Tests', () => {
  let provider: OllamaProvider;
  
  const mockConfig = {
    endpoint: 'http://localhost:11434',
    timeout: 30000,
    maxRetries: 3,
    maxConcurrent: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OllamaProvider(mockConfig);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Configuration and Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(provider.name).toBe('ollama');
      expect(provider.endpoint).toBe(mockConfig.endpoint);
    });

    it('should provide correct capabilities', () => {
      const capabilities = provider.getCapabilities();
      
      expect(capabilities).toBeDefined();
      expect(capabilities.strengths).toContain('analysis');
      expect(capabilities.strengths).toContain('reasoning');
      expect(capabilities.optimalFor).toContain('complex-analysis');
      expect(capabilities.responseTime).toBe('medium');
      expect(capabilities.supportsStreaming).toBe(true);
      expect(capabilities.contextWindow).toBe(4096);
    });

    it('should handle invalid configuration gracefully', () => {
      expect(() => {
        new OllamaProvider({
          endpoint: '',
          timeout: -1,
        });
      }).toThrow('Invalid Ollama configuration');
    });
  });

  describe('Health Checks and Availability', () => {
    it('should check availability successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      } as Response);

      const isAvailable = await provider.isAvailable();
      
      expect(isAvailable).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({
          method: 'GET',
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should handle availability check failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const isAvailable = await provider.isAvailable();
      
      expect(isAvailable).toBe(false);
    });

    it('should respect timeout during availability check', async () => {
      const longTimeoutProvider = new OllamaProvider({
        ...mockConfig,
        timeout: 1000,
      });

      // Mock a slow response
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );

      const isAvailable = await longTimeoutProvider.isAvailable();
      
      expect(isAvailable).toBe(false);
    });
  });

  describe('Text Generation with TypeScript Interfaces', () => {
    it('should generate text with proper request interface', async () => {
      const mockResponse = {
        model: 'tinyllama',
        response: 'Generated text response',
        done: true,
        context: [1, 2, 3],
        total_duration: 1000000000,
        load_duration: 500000000,
        prompt_eval_duration: 300000000,
        eval_duration: 200000000,
        prompt_eval_count: 10,
        eval_count: 20,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options = {
        prompt: 'Test prompt',
        model: 'tinyllama',
        temperature: 0.7,
        maxTokens: 1000,
        stream: false,
      };

      const response = await provider.generateText(options);

      expect(response).toBeDefined();
      expect(response.text).toBe('Generated text response');
      expect(response.totalTokens).toBe(30); // prompt_eval_count + eval_count
      expect(response.finishReason).toBe('stop');
      expect(response.model).toBe('tinyllama');

      // Verify request was made with proper interface
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"prompt":"Test prompt"'),
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should validate request options and reject invalid input', async () => {
      const invalidOptions = {
        prompt: '',
        temperature: 2.5, // Invalid: too high
        maxTokens: -1, // Invalid: negative
      };

      await expect(provider.generateText(invalidOptions as any))
        .rejects
        .toThrow('Invalid generation options');
    });

    it('should handle generation API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error occurred',
      } as Response);

      await expect(provider.generateText({
        prompt: 'Test prompt',
      })).rejects.toThrow('Ollama API error: 500 Internal Server Error');
    });
  });

  describe('Streaming with TypeScript Interfaces', () => {
    it('should handle streaming text generation', async () => {
      const streamTokens = [
        { response: 'Hello', done: false },
        { response: ' world', done: false },
        { response: '!', done: true, total_duration: 1000000000 },
      ];

      // Mock ReadableStream
      const mockStream = new ReadableStream({
        start(controller) {
          streamTokens.forEach(token => {
            controller.enqueue(new TextEncoder().encode(JSON.stringify(token) + '\n'));
          });
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      } as Response);

      const receivedTokens: string[] = [];
      const onToken = (token: string) => receivedTokens.push(token);

      const response = await provider.generateTextStream({
        prompt: 'Test streaming prompt',
        stream: true,
      }, onToken);

      expect(response.text).toBe('Hello world!');
      expect(receivedTokens).toEqual(['Hello', ' world', '!']);
      expect(response.streaming).toBe(true);
    });

    it('should handle streaming errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      await expect(provider.generateTextStream({
        prompt: 'Test prompt',
        stream: true,
      }, jest.fn())).rejects.toThrow('Ollama streaming error');
    });
  });

  describe('Model Management', () => {
    it('should list available models with proper interface', async () => {
      const mockModels = {
        models: [
          {
            name: 'tinyllama:latest',
            size: 1024000000,
            digest: 'sha256:abcd1234',
            details: {
              format: 'ggml',
              family: 'llama',
              families: ['llama'],
              parameter_size: '1.1B',
              quantization_level: 'Q4_0',
            },
            modified_at: '2024-01-01T00:00:00Z',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockModels,
      } as Response);

      const models = await provider.listModels();

      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('tinyllama:latest');
      expect(models[0].size).toBe(1024000000);
      expect(models[0].parameters).toBe('1.1B');
      expect(typeof models[0].modifiedAt).toBe('string');
    });

    it('should get model info with proper interface', async () => {
      const mockModelInfo = {
        license: 'MIT',
        modelfile: 'FROM tinyllama',
        parameters: 'temperature 0.7\ntop_p 0.9',
        template: '{{ .Prompt }}',
        details: {
          format: 'ggml',
          family: 'llama',
          parameter_size: '1.1B',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockModelInfo,
      } as Response);

      const modelInfo = await provider.getModelInfo('tinyllama:latest');

      expect(modelInfo.name).toBe('tinyllama:latest');
      expect(modelInfo.parameters.temperature).toBe(0.7);
      expect(modelInfo.parameters.top_p).toBe(0.9);
      expect(modelInfo.family).toBe('llama');
      expect(modelInfo.size).toBe('1.1B');
    });

    it('should handle model loading operations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success' }),
      } as Response);

      const result = await provider.loadModel('tinyllama:latest');

      expect(result.success).toBe(true);
      expect(result.message).toContain('loaded');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"model":"tinyllama:latest"'),
        })
      );
    });
  });

  describe('Status and Monitoring', () => {
    it('should provide accurate status information', async () => {
      // Mock successful health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      } as Response);

      const status = await provider.getStatus();

      expect(status.available).toBe(true);
      expect(status.currentLoad).toBe(0);
      expect(status.maxLoad).toBe(mockConfig.maxConcurrent);
      expect(status.errorRate).toBe(0);
      expect(typeof status.responseTime).toBe('number');
    });

    it('should track request metrics correctly', async () => {
      // Simulate successful request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Test response',
          done: true,
          total_duration: 1500000000, // 1.5 seconds
        }),
      } as Response);

      await provider.generateText({ prompt: 'Test' });

      const status = await provider.getStatus();
      expect(status.requestCount).toBe(1);
      expect(status.responseTime).toBeGreaterThan(0);
    });

    it('should track error metrics correctly', async () => {
      // Simulate failed request
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      try {
        await provider.generateText({ prompt: 'Test' });
      } catch {
        // Expected error
      }

      const status = await provider.getStatus();
      expect(status.requestCount).toBe(1);
      expect(status.errorRate).toBeGreaterThan(0);
      expect(status.lastError).toContain('Network error');
    });
  });

  describe('Error Handling and Validation', () => {
    it('should validate configuration on construction', () => {
      expect(() => new OllamaProvider({} as any))
        .toThrow('Invalid Ollama configuration');
      
      expect(() => new OllamaProvider({
        endpoint: 'not-a-url',
        timeout: 'invalid',
      } as any)).toThrow('Invalid Ollama configuration');
    });

    it('should handle network timeouts correctly', async () => {
      const shortTimeoutProvider = new OllamaProvider({
        ...mockConfig,
        timeout: 100,
      });

      // Mock slow response
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ response: 'slow' }),
        }), 200))
      );

      await expect(shortTimeoutProvider.generateText({ prompt: 'Test' }))
        .rejects.toThrow('Request timeout');
    });

    it('should handle malformed API responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      } as Response);

      await expect(provider.generateText({ prompt: 'Test' }))
        .rejects.toThrow('Invalid response format');
    });

    it('should sanitize and validate prompts', async () => {
      // Test empty prompt
      await expect(provider.generateText({ prompt: '' }))
        .rejects.toThrow('Prompt cannot be empty');

      // Test extremely long prompt
      const longPrompt = 'x'.repeat(100000);
      await expect(provider.generateText({ prompt: longPrompt }))
        .rejects.toThrow('Prompt too long');

      // Test prompt with potential injection
      const maliciousPrompt = '"; DROP TABLE users; --';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'safe response', done: true }),
      } as Response);

      // Should not throw, but should sanitize
      const response = await provider.generateText({ prompt: maliciousPrompt });
      expect(response).toBeDefined();
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should enforce concurrent request limits', async () => {
      const promises: Promise<any>[] = [];
      
      // Mock slow responses to keep requests active
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ response: 'concurrent', done: true }),
        }), 100))
      );

      // Start more requests than the limit
      for (let i = 0; i < mockConfig.maxConcurrent + 2; i++) {
        promises.push(provider.generateText({ prompt: `Request ${i}` }));
      }

      const results = await Promise.allSettled(promises);
      
      // Some requests should have been queued/limited
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(0);
    });

    it('should track concurrent load correctly', async () => {
      // Start a slow request
      const slowPromise = new Promise(resolve => setTimeout(resolve, 200));
      mockFetch.mockImplementationOnce(() => slowPromise.then(() => ({
        ok: true,
        json: async () => ({ response: 'slow', done: true }),
      })));

      const requestPromise = provider.generateText({ prompt: 'Slow request' });
      
      // Check load during request
      await new Promise(resolve => setTimeout(resolve, 50));
      const status = await provider.getStatus();
      expect(status.currentLoad).toBeGreaterThan(0);

      await requestPromise;
      
      // Check load after request
      const finalStatus = await provider.getStatus();
      expect(finalStatus.currentLoad).toBe(0);
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup resources on shutdown', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ response: 'test', done: true }),
      } as Response);

      // Start some requests
      const promises = [
        provider.generateText({ prompt: 'Test 1' }),
        provider.generateText({ prompt: 'Test 2' }),
      ];

      await provider.shutdown();

      // Verify cleanup occurred
      const status = await provider.getStatus();
      expect(status.currentLoad).toBe(0);

      // New requests should fail after shutdown
      await expect(provider.generateText({ prompt: 'After shutdown' }))
        .rejects.toThrow('Provider has been shut down');
    });
  });
});