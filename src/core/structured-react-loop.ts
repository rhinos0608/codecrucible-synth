import { BaseTool } from './tools/base-tool.js';
import { AsyncToolExecutor, ToolExecutionResult } from './async-tool-executor.js';
import { logger } from './logger.js';
import { z } from 'zod';

// Structured thought schema for ReAct loop
const StructuredThoughtSchema = z.object({
  reasoning: z.string().describe('Your reasoning about the current situation and what needs to be done'),
  action: z.object({
    type: z.enum(['tool_call', 'tool_sequence', 'tool_parallel', 'complete', 'clarify']),
    tools: z.array(z.object({
      name: z.string(),
      input: z.record(z.unknown()),
      priority: z.number().optional().default(1),
      dependencies: z.array(z.string()).optional().default([])
    })).optional(),
    reasoning: z.string().describe('Why this action is chosen'),
    expectedOutcome: z.string().describe('What you expect this action to achieve')
  }),
  observation: z.string().optional().describe('Analysis of previous action results'),
  nextSteps: z.array(z.string()).optional().describe('Planned follow-up actions'),
  confidence: z.number().min(0).max(1).describe('Confidence in this decision (0-1)')
});

type StructuredThought = z.infer<typeof StructuredThoughtSchema>;

export interface ReActContext {
  workingDirectory: string;
  goal: string;
  maxIterations: number;
  currentIteration: number;
  conversationHistory: Array<{
    type: 'user' | 'thought' | 'action' | 'observation' | 'result';
    content: string;
    timestamp: number;
    metadata?: any;
  }>;
  availableTools: BaseTool[];
  executionResults: ToolExecutionResult[];
  progressMetrics: {
    toolsUsed: Set<string>;
    filesAccessed: Set<string>;
    taskCompletion: number; // 0-1
    stepsCompleted: string[];
  };
}

export interface ReActResult {
  success: boolean;
  result: string;
  iterations: number;
  toolsUsed: string[];
  executionTime: number;
  finalThought?: StructuredThought;
  error?: string;
}

/**
 * Structured ReAct Loop Implementation
 * Based on the Reasoning-Acting-Observing pattern from modern agentic systems
 */
export class StructuredReActLoop {
  private toolExecutor: AsyncToolExecutor;
  private context: ReActContext;

  constructor(
    goal: string,
    availableTools: BaseTool[],
    workingDirectory: string,
    maxIterations: number = 10
  ) {
    this.toolExecutor = AsyncToolExecutor.getInstance();
    this.context = {
      workingDirectory,
      goal,
      maxIterations,
      currentIteration: 0,
      conversationHistory: [],
      availableTools,
      executionResults: [],
      progressMetrics: {
        toolsUsed: new Set(),
        filesAccessed: new Set(),
        taskCompletion: 0,
        stepsCompleted: []
      }
    };

    this.addToHistory('user', goal);
    logger.info(`🎯 Initialized ReAct loop for goal: ${goal}`);
  }

