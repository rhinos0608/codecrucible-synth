import { EventEmitter } from 'events';
import {
  ResourceLimits,
  ResourceSnapshot,
  ResourceViolation,
  ResourceType,
  OperationResourceContext,
} from './resource-types.js';
import { ResourceMonitor } from './resource-monitor.js';
import { QuotaEnforcer } from './quota-enforcer.js';
import { ScalingController } from './scaling-controller.js';
import { PerformanceOptimizer } from './performance-optimizer.js';
import { CostAnalyzer } from './cost-analyzer.js';
import { HealthChecker } from './health-checker.js';
import { AlertManager } from './alert-manager.js';
import { CapacityPlanner } from './capacity-planner.js';

/**
 * ProductionResourceEnforcer
 *
 * Coordinates monitoring, quota enforcement, scaling hints, optimization,
 * cost tracking, health checks and capacity planning for production
 * environments.
 */
export class ProductionResourceEnforcer extends EventEmitter {
  private monitor = new ResourceMonitor();
  private quota: QuotaEnforcer;
  private scaling = new ScalingController();
  private optimizer = new PerformanceOptimizer();
  private cost = new CostAnalyzer();
  private health = new HealthChecker();
  private alerts = new AlertManager();
  private capacity = new CapacityPlanner();

  private history: ResourceSnapshot[] = [];
  private violations: ResourceViolation[] = [];

  private activeOperations = new Map<string, OperationResourceContext>();
  private operationQueue: OperationResourceContext[] = [];
  private rejectedOperations = 0;

  constructor(private limits: ResourceLimits) {
    super();
    this.quota = new QuotaEnforcer(limits);
    this.monitor.on('snapshot', snap => this.handleSnapshot(snap));
  }

  start(): void {
    this.monitor.start();
  }

  stop(): void {
    this.monitor.stop();
  }

  /** Register a new operation with required resources. */
  registerOperation(ctx: OperationResourceContext): void {
    if (this.activeOperations.size < this.limits.concurrency.maxConcurrentOperations) {
      ctx.state = 'running';
      ctx.startTime = Date.now();
      this.activeOperations.set(ctx.operationId, ctx);
    } else if (this.operationQueue.length < this.limits.concurrency.maxQueueSize) {
      ctx.state = 'pending';
      this.operationQueue.push(ctx);
    } else {
      this.rejectedOperations += 1;
      const violation = this.quota.enforce(
        ResourceType.CONCURRENCY,
        this.activeOperations.size + this.operationQueue.length,
        'queued',
        ctx.operationId
      );
      if (violation) {
        this.recordViolation(violation);
      }
      return;
    }

    this.updateConcurrencyStats();
  }

  completeOperation(id: string): void {
    this.activeOperations.delete(id);
    if (this.operationQueue.length > 0) {
      const next = this.operationQueue.shift();
      if (next) {
        this.registerOperation(next);
      }
    }
    this.updateConcurrencyStats();
  }

  recordNetwork(
    stats: Partial<{
      activeConnections: number;
      bandwidthUsageMbps: number;
      pendingRequests: number;
      connectionErrors: number;
    }>
  ): void {
    this.monitor.updateNetwork(stats);
  }

  recordFilesystem(
    stats: Partial<{
      openFiles: number;
      diskUsageMB: number;
      tempFilesCount: number;
      ioOperationsPerSec: number;
    }>
  ): void {
    this.monitor.updateFilesystem(stats);
  }

  getSnapshotHistory(): ResourceSnapshot[] {
    return this.history;
  }

  getViolations(): ResourceViolation[] {
    return this.violations;
  }

  private handleSnapshot(snapshot: ResourceSnapshot): void {
    this.history.push(snapshot);
    if (this.history.length > 100) {
      this.history.shift();
    }

    // Quota checks
    this.checkQuota(ResourceType.MEMORY, snapshot.memory.heapUsed);
    this.checkQuota(ResourceType.CPU, snapshot.cpu.usagePercent);
    this.checkQuota(ResourceType.CONCURRENCY, snapshot.concurrency.activeOperations);
    this.checkQuota(ResourceType.CONCURRENCY, snapshot.concurrency.queuedOperations, 'queued');
    this.checkQuota(ResourceType.NETWORK, snapshot.network.activeConnections, 'connections');
    this.checkQuota(ResourceType.NETWORK, snapshot.network.bandwidthUsageMbps, 'bandwidth');
    this.checkQuota(ResourceType.FILESYSTEM, snapshot.filesystem.openFiles);
    this.checkQuota(ResourceType.FILESYSTEM, snapshot.filesystem.diskUsageMB, 'disk');

    // Scaling and optimization
    this.scaling.record(snapshot);
    const decision = this.scaling.evaluate();
    if (decision !== 'stable') {
      this.emit('scaling', decision);
    }

    this.optimizer.analyze(snapshot);
    this.cost.record(snapshot);

    const issues = this.health.evaluate(snapshot);
    issues.forEach(msg => this.alerts.notify('warn', msg));

    this.capacity.record(snapshot);

    this.emit('snapshot', snapshot);

    this.updateConcurrencyStats();
  }

  private checkQuota(type: ResourceType, value: number, metric?: string, operation?: string): void {
    const violation = this.quota.enforce(type, value, metric, operation);
    if (violation) {
      this.recordViolation(violation);
    }
  }

  private recordViolation(v: ResourceViolation): void {
    this.violations.push(v);
    this.alerts.notify('error', `Resource violation: ${v.resourceType} (${v.violationType})`, v);
    this.emit('violation', v);
  }

  private updateConcurrencyStats(): void {
    const active = this.activeOperations.size;
    const queued = this.operationQueue.length;
    this.monitor.updateConcurrency(active, queued, this.rejectedOperations, 0);
  }
}
