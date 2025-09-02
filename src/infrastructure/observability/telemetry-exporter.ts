import { createLogger } from '../logging/logger.js';
import { ILogger } from '../../domain/interfaces/logger.js';
import { MetricPoint } from './metrics-collector.js';
import { SystemHealth } from './health-monitor.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as net from 'net';
import * as http from 'http';
import * as https from 'https';

export interface TelemetryExporterConfig {
  enabled: boolean;
  interval?: number;
  exporters: Array<{
    type: 'prometheus' | 'statsd' | 'opentelemetry' | 'file';
    endpoint?: string;
    authentication?: Record<string, string>;
    batchSize?: number;
    flushInterval?: number;
  }>;
}

export class TelemetryExporter {
  private logger: ILogger = createLogger('TelemetryExporter');
  private fileHandles: Map<string, string> = new Map(); // For file exporters

  constructor(private config: TelemetryExporterConfig) {}

  async initialize(): Promise<void> {
    // Validate configuration
    if (
      !this.config.exporters ||
      !Array.isArray(this.config.exporters) ||
      this.config.exporters.length === 0
    ) {
      throw new Error('TelemetryExporter: At least one exporter configuration is required.');
    }
    for (const [i, exporter] of this.config.exporters.entries()) {
      if (
        !exporter.type ||
        !['prometheus', 'statsd', 'opentelemetry', 'file'].includes(exporter.type)
      ) {
        throw new Error(`TelemetryExporter: Invalid exporter type at index ${i}: ${exporter.type}`);
      }
      // Example: endpoint is required for all except 'file'
      if (
        exporter.type !== 'file' &&
        (!exporter.endpoint || typeof exporter.endpoint !== 'string')
      ) {
        throw new Error(
          `TelemetryExporter: Exporter of type '${exporter.type}' at index ${i} requires a valid 'endpoint'.`
        );
      }
      if (
        exporter.batchSize !== undefined &&
        (typeof exporter.batchSize !== 'number' || exporter.batchSize <= 0)
      ) {
        throw new Error(
          `TelemetryExporter: Invalid batchSize for exporter at index ${i}: ${exporter.batchSize}`
        );
      }
      if (
        exporter.flushInterval !== undefined &&
        (typeof exporter.flushInterval !== 'number' || exporter.flushInterval <= 0)
      ) {
        throw new Error(
          `TelemetryExporter: Invalid flushInterval for exporter at index ${i}: ${exporter.flushInterval}`
        );
      }
    }

    // Initialize file exporters by creating directories
    for (const exporter of this.config.exporters) {
      if (exporter.type === 'file') {
        const filePath = exporter.endpoint || './telemetry/metrics.jsonl';
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        this.fileHandles.set(exporter.type, filePath);
        this.logger.info(`File exporter initialized: ${filePath}`);
      }
    }

    this.logger.info(
      `TelemetryExporter initialized with ${this.config.exporters.length} exporters`
    );
  }

  async exportMetrics(metrics: MetricPoint[]): Promise<void> {
    if (!metrics || metrics.length === 0) {
      return;
    }

    for (const exporter of this.config.exporters) {
      try {
        await this.exportToTarget(exporter, metrics);
        this.logger.debug(`Successfully exported ${metrics.length} metrics to ${exporter.type}`);
      } catch (error) {
        this.logger.error(`Failed to export metrics to ${exporter.type}:`, error);
      }
    }
  }

  private async exportToTarget(exporter: any, metrics: MetricPoint[]): Promise<void> {
    switch (exporter.type) {
      case 'file':
        await this.exportToFile(exporter, metrics);
        break;
      case 'prometheus':
        await this.exportToPrometheus(exporter, metrics);
        break;
      case 'statsd':
        await this.exportToStatsd(exporter, metrics);
        break;
      case 'opentelemetry':
        await this.exportToOpenTelemetry(exporter, metrics);
        break;
      default:
        throw new Error(`Unsupported exporter type: ${exporter.type}`);
    }
  }

  private async exportToFile(exporter: any, metrics: MetricPoint[]): Promise<void> {
    const filePath =
      this.fileHandles.get(exporter.type) || exporter.endpoint || './telemetry/metrics.jsonl';

    const timestamp = new Date().toISOString();
    const exportData = {
      timestamp,
      metrics: metrics.map(metric => ({
        name: metric.name,
        value: metric.value,
        unit: metric.unit,
        timestamp: metric.timestamp,
        tags: metric.tags,
      })),
      exportedBy: 'codecrucible-synth',
    };

    const jsonLine = JSON.stringify(exportData) + '\n';
    await fs.appendFile(filePath, jsonLine, 'utf-8');
  }

