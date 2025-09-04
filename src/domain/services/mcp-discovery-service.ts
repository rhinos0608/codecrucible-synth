/**
 * MCP Discovery Domain Service
 * Pure business logic for MCP server discovery, selection, and orchestration
 *
 * Architecture Compliance:
 * - Domain layer: pure business logic only
 * - No infrastructure dependencies
 * - Server discovery strategies and selection algorithms
 * - Capability matching and load balancing logic
 */

export interface MCPServerCapability {
  type: CapabilityType;
  name: string;
  description: string;
  version?: string;
  metadata?: Record<string, any>;
}

export interface MCPServerProfile {
  id: string;
  name: string;
  description: string;
  vendor?: string;
  version: string;
  capabilities: MCPServerCapability[];
  performance: ServerPerformanceMetrics;
  reliability: ServerReliabilityMetrics;
  compatibility: ServerCompatibilityInfo;
  cost?: ServerCostInfo;
  lastSeen: Date;
  status: ServerProfileStatus;
}

export interface ServerPerformanceMetrics {
  averageLatency: number;
  throughput: number;
  concurrentConnectionLimit: number;
  memoryUsage: number;
  cpuUsage: number;
  errorRate: number;
  uptime: number;
}

export interface ServerReliabilityMetrics {
  availabilityScore: number; // 0-1
  mttr: number; // Mean Time To Recovery (minutes)
  mtbf: number; // Mean Time Between Failures (hours)
  errorCount: number;
  successRate: number; // 0-1
  lastFailure?: Date;
  consecutiveFailures: number;
}

export interface ServerCompatibilityInfo {
  protocolVersions: string[];
  requiredFeatures: string[];
  optionalFeatures: string[];
  platformSupport: string[];
  dependencies: string[];
}

export interface ServerCostInfo {
  tier: CostTier;
  requestCost?: number;
  connectionCost?: number;
  dataTransferCost?: number;
  currency: string;
}

export enum CapabilityType {
  TOOL = 'tool',
  RESOURCE = 'resource',
  PROMPT = 'prompt',
  COMPLETION = 'completion',
  SEARCH = 'search',
  ANALYSIS = 'analysis',
  GENERATION = 'generation',
  TRANSFORMATION = 'transformation',
}

export enum ServerProfileStatus {
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  EXPERIMENTAL = 'experimental',
  MAINTENANCE = 'maintenance',
  INACTIVE = 'inactive',
}

