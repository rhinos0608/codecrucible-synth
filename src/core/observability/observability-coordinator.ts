import { EventEmitter } from 'events';
import { createLogger } from '../logger.js';
import { ILogger } from '../../domain/interfaces/logger.js';
import { MetricsCollector, MetricPoint, MetricsConfig, MetricsStats, MetricsSummary } from './metrics-collector.js';
import { HealthMonitor, HealthConfig, SystemHealth, HealthStats } from './health-monitor.js';
import { AlertManager, AlertConfig, Alert, AlertStats } from './alert-manager.js';
import { TelemetryExporter, TelemetryExporterConfig } from './telemetry-exporter.js';
import { mcpServerMonitoring } from '../../mcp-servers/core/mcp-server-monitoring.js';

export interface TraceSpan {
  id: string;
  name: string;
  start: number;
  tags?: Record<string, string>;
}

export interface ObservabilityConfig {
  metrics: MetricsConfig;
  health: HealthConfig;
  alerting: AlertConfig;
  telemetry: TelemetryExporterConfig;
}

export class ObservabilityCoordinator extends EventEmitter {
  private logger: ILogger = createLogger('ObservabilityCoordinator');
  private metrics: MetricsCollector;
  private health: HealthMonitor;
  private alerts: AlertManager;
  private telemetry: TelemetryExporter;
  private healthInterval?: NodeJS.Timeout;
  private startTime = Date.now();

  constructor(private config: ObservabilityConfig) {
    super();
    this.metrics = new MetricsCollector(config.metrics);
    this.health = new HealthMonitor(config.health);
    this.alerts = new AlertManager(config.alerting);
    this.telemetry = new TelemetryExporter(config.telemetry);
  }

  async initialize(): Promise<void> {
    await this.metrics.initialize();
    await this.health.initialize();
    await this.alerts.initialize();
    await this.telemetry.initialize();
    this.scheduleHealthChecks();
  }

  recordMetric(name: string, value: number, tags: Record<string, string> = {}, unit = 'count'): void {
    const metric: MetricPoint = { name, value, timestamp: new Date(), tags, unit, type: 'gauge' };
    this.metrics.record(metric);
  }

  incrementCounter(name: string, tags: Record<string, string> = {}, value = 1): void {
    const metric: MetricPoint = { name, value, timestamp: new Date(), tags, unit: 'count', type: 'counter' };
    this.metrics.record(metric);
  }

  recordTimer(name: string, duration: number, tags: Record<string, string> = {}): void {
    const metric: MetricPoint = { name, value: duration, timestamp: new Date(), tags, unit: 'ms', type: 'timer' };
    this.metrics.record(metric);
  }

  startSpan(name: string, tags?: Record<string, string>): TraceSpan {
    return { id: Math.random().toString(36).slice(2), name, start: Date.now(), tags };
  }

  finishSpan(span: TraceSpan, tags?: Record<string, string>): void {
    const duration = Date.now() - span.start;
    this.recordTimer(`span.${span.name}`, duration, { ...span.tags, ...tags });
  }

  getMetricsSummary(range?: { start: Date; end: Date }): MetricsSummary {
    return this.metrics.getSummary(range);
  }

  getSystemHealth(): Promise<SystemHealth> {
    return this.health.performHealthCheck();
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.getActiveAlerts();
  }

  getSystemStats(): {
    metrics: MetricsStats;
    health: HealthStats;
    alerts: AlertStats;
    uptime: number;
  } {
    return {
      metrics: this.metrics.getStats(),
      health: this.health.getStats(),
      alerts: this.alerts.getStats(),
      uptime: Date.now() - this.startTime,
    };
  }

  async shutdown(): Promise<void> {
    if (this.healthInterval) clearInterval(this.healthInterval);
    await this.metrics.shutdown();
    await this.health.shutdown();
    await this.alerts.shutdown();
    await this.telemetry.shutdown();
  }

  private scheduleHealthChecks(): void {
    const run = async () => {
      const health = await this.health.performHealthCheck();
      this.telemetry.exportHealth(health).catch(() => {});
      const metrics = this.metrics.exportData();
      this.telemetry.exportMetrics(metrics).catch(() => {});
      const mcp = mcpServerMonitoring.getSystemMetrics();
      if (mcp) {
        this.recordMetric('system.cpu.usage', mcp.cpu.usage, {}, '%');
        this.recordMetric('system.memory.used', mcp.memory.used, {}, 'bytes');
      }
      this.alerts.evaluateRules();
    };
    run().catch(() => {});
    this.healthInterval = setInterval(run, this.config.health.checkInterval);
  }
}

export type { MetricPoint, SystemHealth, Alert, MetricsStats, HealthStats, AlertStats };

