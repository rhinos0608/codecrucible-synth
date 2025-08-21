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
<<<<<<< HEAD
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
=======
        });\n      }\n    }\n    \n    const report = this.generateReport();\n    logger.info('Performance benchmark completed');\n    this.emit('benchmark-completed', report);\n    \n    return report;\n  }\n  \n  /**\n   * Benchmark hybrid router routing decisions\n   */\n  private async benchmarkHybridRouter(): Promise<BenchmarkResult> {\n    const startTime = performance.now();\n    const memoryBefore = process.memoryUsage();\n    \n    const router = new HybridLLMRouter({\n      lmStudio: {\n        endpoint: 'http://localhost:1234',\n        enabled: true,\n        models: ['codellama-7b'],\n        maxConcurrent: 3,\n        strengths: ['speed', 'templates']\n      },\n      ollama: {\n        endpoint: 'http://localhost:11434',\n        enabled: true,\n        models: ['qwen2.5:72b'],\n        maxConcurrent: 1,\n        strengths: ['analysis', 'reasoning']\n      },\n      routing: {\n        defaultProvider: 'auto',\n        escalationThreshold: 0.7,\n        confidenceScoring: true,\n        learningEnabled: true\n      }\n    });\n    \n    // Test routing performance with various task types\n    const tasks = [\n      { type: 'template', prompt: 'Generate a React component' },\n      { type: 'format', prompt: 'Format this code snippet' },\n      { type: 'analysis', prompt: 'Analyze this complex system architecture' },\n      { type: 'security', prompt: 'Review for security vulnerabilities' },\n      { type: 'architecture', prompt: 'Design a microservices system' }\n    ];\n    \n    const routingResults = [];\n    \n    for (let i = 0; i < 100; i++) {\n      const task = tasks[i % tasks.length];\n      const decision = await router.routeTask(task.type, task.prompt);\n      routingResults.push(decision);\n    }\n    \n    router.destroy();\n    \n    const duration = performance.now() - startTime;\n    const memoryAfter = process.memoryUsage();\n    const throughput = routingResults.length / (duration / 1000);\n    \n    // Validate routing intelligence\n    const templateToLMStudio = routingResults\n      .filter(r => r.selectedLLM === 'lm-studio').length;\n    const analysisToOllama = routingResults\n      .filter(r => r.selectedLLM === 'ollama').length;\n    \n    return {\n      testName: 'Hybrid Router Performance',\n      duration,\n      throughput,\n      memoryUsage: memoryAfter,\n      success: duration < 1000 && throughput > 50, // Target: <1s, >50 ops/sec\n      details: {\n        totalDecisions: routingResults.length,\n        templateToLMStudio,\n        analysisToOllama,\n        averageResponseTime: routingResults.reduce((sum, r) => sum + r.estimatedResponseTime, 0) / routingResults.length,\n        memoryDelta: memoryAfter.heapUsed - memoryBefore.heapUsed\n      }\n    };\n  }\n  \n  /**\n   * Benchmark batch processing efficiency\n   */\n  private async benchmarkBatchProcessor(): Promise<BenchmarkResult> {\n    const startTime = performance.now();\n    const memoryBefore = process.memoryUsage();\n    \n    // Test optimal batch size (64 per research)\n    const requests = Array.from({ length: 100 }, (_, i) => \n      intelligentBatchProcessor.queueRequest(\n        `Test prompt ${i}`,\n        { complexity: Math.random() },\n        i % 3 === 0 ? 'high' : 'medium'\n      )\n    );\n    \n    const results = await Promise.allSettled(requests);\n    \n    const duration = performance.now() - startTime;\n    const memoryAfter = process.memoryUsage();\n    const throughput = results.length / (duration / 1000);\n    \n    const successCount = results.filter(r => r.status === 'fulfilled').length;\n    const failureCount = results.length - successCount;\n    \n    return {\n      testName: 'Batch Processing Efficiency',\n      duration,\n      throughput,\n      memoryUsage: memoryAfter,\n      success: duration < 5000 && successCount / results.length > 0.95, // Target: <5s, >95% success\n      details: {\n        totalRequests: results.length,\n        successCount,\n        failureCount,\n        batchStatus: intelligentBatchProcessor.getStatus(),\n        memoryDelta: memoryAfter.heapUsed - memoryBefore.heapUsed\n      }\n    };\n  }\n  \n  /**\n   * Benchmark worker pool throughput\n   */\n  private async benchmarkWorkerPool(): Promise<BenchmarkResult> {\n    const startTime = performance.now();\n    const memoryBefore = process.memoryUsage();\n    \n    // Test worker pool with analysis tasks\n    const files = Array.from({ length: 20 }, (_, i) => `test-file-${i}.ts`);\n    const config = {\n      endpoint: 'http://localhost:11434',\n      providers: [{ type: 'ollama' as const }],\n      executionMode: 'auto' as const,\n      fallbackChain: ['ollama' as const],\n      performanceThresholds: {\n        fastModeMaxTokens: 2048,\n        timeoutMs: 10000, // Reduced for benchmark\n        maxConcurrentRequests: 2\n      },\n      security: {\n        enableSandbox: true,\n        maxInputLength: 10000,\n        allowedCommands: ['node']\n      }\n    };\n    \n    try {\n      const result = await analysisWorkerPool.executeAnalysis({\n        id: 'benchmark-test',\n        files,\n        prompt: 'Analyze these test files',\n        options: { maxFiles: 20 },\n        timeout: 10000\n      }, config);\n      \n      const duration = performance.now() - startTime;\n      const memoryAfter = process.memoryUsage();\n      const throughput = files.length / (duration / 1000);\n      \n      return {\n        testName: 'Worker Pool Throughput',\n        duration,\n        throughput,\n        memoryUsage: memoryAfter,\n        success: result.success && duration < 15000, // Target: <15s for 20 files\n        details: {\n          filesProcessed: files.length,\n          workerResult: result,\n          memoryDelta: memoryAfter.heapUsed - memoryBefore.heapUsed\n        }\n      };\n      \n    } catch (error) {\n      const duration = performance.now() - startTime;\n      const memoryAfter = process.memoryUsage();\n      \n      return {\n        testName: 'Worker Pool Throughput',\n        duration,\n        throughput: 0,\n        memoryUsage: memoryAfter,\n        success: false,\n        details: {\n          error: error instanceof Error ? error.message : 'Unknown error',\n          filesRequested: files.length\n        }\n      };\n    }\n  }\n  \n  /**\n   * Benchmark memory management and leak prevention\n   */\n  private async benchmarkMemoryManagement(): Promise<BenchmarkResult> {\n    const startTime = performance.now();\n    const memoryBefore = process.memoryUsage();\n    \n    // Simulate heavy operations to test memory management\n    const operations = [];\n    \n    for (let i = 0; i < 50; i++) {\n      operations.push(new Promise(resolve => {\n        // Simulate EventEmitter usage\n        const emitter = new EventEmitter();\n        emitter.setMaxListeners(20);\n        \n        // Add listeners\n        const listeners = Array.from({ length: 10 }, (_, j) => \n          () => console.log(`Event ${i}-${j}`)\n        );\n        \n        listeners.forEach(listener => emitter.on('test', listener));\n        \n        // Emit events\n        emitter.emit('test');\n        \n        // Cleanup\n        emitter.removeAllListeners();\n        \n        setTimeout(resolve, 10);\n      }));\n    }\n    \n    await Promise.all(operations);\n    \n    // Force garbage collection if available\n    if (global.gc) {\n      global.gc();\n    }\n    \n    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for cleanup\n    \n    const duration = performance.now() - startTime;\n    const memoryAfter = process.memoryUsage();\n    const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;\n    \n    return {\n      testName: 'Memory Leak Prevention',\n      duration,\n      throughput: operations.length / (duration / 1000),\n      memoryUsage: memoryAfter,\n      success: memoryDelta < 50 * 1024 * 1024, // Target: <50MB memory increase\n      details: {\n        operationsCompleted: operations.length,\n        memoryDelta,\n        memoryDeltaMB: memoryDelta / (1024 * 1024),\n        memoryBefore: memoryBefore.heapUsed,\n        memoryAfter: memoryAfter.heapUsed\n      }\n    };\n  }\n  \n  /**\n   * Benchmark caching performance\n   */\n  private async benchmarkCaching(): Promise<BenchmarkResult> {\n    const startTime = performance.now();\n    const memoryBefore = process.memoryUsage();\n    \n    const router = new HybridLLMRouter({\n      lmStudio: { endpoint: 'http://localhost:1234', enabled: true, models: [], maxConcurrent: 3, strengths: [] },\n      ollama: { endpoint: 'http://localhost:11434', enabled: true, models: [], maxConcurrent: 1, strengths: [] },\n      routing: { defaultProvider: 'auto', escalationThreshold: 0.7, confidenceScoring: true, learningEnabled: true }\n    });\n    \n    // Test cache hit performance\n    const testPrompt = 'Analyze this code for performance issues';\n    const testType = 'analysis';\n    \n    // First call - cache miss\n    const firstCall = performance.now();\n    await router.routeTask(testType, testPrompt);\n    const firstCallDuration = performance.now() - firstCall;\n    \n    // Second call - should hit cache\n    const secondCall = performance.now();\n    await router.routeTask(testType, testPrompt);\n    const secondCallDuration = performance.now() - secondCall;\n    \n    // Third call - different prompt to test cache behavior\n    await router.routeTask(testType, 'Different prompt for testing');\n    \n    const cacheStatus = router.getCacheStatus();\n    router.destroy();\n    \n    const duration = performance.now() - startTime;\n    const memoryAfter = process.memoryUsage();\n    const cacheSpeedup = firstCallDuration / secondCallDuration;\n    \n    return {\n      testName: 'Cache Performance',\n      duration,\n      throughput: 3 / (duration / 1000), // 3 operations\n      memoryUsage: memoryAfter,\n      success: cacheSpeedup > 2 && cacheStatus.size > 0, // Target: >2x speedup\n      details: {\n        firstCallDuration,\n        secondCallDuration,\n        cacheSpeedup,\n        cacheStatus,\n        memoryDelta: memoryAfter.heapUsed - memoryBefore.heapUsed\n      }\n    };\n  }\n  \n  /**\n   * Benchmark event loop health\n   */\n  private async benchmarkEventLoop(): Promise<BenchmarkResult> {\n    const startTime = performance.now();\n    const memoryBefore = process.memoryUsage();\n    \n    const lagMeasurements: number[] = [];\n    let measurementCount = 0;\n    const maxMeasurements = 50;\n    \n    const measureLag = () => {\n      const start = performance.now();\n      setImmediate(() => {\n        const lag = performance.now() - start;\n        lagMeasurements.push(lag);\n        measurementCount++;\n        \n        if (measurementCount < maxMeasurements) {\n          setTimeout(measureLag, 10);\n        }\n      });\n    };\n    \n    // Start lag measurement\n    measureLag();\n    \n    // Simulate some async work\n    await new Promise(resolve => {\n      let completed = 0;\n      for (let i = 0; i < 20; i++) {\n        setTimeout(() => {\n          // Simulate some work\n          const data = Array.from({ length: 1000 }, (_, j) => j * Math.random());\n          data.sort();\n          \n          completed++;\n          if (completed === 20) {\n            resolve(undefined);\n          }\n        }, i * 10);\n      }\n    });\n    \n    // Wait for lag measurements to complete\n    while (measurementCount < maxMeasurements) {\n      await new Promise(resolve => setTimeout(resolve, 20));\n    }\n    \n    const duration = performance.now() - startTime;\n    const memoryAfter = process.memoryUsage();\n    \n    const averageLag = lagMeasurements.reduce((sum, lag) => sum + lag, 0) / lagMeasurements.length;\n    const maxLag = Math.max(...lagMeasurements);\n    \n    return {\n      testName: 'Event Loop Health',\n      duration,\n      throughput: lagMeasurements.length / (duration / 1000),\n      memoryUsage: memoryAfter,\n      success: averageLag < 10 && maxLag < 100, // Target: <10ms avg, <100ms max\n      details: {\n        measurements: lagMeasurements.length,\n        averageLag,\n        maxLag,\n        minLag: Math.min(...lagMeasurements),\n        lagDistribution: {\n          p50: this.percentile(lagMeasurements, 0.5),\n          p95: this.percentile(lagMeasurements, 0.95),\n          p99: this.percentile(lagMeasurements, 0.99)\n        }\n      }\n    };\n  }\n  \n  /**\n   * Calculate percentile from array of numbers\n   */\n  private percentile(values: number[], p: number): number {\n    const sorted = values.slice().sort((a, b) => a - b);\n    const index = Math.ceil(sorted.length * p) - 1;\n    return sorted[index];\n  }\n  \n  /**\n   * Generate comprehensive benchmark report\n   */\n  private generateReport(): BenchmarkReport {\n    const passedTests = this.results.filter(r => r.success).length;\n    const failedTests = this.results.length - passedTests;\n    \n    const averageDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;\n    const totalThroughput = this.results.reduce((sum, r) => sum + r.throughput, 0);\n    const memoryEfficiency = this.calculateMemoryEfficiency();\n    const overallScore = this.calculateOverallScore();\n    \n    return {\n      timestamp: new Date().toISOString(),\n      totalTests: this.results.length,\n      passedTests,\n      failedTests,\n      results: this.results,\n      summary: {\n        averageDuration,\n        totalThroughput,\n        memoryEfficiency,\n        overallScore\n      }\n    };\n  }\n  \n  /**\n   * Calculate memory efficiency score\n   */\n  private calculateMemoryEfficiency(): number {\n    const memoryResults = this.results\n      .filter(r => r.details.memoryDelta !== undefined)\n      .map(r => r.details.memoryDelta);\n    \n    if (memoryResults.length === 0) return 0;\n    \n    const averageMemoryIncrease = memoryResults.reduce((sum, delta) => sum + delta, 0) / memoryResults.length;\n    const maxAcceptableIncrease = 10 * 1024 * 1024; // 10MB\n    \n    return Math.max(0, 100 - (averageMemoryIncrease / maxAcceptableIncrease) * 100);\n  }\n  \n  /**\n   * Calculate overall performance score\n   */\n  private calculateOverallScore(): number {\n    const successRate = (this.results.filter(r => r.success).length / this.results.length) * 100;\n    const throughputScore = Math.min(100, (this.summary.totalThroughput / 100) * 100);\n    const memoryScore = this.calculateMemoryEfficiency();\n    \n    return (successRate * 0.5) + (throughputScore * 0.3) + (memoryScore * 0.2);\n  }\n  \n  private get summary() {\n    return {\n      totalThroughput: this.results.reduce((sum, r) => sum + r.throughput, 0)\n    };\n  }\n}\n\n// Export singleton instance for easy usage\nexport const performanceBenchmark = new PerformanceBenchmark();
>>>>>>> 44ae8383dd29cf64d817a2f2858150305ea5525d
