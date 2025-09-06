#!/usr/bin/env node

/**
 * CodeCrucible Synth - Simplified Performance Validation
 * Quick validation of core system functionality and performance
 */

import { spawn } from 'child_process';
import { performance } from 'perf_hooks';
import os from 'os';

class SimplePerformanceTest {
  constructor() {
    this.results = new Map();
    this.startTime = Date.now();
  }

  async initialize() {
    console.log('🔥 CodeCrucible Synth - Performance Validation');
    console.log('==============================================');
    console.log(`Node.js: ${process.version}`);
    console.log(`Platform: ${os.platform()} ${os.arch()}`);
    console.log(`CPU Cores: ${os.cpus().length}`);
    console.log(`Total Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`);
    console.log(`Free Memory: ${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB\n`);
  }

  async runTests() {
    const tests = [
      { name: 'Basic CLI Functionality', test: this.testBasicCLI.bind(this) },
      { name: 'Response Time Performance', test: this.testResponseTimes.bind(this) },
      { name: 'Memory Usage', test: this.testMemoryUsage.bind(this) },
      { name: 'Concurrent Operations', test: this.testConcurrency.bind(this) },
      { name: 'Error Handling', test: this.testErrorHandling.bind(this) },
      { name: 'System Recovery', test: this.testSystemRecovery.bind(this) },
    ];

    for (const test of tests) {
      console.log(`\n🧪 Testing: ${test.name}`);
      console.log('─'.repeat(40));

      const startTime = performance.now();
      try {
        const result = await test.test();
        const duration = performance.now() - startTime;

        this.results.set(test.name, {
          status: 'PASSED',
          duration: Math.round(duration),
          result: result,
        });

        console.log(`✅ ${test.name} - PASSED (${Math.round(duration)}ms)`);
        this.displayTestResult(result);
      } catch (error) {
        const duration = performance.now() - startTime;

        this.results.set(test.name, {
          status: 'FAILED',
          duration: Math.round(duration),
          error: error.message,
        });

        console.log(`❌ ${test.name} - FAILED (${Math.round(duration)}ms)`);
        console.log(`   Error: ${error.message}`);
      }
    }

    await this.generateReport();
  }

  async testBasicCLI() {
    const commands = [['--help'], ['--version'], ['status'], ['models']];

    const results = {
      commandsExecuted: 0,
      commandsSuccessful: 0,
      averageTime: 0,
    };

    let totalTime = 0;

    for (const cmd of commands) {
      const startTime = performance.now();
      const result = await this.executeCommand(cmd);
      const duration = performance.now() - startTime;

      totalTime += duration;
      results.commandsExecuted++;

      if (result.code === 0 || (result.stdout && result.stdout.length > 0)) {
        results.commandsSuccessful++;
      }
    }

    results.averageTime = Math.round(totalTime / results.commandsExecuted);
    return results;
  }

  async testResponseTimes() {
    const measurements = [];
    const testCommand = ['--version'];

    // Run 10 iterations to get reliable measurements
    for (let i = 0; i < 10; i++) {
      const startTime = performance.now();
      await this.executeCommand(testCommand);
      const duration = performance.now() - startTime;
      measurements.push(duration);
    }

    measurements.sort((a, b) => a - b);

    return {
      averageTime: Math.round(measurements.reduce((a, b) => a + b) / measurements.length),
      minTime: Math.round(measurements[0]),
      maxTime: Math.round(measurements[measurements.length - 1]),
      p50Time: Math.round(measurements[Math.floor(measurements.length * 0.5)]),
      p95Time: Math.round(measurements[Math.floor(measurements.length * 0.95)]),
    };
  }

  async testMemoryUsage() {
    const initialMemory = process.memoryUsage();
    const memorySnapshots = [];

    // Perform memory-intensive operations
    for (let i = 0; i < 10; i++) {
      await this.executeCommand(['--help']);
      const currentMemory = process.memoryUsage();
      memorySnapshots.push({
        heapUsed: currentMemory.heapUsed / 1024 / 1024,
        rss: currentMemory.rss / 1024 / 1024,
      });
    }

    // Force garbage collection if available
    if (global.gc) global.gc();
    const finalMemory = process.memoryUsage();

    const avgHeapUsed =
      memorySnapshots.reduce((sum, snap) => sum + snap.heapUsed, 0) / memorySnapshots.length;
    const peakHeapUsed = Math.max(...memorySnapshots.map(s => s.heapUsed));
    const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

    return {
      initialMemoryMB: Math.round(initialMemory.heapUsed / 1024 / 1024),
      finalMemoryMB: Math.round(finalMemory.heapUsed / 1024 / 1024),
      avgHeapUsedMB: Math.round(avgHeapUsed),
      peakHeapUsedMB: Math.round(peakHeapUsed),
      memoryIncreaseMB: Math.round(memoryIncrease),
      memoryLeakDetected: memoryIncrease > 50, // Flag if more than 50MB increase
    };
  }

