/**
 * MCP Orchestration Adapter
 * Translates between application layer and MCP infrastructure
 *
 * Architecture Compliance:
 * - Adapter layer: translates between application and infrastructure
 * - Imports from Application & Domain layers
 * - Provides high-level MCP orchestration interface
 * - Handles server lifecycle and connection management
 */

import { EventEmitter } from 'events';
import {
  MCPConnectionClient,
  MCPServerInfo,
  MCPServerStatus,
} from '../infrastructure/mcp/mcp-connection-client.js';
import {
  MCPDiscoveryService,
  MCPServerProfile,
  ServerDiscoveryQuery,
  ServerSelectionResult,
} from '../domain/services/mcp-discovery-service.js';
import {
  ToolExecutionResult as BaseToolExecutionResult,
  ToolExecutionArgs,
} from '../domain/interfaces/tool-execution.js';

// Application layer interfaces
export interface MCPServerConnection {
  id: string;
  client: MCPConnectionClient;
  profile: MCPServerProfile;
  status: ConnectionStatus;
  metrics: ConnectionMetrics;
  lastActivity: Date;
}

export interface ConnectionStatus {
  connected: boolean;
  connectionTime?: Date;
  lastHeartbeat?: Date;
  errorCount: number;
  reconnectAttempts: number;
  isHealthy: boolean;
}

export interface ConnectionMetrics {
  requestCount: number;
  responseCount: number;
  errorCount: number;
  averageLatency: number;
  totalUptime: number;
  bytesTransmitted: number;
  bytesReceived: number;
}

export interface ToolExecutionRequest {
  toolName: string;
  arguments: ToolExecutionArgs;
  serverId?: string;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  priority?: ExecutionPriority;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: BaseToolExecutionResult;
  error?: string;
  executionTime: number;
  serverId: string;
  serverLatency: number;
  retryCount: number;
}

export interface ResourceAccessRequest {
  resourceUri: string;
  serverId?: string;
  cachePolicy?: CachePolicy;
  timeout?: number;
}

export interface ResourceAccessResult {
  success: boolean;
  content?: string | Buffer | object;
  contentType?: string;
  size?: number;
  error?: string;
  serverId: string;
  fromCache: boolean;
}

export enum ExecutionPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
}

export interface CachePolicy {
  enabled: boolean;
  ttl: number;
  invalidateOnUpdate: boolean;
}

export interface ServerHealthStatus {
  serverId: string;
  isHealthy: boolean;
  lastCheck: Date;
  responseTime: number;
  uptime: number;
  issues: HealthIssue[];
}

export interface HealthIssue {
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  detectedAt: Date;
  count: number;
}

export enum IssueType {
  CONNECTION_TIMEOUT = 'connection_timeout',
  HIGH_LATENCY = 'high_latency',
  HIGH_ERROR_RATE = 'high_error_rate',
  MEMORY_LEAK = 'memory_leak',
  CPU_SPIKE = 'cpu_spike',
  PROTOCOL_ERROR = 'protocol_error',
}

export enum IssueSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface LoadBalancingConfig {
  strategy: LoadBalancingStrategy;
  healthCheckInterval: number;
  failoverTimeout: number;
  maxRetries: number;
}

export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  CAPABILITY_BASED = 'capability_based',
  PERFORMANCE_WEIGHTED = 'performance_weighted',
}

/**
 * MCP Orchestration Adapter
 * High-level interface for MCP server orchestration and management
 */
export class MCPOrchestrationAdapter extends EventEmitter {
  private readonly discoveryService: MCPDiscoveryService;
  private readonly connections: Map<string, MCPServerConnection> = new Map();
  private operationCounter: number = 0;
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly loadBalancingConfig: LoadBalancingConfig;

