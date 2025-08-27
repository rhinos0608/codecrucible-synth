/**
 * Workflow Orchestrator Interface
 * 
 * This interface provides a mediator pattern to coordinate between
 * CLI, UnifiedModelClient, MCP-Manager, and Tools without circular dependencies.
 */

import { IUserInteraction } from './user-interaction.js';
import { IEventBus } from './event-bus.js';

export interface WorkflowRequest {
  id: string;
  type: 'prompt' | 'tool-execution' | 'model-request' | 'analysis';
  payload: any;
  context?: WorkflowContext;
  metadata?: Record<string, any>;
}

export interface WorkflowResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: Error;
  metadata?: Record<string, any>;
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
  executeTool(toolName: string, args: any, context: WorkflowContext): Promise<any>;
  
  /**
   * Process a model request with routing and fallbacks
   */
  processModelRequest(request: any, context: WorkflowContext): Promise<any>;
}

/**
 * Living Spiral Coordinator Interface for iterative development processes
 */
export interface LivingSpiralCoordinatorInterface {
  /**
   * Execute the complete Living Spiral process
   */
  executeSpiralProcess(initialPrompt: string): Promise<any>;
  
  /**
   * Execute a single spiral iteration  
   */
  executeSpiralIteration(input: string, iteration: number): Promise<any>;
  
  /**
   * Check if convergence has been achieved
   */
  checkConvergence(results: any[]): Promise<boolean>;
  
  /**
   * Analyze code or files
   */
  analyzeCode(filePath: string, context: WorkflowContext): Promise<any>;
  
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
  modelClient?: any; // Interface to be defined later
  mcpManager?: any; // Interface to be defined later
  securityValidator?: any; // Interface to be defined later
  configManager?: any; // Interface to be defined later
}

/**
 * Workflow orchestrator events for decoupled communication
 */
export interface WorkflowEvents {
  'workflow:started': { id: string; type: string };
  'workflow:completed': { id: string; result: any };
  'workflow:failed': { id: string; error: Error };
  'workflow:progress': { id: string; message: string; progress?: number };
}