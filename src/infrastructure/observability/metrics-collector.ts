import { createLogger } from '../logging/logger-adapter.js';
import { ILogger } from '../../domain/interfaces/logger.js';

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  unit: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface MetricExporter {
  type: 'prometheus' | 'statsd' | 'opentelemetry' | 'file';
  endpoint?: string;
  authentication?: Record<string, string>;
  batchSize?: number;
  flushInterval?: number;
}

interface AggregatedMetric {
  name: string;
  tags: Record<string, string>;
  count: number;
  sum: number;
  min: number;
  max: number;
  values: number[];
}

export interface MetricsSummary {
  totalMetrics: number;
  uniqueMetrics: number;
  timeRange: { start: Date; end: Date };
  topMetrics: Record<string, number>;
  aggregations: Record<
    string,
    { count: number; avg: number; min: number; max: number; p95: number; p99: number }
  >;
}

export interface MetricsStats {
  totalCollected: number;
  uniqueNames: number;
  aggregatedMetrics: number;
  memoryUsage: number;
  exporterStatus: Array<{ type: string; healthy: boolean }>;
}

export interface MetricsConfig {
  enabled: boolean;
  retentionDays: number;
  exportInterval: number;
  exporters: MetricExporter[];
}

export class MetricsCollector {
  private metrics: MetricPoint[] = [];
  private aggregated: Map<string, AggregatedMetric> = new Map();
  private logger: ILogger = createLogger('MetricsCollector');

  constructor(private config: MetricsConfig) {}

  public initialize(): void {
    if (this.config.exportInterval > 0) {
      setInterval(() => {
        this.exportMetrics().catch(err => { this.logger.error('Error exporting metrics:', err); });
      }, this.config.exportInterval);
    }
  }

  record(metric: MetricPoint): void {
    this.metrics.push(metric);
    this.updateAggregated(metric);
    this.cleanup();
  }

  public getSummary(timeRange?: { start: Date; end: Date }): MetricsSummary {
    const { metrics } = this;
    let filteredMetrics = metrics;
    if (timeRange) {
      const { start, end } = timeRange;
      filteredMetrics = metrics.filter(m => m.timestamp >= start && m.timestamp <= end);
    }

    return {
      totalMetrics: filteredMetrics.length,
      uniqueMetrics: new Set(filteredMetrics.map(m => m.name)).size,
      timeRange: timeRange || {
        start: filteredMetrics[0]?.timestamp ?? new Date(),
        end: filteredMetrics[filteredMetrics.length - 1]?.timestamp ?? new Date(),
      },
      topMetrics: this.getTopMetrics(filteredMetrics),
      aggregations: this.getAggregations(filteredMetrics),
    };
  }

  exportData(timeRange?: { start: Date; end: Date }): MetricPoint[] {
    if (!timeRange) return [...this.metrics];
    return this.metrics.filter(m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end);
  }

  getStats(): MetricsStats {
    return {
      totalCollected: this.metrics.length,
      uniqueNames: new Set(this.metrics.map(m => m.name)).size,
      aggregatedMetrics: this.aggregated.size,
      memoryUsage: this.metrics.length * 100,
      exporterStatus: this.config.exporters.map(e => ({ type: e.type, healthy: true })),
    };
  }

  async shutdown(): Promise<void> {
    await this.exportMetrics();
  }

  private updateAggregated(metric: MetricPoint): void {
    const key = `${metric.name}:${JSON.stringify(metric.tags)}`;
    if (!this.aggregated.has(key)) {
      this.aggregated.set(key, {
        name: metric.name,
        tags: metric.tags,
        count: 0,
        sum: 0,
        min: Number.MAX_VALUE,
        max: Number.MIN_VALUE,
        values: [],
      });
    }

    const agg = this.aggregated.get(key);
    if (!agg) {
      this.logger.error(`Aggregated metric not found for key: ${key}`);
      return;
    }
    agg.count++;
    agg.sum += metric.value;
    agg.min = Math.min(agg.min, metric.value);
    agg.max = Math.max(agg.max, metric.value);
    agg.values.push(metric.value);
    if (agg.values.length > 1000) {
      agg.values = agg.values.slice(-500);
    }
  }

