#!/usr/bin/env node

/**
 * CodeCrucible Synth - Targeted Performance Analysis
 * Focuses on core system performance and identifies bottlenecks
 */

import { spawn } from 'child_process';
import { performance } from 'perf_hooks';
import os from 'os';

class TargetedPerformanceAnalysis {
  constructor() {
    this.results = new Map();
    this.startTime = Date.now();
    this.testData = {
      fastCommands: ['--help', '--version'],
      slowCommands: ['status', 'models'],
      errorCommands: ['nonexistent', '--invalid-flag'],
    };
  }

  async initialize() {
    console.log('🎯 CodeCrucible Synth - Targeted Performance Analysis');
    console.log('===================================================');
    console.log(`System: Node.js ${process.version} on ${os.platform()} ${os.arch()}`);
    console.log(
      `Resources: ${os.cpus().length} CPU cores, ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB RAM\n`
    );
  }

  async runAnalysis() {
    const analyses = [
      { name: 'Fast Command Performance', test: this.analyzeFastCommands.bind(this) },
      { name: 'Slow Command Analysis', test: this.analyzeSlowCommands.bind(this) },
      { name: 'Memory Baseline', test: this.analyzeMemoryBaseline.bind(this) },
      { name: 'Startup Performance', test: this.analyzeStartupPerformance.bind(this) },
      { name: 'Error Handling Speed', test: this.analyzeErrorHandling.bind(this) },
      { name: 'Concurrent Load Test', test: this.analyzeConcurrentLoad.bind(this) },
      { name: 'System Resource Usage', test: this.analyzeResourceUsage.bind(this) },
    ];

    for (const analysis of analyses) {
      console.log(`\n🔍 ${analysis.name}`);
      console.log('─'.repeat(50));

      const startTime = performance.now();
      try {
        const result = await analysis.test();
        const duration = performance.now() - startTime;

        this.results.set(analysis.name, {
          status: 'COMPLETED',
          duration: Math.round(duration),
          metrics: result,
        });

        console.log(`✅ Completed in ${Math.round(duration)}ms`);
        this.displayMetrics(result);
      } catch (error) {
        const duration = performance.now() - startTime;

        this.results.set(analysis.name, {
          status: 'FAILED',
          duration: Math.round(duration),
          error: error.message,
        });

        console.log(`❌ Failed after ${Math.round(duration)}ms: ${error.message}`);
      }

      // Brief pause between analyses
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await this.generateComprehensiveReport();
  }

  async analyzeFastCommands() {
    const results = {
      commands: [],
      averageTime: 0,
      reliability: 0,
      throughput: 0,
    };

    let totalTime = 0;
    let successCount = 0;

    for (const cmd of this.testData.fastCommands) {
      const iterations = 5;
      const times = [];
      let cmdSuccesses = 0;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const result = await this.executeCommand([cmd], 10000); // 10s timeout
        const duration = performance.now() - startTime;

        times.push(duration);
        totalTime += duration;

        if (result.code === 0) {
          cmdSuccesses++;
          successCount++;
        }
      }

      results.commands.push({
        command: cmd,
        averageTime: Math.round(times.reduce((a, b) => a + b) / times.length),
        minTime: Math.round(Math.min(...times)),
        maxTime: Math.round(Math.max(...times)),
        successRate: cmdSuccesses / iterations,
        reliability:
          cmdSuccesses === iterations ? 'EXCELLENT' : cmdSuccesses > 0 ? 'PARTIAL' : 'FAILED',
      });
    }

    results.averageTime = Math.round(totalTime / (this.testData.fastCommands.length * 5));
    results.reliability = successCount / (this.testData.fastCommands.length * 5);
    results.throughput = 1000 / results.averageTime; // Commands per second

    return results;
  }

