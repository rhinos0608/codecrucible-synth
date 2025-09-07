import { MCPServerProfile, ServerDiscoveryQuery } from './discovery-types.js';

/**
 * Applies load balancing algorithms to select servers.
 */
export class LoadBalancer {
  selectServer(
    servers: MCPServerProfile[],
    _query: ServerDiscoveryQuery
  ): MCPServerProfile | undefined {
    // TODO: Implement load balancing strategy
    if (servers.length > 0) {
      return servers[0];
    }
    return undefined;
  }
}
