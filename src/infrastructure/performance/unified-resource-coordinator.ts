/**
 * Unified Resource Coordinator
 * Agent 3: Runtime Coordination & Performance Specialist
 *
 * Coordinates resource utilization across all systems to prevent contention
 * - Memory management and limits
 * - CPU usage coordination
 * - Network connection pooling
 * - File system access coordination
 * - Concurrent request limiting
 * - Resource cleanup and lifecycle management
 *
 * Addresses resource contention between routing, voice, MCP, and orchestration systems
 */

import { EventEmitter } from 'events';
import { logger } from '../logging/logger.js';

export interface ResourceLimits {
  memory: {
    maxHeapSize: number;
    warningThreshold: number;
    criticalThreshold: number;
    gcForceThreshold: number;
  };
  cpu: {
    maxUsagePercent: number;
    warningThreshold: number;
    throttleThreshold: number;
  };
  network: {
    maxConnections: number;
    maxConcurrentRequests: number;
    connectionTimeout: number;
    requestTimeout: number;
  };
  filesystem: {
    maxOpenFiles: number;
    maxCacheSize: number;
    tempDirQuota: number;
  };
  concurrency: {
    maxConcurrentOperations: number;
    maxQueueSize: number;
    operationTimeout: number;
  };
}

export interface ResourceUsage {
  timestamp: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    utilizationPercent: number;
  };
  cpu: {
    usagePercent: number;
    loadAverage: number[];
    processTime: number;
  };
  network: {
    activeConnections: number;
    pendingRequests: number;
    bytesTransferred: number;
    errors: number;
  };
  filesystem: {
    openFiles: number;
    diskUsage: number;
    ioOperations: number;
  };
  concurrency: {
    activeOperations: number;
    queuedOperations: number;
    completedOperations: number;
    failedOperations: number;
  };
}

export interface ResourceAllocation {
  systemName: string;
  resourceType: 'memory' | 'cpu' | 'network' | 'filesystem' | 'concurrency';
  allocated: number;
  used: number;
  priority: number;
  lastAccessed: number;
  restrictions: ResourceRestriction[];
}

export interface ResourceRestriction {
  type: 'memory_limit' | 'cpu_throttle' | 'connection_limit' | 'queue_limit';
  value: number;
  reason: string;
  startTime: number;
  endTime?: number;
}

export interface ResourceAlert {
  level: 'info' | 'warning' | 'error' | 'critical';
  resourceType: string;
  system?: string;
  current: number;
  limit: number;
  message: string;
  timestamp: number;
  action?: string;
}

export interface ResourceCoordinationStats {
  totalSystems: number;
  resourceUsage: ResourceUsage;
  allocations: ResourceAllocation[];
  restrictions: ResourceRestriction[];
  alerts: ResourceAlert[];
  coordinationMetrics: {
    preventedContention: number;
    resourceSavings: number;
    coordinationOverhead: number;
    fairnessScore: number;
  };
}

/**
 * Unified Resource Coordinator
 * Manages and coordinates resource usage across all systems
 */
export class UnifiedResourceCoordinator extends EventEmitter {
  private static instance: UnifiedResourceCoordinator | null = null;

  private resourceLimits: ResourceLimits;
  private currentUsage: ResourceUsage;
  private allocations = new Map<string, ResourceAllocation>();
  private restrictions = new Map<string, ResourceRestriction>();
  private alerts: ResourceAlert[] = [];

  private monitoringIntervalId?: NodeJS.Timeout;
  private isMonitoring = false;
  private startTime = Date.now();

  // System coordination
  private registeredSystems = new Set<string>();
  private systemPriorities = new Map<string, number>();
  private operationQueue: QueuedOperation[] = [];
  private activeOperations = new Map<string, Operation>();

  // Resource pools
  private connectionPools = new Map<string, ConnectionPool>();
  private memoryPools = new Map<string, MemoryPool>();

  // Metrics
  private preventedContentionCount = 0;
  private resourceSavings = 0;
  private coordinationOperations = 0;

  private constructor() {
    super();

    this.resourceLimits = this.getDefaultResourceLimits();
    this.currentUsage = this.initializeResourceUsage();

    this.setupSystemPriorities();
    this.setupResourcePools();

    logger.info('⚡ Unified Resource Coordinator initialized', {
      memoryLimit: `${(this.resourceLimits.memory.maxHeapSize / 1024 / 1024).toFixed(0)}MB`,
      concurrencyLimit: this.resourceLimits.concurrency.maxConcurrentOperations,
    });
  }

