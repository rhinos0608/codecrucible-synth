/**
 * MCP Server Manager - Clean Architecture
 *
 * Lightweight orchestrator using dependency injection with focused modules
 * Replaces the 1885-line monolithic implementation that caused memory crashes
 *
 * Uses composition over inheritance following Coding Grimoire principles
 */

import { logger } from '../infrastructure/logging/unified-logger.js';
import { mcpServerRegistry, MCPServerDefinition } from './core/mcp-server-registry.js';
import { 
  enterpriseErrorHandler,
  EnterpriseErrorHandler 
} from '../infrastructure/error-handling/enterprise-error-handler.js';
import { ErrorCategory, ErrorSeverity } from '../infrastructure/error-handling/structured-error-system.js';
import { mcpServerLifecycle } from './core/mcp-server-lifecycle.js';
import { mcpServerSecurity, SecurityContext } from './core/mcp-server-security.js';
import { mcpServerMonitoring } from './core/mcp-server-monitoring.js';
import { unifiedToolRegistry } from '../infrastructure/tools/unified-tool-registry.js';
import { SmitheryMCPServer, SmitheryMCPConfig } from './smithery-mcp-server.js';
import { PathUtilities } from '../utils/path-utilities.js';
import { 
  ToolExecutionArgs, 
  ToolExecutionContext, 
  ToolExecutionResult,
  ToolExecutionOptions 
} from '../infrastructure/types/tool-execution-types.js';

// Define proper types for server management
export interface ServerStatus {
  id: string;
  status: 'stopped' | 'starting' | 'running' | 'error' | 'reconnecting';
  health: 'healthy' | 'degraded' | 'unhealthy' | 'circuit_open';
  capabilities: string[];
  lastSeen: Date;
}

export interface HealthCheckResult {
  status: string;
  servers: Array<{
    serverId: string;
    status: string;
    uptime: number;
    lastChecked: Date;
  }>;
}

export interface MCPServerConfig {
  filesystem: {
    enabled: boolean;
    restrictedPaths: string[];
    allowedPaths: string[];
  };
  git: {
    enabled: boolean;
    autoCommitMessages: boolean;
    safeModeEnabled: boolean;
  };
  terminal: {
    enabled: boolean;
    allowedCommands: string[];
    blockedCommands: string[];
  };
  packageManager: {
    enabled: boolean;
    autoInstall: boolean;
    securityScan: boolean;
  };
  smithery?: {
    enabled: boolean;
    apiKey?: string;
    enabledServers?: string[];
    autoDiscovery?: boolean;
  };
}

export interface ServerHealth {
  enabled: boolean;
  status: 'stopped' | 'starting' | 'running' | 'error' | 'reconnecting';
  lastError?: string;
  performance?: {
    avgResponseTime: number;
    successRate: number;
    lastHealthCheck: Date;
    availability: number;
  };
  capabilities: {
    toolCount: number;
    resourceCount: number;
    promptCount: number;
    lastDiscovered: Date;
  } | null;
}


/**
 * Clean, focused MCP Server Manager using dependency injection
 */
