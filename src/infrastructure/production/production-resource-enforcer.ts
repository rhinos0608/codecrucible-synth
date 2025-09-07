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
    hardLimit: 1024,
    softLimit: 768,
    emergencyLimit: 900,
    gcThreshold: 0.8,
    leakDetectionEnabled: true,
    maxAllocationSize: 256,
  },
  cpu: {
    maxUsagePercent: 90,
    throttleThreshold: 80,
    measurementWindow: 1000,
    throttleDelay: 100,
    maxConcurrentCpuOps: 4,
  },
  concurrency: {
    maxConcurrentOperations: 10,
    maxQueueSize: 100,
    operationTimeout: 60000,
    priorityLevels: 3,
    fairnessEnabled: true,
    starvationPrevention: true,
  },
  network: {
    maxConnections: 100,
    maxBandwidthMbps: 1000,
    connectionTimeout: 30000,
    idleTimeout: 60000,
    maxConcurrentRequests: 100,
  },
  filesystem: {
    maxOpenFiles: 100,
    maxDiskUsageMB: 1024,
    tempFileQuotaMB: 100,
    maxFileSize: 50,
    ioThrottleThreshold: 80,
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
    this.quota = new QuotaEnforcer(this.limits);
    this.monitor.on('snapshot', snap => this.handleSnapshot(snap));
  }

  start(): void {
    this.monitor.start();
  }

  stop(): void {
    this.monitor.stop();
  }

  /** Register a new operation with required resources. */
  registerOperation(ctx: OperationResourceContext): boolean {
    if (this.activeOperations.size < this.limits.concurrency.maxConcurrentOperations) {
      ctx.state = 'running';
      ctx.startTime = Date.now();
      this.activeOperations.set(ctx.operationId, ctx);
      this.emit('operation-started', ctx.operationId);
      this.updateConcurrencyStats();
      return true;
    }
    if (this.operationQueue.length < this.limits.concurrency.maxQueueSize) {
      ctx.state = 'pending';
      this.operationQueue.push(ctx);
      this.updateConcurrencyStats();
      return true;
    }

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
    this.updateConcurrencyStats();
    return false;
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

  /**
   * Executes an operation while enforcing concurrency limits.
   *
   * The operation is registered with the enforcer and may execute immediately
   * or be queued depending on current resource usage. If queued, this method
   * waits until the operation is promoted to running before invoking the
   * provided callback. If the operation cannot be accepted, an error is thrown
   * and the callback is never executed.
   *
   * @param operationId - Unique identifier for the operation.
   * @param fn - Function to execute once resources are available.
   * @param options - Optional resource requirements, priority, and timeout.
   */
  async executeWithEnforcement<T>(
    operationId: string,
    fn: () => Promise<T> | T,
    options: {
      resourceRequirements?: OperationResourceContext['resourceRequirements'];
      priority?: number;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const ctx: OperationResourceContext = {
      operationId,
      resourceRequirements: options.resourceRequirements || {},
      priority: options.priority ?? 0,
      startTime: Date.now(),
      timeout: options.timeout ?? 0,
      resourcesAllocated: new Map(),
      state: 'pending',
    };

    const accepted = this.registerOperation(ctx);
    if (!accepted) {
      ctx.state = 'rejected';
      throw new Error(`Operation ${operationId} rejected due to resource limits`);
    }

    if (ctx.state === 'pending') {
      await new Promise<void>((resolve, reject) => {
        const onStart = (id: string): void => {
          if (id === operationId) {
            cleanup();
            resolve();
          }
        };
        const cleanup = () => {
          clearTimeout(timeoutId);
          this.off('operation-started', onStart);
        };
        this.on('operation-started', onStart);
        const timeoutMs = ctx.timeout && ctx.timeout > 0 ? ctx.timeout : 60000;
        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error(`Timeout waiting for operation ${operationId} to start`));
        }, timeoutMs);
      });
    }

    try {
      const result = await fn();
      ctx.state = 'completed';
      return result;
    } catch (error) {
      ctx.state = 'failed';
      throw error;
    } finally {
      this.completeOperation(operationId);
    }
  }

  /**
   * Triggers an emergency cleanup of all active and queued operations.
   *
   * This method should be called in critical situations where the system is in
   * an unrecoverable state, such as severe resource violations, persistent
   * instability, or when normal operation cannot continue safely.
   *
   * The cleanup process involves:
   * - Clearing all active operations.
   * - Emptying the operation queue.
   * - Resetting the count of rejected operations.
   * - Updating concurrency statistics.
   * - Emitting an 'emergency-cleanup' event with the provided reason.
   *
   * Potential side effects:
   * - Abrupt termination of all in-progress and queued operations, which may
   *   result in loss of work or inconsistent state.
   * - Listeners to the 'emergency-cleanup' event should handle any necessary
   *   recovery or alerting.
   *
   * @param reason - A descriptive reason for triggering the emergency cleanup.
   */
  async triggerEmergencyCleanup(reason: string): Promise<void> {
    this.activeOperations.clear();
    this.operationQueue = [];
    this.rejectedOperations = 0;
    this.updateConcurrencyStats();
    this.emit('emergency-cleanup', reason);
  }

  getEnforcementStats(): {
    activeOperations: number;
    queuedOperations: number;
    rejectedOperations: number;
  } {
    return {
      activeOperations: this.activeOperations.size,
      queuedOperations: this.operationQueue.length,
      rejectedOperations: this.rejectedOperations,
    };
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
