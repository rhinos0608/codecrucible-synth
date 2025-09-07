import { ResourceSnapshot } from './resource-types.js';

export interface ScalingConfig {
  window?: number;
  cpuScaleUpThreshold?: number;
  cpuScaleDownThreshold?: number;
  queueScaleUpThreshold?: number;
}

export class ScalingController {
  private history: ResourceSnapshot[] = [];
  private readonly window: number;
  private readonly cpuScaleUpThreshold: number;
  private readonly cpuScaleDownThreshold: number;
  private readonly queueScaleUpThreshold: number;

  constructor(config: ScalingConfig = {}) {
    this.window = config.window ?? 60; // keep last 60 seconds
    this.cpuScaleUpThreshold = config.cpuScaleUpThreshold ?? 80;
    this.cpuScaleDownThreshold = config.cpuScaleDownThreshold ?? 20;
    this.queueScaleUpThreshold = config.queueScaleUpThreshold ?? 0;
  }

  record(snapshot: ResourceSnapshot): void {
    this.history.push(snapshot);
    if (this.history.length > this.window) {
      this.history.shift();
    }
  }

  /**
   * Evaluates recent resource snapshots to determine scaling actions.
   *
   * @returns 'scale_up' when CPU usage or queue size exceed configured thresholds,
   * 'scale_down' when CPU usage is below the scale-down threshold and the queue is empty,
   * otherwise 'stable'.
   */
  evaluate(): 'scale_up' | 'scale_down' | 'stable' {
    if (this.history.length === 0) return 'stable';

    const cpuAvg =
      this.history.reduce((sum, s) => sum + s.cpu.usagePercent, 0) / this.history.length;
    const queueAvg =
      this.history.reduce((sum, s) => sum + s.concurrency.queuedOperations, 0) /
      this.history.length;

    if (cpuAvg > this.cpuScaleUpThreshold || queueAvg > this.queueScaleUpThreshold) {
      return 'scale_up';
    }
    if (cpuAvg < this.cpuScaleDownThreshold && queueAvg === 0) {
      return 'scale_down';
    }
    return 'stable';
  }
}
