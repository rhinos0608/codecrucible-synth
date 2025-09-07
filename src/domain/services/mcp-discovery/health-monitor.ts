import { MCPServerProfile } from './discovery-types.js';

/**
 * Performs periodic health checks on MCP servers.
 */
export class HealthMonitor {
  async checkHealth(_server: MCPServerProfile): Promise<void> {
    // TODO: Implement health check logic
  }
}
