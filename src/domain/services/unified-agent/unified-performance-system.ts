/**
 * Unified Performance System
 *
 * Centralized performance monitoring and optimization for agent operations:
 * - Execution time tracking
 * - Memory usage monitoring
 * - Resource utilization analysis
 * - Performance bottleneck detection
 * - Optimization recommendations
 */

import { performance } from 'perf_hooks';

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  cpuUsage?: number;
  networkLatency?: number;
  operationCount: number;
  timestamp: Date;
  agentId: string;
  operation: string;
}

export interface PerformanceThresholds {
  maxExecutionTime: number; // milliseconds
  maxMemoryUsage: number;   // bytes
  maxCpuUsage?: number;     // percentage
  maxNetworkLatency?: number; // milliseconds
}

export interface PerformanceAlert {
  type: 'warning' | 'critical';
  metric: keyof PerformanceMetrics;
  value: number;
  threshold: number;
  timestamp: Date;
  agentId: string;
  operation: string;
  suggestion?: string;
}

export interface OptimizationRecommendation {
  priority: 'low' | 'medium' | 'high';
  category: 'memory' | 'cpu' | 'network' | 'algorithm';
  description: string;
  estimatedImprovement: string;
  implementation: string;
}

export class UnifiedPerformanceSystem {
  private readonly metrics = new Map<string, PerformanceMetrics[]>();
  private readonly thresholds: PerformanceThresholds;
  private readonly alerts: PerformanceAlert[] = [];
  private readonly recommendations: OptimizationRecommendation[] = [];

