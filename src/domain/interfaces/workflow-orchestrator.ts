/**
 * Workflow Orchestrator Interface
 *
 * This interface provides a mediator pattern to coordinate between
 * CLI, UnifiedModelClient, MCP-Manager, and Tools without circular dependencies.
 */

import { IUserInteraction } from './user-interaction.js';
import { IEventBus } from './event-bus.js';
import { IModelClient, ModelRequest, ModelResponse } from './model-client.js';
import { IMcpManager } from './mcp-manager.js';
import { IUnifiedSecurityValidator } from '../services/unified-security-validator.js';
import { IUnifiedConfigurationManager } from '../services/unified-configuration-manager.js';
import { ToolExecutionArgs, ToolExecutionResult } from './tool-execution.js';

// Specific workflow payload types
export interface PromptPayload {
  prompt: string;
  voiceId?: string;
  model?: string;
  parameters?: Record<string, unknown>;
}

export interface ToolExecutionPayload {
  toolName: string;
  arguments: ToolExecutionArgs;
  timeout?: number;
}

export interface ModelRequestPayload {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  parameters?: Record<string, unknown>;
}

export interface AnalysisPayload {
  target: string;
  type: 'file' | 'directory' | 'codebase';
  options?: Record<string, unknown>;
}

export type WorkflowPayload = Record<string, unknown>;

// Result types for different workflow operations
export interface SpiralProcessResult {
  phases: Array<{
    name: string;
    output: string;
    metadata: Record<string, unknown>;
  }>;
  finalOutput: string;
  convergenceReached: boolean;
  iterationCount: number;
}

export interface CodeAnalysisResult {
  summary: string;
  issues: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    location?: string;
  }>;
  metrics: Record<string, number>;
  recommendations: string[];
}

export interface WorkflowRequest {
  id: string;
  type: 'prompt' | 'tool-execution' | 'model-request' | 'analysis';
  payload: WorkflowPayload;
  context?: WorkflowContext;
  metadata?: Record<string, unknown>;
}

export interface WorkflowResponse {
  id: string;
  success: boolean;
  result?: unknown;
  error?: Error;
  metadata?: Record<string, unknown>;
}

export interface WorkflowContext {
  userId?: string;
  sessionId: string;
  workingDirectory: string;
  permissions: string[];
  securityLevel: 'low' | 'medium' | 'high';
}

export interface IWorkflowOrchestrator {
  /**
   * Process a workflow request
   */
  processRequest(request: WorkflowRequest): Promise<WorkflowResponse>;

  /**
   * Execute a tool with proper context and security
   */
  executeTool(
    toolName: string,
    args: ToolExecutionArgs,
    context: WorkflowContext
  ): Promise<ToolExecutionResult>;

  /**
   * Process a model request with routing and fallbacks
   */
  processModelRequest(request: ModelRequest, context?: WorkflowContext): Promise<ModelResponse>;

  /**
   * Initialize the orchestrator with dependencies
   */
  initialize(dependencies: OrchestratorDependencies): Promise<void>;

  /**
   * Shutdown and cleanup resources
   */
  shutdown(): Promise<void>;
}

/**
 * Living Spiral Coordinator Interface for iterative development processes
 */
export interface LivingSpiralCoordinatorInterface {
  /**
   * Execute the complete Living Spiral process
   */
  executeSpiralProcess(initialPrompt: string): Promise<unknown>;

  /**
   * Execute a single spiral iteration
   */
  executeSpiralIteration(input: string, iteration: number): Promise<unknown>;

  /**
   * Check if convergence has been achieved
   */
  checkConvergence(results: unknown[]): Promise<boolean>;

  /**
   * Analyze code or files
   */
  analyzeCode(filePath: string, context: WorkflowContext): Promise<unknown>;

  /**
   * Initialize the orchestrator with dependencies
   */
  initialize(dependencies: OrchestratorDependencies): Promise<void>;

  /**
   * Shutdown and cleanup
   */
  shutdown(): Promise<void>;
}

export interface OrchestratorDependencies {
  userInteraction: IUserInteraction;
  eventBus: IEventBus;
  modelClient?: IModelClient;
  mcpManager?: IMcpManager;
  securityValidator?: IUnifiedSecurityValidator;
  configManager?: IUnifiedConfigurationManager;
  /**
   * Optional aggregated runtime context replacing scattered singletons.
   * When supplied, fields inside take precedence for orchestration internals.
   */
  runtimeContext?: import('../../application/runtime/runtime-context.js').RuntimeContext;
}

/**
 * Workflow orchestrator events for decoupled communication
 */
export interface WorkflowEvents {
  'workflow:started': { id: string; type: string };
  'workflow:completed': { id: string; result: unknown };
  'workflow:failed': { id: string; error: Error };
  'workflow:progress': { id: string; message: string; progress?: number };
}
