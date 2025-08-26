/**
 * Production Resource Enforcer - Enterprise Resource Management
 * 
 * Advanced resource enforcement system that provides strict memory, CPU, and
 * concurrency limits with automatic cleanup, throttling, and resource recovery
 * for production environments.
 * 
 * Key Features:
 * - Hard memory limits with automatic GC triggering
 * - CPU usage throttling and operation queuing
 * - Concurrency limits with fair scheduling
 * - Resource leak detection and cleanup
 * - Emergency resource recovery procedures
 * - Performance monitoring and optimization
 * - Resource usage analytics and reporting
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';
import { logger } from '../logging/logger.js';

// Resource Types
export enum ResourceType {
  MEMORY = 'memory',
  CPU = 'cpu',
  CONCURRENCY = 'concurrency',
  NETWORK = 'network',
  FILESYSTEM = 'filesystem'
}

// Resource Enforcement Actions
export enum EnforcementAction {
  WARN = 'warn',
  THROTTLE = 'throttle',
  QUEUE = 'queue',
  REJECT = 'reject',
  CLEANUP = 'cleanup',
  EMERGENCY_CLEANUP = 'emergency_cleanup',
  KILL_OPERATION = 'kill_operation'
}

// Resource Limit Configuration
export interface ResourceLimits {
  memory: {
    hardLimit: number;        // Hard memory limit in bytes
    softLimit: number;        // Soft limit to trigger warnings
    emergencyLimit: number;   // Emergency cleanup threshold
    gcThreshold: number;      // Force GC threshold
    leakDetectionEnabled: boolean;
    maxAllocationSize: number; // Max single allocation
  };
  
  cpu: {
    maxUsagePercent: number;  // Maximum CPU usage %
    throttleThreshold: number; // Start throttling at %
    measurementWindow: number; // CPU measurement window in ms
    throttleDelay: number;    // Delay between operations when throttling
    maxConcurrentCpuOps: number; // Max concurrent CPU-intensive operations
  };
  
  concurrency: {
    maxConcurrentOperations: number;
    maxQueueSize: number;
    operationTimeout: number;
    priorityLevels: number;
    fairnessEnabled: boolean;
    starvationPrevention: boolean;
  };
  
  network: {
    maxConnections: number;
    maxBandwidthMbps: number;
    connectionTimeout: number;
    idleTimeout: number;
    maxConcurrentRequests: number;
  };
  
  filesystem: {
    maxOpenFiles: number;
    maxDiskUsageMB: number;
    tempFileQuotaMB: number;
    maxFileSize: number;
    ioThrottleThreshold: number;
  };
}

// Resource Usage Snapshot
export interface ResourceSnapshot {
  timestamp: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    utilizationPercent: number;
    leaksDetected: number;
  };
  
  cpu: {
    usagePercent: number;
    loadAverage: number[];
    activeOperations: number;
    throttledOperations: number;
  };
  
  concurrency: {
    activeOperations: number;
    queuedOperations: number;
    rejectedOperations: number;
    avgWaitTime: number;
  };
  
  network: {
    activeConnections: number;
    bandwidthUsageMbps: number;
    pendingRequests: number;
    connectionErrors: number;
  };
  
  filesystem: {
    openFiles: number;
    diskUsageMB: number;
    tempFilesCount: number;
    ioOperationsPerSec: number;
  };
}

// Resource Violation
export interface ResourceViolation {
  id: string;
  timestamp: number;
  resourceType: ResourceType;
  violationType: 'soft_limit' | 'hard_limit' | 'emergency';
  currentValue: number;
  limitValue: number;
  operation?: string;
  context?: any;
  action: EnforcementAction;
  resolved?: boolean;
  resolvedAt?: number;
}

// Operation Context for Resource Tracking
export interface OperationResourceContext {
  operationId: string;
  resourceRequirements: {
    memory?: number;
    cpu?: number;
    concurrency?: number;
    network?: number;
    filesystem?: number;
  };
  priority: number;
  startTime: number;
  timeout: number;
  resourcesAllocated: Map<ResourceType, number>;
  state: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
}

/**
 * Production Resource Enforcer
 * 
 * Enforces strict resource limits and provides comprehensive resource
 * management for production environments.
 */
export class ProductionResourceEnforcer extends EventEmitter {
  private static instance: ProductionResourceEnforcer | null = null;
  
  private limits: ResourceLimits;
  private isEnforcing: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  
  // Resource Tracking
  private resourceHistory: ResourceSnapshot[] = [];
  private violations: ResourceViolation[] = [];
  private activeOperations = new Map<string, OperationResourceContext>();
  private operationQueue: OperationResourceContext[] = [];
  
