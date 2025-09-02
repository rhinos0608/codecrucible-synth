export { ObservabilityCoordinator as ObservabilitySystem } from './observability-coordinator.js';
export * from './observability-coordinator.js';

// Default telemetry provider implementation
export function getTelemetryProvider() {
  return {
    recordMetric: (name: string, value: number, tags?: Record<string, any>, unit?: string) => {
      // Basic telemetry recording - can be enhanced with actual telemetry backend
      console.debug(`[Telemetry] ${name}: ${value} ${unit || ''} ${JSON.stringify(tags || {})}`);
    },
  };
}
