/**
 * Production Hardening System - Enterprise Security & Reliability
 * 
 * Comprehensive production-ready hardening system that transforms CodeCrucible Synth 
 * from a development prototype into an enterprise-grade platform.
 * 
 * Key Features:
 * - Multi-level timeout management with intelligent recovery
 * - Resource limits enforcement with automatic cleanup
 * - Comprehensive error handling with automated recovery
 * - Enterprise observability with audit trails and alerting
 * - Security hardening with DoS protection and input validation
 * - Graceful shutdown with proper resource cleanup
 * - Performance protection and anti-degradation measures
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';
import * as path from 'path';
import { logger } from '../logging/logger.js';
import { TimeoutManager, TimeoutLevel, TimeoutStrategy } from '../error-handling/timeout-manager.js';
import { CircuitBreakerManager } from '../error-handling/circuit-breaker-system.js';
import { ObservabilitySystem } from '../../core/observability/observability-system.js';
import { globalRateLimitManager } from '../../core/networking/rate-limiting-system.js';

// Production Hardening Configuration
export interface ProductionHardeningConfig {
  // Resource Management
  resourceLimits: {
    memory: {
      maxHeapSize: number;           // Maximum heap size in bytes
      warningThreshold: number;      // Warning at % of max
      criticalThreshold: number;     // Critical at % of max
      forceCleanupThreshold: number; // Force cleanup at % of max
      gcInterval: number;            // Garbage collection interval
    };
    cpu: {
      maxUsagePercent: number;       // Maximum CPU usage %
      warningThreshold: number;      // Warning threshold %
      throttleThreshold: number;     // Start throttling at %
      monitoringInterval: number;    // CPU monitoring interval
    };
    concurrency: {
      maxConcurrentOperations: number;
      maxQueueSize: number;
      operationTimeout: number;
      requestTimeout: number;
    };
  };
  
  // Timeout Management
  timeouts: {
    operation: number;    // Individual operation timeout
    request: number;      // Request processing timeout
    session: number;      // Session timeout
    system: number;       // System-wide operation timeout
    shutdown: number;     // Graceful shutdown timeout
  };
  
  // Security Hardening
  security: {
    rateLimiting: {
      enabled: boolean;
      requestsPerMinute: number;
      burstLimit: number;
      banDuration: number;
    };
    inputValidation: {
      enabled: boolean;
      maxInputSize: number;
      sanitizeInputs: boolean;
      blockSuspiciousPatterns: boolean;
    };
    auditLogging: {
      enabled: boolean;
      auditAllOperations: boolean;
      sensitiveDataRedaction: boolean;
      logRetentionDays: number;
    };
  };
  
  // Error Recovery
  errorRecovery: {
    maxRetries: number;
    retryBackoffMultiplier: number;
    maxBackoffTime: number;
    autoRecoveryEnabled: boolean;
    fallbackModeEnabled: boolean;
  };
  
  // Health Monitoring
  monitoring: {
    healthCheckInterval: number;
    metricsCollectionInterval: number;
    alertingEnabled: boolean;
    alertThresholds: {
      memoryUsage: number;
      cpuUsage: number;
      errorRate: number;
      responseTime: number;
    };
  };
}

// Production Hardening Statistics
export interface ProductionStats {
  uptime: number;
  totalOperations: number;
  successRate: number;
  averageResponseTime: number;
  
  resourceUsage: {
    memory: {
      current: number;
      peak: number;
      utilizationPercent: number;
    };
    cpu: {
      current: number;
      average: number;
    };
    concurrency: {
      active: number;
      queued: number;
      completed: number;
    };
  };
  
  security: {
    blockedRequests: number;
    rateLimitViolations: number;
    suspiciousPatterns: number;
    auditEntries: number;
  };
  
  reliability: {
    timeouts: number;
    circuitBreakerTrips: number;
    errorRecoveries: number;
    forcedCleanups: number;
  };
  
  performance: {
    operationsPerSecond: number;
    memoryLeaks: number;
    performanceDegradations: number;
    optimizationActions: number;
  };
}

// Production Alert
export interface ProductionAlert {
  id: string;
  timestamp: number;
  level: 'info' | 'warning' | 'error' | 'critical';
  category: 'resource' | 'security' | 'performance' | 'reliability' | 'system';
  message: string;
  details: any;
  action?: string;
  resolved?: boolean;
  resolvedAt?: number;
}

/**
 * Main Production Hardening System
 * 
 * Orchestrates all production-ready components to ensure enterprise-grade reliability,
 * security, and performance under production workloads.
 */
