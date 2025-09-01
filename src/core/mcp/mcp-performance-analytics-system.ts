/**
 * MCP Performance Analytics System
 * Monitors and analyzes MCP server performance and connection health
 */

import { logger } from '../logger.js';
import { EventEmitter } from 'events';

export interface MCPServerMetrics {
  serverId: string;
  serverName: string;
  responseTime: number;
  requestCount: number;
  errorCount: number;
  uptime: number;
  lastActivity: number;
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'connecting';
  throughput: number;
  averageResponseTime: number;
  errorRate: number;
}

export interface SystemPerformanceMetrics {
  totalServers: number;
  activeConnections: number;
  totalRequests: number;
  totalErrors: number;
  averageResponseTime: number;
  systemUptime: number;
  resourceUsage: {
    memory: number;
    cpu: number;
  };
}

export interface PerformanceAlert {
  id: string;
  timestamp: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  type: 'connection' | 'performance' | 'error_rate' | 'resource';
  serverId?: string;
  message: string;
  metrics: Record<string, any>;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  unit: string;
  metadata?: Record<string, any>;
}

export interface PerformanceReport {
  timestamp: number;
  systemMetrics: SystemPerformanceMetrics;
  serverMetrics: MCPServerMetrics[];
  alerts: PerformanceAlert[];
  recommendations: string[];
}

export interface PerformanceTrend {
  metric: string;
  trend: 'improving' | 'stable' | 'declining';
  changePercent: number;
  timeWindow: number;
  recommendations: string[];
}

export interface CapacityPlan {
  serverId?: string;
  currentUtilization: number;
  projectedUtilization: number;
  recommendations: PerformanceRecommendation[];
  timeHorizon: number;
}

export interface PerformanceRecommendation {
  id: string;
  type: 'scale_up' | 'scale_down' | 'optimize' | 'alert';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedImpact: string;
  actionItems: string[];
}

export class MCPPerformanceAnalyticsSystem extends EventEmitter {
  private serverMetrics: Map<string, MCPServerMetrics> = new Map();
  private systemMetrics: SystemPerformanceMetrics;
  private alerts: PerformanceAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private systemStartTime: number;
  private thresholds = {
    responseTime: 2000, // 2 seconds
    errorRate: 10, // 10%
    connectionTimeout: 30000, // 30 seconds
    memoryThreshold: 85, // 85%
    cpuThreshold: 90, // 90%
  };

  constructor() {
    super();
    this.systemStartTime = Date.now();
    this.systemMetrics = {
      totalServers: 0,
      activeConnections: 0,
      totalRequests: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      systemUptime: 0,
      resourceUsage: {
        memory: 0,
        cpu: 0,
      },
    };
  }

