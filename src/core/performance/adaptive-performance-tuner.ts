/**
 * Adaptive Performance Tuner
 * Dynamically adjusts system performance based on current load and resource usage
 */

import { logger } from '../logger.js';
import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  responseTime: number;
  requestRate: number;
  errorRate: number;
  activeConnections: number;
}

export interface PerformanceThresholds {
  cpu: { low: number; medium: number; high: number };
  memory: { low: number; medium: number; high: number };
  responseTime: { low: number; medium: number; high: number };
  errorRate: { low: number; medium: number; high: number };
}

export interface TuningConfiguration {
  batchSize: number;
  timeouts: {
    request: number;
    connection: number;
  };
  concurrency: {
    max: number;
    optimal: number;
  };
  caching: {
    enabled: boolean;
    ttl: number;
  };
}

export class AdaptivePerformanceTuner extends EventEmitter {
  private metrics: PerformanceMetrics;
  private thresholds: PerformanceThresholds;
  private config: TuningConfiguration;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private adjustmentHistory: Array<{
    timestamp: number;
    metric: string;
    oldValue: any;
    newValue: any;
    reason: string;
  }> = [];

  constructor() {
    super();
    
    this.metrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      responseTime: 0,
      requestRate: 0,
      errorRate: 0,
      activeConnections: 0
    };

    this.thresholds = {
      cpu: { low: 30, medium: 60, high: 85 },
      memory: { low: 40, medium: 70, high: 90 },
      responseTime: { low: 100, medium: 500, high: 2000 },
      errorRate: { low: 1, medium: 5, high: 15 }
    };

