/**
 * Legacy Performance Utils - Compatibility Stub
 *
 * This is a minimal stub to maintain backward compatibility
 * during the architectural migration.
 *
 * @deprecated Use UnifiedPerformanceSystem from domain/services instead
 */

import { EventEmitter } from 'events';

export interface IPerformanceMetrics {
  activeMeasurements: number;
}

export interface IProviderMetric {
  averageLatency: number;
  successRate: number;
}

export type ProviderMetrics = Record<string, IProviderMetric>;

export interface IPerformanceSummary {
  activeMeasurements: number;
  measurementCount: number;
}

export class PerformanceMonitor extends EventEmitter {
  private measurements = new Map<string, number>();

  constructor() {
    super();
  }

  startMeasurement(name: string): string {
    const id = `${name}_${Date.now()}`;
    this.measurements.set(id, performance.now());
    return id;
  }

  endMeasurement(id: string): number {
    const startTime = this.measurements.get(id);
    if (!startTime) return 0;

    const duration = performance.now() - startTime;
    this.measurements.delete(id);
    return duration;
  }

  getMetrics(): IPerformanceMetrics {
    return {
      activeMeasurements: this.measurements.size,
    };
  }

  getProviderMetrics(): ProviderMetrics {
    // Create mock provider metrics for compatibility
    return {
      ollama: { averageLatency: 150, successRate: 0.95 },
      lmstudio: { averageLatency: 100, successRate: 0.98 },
      huggingface: { averageLatency: 300, successRate: 0.9 },
    };
  }

  getSummary(): IPerformanceSummary {
    return {
      activeMeasurements: this.measurements.size,
      measurementCount: this.measurements.size,
    };
  }
}
