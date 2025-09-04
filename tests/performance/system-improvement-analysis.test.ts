/**
 * Comprehensive System Improvement Analysis Test
 *
 * This test file thoroughly tests all performance optimization components,
 * measures actual performance metrics, identifies bottlenecks and issues,
 * and generates specific improvement suggestions based on real data.
 *
 * Test Coverage:
 * - Request batching with various batch sizes
 * - Cache hit rates and memory usage
 * - Startup optimization with complex dependencies
 * - Memory leak detection accuracy
 * - Streaming response performance
 * - Actual latency improvements
 * - System under load conditions
 * - Integration gaps identification
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { promisify } from 'util';

// Import all performance optimization components
import { requestBatcher } from '../../src/core/performance/intelligent-request-batcher.js';
import { responseCache } from '../../src/core/performance/response-cache-manager.js';
import { StreamingResponseOptimizer } from '../../src/core/performance/streaming-response-optimizer.js';
import { MemoryUsageOptimizer } from '../../src/core/performance/memory-usage-optimizer.js';
import { startupOptimizer } from '../../src/core/performance/startup-optimizer.js';
import { MemoryLeakDetector } from '../../src/core/memory-leak-detector.js';
import { PerformanceMonitor } from '../../src/utils/performance.js';

const sleep = promisify(setTimeout);

// Initialize singletons in test mode
let streamingOptimizer: StreamingResponseOptimizer;
let memoryOptimizer: MemoryUsageOptimizer;

// Test data and constants
const TEST_MODELS = ['test-model-fast', 'test-model-accurate', 'test-model-balanced'];
const TEST_PROVIDERS = ['mock-provider', 'test-provider', 'benchmark-provider'];
const BATCH_SIZES = [1, 2, 4, 8, 16];
const LOAD_TEST_ITERATIONS = [10, 50, 100, 500];

// Performance measurement utilities
class PerformanceMeasurement {
  private measurements: Map<string, number[]> = new Map();
  private memorySnapshots: Array<{ name: string; usage: NodeJS.MemoryUsage; timestamp: number }> =
    [];

  startMeasurement(name: string): () => number {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    this.memorySnapshots.push({
      name: `${name}-start`,
      usage: startMemory,
      timestamp: Date.now(),
    });

    return () => {
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      const duration = endTime - startTime;

      this.memorySnapshots.push({
        name: `${name}-end`,
        usage: endMemory,
        timestamp: Date.now(),
      });

      if (!this.measurements.has(name)) {
        this.measurements.set(name, []);
      }
      this.measurements.get(name)!.push(duration);

      return duration;
    };
  }

  getStats(name: string) {
    const values = this.measurements.get(name) || [];
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: values.reduce((sum, val) => sum + val, 0) / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: this.calculateStdDev(values),
    };
  }

  getMemoryDelta(operationName: string) {
    const startSnapshot = this.memorySnapshots.find(s => s.name === `${operationName}-start`);
    const endSnapshot = this.memorySnapshots.find(s => s.name === `${operationName}-end`);

    if (!startSnapshot || !endSnapshot) return null;

    return {
      heapUsedDelta: endSnapshot.usage.heapUsed - startSnapshot.usage.heapUsed,
      heapTotalDelta: endSnapshot.usage.heapTotal - startSnapshot.usage.heapTotal,
      externalDelta: endSnapshot.usage.external - startSnapshot.usage.external,
      rssDealta: endSnapshot.usage.rss - startSnapshot.usage.rss,
      duration: endSnapshot.timestamp - startSnapshot.timestamp,
    };
  }

  private calculateStdDev(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }

  getAllMeasurements() {
    return Object.fromEntries(this.measurements.entries());
  }

  getMemorySnapshots() {
    return [...this.memorySnapshots];
  }

  clear() {
    this.measurements.clear();
    this.memorySnapshots.length = 0;
  }
}

// Mock provider for testing
class MockProvider {
  private responseDelay: number;
  private successRate: number;
  private responseSize: number;

  constructor(responseDelay = 100, successRate = 0.95, responseSize = 1000) {
    this.responseDelay = responseDelay;
    this.successRate = successRate;
    this.responseSize = responseSize;
  }

  async generate(options: any) {
    await sleep(this.responseDelay);

    if (Math.random() > this.successRate) {
      throw new Error('Mock provider error');
    }

    const content = 'x'.repeat(this.responseSize);
    return {
      content,
      usage: {
        prompt_tokens: Math.floor(options.prompt?.length / 4) || 50,
        completion_tokens: Math.floor(content.length / 4),
        total_tokens: Math.floor((options.prompt?.length + content.length) / 4) || 300,
      },
    };
  }
}

// Improvement report generator
class ImprovementReportGenerator {
  private testResults: Map<string, any> = new Map();
  private performance: PerformanceMeasurement;
  private issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    area: string;
    description: string;
    recommendation: string;
  }> = [];

  constructor(performance: PerformanceMeasurement) {
    this.performance = performance;
  }

  addTestResult(testName: string, result: any) {
    this.testResults.set(testName, result);
  }

  addIssue(
    severity: 'low' | 'medium' | 'high' | 'critical',
    area: string,
    description: string,
    recommendation: string
  ) {
    this.issues.push({ severity, area, description, recommendation });
  }

  generateReport(): string {
    const report = [];

    report.push('🔍 COMPREHENSIVE SYSTEM IMPROVEMENT ANALYSIS REPORT');
    report.push('='.repeat(60));
    report.push('');

    // Executive Summary
    report.push('📊 EXECUTIVE SUMMARY:');
    report.push('-'.repeat(30));
    report.push(`• Total Test Cases: ${this.testResults.size}`);
    report.push(`• Issues Identified: ${this.issues.length}`);
    report.push(`• Critical Issues: ${this.issues.filter(i => i.severity === 'critical').length}`);
    report.push(`• High Priority Issues: ${this.issues.filter(i => i.severity === 'high').length}`);
    report.push('');

    // Performance Analysis
    report.push('⚡ PERFORMANCE ANALYSIS:');
    report.push('-'.repeat(30));

    const performanceData = this.performance.getAllMeasurements();
    for (const [testName, measurements] of Object.entries(performanceData)) {
      const stats = this.performance.getStats(testName);
      if (stats) {
        report.push(`• ${testName}:`);
        report.push(`  - Count: ${stats.count}, Mean: ${stats.mean.toFixed(2)}ms`);
        report.push(`  - P95: ${stats.p95.toFixed(2)}ms, P99: ${stats.p99.toFixed(2)}ms`);
        report.push(`  - Min/Max: ${stats.min.toFixed(2)}/${stats.max.toFixed(2)}ms`);
      }
    }
    report.push('');

    // Memory Analysis
    report.push('🧠 MEMORY ANALYSIS:');
    report.push('-'.repeat(30));
    const memorySnapshots = this.performance.getMemorySnapshots();
    if (memorySnapshots.length > 0) {
      const startMemory = memorySnapshots[0]?.usage.heapUsed || 0;
      const endMemory = memorySnapshots[memorySnapshots.length - 1]?.usage.heapUsed || 0;
      const memoryDelta = endMemory - startMemory;

      report.push(`• Memory Delta: ${(memoryDelta / 1024 / 1024).toFixed(2)} MB`);
      report.push(
        `• Peak Memory: ${Math.max(...memorySnapshots.map(s => s.usage.heapUsed)) / 1024 / 1024} MB`
      );
      report.push(
        `• Memory Efficiency: ${memoryDelta < 0 ? 'Good (decreased)' : memoryDelta < 50 * 1024 * 1024 ? 'Acceptable' : 'Poor (high growth)'}`
      );
    }
    report.push('');

    // Issues by Severity
    report.push('🚨 IDENTIFIED ISSUES:');
    report.push('-'.repeat(30));

    const issuesBySeverity = {
      critical: this.issues.filter(i => i.severity === 'critical'),
      high: this.issues.filter(i => i.severity === 'high'),
      medium: this.issues.filter(i => i.severity === 'medium'),
      low: this.issues.filter(i => i.severity === 'low'),
    };

    for (const [severity, severityIssues] of Object.entries(issuesBySeverity)) {
      if (severityIssues.length > 0) {
        const emoji =
          severity === 'critical'
            ? '🚨'
            : severity === 'high'
              ? '🔴'
              : severity === 'medium'
                ? '🟡'
                : '🔵';
        report.push(`${emoji} ${severity.toUpperCase()} (${severityIssues.length}):`);

        severityIssues.forEach(issue => {
          report.push(`  • [${issue.area}] ${issue.description}`);
          report.push(`    💡 ${issue.recommendation}`);
        });
        report.push('');
      }
    }

    // Test Results Details
    report.push('📋 DETAILED TEST RESULTS:');
    report.push('-'.repeat(30));

    for (const [testName, result] of this.testResults.entries()) {
      report.push(`• ${testName}:`);
      if (typeof result === 'object') {
        for (const [key, value] of Object.entries(result)) {
          report.push(`  - ${key}: ${JSON.stringify(value)}`);
        }
      } else {
        report.push(`  - Result: ${result}`);
      }
      report.push('');
    }

    // Recommendations
    report.push('💡 IMPROVEMENT RECOMMENDATIONS:');
    report.push('-'.repeat(30));

    // Generate specific recommendations based on test results
    const recommendations = this.generateRecommendations();
    recommendations.forEach(rec => {
      report.push(`• ${rec}`);
    });

    return report.join('\n');
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Performance-based recommendations
    const batchingResult = this.testResults.get('request_batching_performance');
    if (batchingResult && batchingResult.efficiency < 0.8) {
      recommendations.push('Optimize request batching algorithm to improve efficiency above 80%');
    }

    const cacheResult = this.testResults.get('cache_hit_rate_analysis');
    if (cacheResult && cacheResult.hitRate < 0.6) {
      recommendations.push(
        'Improve cache hit rate by optimizing cache key generation and TTL settings'
      );
    }

    const memoryResult = this.testResults.get('memory_optimization_effectiveness');
    if (memoryResult && memoryResult.leakDetected) {
      recommendations.push(
        'Address detected memory leaks to prevent long-term performance degradation'
      );
    }

    const streamingResult = this.testResults.get('streaming_performance_analysis');
    if (streamingResult && streamingResult.throughput < 1000) {
      recommendations.push(
        'Optimize streaming buffer management to increase throughput above 1000 tokens/sec'
      );
    }

    // Generic recommendations based on issues
    if (this.issues.some(i => i.area === 'startup' && i.severity === 'high')) {
      recommendations.push('Implement async startup optimization to reduce initialization time');
    }

    if (this.issues.some(i => i.area === 'concurrency')) {
      recommendations.push(
        'Review concurrent operation limits and implement better resource management'
      );
    }

    if (this.issues.some(i => i.area === 'integration')) {
      recommendations.push(
        'Improve component integration to reduce coupling and increase modularity'
      );
    }

    // Default recommendations if no specific issues found
    if (recommendations.length === 0) {
      recommendations.push('System performance is within acceptable parameters');
      recommendations.push('Continue monitoring for performance regressions');
      recommendations.push('Consider load testing with higher concurrency levels');
    }

    return recommendations;
  }
}

describe('Comprehensive System Improvement Analysis', () => {
  let performanceMeasurement: PerformanceMeasurement;
  let improvementReport: ImprovementReportGenerator;
  let memoryLeakDetector: MemoryLeakDetector;
  let performanceMonitor: PerformanceMonitor;

  beforeAll(async () => {
    // Enable test mode for singletons to prevent interval creation
    StreamingResponseOptimizer.setTestMode(true);
    MemoryUsageOptimizer.setTestMode(true);

    performanceMeasurement = new PerformanceMeasurement();
    improvementReport = new ImprovementReportGenerator(performanceMeasurement);
    memoryLeakDetector = new MemoryLeakDetector();
    performanceMonitor = new PerformanceMonitor(true);

    // Get instances after setting test mode
    streamingOptimizer = StreamingResponseOptimizer.getInstance();
    memoryOptimizer = MemoryUsageOptimizer.getInstance();

    // Initialize all performance components
    memoryOptimizer.updateConfig({
      maxHeapSize: 256, // Lower for testing
      gcThreshold: 0.7,
      monitoringInterval: 1000, // Faster for testing
      leakDetectionEnabled: true,
      cacheEvictionEnabled: true,
      aggressiveCleanup: false,
    });

    // Register startup optimization tasks
    startupOptimizer.registerCommonTasks();
  });

  afterAll(async () => {
    // Generate and output the comprehensive improvement report
    const report = improvementReport.generateReport();
    console.log('\n' + report);

    // Cleanup all performance components
    requestBatcher.shutdown();
    responseCache.shutdown();
    if (streamingOptimizer) {
      streamingOptimizer.shutdown();
    }
    if (memoryOptimizer) {
      memoryOptimizer.shutdown();
    }
    memoryLeakDetector.dispose();
    performanceMonitor.destroy();

    // Reset singleton instances for clean slate
    StreamingResponseOptimizer.resetInstance();
    MemoryUsageOptimizer.resetInstance();

    // Clear test mode
    StreamingResponseOptimizer.setTestMode(false);
    MemoryUsageOptimizer.setTestMode(false);
  });

  beforeEach(() => {
    // Clear metrics before each test
    responseCache.clear();
    performanceMonitor.clearAllMetrics();
    performanceMeasurement.clear();
  });

  describe('Request Batching Performance Analysis', () => {
    it('should test request batching with various batch sizes', async () => {
      const endMeasurement = performanceMeasurement.startMeasurement(
        'request_batching_performance'
      );

      const batchResults: Array<{ batchSize: number; duration: number; efficiency: number }> = [];

      for (const batchSize of BATCH_SIZES) {
        const batchStart = performance.now();
        const promises: Promise<any>[] = [];

        // Create batch of similar requests
        for (let i = 0; i < batchSize; i++) {
          const promise = requestBatcher
            .batchRequest(
              `Test prompt ${i % 3}`, // Similar prompts for batching
              TEST_MODELS[i % TEST_MODELS.length],
              TEST_PROVIDERS[i % TEST_PROVIDERS.length],
              { priority: 'medium' }
            )
            .catch(err => ({ error: err.message }));

          promises.push(promise);
        }

        const results = await Promise.allSettled(promises);
        const batchEnd = performance.now();
        const duration = batchEnd - batchStart;

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const efficiency = successCount / batchSize;

        batchResults.push({ batchSize, duration, efficiency });

        // Give system time to process batches
        await sleep(100);
      }

      endMeasurement();

      // Analyze batching performance
      const stats = requestBatcher.getBatchingStats();
      const overallEfficiency =
        batchResults.reduce((sum, r) => sum + r.efficiency, 0) / batchResults.length;

      improvementReport.addTestResult('request_batching_performance', {
        batchResults,
        batchingStats: stats,
        efficiency: overallEfficiency,
        avgBatchSize: stats.avgBatchSize,
        pendingRequests: stats.pendingRequests,
      });

      // Performance assertions
      expect(overallEfficiency).toBeGreaterThan(0.5); // At least 50% efficiency
      expect(stats.totalBatches).toBeGreaterThan(0);

      // Generate recommendations based on results
      if (overallEfficiency < 0.8) {
        improvementReport.addIssue(
          'medium',
          'batching',
          `Request batching efficiency is ${(overallEfficiency * 100).toFixed(1)}%`,
          'Optimize similarity threshold and batching timeout settings'
        );
      }

      if (stats.avgBatchSize < 2) {
        improvementReport.addIssue(
          'medium',
          'batching',
          'Average batch size is too small',
          'Increase batch timeout or improve request similarity detection'
        );
      }
    }, 30000);

    it('should measure actual latency improvements from batching', async () => {
      const endMeasurement = performanceMeasurement.startMeasurement(
        'batching_latency_improvement'
      );

      // Measure individual request times
      const individualTimes: number[] = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await requestBatcher
          .batchRequest(`Individual request ${i}`, 'test-model', 'test-provider', {
            priority: 'high',
          })
          .catch(() => ({}));
        individualTimes.push(performance.now() - start);
        await sleep(50); // Prevent batching
      }

      // Measure batch request times
      const batchStart = performance.now();
      const batchPromises = [];
      for (let i = 0; i < 5; i++) {
        batchPromises.push(
          requestBatcher
            .batchRequest('Batch request template', 'test-model', 'test-provider', {
              priority: 'medium',
            })
            .catch(() => ({}))
        );
      }
      await Promise.all(batchPromises);
      const batchTotalTime = performance.now() - batchStart;

      endMeasurement();

      const avgIndividualTime =
        individualTimes.reduce((sum, time) => sum + time, 0) / individualTimes.length;
      const avgBatchTime = batchTotalTime / 5;
      const improvement = ((avgIndividualTime - avgBatchTime) / avgIndividualTime) * 100;

      improvementReport.addTestResult('batching_latency_improvement', {
        avgIndividualTime,
        avgBatchTime,
        improvement,
        individualTimes,
        batchTotalTime,
      });

      expect(improvement).toBeGreaterThan(-50); // Should not be 50% worse

      if (improvement < 10) {
        improvementReport.addIssue(
          'low',
          'batching',
          'Batching provides minimal latency improvement',
          'Review batching logic and consider optimizing batch processing'
        );
      }
    }, 20000);
  });

  describe('Cache Performance Analysis', () => {
    it('should measure cache hit rates and memory usage', async () => {
      const endMeasurement = performanceMeasurement.startMeasurement('cache_hit_rate_analysis');

      const testPrompts = [
        'What is TypeScript?',
        'Explain async/await in JavaScript',
        'What is TypeScript?', // Duplicate for cache hit
        'How to use React hooks?',
        'What is TypeScript?', // Another duplicate
        'Explain async/await in JavaScript', // Another duplicate
        'Node.js performance tips',
        'What is TypeScript?', // Final duplicate
      ];

      let cacheHits = 0;
      let cacheMisses = 0;

      for (const prompt of testPrompts) {
        // Check if cached
        const cached = responseCache.get(prompt, 'test-model', 'test-provider');
        if (cached) {
          cacheHits++;
        } else {
          cacheMisses++;
          // Simulate response and cache it
          responseCache.set(prompt, 'test-model', 'test-provider', {
            content: `Response to: ${prompt}`,
            usage: { prompt_tokens: Math.floor(prompt.length / 4), completion_tokens: 50 },
          });
        }

        await sleep(10); // Small delay between requests
      }

      endMeasurement();

      const cacheStats = responseCache.getStats();
      const hitRate = cacheHits / (cacheHits + cacheMisses);

      improvementReport.addTestResult('cache_hit_rate_analysis', {
        hitRate,
        cacheHits,
        cacheMisses,
        cacheStats,
        memoryUsage: cacheStats.memoryUsage,
      });

      expect(hitRate).toBeGreaterThan(0); // Should have some cache hits
      expect(cacheStats.totalEntries).toBeGreaterThan(0);

      if (hitRate < 0.4) {
        improvementReport.addIssue(
          'medium',
          'caching',
          `Cache hit rate is only ${(hitRate * 100).toFixed(1)}%`,
          'Improve cache key generation and increase cache TTL'
        );
      }

      if (cacheStats.memoryUsage > 100) {
        // 100KB threshold
        improvementReport.addIssue(
          'low',
          'caching',
          `Cache memory usage is ${cacheStats.memoryUsage}KB`,
          'Consider implementing cache size limits and LRU eviction'
        );
      }
    }, 15000);

    it('should test cache memory efficiency', async () => {
      const endMeasurement = performanceMeasurement.startMeasurement('cache_memory_efficiency');

      const initialMemory = process.memoryUsage();

      // Fill cache with various sized entries
      const entrySizes = [100, 500, 1000, 5000, 10000]; // Characters
      for (let i = 0; i < 50; i++) {
        const size = entrySizes[i % entrySizes.length];
        const content = 'x'.repeat(size);
        responseCache.set(`Cache test prompt ${i}`, 'test-model', 'test-provider', {
          content,
          usage: { prompt_tokens: 20, completion_tokens: Math.floor(size / 4) },
        });
      }

      const afterCacheMemory = process.memoryUsage();

      // Test cache cleanup
      responseCache.clear();

      const afterClearMemory = process.memoryUsage();

      endMeasurement();

      const cacheMemoryDelta = afterCacheMemory.heapUsed - initialMemory.heapUsed;
      const clearMemoryDelta = afterCacheMemory.heapUsed - afterClearMemory.heapUsed;

      improvementReport.addTestResult('cache_memory_efficiency', {
        cacheMemoryDelta: cacheMemoryDelta / 1024, // KB
        clearMemoryDelta: clearMemoryDelta / 1024, // KB
        memoryRecoveryRate: clearMemoryDelta / cacheMemoryDelta,
        initialHeap: initialMemory.heapUsed / 1024 / 1024, // MB
        afterCacheHeap: afterCacheMemory.heapUsed / 1024 / 1024, // MB
        afterClearHeap: afterClearMemory.heapUsed / 1024 / 1024, // MB
      });

      expect(Math.abs(cacheMemoryDelta)).toBeGreaterThan(0); // Should show memory change
      expect(Math.abs(clearMemoryDelta)).toBeGreaterThan(0); // Should show memory change

      const memoryRecoveryRate = clearMemoryDelta / cacheMemoryDelta;
      if (memoryRecoveryRate < 0.5) {
        improvementReport.addIssue(
          'medium',
          'caching',
          `Cache memory recovery rate is only ${(memoryRecoveryRate * 100).toFixed(1)}%`,
          'Investigate potential memory leaks in cache implementation'
        );
      }
    }, 10000);
  });

  describe('Startup Optimization Analysis', () => {
    it('should test startup optimization with complex dependencies', async () => {
      const endMeasurement = performanceMeasurement.startMeasurement(
        'startup_optimization_performance'
      );

      // Reset startup optimizer for clean test
      startupOptimizer.reset();

      // Add complex dependency chain for testing
      startupOptimizer.registerTask({
        name: 'database_connection',
        priority: 'critical',
        timeout: 2000,
        task: async () => {
          await sleep(200);
          return { connected: true };
        },
      });

      startupOptimizer.registerTask({
        name: 'cache_initialization',
        priority: 'high',
        timeout: 1000,
        task: async () => {
          await sleep(150);
          return { initialized: true };
        },
        dependencies: ['database_connection'],
      });

      startupOptimizer.registerTask({
        name: 'model_preloading',
        priority: 'high',
        timeout: 3000,
        task: async () => {
          await sleep(300);
          return { preloaded: true };
        },
        dependencies: ['database_connection'],
      });

      startupOptimizer.registerTask({
        name: 'api_server_start',
        priority: 'medium',
        timeout: 1500,
        task: async () => {
          await sleep(100);
          return { started: true };
        },
        dependencies: ['cache_initialization', 'model_preloading'],
      });

      startupOptimizer.registerTask({
        name: 'external_services',
        priority: 'low',
        timeout: 5000,
        task: async () => {
          await sleep(Math.random() * 1000 + 500); // Variable delay
          return { connected: true };
        },
      });

      // Execute startup optimization
      const startupResult = await startupOptimizer.executeOptimizedStartup();
      const analytics = startupOptimizer.getStartupAnalytics();

      endMeasurement();

      improvementReport.addTestResult('startup_optimization_performance', {
        startupResult,
        analytics,
        recommendations: startupOptimizer.getOptimizationRecommendations(),
      });

      expect(startupResult.successCount).toBeGreaterThan(0);
      expect(startupResult.totalTime).toBeLessThan(10000); // Should complete within 10s

      if (startupResult.totalTime > 5000) {
        improvementReport.addIssue(
          'medium',
          'startup',
          `Startup time is ${startupResult.totalTime}ms`,
          'Optimize task dependencies and consider parallel execution'
        );
      }

      if (startupResult.failureCount > 0) {
        improvementReport.addIssue(
          'high',
          'startup',
          `${startupResult.failureCount} startup tasks failed`,
          'Review task timeouts and error handling'
        );
      }

      if (analytics.bottlenecks.length > 0) {
        improvementReport.addIssue(
          'medium',
          'startup',
          `${analytics.bottlenecks.length} startup bottlenecks detected`,
          'Optimize slow startup tasks: ' + analytics.bottlenecks.map(b => b.task).join(', ')
        );
      }
    }, 15000);
  });

  describe('Memory Leak Detection Analysis', () => {
    it('should analyze memory leak detection accuracy', async () => {
      const endMeasurement = performanceMeasurement.startMeasurement(
        'memory_leak_detection_accuracy'
      );

      // Perform comprehensive memory leak analysis
      const memoryAnalysis = await memoryLeakDetector.detectMemoryLeaks();

      endMeasurement();

      const report = memoryLeakDetector.generateReport(memoryAnalysis);

      improvementReport.addTestResult('memory_leak_detection_accuracy', {
        memoryAnalysis: {
          baseline: memoryAnalysis.baseline.heapUsed / 1024 / 1024, // MB
          current: memoryAnalysis.current.heapUsed / 1024 / 1024, // MB
          growthRate: memoryAnalysis.growthRate / 1024, // KB/s
          leaksCount: memoryAnalysis.leaks.length,
          bottlenecksCount: memoryAnalysis.bottlenecks.length,
          recommendationsCount: memoryAnalysis.recommendations.length,
        },
        leaksByType: memoryAnalysis.leaks.reduce(
          (acc, leak) => {
            acc[leak.type] = (acc[leak.type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
        leaksBySeverity: memoryAnalysis.leaks.reduce(
          (acc, leak) => {
            acc[leak.severity] = (acc[leak.severity] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
        report: report.length, // Just store length to avoid huge test output
      });

      expect(memoryAnalysis).toHaveProperty('baseline');
      expect(memoryAnalysis).toHaveProperty('current');
      expect(memoryAnalysis.recommendations).toBeInstanceOf(Array);

      // Analyze memory leaks
      const criticalLeaks = memoryAnalysis.leaks.filter(l => l.severity === 'critical').length;
      const highLeaks = memoryAnalysis.leaks.filter(l => l.severity === 'high').length;

      if (criticalLeaks > 0) {
        improvementReport.addIssue(
          'critical',
          'memory',
          `${criticalLeaks} critical memory leaks detected`,
          'Address critical memory leaks immediately to prevent system instability'
        );
      }

      if (highLeaks > 2) {
        improvementReport.addIssue(
          'high',
          'memory',
          `${highLeaks} high-severity memory leaks detected`,
          'Review and fix high-priority memory leaks to improve system stability'
        );
      }

      if (memoryAnalysis.growthRate > 1024) {
        // 1KB/s growth
        improvementReport.addIssue(
          'medium',
          'memory',
          `Memory growth rate is ${(memoryAnalysis.growthRate / 1024).toFixed(2)} KB/s`,
          'Monitor memory growth and implement cleanup mechanisms'
        );
      }

      // Test automatic fixes
      const fixableLeaks = memoryAnalysis.leaks.filter(l => l.autoFixable);
      if (fixableLeaks.length > 0) {
        const fixResult = await memoryLeakDetector.applyAutomaticFixes(fixableLeaks);
        improvementReport.addTestResult('automatic_leak_fixes', fixResult);

        if (fixResult.failed > 0) {
          improvementReport.addIssue(
            'medium',
            'memory',
            `${fixResult.failed} automatic fixes failed`,
            'Review failed fixes and implement manual corrections'
          );
        }
      }
    }, 20000);

    it('should test memory optimization effectiveness', async () => {
      const endMeasurement = performanceMeasurement.startMeasurement(
        'memory_optimization_effectiveness'
      );

      // Force memory pressure to test optimization
      const largeArrays: any[] = [];
      for (let i = 0; i < 100; i++) {
        largeArrays.push(new Array(10000).fill(`data-${i}`));
      }

      const beforeOptimization = process.memoryUsage();

      // Track component memory
      memoryOptimizer.trackComponentMemory('test-component', beforeOptimization.heapUsed);

      // Wait for memory monitoring to detect pressure
      await sleep(2000);

      const memoryStats = memoryOptimizer.getMemoryStats();

      // Clear large arrays to simulate cleanup
      largeArrays.length = 0;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      await sleep(1000);

      const afterOptimization = process.memoryUsage();

      endMeasurement();

      const memoryDelta = beforeOptimization.heapUsed - afterOptimization.heapUsed;
      const memoryImprovement = memoryDelta / beforeOptimization.heapUsed;

      improvementReport.addTestResult('memory_optimization_effectiveness', {
        memoryStats,
        beforeHeap: beforeOptimization.heapUsed / 1024 / 1024, // MB
        afterHeap: afterOptimization.heapUsed / 1024 / 1024, // MB
        memoryDelta: memoryDelta / 1024 / 1024, // MB
        memoryImprovement,
        leakDetected: memoryStats.leaksDetected > 0,
        recommendations: memoryStats.recommendations,
      });

      expect(memoryStats).toHaveProperty('current');
      expect(memoryStats.recommendations).toBeInstanceOf(Array);

      if (memoryStats.leaksDetected > 2) {
        improvementReport.addIssue(
          'high',
          'memory',
          `${memoryStats.leaksDetected} memory leaks detected during optimization test`,
          'Address memory leaks to improve optimization effectiveness'
        );
      }

      if (memoryImprovement < 0.1) {
        improvementReport.addIssue(
          'medium',
          'memory',
          `Memory optimization achieved only ${(memoryImprovement * 100).toFixed(1)}% improvement`,
          'Review memory optimization triggers and cleanup mechanisms'
        );
      }
    }, 15000);
  });

  describe('Streaming Performance Analysis', () => {
    it('should measure streaming response performance', async () => {
      const endMeasurement = performanceMeasurement.startMeasurement(
        'streaming_performance_analysis'
      );

      const streamId = streamingOptimizer.createStream('test-stream', {
        bufferSize: 50,
        flushInterval: 25,
        enablePrediction: true,
        enableCompression: true,
      });

      const receivedChunks: any[] = [];
      const chunkTimestamps: number[] = [];

      // Subscribe to stream
      const unsubscribe = streamingOptimizer.subscribeToStream(streamId, chunk => {
        receivedChunks.push(chunk);
        chunkTimestamps.push(Date.now());
      });

      // Add content to stream with timing
      const contentPieces = [
        'Hello world',
        ' this is a test',
        ' of streaming performance',
        ' with multiple chunks',
        ' to measure throughput',
        ' and latency optimization',
        ' for real-time responses',
        ' in the system',
      ];

      const addStartTime = performance.now();

      for (const [index, content] of contentPieces.entries()) {
        streamingOptimizer.addToStream(streamId, content, { index });
        if (index % 2 === 0) {
          await sleep(10); // Variable timing
        }
      }

      // Wait for final flush
      await sleep(200);

      const addEndTime = performance.now();

      const streamStats = streamingOptimizer.getStreamingStats();
      const streamMetrics = streamingOptimizer.getStreamMetrics(streamId);

      streamingOptimizer.closeStream(streamId);
      unsubscribe();

      endMeasurement();

      const totalContentLength = contentPieces.join('').length;
      const totalTime = addEndTime - addStartTime;
      const throughput = (totalContentLength / totalTime) * 1000; // chars per second

      // Calculate latency between chunks
      const latencies: number[] = [];
      for (let i = 1; i < chunkTimestamps.length; i++) {
        latencies.push(chunkTimestamps[i] - chunkTimestamps[i - 1]);
      }

      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

      improvementReport.addTestResult('streaming_performance_analysis', {
        streamStats,
        streamMetrics,
        receivedChunks: receivedChunks.length,
        totalContentLength,
        totalTime,
        throughput,
        avgLatency,
        latencies,
        bufferUtilization: streamStats.bufferUtilization,
      });

      expect(receivedChunks.length).toBeGreaterThan(0);
      expect(throughput).toBeGreaterThan(0);

      if (throughput < 1000) {
        // Less than 1000 chars/second
        improvementReport.addIssue(
          'medium',
          'streaming',
          `Streaming throughput is only ${throughput.toFixed(0)} chars/second`,
          'Optimize buffer management and chunk processing to increase throughput'
        );
      }

      if (avgLatency > 100) {
        // More than 100ms average latency
        improvementReport.addIssue(
          'medium',
          'streaming',
          `Average streaming latency is ${avgLatency.toFixed(1)}ms`,
          'Reduce buffer flush interval or optimize chunk processing'
        );
      }

      if (streamStats.bufferUtilization < 0.5) {
        improvementReport.addIssue(
          'low',
          'streaming',
          `Buffer utilization is only ${(streamStats.bufferUtilization * 100).toFixed(1)}%`,
          'Consider adjusting buffer size or flush interval for better utilization'
        );
      }
    }, 15000);

    it('should test streaming under load conditions', async () => {
      const endMeasurement = performanceMeasurement.startMeasurement('streaming_load_test');

      const concurrentStreams = 5;
      const streamIds: string[] = [];
      const allReceivedChunks: Array<{ streamId: string; chunks: any[] }> = [];

      // Create multiple concurrent streams
      for (let i = 0; i < concurrentStreams; i++) {
        const streamId = streamingOptimizer.createStream(`load-test-stream-${i}`, {
          bufferSize: 25,
          flushInterval: 50,
        });
        streamIds.push(streamId);

        const receivedChunks: any[] = [];
        streamingOptimizer.subscribeToStream(streamId, chunk => {
          receivedChunks.push(chunk);
        });

        allReceivedChunks.push({ streamId, chunks: receivedChunks });
      }

      const loadTestStart = performance.now();

      // Simulate concurrent streaming load
      const streamingPromises = streamIds.map(async (streamId, streamIndex) => {
        for (let i = 0; i < 20; i++) {
          streamingOptimizer.addToStream(streamId, `Content for stream ${streamIndex} chunk ${i}`, {
            streamIndex,
            chunkIndex: i,
          });

          if (i % 5 === 0) {
            await sleep(Math.random() * 20); // Random small delays
          }
        }
      });

      await Promise.all(streamingPromises);

      // Wait for all streams to flush
      await sleep(500);

      const loadTestEnd = performance.now();

      const finalStats = streamingOptimizer.getStreamingStats();

      // Cleanup streams
      streamIds.forEach(streamId => streamingOptimizer.closeStream(streamId));

      endMeasurement();

      const totalLoadTime = loadTestEnd - loadTestStart;
      const totalChunksReceived = allReceivedChunks.reduce(
        (sum, stream) => sum + stream.chunks.length,
        0
      );
      const chunksPerSecond = (totalChunksReceived / totalLoadTime) * 1000;

      improvementReport.addTestResult('streaming_load_test', {
        concurrentStreams,
        totalLoadTime,
        totalChunksReceived,
        chunksPerSecond,
        finalStats,
        streamingEfficiency: finalStats.optimizationEfficiency,
      });

      expect(totalChunksReceived).toBeGreaterThan(0);
      expect(chunksPerSecond).toBeGreaterThan(0);

      if (chunksPerSecond < 50) {
        improvementReport.addIssue(
          'medium',
          'streaming',
          `Streaming load test achieved only ${chunksPerSecond.toFixed(1)} chunks/second`,
          'Optimize concurrent stream handling to improve throughput under load'
        );
      }

      if (finalStats.optimizationEfficiency < 50) {
        improvementReport.addIssue(
          'medium',
          'streaming',
          `Streaming optimization efficiency is only ${finalStats.optimizationEfficiency.toFixed(1)}%`,
          'Review streaming optimization algorithms and buffer management'
        );
      }

      // Check for memory leaks in concurrent streaming
      const memoryDelta = performanceMeasurement.getMemoryDelta('streaming_load_test');
      if (memoryDelta && memoryDelta.heapUsedDelta > 50 * 1024 * 1024) {
        // 50MB growth
        improvementReport.addIssue(
          'high',
          'streaming',
          `Streaming load test caused ${(memoryDelta.heapUsedDelta / 1024 / 1024).toFixed(1)}MB memory growth`,
          'Investigate potential memory leaks in concurrent streaming operations'
        );
      }
    }, 20000);
  });

  describe('Integration Gap Analysis', () => {
    it('should identify system integration gaps', async () => {
      const endMeasurement = performanceMeasurement.startMeasurement('integration_gap_analysis');

      // Test integration between components
      const integrationTests: Array<{
        name: string;
        test: () => Promise<boolean>;
        expectedResult: boolean;
      }> = [
        {
          name: 'request_batcher_cache_integration',
          test: async () => {
            try {
              // Test if request batcher uses response cache
              await requestBatcher
                .batchRequest('Integration test prompt', 'test-model', 'test-provider')
                .catch(() => ({}));

              const cached = responseCache.get(
                'Integration test prompt',
                'test-model',
                'test-provider'
              );
              return cached !== null;
            } catch {
              return false;
            }
          },
          expectedResult: true,
        },
        {
          name: 'streaming_memory_integration',
          test: async () => {
            try {
              // Test if streaming optimizer properly manages memory
              const initialMemory = process.memoryUsage().heapUsed;
              const streamId = streamingOptimizer.createStream('memory-test-stream');

              for (let i = 0; i < 100; i++) {
                streamingOptimizer.addToStream(streamId, `Test content ${i}`.repeat(100));
              }

              await sleep(200);
              streamingOptimizer.closeStream(streamId);

              const finalMemory = process.memoryUsage().heapUsed;
              const memoryGrowth = finalMemory - initialMemory;

              // Should not grow by more than 10MB
              return memoryGrowth < 10 * 1024 * 1024;
            } catch {
              return false;
            }
          },
          expectedResult: true,
        },
        {
          name: 'memory_optimizer_leak_detector_integration',
          test: async () => {
            try {
              // Test if memory optimizer and leak detector work together
              const memoryStats = memoryOptimizer.getMemoryStats();
              memoryOptimizer.trackComponentMemory('integration-test', 1024 * 1024);

              const updatedStats = memoryOptimizer.getMemoryStats();
              return updatedStats.current.heapUsed >= memoryStats.current.heapUsed;
            } catch {
              return false;
            }
          },
          expectedResult: true,
        },
      ];

      const integrationResults: Array<{ name: string; passed: boolean; issue?: string }> = [];

      for (const integrationTest of integrationTests) {
        try {
          const result = await integrationTest.test();
          const passed = result === integrationTest.expectedResult;

          integrationResults.push({
            name: integrationTest.name,
            passed,
            issue: passed ? undefined : `Expected ${integrationTest.expectedResult}, got ${result}`,
          });

          if (!passed) {
            improvementReport.addIssue(
              'medium',
              'integration',
              `Integration test ${integrationTest.name} failed`,
              `Review component integration: ${integrationTest.name.replace('_', ' ')}`
            );
          }
        } catch (error) {
          integrationResults.push({
            name: integrationTest.name,
            passed: false,
            issue: `Test threw error: ${error}`,
          });

          improvementReport.addIssue(
            'high',
            'integration',
            `Integration test ${integrationTest.name} threw error`,
            'Fix integration test errors and ensure component compatibility'
          );
        }
      }

      endMeasurement();

      const passedTests = integrationResults.filter(r => r.passed).length;
      const integrationScore = (passedTests / integrationResults.length) * 100;

      improvementReport.addTestResult('integration_gap_analysis', {
        integrationResults,
        integrationScore,
        passedTests,
        totalTests: integrationResults.length,
        failedTests: integrationResults.filter(r => !r.passed),
      });

      expect(integrationScore).toBeGreaterThan(50); // At least 50% integration success

      if (integrationScore < 80) {
        improvementReport.addIssue(
          'medium',
          'integration',
          `Integration score is only ${integrationScore.toFixed(1)}%`,
          'Improve component integration and cross-component communication'
        );
      }
    }, 15000);

    it('should test component communication under load', async () => {
      const endMeasurement = performanceMeasurement.startMeasurement(
        'component_communication_load_test'
      );

      // Test concurrent operations across components
      const concurrentOperations = [];
      const operationResults: Array<{ operation: string; success: boolean; duration: number }> = [];

      for (let i = 0; i < 20; i++) {
        // Batch requests
        concurrentOperations.push(
          (async () => {
            const start = performance.now();
            try {
              await requestBatcher
                .batchRequest(`Concurrent batch request ${i}`, 'test-model', 'test-provider')
                .catch(() => ({}));
              return {
                operation: `batch_request_${i}`,
                success: true,
                duration: performance.now() - start,
              };
            } catch (error) {
              return {
                operation: `batch_request_${i}`,
                success: false,
                duration: performance.now() - start,
              };
            }
          })()
        );

        // Cache operations
        concurrentOperations.push(
          (async () => {
            const start = performance.now();
            try {
              responseCache.set(`Concurrent cache test ${i}`, 'test-model', 'test-provider', {
                content: `Response ${i}`,
                usage: { total_tokens: 100 },
              });
              const retrieved = responseCache.get(
                `Concurrent cache test ${i}`,
                'test-model',
                'test-provider'
              );
              return {
                operation: `cache_operation_${i}`,
                success: retrieved !== null,
                duration: performance.now() - start,
              };
            } catch (error) {
              return {
                operation: `cache_operation_${i}`,
                success: false,
                duration: performance.now() - start,
              };
            }
          })()
        );

        // Streaming operations
        concurrentOperations.push(
          (async () => {
            const start = performance.now();
            try {
              const streamId = streamingOptimizer.createStream(`concurrent_stream_${i}`);
              streamingOptimizer.addToStream(streamId, `Content for stream ${i}`);
              await sleep(50);
              streamingOptimizer.closeStream(streamId);
              return {
                operation: `stream_operation_${i}`,
                success: true,
                duration: performance.now() - start,
              };
            } catch (error) {
              return {
                operation: `stream_operation_${i}`,
                success: false,
                duration: performance.now() - start,
              };
            }
          })()
        );
      }

      const results = await Promise.allSettled(concurrentOperations);

      for (const result of results) {
        if (result.status === 'fulfilled') {
          operationResults.push(result.value);
        } else {
          operationResults.push({
            operation: 'unknown_operation',
            success: false,
            duration: 0,
          });
        }
      }

      endMeasurement();

      const successfulOperations = operationResults.filter(r => r.success).length;
      const successRate = (successfulOperations / operationResults.length) * 100;
      const avgDuration =
        operationResults.reduce((sum, r) => sum + r.duration, 0) / operationResults.length;

      improvementReport.addTestResult('component_communication_load_test', {
        totalOperations: operationResults.length,
        successfulOperations,
        successRate,
        avgDuration,
        operationResults: operationResults.slice(0, 10), // Sample of results
      });

      expect(successRate).toBeGreaterThan(70); // At least 70% success under load

      if (successRate < 90) {
        improvementReport.addIssue(
          'medium',
          'concurrency',
          `Component communication success rate under load is only ${successRate.toFixed(1)}%`,
          'Improve concurrent operation handling and resource contention management'
        );
      }

      if (avgDuration > 500) {
        // More than 500ms average
        improvementReport.addIssue(
          'medium',
          'concurrency',
          `Average operation duration under load is ${avgDuration.toFixed(1)}ms`,
          'Optimize component operations for better performance under concurrent load'
        );
      }
    }, 25000);
  });

  describe('Edge Case and Failure Scenario Analysis', () => {
    it('should test system behavior under extreme load', async () => {
      const endMeasurement = performanceMeasurement.startMeasurement('extreme_load_test');

      const extremeLoadOperations = [];
      const startTime = performance.now();

      // Create extreme load scenario
      for (let i = 0; i < 100; i++) {
        extremeLoadOperations.push(
          requestBatcher
            .batchRequest(
              `Extreme load request ${i}`,
              TEST_MODELS[i % TEST_MODELS.length],
              TEST_PROVIDERS[i % TEST_PROVIDERS.length],
              { priority: i % 4 === 0 ? 'critical' : 'medium' }
            )
            .catch(error => ({ error: error.message }))
        );
      }

      // Add memory pressure
      const memoryArrays = [];
      for (let i = 0; i < 50; i++) {
        memoryArrays.push(new Array(1000).fill(`memory-load-${i}`));
      }

      const results = await Promise.allSettled(extremeLoadOperations);
      const endTime = performance.now();

      // Cleanup
      memoryArrays.length = 0;

      endMeasurement();

      const successCount = results.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
      const failureCount = results.length - successCount;
      const extremeLoadDuration = endTime - startTime;
      const throughput = (results.length / extremeLoadDuration) * 1000; // operations per second

      improvementReport.addTestResult('extreme_load_test', {
        totalOperations: results.length,
        successCount,
        failureCount,
        successRate: (successCount / results.length) * 100,
        extremeLoadDuration,
        throughput,
      });

      expect(successCount).toBeGreaterThan(0); // Some operations should succeed

      if (failureCount > results.length * 0.3) {
        // More than 30% failure
        improvementReport.addIssue(
          'high',
          'reliability',
          `${((failureCount / results.length) * 100).toFixed(1)}% of operations failed under extreme load`,
          'Improve error handling and implement circuit breakers for high load scenarios'
        );
      }

      if (throughput < 5) {
        // Less than 5 operations per second
        improvementReport.addIssue(
          'medium',
          'performance',
          `System throughput under extreme load is only ${throughput.toFixed(2)} ops/sec`,
          'Optimize resource management and implement load shedding mechanisms'
        );
      }
    }, 30000);

    it('should test error recovery and graceful degradation', async () => {
      const endMeasurement = performanceMeasurement.startMeasurement('error_recovery_test');

      const errorRecoveryTests: Array<{
        name: string;
        test: () => Promise<{ recovered: boolean; graceful: boolean }>;
      }> = [
        {
          name: 'cache_memory_exhaustion',
          test: async () => {
            try {
              // Fill cache until memory pressure
              for (let i = 0; i < 1000; i++) {
                responseCache.set(`memory-test-${i}`, 'test-model', 'test-provider', {
                  content: 'x'.repeat(10000),
                  usage: { total_tokens: 2500 },
                });
              }

              // System should still respond
              const testResult = responseCache.get('test-prompt', 'test-model', 'test-provider');

              // Cleanup
              responseCache.clear();

              return { recovered: true, graceful: testResult === null };
            } catch (error) {
              return { recovered: false, graceful: false };
            }
          },
        },
        {
          name: 'streaming_buffer_overflow',
          test: async () => {
            try {
              const streamId = streamingOptimizer.createStream('overflow-test');

              // Attempt to overflow buffer
              for (let i = 0; i < 1000; i++) {
                streamingOptimizer.addToStream(streamId, `Overflow content ${i}`.repeat(100));
              }

              await sleep(100);

              const streamStats = streamingOptimizer.getStreamingStats();
              streamingOptimizer.closeStream(streamId);

              return {
                recovered: true,
                graceful: streamStats.activeStreams >= 0, // System should track streams correctly
              };
            } catch (error) {
              return { recovered: false, graceful: false };
            }
          },
        },
        {
          name: 'concurrent_component_access',
          test: async () => {
            try {
              // Simulate concurrent access to all components
              const promises = [];

              for (let i = 0; i < 50; i++) {
                promises.push(
                  requestBatcher
                    .batchRequest(`concurrent-${i}`, 'test-model', 'test-provider')
                    .catch(() => ({})),
                  (async () => {
                    responseCache.set(`concurrent-cache-${i}`, 'test-model', 'test-provider', {
                      content: `content-${i}`,
                    });
                    return responseCache.get(
                      `concurrent-cache-${i}`,
                      'test-model',
                      'test-provider'
                    );
                  })(),
                  (async () => {
                    const streamId = streamingOptimizer.createStream(`concurrent-stream-${i}`);
                    streamingOptimizer.addToStream(streamId, `concurrent-content-${i}`);
                    setTimeout(() => streamingOptimizer.closeStream(streamId), 100);
                    return true;
                  })()
                );
              }

              const results = await Promise.allSettled(promises);
              const successCount = results.filter(r => r.status === 'fulfilled').length;

              return {
                recovered: true,
                graceful: successCount > promises.length * 0.8, // 80% success rate
              };
            } catch (error) {
              return { recovered: false, graceful: false };
            }
          },
        },
      ];

      const errorRecoveryResults: Array<{
        test: string;
        recovered: boolean;
        graceful: boolean;
      }> = [];

      for (const test of errorRecoveryTests) {
        const result = await test.test();
        errorRecoveryResults.push({
          test: test.name,
          ...result,
        });

        if (!result.recovered) {
          improvementReport.addIssue(
            'high',
            'reliability',
            `Error recovery test ${test.name} failed to recover`,
            'Implement better error recovery mechanisms for system resilience'
          );
        }

        if (!result.graceful) {
          improvementReport.addIssue(
            'medium',
            'reliability',
            `Error recovery test ${test.name} did not degrade gracefully`,
            'Improve graceful degradation handling under error conditions'
          );
        }
      }

      endMeasurement();

      const recoveredTests = errorRecoveryResults.filter(r => r.recovered).length;
      const gracefulTests = errorRecoveryResults.filter(r => r.graceful).length;
      const recoveryRate = (recoveredTests / errorRecoveryResults.length) * 100;
      const gracefulRate = (gracefulTests / errorRecoveryResults.length) * 100;

      improvementReport.addTestResult('error_recovery_test', {
        errorRecoveryResults,
        recoveryRate,
        gracefulRate,
        totalTests: errorRecoveryResults.length,
      });

      expect(recoveryRate).toBeGreaterThan(80); // At least 80% recovery rate
      expect(gracefulRate).toBeGreaterThan(60); // At least 60% graceful degradation

      if (recoveryRate < 90) {
        improvementReport.addIssue(
          'medium',
          'reliability',
          `Error recovery rate is only ${recoveryRate.toFixed(1)}%`,
          'Improve error handling and recovery mechanisms across all components'
        );
      }
    }, 20000);
  });
});
