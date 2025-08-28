/**
 * Unified Data Models for System Integration
 * 
 * Addresses Issues #4, #5, #6, #12:
 * - Data Transformation Mismatches
 * - Context Passing Inconsistencies  
 * - State Management Conflicts
 * - Request/Response Standardization
 * 
 * This module provides standardized data contracts for inter-system communication
 * between the 4 major systems: Routing, Voice, MCP, and Orchestration.
 */

// ========================================
// CORE UNIFIED DATA TYPES
// ========================================

/**
 * Universal Request Context - Standardized context for all systems
 * Ensures consistent context flow across system boundaries
 */
export interface UnifiedRequestContext {
  // Request identification
  requestId: string;
  sessionId: string;
  userId?: string;
  timestamp: number;
  
  // Living Spiral context
  phase?: 'collapse' | 'council' | 'synthesis' | 'rebirth' | 'reflection';
  iteration?: number;
  spiralHistory?: SpiralPhaseResult[];
  
  // System context
  systemPath: string[]; // Track which systems have processed this context
  previousResults?: SystemResult[];
  currentSystemState: Record<string, any>;
  
  // Performance context
  performanceTargets: {
    maxLatency: number;
    minAccuracy: number;
    maxCost: number;
    qualityThreshold: number;
  };
  
  // Routing preferences
  routingPreferences: {
    prioritizeSpeed: boolean;
    prioritizeQuality: boolean;
    maxVoices: number;
    preferredProviders: string[];
    enableHybridRouting: boolean;
  };
  
  // MCP requirements
  mcpRequirements: {
    capabilities: string[];
    minReliability: number;
    maxLatency: number;
    securityLevel: 'basic' | 'standard' | 'high' | 'enterprise';
  };
  
  // Error recovery options
  errorRecovery: {
    fallbackEnabled: boolean;
    retryAttempts: number;
    escalateToHuman: boolean;
    allowPartialResults: boolean;
  };
  
  // State synchronization
  stateVersion: string;
  stateLocks: string[]; // Systems that have state locks
  stateSnapshot?: Record<string, any>;
}

/**
 * Universal System Result - Standardized output from any system
 */
export interface SystemResult {
  // Result identification
  resultId: string;
  requestId: string;
  systemId: string;
  timestamp: number;
  
  // Result data
  success: boolean;
  data?: any;
  error?: SystemError;
  
  // Performance metrics
  executionTime: number;
  resourceUsage: ResourceUsage;
  qualityMetrics: QualityMetrics;
  
  // State changes
  stateChanges: StateChange[];
  nextRecommendations: SystemRecommendation[];
  
  // Integration metadata
  transformations: DataTransformation[];
  contextPreservation: ContextPreservation;
}

/**
 * Spiral Phase Result - Tracks Living Spiral methodology results
 */
export interface SpiralPhaseResult {
  phase: 'collapse' | 'council' | 'synthesis' | 'rebirth' | 'reflection';
  iteration: number;
  startTime: number;
  endTime: number;
  systemsInvolved: string[];
  results: SystemResult[];
  qualityScore: number;
  convergenceMetrics: ConvergenceMetrics;
  nextPhaseRecommendations: string[];
}

/**
 * Resource Usage Tracking
 */
export interface ResourceUsage {
  cpuTime: number; // milliseconds
  memoryPeak: number; // bytes
  networkCalls: number;
  diskOperations: number;
  costEstimate: number; // USD
}

/**
 * Quality Metrics
 */
export interface QualityMetrics {
  accuracy: number; // 0-1
  completeness: number; // 0-1
  relevance: number; // 0-1
  consistency: number; // 0-1
  confidence: number; // 0-1
  userSatisfaction?: number; // 0-1
}

/**
 * State Change Tracking
 */
export interface StateChange {
  key: string;
  oldValue: any;
  newValue: any;
  changeType: 'create' | 'update' | 'delete';
  system: string;
  timestamp: number;
  dependencies: string[]; // Other state keys affected
}

/**
 * System Recommendation
 */
