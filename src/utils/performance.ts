/**
 * Legacy Performance Utils - Compatibility Stub
 * 
 * This is a minimal stub to maintain backward compatibility
 * during the architectural migration.
 * 
 * @deprecated Use UnifiedPerformanceSystem from domain/services instead
 */

import { EventEmitter } from 'events';

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

  getMetrics(): any {
    return {
      activeMeasurements: this.measurements.size
    };
  }

  getProviderMetrics(): Record<string, { averageLatency: number; successRate: number }> {
    // Create mock provider metrics for compatibility
    return {
      ollama: { averageLatency: 150, successRate: 0.95 },
      lmstudio: { averageLatency: 100, successRate: 0.98 },
      huggingface: { averageLatency: 300, successRate: 0.90 }
    };
  }

  getSummary(): any {
    return {
      activeMeasurements: this.measurements.size,
      measurementCount: this.measurements.size
    };
  }
}