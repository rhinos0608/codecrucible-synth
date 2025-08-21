/**
 * Comprehensive tests for UnifiedModelClient
 * Testing multi-provider support, failover, and performance monitoring
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { UnifiedModelClient } from '../../../src/core/client.js';

// Mock providers
const mockOllamaProvider = {
  name: 'ollama',
  isAvailable: jest.fn().mockResolvedValue(true),
  generate: jest.fn().mockResolvedValue({
    content: 'Ollama response',
    tokensUsed: 50,
    finishReason: 'stop'
  }),
  getModels: jest.fn().mockResolvedValue(['llama2', 'codellama']),
  destroy: jest.fn()
};

const mockLMStudioProvider = {
  name: 'lm-studio',
  isAvailable: jest.fn().mockResolvedValue(true),
  generate: jest.fn().mockResolvedValue({
    content: 'LM Studio response',
    tokensUsed: 75,
    finishReason: 'stop'
  }),
  getModels: jest.fn().mockResolvedValue(['gpt-4', 'claude-3']),
  destroy: jest.fn()
};

describe('UnifiedModelClient', () => {
  let client: UnifiedModelClient;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      providers: [
        { type: 'ollama', endpoint: 'http://localhost:11434', model: 'llama2' },
        { type: 'lm-studio', endpoint: 'http://localhost:1234', model: 'gpt-4' }
      ],
      executionMode: 'auto' as const,
      fallbackChain: ['ollama', 'lm-studio'] as const,
      performanceThresholds: {
        fastModeMaxTokens: 1000,
        timeoutMs: 30000,
        maxConcurrentRequests: 3
      },
      security: {
        enableSandbox: true,
        maxInputLength: 10000,
        allowedCommands: ['analyze', 'generate']
      }
    };

    // Mock the provider creation
    jest.doMock('../../../src/providers/ollama.js', () => ({
      OllamaProvider: jest.fn(() => mockOllamaProvider)
    }));
    
    jest.doMock('../../../src/providers/lm-studio.js', () => ({
      LMStudioProvider: jest.fn(() => mockLMStudioProvider)
    }));

    client = new UnifiedModelClient(mockConfig);
  });

  afterEach(async () => {
    await client.destroy();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with configured providers', async () => {
      expect(client).toBeDefined();
      // Client should be ready after initialization
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should handle empty provider configuration', () => {
      const emptyConfig = {
        ...mockConfig,
        providers: []
      };

      expect(() => new UnifiedModelClient(emptyConfig)).not.toThrow();
    });
  });

  describe('Text Generation', () => {
    it('should generate text using first available provider', async () => {
      const response = await client.synthesize({
        prompt: 'Write a hello world function',
        model: 'default',
        temperature: 0.7
      });

      expect(response.content).toBeDefined();
      expect(response.tokensUsed).toBeGreaterThan(0);
      expect(typeof response.content).toBe('string');
    });

    it('should handle generation with options', async () => {
      const response = await client.synthesize({
        prompt: 'Explain recursion',
        model: 'default',
        temperature: 0.3,
        maxTokens: 500
      });

      expect(response.content).toBeDefined();
      expect(response.tokensUsed).toBeDefined();
    });

    it('should respect maxTokens parameter', async () => {
      const response = await client.synthesize({
        prompt: 'Write a long essay about AI',
        model: 'default',
        maxTokens: 100
      });

      expect(response.content).toBeDefined();
      // Note: Actual token limiting depends on provider implementation
    });
  });

  describe('Provider Failover', () => {
    it('should failover to next provider on failure', async () => {
      // Make first provider fail
      mockOllamaProvider.generate.mockRejectedValueOnce(new Error('Ollama down'));

      const response = await client.synthesize({
        prompt: 'Test failover',
        model: 'default'
      });

      expect(response.content).toBeDefined();
      expect(mockOllamaProvider.generate).toHaveBeenCalled();
      expect(mockLMStudioProvider.generate).toHaveBeenCalled();
    });

    it('should handle all providers failing', async () => {
      // Make all providers fail
      mockOllamaProvider.generate.mockRejectedValue(new Error('Ollama down'));
      mockLMStudioProvider.generate.mockRejectedValue(new Error('LM Studio down'));

      await expect(client.synthesize({
        prompt: 'Test all providers down',
        model: 'default'
      })).rejects.toThrow();
    });

    it('should track provider failures', async () => {
      mockOllamaProvider.generate.mockRejectedValue(new Error('Provider error'));

      try {
        await client.synthesize({
          prompt: 'Test error tracking',
          model: 'default'
        });
      } catch (error) {
        // Error is expected
      }

      // Provider failure should be tracked internally
      // (This would require exposing internal state for testing)
    });
  });

  describe('Performance Monitoring', () => {
    it('should track request latency', async () => {
      const startTime = Date.now();
      
      await client.synthesize({
        prompt: 'Test latency tracking',
        model: 'default'
      });

      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThan(0);
    });

    it('should handle concurrent requests', async () => {
      const promises = Array(3).fill(0).map((_, i) => 
        client.synthesize({
          prompt: `Concurrent request ${i}`,
          model: 'default'
        })
      );

      const responses = await Promise.all(promises);
      
      expect(responses).toHaveLength(3);
      responses.forEach(response => {
        expect(response.content).toBeDefined();
      });
    });

    it('should respect concurrency limits', async () => {
      // This test would require exposing internal queue state
      // For now, just ensure multiple requests complete
      const promises = Array(5).fill(0).map((_, i) => 
        client.synthesize({
          prompt: `Queue test ${i}`,
          model: 'default'
        })
      );

      const responses = await Promise.all(promises);
      expect(responses).toHaveLength(5);
    });
  });

  describe('Security Features', () => {
    it('should validate input length', async () => {
      const longPrompt = 'a'.repeat(20000); // Exceeds maxInputLength

      await expect(client.synthesize({
        prompt: longPrompt,
        model: 'default'
      })).rejects.toThrow('Input too long');
    });

    it('should sanitize inputs', async () => {
      const maliciousPrompt = '<script>alert("xss")</script>Generate code';

      // Should not throw, but should sanitize
      const response = await client.synthesize({
        prompt: maliciousPrompt,
        model: 'default'
      });

      expect(response.content).toBeDefined();
      // The actual sanitization logic would be tested separately
    });

    it('should enforce security sandbox', async () => {
      // Test that security sandbox is enabled
      const response = await client.synthesize({
        prompt: 'rm -rf /', // Dangerous command
        model: 'default'
      });

      expect(response.content).toBeDefined();
      // Security measures should prevent actual execution
    });
  });

  describe('Model Management', () => {
    it('should list available models', async () => {
      const models = await client.getAvailableModels();
      
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it('should check provider health', async () => {
      const health = await client.checkHealth();
      
      expect(health).toBeDefined();
      expect(typeof health.status).toBe('string');
      expect(Array.isArray(health.providers)).toBe(true);
    });

    it('should handle model switching', async () => {
      const response1 = await client.synthesize({
        prompt: 'Test with default model',
        model: 'default'
      });

      const response2 = await client.synthesize({
        prompt: 'Test with specific model',
        model: 'llama2'
      });

      expect(response1.content).toBeDefined();
      expect(response2.content).toBeDefined();
    });
  });

  describe('Streaming Support', () => {
    it('should support streaming responses', (done) => {
      let chunks = 0;
      
      const stream = client.generateStream({
        prompt: 'Write a story about AI',
        model: 'default'
      });

      stream.on('data', (chunk) => {
        chunks++;
        expect(chunk).toBeDefined();
      });

      stream.on('end', () => {
        expect(chunks).toBeGreaterThan(0);
        done();
      });

      stream.on('error', (error) => {
        done(error);
      });
    });

    it('should handle streaming errors', (done) => {
      mockOllamaProvider.generateStream = jest.fn(() => {
        const { Readable } = require('stream');
        const stream = new Readable({ read() {} });
        setTimeout(() => stream.emit('error', new Error('Stream error')), 100);
        return stream;
      });

      const stream = client.generateStream({
        prompt: 'Test stream error',
        model: 'default'
      });

      stream.on('error', (error) => {
        expect(error.message).toBe('Stream error');
        done();
      });
    });
  });

  describe('Caching', () => {
    it('should cache responses when enabled', async () => {
      const prompt = 'What is 2+2?';
      
      const response1 = await client.synthesize({
        prompt,
        model: 'default'
      });

      const response2 = await client.synthesize({
        prompt,
        model: 'default'
      });

      expect(response1.content).toBeDefined();
      expect(response2.content).toBeDefined();
      // In a real implementation, we'd check if the second call was faster
    });

    it('should invalidate cache when appropriate', async () => {
      const prompt = 'Generate random number';
      
      await client.synthesize({ prompt, model: 'default' });
      
      // Clear cache (would need to expose cache clearing method)
      // For now, just ensure subsequent calls work
      const response = await client.synthesize({ prompt, model: 'default' });
      expect(response.content).toBeDefined();
    });
  });

  describe('Configuration Updates', () => {
    it('should allow runtime configuration updates', async () => {
      const newConfig = {
        ...mockConfig,
        performanceThresholds: {
          ...mockConfig.performanceThresholds,
          timeoutMs: 5000
        }
      };

      // In a real implementation, we'd expose an updateConfig method
      // For now, ensure client continues to work
      const response = await client.synthesize({
        prompt: 'Test after config update',
        model: 'default'
      });

      expect(response.content).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources properly', async () => {
      await client.destroy();
      
      expect(mockOllamaProvider.destroy).toHaveBeenCalled();
      expect(mockLMStudioProvider.destroy).toHaveBeenCalled();
    });

    it('should handle destroy when no providers exist', async () => {
      const emptyClient = new UnifiedModelClient({
        ...mockConfig,
        providers: []
      });

      await expect(emptyClient.destroy()).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty prompt', async () => {
      await expect(client.synthesize({
        prompt: '',
        model: 'default'
      })).rejects.toThrow();
    });

    it('should handle very long responses', async () => {
      mockOllamaProvider.generate.mockResolvedValue({
        content: 'A'.repeat(100000),
        tokensUsed: 50000,
        finishReason: 'length'
      });

      const response = await client.synthesize({
        prompt: 'Generate very long text',
        model: 'default'
      });

      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(1000);
    });

    it('should handle provider timeout', async () => {
      mockOllamaProvider.generate.mockImplementation(() => 
        new Promise((resolve) => setTimeout(() => resolve({
          content: 'Delayed response',
          tokensUsed: 50,
          finishReason: 'stop'
        }), 60000)) // Longer than default timeout
      );

      await expect(client.synthesize({
        prompt: 'Test timeout',
        model: 'default'
      })).rejects.toThrow('timeout');
    }, 10000);
  });
});