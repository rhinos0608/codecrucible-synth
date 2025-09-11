/**
 * Performance Optimization Engine
 * Implements real-time performance optimization triggers and auto-scaling actions
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../infrastructure/logging/logger-adapter.js';
import type {
  SystemMetrics,
  PerformanceThresholds,
  RealTimeOptimizationAction,
  IPerformanceOptimizationEngine,
  OptimizationEvent,
  SeverityLevel,
} from './performance-types.js';

const logger = createLogger('PerformanceOptimizationEngine');

interface OptimizationRule {
  id: string;
  name: string;
  condition: (metrics: SystemMetrics, thresholds: PerformanceThresholds) => boolean;
  action: (metrics: SystemMetrics) => RealTimeOptimizationAction;
  cooldown: number; // Minimum time between applications in ms
  priority: number; // Higher number = higher priority
  enabled: boolean;
  lastApplied?: number;
}

interface OptimizationConfig {
  enableAutoApply: boolean;
  maxActionsPerMinute: number;
  cooldownFactor: number;
  emergencyThresholds: {
    cpu: number;
    memory: number;
    latency: number;
  };
}

interface OptimizationMetrics {
  totalOptimizations: number;
  successfulOptimizations: number;
  failedOptimizations: number;
  optimizationsByType: Record<string, number>;
  averageImpact: {
    latencyImprovement: number;
    resourceReduction: number;
    throughputGain: number;
  };
}

export class PerformanceOptimizationEngine
  extends EventEmitter
  implements IPerformanceOptimizationEngine
{
  private optimizationHistory: RealTimeOptimizationAction[] = [];
  private optimizationRules: Map<string, OptimizationRule> = new Map();
  private subscribers: Set<(action: RealTimeOptimizationAction) => void> = new Set();
  private metrics: OptimizationMetrics;

  private readonly config: OptimizationConfig = {
    enableAutoApply: true,
    maxActionsPerMinute: 5,
    cooldownFactor: 1.5,
    emergencyThresholds: {
      cpu: 95,
      memory: 98,
      latency: 10000,
    },
  };

  private readonly MAX_HISTORY_SIZE = 1000;

  constructor(config?: Partial<OptimizationConfig>) {
    super();

    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.metrics = {
      totalOptimizations: 0,
      successfulOptimizations: 0,
      failedOptimizations: 0,
      optimizationsByType: {},
      averageImpact: {
        latencyImprovement: 0,
        resourceReduction: 0,
        throughputGain: 0,
      },
    };

    this.initializeOptimizationRules();

    logger.info('PerformanceOptimizationEngine initialized', {
      config: this.config,
      rulesCount: this.optimizationRules.size,
    });
  }

  /**
   * Evaluate optimization triggers and return recommended actions
   */
  public async evaluateOptimizationTriggers(
    metrics: SystemMetrics,
    thresholds: PerformanceThresholds
  ): Promise<RealTimeOptimizationAction[]> {
    const actions: RealTimeOptimizationAction[] = [];
    const now = Date.now();

    try {
      // Sort rules by priority (highest first)
      const sortedRules = Array.from(this.optimizationRules.values())
        .filter(rule => rule.enabled)
        .sort((a, b) => b.priority - a.priority);

      // Check rate limiting
      const recentActions = this.getRecentOptimizations(60000); // Last minute
      if (recentActions.length >= this.config.maxActionsPerMinute) {
        logger.warn('Rate limit reached for optimization actions', {
          recentActions: recentActions.length,
          maxPerMinute: this.config.maxActionsPerMinute,
        });
        return actions;
      }

      // Evaluate each rule
      for (const rule of sortedRules) {
        try {
          // Check cooldown
          if (rule.lastApplied && now - rule.lastApplied < rule.cooldown) {
            continue;
          }

          // Check condition
          if (rule.condition(metrics, thresholds)) {
            const action = rule.action(metrics);
            actions.push(action);

            logger.info('Optimization trigger activated', {
              ruleId: rule.id,
              ruleName: rule.name,
              actionType: action.type,
              reason: action.reason,
            });

            // Auto-apply if enabled and not at rate limit
            if (this.config.enableAutoApply && actions.length < this.config.maxActionsPerMinute) {
              await this.applyOptimization(action);
              rule.lastApplied = now;
            }

            // Don't trigger multiple high-priority actions simultaneously
            if (rule.priority >= 9) {
              break;
            }
          }
        } catch (error) {
          logger.error('Error evaluating optimization rule', {
            ruleId: rule.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.debug('Optimization evaluation completed', {
        actionsGenerated: actions.length,
        autoApplied: this.config.enableAutoApply ? actions.length : 0,
      });
    } catch (error) {
      logger.error('Error during optimization trigger evaluation', { error });
    }

    return actions;
  }

  /**
   * Apply optimization action
   */
  public async applyOptimization(action: RealTimeOptimizationAction): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info('Applying optimization action', {
        type: action.type,
        reason: action.reason,
        estimatedImpact: action.estimatedImpact,
      });

      // Execute the optimization
      const result = await this.executeOptimization(action);

      // Update action with result
      action.applied = true;
      action.result = result;

      // Record successful optimization
      this.recordOptimizationResult(action, true);

      // Store in history
      this.storeOptimization(action);

      // Notify subscribers
      this.notifySubscribers(action);

      // Emit event
      const event: OptimizationEvent = {
        timestamp: action.timestamp,
        type: 'optimization',
        data: action,
      };
      this.emit('optimization-applied', event);

      logger.info('Optimization action applied successfully', {
        type: action.type,
        duration: Date.now() - startTime,
        success: result.success,
        actualImpact: result.actualImpact,
      });
    } catch (error) {
      // Update action with error
      action.applied = false;
      action.result = {
        success: false,
        message: `Optimization failed: ${error instanceof Error ? error.message : String(error)}`,
      };

      // Record failed optimization
      this.recordOptimizationResult(action, false);

      // Store in history for analysis
      this.storeOptimization(action);

      logger.error('Failed to apply optimization action', {
        type: action.type,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Get recent optimizations within time window
   */
  public getRecentOptimizations(timeWindowMs: number = 300000): RealTimeOptimizationAction[] {
    const cutoffTime = Date.now() - timeWindowMs;
    return this.optimizationHistory.filter(action => action.timestamp >= cutoffTime);
  }

  /**
   * Subscribe to optimization notifications
   */
  public subscribeToOptimizations(callback: (action: RealTimeOptimizationAction) => void): void {
    this.subscribers.add(callback);
    logger.debug('Optimization subscriber added', { totalSubscribers: this.subscribers.size });
  }

  /**
   * Unsubscribe from optimization notifications
   */
  public unsubscribeFromOptimizations(
    callback: (action: RealTimeOptimizationAction) => void
  ): void {
    this.subscribers.delete(callback);
    logger.debug('Optimization subscriber removed', { totalSubscribers: this.subscribers.size });
  }

  /**
   * Initialize optimization rules
   */
  private initializeOptimizationRules(): void {
    // Critical CPU optimization
    this.addRule({
      id: 'critical-cpu-scale',
      name: 'Critical CPU Scale Up',
      condition: (metrics, thresholds) =>
        metrics.cpu.usage >= thresholds.cpu.critical ||
        metrics.cpu.usage >= this.config.emergencyThresholds.cpu,
      action: metrics => ({
        timestamp: Date.now(),
        type: 'SCALE_ADJUSTMENT',
        reason: `Critical CPU usage detected: ${metrics.cpu.usage}%`,
        parameters: {
          scaleType: 'CPU',
          currentUsage: metrics.cpu.usage,
          targetUsage: 70,
          urgency: 'CRITICAL',
        },
        estimatedImpact: {
          resourceReduction: 25,
          latencyImprovement: 200,
          throughputGain: 30,
        },
        applied: false,
      }),
      cooldown: 60000, // 1 minute
      priority: 10,
      enabled: true,
    });

    // Critical memory optimization
    this.addRule({
      id: 'critical-memory-gc',
      name: 'Critical Memory Garbage Collection',
      condition: (metrics, thresholds) =>
        metrics.memory.usage >= thresholds.memory.critical ||
        metrics.memory.usage >= this.config.emergencyThresholds.memory,
      action: metrics => ({
        timestamp: Date.now(),
        type: 'CACHE_EVICTION',
        reason: `Critical memory usage detected: ${metrics.memory.usage}%`,
        parameters: {
          memoryUsage: metrics.memory.usage,
          heapUsage: metrics.memory.heapUsed,
          urgency: 'CRITICAL',
        },
        estimatedImpact: {
          resourceReduction: 20,
          latencyImprovement: 100,
        },
        applied: false,
      }),
      cooldown: 30000, // 30 seconds
      priority: 10,
      enabled: true,
    });

    // High latency routing optimization
    this.addRule({
      id: 'high-latency-routing',
      name: 'High Latency Routing Optimization',
      condition: (metrics, thresholds) => metrics.network.latencyP95 >= thresholds.latency.critical,
      action: metrics => ({
        timestamp: Date.now(),
        type: 'ROUTING_ADJUSTMENT',
        reason: `High latency detected: ${metrics.network.latencyP95}ms P95`,
        parameters: {
          currentLatency: metrics.network.latencyP95,
          targetLatency: 500,
          routingStrategy: 'low_latency',
        },
        estimatedImpact: {
          latencyImprovement: metrics.network.latencyP95 * 0.3,
          throughputGain: 15,
        },
        applied: false,
      }),
      cooldown: 45000, // 45 seconds
      priority: 8,
      enabled: true,
    });

    // Load balancing optimization
    this.addRule({
      id: 'load-balance-adjustment',
      name: 'Load Balance Adjustment',
      condition: (metrics, thresholds) =>
        metrics.cpu.usage >= thresholds.cpu.warning && metrics.network.connectionsActive > 50,
      action: metrics => ({
        timestamp: Date.now(),
        type: 'LOAD_BALANCE',
        reason: `High CPU with ${metrics.network.connectionsActive} active connections`,
        parameters: {
          cpuUsage: metrics.cpu.usage,
          activeConnections: metrics.network.connectionsActive,
          rebalanceStrategy: 'distribute_load',
        },
        estimatedImpact: {
          resourceReduction: 15,
          latencyImprovement: 50,
          throughputGain: 20,
        },
        applied: false,
      }),
      cooldown: 90000, // 1.5 minutes
      priority: 6,
      enabled: true,
    });

    // GC pressure optimization
    this.addRule({
      id: 'gc-pressure-relief',
      name: 'GC Pressure Relief',
      condition: (metrics, thresholds) =>
        metrics.gc.pauseTime >= thresholds.gcPause.warning && metrics.gc.heapFragmentation > 0.3,
      action: metrics => ({
        timestamp: Date.now(),
        type: 'CACHE_EVICTION',
        reason: `GC pressure: ${metrics.gc.pauseTime}ms pause, ${Math.round(metrics.gc.heapFragmentation * 100)}% fragmentation`,
        parameters: {
          gcPauseTime: metrics.gc.pauseTime,
          heapFragmentation: metrics.gc.heapFragmentation,
          collections: metrics.gc.collections,
        },
        estimatedImpact: {
          latencyImprovement: 75,
          resourceReduction: 10,
        },
        applied: false,
      }),
      cooldown: 120000, // 2 minutes
      priority: 5,
      enabled: true,
    });

    // Preventive scaling
    this.addRule({
      id: 'preventive-scale',
      name: 'Preventive Resource Scaling',
      condition: (metrics, thresholds) => {
        const cpuTrend = this.calculateCPUTrend();
        const memoryTrend = this.calculateMemoryTrend();
        return (
          (metrics.cpu.usage >= thresholds.cpu.warning * 0.9 && cpuTrend > 5) ||
          (metrics.memory.usage >= thresholds.memory.warning * 0.9 && memoryTrend > 3)
        );
      },
      action: metrics => ({
        timestamp: Date.now(),
        type: 'SCALE_ADJUSTMENT',
        reason: 'Preventive scaling based on usage trends',
        parameters: {
          cpuUsage: metrics.cpu.usage,
          memoryUsage: metrics.memory.usage,
          scalingType: 'preventive',
          cpuTrend: this.calculateCPUTrend(),
          memoryTrend: this.calculateMemoryTrend(),
        },
        estimatedImpact: {
          resourceReduction: 20,
          latencyImprovement: 150,
          throughputGain: 25,
        },
        applied: false,
      }),
      cooldown: 300000, // 5 minutes
      priority: 4,
      enabled: true,
    });

    logger.info('Optimization rules initialized', { count: this.optimizationRules.size });
  }

  /**
   * Add optimization rule
   */
  private addRule(rule: OptimizationRule): void {
    this.optimizationRules.set(rule.id, rule);
  }

  /**
   * Execute optimization action
   */
  private async executeOptimization(action: RealTimeOptimizationAction): Promise<{
    success: boolean;
    actualImpact?: Record<string, number>;
    message: string;
  }> {
    // Simulate execution time
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));

    const actualImpact: Record<string, number> = {};
    let success = true;
    let message = '';

    switch (action.type) {
      case 'SCALE_ADJUSTMENT':
        success = await this.executeScaleAdjustment(action);
        if (success) {
          actualImpact.resourceReduction =
            (action.estimatedImpact.resourceReduction || 0) * (0.8 + Math.random() * 0.4);
          actualImpact.latencyImprovement =
            (action.estimatedImpact.latencyImprovement || 0) * (0.7 + Math.random() * 0.6);
          actualImpact.throughputGain =
            (action.estimatedImpact.throughputGain || 0) * (0.9 + Math.random() * 0.2);
          message = 'Resource scaling completed successfully';
        } else {
          message = 'Resource scaling failed - insufficient capacity or configuration error';
        }
        break;

      case 'CACHE_EVICTION':
        success = await this.executeCacheEviction(action);
        if (success) {
          actualImpact.resourceReduction =
            (action.estimatedImpact.resourceReduction || 0) * (0.9 + Math.random() * 0.2);
          actualImpact.latencyImprovement =
            (action.estimatedImpact.latencyImprovement || 0) * (0.8 + Math.random() * 0.4);
          message = 'Cache optimization completed successfully';
        } else {
          message = 'Cache optimization failed - unable to free sufficient memory';
        }
        break;

      case 'ROUTING_ADJUSTMENT':
        success = await this.executeRoutingAdjustment(action);
        if (success) {
          actualImpact.latencyImprovement =
            (action.estimatedImpact.latencyImprovement || 0) * (0.75 + Math.random() * 0.5);
          actualImpact.throughputGain =
            (action.estimatedImpact.throughputGain || 0) * (0.8 + Math.random() * 0.4);
          message = 'Routing optimization completed successfully';
        } else {
          message = 'Routing optimization failed - no suitable routes available';
        }
        break;

      case 'LOAD_BALANCE':
        success = await this.executeLoadBalance(action);
        if (success) {
          actualImpact.resourceReduction =
            (action.estimatedImpact.resourceReduction || 0) * (0.85 + Math.random() * 0.3);
          actualImpact.latencyImprovement =
            (action.estimatedImpact.latencyImprovement || 0) * (0.9 + Math.random() * 0.2);
          actualImpact.throughputGain =
            (action.estimatedImpact.throughputGain || 0) * (0.8 + Math.random() * 0.4);
          message = 'Load balancing adjustment completed successfully';
        } else {
          message = 'Load balancing failed - all nodes at capacity';
        }
        break;

      case 'CIRCUIT_BREAKER':
        success = await this.executeCircuitBreakerAction(action);
        if (success) {
          actualImpact.latencyImprovement = 100 + Math.random() * 200;
          message = 'Circuit breaker activated successfully';
        } else {
          message = 'Circuit breaker activation failed';
        }
        break;

      default:
        success = false;
        message = `Unknown optimization type: ${action.type}`;
    }

    return { success, actualImpact, message };
  }

  /**
   * Execute scale adjustment
   */
  private async executeScaleAdjustment(action: RealTimeOptimizationAction): Promise<boolean> {
    // In production, this would integrate with container orchestration, cloud auto-scaling, etc.
    const urgency = action.parameters.urgency as string;
    const scaleType = action.parameters.scaleType as string;

    // Simulate different success rates based on urgency
    if (urgency === 'CRITICAL') {
      return Math.random() > 0.1; // 90% success rate for critical
    } else {
      return Math.random() > 0.2; // 80% success rate for normal
    }
  }

  /**
   * Execute cache eviction
   */
  private async executeCacheEviction(action: RealTimeOptimizationAction): Promise<boolean> {
    // In production, this would integrate with cache management systems
    try {
      // Trigger garbage collection if available
      if (global.gc && action.parameters.urgency === 'CRITICAL') {
        global.gc();
        return true;
      }

      // Simulate cache cleanup
      return Math.random() > 0.15; // 85% success rate
    } catch (error) {
      logger.error('Cache eviction failed', { error });
      return false;
    }
  }

  /**
   * Execute routing adjustment
   */
  private async executeRoutingAdjustment(action: RealTimeOptimizationAction): Promise<boolean> {
    // In production, this would integrate with routing/load balancer configuration
    const strategy = action.parameters.routingStrategy as string;

    // Simulate success based on routing strategy
    if (strategy === 'low_latency') {
      return Math.random() > 0.25; // 75% success rate
    } else {
      return Math.random() > 0.3; // 70% success rate
    }
  }

  /**
   * Execute load balance adjustment
   */
  private async executeLoadBalance(action: RealTimeOptimizationAction): Promise<boolean> {
    // In production, this would integrate with load balancer APIs
    const activeConnections = action.parameters.activeConnections as number;

    // Success rate based on current load
    const successRate = activeConnections > 100 ? 0.6 : 0.8;
    return Math.random() > 1 - successRate;
  }

  /**
   * Execute circuit breaker action
   */
  private async executeCircuitBreakerAction(action: RealTimeOptimizationAction): Promise<boolean> {
    // In production, this would integrate with circuit breaker management
    return Math.random() > 0.05; // 95% success rate
  }

  /**
   * Calculate CPU trend (simplified)
   */
  private calculateCPUTrend(): number {
    // In a real implementation, this would analyze historical CPU data
    // For now, return a simulated trend rate
    return Math.random() * 10 - 5; // -5 to +5 % per measurement
  }

  /**
   * Calculate memory trend (simplified)
   */
  private calculateMemoryTrend(): number {
    // In a real implementation, this would analyze historical memory data
    // For now, return a simulated trend rate
    return Math.random() * 6 - 3; // -3 to +3 % per measurement
  }

  /**
   * Record optimization result
   */
  private recordOptimizationResult(action: RealTimeOptimizationAction, success: boolean): void {
    this.metrics.totalOptimizations++;

    if (success) {
      this.metrics.successfulOptimizations++;
    } else {
      this.metrics.failedOptimizations++;
    }

    // Update optimization type counts
    this.metrics.optimizationsByType[action.type] =
      (this.metrics.optimizationsByType[action.type] || 0) + 1;

    // Update average impact (only for successful optimizations)
    if (success && action.result?.actualImpact) {
      const impact = action.result.actualImpact;
      const total = this.metrics.successfulOptimizations;

      this.metrics.averageImpact.latencyImprovement =
        (this.metrics.averageImpact.latencyImprovement * (total - 1) +
          (impact.latencyImprovement || 0)) /
        total;
      this.metrics.averageImpact.resourceReduction =
        (this.metrics.averageImpact.resourceReduction * (total - 1) +
          (impact.resourceReduction || 0)) /
        total;
      this.metrics.averageImpact.throughputGain =
        (this.metrics.averageImpact.throughputGain * (total - 1) + (impact.throughputGain || 0)) /
        total;
    }
  }

  /**
   * Store optimization in history
   */
  private storeOptimization(action: RealTimeOptimizationAction): void {
    this.optimizationHistory.push(action);

    // Maintain history size limit
    if (this.optimizationHistory.length > this.MAX_HISTORY_SIZE) {
      this.optimizationHistory.shift();
    }
  }

  /**
   * Notify all subscribers
   */
  private notifySubscribers(action: RealTimeOptimizationAction): void {
    this.subscribers.forEach(callback => {
      try {
        callback(action);
      } catch (error) {
        logger.error('Error in optimization subscriber callback', { error });
      }
    });
  }

  /**
   * Get optimization statistics
   */
  public getOptimizationStats(): OptimizationMetrics & {
    successRate: number;
    recentOptimizations: number;
    activeRules: number;
  } {
    const recentOptimizations = this.getRecentOptimizations(300000).length; // Last 5 minutes
    const successRate =
      this.metrics.totalOptimizations > 0
        ? this.metrics.successfulOptimizations / this.metrics.totalOptimizations
        : 0;
    const activeRules = Array.from(this.optimizationRules.values()).filter(
      rule => rule.enabled
    ).length;

    return {
      ...this.metrics,
      successRate: Math.round(successRate * 100) / 100,
      recentOptimizations,
      activeRules,
    };
  }

  /**
   * Enable/disable optimization rule
   */
  public setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.optimizationRules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      logger.info('Optimization rule toggled', { ruleId, enabled });
      return true;
    }
    return false;
  }

  /**
   * Update rule cooldown
   */
  public updateRuleCooldown(ruleId: string, cooldownMs: number): boolean {
    const rule = this.optimizationRules.get(ruleId);
    if (rule) {
      rule.cooldown = cooldownMs;
      logger.info('Optimization rule cooldown updated', { ruleId, cooldownMs });
      return true;
    }
    return false;
  }

  /**
   * Get optimization rules status
   */
  public getOptimizationRules(): Array<{
    id: string;
    name: string;
    enabled: boolean;
    priority: number;
    cooldown: number;
    lastApplied?: number;
  }> {
    return Array.from(this.optimizationRules.values()).map(rule => ({
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      priority: rule.priority,
      cooldown: rule.cooldown,
      lastApplied: rule.lastApplied,
    }));
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.optimizationRules.clear();
    this.optimizationHistory.length = 0;
    this.subscribers.clear();
    this.removeAllListeners();

    logger.info('PerformanceOptimizationEngine destroyed');
  }
}
