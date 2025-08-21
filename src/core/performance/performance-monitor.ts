/**
 * Enterprise Performance Monitoring System
 * Implements real-time performance tracking with APM-style metrics
 */

import { EventEmitter } from 'events';
import { performance, PerformanceObserver } from 'perf_hooks';
import { logger } from '../logger.js';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percent' | 'ops/sec';
  timestamp: number;
  tags: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  unit: string;
  action?: 'log' | 'alert' | 'throttle' | 'circuit-break';
}

export interface PerformanceConfig {
  enableRealTimeMonitoring: boolean;
  enableWebVitals: boolean;
  enableResourceTiming: boolean;
  enableMemoryMonitoring: boolean;
  enableEventLoopMonitoring: boolean;
  sampleRate: number;
  aggregationWindow: number;
  retentionPeriod: number;
  thresholds: PerformanceThreshold[];
}

export interface TransactionTrace {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'active' | 'completed' | 'failed';
  spans: Span[];
  metadata: Record<string, any>;
  error?: Error;
}

export interface Span {
  id: string;
  parentId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, string>;
  logs: Array<{ timestamp: number; message: string; level: string }>;
}

export interface PerformanceSnapshot {
  timestamp: number;
  metrics: {
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    memory: {
      used: number;
      total: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    };
    eventLoop: {
      delay: number;
      utilization: number;
    };
    gc: {
      collections: number;
      totalTime: number;
      averageTime: number;
    };
    http: {
      activeConnections: number;
      requestsPerSecond: number;
      averageResponseTime: number;
      errorRate: number;
    };
    custom: Record<string, number>;
  };
}

export class PerformanceMonitor extends EventEmitter {
  private config: PerformanceConfig;
  private metrics = new Map<string, PerformanceMetric[]>();
  private transactions = new Map<string, TransactionTrace>();
  private thresholds = new Map<string, PerformanceThreshold>();

  private performanceObserver?: PerformanceObserver;
  private monitoringInterval?: NodeJS.Timeout;
  private snapshotInterval?: NodeJS.Timeout;

  private startTime = Date.now();
  private lastSnapshot?: PerformanceSnapshot;
  private gcStats = { collections: 0, totalTime: 0 };

  constructor(config: Partial<PerformanceConfig> = {}) {
    super();

    this.config = {
      enableRealTimeMonitoring: true,
      enableWebVitals: true,
      enableResourceTiming: true,
      enableMemoryMonitoring: true,
      enableEventLoopMonitoring: true,
      sampleRate: 1.0,
      aggregationWindow: 60000, // 1 minute
      retentionPeriod: 3600000, // 1 hour
      thresholds: [
        { metric: 'http_response_time', warning: 1000, critical: 5000, unit: 'ms', action: 'log' },
        { metric: 'memory_usage', warning: 80, critical: 95, unit: 'percent', action: 'alert' },
        { metric: 'cpu_usage', warning: 70, critical: 90, unit: 'percent', action: 'alert' },
        { metric: 'event_loop_delay', warning: 10, critical: 50, unit: 'ms', action: 'alert' },
        {
          metric: 'error_rate',
          warning: 5,
          critical: 10,
          unit: 'percent',
          action: 'circuit-break',
        },
      ],
      ...config,
    };

    // Register thresholds
    this.config.thresholds.forEach(threshold => {
      this.thresholds.set(threshold.metric, threshold);
    });

    this.initialize();
  }

  /**
   * Initialize performance monitoring
   */
  private initialize(): void {
    if (this.config.enableRealTimeMonitoring) {
      this.startRealTimeMonitoring();
    }

    if (this.config.enableResourceTiming) {
      this.startResourceTimingObserver();
    }

    if (this.config.enableMemoryMonitoring) {
      this.startMemoryMonitoring();
    }

    if (this.config.enableEventLoopMonitoring) {
      this.startEventLoopMonitoring();
    }

    // Start periodic snapshots
    this.startSnapshotCollection();

    logger.info('Performance monitor initialized', {
      realTimeMonitoring: this.config.enableRealTimeMonitoring,
      webVitals: this.config.enableWebVitals,
      resourceTiming: this.config.enableResourceTiming,
      sampleRate: this.config.sampleRate,
    });
  }

