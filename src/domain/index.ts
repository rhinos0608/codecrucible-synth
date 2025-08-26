/**
 * Domain Layer Index
 * Clean exports for the domain layer following ARCHITECTURE.md principles
 *
 * Living Spiral Council Applied:
 * - Domain-driven design with proper layer isolation
 * - Clean exports organized by domain concepts
 * - No infrastructure dependencies leaked through exports
 */

// Core Domain Entities
export { Model, ModelFactory, ModelParameters, ModelConfiguration } from './entities/model.js';
export { Voice, VoiceConfiguration, VoiceFactory } from './entities/voice.js';
export { ProcessingRequest } from './entities/request.js';

// Execution Domain
export { 
  ReasoningStep, 
  ReasoningStepType, 
  ConfidenceScore, 
  ToolArguments,
  ReasoningStepConfiguration
} from './entities/reasoning-step.js';

export { 
  ExecutionPlan, 
  Goal, 
  Domain, 
  StepEstimate, 
  SelectedTools,
  ExecutionPlanConfiguration
} from './entities/execution-plan.js';

export { 
  ToolExecution, 
  ToolName, 
  ExecutionStatus,
  ToolResult,
  ExecutionDuration,
  ToolExecutionConfiguration
} from './entities/tool-execution.js';

export { 
  WorkflowTemplate, 
  WorkflowStep, 
  WorkflowTrigger, 
  RequiredTools, 
  TargetResources, 
  WorkflowStepPriority,
  WorkflowTemplateConfiguration
} from './entities/workflow-template.js';

// Routing Domain
export { 
  RoutingDecision, 
  TaskComplexity, 
  RoutingPriority, 
  ModelSelectionCriteria, 
  ModelCapability, 
  PerformanceProfile,
  RoutingDecisionConfiguration
} from './entities/routing-decision.js';

// Value Objects
export { 
  VoiceStyle, 
  VoiceTemperature, 
  ProviderType, 
  ModelName, 
  RequestPriority 
} from './value-objects/voice-values.js';

export { 
  ExecutionId, 
  TaskDescription, 
  ErrorMessage, 
  Timestamp, 
  Duration, 
  ResourceIdentifier, 
  QualityScore 
} from './value-objects/execution-values.js';

// Repository Interfaces (Pure domain interfaces - no implementations)
export { 
  IModelRepository
} from './repositories/model-repository.js';

export { 
  IVoiceRepository
} from './repositories/voice-repository.js';

export { 
  ReasoningStepRepository, 
  ExecutionPlanRepository, 
  ToolExecutionRepository, 
  WorkflowTemplateRepository, 
  ExecutionQueryRepository,
  ExecutionStatistics,
  PlanMetrics,
  ExecutionResults,
  ToolMetrics,
  WorkflowTemplateMatch,
  ExecutionInsights
} from './repositories/execution-repository.js';

export { 
  RoutingDecisionRepository, 
  ModelAvailabilityRepository, 
  RoutingAnalyticsRepository, 
  RoutingQueryRepository,
  RoutingMetrics,
  ModelPerformanceHistory,
  ModelUsageStatistics,
  RoutingOutcome,
  RoutingTrends,
  RoutingPattern,
  RoutingRecommendation,
  ModelComparison,
  RoutingInsights,
  OptimalModelCriteria,
  OptimalModelRecommendation
} from './repositories/routing-repository.js';

// Domain Services (Pure business logic)
export { 
  ModelSelectionService
} from './services/model-selection-service.js';

export { 
  VoiceOrchestrationService
} from './services/voice-orchestration-service.js';

export { 
  ExecutionOrchestrationService, 
  ExecutionContext, 
  ExecutionPreferences, 
  ExecutionResult,
  ValidationResult,
  ContinuationDecision
} from './services/execution-orchestration-service.js';

export { 
  ModelRoutingService, 
  RoutingRequest, 
  RequestContext, 
  ModelScoringResult, 
  RoutingStrategy, 
  PerformanceFirstStrategy, 
  QualityFirstStrategy, 
  BalancedRoutingStrategy,
  RoutingEvaluation,
  StrategyOptimization
} from './services/model-routing-service.js';

// Domain Events (if any exist or are added later)
// export { DomainEvent, DomainEventHandler } from './events/index.js';

// Domain Exceptions (pure domain errors)
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class BusinessRuleError extends DomainError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'BUSINESS_RULE_ERROR', context);
    this.name = 'BusinessRuleError';
  }
}

export class DomainNotFoundError extends DomainError {
  constructor(resource: string, identifier: string) {
    super(`${resource} not found: ${identifier}`, 'NOT_FOUND', { resource, identifier });
    this.name = 'DomainNotFoundError';
  }
}

/**
 * Domain Constants
 */
export const DOMAIN_CONSTANTS = {
  MAX_EXECUTION_STEPS: 20,
  MAX_REASONING_CHAIN_LENGTH: 50,
  DEFAULT_CONFIDENCE_THRESHOLD: 0.7,
  MIN_QUALITY_SCORE: 0.5,
  MAX_TOOL_EXECUTION_TIME_MS: 60000,
  DEFAULT_EXECUTION_TIMEOUT_MS: 300000
} as const;

/**
 * Domain Type Guards
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isBusinessRuleError(error: unknown): error is BusinessRuleError {
  return error instanceof BusinessRuleError;
}

export function isDomainNotFoundError(error: unknown): error is DomainNotFoundError {
  return error instanceof DomainNotFoundError;
}