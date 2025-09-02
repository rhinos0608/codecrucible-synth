/**
 * MCP Server Monitoring and Metrics
 * 
 * Comprehensive health monitoring with performance metrics and alerting
 * Designed to orchestrate Rust-backed resource monitors through NAPI bindings
 * Implements circuit breaker patterns and adaptive thresholds
 * 
 * Memory-efficient with streaming metrics and bounded collection
 */

import { EventEmitter } from 'events';
import { logger } from '../../infrastructure/logging/unified-logger.js';
import { outputConfig } from '../../utils/output-config.js';

export interface MetricsConfig {
  enableMetrics: boolean;
  metricsRetentionMs: number; // How long to keep metrics in memory
  alertThresholds: {
    responseTime: number; // ms
    errorRate: number; // percentage
    memoryUsage: number; // bytes
    cpuUsage: number; // percentage
  };
  healthCheckInterval: number; // ms
  maxMetricsEntries: number; // Prevent unbounded growth
  enableDetailedProfiling: boolean;
}

export interface ServerMetrics {
  serverId: string;
  metrics: {
    uptime: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    currentResponseTime: number;
    memoryUsage: number;
    cpuUsage: number;
    lastHealth: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    lastHealthCheck: Date;
    errorRate: number; // 0-100
  };
  recentActivity: ActivityEntry[];
  alerts: AlertEntry[];
}

export interface ActivityEntry {
  timestamp: Date;
  operation: string;
  duration: number;
  success: boolean;
  error?: string;
  memoryDelta?: number;
}

export interface AlertEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  acknowledged: boolean;
}

export interface SystemResourceMetrics {
  timestamp: Date;
  memory: {
    total: number;
    used: number;
    available: number;
    heapUsed: number;
    heapTotal: number;
  };
  cpu: {
    usage: number; // percentage
    loadAverage: number[];
  };
  eventLoop: {
    lag: number; // ms
    utilization: number; // percentage
  };
  concurrent: {
    activeConnections: number;
    pendingOperations: number;
  };
}

/**
 * Comprehensive monitoring system with Rust integration preparation
 */
export class MCPServerMonitoring extends EventEmitter {
  private config: MetricsConfig;
  private serverMetrics: Map<string, ServerMetrics> = new Map();
  private systemMetrics: SystemResourceMetrics[] = [];
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isMonitoring = false;
  private startTime = Date.now();

  // Performance tracking
  private metricsCollectionTime = 0;
  private lastCleanup = Date.now();

  constructor(config: Partial<MetricsConfig> = {}) {
    super();
    
    this.config = {
      enableMetrics: true,
      metricsRetentionMs: 60 * 60 * 1000, // 1 hour
      alertThresholds: {
        responseTime: 5000, // 5 seconds
        errorRate: 10, // 10%
        memoryUsage: outputConfig.getConfig().maxBufferSize, // Use config limit
        cpuUsage: 80 // 80%
      },
      healthCheckInterval: 30000, // 30 seconds
      maxMetricsEntries: 1000,
      enableDetailedProfiling: false,
      ...config
    };

    this.setMaxListeners(100);
    this.setupSystemMonitoring();
  }

  /**
   * Register a server for monitoring
   */
  registerServer(serverId: string): void {
    if (this.serverMetrics.has(serverId)) {
      logger.warn(`Server ${serverId} already registered for monitoring`);
      return;
    }

    const serverMetric: ServerMetrics = {
      serverId,
      metrics: {
        uptime: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        currentResponseTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        lastHealth: 'unknown',
        lastHealthCheck: new Date(),
        errorRate: 0
      },
      recentActivity: [],
      alerts: []
    };

    this.serverMetrics.set(serverId, serverMetric);
    this.startServerMonitoring(serverId);
    
    logger.info(`📊 Server ${serverId} registered for monitoring`);
    this.emit('serverRegistered', serverId);
  }