  private cleanup(): void {
    if (this.metrics.length > 10000) {
      const cutoff = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
      this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    }
  }

  private async exportMetrics(): Promise<void> {
    if (this.metrics.length === 0) {
      this.logger.debug('No metrics to export');
      return;
    }

    const metricsToExport = [...this.metrics];
    
    for (const exporter of this.config.exporters) {
      try {
        this.logger.debug(`Exporting ${metricsToExport.length} metrics to ${exporter.type}`);
        
        switch (exporter.type) {
          case 'prometheus':
            await this.exportToPrometheus(metricsToExport, exporter);
            break;
          case 'statsd':
            await this.exportToStatsD(metricsToExport, exporter);
            break;
          case 'opentelemetry':
            await this.exportToOpenTelemetry(metricsToExport, exporter);
            break;
          case 'file':
            await this.exportToFile(metricsToExport, exporter);
            break;
          default:
            this.logger.warn(`Unsupported exporter type: ${exporter.type}`);
        }
        
        this.logger.info(`Successfully exported ${metricsToExport.length} metrics to ${exporter.type}`);
      } catch (error) {
        this.logger.error(`Failed to export to ${exporter.type}:`, error);
      }
    }
  }

  /**
   * Export metrics to Prometheus format
   */
  private async exportToPrometheus(metrics: MetricPoint[], exporter: MetricExporter): Promise<void> {
    const prometheusFormat = this.convertToPrometheusFormat(metrics);
    
    if (exporter.endpoint) {
      // Push to Prometheus Push Gateway
      const response = await fetch(`${exporter.endpoint}/metrics/job/codecrucible-synth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          ...exporter.authentication,
        },
        body: prometheusFormat,
      });

      if (!response.ok) {
        throw new Error(`Prometheus export failed: ${response.status} ${response.statusText}`);
      }
    } else {
      // Log metrics in Prometheus format for scraping
      this.logger.info('Prometheus metrics:\n' + prometheusFormat);
    }
  }

  /**
   * Export metrics to StatsD
   */
  private async exportToStatsD(metrics: MetricPoint[], exporter: MetricExporter): Promise<void> {
    if (!exporter.endpoint) {
      throw new Error('StatsD endpoint is required');
    }

    const { createSocket } = await import('dgram');
    const client = createSocket('udp4');
    
    try {
      for (const metric of metrics) {
        const statsdFormat = this.convertToStatsDFormat(metric);
        const [host, port] = exporter.endpoint.split(':');
        
        await new Promise<void>((resolve, reject) => {
          client.send(statsdFormat, parseInt(port) || 8125, host || 'localhost', (error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }
    } finally {
      client.close();
    }
  }

  /**
   * Export metrics to OpenTelemetry
   */
  private async exportToOpenTelemetry(metrics: MetricPoint[], exporter: MetricExporter): Promise<void> {
    if (!exporter.endpoint) {
      throw new Error('OpenTelemetry endpoint is required');
    }

    const otlpPayload = this.convertToOTLPFormat(metrics);
    
    const response = await fetch(`${exporter.endpoint}/v1/metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...exporter.authentication,
      },
      body: JSON.stringify(otlpPayload),
    });

