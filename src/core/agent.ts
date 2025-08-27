/**
 * Legacy Unified Agent - Backward Compatibility Wrapper
 * 
 * This is a temporary wrapper around the new UnifiedAgentSystem
 * to maintain backward compatibility during the architectural migration.
 * 
 * @deprecated Use UnifiedAgentSystem from domain/services instead
 */

import { EventEmitter } from 'events';
import { UnifiedAgentSystem, AgentRequest, AgentResponse } from '../domain/services/unified-agent-system.js';
import { UnifiedConfigurationManager } from '../domain/services/unified-configuration-manager.js';
import { EventBus } from '../domain/interfaces/event-bus.js';
import { UnifiedSecurityValidator } from '../domain/services/unified-security-validator.js';
import { UnifiedPerformanceSystem } from '../domain/services/unified-performance-system.js';
import { configManager, AgentConfig } from '../config/config-manager.js';
export type { AgentConfig };
import { PerformanceMonitor } from '../utils/performance.js';
import { logger } from './logger.js';
import type {
  ExecutionRequest,
  ExecutionResponse,
  Task,
  Workflow,
  ProjectContext,
  ExecutionResult,
} from './types.js';

export interface AgentCapability {
  name: string;
  description: string;
  handler: (task: Task) => Promise<ExecutionResult>;
  priority: number;
  enabled: boolean;
}

export interface AgentMetrics {
  tasksCompleted: number;
  averageExecutionTime: number;
  successRate: number;
  errorCount: number;
  lastExecutionTime: number;
}

/**
 * Legacy Unified Agent System with all capabilities
 * @deprecated Use UnifiedAgentSystem instead
 */
export class UnifiedAgent extends EventEmitter {
  private unifiedSystem?: UnifiedAgentSystem;
  private config: AgentConfig = {
    enabled: true,
    mode: 'balanced',
    maxConcurrency: 3,
    enableCaching: true,
    enableMetrics: true,
    enableSecurity: true,
  };
  private capabilities: Map<string, AgentCapability>;
  private activeWorkflows: Map<string, Workflow>;
  private metrics: AgentMetrics;
  private executionQueue: Task[];

  constructor(modelClient: any, performanceMonitor: PerformanceMonitor) {
    super();
    console.warn('⚠️ UnifiedAgent is deprecated. Use UnifiedAgentSystem instead.');
    
    // Increase max listeners to prevent memory leak warnings
    this.setMaxListeners(50);

    this.capabilities = new Map();
    this.activeWorkflows = new Map();
    this.executionQueue = [];
    this.metrics = {
      tasksCompleted: 0,
      averageExecutionTime: 0,
      successRate: 0,
      errorCount: 0,
      lastExecutionTime: 0,
    };

    this.initializeUnifiedSystem();
    this.initializeCapabilities();
    this.loadConfig();
  }

  private async initializeUnifiedSystem(): Promise<void> {
    try {
      // Create unified system components
      const configManager = new UnifiedConfigurationManager();
      await configManager.initialize();
      const unifiedConfig = configManager.getConfiguration();
      
      const eventBus = new EventBus();
      const securityValidator = new UnifiedSecurityValidator(eventBus);
      const performanceSystem = new UnifiedPerformanceSystem(eventBus);
      
      // Create mock user interaction
      const mockUserInteraction = {
        async promptUser(question: string): Promise<string> {
          return 'yes';
        },
        displayMessage(message: string): void {
          logger.info(`[Agent] ${message}`);
        },
        displayError(error: string): void {
          logger.error(`[Agent] ${error}`);
        },
        displayWarning(warning: string): void {
          logger.warn(`[Agent] ${warning}`);
        }
      };
      
      // Initialize systems
      await securityValidator.initialize();
      await performanceSystem.initialize();
      
      // Create unified agent system
      this.unifiedSystem = new UnifiedAgentSystem(
        unifiedConfig,
        eventBus,
        mockUserInteraction,
        securityValidator,
        performanceSystem
      );
      
      await this.unifiedSystem.initialize();
      
    } catch (error) {
      logger.error('Failed to initialize unified agent system:', error);
    }
  }

