import { 
  MCPServerProfile, 
  ServerDiscoveryQuery, 
  ServerProfileStatus,
  CapabilityType,
  CostTier 
} from './discovery-types.js';

/**
 * Handles MCP server discovery and scanning strategies.
 */
export class ServerScanner {
  private readonly discoveryStrategies = new Map<string, () => Promise<MCPServerProfile[]>>();
  private readonly knownServers = new Map<string, MCPServerProfile>();

  constructor() {
    this.initializeDiscoveryStrategies();
    this.registerKnownServers();
  }

  /**
   * Scan for MCP servers based on discovery query
   */
  async scanServers(query: ServerDiscoveryQuery): Promise<MCPServerProfile[]> {
    const results: MCPServerProfile[] = [];

    // Strategy 1: Registry-based discovery (known servers)
    const registryResults = await this.scanRegistryServers(query);
    results.push(...registryResults);

    // Strategy 2: Network-based discovery (if applicable)
    if (!query.requireLocalExecution) {
      const networkResults = await this.scanNetworkServers(query);
      results.push(...networkResults);
    }

    // Strategy 3: Local discovery (filesystem, environment)
    const localResults = await this.scanLocalServers(query);
    results.push(...localResults);

    // Strategy 4: Community/marketplace discovery
    const marketplaceResults = await this.scanMarketplaceServers(query);
    results.push(...marketplaceResults);

    // Filter and sort results based on query criteria
    return this.filterAndRankResults(results, query);
  }

  /**
   * Initialize discovery strategies
   */
  private initializeDiscoveryStrategies(): void {
    this.discoveryStrategies.set('registry', this.registryDiscovery.bind(this));
    this.discoveryStrategies.set('network', this.networkDiscovery.bind(this));
    this.discoveryStrategies.set('local', this.localDiscovery.bind(this));
    this.discoveryStrategies.set('marketplace', this.marketplaceDiscovery.bind(this));
  }

  /**
   * Register known MCP servers
   */
  private registerKnownServers(): void {
    // Core filesystem server
    this.knownServers.set('filesystem', {
      id: 'filesystem',
      name: 'Filesystem Server',
      description: 'Core filesystem operations and file management',
      version: '1.0.0',
      capabilities: [
        { type: CapabilityType.RESOURCE, name: 'file-read', description: 'Read file contents' },
        { type: CapabilityType.RESOURCE, name: 'file-write', description: 'Write file contents' },
        { type: CapabilityType.TOOL, name: 'file-list', description: 'List directory contents' }
      ],
      performance: this.createDefaultPerformanceMetrics(),
      reliability: this.createDefaultReliabilityMetrics(),
      compatibility: {
        protocolVersions: ['1.0'],
        requiredFeatures: [],
        optionalFeatures: ['streaming'],
        platformSupport: ['windows', 'macos', 'linux'],
        dependencies: []
      },
      cost: { tier: CostTier.FREE, currency: 'USD' },
      lastSeen: new Date(),
      status: ServerProfileStatus.ACTIVE
    });

    // Git operations server
    this.knownServers.set('git', {
      id: 'git',
      name: 'Git Operations Server',
      description: 'Git version control operations',
      version: '1.0.0',
      capabilities: [
        { type: CapabilityType.TOOL, name: 'git-status', description: 'Get git repository status' },
        { type: CapabilityType.TOOL, name: 'git-commit', description: 'Create git commits' },
        { type: CapabilityType.TOOL, name: 'git-branch', description: 'Branch management' }
      ],
      performance: this.createDefaultPerformanceMetrics(),
      reliability: this.createDefaultReliabilityMetrics(),
      compatibility: {
        protocolVersions: ['1.0'],
        requiredFeatures: ['git'],
        optionalFeatures: [],
        platformSupport: ['windows', 'macos', 'linux'],
        dependencies: ['git']
      },
      cost: { tier: CostTier.FREE, currency: 'USD' },
      lastSeen: new Date(),
      status: ServerProfileStatus.ACTIVE
    });

    // Terminal server
    this.knownServers.set('terminal', {
      id: 'terminal',
      name: 'Terminal Server',
      description: 'Terminal and command execution',
      version: '1.0.0',
      capabilities: [
        { type: CapabilityType.TOOL, name: 'execute-command', description: 'Execute shell commands' },
        { type: CapabilityType.TOOL, name: 'get-output', description: 'Get command output' }
      ],
      performance: this.createDefaultPerformanceMetrics(),
      reliability: this.createDefaultReliabilityMetrics(),
      compatibility: {
        protocolVersions: ['1.0'],
        requiredFeatures: [],
        optionalFeatures: ['streaming'],
        platformSupport: ['windows', 'macos', 'linux'],
        dependencies: []
      },
      cost: { tier: CostTier.FREE, currency: 'USD' },
      lastSeen: new Date(),
      status: ServerProfileStatus.ACTIVE
    });
  }

