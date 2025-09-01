/**
 * Rust Bridge Manager - Phase 4 Implementation
 * 
 * Manages the NAPI bridge between TypeScript and Rust, handling
 * module loading, lifecycle management, and communication protocols.
 */

import { logger } from '../../logger.js';

export interface BridgeConfiguration {
  modulePath: string;
  initializationTimeout: number;
  healthCheckInterval: number;
  autoRecover: boolean;
}

export interface BridgeHealth {
  status: 'healthy' | 'degraded' | 'failed';
  lastCheck: Date;
  responseTime: number;
  errorCount: number;
}

/**
 * Manages the NAPI bridge to the Rust execution module
 */
export class RustBridgeManager {
  private config: BridgeConfiguration;
  private rustModule: any = null;
  private health: BridgeHealth;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<BridgeConfiguration> = {}) {
    this.config = {
      modulePath: './rust-executor',
      initializationTimeout: 5000,
      healthCheckInterval: 30000,
      autoRecover: true,
      ...config,
    };

    this.health = {
      status: 'failed',
      lastCheck: new Date(),
      responseTime: 0,
      errorCount: 0,
    };
  }

  /**
   * Initialize the Rust bridge
   */
  async initialize(): Promise<boolean> {
    try {
      logger.info('Initializing Rust bridge...', {
        modulePath: this.config.modulePath,
        timeout: this.config.initializationTimeout,
      });

      // Load the native module with timeout
      const loadPromise = this.loadRustModule();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Module load timeout')), this.config.initializationTimeout)
      );

      this.rustModule = await Promise.race([loadPromise, timeoutPromise]);

      if (this.rustModule) {
        this.health.status = 'healthy';
        this.startHealthMonitoring();
        
        logger.info('Rust bridge initialized successfully');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to initialize Rust bridge:', error);
      this.health.status = 'failed';
      this.health.errorCount++;
      return false;
    }
  }

  /**
   * Get the loaded Rust module instance
   */
  getRustModule(): any {
    if (!this.rustModule) {
      throw new Error('Rust module not initialized');
    }
    return this.rustModule;
  }

  /**
   * Check if the bridge is healthy and operational
   */
  isHealthy(): boolean {
    return this.health.status === 'healthy';
  }

  /**
   * Get current bridge health status
   */
  getHealth(): BridgeHealth {
    return { ...this.health };
  }

  /**
   * Perform a health check on the Rust module
   */
  async performHealthCheck(): Promise<boolean> {
    if (!this.rustModule) {
      this.health.status = 'failed';
      return false;
    }

    try {
      const startTime = Date.now();
      
      // Test basic functionality
      const testResult = this.rustModule.add(2, 2);
      
      this.health.responseTime = Date.now() - startTime;
      this.health.lastCheck = new Date();

      if (testResult === 4) {
        this.health.status = 'healthy';
        return true;
      } else {
        this.health.status = 'degraded';
        this.health.errorCount++;
        return false;
      }
    } catch (error) {
      logger.error('Rust bridge health check failed:', error);
      this.health.status = 'failed';
      this.health.errorCount++;
      this.health.lastCheck = new Date();
      
      // Auto-recovery attempt
      if (this.config.autoRecover && this.health.errorCount < 5) {
        logger.info('Attempting Rust bridge recovery...');
        return this.initialize();
      }
      
      return false;
    }
  }

  /**
   * Cleanup and shutdown the bridge
   */
  async shutdown(): Promise<void> {
    try {
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }

      this.rustModule = null;
      this.health.status = 'failed';
      
      logger.info('Rust bridge shut down successfully');
    } catch (error) {
      logger.error('Error during Rust bridge shutdown:', error);
    }
  }

  // Private methods

  private async loadRustModule(): Promise<any> {
    try {
      // Try to load the compiled Rust module
      const module = await import(this.config.modulePath);
      return module;
    } catch (error) {
      logger.warn('Native Rust module not available, this is expected during development:', error);
      return null;
    }
  }

  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);

    logger.debug('Rust bridge health monitoring started');
  }
}