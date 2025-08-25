/**
 * MCP Server Manager - Basic implementation for compatibility
 * Provides enterprise MCP server management capabilities
 */

import { EventEmitter } from 'events';
import { logger } from './logger.js';

export interface MCPServer {
  id: string;
  name: string;
  endpoint: string;
  status: 'connected' | 'disconnected' | 'error';
  listTools?(): Promise<any[]>;
  listResources?(): Promise<any[]>;
  listPrompts?(): Promise<any[]>;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  endpoint: string;
  enabled: boolean;
  timeout: number;
}

export class MCPServerManager extends EventEmitter {
  private servers: Map<string, MCPServer> = new Map();
  private configs: Map<string, MCPServerConfig> = new Map();

  constructor() {
    super();
  }

  public async addServer(config: MCPServerConfig): Promise<void> {
    this.configs.set(config.id, config);

    const server: MCPServer = {
      id: config.id,
      name: config.name,
      endpoint: config.endpoint,
      status: 'disconnected',

      async listTools() {
        return [];
      },

      async listResources() {
        return [];
      },

      async listPrompts() {
        return [];
      },
    };

    this.servers.set(config.id, server);
    this.emit('server-added', server);
    logger.info(`MCP server added: ${config.name}`);
  }

  public getServer(id: string): MCPServer | undefined {
    return this.servers.get(id);
  }

  public getAllServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  public async removeServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (server) {
      this.servers.delete(id);
      this.configs.delete(id);
      this.emit('server-removed', server);
      logger.info(`MCP server removed: ${id}`);
    }
  }

  public async connectServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (server) {
      server.status = 'connected';
      this.emit('server-connected', server);
      logger.info(`MCP server connected: ${id}`);
    }
  }

  public async disconnectServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (server) {
      server.status = 'disconnected';
      this.emit('server-disconnected', server);
      logger.info(`MCP server disconnected: ${id}`);
    }
  }

  public getServerStatus(id: string): string | undefined {
    const server = this.servers.get(id);
    return server?.status;
  }

  public async healthCheck(): Promise<{ total: number; connected: number; failed: number }> {
    const servers = Array.from(this.servers.values());
    const connected = servers.filter(s => s.status === 'connected').length;
    const failed = servers.filter(s => s.status === 'error').length;

    return {
      total: servers.length,
      connected,
      failed,
    };
  }

  /**
   * Graceful shutdown of all MCP servers
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down MCP server manager...');
    
    // Disconnect all servers
    const disconnectionPromises = Array.from(this.servers.keys()).map(id => 
      this.disconnectServer(id)
    );
    
    await Promise.allSettled(disconnectionPromises);
    
    // Clear data structures
    this.servers.clear();
    this.configs.clear();
    
    // Remove all event listeners to prevent memory leaks
    this.removeAllListeners();
    
    logger.info('MCP server manager shutdown completed');
  }

  /**
   * Emergency cleanup of all resources
   */
  public async destroy(): Promise<void> {
    logger.warn('Emergency cleanup of MCP server manager...');
    
    // Force clear all data structures
    this.servers.clear();
    this.configs.clear();
    
    // Remove all event listeners to prevent memory leaks
    this.removeAllListeners();
    
    logger.info('MCP server manager destroyed');
  }
}