  public constructor(
    discoveryService?: MCPDiscoveryService,
    loadBalancingConfig?: Readonly<Partial<LoadBalancingConfig>>
  ) {
    super();
    this.discoveryService = discoveryService ?? new MCPDiscoveryService();
    this.loadBalancingConfig = {
      strategy: LoadBalancingStrategy.CAPABILITY_BASED,
      healthCheckInterval: 30000,
      failoverTimeout: 5000,
      maxRetries: 3,
      ...loadBalancingConfig,
    };

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Initialize the orchestration adapter
   */
  public initialize(): void {
    this.emit('initialized');
  }

  // Server Discovery and Selection

  /**
   * Discover and connect to MCP servers based on requirements
   */
  public async discoverAndConnect(
    query: Readonly<ServerDiscoveryQuery>
  ): Promise<ServerSelectionResult> {
    const operationId = this.generateOperationId();

    try {
      // Discover available servers
      const discoveredServers = await this.discoveryService.discoverServers(query);

      if (discoveredServers.length === 0) {
        throw new Error('No servers discovered matching the criteria');
      }

      // Select optimal servers
      const selectionResult = await this.discoveryService.selectServers(discoveredServers, query);

      // Connect to selected servers
      await Promise.allSettled(
        selectionResult.primaryServers.map(async (server: Readonly<MCPServerProfile>) =>
          this.connectToServer(server)
        )
      );

      // Connect to fallback servers (fire-and-forget; do not return a Promise in forEach callback)
      selectionResult.fallbackServers.forEach((server: Readonly<MCPServerProfile>) => {
        this.connectToServer(server).catch((error: unknown) => {
          this.emit('fallbackConnectionError', { server: server.id, error });
        });
      });

      this.emit('serversDiscoveredAndConnected', {
        operationId,
        primaryCount: selectionResult.primaryServers.length,
        fallbackCount: selectionResult.fallbackServers.length,
        totalConnections: this.connections.size,
      });

      return selectionResult;
    } catch (error) {
      this.emit('discoveryError', { operationId, error });
      throw error;
    }
  }

  /**
   * Connect to a specific MCP server
   */
  public async connectToServer(
    serverProfile: Readonly<MCPServerProfile>
  ): Promise<MCPServerConnection> {
    const existingConnection = this.connections.get(serverProfile.id);
    if (existingConnection && existingConnection.client.isConnected()) {
      return existingConnection;
    }

    const serverInfo: MCPServerInfo = {
      name: serverProfile.name,
      command: 'node', // Would be extracted from serverProfile
      args: [], // Would be extracted from serverProfile
      status: MCPServerStatus.DISCONNECTED,
    };

    const client = new MCPConnectionClient(serverInfo, {
      serverCommand: serverInfo.command,
      serverArgs: serverInfo.args,
      timeout: 30000,
      retryAttempts: 3,
      retryDelayMs: 5000,
      heartbeatIntervalMs: 30000,
      maxMessageSize: 10 * 1024 * 1024,
      connectionTimeout: 10000,
    });

    const connection: MCPServerConnection = {
      id: serverProfile.id,
      client,
      profile: serverProfile,
      status: {
        connected: false,
        errorCount: 0,
        reconnectAttempts: 0,
        isHealthy: false,
      },
      metrics: {
        requestCount: 0,
        responseCount: 0,
        errorCount: 0,
        averageLatency: 0,
        totalUptime: 0,
        bytesTransmitted: 0,
        bytesReceived: 0,
      },
      lastActivity: new Date(),
    };

    // Set up event handlers
    this.setupClientEventHandlers(connection);

    try {
      await client.connect();

      connection.status.connected = true;
      connection.status.connectionTime = new Date();
      connection.status.isHealthy = true;

      this.connections.set(serverProfile.id, connection);

      this.emit('serverConnected', {
        serverId: serverProfile.id,
        serverName: serverProfile.name,
        capabilities: serverProfile.capabilities.map((c: Readonly<{ type: string }>) => c.type),
      });

      return connection;
    } catch (error) {
      connection.status.errorCount++;
      this.emit('serverConnectionError', {
        serverId: serverProfile.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Disconnect from a server
   */
  public async disconnectFromServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return;
    }

    try {
      await connection.client.disconnect();
      this.connections.delete(serverId);

      this.emit('serverDisconnected', {
        serverId,
        totalUptime: connection.metrics.totalUptime,
      });
    } catch (error) {
      this.emit('serverDisconnectionError', { serverId, error });
    }
  }

  // Tool Execution

  /**
   * Execute a tool with intelligent server selection
   */
  public async executeTool(request: Readonly<ToolExecutionRequest>): Promise<ToolExecutionResult> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      // Select server for tool execution
      const connection = await this.selectServerForTool(request.toolName, request.serverId);

      if (!connection) {
        throw new Error(`No server available for tool: ${request.toolName}`);
      }

      // Execute with retry policy
      const result = await this.executeWithRetry<BaseToolExecutionResult>(async () => {
        const toolResult: unknown = await connection.client.callTool(
          request.toolName,
          request.arguments
        );
        if (typeof toolResult !== 'object' || toolResult === null) {
          throw new Error('Tool execution did not return a valid result object');
        }
        return toolResult as BaseToolExecutionResult;
      }, request.retryPolicy ?? this.getDefaultRetryPolicy());

      const executionTime = Date.now() - startTime;

      // Update metrics
      connection.metrics.requestCount++;
      connection.metrics.responseCount++;
      connection.lastActivity = new Date();
      this.updateLatencyMetrics(connection, executionTime);

      const toolResult: ToolExecutionResult = {
        success: true,
        result,
        executionTime,
        serverId: connection.id,
        serverLatency: connection.profile.performance.averageLatency,
        retryCount: 0, // Would be tracked in executeWithRetry
      };

      this.emit('toolExecuted', {
        operationId,
        toolName: request.toolName,
        serverId: connection.id,
        executionTime,
        success: true,
      });

      return toolResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.emit('toolExecutionError', {
        operationId,
        toolName: request.toolName,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        serverId: request.serverId ?? 'unknown',
        serverLatency: 0,
        retryCount: 0,
      };
    }
  }

  /**
   * Execute multiple tools in parallel
   */
  public async executeToolsBatch(
    requests: readonly ToolExecutionRequest[]
  ): Promise<ToolExecutionResult[]> {
    const operationId = this.generateOperationId();

    try {
      const results = await Promise.allSettled(
        requests.map(async (request: Readonly<ToolExecutionRequest>) => this.executeTool(request))
      );

      const batchResults = results.map(
        (result: PromiseSettledResult<ToolExecutionResult>, index: number) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            return {
              success: false,
              error: result.reason instanceof Error ? result.reason.message : String(result.reason),
              executionTime: 0,
              serverId: requests[index].serverId ?? 'unknown',
              serverLatency: 0,
              retryCount: 0,
            };
          }
        }
      );

      this.emit('toolsBatchExecuted', {
        operationId,
        totalTools: requests.length,
        successCount: batchResults.filter((r: Readonly<ToolExecutionResult>) => r.success).length,
        failureCount: batchResults.filter((r: Readonly<ToolExecutionResult>) => !r.success).length,
      });

      return batchResults;
    } catch (error) {
      this.emit('toolsBatchError', { operationId, error });
      throw error;
    }
  }

