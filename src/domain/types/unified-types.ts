/**
 * Unified Type System for CodeCrucible Synth
 * 
 * Consolidates and organizes all type definitions following domain-driven design:
 * - Core domain types (business logic)
 * - Application types (use cases)
 * - Infrastructure types (external concerns)
 * - Value objects and entities
 */

// ============================================================================
// CORE DOMAIN TYPES - Business Logic and Domain Models
// ============================================================================

/**
 * Core entity types representing business objects
 */
export interface CodeCrucibleEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface Project extends CodeCrucibleEntity {
  name: string;
  workingDirectory: string;
  language: string[];
  framework?: string;
  dependencies: ProjectDependency[];
  configuration: ProjectConfiguration;
  metadata: ProjectMetadata;
}

export interface ProjectDependency {
  name: string;
  version: string;
  type: 'runtime' | 'development' | 'peer';
  source: 'npm' | 'maven' | 'pip' | 'cargo' | 'go' | 'nuget';
}

export interface ProjectConfiguration {
  buildTool?: string;
  testFramework?: string;
  linting: boolean;
  formatting: boolean;
  cicd: boolean;
  security: SecurityPolicy;
}

export interface ProjectMetadata {
  totalFiles: number;
  totalLines: number;
  languageDistribution: Record<string, number>;
  complexity: ComplexityMetrics;
  quality: QualityMetrics;
}

/**
 * AI Model and Provider domain types
 */
export interface ModelProvider extends CodeCrucibleEntity {
  name: string;
  type: ProviderType;
  endpoint: string;
  isAvailable: boolean;
  models: AIModel[];
  capabilities: ProviderCapabilities;
  metrics: ProviderMetrics;
  configuration: ProviderConfiguration;
}

export type ProviderType = 'ollama' | 'lm-studio' | 'huggingface' | 'openai' | 'anthropic' | 'google';

export interface AIModel {
  id: string;
  name: string;
  displayName: string;
  contextLength: number;
  capabilities: ModelCapabilities;
  performance: ModelPerformance;
  specialization: ModelSpecialization[];
}

export interface ModelCapabilities {
  completion: boolean;
  chat: boolean;
  tools: boolean;
  vision: boolean;
  code: boolean;
  streaming: boolean;
  functionCalling: boolean;
}

export interface ModelPerformance {
  averageLatency: number;
  tokensPerSecond: number;
  qualityScore: number;
  reliability: number;
  costPerToken?: number;
}

export type ModelSpecialization = 'coding' | 'analysis' | 'writing' | 'reasoning' | 'math' | 'research';

export interface ProviderCapabilities {
  maxConcurrentRequests: number;
  supportsStreaming: boolean;
  supportsBatch: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  rateLimits: RateLimit;
}

export interface RateLimit {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerDay?: number;
}

export interface ProviderConfiguration {
  apiKey?: string;
  timeout: number;
  retries: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  priority: number;
  enabled: boolean;
}

/**
 * Voice Archetype System domain types
 */
export interface VoiceArchetype extends CodeCrucibleEntity {
  name: string;
  specialization: VoiceSpecialization;
  characteristics: VoiceCharacteristics;
  systemPrompt: string;
  performance: VoicePerformance;
  configuration: VoiceConfiguration;
}

export type VoiceSpecialization = 
  | 'exploration' 
  | 'maintenance' 
  | 'security' 
  | 'architecture' 
  | 'development' 
  | 'analysis' 
  | 'optimization' 
  | 'design' 
  | 'testing' 
  | 'documentation';

export interface VoiceCharacteristics {
  creativity: number; // 0-1
  precision: number; // 0-1
  riskTolerance: number; // 0-1
  collaborationStyle: 'leader' | 'supporter' | 'challenger' | 'mediator';
  thinkingStyle: 'analytical' | 'intuitive' | 'systematic' | 'creative';
}

export interface VoicePerformance {
  qualityScore: number;
  responseTime: number;
  consistency: number;
  userSatisfaction: number;
  taskSuccessRate: number;
}

export interface VoiceConfiguration {
  temperature: number;
  maxTokens: number;
  model: string;
  provider: string;
  enabled: boolean;
  priority: number;
}

/**
 * Living Spiral methodology types
 */
export interface LivingSpiralProcess extends CodeCrucibleEntity {
  phase: SpiralPhase;
  iterations: SpiralIteration[];
  convergenceCriteria: ConvergenceCriteria;
  qualityGates: QualityGate[];
  currentState: ProcessState;
}

