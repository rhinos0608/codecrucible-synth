/**
 * Advanced Synthesis Performance Benchmark Tests
 * Measures performance characteristics and establishes baseline metrics
 * Created: August 26, 2025
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import { AdvancedSynthesisEngine, SynthesisMode, WeightingStrategy } from '../../src/core/advanced-synthesis-engine';
import { ResponseFactory, AgentResponse } from '../../src/core/response-types';

interface PerformanceBenchmark {
  operation: string;
  samples: number;
  averageTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  throughputPerSecond: number;
  memoryUsedMB?: number;
}

describe('Advanced Synthesis Performance Benchmarks', () => {
  let synthesisEngine: AdvancedSynthesisEngine;
  let mockModelClient: any;
  let performanceResults: PerformanceBenchmark[] = [];

  beforeEach(() => {
    mockModelClient = {
      generateVoiceResponse: jest.fn().mockResolvedValue({
        content: 'Mock response for performance testing',
        confidence: 0.8
      })
    };
    
    synthesisEngine = new AdvancedSynthesisEngine(mockModelClient);
    performanceResults = [];
  });

  afterEach(() => {
    synthesisEngine.removeAllListeners();
    
    // Log performance results for analysis
    if (performanceResults.length > 0) {
      console.log('\n📊 Performance Benchmark Results:');
      performanceResults.forEach(result => {
        console.log(`\n${result.operation}:`);
        console.log(`  • Samples: ${result.samples}`);
        console.log(`  • Average: ${result.averageTimeMs.toFixed(2)}ms`);
        console.log(`  • Range: ${result.minTimeMs.toFixed(2)}ms - ${result.maxTimeMs.toFixed(2)}ms`);
        console.log(`  • Throughput: ${result.throughputPerSecond.toFixed(2)} ops/sec`);
        if (result.memoryUsedMB) {
          console.log(`  • Memory: ${result.memoryUsedMB.toFixed(2)}MB`);
        }
      });
    }
  });

  /**
   * Utility function to run performance benchmarks
   */
  async function runBenchmark<T>(
    operation: string,
    testFunction: () => Promise<T>,
    samples: number = 10,
    measureMemory: boolean = false
  ): Promise<PerformanceBenchmark> {
    const times: number[] = [];
    const memoryBefore = measureMemory ? process.memoryUsage().heapUsed : 0;

    // Warm up
    await testFunction();

    // Run benchmark samples
    for (let i = 0; i < samples; i++) {
      const startTime = performance.now();
      await testFunction();
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    const memoryAfter = measureMemory ? process.memoryUsage().heapUsed : 0;
    const memoryUsedMB = measureMemory ? (memoryAfter - memoryBefore) / 1024 / 1024 : undefined;

    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const throughput = 1000 / averageTime; // Operations per second

    const benchmark: PerformanceBenchmark = {
      operation,
      samples,
      averageTimeMs: averageTime,
      minTimeMs: minTime,
      maxTimeMs: maxTime,
      throughputPerSecond: throughput,
      memoryUsedMB
    };

    performanceResults.push(benchmark);
    return benchmark;
  }

  describe('Baseline Synthesis Performance', () => {
    test('should handle small voice groups efficiently (2-3 voices)', async () => {
      const smallGroupResponses = [
        ResponseFactory.createAgentResponse('Response 1', { confidence: 0.8, voiceId: 'voice1' }),
        ResponseFactory.createAgentResponse('Response 2', { confidence: 0.85, voiceId: 'voice2' }),
        ResponseFactory.createAgentResponse('Response 3', { confidence: 0.75, voiceId: 'voice3' })
      ];

      const benchmark = await runBenchmark(
        'Small Voice Group (3 voices)',
        () => synthesisEngine.synthesizeAdvanced(smallGroupResponses),
        20,
        true
      );

      // Performance expectations for small groups
      expect(benchmark.averageTimeMs).toBeLessThan(100); // Should complete in <100ms
      expect(benchmark.throughputPerSecond).toBeGreaterThan(10); // >10 syntheses per second
      expect(benchmark.memoryUsedMB || 0).toBeLessThan(10); // <10MB memory usage
    });

    test('should handle medium voice groups efficiently (5-7 voices)', async () => {
      const mediumGroupResponses = Array.from({ length: 6 }, (_, i) =>
        ResponseFactory.createAgentResponse(
          `Medium group response ${i + 1} with detailed content for testing performance characteristics.`,
          { confidence: 0.7 + (i * 0.05), voiceId: `voice${i + 1}`, tokensUsed: 50 + i * 10 }
        )
      );

      const benchmark = await runBenchmark(
        'Medium Voice Group (6 voices)',
        () => synthesisEngine.synthesizeAdvanced(mediumGroupResponses),
        15,
        true
      );

      // Performance expectations for medium groups
      expect(benchmark.averageTimeMs).toBeLessThan(250); // Should complete in <250ms
      expect(benchmark.throughputPerSecond).toBeGreaterThan(4); // >4 syntheses per second
      expect(benchmark.memoryUsedMB || 0).toBeLessThan(20); // <20MB memory usage
    });

    test('should handle large voice groups efficiently (10+ voices)', async () => {
      const largeGroupResponses = Array.from({ length: 12 }, (_, i) =>
        ResponseFactory.createAgentResponse(
          `Large group response ${i + 1} with comprehensive content including multiple perspectives, detailed analysis, and extensive recommendations for the problem at hand.`,
          { confidence: 0.65 + (i * 0.02), voiceId: `voice${i + 1}`, tokensUsed: 100 + i * 15 }
        )
      );

      const benchmark = await runBenchmark(
        'Large Voice Group (12 voices)',
        () => synthesisEngine.synthesizeAdvanced(largeGroupResponses),
        10,
        true
      );

      // Performance expectations for large groups
      expect(benchmark.averageTimeMs).toBeLessThan(500); // Should complete in <500ms
      expect(benchmark.throughputPerSecond).toBeGreaterThan(2); // >2 syntheses per second
      expect(benchmark.memoryUsedMB || 0).toBeLessThan(50); // <50MB memory usage
    });
  });

  describe('Synthesis Mode Performance Comparison', () => {
    test('should benchmark different synthesis modes', async () => {
      const testResponses = Array.from({ length: 5 }, (_, i) =>
        ResponseFactory.createAgentResponse(
          `Synthesis mode test response ${i + 1} with content for performance analysis.`,
          { confidence: 0.8, voiceId: `voice${i + 1}`, tokensUsed: 60 }
        )
      );

      const modes = [
        SynthesisMode.COMPETITIVE,
        SynthesisMode.COLLABORATIVE,
        SynthesisMode.CONSENSUS,
        SynthesisMode.HIERARCHICAL,
        SynthesisMode.DIALECTICAL
      ];

      const modeBenchmarks: Record<string, PerformanceBenchmark> = {};

      for (const mode of modes) {
        const benchmark = await runBenchmark(
          `Synthesis Mode: ${mode}`,
          () => synthesisEngine.synthesizeAdvanced(testResponses, { mode }),
          15
        );
        modeBenchmarks[mode] = benchmark;
      }

      // All modes should perform within acceptable ranges
      Object.entries(modeBenchmarks).forEach(([mode, benchmark]) => {
        expect(benchmark.averageTimeMs).toBeLessThan(300);
        expect(benchmark.throughputPerSecond).toBeGreaterThan(3);
      });

      // Competitive mode should be fastest (just selects best)
      expect(modeBenchmarks[SynthesisMode.COMPETITIVE].averageTimeMs)
        .toBeLessThan(modeBenchmarks[SynthesisMode.DIALECTICAL].averageTimeMs);
    });
  });

  describe('Weighting Strategy Performance', () => {
    test('should benchmark different weighting strategies', async () => {
      const testResponses = Array.from({ length: 8 }, (_, i) =>
        ResponseFactory.createAgentResponse(
          `Weighting strategy test response ${i + 1}.`,
          { 
            confidence: 0.7 + (i * 0.03), 
            voiceId: `voice${i + 1}`, 
            tokensUsed: 40 + (i * 5) 
          }
        )
      );

      const strategies = [
        WeightingStrategy.CONFIDENCE_BASED,
        WeightingStrategy.EXPERTISE_BASED,
        WeightingStrategy.PERFORMANCE_BASED,
        WeightingStrategy.BALANCED
      ];

      for (const strategy of strategies) {
        const benchmark = await runBenchmark(
          `Weighting Strategy: ${strategy}`,
          () => synthesisEngine.synthesizeAdvanced(testResponses, { weightingStrategy: strategy }),
          12
        );

        // All weighting strategies should perform well
        expect(benchmark.averageTimeMs).toBeLessThan(200);
        expect(benchmark.throughputPerSecond).toBeGreaterThan(5);
      }
    });
  });

  describe('Concurrent Synthesis Performance', () => {
    test('should handle multiple concurrent synthesis requests', async () => {
      const concurrentRequests = 5;
      const testResponses = [
        ResponseFactory.createAgentResponse('Concurrent test response 1', { confidence: 0.8, voiceId: 'voice1' }),
        ResponseFactory.createAgentResponse('Concurrent test response 2', { confidence: 0.85, voiceId: 'voice2' }),
        ResponseFactory.createAgentResponse('Concurrent test response 3', { confidence: 0.75, voiceId: 'voice3' })
      ];

      const benchmark = await runBenchmark(
        `Concurrent Synthesis (${concurrentRequests} parallel)`,
        async () => {
          const promises = Array.from({ length: concurrentRequests }, () =>
            synthesisEngine.synthesizeAdvanced(testResponses)
          );
          await Promise.all(promises);
        },
        8,
        true
      );

      // Should handle concurrent requests efficiently
      expect(benchmark.averageTimeMs).toBeLessThan(300);
      expect(benchmark.memoryUsedMB || 0).toBeLessThan(30);
    });
  });

  describe('Quality vs Performance Trade-offs', () => {
    test('should measure performance impact of quality thresholds', async () => {
      const testResponses = Array.from({ length: 6 }, (_, i) =>
        ResponseFactory.createAgentResponse(
          `Quality threshold test response ${i + 1} with varying quality levels.`,
          { confidence: 0.6 + (i * 0.05), voiceId: `voice${i + 1}` }
        )
      );

      const qualityThresholds = [50, 75, 90];
      
      for (const threshold of qualityThresholds) {
        const benchmark = await runBenchmark(
          `Quality Threshold: ${threshold}%`,
          () => synthesisEngine.synthesizeAdvanced(testResponses, { 
            qualityThreshold: threshold,
            enableAdaptiveSynthesis: true
          }),
          10
        );

        // Higher quality thresholds may take longer due to adaptive refinement
        expect(benchmark.averageTimeMs).toBeLessThan(1000);
        expect(benchmark.throughputPerSecond).toBeGreaterThan(1);
      }
    });
  });

  describe('Memory Usage Analysis', () => {
    test('should maintain stable memory usage across multiple synthesis operations', async () => {
      const testResponses = Array.from({ length: 4 }, (_, i) =>
        ResponseFactory.createAgentResponse(
          `Memory usage test response ${i + 1}.`,
          { confidence: 0.8, voiceId: `voice${i + 1}` }
        )
      );

      const memoryReadings: number[] = [];
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const memoryBefore = process.memoryUsage().heapUsed;
        await synthesisEngine.synthesizeAdvanced(testResponses);
        const memoryAfter = process.memoryUsage().heapUsed;
        memoryReadings.push((memoryAfter - memoryBefore) / 1024 / 1024);
        
        // Force garbage collection if available (for testing)
        if (global.gc) {
          global.gc();
        }
      }

      const avgMemoryUsage = memoryReadings.reduce((a, b) => a + b, 0) / memoryReadings.length;
      const maxMemoryUsage = Math.max(...memoryReadings);

      // Memory usage should be reasonable and stable
      expect(avgMemoryUsage).toBeLessThan(10); // <10MB average per synthesis
      expect(maxMemoryUsage).toBeLessThan(25); // <25MB max per synthesis

      // Memory usage should not grow significantly over time (no major leaks)
      const firstHalf = memoryReadings.slice(0, iterations / 2);
      const secondHalf = memoryReadings.slice(iterations / 2);
      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      // Second half shouldn't use significantly more memory than first half
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5);

      performanceResults.push({
        operation: 'Memory Stability Analysis',
        samples: iterations,
        averageTimeMs: 0,
        minTimeMs: 0,
        maxTimeMs: 0,
        throughputPerSecond: 0,
        memoryUsedMB: avgMemoryUsage
      });
    });
  });

  describe('Stress Testing', () => {
    test('should handle stress conditions gracefully', async () => {
      // Create a large number of responses with varying content sizes
      const stressResponses = Array.from({ length: 20 }, (_, i) => {
        const contentSize = i < 10 ? 'small' : 'large';
        const content = contentSize === 'small' 
          ? `Stress test response ${i + 1}.`
          : `Stress test response ${i + 1} with extensive content: ${'detailed analysis '.repeat(20)}`;
          
        return ResponseFactory.createAgentResponse(
          content,
          { 
            confidence: 0.5 + (Math.random() * 0.5), 
            voiceId: `stress-voice-${i + 1}`, 
            tokensUsed: contentSize === 'small' ? 20 + i : 200 + i * 10
          }
        );
      });

      const benchmark = await runBenchmark(
        'Stress Test (20 voices, mixed content)',
        () => synthesisEngine.synthesizeAdvanced(stressResponses),
        5,
        true
      );

      // Should handle stress conditions within reasonable limits
      expect(benchmark.averageTimeMs).toBeLessThan(2000); // <2 seconds
      expect(benchmark.throughputPerSecond).toBeGreaterThan(0.5); // >0.5 ops/sec
      expect(benchmark.memoryUsedMB || 0).toBeLessThan(100); // <100MB
    });

    test('should maintain performance under rapid-fire requests', async () => {
      const rapidFireResponses = [
        ResponseFactory.createAgentResponse('Rapid response 1', { confidence: 0.8, voiceId: 'rapid1' }),
        ResponseFactory.createAgentResponse('Rapid response 2', { confidence: 0.85, voiceId: 'rapid2' })
      ];

      const rapidFireCount = 50;
      const startTime = performance.now();
      
      const promises = Array.from({ length: rapidFireCount }, () =>
        synthesisEngine.synthesizeAdvanced(rapidFireResponses)
      );
      
      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All requests should complete successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should handle rapid-fire requests efficiently
      const avgTimePerRequest = totalTime / rapidFireCount;
      expect(avgTimePerRequest).toBeLessThan(100); // <100ms average per request
      expect(totalTime).toBeLessThan(5000); // Complete all within 5 seconds

      performanceResults.push({
        operation: `Rapid Fire Test (${rapidFireCount} requests)`,
        samples: rapidFireCount,
        averageTimeMs: avgTimePerRequest,
        minTimeMs: 0,
        maxTimeMs: 0,
        throughputPerSecond: 1000 / avgTimePerRequest,
        memoryUsedMB: process.memoryUsage().heapUsed / 1024 / 1024
      });
    });
  });

  describe('Performance Regression Detection', () => {
    test('should establish performance baselines for regression testing', async () => {
      const baselineResponses = [
        ResponseFactory.createAgentResponse(
          'Baseline response for regression testing with consistent content length.',
          { confidence: 0.8, voiceId: 'baseline1', tokensUsed: 50 }
        ),
        ResponseFactory.createAgentResponse(
          'Another baseline response for regression testing with consistent quality.',
          { confidence: 0.85, voiceId: 'baseline2', tokensUsed: 52 }
        ),
        ResponseFactory.createAgentResponse(
          'Third baseline response maintaining consistent performance characteristics.',
          { confidence: 0.82, voiceId: 'baseline3', tokensUsed: 48 }
        )
      ];

      const benchmark = await runBenchmark(
        'Performance Baseline (3 voices)',
        () => synthesisEngine.synthesizeAdvanced(baselineResponses),
        25,
        true
      );

      // Establish baseline expectations that can be used for regression testing
      const baselineExpectations = {
        maxAverageTimeMs: 150,
        minThroughputPerSecond: 6,
        maxMemoryUsageMB: 15,
        maxVariabilityPercent: 1000 // Max 1000% variance between min and max times (very permissive for test environment)
      };

      expect(benchmark.averageTimeMs).toBeLessThan(baselineExpectations.maxAverageTimeMs);
      expect(benchmark.throughputPerSecond).toBeGreaterThan(baselineExpectations.minThroughputPerSecond);
      expect(benchmark.memoryUsedMB || 0).toBeLessThan(baselineExpectations.maxMemoryUsageMB);

      // Check time variability
      const variability = ((benchmark.maxTimeMs - benchmark.minTimeMs) / benchmark.averageTimeMs) * 100;
      expect(variability).toBeLessThan(baselineExpectations.maxVariabilityPercent);

      // Log baseline for future reference
      console.log('\n🎯 Performance Baseline Established:');
      console.log(`  • Average Time: ${benchmark.averageTimeMs.toFixed(2)}ms`);
      console.log(`  • Throughput: ${benchmark.throughputPerSecond.toFixed(2)} ops/sec`);
      console.log(`  • Memory: ${(benchmark.memoryUsedMB || 0).toFixed(2)}MB`);
      console.log(`  • Variability: ${variability.toFixed(1)}%`);
    });
  });
});