/**
 * 2025 Memory Optimization Patterns for CLI AI Applications
 * Implements advanced memory management, leak prevention, and resource cleanup
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { logger } from '../logging/logger.js';

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
  timestamp: number;
}

export interface ResourceTracker {
  id: string;
  type: 'interval' | 'timeout' | 'eventemitter' | 'stream' | 'connection';
  created: number;
  lastAccessed: number;
  cleanup: () => void;
  priority: number; // Lower = higher priority for cleanup
}

export class MemoryOptimizer2025 extends EventEmitter {
  private static instance: MemoryOptimizer2025;
  
  private resourceTrackers = new Map<string, ResourceTracker>();
  private memorySnapshots: MemoryMetrics[] = [];
  private cleanupScheduled = false;
  private gcScheduled = false;
  private maxSnapshotHistory = 20; // Reduced from potential 100+
  
  // 2025 Pattern: Adaptive Memory Thresholds
  private memoryThresholds = {
    warning: 100 * 1024 * 1024, // 100MB
    critical: 200 * 1024 * 1024, // 200MB
    emergency: 512 * 1024 * 1024, // 512MB
  };

  // 2025 Pattern: Intelligent Cleanup Intervals
  private cleanupConfig = {
    intervalMs: 30000, // 30 seconds
    aggressiveCleanupAfterMs: 300000, // 5 minutes
    emergencyCleanupThresholdMs: 60000, // 1 minute
  };

  private constructor() {
    super();
    this.setMaxListeners(0); // Unlimited listeners for internal events
    this.initializeMemoryMonitoring();
    this.setupGlobalCleanupHandlers();
  }

  static getInstance(): MemoryOptimizer2025 {
    if (!MemoryOptimizer2025.instance) {
      MemoryOptimizer2025.instance = new MemoryOptimizer2025();
    }
    return MemoryOptimizer2025.instance;
  }

  /**
   * 2025 Pattern: Smart Resource Registration with Auto-cleanup
   */
  registerResource(resource: Omit<ResourceTracker, 'created' | 'lastAccessed'>): string {
    const id = resource.id || `${resource.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const tracker: ResourceTracker = {
      ...resource,
      id,
      created: performance.now(),
      lastAccessed: performance.now(),
    };

    this.resourceTrackers.set(id, tracker);
    
    // 2025 Pattern: Auto-cleanup for long-running resources
    setTimeout(() => {
      this.checkResourceForCleanup(id);
    }, this.cleanupConfig.aggressiveCleanupAfterMs);

    logger.debug(`Resource registered: ${id} (${resource.type})`);
    return id;
  }

  /**
   * 2025 Pattern: Immediate Resource Deregistration
   */
  unregisterResource(id: string): void {
    const tracker = this.resourceTrackers.get(id);
    if (tracker) {
      try {
        tracker.cleanup();
      } catch (error) {
        logger.warn(`Error during resource cleanup for ${id}:`, error);
      }
      this.resourceTrackers.delete(id);
      logger.debug(`Resource unregistered: ${id}`);
    }
  }

  /**
   * 2025 Pattern: Interval Registration with Auto-cleanup
   */
  registerInterval(callback: () => void, intervalMs: number, priority: number = 5): string {
    const intervalId = setInterval(callback, intervalMs);
    
    return this.registerResource({
      id: `interval-${intervalId}`,
      type: 'interval',
      cleanup: () => clearInterval(intervalId),
      priority,
    });
  }

  /**
   * 2025 Pattern: Timeout Registration with Auto-cleanup
   */
  registerTimeout(callback: () => void, timeoutMs: number, priority: number = 5): string {
    const timeoutId = setTimeout(() => {
      callback();
      this.unregisterResource(trackerId);
    }, timeoutMs);
    
    const trackerId = this.registerResource({
      id: `timeout-${timeoutId}`,
      type: 'timeout',
      cleanup: () => clearTimeout(timeoutId),
      priority,
    });

    return trackerId;
  }

  /**
   * 2025 Pattern: EventEmitter Registration with Listener Tracking
   */
  registerEventEmitter(emitter: EventEmitter, name: string, priority: number = 5): string {
    const originalEmit = emitter.emit.bind(emitter);
    let listenerCount = 0;

    // Track listener additions
    const originalOn = emitter.on.bind(emitter);
    emitter.on = (event: any, listener: any) => {
      listenerCount++;
      return originalOn(event, listener);
    };

    // Track listener removals
    const originalOff = emitter.removeListener.bind(emitter);
    emitter.removeListener = (event: any, listener: any) => {
      listenerCount--;
      return originalOff(event, listener);
    };

    return this.registerResource({
      id: `eventemitter-${name}`,
      type: 'eventemitter',
      cleanup: () => {
        emitter.removeAllListeners();
        logger.debug(`Cleaned up EventEmitter: ${name} (${listenerCount} listeners removed)`);
      },
      priority,
    });
  }

  /**
   * 2025 Pattern: Memory Pressure Detection with Adaptive Response
   */
  private initializeMemoryMonitoring(): void {
    const monitoringId = this.registerInterval(() => {
      this.recordMemorySnapshot();
      this.analyzeMemoryPressure();
    }, 15000, 1); // High priority monitoring

    // 2025 Pattern: V8 Garbage Collection Integration
    if (global.gc) {
      this.on('memoryPressure', (level: 'warning' | 'critical' | 'emergency') => {
        if (level === 'critical' && !this.gcScheduled) {
          this.scheduleGarbageCollection();
        }
      });
    }
  }

  /**
   * 2025 Pattern: Proactive Memory Snapshot Recording
   */
  private recordMemorySnapshot(): void {
    const memUsage = process.memoryUsage();
    const snapshot: MemoryMetrics = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      rss: memUsage.rss,
      timestamp: performance.now(),
    };

    this.memorySnapshots.push(snapshot);
    
    // 2025 Pattern: Sliding Window Memory History
    if (this.memorySnapshots.length > this.maxSnapshotHistory) {
      this.memorySnapshots = this.memorySnapshots.slice(-this.maxSnapshotHistory);
    }
  }

  /**
   * 2025 Pattern: Intelligent Memory Pressure Analysis
   */
  private analyzeMemoryPressure(): void {
    if (this.memorySnapshots.length < 2) return;

    const current = this.memorySnapshots[this.memorySnapshots.length - 1];
    const previous = this.memorySnapshots[this.memorySnapshots.length - 2];
    
    const heapGrowth = current.heapUsed - previous.heapUsed;
    const growthRate = heapGrowth / (current.timestamp - previous.timestamp) * 1000; // bytes per second

    // Emit appropriate memory pressure events
    if (current.heapUsed > this.memoryThresholds.emergency || growthRate > 10 * 1024 * 1024) {
      this.emit('memoryPressure', 'emergency');
      this.executeEmergencyCleanup();
    } else if (current.heapUsed > this.memoryThresholds.critical || growthRate > 5 * 1024 * 1024) {
      this.emit('memoryPressure', 'critical');
      this.executeCriticalCleanup();
    } else if (current.heapUsed > this.memoryThresholds.warning || growthRate > 1 * 1024 * 1024) {
      this.emit('memoryPressure', 'warning');
      this.scheduleCleanup();
    }
  }

  /**
   * 2025 Pattern: Tiered Cleanup Strategy
   */
  private scheduleCleanup(): void {
    if (this.cleanupScheduled) return;
    
    this.cleanupScheduled = true;
    setTimeout(() => {
      this.executeRoutineCleanup();
      this.cleanupScheduled = false;
    }, 5000); // 5 second delay for routine cleanup
  }

  private executeRoutineCleanup(): void {
    logger.debug('Executing routine memory cleanup');
    
    // Clean up low-priority resources older than 5 minutes
    const fiveMinutesAgo = performance.now() - 300000;
    
    for (const [id, tracker] of this.resourceTrackers.entries()) {
      if (tracker.priority >= 5 && tracker.lastAccessed < fiveMinutesAgo) {
        this.unregisterResource(id);
      }
    }
  }

  private executeCriticalCleanup(): void {
    logger.warn('Executing critical memory cleanup due to memory pressure');
    
    // Clean up medium-priority resources older than 2 minutes
    const twoMinutesAgo = performance.now() - 120000;
    
    for (const [id, tracker] of this.resourceTrackers.entries()) {
      if (tracker.priority >= 3 && tracker.lastAccessed < twoMinutesAgo) {
        this.unregisterResource(id);
      }
    }
    
    // Force garbage collection if available
    this.scheduleGarbageCollection();
  }

  private executeEmergencyCleanup(): void {
    logger.error('Executing emergency memory cleanup - high memory pressure detected');
    
    // Clean up all non-critical resources
    const resourcestoClean = Array.from(this.resourceTrackers.entries())
      .filter(([id, tracker]) => tracker.priority > 2)
      .sort((a, b) => b[1].priority - a[1].priority); // Highest priority first

    for (const [id] of resourcestoClean) {
      this.unregisterResource(id);
    }
    
    // Force garbage collection
    this.scheduleGarbageCollection();
    
    // Clear memory snapshots except recent ones
    this.memorySnapshots = this.memorySnapshots.slice(-5);
  }

  /**
   * 2025 Pattern: Safe Garbage Collection Scheduling
   */
  private scheduleGarbageCollection(): void {
    if (this.gcScheduled || !global.gc) return;
    
    this.gcScheduled = true;
    setImmediate(() => {
      try {
        if (global.gc) {
          global.gc();
          logger.debug('Garbage collection completed');
        }
      } catch (error) {
        logger.warn('Garbage collection failed:', error);
      } finally {
        this.gcScheduled = false;
      }
    });
  }

  /**
   * 2025 Pattern: Automatic Resource Lifecycle Management
   */
  private checkResourceForCleanup(id: string): void {
    const tracker = this.resourceTrackers.get(id);
    if (!tracker) return;

    const age = performance.now() - tracker.created;
    const timeSinceAccess = performance.now() - tracker.lastAccessed;

    // Auto-cleanup rules based on resource type and age
    const shouldCleanup = 
      (tracker.type === 'timeout' && age > 60000) || // 1 minute for timeouts
      (tracker.type === 'interval' && timeSinceAccess > 300000) || // 5 minutes since last access
      (tracker.type === 'connection' && timeSinceAccess > 180000) || // 3 minutes for connections
      (tracker.priority > 7 && timeSinceAccess > 120000); // 2 minutes for very low priority

    if (shouldCleanup) {
      logger.debug(`Auto-cleaning up resource: ${id} (age: ${Math.round(age/1000)}s, unused: ${Math.round(timeSinceAccess/1000)}s)`);
      this.unregisterResource(id);
    }
  }

  /**
   * 2025 Pattern: Global Process Event Handlers
   */
  private setupGlobalCleanupHandlers(): void {
    // Handle process exit
    process.once('exit', () => {
      this.executeShutdownCleanup();
    });

    // Handle SIGINT (Ctrl+C)
    process.once('SIGINT', () => {
      logger.info('Received SIGINT - performing graceful cleanup');
      this.executeShutdownCleanup();
      process.exit(0);
    });

    // Handle SIGTERM
    process.once('SIGTERM', () => {
      logger.info('Received SIGTERM - performing graceful cleanup');
      this.executeShutdownCleanup();
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.once('uncaughtException', (error) => {
      logger.error('Uncaught exception - performing emergency cleanup:', error);
      this.executeEmergencyCleanup();
      process.exit(1);
    });
  }

  /**
   * 2025 Pattern: Graceful Shutdown Cleanup
   */
  private executeShutdownCleanup(): void {
    logger.debug('Executing shutdown cleanup for all resources');
    
    // Clean up all resources in priority order
    const sortedResources = Array.from(this.resourceTrackers.entries())
      .sort((a, b) => a[1].priority - b[1].priority); // Lowest priority number first

    for (const [id] of sortedResources) {
      this.unregisterResource(id);
    }
    
    this.resourceTrackers.clear();
  }

  /**
   * Public API Methods
   */
  getMemoryMetrics(): {
    current: MemoryMetrics | null;
    history: MemoryMetrics[];
    activeResources: number;
    recommendations: string[];
  } {
    const current = this.memorySnapshots.length > 0 
      ? this.memorySnapshots[this.memorySnapshots.length - 1]
      : null;
    
    const recommendations = [];
    if (current) {
      if (current.heapUsed > this.memoryThresholds.warning) {
        recommendations.push('Consider reducing memory usage or enabling more aggressive cleanup');
      }
      if (this.resourceTrackers.size > 50) {
        recommendations.push('High number of tracked resources - consider consolidating or cleaning up');
      }
    }

    return {
      current,
      history: this.memorySnapshots,
      activeResources: this.resourceTrackers.size,
      recommendations
    };
  }

  forceCleanup(priority: number = 5): number {
    let cleanedCount = 0;
    
    for (const [id, tracker] of this.resourceTrackers.entries()) {
      if (tracker.priority >= priority) {
        this.unregisterResource(id);
        cleanedCount++;
      }
    }
    
    logger.info(`Force cleanup completed: ${cleanedCount} resources cleaned`);
    return cleanedCount;
  }

  /**
   * Access tracking for resource usage optimization
   */
  markResourceAccessed(id: string): void {
    const tracker = this.resourceTrackers.get(id);
    if (tracker) {
      tracker.lastAccessed = performance.now();
    }
  }
}

/**
 * 2025 Pattern: Global Memory Optimizer Instance
 */
export const memoryOptimizer = MemoryOptimizer2025.getInstance();

/**
 * 2025 Pattern: Convenient Helper Functions
 */
export function trackInterval(callback: () => void, intervalMs: number, priority = 5): string {
  return memoryOptimizer.registerInterval(callback, intervalMs, priority);
}

export function trackTimeout(callback: () => void, timeoutMs: number, priority = 5): string {
  return memoryOptimizer.registerTimeout(callback, timeoutMs, priority);
}

export function trackEventEmitter(emitter: EventEmitter, name: string, priority = 5): string {
  return memoryOptimizer.registerEventEmitter(emitter, name, priority);
}

export function untrack(id: string): void {
  memoryOptimizer.unregisterResource(id);
}

export function getMemoryStatus(): ReturnType<MemoryOptimizer2025['getMemoryMetrics']> {
  return memoryOptimizer.getMemoryMetrics();
}