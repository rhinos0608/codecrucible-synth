/**
 * Shared types and enums for MCP discovery modules
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
  availabilityScore: number;
  mttr: number;
  mtbf: number;
  errorCount: number;
  successRate: number;
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
  probability: number;
  impact: number;
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

// Placeholder types for completeness
export interface HealthCheckStrategy {
  type: string;
}

export interface RecoveryThreshold {
  metric: string;
  value: number;
}

export interface RollbackPlan {
  steps: string[];
}

export interface MonitoringMetric {
  name: string;
}

export interface AlertThreshold {
  metric: string;
  threshold: number;
}

export interface DashboardConfig {
  url: string;
}

export interface ScalingTrigger {
  metric: string;
  threshold: number;
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
