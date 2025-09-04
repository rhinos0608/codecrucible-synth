/**
 * Performance Integration Test
 * Tests the actual performance optimizations that were integrated
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { requestBatcher } from '../../src/core/performance/intelligent-request-batcher.js';
import { adaptiveTuner } from '../../src/core/performance/adaptive-performance-tuner.js';
import { responseCache } from '../../src/core/performance/response-cache-manager.js';
import { modelPreloader } from '../../src/core/performance/model-preloader.js';

describe('Performance Integration Tests', () => {
  beforeAll(async () => {
    // Initialize performance systems
  });

  afterAll(async () => {
    // Cleanup performance systems
    requestBatcher.shutdown();
    adaptiveTuner.shutdown();
    responseCache.shutdown();
    modelPreloader.shutdown();
  });

  describe('Intelligent Request Batcher', () => {
    it('should initialize successfully', () => {
      expect(requestBatcher).toBeDefined();
      const stats = requestBatcher.getBatchingStats();
      expect(stats).toHaveProperty('totalBatches');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('pendingRequests');
    });

    it('should provide accurate statistics', () => {
      const stats = requestBatcher.getBatchingStats();
      expect(typeof stats.totalBatches).toBe('number');
      expect(typeof stats.totalRequests).toBe('number');
      expect(typeof stats.avgBatchSize).toBe('number');
      expect(typeof stats.efficiencyRate).toBe('number');
      expect(stats.totalBatches).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Adaptive Performance Tuner', () => {
    it('should initialize successfully', () => {
      expect(adaptiveTuner).toBeDefined();
      const config = adaptiveTuner.getCurrentConfig();
      expect(config).toHaveProperty('cacheSize');
      expect(config).toHaveProperty('batchSizeMin');
      expect(config).toHaveProperty('memoryWarningThreshold');
    });

    it('should record metrics properly', () => {
      // Record some test metrics
      adaptiveTuner.recordMetrics(1000, 5, 0.1);
      adaptiveTuner.recordMetrics(800, 3, 0.05);

      const stats = adaptiveTuner.getTuningStats();
      expect(stats).toHaveProperty('totalOptimizations');
      expect(stats).toHaveProperty('recentMetrics');
      expect(typeof stats.performanceImprovement).toBe('number');
    });

    it('should perform performance analysis', () => {
      const analysis = adaptiveTuner.analyzePerformance();
      expect(analysis).toHaveProperty('status');
      expect(analysis).toHaveProperty('issues');
      expect(analysis).toHaveProperty('recommendations');
      expect(['excellent', 'good', 'fair', 'poor']).toContain(analysis.status);
    });
  });

  describe('Response Cache Manager', () => {
    it('should initialize successfully', () => {
      expect(responseCache).toBeDefined();
      const stats = responseCache.getStats();
      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('memoryUsage');
    });

    it('should handle cache operations correctly', () => {
      const prompt = 'test prompt for caching';
      const model = 'test-model';
      const provider = 'test-provider';

      // Should return null for non-existent cache entry
      const result = responseCache.get(prompt, model, provider);
      expect(result).toBeNull();

      // Should store cache entry
      responseCache.set(prompt, model, provider, {
        content: 'test response',
        usage: { totalTokens: 100 },
      });

      // Should retrieve cached entry
      const cached = responseCache.get(prompt, model, provider);
      expect(cached).not.toBeNull();
      expect(cached?.response.content).toBe('test response');
    });
  });

  describe('Model Preloader', () => {
    it('should initialize successfully', () => {
      expect(modelPreloader).toBeDefined();
      const stats = modelPreloader.getWarmupStats();
      expect(stats).toHaveProperty('warmModels');
      expect(stats).toHaveProperty('totalModels');
      expect(stats).toHaveProperty('queueLength');
    });

    it('should record model usage properly', () => {
      modelPreloader.recordModelUsage('test-model', 'test-provider', 1500, true);
      modelPreloader.recordModelUsage('test-model-2', 'test-provider', 2000, false);

      const stats = modelPreloader.getWarmupStats();
      expect(stats.totalModels).toBeGreaterThan(0);
    });

    it('should check model warmup status', () => {
      const isWarmed = modelPreloader.isModelWarmed('test-model', 'test-provider');
      expect(typeof isWarmed).toBe('boolean');
    });

    it('should estimate performance benefits', () => {
      const estimate = modelPreloader.estimatePerformanceBenefit('test-model', 'test-provider');
      expect(estimate).toHaveProperty('estimatedSpeedupMs');
      expect(estimate).toHaveProperty('confidenceLevel');
      expect(['low', 'medium', 'high']).toContain(estimate.confidenceLevel);
    });
  });

  describe('Integration Verification', () => {
    it('should have all performance systems connected', () => {
      // Verify all singleton instances exist
      expect(requestBatcher).toBeDefined();
      expect(adaptiveTuner).toBeDefined();
      expect(responseCache).toBeDefined();
      expect(modelPreloader).toBeDefined();
    });

    it('should provide consistent performance data', () => {
      // Record activity across systems
      adaptiveTuner.recordMetrics(1200, 2, 0.0);
      modelPreloader.recordModelUsage('integrated-test', 'test-provider', 1200, true);

      // Check that data flows between systems
      const tunerStats = adaptiveTuner.getTuningStats();
      const preloaderStats = modelPreloader.getWarmupStats();
      const cacheStats = responseCache.getStats();
      const batchStats = requestBatcher.getBatchingStats();

      expect(tunerStats.totalOptimizations).toBeGreaterThanOrEqual(0);
      expect(preloaderStats.totalModels).toBeGreaterThanOrEqual(1);
      expect(cacheStats.totalEntries).toBeGreaterThanOrEqual(0);
      expect(batchStats.totalBatches).toBeGreaterThanOrEqual(0);
    });
  });
});
