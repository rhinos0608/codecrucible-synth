/**
 * Metrics Collector - Modularized Performance Tracking
 *
 * Extracted from UnifiedCLICoordinator to handle comprehensive metrics collection:
 * - Operation performance tracking and timing
 * - System health monitoring and reporting
 * - Resource usage monitoring (memory, CPU)
 * - Error tracking and recovery metrics
 * - Integration with observability systems
 * - Statistical analysis and reporting
 *
 * This module provides detailed insights into CLI system performance and health.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { logger } from '../../infrastructure/logging/unified-logger.js';
import {
  ObservabilitySystem,
  TraceSpan,
} from '../../infrastructure/observability/observability-system.js';

export interface OperationMetrics {
  operationId: string;
  operationType: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  memoryUsed?: number;
  contextTokens?: number;
  responseTokens?: number;
}

export interface SystemHealthMetrics {
  timestamp: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  activeSessions: number;
  activeOperations: number;
  errorRate: number;
  averageResponseTime: number;
  systemLoad: number;
}

export interface MetricsCollectorOptions {
  enableDetailedMetrics?: boolean;
  enableSystemMonitoring?: boolean;
  metricsRetentionMs?: number;
  healthCheckIntervalMs?: number;
  errorThreshold?: number;
}

export interface MetricsSummary {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  errorRate: number;
  totalProcessingTime: number;
  memoryHighWaterMark: number;
  operationTypeDistribution: Record<string, number>;
}

/**
 * Collects and manages performance metrics and system health data
 */
export class MetricsCollector extends EventEmitter {
  private readonly observabilitySystem: ObservabilitySystem;
  private readonly options: Required<MetricsCollectorOptions>;

  // Metrics storage
  private readonly operationMetrics: Map<string, OperationMetrics> = new Map();
  private systemHealthHistory: SystemHealthMetrics[] = [];
  private readonly activeOperations: Map<string, OperationMetrics> = new Map();

