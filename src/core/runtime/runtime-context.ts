/**
 * Runtime Context - Dependency Injection Container
 * 
 * Replaces global mutable singletons with a proper dependency injection approach.
 * This addresses the architectural debt of having global state scattered throughout the system.
 */

import { EventEmitter } from 'events';
import { IEventBus } from '../../domain/interfaces/event-bus.js';
import { ILogger } from '../../domain/interfaces/logger.js';
import { UnifiedResourceCoordinator } from '../../infrastructure/performance/unified-resource-coordinator.js';
import { ResourceCoordinationManager } from '../coordination/resource-coordination-manager.js';
import { UnifiedCacheCoordinator } from '../../infrastructure/cache/unified-cache-coordinator.js';

/**
 * Core runtime dependencies that should be injected rather than accessed globally
 */
export interface RuntimeDependencies {
  eventBus: IEventBus;
  logger: ILogger;
  resourceCoordinator: UnifiedResourceCoordinator;
  resourceManager: ResourceCoordinationManager;
  cacheCoordinator: UnifiedCacheCoordinator;
  
  // Security context
  securityConfig: {
    enabled: boolean;
    level: 'basic' | 'standard' | 'high' | 'enterprise';
    allowedOperations: string[];
  };
  
  // Performance settings
  performanceConfig: {
    maxConcurrency: number;
    timeouts: {
      default: number;
      critical: number;
    };
    resourceLimits: {
      memoryMB: number;
      cpuPercent: number;
    };
  };
}

/**
 * Runtime Context for Dependency Injection
 * 
 * This replaces the pattern of:
 * - getGlobalEventBus()
 * - UnifiedResourceCoordinator.getInstance()
 * - ResourceCoordinationManager.getInstance()
 */
export class RuntimeContext extends EventEmitter {
  private readonly dependencies: RuntimeDependencies;
  private readonly correlationId: string;
  private readonly created: number;
  private disposed = false;

  constructor(dependencies: RuntimeDependencies, correlationId?: string) {
    super();
    this.dependencies = { ...dependencies };
    this.correlationId = correlationId ?? this.generateCorrelationId();
    this.created = Date.now();

    // Set up cleanup on process termination
    this.setupGracefulShutdown();
  }

  /**
   * Get the event bus for this runtime context
   */
  getEventBus(): IEventBus {
    this.ensureNotDisposed();
    return this.dependencies.eventBus;
  }

  /**
   * Get the logger for this runtime context
   */
  getLogger(): ILogger {
    this.ensureNotDisposed();
    return this.dependencies.logger;
  }

  /**
   * Get the resource coordinator for this runtime context
   */
  getResourceCoordinator(): UnifiedResourceCoordinator {
    this.ensureNotDisposed();
    return this.dependencies.resourceCoordinator;
  }

  /**
   * Get the resource manager for this runtime context
   */
  getResourceManager(): ResourceCoordinationManager {
    this.ensureNotDisposed();
    return this.dependencies.resourceManager;
  }

  /**
   * Get the cache coordinator for this runtime context
   */
  getCacheCoordinator(): UnifiedCacheCoordinator {
    this.ensureNotDisposed();
    return this.dependencies.cacheCoordinator;
  }

  /**
   * Get security configuration
   */
  getSecurityConfig(): RuntimeDependencies['securityConfig'] {
    this.ensureNotDisposed();
    return this.dependencies.securityConfig;
  }

  /**
   * Get performance configuration
   */
  getPerformanceConfig(): RuntimeDependencies['performanceConfig'] {
    this.ensureNotDisposed();
    return this.dependencies.performanceConfig;
  }

  /**
   * Get correlation ID for tracking requests across boundaries
   */
  getCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Create a child context with updated dependencies
   */
  createChildContext(overrides: Partial<RuntimeDependencies>): RuntimeContext {
    this.ensureNotDisposed();
    
    const childDependencies: RuntimeDependencies = {
      ...this.dependencies,
      ...overrides
    };

    const childContext = new RuntimeContext(
      childDependencies, 
      this.generateCorrelationId()
    );

    // Link child to parent for cleanup
    this.once('dispose', () => {
      if (!childContext.disposed) {
        void childContext.dispose();
      }
    });

    return childContext;
  }

