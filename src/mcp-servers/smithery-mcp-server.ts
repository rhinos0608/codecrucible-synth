import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../infrastructure/logging/logger.js';
import { SmitheryRegistryIntegration, SmitheryConfig } from './smithery-registry-integration.js';

export interface SmitheryMCPConfig {
  apiKey: string;
  enabledServers?: string[]; // List of qualified server names to enable
  autoDiscovery?: boolean; // Whether to auto-discover popular servers
}

export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: unknown;
  serverName: string;
  originalName: string;
}

export interface RegisteredServer {
  qualifiedName: string;
  displayName: string;
  tools: RegisteredTool[];
}

export interface ToolCallArgs {
  [key: string]: unknown;
}

export interface ToolCallResponse {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export class SmitheryMCPServer {
  private server: Server;
  private config: SmitheryMCPConfig;
  private registryIntegration: SmitheryRegistryIntegration;
  private availableServers: Map<string, RegisteredServer> = new Map();
  private availableTools: Map<string, RegisteredTool> = new Map();
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(config: SmitheryMCPConfig) {
    this.config = config;

    this.server = new Server(
      { name: 'smithery-registry', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    // Initialize Smithery registry integration
    const smitheryConfig: SmitheryConfig = {
      apiKey: config.apiKey,
    };
    this.registryIntegration = new SmitheryRegistryIntegration(smitheryConfig);

    // Don't call async initialization in constructor
    // It will be called when getServer() is called
  }

  private async initializeServer(): Promise<void> {
    try {
      // Discover available MCP servers from registry
      await this.discoverServers();

      // Register tool handlers
      this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
        const { name, arguments: args } = request.params;
        const result = await this.handleToolCall(name, args || {});
        return {
          content: result.content,
          isError: result.isError,
        };
      });

      // Register available tools dynamically from discovered servers
      this.server.setRequestHandler(ListToolsRequestSchema, async () => {
        const tools = Array.from(this.availableTools.values());
        logger.info(`Providing ${tools.length} tools from Smithery registry`);
        return { tools };
      });

      logger.info('Smithery MCP server initialized successfully');
    } catch (error) {
      logger.error('Error initializing Smithery MCP server:', error);
      throw error;
    }
  }

  private async discoverServers(): Promise<void> {
    try {
      let servers: RegisteredServer[] = [];

      if (this.config.enabledServers && this.config.enabledServers.length > 0) {
        // Load specific servers
        for (const serverName of this.config.enabledServers) {
          const smitheryServer = await this.registryIntegration.getServerDetails(serverName);
          if (smitheryServer) {
            const registeredServer: RegisteredServer = {
              qualifiedName: smitheryServer.qualifiedName,
              displayName: smitheryServer.displayName,
              tools: smitheryServer.tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
                serverName: smitheryServer.qualifiedName,
                originalName: tool.name,
              })),
            };
            servers.push(registeredServer);
          }
        }
      } else if (this.config.autoDiscovery !== false) {
        // Auto-discover popular servers
        const smitheryServers = await this.registryIntegration.getPopularServers(10);
        servers = smitheryServers.map(smitheryServer => ({
          qualifiedName: smitheryServer.qualifiedName,
          displayName: smitheryServer.displayName,
          tools: smitheryServer.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            serverName: smitheryServer.qualifiedName,
            originalName: tool.name,
          })),
        }));
      }

      // Register tools from discovered servers
      for (const server of servers) {
        this.availableServers.set(server.qualifiedName, server);

        for (const tool of server.tools) {
          const toolName = `${server.qualifiedName.replace('/', '_')}_${tool.name}`;
          const toolDef: RegisteredTool = {
            name: toolName,
            description: `${tool.description} (from ${server.displayName})`,
            inputSchema: tool.inputSchema,
            serverName: server.qualifiedName,
            originalName: tool.name,
          };
          this.availableTools.set(toolName, toolDef);
        }
      }

      logger.info(`Discovered ${servers.length} servers with ${this.availableTools.size} tools`);
    } catch (error) {
      logger.error('Error discovering Smithery servers:', error);
      // Continue with empty tools if discovery fails
    }
  }

  private async handleToolCall(name: string, args: ToolCallArgs): Promise<ToolCallResponse> {
    try {
      const tool = this.availableTools.get(name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      // This is a placeholder - in a full implementation, we would
      // need to establish connections to the actual MCP servers
      // and proxy the tool calls through them
      return {
        content: [
          {
            type: 'text',
            text: `Tool ${name} would be executed with args: ${JSON.stringify(args)}\n\nNote: This is a registry integration preview. Full tool execution requires establishing connections to individual MCP servers.`,
          },
        ],
      };
    } catch (error: unknown) {
      logger.error(`Tool execution error for ${name}:`, error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: `Tool execution error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async getServer(): Promise<Server> {
    await this.ensureInitialized();
    return this.server;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeServer();
    await this.initializationPromise;
    this.initialized = true;
  }

  async getRegistryHealth(): Promise<Record<string, unknown>> {
    await this.ensureInitialized();
    return (await this.registryIntegration.healthCheck()) as Record<string, unknown>;
  }

  getAvailableServers(): RegisteredServer[] {
    return Array.from(this.availableServers.values());
  }

  getAvailableTools(): RegisteredTool[] {
    return Array.from(this.availableTools.values());
  }

  async refreshServers(): Promise<void> {
    await this.ensureInitialized();
    this.availableServers.clear();
    this.availableTools.clear();
    await this.discoverServers();
  }

  async initialize(): Promise<void> {
    await this.ensureInitialized();
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
    this.initializationPromise = null;
    this.availableServers.clear();
    this.availableTools.clear();
  }
}
