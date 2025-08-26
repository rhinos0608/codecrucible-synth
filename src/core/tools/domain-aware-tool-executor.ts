/**
 * Domain-Aware Tool Executor
 * Infrastructure layer that uses pure domain entities for execution logic
 * Refactored from enhanced-sequential-tool-executor.ts to follow ARCHITECTURE.md
 *
 * Living Spiral Council Applied:
 * - Clean separation between domain logic and infrastructure
 * - Domain entities handle business rules
 * - Infrastructure handles I/O, formatting, and external integrations
 */

import { EventEmitter } from 'events';
import chalk from 'chalk';
import { logger } from '../logger.js';
import { ResponseNormalizer } from '../response-normalizer.js';

// Domain imports - pure business logic
import { ExecutionPlan } from '../../domain/entities/execution-plan.js';
import { ReasoningStep, ReasoningStepType, ConfidenceScore, ToolArguments } from '../../domain/entities/reasoning-step.js';
import { ToolExecution, ToolName } from '../../domain/entities/tool-execution.js';
import { WorkflowTemplate } from '../../domain/entities/workflow-template.js';
import { ExecutionOrchestrationService, ExecutionContext, ExecutionPreferences, ExecutionResult } from '../../domain/services/execution-orchestration-service.js';

// Infrastructure imports - external integrations
import { DomainAwareToolOrchestrator, DomainAnalysis } from './domain-aware-tool-orchestrator.js';
import { getGlobalEnhancedToolIntegration } from './enhanced-tool-integration.js';
import { getGlobalToolIntegration } from './tool-integration.js';
import { WorkflowGuidedExecutor, WorkflowTemplate as LegacyWorkflowTemplate, WorkflowStep } from './workflow-guided-executor.js';

/**
 * Streaming callbacks for real-time execution feedback
 * Infrastructure concern - not domain logic
 */
export interface StreamingCallbacks {
  onReasoningStep?: (step: ReasoningStep) => void;
  onToolExecution?: (execution: ToolExecution) => void;
  onToolResult?: (result: any, success: boolean) => void;
  onProgress?: (currentStep: number, totalEstimated: number) => void;
  onCompletion?: (result: ExecutionResult) => void;
  onError?: (error: Error, step: number) => void;
}

/**
 * Legacy interfaces for backward compatibility
 * These map to domain entities internally
 */
export interface LegacyExecutionResult {
  success: boolean;
  finalResult: string;
  reasoningChain: Array<{
    step: number;
    type: string;
    content: string;
    toolName?: string;
    toolArgs?: any;
    toolResult?: any;
    confidence: number;
    timestamp: Date;
    executionTime?: number;
    metadata?: Record<string, any>;
  }>;
  executionPlan: {
    goal: string;
    domain: string;
    estimatedSteps: number;
    selectedTools: string[];
    reasoning: string;
    confidence: number;
  };
  totalSteps: number;
  executionTime: number;
  tokensUsed?: number;
  streamed: boolean;
}

/**
 * Domain-Aware Tool Executor
 * Infrastructure layer that coordinates between domain services and external tools
 */
export class DomainAwareToolExecutor extends EventEmitter {
  private readonly orchestrationService: ExecutionOrchestrationService;
  private readonly domainOrchestrator: DomainAwareToolOrchestrator;
  private readonly workflowExecutor: WorkflowGuidedExecutor;
  private readonly responseNormalizer: ResponseNormalizer;

  private currentExecutionId: string = '';
  private isStreaming: boolean = false;
  private streamingCallbacks?: StreamingCallbacks;
  private currentOriginalPrompt?: string;

  constructor() {
    super();
    this.orchestrationService = new ExecutionOrchestrationService();
    this.domainOrchestrator = new DomainAwareToolOrchestrator();
    this.workflowExecutor = new WorkflowGuidedExecutor();
    this.responseNormalizer = new ResponseNormalizer();
  }

