#!/usr/bin/env node

/**
 * Performance Monitor - Consolidated performance tracking and metrics
 * Replaces: system-benchmark.ts, performance-optimized-client.ts, and scattered metrics
 */

import { EventEmitter } from 'events';
import { cpus } from 'os';
import { logger } from '../core/logger.js';
import { PerformanceMetrics, ProviderMetrics } from '../core/types.js';

export interface RequestMetrics {
  provider: string;
  model: string;
  startTime: number;
  endTime?: number;
  tokenCount?: number;
  success: boolean;
  error?: string;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
}

export interface PerformanceAlert {
  type: 'latency' | 'error_rate' | 'resource_usage';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  provider?: string;
  timestamp: Date;
}

export class PerformanceMonitor extends EventEmitter {
  private providerMetrics: Map<string, ProviderMetrics> = new Map();
  private requestHistory: RequestMetrics[] = [];
  private systemMetrics: SystemMetrics | null = null;
  private alerts: PerformanceAlert[] = [];
  private startTime: number = Date.now();
  private monitoringEnabled: boolean;
  private monitoringInterval?: NodeJS.Timeout;
  private lastAlertTimes: Map<string, number> = new Map(); // Track last alert times to prevent spam
  
  private readonly MAX_HISTORY_SIZE = 50; // OPTIMIZED: Reduced from 1000 to prevent memory leaks
  private readonly ALERT_THRESHOLDS = {
    latency: 10000, // 10 seconds
    errorRate: 0.1, // 10%
    memoryUsage: 0.85 // 85%
  };

  constructor(enableMonitoring: boolean = true) {
    super();
    this.monitoringEnabled = enableMonitoring;
    
    // Set higher max listeners to avoid warnings during testing
    this.setMaxListeners(20);
    
    if (this.monitoringEnabled) {
      this.initializeSystemMonitoring();
    }
  }

