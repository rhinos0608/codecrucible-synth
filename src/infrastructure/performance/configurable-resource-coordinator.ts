/**
 * Resource Coordinator Factory - Non-Singleton Approach
 *
 * Creates UnifiedResourceCoordinator instances that can be dependency-injected
 * rather than using the singleton pattern.
 */

import { EventEmitter } from 'events';
import { logger } from '../logging/unified-logger.js';
import {
  ResourceLimits,
  ResourceUsage,
  ResourceAllocation,
  ResourceRestriction,
  ResourceAlert,
  ResourceCoordinationStats,
} from './unified-resource-coordinator.js';

/**
 * Local interfaces for internal coordination logic
 */
interface QueuedOperation {
  id: string;
  systemName: string;
  resourceType: 'memory' | 'cpu' | 'network' | 'filesystem' | 'concurrency';
  amount: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requestTime: number;
  status: 'queued' | 'allocated' | 'failed';
}

interface Operation {
  id: string;
  systemName: string;
  resourceType: 'memory' | 'cpu' | 'network' | 'filesystem' | 'concurrency';
  status: 'active' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  amount: number;
  error?: Error;
}

interface ConnectionPool {
  maxConnections: number;
  activeConnections: number;
  queue: string[];
}

interface MemoryPool {
  maxSize: number;
  currentSize: number;
  allocations: Map<string, number>;
}

/**
 * Configuration for creating a UnifiedResourceCoordinator
 */
export interface ResourceCoordinatorConfig {
  resourceLimits?: Partial<ResourceLimits>;
  monitoringInterval?: number;
  maxAlerts?: number;
  autoStart?: boolean;
  coordinatorId?: string;
}

/**
 * Dependency-Injectable Resource Coordinator
 *
 * This replaces the singleton pattern with a factory approach
 */
export class ConfigurableResourceCoordinator extends EventEmitter {
  private readonly coordinatorId: string;
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
  private disposed = false;

