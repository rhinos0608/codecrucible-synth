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

const DEFAULT_LIMITS: ResourceLimits = {
  memory: {
    hardLimit: 1_024 * 1_024 * 1_024,
    softLimit: 768 * 1_024 * 1_024,
    emergencyLimit: 1_280 * 1_024 * 1_024,
    gcThreshold: 0.85,
    leakDetectionEnabled: true,
    maxAllocationSize: 100 * 1_024 * 1_024,
  },
  cpu: {
    maxUsagePercent: 90,
    throttleThreshold: 75,
    measurementWindow: 1_000,
    throttleDelay: 100,
    maxConcurrentCpuOps: 4,
  },
  concurrency: {
    maxConcurrentOperations: 10,
    maxQueueSize: 50,
    operationTimeout: 30_000,
    priorityLevels: 3,
    fairnessEnabled: true,
    starvationPrevention: true,
  },
  network: {
    maxConnections: 100,
    maxBandwidthMbps: 1_000,
    connectionTimeout: 30_000,
    idleTimeout: 30_000,
    maxConcurrentRequests: 50,
  },
  filesystem: {
    maxOpenFiles: 1_000,
    maxDiskUsageMB: 10_000,
    tempFileQuotaMB: 1_000,
    maxFileSize: 1_000,
    ioThrottleThreshold: 1_000,
  },
};

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

  constructor(private limits: ResourceLimits = DEFAULT_LIMITS) {
    super();
    this.quota = new QuotaEnforcer(limits);
    this.monitor.on('snapshot', snap => this.handleSnapshot(snap));
  }

  start(): void {
    this.monitor.start();
  }

  async stop(): Promise<void> {
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
        this.operationQueue.length,
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
    this.emit('resource-violation', v);
  }

  private updateConcurrencyStats(): void {
    const active = this.activeOperations.size;
    const queued = this.operationQueue.length;
    this.monitor.updateConcurrency(active, queued, this.rejectedOperations, 0);
  }

  async executeWithEnforcement<T>(
    operationId: string,
    operation: () => Promise<T>,
    ctx: Partial<OperationResourceContext> & {
      resourceRequirements?: OperationResourceContext['resourceRequirements'];
      priority?: number;
      timeout?: number;
      metadata?: any;
    } = {}
  ): Promise<T> {
    const opCtx: OperationResourceContext = {
      operationId,
      resourceRequirements: ctx.resourceRequirements || {},
      priority: ctx.priority ?? 0,
      startTime: Date.now(),
      timeout: ctx.timeout ?? 0,
      resourcesAllocated: new Map(),
      state: 'pending',
    };
    this.registerOperation(opCtx);
    try {
      const result = await operation();
      opCtx.state = 'completed';
      return result;
    } catch (err) {
      opCtx.state = 'failed';
      throw err;
    } finally {
      this.completeOperation(operationId);
    }
  }

  async triggerEmergencyCleanup(reason: string): Promise<void> {
    this.emit('emergency-cleanup', reason);
  }

  async shutdown(): Promise<void> {
    this.stop();
  }

  getEnforcementStats(): {
    activeOperations: number;
    queuedOperations: number;
    rejectedOperations: number;
    violations: number;
  } {
    return {
      activeOperations: this.activeOperations.size,
      queuedOperations: this.operationQueue.length,
      rejectedOperations: this.rejectedOperations,
      violations: this.violations.length,
    };
  }
}