  public constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = {
      maxExecutionTime: 30000,  // 30 seconds
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
      maxCpuUsage: 80,          // 80%
      maxNetworkLatency: 5000,  // 5 seconds
      ...thresholds,
    };
  }

  /**
   * Start performance monitoring for an operation
   */
  public startMonitoring(agentId: string, operation: string): string {
    const monitoringId = `${agentId}_${operation}_${Date.now()}`;
    const startTime = performance.now();
    const startMemory = this.getCurrentMemoryUsage();

    // Store initial state
    this.setMetricContext(monitoringId, {
      startTime,
      startMemory,
      agentId,
      operation,
    });

    return monitoringId;
  }

  /**
   * Stop monitoring and record final metrics
   */
  public stopMonitoring(monitoringId: string): PerformanceMetrics | null {
    const context = this.getMetricContext(monitoringId);
    if (!context) {
      return null;
    }

    const endTime = performance.now();
    const endMemory = this.getCurrentMemoryUsage();

    const metrics: PerformanceMetrics = {
      executionTime: endTime - context.startTime,
      memoryUsage: Math.max(0, endMemory - context.startMemory),
      operationCount: 1,
      timestamp: new Date(),
      agentId: context.agentId,
      operation: context.operation,
    };

    // Store metrics
    this.recordMetrics(metrics);

    // Check for threshold violations
    this.checkThresholds(metrics);

    // Clean up context
    this.clearMetricContext(monitoringId);

    return metrics;
  }

  /**
   * Record performance metrics directly
   */
  public recordMetrics(metrics: PerformanceMetrics): void {
    const key = `${metrics.agentId}_${metrics.operation}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const agentMetrics = this.metrics.get(key)!;
    agentMetrics.push(metrics);

    // Keep only last 100 entries per agent/operation
    if (agentMetrics.length > 100) {
      agentMetrics.splice(0, agentMetrics.length - 100);
    }
  }

  /**
   * Get performance statistics for an agent or operation
   */
  public getStatistics(agentId?: string, operation?: string): {
    average: PerformanceMetrics;
    min: PerformanceMetrics;
    max: PerformanceMetrics;
    total: number;
  } | null {
    let allMetrics: PerformanceMetrics[] = [];

    if (agentId && operation) {
      const key = `${agentId}_${operation}`;
      allMetrics = this.metrics.get(key) || [];
    } else if (agentId) {
      // Get all metrics for this agent
      for (const [key, metrics] of this.metrics) {
        if (key.startsWith(agentId)) {
          allMetrics.push(...metrics);
        }
      }
    } else {
      // Get all metrics
      for (const metrics of this.metrics.values()) {
        allMetrics.push(...metrics);
      }
    }

    if (allMetrics.length === 0) {
      return null;
    }

    // Calculate statistics
    const avgExecutionTime = allMetrics.reduce((sum, m) => sum + m.executionTime, 0) / allMetrics.length;
    const avgMemoryUsage = allMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / allMetrics.length;

    const minExecution = Math.min(...allMetrics.map(m => m.executionTime));
    const maxExecution = Math.max(...allMetrics.map(m => m.executionTime));
    const minMemory = Math.min(...allMetrics.map(m => m.memoryUsage));
    const maxMemory = Math.max(...allMetrics.map(m => m.memoryUsage));

    return {
      average: {
        executionTime: avgExecutionTime,
        memoryUsage: avgMemoryUsage,
        operationCount: allMetrics.length,
        timestamp: new Date(),
        agentId: agentId || 'all',
        operation: operation || 'all',
      },
      min: {
        executionTime: minExecution,
        memoryUsage: minMemory,
        operationCount: 1,
        timestamp: new Date(),
        agentId: agentId || 'all',
        operation: operation || 'all',
      },
      max: {
        executionTime: maxExecution,
        memoryUsage: maxMemory,
        operationCount: 1,
        timestamp: new Date(),
        agentId: agentId || 'all',
        operation: operation || 'all',
      },
      total: allMetrics.length,
    };
  }

  /**
   * Get recent performance alerts
   */
  public getAlerts(limit?: number): PerformanceAlert[] {
    return this.alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit || 50);
  }

  /**
   * Get optimization recommendations
   */
  public getRecommendations(): OptimizationRecommendation[] {
    return [...this.recommendations];
  }

  /**
   * Generate performance report
   */
  public generateReport(): {
    summary: {
      totalOperations: number;
      averageExecutionTime: number;
      totalMemoryUsed: number;
      alertCount: number;
    };
    topSlowOperations: Array<{ operation: string; agentId: string; executionTime: number }>;
    topMemoryConsumers: Array<{ operation: string; agentId: string; memoryUsage: number }>;
    recentAlerts: PerformanceAlert[];
    recommendations: OptimizationRecommendation[];
  } {
    const allMetrics: PerformanceMetrics[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }

    // Summary statistics
    const totalOperations = allMetrics.length;
    const averageExecutionTime = allMetrics.length > 0 
      ? allMetrics.reduce((sum, m) => sum + m.executionTime, 0) / allMetrics.length 
      : 0;
    const totalMemoryUsed = allMetrics.reduce((sum, m) => sum + m.memoryUsage, 0);

    // Top slow operations
    const topSlowOperations = allMetrics
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10)
      .map(m => ({
        operation: m.operation,
        agentId: m.agentId,
        executionTime: m.executionTime,
      }));

    // Top memory consumers
    const topMemoryConsumers = allMetrics
      .sort((a, b) => b.memoryUsage - a.memoryUsage)
      .slice(0, 10)
      .map(m => ({
        operation: m.operation,
        agentId: m.agentId,
        memoryUsage: m.memoryUsage,
      }));

    return {
      summary: {
        totalOperations,
        averageExecutionTime,
        totalMemoryUsed,
        alertCount: this.alerts.length,
      },
      topSlowOperations,
      topMemoryConsumers,
      recentAlerts: this.getAlerts(10),
      recommendations: this.recommendations,
    };
  }

  private checkThresholds(metrics: PerformanceMetrics): void {
    // Check execution time
    if (metrics.executionTime > this.thresholds.maxExecutionTime) {
      this.addAlert({
        type: metrics.executionTime > this.thresholds.maxExecutionTime * 2 ? 'critical' : 'warning',
        metric: 'executionTime',
        value: metrics.executionTime,
        threshold: this.thresholds.maxExecutionTime,
        timestamp: new Date(),
        agentId: metrics.agentId,
        operation: metrics.operation,
        suggestion: 'Consider optimizing algorithm or breaking operation into smaller chunks',
      });
    }

    // Check memory usage
    if (metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
      this.addAlert({
        type: metrics.memoryUsage > this.thresholds.maxMemoryUsage * 2 ? 'critical' : 'warning',
        metric: 'memoryUsage',
        value: metrics.memoryUsage,
        threshold: this.thresholds.maxMemoryUsage,
        timestamp: new Date(),
        agentId: metrics.agentId,
        operation: metrics.operation,
        suggestion: 'Consider implementing data streaming or pagination',
      });
    }
  }

  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);
    
    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts.splice(0, this.alerts.length - 1000);
    }

    // Generate recommendation based on alert
    this.generateRecommendation(alert);
  }

  private generateRecommendation(alert: PerformanceAlert): void {
    if (alert.metric === 'executionTime') {
      this.recommendations.push({
        priority: alert.type === 'critical' ? 'high' : 'medium',
        category: 'algorithm',
        description: `Operation ${alert.operation} is taking ${Math.round(alert.value)}ms, exceeding threshold of ${alert.threshold}ms`,
        estimatedImprovement: '30-50% execution time reduction',
        implementation: 'Optimize algorithm, implement caching, or use parallel processing',
      });
    } else if (alert.metric === 'memoryUsage') {
      this.recommendations.push({
        priority: alert.type === 'critical' ? 'high' : 'medium',
        category: 'memory',
        description: `Operation ${alert.operation} is using ${Math.round(alert.value / 1024 / 1024)}MB, exceeding threshold of ${Math.round(alert.threshold / 1024 / 1024)}MB`,
        estimatedImprovement: '40-60% memory usage reduction',
        implementation: 'Implement streaming, pagination, or data compression',
      });
    }
  }

  private getCurrentMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  private readonly contextStore = new Map<string, { 
    startTime: number; 
    startMemory: number; 
    agentId: string; 
    operation: string; 
  }>();

  private setMetricContext(id: string, context: { 
    startTime: number; 
    startMemory: number; 
    agentId: string; 
    operation: string; 
  }): void {
    this.contextStore.set(id, context);
  }

  private getMetricContext(id: string): { 
    startTime: number; 
    startMemory: number; 
    agentId: string; 
    operation: string; 
  } | undefined {
    return this.contextStore.get(id);
  }

  private clearMetricContext(id: string): void {
    this.contextStore.delete(id);
  }

  /**
   * Track resource usage for legacy compatibility
   */
  public trackResourceUsage(
    agentId: string,
    operation: string,
    resourceType: string,
    usage: number
  ): void {
    const metrics: PerformanceMetrics = {
      executionTime: 0,
      memoryUsage: resourceType === 'memory' ? usage : 0,
      operationCount: 1,
      timestamp: new Date(),
      agentId,
      operation,
    };

    this.recordMetrics(metrics);
  }

  /**
   * Clear all metrics and reset system
   */
  public reset(): void {
    this.metrics.clear();
    this.alerts.splice(0);
    this.recommendations.splice(0);
    this.contextStore.clear();
  }
}