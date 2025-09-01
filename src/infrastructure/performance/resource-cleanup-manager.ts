/**
 * Resource Cleanup Manager
 * Centralized management of all system resources, timers, intervals, and event listeners
 * Prevents memory leaks and ensures proper cleanup on shutdown
 */

import { EventEmitter } from 'events';
import { logger } from '../logging/logger.js';

interface ManagedResource {
  id: string;
  type: 'interval' | 'timeout' | 'listener' | 'connection' | 'stream';
  resource: any;
  source: string; // Component that created it
  createdAt: number;
  cleanup: () => void;
}

export class ResourceCleanupManager extends EventEmitter {
  private static instance: ResourceCleanupManager | null = null;
  private resources = new Map<string, ManagedResource>();
  private cleanupScheduled = false;
  private shutdownInProgress = false;

  private constructor() {
    super();
    this.setupShutdownHandlers();
  }

  static getInstance(): ResourceCleanupManager {
    if (!ResourceCleanupManager.instance) {
      ResourceCleanupManager.instance = new ResourceCleanupManager();
    }
    return ResourceCleanupManager.instance;
  }

  /**
   * Register an interval for managed cleanup
   */
  registerInterval(interval: NodeJS.Timeout, source: string, description?: string): string {
    const id = this.generateId('interval', source);

    this.resources.set(id, {
      id,
      type: 'interval',
      resource: interval,
      source,
      createdAt: Date.now(),
      cleanup: () => {
        clearInterval(interval);
        logger.debug(`Cleared interval ${id} from ${source}`);
      },
    });

    logger.debug(
      `Registered interval ${id} from ${source}${description ? `: ${description}` : ''}`
    );
    return id;
  }

  /**
   * Register a timeout for managed cleanup
   */
  registerTimeout(timeout: NodeJS.Timeout, source: string, description?: string): string {
    const id = this.generateId('timeout', source);

    this.resources.set(id, {
      id,
      type: 'timeout',
      resource: timeout,
      source,
      createdAt: Date.now(),
      cleanup: () => {
        clearTimeout(timeout);
        logger.debug(`Cleared timeout ${id} from ${source}`);
      },
    });

    logger.debug(`Registered timeout ${id} from ${source}${description ? `: ${description}` : ''}`);
    return id;
  }

  /**
   * Register an event listener for managed cleanup
   */
  registerListener(
    emitter: EventEmitter | NodeJS.Process,
    event: string,
    listener: (...args: any[]) => void,
    source: string
  ): string {
    const id = this.generateId('listener', source);

    this.resources.set(id, {
      id,
      type: 'listener',
      resource: { emitter, event, listener },
      source,
      createdAt: Date.now(),
      cleanup: () => {
        emitter.removeListener(event, listener);
        logger.debug(`Removed listener ${id} from ${source} (${event})`);
      },
    });

    logger.debug(`Registered listener ${id} from ${source} (${event})`);
    return id;
  }

  /**
   * Register a connection or stream for managed cleanup
   */
  registerConnection(
    connection: any,
    source: string,
    cleanupFn: () => void,
    description?: string
  ): string {
    const id = this.generateId('connection', source);

    this.resources.set(id, {
      id,
      type: 'connection',
      resource: connection,
      source,
      createdAt: Date.now(),
      cleanup: cleanupFn,
    });

    logger.debug(
      `Registered connection ${id} from ${source}${description ? `: ${description}` : ''}`
    );
    return id;
  }

  /**
   * Manually cleanup a resource by ID
   */
  cleanup(resourceId: string): boolean {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      logger.warn(`Resource ${resourceId} not found for cleanup`);
      return false;
    }

