import { createLogger } from '../logging/logger-adapter.js';
import { ResponseNormalizer } from '../../utils/response-normalizer.js';
import { DomainAwareToolOrchestrator, DomainAnalysis } from './domain-aware-tool-orchestrator.js';
import { PerformanceProfiler } from '../performance/profiler.js';
import { RustExecutionBackend } from '../execution/rust-executor/index.js';

/**
 * Sequential Tool Executor with Chain-of-Thought Reasoning
 *
 * Implements ReAct pattern (Reasoning + Acting):
 * 1. Thought: What do I need to do?
 * 2. Action: Execute specific tool
 * 3. Observation: Process tool result
 * 4. Thought: What's next based on observation?
 * 5. Repeat until goal achieved
 */

export interface ReasoningStep {
  step: number;
  type: 'thought' | 'action' | 'observation' | 'conclusion';
  content: string;
  toolName?: string;
  toolArgs?: any;
  toolResult?: any;
  confidence: number;
  timestamp: Date;
}

export interface ExecutionPlan {
  goal: string;
  domain: string;
  estimatedSteps: number;
  selectedTools: string[];
  reasoning: string;
}

export interface ExecutionResult {
  success: boolean;
  finalResult: string;
  reasoningChain: ReasoningStep[];
  executionPlan: ExecutionPlan;
  totalSteps: number;
  executionTime: number;
  tokensUsed?: number;
}

const logger = createLogger('ToolExecutor');

export interface StreamingCallbacks {
  onStepStart?: (step: number, type: string, content: string) => void;
  onStepComplete?: (step: number, result: any) => void;
  onReasoningStart?: (content: string) => void;
  onToolExecution?: (toolName: string, args: any) => void;
  onObservation?: (content: string, confidence: number) => void;
  onProgress?: (current: number, total: number) => void;
}

export class SequentialToolExecutor {
  private domainOrchestrator: DomainAwareToolOrchestrator;
  private maxReasoningSteps: number = 10;
  private currentExecutionId: string = '';
  private performanceProfiler?: PerformanceProfiler;
  private rustBackend?: RustExecutionBackend;

  constructor(performanceProfiler?: PerformanceProfiler, rustBackend?: RustExecutionBackend) {
    this.domainOrchestrator = new DomainAwareToolOrchestrator();
    this.performanceProfiler = performanceProfiler;
    this.rustBackend = rustBackend;

    logger.info('SequentialToolExecutor initialized', {
      rustBackendEnabled: !!this.rustBackend,
      rustAvailable: this.rustBackend?.isAvailable() || false,
    });
  }

  /**
   * Execute tools sequentially with chain-of-thought reasoning and streaming feedback
   */
  async executeWithStreamingReasoning(
    prompt: string,
    availableTools: any[],
    modelClient: any,
    maxSteps: number = 8,
    streamingCallbacks?: StreamingCallbacks
  ): Promise<ExecutionResult> {
    return this.executeWithReasoning(
      prompt,
      availableTools,
      modelClient,
      maxSteps,
      streamingCallbacks
    );
  }

