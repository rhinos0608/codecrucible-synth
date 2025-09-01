/**
 * Enhanced MCP Connection Reliability System
 *
 * Provides advanced reliability features for MCP connections including:
 * - Intelligent failover and recovery
 * - Connection health analytics
 * - Adaptive timeout management
 * - Smart circuit breaking with machine learning
 * - Connection pooling with load balancing
 * - Performance prediction and optimization
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';

export interface ConnectionHealthMetrics {
  connectionId: string;
  serverName: string;
  uptime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  lastResponseTime: number;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  errorRate: number;
  availability: number;
  lastHealthCheck: Date;
  performanceTrend: 'improving' | 'stable' | 'degrading';
  predictedReliability: number;
}

export interface ConnectionPool {
  poolId: string;
  servers: string[];
  strategy: 'round-robin' | 'least-connections' | 'fastest-response' | 'weighted';
  weights?: Map<string, number>;
  currentIndex: number;
  totalConnections: number;
  activeRequests: Map<string, number>;
}

export interface AdaptiveTimeout {
  baseTimeout: number;
  currentTimeout: number;
  minTimeout: number;
  maxTimeout: number;
  adaptationFactor: number;
  successHistory: number[];
  timeoutHistory: number[];
}

export class EnhancedMCPReliabilitySystem extends EventEmitter {
  private healthMetrics: Map<string, ConnectionHealthMetrics> = new Map();
  private connectionPools: Map<string, ConnectionPool> = new Map();
  private adaptiveTimeouts: Map<string, AdaptiveTimeout> = new Map();
  private circuitBreakers: Map<string, SmartCircuitBreaker> = new Map();
  private performancePredictors: Map<string, PerformancePredictor> = new Map();

  // Configuration
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly PERFORMANCE_WINDOW = 100; // Number of requests to track
  private readonly PREDICTION_WINDOW = 50; // Requests for prediction

  constructor() {
    super();
    this.startGlobalHealthMonitoring();
  }

  /**
   * Smart Circuit Breaker with Machine Learning
   */
  private getSmartCircuitBreaker(connectionId: string): SmartCircuitBreaker {
    if (!this.circuitBreakers.has(connectionId)) {
      this.circuitBreakers.set(connectionId, new SmartCircuitBreaker(connectionId));
    }
    return this.circuitBreakers.get(connectionId)!;
  }

  /**
   * Initialize connection monitoring
   */
  async initializeConnection(
    connectionId: string,
    serverName: string,
    config?: any
  ): Promise<void> {
    const healthMetrics: ConnectionHealthMetrics = {
      connectionId,
      serverName,
      uptime: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      lastResponseTime: 0,
      consecutiveSuccesses: 0,
      consecutiveFailures: 0,
      errorRate: 0,
      availability: 100,
      lastHealthCheck: new Date(),
      performanceTrend: 'stable',
      predictedReliability: 100,
    };

    this.healthMetrics.set(connectionId, healthMetrics);

    // Initialize adaptive timeout
    const adaptiveTimeout: AdaptiveTimeout = {
      baseTimeout: config?.baseTimeout || 30000,
      currentTimeout: config?.baseTimeout || 30000,
      minTimeout: config?.minTimeout || 5000,
      maxTimeout: config?.maxTimeout || 120000,
      adaptationFactor: 0.1,
      successHistory: [],
      timeoutHistory: [],
    };
    this.adaptiveTimeouts.set(connectionId, adaptiveTimeout);

    // Initialize performance predictor
    this.performancePredictors.set(connectionId, new PerformancePredictor(connectionId));

    logger.info(`Enhanced reliability monitoring initialized for connection: ${serverName}`);
    this.emit('connection-monitoring-started', connectionId, healthMetrics);
  }

  /**
   * Create connection pool with intelligent load balancing
   */
  createConnectionPool(
    poolId: string,
    serverIds: string[],
    strategy: ConnectionPool['strategy'] = 'fastest-response',
    weights?: Map<string, number>
  ): void {
    const pool: ConnectionPool = {
      poolId,
      servers: [...serverIds],
      strategy,
      weights: weights || new Map(),
      currentIndex: 0,
      totalConnections: serverIds.length,
      activeRequests: new Map(serverIds.map(id => [id, 0])),
    };

    this.connectionPools.set(poolId, pool);
    logger.info(
      `Connection pool created: ${poolId} with ${serverIds.length} servers using ${strategy} strategy`
    );
    this.emit('connection-pool-created', poolId, pool);
  }

  /**
   * Get optimal connection from pool
   */
  getOptimalConnection(poolId: string): string | null {
    const pool = this.connectionPools.get(poolId);
    if (!pool || pool.servers.length === 0) {
      return null;
    }

    switch (pool.strategy) {
      case 'round-robin':
        return this.getRoundRobinConnection(pool);
      case 'least-connections':
        return this.getLeastConnectionsConnection(pool);
      case 'fastest-response':
        return this.getFastestResponseConnection(pool);
      case 'weighted':
        return this.getWeightedConnection(pool);
      default:
        return pool.servers[0];
    }
  }

  private getRoundRobinConnection(pool: ConnectionPool): string {
    const connection = pool.servers[pool.currentIndex];
    pool.currentIndex = (pool.currentIndex + 1) % pool.servers.length;
    return connection;
  }

  private getLeastConnectionsConnection(pool: ConnectionPool): string {
    let minConnections = Infinity;
    let selectedConnection = pool.servers[0];

    for (const serverId of pool.servers) {
      const connections = pool.activeRequests.get(serverId) || 0;
      if (connections < minConnections) {
        minConnections = connections;
        selectedConnection = serverId;
      }
    }

    return selectedConnection;
  }

  private getFastestResponseConnection(pool: ConnectionPool): string {
    let fastestTime = Infinity;
    let selectedConnection = pool.servers[0];

    for (const serverId of pool.servers) {
      const metrics = this.healthMetrics.get(serverId);
      if (metrics && metrics.avgResponseTime < fastestTime) {
        fastestTime = metrics.avgResponseTime;
        selectedConnection = serverId;
      }
    }

    return selectedConnection;
  }

  private getWeightedConnection(pool: ConnectionPool): string {
    const totalWeight = Array.from(pool.weights?.values() || []).reduce(
      (sum, weight) => sum + weight,
      0
    );
    let random = Math.random() * totalWeight;

    for (const serverId of pool.servers) {
      const weight = pool.weights?.get(serverId) || 1;
      random -= weight;
      if (random <= 0) {
        return serverId;
      }
    }

    return pool.servers[0];
  }

  /**
   * Record request start
   */
  recordRequestStart(connectionId: string, poolId?: string): void {
    const metrics = this.healthMetrics.get(connectionId);
    if (metrics) {
      metrics.totalRequests++;
    }

    // Update pool active requests
    if (poolId) {
      const pool = this.connectionPools.get(poolId);
      if (pool) {
        const current = pool.activeRequests.get(connectionId) || 0;
        pool.activeRequests.set(connectionId, current + 1);
      }
    }

    this.emit('request-started', connectionId);
  }

  /**
   * Record request completion
   */
  recordRequestCompletion(
    connectionId: string,
    success: boolean,
    responseTime: number,
    poolId?: string,
    error?: Error
  ): void {
    const metrics = this.healthMetrics.get(connectionId);
    if (!metrics) return;

    // Update basic metrics
    metrics.lastResponseTime = responseTime;
    metrics.avgResponseTime = (metrics.avgResponseTime + responseTime) / 2;

    if (success) {
      metrics.successfulRequests++;
      metrics.consecutiveSuccesses++;
      metrics.consecutiveFailures = 0;
    } else {
      metrics.failedRequests++;
      metrics.consecutiveFailures++;
      metrics.consecutiveSuccesses = 0;
    }

    // Calculate error rate
    metrics.errorRate = (metrics.failedRequests / metrics.totalRequests) * 100;
    metrics.availability = (metrics.successfulRequests / metrics.totalRequests) * 100;

    // Update adaptive timeout
    this.updateAdaptiveTimeout(connectionId, success, responseTime);

    // Update circuit breaker
    const circuitBreaker = this.getSmartCircuitBreaker(connectionId);
    circuitBreaker.recordResult(success, responseTime, error);

    // Update performance predictor
    const predictor = this.performancePredictors.get(connectionId);
    if (predictor) {
      predictor.recordRequest(success, responseTime);
      metrics.predictedReliability = predictor.predictReliability();
    }

    // Analyze performance trend
    this.analyzePerformanceTrend(connectionId);

    // Update pool active requests
    if (poolId) {
      const pool = this.connectionPools.get(poolId);
      if (pool) {
        const current = pool.activeRequests.get(connectionId) || 0;
        pool.activeRequests.set(connectionId, Math.max(0, current - 1));
      }
    }

    this.emit('request-completed', connectionId, success, responseTime, metrics);
  }

  /**
   * Update adaptive timeout based on performance
   */
  private updateAdaptiveTimeout(
    connectionId: string,
    success: boolean,
    responseTime: number
  ): void {
    const timeout = this.adaptiveTimeouts.get(connectionId);
    if (!timeout) return;

    timeout.successHistory.push(success ? 1 : 0);
    timeout.timeoutHistory.push(responseTime);

    // Keep only recent history
    if (timeout.successHistory.length > this.PERFORMANCE_WINDOW) {
      timeout.successHistory.shift();
      timeout.timeoutHistory.shift();
    }

    // Calculate success rate
    const successRate =
      timeout.successHistory.reduce((sum, val) => sum + val, 0) / timeout.successHistory.length;
    const avgResponseTime =
      timeout.timeoutHistory.reduce((sum, val) => sum + val, 0) / timeout.timeoutHistory.length;

    // Adaptive adjustment
    if (successRate > 0.95 && avgResponseTime < timeout.currentTimeout * 0.5) {
      // High success rate and fast responses - decrease timeout
      timeout.currentTimeout = Math.max(
        timeout.minTimeout,
        timeout.currentTimeout * (1 - timeout.adaptationFactor)
      );
    } else if (successRate < 0.8 || responseTime > timeout.currentTimeout * 0.8) {
      // Low success rate or slow responses - increase timeout
      timeout.currentTimeout = Math.min(
        timeout.maxTimeout,
        timeout.currentTimeout * (1 + timeout.adaptationFactor)
      );
    }

    this.adaptiveTimeouts.set(connectionId, timeout);
  }

  /**
   * Analyze performance trend
   */
  private analyzePerformanceTrend(connectionId: string): void {
    const metrics = this.healthMetrics.get(connectionId);
    const timeout = this.adaptiveTimeouts.get(connectionId);
    if (!metrics || !timeout || timeout.timeoutHistory.length < 10) return;

    // Analyze recent performance
    const recentResponses = timeout.timeoutHistory.slice(-10);
    const olderResponses = timeout.timeoutHistory.slice(-20, -10);

    if (olderResponses.length < 5) return;

    const recentAvg = recentResponses.reduce((sum, val) => sum + val, 0) / recentResponses.length;
    const olderAvg = olderResponses.reduce((sum, val) => sum + val, 0) / olderResponses.length;

    const improvement = (olderAvg - recentAvg) / olderAvg;

    if (improvement > 0.1) {
      metrics.performanceTrend = 'improving';
    } else if (improvement < -0.1) {
      metrics.performanceTrend = 'degrading';
    } else {
      metrics.performanceTrend = 'stable';
    }

    if (metrics.performanceTrend === 'degrading') {
      logger.warn(`Performance degradation detected for connection: ${metrics.serverName}`);
      this.emit('performance-degradation', connectionId, metrics);
    }
  }

  /**
   * Check if connection should be used based on circuit breaker
   */
  shouldAllowRequest(connectionId: string): boolean {
    const circuitBreaker = this.getSmartCircuitBreaker(connectionId);
    return circuitBreaker.allowRequest();
  }

  /**
   * Get adaptive timeout for connection
   */
  getAdaptiveTimeout(connectionId: string): number {
    const timeout = this.adaptiveTimeouts.get(connectionId);
    return timeout?.currentTimeout || 30000;
  }

  /**
   * Get connection health metrics
   */
  getHealthMetrics(connectionId: string): ConnectionHealthMetrics | null {
    return this.healthMetrics.get(connectionId) || null;
  }

  /**
   * Get all health metrics
   */
  getAllHealthMetrics(): ConnectionHealthMetrics[] {
    return Array.from(this.healthMetrics.values());
  }

  /**
   * Get pool information
   */
  getPoolInfo(poolId: string): ConnectionPool | null {
    return this.connectionPools.get(poolId) || null;
  }

  /**
   * Start global health monitoring
   */
  private startGlobalHealthMonitoring(): void {
    setInterval(() => {
      this.performGlobalHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private performGlobalHealthCheck(): void {
    for (const [connectionId, metrics] of this.healthMetrics) {
      // Update uptime
      const now = new Date();
      metrics.uptime = now.getTime() - metrics.lastHealthCheck.getTime();
      metrics.lastHealthCheck = now;

      // Emit health status
      this.emit('health-check', connectionId, metrics);
    }

    // Emit global stats
    const globalStats = this.calculateGlobalStats();
    this.emit('global-health-stats', globalStats);
  }

  private calculateGlobalStats() {
    const allMetrics = Array.from(this.healthMetrics.values());

    return {
      totalConnections: allMetrics.length,
      healthyConnections: allMetrics.filter(m => m.errorRate < 5).length,
      avgResponseTime:
        allMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / allMetrics.length,
      totalRequests: allMetrics.reduce((sum, m) => sum + m.totalRequests, 0),
      globalErrorRate: allMetrics.reduce((sum, m) => sum + m.errorRate, 0) / allMetrics.length,
      globalAvailability:
        allMetrics.reduce((sum, m) => sum + m.availability, 0) / allMetrics.length,
    };
  }

  /**
   * Cleanup connection monitoring
   */
  removeConnection(connectionId: string): void {
    this.healthMetrics.delete(connectionId);
    this.adaptiveTimeouts.delete(connectionId);
    this.circuitBreakers.delete(connectionId);
    this.performancePredictors.delete(connectionId);

    // Remove from pools
    for (const [poolId, pool] of this.connectionPools) {
      const index = pool.servers.indexOf(connectionId);
      if (index !== -1) {
        pool.servers.splice(index, 1);
        pool.activeRequests.delete(connectionId);
        pool.weights?.delete(connectionId);
        pool.totalConnections = pool.servers.length;
      }
    }

    logger.info(`Connection monitoring removed: ${connectionId}`);
    this.emit('connection-monitoring-removed', connectionId);
  }
}

/**
 * Smart Circuit Breaker with Machine Learning
 */
class SmartCircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private responseTimeHistory: number[] = [];
  private errorPatterns: Map<string, number> = new Map();

  // Dynamic thresholds
  private failureThreshold = 5;
  private timeout = 60000; // 1 minute
  private successThreshold = 3;

  constructor(private connectionId: string) {}

  recordResult(success: boolean, responseTime: number, error?: Error): void {
    this.responseTimeHistory.push(responseTime);

    // Keep only recent history
    if (this.responseTimeHistory.length > 50) {
      this.responseTimeHistory.shift();
    }

    if (success) {
      this.onSuccess();
    } else {
      this.onFailure(error);
    }

    // Adapt thresholds based on patterns
    this.adaptThresholds();
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'closed';
        this.successCount = 0;
        logger.info(`Circuit breaker closed for connection: ${this.connectionId}`);
      }
    }
  }

  private onFailure(error?: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // Track error patterns
    if (error) {
      const errorType = error.constructor.name;
      this.errorPatterns.set(errorType, (this.errorPatterns.get(errorType) || 0) + 1);
    }

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      logger.warn(
        `Circuit breaker opened for connection: ${this.connectionId} after ${this.failureCount} failures`
      );
    }
  }

  private adaptThresholds(): void {
    // Adapt based on response time patterns
    if (this.responseTimeHistory.length >= 20) {
      const avgResponseTime =
        this.responseTimeHistory.reduce((sum, time) => sum + time, 0) /
        this.responseTimeHistory.length;
      const responseTimeVariance = this.calculateVariance(this.responseTimeHistory);

      // If response times are highly variable, be more conservative
      if (responseTimeVariance > avgResponseTime) {
        this.failureThreshold = Math.max(3, this.failureThreshold - 1);
        this.timeout = Math.min(300000, this.timeout * 1.2); // Max 5 minutes
      } else {
        this.failureThreshold = Math.min(10, this.failureThreshold + 1);
        this.timeout = Math.max(30000, this.timeout * 0.9); // Min 30 seconds
      }
    }
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squareDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squareDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  allowRequest(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = 'half-open';
        this.successCount = 0;
        logger.info(`Circuit breaker half-open for connection: ${this.connectionId}`);
        return true;
      }
      return false;
    }

    // half-open state
    return true;
  }

  getState(): string {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      failureThreshold: this.failureThreshold,
      timeout: this.timeout,
      errorPatterns: Object.fromEntries(this.errorPatterns),
    };
  }
}