  async testConcurrency() {
    const concurrencyLevels = [5, 10, 15];
    const results = {
      maxSuccessfulConcurrency: 0,
      concurrencyResults: [],
    };

    for (const level of concurrencyLevels) {
      const operations = [];
      const startTime = performance.now();

      // Create concurrent operations
      for (let i = 0; i < level; i++) {
        operations.push(
          this.executeCommand(['--version'])
            .then(result => ({ success: result.code === 0, id: i }))
            .catch(() => ({ success: false, id: i }))
        );
      }

      const operationResults = await Promise.all(operations);
      const duration = performance.now() - startTime;
      const successCount = operationResults.filter(r => r.success).length;
      const successRate = successCount / level;

      results.concurrencyResults.push({
        level,
        successCount,
        successRate,
        duration: Math.round(duration),
      });

      if (successRate >= 0.9) {
        // 90% success rate
        results.maxSuccessfulConcurrency = level;
      }

      // Brief pause between concurrency tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }

  async testErrorHandling() {
    const errorScenarios = [
      ['nonexistent-command'],
      ['--invalid-flag'],
      ['analyze', '/nonexistent/path'],
    ];

    const results = {
      totalScenarios: errorScenarios.length,
      gracefulFailures: 0,
      unhandledErrors: 0,
    };

    for (const scenario of errorScenarios) {
      try {
        const result = await this.executeCommand(scenario);

        // Check if error was handled gracefully (non-zero exit but no crash)
        if (result.code !== 0 && (result.stderr || result.stdout)) {
          results.gracefulFailures++;
        } else if (result.code === 0) {
          // Unexpected success
          results.unhandledErrors++;
        }
      } catch (error) {
        // Process crash or timeout
        results.unhandledErrors++;
      }
    }

    return results;
  }

  async testSystemRecovery() {
    const results = {
      recoveredAfterErrors: false,
      systemStillResponsive: false,
      recoveryTime: 0,
    };

    try {
      // Trigger error condition
      await this.executeCommand(['nonexistent-command']);

      // Test system recovery
      const recoveryStart = performance.now();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief recovery time

      const recoveryResult = await this.executeCommand(['--version']);
      results.recoveryTime = Math.round(performance.now() - recoveryStart);

      results.recoveredAfterErrors = recoveryResult.code === 0;
      results.systemStillResponsive = true;
    } catch (error) {
      results.systemStillResponsive = false;
    }

    return results;
  }

  async executeCommand(args) {
    return new Promise((resolve, reject) => {
      const process = spawn('node', ['dist/index.js', ...args], {
        stdio: 'pipe',
        timeout: 30000,
        cwd: process.cwd(),
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', data => {
        stdout += data.toString();
      });

      process.stderr.on('data', data => {
        stderr += data.toString();
      });

      process.on('close', code => {
        resolve({ stdout, stderr, code });
      });

      process.on('error', error => {
        reject(error);
      });
    });
  }

  displayTestResult(result) {
    if (!result) return;

    // Display specific metrics based on test type
    if (result.commandsExecuted) {
      console.log(
        `   Commands: ${result.commandsSuccessful}/${result.commandsExecuted} successful`
      );
      console.log(`   Average time: ${result.averageTime}ms`);
    }

    if (result.averageTime && result.p95Time) {
      console.log(
        `   Avg: ${result.averageTime}ms, P95: ${result.p95Time}ms, Min: ${result.minTime}ms, Max: ${result.maxTime}ms`
      );
    }

    if (result.initialMemoryMB) {
      console.log(
        `   Memory: ${result.initialMemoryMB}MB → ${result.finalMemoryMB}MB (Peak: ${result.peakHeapUsedMB}MB)`
      );
      console.log(
        `   Memory increase: ${result.memoryIncreaseMB}MB, Leak detected: ${result.memoryLeakDetected}`
      );
    }

    if (result.maxSuccessfulConcurrency !== undefined) {
      console.log(`   Max concurrent operations: ${result.maxSuccessfulConcurrency}`);
      result.concurrencyResults.forEach(cr => {
        console.log(
          `   Level ${cr.level}: ${cr.successCount}/${cr.level} success (${(cr.successRate * 100).toFixed(1)}%)`
        );
      });
    }

    if (result.totalScenarios) {
      console.log(`   Graceful failures: ${result.gracefulFailures}/${result.totalScenarios}`);
      console.log(`   Unhandled errors: ${result.unhandledErrors}`);
    }

    if (result.systemStillResponsive !== undefined) {
      console.log(`   System recovery: ${result.recoveredAfterErrors ? 'SUCCESS' : 'FAILED'}`);
      console.log(`   Recovery time: ${result.recoveryTime}ms`);
    }
  }

  async generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE VALIDATION REPORT');
    console.log('='.repeat(60));

    const totalDuration = Date.now() - this.startTime;
    const totalTests = this.results.size;
    const passedTests = [...this.results.values()].filter(r => r.status === 'PASSED').length;

    console.log(`\n📋 Test Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${passedTests}`);
    console.log(`   Failed: ${totalTests - passedTests}`);
    console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`   Total Duration: ${Math.round(totalDuration / 1000)}s`);

    console.log(`\n🎯 Production Readiness Assessment:`);
    const assessment = this.assessProductionReadiness();

    console.log(`   Basic Functionality: ${assessment.basicFunctionality ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Performance: ${assessment.performance ? '✅ GOOD' : '❌ POOR'}`);
    console.log(`   Memory Management: ${assessment.memoryManagement ? '✅ CLEAN' : '❌ LEAKS'}`);
    console.log(`   Concurrency: ${assessment.concurrency ? '✅ GOOD' : '❌ LIMITED'}`);
    console.log(`   Error Handling: ${assessment.errorHandling ? '✅ ROBUST' : '❌ WEAK'}`);
    console.log(`   System Recovery: ${assessment.systemRecovery ? '✅ RESILIENT' : '❌ FRAGILE'}`);

    const overallScore =
      (Object.values(assessment).filter(Boolean).length / Object.values(assessment).length) * 100;
    console.log(`\n🏆 Overall Production Readiness: ${overallScore.toFixed(1)}%`);

    if (overallScore >= 90) {
      console.log('   🟢 EXCELLENT - Ready for production deployment');
    } else if (overallScore >= 75) {
      console.log('   🟡 GOOD - Minor optimizations recommended');
    } else if (overallScore >= 60) {
      console.log('   🟠 FAIR - Significant improvements needed');
    } else {
      console.log('   🔴 POOR - Not ready for production');
    }

    // Specific recommendations
    console.log(`\n💡 Recommendations:`);
    this.generateRecommendations(assessment);

    console.log('\n✅ Performance validation completed.');
  }

