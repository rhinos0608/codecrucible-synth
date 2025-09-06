/**
 * MCP Manager Interface
 *
 * Defines the contract for Model Context Protocol server management
 * providing type safety for tool execution, server lifecycle, and monitoring.
 */

import {
  ToolExecutionArgs,
  ToolExecutionContext,
  ToolExecutionOptions,
  ToolExecutionResult,
} from '../../infrastructure/types/tool-execution-types.js';

export interface IMcpManager {
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

