/**
 * Advanced MCP Server Discovery and Registration System
 * 
 * Provides intelligent discovery, registration, and management of MCP servers including:
 * - Automated server discovery from multiple registries
 * - Capability-based server matching and routing
 * - Dynamic server registration and health monitoring
 * - Smart server recommendation system
 * - Server compatibility analysis
 * - Automatic server updates and migrations
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { SmitheryRegistryIntegration, SmitheryServer } from '../../mcp-servers/smithery-registry-integration.js';

export interface MCPServerCapability {
  category: string;
  name: string;
  description: string;
  inputSchema: any;
  outputSchema?: any;
  complexity: 'low' | 'medium' | 'high';
  reliability: number; // 0-100
  performance: number; // 0-100
  cost?: 'free' | 'low' | 'medium' | 'high';
  authentication?: 'none' | 'api-key' | 'oauth' | 'custom';
}

export interface DiscoveredMCPServer {
  id: string;
  qualifiedName: string;
  displayName: string;
  description: string;
  version: string;
  author: string;
  homepage?: string;
  repository?: string;
  license?: string;
  tags: string[];
  categories: string[];
  
  // Discovery metadata
  discoveredAt: Date;
  discoverySource: string;
  
  // Connection information
  endpoint?: string;
  connectionType: 'http' | 'websocket' | 'subprocess' | 'stdio';
  authenticationMethods: string[];
  
  // Capabilities and features
  capabilities: MCPServerCapability[];
  supportedProtocols: string[];
  maxConcurrentRequests?: number;
  rateLimits?: {
    requestsPerMinute?: number;
    requestsPerHour?: number;
    requestsPerDay?: number;
  };
  
  // Quality metrics
  reliability: number; // 0-100
  performance: number; // 0-100
  popularity: number; // 0-100 based on usage stats
  communityRating?: number; // 0-5
  lastUpdated: Date;
  
  // Compatibility
  minimumProtocolVersion?: string;
  dependencies?: string[];
  conflicts?: string[];
  
  // Usage statistics
  totalDownloads?: number;
  recentDownloads?: number;
  activeInstallations?: number;
  
  // Health status
  status: 'active' | 'deprecated' | 'experimental' | 'maintenance';
  healthScore: number; // 0-100
  lastHealthCheck?: Date;
}

export interface ServerDiscoveryQuery {
  category?: string;
  tags?: string[];
  capabilities?: string[];
  minReliability?: number;
  minPerformance?: number;
  maxCost?: 'free' | 'low' | 'medium' | 'high';
  authenticationTypes?: string[];
  excludeExperimental?: boolean;
  minPopularity?: number;
  requiredProtocolVersion?: string;
}

export interface ServerRecommendation {
  server: DiscoveredMCPServer;
  matchScore: number; // 0-100
  reasons: string[];
  alternatives: DiscoveredMCPServer[];
  migrationPath?: {
    from: string;
    to: string;
    steps: string[];
    estimatedEffort: 'low' | 'medium' | 'high';
  };
}

export class AdvancedMCPDiscoverySystem extends EventEmitter {
  private discoveredServers: Map<string, DiscoveredMCPServer> = new Map();
  private registryClients: Map<string, any> = new Map();
  private capabilityIndex: Map<string, Set<string>> = new Map();
  private categoryIndex: Map<string, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  
  // Discovery configuration
  private readonly DISCOVERY_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
  private readonly HEALTH_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
  private readonly SERVER_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  
  constructor(smitheryConfig?: { apiKey: string }) {
    super();
    
    // Initialize registry clients
    if (smitheryConfig?.apiKey) {
      this.registerDiscoverySource('smithery', new SmitheryRegistryIntegration(smitheryConfig));
    }
    
    // Start automated discovery
    this.startAutomatedDiscovery();
    this.startHealthMonitoring();
  }

  /**
   * Register additional discovery sources
   */
  registerDiscoverySource(name: string, client: any): void {
    this.registryClients.set(name, client);
    logger.info(`Registered MCP discovery source: ${name}`);
    this.emit('discovery-source-registered', name);
  }

  /**
   * Discover servers from all registered sources
   */
  async discoverServers(forceRefresh: boolean = false): Promise<DiscoveredMCPServer[]> {
    logger.info('Starting comprehensive MCP server discovery...');
    
    const discoveryPromises: Promise<DiscoveredMCPServer[]>[] = [];
    
    // Discover from Smithery
    if (this.registryClients.has('smithery')) {
      discoveryPromises.push(this.discoverFromSmithery());
    }
    
    // Add other discovery sources here
    // discoveryPromises.push(this.discoverFromGitHub());
    // discoveryPromises.push(this.discoverFromNPM());
    
    try {
      const allDiscoveries = await Promise.allSettled(discoveryPromises);
      const allServers: DiscoveredMCPServer[] = [];
      
      allDiscoveries.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allServers.push(...result.value);
        } else {
          logger.warn(`Discovery source ${index} failed:`, result.reason);
        }
      });
      
      // Process and index discovered servers
      await this.processDiscoveredServers(allServers);
      
      logger.info(`Discovered ${allServers.length} MCP servers from ${this.registryClients.size} sources`);
      this.emit('discovery-completed', allServers.length);
      
      return Array.from(this.discoveredServers.values());
    } catch (error) {
      logger.error('Server discovery failed:', error);
      throw error;
    }
  }

  /**
   * Discover servers from Smithery registry
   */
  private async discoverFromSmithery(): Promise<DiscoveredMCPServer[]> {
    const smithery = this.registryClients.get('smithery') as SmitheryRegistryIntegration;
    if (!smithery) return [];

    try {
      // Get popular servers
      const popularServers = await smithery.getPopularServers(50);
      
      // Get servers by categories
      const categories = ['productivity', 'development', 'ai', 'data', 'communication'];
      const categoryPromises = categories.map(category => 
        smithery.getServersByTag(category, 20).catch(() => [])
      );
      
      const categoryResults = await Promise.allSettled(categoryPromises);
      const categoryServers: SmitheryServer[] = [];
      
      categoryResults.forEach(result => {
        if (result.status === 'fulfilled') {
          categoryServers.push(...result.value);
        }
      });
      
      // Combine and deduplicate
      const allServers = [...popularServers, ...categoryServers];
      const uniqueServers = new Map<string, SmitheryServer>();
      
      allServers.forEach(server => {
        uniqueServers.set(server.qualifiedName, server);
      });
      
      // Convert to our format
      const discoveredServers: DiscoveredMCPServer[] = [];
      
      for (const server of uniqueServers.values()) {
        try {
          // Get detailed information
          const detailed = await smithery.getServerDetails(server.qualifiedName);
          if (detailed) {
            discoveredServers.push(await this.convertSmitheryServer(detailed));
          }
        } catch (error) {
          logger.debug(`Failed to get details for ${server.qualifiedName}:`, error);
        }
      }
      
      return discoveredServers;
    } catch (error) {
      logger.error('Smithery discovery failed:', error);
      return [];
    }
  }

  /**
   * Convert Smithery server to our format
   */
  private async convertSmitheryServer(server: SmitheryServer): Promise<DiscoveredMCPServer> {
    const capabilities: MCPServerCapability[] = server.tools.map(tool => ({
      category: this.inferCategory(tool.name, tool.description),
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      complexity: this.inferComplexity(tool.inputSchema),
      reliability: this.calculateReliability(server),
      performance: this.estimatePerformance(server),
      cost: 'free', // Most Smithery servers are free
      authentication: 'api-key', // Smithery uses API keys
    }));

    return {
      id: server.qualifiedName,
      qualifiedName: server.qualifiedName,
      displayName: server.displayName,
      description: server.description,
      version: '1.0.0', // Default version
      author: this.extractAuthor(server.qualifiedName),
      homepage: server.homepage,
      tags: this.inferTags(server),
      categories: this.inferCategories(server),
      
      discoveredAt: new Date(),
      discoverySource: 'smithery',
      
      endpoint: `https://server.smithery.ai/${server.qualifiedName}/mcp`,
      connectionType: 'http',
      authenticationMethods: ['api-key'],
      
      capabilities,
      supportedProtocols: ['mcp/1.0'],
      
      reliability: this.calculateReliability(server),
      performance: this.estimatePerformance(server),
      popularity: Math.min(100, Math.log10(server.useCount + 1) * 25),
      lastUpdated: new Date(),
      
      status: 'active',
      healthScore: 85, // Default health score
    };
  }

  private inferCategory(toolName: string, description: string): string {
    const text = `${toolName} ${description}`.toLowerCase();
    
    if (text.includes('file') || text.includes('filesystem') || text.includes('directory')) {
      return 'filesystem';
    } else if (text.includes('git') || text.includes('version') || text.includes('repository')) {
      return 'development';
    } else if (text.includes('web') || text.includes('http') || text.includes('api')) {
      return 'web';
    } else if (text.includes('terminal') || text.includes('shell') || text.includes('command')) {
      return 'system';
    } else if (text.includes('search') || text.includes('query') || text.includes('find')) {
      return 'search';
    } else if (text.includes('ai') || text.includes('llm') || text.includes('model')) {
      return 'ai';
    } else if (text.includes('data') || text.includes('database') || text.includes('sql')) {
      return 'data';
    } else if (text.includes('document') || text.includes('text') || text.includes('word')) {
      return 'document';
    }
    
    return 'utility';
  }

  private inferComplexity(inputSchema: any): 'low' | 'medium' | 'high' {
    if (!inputSchema || !inputSchema.properties) return 'low';
    
    const propertyCount = Object.keys(inputSchema.properties).length;
    const hasNestedObjects = Object.values(inputSchema.properties).some(
      (prop: any) => prop.type === 'object' || prop.type === 'array'
    );
    
    if (propertyCount > 5 || hasNestedObjects) return 'high';
    if (propertyCount > 2) return 'medium';
    return 'low';
  }

  private calculateReliability(server: SmitheryServer): number {
    // Base reliability on usage count and server maturity
    const usageScore = Math.min(50, Math.log10(server.useCount + 1) * 10);
    const toolCount = server.tools.length;
    const toolScore = Math.min(30, toolCount * 5);
    const baseScore = 20; // Base reliability
    
    return Math.min(100, usageScore + toolScore + baseScore);
  }

  private estimatePerformance(server: SmitheryServer): number {
    // Estimate based on tool complexity and count
    const toolCount = server.tools.length;
    const complexityPenalty = server.tools.filter(tool => 
      this.inferComplexity(tool.inputSchema) === 'high'
    ).length * 5;
    
    const basePerformance = 80;
    const toolPenalty = Math.max(0, (toolCount - 5) * 2);
    
    return Math.max(30, basePerformance - toolPenalty - complexityPenalty);
  }

  private extractAuthor(qualifiedName: string): string {
    const parts = qualifiedName.split('/');
    return parts[0].replace('@', '');
  }

  private inferTags(server: SmitheryServer): string[] {
    const tags = new Set<string>();
    
    server.tools.forEach(tool => {
      const category = this.inferCategory(tool.name, tool.description);
      tags.add(category);
      
      // Add specific tags based on tool names
      if (tool.name.includes('search')) tags.add('search');
      if (tool.name.includes('file')) tags.add('file-management');
      if (tool.name.includes('git')) tags.add('version-control');
      if (tool.name.includes('terminal')) tags.add('command-line');
      if (tool.name.includes('web')) tags.add('web-services');
    });
    
    return Array.from(tags);
  }

  private inferCategories(server: SmitheryServer): string[] {
    const categories = new Set(server.tools.map(tool => 
      this.inferCategory(tool.name, tool.description)
    ));
    return Array.from(categories);
  }

  /**
   * Process and index discovered servers
   */
  private async processDiscoveredServers(servers: DiscoveredMCPServer[]): Promise<void> {
    for (const server of servers) {
      // Store server
      this.discoveredServers.set(server.id, server);
      
      // Index capabilities
      server.capabilities.forEach(capability => {
        if (!this.capabilityIndex.has(capability.name)) {
          this.capabilityIndex.set(capability.name, new Set());
        }
        this.capabilityIndex.get(capability.name)!.add(server.id);
      });
      
      // Index categories
      server.categories.forEach(category => {
        if (!this.categoryIndex.has(category)) {
          this.categoryIndex.set(category, new Set());
        }
        this.categoryIndex.get(category)!.add(server.id);
      });
      
      // Index tags
      server.tags.forEach(tag => {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(server.id);
      });
    }
  }

  /**
   * Search servers based on query
   */
  searchServers(query: ServerDiscoveryQuery): DiscoveredMCPServer[] {
    let candidateIds = new Set<string>(this.discoveredServers.keys());
    
    // Filter by category
    if (query.category) {
      const categoryIds = this.categoryIndex.get(query.category) || new Set();
      candidateIds = this.intersectSets(candidateIds, categoryIds);
    }
    
    // Filter by capabilities
    if (query.capabilities && query.capabilities.length > 0) {
      query.capabilities.forEach(capability => {
        const capabilityIds = this.capabilityIndex.get(capability) || new Set();
        candidateIds = this.intersectSets(candidateIds, capabilityIds);
      });
    }
    
    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      query.tags.forEach(tag => {
        const tagIds = this.tagIndex.get(tag) || new Set();
        candidateIds = this.intersectSets(candidateIds, tagIds);
      });
    }
    
    // Convert to servers and apply additional filters
    const candidates = Array.from(candidateIds)
      .map(id => this.discoveredServers.get(id)!)
      .filter(server => {
        // Filter by reliability
        if (query.minReliability && server.reliability < query.minReliability) {
          return false;
        }
        
        // Filter by performance
        if (query.minPerformance && server.performance < query.minPerformance) {
          return false;
        }
        
        // Filter by popularity
        if (query.minPopularity && server.popularity < query.minPopularity) {
          return false;
        }
        
        // Filter experimental servers
        if (query.excludeExperimental && server.status === 'experimental') {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        // Sort by combined score
        const scoreA = (a.reliability + a.performance + a.popularity) / 3;
        const scoreB = (b.reliability + b.performance + b.popularity) / 3;
        return scoreB - scoreA;
      });
    
    return candidates;
  }

  private intersectSets<T>(set1: Set<T>, set2: Set<T>): Set<T> {
    return new Set([...set1].filter(x => set2.has(x)));
  }

  /**
   * Get server recommendations based on requirements
   */
  getServerRecommendations(requirements: ServerDiscoveryQuery, limit: number = 5): ServerRecommendation[] {
    const candidates = this.searchServers(requirements);
    
    return candidates.slice(0, limit).map(server => {
      const matchScore = this.calculateMatchScore(server, requirements);
      const reasons = this.generateRecommendationReasons(server, requirements);
      const alternatives = this.findAlternatives(server, 3);
      
      return {
        server,
        matchScore,
        reasons,
        alternatives,
      };
    });
  }

  private calculateMatchScore(server: DiscoveredMCPServer, requirements: ServerDiscoveryQuery): number {
    let score = 0;
    let maxScore = 0;
    
    // Category match
    if (requirements.category) {
      maxScore += 20;
      if (server.categories.includes(requirements.category)) {
        score += 20;
      }
    }
    
    // Capability matches
    if (requirements.capabilities) {
      maxScore += 30;
      const serverCapabilities = server.capabilities.map(c => c.name);
      const matchedCapabilities = requirements.capabilities.filter(cap => 
        serverCapabilities.includes(cap)
      );
      score += (matchedCapabilities.length / requirements.capabilities.length) * 30;
    }
    
    // Tag matches
    if (requirements.tags) {
      maxScore += 20;
      const matchedTags = requirements.tags.filter(tag => server.tags.includes(tag));
      score += (matchedTags.length / requirements.tags.length) * 20;
    }
    
    // Quality metrics
    maxScore += 30;
    score += (server.reliability / 100) * 10;
    score += (server.performance / 100) * 10;
    score += (server.popularity / 100) * 10;
    
    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }

  private generateRecommendationReasons(server: DiscoveredMCPServer, requirements: ServerDiscoveryQuery): string[] {
    const reasons: string[] = [];
    
    if (server.reliability > 80) {
      reasons.push(`High reliability score (${server.reliability}%)`);
    }
    
    if (server.performance > 80) {
      reasons.push(`Excellent performance rating (${server.performance}%)`);
    }
    
    if (server.popularity > 60) {
      reasons.push(`Popular choice in the community (${server.popularity}% popularity)`);
    }
    
    if (server.capabilities.length > 5) {
      reasons.push(`Rich feature set with ${server.capabilities.length} capabilities`);
    }
    
    if (requirements.capabilities) {
      const matchedCapabilities = requirements.capabilities.filter(cap =>
        server.capabilities.some(serverCap => serverCap.name === cap)
      );
      if (matchedCapabilities.length > 0) {
        reasons.push(`Provides ${matchedCapabilities.length} of your required capabilities`);
      }
    }
    
    return reasons;
  }

  private findAlternatives(server: DiscoveredMCPServer, limit: number): DiscoveredMCPServer[] {
    const alternatives: DiscoveredMCPServer[] = [];
    
    // Find servers with similar capabilities
    const serverCapabilities = server.capabilities.map(c => c.name);
    
    for (const [id, candidate] of this.discoveredServers) {
      if (id === server.id) continue;
      
      const candidateCapabilities = candidate.capabilities.map(c => c.name);
      const overlap = serverCapabilities.filter(cap => candidateCapabilities.includes(cap));
      
      if (overlap.length > 0) {
        alternatives.push(candidate);
      }
      
      if (alternatives.length >= limit) break;
    }
    
    return alternatives.sort((a, b) => {
      const scoreA = (a.reliability + a.performance + a.popularity) / 3;
      const scoreB = (b.reliability + b.performance + b.popularity) / 3;
      return scoreB - scoreA;
    });
  }

  /**
   * Start automated discovery
   */
  private startAutomatedDiscovery(): void {
    // Initial discovery
    this.discoverServers().catch(error => {
      logger.error('Initial server discovery failed:', error);
    });
    
    // Periodic discovery
    setInterval(async () => {
      try {
        await this.discoverServers();
      } catch (error) {
        logger.error('Periodic server discovery failed:', error);
      }
    }, this.DISCOVERY_INTERVAL);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      await this.performHealthChecks();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private async performHealthChecks(): Promise<void> {
    logger.debug('Performing health checks on discovered servers...');
    
    const healthPromises = Array.from(this.discoveredServers.values()).map(async server => {
      try {
        // Simple health check - this would be more sophisticated in a real implementation
        const healthScore = await this.checkServerHealth(server);
        server.healthScore = healthScore;
        server.lastHealthCheck = new Date();
        
        this.emit('server-health-updated', server.id, healthScore);
      } catch (error) {
        logger.debug(`Health check failed for server ${server.displayName}:`, error);
        server.healthScore = Math.max(0, server.healthScore - 10);
      }
    });
    
    await Promise.allSettled(healthPromises);
  }

  private async checkServerHealth(server: DiscoveredMCPServer): Promise<number> {
    // This is a placeholder - real implementation would check server availability
    // For now, we'll simulate health based on age and status
    
    const daysSinceUpdate = (Date.now() - server.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    
    let health = 100;
    
    // Penalize old servers
    if (daysSinceUpdate > 90) {
      health -= 20;
    } else if (daysSinceUpdate > 30) {
      health -= 10;
    }
    
    // Bonus for active servers
    if (server.status === 'active') {
      health += 0;
    } else if (server.status === 'experimental') {
      health -= 15;
    } else if (server.status === 'deprecated') {
      health -= 30;
    }
    
    return Math.max(0, Math.min(100, health));
  }

  /**
   * Get discovery statistics
   */
  getDiscoveryStats() {
    const servers = Array.from(this.discoveredServers.values());
    
    return {
      totalServers: servers.length,
      bySource: this.groupBy(servers, s => s.discoverySource),
      byStatus: this.groupBy(servers, s => s.status),
      byCategory: this.groupBy(servers.flatMap(s => s.categories.map(cat => ({category: cat}))), item => item.category),
      totalCapabilities: this.capabilityIndex.size,
      avgReliability: servers.reduce((sum, s) => sum + s.reliability, 0) / servers.length,
      avgPerformance: servers.reduce((sum, s) => sum + s.performance, 0) / servers.length,
      avgHealthScore: servers.reduce((sum, s) => sum + s.healthScore, 0) / servers.length,
    };
  }

  private groupBy<T, K extends string | number>(array: T[], keyFn: (item: T) => K): Record<K, number> {
    const result = {} as Record<K, number>;
    array.forEach(item => {
      const key = keyFn(item);
      result[key] = (result[key] || 0) + 1;
    });
    return result;
  }

  /**
   * Get all discovered servers
   */
  getAllServers(): DiscoveredMCPServer[] {
    return Array.from(this.discoveredServers.values());
  }

  /**
   * Get server by ID
   */
  getServer(id: string): DiscoveredMCPServer | null {
    return this.discoveredServers.get(id) || null;
  }

  /**
   * Get servers by capability
   */
  getServersByCapability(capability: string): DiscoveredMCPServer[] {
    const serverIds = this.capabilityIndex.get(capability) || new Set();
    return Array.from(serverIds).map(id => this.discoveredServers.get(id)!);
  }

  /**
   * Get servers by category
   */
  getServersByCategory(category: string): DiscoveredMCPServer[] {
    const serverIds = this.categoryIndex.get(category) || new Set();
    return Array.from(serverIds).map(id => this.discoveredServers.get(id)!);
  }
}

// Global instance
export const advancedMCPDiscoverySystem = new AdvancedMCPDiscoverySystem();