  /**
   * Main execution method - delegates to domain service for business logic
   */
  async executeWithStreamingReasoning(
    prompt: string,
    availableTools: any[],
    modelClient: any,
    maxSteps: number = 8,
    streamingCallbacks?: StreamingCallbacks
  ): Promise<LegacyExecutionResult> {
    const startTime = Date.now();
    this.currentExecutionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.isStreaming = !!streamingCallbacks;
    this.streamingCallbacks = streamingCallbacks;
    this.currentOriginalPrompt = prompt;

    logger.info('🚀 Starting domain-aware execution with streaming reasoning', {
      executionId: this.currentExecutionId,
      promptLength: prompt.length,
      maxSteps,
      availableToolCount: availableTools.length,
      streamingEnabled: this.isStreaming
    });

    try {
      // Create execution context (infrastructure concern)
      const context = this.createExecutionContext(prompt, availableTools, maxSteps);
      
      // Check for workflow template match (infrastructure integration)
      const workflowTemplate = await this.findWorkflowTemplate(prompt);
      
      // Create execution plan using domain service
      const executionPlan = this.orchestrationService.createExecutionPlan(
        prompt, 
        this.extractToolNames(availableTools),
        workflowTemplate
      );

      // Validate plan feasibility
      const validationResult = this.orchestrationService.validateExecutionPlan(executionPlan, context);
      if (!validationResult.isValid) {
        throw new Error(`Invalid execution plan: ${validationResult.issues.join(', ')}`);
      }

      // Optimize plan based on preferences
      const optimizedPlan = this.orchestrationService.optimizeExecutionPlan(executionPlan, context);
      
      // Execute the reasoning chain
      const domainResult = await this.executeReasoningChain(optimizedPlan, context, modelClient);
      
      // Convert domain result to legacy format for backward compatibility
      return this.convertToLegacyResult(domainResult, startTime);

    } catch (error) {
      logger.error('❌ Execution failed', {
        executionId: this.currentExecutionId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Execute reasoning chain using domain orchestration service
   */
  private async executeReasoningChain(
    plan: ExecutionPlan,
    context: ExecutionContext,
    modelClient: any
  ): Promise<ExecutionResult> {
    const reasoningChain: ReasoningStep[] = [];
    let currentStep = 0;

    // Stream progress update
    await this.streamProgress('🎯 Starting execution with domain-aware reasoning...', 0, plan.stepEstimate.value);

    while (currentStep < context.maxSteps) {
      currentStep++;
      
      // Check if execution should continue using domain service
      const continuationDecision = this.orchestrationService.shouldContinueExecution(
        reasoningChain, 
        context, 
        plan
      );
      
      if (!continuationDecision.shouldContinue) {
        logger.info(`🏁 Stopping execution: ${continuationDecision.reason}`);
        break;
      }

      // Generate next reasoning step using domain service
      const nextStep = this.orchestrationService.createNextReasoningStep(
        reasoningChain, 
        context, 
        plan
      );
      
      if (!nextStep) {
        logger.info('🏁 No next step generated - completing execution');
        break;
      }

      // Stream the reasoning step
      await this.streamReasoningStep(nextStep);
      
      // Execute tool if this is an action step
      if (nextStep.isToolStep() && nextStep.toolName) {
        const toolExecution = await this.executeToolStep(nextStep, context);
        const updatedStep = nextStep.withToolResult(
          toolExecution.result?.output, 
          toolExecution.duration.milliseconds
        );
        reasoningChain.push(updatedStep);
      } else {
        reasoningChain.push(nextStep);
      }

      // Update progress
      await this.streamProgress(
        `Step ${currentStep}: ${nextStep.type.value}`, 
        currentStep, 
        plan.stepEstimate.value
      );
    }

    // Synthesize final result using domain service
    const executionTime = Date.now() - context.executionId.split('_')[1];
    const finalResult = this.orchestrationService.synthesizeFinalResult(
      reasoningChain, 
      plan, 
      context, 
      executionTime
    );

    return finalResult;
  }

  /**
   * Execute a single tool step - infrastructure concern
   */
  private async executeToolStep(step: ReasoningStep, context: ExecutionContext): Promise<ToolExecution> {
    if (!step.toolName || !step.toolArgs) {
      throw new Error('Invalid tool step - missing tool name or arguments');
    }

    const toolExecution = ToolExecution.createPending(step.toolName, step.toolArgs.args);
    
    try {
      // Start execution
      const runningExecution = toolExecution.start();
      
      // Stream tool execution start
      if (this.streamingCallbacks?.onToolExecution) {
        this.streamingCallbacks.onToolExecution(runningExecution);
      }

      // Execute tool using infrastructure integration
      const toolIntegration = getGlobalEnhancedToolIntegration();
      const result = await toolIntegration.executeToolWithMCP(
        { name: step.toolName, args: step.toolArgs.args },
        step.toolArgs.args,
        [] // availableTools - would need to be passed properly
      );

      // Complete execution with success
      const completedExecution = runningExecution.completeSuccess(result);
      
      // Stream tool result
      if (this.streamingCallbacks?.onToolResult) {
        this.streamingCallbacks.onToolResult(result, true);
      }

      return completedExecution;

    } catch (error) {
      // Complete execution with failure
      const failedExecution = toolExecution.completeFailure(
        error instanceof Error ? error.message : String(error)
      );
      
      // Stream tool error
      if (this.streamingCallbacks?.onToolResult) {
        this.streamingCallbacks.onToolResult(null, false);
      }

      return failedExecution;
    }
  }

  /**
   * Infrastructure helpers
   */
  
  private createExecutionContext(
    prompt: string, 
    availableTools: any[], 
    maxSteps: number
  ): ExecutionContext {
    return ExecutionContext.create(
      this.currentExecutionId,
      prompt,
      this.extractToolNames(availableTools),
      maxSteps,
      300000, // 5 minute timeout
      ExecutionPreferences.balanced()
    );
  }

  private async findWorkflowTemplate(prompt: string): Promise<WorkflowTemplate | undefined> {
    // Check legacy workflow system for template match
    const legacyTemplate = this.workflowExecutor.matchWorkflowTemplate(prompt);
    if (legacyTemplate) {
      // Convert legacy template to domain template
      return this.convertLegacyTemplate(legacyTemplate);
    }
    return undefined;
  }

  private convertLegacyTemplate(legacyTemplate: LegacyWorkflowTemplate): WorkflowTemplate {
    // This would be a proper conversion - simplified for now
    return WorkflowTemplate.createProjectAnalysisTemplate(); // Placeholder
  }

  private extractToolNames(availableTools: any[]): string[] {
    return availableTools.map(tool => 
      tool.function?.name || tool.name || 'unknown_tool'
    );
  }

  private async streamReasoningStep(step: ReasoningStep): Promise<void> {
    if (this.streamingCallbacks?.onReasoningStep) {
      this.streamingCallbacks.onReasoningStep(step);
    }

    // Console output for development
    const stepColor = step.type.value === 'error' ? chalk.red : 
                     step.type.value === 'action' ? chalk.blue :
                     step.type.value === 'conclusion' ? chalk.green : chalk.yellow;
    
    logger.info(stepColor(`📝 Step ${step.stepNumber} (${step.type.value}): ${step.content.substring(0, 100)}`));
  }

  private async streamProgress(message: string, currentStep: number, totalSteps: number): Promise<void> {
    if (this.streamingCallbacks?.onProgress) {
      this.streamingCallbacks.onProgress(currentStep, totalSteps);
    }
    
    logger.info(chalk.cyan(`⏳ ${message} (${currentStep}/${totalSteps})`));
  }

  private convertToLegacyResult(domainResult: ExecutionResult, startTime: number): LegacyExecutionResult {
    return {
      success: domainResult.success,
      finalResult: domainResult.finalResult,
      reasoningChain: domainResult.reasoningChain.map(step => ({
        step: step.stepNumber,
        type: step.type.value,
        content: step.content,
        toolName: step.toolName,
        toolArgs: step.toolArgs?.args,
        toolResult: step.toolResult,
        confidence: step.confidence.value,
        timestamp: step.timestamp,
        executionTime: step.executionTime,
        metadata: step.metadata
      })),
      executionPlan: {
        goal: domainResult.executionPlan.goal.description,
        domain: domainResult.executionPlan.domain.value,
        estimatedSteps: domainResult.executionPlan.stepEstimate.value,
        selectedTools: [...domainResult.executionPlan.selectedTools.tools],
        reasoning: domainResult.executionPlan.reasoning,
        confidence: domainResult.executionPlan.confidence.value
      },
      totalSteps: domainResult.totalSteps,
      executionTime: domainResult.executionTime,
      tokensUsed: domainResult.tokensUsed,
      streamed: domainResult.streamed
    };
  }

  /**
   * Legacy methods for backward compatibility
   * These delegate to domain service or provide infrastructure functionality
   */
  
  private isMultiStepTask(prompt: string): boolean {
    // Delegate to domain service
    const goal = this.orchestrationService.createExecutionPlan(prompt, [], undefined).goal;
    return goal.requiresMultipleSteps();
  }

  private getTaskType(prompt: string): string {
    const goal = this.orchestrationService.createExecutionPlan(prompt, [], undefined);
    return goal.goal.estimateComplexity();
  }

  private estimateSteps(prompt: string, analysis: DomainAnalysis): number {
    const plan = this.orchestrationService.createExecutionPlan(prompt, [], undefined);
    return plan.stepEstimate.value;
  }

  /**
   * Formatting and output processing - pure infrastructure concerns
   */
  
  private formatToolEvidence(toolResults: any[]): string {
    // Keep existing formatting logic as it's pure infrastructure
    const fileReadResult = toolResults.find(result => {
      if (result.toolId === 'filesystem_read_file' && result.success && result.output?.content) {
        return true;
      }
      
      if (result.output?.toolId === 'filesystem_read_file' && 
          result.output?.success && result.output?.output?.content) {
        return true;
      }
      
      if (result.result?.toolId === 'filesystem_read_file' && 
          result.result?.success && result.result?.output?.content) {
        return true;
      }
      
      return false;
    });
    
    if (fileReadResult) {
      let content, filePath;
      
      if (fileReadResult.toolId === 'filesystem_read_file') {
        content = fileReadResult.output.content;
        filePath = fileReadResult.output.filePath || 'file';
      } else if (fileReadResult.output?.toolId === 'filesystem_read_file') {
        content = fileReadResult.output.output.content;
        filePath = fileReadResult.output.output.filePath || 'file';
      } else if (fileReadResult.result?.toolId === 'filesystem_read_file') {
        content = fileReadResult.result.output.content;
        filePath = fileReadResult.result.output.filePath || 'file';
      } else {
        return `**Tool Result**: ${JSON.stringify(fileReadResult, null, 2)}`;
      }
      
      const filename = filePath.split(/[/\\]/).pop() || 'file';
      const extension = filename.split('.').pop()?.toLowerCase() || '';
      
      if (extension === 'json') {
        try {
          const parsed = typeof content === 'string' ? JSON.parse(content) : content;
          return `**⚙️ ${filename}**\n\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
        } catch (e) {
          return `**⚙️ ${filename}**\n\n\`\`\`json\n${content}\n\`\`\``;
        }
      } else if (['js', 'ts', 'jsx', 'tsx'].includes(extension)) {
        return `**📄 ${filename}**\n\n\`\`\`${extension}\n${content}\n\`\`\``;
      } else if (extension === 'md') {
        return `**📝 ${filename}**\n\n${content}`;
      } else {
        return `**📄 ${filename}**\n\n${content}`;
      }
    }
    
    // Handle directory listing operations
    const dirListResult = toolResults.find(result =>
      result.toolId === 'filesystem_list_directory' && result.success
    );
    
    if (dirListResult) {
      const listing = dirListResult.output?.listing || JSON.stringify(dirListResult.output, null, 2);
      const dirPath = dirListResult.output?.path || 'directory';
      return `**📁 ${dirPath}**\n\n${listing}`;
    }
    
    return toolResults.map((result, i) => {
      return `**Tool Result ${i + 1}**: ${result.toolId || 'undefined'}\n\n${JSON.stringify(result, null, 2).substring(0, 1000)}`;
    }).join('\n\n---\n\n');
  }
}

/**
 * Factory function for backward compatibility
 */
export function createEnhancedSequentialToolExecutor(): DomainAwareToolExecutor {
  return new DomainAwareToolExecutor();
}