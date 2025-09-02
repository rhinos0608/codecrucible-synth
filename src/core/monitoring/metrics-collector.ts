/**
 * Enterprise Metrics Collection System
 * Implements Prometheus-style metrics with custom business metrics
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

export interface MetricConfig {
  name: string;
  help: string;
  labels?: string[];
}

export interface HistogramConfig extends MetricConfig {
  buckets?: number[];
}

export interface CounterMetric {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export interface GaugeMetric {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export interface HistogramMetric {
  name: string;
  count: number;
  sum: number;
  buckets: Record<string, number>;
  labels: Record<string, string>;
  timestamp: number;
}

export interface PerformanceMetrics {
  httpRequests: {
    total: number;
    duration: HistogramMetric;
    errors: number;
    activeConnections: number;
  };
  aiOperations: {
    total: number;
    duration: HistogramMetric;
    tokensGenerated: number;
    failures: number;
  };
  system: {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    uptime: number;
  };
  business: {
    activeUsers: number;
    codeGenerations: number;
    analysisRequests: number;
    voiceInteractions: number;
  };
}

export class MetricsCollector extends EventEmitter {
  private counters = new Map<string, CounterMetric>();
  private gauges = new Map<string, GaugeMetric>();
  private histograms = new Map<string, HistogramMetric>();
  private registry = new Map<string, MetricConfig>();

  private systemMetricsInterval?: NodeJS.Timeout;
  private metricsHistory: Array<{ timestamp: number; metrics: any }> = [];
  private readonly maxHistorySize = 1000;

  constructor() {
    super();
    this.initializeDefaultMetrics();
    this.startSystemMetricsCollection();
  }

  /**
   * Initialize default application metrics
   */
  private initializeDefaultMetrics(): void {
    // HTTP metrics
    this.registerCounter('http_requests_total', 'Total HTTP requests', [
      'method',
      'route',
      'status',
    ]);
    this.registerHistogram(
      'http_request_duration_seconds',
      'HTTP request duration',
      ['method', 'route'],
      [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    );
    this.registerGauge('http_active_connections', 'Active HTTP connections');

    // AI/LLM metrics
    this.registerCounter('ai_operations_total', 'Total AI operations', [
      'provider',
      'model',
      'voice',
    ]);
    this.registerHistogram(
      'ai_operation_duration_seconds',
      'AI operation duration',
      ['provider', 'model'],
      [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120]
    );
    this.registerCounter('ai_tokens_generated_total', 'Total tokens generated', [
      'provider',
      'model',
    ]);
    this.registerCounter('ai_errors_total', 'Total AI operation errors', [
      'provider',
      'error_type',
    ]);

    // System metrics
    this.registerGauge('system_memory_usage_bytes', 'System memory usage');
    this.registerGauge('system_cpu_usage_percent', 'System CPU usage percentage');
    this.registerGauge('system_uptime_seconds', 'System uptime');
    this.registerGauge('nodejs_heap_size_used_bytes', 'Node.js heap size used');
    this.registerGauge('nodejs_heap_size_total_bytes', 'Node.js heap size total');

    // Business metrics
    this.registerGauge('active_users_total', 'Currently active users');
    this.registerCounter('code_generations_total', 'Total code generations', [
      'language',
      'success',
    ]);
    this.registerCounter('file_analyses_total', 'Total file analyses', ['file_type', 'success']);
    this.registerCounter('voice_interactions_total', 'Total voice interactions', ['voice_type']);

    // Cache metrics
    this.registerCounter('cache_operations_total', 'Total cache operations', [
      'operation',
      'cache_type',
    ]);
    this.registerGauge('cache_hit_ratio', 'Cache hit ratio', ['cache_type']);
    this.registerGauge('cache_size_bytes', 'Cache size in bytes', ['cache_type']);

    // Security metrics
    this.registerCounter('auth_attempts_total', 'Total authentication attempts', [
      'result',
      'method',
    ]);
    this.registerCounter('security_events_total', 'Total security events', [
      'event_type',
      'severity',
    ]);
    this.registerGauge('active_sessions_total', 'Currently active sessions');
  }

  /**
   * Register a counter metric
   */
  registerCounter(name: string, help: string, labels: string[] = []): void {
    this.registry.set(name, { name, help, labels });
    this.counters.set(name, {
      name,
      value: 0,
      labels: {},
      timestamp: Date.now(),
    });
  }

  /**
   * Register a gauge metric
   */
  registerGauge(name: string, help: string, labels: string[] = []): void {
    this.registry.set(name, { name, help, labels });
    this.gauges.set(name, {
      name,
      value: 0,
      labels: {},
      timestamp: Date.now(),
    });
  }

  /**
   * Register a histogram metric
   */
  registerHistogram(
    name: string,
    help: string,
    labels: string[] = [],
    buckets: number[] = []
  ): void {
    this.registry.set(name, { name, help, labels });

    const bucketMap: Record<string, number> = {};
    buckets.forEach(bucket => {
      bucketMap[bucket.toString()] = 0;
    });
    bucketMap['+Inf'] = 0;

    this.histograms.set(name, {
      name,
      count: 0,
      sum: 0,
      buckets: bucketMap,
      labels: {},
      timestamp: Date.now(),
    });
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const key = this.generateKey(name, labels);
    let counter = this.counters.get(key);

    if (!counter) {
      counter = {
        name,
        value: 0,
        labels,
        timestamp: Date.now(),
      };
    }

    counter.value += value;
    counter.timestamp = Date.now();
    this.counters.set(key, counter);

    this.emit('metric_updated', { type: 'counter', name, labels, value: counter.value });
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.generateKey(name, labels);
    const gauge: GaugeMetric = {
      name,
      value,
      labels,
      timestamp: Date.now(),
    };

    this.gauges.set(key, gauge);
    this.emit('metric_updated', { type: 'gauge', name, labels, value });
  }

  /**
   * Increment a gauge
   */
  incrementGauge(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    const key = this.generateKey(name, labels);
    const existing = this.gauges.get(key);
    const newValue = (existing?.value || 0) + value;
    this.setGauge(name, newValue, labels);
  }

  /**
   * Decrement a gauge
   */
  decrementGauge(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    this.incrementGauge(name, -value, labels);
  }

  /**
   * Observe a value in a histogram
   */
  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.generateKey(name, labels);
    let histogram = this.histograms.get(key);

    if (!histogram) {
      // Initialize with default buckets if not exists
      histogram = {
        name,
        count: 0,
        sum: 0,
        buckets: { '+Inf': 0 },
        labels,
        timestamp: Date.now(),
      };
    }

    histogram.count++;
    histogram.sum += value;
    histogram.timestamp = Date.now();

    // Update buckets
    Object.keys(histogram.buckets).forEach(bucketStr => {
      const bucket = bucketStr === '+Inf' ? Infinity : parseFloat(bucketStr);
      if (value <= bucket) {
        histogram!.buckets[bucketStr]++;
      }
    });

    this.histograms.set(key, histogram);
    this.emit('metric_updated', { type: 'histogram', name, labels, value });
  }

  /**
   * Time an operation and record in histogram
   */
  async timeOperation<T>(
    histogramName: string,
    operation: () => Promise<T>,
    labels: Record<string, string> = {}
  ): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await operation();
      const duration = (performance.now() - startTime) / 1000; // Convert to seconds
      this.observeHistogram(histogramName, duration, labels);
      return result;
    } catch (error) {
      const duration = (performance.now() - startTime) / 1000;
      this.observeHistogram(histogramName, duration, { ...labels, error: 'true' });
      throw error;
    }
  }

  /**
   * Start system metrics collection
   */
  private startSystemMetricsCollection(): void {
    this.systemMetricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 10000); // Every 10 seconds
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    try {
      // Node.js process metrics
      const memUsage = process.memoryUsage();
      this.setGauge('nodejs_heap_size_used_bytes', memUsage.heapUsed);
      this.setGauge('nodejs_heap_size_total_bytes', memUsage.heapTotal);

      // System uptime
      this.setGauge('system_uptime_seconds', process.uptime());

      // CPU usage (simplified)
      const cpuUsage = process.cpuUsage();
      this.setGauge('system_cpu_usage_percent', (cpuUsage.user + cpuUsage.system) / 1000000); // Convert to seconds

      // Store metrics history
      this.storeMetricsSnapshot();
    } catch (error) {
      console.error('Failed to collect system metrics:', error);
    }
  }

  /**
   * Store metrics snapshot for trend analysis
   */
  private storeMetricsSnapshot(): void {
    const snapshot = {
      timestamp: Date.now(),
      metrics: {
        counters: Object.fromEntries(this.counters),
        gauges: Object.fromEntries(this.gauges),
        histograms: Object.fromEntries(this.histograms),
      },
    };

    this.metricsHistory.push(snapshot);

    // Trim history if too large
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Generate key for metric with labels
   */
  private generateKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    return labelStr ? `${name}{${labelStr}}` : name;
  }

  /**
   * Get current performance metrics summary
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return {
      httpRequests: {
        total: this.getCounterValue('http_requests_total'),
        duration: this.getHistogramValue('http_request_duration_seconds'),
        errors: this.getCounterValue('http_requests_total', { status: '5xx' }),
        activeConnections: this.getGaugeValue('http_active_connections'),
      },
      aiOperations: {
        total: this.getCounterValue('ai_operations_total'),
        duration: this.getHistogramValue('ai_operation_duration_seconds'),
        tokensGenerated: this.getCounterValue('ai_tokens_generated_total'),
        failures: this.getCounterValue('ai_errors_total'),
      },
      system: {
        memoryUsage: this.getGaugeValue('nodejs_heap_size_used_bytes'),
        cpuUsage: this.getGaugeValue('system_cpu_usage_percent'),
        diskUsage: 0, // Would implement with fs.stat in production
        uptime: this.getGaugeValue('system_uptime_seconds'),
      },
      business: {
        activeUsers: this.getGaugeValue('active_users_total'),
        codeGenerations: this.getCounterValue('code_generations_total'),
        analysisRequests: this.getCounterValue('file_analyses_total'),
        voiceInteractions: this.getCounterValue('voice_interactions_total'),
      },
    };
  }

  /**
   * Get counter value
   */
  private getCounterValue(name: string, labels: Record<string, string> = {}): number {
    const key = this.generateKey(name, labels);
    return this.counters.get(key)?.value || 0;
  }

  /**
   * Get gauge value
   */
  private getGaugeValue(name: string, labels: Record<string, string> = {}): number {
    const key = this.generateKey(name, labels);
    return this.gauges.get(key)?.value || 0;
  }

  /**
   * Get histogram value
   */
  private getHistogramValue(name: string, labels: Record<string, string> = {}): HistogramMetric {
    const key = this.generateKey(name, labels);
    return (
      this.histograms.get(key) || {
        name,
        count: 0,
        sum: 0,
        buckets: {},
        labels,
        timestamp: Date.now(),
      }
    );
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    let output = '';

    // Export counters
    for (const [key, counter] of this.counters) {
      const config = this.registry.get(counter.name);
      if (config) {
        output += `# HELP ${counter.name} ${config.help}\n`;
        output += `# TYPE ${counter.name} counter\n`;
        output += `${key} ${counter.value}\n\n`;
      }
    }

    // Export gauges
    for (const [key, gauge] of this.gauges) {
      const config = this.registry.get(gauge.name);
      if (config) {
        output += `# HELP ${gauge.name} ${config.help}\n`;
        output += `# TYPE ${gauge.name} gauge\n`;
        output += `${key} ${gauge.value}\n\n`;
      }
    }

    // Export histograms
    for (const [key, histogram] of this.histograms) {
      const config = this.registry.get(histogram.name);
      if (config) {
        output += `# HELP ${histogram.name} ${config.help}\n`;
        output += `# TYPE ${histogram.name} histogram\n`;

        Object.entries(histogram.buckets).forEach(([bucket, count]) => {
          output += `${histogram.name}_bucket{le="${bucket}"} ${count}\n`;
        });

        output += `${histogram.name}_sum ${histogram.sum}\n`;
        output += `${histogram.name}_count ${histogram.count}\n\n`;
      }
    }

    return output;
  }

  /**
   * Get metrics history for trend analysis
   */
  getMetricsHistory(minutes: number = 60): Array<{ timestamp: number; metrics: any }> {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.metricsHistory.filter(snapshot => snapshot.timestamp >= cutoff);
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.metricsHistory = [];
    this.initializeDefaultMetrics();
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }
  }

  /**
   * Express middleware for automatic HTTP metrics
   */
  middleware() {
    return (req: any, res: any, next: any) => {
      const startTime = performance.now();

      // Increment active connections
      this.incrementGauge('http_active_connections');

      // Override res.end to capture metrics
      const originalEnd = res.end;
      res.end = (chunk: any, encoding: any) => {
        const duration = (performance.now() - startTime) / 1000;
        const labels = {
          method: req.method,
          route: req.route?.path || req.path,
          status: this.getStatusClass(res.statusCode),
        };

        // Record metrics
        this.incrementCounter('http_requests_total', labels);
        this.observeHistogram('http_request_duration_seconds', duration, labels);
        this.decrementGauge('http_active_connections');

        originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Get status class for grouping
   */
  private getStatusClass(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) return '2xx';
    if (statusCode >= 300 && statusCode < 400) return '3xx';
    if (statusCode >= 400 && statusCode < 500) return '4xx';
    if (statusCode >= 500) return '5xx';
    return 'unknown';
  }
}
