/**
 * MCP Server Lifecycle Manager
 *
 * Orchestrates server initialization, health monitoring, and graceful shutdown
 * Uses dependency injection pattern to avoid tight coupling
 * Implements circuit breaker pattern for resilience
 *
 * Memory-efficient design with lazy loading and cleanup
 */

import { EventEmitter } from 'events';
import { logger } from '../../infrastructure/logging/unified-logger.js';
import { mcpServerRegistry } from './mcp-server-registry.js';

export interface LifecycleConfig {
  maxStartupTime: number; // Max time for all servers to start
  maxShutdownTime: number; // Max time for graceful shutdown
  healthCheckInterval: number; // Health check frequency
  circuitBreakerThreshold: number; // Failures before circuit opens
  circuitBreakerTimeout: number; // Time before retry after circuit opens
}

export interface ServerHealthStatus {
  serverId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'circuit_open';
  lastCheck: Date;
  consecutiveFailures: number;
  avgResponseTime: number;
  errorRate: number;
}

/**
 * Lightweight lifecycle orchestrator with circuit breaker pattern
 */
export class MCPServerLifecycle extends EventEmitter {
  private config: LifecycleConfig;
  private healthStatuses: Map<string, ServerHealthStatus> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private shutdownInProgress = false;
  private startupCompleted = false;

  constructor(config: Partial<LifecycleConfig> = {}) {
    super();

    this.config = {
      maxStartupTime: 30000, // 30 seconds
      maxShutdownTime: 10000, // 10 seconds
      healthCheckInterval: 30000, // 30 seconds
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000, // 1 minute
      ...config,
    };

    this.setMaxListeners(100); // Higher limit for lifecycle events
    this.setupProcessHandlers();
  }

