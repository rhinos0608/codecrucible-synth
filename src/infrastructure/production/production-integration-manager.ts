import { EventEmitter } from 'events';

import { logger } from '../logging/logger.js';
import { ProductionHardeningSystem } from './production-hardening-system.js';
import { ProductionStats } from './hardening-types.js';
import {
  ProductionSecurityAuditLogger,
  SecurityEventType,
  SecuritySeverity,
} from '../security/production-security-audit-logger.js';
import {
  ProductionResourceEnforcer,
  ResourceType,
  ResourceSnapshot,
} from './production-resource-enforcer.js';
import { ObservabilitySystem } from '../observability/observability-system.js';

// Production Integration Configuration
export interface ProductionIntegrationConfig {
  // Component Enablement
  components: {
    hardeningSystem: boolean;
    securityAuditLogger: boolean;
    resourceEnforcer: boolean;
    observabilitySystem: boolean;
    emergencyProcedures: boolean;
  };

  // Integration Settings
  integration: {
    startupSequence: string[]; // Order of component initialization
    shutdownSequence: string[]; // Order of component shutdown
    healthCheckInterval: number; // Interval for integrated health checks
    emergencyResponseTime: number; // Max time for emergency response
    coordinationEnabled: boolean; // Enable inter-component coordination
  };

  // Operational Thresholds
  thresholds: {
    systemHealthScore: number; // Minimum overall system health score
    emergencyTriggerScore: number; // Score that triggers emergency mode
    performanceBaseline: {
      maxResponseTime: number; // Maximum acceptable response time
      minThroughput: number; // Minimum operations per second
      maxErrorRate: number; // Maximum error rate percentage
    };
  };

  // Enterprise Features
  enterprise: {
    highAvailabilityMode: boolean; // Enable HA features
    disasterRecoveryEnabled: boolean; // Enable DR procedures
    complianceReportingEnabled: boolean; // Enable compliance features
    auditTrailEnabled: boolean; // Enable comprehensive audit trails
    performanceOptimizationEnabled: boolean; // Enable auto-optimization
  };
}

// Integrated System Health Status
export interface IntegratedSystemHealth {
  timestamp: number;
  overallStatus: 'healthy' | 'degraded' | 'critical' | 'emergency';
  overallScore: number;

  components: {
    hardeningSystem: ComponentHealth;
    securityAuditLogger: ComponentHealth;
    resourceEnforcer: ComponentHealth;
    observabilitySystem: ComponentHealth;
  };

  systemMetrics: {
    uptime: number;
    totalOperations: number;
    successRate: number;
    avgResponseTime: number;
    currentThroughput: number;
  };

  alerts: {
    active: number;
    critical: number;
    warnings: number;
    lastAlert?: string;
  };

  recommendations: SystemRecommendation[];
}

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'critical' | 'offline';
  lastChecked: number;
  uptime: number;
  metrics: any;
  issues: string[];
}

interface SystemRecommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'performance' | 'security' | 'reliability' | 'compliance';
  description: string;
  action: string;
  estimatedImpact: string;
}

// Production Operation Context
export interface ProductionOperationContext {
  operationId: string;
  startTime: number;
  endTime?: number;
  duration?: number;

  // Component tracking
  componentStates: {
    hardeningApplied: boolean;
    securityAudited: boolean;
    resourcesEnforced: boolean;
    observabilityTracked: boolean;
  };

  // Performance tracking
  performance: {
    responseTime: number;
    memoryUsed: number;
    cpuUsed: number;
    resourceEfficiency: number;
  };

import { ProductionIntegrationConfig, IntegratedSystemHealth } from './production-types.js';
import { DeploymentOrchestrator } from './deployment-orchestrator.js';
import { EnvironmentManager } from './environment-manager.js';
import { HealthMonitoring } from './health-monitoring.js';
import { ScalingCoordinator } from './scaling-coordinator.js';
import { SecurityIntegration } from './security-integration.js';
import { BackupCoordinator } from './backup-coordinator.js';
import { MetricsCollector } from './metrics-collector.js';
import { RollbackManager } from './rollback-manager.js';


export class ProductionIntegrationManager extends EventEmitter {
  private static instance?: ProductionIntegrationManager;
  private readonly orchestrator: DeploymentOrchestrator;
  private readonly env: EnvironmentManager;
  private readonly health: HealthMonitoring;

  private constructor(private readonly config: ProductionIntegrationConfig) {
    super();
    this.env = new EnvironmentManager(config);
    this.health = new HealthMonitoring();
    const scaling = new ScalingCoordinator();
    const security = new SecurityIntegration();
    const backup = new BackupCoordinator();
    const metrics = new MetricsCollector();
    const rollback = new RollbackManager();
    this.orchestrator = new DeploymentOrchestrator(
      this.env,
      this.health,
      scaling,
      security,
      backup,
      metrics,
      rollback
    );
  }