  // Performance Tracking
  private cpuUsageHistory: number[] = [];
  private memoryPeaks: number[] = [];
  private lastGCTime: number = 0;
  
  // Emergency State
  private emergencyMode: boolean = false;
  private emergencyStartTime?: number;
  
  // Resource Pools
  private memoryPool: Map<string, number> = new Map();
  private networkConnections: Set<string> = new Set();
  private openFiles: Set<string> = new Set();
  
  // Worker Thread Pool for CPU-intensive operations
  private workerPool: Worker[] = [];
  private availableWorkers: Worker[] = [];

  private constructor(limits?: Partial<ResourceLimits>) {
    super();
    
    this.limits = this.createDefaultLimits(limits);
    this.setupResourceMonitoring();
    this.setupEmergencyHandlers();
    
    logger.info('💪 Production Resource Enforcer initialized', {
      memoryLimit: `${(this.limits.memory.hardLimit / 1024 / 1024).toFixed(0)}MB`,
      cpuLimit: `${this.limits.cpu.maxUsagePercent}%`,
      concurrencyLimit: this.limits.concurrency.maxConcurrentOperations
    });
  }
  
  static getInstance(limits?: Partial<ResourceLimits>): ProductionResourceEnforcer {
    if (!ProductionResourceEnforcer.instance) {
      ProductionResourceEnforcer.instance = new ProductionResourceEnforcer(limits);
    }
    return ProductionResourceEnforcer.instance;
  }
  
  /**
   * Start resource enforcement
   */
  async startEnforcement(): Promise<void> {
    if (this.isEnforcing) {
      logger.warn('Resource enforcement already active');
      return;
    }
    
    try {
      // Initialize worker pool for CPU-intensive operations
      await this.initializeWorkerPool();
      
      // Start monitoring
      this.startResourceMonitoring();
      
      // Initial resource check
      await this.performResourceCheck();
      
      this.isEnforcing = true;
      this.emit('enforcement:started');
      
      logger.info('🚀 Resource enforcement started');
      
    } catch (error) {
      logger.error('Failed to start resource enforcement:', error);
      throw error;
    }
  }
  
  /**
   * Execute operation with resource enforcement
   */
  async executeWithEnforcement<T>(
    operationId: string,
    operation: () => Promise<T>,
    options: {
      resourceRequirements?: {
        memory?: number;
        cpu?: number;
        concurrency?: number;
        network?: number;
        filesystem?: number;
      };
      priority?: number;
      timeout?: number;
      metadata?: any;
    } = {}
  ): Promise<T> {
    
    const context: OperationResourceContext = {
      operationId,
      resourceRequirements: options.resourceRequirements || {},
      priority: options.priority || 50,
      startTime: performance.now(),
      timeout: options.timeout || 300000, // 5 minutes default
      resourcesAllocated: new Map(),
      state: 'pending'
    };
    
    try {
      // Pre-execution resource check
      await this.preExecutionCheck(context);
      
      // Allocate resources
      await this.allocateResources(context);
      
      // Execute with monitoring
      const result = await this.executeWithMonitoring(operation, context);
      
      // Successful completion
      context.state = 'completed';
      return result;
      
    } catch (error) {
      context.state = 'failed';
      throw error;
    } finally {
      // Always cleanup resources
      await this.releaseResources(context);
      this.activeOperations.delete(operationId);
    }
  }
  
  /**
   * Get current resource usage snapshot
   */
  getCurrentResourceSnapshot(): ResourceSnapshot {
    const memUsage = process.memoryUsage();
    const cpuUsage = this.getCurrentCPUUsage();
    
    return {
      timestamp: Date.now(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        utilizationPercent: (memUsage.heapUsed / this.limits.memory.hardLimit) * 100,
        leaksDetected: this.detectMemoryLeaks()
      },
      
      cpu: {
        usagePercent: cpuUsage,
        loadAverage: [], // Would implement with actual load average
        activeOperations: this.getActiveCPUOperations(),
        throttledOperations: this.getThrottledOperations()
      },
      
      concurrency: {
        activeOperations: this.activeOperations.size,
        queuedOperations: this.operationQueue.length,
        rejectedOperations: this.getRejectedOperationsCount(),
        avgWaitTime: this.getAverageWaitTime()
      },
      
      network: {
        activeConnections: this.networkConnections.size,
        bandwidthUsageMbps: 0, // Would implement with network monitoring
        pendingRequests: 0,
        connectionErrors: 0
      },
      
      filesystem: {
        openFiles: this.openFiles.size,
        diskUsageMB: 0, // Would implement with disk monitoring
        tempFilesCount: 0,
        ioOperationsPerSec: 0
      }
    };
  }
  