    try {
      resource.cleanup();
      this.resources.delete(resourceId);
      logger.debug(`Cleaned up resource ${resourceId}`);
      return true;
    } catch (error) {
      logger.error(`Error cleaning up resource ${resourceId}:`, error);
      return false;
    }
  }

  /**
   * Cleanup all resources from a specific source
   */
  cleanupBySource(source: string): number {
    let cleanedCount = 0;
    const toCleanup = Array.from(this.resources.values()).filter(r => r.source === source);

    for (const resource of toCleanup) {
      if (this.cleanup(resource.id)) {
        cleanedCount++;
      }
    }

    logger.info(`Cleaned up ${cleanedCount} resources from ${source}`);
    return cleanedCount;
  }

  /**
   * Cleanup old resources (older than maxAge milliseconds)
   */
  cleanupOldResources(maxAge: number = 5 * 60 * 1000): number {
    // 5 minutes default
    const now = Date.now();
    let cleanedCount = 0;

    const toCleanup = Array.from(this.resources.values()).filter(r => now - r.createdAt > maxAge);

    for (const resource of toCleanup) {
      if (this.cleanup(resource.id)) {
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} old resources`);
    }

    return cleanedCount;
  }

  /**
   * Schedule periodic cleanup of old resources
   */
  schedulePeriodicCleanup(interval: number = 2 * 60 * 1000): void {
    // 2 minutes default
    if (this.cleanupScheduled) {
      return;
    }

    const cleanupInterval = setInterval(() => {
      if (this.shutdownInProgress) {
        clearInterval(cleanupInterval);
        return;
      }

      this.cleanupOldResources();
    }, interval);

    // Don't let cleanup interval keep process alive
    if (cleanupInterval.unref) {
      cleanupInterval.unref();
    }

    // Register the cleanup interval itself (meta!)
    this.registerInterval(cleanupInterval, 'ResourceCleanupManager', 'periodic cleanup');
    this.cleanupScheduled = true;
  }

  /**
   * Get resource statistics
   */
  getStats(): {
    totalResources: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
    oldest: { age: number; source: string; type: string } | null;
  } {
    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let oldest: { age: number; source: string; type: string } | null = null;
    const now = Date.now();

    for (const resource of this.resources.values()) {
      byType[resource.type] = (byType[resource.type] || 0) + 1;
      bySource[resource.source] = (bySource[resource.source] || 0) + 1;

      const age = now - resource.createdAt;
      if (!oldest || age > oldest.age) {
        oldest = { age, source: resource.source, type: resource.type };
      }
    }

    return {
      totalResources: this.resources.size,
      byType,
      bySource,
      oldest,
    };
  }

  /**
   * Force cleanup all resources (shutdown)
   */
  async shutdown(): Promise<void> {
    if (this.shutdownInProgress) {
      return;
    }

    logger.info('🔄 Starting resource cleanup manager shutdown...');
    this.shutdownInProgress = true;

    const resourceIds = Array.from(this.resources.keys());
    let cleanedCount = 0;

    for (const resourceId of resourceIds) {
      try {
        if (this.cleanup(resourceId)) {
          cleanedCount++;
        }
      } catch (error) {
        logger.error(`Error during shutdown cleanup of ${resourceId}:`, error);
      }
    }

    this.resources.clear();
    logger.info(
      `✅ Resource cleanup manager shutdown complete. Cleaned ${cleanedCount} resources.`
    );
  }

  private generateId(type: string, source: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);
    return `${type}_${source.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}_${random}`;
  }

  private setupShutdownHandlers(): void {
    const shutdownHandler = async () => {
      await this.shutdown();
    };

    // Register shutdown handlers
    process.once('SIGTERM', shutdownHandler);
    process.once('SIGINT', shutdownHandler);
    process.once('beforeExit', shutdownHandler);
  }
}

// Global instance for easy access
export const resourceManager = ResourceCleanupManager.getInstance();

// Convenience functions
export const registerInterval = (interval: NodeJS.Timeout, source: string, description?: string) =>
  resourceManager.registerInterval(interval, source, description);

export const registerTimeout = (timeout: NodeJS.Timeout, source: string, description?: string) =>
  resourceManager.registerTimeout(timeout, source, description);

export const registerListener = (
  emitter: EventEmitter | NodeJS.Process,
  event: string,
  listener: (...args: any[]) => void,
  source: string
) => resourceManager.registerListener(emitter, event, listener, source);

export const cleanupBySource = (source: string) => resourceManager.cleanupBySource(source);