export enum CostTier {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

export interface ServerDiscoveryQuery {
  requiredCapabilities: CapabilityType[];
  optionalCapabilities?: CapabilityType[];
  maxLatency?: number;
  minReliability?: number;
  maxCost?: number;
  preferredVendors?: string[];
  excludeVendors?: string[];
  requireLocalExecution?: boolean;
  maxConcurrentConnections?: number;
}

export interface ServerSelectionResult {
  primaryServers: MCPServerProfile[];
  fallbackServers: MCPServerProfile[];
  selectionReason: string;
  estimatedPerformance: EstimatedPerformance;
  riskAssessment: RiskAssessment;
  alternatives: MCPServerProfile[];
}

export interface EstimatedPerformance {
  expectedLatency: number;
  expectedThroughput: number;
  reliabilityScore: number;
  scalabilityScore: number;
}

export interface RiskAssessment {
  overallRisk: RiskLevel;
  risks: Risk[];
  mitigations: string[];
  recommendations: string[];
}

export interface Risk {
  type: RiskType;
  severity: RiskSeverity;
  description: string;
  probability: number; // 0-1
  impact: number; // 0-1
}

export enum RiskLevel {
  MINIMAL = 'minimal',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum RiskType {
  PERFORMANCE = 'performance',
  RELIABILITY = 'reliability',
  SECURITY = 'security',
  COMPATIBILITY = 'compatibility',
  COST = 'cost',
  VENDOR_LOCK_IN = 'vendor_lock_in',
}

export enum RiskSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ServerOrchestrationPlan {
  servers: ServerAllocation[];
  loadBalancingStrategy: LoadBalancingStrategy;
  failoverPlan: FailoverPlan;
  monitoringPlan: MonitoringPlan;
  estimatedCost: number;
  scalingPlan?: ScalingPlan;
}

export interface ServerAllocation {
  server: MCPServerProfile;
  role: ServerRole;
  weight: number;
  maxConnections: number;
  priority: number;
  healthCheckInterval: number;
}

export enum ServerRole {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  FALLBACK = 'fallback',
  LOAD_BALANCER = 'load_balancer',
  CACHE = 'cache',
  SPECIALIST = 'specialist',
}

export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  WEIGHTED_ROUND_ROBIN = 'weighted_round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  CAPABILITY_BASED = 'capability_based',
  PERFORMANCE_BASED = 'performance_based',
  COST_OPTIMIZED = 'cost_optimized',
}

export interface FailoverPlan {
  triggers: FailoverTrigger[];
  strategy: FailoverStrategy;
  fallbackServers: MCPServerProfile[];
  recoveryPlan: RecoveryPlan;
}

export interface FailoverTrigger {
  type: TriggerType;
  threshold: number;
  timeWindow: number;
  action: FailoverAction;
}

export enum TriggerType {
  LATENCY_THRESHOLD = 'latency_threshold',
  ERROR_RATE_THRESHOLD = 'error_rate_threshold',
  CONNECTION_FAILURE = 'connection_failure',
  CONSECUTIVE_FAILURES = 'consecutive_failures',
  HEALTH_CHECK_FAILURE = 'health_check_failure',
}

export enum FailoverAction {
  SWITCH_PRIMARY = 'switch_primary',
  ADD_FALLBACK = 'add_fallback',
  REDISTRIBUTE_LOAD = 'redistribute_load',
  SCALE_OUT = 'scale_out',
  ALERT_ONLY = 'alert_only',
}

export enum FailoverStrategy {
  IMMEDIATE = 'immediate',
  GRADUAL = 'gradual',
  CIRCUIT_BREAKER = 'circuit_breaker',
  RETRY_WITH_BACKOFF = 'retry_with_backoff',
}

export interface RecoveryPlan {
  healthCheckStrategy: HealthCheckStrategy;
  recoveryThresholds: RecoveryThreshold[];
  rollbackPlan: RollbackPlan;
}

export interface MonitoringPlan {
  metrics: MonitoringMetric[];
  alertThresholds: AlertThreshold[];
  reportingInterval: number;
  dashboardConfig: DashboardConfig;
}

export interface ScalingPlan {
  scaleUpTriggers: ScalingTrigger[];
  scaleDownTriggers: ScalingTrigger[];
  minInstances: number;
  maxInstances: number;
  scalingCooldown: number;
}

/**
 * MCP Discovery Domain Service
 * Handles server discovery, selection, and orchestration logic
 */
export class MCPDiscoveryService {
  private serverRegistry: Map<string, MCPServerProfile> = new Map();
  private discoveryStrategies: DiscoveryStrategy[] = [];

  constructor() {
    // Initialize default strategies
    this.initializeDefaultStrategies();
  }

  /**
   * Discover MCP servers based on query criteria
   */
  async discoverServers(query: ServerDiscoveryQuery): Promise<MCPServerProfile[]> {
    const discoveredServers: MCPServerProfile[] = [];

    // Apply discovery strategies
    for (const strategy of this.discoveryStrategies) {
      const servers = await this.applyDiscoveryStrategy(strategy, query);
      discoveredServers.push(...servers);
    }

    // Remove duplicates and filter by query criteria
    const uniqueServers = this.deduplicateServers(discoveredServers);
    const filteredServers = this.filterServersByQuery(uniqueServers, query);

    // Update server registry
    filteredServers.forEach(server => {
      this.serverRegistry.set(server.id, server);
    });

    return filteredServers;
  }

