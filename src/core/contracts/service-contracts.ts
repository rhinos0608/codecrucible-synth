/**
 * Unified Service Contracts and Interface Standards
 *
 * ADDRESSES CRITICAL ARCHITECTURE ISSUES:
 * - Issue #3: Interface Misalignment (standardized contracts across all systems)
 * - Issue #2: Inconsistent Architectural Patterns (enforced interfaces)
 *
 * PURPOSE: Define standardized contracts that all services must implement
 * to ensure architectural consistency and enable proper integration
 */

import { EventEmitter } from 'events';

// Base Service Contract - All services must implement this
export interface IBaseService {
  readonly serviceName: string;
  readonly version: string;
  readonly category: ServiceCategory;

  // Lifecycle methods
  initialize?(): Promise<void>;
  cleanup?(): Promise<void>;

  // Health monitoring
  getHealth(): ServiceHealth;

  // Performance monitoring
  getMetrics(): ServiceMetrics;
}

export type ServiceCategory = 'core' | 'domain' | 'application' | 'infrastructure' | 'integration';

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  lastChecked: Date;
  uptime: number;
  details?: Record<string, any>;
  errors?: ServiceError[];
}

export interface ServiceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  lastResetTime: Date;
  customMetrics?: Record<string, number>;
}

export interface ServiceError {
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  context?: Record<string, any>;
}

// Configuration Service Contract
export interface IConfigurationService extends IBaseService {
  // Config loading and validation
  loadConfig<T>(key: string): Promise<T>;
  validateConfig(config: unknown): ConfigValidationResult;

  // Config watching and updates
  watchConfig(key: string, callback: (newValue: any) => void): void;
  updateConfig(key: string, value: any): Promise<void>;

  // Environment and feature flags
  getEnvironment(): string;
  isFeatureEnabled(feature: string): boolean;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalizedConfig?: any;
}

// Cache Service Contract
export interface ICacheService extends IBaseService {
  // Basic cache operations
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;

  // Advanced operations
  getMultiple<T>(keys: string[]): Promise<Map<string, T>>;
  setMultiple<T>(entries: Map<string, T>, options?: CacheOptions): Promise<void>;

  // Cache management
  getCacheStats(): CacheStats;
  evictExpired(): Promise<number>;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  priority?: 'low' | 'normal' | 'high';
}

export interface CacheStats {
  size: number;
  hitRate: number;
  memoryUsage: number;
  evictionCount: number;
}

// MCP Service Contract
export interface IMCPService extends IBaseService {
  // Connection management
  connect(serverConfig: MCPServerConfig): Promise<MCPConnection>;
  disconnect(serverId: string): Promise<void>;

  // Tool operations
  listTools(serverId?: string): Promise<MCPTool[]>;
  executeTool(toolName: string, parameters: any, serverId?: string): Promise<any>;

  // Resource operations
  listResources(serverId?: string): Promise<MCPResource[]>;
  readResource(uri: string, serverId?: string): Promise<any>;

