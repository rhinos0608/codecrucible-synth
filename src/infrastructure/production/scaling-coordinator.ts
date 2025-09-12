export type ScaleAction = 'none' | 'scale_up' | 'scale_down';

export interface ScalingDecision {
  action: ScaleAction;
  reason: string;
  target?: number;
}

export type ScalingExecutor = (action: ScaleAction, target?: number) => Promise<boolean>;

/**
 * Simple scaling coordinator that evaluates CPU and queue depth to decide scaling actions.
 */
export class ScalingCoordinator {
  private minInstances = 1;
  private maxInstances = 10;
  private currentInstances = 1;

  configure(bounds: { min?: number; max?: number; current?: number }): void {
    if (typeof bounds.min === 'number') this.minInstances = Math.max(1, bounds.min);
    if (typeof bounds.max === 'number') this.maxInstances = Math.max(this.minInstances, bounds.max);
    if (typeof bounds.current === 'number') this.currentInstances = Math.min(this.maxInstances, Math.max(this.minInstances, bounds.current));
  }

  evaluate(metrics: { cpuLoad1: number; queueDepth: number }): ScalingDecision {
    const { cpuLoad1, queueDepth } = metrics;
    // Simple heuristic: scale up if 1-min load > instances or queue backlog grows
    if ((cpuLoad1 > this.currentInstances && this.currentInstances < this.maxInstances) || queueDepth > this.currentInstances * 5) {
      const target = Math.min(this.maxInstances, this.currentInstances + 1);
      return { action: 'scale_up', reason: 'High CPU load or queue backlog', target };
    }
    // Scale down if underutilized and no backlog
    if (cpuLoad1 < Math.max(0.5, this.currentInstances * 0.5) && queueDepth === 0 && this.currentInstances > this.minInstances) {
      const target = Math.max(this.minInstances, this.currentInstances - 1);
      return { action: 'scale_down', reason: 'Low CPU load and idle queue', target };
    }
    return { action: 'none', reason: 'Within thresholds' };
  }

  async enact(decision: ScalingDecision, executor: ScalingExecutor): Promise<boolean> {
    if (decision.action === 'none') return true;
    const ok = await executor(decision.action, decision.target);
    if (ok) {
      if (decision.target !== undefined) this.currentInstances = decision.target;
    }
    return ok;
  }
}