  /**
   * Start all registered servers with dependency resolution
   */
  async startAll(): Promise<void> {
    if (this.startupCompleted) {
      logger.warn('Lifecycle startup already completed');
      return;
    }

    logger.info('🚀 Starting MCP server lifecycle...');
    const startTime = Date.now();

    try {
      // Set startup timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Startup timeout after ${this.config.maxStartupTime}ms`));
        }, this.config.maxStartupTime);
      });

      // Start servers in priority order
      const startupPromise = this.startServersInOrder();

      await Promise.race([startupPromise, timeoutPromise]);

      this.startupCompleted = true;
      const duration = Date.now() - startTime;

      logger.info(`✅ MCP lifecycle startup completed (${duration}ms)`);
      this.emit('startupComplete', { duration });

      // Begin health monitoring
      this.startHealthMonitoring();
    } catch (error) {
      logger.error('❌ MCP lifecycle startup failed:', error);
      this.emit('startupFailed', error);
      throw error;
    }
  }

  /**
   * Start servers in dependency and priority order
   */
  private async startServersInOrder(): Promise<void> {
    const serverIds = mcpServerRegistry.getRegisteredServerIds();

    // Sort by priority (higher priority first)
    const sortedIds = serverIds.sort((a, b) => {
      const regA = mcpServerRegistry['registrations'].get(a);
      const regB = mcpServerRegistry['registrations'].get(b);
      if (!regA || !regB) return 0;
      return regB.definition.priority - regA.definition.priority;
    });

    // Initialize health status for all servers
    for (const serverId of sortedIds) {
      if (mcpServerRegistry.isServerAvailable(serverId)) {
        this.healthStatuses.set(serverId, {
          serverId,
          status: 'healthy',
          lastCheck: new Date(),
          consecutiveFailures: 0,
          avgResponseTime: 0,
          errorRate: 0,
        });
      }
    }

    // Start servers (registry handles dependencies and lazy loading)
    const startPromises = sortedIds
      .filter(id => mcpServerRegistry.isServerAvailable(id))
      .map(id => this.startServerSafely(id));

    // Use Promise.allSettled but check for failures to fail fast
    const results = await Promise.allSettled(startPromises);
    
    // Check for critical server failures
    const failures = results
      .map((result, index) => ({ result, serverId: sortedIds[index] }))
      .filter(({ result }) => result.status === 'rejected');

    if (failures.length > 0) {
      const failedServerIds = failures.map(({ serverId }) => serverId);
      const errorMessages = failures.map(({ result }) => 
        result.status === 'rejected' ? result.reason.message || result.reason : 'Unknown error'
      );
      
      const errorMsg = `Critical MCP servers failed to start: ${failedServerIds.join(', ')}. Errors: ${errorMessages.join('; ')}`;
      logger.error(`🚨 ${errorMsg}`);
      
      // Fail fast - don't allow partial initialization
      throw new Error(errorMsg);
    }
  }

  /**
   * Start a single server with error isolation - throws for critical failures
   */
  private async startServerSafely(serverId: string): Promise<void> {
    try {
      // Get server instance (triggers lazy initialization)
      const server = await mcpServerRegistry.getServer(serverId);

      // Initialize if server has init method
      if (server && typeof server.initialize === 'function') {
        await server.initialize();
      }

      logger.info(`✅ Server ${serverId} started successfully`);
      this.emit('serverStarted', serverId);
    } catch (error) {
      logger.error(`❌ Failed to start server ${serverId}:`, error);
      this.updateHealthStatus(serverId, 'unhealthy', error);
      this.emit('serverStartFailed', serverId, error);
      
      // Re-throw the error so Promise.allSettled can detect the failure
      // This enables fail-fast behavior for critical server startup failures
      throw new Error(`Server ${serverId} failed to start: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Start health monitoring for all servers
   */
  private startHealthMonitoring(): void {
    if (!this.config.healthCheckInterval) return;

    for (const serverId of this.healthStatuses.keys()) {
      const interval = setInterval(
        () => this.performHealthCheck(serverId),
        this.config.healthCheckInterval
      );

      this.healthCheckIntervals.set(serverId, interval);
    }

    logger.info(`🩺 Health monitoring started (${this.config.healthCheckInterval}ms interval)`);
  }

  /**
   * Perform health check on a specific server
   */
  private async performHealthCheck(serverId: string): Promise<void> {
    const healthStatus = this.healthStatuses.get(serverId);
    if (!healthStatus) return;

    // Skip if circuit breaker is open
    const circuitState = this.circuitBreakers.get(serverId);
    if (circuitState && circuitState.state === 'open') {
      if (Date.now() - circuitState.lastFailure > this.config.circuitBreakerTimeout) {
        // Try to close circuit breaker
        circuitState.state = 'half-open';
        logger.info(`🔄 Circuit breaker half-open for ${serverId}`);
      } else {
        return; // Skip health check while circuit is open
      }
    }

    const startTime = Date.now();

    try {
      // Get server instance
      const server = await mcpServerRegistry.getServer(serverId);

      // Perform health check if server supports it
      let isHealthy = true;
      if (server && typeof server.healthCheck === 'function') {
        const healthResult = await Promise.race([
          server.healthCheck(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          ),
        ]);
        isHealthy = healthResult === true || (healthResult && healthResult.status === 'healthy');
      }

      const responseTime = Date.now() - startTime;

      if (isHealthy) {
        this.updateHealthStatus(serverId, 'healthy', null, responseTime);
        this.resetCircuitBreaker(serverId);
      } else {
        this.updateHealthStatus(
          serverId,
          'degraded',
          new Error('Health check failed'),
          responseTime
        );
        this.incrementCircuitBreaker(serverId);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateHealthStatus(serverId, 'unhealthy', error, responseTime);
      this.incrementCircuitBreaker(serverId);
    }
  }

  /**
   * Update health status with metrics
   */
  private updateHealthStatus(
    serverId: string,
    status: ServerHealthStatus['status'],
    error?: any,
    responseTime?: number
  ): void {
    const healthStatus = this.healthStatuses.get(serverId);
    if (!healthStatus) return;

    const wasHealthy = healthStatus.status === 'healthy';

    healthStatus.status = status;
    healthStatus.lastCheck = new Date();

    if (status === 'healthy') {
      healthStatus.consecutiveFailures = 0;
    } else {
      healthStatus.consecutiveFailures++;
    }

    if (responseTime !== undefined) {
      // Calculate rolling average response time
      healthStatus.avgResponseTime =
        healthStatus.avgResponseTime === 0
          ? responseTime
          : healthStatus.avgResponseTime * 0.8 + responseTime * 0.2;
    }

    // Calculate error rate (simplified)
    const totalChecks = Math.max(
      1,
      Math.ceil(
        (Date.now() - (this.startupCompleted ? Date.now() - 300000 : 0)) /
          this.config.healthCheckInterval
      )
    );
    healthStatus.errorRate =
      healthStatus.consecutiveFailures / Math.max(1, Math.min(totalChecks, 10));

    // Emit status change events
    if (wasHealthy && status !== 'healthy') {
      logger.warn(`⚠️ Server ${serverId} health degraded: ${status}`);
      this.emit('serverDegraded', serverId, status, error);
    } else if (!wasHealthy && status === 'healthy') {
      logger.info(`✅ Server ${serverId} health recovered`);
      this.emit('serverRecovered', serverId);
    }
  }

  /**
   * Circuit breaker management
   */
  private incrementCircuitBreaker(serverId: string): void {
    let circuitState = this.circuitBreakers.get(serverId);
    if (!circuitState) {
      circuitState = { state: 'closed', failures: 0, lastFailure: Date.now() };
      this.circuitBreakers.set(serverId, circuitState);
    }

    circuitState.failures++;
    circuitState.lastFailure = Date.now();

    if (
      circuitState.failures >= this.config.circuitBreakerThreshold &&
      circuitState.state !== 'open'
    ) {
      circuitState.state = 'open';
      this.updateHealthStatus(serverId, 'circuit_open');
      logger.warn(`🚫 Circuit breaker opened for ${serverId} (${circuitState.failures} failures)`);
      this.emit('circuitBreakerOpened', serverId, circuitState.failures);
    }
  }

  private resetCircuitBreaker(serverId: string): void {
    const circuitState = this.circuitBreakers.get(serverId);
    if (circuitState && circuitState.state !== 'closed') {
      circuitState.state = 'closed';
      circuitState.failures = 0;
      logger.info(`✅ Circuit breaker closed for ${serverId}`);
      this.emit('circuitBreakerClosed', serverId);
    }
  }

  /**
   * Get health status for all servers
   */
  getHealthStatus(): ServerHealthStatus[] {
    return Array.from(this.healthStatuses.values());
  }

  /**
   * Get health status for specific server
   */
  getServerHealth(serverId: string): ServerHealthStatus | null {
    return this.healthStatuses.get(serverId) || null;
  }

  /**
   * Graceful shutdown of all servers
   */
  async shutdown(): Promise<void> {
    if (this.shutdownInProgress) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.shutdownInProgress = true;
    logger.info('🛑 Starting graceful MCP server shutdown...');

    try {
      // Stop health monitoring
      this.stopHealthMonitoring();

      // Shutdown servers with timeout
      const shutdownPromise = this.shutdownAllServers();
      const timeoutPromise = new Promise<void>(resolve => {
        setTimeout(() => {
          logger.warn(`⚠️ Shutdown timeout after ${this.config.maxShutdownTime}ms, forcing exit`);
          resolve();
        }, this.config.maxShutdownTime);
      });

      await Promise.race([shutdownPromise, timeoutPromise]);

      logger.info('✅ MCP server lifecycle shutdown completed');
      this.emit('shutdownComplete');
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      this.emit('shutdownError', error);
    } finally {
      this.cleanup();
    }
  }

  /**
   * Shutdown all servers
   */
  private async shutdownAllServers(): Promise<void> {
    const serverIds = Array.from(this.healthStatuses.keys());

    // Shutdown in reverse priority order
    const shutdownPromises = serverIds.map(async serverId => {
      try {
        const server = await mcpServerRegistry.getServer(serverId);
        if (server && typeof server.shutdown === 'function') {
          await server.shutdown();
        }
        logger.info(`✅ Server ${serverId} shutdown completed`);
      } catch (error) {
        logger.error(`❌ Error shutting down server ${serverId}:`, error);
      }
    });

    await Promise.allSettled(shutdownPromises);
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();
  }

  /**
   * Setup process handlers for graceful shutdown
   */
  private setupProcessHandlers(): void {
    const gracefulShutdown = () => {
      logger.info('Received shutdown signal, initiating graceful shutdown...');
      this.shutdown().finally(() => {
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('beforeExit', () => {
      if (!this.shutdownInProgress) {
        this.cleanup();
      }
    });
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.stopHealthMonitoring();
    this.removeAllListeners();
    this.healthStatuses.clear();
    this.circuitBreakers.clear();
  }
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure: number;
}

// Export singleton instance
export const mcpServerLifecycle = new MCPServerLifecycle();