  /**
   * Select optimal servers for a given query
   */
  async selectServers(
    availableServers: MCPServerProfile[],
    query: ServerDiscoveryQuery
  ): Promise<ServerSelectionResult> {
    // Filter servers that meet requirements
    const eligibleServers = this.filterEligibleServers(availableServers, query);

    if (eligibleServers.length === 0) {
      throw new Error('No eligible servers found for the given criteria');
    }

    // Score and rank servers
    const scoredServers = eligibleServers.map(server => ({
      server,
      score: this.calculateServerScore(server, query),
    }));

    scoredServers.sort((a, b) => b.score - a.score);

    // Select primary and fallback servers
    const primaryServers = scoredServers
      .slice(0, Math.min(3, scoredServers.length))
      .map(s => s.server);

    const fallbackServers = scoredServers
      .slice(3, Math.min(6, scoredServers.length))
      .map(s => s.server);

    const alternatives = scoredServers.slice(6).map(s => s.server);

    // Generate selection reason
    const selectionReason = this.generateSelectionReason(
      primaryServers,
      query,
      scoredServers[0].score
    );

    // Calculate estimated performance
    const estimatedPerformance = this.calculateEstimatedPerformance(primaryServers);

    // Perform risk assessment
    const riskAssessment = this.assessRisks(primaryServers, query);

    return {
      primaryServers,
      fallbackServers,
      selectionReason,
      estimatedPerformance,
      riskAssessment,
      alternatives,
    };
  }

  /**
   * Create orchestration plan for selected servers
   */
  async createOrchestrationPlan(
    selectionResult: ServerSelectionResult,
    requirements: OrchestrationRequirements
  ): Promise<ServerOrchestrationPlan> {
    const servers = [...selectionResult.primaryServers, ...selectionResult.fallbackServers];

    // Create server allocations
    const serverAllocations = this.createServerAllocations(servers, requirements);

    // Determine load balancing strategy
    const loadBalancingStrategy = this.selectLoadBalancingStrategy(servers, requirements);

    // Create failover plan
    const failoverPlan = this.createFailoverPlan(selectionResult, requirements);

    // Create monitoring plan
    const monitoringPlan = this.createMonitoringPlan(servers, requirements);

    // Calculate estimated cost
    const estimatedCost = this.calculateEstimatedCost(servers, requirements);

    // Create scaling plan if needed
    const scalingPlan = requirements.enableAutoScaling
      ? this.createScalingPlan(servers, requirements)
      : undefined;

    return {
      servers: serverAllocations,
      loadBalancingStrategy,
      failoverPlan,
      monitoringPlan,
      estimatedCost,
      scalingPlan,
    };
  }

  /**
   * Update server performance metrics
   */
  updateServerMetrics(serverId: string, metrics: Partial<ServerPerformanceMetrics>): void {
    const server = this.serverRegistry.get(serverId);
    if (server) {
      server.performance = { ...server.performance, ...metrics };
      server.lastSeen = new Date();
    }
  }

  /**
   * Update server reliability metrics
   */
  updateServerReliability(serverId: string, reliability: Partial<ServerReliabilityMetrics>): void {
    const server = this.serverRegistry.get(serverId);
    if (server) {
      server.reliability = { ...server.reliability, ...reliability };
    }
  }

  /**
   * Get server recommendations for specific capability
   */
  getCapabilityRecommendations(capability: CapabilityType): MCPServerProfile[] {
    const servers = Array.from(this.serverRegistry.values())
      .filter(server => server.capabilities.some(cap => cap.type === capability))
      .filter(server => server.status === ServerProfileStatus.ACTIVE);

    return servers
      .sort((a, b) => {
        // Sort by reliability and performance
        const aScore = a.reliability.availabilityScore * 0.6 + (1 - a.performance.errorRate) * 0.4;
        const bScore = b.reliability.availabilityScore * 0.6 + (1 - b.performance.errorRate) * 0.4;
        return bScore - aScore;
      })
      .slice(0, 5);
  }

  /**
   * Analyze server ecosystem health
   */
  analyzeEcosystemHealth(): EcosystemHealthReport {
    const allServers = Array.from(this.serverRegistry.values());
    const activeServers = allServers.filter(s => s.status === ServerProfileStatus.ACTIVE);

    const averageReliability =
      activeServers.reduce((sum, s) => sum + s.reliability.availabilityScore, 0) /
      activeServers.length;
    const averageLatency =
      activeServers.reduce((sum, s) => sum + s.performance.averageLatency, 0) /
      activeServers.length;
    const totalCapabilities = new Set(allServers.flatMap(s => s.capabilities.map(c => c.type)))
      .size;

    const capabilityDistribution = this.calculateCapabilityDistribution(activeServers);
    const vendorDistribution = this.calculateVendorDistribution(activeServers);
    const riskAnalysis = this.analyzeEcosystemRisks(activeServers);

    return {
      totalServers: allServers.length,
      activeServers: activeServers.length,
      averageReliability,
      averageLatency,
      totalCapabilities,
      capabilityDistribution,
      vendorDistribution,
      riskAnalysis,
      lastUpdated: new Date(),
    };
  }

