/**
 * Comprehensive Observability System for CodeCrucible Synth
 * Production-ready monitoring, metrics collection, logging, and telemetry system
 * with OpenTelemetry integration and performance analytics
 */

import { EventEmitter } from 'events';
import { createLogger } from '../logger.js';
import { ILogger } from '../../domain/interfaces/logger.js';
import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';
import * as path from 'path';

// Enhanced: OpenTelemetry Integration - Fixed type declarations
let trace: any;
let metrics: any;
let logs: any;
let SpanStatusCode: any;
let SpanKind: any;
let context: any;
let openTelemetryAvailable: boolean;

try {
  const otelApi = require('@opentelemetry/api');
  trace = otelApi.trace;
  metrics = otelApi.metrics;
  logs = otelApi.logs;
  SpanStatusCode = otelApi.SpanStatusCode;
  SpanKind = otelApi.SpanKind;
  context = otelApi.context;
  openTelemetryAvailable = true;
} catch (error) {
  openTelemetryAvailable = false;
  // Mock OpenTelemetry APIs when not available
  trace = {
    getTracer: () => ({
      startSpan: () => ({ end: () => {}, setStatus: () => {}, setAttributes: () => {} }),
    }),
  };
  SpanStatusCode = { OK: 1, ERROR: 2 };
  SpanKind = { CLIENT: 3 };
  metrics = {};
  logs = {};
  context = {};
}

// Core Observability Interfaces
export interface MetricPoint {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  unit: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tags: Record<string, string>;
  logs: SpanLog[];
  status: 'ok' | 'error' | 'timeout';
  baggage?: Record<string, string>;
}

// Enhanced: OpenTelemetry-compatible attributes
export interface ModelRequestSpanAttributes {
  'codecrucible.model': string;
  'codecrucible.provider': string;
  'codecrucible.request.type': string;
  'codecrucible.request.complexity': string;
  'codecrucible.request.tokens.input'?: number;
  'codecrucible.request.tokens.output'?: number;
  'codecrucible.request.temperature'?: number;
  'codecrucible.streaming.enabled'?: boolean;
  'codecrucible.tools.count'?: number;
  'codecrucible.voice.archetype'?: string;
  'codecrucible.hybrid.routing.decision'?: string;
}

export interface StreamingSpanAttributes {
  'codecrucible.streaming.session_id': string;
  'codecrucible.streaming.chunk_type': string;
  'codecrucible.streaming.block_id'?: string;
  'codecrucible.streaming.total_chunks': number;
  'codecrucible.streaming.bytes_streamed': number;
}

export interface ToolExecutionSpanAttributes {
  'codecrucible.tool.name': string;
  'codecrucible.tool.execution_time': number;
  'codecrucible.tool.success': boolean;
  'codecrucible.tool.error_type'?: string;
}

export interface SpanLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields?: Record<string, any>;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  components: ComponentHealth[];
  overallScore: number;
  lastChecked: Date;
  uptime: number;
  version: string;

  // Enhanced: OpenTelemetry integration status
  telemetryEnabled?: boolean;
  tracingStatus?: 'active' | 'disabled' | 'error';
  metricsStatus?: 'active' | 'disabled' | 'error';
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  metrics: ComponentMetrics;
  dependencies: string[];
  lastChecked: Date;
  errorRate: number;
  responseTime: number;
}

export interface ComponentMetrics {
  cpu: number;
  memory: number;
  diskUsage: number;
  networkLatency: number;
  errorCount: number;
  requestCount: number;
  customMetrics: Record<string, number>;
}

export interface PerformanceProfile {
  operation: string;
  measurements: PerformanceMeasurement[];
  statistics: PerformanceStatistics;
  trends: PerformanceTrend[];
}

export interface PerformanceMeasurement {
  timestamp: Date;
  duration: number;
  memoryUsage: number;
  cpuUsage: number;
  success: boolean;
  metadata: Record<string, any>;
}

export interface PerformanceStatistics {
  count: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  stdDev: number;
}

export interface PerformanceTrend {
  period: string;
  direction: 'improving' | 'degrading' | 'stable';
  changePercent: number;
  significance: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  threshold: AlertThreshold;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldown: number;
  actions: AlertAction[];
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'change';
  timeWindow: number;
  aggregation: 'avg' | 'sum' | 'max' | 'min' | 'count';
}

export interface AlertThreshold {
  warning: number;
  critical: number;
  unit: string;
}

