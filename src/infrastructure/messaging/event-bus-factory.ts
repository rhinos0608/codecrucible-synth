/**
 * Event Bus Factory
 * Centralizes creation/config of the OptimizedEventBus with optional profiling.
 */

import { OptimizedEventBus, type EventBusConfig } from './optimized-event-bus.js';
import { createLogger } from '../logging/logger-adapter.js';
import { PerformanceProfiler, createPerformanceProfiler } from '../performance/profiler.js';
import { MetricsCollector } from '../observability/metrics-collector.js';

export interface EventBusFactoryOptions {
  enableProfiling?: boolean;
  eventBusConfig?: Partial<EventBusConfig>;
  metrics?: MetricsCollector; // optional existing collector
}

/**
 * Create an OptimizedEventBus wired to a PerformanceProfiler and MetricsCollector.
 */
export function createEventBus(options: Readonly<EventBusFactoryOptions> = {}): OptimizedEventBus {
  const logger = createLogger('EventBusFactory');

  const enableProfiling = options.enableProfiling ?? true;

  const metrics =
    options.metrics ??
    new MetricsCollector({
      enabled: true,
      retentionDays: 7,
      exportInterval: 0,
      exporters: [],
    });

  // Create a profiler only if profiling is enabled
  const profiler: PerformanceProfiler | undefined = enableProfiling
    ? createPerformanceProfiler(metrics, undefined, {
        enableDetailedLogging: false,
      })
    : undefined;

  const bus = new OptimizedEventBus(profiler, options.eventBusConfig);
  logger.info('Created OptimizedEventBus via factory', {
    profiling: !!profiler,
  });
  return bus;
}

export default createEventBus;