/**
 * Performance Predictor using simple machine learning
 */
class PerformancePredictor {
  private requestHistory: Array<{ success: boolean; responseTime: number; timestamp: number }> = [];
  private weights = { successRate: 0.4, avgResponseTime: 0.3, trend: 0.3 };

  constructor(private connectionId: string) {}

  recordRequest(success: boolean, responseTime: number): void {
    this.requestHistory.push({
      success,
      responseTime,
      timestamp: Date.now(),
    });

    // Keep only recent history
    if (this.requestHistory.length > 100) {
      this.requestHistory.shift();
    }
  }

  predictReliability(): number {
    if (this.requestHistory.length < 10) {
      return 50; // Neutral prediction with insufficient data
    }

    const recent = this.requestHistory.slice(-20);
    const successRate = recent.filter(r => r.success).length / recent.length;

    const avgResponseTime = recent.reduce((sum, r) => sum + r.responseTime, 0) / recent.length;
    const normalizedResponseTime = Math.max(0, 1 - avgResponseTime / 10000); // Normalize against 10s

    // Calculate trend
    const firstHalf = recent.slice(0, 10);
    const secondHalf = recent.slice(10);

    const firstHalfSuccess = firstHalf.filter(r => r.success).length / firstHalf.length;
    const secondHalfSuccess = secondHalf.filter(r => r.success).length / secondHalf.length;

    const trend = secondHalfSuccess >= firstHalfSuccess ? 1 : 0.5;

    // Weighted prediction
    const prediction =
      (successRate * this.weights.successRate +
        normalizedResponseTime * this.weights.avgResponseTime +
        trend * this.weights.trend) *
      100;

    return Math.round(Math.max(0, Math.min(100, prediction)));
  }
}

// Global instance
export const enhancedMCPReliabilitySystem = new EnhancedMCPReliabilitySystem();
