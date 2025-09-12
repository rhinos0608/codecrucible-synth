import { MCPServerProfile, ServerProfileStatus } from './discovery-types.js';

/**
 * Performs periodic health checks on MCP servers.
 */
export class HealthMonitor {
  async checkHealth(server: MCPServerProfile): Promise<void> {
    const start = Date.now();

    try {
      const response = await fetch(server.id);
      const latency = Date.now() - start;

      server.lastSeen = new Date();
      server.performance.averageLatency = latency;

      if (!response.ok) {
        server.reliability.errorCount++;
        server.reliability.consecutiveFailures++;
        server.reliability.lastFailure = new Date();
        server.status = ServerProfileStatus.INACTIVE;
      } else {
        server.reliability.consecutiveFailures = 0;
        server.status = ServerProfileStatus.ACTIVE;
      }
    } catch {
      server.reliability.errorCount++;
      server.reliability.consecutiveFailures++;
      server.reliability.lastFailure = new Date();
      server.status = ServerProfileStatus.INACTIVE;
    }
  }
}