    if (!response.ok) {
      throw new Error(`OpenTelemetry export failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Export metrics to file
   */
  private async exportToFile(metrics: MetricPoint[], exporter: MetricExporter): Promise<void> {
    const { writeFile, mkdir } = await import('fs/promises');
    const { dirname } = await import('path');
    
    const filePath = exporter.endpoint || `./metrics/metrics-${Date.now()}.json`;
    await mkdir(dirname(filePath), { recursive: true });
    
    const data = {
      timestamp: new Date().toISOString(),
      metrics,
      summary: this.getSummary(),
    };

    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    this.logger.info(`Metrics exported to file: ${filePath}`);
  }

  /**
   * Convert metrics to Prometheus format
   */
  private convertToPrometheusFormat(metrics: MetricPoint[]): string {
    const lines: string[] = [];
    const groupedMetrics = new Map<string, MetricPoint[]>();

    // Group metrics by name
    for (const metric of metrics) {
      if (!groupedMetrics.has(metric.name)) {
        groupedMetrics.set(metric.name, []);
      }
      groupedMetrics.get(metric.name)!.push(metric);
    }

    // Convert each metric group
    for (const [name, metricGroup] of groupedMetrics) {
      const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, '_');
      
      // Add help comment
      lines.push(`# HELP ${sanitizedName} ${name} metric`);
      lines.push(`# TYPE ${sanitizedName} ${metricGroup[0].type}`);

      for (const metric of metricGroup) {
        const tagsStr = Object.entries(metric.tags)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');
        
        const labelsStr = tagsStr ? `{${tagsStr}}` : '';
        lines.push(`${sanitizedName}${labelsStr} ${metric.value} ${metric.timestamp.getTime()}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Convert metric to StatsD format
   */
  private convertToStatsDFormat(metric: MetricPoint): string {
    const tags = Object.entries(metric.tags)
      .map(([key, value]) => `${key}:${value}`)
      .join(',');
    
    const tagsSuffix = tags ? `|#${tags}` : '';
    
    switch (metric.type) {
      case 'counter':
        return `${metric.name}:${metric.value}|c${tagsSuffix}`;
      case 'gauge':
        return `${metric.name}:${metric.value}|g${tagsSuffix}`;
      case 'timer':
        return `${metric.name}:${metric.value}|ms${tagsSuffix}`;
      case 'histogram':
        return `${metric.name}:${metric.value}|h${tagsSuffix}`;
      default:
        return `${metric.name}:${metric.value}|g${tagsSuffix}`;
    }
  }

  /**
   * Convert metrics to OpenTelemetry OTLP format
   */
  private convertToOTLPFormat(metrics: MetricPoint[]): any {
    return {
      resourceMetrics: [
        {
          resource: {
            attributes: [
              {
                key: 'service.name',
                value: { stringValue: 'codecrucible-synth' },
              },
            ],
          },
          scopeMetrics: [
            {
              scope: {
                name: 'codecrucible-synth-metrics',
                version: '1.0.0',
              },
              metrics: metrics.map(metric => ({
                name: metric.name,
                description: `${metric.name} metric`,
                unit: metric.unit,
                gauge: {
                  dataPoints: [
                    {
                      attributes: Object.entries(metric.tags).map(([key, value]) => ({
                        key,
                        value: { stringValue: value },
                      })),
                      timeUnixNano: metric.timestamp.getTime() * 1_000_000,
                      asDouble: metric.value,
                    },
                  ],
                },
              })),
            },
          ],
        },
      ],
    };
  }

  private getTopMetrics(metrics: MetricPoint[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const m of metrics) {
      counts[m.name] = (counts[m.name] || 0) + 1;
    }
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    return Object.fromEntries(sorted);
  }

  private getAggregations(
    metrics: MetricPoint[]
  ): Record<
    string,
    { count: number; avg: number; min: number; max: number; p95: number; p99: number }
  > {
    const aggregations: Record<
      string,
      { count: number; avg: number; min: number; max: number; p95: number; p99: number }
    > = {};
    for (const m of metrics) {
      if (!aggregations[m.name]) {
        aggregations[m.name] = {
          count: 0,
          avg: 0,
          min: Number.MAX_VALUE,
          max: Number.MIN_VALUE,
          p95: 0,
          p99: 0,
        };
      }
      const agg = aggregations[m.name];
      agg.count++;
      agg.avg += m.value;
      agg.min = Math.min(agg.min, m.value);
      agg.max = Math.max(agg.max, m.value);
    }
    for (const [name, agg] of Object.entries(aggregations)) {
      const values = metrics
        .filter(m => m.name === name)
        .map(m => m.value)
        .sort((a, b) => a - b);
      agg.avg = agg.avg / agg.count;
      agg.p95 = this.percentile(values, 0.95);
      agg.p99 = this.percentile(values, 0.99);
    }
    return aggregations;
  }

  private percentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const index = Math.ceil(values.length * percentile) - 1;
    return values[Math.max(0, index)];
  }
}
