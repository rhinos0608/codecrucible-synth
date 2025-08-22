import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { logger } from '../core/logger.js';

export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  enabled: boolean;
  capabilities?: string[];
}

export interface MCPClientInstance {
  id: string;
  client: Client;
  transport: StreamableHTTPClientTransport;
  tools: any[];
  status: 'connected' | 'disconnected' | 'error';
  lastError?: string;
}

export class EnhancedMCPClientManager {
  private clients: Map<string, MCPClientInstance> = new Map();
  private config: MCPServerConfig[];

  constructor(config: MCPServerConfig[]) {
    this.config = config;
  }

  async initializeServers(): Promise<void> {
    const initPromises = this.config
      .filter(server => server.enabled)
      .map(server => this.connectToServer(server));
    
    await Promise.allSettled(initPromises);
  }

  private async connectToServer(config: MCPServerConfig): Promise<void> {
    try {
      // Construct server URL with authentication
      const url = new URL(config.url);
      url.searchParams.set("api_key", config.apiKey);
      const serverUrl = url.toString();

      // Create transport
      const transport = new StreamableHTTPClientTransport(new URL(serverUrl));

      // Create MCP client
      const client = new Client({
        name: "CodeCrucible Synth",
        version: "3.9.1"
      });

      await client.connect(transport);

      // List available tools
      const toolsResult = await client.listTools();
      const tools = toolsResult?.tools || [];
      
      // Store client instance
      this.clients.set(config.id, {
        id: config.id,
        client,
        transport,
        tools: tools,
        status: 'connected'
      });

      logger.info(`✅ Connected to ${config.name}: ${tools.map(t => t.name).join(", ") || 'No tools'}`);
    } catch (error) {
      logger.error(`❌ Failed to connect to ${config.name}:`, error);
      this.clients.set(config.id, {
        id: config.id,
        client: null as any,
        transport: null as any,
        tools: [],
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async executeToolCall(serverId: string, toolName: string, args: any): Promise<any> {
    const clientInstance = this.clients.get(serverId);
    if (!clientInstance || clientInstance.status !== 'connected') {
      throw new Error(`MCP server ${serverId} not available`);
    }

    try {
      const result = await clientInstance.client.callTool({
        name: toolName,
        arguments: args
      });
      
      return result;
    } catch (error) {
      logger.error(`Tool execution failed on ${serverId}.${toolName}:`, error);
      throw error;
    }
  }

  getAvailableTools(serverId?: string): any[] {
    if (serverId) {
      const client = this.clients.get(serverId);
      return client?.tools || [];
    }
    
    // Return all tools from all servers
    const allTools: any[] = [];
    for (const client of this.clients.values()) {
      allTools.push(...client.tools.map(tool => ({
        ...tool,
        serverId: client.id
      })));
    }
    return allTools;
  }

  async healthCheck(): Promise<{[serverId: string]: any}> {
    const health: {[serverId: string]: any} = {};
    
    for (const [id, instance] of this.clients) {
      health[id] = {
        status: instance.status,
        toolCount: instance.tools.length,
        lastError: instance.lastError,
        tools: instance.tools.map(t => t.name)
      };
    }
    
    return health;
  }

  async disconnect(): Promise<void> {
    for (const instance of this.clients.values()) {
      try {
        if (instance.client) {
          await instance.client.close();
        }
      } catch (error) {
        logger.error(`Error disconnecting ${instance.id}:`, error);
      }
    }
    this.clients.clear();
  }
}