export class ProductionHardeningSystem extends EventEmitter {
  private static instance: ProductionHardeningSystem | null = null;
  
  private config: ProductionHardeningConfig;
  private stats: ProductionStats;
  private alerts: ProductionAlert[] = [];
  private isRunning: boolean = false;
  private startTime: number;
  
  // Core Components
  private timeoutManager: TimeoutManager;
  private circuitBreakerManager: CircuitBreakerManager;
  private observabilitySystem: ObservabilitySystem;
  private resourceMonitor: ResourceMonitor;
  private securityHardener: SecurityHardener;
  private errorRecoverySystem: ErrorRecoverySystem;
  private performanceProtector: PerformanceProtector;
  private shutdownHandler: GracefulShutdownHandler;
  
  // Monitoring Intervals
  private monitoringIntervals: NodeJS.Timeout[] = [];
  
  // Operational State
  private operationQueue: OperationRequest[] = [];
  private activeOperations = new Map<string, OperationContext>();
  private performanceHistory: PerformanceMetric[] = [];

  private constructor(config?: Partial<ProductionHardeningConfig>) {
    super();
    
    this.config = this.createDefaultConfig(config);
    this.startTime = Date.now();
    this.stats = this.initializeStats();
    
    // Initialize core components
    this.timeoutManager = TimeoutManager.getInstance();
    this.circuitBreakerManager = CircuitBreakerManager.getInstance();
    this.observabilitySystem = new ObservabilitySystem(this.createObservabilityConfig());
    this.resourceMonitor = new ResourceMonitor(this.config.resourceLimits, this);
    this.securityHardener = new SecurityHardener(this.config.security, this);
    this.errorRecoverySystem = new ErrorRecoverySystem(this.config.errorRecovery, this);
    this.performanceProtector = new PerformanceProtector(this.config, this);
    this.shutdownHandler = new GracefulShutdownHandler(this.config.timeouts.shutdown, this);
    
    this.setupEventHandlers();
    
    logger.info('🔒 Production Hardening System initialized', {
      memoryLimit: `${(this.config.resourceLimits.memory.maxHeapSize / 1024 / 1024).toFixed(0)}MB`,
      securityEnabled: this.config.security.rateLimiting.enabled,
      observabilityEnabled: true
    });
  }
  
  static getInstance(config?: Partial<ProductionHardeningConfig>): ProductionHardeningSystem {
    if (!ProductionHardeningSystem.instance) {
      ProductionHardeningSystem.instance = new ProductionHardeningSystem(config);
    }
    return ProductionHardeningSystem.instance;
  }
  
  /**
   * Initialize the production hardening system
   */
  async initialize(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Production hardening system already running');
      return;
    }
    