export type SpiralPhase = 'collapse' | 'council' | 'synthesis' | 'rebirth' | 'reflection';

export interface SpiralIteration {
  number: number;
  phase: SpiralPhase;
  input: any;
  output: any;
  qualityScore: number;
  feedback: string[];
  improvementAreas: string[];
  timestamp: Date;
  duration: number;
}

export interface ConvergenceCriteria {
  qualityThreshold: number;
  maxIterations: number;
  improvementThreshold: number;
  consensusRequired: boolean;
  voiceAgreementThreshold: number;
}

export interface QualityGate {
  name: string;
  type: 'automated' | 'manual' | 'hybrid';
  criteria: QualityCriterion[];
  threshold: number;
  blocking: boolean;
}

export interface QualityCriterion {
  name: string;
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold: number | string;
  weight: number;
}

export type ProcessState = 'initializing' | 'running' | 'converging' | 'completed' | 'failed' | 'paused';

// ============================================================================
// APPLICATION LAYER TYPES - Use Cases and Application Services
// ============================================================================

/**
 * Request/Response types for application services
 */
export interface CodeGenerationRequest {
  id: string;
  prompt: string;
  context: GenerationContext;
  options: GenerationOptions;
  requirements: GenerationRequirements;
}

export interface GenerationContext {
  projectId: string;
  workingDirectory: string;
  targetFiles: string[];
  existingCode?: string;
  framework?: string;
  language: string;
  dependencies: ProjectDependency[];
  constraints: GenerationConstraints;
}

export interface GenerationOptions {
  voices: string[];
  maxTokens: number;
  temperature: number;
  streaming: boolean;
  iterativeImprovement: boolean;
  qualityThreshold: number;
  timeoutMs: number;
}

export interface GenerationRequirements {
  functionality: string[];
  qualityAttributes: QualityAttribute[];
  constraints: string[];
  testRequirements: TestRequirement[];
  documentationLevel: 'none' | 'minimal' | 'standard' | 'comprehensive';
}

export interface QualityAttribute {
  name: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  measurable: boolean;
  criteria: string;
}

export interface TestRequirement {
  type: 'unit' | 'integration' | 'e2e' | 'performance' | 'security';
  coverage: number;
  framework?: string;
  required: boolean;
}

export interface GenerationConstraints {
  maxFileSize: number;
  allowedLanguages: string[];
  forbiddenPatterns: string[];
  securityLevel: SecurityLevel;
  performanceRequirements: PerformanceRequirement[];
}

export interface PerformanceRequirement {
  metric: 'response_time' | 'throughput' | 'memory_usage' | 'cpu_usage';
  threshold: number;
  unit: string;
}

export interface CodeGenerationResponse {
  id: string;
  success: boolean;
  result?: GenerationResult;
  error?: ApplicationError;
  metadata: ResponseMetadata;
}

export interface GenerationResult {
  code: string;
  explanation: string;
  quality: QualityAssessment;
  tests?: string;
  documentation?: string;
  iterationsPerformed: number;
  voicesUsed: string[];
  improvementHistory: ImprovementStep[];
}

export interface QualityAssessment {
  overallScore: number;
  dimensions: QualityDimension[];
  recommendations: string[];
  passedGates: string[];
  failedGates: string[];
}

export interface QualityDimension {
  name: string;
  score: number;
  weight: number;
  feedback: string;
  suggestions: string[];
}

export interface ImprovementStep {
  iteration: number;
  changes: string;
  qualityImprovement: number;
  feedback: string;
  voice: string;
}

/**
 * Analysis and Intelligence types
 */
export interface AnalysisRequest {
  id: string;
  type: AnalysisType;
  target: AnalysisTarget;
  options: AnalysisOptions;
}

export type AnalysisType = 
  | 'code_quality' 
  | 'security' 
  | 'performance' 
  | 'architecture' 
  | 'dependencies' 
  | 'complexity' 
  | 'maintainability' 
  | 'test_coverage'
  | 'technical_debt';

export interface AnalysisTarget {
  type: 'file' | 'directory' | 'project' | 'function' | 'class' | 'module';
  path: string;
  content?: string;
  language?: string;
}

export interface AnalysisOptions {
  depth: 'surface' | 'detailed' | 'comprehensive';
  includeRecommendations: boolean;
  includeMetrics: boolean;
  customRules?: AnalysisRule[];
}

