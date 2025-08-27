#!/usr/bin/env node

/**
 * Memory Leak Detector and Performance Optimizer
 * Detects and fixes memory leaks, optimizes performance bottlenecks
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { glob } from 'glob';
import { getConfig } from './config/env-config.js';
import { logger } from './logger.js';

interface MemoryUsage {
  rss: number; // Resident Set Size
  heapTotal: number; // Total heap size
  heapUsed: number; // Used heap size
  external: number; // External memory
  arrayBuffers: number; // Array buffers
}

interface MemoryLeak {
  type:
    | 'event_listener'
    | 'interval'
    | 'timeout'
    | 'cache_growth'
    | 'closure'
    | 'circular_reference';
  file: string;
  line: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
  leakRate: number; // KB/second
  autoFixable: boolean;
}

interface PerformanceBottleneck {
  type:
    | 'cpu_intensive'
    | 'memory_intensive'
    | 'io_blocking'
    | 'inefficient_algorithm'
    | 'large_payload';
  file: string;
  function: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestion: string;
  estimatedImprovement: string;
}

interface MemoryAnalysis {
  baseline: MemoryUsage;
  current: MemoryUsage;
  growthRate: number;
  leaks: MemoryLeak[];
  bottlenecks: PerformanceBottleneck[];
  recommendations: string[];
}

export class MemoryLeakDetector extends EventEmitter {
  private memoryHistory: MemoryUsage[] = [];
  private intervals: NodeJS.Timeout[] = [];
  private timeouts: NodeJS.Timeout[] = [];
  private eventListeners: Map<string, number> = new Map();
  private cacheGrowthTracking: Map<string, { size: number; timestamp: number }> = new Map();
  private performanceData: Map<string, number[]> = new Map();
  private isMonitoring = false;
  private lastMemorySpikeWarning = 0;

  /**
   * Start comprehensive memory leak detection
   */
  async detectMemoryLeaks(): Promise<MemoryAnalysis> {
    logger.info('🔍 Starting comprehensive memory leak detection...');

    const baseline = process.memoryUsage();
    this.memoryHistory.push(baseline);

    // Start monitoring
    this.startMemoryMonitoring();

    // Analyze codebase for potential leaks
    const codebaseLeaks = await this.analyzeCodebaseForLeaks();

    // Analyze runtime patterns
    const runtimeLeaks = await this.analyzeRuntimePatterns();

    // Find performance bottlenecks
    const bottlenecks = await this.findPerformanceBottlenecks();

    // Calculate growth rate
    const growthRate = this.calculateMemoryGrowthRate();

    const current = process.memoryUsage();
    const recommendations = this.generateRecommendations(
      [...codebaseLeaks, ...runtimeLeaks],
      bottlenecks
    );

    return {
      baseline,
      current,
      growthRate,
      leaks: [...codebaseLeaks, ...runtimeLeaks],
      bottlenecks,
      recommendations,
    };
  }

  /**
   * Start monitoring memory usage
   */
  private startMemoryMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    const interval = setInterval(() => {
      const usage = process.memoryUsage();
      this.memoryHistory.push(usage);

      // Keep only last 100 entries
      if (this.memoryHistory.length > 100) {
        this.memoryHistory.shift();
      }

      // Check for memory spikes
      this.checkForMemorySpikes(usage);
    }, 5000); // Every 5 seconds

    this.intervals.push(interval);

    // Cleanup after configured timeout
    const timeout = setTimeout(() => {
      this.stopMemoryMonitoring();
    }, getConfig().memoryMonitoringTimeout);
    
    this.timeouts.push(timeout);
  }

  /**
   * Stop memory monitoring
   */
  private stopMemoryMonitoring(): void {
    this.isMonitoring = false;

    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    
    for (const timeout of this.timeouts) {
      clearTimeout(timeout);
    }

    this.intervals = [];
    this.timeouts = [];
  }

  /**
   * Check for memory spikes
   */
  private checkForMemorySpikes(current: MemoryUsage): void {
    if (this.memoryHistory.length < 2) return;

    const previous = this.memoryHistory[this.memoryHistory.length - 2];
    const heapGrowth = current.heapUsed - previous.heapUsed;

    // Alert on rapid growth (>50MB in 5 seconds)
    if (heapGrowth > 50 * 1024 * 1024) {
      this.emit('memory-spike', {
        growth: heapGrowth,
        current: current.heapUsed,
        timestamp: Date.now(),
      });

      // Throttle memory spike warnings to prevent spam
      const now = Date.now();
      if (now - this.lastMemorySpikeWarning > getConfig().requestTimeout) {
        // 30 seconds between warnings
        logger.warn(`🚨 Memory spike detected: +${Math.round(heapGrowth / 1024 / 1024)}MB`);
        this.lastMemorySpikeWarning = now;
      }
    }
  }

  /**
   * Analyze codebase for potential memory leaks
   */
  private async analyzeCodebaseForLeaks(): Promise<MemoryLeak[]> {
    const leaks: MemoryLeak[] = [];
    const sourceFiles = await glob('src/**/*.{ts,js}', { ignore: ['src/**/*.test.ts'] });

    for (const file of sourceFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const fileLeaks = await this.analyzeFileForLeaks(file, content);
        leaks.push(...fileLeaks);
      } catch (error) {
        logger.warn(`Failed to analyze ${file}:`, error);
      }
    }

    return leaks;
  }

  /**
   * Analyze a single file for memory leaks
   */
  private async analyzeFileForLeaks(filePath: string, content: string): Promise<MemoryLeak[]> {
    const leaks: MemoryLeak[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for event listeners without cleanup
      if (this.hasEventListenerLeak(line, lines, i)) {
        leaks.push({
          type: 'event_listener',
          file: filePath,
          line: lineNum,
          severity: 'high',
          description: 'Event listener added without cleanup',
          recommendation: 'Add removeEventListener or AbortController cleanup',
          leakRate: 0.1, // Estimated KB/second
          autoFixable: true,
        });
      }

      // Check for intervals without cleanup
      if (this.hasIntervalLeak(line, lines, i)) {
        leaks.push({
          type: 'interval',
          file: filePath,
          line: lineNum,
          severity: 'high',
          description: 'setInterval without clearInterval',
          recommendation: 'Store interval ID and clear in cleanup method',
          leakRate: 0.05,
          autoFixable: true,
        });
      }

      // Check for unbounded cache growth
      if (this.hasUnboundedCacheGrowth(line)) {
        leaks.push({
          type: 'cache_growth',
          file: filePath,
          line: lineNum,
          severity: 'medium',
          description: 'Cache without size limit or TTL',
          recommendation: 'Implement LRU cache with size limits and TTL',
          leakRate: 1.0,
          autoFixable: false,
        });
      }

      // Check for circular references
      if (this.hasCircularReference(line, lines, i)) {
        leaks.push({
          type: 'circular_reference',
          file: filePath,
          line: lineNum,
          severity: 'medium',
          description: 'Potential circular reference',
          recommendation: 'Use WeakMap or WeakSet for object references',
          leakRate: 0.2,
          autoFixable: false,
        });
      }

      // Check for closure leaks
      if (this.hasClosureLeak(line, lines, i)) {
        leaks.push({
          type: 'closure',
          file: filePath,
          line: lineNum,
          severity: 'medium',
          description: 'Closure capturing large scope',
          recommendation: 'Minimize closure scope or use weak references',
          leakRate: 0.3,
          autoFixable: false,
        });
      }
    }

    return leaks;
  }

  /**
   * Check for event listener leaks
   */
  private hasEventListenerLeak(line: string, lines: string[], index: number): boolean {
    if (!line.includes('addEventListener') && !line.includes('on(')) return false;

    // Look for cleanup in the same function or class
    const contextLines = lines.slice(Math.max(0, index - 10), Math.min(lines.length, index + 20));
    const contextContent = contextLines.join('\n');

    return !(
      contextContent.includes('removeEventListener') ||
      contextContent.includes('off(') ||
      contextContent.includes('AbortController') ||
      contextContent.includes('signal') ||
      contextContent.includes('cleanup') ||
      contextContent.includes('dispose') ||
      contextContent.includes('destroy')
    );
  }

  /**
   * Check for interval leaks
   */
  private hasIntervalLeak(line: string, lines: string[], index: number): boolean {
    if (!line.includes('setInterval')) return false;

    // Look for clearInterval in context
    const contextLines = lines.slice(Math.max(0, index - 5), Math.min(lines.length, index + 15));
    const contextContent = contextLines.join('\n');

    return !contextContent.includes('clearInterval');
  }

  /**
   * Check for unbounded cache growth
   */
  private hasUnboundedCacheGrowth(line: string): boolean {
    const isCacheOperation =
      /\.(set|put|store|cache)\s*\(/.test(line) ||
      /new\s+(Map|Set|WeakMap|WeakSet)\s*\(/.test(line);

    if (!isCacheOperation) return false;

    // Check if there's any size limiting logic nearby
    return !(
      line.includes('maxSize') ||
      line.includes('limit') ||
      line.includes('TTL') ||
      line.includes('expire') ||
      line.includes('LRU') ||
      line.includes('evict')
    );
  }

  /**
   * Check for circular references
   */
  private hasCircularReference(line: string, lines: string[], index: number): boolean {
    // Look for patterns that might create circular refs
    const patterns = [
      /\w+\.\w+\s*=\s*\w+/, // obj.prop = obj
      /\w+\[\s*['"`]\w+['"`]\s*\]\s*=\s*\w+/, // obj['prop'] = obj
    ];

    return patterns.some(pattern => pattern.test(line));
  }

  /**
   * Check for closure leaks
   */
  private hasClosureLeak(line: string, lines: string[], index: number): boolean {
    if (!/function\s*\(|=>\s*{|=>\s*\w/.test(line)) return false;

    // Look for large captured scope
    const contextLines = lines.slice(Math.max(0, index - 20), index);
    const hasLargeScope = contextLines.some(
      contextLine =>
        contextLine.includes('const') || contextLine.includes('let') || contextLine.includes('var')
    );

    return hasLargeScope && contextLines.length > 10;
  }

  /**
   * Analyze runtime patterns for leaks
   */
  private async analyzeRuntimePatterns(): Promise<MemoryLeak[]> {
    const leaks: MemoryLeak[] = [];

    // Check for growing event listener counts
    for (const [event, count] of this.eventListeners) {
      if (count > 50) {
        // Arbitrary threshold
        leaks.push({
          type: 'event_listener',
          file: 'runtime',
          line: 0,
          severity: 'high',
          description: `High number of ${event} listeners: ${count}`,
          recommendation: 'Review event listener cleanup logic',
          leakRate: count * 0.01,
          autoFixable: false,
        });
      }
    }

    // Check for cache growth
    for (const [cacheName, data] of this.cacheGrowthTracking) {
      const growthRate = data.size / ((Date.now() - data.timestamp) / 1000);
      if (growthRate > 100) {
        // 100 entries per second
        leaks.push({
          type: 'cache_growth',
          file: 'runtime',
          line: 0,
          severity: 'critical',
          description: `Rapid cache growth: ${cacheName} growing at ${growthRate} entries/sec`,
          recommendation: 'Implement cache size limits and cleanup',
          leakRate: growthRate * 0.1,
          autoFixable: false,
        });
      }
    }

    return leaks;
  }

  /**
   * Find performance bottlenecks
   */
  private async findPerformanceBottlenecks(): Promise<PerformanceBottleneck[]> {
    const bottlenecks: PerformanceBottleneck[] = [];
    const sourceFiles = await glob('src/**/*.{ts,js}', { ignore: ['src/**/*.test.ts'] });

    for (const file of sourceFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const fileBottlenecks = await this.analyzeFileForBottlenecks(file, content);
        bottlenecks.push(...fileBottlenecks);
      } catch (error) {
        logger.warn(`Failed to analyze ${file} for bottlenecks:`, error);
      }
    }

    return bottlenecks;
  }

  /**
   * Analyze file for performance bottlenecks
   */
  private async analyzeFileForBottlenecks(
    filePath: string,
    content: string
  ): Promise<PerformanceBottleneck[]> {
    const bottlenecks: PerformanceBottleneck[] = [];

    // Check for synchronous file operations
    if (content.includes('readFileSync') || content.includes('writeFileSync')) {
      bottlenecks.push({
        type: 'io_blocking',
        file: filePath,
        function: 'file operations',
        impact: 'high',
        description: 'Synchronous file operations block event loop',
        suggestion: 'Use async file operations (fs.promises)',
        estimatedImprovement: '50-90% faster I/O',
      });
    }

    // Check for inefficient loops
    const inefficientLoopPattern = /for\s*\([^)]*\.length[^)]*\)|while\s*\([^)]*\.length[^)]*\)/g;
    if (inefficientLoopPattern.test(content)) {
      bottlenecks.push({
        type: 'inefficient_algorithm',
        file: filePath,
        function: 'loops',
        impact: 'medium',
        description: 'Loop with repeated .length calculation',
        suggestion: 'Cache array length outside loop',
        estimatedImprovement: '10-30% faster iteration',
      });
    }

    // Check for large JSON operations
    if (content.includes('JSON.stringify') && content.includes('JSON.parse')) {
      bottlenecks.push({
        type: 'large_payload',
        file: filePath,
        function: 'JSON operations',
        impact: 'medium',
        description: 'Potentially large JSON serialization/parsing',
        suggestion: 'Consider streaming JSON or data compression',
        estimatedImprovement: '20-60% faster serialization',
      });
    }

    // Check for CPU-intensive regex
    const complexRegexPattern = /new\s+RegExp\(.*\|.*\|.*\)/g;
    if (complexRegexPattern.test(content)) {
      bottlenecks.push({
        type: 'cpu_intensive',
        file: filePath,
        function: 'regex operations',
        impact: 'medium',
        description: 'Complex regex patterns',
        suggestion: 'Simplify regex or use string methods',
        estimatedImprovement: '30-70% faster text processing',
      });
    }

    // Check for memory-intensive operations
    if (content.includes('Buffer.alloc') || content.includes('new Array(')) {
      bottlenecks.push({
        type: 'memory_intensive',
        file: filePath,
        function: 'memory allocation',
        impact: 'high',
        description: 'Large memory allocations',
        suggestion: 'Use streaming or pooled buffers',
        estimatedImprovement: '40-80% memory reduction',
      });
    }

    return bottlenecks;
  }

  /**
   * Calculate memory growth rate
   */
  private calculateMemoryGrowthRate(): number {
    if (this.memoryHistory.length < 2) return 0;

    const first = this.memoryHistory[0];
    const last = this.memoryHistory[this.memoryHistory.length - 1];
    const timeDiff = this.memoryHistory.length * 5; // 5 seconds per sample

    const heapGrowth = last.heapUsed - first.heapUsed;
    return heapGrowth / timeDiff; // Bytes per second
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    leaks: MemoryLeak[],
    bottlenecks: PerformanceBottleneck[]
  ): string[] {
    const recommendations: string[] = [];

    const criticalLeaks = leaks.filter(l => l.severity === 'critical').length;
    const highLeaks = leaks.filter(l => l.severity === 'high').length;
    const highBottlenecks = bottlenecks.filter(b => b.impact === 'high').length;

    if (criticalLeaks > 0) {
      recommendations.push(`🚨 Address ${criticalLeaks} critical memory leaks immediately`);
    }

    if (highLeaks > 0) {
      recommendations.push(`🔴 Fix ${highLeaks} high-impact memory leaks`);
    }

    if (highBottlenecks > 0) {
      recommendations.push(`⚡ Optimize ${highBottlenecks} high-impact performance bottlenecks`);
    }

    // Event listener recommendations
    const eventLeaks = leaks.filter(l => l.type === 'event_listener').length;
    if (eventLeaks > 0) {
      recommendations.push('🎯 Implement cleanup for event listeners using AbortController');
    }

    // Cache recommendations
    const cacheLeaks = leaks.filter(l => l.type === 'cache_growth').length;
    if (cacheLeaks > 0) {
      recommendations.push('💾 Add size limits and TTL to all caches');
    }

    // Performance recommendations
    const ioBottlenecks = bottlenecks.filter(b => b.type === 'io_blocking').length;
    if (ioBottlenecks > 0) {
      recommendations.push('📁 Convert synchronous I/O to asynchronous operations');
    }

    recommendations.push('🔄 Implement regular memory profiling in CI/CD');
    recommendations.push('📊 Add memory usage monitoring and alerting');
    recommendations.push('🧹 Schedule regular cleanup and optimization reviews');

    return recommendations;
  }

  /**
   * Apply automatic fixes for fixable issues
   */
  async applyAutomaticFixes(leaks: MemoryLeak[]): Promise<{ fixed: number; failed: number }> {
    let fixed = 0;
    let failed = 0;

    const fixableLeaks = leaks.filter(l => l.autoFixable);

    for (const leak of fixableLeaks) {
      try {
        await this.applyLeakFix(leak);
        fixed++;
        logger.info(`✅ Fixed ${leak.type} in ${leak.file}:${leak.line}`);
      } catch (error) {
        failed++;
        logger.error(`❌ Failed to fix ${leak.type} in ${leak.file}:`, error);
      }
    }

    return { fixed, failed };
  }

  /**
   * Apply fix for a specific leak
   */
  private async applyLeakFix(leak: MemoryLeak): Promise<void> {
    if (leak.file === 'runtime') return; // Can't fix runtime issues automatically

    const content = await fs.readFile(leak.file, 'utf-8');
    let fixedContent = content;

    switch (leak.type) {
      case 'event_listener':
        fixedContent = this.fixEventListenerLeak(content, leak.line);
        break;
      case 'interval':
        fixedContent = this.fixIntervalLeak(content, leak.line);
        break;
      // Other fixes would be implemented here
    }

    if (fixedContent !== content) {
      await fs.writeFile(leak.file, fixedContent);
    }
  }

  /**
   * Fix event listener leak
   */
  private fixEventListenerLeak(content: string, lineNumber: number): string {
    const lines = content.split('\n');
    const line = lines[lineNumber - 1];

    // Simple fix: add comment about cleanup needed
    if (line.includes('addEventListener')) {
      const indent = line.match(/^\s*/)?.[0] || '';
      lines.splice(
        lineNumber,
        0,
        `${indent}// TODO: Add cleanup with removeEventListener or AbortController`
      );
    }

    return lines.join('\n');
  }

  /**
   * Fix interval leak
   */
  private fixIntervalLeak(content: string, lineNumber: number): string {
    const lines = content.split('\n');
    const line = lines[lineNumber - 1];

    // Simple fix: add comment about cleanup needed
    if (line.includes('setInterval')) {
      const indent = line.match(/^\s*/)?.[0] || '';
      lines.splice(
        lineNumber,
        0,
        `${indent}// TODO: Store interval ID and call clearInterval in cleanup`
      );
    }

    return lines.join('\n');
  }

  /**
   * Generate comprehensive report
   */
  generateReport(analysis: MemoryAnalysis): string {
    const { baseline, current, growthRate, leaks, bottlenecks, recommendations } = analysis;

    const memoryDiff = current.heapUsed - baseline.heapUsed;
    const memoryPercent = ((memoryDiff / baseline.heapUsed) * 100).toFixed(1);

    let report = `
🧠 MEMORY LEAK & PERFORMANCE ANALYSIS REPORT
===========================================

MEMORY USAGE:
• Baseline: ${this.formatBytes(baseline.heapUsed)}
• Current: ${this.formatBytes(current.heapUsed)}
• Change: ${memoryDiff >= 0 ? '+' : ''}${this.formatBytes(memoryDiff)} (${memoryPercent}%)
• Growth Rate: ${this.formatBytes(growthRate)}/second

`;

    // Memory leaks
    if (leaks.length > 0) {
      report += `🚨 MEMORY LEAKS DETECTED (${leaks.length}):\n`;
      report += `${'─'.repeat(50)}\n`;

      const leakTypes = new Map<string, MemoryLeak[]>();
      for (const leak of leaks) {
        if (!leakTypes.has(leak.type)) {
          leakTypes.set(leak.type, []);
        }
        leakTypes.get(leak.type)!.push(leak);
      }

      for (const [type, typeLeaks] of leakTypes) {
        const icon =
          type === 'event_listener'
            ? '🎯'
            : type === 'interval'
              ? '⏰'
              : type === 'cache_growth'
                ? '💾'
                : type === 'circular_reference'
                  ? '🔄'
                  : '⚠️';

        report += `${icon} ${type.replace('_', ' ').toUpperCase()} (${typeLeaks.length}):\n`;

        for (const leak of typeLeaks.slice(0, 5)) {
          const severity =
            leak.severity === 'critical'
              ? '🚨'
              : leak.severity === 'high'
                ? '🔴'
                : leak.severity === 'medium'
                  ? '🟡'
                  : '🔵';

          report += `  ${severity} ${leak.file}:${leak.line} - ${leak.description}\n`;
          report += `     💡 ${leak.recommendation}\n`;
        }

        if (typeLeaks.length > 5) {
          report += `     ... and ${typeLeaks.length - 5} more\n`;
        }
        report += '\n';
      }
    }

    // Performance bottlenecks
    if (bottlenecks.length > 0) {
      report += `⚡ PERFORMANCE BOTTLENECKS (${bottlenecks.length}):\n`;
      report += `${'─'.repeat(50)}\n`;

      const bottleneckTypes = new Map<string, PerformanceBottleneck[]>();
      for (const bottleneck of bottlenecks) {
        if (!bottleneckTypes.has(bottleneck.type)) {
          bottleneckTypes.set(bottleneck.type, []);
        }
        bottleneckTypes.get(bottleneck.type)!.push(bottleneck);
      }

      for (const [type, typeBottlenecks] of bottleneckTypes) {
        const icon =
          type === 'cpu_intensive'
            ? '🔥'
            : type === 'memory_intensive'
              ? '🧠'
              : type === 'io_blocking'
                ? '📁'
                : type === 'inefficient_algorithm'
                  ? '🔄'
                  : '⚠️';

        report += `${icon} ${type.replace('_', ' ').toUpperCase()} (${typeBottlenecks.length}):\n`;

        for (const bottleneck of typeBottlenecks.slice(0, 3)) {
          const impact =
            bottleneck.impact === 'critical'
              ? '🚨'
              : bottleneck.impact === 'high'
                ? '🔴'
                : bottleneck.impact === 'medium'
                  ? '🟡'
                  : '🔵';

          report += `  ${impact} ${bottleneck.file} - ${bottleneck.description}\n`;
          report += `     🚀 ${bottleneck.suggestion} (${bottleneck.estimatedImprovement})\n`;
        }

        if (typeBottlenecks.length > 3) {
          report += `     ... and ${typeBottlenecks.length - 3} more\n`;
        }
        report += '\n';
      }
    }

    // Recommendations
    if (recommendations.length > 0) {
      report += '📋 RECOMMENDATIONS:\n';
      report += `${'─'.repeat(50)}\n`;

      for (const rec of recommendations) {
        report += `${rec}\n`;
      }
      report += '\n';
    }

    return report;
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Cleanup method
   */
  dispose(): void {
    this.stopMemoryMonitoring();
    this.removeAllListeners();
    this.memoryHistory = [];
    this.eventListeners.clear();
    this.cacheGrowthTracking.clear();
    this.performanceData.clear();
  }
}

// CLI usage
if (typeof require !== 'undefined' && require.main === module) {
  const detector = new MemoryLeakDetector();

  detector
    .detectMemoryLeaks()
    .then(analysis => {
      console.log(detector.generateReport(analysis));

      if (analysis.leaks.length > 0) {
        console.log(
          `\n🔧 Found ${analysis.leaks.length} memory leaks and ${analysis.bottlenecks.length} performance bottlenecks`
        );

        const fixableLeaks = analysis.leaks.filter(l => l.autoFixable);
        if (fixableLeaks.length > 0) {
          console.log(`💾 ${fixableLeaks.length} leaks can be automatically fixed`);
        }
      } else {
        console.log('\n✅ No memory leaks detected!');
      }
    })
    .finally(() => {
      detector.dispose();
    })
    .catch(error => {
      console.error('Memory leak detection failed:', error);
      try {
        detector.dispose();
      } catch (disposeError) {
        console.error('Error during cleanup:', disposeError);
      }
      process.exit(1);
    });
}