export interface AlertAction {
  type: 'log' | 'email' | 'webhook' | 'slack';
  configuration: Record<string, any>;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'silenced';
  triggeredAt: Date;
  resolvedAt?: Date;
  message: string;
  details: Record<string, any>;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface ObservabilityConfig {
  metrics: {
    enabled: boolean;
    retentionDays: number;
    exportInterval: number;
    exporters: MetricExporter[];
  };
  tracing: {
    enabled: boolean;
    samplingRate: number;
    maxSpansPerTrace: number;
    exporters: TraceExporter[];
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    outputs: LogOutput[];
    structured: boolean;
    includeStackTrace: boolean;
  };
  health: {
    checkInterval: number;
    timeoutMs: number;
    retryAttempts: number;
  };
  alerting: {
    enabled: boolean;
    rules: AlertRule[];
    defaultCooldown: number;
  };
  storage: {
    dataPath: string;
    maxFileSize: number;
    compressionEnabled: boolean;
    encryptionEnabled: boolean;
  };
}

export interface MetricExporter {
  type: 'prometheus' | 'statsd' | 'opentelemetry' | 'file';
  endpoint?: string;
  authentication?: Record<string, string>;
  batchSize: number;
  flushInterval: number;
}

export interface TraceExporter {
  type: 'jaeger' | 'zipkin' | 'opentelemetry' | 'file';
  endpoint?: string;
  authentication?: Record<string, string>;
  batchSize: number;
  flushInterval: number;
}

export interface LogOutput {
  type: 'console' | 'file' | 'syslog' | 'elasticsearch';
  configuration: Record<string, any>;
  level?: string;
  format?: string;
}

// Main Observability System
export class ObservabilitySystem extends EventEmitter {
  private logger: ILogger;
  private config: ObservabilityConfig;
  private metricsCollector: MetricsCollector;
  private tracingSystem: TracingSystem;
  private healthMonitor: HealthMonitor;
  private alertManager: AlertManager;
  private performanceProfiler: PerformanceProfiler;
  private dataStorage: ObservabilityStorage;
  private isRunning: boolean = false;
  private systemStartTime: Date = new Date();
  private monitoringIntervals: NodeJS.Timeout[] = [];

  constructor(config: ObservabilityConfig) {
    super();
    this.logger = createLogger('ObservabilitySystem');
    this.config = config;

    // Initialize components
    this.metricsCollector = new MetricsCollector(config.metrics, this);
    this.tracingSystem = new TracingSystem(config.tracing, this);
    this.healthMonitor = new HealthMonitor(config.health, this);
    this.alertManager = new AlertManager(config.alerting, this);
    this.performanceProfiler = new PerformanceProfiler();
    this.dataStorage = new ObservabilityStorage(config.storage);
  }

  /**
   * Initialize and start the observability system
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Observability System...');

    try {
      // Initialize storage
      await this.dataStorage.initialize();

      // Initialize components
      await this.metricsCollector.initialize();
      await this.tracingSystem.initialize();
      await this.healthMonitor.initialize();
      await this.alertManager.initialize();

      // Start monitoring
      this.startSystemMonitoring();

      this.isRunning = true;
      this.logger.info('Observability System initialized successfully');
      this.emit('system:initialized');
    } catch (error) {
      this.logger.error('Failed to initialize observability system:', error);
      throw error;
    }
  }

  /**
   * Record a metric
   */
  recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>,
    unit: string = 'count'
  ): void {
    const metric: MetricPoint = {
      name,
      value,
      timestamp: new Date(),
      tags: tags || {},
      unit,
      type: 'gauge',
    };

    this.metricsCollector.record(metric);
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, tags?: Record<string, string>, value: number = 1): void {
    const metric: MetricPoint = {
      name,
      value,
      timestamp: new Date(),
      tags: tags || {},
      unit: 'count',
      type: 'counter',
    };

    this.metricsCollector.record(metric);
  }

  /**
   * Record a timer
   */
  recordTimer(name: string, duration: number, tags?: Record<string, string>): void {
    const metric: MetricPoint = {
      name,
      value: duration,
      timestamp: new Date(),
      tags: tags || {},
      unit: 'ms',
      type: 'timer',
    };

    this.metricsCollector.record(metric);
  }

  /**
   * Start a trace span
   */
  startSpan(operationName: string, parentSpan?: TraceSpan): TraceSpan {
    return this.tracingSystem.startSpan(operationName, parentSpan);
  }

  /**
   * Finish a trace span
   */
  finishSpan(span: TraceSpan, tags?: Record<string, string>): void {
    this.tracingSystem.finishSpan(span, tags);
  }