  // Performance tracking
  private readonly globalStats = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    totalProcessingTime: 0,
    memoryHighWaterMark: 0,
  };

  // Health monitoring
  private healthCheckInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  public constructor(options: MetricsCollectorOptions = {}) {
    super();

    this.options = {
      enableDetailedMetrics: options.enableDetailedMetrics ?? true,
      enableSystemMonitoring: options.enableSystemMonitoring ?? true,
      metricsRetentionMs: options.metricsRetentionMs ?? 3600000, // 1 hour
      healthCheckIntervalMs: options.healthCheckIntervalMs ?? 30000, // 30 seconds
      errorThreshold: options.errorThreshold ?? 0.1, // 10% error rate threshold
    };

    // Initialize observability system
    this.observabilitySystem = new ObservabilitySystem({
      metrics: { enabled: true, retentionDays: 7, exportInterval: 60000, exporters: [] },
      tracing: { enabled: true, samplingRate: 1.0, maxSpansPerTrace: 100, exporters: [] },
      logging: { level: 'info', outputs: [], structured: true, includeStackTrace: true },
      health: { checkInterval: 30000, timeoutMs: 5000, retryAttempts: 3 },
      alerting: { enabled: true, rules: [], defaultCooldown: 300000 },
      telemetry: { enabled: true, interval: 60000, exporters: [] },
      storage: {
        dataPath: './data/observability',
        maxFileSize: 100 * 1024 * 1024,
        compressionEnabled: true,
        encryptionEnabled: false,
      },
    });

    this.startHealthMonitoring();
  }

  /**
   * Start tracking an operation
   */
  public startOperation(
    operationId: string,
    operationType: string,
    metadata?: Readonly<Record<string, unknown>>
  ): TraceSpan | undefined {
    const startTime = performance.now();

    const metrics: OperationMetrics = {
      operationId,
      operationType,
      startTime,
      success: false, // Will be updated when operation completes
    };

    this.activeOperations.set(operationId, metrics);
    this.globalStats.totalOperations++;

    // Start tracing if enabled
    let traceSpan: TraceSpan | undefined;
    if (this.options.enableDetailedMetrics) {
      traceSpan = this.observabilitySystem.startSpan('cli-operation', {
        'operation.id': operationId,
        'operation.type': operationType,
        ...metadata,
      });
    }

    this.emit('operation:started', { operationId, operationType, startTime });

    if (this.options.enableDetailedMetrics) {
      logger.info(`📊 Started tracking operation ${operationId} (${operationType})`);
    }

    return traceSpan;
  }

  /**
   * Record operation completion
   */
  public recordOperation(
    operationId: string,
    success: boolean,
    error?: string,
    metadata?: Readonly<Record<string, unknown>>,
    traceSpan?: Readonly<TraceSpan>
  ): void {
    const activeMetrics = this.activeOperations.get(operationId);
    if (!activeMetrics) {
      logger.warn(`Attempted to record metrics for unknown operation: ${operationId}`);
      return;
    }

    const endTime = performance.now();
    const duration = endTime - activeMetrics.startTime;

    // Update metrics
    const completedMetrics: OperationMetrics = {
      ...activeMetrics,
      endTime,
      duration,
      success,
      error,
      memoryUsed: process.memoryUsage().heapUsed,
      ...metadata,
    };

    // Store completed metrics
    this.operationMetrics.set(operationId, completedMetrics);
    this.activeOperations.delete(operationId);

    // Update global stats
    if (success) {
      this.globalStats.successfulOperations++;
    } else {
      this.globalStats.failedOperations++;
    }
    this.globalStats.totalProcessingTime += duration;

    // Update memory high water mark
    const currentMemory = completedMetrics.memoryUsed ?? 0;
    if (currentMemory > this.globalStats.memoryHighWaterMark) {
      this.globalStats.memoryHighWaterMark = currentMemory;
    }

    // Record in observability system
    if (this.options.enableDetailedMetrics) {
      this.observabilitySystem.recordTimer('cli.operation.duration', duration, {
        operationType: activeMetrics.operationType,
        operationId,
        success: success.toString(),
      });

      this.observabilitySystem.incrementCounter('cli.operation.count', {
        operationType: activeMetrics.operationType,
        success: success.toString(),
      });

      // Complete trace span
      if (traceSpan) {
        this.observabilitySystem.finishSpan(traceSpan, {
          status: success ? 'ok' : 'error',
          'operation.duration': duration.toString(),
          'operation.error': error ?? '',
        });
      }
    }

    this.emit('operation:completed', completedMetrics);

    // Log performance information
    const statusSymbol = success ? '✅' : '❌';
    const memoryMB = currentMemory ? (currentMemory / 1024 / 1024).toFixed(2) : 'N/A';

    logger.info(
      `${statusSymbol} Operation ${operationId} (${activeMetrics.operationType}): ` +
        `${duration.toFixed(2)}ms, Memory: ${memoryMB}MB`
    );
  }

  /**
   * Record system health metrics
   */
  public recordSystemHealth(activeSessions: number = 0): SystemHealthMetrics {
    const memoryUsage = process.memoryUsage();
    const timestamp = performance.now();

    // Calculate error rate from recent operations
    const recentOpsCount = Math.min(this.globalStats.totalOperations, 100);
    const errorRate =
      recentOpsCount > 0 ? this.globalStats.failedOperations / this.globalStats.totalOperations : 0;

    // Calculate average response time
    const averageResponseTime =
      this.globalStats.totalOperations > 0
        ? this.globalStats.totalProcessingTime / this.globalStats.totalOperations
        : 0;

    const healthMetrics: SystemHealthMetrics = {
      timestamp,
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
      },
      activeSessions,
      activeOperations: this.activeOperations.size,
      errorRate,
      averageResponseTime,
      systemLoad: this.calculateSystemLoad(),
    };

    this.systemHealthHistory.push(healthMetrics);

    // Record in observability system
    if (this.options.enableSystemMonitoring) {
      this.observabilitySystem.recordMetric(
        'system.memory.used',
        memoryUsage.heapUsed / 1024 / 1024, // Convert to MB
        {},
        'MB'
      );

      this.observabilitySystem.recordMetric('system.sessions.active', activeSessions, {}, 'count');

      this.observabilitySystem.recordMetric('system.error.rate', errorRate, {}, 'percentage');
    }

    // Clean up old health data
    this.cleanupOldHealthData();

    this.emit('health:recorded', healthMetrics);

    return healthMetrics;
  }

  /**
   * Get comprehensive metrics summary
   */
  public getMetricsSummary(): MetricsSummary {
    const operationTypeDistribution: Record<string, number> = {};

    // Calculate operation type distribution
    for (const metrics of this.operationMetrics.values()) {
      operationTypeDistribution[metrics.operationType] =
        (operationTypeDistribution[metrics.operationType] || 0) + 1;
    }

    const averageResponseTime =
      this.globalStats.totalOperations > 0
        ? this.globalStats.totalProcessingTime / this.globalStats.totalOperations
        : 0;

    const errorRate =
      this.globalStats.totalOperations > 0
        ? this.globalStats.failedOperations / this.globalStats.totalOperations
        : 0;

    return {
      totalOperations: this.globalStats.totalOperations,
      successfulOperations: this.globalStats.successfulOperations,
      failedOperations: this.globalStats.failedOperations,
      averageResponseTime,
      errorRate,
      totalProcessingTime: this.globalStats.totalProcessingTime,
      memoryHighWaterMark: this.globalStats.memoryHighWaterMark,
      operationTypeDistribution,
    };
  }

  /**
   * Get current system health
   */
  public getCurrentSystemHealth(): SystemHealthMetrics | null {
    return this.systemHealthHistory.length > 0
      ? this.systemHealthHistory[this.systemHealthHistory.length - 1]
      : null;
  }

  /**
   * Get system health trend over time
   */
  public getSystemHealthTrend(timeRangeMs: Readonly<number> = 300000): SystemHealthMetrics[] {
    const cutoffTime = performance.now() - timeRangeMs;
    return this.systemHealthHistory.filter(h => h.timestamp >= cutoffTime);
  }

  /**
   * Check if system is healthy
   */
  public isSystemHealthy(): boolean {
    const health = this.getCurrentSystemHealth();
    if (!health) return true; // No data means healthy by default

    // Check error rate threshold
    if (health.errorRate > this.options.errorThreshold) {
      return false;
    }

    // Check memory usage (warn if over 1GB)
    const memoryUsageMB = health.memoryUsage.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 1024) {
      logger.warn(`High memory usage: ${memoryUsageMB.toFixed(2)}MB`);
    }

    return true;
  }

  /**
   * Calculate system load based on active operations and performance
   */
  private calculateSystemLoad(): number {
    const activeOps = this.activeOperations.size;
    const recentHealth = this.systemHealthHistory.slice(-5);

    if (recentHealth.length === 0) return 0;

    // Base load on active operations
    let load = Math.min(activeOps / 10, 1.0); // Normalize to 0-1

    // Adjust based on recent error rates
    const avgErrorRate =
      recentHealth.reduce((sum, h) => sum + h.errorRate, 0) / recentHealth.length;
    load += avgErrorRate * 0.5;

    // Adjust based on memory pressure
    const memoryUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memoryUsageMB > 512) {
      load += 0.2;
    }

    return Math.min(load, 1.0);
  }

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(): void {
    if (!this.options.enableSystemMonitoring || this.isShuttingDown) {
      return;
    }

    this.healthCheckInterval = setInterval(() => {
      if (!this.isShuttingDown) {
        this.recordSystemHealth();
      }
    }, this.options.healthCheckIntervalMs);

    logger.info(
      `📈 Started health monitoring with ${this.options.healthCheckIntervalMs}ms interval`
    );
  }

  /**
   * Clean up old metrics data to prevent memory leaks
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = performance.now() - this.options.metricsRetentionMs;

    for (const [operationId, metrics] of this.operationMetrics.entries()) {
      if (metrics.endTime && metrics.endTime < cutoffTime) {
        this.operationMetrics.delete(operationId);
      }
    }
  }

  /**
   * Clean up old health data
   */
  private cleanupOldHealthData(): void {
    const cutoffTime = performance.now() - this.options.metricsRetentionMs;
    this.systemHealthHistory = this.systemHealthHistory.filter(h => h.timestamp >= cutoffTime);
  }

  /**
   * Get operation metrics by ID
   */
  public getOperationMetrics(operationId: string): OperationMetrics | undefined {
    return this.operationMetrics.get(operationId);
  }

  /**
   * Get all active operations
   */
  public getActiveOperations(): OperationMetrics[] {
    return Array.from(this.activeOperations.values());
  }

  /**
   * Export metrics data for analysis
   */
  public exportMetrics(): {
    summary: MetricsSummary;
    operations: OperationMetrics[];
    systemHealth: SystemHealthMetrics[];
  } {
    return {
      summary: this.getMetricsSummary(),
      operations: Array.from(this.operationMetrics.values()),
      systemHealth: this.systemHealthHistory,
    };
  }

  /**
   * Shutdown and cleanup all resources
   */
  public shutdown(): void {
    this.isShuttingDown = true;

    logger.info('Shutting down MetricsCollector');

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Clean up metrics data
    this.cleanupOldMetrics();
    this.cleanupOldHealthData();

    // Remove all listeners
    this.removeAllListeners();
  }
}

// Create a default instance for convenience
export const metricsCollector = new MetricsCollector();

export default MetricsCollector;
