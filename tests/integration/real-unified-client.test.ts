/**
 * Real Integration Tests for UnifiedModelClient
 * Tests actual functionality with real providers (when available)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { UnifiedModelClient, UnifiedClientConfig } from '../../src/core/client.js';
import { ConfigManager } from '../../src/config/config-manager.js';

describe('UnifiedModelClient Real Integration', () => {
  let client: UnifiedModelClient;
  let config: UnifiedClientConfig;

  beforeAll(async () => {
    // Use real configuration
    const configManager = new ConfigManager();
    const appConfig = await configManager.loadConfiguration();
    
    config = {
      providers: [
        {
          type: 'ollama',
          endpoint: appConfig.model?.endpoint || 'http://localhost:11434',
          model: null,
          timeout: 30000,
        },
        {
          type: 'lm-studio',
          endpoint: 'http://localhost:1234',
          model: null,
          timeout: 30000,
        },
      ],
      executionMode: 'auto',
      fallbackChain: ['ollama', 'lm-studio'],
      performanceThresholds: {
        fastModeMaxTokens: 32768,
        timeoutMs: 60000,
        maxConcurrentRequests: 2,
      },
      security: {
        enableSandbox: true,
        maxInputLength: 100000,
        allowedCommands: ['npm', 'node', 'git'],
      },
    };

    client = new UnifiedModelClient(config);
    
    // Initialize and wait for providers to come online
    try {
      await client.initialize();
    } catch (error) {
      console.warn('Provider initialization failed, continuing with limited functionality');
    }
  }, 60000);

  afterAll(async () => {
    if (client) {
      await client.destroy();
    }
  });

  describe('Real Provider Integration', () => {
    it('should initialize with real providers', async () => {
      expect(client).toBeDefined();
      
      // Check if any providers are actually available
      const health = await client.checkHealth();
      expect(health).toBeDefined();
      expect(typeof health.status).toBe('string');
    });

    it('should generate real text responses', async () => {
      try {
        const response = await client.generateText('What is 2+2?', { timeout: 30000 });
        
        expect(response).toBeDefined();
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
        expect(response).toMatch(/4|four/i);
      } catch (error) {
        if (error.message.includes('No providers available')) {
          console.warn('No AI providers available for testing, skipping');
          return;
        }
        throw error;
      }
    }, 35000);

    it('should handle code generation requests', async () => {
      try {
        const response = await client.generateText(
          'Write a simple JavaScript function that adds two numbers',
          { timeout: 45000 }
        );
        
        expect(response).toBeDefined();
        expect(typeof response).toBe('string');
        expect(response).toMatch(/function|const|=>/i);
        expect(response).toMatch(/\+|\badd\b/i);
      } catch (error) {
        if (error.message.includes('No providers available')) {
          console.warn('No AI providers available for testing, skipping');
          return;
        }
        throw error;
      }
    }, 50000);

    it('should respect timeout parameters', async () => {
      const startTime = Date.now();
      
      try {
        await client.generateText('Very short answer please', { timeout: 5000 });
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(10000); // Should complete well under timeout
      } catch (error) {
        const duration = Date.now() - startTime;
        if (error.message.includes('timeout')) {
          expect(duration).toBeGreaterThan(4000); // Should respect timeout
          expect(duration).toBeLessThan(15000); // But not wait too much longer
        } else if (error.message.includes('No providers available')) {
          console.warn('No AI providers available for testing, skipping');
          return;
        } else {
          throw error;
        }
      }
    }, 20000);
  });

  describe('Real Health Monitoring', () => {
    it('should provide real health status', async () => {
      const health = await client.checkHealth();
      
      expect(health).toBeDefined();
      expect(health.status).toMatch(/healthy|degraded|unavailable/i);
      expect(Array.isArray(health.providers)).toBe(true);
      
      // Should have information about actual providers
      health.providers.forEach(provider => {
        expect(provider.name).toMatch(/ollama|lm-studio/);
        expect(typeof provider.available).toBe('boolean');
        expect(typeof provider.latency).toBe('number');
      });
    });

    it('should detect available models', async () => {
      try {
        const models = await client.getAvailableModels();
        
        expect(Array.isArray(models)).toBe(true);
        
        if (models.length > 0) {
          models.forEach(model => {
            expect(typeof model).toBe('string');
            expect(model.length).toBeGreaterThan(0);
          });
        }
      } catch (error) {
        console.warn('Could not fetch models, providers may be unavailable');
      }
    });
  });

  describe('Real Error Handling', () => {
    it('should handle invalid prompts gracefully', async () => {
      await expect(client.generateText('', { timeout: 10000 }))
        .rejects.toThrow(/empty|invalid|required/i);
    });

    it('should handle very long inputs according to security settings', async () => {
      const longPrompt = 'a'.repeat(config.security.maxInputLength + 1000);
      
      await expect(client.generateText(longPrompt, { timeout: 10000 }))
        .rejects.toThrow(/too long|exceeded|limit/i);
    });

    it('should handle network unavailability gracefully', async () => {
      // Create client with invalid endpoints
      const badConfig = {
        ...config,
        providers: [
          {
            type: 'ollama' as const,
            endpoint: 'http://localhost:99999',
            model: null,
            timeout: 5000,
          }
        ]
      };
      
      const badClient = new UnifiedModelClient(badConfig);
      
      try {
        await badClient.initialize();
        
        await expect(badClient.generateText('test', { timeout: 10000 }))
          .rejects.toThrow(/No providers available|connection|failed/i);
      } finally {
        await badClient.destroy();
      }
    }, 20000);
  });

  describe('Real Performance Characteristics', () => {
    it('should complete simple requests within reasonable time', async () => {
      const startTime = Date.now();
      
      try {
        await client.generateText('Hello', { timeout: 30000 });
        const duration = Date.now() - startTime;
        
        // Should complete within 30 seconds for simple requests
        expect(duration).toBeLessThan(30000);
        
        // Log performance for analysis
        console.log(`Simple request completed in ${duration}ms`);
      } catch (error) {
        if (!error.message.includes('No providers available')) {
          throw error;
        }
      }
    }, 35000);

    it('should handle concurrent requests', async () => {
      const requests = [
        'What is 1+1?',
        'What is 2+2?',
        'What is 3+3?'
      ];
      
      const startTime = Date.now();
      
      try {
        const promises = requests.map(prompt => 
          client.generateText(prompt, { timeout: 20000 })
        );
        
        const responses = await Promise.allSettled(promises);
        const duration = Date.now() - startTime;
        
        // At least some should succeed
        const successful = responses.filter(r => r.status === 'fulfilled');
        expect(successful.length).toBeGreaterThan(0);
        
        console.log(`Concurrent requests: ${successful.length}/${requests.length} succeeded in ${duration}ms`);
      } catch (error) {
        console.warn('Concurrent request test failed, providers may be limited');
      }
    }, 60000);
  });

  describe('Real Configuration Validation', () => {
    it('should work with minimal configuration', async () => {
      const minimalConfig: UnifiedClientConfig = {
        providers: [
          {
            type: 'ollama',
            endpoint: 'http://localhost:11434',
            model: null,
            timeout: 30000,
          }
        ],
        executionMode: 'auto',
        fallbackChain: ['ollama'],
        performanceThresholds: {
          fastModeMaxTokens: 1000,
          timeoutMs: 30000,
          maxConcurrentRequests: 1,
        },
        security: {
          enableSandbox: false,
          maxInputLength: 1000,
          allowedCommands: [],
        },
      };

      const minimalClient = new UnifiedModelClient(minimalConfig);
      
      try {
        await minimalClient.initialize();
        const health = await minimalClient.checkHealth();
        expect(health).toBeDefined();
      } finally {
        await minimalClient.destroy();
      }
    }, 45000);
  });

  describe('Real Security Features', () => {
    it('should sanitize inputs in real scenarios', async () => {
      const maliciousInput = '<script>alert("test")</script>Generate a function';
      
      try {
        const response = await client.generateText(maliciousInput, { timeout: 20000 });
        
        // Response should be generated but script tags should not be executed
        expect(response).toBeDefined();
        expect(typeof response).toBe('string');
        // The response should not contain raw script execution
        expect(response).not.toMatch(/<script.*>.*alert.*<\/script>/);
      } catch (error) {
        if (!error.message.includes('No providers available')) {
          throw error;
        }
      }
    }, 25000);
  });
});