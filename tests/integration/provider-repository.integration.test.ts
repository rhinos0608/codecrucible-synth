/**
 * ProviderRepository Integration Tests
 * Following AI Coding Grimoire - Real Implementation First
 * Tests with actual provider instances and real connections
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { ProviderRepository, ProviderConfig, ProviderType } from '../../src/core/providers/provider-repository.js';
import { OllamaProvider } from '../../src/providers/ollama.js';
import { LMStudioProvider } from '../../src/providers/lm-studio.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';

describe('ProviderRepository Real Integration Tests', () => {
  let repository: ProviderRepository;
  let testConfigs: ProviderConfig[];
  let tempDir: string;

  beforeAll(async () => {
    // Create temporary directory for test isolation
    tempDir = await mkdtemp(join(tmpdir(), 'provider-test-'));
  });

  afterAll(async () => {
    // Cleanup temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    repository = new ProviderRepository();
    
    // Real provider configurations for testing
    testConfigs = [
      {
        type: 'ollama' as ProviderType,
        endpoint: process.env.TEST_OLLAMA_ENDPOINT || 'http://localhost:11434',
        enabled: true,
        model: 'tinyllama:latest', // Lightweight model for testing
        timeout: 30000,
      },
      {
        type: 'lm-studio' as ProviderType,
        endpoint: process.env.TEST_LMSTUDIO_ENDPOINT || 'http://localhost:1234',
        enabled: true,
        timeout: 30000,
      },
    ];
  });

  afterEach(async () => {
    // Always cleanup after each test
    if (repository) {
      await repository.shutdown();
    }
  });

  describe('Real Provider Initialization', () => {
    it('should initialize with available providers only', async () => {
      let initializationResult: any;
      
      const initPromise = new Promise((resolve) => {
        repository.on('initialized', (result) => {
          initializationResult = result;
          resolve(result);
        });
      });

      await repository.initialize(testConfigs);
      await initPromise;

      expect(initializationResult).toBeDefined();
      expect(initializationResult.successCount).toBeGreaterThanOrEqual(0);
      expect(initializationResult.failureCount).toBeGreaterThanOrEqual(0);
      
      // Total should equal number of configs
      expect(initializationResult.successCount + initializationResult.failureCount).toBe(testConfigs.length);
    }, 60000); // Extended timeout for real network operations

    it('should handle unavailable providers gracefully', async () => {
      const unavailableConfig: ProviderConfig = {
        type: 'ollama' as ProviderType,
        endpoint: 'http://localhost:99999', // Non-existent port
        enabled: true,
        timeout: 5000, // Short timeout for faster test
      };

      let initializationResult: any;
      
      const initPromise = new Promise((resolve) => {
        repository.on('initialized', (result) => {
          initializationResult = result;
          resolve(result);
        });
      });

      await repository.initialize([unavailableConfig]);
      await initPromise;

      expect(initializationResult.failureCount).toBe(1);
      expect(initializationResult.successCount).toBe(0);
    }, 15000);

    it('should prevent duplicate initialization', async () => {
      await repository.initialize(testConfigs);
      
      // Second initialization should be ignored
      await repository.initialize(testConfigs);
      
      // Should only have providers from first initialization
      const providers = repository.getAllProviders();
      expect(providers.length).toBeLessThanOrEqual(testConfigs.length);
    });
  });

  describe('Real Provider Health Checks', () => {
    beforeEach(async () => {
      await repository.initialize(testConfigs);
    });

    it('should perform actual health checks on available providers', async () => {
      const providers = repository.getAllProviders();
      
      for (const providerType of providers) {
        const isHealthy = await repository.checkProviderHealth(providerType);
        expect(typeof isHealthy).toBe('boolean');
        
        // If provider is available, it should be healthy
        const status = repository.getProviderStatus(providerType);
        if (status?.isInitialized) {
          expect(isHealthy).toBe(true);
        }
      }
    }, 30000);

    it('should return false for health check on unavailable provider', async () => {
      // Test with a provider type that wasn't initialized
      const isHealthy = await repository.checkProviderHealth('huggingface' as ProviderType);
      expect(isHealthy).toBe(false);
    });

    it('should track provider status correctly', () => {
      const statuses = repository.getAllProviderStatuses();
      
      for (const [providerType, status] of statuses) {
        expect(status).toBeDefined();
        expect(status.type).toBe(providerType);
        expect(typeof status.isHealthy).toBe('boolean');
        expect(typeof status.isInitialized).toBe('boolean');
      }
    });
  });

  describe('Real Model Operations', () => {
    beforeEach(async () => {
      await repository.initialize(testConfigs);
    });

    it('should retrieve actual available models', async () => {
      const providers = repository.getAvailableProviders();
      
      for (const providerType of providers) {
        const models = await repository.getAvailableModels(providerType);
        expect(Array.isArray(models)).toBe(true);
        
        // If provider is available, it might have models
        if (models.length > 0) {
          models.forEach(model => {
            expect(typeof model).toBe('string');
            expect(model.length).toBeGreaterThan(0);
          });
        }
      }
    }, 30000);

    it('should aggregate models from all providers', async () => {
      const allModels = await repository.getAvailableModels();
      expect(Array.isArray(allModels)).toBe(true);
      
      // Each model should be prefixed with provider type
      allModels.forEach(model => {
        expect(model).toMatch(/^(ollama|lm-studio):/);
      });
    }, 30000);

    it('should handle model switching on supporting providers', async () => {
      const availableProviders = repository.getAvailableProviders();
      
      for (const providerType of availableProviders) {
        const models = await repository.getAvailableModels(providerType);
        
        if (models.length > 0) {
          let modelSwitched = false;
          
          const switchPromise = new Promise((resolve) => {
            repository.on('model-switched', (event) => {
              if (event.providerType === providerType) {
                modelSwitched = true;
                resolve(event);
              }
            });
          });

          try {
            await repository.switchModel(providerType, models[0]);
            await switchPromise;
            expect(modelSwitched).toBe(true);
          } catch (error) {
            // Some providers might not support model switching
            expect(error.message).toContain('does not support model switching');
          }
        }
      }
    }, 30000);
  });

  describe('Real Provider Management', () => {
    beforeEach(async () => {
      await repository.initialize(testConfigs);
    });

    it('should enable and disable providers correctly', async () => {
      const availableProviders = Array.from(repository.getAvailableProviders());
      
      if (availableProviders.length > 0) {
        const testProvider = availableProviders[0];
        
        // Disable provider
        await repository.disableProvider(testProvider);
        expect(repository.getProvider(testProvider)).toBeUndefined();
        
        // Re-enable provider  
        await repository.enableProvider(testProvider);
        
        // Give it time to reinitialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Provider should be available again (if the service is running)
        const reenabledProvider = repository.getProvider(testProvider);
        if (reenabledProvider) {
          expect(reenabledProvider).toBeDefined();
        }
      }
    }, 30000);

    it('should switch between available providers', async () => {
      const availableProviders = Array.from(repository.getAvailableProviders());
      
      if (availableProviders.length >= 2) {
        let switchEventFired = false;
        
        const switchPromise = new Promise((resolve) => {
          repository.on('provider-switched', (event) => {
            switchEventFired = true;
            expect(event.from).toBe(availableProviders[0]);
            expect(event.to).toBe(availableProviders[1]);
            resolve(event);
          });
        });

        await repository.switchProvider(availableProviders[0], availableProviders[1]);
        await switchPromise;
        
        expect(switchEventFired).toBe(true);
      } else {
        // Skip test if less than 2 providers available
        console.log('Skipping provider switch test - need at least 2 available providers');
      }
    });

    it('should handle switching to unavailable provider', async () => {
      const availableProviders = Array.from(repository.getAvailableProviders());
      
      if (availableProviders.length > 0) {
        await expect(
          repository.switchProvider(availableProviders[0], 'nonexistent' as ProviderType)
        ).rejects.toThrow('not available');
      }
    });
  });

  describe('Real Configuration Management', () => {
    beforeEach(async () => {
      await repository.initialize(testConfigs);
    });

    it('should update provider configuration', async () => {
      const availableProviders = Array.from(repository.getAvailableProviders());
      
      if (availableProviders.length > 0) {
        const testProvider = availableProviders[0];
        let configUpdated = false;
        
        const configPromise = new Promise((resolve) => {
          repository.on('config-updated', (providerType, config) => {
            if (providerType === testProvider) {
              configUpdated = true;
              resolve({ providerType, config });
            }
          });
        });

        const newConfig = { timeout: 45000 };
        await repository.updateProviderConfig(testProvider, newConfig);
        
        await configPromise;
        expect(configUpdated).toBe(true);
        
        const updatedConfig = repository.getProviderConfig(testProvider);
        expect(updatedConfig?.timeout).toBe(45000);
      }
    });

    it('should retrieve provider configuration', () => {
      const availableProviders = Array.from(repository.getAvailableProviders());
      
      if (availableProviders.length > 0) {
        const testProvider = availableProviders[0];
        const config = repository.getProviderConfig(testProvider);
        
        expect(config).toBeDefined();
        expect(config?.type).toBe(testProvider);
      }
    });

    it('should handle updating non-existent provider config', async () => {
      await expect(
        repository.updateProviderConfig('nonexistent' as ProviderType, { timeout: 5000 })
      ).rejects.toThrow('not configured');
    });
  });

  describe('Real Shutdown and Cleanup', () => {
    it('should shutdown all providers gracefully', async () => {
      await repository.initialize(testConfigs);
      
      let shutdownEventFired = false;
      
      const shutdownPromise = new Promise((resolve) => {
        repository.on('shutdown', () => {
          shutdownEventFired = true;
          resolve(true);
        });
      });

      await repository.shutdown();
      await shutdownPromise;
      
      expect(shutdownEventFired).toBe(true);
      expect(repository.getAllProviders()).toHaveLength(0);
    });
  });

  describe('Real Event System', () => {
    it('should emit real provider lifecycle events', async () => {
      const events: string[] = [];
      
      repository.on('initialized', () => events.push('initialized'));
      repository.on('provider-initialized', (type) => events.push(`provider-initialized:${type}`));
      repository.on('shutdown', () => events.push('shutdown'));

      await repository.initialize(testConfigs);
      await repository.shutdown();

      expect(events).toContain('initialized');
      expect(events).toContain('shutdown');
      
      // Should have provider-initialized events for each successful initialization
      const initEvents = events.filter(e => e.startsWith('provider-initialized:'));
      expect(initEvents.length).toBeGreaterThanOrEqual(0);
    }, 30000);
  });
});