  // Private helper methods

  private initializeDefaultStrategies(): void {
    // Initialize discovery strategies
    this.discoveryStrategies = [
      DiscoveryStrategy.REGISTRY_LOOKUP,
      DiscoveryStrategy.CAPABILITY_MATCH,
      DiscoveryStrategy.NETWORK_SCAN,
      DiscoveryStrategy.CONFIGURATION_BASED,
    ];

    // TODO: Initialize selection strategies when implemented
  }

  private async applyDiscoveryStrategy(
    strategy: DiscoveryStrategy,
    query: ServerDiscoveryQuery
  ): Promise<MCPServerProfile[]> {
    // Implementation would depend on the specific strategy
    // This is a placeholder for the discovery logic
    return [];
  }

  private deduplicateServers(servers: MCPServerProfile[]): MCPServerProfile[] {
    const seen = new Set<string>();
    return servers.filter(server => {
      if (seen.has(server.id)) {
        return false;
      }
      seen.add(server.id);
      return true;
    });
  }

  private filterServersByQuery(
    servers: MCPServerProfile[],
    query: ServerDiscoveryQuery
  ): MCPServerProfile[] {
    return servers.filter(server => {
      // Check required capabilities
      const hasRequiredCapabilities = query.requiredCapabilities.every(reqCap =>
        server.capabilities.some(cap => cap.type === reqCap)
      );

      if (!hasRequiredCapabilities) return false;

      // Check latency requirement
      if (query.maxLatency && server.performance.averageLatency > query.maxLatency) {
        return false;
      }

      // Check reliability requirement
      if (query.minReliability && server.reliability.availabilityScore < query.minReliability) {
        return false;
      }

      // Check vendor preferences
      if (query.preferredVendors && query.preferredVendors.length > 0) {
        if (!query.preferredVendors.includes(server.vendor || '')) {
          return false;
        }
      }

      if (query.excludeVendors && server.vendor && query.excludeVendors.includes(server.vendor)) {
        return false;
      }

      return true;
    });
  }

  private filterEligibleServers(
    servers: MCPServerProfile[],
    query: ServerDiscoveryQuery
  ): MCPServerProfile[] {
    return servers.filter(
      server =>
        server.status === ServerProfileStatus.ACTIVE &&
        server.reliability.availabilityScore > 0.7 && // Minimum reliability threshold
        server.performance.errorRate < 0.1 // Maximum error rate
    );
  }

  private calculateServerScore(server: MCPServerProfile, query: ServerDiscoveryQuery): number {
    let score = 0;

    // Capability match score (40%)
    const capabilityScore = this.calculateCapabilityScore(server, query);
    score += capabilityScore * 0.4;

    // Performance score (30%)
    const performanceScore = this.calculatePerformanceScore(server, query);
    score += performanceScore * 0.3;

    // Reliability score (20%)
    const reliabilityScore = server.reliability.availabilityScore;
    score += reliabilityScore * 0.2;

    // Cost score (10%)
    const costScore = this.calculateCostScore(server, query);
    score += costScore * 0.1;

    return score;
  }

  private calculateCapabilityScore(server: MCPServerProfile, query: ServerDiscoveryQuery): number {
    let score = 0;

    // Required capabilities (must have all)
    const hasAllRequired = query.requiredCapabilities.every(reqCap =>
      server.capabilities.some(cap => cap.type === reqCap)
    );

    if (!hasAllRequired) return 0;

    score += 0.7; // Base score for having all required capabilities

    // Optional capabilities bonus
    if (query.optionalCapabilities) {
      const optionalMatches = query.optionalCapabilities.filter(optCap =>
        server.capabilities.some(cap => cap.type === optCap)
      ).length;

      const optionalBonus = (optionalMatches / query.optionalCapabilities.length) * 0.3;
      score += optionalBonus;
    }

    return Math.min(score, 1.0);
  }

