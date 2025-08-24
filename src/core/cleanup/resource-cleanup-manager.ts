/**
 * Resource Cleanup Manager - Centralizes shutdown and cleanup operations
 * Extracted from UnifiedModelClient to provide focused resource management
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { getErrorMessage } from '../../utils/error-utils.js';

export interface CleanupConfig {
  shutdownTimeoutMs: number;
  gracefulShutdown: boolean;
}

export interface CleanupableResource {
  name: string;
  cleanup: () => Promise<void> | void;
  priority?: number; // Lower numbers = higher priority
}

export interface IResourceCleanupManager {
  /**
   * Register a resource for cleanup
   */
  registerResource(resource: CleanupableResource): void;

  /**
   * Perform graceful shutdown of all resources
   */
  shutdown(): Promise<void>;

  /**
   * Perform emergency cleanup of all resources
   */
  destroy(): Promise<void>;

  /**
   * Wait for active operations to complete
   */
  waitForActiveOperations(checkActive: () => number, timeoutMs?: number): Promise<boolean>;

  /**
   * Clear request queue with error messages
   */
  clearRequestQueue(queue: Array<{ reject: (error: Error) => void }>, message?: string): void;

  /**
   * Check if shutdown is in progress
   */
  isShuttingDown(): boolean;
}

export class ResourceCleanupManager extends EventEmitter implements IResourceCleanupManager {
  private readonly config: CleanupConfig;
  private resources: CleanupableResource[] = [];
  private shuttingDown = false;
  private destroyed = false;

  constructor(config?: Partial<CleanupConfig>) {
    super();

    this.config = {
      shutdownTimeoutMs: 10000, // 10 seconds default
      gracefulShutdown: true,
      ...config,
    };

    logger.debug('ResourceCleanupManager initialized', { config: this.config });
  }

  /**
   * Register a resource for cleanup
   */
  registerResource(resource: CleanupableResource): void {
    if (this.destroyed) {
      logger.warn('Cannot register resource after cleanup manager destroyed');
      return;
    }

    this.resources.push(resource);
    // Sort by priority (lower number = higher priority)
    this.resources.sort((a, b) => (a.priority || 99) - (b.priority || 99));

    logger.debug('Resource registered for cleanup', {
      name: resource.name,
      priority: resource.priority || 99,
      totalResources: this.resources.length,
    });
  }

  /**
   * Perform graceful shutdown of all resources
   */
  async shutdown(): Promise<void> {
    if (this.shuttingDown || this.destroyed) {
      logger.warn('Shutdown already in progress or completed');
      return;
    }

    this.shuttingDown = true;
    logger.info('🛑 Starting graceful shutdown...');
    this.emit('shutdown-started');

    const startTime = Date.now();
    const errors: Array<{ resource: string; error: string }> = [];

    // Process resources in priority order
    for (const resource of this.resources) {
      try {
        logger.debug(`Shutting down ${resource.name}...`);

        const cleanupPromise = Promise.resolve(resource.cleanup());
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('Cleanup timeout')), 5000);
        });

        await Promise.race([cleanupPromise, timeoutPromise]);

        logger.debug(`✅ ${resource.name} shutdown complete`);
        this.emit('resource-shutdown', { name: resource.name, success: true });
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        logger.error(`Failed to shutdown ${resource.name}:`, errorMessage);
        errors.push({ resource: resource.name, error: errorMessage });
        this.emit('resource-shutdown', {
          name: resource.name,
          success: false,
          error: errorMessage,
        });
      }
    }

    const duration = Date.now() - startTime;

    if (errors.length > 0) {
      logger.warn(`Shutdown completed with ${errors.length} errors in ${duration}ms`, { errors });
      this.emit('shutdown-completed', { success: false, duration, errors });
    } else {
      logger.info(`✅ Graceful shutdown completed in ${duration}ms`);
      this.emit('shutdown-completed', { success: true, duration });
    }

    this.shuttingDown = false;
  }

  /**
   * Perform emergency cleanup of all resources
   */
  async destroy(): Promise<void> {
    if (this.destroyed) {
      logger.warn('Already destroyed');
      return;
    }

    this.destroyed = true;
    logger.info('🚨 Starting emergency resource cleanup...');
    this.emit('destroy-started');

    const startTime = Date.now();
    const cleanupPromises: Promise<void>[] = [];

    // Attempt to clean up all resources in parallel for speed
    for (const resource of this.resources) {
      const cleanupPromise = (async () => {
        try {
          await Promise.resolve(resource.cleanup());
          logger.debug(`✅ ${resource.name} destroyed`);
        } catch (error) {
          logger.error(`Failed to destroy ${resource.name}:`, getErrorMessage(error));
        }
      })();

      cleanupPromises.push(cleanupPromise);
    }

    // Wait for all cleanups with timeout
    try {
      await Promise.race([
        Promise.all(cleanupPromises),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('Destroy timeout')), this.config.shutdownTimeoutMs);
        }),
      ]);
    } catch (error) {
      logger.error('Some resources failed to clean up:', getErrorMessage(error));
    }

    const duration = Date.now() - startTime;
    logger.info(`Emergency cleanup completed in ${duration}ms`);

    // Clear resources and remove listeners
    this.resources = [];
    this.removeAllListeners();

    this.emit('destroy-completed', { duration });
  }

  /**
   * Wait for active operations to complete
   */
  async waitForActiveOperations(checkActive: () => number, timeoutMs?: number): Promise<boolean> {
    const timeout = timeoutMs || this.config.shutdownTimeoutMs;
    const startTime = Date.now();

    logger.debug('Waiting for active operations to complete...');

    while (checkActive() > 0 && Date.now() - startTime < timeout) {
      const remaining = checkActive();
      logger.debug(`Waiting for ${remaining} active operations...`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const activeCount = checkActive();
    if (activeCount === 0) {
      logger.debug('All active operations completed');
      return true;
    } else {
      logger.warn(`Timeout waiting for ${activeCount} active operations`);
      return false;
    }
  }

  /**
   * Clear request queue with error messages
   */
  clearRequestQueue(
    queue: Array<{ reject: (error: Error) => void }>,
    message: string = 'System shutting down'
  ): void {
    const queueLength = queue.length;

    if (queueLength === 0) {
      return;
    }

    logger.info(`Clearing ${queueLength} queued requests`);

    const error = new Error(message);
    for (const item of queue) {
      item.reject(error);
    }

    queue.length = 0; // Clear the array

    this.emit('queue-cleared', { count: queueLength, reason: message });
  }

  /**
   * Check if shutdown is in progress
   */
  isShuttingDown(): boolean {
    return this.shuttingDown || this.destroyed;
  }
}
