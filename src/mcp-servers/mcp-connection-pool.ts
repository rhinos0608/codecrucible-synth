/**
 * MCP Connection Pool
 *
 * Implements connection pooling for MCP servers to address bottlenecks identified
 * in the architectural analysis. Provides:
 * - Connection reuse and pooling
 * - Load balancing across multiple server instances
 * - Circuit breaker patterns for failed connections
 * - Connection health monitoring and automatic recovery
 */

import { EventEmitter } from 'events';
import { ILogger } from '../domain/interfaces/logger.js';

export interface MCPConnection {
  id: string;
  serverId: string;
  url: string;
  isActive: boolean;
  isHealthy: boolean;
  createdAt: Date;
  lastUsed: Date;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  // Connection instance would be stored here
  connection?: unknown;
}

export interface ConnectionPoolConfig {
  maxConnectionsPerServer: number;
  maxTotalConnections: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  healthCheckIntervalMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeoutMs: number;
  enableLoadBalancing: boolean;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  unhealthyConnections: number;
  circuitBreakerOpenCount: number;
  totalRequestsServed: number;
  averageResponseTime: number;
  connectionUtilization: number;
}

export interface ServerCircuitBreaker {
  serverId: string;
  isOpen: boolean;
  failureCount: number;
  lastFailure: Date;
  nextRetryAt: Date;
}

export class MCPConnectionPool extends EventEmitter {
  private connections: Map<string, MCPConnection[]> = new Map(); // serverId -> connections
  private circuitBreakers: Map<string, ServerCircuitBreaker> = new Map();
  private config: ConnectionPoolConfig;
  private logger: ILogger;
  private healthCheckInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private stats: PoolStats;

  constructor(logger: ILogger, config?: Partial<ConnectionPoolConfig>) {
    super();
    this.logger = logger;
    this.config = {
      maxConnectionsPerServer: 5,
      maxTotalConnections: 50,
      connectionTimeoutMs: 30000,
      idleTimeoutMs: 300000, // 5 minutes
      healthCheckIntervalMs: 60000, // 1 minute
      circuitBreakerThreshold: 5,
      circuitBreakerTimeoutMs: 60000, // 1 minute
      enableLoadBalancing: true,
      retryAttempts: 3,
      retryDelayMs: 1000,
      ...config,
    };

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      unhealthyConnections: 0,
      circuitBreakerOpenCount: 0,
      totalRequestsServed: 0,
      averageResponseTime: 0,
      connectionUtilization: 0,
    };

