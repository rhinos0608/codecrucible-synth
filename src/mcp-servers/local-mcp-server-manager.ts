/**
 * Local MCP Server Manager
 * Manages local MCP servers to replace unreliable external Smithery dependencies
 * Based on agent recommendations for 2024-2025 MCP best practices
 */

import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'path';
import { logger } from '../core/logger.js';

export interface LocalMCPServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  enabled: boolean;
  capabilities: string[];
  restartOnFailure?: boolean;
}

export interface LocalMCPInstance {
  id: string;
  config: LocalMCPServerConfig;
  process?: ChildProcess;
  client: Client;
  transport: StdioClientTransport;
  tools: any[];
  status: 'starting' | 'connected' | 'disconnected' | 'error' | 'stopped';
  lastError?: string;
  startTime?: Date;
  restartCount: number;
}

export class LocalMCPServerManager {
  private servers: Map<string, LocalMCPInstance> = new Map();
  private isShuttingDown = false;

  constructor() {
    // Graceful shutdown handling
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Get default local MCP server configurations
   */
  static getDefaultConfigurations(): LocalMCPServerConfig[] {
    const projectRoot = process.cwd();
    
    return [
      {
        id: 'local-terminal',
        name: 'Local Terminal Server',
        command: 'node',
        args: ['./dist/mcp-servers/local-terminal-server.js'],
        cwd: projectRoot,
        enabled: true,
        capabilities: ['execute_command', 'read_file', 'write_file', 'list_directory'],
        restartOnFailure: true,
      },
      // Add more local servers as needed
    ];
  }

  /**
   * Start all enabled local MCP servers
   */
  async startAllServers(configs: LocalMCPServerConfig[] = LocalMCPServerManager.getDefaultConfigurations()): Promise<void> {
    logger.info(`Starting ${configs.length} local MCP servers...`);

    const startPromises = configs
      .filter(config => config.enabled)
      .map(config => this.startServer(config));

    await Promise.allSettled(startPromises);

    const connectedCount = Array.from(this.servers.values())
      .filter(server => server.status === 'connected').length;
    
    logger.info(`Local MCP servers started: ${connectedCount}/${configs.length} connected`);
  }

  /**
   * Start a single local MCP server
   */
  async startServer(config: LocalMCPServerConfig): Promise<LocalMCPInstance> {
    try {
      logger.debug(`Starting local MCP server: ${config.name}`);

      // Create the transport with server parameters
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: { ...process.env, ...config.env } as Record<string, string>,
        cwd: config.cwd || process.cwd(),
        stderr: 'pipe', // Pipe stderr for logging
      });

      // Create the server instance
      const instance: LocalMCPInstance = {
        id: config.id,
        config,
        client: new Client(
          {
            name: 'codecrucible-local-client',
            version: '1.0.0',
          },
          {
            capabilities: {},
          }
        ),
        transport,
        tools: [],
        status: 'starting',
        restartCount: 0,
      };

      // Connect the MCP client to the server (this will spawn the process)
      await instance.client.connect(transport);
      
      // The process is now managed by the transport
      // We can get the pid for monitoring
      instance.process = { pid: transport.pid } as any;

      // List available tools
      const toolsResult = await instance.client.listTools();
      instance.tools = toolsResult.tools || [];

      instance.status = 'connected';
      instance.startTime = new Date();

      this.servers.set(config.id, instance);

      logger.info(`Local MCP server '${config.name}' started successfully with ${instance.tools.length} tools`);
      
      return instance;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to start local MCP server '${config.name}':`, error);

      const failedInstance: LocalMCPInstance = {
        id: config.id,
        config,
        client: new Client({ name: 'failed-client', version: '1.0.0' }, { capabilities: {} }),
        transport: new StdioClientTransport({
          command: config.command,
          args: config.args,
        }),
        tools: [],
        status: 'error',
        lastError: errorMessage,
        restartCount: 0,
      };

      this.servers.set(config.id, failedInstance);
      return failedInstance;
    }
  }

  /**
   * Set up process event handlers for a server instance
   */
  private setupProcessHandlers(instance: LocalMCPInstance): void {
    if (!instance.process) return;

    instance.process.on('error', (error) => {
      logger.error(`Local MCP server '${instance.config.name}' process error:`, error);
      instance.status = 'error';
      instance.lastError = error.message;

      if (instance.config.restartOnFailure && !this.isShuttingDown) {
        this.scheduleRestart(instance);
      }
    });

    instance.process.on('exit', (code, signal) => {
      logger.warn(`Local MCP server '${instance.config.name}' exited with code ${code}, signal ${signal}`);
      
      if (instance.status === 'connected') {
        instance.status = 'disconnected';
      }

      if (instance.config.restartOnFailure && !this.isShuttingDown && code !== 0) {
        this.scheduleRestart(instance);
      }
    });

    // Log stderr for debugging
    if (instance.process.stderr) {
      instance.process.stderr.on('data', (data: Buffer) => {
        logger.debug(`Local MCP server '${instance.config.name}' stderr: ${data.toString()}`);
      });
    }
  }

  /**
   * Schedule a restart for a failed server
   */
  private scheduleRestart(instance: LocalMCPInstance): void {
    if (instance.restartCount >= 3) {
      logger.error(`Local MCP server '${instance.config.name}' failed too many times, giving up`);
      instance.status = 'error';
      instance.lastError = 'Too many restart attempts';
      return;
    }

    const restartDelay = Math.min(1000 * Math.pow(2, instance.restartCount), 30000); // Exponential backoff, max 30s
    
    logger.info(`Restarting local MCP server '${instance.config.name}' in ${restartDelay}ms (attempt ${instance.restartCount + 1}/3)`);

    setTimeout(async () => {
      if (!this.isShuttingDown) {
        instance.restartCount++;
        await this.startServer(instance.config);
      }
    }, restartDelay);
  }

  /**
   * Execute a tool call on a specific server
   */
  async executeToolCall(serverId: string, toolName: string, args: any): Promise<any> {
    const instance = this.servers.get(serverId);
    
    if (!instance) {
      throw new Error(`Local MCP server '${serverId}' not found`);
    }

    if (instance.status !== 'connected') {
      throw new Error(`Local MCP server '${serverId}' not connected (status: ${instance.status})`);
    }

    try {
      const result = await instance.client.callTool({
        name: toolName,
        arguments: args,
      });

      return result;
    } catch (error) {
      logger.error(`Tool execution failed on local server ${serverId}.${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Get available tools from a specific server
   */
  getAvailableTools(serverId?: string): any[] {
    if (serverId) {
      const instance = this.servers.get(serverId);
      return instance?.tools || [];
    }

    // Return tools from all connected servers
    const allTools: any[] = [];
    for (const instance of this.servers.values()) {
      if (instance.status === 'connected') {
        allTools.push(...instance.tools.map(tool => ({
          ...tool,
          serverId: instance.id,
          serverName: instance.config.name,
        })));
      }
    }

    return allTools;
  }

  /**
   * Get server status information
   */
  getServerStatus(): Array<{
    id: string;
    name: string;
    status: string;
    toolCount: number;
    uptime?: number;
    restartCount: number;
    lastError?: string;
  }> {
    return Array.from(this.servers.values()).map(instance => ({
      id: instance.id,
      name: instance.config.name,
      status: instance.status,
      toolCount: instance.tools.length,
      uptime: instance.startTime ? Date.now() - instance.startTime.getTime() : undefined,
      restartCount: instance.restartCount,
      lastError: instance.lastError,
    }));
  }

  /**
   * Check if a server is available
   */
  isServerAvailable(serverId: string): boolean {
    const instance = this.servers.get(serverId);
    return instance?.status === 'connected';
  }

  /**
   * Stop a specific server
   */
  async stopServer(serverId: string): Promise<void> {
    const instance = this.servers.get(serverId);
    if (!instance) {
      throw new Error(`Local MCP server '${serverId}' not found`);
    }

    logger.info(`Stopping local MCP server: ${instance.config.name}`);
    instance.status = 'stopped';

    if (instance.process) {
      instance.process.kill('SIGTERM');
    }

    try {
      await instance.client.close();
    } catch (error) {
      logger.warn(`Error closing client for server '${serverId}':`, error);
    }

    this.servers.delete(serverId);
  }

  /**
   * Shutdown all local MCP servers
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    logger.info('Shutting down all local MCP servers...');

    const shutdownPromises = Array.from(this.servers.keys()).map(serverId =>
      this.stopServer(serverId).catch(error => 
        logger.error(`Error stopping server ${serverId}:`, error)
      )
    );

    await Promise.allSettled(shutdownPromises);
    logger.info('All local MCP servers shut down');
  }
}