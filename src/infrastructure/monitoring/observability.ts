/**
 * Observability and Monitoring System
 * Provides enterprise-grade monitoring, metrics, and observability features
 */

import { EventEmitter } from 'events';
import { logger } from '../../infrastructure/logging/logger.js';

export interface MetricValue {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface HealthMetric {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details?: Record<string, any>;
}

export interface ObservabilityConfig {
  metricsEnabled: boolean;
  tracingEnabled: boolean;
  loggingLevel: string;
  retentionDays: number;
}

export class ObservabilitySystem extends EventEmitter {
  private metrics: Map<string, MetricValue[]> = new Map();
  private config: ObservabilityConfig;
  private healthMetrics: Map<string, HealthMetric> = new Map();

  constructor(config: Partial<ObservabilityConfig> = {}) {
    super();
    this.config = {
      metricsEnabled: true,
      tracingEnabled: true,
      loggingLevel: 'info',
      retentionDays: 7,
      ...config,
    };
  }

  public recordMetric(metric: MetricValue): void {
    if (!this.config.metricsEnabled) return;

    const metricHistory = this.metrics.get(metric.name) || [];
    metricHistory.push(metric);

    // Keep only recent metrics based on retention policy
    const cutoffTime = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
    const filteredHistory = metricHistory.filter(m => m.timestamp > cutoffTime);

    this.metrics.set(metric.name, filteredHistory);
    this.emit('metric-recorded', metric);
  }

  public recordHealthMetric(healthMetric: HealthMetric): void {
    this.healthMetrics.set(healthMetric.component, healthMetric);
    this.emit('health-metric-recorded', healthMetric);
  }

  public getMetric(name: string): MetricValue[] {
    return this.metrics.get(name) || [];
  }

  public getHealthMetric(component: string): HealthMetric | undefined {
    return this.healthMetrics.get(component);
  }

  public getAllMetrics(): Record<string, MetricValue[]> {
    return Object.fromEntries(this.metrics.entries());
  }

  public getAllHealthMetrics(): Record<string, HealthMetric> {
    return Object.fromEntries(this.healthMetrics.entries());
  }

  public getSystemOverview(): {
    totalMetrics: number;
    healthyComponents: number;
    unhealthyComponents: number;
    averageResponseTime: number;
  } {
    const totalMetrics = Array.from(this.metrics.values()).reduce(
      (sum, metrics) => sum + metrics.length,
      0
    );

    const healthMetrics = Array.from(this.healthMetrics.values());
    const healthyComponents = healthMetrics.filter(m => m.status === 'healthy').length;
    const unhealthyComponents = healthMetrics.filter(m => m.status === 'unhealthy').length;

    const averageResponseTime =
      healthMetrics.length > 0
        ? healthMetrics.reduce((sum, m) => sum + m.responseTime, 0) / healthMetrics.length
        : 0;

    return {
      totalMetrics,
      healthyComponents,
      unhealthyComponents,
      averageResponseTime,
    };
  }

  public startMonitoring(): void {
    logger.info('Observability system started');
    this.emit('monitoring-started');
  }

  public stopMonitoring(): void {
    logger.info('Observability system stopped');
    this.emit('monitoring-stopped');
  }

  public clearMetrics(): void {
    this.metrics.clear();
    this.healthMetrics.clear();
    logger.info('All metrics cleared');
  }
}

// Export singleton instance
export const observabilitySystem = new ObservabilitySystem();

// Export metrics and logging interfaces for compatibility
export const metrics = {
  apiRequestDuration: {
    observe: (labels: Record<string, string>, value: number) => {
      observabilitySystem.recordMetric({
        name: 'api_request_duration',
        value,
        timestamp: new Date(),
        tags: labels,
      });
    },
  },
  memoryUsage: {
    set: (value: number) => {
      observabilitySystem.recordMetric({
        name: 'memory_usage',
        value,
        timestamp: new Date(),
        tags: { type: 'heap' },
      });
    },
  },
};

export const logging = {
  error: (message: string, error?: Error) => {
    console.error(message, error);
    if (error) {
      observabilitySystem.recordMetric({
        name: 'error_count',
        value: 1,
        timestamp: new Date(),
        tags: { level: 'error', message },
      });
    }
  },
  warn: (message: string) => {
    console.warn(message);
    observabilitySystem.recordMetric({
      name: 'warn_log_count',
      value: 1,
      timestamp: new Date(),
      tags: { level: 'warn', message },
    });
  },
  info: (message: string) => {
    console.info(message);
    observabilitySystem.recordMetric({
      name: 'info_log_count',
      value: 1,
      timestamp: new Date(),
      tags: { level: 'info', message },
    });
  },
};
