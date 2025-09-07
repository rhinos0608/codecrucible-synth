import { MCPServerProfile } from './discovery-types.js';

/**
 * Maintains registry of discovered MCP servers.
 */
export class RegistryManager {
  private readonly registry = new Map<string, MCPServerProfile>();

  register(server: MCPServerProfile): void {
    this.registry.set(server.id, server);
  }

  get(id: string): MCPServerProfile | undefined {
    return this.registry.get(id);
  }

  getAll(): MCPServerProfile[] {
    return Array.from(this.registry.values());
  }
}