    this.startHealthChecks();
    this.startCleanupTimer();
  }

  /**
   * Get a connection for a specific server
   */
  public async getConnection(serverId: string, serverUrl: string): Promise<MCPConnection | null> {
    // Check circuit breaker
    if (this.isCircuitBreakerOpen(serverId)) {
      this.logger.warn(`Circuit breaker open for server ${serverId}, request rejected`);
      return null;
    }

    // Try to get existing idle connection
    let connection = this.getIdleConnection(serverId);

    if (!connection) {
      // Create new connection if under limits
      if (this.canCreateNewConnection(serverId)) {
        connection = await this.createConnection(serverId, serverUrl);
      } else if (this.config.enableLoadBalancing) {
        // Try load balancing to other server instances
        connection = this.getConnectionWithLoadBalancing(serverId);
      }
    }

    if (connection) {
      connection.isActive = true;
      connection.lastUsed = new Date();
      this.updateStats();
      this.emit('connectionAcquired', { serverId, connectionId: connection.id });
    }

    return connection;
  }

  /**
   * Return a connection to the pool
   */
  public releaseConnection(
    connectionId: string,
    responseTime?: number,
    wasError: boolean = false
  ): void {
    const connection = this.findConnectionById(connectionId);
    if (!connection) {
      this.logger.warn(`Attempted to release unknown connection: ${connectionId}`);
      return;
    }

    connection.isActive = false;
    connection.lastUsed = new Date();
    connection.requestCount++;

    if (responseTime) {
      // Update rolling average response time
      const weight = 0.1; // Weight for new sample
      connection.averageResponseTime =
        connection.averageResponseTime * (1 - weight) + responseTime * weight;
    }

    if (wasError) {
      connection.errorCount++;
      this.handleConnectionError(connection);
    } else {
      // Reset error count on successful request
      connection.errorCount = Math.max(0, connection.errorCount - 1);
    }

    this.updateStats();
    this.emit('connectionReleased', {
      connectionId,
      serverId: connection.serverId,
      wasError,
      responseTime,
    });
  }

  /**
   * Remove unhealthy connection from pool
   */
  public removeConnection(connectionId: string): void {
    for (const [serverId, connections] of this.connections.entries()) {
      const index = connections.findIndex(c => c.id === connectionId);
      if (index !== -1) {
        const connection = connections[index];
        connections.splice(index, 1);

        // Clean up empty server pools
        if (connections.length === 0) {
          this.connections.delete(serverId);
        }

        this.logger.info(`Removed unhealthy connection ${connectionId} for server ${serverId}`);
        this.updateStats();
        this.emit('connectionRemoved', { connectionId, serverId });
        break;
      }
    }
  }

  /**
   * Get pool statistics
   */
  public getStats(): PoolStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get connections for a specific server
   */
  public getServerConnections(serverId: string): MCPConnection[] {
    return this.connections.get(serverId)?.slice() || [];
  }

  /**
   * Close all connections and clean up
   */
  public async dispose(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Close all connections
    for (const [serverId, connections] of this.connections.entries()) {
      for (const connection of connections) {
        // Here you would close the actual connection
        // await connection.connection?.close?.();
      }
      connections.length = 0;
    }

    this.connections.clear();
    this.circuitBreakers.clear();
    this.removeAllListeners();

    this.logger.info('MCP Connection Pool disposed');
  }

  // Private methods

  private getIdleConnection(serverId: string): MCPConnection | null {
    const connections = this.connections.get(serverId);
    if (!connections) return null;

    // Find healthy, idle connection
    const idleConnection = connections.find(
      c => !c.isActive && c.isHealthy && c.errorCount < this.config.circuitBreakerThreshold
    );

    return idleConnection || null;
  }

  private canCreateNewConnection(serverId: string): boolean {
    const serverConnections = this.connections.get(serverId)?.length || 0;
    const totalConnections = this.getTotalConnectionCount();

    return (
      serverConnections < this.config.maxConnectionsPerServer &&
      totalConnections < this.config.maxTotalConnections
    );
  }

  private async createConnection(serverId: string, serverUrl: string): Promise<MCPConnection> {
    const connectionId = `${serverId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const connection: MCPConnection = {
      id: connectionId,
      serverId,
      url: serverUrl,
      isActive: false,
      isHealthy: true,
      createdAt: new Date(),
      lastUsed: new Date(),
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      // connection: await this.establishConnection(serverUrl), // Would establish actual connection
    };

    // Store in pool
    if (!this.connections.has(serverId)) {
      this.connections.set(serverId, []);
    }
    this.connections.get(serverId)!.push(connection);

    this.logger.info(`Created new connection ${connectionId} for server ${serverId}`);
    this.emit('connectionCreated', { connectionId, serverId, serverUrl });

    return connection;
  }

  private getConnectionWithLoadBalancing(serverId: string): MCPConnection | null {
    // Simple load balancing: find least used connection across all servers
    let bestConnection: MCPConnection | null = null;
    let lowestUsage = Infinity;

    for (const connections of this.connections.values()) {
      for (const connection of connections) {
        if (!connection.isActive && connection.isHealthy) {
          const usage = connection.requestCount / (Date.now() - connection.createdAt.getTime());
          if (usage < lowestUsage) {
            lowestUsage = usage;
            bestConnection = connection;
          }
        }
      }
    }

    return bestConnection;
  }

  private findConnectionById(connectionId: string): MCPConnection | null {
    for (const connections of this.connections.values()) {
      const connection = connections.find(c => c.id === connectionId);
      if (connection) return connection;
    }
    return null;
  }

  private isCircuitBreakerOpen(serverId: string): boolean {
    const breaker = this.circuitBreakers.get(serverId);
    if (!breaker || !breaker.isOpen) return false;

    // Check if circuit breaker timeout has expired
    if (Date.now() > breaker.nextRetryAt.getTime()) {
      breaker.isOpen = false;
      this.logger.info(`Circuit breaker reset for server ${serverId}`);
      this.emit('circuitBreakerReset', { serverId });
      return false;
    }

    return true;
  }

  private handleConnectionError(connection: MCPConnection): void {
    const serverId = connection.serverId;

    // Check if we should open circuit breaker
    if (connection.errorCount >= this.config.circuitBreakerThreshold) {
      let breaker = this.circuitBreakers.get(serverId);
      if (!breaker) {
        breaker = {
          serverId,
          isOpen: false,
          failureCount: 0,
          lastFailure: new Date(),
          nextRetryAt: new Date(),
        };
        this.circuitBreakers.set(serverId, breaker);
      }

      breaker.failureCount++;
      breaker.lastFailure = new Date();
      breaker.nextRetryAt = new Date(Date.now() + this.config.circuitBreakerTimeoutMs);
      breaker.isOpen = true;

      this.logger.warn(`Circuit breaker opened for server ${serverId} due to repeated failures`);
      this.emit('circuitBreakerOpened', { serverId, failureCount: breaker.failureCount });

      // Mark connection as unhealthy
      connection.isHealthy = false;
    }
  }

  private getTotalConnectionCount(): number {
    let total = 0;
    for (const connections of this.connections.values()) {
      total += connections.length;
    }
    return total;
  }

  private updateStats(): void {
    let totalConnections = 0;
    let activeConnections = 0;
    let unhealthyConnections = 0;
    let totalResponseTime = 0;
    let totalRequests = 0;

    for (const connections of this.connections.values()) {
      for (const connection of connections) {
        totalConnections++;
        if (connection.isActive) activeConnections++;
        if (!connection.isHealthy) unhealthyConnections++;
        totalResponseTime += connection.averageResponseTime * connection.requestCount;
        totalRequests += connection.requestCount;
      }
    }

    this.stats = {
      totalConnections,
      activeConnections,
      idleConnections: totalConnections - activeConnections,
      unhealthyConnections,
      circuitBreakerOpenCount: Array.from(this.circuitBreakers.values()).filter(b => b.isOpen)
        .length,
      totalRequestsServed: totalRequests,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      connectionUtilization: totalConnections > 0 ? activeConnections / totalConnections : 0,
    };
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks().catch(error => {
        this.logger.error('Health check error:', error);
      });
    }, this.config.healthCheckIntervalMs);
  }

  private async performHealthChecks(): Promise<void> {
    for (const [serverId, connections] of this.connections.entries()) {
      for (const connection of connections) {
        // Skip active connections
        if (connection.isActive) continue;

        try {
          // Perform health check (ping, lightweight request, etc.)
          const isHealthy = await this.checkConnectionHealth(connection);

          if (connection.isHealthy !== isHealthy) {
            connection.isHealthy = isHealthy;
            this.logger.info(`Connection ${connection.id} health changed to ${isHealthy}`);
            this.emit('connectionHealthChanged', {
              connectionId: connection.id,
              serverId,
              isHealthy,
            });
          }
        } catch (error) {
          connection.isHealthy = false;
          connection.errorCount++;
          this.logger.warn(`Health check failed for connection ${connection.id}:`, error);
        }
      }
    }
  }

  private async checkConnectionHealth(connection: MCPConnection): Promise<boolean> {
    // This would implement actual health check logic
    // For now, return true if error count is below threshold
    return connection.errorCount < this.config.circuitBreakerThreshold;
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // Run cleanup every minute
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [serverId, connections] of this.connections.entries()) {
      for (let i = connections.length - 1; i >= 0; i--) {
        const connection = connections[i];

        // Remove connections that have been idle too long
        const idleTime = now - connection.lastUsed.getTime();
        if (!connection.isActive && idleTime > this.config.idleTimeoutMs) {
          connections.splice(i, 1);
          removedCount++;
          this.logger.debug(`Removed idle connection ${connection.id} (idle for ${idleTime}ms)`);
        }
      }

      // Clean up empty server pools
      if (connections.length === 0) {
        this.connections.delete(serverId);
      }
    }

    if (removedCount > 0) {
      this.logger.info(`Cleaned up ${removedCount} idle connections`);
      this.updateStats();
      this.emit('connectionsCleanedUp', { removedCount });
    }
  }

  /**
   * Force cleanup of all idle connections
   */
  public forceCleanup(): void {
    this.cleanupIdleConnections();
  }
}