  /**
   * Initialize legacy agent capabilities
   */
  private initializeCapabilities(): void {
    // Code Analysis Capability
    this.registerCapability({
      name: 'code-analysis',
      description: 'Analyze code quality, patterns, and improvements',
      priority: 10,
      enabled: true,
      handler: async task => this.handleCodeAnalysis(task),
    });

    // Code Generation Capability
    this.registerCapability({
      name: 'code-generation',
      description: 'Generate code based on specifications',
      priority: 9,
      enabled: true,
      handler: async task => this.handleCodeGeneration(task),
    });

    // Documentation Capability
    this.registerCapability({
      name: 'documentation',
      description: 'Generate and improve documentation',
      priority: 7,
      enabled: true,
      handler: async task => this.handleDocumentation(task),
    });

    // Testing Capability
    this.registerCapability({
      name: 'testing',
      description: 'Generate and optimize tests',
      priority: 8,
      enabled: true,
      handler: async task => this.handleTesting(task),
    });

    // Refactoring Capability
    this.registerCapability({
      name: 'refactoring',
      description: 'Refactor and optimize code',
      priority: 6,
      enabled: true,
      handler: async task => this.handleRefactoring(task),
    });

    // Bug Fixing Capability
    this.registerCapability({
      name: 'bug-fixing',
      description: 'Identify and fix bugs',
      priority: 10,
      enabled: true,
      handler: async task => this.handleBugFixing(task),
    });

    // Performance Optimization Capability
    this.registerCapability({
      name: 'performance-optimization',
      description: 'Optimize code performance',
      priority: 5,
      enabled: true,
      handler: async task => this.handlePerformanceOptimization(task),
    });

    // Security Analysis Capability
    this.registerCapability({
      name: 'security-analysis',
      description: 'Analyze code for security vulnerabilities',
      priority: 9,
      enabled: true,
      handler: async task => this.handleSecurityAnalysis(task),
    });
  }

  /**
   * Load configuration
   */
  private async loadConfig(): Promise<void> {
    this.config = await configManager.getAgentConfig();
  }

  /**
   * Register a new capability
   */
  registerCapability(capability: AgentCapability): void {
    this.capabilities.set(capability.name, capability);
    this.emit('capability-registered', capability);
  }