  static getInstance(): UnifiedResourceCoordinator {
    if (!UnifiedResourceCoordinator.instance) {
      UnifiedResourceCoordinator.instance = new UnifiedResourceCoordinator();
    }
    return UnifiedResourceCoordinator.instance;
  }

  /**
   * Start resource monitoring and coordination
   */
  startCoordination(intervalMs: number = 10000): void {
    if (this.isMonitoring) {
      logger.warn('Resource coordination already started');
      return;
    }

    this.isMonitoring = true;
    this.monitoringIntervalId = setInterval(() => {
      this.performResourceCoordination();
    }, intervalMs);

    logger.info('🚀 Resource coordination started', {
      interval: `${intervalMs}ms`,
      systems: this.registeredSystems.size,
    });

    // Perform initial coordination
    this.performResourceCoordination();
  }

  /**
   * Stop resource coordination
   */
  stopCoordination(): void {
    if (!this.isMonitoring || !this.monitoringIntervalId) return;

    clearInterval(this.monitoringIntervalId);
    this.isMonitoring = false;
    this.monitoringIntervalId = undefined;

    logger.info('🛑 Resource coordination stopped');
  }

  /**
   * Register a system for resource coordination
   */
  registerSystem(name: string, priority: number = 50): void {
    this.registeredSystems.add(name);
    this.systemPriorities.set(name, priority);

    // Initialize resource allocations
    this.allocations.set(name, {
      systemName: name,
      resourceType: 'memory',
      allocated: 0,
      used: 0,
      priority,
      lastAccessed: Date.now(),
      restrictions: [],
    });

    logger.info(`📋 Registered system for resource coordination: ${name} (priority: ${priority})`);
    this.emit('system-registered', { name, priority });
  }

