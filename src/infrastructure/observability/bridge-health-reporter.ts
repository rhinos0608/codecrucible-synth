import type { MetricsCollector } from './metrics-collector.js';
import type { IRustExecutionBridge } from '../execution/rust-executor/bridge-adapter.js';

export interface BridgeHealthReporterOptions {
  intervalMs?: number;
  service?: string;
}

function mapStatusToValue(status: string): number {
  switch (status) {
    case 'healthy':
      return 1;
    case 'degraded':
      return 0.5;
    default:
      return 0;
  }
}

export function startBridgeHealthReporter(
  metrics: MetricsCollector,
  bridge: IRustExecutionBridge,
  opts: BridgeHealthReporterOptions = {}
): () => void {
  const interval = opts.intervalMs ?? 30000;
  const service = opts.service ?? 'rust_bridge';

  const tick = () => {
    try {
      const health = bridge.getHealth();
      const value = mapStatusToValue(health.status);
      metrics.record({
        name: 'crucible_bridge_health',
        value,
        timestamp: new Date(),
        tags: { service },
        unit: 'status',
        type: 'gauge',
      });
      metrics.record({
        name: 'crucible_bridge_response_time_ms',
        value: health.responseTime ?? 0,
        timestamp: new Date(),
        tags: { service },
        unit: 'ms',
        type: 'gauge',
      });
      metrics.record({
        name: 'crucible_bridge_errors_total',
        value: health.errorCount ?? 0,
        timestamp: new Date(),
        tags: { service },
        unit: 'count',
        type: 'counter',
      });
    } catch {
      // ignore
    }
  };

  // immediate heartbeat
  tick();
  const handle = setInterval(tick, interval);
  return () => clearInterval(handle);
}

export default startBridgeHealthReporter;

