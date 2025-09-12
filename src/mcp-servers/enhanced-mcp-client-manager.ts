/**
 * Enhanced MCP Client Manager
 * Advanced MCP client management with connection pooling and health monitoring
 */

import { MCPServerManager } from './mcp-server-manager.js';
import { createLogger } from '../infrastructure/logging/logger-adapter.js';
import { EventEmitter } from 'events';
import { MCPConnectionPool, ConnectionPoolConfig, PoolStats } from './mcp-connection-pool.js';

export interface ClientConfig {
  maxConnections: number;
  connectionTimeout: number;
  retryAttempts: number;
  healthCheckInterval: number;
  enableLoadBalancing: boolean;
}

export interface MCPServerConfig {
  id?: string;
  name: string;
  command?: string;
  url?: string;
  apiKey?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  timeout?: number;
  maxRetries?: number;
  capabilities?: string[];
}

export class EnhancedMCPClientManager extends EventEmitter {
  private readonly baseManager: MCPServerManager;
  private connectionPool: MCPConnectionPool;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly logger = createLogger('EnhancedMCPClientManager');

  public constructor(public readonly config?: Readonly<Partial<ClientConfig>>) {
    super();

    this.config = {
      maxConnections: 10,
      connectionTimeout: 30000,
      retryAttempts: 3,
      healthCheckInterval: 60000,
      enableLoadBalancing: true,
      ...config,
    };

    // Create default MCP server config for the base manager
    const defaultMCPConfig = {
      filesystem: { enabled: true, restrictedPaths: [] as string[], allowedPaths: [] as string[] },
      git: { enabled: true, autoCommitMessages: false, safeModeEnabled: true },
      terminal: {
        enabled: false,
        allowedCommands: [] as string[],
        blockedCommands: [] as string[],
      },
      packageManager: { enabled: false, autoInstall: false, securityScan: true },
    };
    this.baseManager = new MCPServerManager(defaultMCPConfig);

    // Initialize connection pool with optimized settings
    this.connectionPool = new MCPConnectionPool(this.logger, {
      maxConnectionsPerServer: this.config.maxConnections || 5,
      maxTotalConnections: (this.config.maxConnections || 5) * 10, // Allow more total connections
      connectionTimeoutMs: this.config.connectionTimeout || 30000,
      idleTimeoutMs: 300000, // 5 minutes
      healthCheckIntervalMs: this.config.healthCheckInterval || 60000,
      circuitBreakerThreshold: 3,
      circuitBreakerTimeoutMs: 60000,
      enableLoadBalancing: this.config.enableLoadBalancing !== false,
      retryAttempts: this.config.retryAttempts || 3,
      retryDelayMs: 1000,
    });

    // Set up connection pool event listeners
    this.connectionPool.on('connectionCreated', event => {
      this.logger.debug(`MCP connection created: ${event.connectionId} for ${event.serverId}`);
    });

    this.connectionPool.on('circuitBreakerOpened', event => {
      this.logger.warn(`MCP circuit breaker opened for server: ${event.serverId}`);
      this.emit('serverUnavailable', event);
    });

    this.connectionPool.on('connectionsCleanedUp', event => {
      this.logger.info(`MCP connections cleaned up: ${event.removedCount} connections removed`);
    });

    this.startHealthMonitoring();
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Enhanced MCP Client Manager');
    await this.baseManager.initialize();
  }

  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      // Move the void expression to its own statement and ensure proper typing
      this.performHealthChecks().catch(error => {
        this.logger.error(
          'Health check error:',
          error instanceof Error ? error : new Error(String(error))
        );
      });
    }, this.config?.healthCheckInterval ?? 60000);
  }

  private async performHealthChecks(): Promise<void> {
    // Health check implementation would go here
    this.logger.debug('Performing MCP client health checks');
    return Promise.resolve();
  }

  /**
   * Get connection pool statistics
   */
  public getConnectionPoolStats(): PoolStats {
    return this.connectionPool.getStats();
  }

  /**
   * Get a connection for a specific server (for advanced usage)
   */
  public async getConnection(serverId: string, serverUrl: string) {
    return await this.connectionPool.getConnection(serverId, serverUrl);
  }

  /**
   * Release a connection back to the pool
   */
  public releaseConnection(
    connectionId: string,
    responseTime?: number,
    wasError: boolean = false
  ): void {
    this.connectionPool.releaseConnection(connectionId, responseTime, wasError);
  }

  /**
   * Force connection pool cleanup
   */
  public forceConnectionCleanup(): void {
    this.connectionPool.forceCleanup();
  }

  public async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Dispose connection pool first
    await this.connectionPool.dispose();

    await this.baseManager.shutdown();
    this.logger.info('Enhanced MCP Client Manager shutdown complete');
  }
}