  private async exportToPrometheus(exporter: any, metrics: MetricPoint[]): Promise<void> {
    const prometheusFormat = this.formatMetricsForPrometheus(metrics);

    if (!exporter.endpoint) {
      throw new Error('Prometheus exporter requires endpoint configuration');
    }

    // Send metrics to Prometheus pushgateway or remote write endpoint
    const url = new URL(exporter.endpoint);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(prometheusFormat),
          ...this.getAuthHeaders(exporter.authentication),
        },
      };

      const req = httpModule.request(options, res => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Prometheus export failed with status: ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.write(prometheusFormat);
      req.end();
    });
  }

  private async exportToStatsd(exporter: any, metrics: MetricPoint[]): Promise<void> {
    if (!exporter.endpoint) {
      throw new Error('StatsD exporter requires endpoint configuration');
    }

    const [host, port] = exporter.endpoint.split(':');
    const statsdPort = parseInt(port || '8125', 10);

    const client = new net.Socket();

    return new Promise((resolve, reject) => {
      client.connect(statsdPort, host, () => {
        const statsdFormat = this.formatMetricsForStatsd(metrics);
        client.write(statsdFormat);
        client.end();
        resolve();
      });

      client.on('error', reject);
    });
  }

  private async exportToOpenTelemetry(exporter: any, metrics: MetricPoint[]): Promise<void> {
    const otlpFormat = this.formatMetricsForOTLP(metrics);

    if (!exporter.endpoint) {
      throw new Error('OpenTelemetry exporter requires endpoint configuration');
    }

    const url = new URL(exporter.endpoint);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(otlpFormat),
          ...this.getAuthHeaders(exporter.authentication),
        },
      };

      const req = httpModule.request(options, res => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`OpenTelemetry export failed with status: ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.write(otlpFormat);
      req.end();
    });
  }

  private formatMetricsForPrometheus(metrics: MetricPoint[]): string {
    return (
      metrics
        .map(metric => {
          const labels = Object.entries(metric.tags || {})
            .map(([key, value]) => `${key}="${value}"`)
            .join(',');
          const labelStr = labels ? `{${labels}}` : '';
          return `${metric.name}${labelStr} ${metric.value} ${metric.timestamp}`;
        })
        .join('\n') + '\n'
    );
  }

  private formatMetricsForStatsd(metrics: MetricPoint[]): string {
    return (
      metrics
        .map(metric => {
          // StatsD format: metric.name:value|type|@sample_rate|#tags
          const tags = Object.entries(metric.tags || {})
            .map(([key, value]) => `${key}:${value}`)
            .join(',');
          const tagStr = tags ? `|#${tags}` : '';
          const type = this.getStatsdType(metric.unit);
          return `${metric.name}:${metric.value}|${type}${tagStr}`;
        })
        .join('\n') + '\n'
    );
  }

  private formatMetricsForOTLP(metrics: MetricPoint[]): string {
    const otlpMetrics = {
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
                name: 'codecrucible-synth-telemetry',
                version: '1.0.0',
              },
              metrics: metrics.map(metric => ({
                name: metric.name,
                unit: metric.unit,
                gauge: {
                  dataPoints: [
                    {
                      timeUnixNano: metric.timestamp.getTime() * 1000000,
                      asDouble: metric.value,
                      attributes: Object.entries(metric.tags || {}).map(([key, value]) => ({
                        key,
                        value: { stringValue: value.toString() },
                      })),
                    },
                  ],
                },
              })),
            },
          ],
        },
      ],
    };

    return JSON.stringify(otlpMetrics);
  }

  private getStatsdType(unit?: string): string {
    if (!unit) return 'g'; // gauge
    switch (unit.toLowerCase()) {
      case 'count':
      case 'counter':
        return 'c';
      case 'ms':
      case 'milliseconds':
        return 'ms';
      case 'histogram':
        return 'h';
      default:
        return 'g'; // gauge
    }
  }

  private getAuthHeaders(authentication?: Record<string, string>): Record<string, string> {
    if (!authentication) return {};

    const headers: Record<string, string> = {};

    if (authentication.bearer) {
      headers['Authorization'] = `Bearer ${authentication.bearer}`;
    } else if (authentication.apiKey) {
      headers['X-API-Key'] = authentication.apiKey;
    } else if (authentication.username && authentication.password) {
      const credentials = Buffer.from(
        `${authentication.username}:${authentication.password}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    return headers;
  }

  async exportHealth(health: SystemHealth): Promise<void> {
    // Convert health status to metrics format
    const healthMetrics: MetricPoint[] = [
      {
        name: 'system_health_status',
        value: health.status === 'healthy' ? 1 : 0,
        unit: 'status',
        timestamp: new Date(),
        tags: {
          status: health.status,
          service: 'codecrucible-synth',
        },
        type: 'gauge',
      },
      {
        name: 'system_health_score',
        value: health.overallScore || 0,
        unit: 'score',
        timestamp: new Date(),
        tags: {
          service: 'codecrucible-synth',
        },
        type: 'gauge',
      },
    ];

    // Add component health metrics if available
    if (health.components) {
      for (const [component, componentHealth] of Object.entries(health.components)) {
        healthMetrics.push({
          name: 'component_health_status',
          value: componentHealth.status === 'healthy' ? 1 : 0,
          unit: 'status',
          timestamp: new Date(),
          tags: {
            component,
            status: componentHealth.status,
            service: 'codecrucible-synth',
          },
          type: 'gauge',
        });
      }
    }

    // Export health metrics using the same exporters
    await this.exportMetrics(healthMetrics);

    this.logger.debug(`Health status exported: ${health.status} (${healthMetrics.length} metrics)`);
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down TelemetryExporter');
    this.fileHandles.clear();
  }
}