  /**
   * Start a new transaction trace
   */
  startTransaction(name: string, metadata: Record<string, any> = {}): string {
    const id = this.generateId();
    const transaction: TransactionTrace = {
      id,
      name,
      startTime: Date.now(),
      status: 'active',
      spans: [],
      metadata,
    };

    this.transactions.set(id, transaction);

    logger.debug('Transaction started', { id, name });
    this.emit('transaction-start', transaction);

    return id;
  }

  /**
   * End a transaction trace
   */
  endTransaction(id: string, error?: Error): void {
    const transaction = this.transactions.get(id);
    if (!transaction) return;

    transaction.endTime = Date.now();
    transaction.duration = transaction.endTime - transaction.startTime;
    transaction.status = error ? 'failed' : 'completed';

    if (error) {
      transaction.error = error;
    }

    // Record metric
    this.recordMetric('transaction_duration', transaction.duration, 'ms', {
      transaction: transaction.name,
      status: transaction.status,
    });

    // Check thresholds
    this.checkThreshold('transaction_duration', transaction.duration);

    logger.debug('Transaction ended', {
      id,
      name: transaction.name,
      duration: transaction.duration,
      status: transaction.status,
    });

    this.emit('transaction-end', transaction);

    // Clean up
    setTimeout(() => {
      this.transactions.delete(id);
    }, this.config.retentionPeriod);
  }

  /**
   * Start a span within a transaction
   */
  startSpan(transactionId: string, name: string, parentSpanId?: string): string {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const spanId = this.generateId();
    const span: Span = {
      id: spanId,
      parentId: parentSpanId,
      name,
      startTime: Date.now(),
      tags: {},
      logs: [],
    };

    transaction.spans.push(span);

    logger.debug('Span started', { transactionId, spanId, name });
    this.emit('span-start', { transaction, span });

    return spanId;
  }

  /**
   * End a span
   */
  endSpan(transactionId: string, spanId: string, tags: Record<string, string> = {}): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return;

    const span = transaction.spans.find(s => s.id === spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.tags = { ...span.tags, ...tags };

    // Record span metric
    this.recordMetric('span_duration', span.duration, 'ms', {
      transaction: transaction.name,
      span: span.name,
      ...tags,
    });

    logger.debug('Span ended', {
      transactionId,
      spanId,
      name: span.name,
      duration: span.duration,
    });

    this.emit('span-end', { transaction, span });
  }

  /**
   * Add log to span
   */
  addSpanLog(transactionId: string, spanId: string, message: string, level: string = 'info'): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return;

    const span = transaction.spans.find(s => s.id === spanId);
    if (!span) return;

