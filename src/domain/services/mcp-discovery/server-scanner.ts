import { MCPServerProfile, ServerDiscoveryQuery } from './discovery-types.js';

/**
 * Handles MCP server discovery and scanning strategies.
 */
export class ServerScanner {
  async scanServers(query: ServerDiscoveryQuery): Promise<MCPServerProfile[]> {
    // TODO: Implement server discovery strategies
    return [];
  }
}
