/**
 * Performance Benchmarking Suite
 * Validates the research-driven optimizations implemented
 */

import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { HybridLLMRouter } from '../hybrid/hybrid-llm-router.js';
import { intelligentBatchProcessor } from './intelligent-batch-processor.js';
import { analysisWorkerPool } from '../workers/analysis-worker.js';

export interface BenchmarkResult {
  testName: string;
  duration: number;
  throughput: number;
  memoryUsage: NodeJS.MemoryUsage;
  success: boolean;
  details: Record<string, any>;
}

export interface BenchmarkReport {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: BenchmarkResult[];
  summary: {
    averageDuration: number;
    totalThroughput: number;
    memoryEfficiency: number;
    overallScore: number;
  };
}

/**
 * Comprehensive performance benchmark suite
 */
export class PerformanceBenchmark extends EventEmitter {
  private startTime: number = 0;
  private results: BenchmarkResult[] = [];
  
  constructor() {
    super();
  }
  
  /**
   * Run comprehensive benchmark suite
   */
  async runBenchmarks(): Promise<BenchmarkReport> {
    logger.info('Starting performance benchmark suite...');
    this.startTime = performance.now();
    this.results = [];
    
    const tests = [
      { name: 'Hybrid Router Performance', fn: () => this.benchmarkHybridRouter() },
      { name: 'Batch Processing Efficiency', fn: () => this.benchmarkBatchProcessor() },
      { name: 'Worker Pool Throughput', fn: () => this.benchmarkWorkerPool() },
      { name: 'Memory Leak Prevention', fn: () => this.benchmarkMemoryManagement() },
      { name: 'Cache Performance', fn: () => this.benchmarkCaching() },
      { name: 'Event Loop Health', fn: () => this.benchmarkEventLoop() },
    ];
    
    for (const test of tests) {
      try {
        logger.info(`Running benchmark: ${test.name}`);
        const result = await test.fn();
        this.results.push(result);
        this.emit('test-completed', result);
      } catch (error) {
        logger.error(`Benchmark failed: ${test.name}`, error);
        this.results.push({
          testName: test.name,
          duration: 0,
          throughput: 0,
          memoryUsage: process.memoryUsage(),
          success: false,
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    }
    
    const report = this.generateReport();
    logger.info('Performance benchmark completed');
    this.emit('benchmark-completed', report);
    
    return report;
  }
  
  /**
   * Benchmark hybrid router routing decisions
   */
  private async benchmarkHybridRouter(): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage();
    
    const router = new HybridLLMRouter({
      lmStudio: {
        endpoint: 'http://localhost:1234',
        enabled: true,
        models: ['codellama-7b'],
        maxConcurrent: 3,
        strengths: ['speed', 'templates']
      },
      ollama: {
        endpoint: 'http://localhost:11434',
        enabled: true,
        models: ['qwen2.5:72b'],
        maxConcurrent: 1,
        strengths: ['analysis', 'reasoning']
      },
      routing: {
        defaultProvider: 'auto',
        escalationThreshold: 0.7,
        confidenceScoring: true,
        learningEnabled: true
      }
    });
    
    // Test routing performance with various task types
    const tasks = [
      { type: 'template', prompt: 'Generate a React component' },
      { type: 'format', prompt: 'Format this code snippet' },
      { type: 'analysis', prompt: 'Analyze this complex system architecture' },
      { type: 'security', prompt: 'Review for security vulnerabilities' },
      { type: 'architecture', prompt: 'Design a microservices system' }
    ];
    
    const routingResults = [];
    
    for (let i = 0; i < 100; i++) {
      const task = tasks[i % tasks.length];
      const decision = await router.routeTask(task.type, task.prompt);
      routingResults.push(decision);
    }
    
    router.destroy();
    
    const duration = performance.now() - startTime;
    const memoryAfter = process.memoryUsage();
    const throughput = routingResults.length / (duration / 1000);
    
    // Validate routing intelligence
    const templateToLMStudio = routingResults
      .filter(r => r.selectedLLM === 'lm-studio').length;
    const analysisToOllama = routingResults
      .filter(r => r.selectedLLM === 'ollama').length;
    
    return {
      testName: 'Hybrid Router Performance',
      duration,
      throughput,
      memoryUsage: memoryAfter,
      success: duration < 1000 && throughput > 50, // Target: <1s, >50 ops/sec
      details: {
        totalDecisions: routingResults.length,
        templateToLMStudio,
        analysisToOllama,
        averageResponseTime: routingResults.reduce((sum, r) => sum + r.estimatedResponseTime, 0) / routingResults.length,
        memoryDelta: memoryAfter.heapUsed - memoryBefore.heapUsed
      }
    };
  }
  
  /**
   * Benchmark batch processing efficiency
   */
  private async benchmarkBatchProcessor(): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage();
    
    // Test optimal batch size (64 per research)
    const requests = Array.from({ length: 100 }, (_, i) => 
      intelligentBatchProcessor.queueRequest(
        `Test prompt ${i}`,
        { complexity: Math.random() },
        i % 3 === 0 ? 'high' : 'medium'
      )
    );
    
    const results = await Promise.allSettled(requests);
    
    const duration = performance.now() - startTime;
    const memoryAfter = process.memoryUsage();
    const throughput = results.length / (duration / 1000);
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.length - successCount;
    
    return {
      testName: 'Batch Processing Efficiency',
      duration,
      throughput,
      memoryUsage: memoryAfter,
      success: duration < 5000 && successCount / results.length > 0.95, // Target: <5s, >95% success
      details: {
        totalRequests: results.length,
        successCount,
        failureCount,
        batchStatus: intelligentBatchProcessor.getStatus(),
        memoryDelta: memoryAfter.heapUsed - memoryBefore.heapUsed
      }
    };
  }
  
  /**
   * Benchmark worker pool throughput
   */
  private async benchmarkWorkerPool(): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage();
    
    // Test worker pool with analysis tasks
    const files = Array.from({ length: 20 }, (_, i) => `test-file-${i}.ts`);
    const config = {
      endpoint: 'http://localhost:11434',
      providers: [{ type: 'ollama' as const }],
      executionMode: 'auto' as const,
      fallbackChain: ['ollama' as const],
      performanceThresholds: {
        fastModeMaxTokens: 2048,
        timeoutMs: 10000, // Reduced for benchmark
        maxConcurrentRequests: 2
      },
      security: {
        enableSandbox: true,
        maxInputLength: 10000,
        allowedCommands: ['node']
      }
    };
    
    try {
      const result = await analysisWorkerPool.executeAnalysis({
        id: 'benchmark-test',
        files,
        prompt: 'Analyze these test files',
        options: { maxFiles: 20 },
        timeout: 10000
      }, config);
      
      const duration = performance.now() - startTime;
      const memoryAfter = process.memoryUsage();
      const throughput = files.length / (duration / 1000);
      
      return {
        testName: 'Worker Pool Throughput',
        duration,
        throughput,
        memoryUsage: memoryAfter,
        success: result.success && duration < 15000, // Target: <15s for 20 files
        details: {
          filesProcessed: files.length,
          workerResult: result,
          memoryDelta: memoryAfter.heapUsed - memoryBefore.heapUsed
        }
      };
      
    } catch (error) {
      const duration = performance.now() - startTime;
      const memoryAfter = process.memoryUsage();
      
      return {
        testName: 'Worker Pool Throughput',
        duration,
        throughput: 0,
        memoryUsage: memoryAfter,
        success: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          filesRequested: files.length
        }
      };
    }
  }
  
  /**
   * Benchmark memory management and leak prevention
   */
  private async benchmarkMemoryManagement(): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage();
    
    // Simulate heavy operations to test memory management
    const operations = [];
    
    for (let i = 0; i < 50; i++) {
      operations.push(new Promise(resolve => {
        // Simulate EventEmitter usage
        const emitter = new EventEmitter();
        emitter.setMaxListeners(20);
        
        // Add listeners
        const listeners = Array.from({ length: 10 }, (_, j) => 
          () => console.log(`Event ${i}-${j}`)
        );
        
        listeners.forEach(listener => emitter.on('test', listener));
        
        // Emit events
        emitter.emit('test');
        
        // Cleanup
        emitter.removeAllListeners();
        
        setTimeout(resolve, 10);
      }));
    }
    
    await Promise.all(operations);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for cleanup
    
    const duration = performance.now() - startTime;
    const memoryAfter = process.memoryUsage();
    const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
    
    return {
      testName: 'Memory Leak Prevention',
      duration,
      throughput: operations.length / (duration / 1000),
      memoryUsage: memoryAfter,
      success: memoryDelta < 50 * 1024 * 1024, // Target: <50MB memory increase
      details: {
        operationsCompleted: operations.length,
        memoryDelta,
        memoryDeltaMB: memoryDelta / (1024 * 1024),
        memoryBefore: memoryBefore.heapUsed,
        memoryAfter: memoryAfter.heapUsed
      }
    };
  }
  
  /**
   * Benchmark caching performance
   */
  private async benchmarkCaching(): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage();
    
    const router = new HybridLLMRouter({
      lmStudio: { endpoint: 'http://localhost:1234', enabled: true, models: [], maxConcurrent: 3, strengths: [] },
      ollama: { endpoint: 'http://localhost:11434', enabled: true, models: [], maxConcurrent: 1, strengths: [] },
      routing: { defaultProvider: 'auto', escalationThreshold: 0.7, confidenceScoring: true, learningEnabled: true }
    });
    
    // Test cache hit performance
    const testPrompt = 'Analyze this code for performance issues';
    const testType = 'analysis';
    
    // First call - cache miss
    const firstCall = performance.now();
    await router.routeTask(testType, testPrompt);
    const firstCallDuration = performance.now() - firstCall;
    
    // Second call - should hit cache
    const secondCall = performance.now();
    await router.routeTask(testType, testPrompt);
    const secondCallDuration = performance.now() - secondCall;
    
    // Third call - different prompt to test cache behavior
    await router.routeTask(testType, 'Different prompt for testing');
    
    const cacheStatus = router.getCacheStatus();
    router.destroy();
    
    const duration = performance.now() - startTime;
    const memoryAfter = process.memoryUsage();
    const cacheSpeedup = firstCallDuration / secondCallDuration;
    
    return {
      testName: 'Cache Performance',
      duration,
      throughput: 3 / (duration / 1000), // 3 operations
      memoryUsage: memoryAfter,
      success: cacheSpeedup > 2 && cacheStatus.size > 0, // Target: >2x speedup
      details: {
        firstCallDuration,
        secondCallDuration,
        cacheSpeedup,
        cacheStatus,
        memoryDelta: memoryAfter.heapUsed - memoryBefore.heapUsed
      }
    };
  }
  
  /**
   * Benchmark event loop health
   */
  private async benchmarkEventLoop(): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage();
    
    const lagMeasurements: number[] = [];
    let measurementCount = 0;
    const maxMeasurements = 50;
    
    const measureLag = () => {
      const start = performance.now();
      setImmediate(() => {
        const lag = performance.now() - start;
        lagMeasurements.push(lag);
        measurementCount++;
        
        if (measurementCount < maxMeasurements) {
          setTimeout(measureLag, 10);
        }
      });
    };
    
    // Start lag measurement
    measureLag();
    
    // Simulate some async work
    await new Promise(resolve => {
      let completed = 0;
      for (let i = 0; i < 20; i++) {
        setTimeout(() => {
          // Simulate some work
          const data = Array.from({ length: 1000 }, (_, j) => j * Math.random());
          data.sort();
          
          completed++;
          if (completed === 20) {
            resolve(undefined);
          }
        }, i * 10);
      }
    });
    
    // Wait for lag measurements to complete
    while (measurementCount < maxMeasurements) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    
    const duration = performance.now() - startTime;
    const memoryAfter = process.memoryUsage();
    
    const averageLag = lagMeasurements.reduce((sum, lag) => sum + lag, 0) / lagMeasurements.length;
    const maxLag = Math.max(...lagMeasurements);
    
    return {
      testName: 'Event Loop Health',
      duration,
      throughput: lagMeasurements.length / (duration / 1000),
      memoryUsage: memoryAfter,
      success: averageLag < 10 && maxLag < 100, // Target: <10ms avg, <100ms max
      details: {
        measurements: lagMeasurements.length,
        averageLag,
        maxLag,
        minLag: Math.min(...lagMeasurements),
        lagDistribution: {
          p50: this.percentile(lagMeasurements, 0.5),
          p95: this.percentile(lagMeasurements, 0.95),
          p99: this.percentile(lagMeasurements, 0.99)
        }
      }
    };
  }
  
  /**
   * Calculate percentile from array of numbers
   */
  private percentile(values: number[], p: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }
  
  /**
   * Generate comprehensive benchmark report
   */
  private generateReport(): BenchmarkReport {
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = this.results.length - passedTests;
    
    const averageDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    const totalThroughput = this.results.reduce((sum, r) => sum + r.throughput, 0);
    const memoryEfficiency = this.calculateMemoryEfficiency();
    const overallScore = this.calculateOverallScore();
    
    return {
      timestamp: new Date().toISOString(),
      totalTests: this.results.length,
      passedTests,
      failedTests,
      results: this.results,
      summary: {
        averageDuration,
        totalThroughput,
        memoryEfficiency,
        overallScore
      }
    };
  }
  
  /**
   * Calculate memory efficiency score
   */
  private calculateMemoryEfficiency(): number {
    const memoryResults = this.results
      .filter(r => r.details.memoryDelta !== undefined)
      .map(r => r.details.memoryDelta);
    
    if (memoryResults.length === 0) return 0;
    
    const averageMemoryIncrease = memoryResults.reduce((sum, delta) => sum + delta, 0) / memoryResults.length;
    const maxAcceptableIncrease = 10 * 1024 * 1024; // 10MB
    
    return Math.max(0, 100 - (averageMemoryIncrease / maxAcceptableIncrease) * 100);
  }
  
  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(): number {
    const successRate = (this.results.filter(r => r.success).length / this.results.length) * 100;
    const throughputScore = Math.min(100, (this.summary.totalThroughput / 100) * 100);
    const memoryScore = this.calculateMemoryEfficiency();
    
    return (successRate * 0.5) + (throughputScore * 0.3) + (memoryScore * 0.2);
  }
  
  private get summary() {
    return {
      totalThroughput: this.results.reduce((sum, r) => sum + r.throughput, 0)
    };
  }
}

// Export singleton instance for easy usage
export const performanceBenchmark = new PerformanceBenchmark();