  static getInstance(config: ProductionIntegrationConfig): ProductionIntegrationManager {
    if (!this.instance) {
      this.instance = new ProductionIntegrationManager(config);
    }
    return this.instance;
  }

  async initializeProductionSystem(): Promise<void> {
    this.emit('initialize:start');
    await this.getIntegratedSystemHealth();
    this.emit('initialize:completed');
  }

  async getIntegratedSystemHealth(): Promise<IntegratedSystemHealth> {
    const health = await this.health.checkHealth();
    this.emit('health-check-completed', health);
    if (health.overallStatus === 'emergency') {
      this.emit('emergency:activated', health);
    }
    return health;
  }

  async shutdownProductionSystem(): Promise<void> {
    this.emit('shutdown:start');
    this.emit('shutdown:completed');
  }


  // Private Implementation Methods

  private async initializeComponents(): Promise<void> {
    for (const componentName of this.config.integration.startupSequence) {
      if (this.config.components[componentName as keyof typeof this.config.components]) {
        logger.info(`Initializing component: ${componentName}`);

        try {
          await this.initializeComponent(componentName);
          logger.info(`✅ ${componentName} initialized successfully`);
        } catch (error) {
          logger.error(`❌ Failed to initialize ${componentName}:`, error);
          throw error;
        }
      }
    }
  }

  private async initializeComponent(componentName: string): Promise<void> {
    switch (componentName) {
      case 'resourceEnforcer':
        this.resourceEnforcer = new ProductionResourceEnforcer();
        this.resourceEnforcer.start();
        break;

      case 'securityAuditLogger':
        this.securityAuditLogger = ProductionSecurityAuditLogger.getInstance();
        await this.securityAuditLogger.initialize();
        break;

      case 'hardeningSystem':
        this.hardeningSystem = ProductionHardeningSystem.getInstance();
        await this.hardeningSystem.initialize();
        break;

      case 'observabilitySystem':
        // Create observability config
        const observabilityConfig = {
          telemetry: { enabled: true, endpoint: 'http://localhost:4318', exporters: [] as any[] },
          metrics: {
            enabled: true,
            retentionDays: 7,
            exportInterval: 60000,
            exporters: [] as any[],
          },
          tracing: {
            enabled: true,
            samplingRate: 0.1,
            maxSpansPerTrace: 100,
            exporters: [] as any[],
          },
          logging: {
            level: 'info',
            outputs: [{ type: 'console', format: 'structured', configuration: {} }],
            structured: true,
            includeStackTrace: false,
          },
          health: { checkInterval: 30000, timeoutMs: 5000, retryAttempts: 3 },
          alerting: { enabled: true, rules: [] as any[], defaultCooldown: 300000 },
          storage: {
            dataPath: './production-observability-data',
            maxFileSize: 100 * 1024 * 1024,
            compressionEnabled: true,
            encryptionEnabled: false,
          },
        };

        this.observabilitySystem = new ObservabilitySystem(observabilityConfig);
        await this.observabilitySystem.initialize();
        break;

      default:
        logger.warn(`Unknown component: ${componentName}`);
    }
  }

  private async shutdownComponent(componentName: string): Promise<void> {
    logger.info(`Shutting down component: ${componentName}`);

    switch (componentName) {
      case 'resourceEnforcer':
        if (this.resourceEnforcer) {

          this.resourceEnforcer.stop();

          await this.resourceEnforcer.stop();

        }
        break;

      case 'securityAuditLogger':
        if (this.securityAuditLogger) {
          await this.securityAuditLogger.shutdown();
        }
        break;

      case 'hardeningSystem':
        if (this.hardeningSystem) {
          await this.hardeningSystem.shutdown();
        }
        break;

      case 'observabilitySystem':
        if (this.observabilitySystem) {
          await this.observabilitySystem.shutdown();
        }
        break;
    }
  }

