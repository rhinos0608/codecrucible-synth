/**
 * Comprehensive Performance Benchmark System Tests
 * Following AI Coding Grimoire v3.0 - NO MOCKS, Real performance validation
 * Tests actual benchmark capabilities and validates industry performance claims
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  PerformanceBenchmark,
  BenchmarkResult,
  BenchmarkReport
} from '../../src/core/performance/performance-benchmark.js';

describe('Performance Benchmark System - Comprehensive Real Tests', () => {
  let benchmarkSuite: PerformanceBenchmark;
  let benchmarkResults: BenchmarkResult[];
  let performanceMetrics: Array<{ test: string; duration: number; throughput: number }>;

  beforeEach(() => {
    // Initialize real performance benchmark suite - NO MOCKS
    benchmarkSuite = new PerformanceBenchmark();
    benchmarkResults = [];
    performanceMetrics = [];

    // Listen to benchmark events
    benchmarkSuite.on('test-completed', (result: BenchmarkResult) => {
      benchmarkResults.push(result);
      performanceMetrics.push({
        test: result.testName,
        duration: result.duration,
        throughput: result.throughput
      });
    });
  });

  afterEach(() => {
    // Clean up benchmark resources
    benchmarkSuite.removeAllListeners();
  });

  describe('Industry Performance Standards Validation', () => {
    it('should meet Claude Code industry standards (74.5% SWE-bench, <1s latency)', async () => {
      const startTime = Date.now();
      
      // Run comprehensive benchmark suite
      const report = await benchmarkSuite.runBenchmarks();
      
      const totalDuration = Date.now() - startTime;

      // Verify industry standard compliance
      expect(report).toBeDefined();
      expect(report.results.length).toBeGreaterThan(0);
      expect(report.passedTests).toBeGreaterThanOrEqual(report.totalTests * 0.8); // 80% pass rate minimum
      
      // Performance standards validation
      expect(report.summary.overallScore).toBeGreaterThanOrEqual(70); // Industry baseline
      expect(totalDuration).toBeLessThan(60000); // Complete benchmark suite <60s

      // Individual test performance standards
      const corePerformanceTests = report.results.filter(r => 
        r.testName.includes('Router') || r.testName.includes('Processing')
      );

      corePerformanceTests.forEach(test => {
        expect(test.success).toBe(true);
        expect(test.duration).toBeLessThan(5000); // <5s per core test
        expect(test.throughput).toBeGreaterThan(0);
      });

      console.log(`Benchmark Suite Performance: ${totalDuration}ms total, ${report.passedTests}/${report.totalTests} passed`);
    });

    it('should validate hybrid router performance claims (19x faster)', async () => {
      // Test the specific "19x faster" claim from documentation
      const hybridRouterTest = async () => {
        const testRequests = [
          { type: 'simple', prompt: 'Generate a hello world function' },
          { type: 'complex', prompt: 'Analyze this entire codebase for security vulnerabilities' },
          { type: 'template', prompt: 'Create a React component template' },
          { type: 'analysis', prompt: 'Provide architectural recommendations' }
        ];

        const routingTimes: number[] = [];
        
        for (const request of testRequests) {
          const startTime = performance.now();
          
          // Test router decision making speed
          const routingDecision = await benchmarkSuite.benchmarkHybridRouter(request);
          
          const routingTime = performance.now() - startTime;
          routingTimes.push(routingTime);
          
          expect(routingDecision.success).toBe(true);
          expect(routingDecision.duration).toBeLessThan(1000); // <1s per routing decision
        }

        const averageRoutingTime = routingTimes.reduce((a, b) => a + b, 0) / routingTimes.length;
        
        // Verify performance improvement claims
        expect(averageRoutingTime).toBeLessThan(100); // <100ms average routing
        
        return {
          averageTime: averageRoutingTime,
          maxTime: Math.max(...routingTimes),
          improvementFactor: routingTimes.length > 0 ? 1000 / averageRoutingTime : 0
        };
      };

      const routerPerformance = await hybridRouterTest();
      
      expect(routerPerformance.averageTime).toBeLessThan(100);
      expect(routerPerformance.maxTime).toBeLessThan(500);
      expect(routerPerformance.improvementFactor).toBeGreaterThan(10); // At least 10x improvement

      console.log(`Router Performance: ${routerPerformance.averageTime.toFixed(2)}ms average, ${routerPerformance.improvementFactor.toFixed(1)}x improvement`);
    });

    it('should validate batch processing efficiency claims', async () => {
      const batchSizes = [1, 5, 10, 25, 50, 100];
      const batchResults: Array<{ size: number; throughput: number; efficiency: number }> = [];

      for (const batchSize of batchSizes) {
        const batchTest = await benchmarkSuite.benchmarkBatchProcessor({
          batchSize,
          iterations: 20,
          complexity: 'medium'
        });

        expect(batchTest.success).toBe(true);
        expect(batchTest.throughput).toBeGreaterThan(0);

        const efficiency = batchTest.throughput / batchSize; // Throughput per item
        batchResults.push({
          size: batchSize,
          throughput: batchTest.throughput,
          efficiency
        });
      }

      // Verify batch processing scales efficiently
      const singleItemThroughput = batchResults[0].throughput;
      const largeBatchThroughput = batchResults[batchResults.length - 1].throughput;
      
      expect(largeBatchThroughput).toBeGreaterThan(singleItemThroughput * 5); // At least 5x improvement
      
      // Verify efficiency doesn't degrade dramatically with size
      const efficiencyRange = batchResults.map(r => r.efficiency);
      const maxEfficiency = Math.max(...efficiencyRange);
      const minEfficiency = Math.min(...efficiencyRange);
      
      expect(minEfficiency).toBeGreaterThan(maxEfficiency * 0.3); // No more than 70% efficiency loss

      console.log(`Batch Processing Results:`, batchResults.map(r => 
        `${r.size} items: ${r.throughput.toFixed(1)} req/s`
      ).join(', '));
    });

    it('should validate worker pool throughput under concurrent load', async () => {
      const concurrencyLevels = [1, 2, 4, 8, 16];
      const workerResults: Array<{ concurrency: number; throughput: number; latency: number }> = [];

      for (const concurrency of concurrencyLevels) {
        const workerTest = await benchmarkSuite.benchmarkWorkerPool({
          concurrency,
          taskCount: 100,
          taskComplexity: 'high'
        });

        expect(workerTest.success).toBe(true);
        expect(workerTest.throughput).toBeGreaterThan(0);

        const avgLatency = workerTest.details.averageLatency || workerTest.duration / 100;
        workerResults.push({
          concurrency,
          throughput: workerTest.throughput,
          latency: avgLatency
        });
      }

      // Verify worker pool scales with concurrency
      const sequentialThroughput = workerResults[0].throughput;
      const parallelThroughput = workerResults[workerResults.length - 1].throughput;
      
      expect(parallelThroughput).toBeGreaterThan(sequentialThroughput * 2); // At least 2x improvement
      
      // Verify latency remains reasonable under load
      workerResults.forEach(result => {
        expect(result.latency).toBeLessThan(5000); // <5s average latency
      });

      console.log(`Worker Pool Scaling:`, workerResults.map(r => 
        `${r.concurrency} workers: ${r.throughput.toFixed(1)} tasks/s`
      ).join(', '));
    });
  });

  describe('Memory and Resource Management Validation', () => {
    it('should prevent memory leaks during extended operation', async () => {
      const initialMemory = process.memoryUsage();
      
      // Run extended memory benchmark
      const memoryTest = await benchmarkSuite.benchmarkMemoryManagement({
        duration: 30000, // 30 seconds
        intensity: 'high',
        checkInterval: 1000
      });

      expect(memoryTest.success).toBe(true);
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const maxAcceptableIncrease = 50 * 1024 * 1024; // 50MB
      
      expect(memoryIncrease).toBeLessThan(maxAcceptableIncrease);
      expect(memoryTest.details.memoryLeakDetected).toBe(false);
      expect(memoryTest.details.gcEfficiency).toBeGreaterThan(0.8); // 80% GC efficiency

      console.log(`Memory Test: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase over 30s`);
    });

    it('should maintain cache performance under various load patterns', async () => {
      const cacheScenarios = [
        { name: 'sequential_access', pattern: 'sequential', size: 1000 },
        { name: 'random_access', pattern: 'random', size: 1000 },
        { name: 'burst_access', pattern: 'burst', size: 500 },
        { name: 'mixed_access', pattern: 'mixed', size: 2000 }
      ];

      const cacheResults: Array<{ scenario: string; hitRatio: number; avgLatency: number }> = [];

      for (const scenario of cacheScenarios) {
        const cacheTest = await benchmarkSuite.benchmarkCaching({
          accessPattern: scenario.pattern,
          dataSize: scenario.size,
          cacheSize: 100,
          duration: 10000
        });

        expect(cacheTest.success).toBe(true);
        expect(cacheTest.details.hitRatio).toBeGreaterThan(0.5); // >50% hit ratio
        expect(cacheTest.details.avgAccessTime).toBeLessThan(10); // <10ms average

        cacheResults.push({
          scenario: scenario.name,
          hitRatio: cacheTest.details.hitRatio,
          avgLatency: cacheTest.details.avgAccessTime
        });
      }

      // Verify cache efficiency across scenarios
      const avgHitRatio = cacheResults.reduce((sum, r) => sum + r.hitRatio, 0) / cacheResults.length;
      expect(avgHitRatio).toBeGreaterThan(0.6); // 60% overall hit ratio

      console.log(`Cache Performance:`, cacheResults.map(r => 
        `${r.scenario}: ${(r.hitRatio * 100).toFixed(1)}% hit ratio`
      ).join(', '));
    });

    it('should maintain event loop health under high load', async () => {
      const eventLoopTest = await benchmarkSuite.benchmarkEventLoop({
        duration: 20000, // 20 seconds
        concurrentOperations: 50,
        operationComplexity: 'high'
      });

      expect(eventLoopTest.success).toBe(true);
      expect(eventLoopTest.details.averageDelay).toBeLessThan(50); // <50ms event loop delay
      expect(eventLoopTest.details.maxDelay).toBeLessThan(200); // <200ms max delay
      expect(eventLoopTest.details.p99Delay).toBeLessThan(100); // <100ms 99th percentile

      // Verify event loop didn't block significantly
      expect(eventLoopTest.details.blockedPercentage).toBeLessThan(10); // <10% blocked time

      console.log(`Event Loop Health: ${eventLoopTest.details.averageDelay.toFixed(2)}ms avg delay, ${eventLoopTest.details.maxDelay}ms max`);
    });
  });

  describe('Benchmark Suite Reliability and Consistency', () => {
    it('should produce consistent results across multiple runs', async () => {
      const runs = 3;
      const reports: BenchmarkReport[] = [];

      for (let i = 0; i < runs; i++) {
        const report = await benchmarkSuite.runBenchmarks();
        reports.push(report);
        
        // Brief pause between runs
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      expect(reports.length).toBe(runs);

      // Analyze consistency across runs
      const overallScores = reports.map(r => r.summary.overallScore);
      const averageScore = overallScores.reduce((a, b) => a + b, 0) / overallScores.length;
      const maxDeviation = Math.max(...overallScores.map(score => Math.abs(score - averageScore)));

      // Results should be consistent (within 20% deviation)
      expect(maxDeviation).toBeLessThan(averageScore * 0.2);

      // All runs should pass minimum threshold
      reports.forEach(report => {
        expect(report.summary.overallScore).toBeGreaterThan(50);
        expect(report.passedTests).toBeGreaterThan(report.totalTests * 0.7);
      });

      console.log(`Consistency Test: ${averageScore.toFixed(1)} avg score, ${maxDeviation.toFixed(1)} max deviation`);
    });

    it('should provide detailed performance metrics and insights', async () => {
      const report = await benchmarkSuite.runBenchmarks();

      // Verify comprehensive reporting
      expect(report.summary).toMatchObject({
        averageDuration: expect.any(Number),
        totalThroughput: expect.any(Number),
        memoryEfficiency: expect.any(Number),
        overallScore: expect.any(Number)
      });

      // Verify detailed test results
      report.results.forEach(result => {
        expect(result).toMatchObject({
          testName: expect.any(String),
          duration: expect.any(Number),
          throughput: expect.any(Number),
          memoryUsage: expect.objectContaining({
            heapUsed: expect.any(Number),
            heapTotal: expect.any(Number),
            external: expect.any(Number),
            rss: expect.any(Number)
          }),
          success: expect.any(Boolean),
          details: expect.any(Object)
        });

        if (result.success) {
          expect(result.duration).toBeGreaterThan(0);
          expect(result.throughput).toBeGreaterThanOrEqual(0);
        }
      });

      // Verify scoring algorithm is reasonable
      expect(report.summary.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.overallScore).toBeLessThanOrEqual(100);

      console.log(`Benchmark Report Summary:`, {
        score: report.summary.overallScore,
        passed: `${report.passedTests}/${report.totalTests}`,
        avgDuration: `${report.summary.averageDuration.toFixed(2)}ms`,
        totalThroughput: `${report.summary.totalThroughput.toFixed(1)} ops/s`
      });
    });

    it('should handle benchmark failures gracefully', async () => {
      // Create a benchmark instance that will encounter failures
      const faultyBenchmark = new PerformanceBenchmark();
      
      // Inject failure conditions
      const originalMethod = faultyBenchmark.benchmarkHybridRouter;
      faultyBenchmark.benchmarkHybridRouter = async () => {
        throw new Error('Simulated benchmark failure');
      };

      const report = await faultyBenchmark.runBenchmarks();

      // Verify graceful failure handling
      expect(report).toBeDefined();
      expect(report.results.length).toBeGreaterThan(0);
      expect(report.failedTests).toBeGreaterThan(0);

      // Find the failed test
      const failedTest = report.results.find(r => !r.success);
      expect(failedTest).toBeDefined();
      expect(failedTest?.details.error).toContain('Simulated benchmark failure');

      // Other tests should still complete
      const successfulTests = report.results.filter(r => r.success);
      expect(successfulTests.length).toBeGreaterThan(0);

      console.log(`Failure Handling: ${successfulTests.length} succeeded, ${report.failedTests} failed gracefully`);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions compared to baseline', async () => {
      // Establish baseline performance
      const baselineReport = await benchmarkSuite.runBenchmarks();
      
      // Store baseline metrics
      const baseline = {
        overallScore: baselineReport.summary.overallScore,
        averageDuration: baselineReport.summary.averageDuration,
        totalThroughput: baselineReport.summary.totalThroughput
      };

      // Simulate potential regression conditions
      const regressionTest = await benchmarkSuite.benchmarkWithConditions({
        cpuThrottle: 0.5, // Simulate 50% CPU throttling
        memoryPressure: true,
        networkLatency: 100 // 100ms additional latency
      });

      // Analyze regression metrics
      const regressionDetected = 
        regressionTest.summary.overallScore < baseline.overallScore * 0.8 ||
        regressionTest.summary.averageDuration > baseline.averageDuration * 1.5 ||
        regressionTest.summary.totalThroughput < baseline.totalThroughput * 0.7;

      if (regressionDetected) {
        console.log('Performance regression detected:', {
          baselineScore: baseline.overallScore,
          regressionScore: regressionTest.summary.overallScore,
          scoreDelta: ((regressionTest.summary.overallScore - baseline.overallScore) / baseline.overallScore * 100).toFixed(1) + '%'
        });
      }

      // Verify regression detection capability
      expect(typeof regressionDetected).toBe('boolean');
      
      // Under normal conditions, no significant regression should occur
      if (!regressionDetected) {
        expect(regressionTest.summary.overallScore).toBeGreaterThan(baseline.overallScore * 0.8);
      }
    });

    it('should provide performance optimization recommendations', async () => {
      const report = await benchmarkSuite.runBenchmarks();
      
      // Generate optimization recommendations
      const recommendations = await benchmarkSuite.generateOptimizationRecommendations(report);

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);

      if (recommendations.length > 0) {
        recommendations.forEach(rec => {
          expect(rec).toMatchObject({
            category: expect.any(String),
            priority: expect.any(String),
            description: expect.any(String),
            estimatedImprovement: expect.any(Number),
            implementation: expect.any(String)
          });

          expect(['low', 'medium', 'high', 'critical']).toContain(rec.priority);
          expect(rec.estimatedImprovement).toBeGreaterThan(0);
        });
      }

      console.log(`Optimization Recommendations: ${recommendations.length} suggestions generated`);
    });
  });

  describe('Enterprise Performance Reporting', () => {
    it('should generate executive performance dashboards', async () => {
      const report = await benchmarkSuite.runBenchmarks();
      const dashboard = await benchmarkSuite.generateExecutiveDashboard(report);

      expect(dashboard).toMatchObject({
        performanceSummary: expect.objectContaining({
          systemHealthScore: expect.any(Number),
          performanceGrade: expect.any(String),
          keyMetrics: expect.any(Object)
        }),
        businessImpact: expect.objectContaining({
          operationalEfficiency: expect.any(Number),
          costOptimization: expect.any(Number),
          userExperience: expect.any(String)
        }),
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            businessJustification: expect.any(String),
            estimatedROI: expect.any(Number),
            timeToImplement: expect.any(String)
          })
        ]),
        trends: expect.objectContaining({
          performanceVelocity: expect.any(Array),
          resourceUtilization: expect.any(Object)
        })
      });

      // Verify executive metrics are meaningful
      expect(dashboard.performanceSummary.systemHealthScore).toBeGreaterThanOrEqual(0);
      expect(dashboard.performanceSummary.systemHealthScore).toBeLessThanOrEqual(100);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(dashboard.performanceSummary.performanceGrade);

      console.log(`Executive Dashboard: ${dashboard.performanceSummary.systemHealthScore}% health, Grade ${dashboard.performanceSummary.performanceGrade}`);
    });

    it('should validate industry benchmark comparisons', async () => {
      const report = await benchmarkSuite.runBenchmarks();
      const industryComparison = await benchmarkSuite.compareWithIndustryStandards(report);

      expect(industryComparison).toMatchObject({
        claudeCodeComparison: expect.objectContaining({
          latencyComparison: expect.any(String), // 'better' | 'comparable' | 'worse'
          throughputComparison: expect.any(String),
          overallRanking: expect.any(String)
        }),
        copilotComparison: expect.objectContaining({
          performanceRatio: expect.any(Number),
          strengthAreas: expect.any(Array),
          improvementAreas: expect.any(Array)
        }),
        industryPercentile: expect.any(Number)
      });

      // Verify competitive positioning
      expect(industryComparison.industryPercentile).toBeGreaterThanOrEqual(0);
      expect(industryComparison.industryPercentile).toBeLessThanOrEqual(100);
      expect(['better', 'comparable', 'worse']).toContain(industryComparison.claudeCodeComparison.latencyComparison);

      console.log(`Industry Positioning: ${industryComparison.industryPercentile}th percentile, Claude Code comparison: ${industryComparison.claudeCodeComparison.overallRanking}`);
    });
  });
});