  private calculatePerformanceScore(server: MCPServerProfile, query: ServerDiscoveryQuery): number {
    let score = 1.0;

    // Latency penalty
    if (query.maxLatency) {
      const latencyPenalty = Math.min(server.performance.averageLatency / query.maxLatency, 1.0);
      score *= 1 - latencyPenalty * 0.5;
    }

    // Error rate penalty
    score *= 1 - server.performance.errorRate;

    // Throughput bonus
    const throughputBonus = Math.min(server.performance.throughput / 1000, 0.2);
    score += throughputBonus;

    return Math.max(0, Math.min(score, 1.0));
  }

  private calculateCostScore(server: MCPServerProfile, query: ServerDiscoveryQuery): number {
    if (!server.cost) return 0.8; // Neutral score if no cost info

    let score = 1.0;

    // Cost tier penalty
    const tierPenalties = {
      [CostTier.FREE]: 0,
      [CostTier.BASIC]: 0.1,
      [CostTier.PREMIUM]: 0.3,
      [CostTier.ENTERPRISE]: 0.5,
    };

    score -= tierPenalties[server.cost.tier];

    return Math.max(0, score);
  }

  private calculateEstimatedPerformance(servers: MCPServerProfile[]): EstimatedPerformance {
    if (servers.length === 0) {
      return {
        expectedLatency: 0,
        expectedThroughput: 0,
        reliabilityScore: 0,
        scalabilityScore: 0,
      };
    }

    // Use primary server metrics for estimation
    const primaryServer = servers[0];

    return {
      expectedLatency: primaryServer.performance.averageLatency,
      expectedThroughput: primaryServer.performance.throughput,
      reliabilityScore: primaryServer.reliability.availabilityScore,
      scalabilityScore: Math.min(servers.length / 3, 1.0), // More servers = better scalability
    };
  }

  private assessRisks(servers: MCPServerProfile[], query: ServerDiscoveryQuery): RiskAssessment {
    const risks: Risk[] = [];

    // Single point of failure risk
    if (servers.length === 1) {
      risks.push({
        type: RiskType.RELIABILITY,
        severity: RiskSeverity.HIGH,
        description: 'Single server dependency creates reliability risk',
        probability: 0.3,
        impact: 0.8,
      });
    }

    // Vendor lock-in risk
    const vendors = new Set(servers.map(s => s.vendor).filter(Boolean));
    if (vendors.size === 1) {
      risks.push({
        type: RiskType.VENDOR_LOCK_IN,
        severity: RiskSeverity.MEDIUM,
        description: 'All servers from same vendor creates lock-in risk',
        probability: 0.5,
        impact: 0.6,
      });
    }

    // Performance risk
    const avgLatency =
      servers.reduce((sum, s) => sum + s.performance.averageLatency, 0) / servers.length;
    if (query.maxLatency && avgLatency > query.maxLatency * 0.8) {
      risks.push({
        type: RiskType.PERFORMANCE,
        severity: RiskSeverity.MEDIUM,
        description: 'Average latency approaching maximum threshold',
        probability: 0.6,
        impact: 0.7,
      });
    }

    // Calculate overall risk
    const overallRisk = this.calculateOverallRisk(risks);

    return {
      overallRisk,
      risks,
      mitigations: this.generateMitigations(risks),
      recommendations: this.generateRecommendations(risks, servers),
    };
  }

  private calculateOverallRisk(risks: Risk[]): RiskLevel {
    if (risks.length === 0) return RiskLevel.MINIMAL;

    const maxRiskScore = Math.max(...risks.map(r => r.probability * r.impact));

    if (maxRiskScore >= 0.8) return RiskLevel.CRITICAL;
    if (maxRiskScore >= 0.6) return RiskLevel.HIGH;
    if (maxRiskScore >= 0.4) return RiskLevel.MEDIUM;
    if (maxRiskScore >= 0.2) return RiskLevel.LOW;
    return RiskLevel.MINIMAL;
  }

  private generateSelectionReason(
    servers: MCPServerProfile[],
    query: ServerDiscoveryQuery,
    topScore: number
  ): string {
    const reasons = [
      `Selected ${servers.length} servers based on capability requirements`,
      `Top server scored ${topScore.toFixed(3)} on combined metrics`,
      `Required capabilities: ${query.requiredCapabilities.join(', ')}`,
    ];

    if (query.maxLatency) {
      reasons.push(`Latency requirement: <${query.maxLatency}ms`);
    }

    if (query.minReliability) {
      reasons.push(`Reliability requirement: >${query.minReliability * 100}%`);
    }

    return reasons.join('; ');
  }

