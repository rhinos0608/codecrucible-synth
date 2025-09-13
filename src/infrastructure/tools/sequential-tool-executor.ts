import { createLogger } from '../logging/logger-adapter.js';
import { ResponseNormalizer } from '../../utils/response-normalizer.js';
import { DomainAnalysis, DomainAwareToolOrchestrator } from './domain-aware-tool-orchestrator.js';
import { PerformanceProfiler } from '../performance/profiler.js';
import { ConsolidatedRustSystem } from '../execution/rust/index.js';

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
  toolArgs?: unknown;
  toolResult?: unknown;
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
  onStepComplete?: (step: number, result: unknown) => void;
  onReasoningStart?: (content: string) => void;
  onToolExecution?: (toolName: string, args: Readonly<Record<string, unknown>>) => void;
  onObservation?: (content: string, confidence: number) => void;
  onProgress?: (current: number, total: number) => void;
}

// Define Tool and ModelClient interfaces to avoid 'any' and unsafe member access
export interface Tool {
  name: string;
  function?: {
    name: string;
    description?: string;
    // Add other properties as needed
  };
  type?: string;
  // Add other properties as needed
}

export interface ModelClient {
  generateText: (
    prompt: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      tools?: unknown[];
    }
  ) => Promise<string>;
}

export class SequentialToolExecutor {
  private readonly domainOrchestrator: DomainAwareToolOrchestrator;
  private maxReasoningSteps: number = 10;
  private currentExecutionId: string = '';
  private readonly performanceProfiler?: PerformanceProfiler;
  private readonly rustBackend?: ConsolidatedRustSystem;

  public constructor(
    performanceProfiler?: PerformanceProfiler,
    rustBackend?: ConsolidatedRustSystem
  ) {
    this.domainOrchestrator = new DomainAwareToolOrchestrator();
    this.performanceProfiler = performanceProfiler;
    this.rustBackend = rustBackend;

    logger.info('SequentialToolExecutor initialized', {
      rustBackendEnabled: !!this.rustBackend,
      rustAvailable: this.rustBackend?.isAvailable() ?? false,
    });
  }