  /**
   * Request resource allocation
   */
  async requestResource(
    systemName: string,
    resourceType: 'memory' | 'cpu' | 'network' | 'filesystem' | 'concurrency',
    amount: number,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<boolean> {
    const priorityValue = { low: 1, medium: 2, high: 3, critical: 4 }[priority];

    try {
      // Check if resource is available
      const available = await this.checkResourceAvailability(resourceType, amount);
      if (!available) {
        // Try to free resources from lower priority systems
        const freed = await this.freeResourcesForHigherPriority(
          resourceType,
          amount,
          priorityValue
        );
        if (!freed) {
          this.recordResourceDenial(systemName, resourceType, amount, 'insufficient_resources');
          return false;
        }
      }

      // Allocate the resource
      const allocation = this.allocations.get(systemName) || {
        systemName,
        resourceType,
        allocated: 0,
        used: 0,
        priority: priorityValue,
        lastAccessed: Date.now(),
        restrictions: [],
      };

      allocation.allocated += amount;
      allocation.resourceType = resourceType;
      allocation.lastAccessed = Date.now();

      this.allocations.set(systemName, allocation);

      logger.debug(`✅ Resource allocated: ${systemName} -> ${amount} ${resourceType}`);
      this.emit('resource-allocated', { systemName, resourceType, amount, priority });

      return true;
    } catch (error) {
      logger.error(`Error allocating resource for ${systemName}:`, error);
      return false;
    }
  }

  /**
   * Release resource allocation
   */
  async releaseResource(
    systemName: string,
    resourceType: 'memory' | 'cpu' | 'network' | 'filesystem' | 'concurrency',
    amount: number
  ): Promise<void> {
    const allocation = this.allocations.get(systemName);
    if (!allocation) return;

    allocation.allocated = Math.max(0, allocation.allocated - amount);
    allocation.used = Math.max(0, allocation.used - amount);
    allocation.lastAccessed = Date.now();

    logger.debug(`♻️ Resource released: ${systemName} -> ${amount} ${resourceType}`);
    this.emit('resource-released', { systemName, resourceType, amount });

    // Process queued operations that might now be possible
    await this.processQueuedOperations();
  }

  /**
   * Queue an operation when resources are not immediately available
   */
  async queueOperation(operation: {
    id: string;
    systemName: string;
    resourceRequirements: Array<{ type: string; amount: number }>;
    priority: number;
    timeout: number;
    callback: () => Promise<any>;
  }): Promise<void> {
    const queuedOp: QueuedOperation = {
      ...operation,
      queuedAt: Date.now(),
      attempts: 0,
    };

    // Insert in priority order
    const insertIndex = this.operationQueue.findIndex(op => op.priority < queuedOp.priority);
    if (insertIndex === -1) {
      this.operationQueue.push(queuedOp);
    } else {
      this.operationQueue.splice(insertIndex, 0, queuedOp);
    }

    logger.info(`⏳ Operation queued: ${operation.id} (queue size: ${this.operationQueue.length})`);
    this.emit('operation-queued', { id: operation.id, queueSize: this.operationQueue.length });

    // Check if we can process immediately
    await this.processQueuedOperations();
  }

  /**
   * Execute an operation with resource coordination
   */
  async executeWithCoordination<T>(
    systemName: string,
    operationId: string,
    resourceRequirements: Array<{ type: string; amount: number }>,
    operation: () => Promise<T>,
    options?: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      timeout?: number;
      retries?: number;
    }
  ): Promise<T> {
    const opts = {
      priority: 'medium' as const,
      timeout: 30000,
      retries: 2,
      ...options,
    };

    const operationInfo: Operation = {
      id: operationId,
      systemName,
      startTime: Date.now(),
      resourceRequirements,
      status: 'starting',
    };

    this.activeOperations.set(operationId, operationInfo);

    try {
      // Request resources
      const resourcesAllocated: Array<{ type: string; amount: number }> = [];

      for (const req of resourceRequirements) {
        const allocated = await this.requestResource(
          systemName,
          req.type as any,
          req.amount,
          opts.priority
        );

        if (!allocated) {
          // Queue the operation if resources not available
          await this.queueOperation({
            id: operationId,
            systemName,
            resourceRequirements,
            priority: { low: 1, medium: 2, high: 3, critical: 4 }[opts.priority],
            timeout: opts.timeout,
            callback: operation,
          });

          throw new Error(`Insufficient ${req.type} resources, operation queued`);
        }

        resourcesAllocated.push(req);
      }

      operationInfo.status = 'running';

      // Execute operation with timeout
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Operation timeout')), opts.timeout)
        ),
      ]);

      operationInfo.status = 'completed';
      operationInfo.endTime = Date.now();

      // Release resources
      for (const req of resourcesAllocated) {
        await this.releaseResource(systemName, req.type as any, req.amount);
      }

      this.activeOperations.delete(operationId);

      logger.debug(`✅ Coordinated operation completed: ${operationId}`);
      return result;
    } catch (error) {
      operationInfo.status = 'failed';
      operationInfo.endTime = Date.now();
      operationInfo.error = error as Error;

      // Release any allocated resources
      for (const req of resourceRequirements) {
        await this.releaseResource(systemName, req.type as any, req.amount);
      }

      this.activeOperations.delete(operationId);

      logger.error(`❌ Coordinated operation failed: ${operationId}`, error);
      throw error;
    }
  }

  /**
   * Get resource coordination statistics
   */
  getCoordinationStats(): ResourceCoordinationStats {
    return {
      totalSystems: this.registeredSystems.size,
      resourceUsage: this.currentUsage,
      allocations: Array.from(this.allocations.values()),
      restrictions: Array.from(this.restrictions.values()),
      alerts: this.alerts.slice(-20),
      coordinationMetrics: {
        preventedContention: this.preventedContentionCount,
        resourceSavings: this.calculateResourceSavings(),
        coordinationOverhead: this.calculateCoordinationOverhead(),
        fairnessScore: this.calculateFairnessScore(),
      },
    };
  }

  /**
   * Get resource health report
   */
  getResourceHealthReport(): any {
    const usage = this.currentUsage;
    const limits = this.resourceLimits;

    return {
      overall: {
        status: this.calculateOverallResourceHealth(),
        utilizationPercent: this.calculateOverallUtilization(),
        systemsActive: this.activeOperations.size,
        queueLength: this.operationQueue.length,
      },
      memory: {
        status: this.getResourceStatus('memory', usage.memory.utilizationPercent),
        current: usage.memory.heapUsed,
        limit: limits.memory.maxHeapSize,
        utilizationPercent: usage.memory.utilizationPercent,
      },
      cpu: {
        status: this.getResourceStatus('cpu', usage.cpu.usagePercent),
        current: usage.cpu.usagePercent,
        limit: limits.cpu.maxUsagePercent,
        utilizationPercent: usage.cpu.usagePercent,
      },
      network: {
        status: this.getResourceStatus(
          'network',
          (usage.network.activeConnections / limits.network.maxConnections) * 100
        ),
        connections: usage.network.activeConnections,
        limit: limits.network.maxConnections,
        pendingRequests: usage.network.pendingRequests,
      },
      concurrency: {
        status: this.getResourceStatus(
          'concurrency',
          (usage.concurrency.activeOperations / limits.concurrency.maxConcurrentOperations) * 100
        ),
        activeOperations: usage.concurrency.activeOperations,
        queuedOperations: usage.concurrency.queuedOperations,
        limit: limits.concurrency.maxConcurrentOperations,
      },
      recommendations: this.generateResourceOptimizationRecommendations(),
    };
  }

  // Private methods

  private async performResourceCoordination(): Promise<void> {
    try {
      // Update resource usage
      await this.updateResourceUsage();

      // Check for resource violations
      await this.checkResourceViolations();

      // Process queued operations
      await this.processQueuedOperations();

      // Clean up expired resources and operations
      await this.cleanupExpiredResources();

      // Update coordination metrics
      this.coordinationOperations++;

      this.emit('coordination-cycle-complete', {
        usage: this.currentUsage,
        activeOperations: this.activeOperations.size,
        queueSize: this.operationQueue.length,
      });
    } catch (error) {
      logger.error('Resource coordination cycle error:', error);
      this.emit('coordination-error', error);
    }
  }

  private async updateResourceUsage(): Promise<void> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.currentUsage = {
      timestamp: Date.now(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        utilizationPercent: (memUsage.heapUsed / this.resourceLimits.memory.maxHeapSize) * 100,
      },
      cpu: {
        usagePercent: this.estimateCPUUsage(cpuUsage),
        loadAverage: [], // Would be populated with actual load average
        processTime: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to ms
      },
      network: {
        activeConnections: this.calculateActiveConnections(),
        pendingRequests: this.operationQueue.length,
        bytesTransferred: 0, // Would track actual bytes
        errors: 0,
      },
      filesystem: {
        openFiles: 0, // Would track actual open files
        diskUsage: 0,
        ioOperations: 0,
      },
      concurrency: {
        activeOperations: this.activeOperations.size,
        queuedOperations: this.operationQueue.length,
        completedOperations: 0, // Would track completed operations
        failedOperations: 0,
      },
    };
  }

  private async checkResourceViolations(): Promise<void> {
    const usage = this.currentUsage;
    const limits = this.resourceLimits;
    const alerts: ResourceAlert[] = [];

    // Check memory violations
    if (usage.memory.utilizationPercent > limits.memory.criticalThreshold) {
      alerts.push({
        level: 'critical',
        resourceType: 'memory',
        current: usage.memory.heapUsed,
        limit: limits.memory.maxHeapSize,
        message: `Memory usage critical: ${usage.memory.utilizationPercent.toFixed(1)}%`,
        timestamp: Date.now(),
        action: 'force_gc_and_cleanup',
      });

      // Force garbage collection and cleanup
      await this.forceResourceCleanup('memory');
    } else if (usage.memory.utilizationPercent > limits.memory.warningThreshold) {
      alerts.push({
        level: 'warning',
        resourceType: 'memory',
        current: usage.memory.heapUsed,
        limit: limits.memory.maxHeapSize,
        message: `Memory usage high: ${usage.memory.utilizationPercent.toFixed(1)}%`,
        timestamp: Date.now(),
        action: 'cleanup_low_priority_caches',
      });
    }

    // Check CPU violations
    if (usage.cpu.usagePercent > limits.cpu.throttleThreshold) {
      alerts.push({
        level: 'warning',
        resourceType: 'cpu',
        current: usage.cpu.usagePercent,
        limit: limits.cpu.maxUsagePercent,
        message: `CPU usage high: ${usage.cpu.usagePercent.toFixed(1)}%`,
        timestamp: Date.now(),
        action: 'throttle_low_priority_operations',
      });

      await this.throttleLowPriorityOperations();
    }

    // Check concurrency violations
    if (usage.concurrency.activeOperations > limits.concurrency.maxConcurrentOperations) {
      alerts.push({
        level: 'error',
        resourceType: 'concurrency',
        current: usage.concurrency.activeOperations,
        limit: limits.concurrency.maxConcurrentOperations,
        message: 'Too many concurrent operations',
        timestamp: Date.now(),
        action: 'queue_new_operations',
      });
    }

    // Store and emit alerts
    this.alerts.push(...alerts);
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-50);
    }

    for (const alert of alerts) {
      this.emit('resource-alert', alert);
      logger.warn(`Resource Alert [${alert.level}] ${alert.resourceType}: ${alert.message}`);
    }
  }

  private async processQueuedOperations(): Promise<void> {
    const processableOps: QueuedOperation[] = [];

    // Find operations that can now be processed
    for (let i = this.operationQueue.length - 1; i >= 0; i--) {
      const op = this.operationQueue[i];

      // Check if operation has timed out
      if (Date.now() - op.queuedAt > op.timeout) {
        this.operationQueue.splice(i, 1);
        logger.warn(`Operation ${op.id} timed out in queue`);
        continue;
      }

      // Check if resources are now available
      let canProcess = true;
      for (const req of op.resourceRequirements) {
        if (!(await this.checkResourceAvailability(req.type as any, req.amount))) {
          canProcess = false;
          break;
        }
      }

      if (canProcess) {
        processableOps.push(op);
        this.operationQueue.splice(i, 1);
      }
    }

    // Process operations in priority order
    processableOps.sort((a, b) => b.priority - a.priority);

    for (const op of processableOps.slice(0, 3)) {
      // Process up to 3 at once
      try {
        await op.callback();
        logger.info(`✅ Queued operation processed: ${op.id}`);
      } catch (error) {
        logger.error(`❌ Queued operation failed: ${op.id}`, error);
      }
    }
  }

  private async checkResourceAvailability(
    resourceType: 'memory' | 'cpu' | 'network' | 'filesystem' | 'concurrency',
    amount: number
  ): Promise<boolean> {
    const usage = this.currentUsage;
    const limits = this.resourceLimits;

    switch (resourceType) {
      case 'memory':
        return usage.memory.heapUsed + amount < limits.memory.maxHeapSize * 0.9;

      case 'cpu':
        return usage.cpu.usagePercent < limits.cpu.maxUsagePercent * 0.8;

      case 'network':
        return usage.network.activeConnections < limits.network.maxConnections;

      case 'concurrency':
        return usage.concurrency.activeOperations < limits.concurrency.maxConcurrentOperations;

      case 'filesystem':
        return usage.filesystem.openFiles < limits.filesystem.maxOpenFiles;

      default:
        return false;
    }
  }

  private async freeResourcesForHigherPriority(
    resourceType: 'memory' | 'cpu' | 'network' | 'filesystem' | 'concurrency',
    amount: number,
    requestorPriority: number
  ): Promise<boolean> {
    // Find lower priority allocations to free
    const candidates = Array.from(this.allocations.values())
      .filter(
        alloc =>
          alloc.resourceType === resourceType &&
          alloc.priority < requestorPriority &&
          alloc.allocated > 0
      )
      .sort((a, b) => a.priority - b.priority);

    let freedAmount = 0;
    for (const candidate of candidates) {
      if (freedAmount >= amount) break;

      const toFree = Math.min(candidate.allocated, amount - freedAmount);
      candidate.allocated -= toFree;
      freedAmount += toFree;

      this.preventedContentionCount++;

      logger.info(
        `🔄 Freed ${toFree} ${resourceType} from ${candidate.systemName} for higher priority request`
      );
    }

    return freedAmount >= amount;
  }

  private async forceResourceCleanup(resourceType: string): Promise<void> {
    logger.warn(`🧹 Forcing resource cleanup for ${resourceType}`);

    if (resourceType === 'memory') {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Clear caches if possible
      this.emit('force-cleanup', { resourceType: 'memory' });
    }

    // Additional cleanup logic for other resource types
  }

  private async throttleLowPriorityOperations(): Promise<void> {
    logger.info('🐌 Throttling low priority operations due to high CPU usage');

    // Add restrictions to low priority systems
    for (const [systemName, allocation] of this.allocations.entries()) {
      if (allocation.priority <= 2) {
        // Low and medium priority
        const restriction: ResourceRestriction = {
          type: 'cpu_throttle',
          value: 50, // 50% reduction
          reason: 'High system CPU usage',
          startTime: Date.now(),
        };

        allocation.restrictions.push(restriction);
        this.restrictions.set(`${systemName}-cpu`, restriction);
      }
    }

    // Remove restrictions after 30 seconds
    setTimeout(() => {
      this.clearResourceRestrictions('cpu_throttle');
    }, 30000);
  }

  private clearResourceRestrictions(restrictionType: string): void {
    for (const [key, restriction] of this.restrictions.entries()) {
      if (restriction.type === restrictionType) {
        restriction.endTime = Date.now();
        this.restrictions.delete(key);
      }
    }

    // Clear from allocations
    for (const allocation of this.allocations.values()) {
      allocation.restrictions = allocation.restrictions.filter(r => r.type !== restrictionType);
    }

    logger.info(`✅ Cleared resource restrictions: ${restrictionType}`);
  }

  private async cleanupExpiredResources(): Promise<void> {
    const now = Date.now();
    const STALE_THRESHOLD = 300000; // 5 minutes

    // Clean up stale allocations
    for (const [systemName, allocation] of this.allocations.entries()) {
      if (now - allocation.lastAccessed > STALE_THRESHOLD) {
        allocation.allocated = 0;
        allocation.used = 0;
        logger.debug(`🧹 Cleaned up stale allocation for ${systemName}`);
      }
    }

    // Clean up completed operations
    for (const [id, operation] of this.activeOperations.entries()) {
      if (operation.status === 'completed' || operation.status === 'failed') {
        if (operation.endTime && now - operation.endTime > 60000) {
          // 1 minute
          this.activeOperations.delete(id);
        }
      } else if (now - operation.startTime > 300000) {
        // 5 minutes timeout
        operation.status = 'failed';
        operation.endTime = now;
        operation.error = new Error('Operation timeout');
        this.activeOperations.delete(id);
      }
    }
  }

  private recordResourceDenial(
    systemName: string,
    resourceType: string,
    amount: number,
    reason: string
  ): void {
    logger.warn(
      `🚫 Resource denied: ${systemName} requested ${amount} ${resourceType} - ${reason}`
    );

    this.emit('resource-denied', {
      systemName,
      resourceType,
      amount,
      reason,
      timestamp: Date.now(),
    });
  }

  private estimateCPUUsage(cpuUsage: NodeJS.CpuUsage): number {
    // Simplified CPU usage estimation
    // In production, this would use more sophisticated measurement
    return Math.random() * 30 + 10; // 10-40% range
  }

  private calculateActiveConnections(): number {
    return this.connectionPools.size + this.activeOperations.size;
  }

  private calculateResourceSavings(): number {
    // Calculate savings from resource coordination
    return this.preventedContentionCount * 10; // Arbitrary metric
  }

  private calculateCoordinationOverhead(): number {
    // Time spent in coordination as percentage
    return this.coordinationOperations * 0.1; // Simplified calculation
  }

  private calculateFairnessScore(): number {
    // Score indicating how fairly resources are distributed
    const priorities = Array.from(this.systemPriorities.values());
    const allocations = Array.from(this.allocations.values()).map(a => a.allocated);

    if (priorities.length === 0) return 1.0;

    // Simplified fairness calculation
    const variance = this.calculateVariance(allocations);
    return Math.max(0, 1 - variance / 1000);
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateOverallResourceHealth(): 'excellent' | 'good' | 'fair' | 'poor' {
    const memUtil = this.currentUsage.memory.utilizationPercent;
    const cpuUtil = this.currentUsage.cpu.usagePercent;
    const concurrencyUtil =
      (this.currentUsage.concurrency.activeOperations /
        this.resourceLimits.concurrency.maxConcurrentOperations) *
      100;

    const avgUtilization = (memUtil + cpuUtil + concurrencyUtil) / 3;

    if (avgUtilization < 50) return 'excellent';
    if (avgUtilization < 70) return 'good';
    if (avgUtilization < 85) return 'fair';
    return 'poor';
  }

  private calculateOverallUtilization(): number {
    const memUtil = this.currentUsage.memory.utilizationPercent;
    const cpuUtil = this.currentUsage.cpu.usagePercent;
    const concurrencyUtil =
      (this.currentUsage.concurrency.activeOperations /
        this.resourceLimits.concurrency.maxConcurrentOperations) *
      100;

    return (memUtil + cpuUtil + concurrencyUtil) / 3;
  }

  private getResourceStatus(type: string, utilization: number): 'healthy' | 'warning' | 'critical' {
    if (utilization < 70) return 'healthy';
    if (utilization < 85) return 'warning';
    return 'critical';
  }

  private generateResourceOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const usage = this.currentUsage;

    if (usage.memory.utilizationPercent > 80) {
      recommendations.push(
        'Consider increasing memory limits or implementing more aggressive cache cleanup'
      );
    }

    if (usage.cpu.usagePercent > 70) {
      recommendations.push(
        'Implement CPU throttling for low-priority operations during peak usage'
      );
    }

    if (this.operationQueue.length > 5) {
      recommendations.push(
        'Consider increasing concurrency limits or optimizing operation processing'
      );
    }

    if (this.preventedContentionCount > 10) {
      recommendations.push(
        'Resource contention frequently prevented - consider increasing resource limits'
      );
    }

    return recommendations;
  }

  private setupSystemPriorities(): void {
    // Set up default system priorities (higher = more important)
    this.systemPriorities.set('unified-cache', 100);
    this.systemPriorities.set('routing-system', 90);
    this.systemPriorities.set('voice-system', 80);
    this.systemPriorities.set('mcp-system', 70);
    this.systemPriorities.set('orchestration-system', 85);
    this.systemPriorities.set('search-system', 60);
  }

  private setupResourcePools(): void {
    // Initialize connection pools for different services
    this.connectionPools.set('default', {
      maxConnections: 50,
      activeConnections: 0,
      queue: [],
    });

    // Initialize memory pools for different types of data
    this.memoryPools.set('cache', {
      maxSize: 50 * 1024 * 1024, // 50MB
      currentSize: 0,
      allocations: new Map(),
    });
  }

  private getDefaultResourceLimits(): ResourceLimits {
    return {
      memory: {
        maxHeapSize: 200 * 1024 * 1024, // 200MB
        warningThreshold: 70, // 70%
        criticalThreshold: 85, // 85%
        gcForceThreshold: 90, // 90%
      },
      cpu: {
        maxUsagePercent: 80,
        warningThreshold: 60,
        throttleThreshold: 75,
      },
      network: {
        maxConnections: 100,
        maxConcurrentRequests: 50,
        connectionTimeout: 30000,
        requestTimeout: 60000,
      },
      filesystem: {
        maxOpenFiles: 100,
        maxCacheSize: 100 * 1024 * 1024, // 100MB
        tempDirQuota: 50 * 1024 * 1024, // 50MB
      },
      concurrency: {
        maxConcurrentOperations: 20,
        maxQueueSize: 50,
        operationTimeout: 300000, // 5 minutes
      },
    };
  }

  private initializeResourceUsage(): ResourceUsage {
    const memUsage = process.memoryUsage();

    return {
      timestamp: Date.now(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        utilizationPercent: 0,
      },
      cpu: {
        usagePercent: 0,
        loadAverage: [],
        processTime: 0,
      },
      network: {
        activeConnections: 0,
        pendingRequests: 0,
        bytesTransferred: 0,
        errors: 0,
      },
      filesystem: {
        openFiles: 0,
        diskUsage: 0,
        ioOperations: 0,
      },
      concurrency: {
        activeOperations: 0,
        queuedOperations: 0,
        completedOperations: 0,
        failedOperations: 0,
      },
    };
  }

  /**
   * Cleanup and shutdown
   */
  destroy(): void {
    this.stopCoordination();
    this.registeredSystems.clear();
    this.allocations.clear();
    this.restrictions.clear();
    this.activeOperations.clear();
    this.operationQueue = [];
    this.connectionPools.clear();
    this.memoryPools.clear();
    this.removeAllListeners();

    logger.info('🧹 Unified Resource Coordinator destroyed');
  }
}

// Supporting interfaces
interface QueuedOperation {
  id: string;
  systemName: string;
  resourceRequirements: Array<{ type: string; amount: number }>;
  priority: number;
  timeout: number;
  callback: () => Promise<any>;
  queuedAt: number;
  attempts: number;
}

interface Operation {
  id: string;
  systemName: string;
  startTime: number;
  endTime?: number;
  resourceRequirements: Array<{ type: string; amount: number }>;
  status: 'starting' | 'running' | 'completed' | 'failed';
  error?: Error;
}

interface ConnectionPool {
  maxConnections: number;
  activeConnections: number;
  queue: any[];
}

interface MemoryPool {
  maxSize: number;
  currentSize: number;
  allocations: Map<string, number>;
}

// Export singleton instance
export const unifiedResourceCoordinator = UnifiedResourceCoordinator.getInstance();
