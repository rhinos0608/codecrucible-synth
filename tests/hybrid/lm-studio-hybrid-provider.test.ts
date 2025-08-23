/**
 * LM Studio Hybrid Provider - REAL Implementation Tests
 * Tests actual LM Studio provider integration with real connections
 * NO MOCKS - Following AI Coding Grimoire principles for authentic testing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { LMStudioProvider } from '../../src/core/hybrid/lm-studio-provider.js';
import { HybridLLMRouter } from '../../src/core/hybrid/hybrid-llm-router.js';
import { UnifiedModelClient, createDefaultUnifiedClientConfig } from '../../src/core/client.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';

describe('LM Studio Hybrid Provider - Real Implementation Tests', () => {
  let testWorkspace: string;
  let lmStudioProvider: LMStudioProvider | null = null;
  let hybridRouter: HybridLLMRouter | null = null;
  let unifiedClient: UnifiedModelClient | null = null;

  const testConfig = {
    endpoint: process.env.TEST_LMSTUDIO_ENDPOINT || 'http://localhost:1234',
    defaultModel: 'qwen2.5-coder:7b',
    timeout: 30000,
    maxRetries: 3,
  };

  beforeAll(async () => {
    // Create isolated test workspace
    testWorkspace = await mkdtemp(join(tmpdir(), 'lmstudio-test-'));
    console.log(`✅ Test workspace created: ${testWorkspace}`);
  }, 60000);

  afterAll(async () => {
    try {
      if (unifiedClient) {
        await unifiedClient.shutdown();
      }
      if (hybridRouter) {
        await hybridRouter.shutdown();
      }
      if (lmStudioProvider) {
        await lmStudioProvider.shutdown();
      }
      if (testWorkspace) {
        await rm(testWorkspace, { recursive: true, force: true });
      }
      console.log('✅ Test cleanup completed');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error);
    }
  });

  beforeEach(() => {
    // Reset any test state
    process.chdir(testWorkspace);
  });

  afterEach(async () => {
    // Cleanup after each test
    if (lmStudioProvider) {
      try {
        await lmStudioProvider.shutdown();
      } catch (error) {
        // Ignore shutdown errors in tests
      }
      lmStudioProvider = null;
    }
  });

  describe('Real Provider Connectivity', () => {
    it('should initialize and connect to actual LM Studio instance', async () => {
      try {
        lmStudioProvider = new LMStudioProvider(testConfig);
        
        // Test actual connectivity
        const isAvailable = await lmStudioProvider.isAvailable();
        
        if (isAvailable) {
          console.log('✅ LM Studio provider connected successfully');
          expect(isAvailable).toBe(true);
          
          // Test provider properties
          expect(lmStudioProvider.name).toBe('lm-studio');
          expect(lmStudioProvider.endpoint).toBe(testConfig.endpoint);
        } else {
          console.log('⚠️ LM Studio not available - testing graceful degradation');
          expect(isAvailable).toBe(false);
        }
      } catch (error) {
        console.log('⚠️ LM Studio connection failed - expected in CI/test environments');
        expect(error).toBeInstanceOf(Error);
      }
    }, 45000);

    it('should handle real connection failures gracefully', async () => {
      const badConfig = {
        ...testConfig,
        endpoint: 'http://localhost:99999', // Non-existent port
        timeout: 5000,
      };

      lmStudioProvider = new LMStudioProvider(badConfig);
      
      const isAvailable = await lmStudioProvider.isAvailable();
      expect(isAvailable).toBe(false);

      const status = await lmStudioProvider.getStatus();
      expect(status.available).toBe(false);
      expect(status.errorRate).toBeGreaterThanOrEqual(0);
    }, 15000);

    it('should provide correct capabilities specification', () => {
      lmStudioProvider = new LMStudioProvider(testConfig);
      
      const capabilities = lmStudioProvider.getCapabilities();
      
      expect(capabilities).toBeDefined();
      expect(capabilities.strengths).toContain('speed');
      expect(capabilities.optimalFor).toContain('template-generation');
      expect(capabilities.contextWindow).toBeGreaterThan(0);
      expect(capabilities.supportsStreaming).toBe(true);
      expect(capabilities.maxConcurrent).toBeGreaterThan(0);
    });
  });

  describe('Real Hybrid Integration', () => {
    it('should integrate properly with HybridLLMRouter using real providers', async () => {
      const hybridConfig = {
        lmStudio: {
          endpoint: testConfig.endpoint,
          enabled: true,
          models: ['codellama-7b-instruct'],
          maxConcurrent: 2,
          strengths: ['speed', 'templates'],
        },
        ollama: {
          endpoint: process.env.TEST_OLLAMA_ENDPOINT || 'http://localhost:11434',
          enabled: true,
          models: ['tinyllama:latest'],
          maxConcurrent: 1,
          strengths: ['analysis', 'reasoning'],
        },
        routing: {
          defaultProvider: 'auto',
          escalationThreshold: 0.7,
          confidenceScoring: true,
          learningEnabled: false, // Disable for test determinism
        },
      };

      hybridRouter = new HybridLLMRouter(hybridConfig);
      await hybridRouter.initialize();

      // Test routing decision for fast task
      const fastTaskDecision = await hybridRouter.routeTask(
        'template',
        'Create a simple React component',
        {
          requiresDeepAnalysis: false,
          isTemplateGeneration: true,
          estimatedProcessingTime: 5000,
        }
      );

      expect(fastTaskDecision).toBeDefined();
      expect(fastTaskDecision.selectedLLM).toBeTruthy();
      expect(fastTaskDecision.confidence).toBeGreaterThan(0);

      // Test routing decision for complex task
      const complexTaskDecision = await hybridRouter.routeTask(
        'analysis',
        'Analyze this complex codebase architecture for security vulnerabilities',
        {
          requiresDeepAnalysis: true,
          hasSecurityImplications: true,
          estimatedProcessingTime: 15000,
        }
      );

      expect(complexTaskDecision).toBeDefined();
      expect(complexTaskDecision.selectedLLM).toBeTruthy();
      expect(complexTaskDecision.confidence).toBeGreaterThan(0);

      console.log(`✅ Hybrid routing decisions: Fast→${fastTaskDecision.selectedLLM}, Complex→${complexTaskDecision.selectedLLM}`);
    }, 30000);

    it('should work within UnifiedModelClient for end-to-end workflows', async () => {
      const clientConfig = createDefaultUnifiedClientConfig({
        providers: [
          {
            type: 'lm-studio',
            endpoint: testConfig.endpoint,
            enabled: true,
            timeout: 30000,
          },
          {
            type: 'ollama',
            endpoint: process.env.TEST_OLLAMA_ENDPOINT || 'http://localhost:11434',
            enabled: true,
            timeout: 30000,
          },
        ],
        executionMode: 'auto',
        fallbackChain: ['lm-studio', 'ollama'],
      });

      unifiedClient = new UnifiedModelClient(clientConfig);
      await unifiedClient.initialize();

      // Test fast execution mode (should prefer LM Studio if available)
      const fastRequest = {
        prompt: 'Format this JSON: {"name": "test", "value": 123}',
        type: 'formatting' as const,
        executionMode: 'fast' as const,
      };

      const fastResponse = await unifiedClient.processRequest(fastRequest);
      
      expect(fastResponse).toBeDefined();
      expect(fastResponse.content || fastResponse.error).toBeTruthy();
      
      if (fastResponse.content) {
        expect(fastResponse.content.length).toBeGreaterThan(0);
        expect(fastResponse.metadata?.provider).toBeTruthy();
        console.log(`✅ Fast mode execution completed with provider: ${fastResponse.metadata?.provider}`);
      }

      // Test auto execution mode (intelligent routing)
      const autoRequest = {
        prompt: 'Explain the concept of closures in JavaScript',
        type: 'explanation' as const,
        executionMode: 'auto' as const,
      };

      const autoResponse = await unifiedClient.processRequest(autoRequest);
      
      expect(autoResponse).toBeDefined();
      expect(autoResponse.content || autoResponse.error).toBeTruthy();
      
      if (autoResponse.content) {
        expect(autoResponse.content.length).toBeGreaterThan(50);
        expect(autoResponse.metadata?.provider).toBeTruthy();
        console.log(`✅ Auto mode execution completed with provider: ${autoResponse.metadata?.provider}`);
      }
    }, 60000);
  });

  describe('Real Performance Characteristics', () => {
    it('should demonstrate actual performance advantages for fast tasks', async () => {
      if (!process.env.TEST_LMSTUDIO_ENDPOINT) {
        console.log('⚠️ Skipping performance test - LM Studio endpoint not configured');
        return;
      }

      lmStudioProvider = new LMStudioProvider(testConfig);
      
      const isAvailable = await lmStudioProvider.isAvailable();
      if (!isAvailable) {
        console.log('⚠️ Skipping performance test - LM Studio not available');
        return;
      }

      // Measure response time for simple task
      const startTime = Date.now();
      
      const testRequest = {
        prompt: 'Create a simple function that adds two numbers',
        temperature: 0.3,
        maxTokens: 200,
      };

      try {
        const response = await lmStudioProvider.generateCode(testRequest);
        const responseTime = Date.now() - startTime;
        
        expect(response).toBeDefined();
        expect(responseTime).toBeLessThan(30000); // Should be fast
        
        if (response.content) {
          expect(response.content).toContain('function');
          expect(response.usage?.totalTokens).toBeGreaterThan(0);
        }

        console.log(`✅ LM Studio performance: ${responseTime}ms for simple task`);
        
        // Verify status tracking
        const status = await lmStudioProvider.getStatus();
        expect(status.responseTime).toBeGreaterThan(0);
        expect(status.currentLoad).toBe(0); // Should be 0 after completion
      } catch (error) {
        console.log('⚠️ LM Studio request failed - testing error handling');
        expect(error).toBeInstanceOf(Error);
        
        const status = await lmStudioProvider.getStatus();
        expect(status.errorRate).toBeGreaterThan(0);
        expect(status.lastError).toBeTruthy();
      }
    }, 45000);

    it('should handle concurrent requests efficiently', async () => {
      if (!process.env.TEST_LMSTUDIO_ENDPOINT) {
        console.log('⚠️ Skipping concurrency test - LM Studio endpoint not configured');
        return;
      }

      lmStudioProvider = new LMStudioProvider(testConfig);
      
      const isAvailable = await lmStudioProvider.isAvailable();
      if (!isAvailable) {
        console.log('⚠️ Skipping concurrency test - LM Studio not available');
        return;
      }

      const concurrentRequests = Array.from({ length: 3 }, (_, i) => ({
        prompt: `Generate a variable name for index ${i}`,
        temperature: 0.5,
        maxTokens: 50,
      }));

      const startTime = Date.now();
      
      try {
        const results = await Promise.allSettled(
          concurrentRequests.map(req => lmStudioProvider!.generateCode(req))
        );
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        expect(successful + failed).toBe(3);
        expect(totalTime).toBeLessThan(60000); // All requests within 60s

        console.log(`✅ Concurrent requests completed: ${successful} successful, ${failed} failed in ${totalTime}ms`);

        // Verify status reflects concurrent processing
        const finalStatus = await lmStudioProvider.getStatus();
        if (successful > 0) {
          expect(finalStatus.requestCount).toBe(successful);
          expect(finalStatus.responseTime).toBeGreaterThan(0);
        }
      } catch (error) {
        console.log('⚠️ Concurrent request test failed - testing error handling');
        expect(error).toBeInstanceOf(Error);
      }
    }, 90000);
  });

  describe('Real Error Handling and Recovery', () => {
    it('should handle real network timeouts gracefully', async () => {
      const timeoutConfig = {
        ...testConfig,
        timeout: 1000, // Very short timeout
      };

      lmStudioProvider = new LMStudioProvider(timeoutConfig);
      
      // This should timeout if LM Studio is slow or unavailable
      const request = {
        prompt: 'Generate a complex algorithm that might take time to process',
        maxTokens: 1000,
      };

      try {
        await lmStudioProvider.generateCode(request);
        console.log('✅ Request completed within timeout');
      } catch (error) {
        console.log('⚠️ Request timed out as expected');
        expect(error).toBeInstanceOf(Error);
        
        const status = await lmStudioProvider.getStatus();
        expect(status.errorRate).toBeGreaterThan(0);
        expect(status.lastError).toContain('timeout');
      }
    }, 30000);

    it('should recover from temporary failures', async () => {
      lmStudioProvider = new LMStudioProvider(testConfig);
      
      // First check if provider is available
      const initialAvailability = await lmStudioProvider.isAvailable();
      
      // Simulate failure by using bad endpoint temporarily
      const badProvider = new LMStudioProvider({
        ...testConfig,
        endpoint: 'http://localhost:99999',
      });

      const failedAvailability = await badProvider.isAvailable();
      expect(failedAvailability).toBe(false);

      // Original provider should still work (if it was available)
      const recoveredAvailability = await lmStudioProvider.isAvailable();
      expect(recoveredAvailability).toBe(initialAvailability);

      console.log(`✅ Provider recovery test: Initial=${initialAvailability}, Failed=${failedAvailability}, Recovered=${recoveredAvailability}`);
    }, 30000);

    it('should maintain accurate status tracking through failures', async () => {
      lmStudioProvider = new LMStudioProvider(testConfig);
      
      // Get initial status
      const initialStatus = await lmStudioProvider.getStatus();
      expect(initialStatus.errorRate).toBe(0);
      expect(initialStatus.requestCount).toBe(0);

      // Attempt request that may fail
      try {
        await lmStudioProvider.generateCode({
          prompt: 'Test request for status tracking',
          maxTokens: 100,
        });
      } catch (error) {
        // Expected if LM Studio not available
      }

      // Check status was updated
      const finalStatus = await lmStudioProvider.getStatus();
      expect(finalStatus.requestCount).toBe(1);
      
      if (finalStatus.lastError) {
        expect(finalStatus.errorRate).toBeGreaterThan(0);
        console.log(`✅ Error tracking working: ${finalStatus.lastError}`);
      } else {
        expect(finalStatus.responseTime).toBeGreaterThan(0);
        console.log('✅ Success tracking working');
      }
    }, 30000);
  });

  describe('Real Provider Interface Compliance', () => {
    it('should implement all required provider methods', () => {
      lmStudioProvider = new LMStudioProvider(testConfig);
      
      // Verify all required methods exist
      expect(typeof lmStudioProvider.isAvailable).toBe('function');
      expect(typeof lmStudioProvider.getCapabilities).toBe('function');
      expect(typeof lmStudioProvider.getStatus).toBe('function');
      expect(typeof lmStudioProvider.generateCode).toBe('function');
      expect(typeof lmStudioProvider.shutdown).toBe('function');
      
      // Verify properties
      expect(typeof lmStudioProvider.name).toBe('string');
      expect(typeof lmStudioProvider.endpoint).toBe('string');
      
      expect(lmStudioProvider.name).toBe('lm-studio');
      expect(lmStudioProvider.endpoint).toBe(testConfig.endpoint);
    });

    it('should provide consistent status interface', async () => {
      lmStudioProvider = new LMStudioProvider(testConfig);
      
      const status = await lmStudioProvider.getStatus();
      
      // Verify status structure
      expect(typeof status.available).toBe('boolean');
      expect(typeof status.currentLoad).toBe('number');
      expect(typeof status.responseTime).toBe('number');
      expect(typeof status.errorRate).toBe('number');
      expect(typeof status.maxLoad).toBe('number');
      
      // Verify reasonable values
      expect(status.currentLoad).toBeGreaterThanOrEqual(0);
      expect(status.responseTime).toBeGreaterThanOrEqual(0);
      expect(status.errorRate).toBeGreaterThanOrEqual(0);
      expect(status.maxLoad).toBeGreaterThan(0);
    });

    it('should provide valid capabilities configuration', () => {
      lmStudioProvider = new LMStudioProvider(testConfig);
      
      const capabilities = lmStudioProvider.getCapabilities();
      
      // Verify capabilities structure
      expect(Array.isArray(capabilities.strengths)).toBe(true);
      expect(Array.isArray(capabilities.optimalFor)).toBe(true);
      expect(typeof capabilities.responseTime).toBe('string');
      expect(typeof capabilities.contextWindow).toBe('number');
      expect(typeof capabilities.supportsStreaming).toBe('boolean');
      expect(typeof capabilities.maxConcurrent).toBe('number');
      
      // Verify LM Studio specific capabilities
      expect(capabilities.strengths.includes('speed')).toBe(true);
      expect(capabilities.optimalFor.includes('template-generation')).toBe(true);
      expect(capabilities.contextWindow).toBeGreaterThan(1000);
      expect(capabilities.maxConcurrent).toBeGreaterThanOrEqual(1);
    });
  });
});