export interface AnalysisRule {
  id: string;
  name: string;
  pattern: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
}

export interface AnalysisResponse {
  id: string;
  type: AnalysisType;
  results: AnalysisResult[];
  summary: AnalysisSummary;
  recommendations: Recommendation[];
  metadata: ResponseMetadata;
}

export interface AnalysisResult {
  category: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  location?: CodeLocation;
  suggestion?: string;
  ruleId?: string;
  metrics?: Record<string, number>;
}

export interface CodeLocation {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface AnalysisSummary {
  totalIssues: number;
  issuesByCategory: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  overallScore: number;
  healthStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  effort: 'trivial' | 'low' | 'medium' | 'high' | 'very_high';
  impact: 'low' | 'medium' | 'high' | 'very_high';
  actionItems: ActionItem[];
}

export interface ActionItem {
  description: string;
  type: 'refactor' | 'add' | 'remove' | 'modify' | 'configure';
  automated: boolean;
  estimatedEffort: string;
}

// ============================================================================
// INFRASTRUCTURE TYPES - Technical and External Concerns
// ============================================================================

/**
 * Security types
 */
export type SecurityLevel = 'low' | 'medium' | 'high' | 'strict';

export interface SecurityPolicy {
  level: SecurityLevel;
  inputValidation: boolean;
  outputSanitization: boolean;
  commandRestrictions: string[];
  fileAccessRestrictions: string[];
  networkAccessPolicy: NetworkPolicy;
  auditLogging: boolean;
}

export interface NetworkPolicy {
  allowed: boolean;
  allowedDomains: string[];
  blockedDomains: string[];
  allowedPorts: number[];
  requiresTLS: boolean;
}

/**
 * Performance and metrics types
 */
export interface ProviderMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  totalLatency: number;
  errorRate: number;
  lastError?: string;
  uptime: number;
  lastUpdated: Date;
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  linesOfCode: number;
  technicalDebt: TechnicalDebt;
  maintainabilityIndex: number;
}

export interface TechnicalDebt {
  totalHours: number;
  category: Record<string, number>;
  priority: Record<string, number>;
  trend: 'improving' | 'stable' | 'worsening';
}

export interface QualityMetrics {
  codeQuality: number;
  testCoverage: number;
  documentation: number;
  security: number;
  performance: number;
  maintainability: number;
  reliability: number;
}

/**
 * Configuration types
 */
export interface SystemConfiguration {
  app: ApplicationConfiguration;
  models: ModelConfiguration;
  voices: VoiceSystemConfiguration;
  tools: ToolConfiguration;
  security: SecurityConfiguration;
  performance: PerformanceConfiguration;
  infrastructure: InfrastructureConfiguration;
}

export interface ApplicationConfiguration {
  name: string;
  version: string;
  environment: 'development' | 'testing' | 'staging' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  features: FeatureFlag[];
}

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  rollout: number; // 0-100 percentage
  conditions?: FeatureCondition[];
}

export interface FeatureCondition {
  type: 'user' | 'environment' | 'time' | 'random';
  operator: '==' | '!=' | 'in' | 'not_in' | '>' | '<';
  value: any;
}

export interface ModelConfiguration {
  defaultProvider: string;
  defaultModel: string;
  providers: ProviderConfiguration[];
  routing: ModelRoutingConfiguration;
  fallback: FallbackConfiguration;
}

export interface ModelRoutingConfiguration {
  strategy: 'round_robin' | 'least_latency' | 'quality_based' | 'load_balanced';
  healthCheckInterval: number;
  failoverThreshold: number;
}

export interface FallbackConfiguration {
  enabled: boolean;
  chain: string[];
  maxRetries: number;
  backoffMs: number;
}

export interface VoiceSystemConfiguration {
  enabled: boolean;
  defaultVoices: string[];
  maxConcurrentVoices: number;
  consensusThreshold: number;
  voices: Record<string, VoiceConfiguration>;
}

export interface ToolConfiguration {
  enabled: boolean;
  discoveryPaths: string[];
  maxConcurrentExecutions: number;
  timeoutMs: number;
  sandbox: SandboxConfiguration;
}

export interface SandboxConfiguration {
  enabled: boolean;
  type: 'docker' | 'vm' | 'process' | 'chroot';
  resourceLimits: ResourceLimits;
  networkIsolation: boolean;
  fileSystemIsolation: boolean;
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxDiskMB: number;
  maxExecutionTimeMs: number;
  maxFileDescriptors: number;
}