  /**
   * Clone the context with the same dependencies but new correlation ID
   */
  clone(): RuntimeContext {
    this.ensureNotDisposed();
    return new RuntimeContext(this.dependencies, this.generateCorrelationId());
  }

  /**
   * Dispose of the runtime context and clean up resources
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;

    this.disposed = true;
    this.emit('dispose');

    // Cleanup dependencies if they have cleanup methods
    const cleanupTasks: Promise<void>[] = [];

    if ('dispose' in this.dependencies.resourceCoordinator) {
      const coordinator = this.dependencies.resourceCoordinator as { dispose?: () => void | Promise<void> };
      if (typeof coordinator.dispose === 'function') {
        cleanupTasks.push(Promise.resolve(coordinator.dispose()));
      }
    }

    if ('destroy' in this.dependencies.cacheCoordinator) {
      const cache = this.dependencies.cacheCoordinator as { destroy?: () => void | Promise<void> };
      if (typeof cache.destroy === 'function') {
        cleanupTasks.push(Promise.resolve(cache.destroy()));
      }
    }

    await Promise.allSettled(cleanupTasks);
    this.removeAllListeners();
  }

  /**
   * Get runtime context statistics
   */
  getStats(): {
    correlationId: string;
    created: number;
    age: number;
    disposed: boolean;
    memoryUsage: NodeJS.MemoryUsage;
  } {
    return {
      correlationId: this.correlationId,
      created: this.created,
      age: Date.now() - this.created,
      disposed: this.disposed,
      memoryUsage: process.memoryUsage()
    };
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error(`RuntimeContext ${this.correlationId} has been disposed`);
    }
  }

  private generateCorrelationId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `ctx_${crypto.randomUUID()}`;
    }
    // Fallback for environments without crypto.randomUUID
    return `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private setupGracefulShutdown(): void {
    const cleanup = () => {
      if (!this.disposed) {
        this.dispose().catch(error => {
          // Using process.stderr instead of console.error for system cleanup
          process.stderr.write(`Error during RuntimeContext cleanup: ${error}\n`);
        });
      }
    };

    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
    process.once('beforeExit', cleanup);
  }
}

/**
 * Factory for creating runtime contexts
 */
export class RuntimeContextFactory {
  private static defaultDependencies: Partial<RuntimeDependencies> = {};

  /**
   * Set default dependencies for all contexts created by this factory
   */
  static setDefaults(defaults: Partial<RuntimeDependencies>): void {
    RuntimeContextFactory.defaultDependencies = { ...defaults };
  }

  /**
   * Create a new runtime context with the given dependencies
   */
  static create(
    dependencies: Partial<RuntimeDependencies>,
    correlationId?: string
  ): RuntimeContext {
    const fullDependencies: RuntimeDependencies = {
      // Default security config
      securityConfig: {
        enabled: true,
        level: 'standard',
        allowedOperations: []
      },
      
      // Default performance config
      performanceConfig: {
        maxConcurrency: 10,
        timeouts: {
          default: 30000,
          critical: 10000
        },
        resourceLimits: {
          memoryMB: 512,
          cpuPercent: 80
        }
      },

      // Merge defaults and provided dependencies
      ...RuntimeContextFactory.defaultDependencies,
      ...dependencies
    } as RuntimeDependencies;

    return new RuntimeContext(fullDependencies, correlationId);
  }

  /**
   * Create a test context with mocked dependencies
   */
  static createForTesting(overrides: Partial<RuntimeDependencies> = {}): RuntimeContext {
    const mockEventBus = new EventEmitter() as IEventBus;
    const mockLogger: ILogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      trace: () => {}
    };

    const testDependencies: Partial<RuntimeDependencies> = {
      eventBus: mockEventBus,
      logger: mockLogger,
      securityConfig: {
        enabled: false,
        level: 'basic',
        allowedOperations: ['*']
      },
      performanceConfig: {
        maxConcurrency: 1,
        timeouts: {
          default: 1000,
          critical: 500
        },
        resourceLimits: {
          memoryMB: 128,
          cpuPercent: 50
        }
      },
      ...overrides
    };

    return RuntimeContextFactory.create(testDependencies, 'test_context');
  }
}