  /**
   * Execute tools sequentially with chain-of-thought reasoning
   */
  public async executeWithReasoning(
    prompt: string,
    availableTools: readonly Tool[],
    modelClient: ModelClient,
    maxSteps: number,
    streamingCallbacks?: Readonly<StreamingCallbacks>
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
          toolNames: availableTools.map((t: Tool) => t.function?.name || t.name).join(','),
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
      const domainResult = this.domainOrchestrator.getToolsForPrompt(
        prompt,
        availableTools as Tool[]
      );

      const executionPlan: ExecutionPlan = {
        goal: prompt.length > 100 ? `${prompt.substring(0, 100)}...` : prompt,
        domain: domainResult.analysis.primaryDomain,
        estimatedSteps: this.estimateSteps(prompt, domainResult.analysis),
        selectedTools: (domainResult.tools as Tool[])
          .map((t: Readonly<Tool>) => t.function?.name ?? t.name)
          .filter((name: string): name is string => typeof name === 'string'),
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
      let retryWithAllTools = false;
      const maxNoToolRetries = 2;
      let noToolRetryCount = 0;

      while (currentStep <= maxSteps && !taskCompleted) {
        // Reasoning step: What should I do next?
        const toolsForReasoning = (
          retryWithAllTools ? availableTools : domainResult.tools
        ) as ReadonlyArray<Tool>;
        const reasoningResult = await this.generateReasoning(
          accumulatedContext,
          reasoningChain,
          toolsForReasoning,
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
            content: reasoningResult.conclusion ?? 'Task completed based on reasoning.',
            confidence: reasoningResult.confidence,
            timestamp: new Date(),
          });
          taskCompleted = true;
          break;
        }

        // If model explicitly selected no tool, retry with broader set or conclude
        if (reasoningResult.selectedTool === null) {
          logger.info('Model selected no tool; retrying if possible', {
            attempt: noToolRetryCount + 1,
            reasoning: reasoningResult.thought,
          });

          if (noToolRetryCount < maxNoToolRetries) {
            noToolRetryCount++;
            retryWithAllTools = true;
            currentStep += 1; // account for thought step
            continue; // retry reasoning with broader toolset
          }

          reasoningChain.push({
            step: currentStep + 1,
            type: 'conclusion',
            content: 'No tool selected after retries. Providing direct response.',
            confidence: reasoningResult.confidence,
            timestamp: new Date(),
          });
          taskCompleted = true;
          currentStep += 2;
          continue;
        }

        // Action step: Execute selected tool
        if (reasoningResult.selectedTool) {
          // STREAMING: Notify about tool execution
          const { selectedTool } = reasoningResult;
          const toolName: string =
            typeof selectedTool.function?.name === 'string'
              ? selectedTool.function.name
              : typeof selectedTool.name === 'string'
                ? selectedTool.name
                : 'unknown-tool';
          const toolArgs: Readonly<Record<string, unknown>> =
            reasoningResult.toolArgs && typeof reasoningResult.toolArgs === 'object'
              ? (reasoningResult.toolArgs as Readonly<Record<string, unknown>>)
              : {};

          streamingCallbacks?.onStepStart?.(currentStep + 1, 'action', `Executing ${toolName}`);
          streamingCallbacks?.onToolExecution?.(toolName, toolArgs);

          // Start individual tool profiling
          let toolOperationId: string | undefined;
          if (this.performanceProfiler && profilingSessionId) {
            toolOperationId = this.performanceProfiler.startOperation(
              profilingSessionId,
              `individual_tool_${toolName}`,
              'tool_execution',
              {
                toolName,
                toolType: typeof selectedTool.type === 'string' ? selectedTool.type : 'unknown',
                arguments: toolArgs,
                step: currentStep + 1,
                executionMode: 'individual',
              }
            );
          }

          const actionResult = await this.executeToolWithRetries(
            reasoningResult.selectedTool,
            reasoningResult.toolArgs,
            domainResult.tools
          );

          // End individual tool profiling
          if (this.performanceProfiler && profilingSessionId && toolOperationId) {
            this.performanceProfiler.endOperation(profilingSessionId, toolOperationId);
          }

          // Safely extract tool name
          let safeToolName: string = 'unknown-tool';
          const selectedToolCandidate = reasoningResult.selectedTool as Partial<Tool> | undefined;
          if (selectedToolCandidate && typeof selectedToolCandidate === 'object') {
            if (
              selectedToolCandidate.function &&
              typeof selectedToolCandidate.function === 'object' &&
              typeof selectedToolCandidate.function.name === 'string'
            ) {
              safeToolName = selectedToolCandidate.function.name;
            } else if (typeof selectedToolCandidate.name === 'string') {
              safeToolName = selectedToolCandidate.name;
            }
          }

          reasoningChain.push({
            step: currentStep + 1,
            type: 'action',
            content: `Executing ${safeToolName} with args: ${JSON.stringify(reasoningResult.toolArgs)}`,
            toolName: safeToolName,
            toolArgs: reasoningResult.toolArgs,
            toolResult: actionResult.result,
            confidence: 0.9,
            timestamp: new Date(),
          });

          // Observation step: Process tool result
          const normalizedResult = ResponseNormalizer.normalizeToString(actionResult.result);
          const observation = this.generateObservation(normalizedResult, safeToolName);

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
          let prevActionName = 'unknown-tool';
          const prevActionToolCandidate = reasoningResult.selectedTool as Partial<Tool> | undefined;
          if (prevActionToolCandidate && typeof prevActionToolCandidate === 'object') {
            if (
              prevActionToolCandidate.function &&
              typeof prevActionToolCandidate.function === 'object' &&
              typeof prevActionToolCandidate.function.name === 'string'
            ) {
              prevActionName = prevActionToolCandidate.function.name;
            } else if (typeof prevActionToolCandidate.name === 'string') {
              prevActionName = prevActionToolCandidate.name;
            }
          }
          accumulatedContext = `${accumulatedContext}\n\nPrevious action: ${prevActionName}\nResult: ${normalizedResult.substring(0, 500)}`;

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
    previousSteps: ReadonlyArray<ReasoningStep>,
    availableTools: ReadonlyArray<Tool>,
    modelClient: ModelClient
  ): Promise<{
    thought: string;
    selectedTool?: Tool | null;
    toolArgs?: unknown;
    confidence: number;
    shouldStop: boolean;
    conclusion?: string;
  }> {
    const recentSteps = previousSteps.slice(-3); // Last 3 steps for context
    const stepsSummary = recentSteps
      .map((step: Readonly<ReasoningStep>) => `${step.type.toUpperCase()}: ${step.content}`)
      .join('\n');

    const toolOptions = availableTools
      .map(
        (tool: Tool) => `- ${tool.function?.name ?? tool.name}: ${tool.function?.description ?? ''}`
      )
      .join('\n');

    const reasoningPrompt = `You are an AI assistant that USES TOOLS to help users. When tools are available, you should USE them to get real results.

CONTEXT: ${context}

PREVIOUS STEPS:
${stepsSummary}

AVAILABLE TOOLS:
${toolOptions}

CRITICAL: You have tools available that can perform real actions. Use them!
- For filesystem operations (list/read/write files), use filesystem tools
- For git operations, use git tools
- For commands, use execute_command tool
- Only use "NONE" if no relevant tool exists for the request

TASK: What specific tool should I use to help with this request?

Respond in this exact format:
THOUGHT: [explain why you're choosing this specific tool]
ACTION: [exact tool name from available tools - USE A TOOL when relevant!]
ARGS: [tool arguments in JSON format with correct parameter names]
CONFIDENCE: [0.0 to 1.0]
COMPLETE: [YES only after using tools and getting results, NO if more actions needed]
CONCLUSION: [final answer with tool results if COMPLETE=YES, or "N/A"]

REMEMBER: Use the available tools! Don't just describe what you would do - actually do it with the tools.`;

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
    availableTools: ReadonlyArray<Tool>
  ): {
    thought: string;
    selectedTool?: Tool | null;
    toolArgs?: unknown;
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
    let selectedTool: Tool | null | undefined = undefined;
    let toolArgs: unknown = undefined;

    if (actionName && actionName !== 'NONE' && actionName !== 'N/A') {
      selectedTool = availableTools.find(
        (tool: Readonly<Tool>) => (tool.function?.name ?? tool.name) === actionName
      );

      if (selectedTool && argsText && argsText !== 'N/A') {
        try {
          const parsedArgs: unknown = JSON.parse(argsText);
          toolArgs = parsedArgs;
        } catch (error) {
          logger.warn('Failed to parse tool arguments', {
            actionName,
            argsText,
            error: error instanceof Error ? error.message : 'Parse error',
          });
          toolArgs = {};
        }
      }
    } else if (actionName === 'NONE' || actionName === 'N/A') {
      selectedTool = null;
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
   * Execute tool with retry logic and alternative approaches
   */
  private async executeToolWithRetries(
    tool: Tool,
    args: unknown,
    availableTools: ReadonlyArray<Tool>
  ): Promise<{
    result: unknown;
    success: boolean;
    error?: string;
  }> {
    const toolName = tool.function?.name || tool.name || 'unknown';
    logger.info('🔧 Starting tool execution with retries', { toolName, args });

    // Attempt 1: Try original arguments
    let result = await this.executeTool(tool, args, availableTools);
    if (result.success) {
      return result;
    }

    logger.info('🔧 First attempt failed, trying alternative approaches', {
      toolName,
      originalError: result.error,
    });

    // Attempt 2: Try alternative argument formats (for common issues)
    const alternatives = this.generateAlternativeArgs(toolName, args);
    for (const [attemptNum, altArgs] of alternatives.entries()) {
      logger.info(`🔧 Retry ${attemptNum + 2}: Trying alternative args`, {
        toolName,
        altArgs,
      });

      result = await this.executeTool(tool, altArgs, availableTools);
      if (result.success) {
        logger.info('🔧 Tool execution succeeded with alternative args', {
          toolName,
          attempt: attemptNum + 2,
        });
        return result;
      }
    }

    // Attempt 3: Try similar tools if available
    const similarTools = this.findSimilarTools(toolName, availableTools);
    for (const similarTool of similarTools) {
      const similarToolName = similarTool.function?.name || similarTool.name || 'unknown';
      logger.info('🔧 Trying similar tool', {
        originalTool: toolName,
        similarTool: similarToolName,
      });

      result = await this.executeTool(similarTool, args, availableTools);
      if (result.success) {
        logger.info('🔧 Tool execution succeeded with similar tool', {
          originalTool: toolName,
          successfulTool: similarToolName,
        });
        return result;
      }
    }

    // All attempts failed - provide helpful error message
    const finalError = `Tool ${toolName} failed after multiple attempts. Tried ${alternatives.length + 1} argument variations and ${similarTools.length} similar tools. Last error: ${result.error}`;

    logger.warn('🔧 All tool execution attempts failed', {
      toolName,
      attemptsCount: alternatives.length + similarTools.length + 1,
      finalError,
    });

    return {
      result: finalError,
      success: false,
      error: finalError,
    };
  }

  /**
   * Generate alternative argument formats for common failure cases
   */
  private generateAlternativeArgs(toolName: string, originalArgs: unknown): unknown[] {
    const alternatives: unknown[] = [];

    if (typeof originalArgs === 'object' && originalArgs !== null) {
      const args = originalArgs as Record<string, unknown>;

      // For filesystem tools, try different path formats
      if (
        toolName.includes('filesystem') ||
        toolName.includes('file') ||
        toolName.includes('directory')
      ) {
        if (args.path && typeof args.path === 'string') {
          const originalPath = args.path;

          // Try absolute path
          if (!originalPath.startsWith('/') && !originalPath.match(/^[A-Z]:/)) {
            alternatives.push({ ...args, path: `/${originalPath}` });
          }

          // Try relative path
          if (originalPath.startsWith('/')) {
            alternatives.push({ ...args, path: originalPath.substring(1) });
          }

          // Try normalized paths
          alternatives.push({ ...args, path: originalPath.replace(/\\/g, '/') });
          alternatives.push({ ...args, path: originalPath.replace(/\//g, '\\') });

          // Try with current directory prefix
          alternatives.push({ ...args, path: `./${originalPath}` });
        }
      }

      // For search/find tools, try broader searches
      if (toolName.includes('search') || toolName.includes('find')) {
        if (args.pattern && typeof args.pattern === 'string') {
          alternatives.push({ ...args, pattern: `*${args.pattern}*` });
          alternatives.push({ ...args, case_sensitive: false });
        }
      }
    }

    return alternatives;
  }

  /**
   * Find similar tools that might accomplish the same task
   */
  private findSimilarTools(toolName: string, availableTools: ReadonlyArray<Tool>): Tool[] {
    const similar: Tool[] = [];

    // Define tool similarity mappings
    const similarityMappings: Record<string, string[]> = {
      filesystem_read_file: ['file_read', 'mcp_read_file', 'read_file'],
      filesystem_write_file: ['file_write', 'mcp_write_file', 'write_file'],
      filesystem_list_directory: ['file_list', 'mcp_list_directory', 'list_directory'],
      file_read: ['filesystem_read_file', 'mcp_read_file'],
      file_write: ['filesystem_write_file', 'mcp_write_file'],
      mcp_list_directory: ['filesystem_list_directory', 'file_list'],
    };

    const possibleAlternatives = similarityMappings[toolName] || [];

    for (const tool of availableTools) {
      const currentToolName = tool.function?.name || tool.name || '';
      if (possibleAlternatives.includes(currentToolName)) {
        similar.push(tool);
      }
    }

    return similar;
  }

  /**
   * Execute a specific tool with given arguments - NOW WITH REAL MCP INTEGRATION
   */
  private async executeTool(
    tool: Tool,
    args: unknown,
    _availableTools: ReadonlyArray<Tool>
  ): Promise<{
    result: unknown;
    success: boolean;
    error?: string;
  }> {
    const toolName: string =
      typeof tool.function?.name === 'string'
        ? tool.function.name
        : typeof tool.name === 'string'
          ? tool.name
          : 'unknown-tool';
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

        interface MCPResult {
          success?: boolean;
          output?: unknown;
          error?: string;
        }
        const mcpResult = (await toolIntegration.executeToolCall(formattedToolCall)) as MCPResult;

        logger.info('🔧 SEQUENTIAL-EXECUTOR: MCP tool execution result', {
          toolName,
          success: mcpResult?.success,
          hasOutput: !!mcpResult?.output,
          outputType: typeof mcpResult?.output,
        });

        if (mcpResult?.success && mcpResult?.output) {
          const output = mcpResult.output as { content?: unknown };
          return {
            result: (output as { content?: unknown }).content ?? output,
            success: true,
          };
        } else {
          return {
            result: `Tool execution failed: ${mcpResult?.error || 'Unknown error'}`,
            success: false,
            error: mcpResult?.error,
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

        interface BasicToolResult {
          success?: boolean;
          output?: unknown;
          error?: string;
        }
        const basicResult = (await basicToolIntegration.executeToolCall(
          formattedToolCall
        )) as BasicToolResult;

        if (basicResult?.success && basicResult.output) {
          const output = basicResult.output as { content?: unknown };
          return {
            result: (output as { content?: unknown }).content ?? output,
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
  public getExecutionStats(): {
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