    span.logs.push({
      timestamp: Date.now(),
      message,
      level,
    });
  }

  /**
   * Record a custom metric
   */
  recordMetric(
    name: string,
    value: number,
    unit: PerformanceMetric['unit'],
    tags: Record<string, string> = {},
    metadata?: Record<string, any>
  ): void {
    // Apply sampling
    if (Math.random() > this.config.sampleRate) {
      return;
    }

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags,
      metadata,
    };

    // Store metric
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricHistory = this.metrics.get(name)!;
    metricHistory.push(metric);

    // Trim old metrics
    const cutoff = Date.now() - this.config.retentionPeriod;
    const filtered = metricHistory.filter(m => m.timestamp > cutoff);
    this.metrics.set(name, filtered);

    // Check thresholds
    this.checkThreshold(name, value);

    // Emit event
    this.emit('metric-recorded', metric);
  }

  /**
   * Get metric statistics
   */
  getMetricStats(
    name: string,
    timeWindow?: number
  ): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const window = timeWindow || this.config.aggregationWindow;
    const cutoff = Date.now() - window;
    const filteredMetrics = metrics.filter(m => m.timestamp > cutoff);

    if (filteredMetrics.length === 0) {
      return null;
    }

    const values = filteredMetrics.map(m => m.value).sort((a, b) => a - b);
    const count = values.length;

    return {
      count,
      min: values[0],
      max: values[count - 1],
      avg: values.reduce((sum, val) => sum + val, 0) / count,
      p50: this.percentile(values, 50),
      p95: this.percentile(values, 95),
      p99: this.percentile(values, 99),
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  /**
   * Check metric against thresholds
   */
  private checkThreshold(metricName: string, value: number): void {
    const threshold = this.thresholds.get(metricName);
    if (!threshold) return;

    if (value >= threshold.critical) {
      logger.error('Performance threshold critical exceeded', {
        metric: metricName,
        value,
        threshold: threshold.critical,
        unit: threshold.unit,
      });

      this.emit('threshold-critical', { metric: metricName, value, threshold });
      this.executeThresholdAction(threshold, 'critical', value);
    } else if (value >= threshold.warning) {
      logger.warn('Performance threshold warning exceeded', {
        metric: metricName,
        value,
        threshold: threshold.warning,
        unit: threshold.unit,
      });

      this.emit('threshold-warning', { metric: metricName, value, threshold });
      this.executeThresholdAction(threshold, 'warning', value);
    }
  }

  /**
   * Execute threshold action
   */
  private executeThresholdAction(
    threshold: PerformanceThreshold,
    level: 'warning' | 'critical',
    value: number
  ): void {
    switch (threshold.action) {
      case 'alert':
        this.emit('performance-alert', { threshold, level, value });
        break;

      case 'throttle':
        this.emit('performance-throttle', { threshold, level, value });
        break;

      case 'circuit-break':
        this.emit('performance-circuit-break', { threshold, level, value });
        break;

      case 'log':
      default:
        // Already logged above
        break;
    }
  }

  /**
   * Start real-time monitoring
   */
  private startRealTimeMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectRealTimeMetrics();
    }, 5000); // Every 5 seconds
  }

  /**
   * Start resource timing observer
   */
  private startResourceTimingObserver(): void {
    this.performanceObserver = new PerformanceObserver(list => {
      const entries = list.getEntries();

      for (const entry of entries) {
        if (entry.entryType === 'measure') {
          this.recordMetric(`custom_${entry.name}`, entry.duration, 'ms', { type: 'measure' });
        } else if ((entry as any).entryType === 'navigation') {
          const navEntry = entry as any; // PerformanceNavigationTiming
          this.recordMetric('page_load_time', navEntry.loadEventEnd - navEntry.fetchStart, 'ms');
          this.recordMetric(
            'dns_lookup_time',
            navEntry.domainLookupEnd - navEntry.domainLookupStart,
            'ms'
          );
          this.recordMetric('tcp_connect_time', navEntry.connectEnd - navEntry.connectStart, 'ms');
        }
      }
    });

    this.performanceObserver.observe({ entryTypes: ['measure', 'resource'] as any });
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    setInterval(() => {
      const memUsage = process.memoryUsage();

      this.recordMetric('memory_heap_used', memUsage.heapUsed, 'bytes');
      this.recordMetric('memory_heap_total', memUsage.heapTotal, 'bytes');
      this.recordMetric('memory_rss', memUsage.rss, 'bytes');
      this.recordMetric('memory_external', memUsage.external, 'bytes');

      // Calculate memory usage percentage
      const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      this.recordMetric('memory_usage_percent', usagePercent, 'percent');
    }, 10000); // Every 10 seconds
  }

  /**
   * Start event loop monitoring
   */
  private startEventLoopMonitoring(): void {
    setInterval(() => {
      const start = process.hrtime.bigint();

      setImmediate(() => {
        const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        this.recordMetric('event_loop_delay', delay, 'ms');
      });
    }, 5000); // Every 5 seconds
  }

  /**
   * Start periodic snapshot collection
   */
  private startSnapshotCollection(): void {
    this.snapshotInterval = setInterval(() => {
      const snapshot = this.createPerformanceSnapshot();
      this.lastSnapshot = snapshot;
      this.emit('performance-snapshot', snapshot);
    }, 30000); // Every 30 seconds
  }

  /**
   * Collect real-time metrics
   */
  private collectRealTimeMetrics(): void {
    // CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000; // Convert to milliseconds
    this.recordMetric('cpu_usage_ms', cpuPercent, 'ms');

    // Process uptime
    this.recordMetric('process_uptime', process.uptime(), 'count');

    // Active handles and requests
    const handles = (process as any)._getActiveHandles();
    const requests = (process as any)._getActiveRequests();
    this.recordMetric('active_handles', handles.length, 'count');
    this.recordMetric('active_requests', requests.length, 'count');
  }

  /**
   * Create performance snapshot
   */
  private createPerformanceSnapshot(): PerformanceSnapshot {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      timestamp: Date.now(),
      metrics: {
        cpu: {
          usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
          loadAverage: [],
        },
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          rss: memUsage.rss,
        },
        eventLoop: {
          delay: 0, // Would need to measure
          utilization: 0,
        },
        gc: {
          collections: this.gcStats.collections,
          totalTime: this.gcStats.totalTime,
          averageTime:
            this.gcStats.collections > 0 ? this.gcStats.totalTime / this.gcStats.collections : 0,
        },
        http: {
          activeConnections: 0, // Would track in HTTP middleware
          requestsPerSecond: 0,
          averageResponseTime: 0,
          errorRate: 0,
        },
        custom: {},
      },
    };
  }

  /**
   * Time a function execution
   */
  async timeFunction<T>(
    name: string,
    fn: () => Promise<T>,
    tags: Record<string, string> = {}
  ): Promise<T> {
    const start = performance.now();

    try {
      const result = await fn();
      const duration = performance.now() - start;

      this.recordMetric(`function_${name}_duration`, duration, 'ms', {
        ...tags,
        status: 'success',
      });

      return result;
    } catch (error) {
      const duration = performance.now() - start;

      this.recordMetric(`function_${name}_duration`, duration, 'ms', {
        ...tags,
        status: 'error',
      });

      throw error;
    }
  }

  /**
   * Create Express middleware for HTTP monitoring
   */
  httpMiddleware() {
    return (req: any, res: any, next: any) => {
      const start = performance.now();
      const transactionId = this.startTransaction(`${req.method} ${req.route?.path || req.path}`, {
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      // Track active requests
      this.recordMetric('http_active_requests', 1, 'count', { method: req.method });

      // Override res.end to capture completion
      const originalEnd = res.end;
      res.end = (chunk: any, encoding: any) => {
        const duration = performance.now() - start;

        // Record HTTP metrics
        this.recordMetric('http_request_duration', duration, 'ms', {
          method: req.method,
          status: res.statusCode.toString(),
          route: req.route?.path || req.path,
        });

        this.recordMetric('http_active_requests', -1, 'count', { method: req.method });

        // End transaction
        this.endTransaction(
          transactionId,
          res.statusCode >= 400 ? new Error(`HTTP ${res.statusCode}`) : undefined
        );

        originalEnd.call(this, chunk, encoding);
      };

      // Attach transaction ID to request
      req.transactionId = transactionId;
      req.performanceMonitor = this;

      next();
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, PerformanceMetric[]> {
    return Object.fromEntries(this.metrics);
  }

  /**
   * Get active transactions
   */
  getActiveTransactions(): TransactionTrace[] {
    return Array.from(this.transactions.values()).filter(t => t.status === 'active');
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    uptime: number;
    totalTransactions: number;
    activeTransactions: number;
    totalMetrics: number;
    lastSnapshot?: PerformanceSnapshot;
    topMetrics: Array<{ name: string; stats: any }>;
  } {
    const topMetrics = Array.from(this.metrics.keys())
      .slice(0, 10)
      .map(name => ({ name, stats: this.getMetricStats(name) }))
      .filter(m => m.stats !== null);

    return {
      uptime: Date.now() - this.startTime,
      totalTransactions: this.transactions.size,
      activeTransactions: this.getActiveTransactions().length,
      totalMetrics: Array.from(this.metrics.values()).reduce(
        (sum, metrics) => sum + metrics.length,
        0
      ),
      lastSnapshot: this.lastSnapshot,
      topMetrics,
    };
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
    }

    this.metrics.clear();
    this.transactions.clear();

    logger.info('Performance monitor stopped');
    this.emit('monitor-stop');
  }
}