  async analyzeSlowCommands() {
    const results = {
      commands: [],
      timeoutRate: 0,
      hangingCommands: [],
    };

    for (const cmd of this.testData.slowCommands) {
      console.log(`   Testing ${cmd}...`);

      const startTime = performance.now();
      const result = await this.executeCommand([cmd], 30000); // 30s timeout
      const duration = performance.now() - startTime;

      const commandResult = {
        command: cmd,
        duration: Math.round(duration),
        timedOut: result.timedOut || false,
        completed: result.code !== undefined,
        status: result.timedOut ? 'TIMEOUT' : result.code === 0 ? 'SUCCESS' : 'ERROR',
      };

      results.commands.push(commandResult);

      if (result.timedOut) {
        results.hangingCommands.push(cmd);
      }
    }

    results.timeoutRate = results.hangingCommands.length / this.testData.slowCommands.length;

    return results;
  }

  async analyzeMemoryBaseline() {
    const results = {
      initialMemory: 0,
      memoryAfterOperations: 0,
      peakMemory: 0,
      memoryEfficiency: 'UNKNOWN',
      garbageCollectionImpact: 0,
    };

    // Capture initial memory
    if (global.gc) global.gc();
    await new Promise(resolve => setTimeout(resolve, 100));

    const initial = process.memoryUsage();
    results.initialMemory = Math.round(initial.heapUsed / 1024 / 1024);

    // Perform operations and track memory
    const memorySnapshots = [];

    for (let i = 0; i < 5; i++) {
      await this.executeCommand(['--version'], 5000);
      const snapshot = process.memoryUsage();
      memorySnapshots.push(snapshot.heapUsed / 1024 / 1024);
    }

    results.peakMemory = Math.round(Math.max(...memorySnapshots));

    // Force garbage collection and measure
    if (global.gc) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const final = process.memoryUsage();
    results.memoryAfterOperations = Math.round(final.heapUsed / 1024 / 1024);
    results.garbageCollectionImpact = results.peakMemory - results.memoryAfterOperations;

    // Assess efficiency
    const memoryIncrease = results.memoryAfterOperations - results.initialMemory;
    if (memoryIncrease < 10) {
      results.memoryEfficiency = 'EXCELLENT';
    } else if (memoryIncrease < 50) {
      results.memoryEfficiency = 'GOOD';
    } else {
      results.memoryEfficiency = 'POOR';
    }

    return results;
  }

  async analyzeStartupPerformance() {
    const results = {
      startupTimes: [],
      averageStartup: 0,
      consistentStartup: true,
      startupReliability: 0,
    };

    // Test startup performance with multiple runs
    for (let i = 0; i < 3; i++) {
      const startTime = performance.now();
      const result = await this.executeCommand(['--version'], 15000);
      const startupTime = performance.now() - startTime;

      results.startupTimes.push({
        iteration: i + 1,
        time: Math.round(startupTime),
        successful: result.code === 0,
      });
    }

    const successfulStartups = results.startupTimes.filter(s => s.successful);
    results.startupReliability = successfulStartups.length / results.startupTimes.length;

    if (successfulStartups.length > 0) {
      const times = successfulStartups.map(s => s.time);
      results.averageStartup = Math.round(times.reduce((a, b) => a + b) / times.length);

      const variance =
        times.reduce((sum, time) => sum + Math.pow(time - results.averageStartup, 2), 0) /
        times.length;
      results.consistentStartup = Math.sqrt(variance) < results.averageStartup * 0.2; // Less than 20% variance
    }

    return results;
  }

  async analyzeErrorHandling() {
    const results = {
      errorResponses: [],
      averageErrorTime: 0,
      gracefulFailures: 0,
    };

    let totalErrorTime = 0;

    for (const cmd of this.testData.errorCommands) {
      const startTime = performance.now();
      const result = await this.executeCommand([cmd], 10000);
      const duration = performance.now() - startTime;

      totalErrorTime += duration;

      const errorResponse = {
        command: cmd,
        responseTime: Math.round(duration),
        graceful: result.code !== undefined && !result.timedOut,
        hasErrorMessage:
          (result.stderr && result.stderr.length > 0) ||
          (result.stdout && result.stdout.includes('error')),
      };

      results.errorResponses.push(errorResponse);

      if (errorResponse.graceful) {
        results.gracefulFailures++;
      }
    }

    results.averageErrorTime = Math.round(totalErrorTime / this.testData.errorCommands.length);

    return results;
  }