export interface SystemRecommendation {
  type: 'optimization' | 'fallback' | 'escalation' | 'retry';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestedAction: string;
  estimatedBenefit: number; // 0-1
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Convergence Metrics for Living Spiral
 */
export interface ConvergenceMetrics {
  consensusLevel: number; // 0-1
  conflictResolution: number; // 0-1  
  informationGain: number; // 0-1
  decisionStability: number; // 0-1
  readyForNextPhase: boolean;
}

// ========================================
// SYSTEM-SPECIFIC UNIFIED MODELS
// ========================================

/**
 * Unified Routing Decision - Standardized routing output
 * Replaces IntelligentRoutingDecision with unified format
 */
export interface UnifiedRoutingDecision extends SystemResult {
  systemId: 'intelligent-routing';
  data: {
    // Core routing decisions
    selectedModel: ModelSelection;
    selectedVoices: VoiceSelection[];
    selectedProvider: ProviderSelection;
    routingStrategy: RoutingStrategy;
    
    // Decision metadata
    confidence: number;
    reasoning: string;
    alternativeOptions: AlternativeOption[];
    
    // Performance predictions
    estimatedLatency: number;
    estimatedCost: number;
    estimatedQuality: number;
    
    // Fallback chain
    fallbackChain: FallbackOption[];
  };
}

/**
 * Unified Voice Processing Result
 * Standardized voice system output
 */
export interface UnifiedVoiceResult extends SystemResult {
  systemId: 'voice-optimization';
  data: {
    // Voice processing results
    primaryVoice: VoiceResult;
    supportingVoices: VoiceResult[];
    synthesisResult: SynthesisResult;
    
    // Voice coordination
    coordinationStrategy: CoordinationStrategy;
    conflictResolutions: ConflictResolution[];
    consensusMetrics: ConsensusMetrics;
    
    // Quality assessment
    voiceQualityScores: Record<string, number>;
    overallQuality: number;
    diversityMeasure: number;
  };
}

/**
 * Unified MCP Execution Result
 * Standardized MCP system output
 */
export interface UnifiedMCPResult extends SystemResult {
  systemId: 'mcp-enhancement';
  data: {
    // Tool execution results
    executedTools: ToolExecutionResult[];
    coordinationPlan: ToolCoordinationPlan;
    
    // Performance metrics
    connectionMetrics: ConnectionMetrics;
    reliabilityScore: number;
    securityCompliance: SecurityComplianceResult;
    
    // Integration results
    voiceIntegrationResults: VoiceMCPResult[];
    loadBalancingDecisions: LoadBalancingDecision[];
  };
}

/**
 * Unified Orchestration Result
 * Standardized orchestration system output
 */
export interface UnifiedOrchestrationResult extends SystemResult {
  systemId: 'unified-orchestration';
  data: {
    // Final synthesis
    finalOutput: any;
    synthesisStrategy: SynthesisStrategy;
    
    // System coordination
    systemContributions: SystemContribution[];
    integrationQuality: IntegrationQuality;
    
    // Workflow results
    workflowExecution: WorkflowExecutionResult;
    taskResults: TaskResult[];
    
    // Final recommendations
    optimizationRecommendations: OptimizationRecommendation[];
    nextIterationSuggestions: string[];
  };
}

// ========================================
// DATA TRANSFORMATION MODELS
// ========================================

/**
 * Data Transformation Record
 * Tracks all data transformations between systems
 */
export interface DataTransformation {
  transformationId: string;
  sourceSystem: string;
  targetSystem: string;
  sourceFormat: string;
  targetFormat: string;
  transformationType: TransformationType;
  transformationRules: TransformationRule[];
  validationResults: ValidationResult;
  timestamp: number;
  reversible: boolean;
  dataLoss: boolean;
  dataLossDetails?: string[];
}

export type TransformationType = 
  | 'format_conversion'
  | 'schema_mapping'
  | 'data_enrichment'
  | 'data_reduction'
  | 'context_adaptation'
  | 'state_synchronization';

/**
 * Transformation Rule
 */
export interface TransformationRule {
  ruleId: string;
  sourceField: string;
  targetField: string;
  transformFunction: string;
  defaultValue?: any;
  validationRules: string[];
  preserveMetadata: boolean;
}

/**
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
  normalizedData?: any;
  confidence: number;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
}

// ========================================
// CONTEXT PRESERVATION MODELS
// ========================================

/**
 * Context Preservation Tracking
 * Ensures context is maintained across system boundaries
 */
export interface ContextPreservation {
  preservationId: string;
  originalContext: UnifiedRequestContext;
  contextChanges: ContextChange[];
  preservationQuality: number; // 0-1
  lostInformation: string[];
  addedInformation: string[];
  contextIntegrity: ContextIntegrity;
}

/**
 * Context Change Tracking
 */
export interface ContextChange {
  changeId: string;
  system: string;
  changeType: 'addition' | 'modification' | 'removal';
  contextPath: string;
  oldValue?: any;
  newValue?: any;
  reason: string;
  timestamp: number;
  reversible: boolean;
}

/**
 * Context Integrity Metrics
 */
export interface ContextIntegrity {
  completeness: number; // 0-1
  consistency: number; // 0-1
  coherence: number; // 0-1
  traceability: number; // 0-1
  reliability: number; // 0-1
}

// ========================================
// STATE MANAGEMENT MODELS
// ========================================

/**
 * Unified State Snapshot
 * Consistent state representation across all systems
 */
export interface UnifiedStateSnapshot {
  snapshotId: string;
  timestamp: number;
  version: string;
  systemStates: Record<string, SystemState>;
  globalState: GlobalState;
  stateRelationships: StateRelationship[];
  stateConsistency: StateConsistencyCheck;
}

/**
 * System State
 */
export interface SystemState {
  systemId: string;
  version: string;
  state: Record<string, any>;
  lastModified: number;
  stateHash: string;
  dependencies: string[];
  locks: StateLock[];
}

/**
 * Global State - Cross-system shared state
 */
export interface GlobalState {
  sessionData: Record<string, any>;
  userPreferences: Record<string, any>;
  activeProcesses: ActiveProcess[];
  sharedMemory: Record<string, any>;
  eventHistory: StateEvent[];
  metricsAccumulator: MetricsAccumulator;
}

/**
 * State Relationship
 */
export interface StateRelationship {
  relationshipId: string;
  sourceSystem: string;
  targetSystem: string;
  relationshipType: 'dependency' | 'synchronization' | 'conflict' | 'derived';
  sourceKeys: string[];
  targetKeys: string[];
  syncStrategy: 'immediate' | 'eventual' | 'manual';
}

/**
 * State Lock
 */
export interface StateLock {
  lockId: string;
  key: string;
  system: string;
  lockType: 'read' | 'write' | 'exclusive';
  timestamp: number;
  expiresAt: number;
  reason: string;
}

/**
 * State Consistency Check
 */
export interface StateConsistencyCheck {
  consistent: boolean;
  conflicts: StateConflict[];
  inconsistencies: StateInconsistency[];
  resolutionRecommendations: ConflictResolution[];
  overallScore: number; // 0-1
}

/**
 * State Conflict
 */
export interface StateConflict {
  conflictId: string;
  systems: string[];
  conflictingKeys: string[];
  conflictType: 'value_mismatch' | 'version_conflict' | 'dependency_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolutionStrategies: string[];
}

// ========================================
// SUPPORTING TYPE DEFINITIONS
// ========================================

export interface SystemError {
  errorId: string;
  system: string;
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  stack?: string;
  context?: any;
  recoverable: boolean;
  timestamp: number;
}

export interface ModelSelection {
  modelId: string;
  modelName: string;
  provider: string;
  confidence: number;
  estimatedCost: number;
  estimatedLatency: number;
}

export interface VoiceSelection {
  voiceId: string;
  voiceName: string;
  role: string;
  confidence: number;
  specialization: string[];
}

export interface ProviderSelection {
  providerId: string;
  providerName: string;
  confidence: number;
  reliability: number;
  latency: number;
}

export interface RoutingStrategy {
  strategyId: string;
  strategyName: string;
  type: 'single-model' | 'hybrid' | 'multi-voice' | 'load-balanced';
  parameters: Record<string, any>;
}

export interface AlternativeOption {
  optionId: string;
  type: 'model' | 'voice' | 'provider' | 'strategy';
  option: any;
  score: number;
  reason: string;
}

export interface FallbackOption {
  fallbackId: string;
  type: 'model' | 'voice' | 'provider' | 'system';
  fallbackTo: any;
  triggers: string[];
  priority: number;
}

export interface VoiceResult {
  voiceId: string;
  content: string;
  confidence: number;
  executionTime: number;
  tokenUsage: number;
  qualityMetrics: QualityMetrics;
}

export interface SynthesisResult {
  method: 'collaborative' | 'competitive' | 'consensus' | 'weighted';
  finalContent: string;
  contributionWeights: Record<string, number>;
  qualityScore: number;
  // Additional properties for compatibility
  voicesUsed?: string[];
  content?: string;
  combinedCode?: string;
}

export interface CoordinationStrategy {
  strategyType: string;
  parameters: Record<string, any>;
  effectiveness: number;
}

export interface ConflictResolution {
  conflictId: string;
  resolutionMethod: string;
  success: boolean;
  resolution: any;
}

export interface ConsensusMetrics {
  consensusLevel: number;
  agreementScore: number;
  diversityIndex: number;
  convergenceRate: number;
}

export interface ToolExecutionResult {
  toolId: string;
  success: boolean;
  result: any;
  executionTime: number;
  resourceUsage: ResourceUsage;
}

export interface ToolCoordinationPlan {
  planId: string;
  tools: string[];
  executionOrder: string[];
  dependencies: Record<string, string[]>;
  estimatedDuration: number;
}

export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  averageLatency: number;
  successRate: number;
  reliability: number;
}