  constructor(config: ResourceCoordinatorConfig = {}) {
    super();

    this.coordinatorId =
      config.coordinatorId ?? `coord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.resourceLimits = { ...this.getDefaultResourceLimits(), ...config.resourceLimits };
    this.currentUsage = this.initializeResourceUsage();

    this.setupSystemPriorities();
    this.setupResourcePools();

    if (config.autoStart !== false) {
      this.startCoordination(config.monitoringInterval);
    }

    logger.info('⚡ Configurable Resource Coordinator initialized', {
      coordinatorId: this.coordinatorId,
      memoryLimit: `${(this.resourceLimits.memory.maxHeapSize / 1024 / 1024).toFixed(0)}MB`,
      concurrencyLimit: this.resourceLimits.concurrency.maxConcurrentOperations,
    });
  }

  /**
   * Get the coordinator ID for debugging and tracking
   */
  getCoordinatorId(): string {
    return this.coordinatorId;
  }

  /**
   * Start resource monitoring and coordination
   */
  startCoordination(intervalMs: number = 10000): void {
    if (this.disposed) {
      throw new Error('Cannot start coordination on disposed coordinator');
    }

    if (this.isMonitoring) {
      logger.warn('Resource coordination already started');
      return;
    }

    this.isMonitoring = true;
    this.monitoringIntervalId = setInterval(() => {
      void this.performResourceCoordination();
    }, intervalMs);

    logger.info('🚀 Resource coordination started', {
      coordinatorId: this.coordinatorId,
      interval: `${intervalMs}ms`,
      systems: this.registeredSystems.size,
    });

    // Perform initial coordination
    void this.performResourceCoordination();
  }

  /**
   * Stop resource coordination
   */
  stopCoordination(): void {
    if (!this.isMonitoring || !this.monitoringIntervalId) return;

    clearInterval(this.monitoringIntervalId);
    this.isMonitoring = false;
    this.monitoringIntervalId = undefined;

    logger.info('🛑 Resource coordination stopped', {
      coordinatorId: this.coordinatorId,
    });
  }

  /**
   * Register a system for resource coordination
   */
  registerSystem(name: string, priority: number = 50): void {
    if (this.disposed) {
      throw new Error('Cannot register system on disposed coordinator');
    }

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

    logger.info(`📋 Registered system for resource coordination: ${name} (priority: ${priority})`, {
      coordinatorId: this.coordinatorId,
    });
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
  ): Promise<string> {
    if (this.disposed) {
      throw new Error('Cannot request resource on disposed coordinator');
    }

    const operationId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const operation: QueuedOperation = {
      id: operationId,
      systemName,
      resourceType,
      amount,
      priority,
      requestTime: Date.now(),
      status: 'queued',
    };

    this.operationQueue.push(operation);
    this.emit('resource-requested', { operationId, systemName, resourceType, amount });

    // Process queue immediately if possible
    void this.processQueuedOperations();

    return operationId;
  }

  /**
   * Get resource coordination statistics
   */
  getCoordinationStats(): ResourceCoordinationStats & { coordinatorId: string } {
    return {
      coordinatorId: this.coordinatorId,
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
   * Dispose of the coordinator and clean up resources
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;

    this.disposed = true;
    this.stopCoordination();

    // Clean up all data structures
    this.registeredSystems.clear();
    this.allocations.clear();
    this.restrictions.clear();
    this.activeOperations.clear();
    this.operationQueue = [];
    this.connectionPools.clear();
    this.memoryPools.clear();
    this.removeAllListeners();

    logger.info('🧹 Configurable Resource Coordinator disposed', {
      coordinatorId: this.coordinatorId,
    });
  }

  /**
   * Check if the coordinator is disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  // The rest of the methods are copied from the original UnifiedResourceCoordinator
  // but with checks for disposal state

  private async performResourceCoordination(): Promise<void> {
    if (this.disposed) return;

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
        coordinatorId: this.coordinatorId,
        usage: this.currentUsage,
        activeOperations: this.activeOperations.size,
        queueSize: this.operationQueue.length,
      });
    } catch (error) {
      logger.error('Resource coordination cycle error:', error);
      this.emit('coordination-error', { coordinatorId: this.coordinatorId, error });
    }
  }

  private async updateResourceUsage(): Promise<void> {
    if (this.disposed) return;

    const memUsage = process.memoryUsage();

    this.currentUsage = {
      timestamp: Date.now(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        utilizationPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
      cpu: {
        usagePercent: 0, // Would need process monitoring to calculate
        loadAverage: [],
        processTime: process.uptime() * 1000,
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
        activeOperations: this.activeOperations.size,
        queuedOperations: this.operationQueue.length,
        completedOperations: 0,
        failedOperations: 0,
      },
    };
  }

  private async checkResourceViolations(): Promise<void> {
    if (this.disposed) return;

    const memoryViolation =
      this.currentUsage.memory.utilizationPercent > this.resourceLimits.memory.warningThreshold;
    const concurrencyViolation =
      this.currentUsage.concurrency.activeOperations >
      this.resourceLimits.concurrency.maxConcurrentOperations;

    if (memoryViolation || concurrencyViolation) {
      const alert: ResourceAlert = {
        level: 'warning',
        resourceType: memoryViolation ? 'memory' : 'concurrency',
        current: memoryViolation
          ? this.currentUsage.memory.utilizationPercent
          : this.currentUsage.concurrency.activeOperations,
        limit: memoryViolation
          ? this.resourceLimits.memory.warningThreshold
          : this.resourceLimits.concurrency.maxConcurrentOperations,
        message: memoryViolation
          ? `Memory usage ${this.currentUsage.memory.utilizationPercent.toFixed(1)}% exceeds warning threshold ${this.resourceLimits.memory.warningThreshold}%`
          : `Active operations ${this.currentUsage.concurrency.activeOperations} exceeds limit ${this.resourceLimits.concurrency.maxConcurrentOperations}`,
        timestamp: Date.now(),
      };

      this.alerts.push(alert);
      this.emit('resource-violation', alert);

      // Keep only recent alerts
      if (this.alerts.length > 100) {
        this.alerts = this.alerts.slice(-50);
      }
    }
  }

  private async processQueuedOperations(): Promise<void> {
    if (this.disposed || this.operationQueue.length === 0) return;

    // Process up to 3 operations per cycle
    const toProcess = this.operationQueue.splice(0, 3);

    for (const operation of toProcess) {
      try {
        // Simple allocation logic - in production this would be more sophisticated
        this.activeOperations.set(operation.id, {
          id: operation.id,
          systemName: operation.systemName,
          resourceType: operation.resourceType,
          status: 'active',
          startTime: Date.now(),
          amount: operation.amount,
        });

        operation.status = 'allocated';
        this.emit('resource-allocated', {
          operationId: operation.id,
          coordinatorId: this.coordinatorId,
        });
      } catch (error) {
        operation.status = 'failed';
        this.emit('resource-allocation-failed', {
          operationId: operation.id,
          coordinatorId: this.coordinatorId,
          error,
        });
      }
    }
  }

  private async cleanupExpiredResources(): Promise<void> {
    if (this.disposed) return;

    const now = Date.now();
    for (const [id, operation] of this.activeOperations.entries()) {
      if (operation.status === 'completed') {
        this.activeOperations.delete(id);
      } else if (now - operation.startTime > 300000) {
        // 5 minutes timeout
        operation.status = 'failed';
        operation.endTime = now;
        operation.error = new Error('Operation timeout');
        this.activeOperations.delete(id);
      }
    }
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

  private calculateResourceSavings(): number {
    return this.resourceSavings; // Simplified
  }

  private calculateCoordinationOverhead(): number {
    return Math.min(this.coordinationOperations * 0.1, 10); // Simplified
  }

  private calculateFairnessScore(): number {
    if (this.registeredSystems.size === 0) return 1.0;

    // Simple fairness calculation based on equal distribution
    const expectedAllocation = 1.0 / this.registeredSystems.size;
    let totalDeviation = 0;

    for (const allocation of this.allocations.values()) {
      const actualAllocation = allocation.used / (allocation.allocated || 1);
      totalDeviation += Math.abs(actualAllocation - expectedAllocation);
    }

    return Math.max(0, 1.0 - totalDeviation / this.registeredSystems.size);
  }
}

/**
 * Factory for creating configured resource coordinators
 */
export class ResourceCoordinatorFactory {
  private static defaultConfig: ResourceCoordinatorConfig = {
    monitoringInterval: 10000,
    maxAlerts: 100,
    autoStart: true,
  };

  /**
   * Set default configuration for all coordinators created by this factory
   */
  static setDefaults(config: Partial<ResourceCoordinatorConfig>): void {
    ResourceCoordinatorFactory.defaultConfig = {
      ...ResourceCoordinatorFactory.defaultConfig,
      ...config,
    };
  }

  /**
   * Create a new resource coordinator with the given configuration
   */
  static create(config: ResourceCoordinatorConfig = {}): ConfigurableResourceCoordinator {
    const fullConfig = { ...ResourceCoordinatorFactory.defaultConfig, ...config };
    return new ConfigurableResourceCoordinator(fullConfig);
  }

  /**
   * Create a test coordinator with minimal configuration
   */
  static createForTesting(
    config: Partial<ResourceCoordinatorConfig> = {}
  ): ConfigurableResourceCoordinator {
    const testConfig: ResourceCoordinatorConfig = {
      monitoringInterval: 100, // Fast for testing
      autoStart: false, // Don't auto-start in tests
      coordinatorId: `test_${Date.now()}`,
      resourceLimits: {
        memory: {
          maxHeapSize: 50 * 1024 * 1024, // 50MB for testing
          warningThreshold: 50,
          criticalThreshold: 70,
          gcForceThreshold: 80,
        },
        concurrency: {
          maxConcurrentOperations: 5,
          maxQueueSize: 20,
          operationTimeout: 30000,
        },
      },
      ...config,
    };

    return new ConfigurableResourceCoordinator(testConfig);
  }

  /**
   * Create a high-performance coordinator for production
   */
  static createHighPerformance(): ConfigurableResourceCoordinator {
    return new ConfigurableResourceCoordinator({
      coordinatorId: 'high_perf_coordinator',
      monitoringInterval: 5000, // More frequent monitoring
      resourceLimits: {
        memory: {
          maxHeapSize: 1024 * 1024 * 1024, // 1GB
          warningThreshold: 75,
          criticalThreshold: 90,
          gcForceThreshold: 95,
        },
        concurrency: {
          maxConcurrentOperations: 50,
          maxQueueSize: 200,
          operationTimeout: 300000,
        },
      },
    });
  }
}
