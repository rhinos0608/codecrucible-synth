#!/usr/bin/env node

/**
 * Performance Audit Script - Comprehensive CLI Performance Analysis
 * Measures startup time, command execution, and resource usage
 */

import { performance } from 'perf_hooks';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PerformanceAuditor {
  constructor() {
    this.results = [];
    this.startTime = performance.now();
  }

  async measureCommand(command, args, description, timeout = 10000) {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const child = spawn(command, args, { 
        stdio: 'pipe',
        cwd: process.cwd(),
        timeout
      });
      
      let output = '';
      let error = '';
      
      child.stdout.on('data', (data) => output += data.toString());
      child.stderr.on('data', (data) => error += data.toString());
      
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve({
          command: description,
          duration: timeout,
          success: false,
          timedOut: true,
          error: 'Command timed out'
        });
      }, timeout);
      
      child.on('close', (code) => {
        clearTimeout(timer);
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        
        resolve({
          command: description,
          duration,
          success: code === 0,
          output: output.slice(0, 200),
          error: error.slice(0, 200),
          exitCode: code
        });
      });
      
      child.on('error', (err) => {
        clearTimeout(timer);
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        resolve({
          command: description,
          duration,
          success: false,
          error: err.message
        });
      });
    });
  }

  async measureMemoryUsage() {
    const memBefore = process.memoryUsage();
    
    // Simulate some operations
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const memAfter = process.memoryUsage();
    
    return {
      before: memBefore,
      after: memAfter,
      growth: {
        heapUsed: memAfter.heapUsed - memBefore.heapUsed,
        heapTotal: memAfter.heapTotal - memBefore.heapTotal,
        external: memAfter.external - memBefore.external
      }
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getPerformanceRating(duration) {
    if (duration < 200) return 'EXCELLENT';
    if (duration < 500) return 'VERY GOOD';
    if (duration < 1000) return 'GOOD';
    if (duration < 2000) return 'FAIR';
    return 'POOR - NEEDS OPTIMIZATION';
  }

  async runComprehensiveAudit() {
    console.log('🔍 CodeCrucible Synth Performance Audit');
    console.log('=' .repeat(60));
    console.log(`📅 Audit Date: ${new Date().toISOString()}`);
    console.log(`🖥️  Platform: ${process.platform} ${process.arch}`);
    console.log(`⚡ Node.js: ${process.version}`);
    console.log('');

    // Memory baseline
    const memoryStart = process.memoryUsage();
    console.log('💾 Initial Memory Usage:');
    console.log(`   Heap Used: ${this.formatBytes(memoryStart.heapUsed)}`);
    console.log(`   Heap Total: ${this.formatBytes(memoryStart.heapTotal)}`);
    console.log('');

    // CLI Command Performance Tests
    console.log('⚡ CLI Command Performance Tests:');
    console.log('-'.repeat(60));

    const tests = [
      { cmd: 'node', args: ['dist/index.js', '--help'], desc: 'Help Command', target: 500 },
      { cmd: 'node', args: ['dist/index.js', '--version'], desc: 'Version Command', target: 300 },
      { cmd: 'node', args: ['dist/index.js', 'status'], desc: 'Status Command', target: 2000 },
      { cmd: 'node', args: ['dist/index.js', 'models'], desc: 'Models Command', target: 3000 }
    ];

    const results = [];
    for (const test of tests) {
      const result = await this.measureCommand(test.cmd, test.args, test.desc, 15000);
      results.push({ ...result, target: test.target });
      
      const status = result.success ? '✅' : '❌';
      const rating = this.getPerformanceRating(result.duration);
      const targetHit = result.duration <= test.target ? '🎯' : '🔴';
      
      console.log(`${status} ${result.command}:`);
      console.log(`   Duration: ${result.duration}ms ${targetHit} (target: ${test.target}ms)`);
      console.log(`   Rating: ${rating}`);
      
      if (!result.success) {
        console.log(`   ❌ Error: ${result.error}`);
      }
      console.log('');
    }

    // Build Performance Test
    console.log('🔨 Build System Performance:');
    console.log('-'.repeat(60));
    
    try {
      const buildStart = performance.now();
      execSync('npm run build', { stdio: 'pipe', timeout: 60000 });
      const buildEnd = performance.now();
      const buildDuration = Math.round(buildEnd - buildStart);
      
      console.log(`✅ TypeScript Build: ${buildDuration}ms`);
      console.log(`   Rating: ${this.getPerformanceRating(buildDuration)}`);
      results.push({ command: 'TypeScript Build', duration: buildDuration, success: true });
    } catch (error) {
      console.log(`❌ TypeScript Build Failed: ${error.message.slice(0, 200)}`);
      results.push({ command: 'TypeScript Build', duration: 0, success: false, error: error.message });
    }
    console.log('');

    // Memory Usage Analysis
    console.log('💾 Memory Usage Analysis:');
    console.log('-'.repeat(60));
    
    const memoryEnd = process.memoryUsage();
    const memoryGrowth = {
      heapUsed: memoryEnd.heapUsed - memoryStart.heapUsed,
      heapTotal: memoryEnd.heapTotal - memoryStart.heapTotal,
      external: memoryEnd.external - memoryStart.external
    };

    console.log(`Initial Heap: ${this.formatBytes(memoryStart.heapUsed)}`);
    console.log(`Final Heap: ${this.formatBytes(memoryEnd.heapUsed)}`);
    console.log(`Heap Growth: ${this.formatBytes(memoryGrowth.heapUsed)}`);
    console.log(`External Growth: ${this.formatBytes(memoryGrowth.external)}`);
    console.log('');

    // Performance Summary
    console.log('📊 PERFORMANCE SUMMARY:');
    console.log('=' .repeat(60));
    
    const successfulResults = results.filter(r => r.success);
    const avgDuration = successfulResults.length > 0 
      ? Math.round(successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length)
      : 0;
    
    console.log(`🎯 Commands Tested: ${results.length}`);
    console.log(`✅ Successful: ${successfulResults.length}`);
    console.log(`❌ Failed: ${results.length - successfulResults.length}`);
    console.log(`⚡ Average Duration: ${avgDuration}ms`);
    console.log(`📈 Overall Rating: ${this.getPerformanceRating(avgDuration)}`);
    console.log('');

    // Performance Analysis & Recommendations
    console.log('🔧 PERFORMANCE ANALYSIS & RECOMMENDATIONS:');
    console.log('=' .repeat(60));
    
    const slowCommands = results.filter(r => r.success && r.duration > (r.target || 1000));
    if (slowCommands.length > 0) {
      console.log('⚠️  Commands exceeding target performance:');
      slowCommands.forEach(cmd => {
        console.log(`   • ${cmd.command}: ${cmd.duration}ms (target: ${cmd.target || 1000}ms)`);
      });
      console.log('');
    }

    // Optimization recommendations
    const recommendations = this.generateRecommendations(results, avgDuration, memoryGrowth);
    console.log('💡 OPTIMIZATION RECOMMENDATIONS:');
    recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec.priority} - ${rec.title}`);
      console.log(`   ${rec.description}`);
      console.log(`   Action: ${rec.action}`);
      console.log('');
    });

    // Save detailed results
    const auditReport = {
      timestamp: new Date().toISOString(),
      platform: `${process.platform} ${process.arch}`,
      nodeVersion: process.version,
      results,
      memoryUsage: { start: memoryStart, end: memoryEnd, growth: memoryGrowth },
      summary: {
        totalCommands: results.length,
        successful: successfulResults.length,
        failed: results.length - successfulResults.length,
        averageDuration: avgDuration,
        overallRating: this.getPerformanceRating(avgDuration)
      },
      recommendations
    };

    const reportPath = path.join(__dirname, '..', 'Docs', `performance-audit-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2));
    console.log(`📄 Detailed report saved to: ${path.relative(process.cwd(), reportPath)}`);
  }

  generateRecommendations(results, avgDuration, memoryGrowth) {
    const recommendations = [];

    // Startup time recommendations
    if (avgDuration > 1000) {
      recommendations.push({
        priority: '🔥 CRITICAL',
        title: 'Optimize CLI Startup Time',
        description: `Average command execution time is ${avgDuration}ms, significantly above 2025 standards (<500ms)`,
        action: 'Implement lazy loading, reduce initial imports, optimize DI container initialization'
      });
    } else if (avgDuration > 500) {
      recommendations.push({
        priority: '⚡ HIGH',
        title: 'Further Startup Optimization',
        description: `Commands averaging ${avgDuration}ms - room for improvement to reach <200ms target`,
        action: 'Apply dynamic imports, defer non-critical initialization, implement command-specific fast paths'
      });
    }

    // Memory recommendations
    if (memoryGrowth.heapUsed > 50 * 1024 * 1024) { // 50MB growth
      recommendations.push({
        priority: '🔥 CRITICAL',
        title: 'Memory Leak Investigation Required',
        description: `Significant heap growth detected: ${this.formatBytes(memoryGrowth.heapUsed)}`,
        action: 'Implement proper resource cleanup, investigate EventEmitter leaks, optimize caching strategies'
      });
    }

    // Build performance
    const buildResult = results.find(r => r.command === 'TypeScript Build');
    if (buildResult && buildResult.success && buildResult.duration > 10000) {
      recommendations.push({
        priority: '⚡ HIGH',
        title: 'Optimize Build Performance',
        description: `TypeScript build taking ${buildResult.duration}ms - impacts development experience`,
        action: 'Enable incremental compilation, optimize tsconfig.json, consider build caching'
      });
    }

    // Command-specific recommendations
    const failedCommands = results.filter(r => !r.success);
    if (failedCommands.length > 0) {
      recommendations.push({
        priority: '🔥 CRITICAL',
        title: 'Fix Command Failures',
        description: `${failedCommands.length} commands failing - core functionality impacted`,
        action: 'Debug command execution, fix initialization dependencies, improve error handling'
      });
    }

    // 2025 best practices
    recommendations.push({
      priority: '🔧 MEDIUM',
      title: 'Apply 2025 CLI Performance Patterns',
      description: 'Modern Node.js applications should leverage latest performance optimizations',
      action: 'Implement ES modules optimization, use Node.js 20+ features, apply connection pooling'
    });

    return recommendations;
  }
}

// Run the audit
async function main() {
  const auditor = new PerformanceAuditor();
  try {
    await auditor.runComprehensiveAudit();
  } catch (error) {
    console.error('❌ Performance audit failed:', error);
    process.exit(1);
  }
}

// Run the audit
main();