  private initializeSystemMonitoring(): void {
    if (!this.monitoringEnabled) return;
    
    // Update system metrics every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.updateSystemMetrics();
      } catch (error) {
        // Silent error handling to prevent crashes
        console.warn('Performance monitoring error:', error);
      }
    }, 30000);
    
    // Prevent interval from keeping process alive during tests
    this.monitoringInterval.unref();

    // Initial system metrics
    this.updateSystemMetrics();
  }

  /**
   * Disable monitoring and clean up intervals
   */
  public disableMonitoring(): void {
    this.monitoringEnabled = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }


  /**
   * Clean up resources and disable monitoring
   */
  public destroy(): void {
    this.disableMonitoring();
    this.removeAllListeners();
    this.providerMetrics.clear();
    this.requestHistory.length = 0;
    this.alerts.length = 0;
  }

  private async updateSystemMetrics(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      
      this.systemMetrics = {
        cpu: {
          usage: await this.getCPUUsage(),
          cores: cpus().length
        },
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: memUsage.heapUsed / memUsage.heapTotal
        },
        disk: {
          used: 0, // Would require additional implementation
          total: 0,
          percentage: 0
        }
      };

      // Check for memory alerts
      if (this.systemMetrics.memory.percentage > this.ALERT_THRESHOLDS.memoryUsage) {
        this.createAlert({
          type: 'resource_usage',
          severity: 'warning',
          message: 'High memory usage detected',
          value: this.systemMetrics.memory.percentage,
          threshold: this.ALERT_THRESHOLDS.memoryUsage,
          timestamp: new Date()
        });
      }

    } catch (error) {
      logger.warn('Failed to update system metrics:', error);
    }
  }

  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const totalUsage = currentUsage.user + currentUsage.system;
        const percentage = totalUsage / 1000000; // Convert microseconds to seconds
        resolve(Math.min(percentage, 100));
      }, 100);
    });
  }

  /**
   * Record a request for performance tracking
   */
  recordRequest(provider: string, metrics: RequestMetrics): void {
    // Add to history
    this.requestHistory.push(metrics);
    
    // OPTIMIZED: Aggressive trimming to prevent memory leaks
    if (this.requestHistory.length > this.MAX_HISTORY_SIZE) {
      this.requestHistory = this.requestHistory.slice(-25); // Keep only 25 most recent
    }

    // Update provider metrics
    this.updateProviderMetrics(provider, metrics);

    // Check for performance alerts
    this.checkPerformanceAlerts(provider, metrics);

    // Emit metrics event
    this.emit('metrics', { provider, metrics });
  }

  private updateProviderMetrics(provider: string, metrics: RequestMetrics): void {
    let providerStats = this.providerMetrics.get(provider);
    
    if (!providerStats) {
      providerStats = {
        requests: 0,
        totalRequests: 0,
        totalLatency: 0,
        averageLatency: 0,
        successRate: 0,
        errorRate: 0
      };
      this.providerMetrics.set(provider, providerStats);
    }

    // Update total requests
    providerStats.requests++;
    providerStats.totalRequests++;

    // Update latency
    if (metrics.endTime && metrics.startTime) {
      const latency = metrics.endTime - metrics.startTime;
      providerStats.totalLatency += latency;
      providerStats.averageLatency = (
        (providerStats.averageLatency * (providerStats.totalRequests - 1) + latency) /
        providerStats.totalRequests
      );
    }

    // Update success/error rates
    const recentRequests = this.requestHistory
      .filter(r => r.provider === provider)
      .slice(-100); // Last 100 requests

    const successCount = recentRequests.filter(r => r.success).length;
    providerStats.successRate = successCount / recentRequests.length;
    providerStats.errorRate = 1 - providerStats.successRate;

    // Update last error
    if (!metrics.success && metrics.error) {
      providerStats.lastError = metrics.error;
    }
  }

  private checkPerformanceAlerts(provider: string, metrics: RequestMetrics): void {
    const providerStats = this.providerMetrics.get(provider);
    if (!providerStats) return;

    // Check latency alert
    if (metrics.endTime && metrics.startTime) {
      const latency = metrics.endTime - metrics.startTime;
      if (latency > this.ALERT_THRESHOLDS.latency) {
        this.createAlert({
          type: 'latency',
          severity: latency > this.ALERT_THRESHOLDS.latency * 2 ? 'critical' : 'warning',
          message: `High latency detected for provider ${provider}`,
          value: latency,
          threshold: this.ALERT_THRESHOLDS.latency,
          provider,
          timestamp: new Date()
        });
      }
    }

    // Check error rate alert
    if (providerStats.errorRate > this.ALERT_THRESHOLDS.errorRate) {
      this.createAlert({
        type: 'error_rate',
        severity: providerStats.errorRate > this.ALERT_THRESHOLDS.errorRate * 2 ? 'critical' : 'warning',
        message: `High error rate detected for provider ${provider}`,
        value: providerStats.errorRate,
        threshold: this.ALERT_THRESHOLDS.errorRate,
        provider,
        timestamp: new Date()
      });
    }
  }

  private createAlert(alert: PerformanceAlert): void {
    // Create unique key for alert throttling
    const alertKey = `${alert.type}_${alert.provider || 'system'}_${alert.severity}`;
    const now = Date.now();
    const lastAlertTime = this.lastAlertTimes.get(alertKey) || 0;
    
    // Throttle alerts - only allow one alert of same type per 60 seconds
    if (now - lastAlertTime < 60000) { // 60 seconds
      return; // Skip this alert to prevent spam
    }
    
    this.lastAlertTimes.set(alertKey, now);
    this.alerts.push(alert);
    
    // OPTIMIZED: Keep only recent alerts (last 25 instead of 100)
    if (this.alerts.length > 25) {
      this.alerts = this.alerts.slice(-15); // Keep only 15 most recent
    }

    // Log alert
    const logLevel = alert.severity === 'critical' ? 'error' : 'warn';
    logger[logLevel](`🚨 Performance Alert: ${alert.message}`, {
      type: alert.type,
      value: alert.value,
      threshold: alert.threshold,
      provider: alert.provider
    });

    // Emit alert event
    this.emit('alert', alert);
  }

  /**
   * Get metrics for a specific provider
   */
  getProviderMetrics(provider?: string): Record<string, ProviderMetrics> {
    if (provider) {
      const metrics = this.providerMetrics.get(provider);
      return metrics ? { [provider]: metrics } : {};
    }
    
    return Object.fromEntries(this.providerMetrics.entries());
  }

  /**
   * Get overall performance summary
   */
  getSummary(): PerformanceMetrics {
    const providers = Object.fromEntries(this.providerMetrics.entries());
    
    // Calculate overall metrics
    const totalRequests = Array.from(this.providerMetrics.values())
      .reduce((sum, metrics) => sum + metrics.totalRequests, 0);
    
    const averageLatency = Array.from(this.providerMetrics.values())
      .reduce((sum, metrics) => {
        return sum + (metrics.averageLatency * metrics.totalRequests) / totalRequests;
      }, 0);
    
    const successRate = Array.from(this.providerMetrics.values())
      .reduce((sum, metrics) => {
        return sum + (metrics.successRate * metrics.totalRequests) / totalRequests;
      }, 0);

    const uptime = (Date.now() - this.startTime) / 1000; // seconds

    return {
      timestamp: new Date(),
      totalRequests,
      averageLatency: averageLatency || 0,
      errorRate: 1 - (successRate || 0),
      providers,
      overall: {
        totalRequests,
        averageLatency: averageLatency || 0,
        successRate: successRate || 0,
        uptime
      }
    };
  }

  /**
   * Get recent performance alerts
   */
  getAlerts(limit: number = 10): PerformanceAlert[] {
    return this.alerts
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics | null {
    return this.systemMetrics;
  }

  /**
   * Get request history
   */
  getRequestHistory(provider?: string, limit: number = 100): RequestMetrics[] {
    let history = this.requestHistory;
    
    if (provider) {
      history = history.filter(r => r.provider === provider);
    }
    
    return history.slice(-limit);
  }

  /**
   * Reset metrics for a provider
   */
  resetProviderMetrics(provider: string): void {
    this.providerMetrics.delete(provider);
    this.requestHistory = this.requestHistory.filter(r => r.provider !== provider);
    logger.info(`🔄 Reset metrics for provider: ${provider}`);
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.providerMetrics.clear();
    this.requestHistory.length = 0;
    this.alerts.length = 0;
    this.startTime = Date.now();
    logger.info('🧹 Cleared all performance metrics');
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): {
    summary: PerformanceMetrics;
    history: RequestMetrics[];
    alerts: PerformanceAlert[];
    system: SystemMetrics | null;
    exportTime: Date;
  } {
    return {
      summary: this.getSummary(),
      history: this.requestHistory,
      alerts: this.alerts,
      system: this.systemMetrics,
      exportTime: new Date()
    };
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): Array<{
    type: 'performance' | 'reliability' | 'resource';
    priority: 'low' | 'medium' | 'high';
    description: string;
    action: string;
  }> {
    const recommendations = [];
    const summary = this.getSummary();

    // Check overall latency
    if (summary.overall.averageLatency > 5000) {
      recommendations.push({
        type: 'performance' as const,
        priority: 'high' as const,
        description: 'Average response latency is high',
        action: 'Consider optimizing models or switching to faster providers'
      });
    }

    // Check success rate
    if (summary.overall.successRate < 0.9) {
      recommendations.push({
        type: 'reliability' as const,
        priority: 'high' as const,
        description: 'Success rate is below 90%',
        action: 'Review error logs and improve error handling'
      });
    }

    // Check memory usage
    if (this.systemMetrics && this.systemMetrics.memory.percentage > 0.8) {
      recommendations.push({
        type: 'resource' as const,
        priority: 'medium' as const,
        description: 'High memory usage detected',
        action: 'Consider increasing memory allocation or optimizing memory usage'
      });
    }

    // Check provider balance
    const providerCounts = Object.values(summary.providers).map(p => p.totalRequests);
    const maxRequests = Math.max(...providerCounts);
    const minRequests = Math.min(...providerCounts);
    
    if (maxRequests > minRequests * 3) {
      recommendations.push({
        type: 'performance' as const,
        priority: 'low' as const,
        description: 'Unbalanced load distribution across providers',
        action: 'Consider implementing better load balancing'
      });
    }

    return recommendations;
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    logger.info('📊 Performance monitoring started');
    this.emit('started');
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    this.clearAllMetrics();
    logger.info('📊 Performance monitoring stopped');
    this.emit('stopped');
  }

  /**
   * Start operation tracking (for compatibility)
   */
  startOperation(operationId: string, component?: string): void {
    const startTime = Date.now();
    if (!this.operationTracking) {
      this.operationTracking = new Map();
    }
    this.operationTracking.set(operationId, { startTime, component });
  }

  /**
   * End operation tracking (for compatibility)
   */
  endOperation(operationId: string): void {
    if (!this.operationTracking) {
      return;
    }
    const operation = this.operationTracking.get(operationId);
    if (operation) {
      const endTime = Date.now();
      
      // Record as a request metric for tracking
      this.recordRequest(operation.component || 'unknown', {
        provider: operation.component || 'unknown',
        model: 'operation',
        startTime: operation.startTime,
        endTime,
        success: true
      });
      
      this.operationTracking.delete(operationId);
    }
  }

  private operationTracking?: Map<string, { startTime: number; component?: string }>;
}