export interface SecurityConfiguration {
  enabled: boolean;
  level: SecurityLevel;
  policies: SecurityPolicy[];
  auditing: AuditConfiguration;
  encryption: EncryptionConfiguration;
}

export interface AuditConfiguration {
  enabled: boolean;
  logLevel: 'minimal' | 'standard' | 'detailed' | 'comprehensive';
  retention: AuditRetention;
  destinations: AuditDestination[];
}

export interface AuditRetention {
  days: number;
  maxSizeMB: number;
  compressionEnabled: boolean;
}

export interface AuditDestination {
  type: 'file' | 'database' | 'syslog' | 'http';
  configuration: Record<string, any>;
  enabled: boolean;
}

export interface EncryptionConfiguration {
  enabled: boolean;
  algorithm: string;
  keyRotationIntervalDays: number;
  encryptAtRest: boolean;
  encryptInTransit: boolean;
}

export interface PerformanceConfiguration {
  caching: CacheConfiguration;
  pooling: PoolConfiguration;
  optimization: OptimizationConfiguration;
  monitoring: MonitoringConfiguration;
}

export interface CacheConfiguration {
  enabled: boolean;
  type: 'memory' | 'redis' | 'file';
  maxSizeMB: number;
  ttlSeconds: number;
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'random';
}

export interface PoolConfiguration {
  connections: ConnectionPoolConfiguration;
  threads: ThreadPoolConfiguration;
}

export interface ConnectionPoolConfiguration {
  maxConnections: number;
  minConnections: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
}

export interface ThreadPoolConfiguration {
  coreSize: number;
  maxSize: number;
  queueSize: number;
  keepAliveMs: number;
}

export interface OptimizationConfiguration {
  enabled: boolean;
  strategies: OptimizationStrategy[];
  adaptiveTuning: boolean;
}

export interface OptimizationStrategy {
  name: string;
  enabled: boolean;
  configuration: Record<string, any>;
  priority: number;
}

export interface MonitoringConfiguration {
  enabled: boolean;
  metrics: MetricConfiguration[];
  alerts: AlertConfiguration[];
  dashboards: DashboardConfiguration[];
}