  /**
   * Execute tools sequentially with chain-of-thought reasoning
   */
  async executeWithReasoning(
    prompt: string,
    availableTools: any[],
    modelClient: any,
    maxSteps: number = 8,
    streamingCallbacks?: StreamingCallbacks
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.currentExecutionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.maxReasoningSteps = maxSteps;

    // Start profiling session for tool execution
    let profilingSessionId: string | undefined;

    if (this.performanceProfiler) {
      profilingSessionId = this.performanceProfiler.startSession(
        `tool_execution_${this.currentExecutionId}`
      );

      // Profile the overall tool execution workflow
      this.performanceProfiler.startOperation(
        profilingSessionId,
        'tool_execution_workflow',
        'tool_execution',
        {
          executionId: this.currentExecutionId,
          promptLength: prompt.length,
          maxSteps,
          availableToolCount: availableTools.length,
          toolNames: availableTools.map(t => t.function?.name || t.name).join(','),
          executionMode: 'sequential',
        }
      );
    }

    logger.info('Starting sequential tool execution with reasoning', {
      executionId: this.currentExecutionId,
      promptLength: prompt.length,
      maxSteps,
      availableToolCount: availableTools.length,
    });

    const reasoningChain: ReasoningStep[] = [];

    try {
      // Step 1: Domain analysis and planning
      const domainResult = this.domainOrchestrator.getToolsForPrompt(prompt, availableTools);

      const executionPlan: ExecutionPlan = {
        goal: prompt.length > 100 ? `${prompt.substring(0, 100)}...` : prompt,
        domain: domainResult.analysis.primaryDomain,
        estimatedSteps: this.estimateSteps(prompt, domainResult.analysis),
        selectedTools: domainResult.tools.map(t => t.function?.name || t.name),
        reasoning: domainResult.reasoning,
      };

      // Step 2: Initial reasoning
      const initialThought =
        `I need to: ${prompt}. Based on analysis, this is a ${executionPlan.domain} task. ` +
        `I have ${executionPlan.selectedTools.length} relevant tools available. ` +
        `I'll work through this step by step.`;

      reasoningChain.push({
        step: 1,
        type: 'thought',
        content: initialThought,
        confidence: domainResult.analysis.confidence,
        timestamp: new Date(),
      });

      // STREAMING: Notify about initial reasoning
      streamingCallbacks?.onStepStart?.(1, 'thought', initialThought);
      streamingCallbacks?.onReasoningStart?.(initialThought);
      streamingCallbacks?.onProgress?.(1, maxSteps);

      // Step 3: Sequential execution loop
      let currentStep = 2;
      let taskCompleted = false;
      let accumulatedContext = prompt;

      while (currentStep <= maxSteps && !taskCompleted) {
        // Reasoning step: What should I do next?
        const reasoningResult = await this.generateReasoning(
          accumulatedContext,
          reasoningChain,
          domainResult.tools,
          modelClient
        );

        reasoningChain.push({
          step: currentStep,
          type: 'thought',
          content: reasoningResult.thought,
          confidence: reasoningResult.confidence,
          timestamp: new Date(),
        });

        // STREAMING: Notify about reasoning step
        streamingCallbacks?.onStepStart?.(currentStep, 'thought', reasoningResult.thought);
        streamingCallbacks?.onReasoningStart?.(reasoningResult.thought);

        // Check if task is complete based on reasoning
        if (reasoningResult.shouldStop) {
          reasoningChain.push({
            step: currentStep + 1,
            type: 'conclusion',
            content: reasoningResult.conclusion || 'Task completed based on reasoning.',
            confidence: reasoningResult.confidence,
            timestamp: new Date(),
          });
          taskCompleted = true;
          break;
        }

        // Action step: Execute selected tool
        if (reasoningResult.selectedTool) {
          // STREAMING: Notify about tool execution
          const toolName =
            reasoningResult.selectedTool.function?.name || reasoningResult.selectedTool.name;
          streamingCallbacks?.onStepStart?.(currentStep + 1, 'action', `Executing ${toolName}`);
          streamingCallbacks?.onToolExecution?.(toolName, reasoningResult.toolArgs);

          // Start individual tool profiling
          let toolOperationId: string | undefined;
          if (this.performanceProfiler && profilingSessionId) {
            toolOperationId = this.performanceProfiler.startOperation(
              profilingSessionId,
              `individual_tool_${toolName}`,
              'tool_execution',
              {
                toolName,
                toolType: reasoningResult.selectedTool.type || 'unknown',
                arguments: reasoningResult.toolArgs,
                step: currentStep + 1,
                executionMode: 'individual',
              }
            );
          }

          const actionResult = await this.executeTool(
            reasoningResult.selectedTool,
            reasoningResult.toolArgs,
            domainResult.tools
          );

          // End individual tool profiling
          if (this.performanceProfiler && profilingSessionId && toolOperationId) {
            this.performanceProfiler.endOperation(profilingSessionId, toolOperationId);
          }

          reasoningChain.push({
            step: currentStep + 1,
            type: 'action',
            content: `Executing ${reasoningResult.selectedTool.name} with args: ${JSON.stringify(reasoningResult.toolArgs)}`,
            toolName: reasoningResult.selectedTool.name,
            toolArgs: reasoningResult.toolArgs,
            toolResult: actionResult.result,
            confidence: 0.9,
            timestamp: new Date(),
          });

          // Observation step: Process tool result
          const normalizedResult = ResponseNormalizer.normalizeToString(actionResult.result);
          const observation = this.generateObservation(
            normalizedResult,
            reasoningResult.selectedTool.name
          );

          reasoningChain.push({
            step: currentStep + 2,
            type: 'observation',
            content: observation.content,
            confidence: observation.confidence,
            timestamp: new Date(),
          });

          // STREAMING: Notify about observation
          streamingCallbacks?.onStepStart?.(currentStep + 2, 'observation', observation.content);
          streamingCallbacks?.onObservation?.(observation.content, observation.confidence);
          streamingCallbacks?.onProgress?.(currentStep + 2, maxSteps);

          // Update accumulated context for next reasoning step
          accumulatedContext = `${accumulatedContext}\n\nPrevious action: ${reasoningResult.selectedTool.name}\nResult: ${normalizedResult.substring(0, 500)}`;

          // Check if this action completed the task
          if (observation.taskComplete) {
            reasoningChain.push({
              step: currentStep + 3,
              type: 'conclusion',
              content: observation.completionReason || 'Task completed successfully.',
              confidence: observation.confidence,
              timestamp: new Date(),
            });
            taskCompleted = true;
          }

          currentStep += 3; // thought + action + observation
        } else {
          // No tool selected, might be complete or need different approach
          reasoningChain.push({
            step: currentStep + 1,
            type: 'conclusion',
            content: 'No specific tool action needed. Providing direct response.',
            confidence: reasoningResult.confidence,
            timestamp: new Date(),
          });
          taskCompleted = true;
          currentStep += 2;
        }
      }

      // Generate final result from reasoning chain
      const finalResult = this.synthesizeFinalResult(reasoningChain, prompt);

      const result: ExecutionResult = {
        success: true,
        finalResult: ResponseNormalizer.normalizeToString(finalResult),
        reasoningChain,
        executionPlan,
        totalSteps: reasoningChain.length,
        executionTime: Date.now() - startTime,
      };

      logger.info('Sequential execution completed', {
        executionId: this.currentExecutionId,
        success: result.success,
        totalSteps: result.totalSteps,
        executionTime: result.executionTime,
        domain: executionPlan.domain,
      });

      // End profiling session on success
      if (this.performanceProfiler && profilingSessionId) {
        this.performanceProfiler.endOperation(profilingSessionId, 'tool_execution_workflow');
        this.performanceProfiler.endSession(profilingSessionId);
      }

      return result;
    } catch (error) {
      logger.error('Sequential execution failed', {
        executionId: this.currentExecutionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        completedSteps: reasoningChain.length,
      });

      // End profiling session on error
      if (this.performanceProfiler && profilingSessionId) {
        this.performanceProfiler.endOperation(
          profilingSessionId,
          'tool_execution_workflow',
          error as Error
        );
        this.performanceProfiler.endSession(profilingSessionId);
      }

      return {
        success: false,
        finalResult: `Execution failed after ${reasoningChain.length} steps: ${error instanceof Error ? error.message : 'Unknown error'}`,
        reasoningChain,
        executionPlan: {
          goal: prompt,
          domain: 'error',
          estimatedSteps: 0,
          selectedTools: [],
          reasoning: 'Execution failed',
        },
        totalSteps: reasoningChain.length,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate next reasoning step using LLM
   */
  private async generateReasoning(
    context: string,
    previousSteps: ReasoningStep[],
    availableTools: any[],
    modelClient: any
  ): Promise<{
    thought: string;
    selectedTool?: any;
    toolArgs?: any;
    confidence: number;
    shouldStop: boolean;
    conclusion?: string;
  }> {
    const recentSteps = previousSteps.slice(-3); // Last 3 steps for context
    const stepsSummary = recentSteps
      .map(step => `${step.type.toUpperCase()}: ${step.content}`)
      .join('\n');

    const toolOptions = availableTools
      .map(tool => `- ${tool.function.name}: ${tool.function.description}`)
      .join('\n');

    const reasoningPrompt = `You are an AI assistant working step-by-step to help the user.

CONTEXT: ${context}

PREVIOUS STEPS:
${stepsSummary}

AVAILABLE TOOLS:
${toolOptions}

TASK: Based on the context and previous steps, what should I do next?

Respond in this exact format:
THOUGHT: [your reasoning about what to do next]
ACTION: [tool name to use, or "NONE" if no tool needed]
ARGS: [tool arguments in JSON format, or "N/A"]
CONFIDENCE: [0.0 to 1.0]
COMPLETE: [YES if task is done, NO if more steps needed]
CONCLUSION: [final answer if COMPLETE=YES, or "N/A"]

Be specific and focused. Choose the most relevant tool for the immediate next step.`;

    try {
      const response = await modelClient.generateText(reasoningPrompt, {
        temperature: 0.3, // Lower temperature for more focused reasoning
        maxTokens: 512,
        tools: [], // No tools for the reasoning step itself
      });

      const responseText = ResponseNormalizer.normalizeToString(response);
      return this.parseReasoningResponse(responseText, availableTools);
    } catch (error) {
      logger.warn('Reasoning generation failed, using fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        thought: 'Unable to generate detailed reasoning. Proceeding with available information.',
        confidence: 0.5,
        shouldStop: false,
      };
    }
  }

  /**
   * Parse structured reasoning response from LLM
   */
  private parseReasoningResponse(
    response: string,
    availableTools: any[]
  ): {
    thought: string;
    selectedTool?: any;
    toolArgs?: any;
    confidence: number;
    shouldStop: boolean;
    conclusion?: string;
  } {
    const lines = response.split('\n').map(line => line.trim());

    let thought = '';
    let actionName = '';
    let argsText = '';
    let confidence = 0.7;
    let shouldStop = false;
    let conclusion = '';

    for (const line of lines) {
      if (line.startsWith('THOUGHT:')) {
        thought = line.substring(8).trim();
      } else if (line.startsWith('ACTION:')) {
        actionName = line.substring(7).trim();
      } else if (line.startsWith('ARGS:')) {
        argsText = line.substring(5).trim();
      } else if (line.startsWith('CONFIDENCE:')) {
        const confStr = line.substring(11).trim();
        confidence = Math.min(Math.max(parseFloat(confStr) || 0.7, 0.0), 1.0);
      } else if (line.startsWith('COMPLETE:')) {
        shouldStop = line.substring(9).trim().toUpperCase() === 'YES';
      } else if (line.startsWith('CONCLUSION:')) {
        conclusion = line.substring(11).trim();
      }
    }

    // Find selected tool
    let selectedTool: any = undefined;
    let toolArgs: any = undefined;

    if (actionName && actionName !== 'NONE' && actionName !== 'N/A') {
      selectedTool = availableTools.find(tool => (tool.function?.name || tool.name) === actionName);

      if (selectedTool && argsText && argsText !== 'N/A') {
        try {
          toolArgs = JSON.parse(argsText);
        } catch (error) {
          logger.warn('Failed to parse tool arguments', {
            actionName,
            argsText,
            error: error instanceof Error ? error.message : 'Parse error',
          });
          toolArgs = {};
        }
      }
    }

    return {
      thought: thought || 'Continuing with next step...',
      selectedTool,
      toolArgs: toolArgs || {},
      confidence,
      shouldStop,
      conclusion: shouldStop ? conclusion : undefined,
    };
  }

  /**
   * Execute a specific tool with given arguments - NOW WITH REAL MCP INTEGRATION
   */
  private async executeTool(
    tool: any,
    args: any,
    availableTools: any[]
  ): Promise<{
    result: any;
    success: boolean;
    error?: string;
  }> {
    const toolName = tool.function?.name || tool.name;
    logger.info('🔧 SEQUENTIAL-EXECUTOR: Executing real MCP tool', {
      toolName,
      args,
      toolType: typeof tool,
    });

    try {
      // CRITICAL: Use actual MCP tool execution instead of simulation
      const { getGlobalEnhancedToolIntegration } = await import('./enhanced-tool-integration.js');
      const toolIntegration = getGlobalEnhancedToolIntegration();

      if (toolIntegration) {
        // Format tool call for MCP execution
        const formattedToolCall = {
          function: {
            name: toolName,
            arguments: JSON.stringify(args),
          },
        };

        logger.info('🔧 SEQUENTIAL-EXECUTOR: Calling enhanced tool integration', {
          toolCall: formattedToolCall,
        });

        const mcpResult = await toolIntegration.executeToolCall(formattedToolCall);

        logger.info('🔧 SEQUENTIAL-EXECUTOR: MCP tool execution result', {
          toolName,
          success: mcpResult.success,
          hasOutput: !!mcpResult.output,
          outputType: typeof mcpResult.output,
        });

        if (mcpResult.success && mcpResult.output) {
          return {
            result: mcpResult.output.content || mcpResult.output,
            success: true,
          };
        } else {
          return {
            result: `Tool execution failed: ${mcpResult.error || 'Unknown error'}`,
            success: false,
            error: mcpResult.error,
          };
        }
      }

      // Fallback to basic tool integration
      logger.warn('🔧 SEQUENTIAL-EXECUTOR: Enhanced integration not available, trying basic');
      const { getGlobalToolIntegration } = await import('./tool-integration.js');
      const basicToolIntegration = getGlobalToolIntegration();

      if (basicToolIntegration) {
        const formattedToolCall = {
          function: {
            name: toolName,
            arguments: JSON.stringify(args),
          },
        };

        const basicResult = await basicToolIntegration.executeToolCall(formattedToolCall);

        if (basicResult.success && basicResult.output) {
          return {
            result: basicResult.output.content || basicResult.output,
            success: true,
          };
        }
      }

      // Last resort: return descriptive failure
      return {
        result: `Tool ${toolName} execution failed - no MCP integration available`,
        success: false,
        error: 'No MCP tool integration available',
      };
    } catch (error) {
      logger.error('🔧 SEQUENTIAL-EXECUTOR: Tool execution error', {
        toolName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        result: `Tool ${toolName} execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate observation from tool result
   */
  private generateObservation(
    result: string,
    toolName: string
  ): {
    content: string;
    confidence: number;
    taskComplete: boolean;
    completionReason?: string;
  } {
    // Simple heuristics for determining task completion
    const resultLower = result.toLowerCase();
    const taskComplete =
      resultLower.includes('success') ||
      resultLower.includes('completed') ||
      resultLower.includes('found') ||
      result.length > 100; // Substantial result

    const content = `Tool ${toolName} returned: ${result.substring(0, 200)}${result.length > 200 ? '...' : ''}`;

    return {
      content,
      confidence: 0.8,
      taskComplete,
      completionReason: taskComplete ? 'Tool execution provided substantial result' : undefined,
    };
  }

  /**
   * Estimate number of steps needed for a task
   */
  private estimateSteps(prompt: string, analysis: DomainAnalysis): number {
    const baseSteps = {
      coding: 4,
      research: 3,
      system: 5,
      planning: 3,
      mixed: 6,
    };

    const domainSteps = baseSteps[analysis.primaryDomain as keyof typeof baseSteps] || 4;

    // Adjust based on complexity indicators
    let complexity = 1;
    if (prompt.includes('and') || prompt.includes('then') || prompt.includes('also'))
      complexity += 1;
    if (prompt.length > 200) complexity += 1;
    if (analysis.secondaryDomains.length > 1) complexity += 1;

    return Math.min(domainSteps * complexity, 10);
  }

  /**
   * Synthesize final result from reasoning chain
   */
  private synthesizeFinalResult(steps: ReasoningStep[], originalPrompt: string): string {
    const conclusions = steps.filter(step => step.type === 'conclusion');
    const observations = steps.filter(step => step.type === 'observation');

    if (conclusions.length > 0) {
      return conclusions[conclusions.length - 1].content;
    }

    if (observations.length > 0) {
      const lastObservation = observations[observations.length - 1];
      return `Based on the analysis: ${lastObservation.content}`;
    }

    return `I've processed your request: "${originalPrompt}" through ${steps.length} reasoning steps, but couldn't generate a definitive result.`;
  }

  /**
   * Get execution statistics for debugging
   */
  getExecutionStats(): {
    currentExecutionId: string;
    maxSteps: number;
    availableDomains: Array<{ name: string; description: string }>;
  } {
    return {
      currentExecutionId: this.currentExecutionId,
      maxSteps: this.maxReasoningSteps,
      availableDomains: this.domainOrchestrator.getAvailableDomains(),
    };
  }
}