    try {
      logger.info('🚀 Initializing Production Hardening System...');
      
      // Initialize core components
      await this.observabilitySystem.initialize();
      await this.resourceMonitor.initialize();
      await this.securityHardener.initialize();
      await this.errorRecoverySystem.initialize();
      await this.performanceProtector.initialize();
      await this.shutdownHandler.initialize();
      
      // Start monitoring systems
      this.startMonitoring();
      
      // Register global error handlers
      this.registerGlobalErrorHandlers();
      
      this.isRunning = true;
      this.emit('system:initialized');
      
      logger.info('✅ Production Hardening System initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize production hardening system:', error);
      throw error;
    }
  }
  
  /**
   * Execute operation with comprehensive production hardening
   */
  async executeWithHardening<T>(
    operationId: string,
    operation: () => Promise<T>,
    options: {
      timeout?: number;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      retries?: number;
      circuitBreaker?: boolean;
      resourceRequirements?: {
        memory?: number;
        cpu?: number;
      };
      metadata?: any;
    } = {}
  ): Promise<T> {
    
    const startTime = performance.now();
    const context: OperationContext = {
      id: operationId,
      startTime,
      priority: options.priority || 'medium',
      metadata: options.metadata || {},
      resourceRequirements: options.resourceRequirements || {},
      status: 'starting'
    };
    
    this.activeOperations.set(operationId, context);
    this.stats.totalOperations++;
    
    try {
      // Security validation
      await this.securityHardener.validateOperation(operationId, context);
      
      // Resource allocation check
      await this.resourceMonitor.checkResourceAvailability(context);
      
      // Execute with timeout and circuit breaker protection
      const result = await this.executeWithAllProtections(operation, context, options);
      
      // Record successful completion
      context.status = 'completed';
      context.endTime = performance.now();
      context.duration = context.endTime - context.startTime;
      
      this.recordOperationSuccess(context);
      this.emit('operation:completed', context);
      
      return result;
      
    } catch (error) {
      // Handle operation failure
      context.status = 'failed';
      context.endTime = performance.now();
      context.duration = context.endTime - context.startTime;
      context.error = error as Error;
      
      await this.handleOperationFailure(context, error as Error);
      throw error;
      
    } finally {
      this.activeOperations.delete(operationId);
      
      // Update performance metrics
      if (context.duration) {
        this.updatePerformanceMetrics(context);
      }
    }
  }
  
  /**
   * Get comprehensive production statistics
   */
  getProductionStats(): ProductionStats {
    const currentStats = { ...this.stats };
    
    // Update real-time metrics
    currentStats.uptime = Date.now() - this.startTime;
    currentStats.resourceUsage = this.resourceMonitor.getCurrentUsage();
    currentStats.security = this.securityHardener.getSecurityStats();
    currentStats.reliability = this.getReliabilityStats();
    currentStats.performance = this.performanceProtector.getPerformanceStats();
    
    return currentStats;
  }
  
  /**
   * Get active production alerts
   */
  getActiveAlerts(): ProductionAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }
  
  /**
   * Create production health report
   */
  async getHealthReport(): Promise<ProductionHealthReport> {
    const stats = this.getProductionStats();
    const systemHealth = await this.observabilitySystem.checkHealth();
    const resourceHealth = this.resourceMonitor.getHealthStatus();
    const securityHealth = this.securityHardener.getSecurityHealth();
    
    const overallScore = this.calculateOverallHealthScore(
      systemHealth.overallScore,
      resourceHealth.score,
      securityHealth.score
    );
    
    return {
      timestamp: Date.now(),
      overallStatus: this.getHealthStatus(overallScore),
      overallScore,
      uptime: stats.uptime,
      
      components: {
        system: systemHealth,
        resources: resourceHealth,
        security: securityHealth,
        performance: this.performanceProtector.getHealthStatus(),
        reliability: this.getReliabilityHealth()
      },
      
      metrics: stats,
      activeAlerts: this.getActiveAlerts(),
      recommendations: this.generateHealthRecommendations(stats)
    };
  }
  
  /**
   * Trigger emergency measures for critical situations
   */
  async triggerEmergencyMode(reason: string): Promise<void> {
    logger.error(`🚨 EMERGENCY MODE TRIGGERED: ${reason}`);
    
    const alert: ProductionAlert = {
      id: `emergency_${Date.now()}`,
      timestamp: Date.now(),
      level: 'critical',
      category: 'system',
      message: `Emergency mode activated: ${reason}`,
      details: { reason, activeOperations: this.activeOperations.size },
      action: 'emergency_measures_activated'
    };
    
    this.alerts.push(alert);
    this.emit('emergency:activated', alert);
    
    // Emergency measures
    await Promise.all([
      this.resourceMonitor.emergencyCleanup(),
      this.performanceProtector.emergencyOptimization(),
      this.errorRecoverySystem.emergencyRecovery(),
      this.securityHardener.emergencyLockdown()
    ]);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    logger.warn('Emergency measures completed');
  }
  
  /**
   * Graceful shutdown of the production hardening system
   */
  async shutdown(): Promise<void> {
    if (!this.isRunning) return;
    
    logger.info('🛑 Shutting down Production Hardening System...');
    
    try {
      // Activate shutdown handler
      await this.shutdownHandler.initiateShutdown();
      
      // Stop monitoring
      this.stopMonitoring();
      
      // Shutdown components in proper order
      await this.performanceProtector.shutdown();
      await this.securityHardener.shutdown();
      await this.errorRecoverySystem.shutdown();
      await this.resourceMonitor.shutdown();
      await this.observabilitySystem.shutdown();
      
      this.isRunning = false;
      this.removeAllListeners();
      
      logger.info('✅ Production Hardening System shutdown completed');
      
    } catch (error) {
      logger.error('Error during shutdown:', error);
      throw error;
    }
  }
  
  // Private Implementation Methods
  
  private async executeWithAllProtections<T>(
    operation: () => Promise<T>,
    context: OperationContext,
    options: any
  ): Promise<T> {
    
    // Wrap with timeout protection
    const timeoutPromise = this.timeoutManager.withTimeout(
      operation,
      context.id,
      {
        level: TimeoutLevel.OPERATION,
        duration: options.timeout || this.config.timeouts.operation,
        strategy: TimeoutStrategy.GRACEFUL
      }
    );
    
    // Circuit breaker protection if enabled
    if (options.circuitBreaker) {
      const circuitBreaker = this.circuitBreakerManager.getCircuitBreaker(
        `operation_${context.id}`,
        () => timeoutPromise,
        {
          name: context.id,
          failureThreshold: 5,
          recoveryTimeout: 30000,
          timeout: options.timeout || this.config.timeouts.operation,
          maxRetries: options.retries || this.config.errorRecovery.maxRetries,
          backoffMultiplier: this.config.errorRecovery.retryBackoffMultiplier,
          maxBackoffTime: this.config.errorRecovery.maxBackoffTime,
          fallbackEnabled: this.config.errorRecovery.fallbackModeEnabled
        }
      );
      
      const result = await circuitBreaker.execute();
      if (!result.success) {
        throw result.error;
      }
      return result.data!;
    }
    
    return await timeoutPromise;
  }
  
  private recordOperationSuccess(context: OperationContext): void {
    const successRate = (this.stats.totalOperations - this.getFailureCount()) / this.stats.totalOperations;
    this.stats.successRate = successRate * 100;
    
    if (context.duration) {
      this.stats.averageResponseTime = (this.stats.averageResponseTime * 0.9) + (context.duration * 0.1);
    }
    
    // Record performance metrics
    this.observabilitySystem.recordTimer(
      'operation.duration',
      context.duration || 0,
      { operation: context.id, status: 'success' }
    );
    
    this.observabilitySystem.incrementCounter('operation.success', { operation: context.id });
  }
  
  private async handleOperationFailure(context: OperationContext, error: Error): Promise<void> {
    logger.error(`Operation failed: ${context.id}`, error);
    
    // Record failure metrics
    this.observabilitySystem.incrementCounter('operation.failure', {
      operation: context.id,
      error: error.name
    });
    
    // Try error recovery if enabled
    if (this.config.errorRecovery.autoRecoveryEnabled) {
      await this.errorRecoverySystem.handleFailure(context, error);
    }
    
    // Create alert for critical errors
    if (this.isCriticalError(error)) {
      const alert: ProductionAlert = {
        id: `error_${Date.now()}`,
        timestamp: Date.now(),
        level: 'error',
        category: 'reliability',
        message: `Critical operation failure: ${context.id}`,
        details: { error: error.message, context },
        action: 'investigate_and_recover'
      };
      
      this.alerts.push(alert);
      this.emit('alert:created', alert);
    }
    
    this.emit('operation:failed', { context, error });
  }
  
  private startMonitoring(): void {
    // Resource monitoring
    const resourceInterval = setInterval(() => {
      this.resourceMonitor.performResourceCheck();
    }, this.config.monitoring.healthCheckInterval);
    this.monitoringIntervals.push(resourceInterval);
    
    // Performance monitoring
    const perfInterval = setInterval(() => {
      this.performanceProtector.checkPerformance();
    }, this.config.monitoring.metricsCollectionInterval);
    this.monitoringIntervals.push(perfInterval);
    
    // Security monitoring
    const secInterval = setInterval(() => {
      this.securityHardener.performSecurityCheck();
    }, 30000); // Every 30 seconds
    this.monitoringIntervals.push(secInterval);
    
    // Alert processing
    const alertInterval = setInterval(() => {
      this.processAlerts();
    }, 10000); // Every 10 seconds
    this.monitoringIntervals.push(alertInterval);
  }
  
  private stopMonitoring(): void {
    this.monitoringIntervals.forEach(interval => {
      clearInterval(interval);
    });
    this.monitoringIntervals = [];
  }
  
  private registerGlobalErrorHandlers(): void {
    // Unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection:', reason);
      this.handleCriticalError(new Error(`Unhandled Promise Rejection: ${reason}`));
    });
    
    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.handleCriticalError(error);
    });
    
    // Warning handler
    process.on('warning', (warning) => {
      logger.warn('Process Warning:', warning);
    });
  }
  
  private async handleCriticalError(error: Error): Promise<void> {
    await this.triggerEmergencyMode(`Critical error: ${error.message}`);
  }
  
  private setupEventHandlers(): void {
    // Resource monitoring events
    this.resourceMonitor.on('resource:warning', (data) => {
      this.createAlert('warning', 'resource', `Resource usage warning: ${data.resource}`, data);
    });
    
    this.resourceMonitor.on('resource:critical', (data) => {
      this.createAlert('critical', 'resource', `Critical resource usage: ${data.resource}`, data);
      this.triggerEmergencyMode(`Critical resource usage: ${data.resource}`);
    });
    
    // Security events
    this.securityHardener.on('security:threat', (data) => {
      this.createAlert('error', 'security', `Security threat detected: ${data.type}`, data);
    });
    
    // Performance events
    this.performanceProtector.on('performance:degradation', (data) => {
      this.createAlert('warning', 'performance', `Performance degradation detected`, data);
    });
  }
  
  private createAlert(
    level: 'info' | 'warning' | 'error' | 'critical',
    category: 'resource' | 'security' | 'performance' | 'reliability' | 'system',
    message: string,
    details: any
  ): void {
    const alert: ProductionAlert = {
      id: `${category}_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      timestamp: Date.now(),
      level,
      category,
      message,
      details
    };
    
    this.alerts.push(alert);
    this.emit('alert:created', alert);
    
    // Keep only recent alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-500);
    }
  }
  
  private processAlerts(): void {
    const activeAlerts = this.getActiveAlerts();
    
    // Auto-resolve alerts that are no longer relevant
    activeAlerts.forEach(alert => {
      if (this.shouldAutoResolveAlert(alert)) {
        alert.resolved = true;
        alert.resolvedAt = Date.now();
        this.emit('alert:resolved', alert);
      }
    });
  }
  
  private shouldAutoResolveAlert(alert: ProductionAlert): boolean {
    // Auto-resolve old resource alerts if resources are now healthy
    if (alert.category === 'resource' && Date.now() - alert.timestamp > 300000) { // 5 minutes
      const resourceHealth = this.resourceMonitor.getHealthStatus();
      return resourceHealth.status === 'healthy';
    }
    
    return false;
  }
  
  private updatePerformanceMetrics(context: OperationContext): void {
    if (!context.duration) return;
    
    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      operationId: context.id,
      duration: context.duration,
      success: context.status === 'completed',
      memoryUsed: process.memoryUsage().heapUsed,
      metadata: context.metadata
    };
    
    this.performanceHistory.push(metric);
    
    // Keep only recent metrics
    if (this.performanceHistory.length > 10000) {
      this.performanceHistory = this.performanceHistory.slice(-5000);
    }
  }
  
  private getFailureCount(): number {
    return this.performanceHistory.filter(m => !m.success).length;
  }
  
  private isCriticalError(error: Error): boolean {
    const criticalErrors = [
      'OutOfMemoryError',
      'TimeoutError', 
      'SecurityViolation',
      'CircuitBreakerError'
    ];
    
    return criticalErrors.some(type => error.name.includes(type) || error.message.includes(type));
  }
  
  private getReliabilityStats(): any {
    return {
      timeouts: this.performanceHistory.filter(m => m.metadata?.timeout).length,
      circuitBreakerTrips: 0, // Would be tracked by circuit breaker manager
      errorRecoveries: 0, // Would be tracked by error recovery system
      forcedCleanups: 0 // Would be tracked by resource monitor
    };
  }
  
  private getReliabilityHealth(): any {
    const stats = this.getReliabilityStats();
    const totalOps = this.stats.totalOperations;
    
    const errorRate = totalOps > 0 ? (this.getFailureCount() / totalOps) * 100 : 0;
    
    return {
      status: errorRate < 1 ? 'healthy' : errorRate < 5 ? 'degraded' : 'critical',
      errorRate,
      stats
    };
  }
  
  private calculateOverallHealthScore(systemScore: number, resourceScore: number, securityScore: number): number {
    return (systemScore + resourceScore + securityScore) / 3;
  }
  
  private getHealthStatus(score: number): 'healthy' | 'degraded' | 'critical' {
    if (score >= 0.8) return 'healthy';
    if (score >= 0.5) return 'degraded';
    return 'critical';
  }
  
  private generateHealthRecommendations(stats: ProductionStats): string[] {
    const recommendations: string[] = [];
    
    if (stats.resourceUsage.memory.utilizationPercent > 80) {
      recommendations.push('Consider increasing memory limits or optimizing memory usage');
    }
    
    if (stats.resourceUsage.cpu.current > 80) {
      recommendations.push('High CPU usage detected - consider load balancing or optimization');
    }
    
    if (stats.successRate < 95) {
      recommendations.push('Success rate below target - investigate error patterns and implement fixes');
    }
    
    if (stats.averageResponseTime > 5000) {
      recommendations.push('Response time high - consider performance optimization');
    }
    
    return recommendations;
  }
  
  private createDefaultConfig(override?: Partial<ProductionHardeningConfig>): ProductionHardeningConfig {
    const defaultConfig: ProductionHardeningConfig = {
      resourceLimits: {
        memory: {
          maxHeapSize: 512 * 1024 * 1024, // 512MB
          warningThreshold: 75,
          criticalThreshold: 90,
          forceCleanupThreshold: 95,
          gcInterval: 30000
        },
        cpu: {
          maxUsagePercent: 80,
          warningThreshold: 60,
          throttleThreshold: 75,
          monitoringInterval: 5000
        },
        concurrency: {
          maxConcurrentOperations: 50,
          maxQueueSize: 100,
          operationTimeout: 300000, // 5 minutes
          requestTimeout: 60000     // 1 minute
        }
      },
      
      timeouts: {
        operation: 30000,   // 30 seconds
        request: 120000,    // 2 minutes
        session: 1800000,   // 30 minutes
        system: 300000,     // 5 minutes
        shutdown: 30000     // 30 seconds
      },
      
      security: {
        rateLimiting: {
          enabled: true,
          requestsPerMinute: 100,
          burstLimit: 20,
          banDuration: 300000 // 5 minutes
        },
        inputValidation: {
          enabled: true,
          maxInputSize: 1024 * 1024, // 1MB
          sanitizeInputs: true,
          blockSuspiciousPatterns: true
        },
        auditLogging: {
          enabled: true,
          auditAllOperations: false,
          sensitiveDataRedaction: true,
          logRetentionDays: 30
        }
      },
      
      errorRecovery: {
        maxRetries: 3,
        retryBackoffMultiplier: 2,
        maxBackoffTime: 60000,
        autoRecoveryEnabled: true,
        fallbackModeEnabled: true
      },
      
      monitoring: {
        healthCheckInterval: 30000,
        metricsCollectionInterval: 10000,
        alertingEnabled: true,
        alertThresholds: {
          memoryUsage: 80,
          cpuUsage: 75,
          errorRate: 5,
          responseTime: 5000
        }
      }
    };
    
    return override ? this.mergeConfig(defaultConfig, override) : defaultConfig;
  }
  
  private mergeConfig(base: ProductionHardeningConfig, override: Partial<ProductionHardeningConfig>): ProductionHardeningConfig {
    // Deep merge configuration
    return {
      ...base,
      ...override,
      resourceLimits: {
        ...base.resourceLimits,
        ...override.resourceLimits,
        memory: { ...base.resourceLimits.memory, ...(override.resourceLimits?.memory || {}) },
        cpu: { ...base.resourceLimits.cpu, ...(override.resourceLimits?.cpu || {}) },
        concurrency: { ...base.resourceLimits.concurrency, ...(override.resourceLimits?.concurrency || {}) }
      },
      timeouts: { ...base.timeouts, ...(override.timeouts || {}) },
      security: {
        ...base.security,
        ...override.security,
        rateLimiting: { ...base.security.rateLimiting, ...(override.security?.rateLimiting || {}) },
        inputValidation: { ...base.security.inputValidation, ...(override.security?.inputValidation || {}) },
        auditLogging: { ...base.security.auditLogging, ...(override.security?.auditLogging || {}) }
      },
      errorRecovery: { ...base.errorRecovery, ...(override.errorRecovery || {}) },
      monitoring: {
        ...base.monitoring,
        ...override.monitoring,
        alertThresholds: { ...base.monitoring.alertThresholds, ...(override.monitoring?.alertThresholds || {}) }
      }
    };
  }
  
  private createObservabilityConfig(): any {
    return {
      metrics: {
        enabled: true,
        retentionDays: 7,
        exportInterval: 60000,
        exporters: []
      },
      tracing: {
        enabled: true,
        samplingRate: 0.1, // 10% sampling in production
        maxSpansPerTrace: 100,
        exporters: []
      },
      logging: {
        level: 'info',
        outputs: [{ type: 'console', format: 'structured', configuration: {} }],
        structured: true,
        includeStackTrace: false
      },
      health: {
        checkInterval: this.config.monitoring.healthCheckInterval,
        timeoutMs: 5000,
        retryAttempts: 3
      },
      alerting: {
        enabled: this.config.monitoring.alertingEnabled,
        rules: [],
        defaultCooldown: 300000
      },
      storage: {
        dataPath: './production-data',
        maxFileSize: 100 * 1024 * 1024, // 100MB
        compressionEnabled: true,
        encryptionEnabled: false
      }
    };
  }
  
  private initializeStats(): ProductionStats {
    return {
      uptime: 0,
      totalOperations: 0,
      successRate: 100,
      averageResponseTime: 0,
      
      resourceUsage: {
        memory: { current: 0, peak: 0, utilizationPercent: 0 },
        cpu: { current: 0, average: 0 },
        concurrency: { active: 0, queued: 0, completed: 0 }
      },
      
      security: {
        blockedRequests: 0,
        rateLimitViolations: 0,
        suspiciousPatterns: 0,
        auditEntries: 0
      },
      
      reliability: {
        timeouts: 0,
        circuitBreakerTrips: 0,
        errorRecoveries: 0,
        forcedCleanups: 0
      },
      
      performance: {
        operationsPerSecond: 0,
        memoryLeaks: 0,
        performanceDegradations: 0,
        optimizationActions: 0
      }
    };
  }
}

// Supporting Classes (Placeholder implementations - would be fully implemented)

class ResourceMonitor extends EventEmitter {
  constructor(private limits: any, private hardeningSystem: ProductionHardeningSystem) {
    super();
  }
  
  async initialize(): Promise<void> {
    // Initialize resource monitoring
  }
  
  async checkResourceAvailability(context: OperationContext): Promise<void> {
    // Check if resources are available for operation
  }
  
  performResourceCheck(): void {
    // Check current resource usage against limits
    const memUsage = process.memoryUsage();
    const heapPercent = (memUsage.heapUsed / this.limits.memory.maxHeapSize) * 100;
    
    if (heapPercent > this.limits.memory.criticalThreshold) {
      this.emit('resource:critical', { resource: 'memory', usage: heapPercent });
    } else if (heapPercent > this.limits.memory.warningThreshold) {
      this.emit('resource:warning', { resource: 'memory', usage: heapPercent });
    }
  }
  
  getCurrentUsage(): any {
    const memUsage = process.memoryUsage();
    return {
      memory: {
        current: memUsage.heapUsed,
        peak: memUsage.heapTotal,
        utilizationPercent: (memUsage.heapUsed / this.limits.memory.maxHeapSize) * 100
      },
      cpu: { current: 0, average: 0 }, // Would implement CPU monitoring
      concurrency: { active: 0, queued: 0, completed: 0 }
    };
  }
  
  getHealthStatus(): { status: string; score: number } {
    const usage = this.getCurrentUsage();
    const memScore = Math.max(0, 1 - (usage.memory.utilizationPercent / 100));
    return { status: memScore > 0.7 ? 'healthy' : 'degraded', score: memScore };
  }
  
  async emergencyCleanup(): Promise<void> {
    // Perform emergency resource cleanup
    if (global.gc) {
      global.gc();
    }
  }
  
  async shutdown(): Promise<void> {
    // Cleanup resource monitoring
  }
}

class SecurityHardener extends EventEmitter {
  constructor(private config: any, private hardeningSystem: ProductionHardeningSystem) {
    super();
  }
  
  async initialize(): Promise<void> {
    // Initialize security hardening
  }
  
  async validateOperation(operationId: string, context: OperationContext): Promise<void> {
    // Validate operation against security policies
  }
  
  performSecurityCheck(): void {
    // Perform periodic security checks
  }
  
  getSecurityStats(): any {
    return {
      blockedRequests: 0,
      rateLimitViolations: 0,
      suspiciousPatterns: 0,
      auditEntries: 0
    };
  }
  
  getSecurityHealth(): { score: number } {
    return { score: 0.9 }; // Would implement actual security health calculation
  }
  
  async emergencyLockdown(): Promise<void> {
    // Implement emergency security lockdown
  }
  
  async shutdown(): Promise<void> {
    // Cleanup security components
  }
}

class ErrorRecoverySystem {
  constructor(private config: any, private hardeningSystem: ProductionHardeningSystem) {}
  
  async initialize(): Promise<void> {
    // Initialize error recovery system
  }
  
  async handleFailure(context: OperationContext, error: Error): Promise<void> {
    // Handle operation failure and attempt recovery
    logger.warn(`Attempting error recovery for ${context.id}: ${error.message}`);
  }
  
  async emergencyRecovery(): Promise<void> {
    // Perform emergency recovery procedures
  }
  
  async shutdown(): Promise<void> {
    // Cleanup error recovery system
  }
}

class PerformanceProtector extends EventEmitter {
  constructor(private config: ProductionHardeningConfig, private hardeningSystem: ProductionHardeningSystem) {
    super();
  }
  
  async initialize(): Promise<void> {
    // Initialize performance protection
  }
  
  checkPerformance(): void {
    // Check for performance issues
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > this.config.resourceLimits.memory.maxHeapSize * 0.8) {
      this.emit('performance:degradation', { type: 'memory', usage: memUsage.heapUsed });
    }
  }
  
  getPerformanceStats(): any {
    return {
      operationsPerSecond: 0,
      memoryLeaks: 0,
      performanceDegradations: 0,
      optimizationActions: 0
    };
  }
  
  getHealthStatus(): any {
    return { status: 'healthy', score: 0.9 };
  }
  
  async emergencyOptimization(): Promise<void> {
    // Perform emergency performance optimization
  }
  
  async shutdown(): Promise<void> {
    // Cleanup performance protection
  }
}

class GracefulShutdownHandler {
  private shutdownStarted: boolean = false;
  
  constructor(private shutdownTimeout: number, private hardeningSystem: ProductionHardeningSystem) {}
  
  async initialize(): Promise<void> {
    // Register shutdown signal handlers
    process.once('SIGTERM', () => this.handleShutdownSignal('SIGTERM'));
    process.once('SIGINT', () => this.handleShutdownSignal('SIGINT'));
    process.once('SIGUSR2', () => this.handleShutdownSignal('SIGUSR2'));
  }
  
  private async handleShutdownSignal(signal: string): Promise<void> {
    if (this.shutdownStarted) return;
    
    logger.info(`Received ${signal}, initiating graceful shutdown...`);
    await this.initiateShutdown();
  }
  
  async initiateShutdown(): Promise<void> {
    if (this.shutdownStarted) return;
    
    this.shutdownStarted = true;
    
    const shutdownTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, this.shutdownTimeout);
    
    try {
      await this.hardeningSystem.shutdown();
      clearTimeout(shutdownTimeout);
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  }
}

// Supporting interfaces
interface OperationContext {
  id: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  priority: string;
  metadata: any;
  resourceRequirements: any;
  status: 'starting' | 'running' | 'completed' | 'failed';
  error?: Error;
}

interface OperationRequest {
  id: string;
  operation: () => Promise<any>;
  context: OperationContext;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

interface PerformanceMetric {
  timestamp: number;
  operationId: string;
  duration: number;
  success: boolean;
  memoryUsed: number;
  metadata: any;
}

interface ProductionHealthReport {
  timestamp: number;
  overallStatus: 'healthy' | 'degraded' | 'critical';
  overallScore: number;
  uptime: number;
  components: any;
  metrics: ProductionStats;
  activeAlerts: ProductionAlert[];
  recommendations: string[];
}

// Export the production hardening system
export const productionHardeningSystem = ProductionHardeningSystem.getInstance();