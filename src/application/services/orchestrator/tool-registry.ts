import { ModelTool } from '../../../domain/interfaces/model-client.js';
import { createDefaultToolRegistry } from '../../../infrastructure/tools/default-tool-registry.js';
import { logger } from '../../../infrastructure/logging/logger.js';
import { 
  ToolExecutionArgs, 
  ToolExecutionContext, 
  ToolExecutionResult,
  ToolExecutionOptions 
} from '../../../infrastructure/types/tool-execution-types.js';

/**
 * Complete MCP Manager Interface
 * 
 * Defines the contract for Model Context Protocol server management
 * Provides type safety for tool execution, server lifecycle, and monitoring
 */
export interface McpManager {
  // Core Lifecycle Methods
  initialize(): Promise<void>;
  startServers(): Promise<void>;
  startServer(serverName: string): Promise<void>;
  shutdown(): Promise<void>;

  // Tool Execution (Primary Interface)
  executeTool(
    toolName: string, 
    args: ToolExecutionArgs, 
    context?: ToolExecutionContext,
    options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult>;

  // Convenient File System Methods
  readFileSecure(filePath: string): Promise<string>;
  writeFileSecure(filePath: string, content: string): Promise<void>;
  listDirectorySecure(directoryPath: string): Promise<string[]>;
  getFileStats(filePath: string): Promise<{
    exists: boolean;
    size?: number;
    modified?: Date;
  }>;

  // Command Execution
  executeCommandSecure(command: string, args?: string[]): Promise<string>;

  // Server Management
  listServers(): Promise<string[]>;
  getServerStatus(serverId: string): any;
  
  // Health and Monitoring
  getHealthStatus(): Promise<{
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
  }>;

  healthCheck(): Promise<{
    status: string;
    servers: Array<{
      serverId: string;
      status: string;
      uptime: number;
      lastChecked: Date;
    }>;
  }>;

  getMonitoringSummary(): {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    averageLatency: number;
    uptimePercentage: number;
    lastActivity?: Date;
  };
}

/**
 * Wrapper around MCP tool registry with simple caching.
 */
export class ToolRegistry {
  private registryCache: Map<string, ModelTool> | null = null;

  constructor(private readonly mcpManager?: McpManager) {}

  private initializeRegistry(): Map<string, ModelTool> {
    if (!this.registryCache) {
      this.registryCache = createDefaultToolRegistry({ mcpManager: this.mcpManager });
    }
    return this.registryCache;
  }

  async getToolsForModel(userQuery?: string): Promise<ModelTool[]> {
    if (!this.mcpManager) {
      return [];
    }
    try {
      const registry = this.initializeRegistry();
      const allTools = Array.from(registry.values());
      logger.info(
        `🎯 Providing all ${allTools.length} available tools to AI for intelligent selection`
      );
      return allTools;
    } catch (error) {
      logger.warn('Failed to get MCP tools for model:', error);
      const registry = this.initializeRegistry();
      return ['filesystem_list', 'filesystem_read'].map(key => registry.get(key)!).filter(Boolean);
    }
  }

  getAllAvailableTools(): string[] {
    const registry = this.initializeRegistry();
    return Array.from(registry.keys());
  }
}

export default ToolRegistry;
