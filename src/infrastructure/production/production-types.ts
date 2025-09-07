import { ProductionAlert } from './production-hardening-system.js';

export { ProductionAlert };

export interface ProductionIntegrationConfig {
  components: {
    hardeningSystem: boolean;
    securityAuditLogger: boolean;
    resourceEnforcer: boolean;
    observabilitySystem: boolean;
    emergencyProcedures: boolean;
  };
  integration: {
    startupSequence: string[];
    shutdownSequence: string[];
    healthCheckInterval: number;
    emergencyResponseTime: number;
    coordinationEnabled: boolean;
  };
  thresholds: {
    systemHealthScore: number;
    emergencyTriggerScore: number;
    performanceBaseline: {
      maxResponseTime: number;
      minThroughput: number;
      maxErrorRate: number;
    };
  };
  enterprise: {
    highAvailabilityMode: boolean;
    disasterRecoveryEnabled: boolean;
    complianceReportingEnabled: boolean;
    auditTrailEnabled: boolean;
    performanceOptimizationEnabled: boolean;
  };
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'critical' | 'offline';
  lastChecked: number;
  uptime: number;
  metrics: any;
  issues: string[];
}

export interface SystemRecommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'performance' | 'security' | 'reliability' | 'compliance';
  description: string;
  action: string;
  estimatedImpact: string;
}

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
    lastAlert?: ProductionAlert;
  };
  recommendations: SystemRecommendation[];
}

export interface ProductionOperationContext {
  operationId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  componentStates: {
    hardeningApplied: boolean;
    securityAudited: boolean;
    resourcesEnforced: boolean;
    observabilityTracked: boolean;
  };
  performance: {
    responseTime: number;
    memoryUsed: number;
    cpuUsed: number;
    resourceEfficiency: number;
  };
  security: {
    threatsDetected: number;
    securityViolations: string[];
    auditTrailId?: string;
  };
  status: 'initializing' | 'running' | 'completed' | 'failed' | 'emergency';
  metadata: any;
}