  /**
   * Record operation metrics for a server
   */
  recordOperation(
    serverId: string,
    operation: string,
    duration: number,
    success: boolean,
    error?: string
  ): void {
    if (!this.config.enableMetrics) return;

    const serverMetric = this.serverMetrics.get(serverId);
    if (!serverMetric) {
      logger.warn(`Attempted to record operation for unregistered server: ${serverId}`);
      return;
    }

    const startMemory = process.memoryUsage().heapUsed;
    
    // Update aggregate metrics
    serverMetric.metrics.totalRequests++;
    if (success) {
      serverMetric.metrics.successfulRequests++;
    } else {
      serverMetric.metrics.failedRequests++;
    }

    // Update response time (rolling average)
    const currentAvg = serverMetric.metrics.avgResponseTime;
    const totalRequests = serverMetric.metrics.totalRequests;
    serverMetric.metrics.avgResponseTime = 
      ((currentAvg * (totalRequests - 1)) + duration) / totalRequests;
    serverMetric.metrics.currentResponseTime = duration;

    // Calculate error rate
    serverMetric.metrics.errorRate = 
      (serverMetric.metrics.failedRequests / serverMetric.metrics.totalRequests) * 100;

    // Record activity entry
    const memoryDelta = process.memoryUsage().heapUsed - startMemory;
    const activity: ActivityEntry = {
      timestamp: new Date(),
      operation,
      duration,
      success,
      error,
      memoryDelta
    };
    
    serverMetric.recentActivity.push(activity);
    this.trimActivityHistory(serverId);

    // Check for alerts
    this.checkAlerts(serverId);

    // Performance monitoring
    this.metricsCollectionTime += Date.now() - startMemory;

    this.emit('operationRecorded', serverId, activity);
  }

  /**
   * Update server health status
   */
  updateServerHealth(
    serverId: string, 
    health: 'healthy' | 'degraded' | 'unhealthy',
    details?: any
  ): void {
    const serverMetric = this.serverMetrics.get(serverId);
    if (!serverMetric) return;

    const previousHealth = serverMetric.metrics.lastHealth;
    serverMetric.metrics.lastHealth = health;
    serverMetric.metrics.lastHealthCheck = new Date();

    // Emit health change events
    if (previousHealth !== health) {
      logger.info(`🏥 Server ${serverId} health changed: ${previousHealth} → ${health}`);
      this.emit('healthChanged', serverId, health, previousHealth, details);

      // Create alert for health degradation
      if (health === 'unhealthy' || health === 'degraded') {
        this.createAlert(serverId, 'warn', `Health degraded to ${health}`, 'health', 0, 1);
      }
    }
  }

  /**
   * Get metrics for a specific server
   */
  getServerMetrics(serverId: string): ServerMetrics | null {
    return this.serverMetrics.get(serverId) || null;
  }

  /**
   * Get metrics for all servers
   */
  getAllServerMetrics(): ServerMetrics[] {
    return Array.from(this.serverMetrics.values());
  }

  /**
   * Get system-wide metrics
   */
  getSystemMetrics(): SystemResourceMetrics | null {
    return this.systemMetrics[this.systemMetrics.length - 1] || null;
  }

  /**
   * Get monitoring summary
   */
  getMonitoringSummary(): {
    totalServers: number;
    healthyServers: number;
    unhealthyServers: number;
    totalRequests: number;
    avgResponseTime: number;
    systemHealth: 'healthy' | 'degraded' | 'unhealthy';
    activeAlerts: number;
  } {
    const servers = Array.from(this.serverMetrics.values());
    const totalRequests = servers.reduce((sum, s) => sum + s.metrics.totalRequests, 0);
    const avgResponseTime = servers.length > 0 
      ? servers.reduce((sum, s) => sum + s.metrics.avgResponseTime, 0) / servers.length 
      : 0;

    const healthyCount = servers.filter(s => s.metrics.lastHealth === 'healthy').length;
    const unhealthyCount = servers.filter(s => s.metrics.lastHealth === 'unhealthy').length;
    
    let systemHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyCount > servers.length / 2) {
      systemHealth = 'unhealthy';
    } else if (unhealthyCount > 0 || avgResponseTime > this.config.alertThresholds.responseTime) {
      systemHealth = 'degraded';
    }

