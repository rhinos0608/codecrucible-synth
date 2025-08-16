import { logger } from './logger.js';
import { E2BService } from './e2b/e2b-service.js';
import { EnhancedContextManager } from './context/enhanced-context-manager.js';

/**
 * Manages the lifecycle of all resources and timers to prevent hanging processes
 */
export class ProcessLifecycleManager {
  private static instance: ProcessLifecycleManager | null = null;
  private services: Set<{ shutdown(): Promise<void> }> = new Set();
  private timers: Set<NodeJS.Timeout> = new Set();
  private intervals: Set<NodeJS.Timeout> = new Set();
  private isShuttingDown = false;
  private shutdownTimeout = 10000; // 10 seconds max for shutdown

  private constructor() {
    this.setupExitHandlers();
  }

  static getInstance(): ProcessLifecycleManager {
    if (!ProcessLifecycleManager.instance) {
      ProcessLifecycleManager.instance = new ProcessLifecycleManager();
    }
    return ProcessLifecycleManager.instance;
  }

  /**
   * Register a service that needs cleanup on shutdown
   */
  registerService(service: { shutdown(): Promise<void> }): void {
    this.services.add(service);
  }

  /**
   * Register a timer for cleanup
   */
  registerTimer(timer: NodeJS.Timeout): void {
    this.timers.add(timer);
  }

  /**
   * Register an interval for cleanup
   */
  registerInterval(interval: NodeJS.Timeout): void {
    this.intervals.add(interval);
  }

  /**
   * Remove a timer from tracking
   */
  unregisterTimer(timer: NodeJS.Timeout): void {
    this.timers.delete(timer);
  }

  /**
   * Remove an interval from tracking
   */
  unregisterInterval(interval: NodeJS.Timeout): void {
    this.intervals.delete(interval);
  }

  /**
   * Setup handlers for various exit scenarios
   */
  private setupExitHandlers(): void {
    // Normal exit
    process.on('exit', () => {
      this.performSyncCleanup();
    });

    // Ctrl+C
    process.on('SIGINT', async () => {
      logger.info('🛑 Received SIGINT (Ctrl+C), shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });

    // Termination signal
    process.on('SIGTERM', async () => {
      logger.info('🛑 Received SIGTERM, shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });

    // Uncaught exceptions
    process.on('uncaughtException', async (error) => {
      logger.error('💥 Uncaught exception:', error);
      await this.shutdown();
      process.exit(1);
    });

    // Unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('💥 Unhandled promise rejection:', reason);
      await this.shutdown();
      process.exit(1);
    });

    // Windows specific signals
    if (process.platform === 'win32') {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.on('SIGINT', () => {
        process.emit('SIGINT' as any);
      });
    }
  }

  /**
   * Graceful shutdown of all resources
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('🔄 Starting graceful shutdown...');

    const shutdownPromise = this.performShutdown();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Shutdown timeout')), this.shutdownTimeout);
    });

    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
      logger.info('✅ Graceful shutdown completed');
    } catch (error) {
      logger.error('❌ Forced shutdown due to timeout:', error);
      this.performSyncCleanup();
    }
  }

  /**
   * Perform the actual shutdown operations
   */
  private async performShutdown(): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];

    // Shutdown all registered services
    for (const service of this.services) {
      shutdownPromises.push(
        service.shutdown().catch((error) => {
          logger.error('Service shutdown error:', error);
        })
      );
    }

    // Wait for all services to shut down
    await Promise.allSettled(shutdownPromises);

    // Clean up timers and intervals
    this.performSyncCleanup();
  }

  /**
   * Synchronous cleanup of timers and intervals
   */
  private performSyncCleanup(): void {
    // Clear all tracked timers
    for (const timer of this.timers) {
      try {
        clearTimeout(timer);
      } catch (error) {
        // Ignore errors when clearing timers
      }
    }
    this.timers.clear();

    // Clear all tracked intervals
    for (const interval of this.intervals) {
      try {
        clearInterval(interval);
      } catch (error) {
        // Ignore errors when clearing intervals
      }
    }
    this.intervals.clear();

    // Clear services set
    this.services.clear();
  }

  /**
   * Get current resource counts for debugging
   */
  getResourceCounts(): {
    services: number;
    timers: number;
    intervals: number;
  } {
    return {
      services: this.services.size,
      timers: this.timers.size,
      intervals: this.intervals.size
    };
  }
}

/**
 * Global instance for easy access
 */
export const processLifecycleManager = ProcessLifecycleManager.getInstance();

/**
 * Helper functions for common resources
 */
export function registerShutdownHandler(service: { shutdown(): Promise<void> }): void {
  processLifecycleManager.registerService(service);
}

export function createManagedTimeout(callback: () => void, delay: number): NodeJS.Timeout {
  const timer = setTimeout(() => {
    processLifecycleManager.unregisterTimer(timer);
    callback();
  }, delay);
  
  processLifecycleManager.registerTimer(timer);
  return timer;
}

export function createManagedInterval(callback: () => void, delay: number): NodeJS.Timeout {
  const interval = setInterval(callback, delay);
  processLifecycleManager.registerInterval(interval);
  return interval;
}

export function clearManagedTimeout(timer: NodeJS.Timeout): void {
  clearTimeout(timer);
  processLifecycleManager.unregisterTimer(timer);
}

export function clearManagedInterval(interval: NodeJS.Timeout): void {
  clearInterval(interval);
  processLifecycleManager.unregisterInterval(interval);
}