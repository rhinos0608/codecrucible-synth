/**
 * ResourceAllocator tracks system usage and assigns resources to workflow tasks.
 */
import * as os from 'os';

export class ResourceAllocator {
  private allocations: Map<string, { type: string; amount: number }[]> = new Map();
  private cpuCapacity: number;
  private cpuUsed: number = 0;
  private memoryCapacityMB: number;
  private memoryUsedMB: number = 0;

  public constructor() {
    const cpus = os.cpus()?.length ?? 4;
    this.cpuCapacity = Math.max(1, cpus);

    const totalMemMB = Math.floor((os.totalmem?.() ?? 4 * 1024 * 1024 * 1024) / (1024 * 1024));
    // Reserve 20% headroom
    this.memoryCapacityMB = Math.floor(totalMemMB * 0.8);
  }

  /**
   * Allocates resources for a given workflow task.
   * Returns actual allocation based on availability.
   */
  public allocate(
    taskId: string,
    resourceType: string,
    amount: number
  ): { success: boolean; allocated?: number; error?: string } {
    const normalizedType = (resourceType || 'default').toLowerCase();
    let allocated = 0;

    if (normalizedType === 'cpu') {
      const available = Math.max(0, this.cpuCapacity - this.cpuUsed);
      allocated = Math.min(available, Math.max(0, Math.floor(amount)) || 1);
      if (allocated === 0) {
        return { success: false, error: 'Insufficient CPU capacity' };
      }
      this.cpuUsed += allocated;
      this.recordAllocation(taskId, normalizedType, allocated);
      return { success: true, allocated };
    }

    if (normalizedType === 'memory' || normalizedType === 'mem') {
      const available = Math.max(0, this.memoryCapacityMB - this.memoryUsedMB);
      // Treat amount as MB
      allocated = Math.min(available, Math.max(0, Math.floor(amount)) || 128);
      if (allocated === 0) {
        return { success: false, error: 'Insufficient memory capacity' };
      }
      this.memoryUsedMB += allocated;
      this.recordAllocation(taskId, 'memory', allocated);
      return { success: true, allocated };
    }

    // Default: admit as-is (non-scarce logical resource)
    allocated = Math.max(1, Math.floor(amount) || 1);
    this.recordAllocation(taskId, normalizedType, allocated);
    return { success: true, allocated };
  }

  /**
   * Release allocations for a task (or for a specific resource type).
   */
  public release(taskId: string, resourceType?: string): void {
    const entries = this.allocations.get(taskId);
    if (!entries) return;
    const remaining: { type: string; amount: number }[] = [];
    for (const alloc of entries) {
      if (resourceType && alloc.type !== resourceType) {
        remaining.push(alloc);
        continue;
      }
      if (alloc.type === 'cpu') this.cpuUsed = Math.max(0, this.cpuUsed - alloc.amount);
      if (alloc.type === 'memory') this.memoryUsedMB = Math.max(0, this.memoryUsedMB - alloc.amount);
    }
    if (remaining.length > 0) this.allocations.set(taskId, remaining);
    else this.allocations.delete(taskId);
  }

  /**
   * Current usage snapshot using OS/process metrics.
   */
  public getUsage(): Record<string, unknown> {
    const procMem = process.memoryUsage?.() ?? { rss: 0, heapTotal: 0, heapUsed: 0 };
    const totalMem = os.totalmem?.() ?? 0;
    const freeMem = os.freemem?.() ?? 0;
    const load = os.loadavg?.() ?? [0, 0, 0];
    return {
      cpu: { used: this.cpuUsed, capacity: this.cpuCapacity, load1: load[0], load5: load[1], load15: load[2] },
      memory: {
        usedMB: this.memoryUsedMB,
        capacityMB: this.memoryCapacityMB,
        process: { rss: procMem.rss, heapTotal: procMem.heapTotal, heapUsed: procMem.heapUsed },
        system: { total: totalMem, free: freeMem },
      },
    };
  }

  private recordAllocation(taskId: string, type: string, amount: number): void {
    const list = this.allocations.get(taskId) ?? [];
    list.push({ type, amount });
    this.allocations.set(taskId, list);
  }
}
