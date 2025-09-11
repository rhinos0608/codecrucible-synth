import { ResourceSnapshot } from './resource-types.js';

export class HealthChecker {
  private readonly recent: ResourceSnapshot[] = [];
  private readonly window = 5;

  public evaluate(snapshot: Readonly<ResourceSnapshot>): string[] {
    this.recent.push(snapshot);
    if (this.recent.length > this.window) {
      this.recent.shift();
    }

    const issues: string[] = [];

    if (snapshot.memory.utilizationPercent > 95) {
      issues.push('Memory utilization critical');
    }
    if (snapshot.cpu.usagePercent > 95) {
      issues.push('CPU usage critical');
    }
    if (snapshot.network.connectionErrors > 0) {
      issues.push('Network errors detected');
    }
    if (this.recent.length === this.window) {
      const start = this.recent[0].memory.heapUsed;
      const end = this.recent[this.recent.length - 1].memory.heapUsed;
      if (end > start * 1.2) {
        issues.push('Possible memory leak detected');
      }
    }

    return issues;
  }
}
