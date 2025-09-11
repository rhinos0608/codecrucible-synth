import type { IUnifiedMetrics, MetricTags } from '../../domain/interfaces/metrics.js';
import { MetricsCollector } from './metrics-collector.js';

/**
 * Adapter that maps IUnifiedMetrics calls to the repository MetricsCollector.
 */
export class UnifiedMetricsAdapter implements IUnifiedMetrics {
  constructor(private readonly collector: MetricsCollector) {}

  counter(name: string, value: number = 1, tags: MetricTags = {}): void {
    this.collector.record({
      name,
      value,
      timestamp: new Date(),
      tags,
      unit: 'count',
      type: 'counter',
    });
  }

  gauge(name: string, value: number, tags: MetricTags = {}): void {
    this.collector.record({
      name,
      value,
      timestamp: new Date(),
      tags,
      unit: 'value',
      type: 'gauge',
    });
  }

  histogram(name: string, value: number, tags: MetricTags = {}): void {
    this.collector.record({
      name,
      value,
      timestamp: new Date(),
      tags,
      unit: 'seconds',
      type: 'histogram',
    });
  }

  startTimer(name: string, tags: MetricTags = {}): () => void {
    const start = Date.now();
    return () => {
      const durationSec = (Date.now() - start) / 1000;
      this.histogram(name, durationSec, tags);
    };
  }
}

export function createUnifiedMetrics(collector?: MetricsCollector): UnifiedMetricsAdapter {
  const c =
    collector ??
    new MetricsCollector({ enabled: true, retentionDays: 7, exportInterval: 0, exporters: [] });
  return new UnifiedMetricsAdapter(c);
}