  // Resource Access

  /**
   * Access a resource with caching and server selection
   */
  public async accessResource(
    request: Readonly<ResourceAccessRequest>
  ): Promise<ResourceAccessResult> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      // Select server for resource access
      const connection = this.selectServerForResource(request.resourceUri, request.serverId);

      if (!connection) {
        throw new Error(`No server available for resource: ${request.resourceUri}`);
      }

      // Access resource
      const result = (await connection.client.readResource(request.resourceUri)) as {
        contents?: string | Buffer | object;
        mimeType?: string;
      };
      const accessTime = Date.now() - startTime;

      // Update metrics
      connection.metrics.requestCount++;
      connection.metrics.responseCount++;
      connection.lastActivity = new Date();
      this.updateLatencyMetrics(connection, accessTime);

      const resourceResult: ResourceAccessResult = {
        success: true,
        content: result?.contents,
        contentType: result?.mimeType,
        size:
          typeof result.contents === 'string' || Buffer.isBuffer(result.contents)
            ? result.contents.length
            : 0,
        serverId: connection.id,
        fromCache: false, // Would implement caching logic
      };

      this.emit('resourceAccessed', {
        operationId,
        resourceUri: request.resourceUri,
        serverId: connection.id,
        accessTime,
        success: true,
      });

      return resourceResult;
    } catch (error) {
      const accessTime = Date.now() - startTime;

      this.emit('resourceAccessError', {
        operationId,
        resourceUri: request.resourceUri,
        error: error instanceof Error ? error.message : String(error),
        accessTime,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        serverId: request.serverId ?? 'unknown',
        fromCache: false,
      };
    }
  }

  // Server Management and Health

  /**
   * Get health status of all servers
   */
  public async getServersHealth(): Promise<ServerHealthStatus[]> {
    const healthStatuses: ServerHealthStatus[] = [];

    for (const connection of this.connections.values()) {
      const status = await this.checkServerHealth(connection);
      healthStatuses.push(status);
    }

    return healthStatuses;
  }

  /**
   * Get connection metrics for all servers
   */
  public getConnectionMetrics(): Map<string, ConnectionMetrics> {
    const metrics = new Map<string, ConnectionMetrics>();

    for (const [serverId, connection] of this.connections) {
      metrics.set(serverId, { ...connection.metrics });
    }

    return metrics;
  }

  /**
   * Get active connections
   */
  public getActiveConnections(): MCPServerConnection[] {
    return Array.from(this.connections.values()).filter(
      (conn: Readonly<MCPServerConnection>) => conn.status.connected
    );
  }

  /**
   * Force reconnection to a server
   */
  public async reconnectServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Server not found: ${serverId}`);
    }

    try {
      // Disconnect first
      await connection.client.disconnect();
      connection.status.connected = false;

      // Reconnect
      await connection.client.connect();
      connection.status.connected = true;
      connection.status.reconnectAttempts++;
      connection.status.connectionTime = new Date();

      this.emit('serverReconnected', { serverId });
    } catch (error) {
      connection.status.errorCount++;
      this.emit('serverReconnectionError', { serverId, error });
      throw error;
    }
  }

  /**
   * Close all connections and cleanup
   */
  public async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const disconnectionPromises = Array.from(this.connections.keys()).map(async serverId =>
      this.disconnectFromServer(serverId)
    );

    await Promise.allSettled(disconnectionPromises);
    this.emit('closed');
  }

  // Private helper methods

  private setupClientEventHandlers(connection: MCPServerConnection): void {
    const { client } = connection;

    client.on('connected', () => {
      connection.status.connected = true;
      connection.status.isHealthy = true;
      this.emit('connectionStatusChanged', {
        serverId: connection.id,
        connected: true,
      });
    });

    client.on('disconnected', () => {
      connection.status.connected = false;
      connection.status.isHealthy = false;
      this.emit('connectionStatusChanged', {
        serverId: connection.id,
        connected: false,
      });
    });

    client.on('connectionError', (error: unknown) => {
      connection.status.errorCount++;
      connection.status.isHealthy = false;
      this.emit('connectionError', {
        serverId: connection.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    client.on('messageReceived', () => {
      connection.metrics.responseCount++;
      connection.lastActivity = new Date();
    });

    client.on('messageSent', () => {
      connection.metrics.requestCount++;
      connection.lastActivity = new Date();
    });
  }

  private async selectServerForTool(
    toolName: string,
    preferredServerId?: string
  ): Promise<MCPServerConnection | null> {
    // If preferred server is specified and available, use it
    if (preferredServerId) {
      const connection = this.connections.get(preferredServerId);
      if (connection && connection.status.connected && connection.status.isHealthy) {
        // Check if server has the tool
        const tools = await connection.client.listTools();
        if (tools.some(tool => tool.name === toolName)) {
          return connection;
        }
      }
    }

    // Find servers with the required tool
    const eligibleConnections: MCPServerConnection[] = [];

    for (const connection of this.connections.values()) {
      if (!connection.status.connected || !connection.status.isHealthy) continue;

      try {
        const tools = await connection.client.listTools();
        if (tools.some(tool => tool.name === toolName)) {
          eligibleConnections.push(connection);
        }
      } catch (error) {
        // Skip servers that can't list tools
        continue;
      }
    }

    if (eligibleConnections.length === 0) {
      return null;
    }

    // Apply load balancing strategy
    return this.applyLoadBalancing(eligibleConnections);
  }

  private selectServerForResource(
    resourceUri: string,
    preferredServerId?: string
  ): MCPServerConnection | null {
    // Similar logic to selectServerForTool but for resources
    if (preferredServerId) {
      const connection = this.connections.get(preferredServerId);
      if (connection && connection.status.connected && connection.status.isHealthy) {
        return connection;
      }
    }

    // For now, return any healthy connection
    const healthyConnections = Array.from(this.connections.values()).filter(
      conn => conn.status.connected && conn.status.isHealthy
    );

    if (healthyConnections.length === 0) {
      return null;
    }

    return this.applyLoadBalancing(healthyConnections);
  }

  private applyLoadBalancing(connections: MCPServerConnection[]): MCPServerConnection {
    switch (this.loadBalancingConfig.strategy) {
      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        return connections.reduce((min, conn) =>
          conn.metrics.requestCount < min.metrics.requestCount ? conn : min
        );

      case LoadBalancingStrategy.PERFORMANCE_WEIGHTED:
        // Select based on performance metrics (lower latency is better)
        return connections.reduce((best, conn) =>
          conn.profile.performance.averageLatency < best.profile.performance.averageLatency
            ? conn
            : best
        );

      case LoadBalancingStrategy.ROUND_ROBIN:
      default: {
        // Simple round-robin based on operation counter
        const index = this.operationCounter % connections.length;
        return connections[index];
      }
    }
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryPolicy: RetryPolicy
  ): Promise<T> {
    let lastError: Error = new Error('No attempts were made');
    let delay = retryPolicy.initialDelay;

    for (let attempt = 0; attempt < retryPolicy.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === retryPolicy.maxAttempts - 1) {
          break; // Last attempt, don't wait
        }

        // Wait before retry
        await this.delay(delay);
        delay = Math.min(delay * retryPolicy.backoffMultiplier, retryPolicy.maxDelay);
      }
    }

    throw lastError ?? new Error('Unknown error during retry operation');
  }

  private getDefaultRetryPolicy(): RetryPolicy {
    return {
      maxAttempts: 3,
      backoffMultiplier: 2,
      initialDelay: 1000,
      maxDelay: 10000,
    };
  }

  private async checkServerHealth(connection: MCPServerConnection): Promise<ServerHealthStatus> {
    const issues: HealthIssue[] = [];
    const startTime = Date.now();

    try {
      // Perform health check (ping)
      await connection.client.sendRequest('ping');
      const responseTime = Date.now() - startTime;

      // Check for high latency
      if (responseTime > 5000) {
        issues.push({
          type: IssueType.HIGH_LATENCY,
          severity: IssueSeverity.WARNING,
          description: `High response time: ${responseTime}ms`,
          detectedAt: new Date(),
          count: 1,
        });
      }

      // Check error rate
      const errorRate =
        connection.metrics.errorCount / Math.max(connection.metrics.requestCount, 1);

      if (errorRate > 0.1) {
        issues.push({
          type: IssueType.HIGH_ERROR_RATE,
          severity: IssueSeverity.ERROR,
          description: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
          detectedAt: new Date(),
          count: connection.metrics.errorCount,
        });
      }

      return {
        serverId: connection.id,
        isHealthy: issues.length === 0,
        lastCheck: new Date(),
        responseTime,
        uptime: connection.metrics.totalUptime,
        issues,
      };
    } catch (error) {
      issues.push({
        type: IssueType.CONNECTION_TIMEOUT,
        severity: IssueSeverity.CRITICAL,
        description: `Health check failed: ${error}`,
        detectedAt: new Date(),
        count: 1,
      });

      return {
        serverId: connection.id,
        isHealthy: false,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        uptime: connection.metrics.totalUptime,
        issues,
      };
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.getServersHealth()
        .then((healthStatuses: readonly ServerHealthStatus[]) => {
          const unhealthyServers = healthStatuses.filter(
            (status: Readonly<ServerHealthStatus>) => !status.isHealthy
          );
          if (unhealthyServers.length > 0) {
            this.emit('unhealthyServersDetected', unhealthyServers);
          }

          this.emit('healthCheckCompleted', {
            totalServers: healthStatuses.length,
            healthyServers: healthStatuses.filter((s: Readonly<ServerHealthStatus>) => s.isHealthy)
              .length,
            unhealthyServers: unhealthyServers.length,
          });
        })
        .catch((error: unknown) => {
          this.emit('healthCheckError', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }, this.loadBalancingConfig.healthCheckInterval);
  }

  private updateLatencyMetrics(connection: MCPServerConnection, latency: number): void {
    const { metrics } = connection;
    const totalRequests = metrics.requestCount;

    // Calculate running average
    metrics.averageLatency =
      (metrics.averageLatency * (totalRequests - 1) + latency) / totalRequests;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateOperationId(): string {
    return `mcp_op_${Date.now()}_${++this.operationCounter}`;
  }
}

// Factory function for creating configured MCP orchestration adapters
export function createMCPOrchestrationAdapter(
  discoveryService?: MCPDiscoveryService,
  loadBalancingConfig?: Partial<LoadBalancingConfig>
): MCPOrchestrationAdapter {
  return new MCPOrchestrationAdapter(discoveryService, loadBalancingConfig);
}
