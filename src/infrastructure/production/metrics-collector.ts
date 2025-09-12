import os from 'os';
import { createLogger } from '../logging/logger-adapter.js';
import type { ILogger } from '../../domain/interfaces/logger.js';
import { getGlobalObservability } from '../observability/observability-coordinator.js';
import {
  MetricsCollector as CoreMetricsCollector,
  type MetricsConfig,
  type MetricPoint,
} from '../observability/metrics-collector.js';

/**
 * Production MetricsCollector
 *
 * Bridges environment/process metrics into the shared observability pipeline.
 * If an ObservabilityCoordinator is active, it uses its collector; otherwise it
 * bootstraps a local CoreMetricsCollector with safe defaults.
 */
export class MetricsCollector {
  private readonly logger: ILogger = createLogger('ProdMetricsCollector');
  private core: CoreMetricsCollector;

  public constructor(config?: Partial<MetricsConfig>) {
    const global = getGlobalObservability();
    if (global) {
      this.core = global.getMetricsCollector();
    } else {
      const localConfig: MetricsConfig = {
        enabled: true,
        retentionDays: 7,
        exportInterval: 0,
        exporters: [],
        ...config,
      } as MetricsConfig;
      this.core = new CoreMetricsCollector(localConfig);
      this.core.initialize();
    }
  }

  /**
   * Collect a single snapshot of system/process metrics.
   */
  public async collect(): Promise<void> {
    try {
      const now = new Date();
      const tags = { env: (process.env.NODE_ENV || 'development').toString() };

      // CPU and load
      const load = this.safe(() => os.loadavg?.()[0] ?? 0, 0);
      const cpus = this.safe(() => os.cpus?.().length ?? 0, 0);

      // Memory
      const total = this.safe(() => os.totalmem?.() ?? 0, 0);
      const free = this.safe(() => os.freemem?.() ?? 0, 0);
      const used = Math.max(0, total - free);

      // Uptime
      const uptime = this.safe(() => os.uptime?.() ?? 0, 0);

      // Event loop delay approximation (cheap)
      const loopDelay = await this.measureEventLoopDelay(10); // ms

      const points: MetricPoint[] = [
        { name: 'system.load.1', value: load, timestamp: now, tags, unit: 'load', type: 'gauge' },
        { name: 'system.cpu.count', value: cpus, timestamp: now, tags, unit: 'count', type: 'gauge' },
        { name: 'system.memory.total', value: total, timestamp: now, tags, unit: 'bytes', type: 'gauge' },
        { name: 'system.memory.used', value: used, timestamp: now, tags, unit: 'bytes', type: 'gauge' },
        { name: 'system.memory.free', value: free, timestamp: now, tags, unit: 'bytes', type: 'gauge' },
        { name: 'process.uptime.seconds', value: uptime, timestamp: now, tags, unit: 's', type: 'gauge' },
        { name: 'process.event_loop.delay_ms', value: loopDelay, timestamp: now, tags, unit: 'ms', type: 'gauge' },
      ];

      for (const p of points) this.core.record(p);
    } catch (err) {
      this.logger.warn('Metrics collection failed', { err: (err as any)?.message });
    }
  }

  private async measureEventLoopDelay(sampleMs: number): Promise<number> {
    return new Promise(resolve => {
      const start = Date.now();
      setTimeout(() => resolve(Date.now() - start - sampleMs), sampleMs);
    });
  }

  private safe<T>(fn: () => T, fallback: T): T {
    try {
      return fn();
    } catch {
      return fallback;
    }
  }
}