  assessProductionReadiness() {
    const basicTest = this.results.get('Basic CLI Functionality')?.result;
    const responseTest = this.results.get('Response Time Performance')?.result;
    const memoryTest = this.results.get('Memory Usage')?.result;
    const concurrencyTest = this.results.get('Concurrent Operations')?.result;
    const errorTest = this.results.get('Error Handling')?.result;
    const recoveryTest = this.results.get('System Recovery')?.result;

    return {
      basicFunctionality: basicTest?.commandsSuccessful >= basicTest?.commandsExecuted * 0.9,
      performance: responseTest?.p95Time < 3000 && responseTest?.averageTime < 1500,
      memoryManagement: !memoryTest?.memoryLeakDetected && memoryTest?.peakHeapUsedMB < 500,
      concurrency: concurrencyTest?.maxSuccessfulConcurrency >= 10,
      errorHandling: errorTest?.gracefulFailures >= errorTest?.totalScenarios * 0.8,
      systemRecovery: recoveryTest?.recoveredAfterErrors && recoveryTest?.systemStillResponsive,
    };
  }

  generateRecommendations(assessment) {
    const recommendations = [];

    if (!assessment.basicFunctionality) {
      recommendations.push('🔴 CRITICAL: Fix basic CLI command failures');
    }

    if (!assessment.performance) {
      recommendations.push('🟡 HIGH: Optimize response times (target <3s P95, <1.5s average)');
    }

    if (!assessment.memoryManagement) {
      recommendations.push('🟡 HIGH: Address memory leaks and optimize memory usage');
    }

    if (!assessment.concurrency) {
      recommendations.push('🟠 MEDIUM: Improve concurrent operation handling capacity');
    }

    if (!assessment.errorHandling) {
      recommendations.push('🟠 MEDIUM: Enhance error handling and graceful failure responses');
    }

    if (!assessment.systemRecovery) {
      recommendations.push('🔴 HIGH: Implement robust system recovery mechanisms');
    }

    if (recommendations.length === 0) {
      recommendations.push('🟢 System performing well overall - continue monitoring in production');
    }

    recommendations.forEach(rec => console.log(`   ${rec}`));
  }
}

// Main execution
async function main() {
  const tester = new SimplePerformanceTest();

  try {
    await tester.initialize();
    await tester.runTests();
  } catch (error) {
    console.error('❌ Performance validation failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
