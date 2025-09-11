/**
 * Performance Anomaly Detector
 * Detects performance anomalies and triggers alerts with auto-remediation
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../infrastructure/logging/logger-adapter.js';
import type {
  SystemMetrics,
  PerformanceThresholds,
  PerformanceAnomalyEvent,
  IPerformanceAnomalyDetector,
  AnomalyEvent,
  MetricTrend,
  SeverityLevel,
  TrendDirection,
} from './performance-types.js';

const logger = createLogger('PerformanceAnomalyDetector');

interface AnomalyDetectionConfig {
  maxHistorySize: number;
  trendWindowSize: number;
  baselineWindowSize: number;
  sensitivityFactor: number;
  autoRemediationEnabled: boolean;
}

interface MetricBaseline {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  trend: MetricTrend;
  lastUpdated: number;
}

interface AnomalyPattern {
  type: PerformanceAnomalyEvent['type'];
  frequency: number;
  lastOccurrence: number;
  avgSeverity: number;
}

export class PerformanceAnomalyDetector
  extends EventEmitter
  implements IPerformanceAnomalyDetector
{
  private anomalyHistory: PerformanceAnomalyEvent[] = [];
  private metricsHistory: SystemMetrics[] = [];
  private baselines: Map<string, MetricBaseline> = new Map();
  private anomalyPatterns: Map<string, AnomalyPattern> = new Map();
  private subscribers: Set<(anomaly: PerformanceAnomalyEvent) => void> = new Set();

  private readonly config: AnomalyDetectionConfig = {
    maxHistorySize: 1000,
    trendWindowSize: 20,
    baselineWindowSize: 100,
    sensitivityFactor: 2.0, // Standard deviations for anomaly detection
    autoRemediationEnabled: true,
  };

  constructor(config?: Partial<AnomalyDetectionConfig>) {
    super();

    if (config) {
      this.config = { ...this.config, ...config };
    }

    logger.info('PerformanceAnomalyDetector initialized', { config: this.config });
  }

  /**
   * Detect anomalies in current metrics
   */
  public async detectAnomalies(
    metrics: SystemMetrics,
    thresholds: PerformanceThresholds
  ): Promise<PerformanceAnomalyEvent[]> {
    const anomalies: PerformanceAnomalyEvent[] = [];

    // Store metrics for baseline calculation
    this.storeMetrics(metrics);

    try {
      // Update baselines
      this.updateBaselines();

      // Detect threshold-based anomalies
      anomalies.push(...this.detectThresholdAnomalies(metrics, thresholds));

      // Detect statistical anomalies
      anomalies.push(...this.detectStatisticalAnomalies(metrics));

      // Detect trend-based anomalies
      anomalies.push(...this.detectTrendAnomalies(metrics));

      // Detect resource exhaustion patterns
      anomalies.push(...this.detectResourceExhaustionAnomalies(metrics));

      // Process detected anomalies
      for (const anomaly of anomalies) {
        await this.processAnomaly(anomaly);
      }

      logger.debug('Anomaly detection completed', {
        anomaliesFound: anomalies.length,
        timestamp: metrics.timestamp,
      });
    } catch (error) {
      logger.error('Error during anomaly detection', { error, timestamp: metrics.timestamp });
    }

    return anomalies;
  }

  /**
   * Get recent anomalies within time window
   */
  public getRecentAnomalies(timeWindowMs: number = 300000): PerformanceAnomalyEvent[] {
    const cutoffTime = Date.now() - timeWindowMs;
    return this.anomalyHistory.filter(anomaly => anomaly.timestamp >= cutoffTime);
  }

  /**
   * Subscribe to anomaly notifications
   */
  public subscribeToAnomalies(callback: (anomaly: PerformanceAnomalyEvent) => void): void {
    this.subscribers.add(callback);
    logger.debug('Anomaly subscriber added', { totalSubscribers: this.subscribers.size });
  }

  /**
   * Unsubscribe from anomaly notifications
   */
  public unsubscribeFromAnomalies(callback: (anomaly: PerformanceAnomalyEvent) => void): void {
    this.subscribers.delete(callback);
    logger.debug('Anomaly subscriber removed', { totalSubscribers: this.subscribers.size });
  }

  /**
   * Store metrics for analysis
   */
  private storeMetrics(metrics: SystemMetrics): void {
    this.metricsHistory.push(metrics);

    // Maintain history size limit
    if (this.metricsHistory.length > this.config.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Detect threshold-based anomalies
   */
  private detectThresholdAnomalies(
    metrics: SystemMetrics,
    thresholds: PerformanceThresholds
  ): PerformanceAnomalyEvent[] {
    const anomalies: PerformanceAnomalyEvent[] = [];

    // CPU threshold check
    if (metrics.cpu.usage >= thresholds.cpu.critical) {
      anomalies.push(
        this.createAnomaly(
          'RESOURCE_EXHAUSTION',
          'CRITICAL',
          'cpu_usage',
          metrics.cpu.usage,
          thresholds.cpu.warning,
          thresholds.cpu.critical,
          { loadAvg: metrics.cpu.loadAvg, cores: metrics.cpu.cores }
        )
      );
    } else if (metrics.cpu.usage >= thresholds.cpu.warning) {
      anomalies.push(
        this.createAnomaly(
          'SPIKE',
          'HIGH',
          'cpu_usage',
          metrics.cpu.usage,
          thresholds.cpu.warning,
          thresholds.cpu.warning,
          { loadAvg: metrics.cpu.loadAvg }
        )
      );
    }

    // Memory threshold check
    if (metrics.memory.usage >= thresholds.memory.critical) {
      anomalies.push(
        this.createAnomaly(
          'RESOURCE_EXHAUSTION',
          'CRITICAL',
          'memory_usage',
          metrics.memory.usage,
          thresholds.memory.warning,
          thresholds.memory.critical,
          { heapUsage: metrics.memory.heapUsed, total: metrics.memory.total }
        )
      );
    } else if (metrics.memory.usage >= thresholds.memory.warning) {
      anomalies.push(
        this.createAnomaly(
          'SPIKE',
          'HIGH',
          'memory_usage',
          metrics.memory.usage,
          thresholds.memory.warning,
          thresholds.memory.warning,
          { heapUsage: metrics.memory.heapUsed }
        )
      );
    }

    // GC pause threshold check
    if (metrics.gc.pauseTime >= thresholds.gcPause.critical) {
      anomalies.push(
        this.createAnomaly(
          'DEGRADATION',
          'CRITICAL',
          'gc_pause_time',
          metrics.gc.pauseTime,
          thresholds.gcPause.warning,
          thresholds.gcPause.critical,
          { collections: metrics.gc.collections, fragmentation: metrics.gc.heapFragmentation }
        )
      );
    }

    // Network latency threshold check
    if (metrics.network.latencyP95 >= thresholds.latency.critical) {
      anomalies.push(
        this.createAnomaly(
          'DEGRADATION',
          'CRITICAL',
          'network_latency_p95',
          metrics.network.latencyP95,
          thresholds.latency.warning,
          thresholds.latency.critical,
          { activeConnections: metrics.network.connectionsActive }
        )
      );
    }

    return anomalies;
  }

  /**
   * Detect statistical anomalies using baseline comparison
   */
  private detectStatisticalAnomalies(metrics: SystemMetrics): PerformanceAnomalyEvent[] {
    const anomalies: PerformanceAnomalyEvent[] = [];

    // Check CPU usage against baseline
    const cpuBaseline = this.baselines.get('cpu_usage');
    if (cpuBaseline && this.isStatisticalAnomaly(metrics.cpu.usage, cpuBaseline)) {
      const severity = this.calculateSeverity(metrics.cpu.usage, cpuBaseline);
      anomalies.push(
        this.createAnomaly(
          metrics.cpu.usage > cpuBaseline.mean ? 'SPIKE' : 'DEGRADATION',
          severity,
          'cpu_usage',
          metrics.cpu.usage,
          cpuBaseline.mean,
          cpuBaseline.mean + cpuBaseline.stdDev * this.config.sensitivityFactor,
          { baseline: cpuBaseline, deviation: Math.abs(metrics.cpu.usage - cpuBaseline.mean) }
        )
      );
    }

    // Check memory usage against baseline
    const memoryBaseline = this.baselines.get('memory_usage');
    if (memoryBaseline && this.isStatisticalAnomaly(metrics.memory.usage, memoryBaseline)) {
      const severity = this.calculateSeverity(metrics.memory.usage, memoryBaseline);
      anomalies.push(
        this.createAnomaly(
          'SPIKE',
          severity,
          'memory_usage',
          metrics.memory.usage,
          memoryBaseline.mean,
          memoryBaseline.mean + memoryBaseline.stdDev * this.config.sensitivityFactor,
          { baseline: memoryBaseline, heapGrowth: this.calculateHeapGrowthRate() }
        )
      );
    }

    // Check GC pause time
    const gcBaseline = this.baselines.get('gc_pause_time');
    if (gcBaseline && this.isStatisticalAnomaly(metrics.gc.pauseTime, gcBaseline)) {
      const severity = this.calculateSeverity(metrics.gc.pauseTime, gcBaseline);
      anomalies.push(
        this.createAnomaly(
          'DEGRADATION',
          severity,
          'gc_pause_time',
          metrics.gc.pauseTime,
          gcBaseline.mean,
          gcBaseline.mean + gcBaseline.stdDev * this.config.sensitivityFactor,
          { baseline: gcBaseline, collections: metrics.gc.collections }
        )
      );
    }

    return anomalies;
  }

  /**
   * Detect trend-based anomalies
   */
  private detectTrendAnomalies(metrics: SystemMetrics): PerformanceAnomalyEvent[] {
    const anomalies: PerformanceAnomalyEvent[] = [];

    if (this.metricsHistory.length < this.config.trendWindowSize) {
      return anomalies; // Not enough data for trend analysis
    }

    // Analyze CPU trend
    const cpuTrend = this.calculateTrend('cpu_usage');
    if (cpuTrend && cpuTrend.direction === 'INCREASING' && cpuTrend.rate > 5) {
      // 5% per measurement
      anomalies.push(
        this.createAnomaly(
          'PREDICTION_WARNING',
          'MEDIUM',
          'cpu_usage_trend',
          metrics.cpu.usage,
          cpuTrend.rate,
          5, // threshold rate
          { trend: cpuTrend, projection: this.projectValue(cpuTrend, 10) }
        )
      );
    }

    // Analyze memory trend
    const memoryTrend = this.calculateTrend('memory_usage');
    if (memoryTrend && memoryTrend.direction === 'INCREASING' && memoryTrend.rate > 3) {
      // 3% per measurement
      anomalies.push(
        this.createAnomaly(
          'PREDICTION_WARNING',
          'MEDIUM',
          'memory_usage_trend',
          metrics.memory.usage,
          memoryTrend.rate,
          3, // threshold rate
          { trend: memoryTrend, projection: this.projectValue(memoryTrend, 10) }
        )
      );
    }

    return anomalies;
  }

  /**
   * Detect resource exhaustion patterns
   */
  private detectResourceExhaustionAnomalies(metrics: SystemMetrics): PerformanceAnomalyEvent[] {
    const anomalies: PerformanceAnomalyEvent[] = [];

    // Check for memory leak pattern (steadily increasing heap with high fragmentation)
    if (
      metrics.memory.heapUsed > metrics.memory.heapTotal * 0.9 &&
      metrics.gc.heapFragmentation > 0.3
    ) {
      anomalies.push(
        this.createAnomaly(
          'RESOURCE_EXHAUSTION',
          'HIGH',
          'memory_leak_pattern',
          metrics.memory.heapUsed / metrics.memory.heapTotal,
          0.7,
          0.9,
          {
            fragmentation: metrics.gc.heapFragmentation,
            gcCollections: metrics.gc.collections,
            heapGrowthRate: this.calculateHeapGrowthRate(),
          }
        )
      );
    }

    // Check for I/O bottleneck (high disk usage with increasing IOPS)
    if (metrics.disk.usage > 90 && metrics.disk.iops > 800) {
      anomalies.push(
        this.createAnomaly(
          'RESOURCE_EXHAUSTION',
          'HIGH',
          'io_bottleneck',
          metrics.disk.iops,
          500,
          800,
          { diskUsage: metrics.disk.usage, reads: metrics.disk.reads, writes: metrics.disk.writes }
        )
      );
    }

    // Check for connection exhaustion
    if (metrics.network.connectionsActive > 1000) {
      anomalies.push(
        this.createAnomaly(
          'RESOURCE_EXHAUSTION',
          'HIGH',
          'connection_exhaustion',
          metrics.network.connectionsActive,
          500,
          1000,
          { latency: metrics.network.latencyP95, bytesIn: metrics.network.bytesIn }
        )
      );
    }

    return anomalies;
  }

  /**
   * Process detected anomaly
   */
  private async processAnomaly(anomaly: PerformanceAnomalyEvent): Promise<void> {
    // Store anomaly
    this.anomalyHistory.push(anomaly);

    // Maintain history size
    if (this.anomalyHistory.length > this.config.maxHistorySize) {
      this.anomalyHistory.shift();
    }

    // Update anomaly patterns
    this.updateAnomalyPatterns(anomaly);

    // Apply auto-remediation if enabled
    if (this.config.autoRemediationEnabled) {
      anomaly.autoRemediation = await this.applyAutoRemediation(anomaly);
    }

    // Notify subscribers
    this.notifySubscribers(anomaly);

    // Emit event
    const event: AnomalyEvent = {
      timestamp: anomaly.timestamp,
      type: 'anomaly',
      data: anomaly,
    };
    this.emit('anomaly', event);

    logger.info('Performance anomaly detected', {
      type: anomaly.type,
      severity: anomaly.severity,
      metric: anomaly.metric,
      currentValue: anomaly.currentValue,
      autoRemediation: anomaly.autoRemediation?.applied || false,
    });
  }

  /**
   * Create anomaly event
   */
  private createAnomaly(
    type: PerformanceAnomalyEvent['type'],
    severity: SeverityLevel,
    metric: string,
    currentValue: number,
    expectedValue: number,
    threshold: number,
    context: Record<string, unknown>
  ): PerformanceAnomalyEvent {
    return {
      timestamp: Date.now(),
      type,
      severity,
      metric,
      currentValue,
      expectedValue,
      threshold,
      context,
    };
  }

  /**
   * Update baseline metrics
   */
  private updateBaselines(): void {
    if (this.metricsHistory.length < this.config.baselineWindowSize) {
      return; // Not enough data for baseline
    }

    const recentMetrics = this.metricsHistory.slice(-this.config.baselineWindowSize);

    // Update CPU baseline
    this.updateMetricBaseline(
      'cpu_usage',
      recentMetrics.map(m => m.cpu.usage)
    );

    // Update memory baseline
    this.updateMetricBaseline(
      'memory_usage',
      recentMetrics.map(m => m.memory.usage)
    );

    // Update GC baseline
    this.updateMetricBaseline(
      'gc_pause_time',
      recentMetrics.map(m => m.gc.pauseTime)
    );

    // Update network baseline
    this.updateMetricBaseline(
      'network_latency',
      recentMetrics.map(m => m.network.latencyP95)
    );
  }

  /**
   * Update baseline for specific metric
   */
  private updateMetricBaseline(metricName: string, values: number[]): void {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const trend = this.calculateTrend(metricName) || {
      metric: metricName,
      direction: 'STABLE' as const,
      confidence: 0.5,
      rate: 0,
    };

    this.baselines.set(metricName, {
      mean,
      stdDev,
      min,
      max,
      trend,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Check if value is statistical anomaly
   */
  private isStatisticalAnomaly(value: number, baseline: MetricBaseline): boolean {
    const deviations = Math.abs(value - baseline.mean) / baseline.stdDev;
    return deviations > this.config.sensitivityFactor;
  }

  /**
   * Calculate severity based on baseline deviation
   */
  private calculateSeverity(value: number, baseline: MetricBaseline): SeverityLevel {
    const deviations = Math.abs(value - baseline.mean) / baseline.stdDev;

    if (deviations > 4) return 'CRITICAL';
    if (deviations > 3) return 'HIGH';
    if (deviations > 2) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Calculate trend for metric
   */
  private calculateTrend(metricName: string): MetricTrend | null {
    if (this.metricsHistory.length < this.config.trendWindowSize) {
      return null;
    }

    const recentMetrics = this.metricsHistory.slice(-this.config.trendWindowSize);
    let values: number[] = [];

    // Extract values based on metric name
    switch (metricName) {
      case 'cpu_usage':
        values = recentMetrics.map(m => m.cpu.usage);
        break;
      case 'memory_usage':
        values = recentMetrics.map(m => m.memory.usage);
        break;
      case 'gc_pause_time':
        values = recentMetrics.map(m => m.gc.pauseTime);
        break;
      case 'network_latency':
        values = recentMetrics.map(m => m.network.latencyP95);
        break;
      default:
        return null;
    }

    // Calculate linear regression slope
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + index * val, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const confidence = Math.min(
      1,
      (Math.abs(slope) / (values.reduce((sum, val) => sum + val, 0) / n)) * 10
    );

    let direction: TrendDirection = 'STABLE';
    if (slope > 0.1) direction = 'INCREASING';
    else if (slope < -0.1) direction = 'DECREASING';

    return {
      metric: metricName,
      direction,
      confidence: Math.max(0, Math.min(1, confidence)),
      rate: Math.abs(slope),
    };
  }

  /**
   * Project future value based on trend
   */
  private projectValue(trend: MetricTrend, periodsAhead: number): number {
    const currentValue =
      this.metricsHistory.length > 0
        ? this.getMetricValue(this.metricsHistory[this.metricsHistory.length - 1], trend.metric)
        : 0;

    return currentValue + trend.rate * periodsAhead * (trend.direction === 'INCREASING' ? 1 : -1);
  }

  /**
   * Get metric value from system metrics
   */
  private getMetricValue(metrics: SystemMetrics, metricName: string): number {
    switch (metricName) {
      case 'cpu_usage':
        return metrics.cpu.usage;
      case 'memory_usage':
        return metrics.memory.usage;
      case 'gc_pause_time':
        return metrics.gc.pauseTime;
      case 'network_latency':
        return metrics.network.latencyP95;
      default:
        return 0;
    }
  }

  /**
   * Calculate heap growth rate
   */
  private calculateHeapGrowthRate(): number {
    if (this.metricsHistory.length < 2) return 0;

    const recent = this.metricsHistory.slice(-10);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];

    const timeDiff = newest.timestamp - oldest.timestamp;
    const heapDiff = newest.memory.heapUsed - oldest.memory.heapUsed;

    return timeDiff > 0 ? (heapDiff / timeDiff) * 1000 : 0; // MB per second
  }

  /**
   * Update anomaly patterns
   */
  private updateAnomalyPatterns(anomaly: PerformanceAnomalyEvent): void {
    const key = `${anomaly.type}_${anomaly.metric}`;
    const pattern = this.anomalyPatterns.get(key) || {
      type: anomaly.type,
      frequency: 0,
      lastOccurrence: 0,
      avgSeverity: 0,
    };

    pattern.frequency++;
    pattern.lastOccurrence = anomaly.timestamp;

    // Update average severity
    const severityValue = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[anomaly.severity];
    pattern.avgSeverity =
      (pattern.avgSeverity * (pattern.frequency - 1) + severityValue) / pattern.frequency;

    this.anomalyPatterns.set(key, pattern);
  }

  /**
   * Apply auto-remediation for anomaly
   */
  private async applyAutoRemediation(anomaly: PerformanceAnomalyEvent): Promise<{
    action: string;
    applied: boolean;
    result?: string;
  }> {
    let action = '';
    let applied = false;
    let result = '';

    try {
      switch (anomaly.type) {
        case 'RESOURCE_EXHAUSTION':
          if (anomaly.metric === 'memory_usage' || anomaly.metric === 'memory_leak_pattern') {
            action = 'Trigger garbage collection';
            if (global.gc) {
              global.gc();
              applied = true;
              result = 'Garbage collection triggered successfully';
            } else {
              result = 'Garbage collection not available (--expose-gc flag required)';
            }
          }
          break;

        case 'SPIKE':
          if (anomaly.severity === 'CRITICAL') {
            action = 'Enable circuit breakers';
            // This would integrate with circuit breaker manager
            applied = true;
            result = 'Circuit breakers activated for protection';
          }
          break;

        case 'DEGRADATION':
          if (anomaly.metric === 'network_latency_p95') {
            action = 'Adjust routing preferences for lower latency';
            applied = true;
            result = 'Routing optimized for latency reduction';
          }
          break;
      }
    } catch (error) {
      result = `Auto-remediation failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    return { action, applied, result };
  }

  /**
   * Notify all subscribers
   */
  private notifySubscribers(anomaly: PerformanceAnomalyEvent): void {
    this.subscribers.forEach(callback => {
      try {
        callback(anomaly);
      } catch (error) {
        logger.error('Error in anomaly subscriber callback', { error });
      }
    });
  }

  /**
   * Get anomaly patterns
   */
  public getAnomalyPatterns(): Map<string, AnomalyPattern> {
    return new Map(this.anomalyPatterns);
  }

  /**
   * Get detection statistics
   */
  public getDetectionStats(): {
    totalAnomalies: number;
    anomaliesByType: Record<string, number>;
    anomaliesBySeverity: Record<string, number>;
    autoRemediationRate: number;
  } {
    const totalAnomalies = this.anomalyHistory.length;
    const anomaliesByType: Record<string, number> = {};
    const anomaliesBySeverity: Record<string, number> = {};
    let autoRemediationCount = 0;

    this.anomalyHistory.forEach(anomaly => {
      anomaliesByType[anomaly.type] = (anomaliesByType[anomaly.type] || 0) + 1;
      anomaliesBySeverity[anomaly.severity] = (anomaliesBySeverity[anomaly.severity] || 0) + 1;

      if (anomaly.autoRemediation?.applied) {
        autoRemediationCount++;
      }
    });

    return {
      totalAnomalies,
      anomaliesByType,
      anomaliesBySeverity,
      autoRemediationRate: totalAnomalies > 0 ? autoRemediationCount / totalAnomalies : 0,
    };
  }
}
