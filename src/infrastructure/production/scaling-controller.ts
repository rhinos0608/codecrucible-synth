import { ResourceSnapshot } from './resource-types.js';

export interface ScalingConfig {
  window?: number;
  cpuScaleUpThreshold?: number;
  cpuScaleDownThreshold?: number;
  queueScaleUpThreshold?: number;
}

export interface ScalingThresholds {
  cpuScaleUp: number;
  cpuScaleDown: number;
  queueScaleUp: number;
  queueScaleDown: number;
}

const DEFAULT_THRESHOLDS: ScalingThresholds = {
  cpuScaleUp: 80,
  cpuScaleDown: 20,
  queueScaleUp: 0,
  queueScaleDown: 0,
};

export class ScalingController {
  private history: ResourceSnapshot[] = [];
  private readonly window: number;
  private readonly thresholds: ScalingThresholds;

  constructor(config: ScalingConfig = {}) {
    this.window = config.window ?? 60; // keep last 60 seconds
    this.thresholds = {
      cpuScaleUp: config.cpuScaleUpThreshold ?? DEFAULT_THRESHOLDS.cpuScaleUp,
      cpuScaleDown: config.cpuScaleDownThreshold ?? DEFAULT_THRESHOLDS.cpuScaleDown,
      queueScaleUp: config.queueScaleUpThreshold ?? DEFAULT_THRESHOLDS.queueScaleUp,
      queueScaleDown: DEFAULT_THRESHOLDS.queueScaleDown,
    };
  }

  record(snapshot: ResourceSnapshot): void {
    this.history.push(snapshot);
    if (this.history.length > this.window) {
      this.history.shift();
    }
  }

  /**

   * Analyzes recent resource snapshots to determine a scaling action.
   *
   * Scales up when average CPU usage or queue length exceeds configured
   * thresholds. Scales down only when CPU usage falls below the down threshold
   * and the queue is empty.

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

    // Scale up if CPU or queue thresholds exceeded
    if (cpuAvg > this.thresholds.cpuScaleUp || queueAvg > this.thresholds.queueScaleUp) {
      return 'scale_up';
    }

    // Scale down if CPU and queue are below thresholds
    if (cpuAvg < this.thresholds.cpuScaleDown && queueAvg <= this.thresholds.queueScaleDown) {
      return 'scale_down';
    }

    // Otherwise remain stable
    return 'stable';
  }
}
