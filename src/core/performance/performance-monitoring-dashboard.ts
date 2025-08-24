/**
 * Performance Monitoring Dashboard
 * Comprehensive real-time performance monitoring and reporting system
 * 
 * Performance Impact: Provides 360° visibility into system performance
 */

import { logger } from '../logger.js';
import { requestBatcher } from './intelligent-request-batcher.js';
import { responseCache } from './response-cache-manager.js';
import { adaptiveTuner } from './adaptive-performance-tuner.js';
import { modelPreloader } from './model-preloader.js';
import { requestTimeoutOptimizer } from './request-timeout-optimizer.js';
import { startupOptimizer } from './startup-optimizer.js';
import { memoryOptimizer } from './memory-usage-optimizer.js';
import { streamingOptimizer } from './streaming-response-optimizer.js';

interface PerformanceDashboardData {
  timestamp: number;
  system: {
    uptime: number;
    memoryUsage: any;
    cpuUsage?: number;
  };
  requests: {
    batching: any;
    caching: any;
    timeouts: any;
  };
  optimization: {
    adaptive: any;
    preloader: any;
    startup: any;
    streaming: any;
  };
  health: {
    status: 'excellent' | 'good' | 'fair' | 'poor';
    score: number;
    issues: string[];
    recommendations: string[];
  };
}

interface PerformanceAlert {
  level: 'info' | 'warning' | 'error' | 'critical';
  component: string;
  message: string;
  timestamp: number;
  data?: any;
}

