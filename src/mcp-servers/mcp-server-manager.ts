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
import { mcpServerLifecycle } from './core/mcp-server-lifecycle.js';
import { mcpServerSecurity, SecurityContext } from './core/mcp-server-security.js';
import { mcpServerMonitoring } from './core/mcp-server-monitoring.js';
import { unifiedToolRegistry } from '../infrastructure/tools/unified-tool-registry.js';
import { SmitheryMCPServer, SmitheryMCPConfig } from './smithery-mcp-server.js';

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

export type HealthCheckResult = Record<string, ServerHealth>;

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
        dependencies: []
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
        dependencies: ['filesystem']
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
        dependencies: []
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
        dependencies: ['filesystem', 'terminal']
      }
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
        dependencies: []
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

      // Start lifecycle management (handles server initialization)
      await mcpServerLifecycle.startAll();

      // Start monitoring
      mcpServerMonitoring.startMonitoring();

      // Initialize Smithery if enabled
      if (this.config.smithery?.enabled) {
        await this.initializeSmitheryServer();
      }

      this.isInitialized = true;
      logger.info('✅ MCP Server Manager initialization completed');

    } catch (error) {
      logger.error('❌ MCP Server Manager initialization failed:', error);
      throw error;
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
    logger.info('All MCP servers started via lifecycle manager');
  }

  /**
   * Start a specific server
   */
  async startServer(serverName: string): Promise<void> {
    if (!mcpServerRegistry.isServerAvailable(serverName)) {
      throw new Error(`Server ${serverName} not registered or disabled`);
    }

    const server = await mcpServerRegistry.getServer(serverName);
    if (server && typeof server.initialize === 'function') {
      await server.initialize();
    }

    logger.info(`Server ${serverName} started`);
  }

  /**
   * Execute a tool with unified security and monitoring
   */
  async executeTool(toolName: string, args: any, context: any = {}): Promise<any> {
    const securityContext: SecurityContext = {
      userId: context.userId,
      sessionId: context.sessionId,
      operation: this.inferOperation(toolName),
      resourceType: this.inferResourceType(toolName),
      requestedPath: args.path || args.directory || args.filePath,
      riskLevel: context.riskLevel || 'medium'
    };

    // Security validation
    if (securityContext.requestedPath) {
      const securityResult = await mcpServerSecurity.validateFileSystemOperation(
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
        mcpServerMonitoring.recordOperation(
          serverId,
          toolName,
          Date.now() - startTime,
          true
        );
      }

      return result.data || result;

    } catch (error) {
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
      throw error;
    }
  }

  /**
   * Secure file operations - delegates to filesystem server
   */
  async readFileSecure(filePath: string): Promise<string> {
    return this.executeTool('read_file', { path: filePath });
  }

  async writeFileSecure(filePath: string, content: string): Promise<void> {
    await this.executeTool('write_file', { path: filePath, content });
  }

  async listDirectorySecure(directoryPath: string): Promise<string[]> {
    return this.executeTool('list_files', { directory: directoryPath });
  }

  async getFileStats(filePath: string): Promise<{ exists: boolean; size?: number; modified?: Date }> {
    const exists = await this.executeTool('file_exists', { path: filePath });
    return { exists, size: 0, modified: new Date() }; // TODO: Implement proper stats
  }

  /**
   * Secure command execution - delegates to terminal server
   */
  async executeCommandSecure(command: string, args: string[] = []): Promise<string> {
    return this.executeTool('execute_command', { command, args });
  }

  /**
   * Get health status of all servers
   */
  async getHealthStatus(): Promise<HealthCheckResult> {
    const healthStatuses = mcpServerLifecycle.getHealthStatus();
    const result: HealthCheckResult = {};

    for (const healthStatus of healthStatuses) {
      const serverMetrics = mcpServerMonitoring.getServerMetrics(healthStatus.serverId);
      
      result[healthStatus.serverId] = {
        enabled: true,
        status: this.mapHealthToStatus(healthStatus.status),
        performance: serverMetrics ? {
          avgResponseTime: serverMetrics.metrics.avgResponseTime,
          successRate: (serverMetrics.metrics.successfulRequests / Math.max(1, serverMetrics.metrics.totalRequests)) * 100,
          lastHealthCheck: healthStatus.lastCheck,
          availability: healthStatus.status === 'healthy' ? 100 : 0
        } : undefined,
        capabilities: {
          toolCount: 0, // TODO: Get from actual server capabilities
          resourceCount: 0,
          promptCount: 0,
          lastDiscovered: new Date()
        }
      };
    }

    return result;
  }

  /**
   * List available servers
   */
  async listServers(): Promise<string[]> {
    return mcpServerRegistry.getRegisteredServerIds();
  }

  /**
   * Get monitoring summary
   */
  getMonitoringSummary() {
    return mcpServerMonitoring.getMonitoringSummary();
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
      apiKey: this.config.smithery.apiKey || process.env.SMITHERY_API_KEY,
      enabledServers: this.config.smithery.enabledServers || [],
      autoDiscovery: this.config.smithery.autoDiscovery ?? true,
    };

    this.smitheryServer = new SmitheryMCPServer(smitheryConfig);
    await this.smitheryServer.initialize();
    
    logger.info('✅ Smithery server initialized');
  }

  private inferOperation(toolName: string): SecurityContext['operation'] {
    if (toolName.includes('read') || toolName.includes('list') || toolName.includes('get')) return 'read';
    if (toolName.includes('write') || toolName.includes('create') || toolName.includes('save')) return 'write';
    if (toolName.includes('execute') || toolName.includes('run') || toolName.includes('command')) return 'execute';
    return 'read';
  }

  private inferResourceType(toolName: string): SecurityContext['resourceType'] {
    if (toolName.includes('file') || toolName.includes('directory')) return 'file';
    if (toolName.includes('command') || toolName.includes('execute')) return 'command';
    if (toolName.includes('network') || toolName.includes('http')) return 'network';
    return 'file';
  }

  private getServerIdForTool(toolName: string): string | null {
    // Map tool names to server IDs
    if (toolName.includes('file') || toolName.includes('read') || toolName.includes('write')) return 'filesystem';
    if (toolName.includes('git')) return 'git';
    if (toolName.includes('command') || toolName.includes('execute')) return 'terminal';
    if (toolName.includes('npm') || toolName.includes('package')) return 'packageManager';
    return null;
  }

  private mapHealthToStatus(health: string): 'stopped' | 'starting' | 'running' | 'error' | 'reconnecting' {
    switch (health) {
      case 'healthy': return 'running';
      case 'degraded': return 'running';
      case 'unhealthy': return 'error';
      case 'circuit_open': return 'error';
      default: return 'stopped';
    }
  }
}