export class MCPServerManager {
  private config: MCPServerConfig;
  private smitheryServer?: SmitheryMCPServer;
  private isInitialized = false;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.registerServerDefinitions();
  }

  /**
   * Register server definitions with the registry
   */
  private registerServerDefinitions(): void {
    const serverDefinitions: MCPServerDefinition[] = [
      {
        id: 'filesystem',
        name: 'Filesystem Server',
        description: 'File system operations with security validation',
        type: 'filesystem',
        config: this.config.filesystem,
        enabled: this.config.filesystem.enabled,
        priority: 8,
        lazyLoad: true,
        dependencies: [],
      },
      {
        id: 'git',
        name: 'Git Server',
        description: 'Git repository operations',
        type: 'git',
        config: this.config.git,
        enabled: this.config.git.enabled,
        priority: 6,
        lazyLoad: true,
        dependencies: ['filesystem'],
      },
      {
        id: 'terminal',
        name: 'Terminal Server',
        description: 'Secure command execution',
        type: 'terminal',
        config: this.config.terminal,
        enabled: this.config.terminal.enabled,
        priority: 7,
        lazyLoad: true,
        dependencies: [],
      },
      {
        id: 'packageManager',
        name: 'Package Manager Server',
        description: 'Package management operations',
        type: 'package',
        config: this.config.packageManager,
        enabled: this.config.packageManager.enabled,
        priority: 5,
        lazyLoad: true,
        dependencies: ['filesystem', 'terminal'],
      },
    ];

    // Register Smithery server if enabled
    if (this.config.smithery?.enabled) {
      serverDefinitions.push({
        id: 'smithery',
        name: 'Smithery Registry Server',
        description: 'External MCP server discovery and management',
        type: 'external',
        config: this.config.smithery,
        enabled: true,
        priority: 9,
        lazyLoad: true,
        dependencies: [],
      });
    }

    // Register all definitions
    serverDefinitions.forEach(definition => {
      mcpServerRegistry.register(definition);
    });

    logger.info(`Registered ${serverDefinitions.length} server definitions`);
  }

  /**
   * Initialize the MCP server system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('MCPServerManager already initialized');
      return;
    }

    try {
      logger.info('🚀 Initializing MCP Server Manager with focused architecture');

      // Perform initialization tasks such as:
      // - Loading configuration files or environment variables
      // - Initializing shared resources or dependencies
      // - Performing security checks or validations
      // - Preparing monitoring or logging subsystems
      // Add additional setup steps here as needed before starting servers.

      this.isInitialized = true;
      logger.info('✅ MCP Server Manager initialization completed');
    } catch (error) {
      // Use enterprise error handler for initialization failures
      const structuredError = await enterpriseErrorHandler.handleEnterpriseError(
        error as Error,
        {
          operation: 'mcp_initialization',
          resource: 'mcp_servers',
          context: { serverCount: 0, phase: 'startup' }
        }
      );
      
      logger.error('❌ MCP Server Manager initialization failed:', structuredError.message);
      
      // Provide recovery suggestions
      if (structuredError.recoverable) {
        logger.info('🔄 Recovery may be possible. Check MCP server configurations.');
        if (structuredError.suggestedActions) {
          structuredError.suggestedActions.forEach(action => {
            logger.info(`  • ${action}`);
          });
        }
      }
      
      throw structuredError;
    }
  }

  /**
   * Start all registered servers
   */
  async startServers(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Lifecycle manager handles the actual startup
    await mcpServerLifecycle.startAll();

    // Register servers with monitoring before starting monitoring to prevent warnings
    this.registerServersWithMonitoring();

    // Start monitoring after servers are running and registered
    mcpServerMonitoring.startMonitoring();

    // Initialize Smithery if enabled
    if (this.config.smithery?.enabled) {
      await this.initializeSmitheryServer();
    }

    logger.info('All MCP servers started via lifecycle manager');
  }

  /**
   * Start a specific server
   */
  async startServer(serverName: string): Promise<void> {
    if (!mcpServerRegistry.isServerAvailable(serverName)) {
      const error = EnterpriseErrorHandler.createEnterpriseError(
        `Server ${serverName} not registered or disabled`,
        ErrorCategory.NOT_FOUND,
        ErrorSeverity.MEDIUM,
        {
          operation: 'server_access',
          resource: 'mcp_server',
          serverName,
          context: { availableServers: mcpServerRegistry.getRegisteredServerIds() }
        }
      );
      
      throw error;
    }

    const server = await mcpServerRegistry.getServer(serverName);
    if (server && typeof server.initialize === 'function') {
      await server.initialize();
    }

    logger.info(`Server ${serverName} started`);
  }

  /**
   * Execute a tool with unified security and monitoring using strict typing
   * Ensures initialization is complete before tool execution
   */
  async executeTool(
    toolName: string, 
    args: ToolExecutionArgs, 
    context: ToolExecutionContext = {},
    options: ToolExecutionOptions = {}
  ): Promise<ToolExecutionResult> {
    // Ensure initialization is complete before executing tools
    if (!this.isInitialized) {
      logger.debug('MCPServerManager not initialized, initializing now before tool execution');
      await this.initialize();
    }
    // Normalize paths before security validation to handle AI-generated paths
    const normalizedPath = this.normalizeAIPath(args.path || args.directory || args.filePath);
    
    const securityContext: SecurityContext = {
      userId: context.userId,
      sessionId: context.sessionId,
      operation: this.inferOperation(toolName),
      resourceType: this.inferResourceType(toolName),
      requestedPath: normalizedPath,
      riskLevel: context.riskLevel || 'medium',
    };

    // Security validation
    let securityResult: { allowed: boolean; reason?: string; sanitizedPath?: string } | null = null;
    if (securityContext.requestedPath) {
      securityResult = await mcpServerSecurity.validateFileSystemOperation(
        securityContext.requestedPath,
        securityContext
      );

      if (!securityResult.allowed) {
        throw new Error(`Security validation failed: ${securityResult.reason}`);
      }

      // Use sanitized path if available
      if (securityResult.sanitizedPath) {
        args.path = securityResult.sanitizedPath;
        args.directory = securityResult.sanitizedPath;
        args.filePath = securityResult.sanitizedPath;
      }
    }

    // Execute through unified tool registry
    const startTime = Date.now();
    try {
      const result = await unifiedToolRegistry.executeTool(toolName, args, context);

      // Record successful operation
      const serverId = this.getServerIdForTool(toolName);
      if (serverId) {
        mcpServerMonitoring.recordOperation(serverId, toolName, Date.now() - startTime, true);
      }

      // Return properly structured ToolExecutionResult
      const executionResult: ToolExecutionResult = {
        success: true,
        data: result.data || result,
        output: {
          content: typeof result === 'string' ? result : JSON.stringify(result.data || result),
          format: typeof result === 'string' ? 'text' : 'json'
        },
        metadata: {
          executionTime: Date.now() - startTime,
          toolName,
          requestId: context.requestId,
          resourcesAccessed: normalizedPath ? [normalizedPath] : undefined,
          warnings: securityResult?.reason ? [securityResult.reason] : undefined
        }
      };

      return executionResult;
    } catch (error) {
      // Use enterprise error handler for tool execution failures
      const structuredError = await enterpriseErrorHandler.handleEnterpriseError(
        error as Error,
        {
          operation: 'tool_execution',
          resource: 'mcp_tool',
          context: { 
            toolName,
            args: JSON.stringify(args).substring(0, 200),
            serverId: this.getServerIdForTool(toolName)
          }
        }
      );
      
      // Record failed operation
      const serverId = this.getServerIdForTool(toolName);
      if (serverId) {
        mcpServerMonitoring.recordOperation(
          serverId,
          toolName,
          Date.now() - startTime,
          false,
          error instanceof Error ? error.message : String(error)
        );
      }

      // Return properly structured error result instead of throwing
      const errorResult: ToolExecutionResult = {
        success: false,
        error: {
          code: error instanceof Error ? error.name : 'UnknownError',
          message: error instanceof Error ? error.message : String(error),
          details: { 
            toolName, 
            args: JSON.stringify(args),
            context: JSON.stringify(context)
          },
          stack: error instanceof Error ? error.stack : undefined
        },
        metadata: {
          executionTime: Date.now() - startTime,
          toolName,
          requestId: context.requestId,
          warnings: securityResult?.reason ? [securityResult.reason] : undefined
        }
      };

      return errorResult;
    }
  }

  /**
   * Secure file operations - delegates to filesystem server
   */
  async readFileSecure(filePath: string): Promise<string> {
    const result = await this.executeTool('read_file', { path: filePath });
    return result.data || '';
  }

  async writeFileSecure(filePath: string, content: string): Promise<void> {
    await this.executeTool('write_file', { path: filePath, content });
  }

  async listDirectorySecure(directoryPath: string): Promise<string[]> {
    const result = await this.executeTool('list_files', { directory: directoryPath });
    return result.data || [];
  }

  async getFileStats(
    filePath: string
  ): Promise<{ exists: boolean; size?: number; modified?: Date }> {
    try {
      // First check if file exists
      const exists = await this.executeTool('file_exists', { path: filePath });

      if (!exists) {
        return { exists: false };
      }

      // Get real file stats using filesystem tools
      const statsResult = await this.executeTool('get_file_info', { path: filePath });
      const stats = statsResult.data;

      return {
        exists: true,
        size: stats?.size || 0,
        modified: stats?.modified ? new Date(stats.modified) : new Date(),
      };
    } catch (error) {
      logger.warn(`Failed to get file stats for ${filePath}:`, error);

      // Fallback to basic exists check
      try {
        const existsResult = await this.executeTool('file_exists', { path: filePath });
        return { exists: existsResult.data || false, size: undefined, modified: undefined };
      } catch (fallbackError) {
        return { exists: false };
      }
    }
  }

  /**
   * Secure command execution - delegates to terminal server
   */
  async executeCommandSecure(command: string, args: string[] = []): Promise<string> {
    const result = await this.executeTool('execute_command', { command, args });
    return result.data || '';
  }

  /**
   * Get health status of all servers (matches McpManager interface)
   */
  async getHealthStatus(): Promise<{
    overall: 'healthy' | 'degraded' | 'critical';
    servers: Array<{
      serverId: string;
      status: 'running' | 'error' | 'stopped';
      uptime: number;
      successRate: number;
      lastSeen: Date;
    }>;
    capabilities: {
      totalTools: number;
      totalServers: number;
      registryStatus: string;
      smitheryEnabled?: boolean;
      smitheryTools?: number;
      smitheryServers?: number;
    };
  }> {
    const healthStatuses = mcpServerLifecycle.getHealthStatus();
    
    // Get real capability counts
    const capabilities = await this.getServerCapabilities();
    
    // Transform server health data to match expected format
    const servers = healthStatuses.map(healthStatus => {
      const serverMetrics = mcpServerMonitoring.getServerMetrics(healthStatus.serverId);
      
      return {
        serverId: healthStatus.serverId,
        status: this.mapHealthToMcpStatus(healthStatus.status),
        uptime: Date.now() - (healthStatus.lastCheck?.getTime() || Date.now()),
        successRate: serverMetrics 
          ? (serverMetrics.metrics.successfulRequests / Math.max(1, serverMetrics.metrics.totalRequests)) * 100
          : 0,
        lastSeen: healthStatus.lastCheck || new Date()
      };
    });
    
    // Calculate overall health status
    const healthyCount = servers.filter(s => s.status === 'running').length;
    const totalCount = servers.length;
    let overall: 'healthy' | 'degraded' | 'critical';
    
    if (totalCount === 0) {
      overall = 'critical';
    } else if (healthyCount === totalCount) {
      overall = 'healthy';
    } else if (healthyCount > totalCount / 2) {
      overall = 'degraded';
    } else {
      overall = 'critical';
    }
    
    // Get Smithery stats if available
    const smitheryEnabled = !!this.smitheryServer;
    const smitheryTools = smitheryEnabled ? this.smitheryServer!.getAvailableTools().length : 0;
    const smitheryServers = smitheryEnabled ? 1 : 0;
    
    return {
      overall,
      servers,
      capabilities: {
        totalTools: capabilities.toolCount,
        totalServers: totalCount,
        registryStatus: 'active', // TODO: Get actual registry status
        smitheryEnabled,
        smitheryTools,
        smitheryServers
      }
    };
  }

  /**
   * Get real server capabilities from active services
   */
  private async getServerCapabilities(): Promise<{
    toolCount: number;
    resourceCount: number;
    promptCount: number;
  }> {
    let totalToolCount = 0;
    let totalResourceCount = 0;
    let totalPromptCount = 0;

    try {
      // Get tool count from unified tool registry
      const toolRegistryStatus = unifiedToolRegistry.getRegistryStatus();
      totalToolCount += toolRegistryStatus.totalTools;

      // Get additional tools from Smithery if available
      if (this.smitheryServer) {
        const smitheryTools = this.smitheryServer.getAvailableTools();
        totalToolCount += smitheryTools.length;

        // Use server count as resource count approximation
        const smitheryServers = this.smitheryServer.getAvailableServers();
        totalResourceCount += smitheryServers.length;
      }

      // For now, set promptCount based on server count (could be enhanced)
      totalPromptCount = Math.min(totalResourceCount, 10); // Conservative estimate

      logger.debug('Server capabilities calculated', {
        toolCount: totalToolCount,
        resourceCount: totalResourceCount,
        promptCount: totalPromptCount,
      });
    } catch (error) {
      logger.warn('Error calculating server capabilities:', error);
      // Fallback to 0 values if calculation fails
    }

    return {
      toolCount: totalToolCount,
      resourceCount: totalResourceCount,
      promptCount: totalPromptCount,
    };
  }

  /**
   * List available servers
   */
  async listServers(): Promise<string[]> {
    return mcpServerRegistry.getRegisteredServerIds();
  }

  /**
   * Get monitoring summary (matches McpManager interface)
   */
  getMonitoringSummary(): {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    averageLatency: number;
    uptimePercentage: number;
    lastActivity?: Date;
  } {
    const actualSummary = mcpServerMonitoring.getMonitoringSummary();
    const servers = mcpServerMonitoring.getAllServerMetrics();
    
    // Calculate interface-expected values from available data
    const successCount = servers.reduce((sum, s) => sum + s.metrics.successfulRequests, 0);
    const totalRequests = actualSummary.totalRequests;
    const errorCount = totalRequests - successCount;
    const uptimePercentage = actualSummary.healthyServers / Math.max(1, actualSummary.totalServers) * 100;
    
    return {
      totalRequests,
      successCount,
      errorCount,
      averageLatency: actualSummary.avgResponseTime,
      uptimePercentage,
      lastActivity: new Date() // Current time as approximation
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('🛑 Shutting down MCP Server Manager');

    // Shutdown Smithery server
    if (this.smitheryServer) {
      try {
        await this.smitheryServer.shutdown();
      } catch (error) {
        logger.error('Error shutting down Smithery server:', error);
      }
    }

    // Shutdown lifecycle manager (handles all servers)
    await mcpServerLifecycle.shutdown();

    // Stop monitoring
    mcpServerMonitoring.stopMonitoring();

    this.isInitialized = false;
    logger.info('✅ MCP Server Manager shutdown completed');
  }

  /**
   * Initialize Smithery server
   */
  private async initializeSmitheryServer(): Promise<void> {
    if (!this.config.smithery?.enabled) return;

    const smitheryConfig: SmitheryMCPConfig = {
      apiKey: this.config.smithery.apiKey || process.env.SMITHERY_API_KEY || '',
      enabledServers: this.config.smithery.enabledServers || [],
      autoDiscovery: this.config.smithery.autoDiscovery ?? true,
    };

    this.smitheryServer = new SmitheryMCPServer(smitheryConfig);
    await this.smitheryServer.initialize();

    logger.info('✅ Smithery server initialized');
  }

  /**
   * Normalize AI-generated paths using centralized utilities
   */
  private normalizeAIPath(filePath?: string): string | undefined {
    if (!filePath || typeof filePath !== 'string') {
      return filePath;
    }
    
    // Use centralized path utilities with intelligent normalization
    return PathUtilities.normalizeAIPath(filePath, {
      allowAbsolute: true,
      allowRelative: true,
      allowTraversal: false,
      basePath: process.cwd()
    });
  }

  private inferOperation(toolName: string): SecurityContext['operation'] {
    if (toolName.includes('git'))
      return 'read'; // Git operations are read-like but work on directories
    if (toolName.includes('read') || toolName.includes('list') || toolName.includes('get'))
      return 'read';
    if (toolName.includes('write') || toolName.includes('create') || toolName.includes('save'))
      return 'write';
    if (toolName.includes('execute') || toolName.includes('run') || toolName.includes('command'))
      return 'execute';
    return 'read';
  }

  private inferResourceType(toolName: string): SecurityContext['resourceType'] {
    if (toolName.includes('file') || toolName.includes('directory')) return 'file';
    if (toolName.includes('command') || toolName.includes('execute')) return 'command';
    if (toolName.includes('network') || toolName.includes('http')) return 'network';
    return 'file';
  }

  /**
   * Register all server IDs with monitoring to prevent "unregistered server" warnings
   */
  private registerServersWithMonitoring(): void {
    const serverIds = ['filesystem', 'git', 'terminal', 'packageManager'];
    
    for (const serverId of serverIds) {
      mcpServerMonitoring.registerServer(serverId);
      logger.debug(`Registered server ${serverId} with monitoring system`);
    }
    
    logger.info(`Registered ${serverIds.length} servers with monitoring system`);
  }

  private getServerIdForTool(toolName: string): string | null {
    // Map tool names to server IDs
    if (toolName.includes('file') || toolName.includes('read') || toolName.includes('write'))
      return 'filesystem';
    if (toolName.includes('git')) return 'git';
    if (toolName.includes('command') || toolName.includes('execute')) return 'terminal';
    if (toolName.includes('npm') || toolName.includes('package')) return 'packageManager';
    return null;
  }

  getServerStatus(serverId: string): ServerStatus {
    // Return basic server status for the given server ID
    return {
      id: serverId,
      status: 'running',
      health: 'healthy',
      capabilities: ['read', 'write', 'execute'],
      lastSeen: new Date(),
    };
  }

  private mapHealthToStatus(
    health: string
  ): 'stopped' | 'starting' | 'running' | 'error' | 'reconnecting' {
    switch (health) {
      case 'healthy':
        return 'running';
      case 'degraded':
        return 'running';
      case 'unhealthy':
        return 'error';
      case 'circuit_open':
        return 'error';
      default:
        return 'stopped';
    }
  }

  private mapHealthToMcpStatus(
    health: string
  ): 'running' | 'error' | 'stopped' {
    switch (health) {
      case 'healthy':
        return 'running';
      case 'degraded':
        return 'running';
      case 'unhealthy':
        return 'error';
      case 'circuit_open':
        return 'error';
      default:
        return 'stopped';
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const serverIds = await this.listServers();
    const serverStatuses = await Promise.all(
      serverIds.map(async serverId => {
        const status = await this.getServerStatus(serverId);
        return {
          serverId: serverId,
          status: status.status,
          uptime: 0, // Would need to track actual uptime
          lastChecked: new Date(),
        };
      })
    );

    const allHealthy = serverStatuses.every(server => server.status === 'running');

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      servers: serverStatuses,
    };
  }
}