  private setupComponentCoordination(): void {
    // Resource enforcer events
    if (this.resourceEnforcer) {
      this.resourceEnforcer.on('emergency-cleanup', violation => {
        this.triggerEmergencyMode(`Resource emergency: ${violation.message}`, 'resource-enforcer');
      });

      this.resourceEnforcer.on('resource-violation', violation => {
        if (this.securityAuditLogger) {
          this.securityAuditLogger.logSecurityEvent({
            eventType: SecurityEventType.RESOURCE_EXHAUSTION,
            severity: SecuritySeverity.HIGH,
            context: {
              environment: (process.env.NODE_ENV as any) || 'development',
              sessionId: this.generateSessionId(),
            },
            description: `Resource violation detected: ${violation.resourceType}`,
            source: 'resource-enforcer',
            details: violation,
          });
        }
      });
    }

    // Security audit logger events
    if (this.securityAuditLogger) {
      this.securityAuditLogger.on('high-severity-alert', event => {
        if (event.severity === SecuritySeverity.CRITICAL) {
          this.triggerEmergencyMode(
            `Critical security event: ${event.description}`,
            'security-audit-logger'
          );
        }
      });
    }

    // Hardening system events
    if (this.hardeningSystem) {
      this.hardeningSystem.on('emergency:activated', alert => {
        logger.warn('Emergency mode activated by hardening system', alert);
      });
    }

    logger.info('✅ Component coordination configured');
  }

