import { ServerScanner } from './server-scanner.js';
import { CapabilityDetector } from './capability-detector.js';
import { RegistryManager } from './registry-manager.js';
import { HealthMonitor } from './health-monitor.js';
import { ConnectionManager } from './connection-manager.js';
import { LoadBalancer } from './load-balancer.js';
import { FailoverCoordinator } from './failover-coordinator.js';
import { MetricsCollector } from './metrics-collector.js';
import {
  MCPServerProfile,
  ServerDiscoveryQuery,
  ServerSelectionResult,
  RiskLevel,
} from './discovery-types.js';

/**
 * Orchestrates MCP server discovery by composing modular components.
 */
export class MCPDiscoveryService {
  constructor(
    private readonly scanner = new ServerScanner(),
    private readonly capabilityDetector = new CapabilityDetector(),
    private readonly registry = new RegistryManager(),
    private readonly healthMonitor = new HealthMonitor(),
    private readonly connections = new ConnectionManager(),
    private readonly loadBalancer = new LoadBalancer(),
    private readonly failover = new FailoverCoordinator(),
    private readonly metrics = new MetricsCollector()
  ) {}

  async discover(query: ServerDiscoveryQuery): Promise<MCPServerProfile[]> {
    const servers = await this.scanner.scanServers(query);
    servers.forEach(server => {
      this.capabilityDetector.detectCapabilities(server);
      this.registry.register(server);
    });
    return servers;
  }

  async select(query: ServerDiscoveryQuery): Promise<ServerSelectionResult> {
    const servers = this.registry.getAll();
    const selected = this.loadBalancer.selectServer(servers, query);
    return {
      primaryServers: selected ? [selected] : [],
      fallbackServers: servers.filter(s => s !== selected),
      selectionReason: selected
        ? `Selected server "${selected.name ?? selected.id ?? 'unknown'}" based on load balancing for query type "${query.type ?? 'unknown'}".`
        : `No suitable server found for query type "${query.type ?? 'unknown'}".`,
      estimatedPerformance: {
        expectedLatency: 0,
        expectedThroughput: 0,
        reliabilityScore: 0,
        scalabilityScore: 0,
      },
      riskAssessment: {
        overallRisk: RiskLevel.MINIMAL,
        risks: [],
        mitigations: [],
        recommendations: [],
      },
      alternatives: servers.filter(s => s !== selected),
    };
  }

  // Aliases for adapter compatibility
  async discoverServers(query: ServerDiscoveryQuery): Promise<MCPServerProfile[]> {
    return this.discover(query);
  }

  async selectServers(
    servers: MCPServerProfile[],
    query: ServerDiscoveryQuery
  ): Promise<ServerSelectionResult> {
    return this.select(query);
  }
}