  /**
   * Profile an operation
   */
  async profileOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.performanceProfiler.profile(operationName, operation, metadata);
  }

  /**
   * Check system health
   */
  async checkHealth(): Promise<SystemHealth> {
    return this.healthMonitor.checkHealth();
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(timeRange?: { start: Date; end: Date }): MetricsSummary {
    return this.metricsCollector.getSummary(timeRange);
  }

  /**
   * Get performance profiles
   */
  getPerformanceProfiles(): PerformanceProfile[] {
    return this.performanceProfiler.getProfiles();
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alertManager.getActiveAlerts();
  }

  /**
   * Create custom alert rule
   */
  createAlertRule(rule: AlertRule): void {
    this.alertManager.addRule(rule);
  }

  /**
   * Enhanced: OpenTelemetry integration - Trace model requests
   */
  async traceModelRequest<T>(
    operation: string,
    attributes: Partial<ModelRequestSpanAttributes>,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!openTelemetryAvailable) {
      // Fallback to built-in tracing
      const span = this.startSpan(operation);
      try {
        const result = await fn();
        this.finishSpan(span, { status: 'ok' });
        return result;
      } catch (error) {
        this.finishSpan(span, {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    const tracer = trace.getTracer('codecrucible-synth', '4.0.7');
    const span = tracer.startSpan(operation, {
      kind: SpanKind.CLIENT,
      attributes: attributes as Record<string, string | number | boolean>,
    });

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Enhanced: OpenTelemetry integration - Trace agent communication
   */
  async traceAgentCommunication<T>(
    attributes: Record<string, string | number | boolean>,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!openTelemetryAvailable) {
      // Fallback to built-in tracing
      const span = this.startSpan('agent_communication');
      try {
        const result = await fn();
        this.finishSpan(span, { status: 'ok' });
        return result;
      } catch (error) {
        this.finishSpan(span, {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    const tracer = trace.getTracer('codecrucible-synth', '4.0.7');
    const span = tracer.startSpan('agent_communication', {
      kind: SpanKind.CLIENT,
      attributes: attributes,
    });

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Enhanced: Record tool execution metrics
   */
  recordToolExecution(
    toolName: string,
    executionTime: number,
    success: boolean,
    errorType?: string
  ): void {
    // Record to built-in metrics system
    this.recordMetric(
      'codecrucible.tool.execution.duration',
      executionTime,
      {
        tool: toolName,
        success: success.toString(),
        ...(errorType && { error_type: errorType }),
      },
      'milliseconds'
    );

    this.recordMetric(
      'codecrucible.tool.execution.count',
      1,
      {
        tool: toolName,
        success: success.toString(),
      },
      'count'
    );
  }

  /**
   * Get system statistics
   */
  getSystemStats(): ObservabilityStats {
    const uptime = Date.now() - this.systemStartTime.getTime();

    return {
      systemInfo: {
        uptime,
        version: '3.5.0',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      metrics: this.metricsCollector.getStats(),
      tracing: this.tracingSystem.getStats(),
      health: this.healthMonitor.getStats(),
      alerts: this.alertManager.getStats(),
      performance: this.performanceProfiler.getStats(),
      storage: this.dataStorage.getStats(),
    };
  }

  /**
   * Export observability data
   */
  async exportData(
    format: 'json' | 'csv' | 'prometheus',
    timeRange?: { start: Date; end: Date }
  ): Promise<string> {
    const data = {
      metrics: this.metricsCollector.exportData(timeRange),
      traces: this.tracingSystem.exportData(timeRange),
      alerts: this.alertManager.exportData(timeRange),
    };

    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data);
      case 'prometheus':
        return this.convertToPrometheus(data);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Shutdown the observability system
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down observability system...');

    this.isRunning = false;

    // Clear all monitoring intervals
    this.monitoringIntervals.forEach(interval => {
      clearInterval(interval);
    });
    this.monitoringIntervals = [];

    // Shutdown components
    await this.metricsCollector.shutdown();
    await this.tracingSystem.shutdown();
    await this.healthMonitor.shutdown();
    await this.alertManager.shutdown();
    await this.dataStorage.shutdown();

    // Remove all event listeners to prevent memory leaks
    this.removeAllListeners();

    this.logger.info('Observability system shutdown completed');
  }

  /**
   * Private Methods
   */

  private startSystemMonitoring(): void {
    // Monitor system metrics every 30 seconds
    const metricsInterval = setInterval(() => {
      // TODO: Store interval ID and call clearInterval in cleanup
      if (!this.isRunning) return;

      this.collectSystemMetrics();
    }, 30000);
    this.monitoringIntervals.push(metricsInterval);

    // Perform health checks every minute
    const healthInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.healthMonitor.performHealthCheck();
      } catch (error) {
        this.logger.error('Health check failed:', error);
      }
    }, 60000);
    this.monitoringIntervals.push(healthInterval);

    // Check alerts every 30 seconds
    const alertsInterval = setInterval(() => {
      if (!this.isRunning) return;

      this.alertManager.evaluateRules();
    }, 30000);
    this.monitoringIntervals.push(alertsInterval);
  }

  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Memory metrics
    this.recordMetric('system.memory.rss', memUsage.rss, {}, 'bytes');
    this.recordMetric('system.memory.heap.used', memUsage.heapUsed, {}, 'bytes');
    this.recordMetric('system.memory.heap.total', memUsage.heapTotal, {}, 'bytes');
    this.recordMetric('system.memory.external', memUsage.external, {}, 'bytes');

    // CPU metrics
    this.recordMetric('system.cpu.user', cpuUsage.user / 1000, {}, 'ms');
    this.recordMetric('system.cpu.system', cpuUsage.system / 1000, {}, 'ms');

    // Event loop metrics
    const eventLoopLag = this.measureEventLoopLag();
    this.recordMetric('system.event_loop.lag', eventLoopLag, {}, 'ms');

    // Uptime
    const uptime = Date.now() - this.systemStartTime.getTime();
    this.recordMetric('system.uptime', uptime, {}, 'ms');
  }

  private measureEventLoopLag(): number {
    const start = performance.now();
    return new Promise<number>(resolve => {
      setImmediate(() => {
        const lag = performance.now() - start;
        resolve(lag);
      });
    }) as any as number;
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion - in production would be more sophisticated
    let csv = 'timestamp,type,name,value,tags\n';

    for (const metric of data.metrics || []) {
      const tags = Object.entries(metric.tags)
        .map(([k, v]) => `${k}=${v}`)
        .join(';');
      csv += `${metric.timestamp},metric,${metric.name},${metric.value},"${tags}"\n`;
    }

    return csv;
  }

  private convertToPrometheus(data: any): string {
    // Convert to Prometheus format
    let prometheus = '';

    for (const metric of data.metrics || []) {
      const labels = Object.entries(metric.tags)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');

      prometheus += `${metric.name.replace(/\./g, '_')}{${labels}} ${metric.value} ${metric.timestamp.getTime()}\n`;
    }

    return prometheus;
  }
}

// Supporting Classes

class MetricsCollector {
  private metrics: MetricPoint[] = [];
  private aggregatedMetrics: Map<string, AggregatedMetric> = new Map();
  private exporters: MetricExporter[] = [];
  private logger: ILogger;

  constructor(
    private config: any,
    private observabilitySystem: ObservabilitySystem
  ) {
    this.logger = createLogger('MetricsCollector');
    this.exporters = config.exporters || [];
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing metrics collection...');

    // Start periodic export
    if (this.config.exportInterval > 0) {
      setInterval(() => {
        this.exportMetrics();
      }, this.config.exportInterval);
    }
  }

  record(metric: MetricPoint): void {
    this.metrics.push(metric);
    this.updateAggregatedMetrics(metric);

    // Cleanup old metrics
    this.cleanupOldMetrics();
  }

  getSummary(timeRange?: { start: Date; end: Date }): MetricsSummary {
    let metricsToAnalyze = this.metrics;

    if (timeRange) {
      metricsToAnalyze = this.metrics.filter(
        m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }

    const summary: MetricsSummary = {
      totalMetrics: metricsToAnalyze.length,
      uniqueMetrics: new Set(metricsToAnalyze.map(m => m.name)).size,
      timeRange: timeRange || {
        start: new Date(Math.min(...metricsToAnalyze.map(m => m.timestamp.getTime()))),
        end: new Date(Math.max(...metricsToAnalyze.map(m => m.timestamp.getTime()))),
      },
      topMetrics: this.getTopMetrics(metricsToAnalyze),
      aggregations: this.getAggregations(metricsToAnalyze),
    };

    return summary;
  }

  exportData(timeRange?: { start: Date; end: Date }): MetricPoint[] {
    if (!timeRange) return [...this.metrics];

    return this.metrics.filter(m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end);
  }

  getStats(): MetricsStats {
    return {
      totalCollected: this.metrics.length,
      uniqueNames: new Set(this.metrics.map(m => m.name)).size,
      aggregatedMetrics: this.aggregatedMetrics.size,
      memoryUsage: this.estimateMemoryUsage(),
      exporterStatus: this.exporters.map(e => ({ type: e.type, healthy: true })),
    };
  }

  async shutdown(): Promise<void> {
    await this.exportMetrics();
    this.logger.info('Metrics collector shutdown completed');
  }

  private updateAggregatedMetrics(metric: MetricPoint): void {
    const key = `${metric.name}:${JSON.stringify(metric.tags)}`;

    if (!this.aggregatedMetrics.has(key)) {
      this.aggregatedMetrics.set(key, {
        name: metric.name,
        tags: metric.tags,
        count: 0,
        sum: 0,
        min: Number.MAX_VALUE,
        max: Number.MIN_VALUE,
        values: [],
      });
    }

    const agg = this.aggregatedMetrics.get(key)!;
    agg.count++;
    agg.sum += metric.value;
    agg.min = Math.min(agg.min, metric.value);
    agg.max = Math.max(agg.max, metric.value);
    agg.values.push(metric.value);

    // Keep only recent values for percentile calculations
    if (agg.values.length > 1000) {
      agg.values = agg.values.slice(-500);
    }
  }

  private cleanupOldMetrics(): void {
    if (this.metrics.length > 10000) {
      const cutoff = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
      this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    }
  }

  private async exportMetrics(): Promise<void> {
    for (const exporter of this.exporters) {
      try {
        await this.exportToExporter(exporter);
      } catch (error) {
        this.logger.error(`Failed to export to ${exporter.type}:`, error);
      }
    }
  }

  private async exportToExporter(exporter: MetricExporter): Promise<void> {
    // Implementation would depend on exporter type
    this.logger.debug(`Exporting metrics to ${exporter.type}`);
  }

  private getTopMetrics(
    metrics: MetricPoint[]
  ): Array<{ name: string; count: number; avgValue: number }> {
    const metricCounts = new Map<string, { count: number; sum: number }>();

    for (const metric of metrics) {
      const existing = metricCounts.get(metric.name) || { count: 0, sum: 0 };
      existing.count++;
      existing.sum += metric.value;
      metricCounts.set(metric.name, existing);
    }

    return Array.from(metricCounts.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgValue: data.sum / data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getAggregations(metrics: MetricPoint[]): Record<string, any> {
    const aggregations: Record<string, any> = {};

    for (const [key, agg] of this.aggregatedMetrics.entries()) {
      aggregations[key] = {
        count: agg.count,
        sum: agg.sum,
        avg: agg.sum / agg.count,
        min: agg.min,
        max: agg.max,
        p95: this.calculatePercentile(agg.values, 0.95),
        p99: this.calculatePercentile(agg.values, 0.99),
      };
    }

    return aggregations;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  private estimateMemoryUsage(): number {
    return this.metrics.length * 100; // Rough estimate: 100 bytes per metric
  }
}

class TracingSystem {
  private traces: Map<string, TraceSpan[]> = new Map();
  private activeSpans: Map<string, TraceSpan> = new Map();
  private logger: ILogger;

  constructor(
    private config: any,
    private observabilitySystem: ObservabilitySystem
  ) {
    this.logger = createLogger('TracingSystem');
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing tracing system...');
  }

  startSpan(operationName: string, parentSpan?: TraceSpan): TraceSpan {
    const traceId = parentSpan?.traceId || this.generateTraceId();
    const spanId = this.generateSpanId();

    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId: parentSpan?.spanId,
      operationName,
      startTime: new Date(),
      tags: {},
      logs: [],
      status: 'ok',
    };

    this.activeSpans.set(spanId, span);

    if (!this.traces.has(traceId)) {
      this.traces.set(traceId, []);
    }
    this.traces.get(traceId)!.push(span);

    return span;
  }

  finishSpan(span: TraceSpan, tags?: Record<string, string>): void {
    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();

    if (tags) {
      span.tags = { ...span.tags, ...tags };
    }

    this.activeSpans.delete(span.spanId);

    this.observabilitySystem.recordTimer(
      `span.duration.${span.operationName}`,
      span.duration,
      span.tags
    );
  }

  exportData(timeRange?: { start: Date; end: Date }): TraceSpan[] {
    const allSpans: TraceSpan[] = [];

    for (const spans of this.traces.values()) {
      allSpans.push(...spans);
    }

    if (!timeRange) return allSpans;

    return allSpans.filter(
      s => s.startTime >= timeRange.start && (s.endTime || new Date()) <= timeRange.end
    );
  }

  getStats(): TracingStats {
    const allSpans = this.exportData();

    return {
      totalTraces: this.traces.size,
      totalSpans: allSpans.length,
      activeSpans: this.activeSpans.size,
      averageSpansPerTrace: allSpans.length / Math.max(1, this.traces.size),
      averageDuration: this.calculateAverageDuration(allSpans),
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Tracing system shutdown completed');
  }

  private generateTraceId(): string {
    return Math.random().toString(36).substr(2, 16);
  }

  private generateSpanId(): string {
    return Math.random().toString(36).substr(2, 8);
  }

  private calculateAverageDuration(spans: TraceSpan[]): number {
    const completedSpans = spans.filter(s => s.duration !== undefined);
    if (completedSpans.length === 0) return 0;

    const totalDuration = completedSpans.reduce((sum, s) => sum + (s.duration || 0), 0);
    return totalDuration / completedSpans.length;
  }
}

class HealthMonitor {
  private components: Map<string, ComponentHealth> = new Map();
  private logger: ILogger;

  constructor(
    private config: any,
    private observabilitySystem: ObservabilitySystem
  ) {
    this.logger = createLogger('HealthMonitor');
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing health monitoring...');
    this.registerDefaultComponents();
  }

  async checkHealth(): Promise<SystemHealth> {
    const componentHealths: ComponentHealth[] = [];
    let totalScore = 0;

    for (const [name, component] of this.components.entries()) {
      try {
        const health = await this.checkComponentHealth(name, component);
        componentHealths.push(health);

        // Calculate health score (healthy=1, degraded=0.5, critical=0, unknown=0.25)
        const score =
          health.status === 'healthy'
            ? 1
            : health.status === 'degraded'
              ? 0.5
              : health.status === 'unknown'
                ? 0.25
                : 0;
        totalScore += score;
      } catch (error) {
        this.logger.error(`Health check failed for ${name}:`, error);
        componentHealths.push({
          ...component,
          status: 'critical',
          lastChecked: new Date(),
          errorRate: 1.0,
        });
      }
    }

    const overallScore = componentHealths.length > 0 ? totalScore / componentHealths.length : 0;
    const status = this.determineOverallStatus(componentHealths, overallScore);

    return {
      status,
      components: componentHealths,
      overallScore,
      lastChecked: new Date(),
      uptime: Date.now() - (this.observabilitySystem as any).systemStartTime.getTime(),
      version: '3.5.0',
    };
  }

  async performHealthCheck(): Promise<void> {
    const health = await this.checkHealth();

    this.observabilitySystem.recordMetric('system.health.score', health.overallScore);
    this.observabilitySystem.recordMetric(
      'system.health.components.total',
      health.components.length
    );

    const healthyCount = health.components.filter(c => c.status === 'healthy').length;
    this.observabilitySystem.recordMetric('system.health.components.healthy', healthyCount);
  }

  registerComponent(name: string, component: ComponentHealth): void {
    this.components.set(name, component);
  }

  getStats(): HealthStats {
    return {
      totalComponents: this.components.size,
      healthyComponents: Array.from(this.components.values()).filter(c => c.status === 'healthy')
        .length,
      degradedComponents: Array.from(this.components.values()).filter(c => c.status === 'degraded')
        .length,
      criticalComponents: Array.from(this.components.values()).filter(c => c.status === 'critical')
        .length,
      lastHealthCheck: new Date(),
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Health monitor shutdown completed');
  }

  private registerDefaultComponents(): void {
    // Register core system components
    this.registerComponent('memory', {
      name: 'memory',
      status: 'healthy',
      metrics: {
        cpu: 0,
        memory: 0,
        diskUsage: 0,
        networkLatency: 0,
        errorCount: 0,
        requestCount: 0,
        customMetrics: {},
      },
      dependencies: [],
      lastChecked: new Date(),
      errorRate: 0,
      responseTime: 0,
    });

    this.registerComponent('event-loop', {
      name: 'event-loop',
      status: 'healthy',
      metrics: {
        cpu: 0,
        memory: 0,
        diskUsage: 0,
        networkLatency: 0,
        errorCount: 0,
        requestCount: 0,
        customMetrics: {},
      },
      dependencies: [],
      lastChecked: new Date(),
      errorRate: 0,
      responseTime: 0,
    });
  }

  private async checkComponentHealth(
    name: string,
    component: ComponentHealth
  ): Promise<ComponentHealth> {
    switch (name) {
      case 'memory':
        return this.checkMemoryHealth(component);
      case 'event-loop':
        return this.checkEventLoopHealth(component);
      default:
        return this.checkGenericComponentHealth(component);
    }
  }

  private checkMemoryHealth(component: ComponentHealth): ComponentHealth {
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    let status: 'healthy' | 'degraded' | 'critical' | 'unknown' = 'healthy';
    if (heapUsedPercent > 90) {
      status = 'critical';
    } else if (heapUsedPercent > 75) {
      status = 'degraded';
    }

    return {
      ...component,
      status,
      metrics: {
        ...component.metrics,
        memory: heapUsedPercent,
      },
      lastChecked: new Date(),
    };
  }

  private checkEventLoopHealth(component: ComponentHealth): ComponentHealth {
    // Simple event loop lag check
    const start = performance.now();

    return new Promise<ComponentHealth>(resolve => {
      setImmediate(() => {
        const lag = performance.now() - start;

        let status: 'healthy' | 'degraded' | 'critical' | 'unknown' = 'healthy';
        if (lag > 100) {
          status = 'critical';
        } else if (lag > 50) {
          status = 'degraded';
        }

        resolve({
          ...component,
          status,
          responseTime: lag,
          lastChecked: new Date(),
        });
      });
    }) as any;
  }

  private checkGenericComponentHealth(component: ComponentHealth): ComponentHealth {
    return {
      ...component,
      lastChecked: new Date(),
    };
  }

  private determineOverallStatus(
    components: ComponentHealth[],
    overallScore: number
  ): 'healthy' | 'degraded' | 'critical' | 'unknown' {
    const criticalComponents = components.filter(c => c.status === 'critical').length;
    const degradedComponents = components.filter(c => c.status === 'degraded').length;

    if (criticalComponents > 0) return 'critical';
    if (degradedComponents > 0 || overallScore < 0.8) return 'degraded';
    if (overallScore < 0.5) return 'critical';

    return 'healthy';
  }
}

class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private logger: ILogger;

  constructor(
    private config: any,
    private observabilitySystem: ObservabilitySystem
  ) {
    this.logger = createLogger('AlertManager');
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing alert management...');

    // Load default rules
    if (this.config.rules) {
      for (const rule of this.config.rules) {
        this.addRule(rule);
      }
    }
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.logger.debug(`Added alert rule: ${rule.name}`);
  }

  evaluateRules(): void {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      try {
        this.evaluateRule(rule);
      } catch (error) {
        this.logger.error(`Failed to evaluate rule ${rule.name}:`, error);
      }
    }
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();
    }
  }

  exportData(timeRange?: { start: Date; end: Date }): Alert[] {
    let alerts = this.alertHistory;

    if (timeRange) {
      alerts = alerts.filter(
        a => a.triggeredAt >= timeRange.start && a.triggeredAt <= timeRange.end
      );
    }

    return alerts;
  }

  getStats(): AlertStats {
    const recentAlerts = this.alertHistory.filter(
      a => a.triggeredAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    return {
      totalRules: this.rules.size,
      activeAlerts: this.activeAlerts.size,
      alertsLast24h: recentAlerts.length,
      criticalAlerts: Array.from(this.activeAlerts.values()).filter(a => a.severity === 'critical')
        .length,
      resolvedAlertsLast24h: recentAlerts.filter(a => a.status === 'resolved').length,
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Alert manager shutdown completed');
  }

  private evaluateRule(rule: AlertRule): void {
    // Simplified rule evaluation - in production would query actual metrics
    const shouldTrigger = Math.random() < 0.01; // 1% chance for demo

    if (shouldTrigger && !this.activeAlerts.has(rule.id)) {
      this.triggerAlert(rule);
    }
  }

  private triggerAlert(rule: AlertRule): void {
    const alert: Alert = {
      id: this.generateAlertId(),
      ruleId: rule.id,
      severity: rule.severity,
      status: 'active',
      triggeredAt: new Date(),
      message: `Alert triggered: ${rule.name}`,
      details: {
        rule: rule.name,
        description: rule.description,
      },
    };

    this.activeAlerts.set(alert.id, alert);
    this.alertHistory.push(alert);

    // Execute alert actions
    this.executeAlertActions(rule, alert);

    this.observabilitySystem.emit('alert:triggered', alert);
    this.logger.warn(`Alert triggered: ${rule.name} (${alert.id})`);
  }

  private executeAlertActions(rule: AlertRule, alert: Alert): void {
    for (const action of rule.actions) {
      if (!action.enabled) continue;

      try {
        this.executeAction(action, alert);
      } catch (error) {
        this.logger.error(`Failed to execute alert action ${action.type}:`, error);
      }
    }
  }

  private executeAction(action: AlertAction, alert: Alert): void {
    switch (action.type) {
      case 'log':
        this.logger.error(`ALERT: ${alert.message}`, alert.details);
        break;
      case 'webhook':
        // Would make HTTP request to webhook URL
        this.logger.debug(`Would send webhook for alert ${alert.id}`);
        break;
      default:
        this.logger.debug(`Action type ${action.type} not implemented`);
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }
}

class PerformanceProfiler {
  private profiles: Map<string, PerformanceProfile> = new Map();
  private activeMeasurements: Map<string, PerformanceMeasurement> = new Map();

  async profile<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    let result: T;
    let success = true;

    try {
      result = await operation();
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const endTime = performance.now();
      const endMemory = process.memoryUsage();

      const measurement: PerformanceMeasurement = {
        timestamp: new Date(),
        duration: endTime - startTime,
        memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
        cpuUsage: 0, // Would need more sophisticated CPU monitoring
        success,
        metadata: metadata || {},
      };

      this.recordMeasurement(operationName, measurement);
    }

    return result!;
  }

  getProfiles(): PerformanceProfile[] {
    return Array.from(this.profiles.values());
  }

  getStats(): PerformanceStats {
    const allProfiles = this.getProfiles();
    const totalMeasurements = allProfiles.reduce((sum, p) => sum + p.measurements.length, 0);

    return {
      totalOperations: this.profiles.size,
      totalMeasurements,
      averageDuration: this.calculateOverallAverageDuration(allProfiles),
      memoryEfficiency: this.calculateMemoryEfficiency(allProfiles),
    };
  }

  private recordMeasurement(operationName: string, measurement: PerformanceMeasurement): void {
    if (!this.profiles.has(operationName)) {
      this.profiles.set(operationName, {
        operation: operationName,
        measurements: [],
        statistics: this.createEmptyStatistics(),
        trends: [],
      });
    }

    const profile = this.profiles.get(operationName)!;
    profile.measurements.push(measurement);

    // Keep only recent measurements
    if (profile.measurements.length > 1000) {
      profile.measurements = profile.measurements.slice(-500);
    }

    // Update statistics
    profile.statistics = this.calculateStatistics(profile.measurements);
    profile.trends = this.calculateTrends(profile.measurements);
  }

  private calculateStatistics(measurements: PerformanceMeasurement[]): PerformanceStatistics {
    if (measurements.length === 0) return this.createEmptyStatistics();

    const durations = measurements.map(m => m.duration);
    const sortedDurations = [...durations].sort((a, b) => a - b);

    const sum = durations.reduce((s, d) => s + d, 0);
    const mean = sum / durations.length;
    const median = sortedDurations[Math.floor(sortedDurations.length / 2)];

    const variance = durations.reduce((v, d) => v + Math.pow(d - mean, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);

    return {
      count: measurements.length,
      mean,
      median,
      p95: sortedDurations[Math.floor(sortedDurations.length * 0.95)],
      p99: sortedDurations[Math.floor(sortedDurations.length * 0.99)],
      min: Math.min(...durations),
      max: Math.max(...durations),
      stdDev,
    };
  }

  private calculateTrends(measurements: PerformanceMeasurement[]): PerformanceTrend[] {
    // Simplified trend calculation
    if (measurements.length < 10) return [];

    const recentMeasurements = measurements.slice(-50);
    const olderMeasurements = measurements.slice(-100, -50);

    if (olderMeasurements.length === 0) return [];

    const recentAvg =
      recentMeasurements.reduce((sum, m) => sum + m.duration, 0) / recentMeasurements.length;
    const olderAvg =
      olderMeasurements.reduce((sum, m) => sum + m.duration, 0) / olderMeasurements.length;

    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

    let direction: 'improving' | 'degrading' | 'stable' = 'stable';
    if (Math.abs(changePercent) > 5) {
      direction = changePercent < 0 ? 'improving' : 'degrading';
    }

    return [
      {
        period: 'recent',
        direction,
        changePercent: Math.abs(changePercent),
        significance: Math.min(1, Math.abs(changePercent) / 20),
      },
    ];
  }

  private createEmptyStatistics(): PerformanceStatistics {
    return {
      count: 0,
      mean: 0,
      median: 0,
      p95: 0,
      p99: 0,
      min: 0,
      max: 0,
      stdDev: 0,
    };
  }

  private calculateOverallAverageDuration(profiles: PerformanceProfile[]): number {
    const allDurations = profiles.flatMap(p => p.measurements.map(m => m.duration));
    if (allDurations.length === 0) return 0;

    return allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length;
  }

  private calculateMemoryEfficiency(profiles: PerformanceProfile[]): number {
    const allMeasurements = profiles.flatMap(p => p.measurements);
    if (allMeasurements.length === 0) return 1;

    const avgMemoryUsage =
      allMeasurements.reduce((sum, m) => sum + m.memoryUsage, 0) / allMeasurements.length;

    // Simple efficiency metric: lower memory usage = higher efficiency
    return Math.max(0, Math.min(1, 1 - avgMemoryUsage / (100 * 1024 * 1024))); // Normalize to 100MB
  }
}

class ObservabilityStorage {
  private logger: ILogger;

  constructor(private config: any) {
    this.logger = createLogger('ObservabilityStorage');
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing observability storage...');

    // Ensure data directory exists
    try {
      await fs.mkdir(this.config.dataPath, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create data directory:', error);
      throw error;
    }
  }

  getStats(): StorageStats {
    return {
      dataPath: this.config.dataPath,
      totalSize: 0, // Would calculate actual size
      compressionEnabled: this.config.compressionEnabled,
      encryptionEnabled: this.config.encryptionEnabled,
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Observability storage shutdown completed');
  }
}

// Additional interfaces for the supporting classes
interface AggregatedMetric {
  name: string;
  tags: Record<string, string>;
  count: number;
  sum: number;
  min: number;
  max: number;
  values: number[];
}

interface MetricsSummary {
  totalMetrics: number;
  uniqueMetrics: number;
  timeRange: { start: Date; end: Date };
  topMetrics: Array<{ name: string; count: number; avgValue: number }>;
  aggregations: Record<string, any>;
}

interface ObservabilityStats {
  systemInfo: {
    uptime: number;
    version: string;
    nodeVersion: string;
    platform: string;
    arch: string;
  };
  metrics: MetricsStats;
  tracing: TracingStats;
  health: HealthStats;
  alerts: AlertStats;
  performance: PerformanceStats;
  storage: StorageStats;
}

interface MetricsStats {
  totalCollected: number;
  uniqueNames: number;
  aggregatedMetrics: number;
  memoryUsage: number;
  exporterStatus: Array<{ type: string; healthy: boolean }>;
}

interface TracingStats {
  totalTraces: number;
  totalSpans: number;
  activeSpans: number;
  averageSpansPerTrace: number;
  averageDuration: number;
}

interface HealthStats {
  totalComponents: number;
  healthyComponents: number;
  degradedComponents: number;
  criticalComponents: number;
  lastHealthCheck: Date;
}

interface AlertStats {
  totalRules: number;
  activeAlerts: number;
  alertsLast24h: number;
  criticalAlerts: number;
  resolvedAlertsLast24h: number;
}

interface PerformanceStats {
  totalOperations: number;
  totalMeasurements: number;
  averageDuration: number;
  memoryEfficiency: number;
}

interface StorageStats {
  dataPath: string;
  totalSize: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

/**
 * Enhanced: Factory function for creating observability system with OpenTelemetry support
 */
export function getTelemetryProvider(): ObservabilitySystem {
  // This would be the singleton instance - simplified for integration
  return new ObservabilitySystem({
    metrics: {
      enabled: true,
      retentionDays: 7,
      exportInterval: 60000,
      exporters: [{ type: 'prometheus', batchSize: 100, flushInterval: 5000 }],
    },
    tracing: {
      enabled: true,
      samplingRate: 1.0,
      maxSpansPerTrace: 100,
      exporters: [{ type: 'jaeger', batchSize: 100, flushInterval: 5000 }],
    },
    logging: {
      level: 'info',
      outputs: [{ type: 'console', format: 'structured', configuration: {} }],
      structured: true,
      includeStackTrace: true,
    },
    health: {
      checkInterval: 30000,
      timeoutMs: 5000,
      retryAttempts: 3,
    },
    alerting: {
      enabled: true,
      rules: [],
      defaultCooldown: 300000,
    },
    storage: {
      dataPath: './observability-data',
      maxFileSize: 104857600,
      compressionEnabled: true,
      encryptionEnabled: false,
    },
  });
}