  // Health and monitoring
  getConnectionStatus(): MCPConnectionStatus;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  command: string[];
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPConnection {
  id: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  lastActivity: Date;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPConnectionStatus {
  totalConnections: number;
  activeConnections: number;
  failedConnections: number;
  lastRefresh: Date;
}

// Error Service Contract
export interface IErrorService extends IBaseService {
  // Error handling
  handleError(error: Error, context?: ErrorContext): Promise<ErrorHandlingResult>;

  // Error recovery
  attemptRecovery(error: Error, strategy: RecoveryStrategy): Promise<boolean>;

  // Error reporting and monitoring
  getErrorStats(): ErrorStats;
  getRecentErrors(limit?: number): ServiceError[];
}

export interface ErrorContext {
  operation: string;
  service: string;
  metadata?: Record<string, any>;
}

export interface ErrorHandlingResult {
  handled: boolean;
  recovered: boolean;
  action: 'retry' | 'fallback' | 'escalate' | 'ignore';
  message?: string;
}

export interface RecoveryStrategy {
  type: 'retry' | 'fallback' | 'circuit-breaker' | 'custom';
  maxAttempts?: number;
  backoffMs?: number;
  fallbackValue?: any;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByService: Record<string, number>;
  recoveryRate: number;
  averageRecoveryTime: number;
}

// Orchestration Service Contract
export interface IOrchestrationService extends IBaseService {
  // Tool orchestration
  orchestrateTools(request: OrchestrationRequest): Promise<OrchestrationResult>;

  // Workflow management
  executeWorkflow(workflow: WorkflowDefinition): Promise<WorkflowResult>;

  // Agent collaboration
  coordinateAgents(request: AgentCoordinationRequest): Promise<AgentCoordinationResult>;

  // Performance optimization
  getOptimizationRecommendations(): OptimizationRecommendation[];
}

export interface OrchestrationRequest {
  id: string;
  type: 'sequential' | 'parallel' | 'conditional';
  tools: ToolRequest[];
  context?: Record<string, any>;
  constraints?: ExecutionConstraints;
}

export interface ToolRequest {
  toolId: string;
  parameters: any;
  dependencies?: string[];
}

export interface ExecutionConstraints {
  maxExecutionTime?: number;
  maxMemoryUsage?: number;
  requiredCapabilities?: string[];
}

export interface OrchestrationResult {
  success: boolean;
  results: Map<string, any>;
  executionTime: number;
  errors?: ServiceError[];
}

export interface WorkflowDefinition {
  id: string;
  steps: WorkflowStep[];
  dependencies?: Map<string, string[]>;
}

export interface WorkflowStep {
  id: string;
  type: 'tool' | 'condition' | 'loop' | 'parallel';
  configuration: any;
}

export interface WorkflowResult {
  success: boolean;
  stepResults: Map<string, any>;
  totalExecutionTime: number;
  errors?: ServiceError[];
}

export interface AgentCoordinationRequest {
  taskId: string;
  agents: AgentDefinition[];
  coordinationStrategy: 'leader-follower' | 'peer-to-peer' | 'hierarchical';
  context?: Record<string, any>;
}

export interface AgentDefinition {
  id: string;
  capabilities: string[];
  role: string;
  priority: number;
}

export interface AgentCoordinationResult {
  success: boolean;
  agentResults: Map<string, any>;
  coordinationMetrics: CoordinationMetrics;
  errors?: ServiceError[];
}

export interface CoordinationMetrics {
  totalAgents: number;
  activeAgents: number;
  averageResponseTime: number;
  coordinationOverhead: number;
}

export interface OptimizationRecommendation {
  type: 'performance' | 'cost' | 'quality' | 'resource';
  priority: 'low' | 'medium' | 'high';
  description: string;
  estimatedImpact: number;
  implementationCost: number;
}

// Model Selection Service Contract
export interface IModelSelectionService extends IBaseService {
  // Model selection
  selectModel(request: ModelSelectionRequest): Promise<ModelSelection>;

  // Model management
  listAvailableModels(): Promise<ModelInfo[]>;
  validateModelCapabilities(modelId: string, capabilities: string[]): Promise<boolean>;

  // Performance optimization
  getModelPerformanceMetrics(modelId: string): Promise<ModelPerformanceMetrics>;
}

export interface ModelSelectionRequest {
  taskType: string;
  requirements: ModelRequirements;
  preferences?: ModelPreferences;
  context?: Record<string, any>;
}

export interface ModelRequirements {
  capabilities: string[];
  minAccuracy?: number;
  maxLatency?: number;
  maxCost?: number;
}

export interface ModelPreferences {
  preferredProviders?: string[];
  preferredModels?: string[];
  qualityVsSpeed?: number; // 0-1 scale
}

export interface ModelSelection {
  modelId: string;
  provider: string;
  confidence: number;
  reasoning: string;
  estimatedPerformance: ModelPerformanceEstimate;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
  specifications: ModelSpecifications;
}

export interface ModelSpecifications {
  contextLength: number;
  outputTokenLimit: number;
  supportedFormats: string[];
  costPerToken?: number;
  averageLatency?: number;
}

export interface ModelPerformanceMetrics {
  averageLatency: number;
  tokenThroughput: number;
  successRate: number;
  qualityScore: number;
  costEfficiency: number;
}

export interface ModelPerformanceEstimate {
  latency: number;
  cost: number;
  quality: number;
  confidence: number;
}

// Voice Orchestration Service Contract
export interface IVoiceOrchestrationService extends IBaseService {
  // Voice selection and coordination
  selectVoices(request: VoiceSelectionRequest): Promise<VoiceSelection>;
  orchestrateMultiVoice(request: MultiVoiceRequest): Promise<MultiVoiceResult>;

  // Voice management
  listAvailableVoices(): Promise<VoiceInfo[]>;
  getVoiceCapabilities(voiceId: string): Promise<VoiceCapabilities>;

  // Performance optimization
  getVoicePerformanceMetrics(): Promise<VoicePerformanceMetrics>;
}

export interface VoiceSelectionRequest {
  taskType: string;
  phase?: string;
  requirements: VoiceRequirements;
  preferences?: VoicePreferences;
  context?: Record<string, any>;
}

export interface VoiceRequirements {
  expertise: string[];
  perspective?: string;
  complexity?: 'low' | 'medium' | 'high';
  collaboration?: boolean;
}

export interface VoicePreferences {
  preferredVoices?: string[];
  maxVoices?: number;
  diversityLevel?: number; // 0-1 scale
}

export interface VoiceSelection {
  voices: SelectedVoice[];
  strategy: string;
  reasoning: string;
  estimatedQuality: number;
}

export interface SelectedVoice {
  id: string;
  role: string;
  weight: number;
  specialization: string[];
}

export interface MultiVoiceRequest {
  prompt: string;
  voices: SelectedVoice[];
  synthesisMode: 'sequential' | 'parallel' | 'hierarchical';
  context?: Record<string, any>;
}

export interface MultiVoiceResult {
  success: boolean;
  synthesis: string;
  voiceContributions: Map<string, VoiceContribution>;
  qualityMetrics: VoiceQualityMetrics;
}

export interface VoiceContribution {
  voiceId: string;
  content: string;
  weight: number;
  qualityScore: number;
}

export interface VoiceInfo {
  id: string;
  name: string;
  description: string;
  expertise: string[];
  personality: string;
  capabilities: VoiceCapabilities;
}

export interface VoiceCapabilities {
  supportedTasks: string[];
  collaborationStyles: string[];
  qualityRange: [number, number];
  averageLatency: number;
}

export interface VoicePerformanceMetrics {
  totalRequests: number;
  averageQuality: number;
  averageLatency: number;
  collaborationEfficiency: number;
  voiceUtilization: Map<string, number>;
}

export interface VoiceQualityMetrics {
  overallQuality: number;
  coherence: number;
  diversity: number;
  completeness: number;
  collaboration: number;
}

// Integration Coordinator Contract
export interface IIntegrationCoordinator extends IBaseService {
  // System integration
  coordinateRequest(request: IntegratedRequest): Promise<IntegratedResponse>;

  // Health monitoring
  getSystemsHealth(): SystemsHealthReport;

  // Resource coordination
  acquireResource(resourceId: string, requesterId: string): Promise<ResourceLock>;
  releaseResource(lock: ResourceLock): Promise<void>;
}

export interface IntegratedRequest {
  id: string;
  type: 'analysis' | 'generation' | 'execution';
  content: string;
  context: IntegrationContext;
  constraints?: IntegrationConstraints;
}

export interface IntegrationContext {
  phase?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiredSystems: string[];
  metadata?: Record<string, any>;
}

export interface IntegrationConstraints {
  maxExecutionTime?: number;
  maxCost?: number;
  requiredQuality?: number;
  allowFallback?: boolean;
}

export interface IntegratedResponse {
  id: string;
  success: boolean;
  result: any;
  systemsUsed: string[];
  performance: IntegrationPerformance;
  errors?: ServiceError[];
}

export interface IntegrationPerformance {
  totalTime: number;
  systemTimes: Map<string, number>;
  resourceUtilization: number;
  qualityScore: number;
  costEstimate: number;
}

export interface SystemsHealthReport {
  overall: 'healthy' | 'degraded' | 'critical';
  systems: Map<string, ServiceHealth>;
  lastUpdated: Date;
  recommendations: string[];
}

export interface ResourceLock {
  id: string;
  resourceId: string;
  requesterId: string;
  acquiredAt: Date;
  expiresAt: Date;
}

// Contract Validation Utilities
export class ContractValidator {
  static validateService<T extends IBaseService>(
    service: any,
    contract: new (...args: any[]) => T
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required properties
    if (!service.serviceName) errors.push('Missing serviceName property');
    if (!service.version) errors.push('Missing version property');
    if (!service.category) errors.push('Missing category property');

    // Check required methods
    if (typeof service.getHealth !== 'function') errors.push('Missing getHealth method');
    if (typeof service.getMetrics !== 'function') errors.push('Missing getMetrics method');

    // Additional contract-specific validation would go here

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static ensureContract<T extends IBaseService>(service: any, contractName: string): service is T {
    const validation = this.validateService(service, Object as any);

    if (!validation.valid) {
      throw new Error(
        `Service does not implement ${contractName} contract: ${validation.errors.join(', ')}`
      );
    }

    return true;
  }
}

// Contract enforcement decorator
export function EnforceContract(contractName: string) {
  return function <T extends { new (...args: any[]): IBaseService }>(constructor: T) {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);

        // Validate contract compliance after construction
        const validation = ContractValidator.validateService(this, constructor);
        if (!validation.valid) {
          throw new Error(
            `${constructor.name} violates ${contractName} contract: ${validation.errors.join(', ')}`
          );
        }
      }
    };
  };
}