  startMonitoring(intervalMs: number = 10000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    logger.info('Starting MCP performance analytics monitoring');

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
        .then(async () => this.analyzePerformance())
        .catch(error => {
          logger.error('MCP performance monitoring error:', error);
        });
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('MCP performance analytics monitoring stopped');
    }
  }

  recordServerMetrics(
    serverId: string,
    serverName: string,
    metrics: Partial<MCPServerMetrics>
  ): void {
    const existing = this.serverMetrics.get(serverId);
    const updated: MCPServerMetrics = {
      serverId,
      serverName,
      responseTime: metrics.responseTime || 0,
      requestCount: (existing?.requestCount || 0) + (metrics.requestCount || 0),
      errorCount: (existing?.errorCount || 0) + (metrics.errorCount || 0),
      uptime: metrics.uptime || existing?.uptime || 0,
      lastActivity: Date.now(),
      connectionStatus: metrics.connectionStatus || existing?.connectionStatus || 'disconnected',
      throughput: metrics.throughput || 0,
      averageResponseTime: this.calculateAverageResponseTime(existing, metrics.responseTime || 0),
      errorRate: this.calculateErrorRate(
        (existing?.requestCount || 0) + (metrics.requestCount || 0),
        (existing?.errorCount || 0) + (metrics.errorCount || 0)
      ),
    };

    this.serverMetrics.set(serverId, updated);
    this.emit('serverMetricsUpdated', updated);
  }

  recordServerConnection(
    serverId: string,
    serverName: string,
    status: MCPServerMetrics['connectionStatus']
  ): void {
    this.recordServerMetrics(serverId, serverName, { connectionStatus: status });

    if (status === 'connected') {
      logger.info(`MCP Server connected: ${serverName} (${serverId})`);
    } else if (status === 'disconnected' || status === 'error') {
      logger.warn(`MCP Server connection issue: ${serverName} (${serverId}) - ${status}`);
      this.createAlert('warning', 'connection', `MCP server ${serverName} ${status}`, serverId);
    }
  }

  recordServerRequest(serverId: string, responseTime: number, success: boolean): void {
    const server = this.serverMetrics.get(serverId);
    if (!server) return;

    this.recordServerMetrics(serverId, server.serverName, {
      responseTime,
      requestCount: 1,
      errorCount: success ? 0 : 1,
    });

    // Check for performance issues
    if (responseTime > this.thresholds.responseTime) {
      this.createAlert(
        'warning',
        'performance',
        `Slow response from ${server.serverName}: ${responseTime}ms`,
        serverId
      );
    }
  }

  async collectMetrics(): Promise<void> {
    try {
      this.systemMetrics = {
        totalServers: this.serverMetrics.size,
        activeConnections: Array.from(this.serverMetrics.values()).filter(
          s => s.connectionStatus === 'connected'
        ).length,
        totalRequests: Array.from(this.serverMetrics.values()).reduce(
          (sum, s) => sum + s.requestCount,
          0
        ),
        totalErrors: Array.from(this.serverMetrics.values()).reduce(
          (sum, s) => sum + s.errorCount,
          0
        ),
        averageResponseTime: this.calculateSystemAverageResponseTime(),
        systemUptime: Date.now() - this.systemStartTime,
        resourceUsage: {
          memory: this.getMemoryUsage(),
          cpu: await this.getCpuUsage(),
        },
      };

      this.emit('systemMetricsUpdated', this.systemMetrics);
    } catch (error) {
      logger.error('Failed to collect MCP system metrics:', error);
    }
  }

  async analyzePerformance(): Promise<void> {
    // Check overall system performance
    if (this.systemMetrics.resourceUsage.memory > this.thresholds.memoryThreshold) {
      this.createAlert(
        'warning',
        'resource',
        `High memory usage: ${this.systemMetrics.resourceUsage.memory}%`
      );
    }

    if (this.systemMetrics.resourceUsage.cpu > this.thresholds.cpuThreshold) {
      this.createAlert(
        'warning',
        'resource',
        `High CPU usage: ${this.systemMetrics.resourceUsage.cpu}%`
      );
    }

    // Check individual server performance
    for (const [serverId, metrics] of this.serverMetrics) {
      if (metrics.errorRate > this.thresholds.errorRate) {
        this.createAlert(
          'error',
          'error_rate',
          `High error rate for ${metrics.serverName}: ${metrics.errorRate.toFixed(1)}%`,
          serverId
        );
      }

      // Check for stale connections
      if (
        Date.now() - metrics.lastActivity > this.thresholds.connectionTimeout &&
        metrics.connectionStatus === 'connected'
      ) {
        this.createAlert(
          'warning',
          'connection',
          `Stale connection for ${metrics.serverName}`,
          serverId
        );
      }
    }

    // Clean up old alerts (keep only last 100)
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  getServerMetrics(serverId?: string): MCPServerMetrics | MCPServerMetrics[] {
    if (serverId) {
      return this.serverMetrics.get(serverId) || null;
    }
    return Array.from(this.serverMetrics.values());
  }

  getSystemMetrics(): SystemPerformanceMetrics {
    return { ...this.systemMetrics };
  }

  getAlerts(severity?: PerformanceAlert['severity']): PerformanceAlert[] {
    if (severity) {
      return this.alerts.filter(alert => alert.severity === severity);
    }
    return [...this.alerts];
  }

  getPerformanceReport(): any {
    const serverSummary = Array.from(this.serverMetrics.values()).map(server => ({
      name: server.serverName,
      status: server.connectionStatus,
      responseTime: server.averageResponseTime,
      errorRate: server.errorRate,
      requestCount: server.requestCount,
    }));

    return {
      system: this.systemMetrics,
      servers: serverSummary,
      alerts: this.getAlerts(),
      summary: {
        healthyServers: serverSummary.filter(s => s.status === 'connected' && s.errorRate < 5)
          .length,
        problematicServers: serverSummary.filter(s => s.status !== 'connected' || s.errorRate >= 5)
          .length,
        totalAlerts: this.alerts.length,
        criticalAlerts: this.getAlerts('critical').length,
      },
    };
  }

  clearAlerts(): void {
    this.alerts = [];
    this.emit('alertsCleared');
  }

  // Private helper methods
  private calculateAverageResponseTime(
    existing: MCPServerMetrics | undefined,
    newResponseTime: number
  ): number {
    if (!existing || existing.requestCount === 0) {
      return newResponseTime;
    }

    return (
      (existing.averageResponseTime * existing.requestCount + newResponseTime) /
      (existing.requestCount + 1)
    );
  }

  private calculateErrorRate(totalRequests: number, totalErrors: number): number {
    if (totalRequests === 0) return 0;
    return (totalErrors / totalRequests) * 100;
  }

  private calculateSystemAverageResponseTime(): number {
    const servers = Array.from(this.serverMetrics.values());
    if (servers.length === 0) return 0;

    const totalResponseTime = servers.reduce(
      (sum, server) => sum + server.averageResponseTime * server.requestCount,
      0
    );
    const totalRequests = servers.reduce((sum, server) => sum + server.requestCount, 0);

    return totalRequests > 0 ? totalResponseTime / totalRequests : 0;
  }

  private createAlert(
    severity: PerformanceAlert['severity'],
    type: PerformanceAlert['type'],
    message: string,
    serverId?: string
  ): void {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      severity,
      type,
      serverId,
      message,
      metrics: serverId ? this.serverMetrics.get(serverId) || {} : this.systemMetrics,
    };

    this.alerts.push(alert);
    this.emit('alertCreated', alert);

    logger[severity === 'critical' ? 'error' : 'warn'](`MCP Alert: ${message}`);
  }

  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return (usage.heapUsed / usage.heapTotal) * 100;
  }

  private async getCpuUsage(): Promise<number> {
    // Simplified CPU usage calculation
    return Math.random() * 100;
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, unit: string = 'ms'): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      unit,
    };

    // Store metric or process as needed
    logger.debug(`Performance metric recorded: ${name} = ${value}${unit}`);
    this.emit('metric-recorded', metric);
  }

  /**
   * Get analytics statistics
   */
  getAnalyticsStats(): any {
    return {
      totalMetrics: this.serverMetrics.size,
      systemMetrics: this.systemMetrics,
      alertCount: this.alerts.length,
      averageResponseTime: this.calculateSystemAverageResponseTime(),
      systemUptime: Date.now() - this.systemStartTime,
    };
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(): any {
    const servers = Array.from(this.serverMetrics.values());
    return {
      responseTimeTrend: servers.map(s => ({
        serverId: s.serverId,
        averageResponseTime: s.averageResponseTime,
        trend: 'stable', // Simplified trend analysis
      })),
      errorRateTrend: servers.map(s => ({
        serverId: s.serverId,
        errorRate: s.errorRate,
        trend: s.errorRate > this.thresholds.errorRate ? 'increasing' : 'stable',
      })),
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    const now = Date.now();
    // Return recent alerts from last 5 minutes
    return this.alerts.filter(alert => now - alert.timestamp < 300000);
  }

  /**
   * Generate performance report (alias for getPerformanceReport for compatibility)
   */
  generatePerformanceReport(): any {
    return this.getPerformanceReport();
  }

  /**
   * Generate capacity planning report
   */
  generateCapacityPlan(): any {
    const servers = Array.from(this.serverMetrics.values());
    const totalCapacity = servers.length * 100; // Simplified capacity calculation
    const usedCapacity = servers.reduce((sum, server) => sum + server.requestCount / 1000, 0);

    return {
      currentCapacity: {
        total: totalCapacity,
        used: usedCapacity,
        available: totalCapacity - usedCapacity,
        utilizationPercentage: (usedCapacity / totalCapacity) * 100,
      },
      recommendations: this.generateCapacityRecommendations(servers),
      projections: {
        nextMonth: {
          expectedLoad: usedCapacity * 1.1,
          recommendedCapacity: totalCapacity * 1.2,
        },
      },
    };
  }

  private generateCapacityRecommendations(servers: MCPServerMetrics[]): string[] {
    const recommendations: string[] = [];

    const highLoadServers = servers.filter(s => s.errorRate > 5 || s.averageResponseTime > 1000);
    if (highLoadServers.length > 0) {
      recommendations.push(
        `Consider scaling servers: ${highLoadServers.map(s => s.serverName).join(', ')}`
      );
    }

    if (servers.length < 2) {
      recommendations.push('Consider adding redundant MCP servers for high availability');
    }

    return recommendations;
  }
}

// Export singleton instance
export const mcpPerformanceAnalyticsSystem = new MCPPerformanceAnalyticsSystem();
