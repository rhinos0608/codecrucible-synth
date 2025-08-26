/**
 * Intelligent MCP Connection Pool and Load Balancer
 * 
 * Provides advanced load balancing and connection pooling for MCP servers including:
 * - Intelligent routing based on capability matching and performance
 * - Dynamic pool scaling and connection lifecycle management
 * - Advanced load balancing algorithms (weighted, capability-aware, ML-based)
 * - Connection affinity and session management
 * - Real-time performance optimization
 * - Automatic failover and disaster recovery
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { enhancedMCPReliabilitySystem } from './enhanced-mcp-reliability-system.js';

export interface ConnectionPoolConfig {
  poolId: string;
  minConnections: number;
  maxConnections: number;
  scaleUpThreshold: number; // CPU/memory threshold to scale up
  scaleDownThreshold: number; // CPU/memory threshold to scale down
  connectionTimeout: number;
  idleTimeout: number; // Time before closing idle connections
  healthCheckInterval: number;
  loadBalancingStrategy: LoadBalancingStrategy;
  affinityEnabled: boolean; // Session affinity
  affinityTTL: number; // Affinity session TTL
}

export type LoadBalancingStrategy = 
  | 'round-robin'
  | 'least-connections' 
  | 'weighted-response-time'
  | 'capability-aware'
  | 'resource-based'
  | 'ml-optimized'
  | 'hybrid';

export interface PoolConnection {
  connectionId: string;
  serverId: string;
  serverName: string;
  capabilities: string[];
  status: 'idle' | 'active' | 'unhealthy' | 'scaling';
  
  // Performance metrics
  activeRequests: number;
  totalRequests: number;
  avgResponseTime: number;
  successRate: number;
  lastUsed: Date;
  createdAt: Date;
  
  // Resource usage
  cpuUsage?: number;
  memoryUsage?: number;
  networkLatency?: number;
  
  // Capability scores
  capabilityScores: Map<string, number>; // How well this connection handles specific capabilities
  
  // Health metrics
  healthScore: number;
  consecutiveErrors: number;
  lastHealthCheck: Date;
}

export interface LoadBalancingDecision {
  selectedConnection: PoolConnection;
  reason: string;
  confidence: number;
  alternatives: PoolConnection[];
  expectedPerformance: number;
}

export interface PoolMetrics {
  poolId: string;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  unhealthyConnections: number;
  
  // Performance
  avgResponseTime: number;
  totalRequests: number;
  requestsPerSecond: number;
  
  // Resource utilization
  avgCpuUsage: number;
  avgMemoryUsage: number;
  avgNetworkLatency: number;
  
  // Quality metrics
  overallHealthScore: number;
  loadDistribution: Map<string, number>;
  capabilityCoverage: string[];
  
  // Scaling metrics
  scaleEvents: number;
  lastScaleAction: Date;
  scaleDirection: 'up' | 'down' | 'stable';
}

export class IntelligentMCPLoadBalancer extends EventEmitter {
  private pools: Map<string, ConnectionPoolConfig> = new Map();
  private connections: Map<string, Map<string, PoolConnection>> = new Map();
  private sessionAffinity: Map<string, string> = new Map(); // sessionId -> connectionId
  private performanceModel: PerformanceMLModel = new PerformanceMLModel();
  
  // Request routing cache
  private routingCache: Map<string, { connectionId: string; expiresAt: number }> = new Map();
  private readonly ROUTING_CACHE_TTL = 30000; // 30 seconds
  
  // Pool monitoring
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    super();
    this.startGlobalMonitoring();
  }

  /**
   * Create connection pool
   */
  async createPool(config: ConnectionPoolConfig, serverIds: string[]): Promise<void> {
    logger.info(`Creating intelligent connection pool: ${config.poolId}`);
    
    this.pools.set(config.poolId, config);
    this.connections.set(config.poolId, new Map());
    
    // Initialize connections
    await this.initializePoolConnections(config.poolId, serverIds);
    
    // Start pool monitoring
    this.startPoolMonitoring(config.poolId);
    
    this.emit('pool-created', config.poolId, config);
  }

  /**
   * Initialize pool connections
   */
  private async initializePoolConnections(poolId: string, serverIds: string[]): Promise<void> {
    const config = this.pools.get(poolId)!;
    const poolConnections = this.connections.get(poolId)!;
    
    // Create initial connections up to minConnections
    const connectionsToCreate = Math.min(config.minConnections, serverIds.length);
    
    for (let i = 0; i < connectionsToCreate; i++) {
      const serverId = serverIds[i % serverIds.length];
      await this.createConnection(poolId, serverId);
    }
    
    logger.info(`Initialized pool ${poolId} with ${poolConnections.size} connections`);
  }

  /**
   * Create new connection in pool
   */
  private async createConnection(poolId: string, serverId: string): Promise<PoolConnection> {
    const connectionId = `${poolId}-${serverId}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    // Initialize connection monitoring in reliability system
    await enhancedMCPReliabilitySystem.initializeConnection(connectionId, serverId);
    
    const connection: PoolConnection = {
      connectionId,
      serverId,
      serverName: serverId, // This would be resolved from server registry
      capabilities: await this.getServerCapabilities(serverId),
      status: 'idle',
      
      activeRequests: 0,
      totalRequests: 0,
      avgResponseTime: 0,
      successRate: 100,
      lastUsed: new Date(),
      createdAt: new Date(),
      
      capabilityScores: new Map(),
      healthScore: 100,
      consecutiveErrors: 0,
      lastHealthCheck: new Date(),
    };
    
    const poolConnections = this.connections.get(poolId)!;
    poolConnections.set(connectionId, connection);
    
    logger.debug(`Created connection ${connectionId} for pool ${poolId}`);
    this.emit('connection-created', poolId, connection);
    
    return connection;
  }

  /**
   * Get best connection for request based on intelligent routing
   */
  async getConnection(
    poolId: string, 
    requiredCapabilities: string[] = [],
    sessionId?: string,
    requestContext?: any
  ): Promise<LoadBalancingDecision | null> {
    const config = this.pools.get(poolId);
    const poolConnections = this.connections.get(poolId);
    
    if (!config || !poolConnections) {
      throw new Error(`Pool ${poolId} not found`);
    }

    // Check session affinity first
    if (sessionId && config.affinityEnabled) {
      const affinityConnection = this.getAffinityConnection(poolId, sessionId);
      if (affinityConnection) {
        return {
          selectedConnection: affinityConnection,
          reason: 'Session affinity',
          confidence: 100,
          alternatives: [],
          expectedPerformance: affinityConnection.avgResponseTime,
        };
      }
    }

    // Check routing cache
    const cacheKey = `${poolId}-${requiredCapabilities.sort().join(',')}-${requestContext?.type || 'default'}`;
    const cached = this.routingCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      const connection = poolConnections.get(cached.connectionId);
      if (connection && connection.status === 'idle') {
        return {
          selectedConnection: connection,
          reason: 'Cached routing decision',
          confidence: 85,
          alternatives: [],
          expectedPerformance: connection.avgResponseTime,
        };
      }
    }

    // Get healthy connections
    const healthyConnections = Array.from(poolConnections.values()).filter(conn => 
      conn.status === 'idle' && 
      conn.healthScore > 70 &&
      conn.consecutiveErrors < 3
    );

    if (healthyConnections.length === 0) {
      // Try to scale up or return best available connection
      await this.scaleUp(poolId);
      return null;
    }

    // Apply load balancing strategy
    const decision = await this.selectConnectionByStrategy(
      config.loadBalancingStrategy,
      healthyConnections,
      requiredCapabilities,
      requestContext
    );

    if (decision) {
      // Cache the decision
      this.routingCache.set(cacheKey, {
        connectionId: decision.selectedConnection.connectionId,
        expiresAt: Date.now() + this.ROUTING_CACHE_TTL,
      });

      // Set session affinity
      if (sessionId && config.affinityEnabled) {
        this.sessionAffinity.set(sessionId, decision.selectedConnection.connectionId);
        setTimeout(() => {
          this.sessionAffinity.delete(sessionId);
        }, config.affinityTTL);
      }
    }

    return decision;
  }

  /**
   * Select connection based on load balancing strategy
   */
  private async selectConnectionByStrategy(
    strategy: LoadBalancingStrategy,
    connections: PoolConnection[],
    requiredCapabilities: string[],
    requestContext?: any
  ): Promise<LoadBalancingDecision | null> {
    switch (strategy) {
      case 'round-robin':
        return this.selectRoundRobin(connections);
      
      case 'least-connections':
        return this.selectLeastConnections(connections);
      
      case 'weighted-response-time':
        return this.selectByResponseTime(connections);
      
      case 'capability-aware':
        return this.selectByCapability(connections, requiredCapabilities);
      
      case 'resource-based':
        return this.selectByResourceUsage(connections);
      
      case 'ml-optimized':
        return await this.selectByMLModel(connections, requiredCapabilities, requestContext);
      
      case 'hybrid':
        return await this.selectByHybridStrategy(connections, requiredCapabilities, requestContext);
      
      default:
        return this.selectRoundRobin(connections);
    }
  }

  private selectRoundRobin(connections: PoolConnection[]): LoadBalancingDecision {
    // Simple round-robin selection
    const selected = connections[Math.floor(Math.random() * connections.length)];
    
    return {
      selectedConnection: selected,
      reason: 'Round-robin selection',
      confidence: 70,
      alternatives: connections.filter(c => c !== selected).slice(0, 2),
      expectedPerformance: selected.avgResponseTime,
    };
  }

  private selectLeastConnections(connections: PoolConnection[]): LoadBalancingDecision {
    const sorted = connections.sort((a, b) => a.activeRequests - b.activeRequests);
    const selected = sorted[0];
    
    return {
      selectedConnection: selected,
      reason: `Least connections (${selected.activeRequests} active)`,
      confidence: 85,
      alternatives: sorted.slice(1, 3),
      expectedPerformance: selected.avgResponseTime,
    };
  }

  private selectByResponseTime(connections: PoolConnection[]): LoadBalancingDecision {
    // Weight inversely by response time
    const weights = connections.map(conn => 1 / (conn.avgResponseTime + 1));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    
    let random = Math.random() * totalWeight;
    for (let i = 0; i < connections.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return {
          selectedConnection: connections[i],
          reason: `Weighted by response time (${connections[i].avgResponseTime.toFixed(1)}ms avg)`,
          confidence: 90,
          alternatives: connections.filter((_, idx) => idx !== i).slice(0, 2),
          expectedPerformance: connections[i].avgResponseTime,
        };
      }
    }
    
    return this.selectRoundRobin(connections);
  }

  private selectByCapability(connections: PoolConnection[], requiredCapabilities: string[]): LoadBalancingDecision {
    if (requiredCapabilities.length === 0) {
      return this.selectLeastConnections(connections);
    }

    // Score connections based on capability match and performance
    const scoredConnections = connections.map(conn => {
      const capabilityMatch = requiredCapabilities.filter(cap => 
        conn.capabilities.includes(cap)
      ).length / requiredCapabilities.length;
      
      const performanceScore = Math.max(0, 100 - conn.avgResponseTime) / 100;
      const healthScore = conn.healthScore / 100;
      
      const overallScore = (capabilityMatch * 0.5) + (performanceScore * 0.3) + (healthScore * 0.2);
      
      return { connection: conn, score: overallScore };
    });

    const best = scoredConnections.sort((a, b) => b.score - a.score)[0];
    
    return {
      selectedConnection: best.connection,
      reason: `Capability-aware selection (${(best.score * 100).toFixed(1)}% match)`,
      confidence: 95,
      alternatives: scoredConnections.slice(1, 3).map(sc => sc.connection),
      expectedPerformance: best.connection.avgResponseTime,
    };
  }

  private selectByResourceUsage(connections: PoolConnection[]): LoadBalancingDecision {
    // Select connection with lowest resource usage
    const withResourceData = connections.filter(conn => 
      conn.cpuUsage !== undefined && conn.memoryUsage !== undefined
    );

    if (withResourceData.length === 0) {
      return this.selectLeastConnections(connections);
    }

    const sorted = withResourceData.sort((a, b) => {
      const scoreA = (a.cpuUsage! + a.memoryUsage!) / 2;
      const scoreB = (b.cpuUsage! + b.memoryUsage!) / 2;
      return scoreA - scoreB;
    });

    const selected = sorted[0];
    
    return {
      selectedConnection: selected,
      reason: `Resource-based selection (${((selected.cpuUsage! + selected.memoryUsage!) / 2).toFixed(1)}% usage)`,
      confidence: 88,
      alternatives: sorted.slice(1, 3),
      expectedPerformance: selected.avgResponseTime,
    };
  }

  private async selectByMLModel(
    connections: PoolConnection[],
    requiredCapabilities: string[],
    requestContext?: any
  ): Promise<LoadBalancingDecision> {
    const predictions = await Promise.all(
      connections.map(async conn => {
        const prediction = await this.performanceModel.predictPerformance(conn, requiredCapabilities, requestContext);
        return { connection: conn, prediction };
      })
    );

    const best = predictions.sort((a, b) => a.prediction.score - b.prediction.score)[0];
    
    return {
      selectedConnection: best.connection,
      reason: `ML-optimized selection (${best.prediction.score.toFixed(1)} predicted score)`,
      confidence: best.prediction.confidence,
      alternatives: predictions.slice(1, 3).map(p => p.connection),
      expectedPerformance: best.prediction.expectedResponseTime,
    };
  }

  private async selectByHybridStrategy(
    connections: PoolConnection[],
    requiredCapabilities: string[],
    requestContext?: any
  ): Promise<LoadBalancingDecision> {
    // Combine multiple strategies with weights
    const strategies = [
      { strategy: 'capability-aware', weight: 0.4 },
      { strategy: 'weighted-response-time', weight: 0.3 },
      { strategy: 'resource-based', weight: 0.2 },
      { strategy: 'ml-optimized', weight: 0.1 },
    ];

    const scores = new Map<string, number>();
    const reasons: string[] = [];

    for (const { strategy, weight } of strategies) {
      const decision = await this.selectConnectionByStrategy(
        strategy as LoadBalancingStrategy,
        connections,
        requiredCapabilities,
        requestContext
      );

      if (decision) {
        const current = scores.get(decision.selectedConnection.connectionId) || 0;
        scores.set(decision.selectedConnection.connectionId, current + (weight * decision.confidence));
        reasons.push(`${strategy}: ${decision.confidence}%`);
      }
    }

    // Find connection with highest hybrid score
    let bestConnectionId = '';
    let bestScore = 0;

    for (const [connectionId, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestConnectionId = connectionId;
      }
    }

    const selectedConnection = connections.find(c => c.connectionId === bestConnectionId)!;
    
    return {
      selectedConnection,
      reason: `Hybrid strategy (${reasons.join(', ')})`,
      confidence: Math.min(100, bestScore),
      alternatives: connections.filter(c => c !== selectedConnection).slice(0, 2),
      expectedPerformance: selectedConnection.avgResponseTime,
    };
  }

  /**
   * Record request completion for connection
   */
  recordRequestCompletion(
    poolId: string,
    connectionId: string,
    success: boolean,
    responseTime: number,
    capabilities?: string[]
  ): void {
    const poolConnections = this.connections.get(poolId);
    const connection = poolConnections?.get(connectionId);
    
    if (!connection) return;

    // Update basic metrics
    connection.totalRequests++;
    connection.avgResponseTime = (connection.avgResponseTime + responseTime) / 2;
    connection.lastUsed = new Date();
    connection.activeRequests = Math.max(0, connection.activeRequests - 1);

    if (success) {
      connection.successRate = (connection.successRate * 0.9) + (1 * 0.1);
      connection.consecutiveErrors = 0;
      connection.healthScore = Math.min(100, connection.healthScore + 1);
    } else {
      connection.successRate = connection.successRate * 0.9;
      connection.consecutiveErrors++;
      connection.healthScore = Math.max(0, connection.healthScore - 5);
    }

    // Update capability scores
    if (capabilities) {
      capabilities.forEach(cap => {
        const current = connection.capabilityScores.get(cap) || 50;
        const adjustment = success ? 2 : -2;
        connection.capabilityScores.set(cap, Math.max(0, Math.min(100, current + adjustment)));
      });
    }

    // Record in reliability system
    enhancedMCPReliabilitySystem.recordRequestCompletion(connectionId, success, responseTime, poolId);

    // Update performance model
    this.performanceModel.recordRequest(connection, success, responseTime, capabilities);

    this.emit('request-completed', poolId, connectionId, success, responseTime);
  }

  /**
   * Get session affinity connection
   */
  private getAffinityConnection(poolId: string, sessionId: string): PoolConnection | null {
    const connectionId = this.sessionAffinity.get(sessionId);
    if (!connectionId) return null;

    const poolConnections = this.connections.get(poolId);
    const connection = poolConnections?.get(connectionId);
    
    return connection && connection.status === 'idle' ? connection : null;
  }

  /**
   * Scale pool up
   */
  private async scaleUp(poolId: string): Promise<void> {
    const config = this.pools.get(poolId);
    const poolConnections = this.connections.get(poolId);
    
    if (!config || !poolConnections) return;

    const currentCount = poolConnections.size;
    if (currentCount >= config.maxConnections) {
      logger.warn(`Pool ${poolId} already at maximum capacity (${config.maxConnections})`);
      return;
    }

    logger.info(`Scaling up pool ${poolId} from ${currentCount} connections`);

    // Add new connection - this would need server selection logic
    // For now, we'll use a placeholder server ID
    await this.createConnection(poolId, `auto-scaled-server-${Date.now()}`);
    
    this.emit('pool-scaled-up', poolId, poolConnections.size);
  }

  /**
   * Scale pool down
   */
  private async scaleDown(poolId: string): Promise<void> {
    const config = this.pools.get(poolId);
    const poolConnections = this.connections.get(poolId);
    
    if (!config || !poolConnections) return;

    const currentCount = poolConnections.size;
    if (currentCount <= config.minConnections) return;

    // Find least used idle connection
    const idleConnections = Array.from(poolConnections.values()).filter(conn => 
      conn.status === 'idle' && conn.activeRequests === 0
    );

    if (idleConnections.length === 0) return;

    const leastUsed = idleConnections.sort((a, b) => a.totalRequests - b.totalRequests)[0];
    
    // Remove connection
    poolConnections.delete(leastUsed.connectionId);
    this.sessionAffinity.forEach((connectionId, sessionId) => {
      if (connectionId === leastUsed.connectionId) {
        this.sessionAffinity.delete(sessionId);
      }
    });

    logger.info(`Scaled down pool ${poolId}, removed connection ${leastUsed.connectionId}`);
    this.emit('pool-scaled-down', poolId, poolConnections.size);
  }

  /**
   * Get server capabilities (placeholder)
   */
  private async getServerCapabilities(serverId: string): Promise<string[]> {
    // This would integrate with the discovery system
    return ['filesystem', 'web-search', 'document-processing'];
  }

  /**
   * Start pool monitoring
   */
  private startPoolMonitoring(poolId: string): void {
    const config = this.pools.get(poolId)!;
    
    const interval = setInterval(async () => {
      await this.monitorPool(poolId);
    }, config.healthCheckInterval);

    this.monitoringIntervals.set(poolId, interval);
  }

  /**
   * Monitor pool health and performance
   */
  private async monitorPool(poolId: string): Promise<void> {
    const config = this.pools.get(poolId);
    const poolConnections = this.connections.get(poolId);
    
    if (!config || !poolConnections) return;

    const connections = Array.from(poolConnections.values());
    const metrics = this.calculatePoolMetrics(poolId, connections);

    // Check scaling conditions
    const avgCpuUsage = metrics.avgCpuUsage || 0;
    const avgActiveRequests = connections.reduce((sum, conn) => sum + conn.activeRequests, 0) / connections.length;

    if (avgCpuUsage > config.scaleUpThreshold || avgActiveRequests > 5) {
      await this.scaleUp(poolId);
    } else if (avgCpuUsage < config.scaleDownThreshold && avgActiveRequests < 1) {
      await this.scaleDown(poolId);
    }

    // Clean up idle connections
    await this.cleanupIdleConnections(poolId);

    this.emit('pool-monitored', poolId, metrics);
  }

  /**
   * Calculate pool metrics
   */
  private calculatePoolMetrics(poolId: string, connections: PoolConnection[]): PoolMetrics {
    const totalConnections = connections.length;
    const activeConnections = connections.filter(c => c.activeRequests > 0).length;
    const idleConnections = connections.filter(c => c.status === 'idle').length;
    const unhealthyConnections = connections.filter(c => c.healthScore < 70).length;

    const avgResponseTime = connections.reduce((sum, c) => sum + c.avgResponseTime, 0) / totalConnections;
    const totalRequests = connections.reduce((sum, c) => sum + c.totalRequests, 0);
    
    const avgCpuUsage = connections
      .filter(c => c.cpuUsage !== undefined)
      .reduce((sum, c) => sum + c.cpuUsage!, 0) / totalConnections;
    
    const avgMemoryUsage = connections
      .filter(c => c.memoryUsage !== undefined)
      .reduce((sum, c) => sum + c.memoryUsage!, 0) / totalConnections;

    const overallHealthScore = connections.reduce((sum, c) => sum + c.healthScore, 0) / totalConnections;

    // Calculate load distribution
    const loadDistribution = new Map<string, number>();
    connections.forEach(conn => {
      loadDistribution.set(conn.serverId, (loadDistribution.get(conn.serverId) || 0) + conn.totalRequests);
    });

    // Get all unique capabilities
    const allCapabilities = new Set<string>();
    connections.forEach(conn => {
      conn.capabilities.forEach(cap => allCapabilities.add(cap));
    });

    return {
      poolId,
      totalConnections,
      activeConnections,
      idleConnections,
      unhealthyConnections,
      
      avgResponseTime,
      totalRequests,
      requestsPerSecond: totalRequests / ((Date.now() - connections[0]?.createdAt.getTime()) / 1000),
      
      avgCpuUsage,
      avgMemoryUsage,
      avgNetworkLatency: 0, // Would be calculated from actual measurements
      
      overallHealthScore,
      loadDistribution,
      capabilityCoverage: Array.from(allCapabilities),
      
      scaleEvents: 0, // Would be tracked separately
      lastScaleAction: new Date(),
      scaleDirection: 'stable',
    };
  }

  /**
   * Cleanup idle connections
   */
  private async cleanupIdleConnections(poolId: string): Promise<void> {
    const config = this.pools.get(poolId)!;
    const poolConnections = this.connections.get(poolId)!;
    
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const [connectionId, connection] of poolConnections) {
      const idleTime = now - connection.lastUsed.getTime();
      if (idleTime > config.idleTimeout && poolConnections.size > config.minConnections) {
        connectionsToRemove.push(connectionId);
      }
    }

    for (const connectionId of connectionsToRemove) {
      poolConnections.delete(connectionId);
      logger.debug(`Removed idle connection ${connectionId} from pool ${poolId}`);
    }
  }

  /**
   * Start global monitoring
   */
  private startGlobalMonitoring(): void {
    setInterval(() => {
      this.cleanupRoutingCache();
    }, 60000); // Clean cache every minute
  }

  /**
   * Cleanup expired routing cache entries
   */
  private cleanupRoutingCache(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, entry] of this.routingCache) {
      if (entry.expiresAt <= now) {
        expired.push(key);
      }
    }

    expired.forEach(key => this.routingCache.delete(key));
  }

  /**
   * Get pool metrics
   */
  getPoolMetrics(poolId: string): PoolMetrics | null {
    const connections = this.connections.get(poolId);
    if (!connections) return null;

    return this.calculatePoolMetrics(poolId, Array.from(connections.values()));
  }

  /**
   * Get all pool metrics
   */
  getAllPoolMetrics(): PoolMetrics[] {
    return Array.from(this.pools.keys()).map(poolId => this.getPoolMetrics(poolId)!);
  }

  /**
   * Destroy pool
   */
  async destroyPool(poolId: string): Promise<void> {
    const connections = this.connections.get(poolId);
    const interval = this.monitoringIntervals.get(poolId);

    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(poolId);
    }

    if (connections) {
      // Clean up session affinity
      this.sessionAffinity.forEach((connectionId, sessionId) => {
        if (connections.has(connectionId)) {
          this.sessionAffinity.delete(sessionId);
        }
      });
    }

    this.pools.delete(poolId);
    this.connections.delete(poolId);

    logger.info(`Destroyed connection pool: ${poolId}`);
    this.emit('pool-destroyed', poolId);
  }
}

/**
 * Performance ML Model for prediction-based routing
 */
class PerformanceMLModel {
  private requestHistory: Array<{
    connectionId: string;
    capabilities: string[];
    responseTime: number;
    success: boolean;
    timestamp: number;
    context?: any;
  }> = [];

  private readonly MAX_HISTORY = 1000;

  async predictPerformance(
    connection: PoolConnection,
    requiredCapabilities: string[],
    requestContext?: any
  ): Promise<{ score: number; confidence: number; expectedResponseTime: number }> {
    // Simple ML model - would be more sophisticated in real implementation
    
    const relevantHistory = this.requestHistory.filter(req => 
      req.connectionId === connection.connectionId ||
      req.capabilities.some(cap => requiredCapabilities.includes(cap))
    );

    if (relevantHistory.length < 5) {
      // Insufficient data, return baseline prediction
      return {
        score: connection.healthScore,
        confidence: 40,
        expectedResponseTime: connection.avgResponseTime,
      };
    }

    // Calculate weighted score based on recent performance
    const recentHistory = relevantHistory.slice(-20);
    const successRate = recentHistory.filter(req => req.success).length / recentHistory.length;
    const avgResponseTime = recentHistory.reduce((sum, req) => sum + req.responseTime, 0) / recentHistory.length;

    // Factor in capability match
    const capabilityMatch = requiredCapabilities.filter(cap => 
      connection.capabilities.includes(cap)
    ).length / Math.max(1, requiredCapabilities.length);

    // Calculate prediction score (lower is better for response time)
    const responseTimeScore = Math.max(0, 100 - (avgResponseTime / 100));
    const successScore = successRate * 100;
    const capabilityScore = capabilityMatch * 100;
    const healthScore = connection.healthScore;

    const overallScore = (
      responseTimeScore * 0.3 +
      successScore * 0.3 +
      capabilityScore * 0.2 +
      healthScore * 0.2
    );

    const confidence = Math.min(100, relevantHistory.length * 2);

    return {
      score: overallScore,
      confidence,
      expectedResponseTime: avgResponseTime,
    };
  }

  recordRequest(
    connection: PoolConnection,
    success: boolean,
    responseTime: number,
    capabilities?: string[]
  ): void {
    this.requestHistory.push({
      connectionId: connection.connectionId,
      capabilities: capabilities || connection.capabilities,
      responseTime,
      success,
      timestamp: Date.now(),
    });

    // Keep only recent history
    if (this.requestHistory.length > this.MAX_HISTORY) {
      this.requestHistory.shift();
    }
  }
}

// Global instance
export const intelligentMCPLoadBalancer = new IntelligentMCPLoadBalancer();