  /**
   * Scan registry-based servers
   */
  private async scanRegistryServers(query: ServerDiscoveryQuery): Promise<MCPServerProfile[]> {
    const results: MCPServerProfile[] = [];
    
    for (const server of this.knownServers.values()) {
      if (this.matchesQuery(server, query)) {
        results.push({ ...server });
      }
    }

    return results;
  }

  /**
   * Scan network-based servers
   */
  private async scanNetworkServers(query: ServerDiscoveryQuery): Promise<MCPServerProfile[]> {
    // In a real implementation, this would scan for MCP servers on the network
    // For now, return empty array as network discovery requires more infrastructure
    return [];
  }

  /**
   * Scan local servers (environment, filesystem)
   */
  private async scanLocalServers(query: ServerDiscoveryQuery): Promise<MCPServerProfile[]> {
    const results: MCPServerProfile[] = [];

    // Check for locally installed MCP servers
    // This could scan package.json, environment variables, etc.
    
    return results;
  }

  /**
   * Scan marketplace/community servers
   */
  private async scanMarketplaceServers(query: ServerDiscoveryQuery): Promise<MCPServerProfile[]> {
    // In a real implementation, this would query external registries
    // For now, return empty array
    return [];
  }

  /**
   * Check if server matches query criteria
   */
  private matchesQuery(server: MCPServerProfile, query: ServerDiscoveryQuery): boolean {
    // Check required capabilities
    const serverCapabilities = server.capabilities.map(c => c.type);
    const hasRequiredCapabilities = query.requiredCapabilities.every(
      required => serverCapabilities.includes(required)
    );

    if (!hasRequiredCapabilities) {
      return false;
    }

    // Check performance requirements
    if (query.maxLatency && server.performance.averageLatency > query.maxLatency) {
      return false;
    }

    if (query.minReliability && server.reliability.availabilityScore < query.minReliability) {
      return false;
    }

    // Check vendor preferences
    if (query.preferredVendors && query.preferredVendors.length > 0) {
      if (!server.vendor || !query.preferredVendors.includes(server.vendor)) {
        return false;
      }
    }

    if (query.excludeVendors && server.vendor && query.excludeVendors.includes(server.vendor)) {
      return false;
    }

    return true;
  }

  /**
   * Filter and rank results based on query preferences
   */
  private filterAndRankResults(
    results: MCPServerProfile[], 
    query: ServerDiscoveryQuery
  ): MCPServerProfile[] {
    // Remove duplicates
    const uniqueResults = Array.from(
      new Map(results.map(server => [server.id, server])).values()
    );

    // Sort by relevance score
    return uniqueResults.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a, query);
      const scoreB = this.calculateRelevanceScore(b, query);
      return scoreB - scoreA;
    });
  }

  /**
   * Calculate relevance score for ranking
   */
  private calculateRelevanceScore(server: MCPServerProfile, query: ServerDiscoveryQuery): number {
    let score = 0;

    // Base score for having required capabilities
    score += query.requiredCapabilities.length * 10;

    // Bonus for optional capabilities
    if (query.optionalCapabilities) {
      const optionalMatches = query.optionalCapabilities.filter(
        optional => server.capabilities.some(cap => cap.type === optional)
      ).length;
      score += optionalMatches * 5;
    }

    // Performance scoring
    if (query.maxLatency) {
      const latencyScore = Math.max(0, 100 - (server.performance.averageLatency / query.maxLatency) * 100);
      score += latencyScore;
    }

    // Reliability scoring
    score += server.reliability.availabilityScore * 50;

    // Preferred vendor bonus
    if (query.preferredVendors && server.vendor && query.preferredVendors.includes(server.vendor)) {
      score += 25;
    }

    return score;
  }

  /**
   * Discovery strategy implementations
   */
  private async registryDiscovery(): Promise<MCPServerProfile[]> {
    return Array.from(this.knownServers.values());
  }

  private async networkDiscovery(): Promise<MCPServerProfile[]> {
    // Network discovery implementation would go here
    return [];
  }

  private async localDiscovery(): Promise<MCPServerProfile[]> {
    // Local discovery implementation would go here
    return [];
  }

  private async marketplaceDiscovery(): Promise<MCPServerProfile[]> {
    // Marketplace discovery implementation would go here
    return [];
  }

  /**
   * Helper methods for creating default metrics
   */
  private createDefaultPerformanceMetrics() {
    return {
      averageLatency: 50,
      throughput: 1000,
      concurrentConnectionLimit: 100,
      memoryUsage: 0,
      cpuUsage: 0,
      errorRate: 0.01,
      uptime: 0.99
    };
  }

  private createDefaultReliabilityMetrics() {
    return {
      availabilityScore: 0.99,
      mttr: 300,
      mtbf: 86400,
      errorCount: 0,
      successRate: 0.99,
      consecutiveFailures: 0
    };
  }
}