  private createServerAllocations(
    servers: MCPServerProfile[],
    requirements: OrchestrationRequirements
  ): ServerAllocation[] {
    return servers.map((server, index) => ({
      server,
      role:
        index === 0 ? ServerRole.PRIMARY : index < 3 ? ServerRole.SECONDARY : ServerRole.FALLBACK,
      weight: Math.max(1, Math.floor(((servers.length - index) / servers.length) * 10)),
      maxConnections: server.performance.concurrentConnectionLimit,
      priority: servers.length - index,
      healthCheckInterval: 30000, // 30 seconds
    }));
  }

  private selectLoadBalancingStrategy(
    servers: MCPServerProfile[],
    requirements: OrchestrationRequirements
  ): LoadBalancingStrategy {
    // Select strategy based on server characteristics and requirements
    if (requirements.optimizeForCost) {
      return LoadBalancingStrategy.COST_OPTIMIZED;
    }

    if (requirements.optimizeForPerformance) {
      return LoadBalancingStrategy.PERFORMANCE_BASED;
    }

    // Check if servers have similar capabilities
    const capabilitySets = servers.map(s => new Set(s.capabilities.map(c => c.type)));
    const hasSpecializedServers = capabilitySets.some((set1, i) =>
      capabilitySets.some((set2, j) => i !== j && !this.setsEqual(set1, set2))
    );

    if (hasSpecializedServers) {
      return LoadBalancingStrategy.CAPABILITY_BASED;
    }

    return LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN;
  }

  private createFailoverPlan(
    selectionResult: ServerSelectionResult,
    requirements: OrchestrationRequirements
  ): FailoverPlan {
    const triggers: FailoverTrigger[] = [
      {
        type: TriggerType.CONSECUTIVE_FAILURES,
        threshold: 3,
        timeWindow: 60000, // 1 minute
        action: FailoverAction.SWITCH_PRIMARY,
      },
      {
        type: TriggerType.LATENCY_THRESHOLD,
        threshold: requirements.maxLatency || 5000,
        timeWindow: 30000, // 30 seconds
        action: FailoverAction.ADD_FALLBACK,
      },
    ];

    return {
      triggers,
      strategy: FailoverStrategy.CIRCUIT_BREAKER,
      fallbackServers: selectionResult.fallbackServers,
      recoveryPlan: {
        healthCheckStrategy: HealthCheckStrategy.PROGRESSIVE,
        recoveryThresholds: [],
        rollbackPlan: {} as RollbackPlan,
      },
    };
  }

  private createMonitoringPlan(
    servers: MCPServerProfile[],
    requirements: OrchestrationRequirements
  ): MonitoringPlan {
    return {
      metrics: [
        MonitoringMetric.LATENCY,
        MonitoringMetric.ERROR_RATE,
        MonitoringMetric.THROUGHPUT,
        MonitoringMetric.AVAILABILITY,
      ],
      alertThresholds: [],
      reportingInterval: 60000, // 1 minute
      dashboardConfig: {} as DashboardConfig,
    };
  }

  private createScalingPlan(
    servers: MCPServerProfile[],
    requirements: OrchestrationRequirements
  ): ScalingPlan {
    return {
      scaleUpTriggers: [],
      scaleDownTriggers: [],
      minInstances: 1,
      maxInstances: 10,
      scalingCooldown: 300000, // 5 minutes
    };
  }

  private calculateEstimatedCost(
    servers: MCPServerProfile[],
    requirements: OrchestrationRequirements
  ): number {
    // Simple cost estimation based on server tiers
    return servers.reduce((total, server) => {
      if (!server.cost) return total;

      const baseCost = {
        [CostTier.FREE]: 0,
        [CostTier.BASIC]: 10,
        [CostTier.PREMIUM]: 50,
        [CostTier.ENTERPRISE]: 200,
      }[server.cost.tier];

      return total + baseCost;
    }, 0);
  }

  private calculateCapabilityDistribution(
    servers: MCPServerProfile[]
  ): Map<CapabilityType, number> {
    const distribution = new Map<CapabilityType, number>();

    servers.forEach(server => {
      server.capabilities.forEach(cap => {
        distribution.set(cap.type, (distribution.get(cap.type) || 0) + 1);
      });
    });

    return distribution;
  }

