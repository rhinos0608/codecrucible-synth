import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../core/logger.js';
import axios from 'axios';

export interface SmitheryMCPConfig {
  apiKey?: string;
  profile?: string;
  baseUrl: string;
}

export class SmitheryMCPServer {
  private server: Server;
  private config: SmitheryMCPConfig;

  constructor(config: SmitheryMCPConfig) {
    this.config = config;

    this.server = new Server(
      { name: 'smithery-ai-exa', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    this.initializeServer();
  }

  private initializeServer(): void {
    // Register tool handlers
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'web_search_exa':
          return await this.handleWebSearchExa(args);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    // Register available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'web_search_exa',
          description: 'Search the web using Exa API through Smithery AI',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              numResults: {
                type: 'number',
                description: 'Number of results to return',
                default: 10,
              },
            },
            required: ['query'],
          },
        },
      ],
    }));

    logger.debug('Smithery MCP server initialized');
  }

  private async handleWebSearchExa(args: any): Promise<any> {
    // If no API key is configured, return an error
    if (!this.config.apiKey || !this.config.profile) {
      return {
        content: [
          {
            type: 'text',
            text: 'Smithery API key and profile are not configured. Please set them in your configuration.',
          },
        ],
        isError: true,
      };
    }

    try {
      const { query, numResults = 10 } = args;

      // Make request to Smithery AI Exa MCP API
      const response = await axios.get(`${this.config.baseUrl}/exa/mcp`, {
        params: {
          api_key: this.config.apiKey,
          profile: this.config.profile,
        },
        headers: {
          Accept: 'application/json',
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query,
              results: response.data,
              numResults,
            }),
          },
        ],
      };
    } catch (error: any) {
      logger.error('Smithery web search error:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Web search error: ${error.message || 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  getServer(): Server {
    return this.server;
  }
}
