import { MCPServerProfile } from './discovery-types.js';

/**
 * Manages connection pooling for MCP servers.
 */
export class ConnectionManager {
  private readonly connections = new Map<string, number>();

  acquire(server: MCPServerProfile): void {
    const count = this.connections.get(server.id) ?? 0;
    this.connections.set(server.id, count + 1);
  }

  release(server: MCPServerProfile): void {
    const count = this.connections.get(server.id) ?? 0;
    if (count > 0) {
      this.connections.set(server.id, count - 1);
    }
  }
}