  async analyzeConcurrentLoad() {
    const results = {
      concurrencyLevels: [],
      maxStableConcurrency: 0,
      loadCapacity: 'UNKNOWN',
    };

    const levels = [3, 5, 8];

    for (const level of levels) {
      console.log(`   Testing ${level} concurrent operations...`);

      const operations = [];
      const startTime = performance.now();

      // Create concurrent operations
      for (let i = 0; i < level; i++) {
        operations.push(
          this.executeCommand(['--version'], 8000)
            .then(result => ({
              success: result.code === 0,
              id: i,
              duration: performance.now() - startTime,
            }))
            .catch(error => ({ success: false, id: i, error: error.message }))
        );
      }

      const operationResults = await Promise.all(operations);
      const totalDuration = performance.now() - startTime;
      const successCount = operationResults.filter(r => r.success).length;
      const successRate = successCount / level;

      const levelResult = {
        level,
        successCount,
        successRate,
        totalTime: Math.round(totalDuration),
        averageTime: Math.round(totalDuration / level),
        stable: successRate >= 0.8 && totalDuration < level * 3000, // 3s per operation max
      };

      results.concurrencyLevels.push(levelResult);

      if (levelResult.stable) {
        results.maxStableConcurrency = level;
      }

      // Brief pause between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (results.maxStableConcurrency >= 8) {
      results.loadCapacity = 'HIGH';
    } else if (results.maxStableConcurrency >= 5) {
      results.loadCapacity = 'MEDIUM';
    } else if (results.maxStableConcurrency >= 3) {
      results.loadCapacity = 'LOW';
    } else {
      results.loadCapacity = 'POOR';
    }

    return results;
  }

  async analyzeResourceUsage() {
    const results = {
      systemLoad: {
        cpu: (os.loadavg()[0] / os.cpus().length) * 100,
        memory: (1 - os.freemem() / os.totalmem()) * 100,
      },
      processImpact: {
        initialMemory: 0,
        peakMemory: 0,
        finalMemory: 0,
      },
      resourceEfficiency: 'UNKNOWN',
    };

    const initial = process.memoryUsage();
    results.processImpact.initialMemory = Math.round(initial.heapUsed / 1024 / 1024);

    // Perform some operations and monitor
    for (let i = 0; i < 3; i++) {
      await this.executeCommand(['--help'], 5000);
      const current = process.memoryUsage();
      results.processImpact.peakMemory = Math.max(
        results.processImpact.peakMemory,
        Math.round(current.heapUsed / 1024 / 1024)
      );
    }

    const final = process.memoryUsage();
    results.processImpact.finalMemory = Math.round(final.heapUsed / 1024 / 1024);

    const memoryGrowth = results.processImpact.finalMemory - results.processImpact.initialMemory;
    if (memoryGrowth < 5) {
      results.resourceEfficiency = 'EXCELLENT';
    } else if (memoryGrowth < 20) {
      results.resourceEfficiency = 'GOOD';
    } else {
      results.resourceEfficiency = 'POOR';
    }

    return results;
  }