export interface SecurityComplianceResult {
  compliant: boolean;
  violations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  mitigations: string[];
}

export interface VoiceMCPResult {
  voiceId: string;
  mcpRequest: any;
  success: boolean;
  result: any;
  integrationQuality: number;
}

export interface LoadBalancingDecision {
  serverId: string;
  load: number;
  selected: boolean;
  reason: string;
}

export interface SynthesisStrategy {
  method: string;
  parameters: Record<string, any>;
  confidence: number;
}

export interface SystemContribution {
  systemId: string;
  contribution: any;
  weight: number;
  quality: number;
  timestamp: number;
}

export interface IntegrationQuality {
  overallScore: number;
  systemScores: Record<string, number>;
  integrationEfficiency: number;
  dataConsistency: number;
  contextPreservation: number;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  success: boolean;
  results: any[];
  executionTime: number;
  tasksCompleted: number;
  tasksFailed: number;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  result: any;
  duration: number;
  qualityScore: number;
}

export interface OptimizationRecommendation {
  type: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedBenefit: number;
  implementationCost: number;
}

export interface StateInconsistency {
  inconsistencyId: string;
  description: string;
  affectedSystems: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolutionSuggestions: string[];
}

export interface ActiveProcess {
  processId: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: number;
  estimatedEndTime?: number;
  metadata: Record<string, any>;
}

