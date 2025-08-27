/**
 * Legacy Performance Utils - Compatibility Stub
 * 
 * This is a minimal stub to maintain backward compatibility
 * during the architectural migration.
 * 
 * @deprecated Use UnifiedPerformanceSystem from domain/services instead
 */

export class PerformanceMonitor {
  private measurements = new Map<string, number>();

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
}