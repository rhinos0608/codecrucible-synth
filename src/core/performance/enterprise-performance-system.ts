/**
 * Enterprise Performance Monitoring and Optimization System
 * Integrates with existing PerformanceMonitor to provide enterprise-grade capabilities
 */

import { EventEmitter } from 'events';
import {
  PerformanceMonitor,
  PerformanceMetric,
  PerformanceSnapshot,
} from './performance-monitor.js';
import {
  SecurityAuditLogger,
  AuditEventType,
  AuditSeverity,
  AuditOutcome,
} from '../security/security-audit-logger.js';
import { logger } from '../logger.js';

export interface EnterprisePerformanceConfig {
  enableSLOMonitoring: boolean;
  enableCapacityPlanning: boolean;
  enableAnomalyDetection: boolean;
  enablePredictiveScaling: boolean;
  enableCostOptimization: boolean;
  enableBusinessMetrics: boolean;
  alerting: {
    enabled: boolean;
    channels: string[];
    escalationRules: EscalationRule[];
  };
  slo: {
    availability: number; // e.g., 99.9%
    latencyP99: number; // e.g., 1000ms
    errorRate: number; // e.g., 0.1%
    throughput: number; // e.g., 1000 RPS
  };
}

export interface EscalationRule {
  condition: string;
  delay: number;
  channels: string[];
  severity: 'warning' | 'critical';
}

export interface SLOViolation {
  metric: string;
  target: number;
  actual: number;
  duration: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
}

export interface CapacityPrediction {
  resource: string;
  currentUsage: number;
  predictedUsage: number;
  timeToCapacity: number; // hours
  confidence: number;
  recommendations: string[];
}

export interface BusinessMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  correlations: Record<string, number>;
}

export interface PerformanceOptimization {
  area: string;
  currentValue: number;
  optimizedValue: number;
  improvement: number;
  confidence: number;
  effort: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
  recommendations: string[];
}

export interface AnomalyAlert {
  metric: string;
  anomalyType: 'spike' | 'drop' | 'trend' | 'outlier';
  severity: number; // 0-1
  confidence: number; // 0-1
  description: string;
  timestamp: number;
  context: Record<string, any>;
}

export class EnterprisePerformanceSystem extends EventEmitter {
  private config: EnterprisePerformanceConfig;
  private performanceMonitor: PerformanceMonitor;
  private auditLogger?: SecurityAuditLogger;

  private sloViolations: SLOViolation[] = [];
  private capacityPredictions = new Map<string, CapacityPrediction>();
  private businessMetrics = new Map<string, BusinessMetric[]>();
  private anomalies: AnomalyAlert[] = [];
  private optimizations: PerformanceOptimization[] = [];

  private baselineData = new Map<string, number[]>();
  private monitoringInterval?: NodeJS.Timeout;
  private predictionInterval?: NodeJS.Timeout;

  constructor(
    performanceMonitor: PerformanceMonitor,
    auditLogger?: SecurityAuditLogger,
    config: Partial<EnterprisePerformanceConfig> = {}
  ) {
    super();

    this.performanceMonitor = performanceMonitor;
    this.auditLogger = auditLogger;

    this.config = {
      enableSLOMonitoring: true,
      enableCapacityPlanning: true,
      enableAnomalyDetection: true,
      enablePredictiveScaling: true,
      enableCostOptimization: true,
      enableBusinessMetrics: true,
      alerting: {
        enabled: true,
        channels: ['log', 'console'],
        escalationRules: [
          {
            condition: 'slo_violation',
            delay: 300000, // 5 minutes
            channels: ['slack', 'email'],
            severity: 'critical',
          },
        ],
      },
      slo: {
        availability: 99.9,
        latencyP99: 1000,
        errorRate: 0.1,
        throughput: 1000,
      },
      ...config,
    };

    this.initialize();
  }

  /**
   * Initialize enterprise performance monitoring
   */
  private initialize(): void {
    // Listen to performance monitor events
    this.performanceMonitor.on('metric-recorded', metric => {
      this.processMetric(metric);
    });

    this.performanceMonitor.on('performance-snapshot', snapshot => {
      this.processSnapshot(snapshot);
    });

    this.performanceMonitor.on('threshold-critical', event => {
      this.handleCriticalThreshold(event);
    });

    // Start enterprise monitoring
    if (this.config.enableSLOMonitoring) {
      this.startSLOMonitoring();
    }

    if (this.config.enableCapacityPlanning) {
      this.startCapacityPlanning();
    }

    if (this.config.enableAnomalyDetection) {
      this.startAnomalyDetection();
    }

    logger.info('Enterprise Performance System initialized', {
      sloMonitoring: this.config.enableSLOMonitoring,
      capacityPlanning: this.config.enableCapacityPlanning,
      anomalyDetection: this.config.enableAnomalyDetection,
      businessMetrics: this.config.enableBusinessMetrics,
    });
  }