export interface MetricConfiguration {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  enabled: boolean;
  labels: string[];
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

export interface AlertConfiguration {
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  channels: AlertChannel[];
  enabled: boolean;
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  configuration: Record<string, any>;
  enabled: boolean;
}

export interface DashboardConfiguration {
  name: string;
  panels: DashboardPanel[];
  refreshInterval: number;
  enabled: boolean;
}

export interface DashboardPanel {
  title: string;
  type: 'chart' | 'table' | 'stat' | 'log';
  query: string;
  visualization: Record<string, any>;
}

export interface InfrastructureConfiguration {
  database: DatabaseConfiguration;
  storage: StorageConfiguration;
  messaging: MessagingConfiguration;
  networking: NetworkConfiguration;
}

export interface DatabaseConfiguration {
  type: 'sqlite' | 'postgresql' | 'mysql' | 'mongodb';
  connectionString?: string;
  poolSize: number;
  migrations: boolean;
  backup: BackupConfiguration;
}

export interface BackupConfiguration {
  enabled: boolean;
  schedule: string; // cron expression
  retention: number; // days
  compression: boolean;
  destination: string;
}

export interface StorageConfiguration {
  type: 'local' | 's3' | 'gcs' | 'azure';
  basePath: string;
  encryption: boolean;
  compression: boolean;
  configuration: Record<string, any>;
}

export interface MessagingConfiguration {
  enabled: boolean;
  type: 'memory' | 'redis' | 'rabbitmq' | 'kafka';
  configuration: Record<string, any>;
}

export interface NetworkConfiguration {
  timeoutMs: number;
  retries: number;
  proxy?: ProxyConfiguration;
  tls: TLSConfiguration;
}

export interface ProxyConfiguration {
  enabled: boolean;
  host: string;
  port: number;
  authentication?: {
    username: string;
    password: string;
  };
}

export interface TLSConfiguration {
  enabled: boolean;
  version: 'TLS1.2' | 'TLS1.3';
  certificatePath?: string;
  keyPath?: string;
  verifyPeer: boolean;
}

// ============================================================================
// COMMON VALUE OBJECTS AND UTILITY TYPES
// ============================================================================

/**
 * Common error types
 */
export interface ApplicationError {
  code: string;
  message: string;
  details?: Record<string, any>;
  cause?: Error;
  stack?: string;
  timestamp: Date;
}

export interface ValidationError extends ApplicationError {
  field: string;
  value: any;
  constraint: string;
}

export interface SystemError extends ApplicationError {
  component: string;
  operation: string;
  recoverable: boolean;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  requestId: string;
  timestamp: Date;
  duration: number;
  version: string;
  traceId?: string;
  userId?: string;
  sessionId?: string;
}

/**
 * Pagination and filtering
 */
export interface PaginationRequest {
  page: number;
  size: number;
  sort?: SortCriteria[];
}

export interface SortCriteria {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

export interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface FilterCriteria {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'ge' | 'lt' | 'le' | 'like' | 'in' | 'not_in';
  value: any;
}

/**
 * Generic utility types
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Required<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

export type ValueOf<T> = T[keyof T];

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Event types for event-driven architecture
 */
export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateVersion: number;
  payload: Record<string, any>;
  metadata: EventMetadata;
  timestamp: Date;
}

export interface EventMetadata {
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  causationId?: string;
  source: string;
  version: string;
}

/**
 * Audit and compliance types
 */
export interface AuditEvent {
  id: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  action: string;
  resource: string;
  outcome: 'success' | 'failure' | 'error';
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Health and status types
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  components: ComponentHealth[];
  timestamp: Date;
  uptime: number;
  version: string;
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  message?: string;
  details?: Record<string, any>;
  dependencies?: ComponentHealth[];
}

// ============================================================================
// LEGACY COMPATIBILITY TYPES - For smooth migration
// ============================================================================

/**
 * Legacy CLI types for backward compatibility
 */
export interface CLIError {
  code: string;
  message: string;
  details?: any;
}

export enum CLIExitCode {
  SUCCESS = 0,
  ERROR = 1,
  INVALID_ARGS = 2,
  NOT_FOUND = 3,
}

export interface REPLInterface {
  start(): Promise<void>;
  stop(): Promise<void>;
  processCommand(command: string): Promise<string>;
}

/**
 * Legacy configuration types
 */
export interface UnifiedClientConfig {
  endpoint?: string;
  providers: Array<{
    type: 'ollama' | 'lm-studio' | 'huggingface' | 'auto';
    endpoint?: string;
    apiKey?: string;
    model?: string;
    timeout?: number;
    maxRetries?: number;
  }>;
  defaultModel?: string;
  executionMode: 'auto' | 'fast' | 'quality';
  fallbackChain: string[];
  performanceThresholds: {
    fastModeMaxTokens: number;
    timeoutMs: number;
    maxConcurrentRequests: number;
  };
  security: {
    enableSandbox: boolean;
    maxInputLength: number;
    allowedCommands: string[];
  };
}

/**
 * Legacy domain types for backward compatibility
 */
export interface ProjectContext {
  workingDirectory: string;
  config: Record<string, unknown>;
  files: Array<{
    path: string;
    content: string;
    type: string;
    language?: string;
  }>;
  structure?: {
    directories: string[];
    fileTypes: Record<string, number>;
  };
}

export interface MetricsData {
  timestamp: number;
  values: Record<string, number>;
  metadata?: Record<string, any>;
}

export interface ComplexityAnalysis {
  score: number;
  level: 'simple' | 'medium' | 'complex';
  factors: {
    promptLength: number;
    hasContext: boolean;
    hasFiles: boolean;
    fileCount: number;
  };
  estimatedTime: string;
}

export type TaskType =
  | 'analysis'
  | 'generation'
  | 'refactoring'
  | 'debug'
  | 'documentation'
  | 'testing'
  | 'optimization'
  | 'general'
  | 'template'
  | 'security'
  | 'planning'
  | 'generate';

/**
 * Stream and response types
 */
export interface StreamToken {
  content: string;
  finished?: boolean;
  index: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ModelRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  provider?: string;
  abortSignal?: AbortSignal;
  context?: Record<string, any>;
  files?: string[];
  taskType?: TaskType;
}

export interface ModelResponse {
  content: string;
  model: string;
  provider?: string;
  error?: string;
  metadata?: {
    tokens: number;
    latency: number;
    quality?: number;
  };
  usage?: {
    totalTokens: number;
    promptTokens?: number;
    completionTokens?: number;
  };
}

// Export all as a convenient namespace
export type * from './unified-types.js';