import { EventEmitter } from 'events';
import os from 'os';
import { ResourceSnapshot } from './resource-types.js';

/**
 * ResourceMonitor
 *
 * Periodically samples process metrics and emits \`ResourceSnapshot\` events.
 * Consumers may provide external counters for concurrency, network, and
 * filesystem activity via the provided update methods. The monitor focuses on
 * keeping overhead low while still providing meaningful statistics for the
 * enforcer orchestrator.
 */
export class ResourceMonitor extends EventEmitter {
  private interval?: NodeJS.Timeout;
  private lastCpu = process.cpuUsage();
  private lastSample = Date.now();

  private concurrency = {
    activeOperations: 0,
    queuedOperations: 0,
    rejectedOperations: 0,
    avgWaitTime: 0,
  };

  private network = {
    activeConnections: 0,
    bandwidthUsageMbps: 0,
    pendingRequests: 0,
    connectionErrors: 0,
  };

  private filesystem = {
    openFiles: 0,
    diskUsageMB: 0,
    tempFilesCount: 0,
    ioOperationsPerSec: 0,
  };

  start(intervalMs = 1000): void {
    if (this.interval) return;
    this.lastCpu = process.cpuUsage();
    this.lastSample = Date.now();
    this.interval = setInterval(() => this.sample(), intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  updateConcurrency(active: number, queued: number, rejected: number, avgWait: number): void {
    this.concurrency = {
      activeOperations: active,
      queuedOperations: queued,
      rejectedOperations: rejected,
      avgWaitTime: avgWait,
    };
  }

  updateNetwork(stats: Partial<typeof this.network>): void {
    this.network = { ...this.network, ...stats };
  }

  updateFilesystem(stats: Partial<typeof this.filesystem>): void {
    this.filesystem = { ...this.filesystem, ...stats };
  }

  private sample(): void {
    const now = Date.now();
    const cpuDiff = process.cpuUsage(this.lastCpu);
    const elapsedMicros = (now - this.lastSample) * 1000;
    const cpuPercent =
      elapsedMicros > 0 ? ((cpuDiff.user + cpuDiff.system) / elapsedMicros) * 100 : 0;

    const mem = process.memoryUsage();

    const snapshot: ResourceSnapshot = {
      timestamp: now,
      memory: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
        rss: mem.rss,
        utilizationPercent: mem.heapTotal > 0 ? (mem.heapUsed / mem.heapTotal) * 100 : 0,
        leaksDetected: 0,
      },
      cpu: {
        usagePercent: cpuPercent,
        loadAverage: os.loadavg(),
        activeOperations: this.concurrency.activeOperations,
        throttledOperations: this.concurrency.rejectedOperations,
      },
      concurrency: { ...this.concurrency },
      network: { ...this.network },
      filesystem: { ...this.filesystem },
    };

    this.lastCpu = process.cpuUsage();
    this.lastSample = now;

    this.emit('snapshot', snapshot);
  }
}
