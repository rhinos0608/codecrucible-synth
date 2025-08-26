/**
 * Execution Repository Domain Interface
 * Pure domain interface - NO infrastructure dependencies
 *
 * Living Spiral Council Applied:
 * - Domain-driven repository pattern
 * - Interface segregation principle
 * - No concrete implementations (those go in infrastructure layer)
 */

import { ReasoningStep } from '../entities/reasoning-step.js';
import { ExecutionPlan } from '../entities/execution-plan.js';
import { ToolExecution } from '../entities/tool-execution.js';
import { WorkflowTemplate } from '../entities/workflow-template.js';

/**
 * Repository for managing reasoning steps in execution chains
 */
export interface ReasoningStepRepository {
  /**
   * Save a reasoning step to persistent storage
   */
  save(step: ReasoningStep): Promise<void>;

  /**
   * Find reasoning steps by execution ID
   */
  findByExecutionId(executionId: string): Promise<ReasoningStep[]>;

  /**
   * Find reasoning steps by type
   */
  findByType(type: string): Promise<ReasoningStep[]>;

  /**
   * Find reasoning steps with low confidence that need attention
   */
  findLowConfidenceSteps(): Promise<ReasoningStep[]>;

  /**
   * Get reasoning chain statistics for analysis
   */
  getExecutionStatistics(executionId: string): Promise<ExecutionStatistics>;

  /**
   * Remove old reasoning steps (cleanup)
   */
  removeOlderThan(date: Date): Promise<number>;
}

/**
 * Repository for managing execution plans
 */
export interface ExecutionPlanRepository {
  /**
   * Save an execution plan
   */
  save(plan: ExecutionPlan): Promise<void>;

  /**
   * Find execution plan by ID
   */
  findById(planId: string): Promise<ExecutionPlan | null>;

  /**
   * Find execution plans by domain
   */
  findByDomain(domain: string): Promise<ExecutionPlan[]>;

  /**
   * Find high-risk execution plans that need review
   */
  findHighRiskPlans(): Promise<ExecutionPlan[]>;

  /**
   * Find successful execution plans for learning
   */
  findSuccessfulPlans(domain?: string): Promise<ExecutionPlan[]>;

  /**
   * Get execution plan performance metrics
   */
  getPlanMetrics(planId: string): Promise<PlanMetrics>;

  /**
   * Update execution plan with results
   */
  updateWithResults(planId: string, results: ExecutionResults): Promise<void>;
}

/**
 * Repository for managing tool executions
 */
export interface ToolExecutionRepository {
  /**
   * Save a tool execution record
   */
  save(execution: ToolExecution): Promise<void>;

  /**
   * Find tool execution by ID
   */
  findById(executionId: string): Promise<ToolExecution | null>;

  /**
   * Find tool executions by tool name
   */
  findByToolName(toolName: string): Promise<ToolExecution[]>;

  /**
   * Find running tool executions
   */
  findRunningExecutions(): Promise<ToolExecution[]>;

  /**
   * Find failed tool executions for analysis
   */
  findFailedExecutions(since?: Date): Promise<ToolExecution[]>;

  /**
   * Get tool performance metrics
   */
  getToolMetrics(toolName: string): Promise<ToolMetrics>;

  /**
   * Find tool executions that may be recoverable failures
   */
  findRecoverableFailures(): Promise<ToolExecution[]>;

  /**
   * Update execution status
   */
  updateStatus(executionId: string, status: string): Promise<void>;
}

/**
 * Repository for managing workflow templates
 */
export interface WorkflowTemplateRepository {
  /**
   * Save a workflow template
   */
  save(template: WorkflowTemplate): Promise<void>;

  /**
   * Find workflow template by name
   */
  findByName(name: string): Promise<WorkflowTemplate | null>;

  /**
   * Find workflow templates by domain
   */
  findByDomain(domain: string): Promise<WorkflowTemplate[]>;

  /**
   * Find workflow templates that match a prompt
   */
  findMatching(prompt: string): Promise<WorkflowTemplateMatch[]>;

  /**
   * Get all workflow templates
   */
  findAll(): Promise<WorkflowTemplate[]>;

  /**
   * Find workflow templates by complexity
   */
  findByComplexity(complexity: 'simple' | 'moderate' | 'complex'): Promise<WorkflowTemplate[]>;

  /**
   * Update workflow template
   */
  update(name: string, template: WorkflowTemplate): Promise<void>;

  /**
   * Remove workflow template
   */
  remove(name: string): Promise<void>;
}

/**
 * Domain value objects for repository operations
 */

export interface ExecutionStatistics {
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  averageConfidence: number;
  executionTime: number;
  toolsUsed: string[];
}

export interface PlanMetrics {
  planId: string;
  estimatedTime: number;
  actualTime?: number;
  estimatedSteps: number;
  actualSteps?: number;
  successRate: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ExecutionResults {
  success: boolean;
  actualSteps: number;
  actualTime: number;
  toolsUsed: string[];
  errors: string[];
}

export interface ToolMetrics {
  toolName: string;
  totalExecutions: number;
  successfulExecutions: number;
  averageExecutionTime: number;
  errorRate: number;
  commonErrors: string[];
  performanceScore: number;
}

export interface WorkflowTemplateMatch {
  template: WorkflowTemplate;
  matchScore: number;
  matchedTriggers: string[];
}

/**
 * Query criteria interfaces for advanced repository operations
 */

export interface ReasoningStepQuery {
  executionId?: string;
  type?: string;
  minConfidence?: number;
  maxConfidence?: number;
  dateFrom?: Date;
  dateTo?: Date;
  hasError?: boolean;
}

export interface ExecutionPlanQuery {
  domain?: string;
  minConfidence?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  dateFrom?: Date;
  dateTo?: Date;
  toolsUsed?: string[];
}

export interface ToolExecutionQuery {
  toolName?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minDuration?: number;
  maxDuration?: number;
  hasError?: boolean;
}

export interface WorkflowTemplateQuery {
  domain?: string;
  complexity?: 'simple' | 'moderate' | 'complex';
  requiredTools?: string[];
  matchPrompt?: string;
}

/**
 * Advanced repository interface with query capabilities
 */
export interface ExecutionQueryRepository {
  /**
   * Advanced query for reasoning steps
   */
  queryReasoningSteps(query: ReasoningStepQuery): Promise<ReasoningStep[]>;

  /**
   * Advanced query for execution plans
   */
  queryExecutionPlans(query: ExecutionPlanQuery): Promise<ExecutionPlan[]>;

  /**
   * Advanced query for tool executions
   */
  queryToolExecutions(query: ToolExecutionQuery): Promise<ToolExecution[]>;

  /**
   * Advanced query for workflow templates
   */
  queryWorkflowTemplates(query: WorkflowTemplateQuery): Promise<WorkflowTemplate[]>;

  /**
   * Get execution insights for optimization
   */
  getExecutionInsights(timeRange: { from: Date; to: Date }): Promise<ExecutionInsights>;
}

export interface ExecutionInsights {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  mostUsedTools: Array<{ tool: string; count: number }>;
  commonFailurePatterns: Array<{ pattern: string; count: number }>;
  performanceTrends: Array<{ date: string; avgTime: number; successRate: number }>;
  recommendations: string[];
}