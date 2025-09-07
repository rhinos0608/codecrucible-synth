import { ResourceSnapshot } from './resource-types.js';

/**
 * CostAnalyzer
 *
 * Tracks approximate cost of resource consumption based on simple pricing
 * models. The intent is to provide visibility rather than exact billing
 * figures.
 */
export class CostAnalyzer {
  private totalCost = 0;
  private readonly memoryRate = 0.0001; // cost per MB-second
  private readonly cpuRate = 0.001; // cost per CPU% per second

  record(snapshot: ResourceSnapshot): void {
    const memMB = snapshot.memory.heapUsed / (1024 * 1024);
    this.totalCost += memMB * this.memoryRate;
    this.totalCost += snapshot.cpu.usagePercent * this.cpuRate;
  }

  getTotalCost(): number {
    return this.totalCost;
  }
}