  private calculateVendorDistribution(servers: MCPServerProfile[]): Map<string, number> {
    const distribution = new Map<string, number>();

    servers.forEach(server => {
      const vendor = server.vendor || 'Unknown';
      distribution.set(vendor, (distribution.get(vendor) || 0) + 1);
    });

    return distribution;
  }

  private analyzeEcosystemRisks(servers: MCPServerProfile[]): Risk[] {
    const risks: Risk[] = [];

    // Check for vendor concentration
    const vendorDistribution = this.calculateVendorDistribution(servers);
    const maxVendorShare = Math.max(...vendorDistribution.values()) / servers.length;

    if (maxVendorShare > 0.7) {
      risks.push({
        type: RiskType.VENDOR_LOCK_IN,
        severity: RiskSeverity.HIGH,
        description: 'High vendor concentration in ecosystem',
        probability: 0.8,
        impact: 0.7,
      });
    }

    return risks;
  }

  private generateMitigations(risks: Risk[]): string[] {
    const mitigations: string[] = [];

    risks.forEach(risk => {
      switch (risk.type) {
        case RiskType.RELIABILITY:
          mitigations.push('Add redundant servers to eliminate single points of failure');
          break;
        case RiskType.VENDOR_LOCK_IN:
          mitigations.push('Diversify server portfolio across multiple vendors');
          break;
        case RiskType.PERFORMANCE:
          mitigations.push('Implement caching and load balancing strategies');
          break;
      }
    });

    return [...new Set(mitigations)];
  }

  private generateRecommendations(risks: Risk[], servers: MCPServerProfile[]): string[] {
    const recommendations: string[] = [];

    if (servers.length < 3) {
      recommendations.push('Consider adding more servers for better redundancy');
    }

    if (risks.some(r => r.type === RiskType.PERFORMANCE)) {
      recommendations.push('Monitor performance metrics closely and consider upgrading servers');
    }

    return recommendations;
  }

  private setsEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
    return set1.size === set2.size && [...set1].every(item => set2.has(item));
  }
}

// Supporting interfaces and enums

export interface OrchestrationRequirements {
  maxLatency?: number;
  minThroughput?: number;
  enableAutoScaling?: boolean;
  optimizeForCost?: boolean;
  optimizeForPerformance?: boolean;
}

export interface EcosystemHealthReport {
  totalServers: number;
  activeServers: number;
  averageReliability: number;
  averageLatency: number;
  totalCapabilities: number;
  capabilityDistribution: Map<CapabilityType, number>;
  vendorDistribution: Map<string, number>;
  riskAnalysis: Risk[];
  lastUpdated: Date;
}

export enum DiscoveryStrategy {
  REGISTRY_LOOKUP = 'registry_lookup',
  CAPABILITY_MATCH = 'capability_match',
  NETWORK_SCAN = 'network_scan',
  CONFIGURATION_BASED = 'configuration_based',
}

export enum SelectionStrategy {
  PERFORMANCE_OPTIMIZED = 'performance_optimized',
  RELIABILITY_FOCUSED = 'reliability_focused',
  COST_MINIMIZED = 'cost_minimized',
  CAPABILITY_SPECIALIZED = 'capability_specialized',
}

export enum HealthCheckStrategy {
  SIMPLE = 'simple',
  PROGRESSIVE = 'progressive',
  COMPREHENSIVE = 'comprehensive',
}

export interface RecoveryThreshold {
  metric: string;
  threshold: number;
  duration: number;
}

export interface RollbackPlan {
  triggerConditions: string[];
  rollbackSteps: string[];
  verificationSteps: string[];
}

export enum MonitoringMetric {
  LATENCY = 'latency',
  ERROR_RATE = 'error_rate',
  THROUGHPUT = 'throughput',
  AVAILABILITY = 'availability',
  CPU_USAGE = 'cpu_usage',
  MEMORY_USAGE = 'memory_usage',
}

export interface AlertThreshold {
  metric: MonitoringMetric;
  threshold: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface DashboardConfig {
  layout: string;
  widgets: string[];
  refreshInterval: number;
}

export interface ScalingTrigger {
  metric: MonitoringMetric;
  threshold: number;
  duration: number;
  action: 'scale_up' | 'scale_down';
}