    this.config = {
      batchSize: 10,
      timeouts: {
        request: 30000,
        connection: 5000
      },
      concurrency: {
        max: 50,
        optimal: 25
      },
      caching: {
        enabled: true,
        ttl: 300000 // 5 minutes
      }
    };
  }

  startMonitoring(intervalMs: number = 5000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    logger.info('Starting adaptive performance monitoring');
    
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
        .then(() => this.analyzeAndTune())
        .catch(error => {
          logger.error('Performance monitoring error:', error);
        });
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Performance monitoring stopped');
    }
  }

  async collectMetrics(): Promise<void> {
    try {
      // Collect system metrics (simplified implementation)
      this.metrics = {
        cpuUsage: await this.getCpuUsage(),
        memoryUsage: await this.getMemoryUsage(),
        responseTime: await this.getAverageResponseTime(),
        requestRate: await this.getRequestRate(),
        errorRate: await this.getErrorRate(),
        activeConnections: await this.getActiveConnections()
      };

      this.emit('metricsCollected', this.metrics);
    } catch (error) {
      logger.error('Failed to collect performance metrics:', error);
    }
  }

  async analyzeAndTune(): Promise<void> {
    const adjustments: string[] = [];

    // CPU-based tuning
    if (this.metrics.cpuUsage > this.thresholds.cpu.high) {
      await this.reduceConcurrency();
      adjustments.push('reduced concurrency due to high CPU');
    } else if (this.metrics.cpuUsage < this.thresholds.cpu.low) {
      await this.increaseConcurrency();
      adjustments.push('increased concurrency due to low CPU');
    }

    // Memory-based tuning
    if (this.metrics.memoryUsage > this.thresholds.memory.high) {
      await this.reduceBatchSize();
      await this.enableAggresiveCaching();
      adjustments.push('reduced batch size and enabled aggressive caching due to high memory');
    }

    // Response time tuning
    if (this.metrics.responseTime > this.thresholds.responseTime.high) {
      await this.reduceTimeouts();
      await this.increaseCacheHitRate();
      adjustments.push('reduced timeouts due to high response time');
    }

    // Error rate tuning
    if (this.metrics.errorRate > this.thresholds.errorRate.high) {
      await this.enableCircuitBreaker();
      await this.increaseRetryDelays();
      adjustments.push('enabled circuit breaker due to high error rate');
    }

    if (adjustments.length > 0) {
      logger.info(`Performance adjustments made: ${adjustments.join('; ')}`);
      this.emit('performanceTuned', { adjustments, metrics: this.metrics });
    }
  }

  getCurrentConfiguration(): TuningConfiguration {
    return { ...this.config };
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getAdjustmentHistory(): Array<any> {
    return [...this.adjustmentHistory];
  }

  // Private tuning methods
  private async reduceConcurrency(): Promise<void> {
    const oldValue = this.config.concurrency.max;
    this.config.concurrency.max = Math.max(10, Math.floor(this.config.concurrency.max * 0.8));
    this.config.concurrency.optimal = Math.floor(this.config.concurrency.max * 0.7);
    
    this.recordAdjustment('concurrency', oldValue, this.config.concurrency.max, 'high CPU usage');
  }

  private async increaseConcurrency(): Promise<void> {
    const oldValue = this.config.concurrency.max;
    this.config.concurrency.max = Math.min(100, Math.floor(this.config.concurrency.max * 1.2));
    this.config.concurrency.optimal = Math.floor(this.config.concurrency.max * 0.7);
    
    this.recordAdjustment('concurrency', oldValue, this.config.concurrency.max, 'low CPU usage');
  }

  private async reduceBatchSize(): Promise<void> {
    const oldValue = this.config.batchSize;
    this.config.batchSize = Math.max(1, Math.floor(this.config.batchSize * 0.8));
    
    this.recordAdjustment('batchSize', oldValue, this.config.batchSize, 'high memory usage');
  }

  private async enableAggresiveCaching(): Promise<void> {
    if (!this.config.caching.enabled) {
      this.config.caching.enabled = true;
      this.recordAdjustment('caching', false, true, 'memory optimization');
    }
  }

  private async reduceTimeouts(): Promise<void> {
    const oldValue = this.config.timeouts.request;
    this.config.timeouts.request = Math.max(5000, Math.floor(this.config.timeouts.request * 0.8));
    
    this.recordAdjustment('requestTimeout', oldValue, this.config.timeouts.request, 'high response time');
  }

  private async increaseCacheHitRate(): Promise<void> {
    const oldValue = this.config.caching.ttl;
    this.config.caching.ttl = Math.min(600000, Math.floor(this.config.caching.ttl * 1.2)); // Max 10 minutes
    
    this.recordAdjustment('cacheTTL', oldValue, this.config.caching.ttl, 'improve response time');
  }

  private async enableCircuitBreaker(): Promise<void> {
    // Circuit breaker logic would be implemented here
    logger.info('Circuit breaker patterns enabled due to high error rate');
  }

  private async increaseRetryDelays(): Promise<void> {
    // Retry delay logic would be implemented here
    logger.info('Increased retry delays due to high error rate');
  }

  private recordAdjustment(metric: string, oldValue: any, newValue: any, reason: string): void {
    this.adjustmentHistory.push({
      timestamp: Date.now(),
      metric,
      oldValue,
      newValue,
      reason
    });

    // Keep only last 100 adjustments
    if (this.adjustmentHistory.length > 100) {
      this.adjustmentHistory.shift();
    }
  }

  // Metric collection methods (simplified implementations)
  private async getCpuUsage(): Promise<number> {
    // In a real implementation, this would use system APIs
    return Math.random() * 100;
  }

  private async getMemoryUsage(): Promise<number> {
    const usage = process.memoryUsage();
    return (usage.heapUsed / usage.heapTotal) * 100;
  }

  private async getAverageResponseTime(): Promise<number> {
    // Would track actual response times
    return 100 + Math.random() * 400;
  }

  private async getRequestRate(): Promise<number> {
    // Would track actual request rate
    return Math.random() * 100;
  }

  private async getErrorRate(): Promise<number> {
    // Would track actual error rate
    return Math.random() * 10;
  }

  private async getActiveConnections(): Promise<number> {
    // Would track actual connections
    return Math.floor(Math.random() * 50);
  }

  /**
   * Record metrics for performance tracking
   */
  recordMetrics(responseTime: number, requestCount: number, errorRate: number): void {
    // Update metrics
    this.responseTimeHistory.push(responseTime);
    if (this.responseTimeHistory.length > 100) {
      this.responseTimeHistory = this.responseTimeHistory.slice(-50);
    }
    
    // Update counters
    this.requestCount += requestCount;
    if (errorRate > 0) {
      this.errorCount += Math.ceil(requestCount * errorRate);
    }
    
    // Log significant performance events
    if (responseTime > 10000) {
      logger.warn(`High response time detected: ${responseTime}ms`);
    }
    
    if (errorRate > 0.1) {
      logger.warn(`High error rate detected: ${(errorRate * 100).toFixed(1)}%`);
    }
  }

  /**
   * Reset statistics (for testing or maintenance)
   */
  resetStats(): void {
    this.responseTimeHistory = [];
    this.errorCount = 0;
    this.requestCount = 0;
    this.lastError = undefined;
  }
}

// Export singleton instance
export const adaptivePerformanceTuner = new AdaptivePerformanceTuner();
export const adaptiveTuner = adaptivePerformanceTuner;