export class PerformanceMonitoringDashboard {
  private static instance: PerformanceMonitoringDashboard | null = null;
  private alerts: PerformanceAlert[] = [];
  private dashboardHistory: PerformanceDashboardData[] = [];
  private isMonitoring = false;
  private monitoringIntervalId: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): PerformanceMonitoringDashboard {
    if (!PerformanceMonitoringDashboard.instance) {
      PerformanceMonitoringDashboard.instance = new PerformanceMonitoringDashboard();
    }
    return PerformanceMonitoringDashboard.instance;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      logger.warn('Performance monitoring already started');
      return;
    }

    this.isMonitoring = true;
    this.monitoringIntervalId = setInterval(() => {
    // TODO: Store interval ID and call clearInterval in cleanup
      this.collectPerformanceData();
    }, intervalMs);

    logger.info('Performance monitoring dashboard started', {
      interval: `${intervalMs / 1000}s`
    });

    // Collect initial data
    this.collectPerformanceData();
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringIntervalId) {
      clearInterval(this.monitoringIntervalId);
      this.monitoringIntervalId = null;
    }

    logger.info('Performance monitoring dashboard stopped');
  }

  /**
   * Collect comprehensive performance data
   */
  private async collectPerformanceData(): Promise<void> {
    try {
      const timestamp = Date.now();
      
      // Collect data from all performance components
      const [
        batchingStats,
        cachingStats,
        timeoutStats,
        adaptiveStats,
        preloaderStats,
        startupStats,
        memoryStats,
        streamingStats
      ] = await Promise.all([
        this.safeGetStats(() => requestBatcher.getBatchingStats()),
        this.safeGetStats(() => responseCache.getStats()),
        this.safeGetStats(() => requestTimeoutOptimizer.getTimeoutStats()),
        this.safeGetStats(() => adaptiveTuner.getTuningStats()),
        this.safeGetStats(() => modelPreloader.getWarmupStats()),
        this.safeGetStats(() => startupOptimizer.getStartupAnalytics()),
        this.safeGetStats(() => memoryOptimizer.getMemoryStats()),
        this.safeGetStats(() => streamingOptimizer.getStreamingStats())
      ]);

      // Collect system stats
      const systemStats = this.collectSystemStats();

      // Create dashboard data
      const dashboardData: PerformanceDashboardData = {
        timestamp,
        system: systemStats,
        requests: {
          batching: batchingStats,
          caching: cachingStats,
          timeouts: timeoutStats
        },
        optimization: {
          adaptive: adaptiveStats,
          preloader: preloaderStats,
          startup: startupStats,
          streaming: streamingStats
        },
        health: this.calculateHealthScore(batchingStats, cachingStats, timeoutStats, adaptiveStats, memoryStats)
      };

      // Store dashboard data
      this.dashboardHistory.push(dashboardData);
      
      // Keep only last 100 entries (about 50 minutes at 30s intervals)
      if (this.dashboardHistory.length > 100) {
        this.dashboardHistory = this.dashboardHistory.slice(-50);
      }

      // Check for alerts
      this.checkForAlerts(dashboardData);

      logger.debug('Performance data collected', {
        healthStatus: dashboardData.health.status,
        healthScore: dashboardData.health.score,
        memoryUsage: `${systemStats.memoryUsage.current.heapUsed}MB`
      });

    } catch (error) {
      logger.error('Error collecting performance data:', error);
    }
  }

  /**
   * Safely get stats from components that might not be initialized
   */
  private async safeGetStats<T>(statsFn: () => T): Promise<T | null> {
    try {
      return statsFn();
    } catch (error) {
      return null;
    }
  }

  /**
   * Collect system-level statistics
   */
  private collectSystemStats(): any {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      uptime: Math.round(uptime),
      memoryUsage: {
        current: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024)
        }
      }
    };
  }

  /**
   * Calculate overall health score and status
   */
  private calculateHealthScore(
    batchingStats: any,
    cachingStats: any,
    timeoutStats: any,
    adaptiveStats: any,
    memoryStats: any
  ): { status: 'excellent' | 'good' | 'fair' | 'poor'; score: number; issues: string[]; recommendations: string[] } {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Evaluate caching performance (20% of score)
    if (cachingStats) {
      if (cachingStats.hitRate < 0.3) {
        score -= 15;
        issues.push('Low cache hit rate');
        recommendations.push('Optimize caching strategy');
      } else if (cachingStats.hitRate < 0.5) {
        score -= 8;
      }

      if (cachingStats.memoryUsage > 100) { // 100MB
        score -= 5;
        issues.push('High cache memory usage');
      }
    }

    // Evaluate timeout performance (15% of score)
    if (timeoutStats) {
      if (timeoutStats.timeoutRate > 0.1) {
        score -= 12;
        issues.push('High timeout rate');
        recommendations.push('Optimize request timeouts');
      } else if (timeoutStats.timeoutRate > 0.05) {
        score -= 6;
      }

      if (timeoutStats.averageRequestDuration > 20000) {
        score -= 8;
        issues.push('High average request duration');
      }
    }

    // Evaluate memory performance (25% of score)
    if (memoryStats) {
      const memoryUsageRatio = memoryStats.current.heapUsed / memoryStats.current.heapTotal;
      if (memoryUsageRatio > 0.9) {
        score -= 20;
        issues.push('Critical memory usage');
        recommendations.push('Immediate memory optimization needed');
      } else if (memoryUsageRatio > 0.8) {
        score -= 12;
        issues.push('High memory usage');
        recommendations.push('Monitor memory usage closely');
      } else if (memoryUsageRatio > 0.7) {
        score -= 5;
      }

      if (memoryStats.leaksDetected > 0) {
        score -= 10;
        issues.push(`${memoryStats.leaksDetected} potential memory leaks`);
        recommendations.push('Investigate memory leaks');
      }

      if (memoryStats.memoryTrend === 'increasing') {
        score -= 8;
        issues.push('Memory usage trending upward');
      }
    }

    // Evaluate adaptive tuning (15% of score)
    if (adaptiveStats) {
      const analysis = adaptiveStats.analysis || { status: 'good', issues: [], recommendations: [] };
      if (analysis.status === 'poor') {
        score -= 12;
        issues.push(...analysis.issues);
        recommendations.push(...analysis.recommendations);
      } else if (analysis.status === 'fair') {
        score -= 6;
        issues.push(...analysis.issues);
      }
    }

    // Evaluate batching performance (10% of score)
    if (batchingStats) {
      if (batchingStats.efficiencyRate < 0.5) {
        score -= 8;
        issues.push('Low batching efficiency');
        recommendations.push('Optimize request batching');
      } else if (batchingStats.efficiencyRate < 0.7) {
        score -= 4;
      }

      if (batchingStats.pendingRequests > 10) {
        score -= 5;
        issues.push('High pending request queue');
      }
    }

    // Determine status based on score
    let status: 'excellent' | 'good' | 'fair' | 'poor';
    if (score >= 90) {
      status = 'excellent';
    } else if (score >= 75) {
      status = 'good';
    } else if (score >= 60) {
      status = 'fair';
    } else {
      status = 'poor';
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    return { status, score, issues, recommendations };
  }

  /**
   * Check for performance alerts
   */
  private checkForAlerts(data: PerformanceDashboardData): void {
    // Critical memory usage
    if (data.system.memoryUsage.current.heapUsed / data.system.memoryUsage.current.heapTotal > 0.95) {
      this.addAlert('critical', 'memory', 'Critical memory usage detected', {
        usage: `${(data.system.memoryUsage.current.heapUsed / data.system.memoryUsage.current.heapTotal * 100).toFixed(1)}%`
      });
    }

    // High timeout rate
    if (data.requests.timeouts && data.requests.timeouts.timeoutRate > 0.15) {
      this.addAlert('error', 'timeouts', 'High timeout rate detected', {
        rate: `${(data.requests.timeouts.timeoutRate * 100).toFixed(1)}%`
      });
    }

    // Poor health score
    if (data.health.score < 50) {
      this.addAlert('critical', 'health', 'Poor system health detected', {
        score: data.health.score,
        issues: data.health.issues
      });
    } else if (data.health.score < 70) {
      this.addAlert('warning', 'health', 'System health degraded', {
        score: data.health.score
      });
    }

    // Low cache hit rate
    if (data.requests.caching && data.requests.caching.hitRate < 0.2) {
      this.addAlert('warning', 'caching', 'Very low cache hit rate', {
        hitRate: `${(data.requests.caching.hitRate * 100).toFixed(1)}%`
      });
    }
  }

  /**
   * Add performance alert
   */
  private addAlert(level: PerformanceAlert['level'], component: string, message: string, data?: any): void {
    const alert: PerformanceAlert = {
      level,
      component,
      message,
      timestamp: Date.now(),
      data
    };

    // Check if similar alert already exists in last 5 minutes
    const recentSimilar = this.alerts.find(a => 
      a.component === component && 
      a.message === message && 
      Date.now() - a.timestamp < 300000
    );

    if (!recentSimilar) {
      this.alerts.push(alert);
      
      // Keep only last 50 alerts
      if (this.alerts.length > 50) {
        this.alerts = this.alerts.slice(-25);
      }

      // Log alert
      const logLevel = level === 'critical' ? 'error' : level === 'error' ? 'error' : 'warn';
      logger[logLevel](`Performance Alert [${level.toUpperCase()}] ${component}: ${message}`, data);
    }
  }

  /**
   * Get current performance dashboard data
   */
  getCurrentDashboard(): PerformanceDashboardData | null {
    return this.dashboardHistory[this.dashboardHistory.length - 1] || null;
  }

  /**
   * Get recent performance history
   */
  getPerformanceHistory(count: number = 20): PerformanceDashboardData[] {
    return this.dashboardHistory.slice(-count);
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(count: number = 10): PerformanceAlert[] {
    return this.alerts.slice(-count);
  }

  /**
   * Get comprehensive performance report
   */
  getPerformanceReport(): {
    summary: {
      status: string;
      score: number;
      uptime: string;
      memoryUsage: string;
      activeAlerts: number;
    };
    components: {
      caching: any;
      batching: any;
      timeouts: any;
      adaptive: any;
      memory: any;
      streaming: any;
    };
    trends: {
      memoryTrend: string;
      performanceTrend: string;
    };
    recommendations: string[];
    recentAlerts: PerformanceAlert[];
  } {
    const current = this.getCurrentDashboard();
    
    if (!current) {
      return {
        summary: { status: 'unknown', score: 0, uptime: '0s', memoryUsage: '0MB', activeAlerts: 0 },
        components: {
          caching: null,
          batching: null,
          timeouts: null,
          adaptive: null,
          memory: null,
          streaming: null
        },
        trends: { memoryTrend: 'unknown', performanceTrend: 'unknown' },
        recommendations: ['Start performance monitoring to see data'],
        recentAlerts: []
      };
    }

    // Calculate trends
    const trends = this.calculateTrends();

    return {
      summary: {
        status: current.health.status,
        score: current.health.score,
        uptime: this.formatUptime(current.system.uptime),
        memoryUsage: `${current.system.memoryUsage.current.heapUsed}MB`,
        activeAlerts: this.alerts.filter(a => Date.now() - a.timestamp < 300000).length
      },
      components: {
        caching: current.requests.caching,
        batching: current.requests.batching,
        timeouts: current.requests.timeouts,
        adaptive: current.optimization.adaptive,
        memory: current.system.memoryUsage,
        streaming: current.optimization.streaming
      },
      trends,
      recommendations: current.health.recommendations,
      recentAlerts: this.getRecentAlerts()
    };
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(): { memoryTrend: string; performanceTrend: string } {
    if (this.dashboardHistory.length < 5) {
      return { memoryTrend: 'insufficient-data', performanceTrend: 'insufficient-data' };
    }

    const recent = this.dashboardHistory.slice(-5);
    const older = this.dashboardHistory.slice(-10, -5);

    // Memory trend
    let memoryTrend = 'stable';
    if (older.length > 0) {
      const recentMemAvg = recent.reduce((sum, d) => sum + d.system.memoryUsage.current.heapUsed, 0) / recent.length;
      const olderMemAvg = older.reduce((sum, d) => sum + d.system.memoryUsage.current.heapUsed, 0) / older.length;
      
      if (recentMemAvg > olderMemAvg * 1.1) {
        memoryTrend = 'increasing';
      } else if (recentMemAvg < olderMemAvg * 0.9) {
        memoryTrend = 'decreasing';
      }
    }

    // Performance trend
    let performanceTrend = 'stable';
    if (older.length > 0) {
      const recentPerfAvg = recent.reduce((sum, d) => sum + d.health.score, 0) / recent.length;
      const olderPerfAvg = older.reduce((sum, d) => sum + d.health.score, 0) / older.length;
      
      if (recentPerfAvg > olderPerfAvg * 1.05) {
        performanceTrend = 'improving';
      } else if (recentPerfAvg < olderPerfAvg * 0.95) {
        performanceTrend = 'degrading';
      }
    }

    return { memoryTrend, performanceTrend };
  }

  /**
   * Format uptime for display
   */
  private formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.dashboardHistory = [];
    this.alerts = [];
    logger.info('Performance monitoring history cleared');
  }

  /**
   * Export performance data
   */
  exportData(): {
    exportTime: number;
    history: PerformanceDashboardData[];
    alerts: PerformanceAlert[];
    summary: any;
  } {
    return {
      exportTime: Date.now(),
      history: this.dashboardHistory,
      alerts: this.alerts,
      summary: this.getPerformanceReport().summary
    };
  }

  /**
   * Shutdown dashboard
   */
  shutdown(): void {
    this.stopMonitoring();
    
    const report = this.getPerformanceReport();
    logger.info('🔄 PerformanceMonitoringDashboard shutting down', {
      finalStatus: report.summary.status,
      finalScore: report.summary.score,
      totalAlerts: this.alerts.length,
      monitoringTime: report.summary.uptime
    });

    this.dashboardHistory = [];
    this.alerts = [];
  }
}

// Global instance for easy access
export const performanceDashboard = PerformanceMonitoringDashboard.getInstance();