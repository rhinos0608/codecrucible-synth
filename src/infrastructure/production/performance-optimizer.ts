import { ResourceSnapshot } from './resource-types.js';

export class PerformanceOptimizer {
  private lastOptimization = 0;

  /**
   * analyze
   *
   * Examines the current snapshot and performs lightweight optimizations such
   * as triggering GC when memory pressure is high. Expensive optimizations are
   * avoided to keep runtime overhead minimal.
   */
  analyze(snapshot: ResourceSnapshot): void {
    if (
      snapshot.memory.utilizationPercent > 90 &&
      typeof (global as any).gc === 'function' &&
      Date.now() - this.lastOptimization > 60_000
    ) {
      try {
        (global as any).gc();
        this.lastOptimization = Date.now();
      } catch {
        // ignore gc errors
      }
    }
  }
}