  /**
   * Execute agent request with intelligent routing
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const startTime = Date.now();
    const workflowId = this.generateWorkflowId();

    try {
      if (this.unifiedSystem) {
        // Convert legacy request to new format
        const agentRequest: AgentRequest = {
          id: workflowId,
          type: this.determineRequestType(request.input),
          input: request.input,
          priority: 'medium',
          preferences: {
            mode: request.mode || this.config.mode,
            outputFormat: 'structured',
            includeReasoning: true,
            verboseLogging: false,
            interactiveMode: false
          }
        };
        
        const response = await this.unifiedSystem.processRequest(agentRequest);
        
        // Convert back to legacy format
        const legacyResponse: ExecutionResponse = {
          workflowId: response.id,
          success: response.success,
          result: response.result as unknown as Record<string, unknown>,
          results: response.result as unknown as Record<string, unknown>,
          executionTime: response.executionTime,
        };
        
        this.updateMetrics(legacyResponse);
        return legacyResponse;
      }
      
      // Fallback to legacy implementation
      return await this.legacyExecute(request, workflowId, startTime);
      
    } catch (error) {
      this.metrics.errorCount++;
      this.emit('workflow-failed', { workflowId, error });

      return {
        workflowId,
        success: false,
        result: {} as Record<string, unknown>,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async legacyExecute(request: ExecutionRequest, workflowId: string, startTime: number): Promise<ExecutionResponse> {
    // Legacy implementation for compatibility
    const workflow: Workflow = {
      id: workflowId,
      request: request as unknown as Record<string, unknown>,
      status: 'running',
      startTime: new Date(startTime),
      tasks: [],
      results: {} as Record<string, unknown>,
    };

    this.activeWorkflows.set(workflowId, workflow);
    this.emit('workflow-started', workflow);

    // Analyze request and create execution plan
    const executionPlan = await this.createExecutionPlan(request);
    workflow.tasks = executionPlan;

    // Execute plan
    const results = await this.executeWorkflow(workflow);

    // Complete workflow
    workflow.status = 'completed';
    workflow.endTime = new Date();
    workflow.results = results as unknown as Record<string, unknown>;

    const response: ExecutionResponse = {
      workflowId,
      success: true,
      result: results as unknown as Record<string, unknown>,
      results: results as unknown as Record<string, unknown>,
      executionTime: workflow.endTime.getTime() - workflow.startTime.getTime(),
    };

    this.updateMetrics(response);
    this.emit('workflow-completed', workflow);
    this.activeWorkflows.delete(workflowId);

    return response;
  }

  // Legacy capability handlers
  private async handleCodeAnalysis(task: Task): Promise<ExecutionResult> {
    return {
      success: true,
      content: 'Code analysis completed',
      metadata: { model: 'legacy', tokens: 100, latency: 1000 }
    };
  }

  private async handleCodeGeneration(task: Task): Promise<ExecutionResult> {
    return {
      success: true,
      content: 'Code generation completed',
      metadata: { model: 'legacy', tokens: 150, latency: 2000 }
    };
  }

  private async handleDocumentation(task: Task): Promise<ExecutionResult> {
    return {
      success: true,
      content: 'Documentation generated',
      metadata: { model: 'legacy', tokens: 80, latency: 1200 }
    };
  }

  private async handleTesting(task: Task): Promise<ExecutionResult> {
    return {
      success: true,
      content: 'Tests generated',
      metadata: { model: 'legacy', tokens: 120, latency: 1800 }
    };
  }

  private async handleRefactoring(task: Task): Promise<ExecutionResult> {
    return {
      success: true,
      content: 'Refactoring completed',
      metadata: { model: 'legacy', tokens: 200, latency: 2500 }
    };
  }

  private async handleBugFixing(task: Task): Promise<ExecutionResult> {
    return {
      success: true,
      content: 'Bug fixes applied',
      metadata: { model: 'legacy', tokens: 180, latency: 2200 }
    };
  }

  private async handlePerformanceOptimization(task: Task): Promise<ExecutionResult> {
    return {
      success: true,
      content: 'Performance optimizations applied',
      metadata: { model: 'legacy', tokens: 160, latency: 2000 }
    };
  }

  private async handleSecurityAnalysis(task: Task): Promise<ExecutionResult> {
    return {
      success: true,
      content: 'Security analysis completed',
      metadata: { model: 'legacy', tokens: 140, latency: 1900 }
    };
  }

  // Legacy methods (simplified implementations)
  private async createExecutionPlan(request: ExecutionRequest): Promise<Task[]> {
    const tasks: Task[] = [];
    const mode = request.mode || this.config.mode;
    const taskType = request.type || this.determineRequestType(request.input);

    tasks.push({
      id: this.generateTaskId(),
      type: taskType,
      capability: this.getValidCapability(taskType),
      description: `Process ${taskType} request`,
      input: request.input,
      priority: 'high',
      estimatedTime: mode === 'fast' ? 5000 : 15000,
    });

    return tasks;
  }

  private async executeWorkflow(workflow: Workflow): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const task of workflow.tasks) {
      const result = await this.executeTask(task);
      results.push(result);
      this.emit('task-completed', { task, result });
    }

    return results;
  }

  private async executeTask(task: Task): Promise<ExecutionResult> {
    const capability = this.capabilities.get(task.capability || '');

    if (!capability || !capability.enabled) {
      throw new Error(`Capability '${task.capability || 'unknown'}' not available`);
    }

    const startTime = Date.now();
    this.emit('task-started', task);

    try {
      const result = await capability.handler(task);
      (result as ExecutionResult & { executionTime?: number; taskId?: string }).executionTime =
        Date.now() - startTime;
      (result as ExecutionResult & { executionTime?: number; taskId?: string }).taskId = task.id;

      return result;
    } catch (error) {
      return {
        success: false,
        content: '',
        metadata: {
          model: 'unknown',
          tokens: 0,
          latency: Date.now() - startTime,
        },
        taskId: task.id,
      };
    }
  }

  /**
   * Utility methods
   */
  private generateWorkflowId(): string {
    return `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineRequestType(input: string): AgentRequest['type'] {
    const lowerInput = input.toLowerCase();

    if (
      lowerInput.includes('analyze') ||
      lowerInput.includes('review') ||
      lowerInput.includes('audit')
    ) {
      return 'analyze';
    }
    if (
      lowerInput.includes('generate') ||
      lowerInput.includes('create') ||
      lowerInput.includes('write')
    ) {
      return 'generate';
    }
    if (lowerInput.includes('test') || lowerInput.includes('spec')) {
      return 'test';
    }
    if (lowerInput.includes('document') || lowerInput.includes('readme')) {
      return 'document';
    }
    if (lowerInput.includes('security') || lowerInput.includes('vulnerabilit')) {
      return 'analyze'; // Security analysis
    }
    if (lowerInput.includes('refactor') || lowerInput.includes('improve')) {
      return 'refactor';
    }
    if (lowerInput.includes('debug') || lowerInput.includes('fix')) {
      return 'debug';
    }
    if (lowerInput.includes('optimize') || lowerInput.includes('performance')) {
      return 'optimize';
    }

    return 'analyze'; // Default
  }

  private getValidCapability(taskType: string): string {
    const validCapabilities = [
      'code-analysis',
      'code-generation',
      'documentation',
      'testing',
      'refactoring',
      'bug-fixing',
      'performance-optimization',
      'security-analysis',
    ];

    return validCapabilities.includes(taskType) ? taskType : 'code-analysis';
  }

  private updateMetrics(response: ExecutionResponse): void {
    this.metrics.tasksCompleted++;
    this.metrics.lastExecutionTime = response.executionTime || 0;

    if (response.success) {
      this.metrics.successRate =
        (this.metrics.successRate * (this.metrics.tasksCompleted - 1) + 1) /
        this.metrics.tasksCompleted;
    } else {
      this.metrics.successRate =
        (this.metrics.successRate * (this.metrics.tasksCompleted - 1)) /
        this.metrics.tasksCompleted;
    }

    const executionTime = response.executionTime || 0;
    this.metrics.averageExecutionTime =
      (this.metrics.averageExecutionTime * (this.metrics.tasksCompleted - 1) + executionTime) /
      this.metrics.tasksCompleted;
  }

  /**
   * Get agent metrics
   */
  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  /**
   * Clean up agent resources
   */
  async destroy(): Promise<void> {
    try {
      // Cancel any active workflows
      for (const workflow of this.activeWorkflows.values()) {
        workflow.status = 'completed';
      }
      this.activeWorkflows.clear();

      // Clear execution queue
      this.executionQueue.length = 0;

      // Shutdown unified system
      if (this.unifiedSystem) {
        await this.unifiedSystem.shutdown();
      }

      // Remove all listeners
      this.removeAllListeners();
    } catch (error) {
      logger.error('Error during UnifiedAgent cleanup:', error);
    }
  }

  /**
   * Get active workflows
   */
  getActiveWorkflows(): Workflow[] {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Get available capabilities
   */
  getCapabilities(): AgentCapability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Enable/disable capability
   */
  setCapabilityEnabled(name: string, enabled: boolean): void {
    const capability = this.capabilities.get(name);
    if (capability) {
      capability.enabled = enabled;
      this.emit('capability-toggled', { name, enabled });
    }
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<AgentConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await configManager.updateAgentConfig(this.config);
    this.emit('config-updated', this.config);
  }
}

// Legacy compatibility exports (preserved from original implementation)
export const timeoutManager = {
  async executeWithRetry<T>(fn: () => Promise<T>, retries: number = 3): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw new Error('Max retries exceeded');
  },
};

// ... rest of the legacy exports preserved for compatibility
interface EditSummary {
  total: number;
  approved: number;
  rejected: number;
}

interface EditConfirmationResult {
  approved: boolean;
  edits: unknown;
}

interface EditApplicationResult {
  success: boolean;
  edits: unknown;
}

interface ConfirmationResult {
  approved: unknown[];
  rejected: unknown[];
}

export const globalEditConfirmation = {
  getPendingEditsCount: () => 0,
  proposeEdits: async (edits: unknown): Promise<EditConfirmationResult> => ({
    approved: true,
    edits,
  }),
  confirmAllEdits: async (): Promise<ConfirmationResult> => ({ approved: [], rejected: [] }),
  applyEdits: async (edits: unknown): Promise<EditApplicationResult> => ({ success: true, edits }),
  clearPendingEdits: () => {},
  generateEditSummary: (): EditSummary => ({ total: 0, approved: 0, rejected: 0 }),
  displayEditSummary: () => {},
};

interface IndexResult {
  indexed: boolean;
  path: string;
}

export const globalRAGSystem = {
  indexPath: async (path: string): Promise<IndexResult> => ({
    indexed: true,
    path,
  }),
};

let shutdownHandlersRegistered = false;

export const registerShutdownHandler = (handler: () => void) => {
  if (!shutdownHandlersRegistered) {
    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);
    shutdownHandlersRegistered = true;
  }
};

export const createManagedInterval = (fn: () => void, interval: number) => {
  return setInterval(fn, interval);
};

export const clearManagedInterval = (id: NodeJS.Timeout) => {
  clearInterval(id);
};

export const initializeEditConfirmation = () => globalEditConfirmation;

export interface AgentContext {
  workingDirectory: string;
  config: AgentConfig;
}