  async executeCommand(args, timeout = 30000) {
    return new Promise(resolve => {
      const childProcess = spawn('node', ['dist/index.js', ...args], {
        stdio: 'pipe',
        timeout: timeout,
        cwd: process.cwd(),
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        childProcess.kill();
        resolve({
          stdout,
          stderr,
          code: null,
          timedOut: true,
          error: 'Command timed out',
        });
      }, timeout);

      childProcess.stdout.on('data', data => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', data => {
        stderr += data.toString();
      });

      childProcess.on('close', code => {
        if (!timedOut) {
          clearTimeout(timeoutHandle);
          resolve({ stdout, stderr, code, timedOut: false });
        }
      });

      childProcess.on('error', error => {
        if (!timedOut) {
          clearTimeout(timeoutHandle);
          resolve({
            stdout,
            stderr,
            code: null,
            timedOut: false,
            error: error.message,
          });
        }
      });
    });
  }

  displayMetrics(metrics) {
    if (!metrics) return;

    // Display metrics based on analysis type
    if (metrics.commands) {
      metrics.commands.forEach(cmd => {
        if (cmd.averageTime !== undefined) {
          console.log(
            `   ${cmd.command}: ${cmd.averageTime}ms avg (${cmd.minTime}-${cmd.maxTime}ms) - ${cmd.reliability}`
          );
        } else if (cmd.duration !== undefined) {
          console.log(`   ${cmd.command}: ${cmd.duration}ms - ${cmd.status}`);
        }
      });
    }

    if (metrics.averageTime !== undefined) {
      console.log(`   Average response: ${metrics.averageTime}ms`);
    }

    if (metrics.reliability !== undefined) {
      console.log(`   Reliability: ${(metrics.reliability * 100).toFixed(1)}%`);
    }

    if (metrics.throughput !== undefined) {
      console.log(`   Throughput: ${metrics.throughput.toFixed(2)} ops/sec`);
    }

    if (metrics.timeoutRate !== undefined) {
      console.log(`   Timeout rate: ${(metrics.timeoutRate * 100).toFixed(1)}%`);
    }

    if (metrics.initialMemory !== undefined) {
      console.log(
        `   Memory: ${metrics.initialMemory}MB → ${metrics.memoryAfterOperations}MB (Peak: ${metrics.peakMemory}MB)`
      );
      console.log(
        `   Efficiency: ${metrics.memoryEfficiency}, GC impact: ${metrics.garbageCollectionImpact}MB`
      );
    }

    if (metrics.averageStartup !== undefined) {
      console.log(
        `   Startup time: ${metrics.averageStartup}ms (${metrics.consistentStartup ? 'Consistent' : 'Variable'})`
      );
      console.log(`   Reliability: ${(metrics.startupReliability * 100).toFixed(1)}%`);
    }

    if (metrics.averageErrorTime !== undefined) {
      console.log(`   Error response time: ${metrics.averageErrorTime}ms`);
      console.log(
        `   Graceful failures: ${metrics.gracefulFailures}/${metrics.errorResponses.length}`
      );
    }

    if (metrics.maxStableConcurrency !== undefined) {
      console.log(`   Max stable concurrency: ${metrics.maxStableConcurrency}`);
      console.log(`   Load capacity: ${metrics.loadCapacity}`);
    }

    if (metrics.systemLoad) {
      console.log(
        `   System load: ${metrics.systemLoad.cpu.toFixed(1)}% CPU, ${metrics.systemLoad.memory.toFixed(1)}% Memory`
      );
      console.log(`   Resource efficiency: ${metrics.resourceEfficiency}`);
    }
  }

  async generateComprehensiveReport() {
    console.log('\n' + '═'.repeat(70));
    console.log('🎯 COMPREHENSIVE PERFORMANCE ANALYSIS REPORT');
    console.log('═'.repeat(70));

    const totalDuration = Date.now() - this.startTime;

    console.log(`\n📊 Analysis Summary:`);
    console.log(`   Total Duration: ${Math.round(totalDuration / 1000)}s`);
    console.log(
      `   Analyses Completed: ${[...this.results.values()].filter(r => r.status === 'COMPLETED').length}/${this.results.size}`
    );
    console.log(
      `   Analyses Failed: ${[...this.results.values()].filter(r => r.status === 'FAILED').length}/${this.results.size}`
    );

    const assessment = this.calculatePerformanceAssessment();

    console.log(`\n🏆 Performance Assessment:`);
    console.log(`   Fast Operations: ${assessment.fastOperations ? '✅ EXCELLENT' : '❌ SLOW'}`);
    console.log(
      `   Memory Management: ${assessment.memoryManagement ? '✅ EFFICIENT' : '❌ INEFFICIENT'}`
    );
    console.log(`   Startup Performance: ${assessment.startupPerformance ? '✅ FAST' : '❌ SLOW'}`);
    console.log(`   Error Handling: ${assessment.errorHandling ? '✅ ROBUST' : '❌ WEAK'}`);
    console.log(`   Concurrency: ${assessment.concurrency ? '✅ GOOD' : '❌ LIMITED'}`);
    console.log(
      `   Resource Efficiency: ${assessment.resourceEfficiency ? '✅ CLEAN' : '❌ WASTEFUL'}`
    );

    const overallScore =
      (Object.values(assessment).filter(Boolean).length / Object.values(assessment).length) * 100;

    console.log(`\n📈 Overall Performance Score: ${overallScore.toFixed(1)}%`);

    if (overallScore >= 85) {
      console.log('   🟢 EXCELLENT - High-performance system ready for production');
    } else if (overallScore >= 70) {
      console.log('   🟡 GOOD - Solid performance with minor optimization opportunities');
    } else if (overallScore >= 50) {
      console.log('   🟠 FAIR - Adequate performance but significant improvements needed');
    } else {
      console.log('   🔴 POOR - Major performance issues require immediate attention');
    }

    this.generateOptimizationRecommendations(assessment);

    console.log('\n═'.repeat(70));
    console.log('Analysis complete. Review metrics above for detailed insights.');
  }

  calculatePerformanceAssessment() {
    const fastOpsResult = this.results.get('Fast Command Performance')?.metrics;
    const memoryResult = this.results.get('Memory Baseline')?.metrics;
    const startupResult = this.results.get('Startup Performance')?.metrics;
    const errorResult = this.results.get('Error Handling Speed')?.metrics;
    const concurrencyResult = this.results.get('Concurrent Load Test')?.metrics;
    const resourceResult = this.results.get('System Resource Usage')?.metrics;

    return {
      fastOperations: fastOpsResult?.averageTime < 2000 && fastOpsResult?.reliability >= 0.9,
      memoryManagement:
        memoryResult?.memoryEfficiency === 'EXCELLENT' || memoryResult?.memoryEfficiency === 'GOOD',
      startupPerformance:
        startupResult?.averageStartup < 3000 && startupResult?.startupReliability >= 0.8,
      errorHandling: errorResult?.averageErrorTime < 5000 && errorResult?.gracefulFailures >= 2,
      concurrency:
        concurrencyResult?.maxStableConcurrency >= 5 && concurrencyResult?.loadCapacity !== 'POOR',
      resourceEfficiency:
        resourceResult?.resourceEfficiency === 'EXCELLENT' ||
        resourceResult?.resourceEfficiency === 'GOOD',
    };
  }

  generateOptimizationRecommendations(assessment) {
    console.log(`\n💡 Optimization Recommendations:`);

    const recommendations = [];

    if (!assessment.fastOperations) {
      recommendations.push(
        '🔴 HIGH: Optimize fast command execution - target <2s average response'
      );
    }

    if (!assessment.memoryManagement) {
      recommendations.push(
        '🟡 MEDIUM: Improve memory management - reduce heap growth and fragmentation'
      );
    }

    if (!assessment.startupPerformance) {
      recommendations.push('🟠 MEDIUM: Optimize startup time - target <3s initial response');
    }

    if (!assessment.errorHandling) {
      recommendations.push('🔴 HIGH: Enhance error handling speed and graceful failure responses');
    }

    if (!assessment.concurrency) {
      recommendations.push(
        '🟡 MEDIUM: Improve concurrent operation handling - target 5+ stable operations'
      );
    }

    if (!assessment.resourceEfficiency) {
      recommendations.push('🟠 MEDIUM: Optimize resource usage patterns and cleanup');
    }

    // Identify hanging commands
    const slowResult = this.results.get('Slow Command Analysis')?.metrics;
    if (slowResult?.hangingCommands?.length > 0) {
      recommendations.push(
        `🔴 CRITICAL: Fix hanging commands: ${slowResult.hangingCommands.join(', ')}`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        '🟢 System performance is excellent - continue monitoring and gradual optimization'
      );
    }

    recommendations.forEach(rec => console.log(`   ${rec}`));
  }
}

// Main execution
async function main() {
  const analyzer = new TargetedPerformanceAnalysis();

  try {
    await analyzer.initialize();
    await analyzer.runAnalysis();
  } catch (error) {
    console.error('❌ Performance analysis failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