  /**
   * Process individual metrics for enterprise analysis
   */
  private processMetric(metric: PerformanceMetric): void {
    // Update baseline data
    this.updateBaseline(metric.name, metric.value);

    // Check SLO compliance
    if (this.config.enableSLOMonitoring) {
      this.checkSLOCompliance(metric);
    }

    // Detect anomalies
    if (this.config.enableAnomalyDetection) {
      this.detectAnomaly(metric);
    }

    // Update business metrics correlation
    if (this.config.enableBusinessMetrics) {
      this.updateBusinessMetricCorrelations(metric);
    }
  }

  /**
   * Process performance snapshots for trend analysis
   */
  private processSnapshot(snapshot: PerformanceSnapshot): void {
    // Capacity planning analysis
    if (this.config.enableCapacityPlanning) {
      this.analyzeCapacity(snapshot);
    }

    // Performance optimization opportunities
    this.identifyOptimizations(snapshot);

    // Emit enterprise snapshot event
    this.emit('enterprise-snapshot', {
      snapshot,
      sloCompliance: this.calculateSLOCompliance(),
      capacityStatus: this.getCapacityStatus(),
      anomalyCount: this.anomalies.length,
      optimizationOpportunities: this.optimizations.length,
    });
  }

  /**
   * Start SLO monitoring
   */
  private startSLOMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.checkAllSLOs();
    }, 60000); // Check every minute
  }

  /**
   * Start capacity planning
   */
  private startCapacityPlanning(): void {
    this.predictionInterval = setInterval(() => {
      this.updateCapacityPredictions();
    }, 300000); // Update every 5 minutes
  }

  /**
   * Start anomaly detection
   */
  private startAnomalyDetection(): void {
    setInterval(() => {
      this.performAnomalyAnalysis();
    }, 120000); // Analyze every 2 minutes
  }

  /**
   * Check SLO compliance for a metric
   */
  private checkSLOCompliance(metric: PerformanceMetric): void {
    const violations: SLOViolation[] = [];

    // Availability SLO
    if (metric.name === 'http_request_duration' && metric.tags.status?.startsWith('5')) {
      const errorRate = this.calculateErrorRate();
      if (errorRate > 100 - this.config.slo.availability) {
        violations.push({
          metric: 'availability',
          target: this.config.slo.availability,
          actual: 100 - errorRate,
          duration: 0,
          impact: this.determineSLOImpact(errorRate),
          timestamp: Date.now(),
        });
      }
    }

    // Latency SLO
    if (metric.name === 'http_request_duration') {
      const latencyStats = this.performanceMonitor.getMetricStats('http_request_duration');
      if (latencyStats && latencyStats.p99 > this.config.slo.latencyP99) {
        violations.push({
          metric: 'latency_p99',
          target: this.config.slo.latencyP99,
          actual: latencyStats.p99,
          duration: 0,
          impact: this.determineSLOImpact(latencyStats.p99 / this.config.slo.latencyP99),
          timestamp: Date.now(),
        });
      }
    }

    // Process violations
    violations.forEach(violation => {
      this.sloViolations.push(violation);
      this.handleSLOViolation(violation);
    });
  }

  /**
   * Calculate current error rate
   */
  private calculateErrorRate(): number {
    const httpMetrics = this.performanceMonitor.getAllMetrics()['http_request_duration'] || [];
    const recentMetrics = httpMetrics.filter(m => Date.now() - m.timestamp < 300000); // Last 5 minutes

    if (recentMetrics.length === 0) return 0;

    const errorCount = recentMetrics.filter(
      m => m.tags.status?.startsWith('4') || m.tags.status?.startsWith('5')
    ).length;

    return (errorCount / recentMetrics.length) * 100;
  }

  /**
   * Determine SLO impact level
   */
  private determineSLOImpact(ratio: number): 'low' | 'medium' | 'high' | 'critical' {
    if (ratio > 2) return 'critical';
    if (ratio > 1.5) return 'high';
    if (ratio > 1.2) return 'medium';
    return 'low';
  }

  /**
   * Handle SLO violation
   */
  private handleSLOViolation(violation: SLOViolation): void {
    logger.error('SLO violation detected', violation);

    // Audit log
    if (this.auditLogger) {
      this.auditLogger.logEvent(
        AuditEventType.SYSTEM_EVENT,
        AuditSeverity.HIGH,
        AuditOutcome.ERROR,
        'enterprise-performance-system',
        'slo_violation',
        violation.metric,
        `SLO violation: ${violation.metric} target=${violation.target} actual=${violation.actual}`,
        {},
        {
          violation,
          impact: violation.impact,
        }
      );
    }

    // Emit violation event
    this.emit('slo-violation', violation);

    // Trigger alerting
    if (this.config.alerting.enabled) {
      this.triggerAlert('SLO Violation', violation);
    }
  }

  /**
   * Update baseline data for anomaly detection
   */
  private updateBaseline(metricName: string, value: number): void {
    if (!this.baselineData.has(metricName)) {
      this.baselineData.set(metricName, []);
    }

    const baseline = this.baselineData.get(metricName)!;
    baseline.push(value);

    // Keep only last 1000 data points
    if (baseline.length > 1000) {
      baseline.shift();
    }
  }

  /**
   * Detect anomalies in metrics
   */
  private detectAnomaly(metric: PerformanceMetric): void {
    const baseline = this.baselineData.get(metric.name);
    if (!baseline || baseline.length < 10) return;

    const anomaly = this.calculateAnomalyScore(metric.value, baseline);

    if (anomaly.severity > 0.8) {
      const alert: AnomalyAlert = {
        metric: metric.name,
        anomalyType: anomaly.type,
        severity: anomaly.severity,
        confidence: anomaly.confidence,
        description: `Anomaly detected in ${metric.name}: ${anomaly.description}`,
        timestamp: Date.now(),
        context: {
          value: metric.value,
          baseline: anomaly.baseline,
          tags: metric.tags,
        },
      };

      this.anomalies.push(alert);
      this.emit('anomaly-detected', alert);

      logger.warn('Performance anomaly detected', alert);
    }
  }

  /**
   * Calculate anomaly score using statistical methods
   */
  private calculateAnomalyScore(
    value: number,
    baseline: number[]
  ): {
    severity: number;
    confidence: number;
    type: 'spike' | 'drop' | 'trend' | 'outlier';
    description: string;
    baseline: { mean: number; std: number };
  } {
    const mean = baseline.reduce((sum, v) => sum + v, 0) / baseline.length;
    const variance = baseline.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / baseline.length;
    const std = Math.sqrt(variance);

    const zScore = Math.abs((value - mean) / std);
    const severity = Math.min(zScore / 3, 1); // Normalize to 0-1

    let type: 'spike' | 'drop' | 'trend' | 'outlier' = 'outlier';
    let description = '';

    if (value > mean + 2 * std) {
      type = 'spike';
      description = `Value ${value.toFixed(2)} is ${zScore.toFixed(2)} standard deviations above baseline`;
    } else if (value < mean - 2 * std) {
      type = 'drop';
      description = `Value ${value.toFixed(2)} is ${zScore.toFixed(2)} standard deviations below baseline`;
    } else {
      type = 'outlier';
      description = `Unusual value detected: ${value.toFixed(2)}`;
    }

    return {
      severity,
      confidence: Math.min(baseline.length / 100, 1), // More data = higher confidence
      type,
      description,
      baseline: { mean, std },
    };
  }

  /**
   * Analyze capacity trends and predictions
   */
  private analyzeCapacity(snapshot: PerformanceSnapshot): void {
    const resources = ['memory', 'cpu', 'connections'];

    resources.forEach(resource => {
      const prediction = this.predictCapacity(resource, snapshot);
      if (prediction) {
        this.capacityPredictions.set(resource, prediction);

        // Alert if capacity will be reached soon
        if (prediction.timeToCapacity < 24) {
          // Less than 24 hours
          this.emit('capacity-warning', prediction);
          logger.warn('Capacity warning', prediction);
        }
      }
    });
  }

  /**
   * Predict capacity requirements
   */
  private predictCapacity(
    resource: string,
    snapshot: PerformanceSnapshot
  ): CapacityPrediction | null {
    // Simplified linear trend prediction
    const metricName = `${resource}_usage_percent`;
    const baseline = this.baselineData.get(metricName);

    if (!baseline || baseline.length < 10) return null;

    const recent = baseline.slice(-10);
    const trend = this.calculateTrend(recent);
    const currentUsage = recent[recent.length - 1];

    if (trend <= 0) return null; // No growth trend

    const timeToCapacity = (95 - currentUsage) / trend; // Hours to reach 95%
    const predictedUsage = currentUsage + trend * 24; // 24 hours ahead

    return {
      resource,
      currentUsage,
      predictedUsage,
      timeToCapacity,
      confidence: Math.min(recent.length / 20, 1),
      recommendations: this.generateCapacityRecommendations(resource, timeToCapacity, trend),
    };
  }

  /**
   * Calculate linear trend
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, idx) => sum + val * idx, 0);
    const sumX2 = values.reduce((sum, _, idx) => sum + idx * idx, 0);

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  /**
   * Generate capacity recommendations
   */
  private generateCapacityRecommendations(
    resource: string,
    timeToCapacity: number,
    trend: number
  ): string[] {
    const recommendations: string[] = [];

    if (timeToCapacity < 24) {
      recommendations.push(
        `Immediate action required: ${resource} capacity will be reached in ${timeToCapacity.toFixed(1)} hours`
      );
      recommendations.push(`Consider scaling up ${resource} immediately`);
    } else if (timeToCapacity < 168) {
      // 1 week
      recommendations.push(`Plan ${resource} scaling within the next week`);
      recommendations.push(`Monitor ${resource} usage closely`);
    }

    if (trend > 5) {
      recommendations.push(`High growth rate detected for ${resource} (${trend.toFixed(2)}%/hour)`);
      recommendations.push(`Investigate cause of rapid ${resource} growth`);
    }

    return recommendations;
  }

  /**
   * Identify performance optimization opportunities
   */
  private identifyOptimizations(snapshot: PerformanceSnapshot): void {
    const optimizations: PerformanceOptimization[] = [];

    // Memory optimization
    if (snapshot.metrics.memory.heapUsed / snapshot.metrics.memory.heapTotal > 0.8) {
      optimizations.push({
        area: 'memory',
        currentValue: snapshot.metrics.memory.heapUsed,
        optimizedValue: snapshot.metrics.memory.heapUsed * 0.7,
        improvement: 30,
        confidence: 0.8,
        effort: 'medium',
        risk: 'low',
        recommendations: [
          'Implement memory pooling',
          'Review object retention',
          'Optimize garbage collection',
        ],
      });
    }

    // Response time optimization
    const latencyStats = this.performanceMonitor.getMetricStats('http_request_duration');
    if (latencyStats && latencyStats.p95 > 500) {
      optimizations.push({
        area: 'response_time',
        currentValue: latencyStats.p95,
        optimizedValue: latencyStats.p95 * 0.6,
        improvement: 40,
        confidence: 0.7,
        effort: 'high',
        risk: 'medium',
        recommendations: [
          'Implement response caching',
          'Optimize database queries',
          'Add CDN for static assets',
        ],
      });
    }

    this.optimizations = optimizations;

    optimizations.forEach(optimization => {
      this.emit('optimization-opportunity', optimization);
    });
  }

  /**
   * Update business metric correlations
   */
  private updateBusinessMetricCorrelations(metric: PerformanceMetric): void {
    // This would correlate technical metrics with business metrics
    // For now, we'll track some basic correlations

    if (metric.name === 'http_request_duration') {
      this.recordBusinessMetric('user_experience_score', 100 - metric.value / 10, 'score');
    }

    if (metric.name === 'error_rate') {
      this.recordBusinessMetric('system_reliability', 100 - metric.value, 'percent');
    }
  }

  /**
   * Record business metric
   */
  recordBusinessMetric(name: string, value: number, unit: string): void {
    const metric: BusinessMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      correlations: {},
    };

    if (!this.businessMetrics.has(name)) {
      this.businessMetrics.set(name, []);
    }

    const metrics = this.businessMetrics.get(name)!;
    metrics.push(metric);

    // Keep only last 100 metrics
    if (metrics.length > 100) {
      metrics.shift();
    }

    this.emit('business-metric', metric);
  }

  /**
   * Check all SLOs
   */
  private checkAllSLOs(): void {
    const compliance = this.calculateSLOCompliance();

    if (compliance.overall < this.config.slo.availability) {
      logger.warn('Overall SLO compliance below target', compliance);
      this.emit('slo-compliance-low', compliance);
    }
  }

  /**
   * Calculate SLO compliance
   */
  private calculateSLOCompliance(): {
    overall: number;
    availability: number;
    latency: number;
    errorRate: number;
    throughput: number;
  } {
    const errorRate = this.calculateErrorRate();
    const availability = 100 - errorRate;

    const latencyStats = this.performanceMonitor.getMetricStats('http_request_duration');
    const latencyCompliance = latencyStats
      ? Math.max(
          0,
          100 - ((latencyStats.p99 - this.config.slo.latencyP99) / this.config.slo.latencyP99) * 100
        )
      : 100;

    const throughputStats = this.performanceMonitor.getMetricStats('http_requests_total');
    const throughputCompliance =
      throughputStats && throughputStats.count > 0
        ? Math.min(100, (throughputStats.count / this.config.slo.throughput) * 100)
        : 0;

    const overall = (availability + latencyCompliance + throughputCompliance) / 3;

    return {
      overall,
      availability,
      latency: latencyCompliance,
      errorRate,
      throughput: throughputCompliance,
    };
  }

  /**
   * Get capacity status
   */
  private getCapacityStatus(): Record<string, CapacityPrediction> {
    return Object.fromEntries(this.capacityPredictions);
  }

  /**
   * Update capacity predictions
   */
  private updateCapacityPredictions(): void {
    // This would be called periodically to update predictions
    const snapshot = this.performanceMonitor.getPerformanceSummary().lastSnapshot;
    if (snapshot) {
      this.analyzeCapacity(snapshot);
    }
  }

  /**
   * Perform comprehensive anomaly analysis
   */
  private performAnomalyAnalysis(): void {
    // Clean old anomalies (older than 1 hour)
    const cutoff = Date.now() - 3600000;
    this.anomalies = this.anomalies.filter(a => a.timestamp > cutoff);

    // Emit anomaly summary
    if (this.anomalies.length > 0) {
      this.emit('anomaly-summary', {
        count: this.anomalies.length,
        highSeverity: this.anomalies.filter(a => a.severity > 0.8).length,
        recentTrends: this.analyzeAnomalyTrends(),
      });
    }
  }

  /**
   * Analyze anomaly trends
   */
  private analyzeAnomalyTrends(): Record<string, number> {
    const trends: Record<string, number> = {};

    this.anomalies.forEach(anomaly => {
      trends[anomaly.anomalyType] = (trends[anomaly.anomalyType] || 0) + 1;
    });

    return trends;
  }

  /**
   * Trigger alert
   */
  private triggerAlert(type: string, data: any): void {
    const alert = {
      type,
      timestamp: Date.now(),
      data,
      channels: this.config.alerting.channels,
    };

    this.emit('alert', alert);

    // Log alert
    logger.error(`Performance Alert: ${type}`, alert);

    // In a real system, this would integrate with:
    // - Slack/Teams webhooks
    // - Email services
    // - PagerDuty/OpsGenie
    // - SMS services
  }

  /**
   * Handle critical threshold events from base monitor
   */
  private handleCriticalThreshold(event: any): void {
    logger.error('Critical performance threshold exceeded', event);

    // Enhanced enterprise handling
    this.triggerAlert('Critical Threshold', event);

    // Auto-scaling trigger (if enabled)
    if (this.config.enablePredictiveScaling) {
      this.emit('scaling-trigger', {
        metric: event.metric,
        value: event.value,
        threshold: event.threshold,
        action: 'scale-up',
      });
    }
  }

  /**
   * Get enterprise performance dashboard data
   */
  getEnterpriseMetrics(): {
    slo: {
      overall: number;
      availability: number;
      latency: number;
      errorRate: number;
      throughput: number;
    };
    capacity: Record<string, CapacityPrediction>;
    anomalies: AnomalyAlert[];
    optimizations: PerformanceOptimization[];
    businessMetrics: Record<string, BusinessMetric[]>;
    alerts: {
      violations: number;
      anomalies: number;
      capacity: number;
    };
  } {
    return {
      slo: this.calculateSLOCompliance(),
      capacity: this.getCapacityStatus(),
      anomalies: this.anomalies.slice(-10), // Last 10 anomalies
      optimizations: this.optimizations,
      businessMetrics: Object.fromEntries(this.businessMetrics),
      alerts: {
        violations: this.sloViolations.filter(v => Date.now() - v.timestamp < 3600000).length,
        anomalies: this.anomalies.filter(a => Date.now() - a.timestamp < 3600000).length,
        capacity: Array.from(this.capacityPredictions.values()).filter(p => p.timeToCapacity < 168)
          .length,
      },
    };
  }

  /**
   * Stop enterprise monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.predictionInterval) {
      clearInterval(this.predictionInterval);
    }

    logger.info('Enterprise Performance System stopped');
    this.emit('enterprise-stop');
  }
}

// Export default instance
export const enterprisePerformanceSystem = new EnterprisePerformanceSystem(
  new PerformanceMonitor()
);