  /**
   * Execute the complete ReAct loop
   */
  public async execute(
    generateThought: (context: ReActContext) => Promise<StructuredThought>
  ): Promise<ReActResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`🔄 Starting ReAct loop with max ${this.context.maxIterations} iterations`);

      while (this.context.currentIteration < this.context.maxIterations) {
        this.context.currentIteration++;
        
        logger.info(`📍 ReAct Iteration ${this.context.currentIteration}/${this.context.maxIterations}`);

        // REASONING: Generate structured thought
        const thought = await this.reasoningPhase(generateThought);
        
        // Check if we should complete
        if (thought.action.type === 'complete') {
          return this.buildSuccessResult(thought, startTime);
        }

        if (thought.action.type === 'clarify') {
          return this.buildClarificationResult(thought, startTime);
        }

        // ACTING: Execute the planned action
        const actionResults = await this.actingPhase(thought);
        
        // OBSERVING: Analyze results and update context
        await this.observingPhase(thought, actionResults);

        // Check progress and decide if we should continue
        const shouldContinue = this.evaluateProgress();
        if (!shouldContinue) {
          logger.info('🎯 Goal achieved or sufficient progress made');
          break;
        }
      }

      // Generate final result
      const finalThought = await this.reasoningPhase(generateThought);
      return this.buildSuccessResult(finalThought, startTime);

    } catch (error) {
      logger.error('❌ ReAct loop execution failed:', error);
      return {
        success: false,
        result: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        iterations: this.context.currentIteration,
        toolsUsed: Array.from(this.context.progressMetrics.toolsUsed),
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * REASONING PHASE: Generate structured thought about current situation
   */
  private async reasoningPhase(
    generateThought: (context: ReActContext) => Promise<StructuredThought>
  ): Promise<StructuredThought> {
    logger.info('🧠 Reasoning phase: Analyzing situation and planning action');
    
    try {
      const thought = await generateThought(this.context);
      
      // Validate the thought structure
      const validatedThought = StructuredThoughtSchema.parse(thought);
      
      this.addToHistory('thought', JSON.stringify(validatedThought, null, 2));
      
      logger.info(`💭 Generated thought with action type: ${validatedThought.action.type}`);
      logger.info(`📊 Confidence level: ${(validatedThought.confidence * 100).toFixed(1)}%`);
      
      return validatedThought;
      
    } catch (error) {
      logger.error('❌ Reasoning phase failed:', error);
      throw new Error(`Failed to generate valid thought: ${error}`);
    }
  }

  /**
   * ACTING PHASE: Execute the planned action
   */
  private async actingPhase(thought: StructuredThought): Promise<ToolExecutionResult[]> {
    if (!thought.action.tools || thought.action.tools.length === 0) {
      logger.warn('⚠️ No tools specified in action, skipping acting phase');
      return [];
    }

    logger.info(`🔧 Acting phase: Executing ${thought.action.tools.length} tools`);
    this.addToHistory('action', thought.action.reasoning);

    const toolsWithInputs = thought.action.tools.map(toolSpec => {
      const tool = this.findTool(toolSpec.name);
      if (!tool) {
        throw new Error(`Tool not found: ${toolSpec.name}`);
      }
      return { tool, input: toolSpec.input, toolName: toolSpec.name };
    });

    let results: ToolExecutionResult[];

    // Execute based on action type
    switch (thought.action.type) {
      case 'tool_parallel':
        logger.info('⚡ Executing tools in parallel');
        const batch = await this.toolExecutor.executeToolBatch(toolsWithInputs);
        results = batch.results;
        break;

      case 'tool_sequence':
        logger.info('🔄 Executing tools in sequence');
        results = [];
        for (const toolWithInput of toolsWithInputs) {
          const result = await this.toolExecutor.executeTool(
            toolWithInput.tool,
            toolWithInput.input,
            toolWithInput.toolName
          );
          results.push(result);
          
          // Stop sequence if a tool fails (unless it's expected)
          if (!result.success && thought.confidence > 0.8) {
            logger.warn('🛑 Stopping sequence due to tool failure');
            break;
          }
        }
        break;

      case 'tool_call':
      default:
        logger.info('🔧 Executing single tool');
        const singleResult = await this.toolExecutor.executeTool(
          toolsWithInputs[0].tool,
          toolsWithInputs[0].input,
          toolsWithInputs[0].toolName
        );
        results = [singleResult];
        break;
    }

    // Update progress metrics
    results.forEach(result => {
      this.context.progressMetrics.toolsUsed.add(result.toolName);
      this.context.executionResults.push(result);
    });

    const successCount = results.filter(r => r.success).length;
    logger.info(`✅ Acting phase complete: ${successCount}/${results.length} tools succeeded`);

    return results;
  }

  /**
   * OBSERVING PHASE: Analyze results and update context
   */
  private async observingPhase(
    thought: StructuredThought,
    actionResults: ToolExecutionResult[]
  ): Promise<void> {
    logger.info('👁️ Observing phase: Analyzing action results');

    // Create observation summary
    const successful = actionResults.filter(r => r.success);
    const failed = actionResults.filter(r => !r.success);
    
    const observation = {
      plannedAction: thought.action.type,
      toolsExecuted: actionResults.length,
      successfulTools: successful.length,
      failedTools: failed.length,
      totalExecutionTime: actionResults.reduce((sum, r) => sum + r.executionTime, 0),
      results: actionResults.map(r => ({
        tool: r.toolName,
        success: r.success,
        hasResult: !!r.result,
        error: r.error
      })),
      goalProgress: this.assessGoalProgress(),
      nextRecommendations: this.generateNextRecommendations(actionResults)
    };

    this.addToHistory('observation', JSON.stringify(observation, null, 2));

    // Update progress metrics based on results
    this.updateProgressMetrics(actionResults);

    // Track files accessed
    this.trackFileAccess(actionResults);

    logger.info(`📊 Observation complete: ${observation.goalProgress}% goal progress`);
  }

  /**
   * Evaluate if we should continue the loop
   */
  private evaluateProgress(): boolean {
    const progress = this.context.progressMetrics.taskCompletion;
    const toolsUsed = this.context.progressMetrics.toolsUsed.size;
    const stepsCompleted = this.context.progressMetrics.stepsCompleted.length;

    // Continue if we haven't made sufficient progress
    if (progress < 0.8 && toolsUsed < 8 && stepsCompleted < 5) {
      return true;
    }

    // Continue if we're making steady progress
    if (this.context.currentIteration > 1 && progress > 0.5) {
      return true;
    }

    // Stop if we've reached our limits
    return false;
  }

  /**
   * Helper methods
   */
  private findTool(toolName: string): BaseTool | null {
    return this.context.availableTools.find(tool => 
      tool.definition.name === toolName
    ) || null;
  }

  private addToHistory(type: string, content: string): void {
    this.context.conversationHistory.push({
      type: type as any,
      content,
      timestamp: Date.now()
    });
  }

  private assessGoalProgress(): number {
    // Simple heuristic based on tools used and successful executions
    const successfulExecutions = this.context.executionResults.filter(r => r.success).length;
    const totalExecutions = this.context.executionResults.length;
    const toolDiversity = this.context.progressMetrics.toolsUsed.size;
    
    if (totalExecutions === 0) return 0;
    
    const successRate = successfulExecutions / totalExecutions;
    const diversityBonus = Math.min(toolDiversity / 5, 1);
    
    return Math.round((successRate * 0.7 + diversityBonus * 0.3) * 100);
  }

  private generateNextRecommendations(results: ToolExecutionResult[]): string[] {
    const recommendations: string[] = [];
    
    const failedTools = results.filter(r => !r.success);
    if (failedTools.length > 0) {
      recommendations.push('Retry failed tools with different parameters');
    }

    if (this.context.progressMetrics.toolsUsed.size < 3) {
      recommendations.push('Use more diverse tools to gather comprehensive information');
    }

    if (!this.context.progressMetrics.toolsUsed.has('listFiles')) {
      recommendations.push('Explore file structure for better understanding');
    }

    return recommendations;
  }

  private updateProgressMetrics(results: ToolExecutionResult[]): void {
    const successfulResults = results.filter(r => r.success);
    
    // Update task completion based on successful tool executions
    const newCompletion = this.assessGoalProgress() / 100;
    this.context.progressMetrics.taskCompletion = Math.max(
      this.context.progressMetrics.taskCompletion,
      newCompletion
    );

    // Add completed steps
    successfulResults.forEach(result => {
      this.context.progressMetrics.stepsCompleted.push(
        `${result.toolName} execution at ${new Date(result.timestamp).toISOString()}`
      );
    });
  }

  private trackFileAccess(results: ToolExecutionResult[]): void {
    results.forEach(result => {
      if (result.success && result.result) {
        // Extract file paths from results (heuristic)
        const resultStr = JSON.stringify(result.result);
        const fileExtensions = ['ts', 'js', 'json', 'md', 'txt', 'yml', 'yaml'];
        fileExtensions.forEach(ext => {
          const regex = new RegExp(`["\']([^"']*\\.${ext})["\']`, 'gi');
          const matches = resultStr.match(regex);
          if (matches) {
            matches.forEach(match => {
              const filePath = match.replace(/['"]/g, '');
              this.context.progressMetrics.filesAccessed.add(filePath);
            });
          }
        });
      }
    });
  }

  private buildSuccessResult(thought: StructuredThought, startTime: number): ReActResult {
    return {
      success: true,
      result: this.generateFinalResult(),
      iterations: this.context.currentIteration,
      toolsUsed: Array.from(this.context.progressMetrics.toolsUsed),
      executionTime: Date.now() - startTime,
      finalThought: thought
    };
  }

  private buildClarificationResult(thought: StructuredThought, startTime: number): ReActResult {
    return {
      success: false,
      result: `Need clarification: ${thought.reasoning}`,
      iterations: this.context.currentIteration,
      toolsUsed: Array.from(this.context.progressMetrics.toolsUsed),
      executionTime: Date.now() - startTime,
      finalThought: thought,
      error: 'Clarification needed'
    };
  }

  private generateFinalResult(): string {
    const metrics = this.context.progressMetrics;
    const successfulExecutions = this.context.executionResults.filter(r => r.success).length;
    
    let result = `## Goal: ${this.context.goal}\n\n`;
    result += `**Status**: ${metrics.taskCompletion >= 80 ? 'Completed' : 'Partially completed'}\n`;
    result += `**Progress**: ${Math.round(metrics.taskCompletion)}%\n`;
    result += `**Iterations**: ${this.context.currentIteration}/${this.context.maxIterations}\n`;
    result += `**Tools used**: ${Array.from(metrics.toolsUsed).join(', ')}\n`;
    result += `**Files accessed**: ${metrics.filesAccessed.size}\n`;
    result += `**Successful operations**: ${successfulExecutions}/${this.context.executionResults.length}\n\n`;
    
    // Add key findings from tool results
    result += `**Key Findings**:\n`;
    this.context.executionResults
      .filter(r => r.success && r.result)
      .slice(-3) // Last 3 successful results
      .forEach(r => {
        result += `- ${r.toolName}: ${this.summarizeResult(r.result)}\n`;
      });

    return result;
  }

  private summarizeResult(result: any): string {
    if (typeof result === 'string') {
      return result.substring(0, 100) + (result.length > 100 ? '...' : '');
    }
    
    if (typeof result === 'object' && result !== null) {
      if (result.summary) return result.summary;
      if (result.message) return result.message;
      if (result.files) return `Found ${result.files.length} files`;
      if (result.error) return `Error: ${result.error}`;
    }
    
    return 'Operation completed successfully';
  }

  /**
   * Get current context for external access
   */
  public getContext(): ReActContext {
    return { ...this.context };
  }

  /**
   * Get execution statistics
   */
  public getStats(): {
    iterations: number;
    toolsUsed: number;
    filesAccessed: number;
    successRate: number;
    averageExecutionTime: number;
  } {
    const successful = this.context.executionResults.filter(r => r.success).length;
    const total = this.context.executionResults.length;
    const avgTime = total > 0 
      ? this.context.executionResults.reduce((sum, r) => sum + r.executionTime, 0) / total 
      : 0;

    return {
      iterations: this.context.currentIteration,
      toolsUsed: this.context.progressMetrics.toolsUsed.size,
      filesAccessed: this.context.progressMetrics.filesAccessed.size,
      successRate: total > 0 ? successful / total : 0,
      averageExecutionTime: avgTime
    };
  }
}