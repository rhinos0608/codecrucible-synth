import { ResourceSnapshot } from './resource-types.js';

interface GlobalWithGC {
  gc?: () => void;
  [key: string]: unknown;
}

declare const global: GlobalWithGC;

export class PerformanceOptimizer {
  private lastOptimization = 0;

  /**
   * analyze
   *
   * Examines the current snapshot and performs lightweight optimizations such
   * as triggering GC when memory pressure is high. Expensive optimizations are
   * avoided to keep runtime overhead minimal.
   */
  public analyze(snapshot: Readonly<ResourceSnapshot>): void {
    if (
      snapshot.memory.utilizationPercent > 90 &&
      typeof global.gc === 'function' &&
      Date.now() - this.lastOptimization > 60_000
    ) {
      try {
        global.gc?.();
        this.lastOptimization = Date.now();
      } catch {
        // ignore gc errors
      }
    }
  }
}