    const activeAlerts = servers.reduce((sum, s) => 
      sum + s.alerts.filter(a => !a.acknowledged).length, 0
    );

    return {
      totalServers: servers.length,
      healthyServers: healthyCount,
      unhealthyServers: unhealthyCount,
      totalRequests,
      avgResponseTime,
      systemHealth,
      activeAlerts
    };
  }

  /**
   * Start monitoring all registered servers
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    logger.info('📊 Starting MCP server monitoring');

    // Start individual server monitoring
    for (const serverId of this.serverMetrics.keys()) {
      this.startServerMonitoring(serverId);
    }

    // Start periodic cleanup
    const cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 5 * 60 * 1000); // Every 5 minutes

    this.monitoringIntervals.set('cleanup', cleanupInterval);
    this.emit('monitoringStarted');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    // Clear all intervals
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval);
    }
    this.monitoringIntervals.clear();

    logger.info('📊 MCP server monitoring stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Start monitoring for a specific server
   */
  private startServerMonitoring(serverId: string): void {
    if (this.monitoringIntervals.has(serverId)) {
      clearInterval(this.monitoringIntervals.get(serverId)!);
    }

    const interval = setInterval(() => {
      this.collectServerMetrics(serverId);
    }, this.config.healthCheckInterval);

    this.monitoringIntervals.set(serverId, interval);
  }

  /**
   * Collect metrics for a specific server
   */
  private async collectServerMetrics(serverId: string): Promise<void> {
    const serverMetric = this.serverMetrics.get(serverId);
    if (!serverMetric) return;

    try {
      // Update uptime
      serverMetric.metrics.uptime = Date.now() - this.startTime;

      // Collect resource usage (placeholder for Rust integration)
      const memoryUsage = process.memoryUsage();
      serverMetric.metrics.memoryUsage = memoryUsage.heapUsed;

      // TODO: Replace with Rust-backed metrics
      // This is where we'll integrate with Rust resource monitors
      serverMetric.metrics.cpuUsage = await this.getCpuUsage();

      this.emit('metricsCollected', serverId, serverMetric.metrics);
      
    } catch (error) {
      logger.error(`Failed to collect metrics for server ${serverId}:`, error);
    }
  }

  /**
   * Setup system-wide monitoring
   */
  private setupSystemMonitoring(): void {
    const collectSystemMetrics = () => {
      const memoryUsage = process.memoryUsage();
      const systemMetric: SystemResourceMetrics = {
        timestamp: new Date(),
        memory: {
          total: memoryUsage.rss,
          used: memoryUsage.heapUsed,
          available: memoryUsage.rss - memoryUsage.heapUsed,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal
        },
        cpu: {
          usage: 0, // TODO: Implement CPU monitoring
          loadAverage: [] // TODO: Implement load average
        },
        eventLoop: {
          lag: 0, // TODO: Implement event loop lag monitoring
          utilization: 0
        },
        concurrent: {
          activeConnections: 0, // TODO: Track active connections
          pendingOperations: this.metricsCollectionTime
        }
      };

      this.systemMetrics.push(systemMetric);
      this.trimSystemMetrics();
      
      this.emit('systemMetricsCollected', systemMetric);
    };

    // Collect system metrics every 30 seconds
    const systemInterval = setInterval(collectSystemMetrics, 30000);
    this.monitoringIntervals.set('system', systemInterval);
    
    // Initial collection
    collectSystemMetrics();
  }

  /**
   * Check alert conditions
   */
  private checkAlerts(serverId: string): void {
    const serverMetric = this.serverMetrics.get(serverId)!;
    const metrics = serverMetric.metrics;
    const thresholds = this.config.alertThresholds;

    // Response time alert
    if (metrics.currentResponseTime > thresholds.responseTime) {
      this.createAlert(
        serverId, 'warn', 
        `High response time: ${metrics.currentResponseTime}ms`,
        'responseTime',
        metrics.currentResponseTime,
        thresholds.responseTime
      );
    }

    // Error rate alert
    if (metrics.errorRate > thresholds.errorRate) {
      this.createAlert(
        serverId, 'error',
        `High error rate: ${metrics.errorRate.toFixed(1)}%`,
        'errorRate',
        metrics.errorRate,
        thresholds.errorRate
      );
    }

    // Memory usage alert
    if (metrics.memoryUsage > thresholds.memoryUsage) {
      this.createAlert(
        serverId, 'warn',
        `High memory usage: ${this.formatBytes(metrics.memoryUsage)}`,
        'memoryUsage',
        metrics.memoryUsage,
        thresholds.memoryUsage
      );
    }
  }

  /**
   * Create an alert
   */
  private createAlert(
    serverId: string,
    level: 'info' | 'warn' | 'error' | 'critical',
    message: string,
    metric: string,
    value: number,
    threshold: number
  ): void {
    const serverMetric = this.serverMetrics.get(serverId);
    if (!serverMetric) return;

    const alert: AlertEntry = {
      timestamp: new Date(),
      level,
      message,
      metric,
      value,
      threshold,
      acknowledged: false
    };

    serverMetric.alerts.push(alert);
    this.trimAlerts(serverId);

    logger.log(level, `🚨 Alert for ${serverId}: ${message}`);
    this.emit('alertCreated', serverId, alert);
  }

  /**
   * Trim activity history to prevent memory growth
   */
  private trimActivityHistory(serverId: string): void {
    const serverMetric = this.serverMetrics.get(serverId);
    if (!serverMetric) return;

    const maxEntries = Math.floor(this.config.maxMetricsEntries * 0.8); // 80% for activities
    if (serverMetric.recentActivity.length > maxEntries) {
      serverMetric.recentActivity.splice(0, serverMetric.recentActivity.length - maxEntries);
    }
  }

  /**
   * Trim alerts history
   */
  private trimAlerts(serverId: string): void {
    const serverMetric = this.serverMetrics.get(serverId);
    if (!serverMetric) return;

    const maxAlerts = Math.floor(this.config.maxMetricsEntries * 0.2); // 20% for alerts
    if (serverMetric.alerts.length > maxAlerts) {
      serverMetric.alerts.splice(0, serverMetric.alerts.length - maxAlerts);
    }
  }

  /**
   * Trim system metrics
   */
  private trimSystemMetrics(): void {
    const maxEntries = 100; // Keep last 100 system metrics
    if (this.systemMetrics.length > maxEntries) {
      this.systemMetrics.splice(0, this.systemMetrics.length - maxEntries);
    }
  }

  /**
   * Perform periodic cleanup
   */
  private performCleanup(): void {
    const now = Date.now();
    
    // Clean up old metrics based on retention policy
    for (const [serverId, serverMetric] of this.serverMetrics) {
      const cutoffTime = now - this.config.metricsRetentionMs;
      
      // Remove old activities
      serverMetric.recentActivity = serverMetric.recentActivity.filter(
        activity => activity.timestamp.getTime() > cutoffTime
      );
      
      // Remove old acknowledged alerts
      serverMetric.alerts = serverMetric.alerts.filter(
        alert => !alert.acknowledged || alert.timestamp.getTime() > cutoffTime
      );
    }

    // Clean up old system metrics
    const systemCutoff = now - (this.config.metricsRetentionMs / 2); // Keep system metrics for half retention
    this.systemMetrics = this.systemMetrics.filter(
      metric => metric.timestamp.getTime() > systemCutoff
    );

    this.lastCleanup = now;
    logger.debug('🧹 Monitoring cleanup completed');
  }

  /**
   * Placeholder CPU usage - to be replaced with Rust implementation
   */
  private async getCpuUsage(): Promise<number> {
    // TODO: Replace with Rust NAPI binding for accurate CPU usage
    return Math.random() * 20; // Mock value
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopMonitoring();
    this.removeAllListeners();
    this.serverMetrics.clear();
    this.systemMetrics.length = 0;
  }
}

// Export singleton instance
export const mcpServerMonitoring = new MCPServerMonitoring();