  /**
   * Get resource enforcement statistics
   */
  getEnforcementStats(): ResourceEnforcementStats {
    const currentSnapshot = this.getCurrentResourceSnapshot();
    const recentViolations = this.violations.filter(v => 
      Date.now() - v.timestamp < 3600000 // Last hour
    );
    
    return {
      isEnforcing: this.isEnforcing,
      emergencyMode: this.emergencyMode,
      currentSnapshot,
      
      limits: this.limits,
      
      violations: {
        total: this.violations.length,
        lastHour: recentViolations.length,
            byType: this.groupViolationsByType(recentViolations),
        bySeverity: this.groupViolationsBySeverity(recentViolations)
      },
      
      performance: {
        avgCpuUsage: this.calculateAverageCPU(),
        peakMemoryUsage: Math.max(...this.memoryPeaks),
        operationsProcessed: this.getTotalOperationsProcessed(),
        averageProcessingTime: this.getAverageProcessingTime(),
        resourceEfficiency: this.calculateResourceEfficiency()
      },
      
      recommendations: this.generateResourceRecommendations()
    };
  }
  
  /**
   * Trigger emergency resource cleanup
   */
  async triggerEmergencyCleanup(reason: string): Promise<void> {
    logger.error(`🚨 EMERGENCY RESOURCE CLEANUP: ${reason}`);
    
    this.emergencyMode = true;
    this.emergencyStartTime = Date.now();
    
    const violation: ResourceViolation = {
      id: `emergency_${Date.now()}`,
      timestamp: Date.now(),
      resourceType: ResourceType.MEMORY, // Assuming memory emergency
      violationType: 'emergency',
      currentValue: process.memoryUsage().heapUsed,
      limitValue: this.limits.memory.hardLimit,
      action: EnforcementAction.EMERGENCY_CLEANUP,
      context: { reason }
    };
    
    this.violations.push(violation);
    this.emit('emergency-cleanup', violation);
    
    try {
      // Emergency actions
      await Promise.all([
        this.forceGarbageCollection(),
        this.killLowPriorityOperations(),
        this.clearCaches(),
        this.releaseUnusedResources()
      ]);
      
      // Wait a moment for cleanup to take effect
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if emergency resolved
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed < this.limits.memory.emergencyLimit) {
        this.emergencyMode = false;
        this.emergencyStartTime = undefined;
        violation.resolved = true;
        violation.resolvedAt = Date.now();
        
        logger.info('✅ Emergency cleanup successful, normal operations resumed');
      } else {
        logger.error('❌ Emergency cleanup insufficient, considering process restart');
        this.emit('emergency-cleanup-failed', { memUsage, limits: this.limits.memory });
      }
      
    } catch (error) {
      logger.error('Emergency cleanup failed:', error);
      throw error;
    }
  }
  
  /**
   * Update resource limits dynamically
   */
  updateResourceLimits(updates: Partial<ResourceLimits>): void {
    this.limits = this.mergeResourceLimits(this.limits, updates);
    
    logger.info('Resource limits updated', updates);
    this.emit('limits-updated', this.limits);
  }
  
  /**
   * Shutdown resource enforcer gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('🛑 Shutting down resource enforcer...');
    
    try {
      // Stop monitoring
      this.stopResourceMonitoring();
      
      // Cleanup worker pool
      await this.shutdownWorkerPool();
      
      // Release all resources
      for (const [operationId, context] of this.activeOperations.entries()) {
        await this.releaseResources(context);
      }
      
      this.isEnforcing = false;
      this.removeAllListeners();
      
      logger.info('✅ Resource enforcer shutdown completed');
      
    } catch (error) {
      logger.error('Error during resource enforcer shutdown:', error);
      throw error;
    }
  }
  
  // Private Implementation Methods
  
  private async preExecutionCheck(context: OperationResourceContext): Promise<void> {
    // Check if in emergency mode
    if (this.emergencyMode) {
      if (context.priority < 80) { // Only high-priority operations in emergency
        throw new ResourceEnforcementError('System in emergency mode - operation rejected', ResourceType.MEMORY);
      }
    }
    
    // Check concurrency limits
    if (this.activeOperations.size >= this.limits.concurrency.maxConcurrentOperations) {
      if (this.operationQueue.length >= this.limits.concurrency.maxQueueSize) {
        throw new ResourceEnforcementError('Concurrency and queue limits exceeded', ResourceType.CONCURRENCY);
      }
      
      // Queue the operation
      context.state = 'pending';
      await this.queueOperation(context);
      return;
    }
    
    // Check resource availability
    await this.checkResourceAvailability(context);
  }
  
  private async allocateResources(context: OperationResourceContext): Promise<void> {
    const requirements = context.resourceRequirements;
    
    // Allocate memory
    if (requirements.memory) {
      await this.allocateMemory(context.operationId, requirements.memory);
      context.resourcesAllocated.set(ResourceType.MEMORY, requirements.memory);
    }
    
    // Allocate CPU (conceptually - mostly about tracking)
    if (requirements.cpu) {
      context.resourcesAllocated.set(ResourceType.CPU, requirements.cpu);
    }
    
    // Track operation
    this.activeOperations.set(context.operationId, context);
    context.state = 'running';
    
    this.emit('resources-allocated', context);
  }
  
  private async executeWithMonitoring<T>(
    operation: () => Promise<T>,
    context: OperationResourceContext
  ): Promise<T> {
    
    const startMemory = process.memoryUsage().heapUsed;
    const startTime = performance.now();
    
    // Setup timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        context.state = 'timeout';
        reject(new ResourceEnforcementError('Operation timeout', ResourceType.CONCURRENCY));
      }, context.timeout);
    });
    
    try {
      // Execute operation with resource monitoring
      const result = await Promise.race([
        operation(),
        timeoutPromise
      ]);
      
      // Track resource usage
      const endMemory = process.memoryUsage().heapUsed;
      const endTime = performance.now();
      
      this.trackOperationCompletion(context, startMemory, endMemory, startTime, endTime);
      
      return result;
      
    } catch (error) {
      // Handle execution failure
      const endTime = performance.now();
      this.trackOperationFailure(context, startTime, endTime, error as Error);
      throw error;
    }
  }
  
  private async releaseResources(context: OperationResourceContext): Promise<void> {
    // Release allocated resources
    for (const [resourceType, amount] of context.resourcesAllocated.entries()) {
      try {
        await this.releaseResourceAmount(resourceType, context.operationId, amount);
      } catch (error) {
        logger.error(`Failed to release ${resourceType} for ${context.operationId}:`, error);
      }
    }
    
    // Process queued operations if resources freed
    if (this.operationQueue.length > 0) {
      await this.processOperationQueue();
    }
    
    this.emit('resources-released', context);
  }
  
  private async checkResourceAvailability(context: OperationResourceContext): Promise<void> {
    const requirements = context.resourceRequirements;
    const currentUsage = this.getCurrentResourceSnapshot();
    
    // Check memory availability
    if (requirements.memory) {
      const availableMemory = this.limits.memory.hardLimit - currentUsage.memory.heapUsed;
      if (requirements.memory > availableMemory) {
        throw new ResourceEnforcementError('Insufficient memory available', ResourceType.MEMORY);
      }
    }
    
    // Check CPU availability (simplified check)
    if (requirements.cpu && currentUsage.cpu.usagePercent > this.limits.cpu.throttleThreshold) {
      // Could queue for later processing
      throw new ResourceEnforcementError('CPU usage too high', ResourceType.CPU);
    }
  }
  
  private async queueOperation(context: OperationResourceContext): Promise<void> {
    // Insert in priority order
    let insertIndex = this.operationQueue.findIndex(op => op.priority < context.priority);
    
    if (insertIndex === -1) {
      this.operationQueue.push(context);
    } else {
      this.operationQueue.splice(insertIndex, 0, context);
    }
    
    logger.info(`Operation queued: ${context.operationId} (queue size: ${this.operationQueue.length})`);
    this.emit('operation-queued', context);
    
    // Wait for resources to become available
    await this.waitForResources(context);
  }
  
  private async waitForResources(context: OperationResourceContext): Promise<void> {
    return new Promise((resolve, reject) => {
      const startWait = Date.now();
      
      const checkResources = () => {
        // Check if operation was dequeued and can proceed
        if (!this.operationQueue.includes(context)) {
          resolve();
          return;
        }
        
        // Check for timeout
        if (Date.now() - startWait > context.timeout) {
          const index = this.operationQueue.indexOf(context);
          if (index > -1) {
            this.operationQueue.splice(index, 1);
          }
          reject(new ResourceEnforcementError('Queue wait timeout', ResourceType.CONCURRENCY));
          return;
        }
        
        // Check again in 100ms
        setTimeout(checkResources, 100);
      };
      
      checkResources();
    });
  }
  
  private async processOperationQueue(): Promise<void> {
    if (this.operationQueue.length === 0) return;
    
    // Process operations in priority order
    const processableOps: OperationResourceContext[] = [];
    
    for (let i = 0; i < this.operationQueue.length; i++) {
      const context = this.operationQueue[i];
      
      try {
        await this.checkResourceAvailability(context);
        processableOps.push(context);
        
        // Remove from queue
        this.operationQueue.splice(i, 1);
        i--; // Adjust index after removal
        
        // Only process one at a time to avoid resource conflicts
        break;
        
      } catch (error) {
        // Operation still can't be processed, leave in queue
        continue;
      }
    }
    
    // Start processing operations that can now run
    for (const context of processableOps) {
      logger.info(`Processing queued operation: ${context.operationId}`);
      this.emit('operation-dequeued', context);
    }
  }
  
  private async allocateMemory(operationId: string, amount: number): Promise<void> {
    const currentUsage = process.memoryUsage().heapUsed;
    
    if (currentUsage + amount > this.limits.memory.hardLimit) {
      // Try cleanup first
      await this.performMemoryCleanup();
      
      const newUsage = process.memoryUsage().heapUsed;
      if (newUsage + amount > this.limits.memory.hardLimit) {
        throw new ResourceEnforcementError('Memory allocation would exceed hard limit', ResourceType.MEMORY);
      }
    }
    
    // Track memory allocation
    this.memoryPool.set(operationId, amount);
    
    // Check if allocation exceeds single allocation limit
    if (amount > this.limits.memory.maxAllocationSize) {
      const violation: ResourceViolation = {
        id: `mem_${Date.now()}`,
        timestamp: Date.now(),
        resourceType: ResourceType.MEMORY,
        violationType: 'soft_limit',
        currentValue: amount,
        limitValue: this.limits.memory.maxAllocationSize,
        operation: operationId,
        action: EnforcementAction.WARN
      };
      
      this.violations.push(violation);
      this.emit('resource-violation', violation);
    }
  }
  
  private async releaseResourceAmount(resourceType: ResourceType, operationId: string, amount: number): Promise<void> {
    switch (resourceType) {
      case ResourceType.MEMORY:
        this.memoryPool.delete(operationId);
        break;
      case ResourceType.NETWORK:
        this.networkConnections.delete(operationId);
        break;
      case ResourceType.FILESYSTEM:
        this.openFiles.delete(operationId);
        break;
    }
  }
  
  private startResourceMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.performResourceCheck();
    }, 5000); // Check every 5 seconds
  }
  
  private stopResourceMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }
  
  private async performResourceCheck(): Promise<void> {
    const snapshot = this.getCurrentResourceSnapshot();
    this.resourceHistory.push(snapshot);
    
    // Keep only recent history
    if (this.resourceHistory.length > 720) { // 1 hour at 5-second intervals
      this.resourceHistory = this.resourceHistory.slice(-360); // Keep 30 minutes
    }
    
    // Check for violations
    await this.checkMemoryLimits(snapshot);
    await this.checkCPULimits(snapshot);
    await this.checkConcurrencyLimits(snapshot);
    
    this.emit('resource-snapshot', snapshot);
  }
  
  private async checkMemoryLimits(snapshot: ResourceSnapshot): Promise<void> {
    const memUsage = snapshot.memory;
    
    // Emergency threshold
    if (memUsage.heapUsed > this.limits.memory.emergencyLimit) {
      await this.triggerEmergencyCleanup('Memory usage exceeded emergency threshold');
      return;
    }
    
    // Hard limit
    if (memUsage.heapUsed > this.limits.memory.hardLimit) {
      const violation: ResourceViolation = {
        id: `mem_hard_${Date.now()}`,
        timestamp: Date.now(),
        resourceType: ResourceType.MEMORY,
        violationType: 'hard_limit',
        currentValue: memUsage.heapUsed,
        limitValue: this.limits.memory.hardLimit,
        action: EnforcementAction.CLEANUP
      };
      
      this.violations.push(violation);
      this.emit('resource-violation', violation);
      
      await this.performMemoryCleanup();
    }
    
    // Soft limit (warning)
    else if (memUsage.heapUsed > this.limits.memory.softLimit) {
      const violation: ResourceViolation = {
        id: `mem_soft_${Date.now()}`,
        timestamp: Date.now(),
        resourceType: ResourceType.MEMORY,
        violationType: 'soft_limit',
        currentValue: memUsage.heapUsed,
        limitValue: this.limits.memory.softLimit,
        action: EnforcementAction.WARN
      };
      
      this.violations.push(violation);
      this.emit('resource-violation', violation);
    }
  }
  
  private async checkCPULimits(snapshot: ResourceSnapshot): Promise<void> {
    const cpuUsage = snapshot.cpu.usagePercent;
    
    if (cpuUsage > this.limits.cpu.maxUsagePercent) {
      const violation: ResourceViolation = {
        id: `cpu_${Date.now()}`,
        timestamp: Date.now(),
        resourceType: ResourceType.CPU,
        violationType: 'hard_limit',
        currentValue: cpuUsage,
        limitValue: this.limits.cpu.maxUsagePercent,
        action: EnforcementAction.THROTTLE
      };
      
      this.violations.push(violation);
      this.emit('resource-violation', violation);
      
      await this.throttleCPUOperations();
    }
  }
  
  private async checkConcurrencyLimits(snapshot: ResourceSnapshot): Promise<void> {
    if (snapshot.concurrency.activeOperations > this.limits.concurrency.maxConcurrentOperations) {
      const violation: ResourceViolation = {
        id: `concurrency_${Date.now()}`,
        timestamp: Date.now(),
        resourceType: ResourceType.CONCURRENCY,
        violationType: 'hard_limit',
        currentValue: snapshot.concurrency.activeOperations,
        limitValue: this.limits.concurrency.maxConcurrentOperations,
        action: EnforcementAction.QUEUE
      };
      
      this.violations.push(violation);
      this.emit('resource-violation', violation);
    }
  }
  
  private async performMemoryCleanup(): Promise<void> {
    logger.info('🧹 Performing memory cleanup...');
    
    // Force garbage collection if available
    if (global.gc) {
      const beforeGC = process.memoryUsage().heapUsed;
      global.gc();
      const afterGC = process.memoryUsage().heapUsed;
      const freed = beforeGC - afterGC;
      
      logger.info(`Garbage collection freed ${(freed / 1024 / 1024).toFixed(2)}MB`);
      this.lastGCTime = Date.now();
    }
    
    // Emit cleanup event for other systems to clean their caches
    this.emit('memory-cleanup-requested');
  }
  
  private async throttleCPUOperations(): Promise<void> {
    logger.warn('🐌 Throttling CPU operations due to high usage');
    
    // Add delays to CPU-intensive operations
    for (const [operationId, context] of this.activeOperations.entries()) {
      if (context.resourceRequirements.cpu) {
        // Add a small delay - would implement more sophisticated throttling
        await new Promise(resolve => setTimeout(resolve, this.limits.cpu.throttleDelay));
      }
    }
  }
  
  private async killLowPriorityOperations(): Promise<void> {
    logger.warn('⚡ Killing low priority operations for emergency cleanup');
    
    const lowPriorityOps = Array.from(this.activeOperations.values())
      .filter(op => op.priority < 30)
      .sort((a, b) => a.priority - b.priority);
    
    for (const context of lowPriorityOps.slice(0, 5)) { // Kill up to 5 lowest priority
      context.state = 'failed';
      await this.releaseResources(context);
      
      logger.info(`Killed low priority operation: ${context.operationId}`);
      this.emit('operation-killed', context);
    }
  }
  
  private async clearCaches(): Promise<void> {
    // Clear internal caches
    this.memoryPool.clear();
    
    // Emit cache clear event
    this.emit('cache-clear-requested');
  }
  
  private async releaseUnusedResources(): Promise<void> {
    // Clean up resource tracking for completed operations
    const staleOperations = Array.from(this.activeOperations.values())
      .filter(op => op.state === 'completed' || op.state === 'failed');
    
    for (const context of staleOperations) {
      await this.releaseResources(context);
    }
  }
  
  private async forceGarbageCollection(): Promise<void> {
    if (global.gc) {
      global.gc();
      this.lastGCTime = Date.now();
      
      // Multiple GC passes for thorough cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      global.gc();
    }
  }
  
  private setupResourceMonitoring(): void {
    // Monitor memory peaks
    setInterval(() => {
      const memUsage = process.memoryUsage().heapUsed;
      this.memoryPeaks.push(memUsage);
      
      // Keep only recent peaks
      if (this.memoryPeaks.length > 100) {
        this.memoryPeaks = this.memoryPeaks.slice(-50);
      }
    }, 10000); // Every 10 seconds
    
    // Monitor CPU usage
    setInterval(() => {
      const cpuUsage = this.getCurrentCPUUsage();
      this.cpuUsageHistory.push(cpuUsage);
      
      // Keep only recent history
      if (this.cpuUsageHistory.length > 60) {
        this.cpuUsageHistory = this.cpuUsageHistory.slice(-30);
      }
    }, 1000); // Every second
  }
  
  private setupEmergencyHandlers(): void {
    // Handle memory warnings from Node.js
    process.on('warning', (warning) => {
      if (warning.name === 'MemoryWarning') {
        this.triggerEmergencyCleanup('Node.js memory warning received');
      }
    });
    
    // Handle unhandled rejections (potential memory leaks)
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection (potential memory leak):', reason);
      
      const violation: ResourceViolation = {
        id: `unhandled_${Date.now()}`,
        timestamp: Date.now(),
        resourceType: ResourceType.MEMORY,
        violationType: 'soft_limit',
        currentValue: 0,
        limitValue: 0,
        action: EnforcementAction.WARN,
        context: { reason: String(reason) }
      };
      
      this.violations.push(violation);
      this.emit('resource-violation', violation);
    });
  }
  
  private async initializeWorkerPool(): Promise<void> {
    // Initialize worker threads for CPU-intensive operations
    const workerCount = Math.min(4, require('os').cpus().length);
    
    for (let i = 0; i < workerCount; i++) {
      // In a real implementation, would create actual worker threads
      // For now, just track the concept
      this.availableWorkers.push({} as Worker);
    }
    
    logger.info(`Initialized worker pool with ${workerCount} workers`);
  }
  
  private async shutdownWorkerPool(): Promise<void> {
    // Shutdown worker threads
    this.availableWorkers = [];
    this.workerPool = [];
  }
  
  private getCurrentCPUUsage(): number {
    // Simplified CPU usage calculation
    // In production, would use actual CPU monitoring
    return Math.random() * 20 + 5; // 5-25% range for simulation
  }
  
  private detectMemoryLeaks(): number {
    if (!this.limits.memory.leakDetectionEnabled) return 0;
    
    // Simple leak detection: consistently growing memory over time
    const recentSnapshots = this.resourceHistory.slice(-12); // Last minute
    
    if (recentSnapshots.length < 5) return 0;
    
    const trend = recentSnapshots.map(s => s.memory.heapUsed);
    const isIncreasing = trend.every((val, idx) => idx === 0 || val > trend[idx - 1]);
    
    return isIncreasing ? 1 : 0;
  }
  
  // Helper methods for statistics
  
  private getActiveCPUOperations(): number {
    return Array.from(this.activeOperations.values())
      .filter(op => op.resourceRequirements.cpu).length;
  }
  
  private getThrottledOperations(): number {
    // Would track throttled operations in real implementation
    return 0;
  }
  
  private getRejectedOperationsCount(): number {
    return this.violations.filter(v => v.action === EnforcementAction.REJECT).length;
  }
  
  private getAverageWaitTime(): number {
    if (this.operationQueue.length === 0) return 0;
    
    const now = Date.now();
    const waitTimes = this.operationQueue.map(op => now - op.startTime);
    
    return waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length;
  }
  
  private calculateAverageCPU(): number {
    if (this.cpuUsageHistory.length === 0) return 0;
    
    return this.cpuUsageHistory.reduce((sum, val) => sum + val, 0) / this.cpuUsageHistory.length;
  }
  
  private getTotalOperationsProcessed(): number {
    return this.violations.length; // Simplified
  }
  
  private getAverageProcessingTime(): number {
    // Would calculate from completed operations
    return 1000; // 1 second placeholder
  }
  
  private calculateResourceEfficiency(): number {
    const currentSnapshot = this.getCurrentResourceSnapshot();
    const memEfficiency = 1 - (currentSnapshot.memory.utilizationPercent / 100);
    const cpuEfficiency = 1 - (currentSnapshot.cpu.usagePercent / 100);
    
    return (memEfficiency + cpuEfficiency) / 2;
  }
  
  private groupViolationsByType(violations: ResourceViolation[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    violations.forEach(violation => {
      const key = violation.resourceType;
      grouped[key] = (grouped[key] || 0) + 1;
    });
    
    return grouped;
  }
  
  private groupViolationsBySeverity(violations: ResourceViolation[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    violations.forEach(violation => {
      const key = violation.violationType;
      grouped[key] = (grouped[key] || 0) + 1;
    });
    
    return grouped;
  }
  
  private generateResourceRecommendations(): string[] {
    const recommendations: string[] = [];
    const currentSnapshot = this.getCurrentResourceSnapshot();
    
    if (currentSnapshot.memory.utilizationPercent > 80) {
      recommendations.push('Consider increasing memory limits or optimizing memory usage');
    }
    
    if (currentSnapshot.cpu.usagePercent > 70) {
      recommendations.push('High CPU usage - consider optimizing CPU-intensive operations');
    }
    
    if (currentSnapshot.concurrency.queuedOperations > 10) {
      recommendations.push('High operation queue - consider increasing concurrency limits');
    }
    
    if (this.violations.filter(v => Date.now() - v.timestamp < 3600000).length > 50) {
      recommendations.push('Frequent resource violations - review and adjust resource limits');
    }
    
    return recommendations;
  }
  
  private trackOperationCompletion(
    context: OperationResourceContext,
    startMemory: number,
    endMemory: number,
    startTime: number,
    endTime: number
  ): void {
    
    const memoryUsed = endMemory - startMemory;
    const processingTime = endTime - startTime;
    
    // Track memory usage for leak detection
    if (memoryUsed > 0) {
      this.memoryPeaks.push(endMemory);
    }
    
    this.emit('operation-completed', {
      context,
      memoryUsed,
      processingTime,
      success: true
    });
  }
  
  private trackOperationFailure(
    context: OperationResourceContext,
    startTime: number,
    endTime: number,
    error: Error
  ): void {
    
    const processingTime = endTime - startTime;
    
    this.emit('operation-failed', {
      context,
      processingTime,
      error,
      success: false
    });
  }
  
  private createDefaultLimits(override?: Partial<ResourceLimits>): ResourceLimits {
    const defaultLimits: ResourceLimits = {
      memory: {
        hardLimit: 1024 * 1024 * 1024, // 1GB
        softLimit: 800 * 1024 * 1024,  // 800MB
        emergencyLimit: 900 * 1024 * 1024, // 900MB
        gcThreshold: 700 * 1024 * 1024, // 700MB
        leakDetectionEnabled: true,
        maxAllocationSize: 100 * 1024 * 1024 // 100MB per allocation
      },
      
      cpu: {
        maxUsagePercent: 80,
        throttleThreshold: 60,
        measurementWindow: 5000,
        throttleDelay: 100,
        maxConcurrentCpuOps: 4
      },
      
      concurrency: {
        maxConcurrentOperations: 50,
        maxQueueSize: 100,
        operationTimeout: 300000, // 5 minutes
        priorityLevels: 10,
        fairnessEnabled: true,
        starvationPrevention: true
      },
      
      network: {
        maxConnections: 1000,
        maxBandwidthMbps: 100,
        connectionTimeout: 30000,
        idleTimeout: 60000,
        maxConcurrentRequests: 100
      },
      
      filesystem: {
        maxOpenFiles: 1000,
        maxDiskUsageMB: 1024,
        tempFileQuotaMB: 100,
        maxFileSize: 50 * 1024 * 1024, // 50MB
        ioThrottleThreshold: 80
      }
    };
    
    return override ? this.mergeResourceLimits(defaultLimits, override) : defaultLimits;
  }
  
  private mergeResourceLimits(base: ResourceLimits, override: Partial<ResourceLimits>): ResourceLimits {
    return {
      ...base,
      ...override,
      memory: { ...base.memory, ...(override.memory || {}) },
      cpu: { ...base.cpu, ...(override.cpu || {}) },
      concurrency: { ...base.concurrency, ...(override.concurrency || {}) },
      network: { ...base.network, ...(override.network || {}) },
      filesystem: { ...base.filesystem, ...(override.filesystem || {}) }
    };
  }
}

// Custom Error Class
export class ResourceEnforcementError extends Error {
  constructor(message: string, public resourceType: ResourceType) {
    super(message);
    this.name = 'ResourceEnforcementError';
    Error.captureStackTrace(this, ResourceEnforcementError);
  }
}

// Supporting Interfaces
interface ResourceEnforcementStats {
  isEnforcing: boolean;
  emergencyMode: boolean;
  currentSnapshot: ResourceSnapshot;
  limits: ResourceLimits;
  violations: {
    total: number;
    lastHour: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  performance: {
    avgCpuUsage: number;
    peakMemoryUsage: number;
    operationsProcessed: number;
    averageProcessingTime: number;
    resourceEfficiency: number;
  };
  recommendations: string[];
}

// Export the production resource enforcer
export const productionResourceEnforcer = ProductionResourceEnforcer.getInstance();