export interface StateEvent {
  eventId: string;
  eventType: string;
  system: string;
  timestamp: number;
  data: any;
  causedBy?: string;
}

export interface MetricsAccumulator {
  totalRequests: number;
  successfulRequests: number;
  averageLatency: number;
  totalCost: number;
  qualityScores: number[];
  systemMetrics: Record<string, any>;
}

// ========================================
// TRANSFORMATION UTILITIES
// ========================================

/**
 * Data Transformation Registry
 * Central registry for all data transformations between systems
 */
export interface TransformationRegistry {
  registerTransformation(
    sourceSystem: string,
    targetSystem: string,
    transformer: DataTransformer
  ): void;
  
  getTransformer(
    sourceSystem: string,
    targetSystem: string
  ): DataTransformer | null;
  
  transform<T, U>(
    data: T,
    sourceSystem: string,
    targetSystem: string,
    context: UnifiedRequestContext
  ): Promise<TransformationResult<U>>;
}

/**
 * Data Transformer Interface
 */
export interface DataTransformer {
  transformerId: string;
  sourceFormat: string;
  targetFormat: string;
  
  transform(
    data: any,
    context: UnifiedRequestContext
  ): Promise<TransformationResult<any>>;
  
  validate(data: any): ValidationResult;
  
  reverseTransform?(
    data: any,
    context: UnifiedRequestContext
  ): Promise<TransformationResult<any>>;
}

/**
 * Transformation Result
 */
export interface TransformationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata: {
    transformationId: string;
    sourceSystem: string;
    targetSystem: string;
    executionTime: number;
    dataIntegrity: number; // 0-1
    informationPreserved: number; // 0-1
  };
  validationResult: ValidationResult;
  transformationRecord: DataTransformation;
}