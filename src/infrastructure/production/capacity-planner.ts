import { ResourceSnapshot } from './resource-types.js';

export interface CapacityForecast {
  memoryMB: number;
  cpuPercent: number;
  concurrency: number;
}

export class CapacityPlanner {
  private history: ResourceSnapshot[] = [];
  private readonly window = 300; // keep last 5 minutes of data

  record(snapshot: ResourceSnapshot): void {
    this.history.push(snapshot);
    if (this.history.length > this.window) {
      this.history.shift();
    }
  }

  forecast(): CapacityForecast {
    if (this.history.length === 0) {
      return { memoryMB: 0, cpuPercent: 0, concurrency: 0 };
    }

    const memoryPeak = Math.max(...this.history.map(s => s.memory.heapUsed));
    const cpuPeak = Math.max(...this.history.map(s => s.cpu.usagePercent));
    const concPeak = Math.max(...this.history.map(s => s.concurrency.activeOperations));

    return {
      memoryMB: (memoryPeak / (1024 * 1024)) * 1.2,
      cpuPercent: cpuPeak * 1.2,
      concurrency: concPeak * 1.2,
    };
  }
}