  private startIntegratedMonitoring(): void {
    // Integrated health checks
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performIntegratedHealthCheck();
      } catch (error) {
        logger.error('Integrated health check failed:', error);
      }
    }, this.config.integration.healthCheckInterval);

    // Performance monitoring
    this.performanceMonitoringInterval = setInterval(() => {
      this.updateIntegratedPerformanceMetrics();
    }, 10000); // Every 10 seconds

    logger.info('🔍 Integrated monitoring started');
  }

  private stopIntegratedMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (this.performanceMonitoringInterval) {
      clearInterval(this.performanceMonitoringInterval);
      this.performanceMonitoringInterval = undefined;
    }
  }

  private async performIntegratedHealthCheck(): Promise<void> {
    const healthData = await this.getIntegratedSystemHealth();
    this.lastHealthCheck = Date.now();

    // Check if emergency action needed
    if (healthData.overallScore < this.config.thresholds.emergencyTriggerScore) {
      await this.triggerEmergencyMode(
        `System health critically degraded (score: ${healthData.overallScore})`,
        'integrated-health-check'
      );
    }

    this.emit('health-check-completed', healthData);
  }

  private updateIntegratedPerformanceMetrics(): void {
    // Update integration statistics
    const currentTime = Date.now();
    const uptime = currentTime - this.systemStartTime;

    this.integrationStats.systemUptime = uptime;
    this.integrationStats.lastUpdateTime = currentTime;

    // Calculate throughput
    this.integrationStats.currentThroughput = this.calculateCurrentThroughput();

    this.emit('performance-metrics-updated', this.integrationStats);
  }

  private createOperationContext(operationId: string, options: any): ProductionOperationContext {
    return {
      operationId,
      startTime: Date.now(),

      componentStates: {
        hardeningApplied: false,
        securityAudited: false,
        resourcesEnforced: false,
        observabilityTracked: false,
      },

      performance: {
        responseTime: 0,
        memoryUsed: 0,
        cpuUsed: 0,
        resourceEfficiency: 0,
      },

      security: {
        threatsDetected: 0,
        securityViolations: [],
      },

      status: 'initializing',
      metadata: options.metadata || {},
    };
  }

  private async recordOperationCompletion(
    context: ProductionOperationContext,
    success: boolean
  ): Promise<void> {
    // Update integration statistics
    this.integrationStats.totalOperations++;
    if (success) {
      this.integrationStats.successfulOperations++;
    } else {
      this.integrationStats.failedOperations++;
    }

    // Update success rate
    this.integrationStats.successRate =
      (this.integrationStats.successfulOperations / this.integrationStats.totalOperations) * 100;

    // Update average response time
    if (context.duration) {
      this.integrationStats.avgResponseTime =
        this.integrationStats.avgResponseTime * 0.9 + context.duration * 0.1;
    }

    // Security audit - post-execution
    if (this.config.components.securityAuditLogger && context.security.auditTrailId) {
      await this.securityAuditLogger.logSecurityEvent({
        eventType: success ? SecurityEventType.SYSTEM_START : SecurityEventType.SECURITY_ALERT,
        severity: success ? SecuritySeverity.INFO : SecuritySeverity.MEDIUM,
        context: {
          environment: (process.env.NODE_ENV as any) || 'development',
          sessionId: this.generateSessionId(),
          operationId: context.operationId,
        },
        description: `Operation ${success ? 'completed' : 'failed'}: ${context.operationId}`,
        source: 'production-integration-manager',
        details: {
          duration: context.duration,
          componentStates: context.componentStates,
          performance: context.performance,
        },
      });
    }

    this.emit('operation-completed', { context, success });
  }

  private async handleOperationFailure(
    context: ProductionOperationContext,
    error: Error
  ): Promise<void> {
    await this.recordOperationCompletion(context, false);

    // Log failure details
    logger.error(`Operation failed: ${context.operationId}`, {
      error: error.message,
      duration: context.duration,
      componentStates: context.componentStates,
    });

    this.emit('operation-failed', { context, error });
  }

  private async handleInitializationFailure(error: Error): Promise<void> {
    logger.error('Production system initialization failed:', error);

    // Attempt partial cleanup

  async executeWithProductionHardening(): Promise<IntegratedSystemHealth> {

    try {
      return await this.orchestrator.deploy(this.config);
    } catch (error) {

      return {
        status: 'critical',
        lastChecked: now,
        uptime: 0,
        metrics: {},
        issues: [`Health check failed: ${(error as Error).message}`],
      };
    }
  }

  private createOfflineHealth(componentName: string): ComponentHealth {
    return {
      status: 'offline',
      lastChecked: Date.now(),
      uptime: 0,
      metrics: {},
      issues: [`${componentName} not initialized`],
    };
  }

  private getHealthScore(status: string): number {
    const scores: { [key: string]: number } = {
      healthy: 1.0,
      degraded: 0.6,
      critical: 0.2,
      offline: 0.0,
    };
    return scores[status] || 0.0;
  }

  private determineOverallStatus(score: number): 'healthy' | 'degraded' | 'critical' | 'emergency' {
    if (this.emergencyMode) return 'emergency';
    if (score >= 0.8) return 'healthy';
    if (score >= 0.5) return 'degraded';
    return 'critical';
  }

  private calculateCurrentThroughput(): number {
    // Calculate operations per second over the last minute
    const oneMinuteAgo = Date.now() - 60000;
    const recentOperations = Array.from(this.activeOperations.values()).filter(
      op => op.startTime >= oneMinuteAgo
    ).length;

    return recentOperations / 60; // Operations per second
  }

  private async getAlertSummary(): Promise<any> {
    const alerts = { active: 0, critical: 0, warnings: 0 };

    if (this.config.components.hardeningSystem && this.hardeningSystem) {
      const hardeningAlerts = this.hardeningSystem.getActiveAlerts();
      alerts.active += hardeningAlerts.length;
    }

    return alerts;
  }

  private generateSystemRecommendations(
    components: any,
    systemMetrics: any,
    overallScore: number
  ): SystemRecommendation[] {
    const recommendations: SystemRecommendation[] = [];

    if (overallScore < 0.7) {
      recommendations.push({
        priority: 'high',
        category: 'reliability',
        description: 'System health score below recommended threshold',
        action: 'Investigate component health issues and optimize system performance',
        estimatedImpact: 'Improved system reliability and performance',
      });
    }

    if (systemMetrics.successRate < 95) {
      recommendations.push({
        priority: 'medium',
        category: 'reliability',
        description: `Success rate below target (${systemMetrics.successRate.toFixed(1)}%)`,
        action: 'Analyze failed operations and improve error handling',
        estimatedImpact: 'Increased operation success rate',
      });
    }

    if (
      systemMetrics.avgResponseTime > this.config.thresholds.performanceBaseline.maxResponseTime
    ) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        description: 'Average response time exceeds baseline',
        action: 'Optimize performance bottlenecks and resource usage',
        estimatedImpact: 'Reduced response time and improved user experience',
      });
    }

    return recommendations;
  }

  private mapPriorityToNumber(priority: string): number {
    const mapping: { [key: string]: number } = { low: 25, medium: 50, high: 75, critical: 100 };
    return mapping[priority] || 50;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  // Compliance reporting helper methods

  private calculateOverallCompliance(
    securityReport: any,
    systemHealth: any,
    performanceData: any
  ): number {
    // Simplified compliance calculation
    const securityScore = securityReport.riskAssessment?.averageRiskScore
      ? 100 - securityReport.riskAssessment.averageRiskScore
      : 80;
    const healthScore = systemHealth.overallScore * 100;
    const performanceScore = performanceData.complianceScore || 85;

    return (securityScore + healthScore + performanceScore) / 3;
  }

  private getCriticalFindings(securityReport: any, systemHealth: any): string[] {
    const findings: string[] = [];

    if (systemHealth.overallStatus === 'critical') {
      findings.push('System health in critical state');
    }

    if (securityReport.summary?.criticalEvents > 0) {
      findings.push(`${securityReport.summary.criticalEvents} critical security events`);
    }

    return findings;
  }

  private getComplianceRecommendations(
    framework: string,
    securityReport: any,
    systemHealth: any
  ): string[] {
    const recommendations: string[] = [];

    recommendations.push('Maintain continuous monitoring and alerting');
    recommendations.push('Regular security assessments and vulnerability scans');
    recommendations.push('Implement automated compliance checking');

    return recommendations;
  }

  private calculateAvailability(dateRange: { start: number; end: number }): number {
    // Calculate system availability percentage
    const totalTime = dateRange.end - dateRange.start;
    const downtime = 0; // Would calculate actual downtime

    return ((totalTime - downtime) / totalTime) * 100;
  }

  private calculateReliability(dateRange: { start: number; end: number }): number {
    // Calculate system reliability metrics
    return this.integrationStats.successRate;
  }

  private getPerformanceComplianceData(dateRange: { start: number; end: number }): any {
    return {
      complianceScore: 85,
      averageResponseTime: this.integrationStats.avgResponseTime,
      throughput: this.integrationStats.currentThroughput,
      errorRate: 100 - this.integrationStats.successRate,
    };
  }

  private getSystemEventsSummary(dateRange: { start: number; end: number }): any {
    return {
      totalEvents: this.integrationStats.totalOperations,
      successfulOperations: this.integrationStats.successfulOperations,
      failedOperations: this.integrationStats.failedOperations,
    };
  }

  private getComplianceEventsSummary(
    framework: string,
    dateRange: { start: number; end: number }
  ): any {
    return {
      framework,
      eventsTracked: this.integrationStats.totalOperations,
      complianceViolations: 0, // Would track actual violations
    };
  }

  private getInfrastructureCompliance(): any {
    return {
      hardeningEnabled: this.config.components.hardeningSystem,
      securityAuditingEnabled: this.config.components.securityAuditLogger,
      resourceEnforcementEnabled: this.config.components.resourceEnforcer,
      observabilityEnabled: this.config.components.observabilitySystem,
    };
  }

  private getDataProtectionCompliance(): any {
    return {
      encryptionInTransit: true,
      encryptionAtRest: false, // Would configure in production
      dataRetention: '30 days',
      dataMinimization: true,
    };
  }

  private getAccessControlCompliance(): any {
    return {
      authenticationEnabled: true,
      authorizationEnabled: true,
      auditLoggingEnabled: this.config.components.securityAuditLogger,
      privilegeManagement: true,
    };
  }

  private generateComplianceActionPlan(
    framework: string,
    securityReport: any,
    systemHealth: any
  ): string[] {
    return [
      'Implement regular compliance assessments',
      'Enhance security monitoring and alerting',
      'Maintain comprehensive audit trails',
      'Regular system health monitoring',
      'Continuous improvement of security posture',
    ];
  }

  private calculateReportIntegrity(
    securityReport: any,
    systemHealth: any,
    performanceData: any
  ): string {
    // Would implement actual integrity verification
    return 'verified';
  }

  private getCertificationLevel(framework: string): string {
    // Would determine based on actual compliance assessment
    return 'standard';
  }

  private createDefaultConfig(
    override?: Partial<ProductionIntegrationConfig>
  ): ProductionIntegrationConfig {
    const defaultConfig: ProductionIntegrationConfig = {
      components: {
        hardeningSystem: true,
        securityAuditLogger: true,
        resourceEnforcer: true,
        observabilitySystem: true,
        emergencyProcedures: true,
      },

      integration: {
        startupSequence: [
          'resourceEnforcer',
          'securityAuditLogger',
          'observabilitySystem',
          'hardeningSystem',
        ],
        shutdownSequence: [
          'hardeningSystem',
          'observabilitySystem',
          'securityAuditLogger',
          'resourceEnforcer',
        ],
        healthCheckInterval: 30000,
        emergencyResponseTime: 60000,
        coordinationEnabled: true,
      },

      thresholds: {
        systemHealthScore: 0.7,
        emergencyTriggerScore: 0.3,
        performanceBaseline: {
          maxResponseTime: 5000,
          minThroughput: 1.0,
          maxErrorRate: 5.0,
        },
      },

      enterprise: {
        highAvailabilityMode: true,
        disasterRecoveryEnabled: false,
        complianceReportingEnabled: true,
        auditTrailEnabled: true,
        performanceOptimizationEnabled: true,
      },
    };

    return override ? this.deepMerge(defaultConfig, override) : defaultConfig;
  }

  private deepMerge(base: any, override: any): any {
    const result = { ...base };

    for (const key in override) {
      if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
        result[key] = this.deepMerge(base[key] || {}, override[key]);
      } else {
        result[key] = override[key];
      }

      this.emit('operation-failed', { context: { operationId: 'deploy' }, error });
      throw error;

    }
  }
}
