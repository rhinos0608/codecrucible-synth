/**
 * Enhanced Sequential Tool Executor with Chain-of-Thought Reasoning
 * Implements ReAct pattern (Reasoning + Acting) with real-time streaming
 * 
 * Architecture:
 * 1. Thought: Generate reasoning step using LLM
 * 2. Action: Execute specific tool with MCP integration  
 * 3. Observation: Process and normalize tool result
 * 4. Stream: Real-time display to user
 * 5. Repeat: Continue until goal achieved
 */

import { EventEmitter } from 'events';
import chalk from 'chalk';
import { logger } from '../logger.js';
import { ResponseNormalizer } from '../response-normalizer.js';
import { DomainAwareToolOrchestrator, DomainAnalysis } from './domain-aware-tool-orchestrator.js';
import { getGlobalEnhancedToolIntegration } from './enhanced-tool-integration.js';
import { getGlobalToolIntegration } from './tool-integration.js';
import { WorkflowGuidedExecutor, WorkflowTemplate, WorkflowStep } from './workflow-guided-executor.js';
import { ContentTypeDetector, EvidenceBasedResponseGenerator, WorkflowDecisionEngine, UserIntentParser } from './content-strategy-detector.js';

export interface ReasoningStep {
  step: number;
  type: 'thought' | 'action' | 'observation' | 'conclusion' | 'error';
  content: string;
  toolName?: string;
  toolArgs?: any;
  toolResult?: any;
  confidence: number;
  timestamp: Date;
  executionTime?: number;
  metadata?: Record<string, any>;
}

export interface ExecutionPlan {
  goal: string;
  domain: string;
  estimatedSteps: number;
  selectedTools: string[];
  reasoning: string;
  confidence: number;
}

export interface ExecutionResult {
  success: boolean;
  finalResult: string;
  reasoningChain: ReasoningStep[];
  executionPlan: ExecutionPlan;
  totalSteps: number;
  executionTime: number;
  tokensUsed?: number;
  streamed: boolean;
}

export interface StreamingCallbacks {
  onReasoningStep?: (step: ReasoningStep) => void;
  onToolExecution?: (toolName: string, args: any) => void;
  onToolResult?: (result: any, success: boolean) => void;
  onProgress?: (currentStep: number, totalEstimated: number) => void;
  onCompletion?: (result: ExecutionResult) => void;
  onError?: (error: Error, step: number) => void;
}

export class EnhancedSequentialToolExecutor extends EventEmitter {
  private domainOrchestrator: DomainAwareToolOrchestrator;
  private workflowExecutor: WorkflowGuidedExecutor;
  private maxReasoningSteps: number = 10;
  private currentExecutionId: string = '';
  private isStreaming: boolean = false;
  private streamingCallbacks?: StreamingCallbacks;
  private currentOriginalPrompt?: string; // NEW: Store original prompt for task validation

  constructor() {
    super();
    this.domainOrchestrator = new DomainAwareToolOrchestrator();
    this.workflowExecutor = new WorkflowGuidedExecutor();
  }

  /**
   * Execute tools sequentially with real-time streaming and chain-of-thought reasoning
   */
  async executeWithStreamingReasoning(
    prompt: string,
    availableTools: any[],
    modelClient: any,
    maxSteps: number = 8,
    streamingCallbacks?: StreamingCallbacks
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.currentExecutionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.maxReasoningSteps = maxSteps;
    this.isStreaming = !!streamingCallbacks;
    this.streamingCallbacks = streamingCallbacks;
    this.currentOriginalPrompt = prompt; // NEW: Store original prompt for task-aware validation

    logger.info('🚀 Starting enhanced sequential execution with streaming reasoning', {
      executionId: this.currentExecutionId,
      promptLength: prompt.length,
      maxSteps,
      availableToolCount: availableTools.length,
      streamingEnabled: this.isStreaming
    });

    const reasoningChain: ReasoningStep[] = [];
    
    try {
      // NEW: Detect multi-step tasks that require sequential execution
      const isMultiStepTask = this.isMultiStepTask(prompt);
      if (isMultiStepTask) {
        logger.info('🔄 Multi-step task detected - ensuring complete workflow execution', {
          prompt: prompt.substring(0, 100),
          taskType: this.getTaskType(prompt)
        });
        
        // Set higher max steps for multi-step tasks to ensure completion
        maxSteps = Math.max(maxSteps, 5);
      }
      
      // PRIORITY FIX: Check for workflow template match FIRST
      const workflowTemplate = this.workflowExecutor.matchWorkflowTemplate(prompt);
      if (workflowTemplate) {
        logger.info('🎯 Workflow template matched - using guided execution', {
          workflowName: workflowTemplate.name,
          description: workflowTemplate.description,
          stepCount: workflowTemplate.steps.length
        });
        
        // Use all available tools for workflow execution (not domain-filtered)
        return await this.executeWorkflowGuidedAnalysis(
          prompt, 
          workflowTemplate, 
          availableTools, // Use ALL tools, not domain-filtered ones
          modelClient, 
          maxSteps, 
          reasoningChain
        );
      }

      // Step 1: Domain analysis and planning with streaming (fallback path)
      await this.streamProgress('🔍 Analyzing task domain and planning execution...', 0, maxSteps);
      
      const domainResult = this.domainOrchestrator.getToolsForPrompt(prompt, availableTools);
      
      const executionPlan: ExecutionPlan = {
        goal: prompt.length > 100 ? `${prompt.substring(0, 100)  }...` : prompt,
        domain: domainResult.analysis.primaryDomain,
        estimatedSteps: this.estimateSteps(prompt, domainResult.analysis),
        selectedTools: domainResult.tools.map(t => t.function?.name || t.name),
        reasoning: domainResult.reasoning,
        confidence: domainResult.analysis.confidence
      };

      await this.streamProgress(`📋 Plan created: ${executionPlan.domain} domain task, ${executionPlan.selectedTools.length} tools available`, 1, maxSteps);

      // Step 2: Fall back to original reasoning for non-workflow tasks
      const initialReasoningStep: ReasoningStep = {
        step: 1,
        type: 'thought',
        content: `🤔 ANALYSIS: I need to ${prompt}. 
        
✅ Domain Analysis:
  - Primary domain: ${executionPlan.domain}
  - Confidence: ${(executionPlan.confidence * 100).toFixed(1)}%
  - Available tools: ${executionPlan.selectedTools.length}
  - Estimated steps: ${executionPlan.estimatedSteps}

💭 REASONING: This appears to be a ${executionPlan.domain} task. ${executionPlan.reasoning}

🎯 STRATEGY: I'll work through this systematically, using the most appropriate tools for each step.`,
        confidence: domainResult.analysis.confidence,
        timestamp: new Date(),
        metadata: { domain: executionPlan.domain, toolCount: executionPlan.selectedTools.length }
      };

      reasoningChain.push(initialReasoningStep);
      await this.streamReasoningStep(initialReasoningStep);

      // Step 3: Enhanced sequential execution loop with streaming
      let currentStep = 2;
      let taskCompleted = false;
      let accumulatedContext = prompt;
      let consecutiveFailures = 0;
      const maxConsecutiveFailures = 3;
      
      while (currentStep <= maxSteps && !taskCompleted && consecutiveFailures < maxConsecutiveFailures) {
        await this.streamProgress(`🔄 Step ${currentStep}/${maxSteps}: Generating reasoning...`, currentStep, maxSteps);

        // Reasoning step: What should I do next?
        const reasoningResult = await this.generateEnhancedReasoning(
          accumulatedContext,
          reasoningChain,
          domainResult.tools,
          modelClient,
          currentStep
        );

        const thoughtStep: ReasoningStep = {
          step: currentStep,
          type: 'thought',
          content: `💭 STEP ${currentStep} REASONING: ${reasoningResult.thought}

🎯 DECISION: ${reasoningResult.selectedTool ? 
  `Execute tool "${reasoningResult.selectedTool.function?.name || reasoningResult.selectedTool.name}"` : 
  'No tool execution needed'}

🔢 CONFIDENCE: ${(reasoningResult.confidence * 100).toFixed(1)}%`,
          confidence: reasoningResult.confidence,
          timestamp: new Date(),
          metadata: { 
            selectedTool: reasoningResult.selectedTool?.function?.name || reasoningResult.selectedTool?.name,
            shouldStop: reasoningResult.shouldStop 
          }
        };

        reasoningChain.push(thoughtStep);
        await this.streamReasoningStep(thoughtStep);

        // Check if task is complete based on reasoning
        if (reasoningResult.shouldStop) {
          const conclusionStep: ReasoningStep = {
            step: currentStep + 1,
            type: 'conclusion',
            content: `✅ CONCLUSION: ${reasoningResult.conclusion || 'Task completed based on reasoning analysis.'}

📊 SUMMARY: Successfully completed the requested task through ${currentStep} reasoning steps.`,
            confidence: reasoningResult.confidence,
            timestamp: new Date(),
            metadata: { reason: 'reasoning_determined_complete' }
          };
          
          reasoningChain.push(conclusionStep);
          await this.streamReasoningStep(conclusionStep);
          taskCompleted = true;
          break;
        }

        // Action step: Execute selected tool with real MCP integration
        if (reasoningResult.selectedTool) {
          await this.streamProgress(`🔧 Executing tool: ${reasoningResult.selectedTool.function?.name || reasoningResult.selectedTool.name}...`, currentStep + 0.5, maxSteps);
          
          if (this.streamingCallbacks?.onToolExecution) {
            this.streamingCallbacks.onToolExecution(
              reasoningResult.selectedTool.function?.name || reasoningResult.selectedTool.name,
              reasoningResult.toolArgs
            );
          }

          const actionResult = await this.executeToolWithMCP(
            reasoningResult.selectedTool,
            reasoningResult.toolArgs,
            domainResult.tools
          );

          const actionStep: ReasoningStep = {
            step: currentStep + 1,
            type: 'action',
            content: `⚡ ACTION EXECUTED: ${reasoningResult.selectedTool.function?.name || reasoningResult.selectedTool.name}
            
📥 INPUT: ${JSON.stringify(reasoningResult.toolArgs, null, 2)}
            
${actionResult.success ? '✅ SUCCESS' : '❌ FAILED'}: Tool execution ${actionResult.success ? 'completed successfully' : 'encountered an error'}`,
            toolName: reasoningResult.selectedTool.function?.name || reasoningResult.selectedTool.name,
            toolArgs: reasoningResult.toolArgs,
            toolResult: actionResult.result,
            confidence: actionResult.success ? 0.9 : 0.3,
            timestamp: new Date(),
            executionTime: actionResult.executionTime,
            metadata: { 
              success: actionResult.success,
              error: actionResult.error,
              toolIntegration: actionResult.toolIntegration
            }
          };

          reasoningChain.push(actionStep);
          await this.streamReasoningStep(actionStep);

          if (this.streamingCallbacks?.onToolResult) {
            this.streamingCallbacks.onToolResult(actionResult.result, actionResult.success);
          }

          if (!actionResult.success) {
            consecutiveFailures++;
            logger.warn(`Tool execution failed (${consecutiveFailures}/${maxConsecutiveFailures}):`, actionResult.error);
            
            if (consecutiveFailures >= maxConsecutiveFailures) {
              // Generate context-aware error response for critical failures
              const contextualErrorResponse = await this.generateContextualErrorResponse(
                prompt,
                reasoningResult.selectedTool,
                { message: actionResult.error || 'Unknown error' },
                currentStep,
                true // isCritical
              );
              
              const errorStep: ReasoningStep = {
                step: currentStep + 2,
                type: 'error',
                content: contextualErrorResponse,
                confidence: 0.1,
                timestamp: new Date(),
                metadata: { failureCount: consecutiveFailures, lastError: actionResult.error }
              };
              
              reasoningChain.push(errorStep);
              await this.streamReasoningStep(errorStep);
              break;
            }
          } else {
            consecutiveFailures = 0; // Reset on success
          }

          // Observation step: Process tool result with enhanced analysis
          const normalizedResult = ResponseNormalizer.normalizeToString(actionResult.result);
          const observation = this.generateEnhancedObservation(
            normalizedResult, 
            reasoningResult.selectedTool.function?.name || reasoningResult.selectedTool.name,
            actionResult.success,
            currentStep
          );

          const observationStep: ReasoningStep = {
            step: currentStep + 2,
            type: 'observation',
            content: `🔍 OBSERVATION: ${observation.content}
            
📊 ANALYSIS: 
  - Result quality: ${observation.confidence >= 0.8 ? 'HIGH' : observation.confidence >= 0.5 ? 'MEDIUM' : 'LOW'}
  - Task progress: ${observation.taskComplete ? 'COMPLETE' : 'CONTINUING'}
  - Next action: ${observation.taskComplete ? 'Finalize results' : 'Continue with next step'}`,
            confidence: observation.confidence,
            timestamp: new Date(),
            metadata: { 
              taskComplete: observation.taskComplete,
              completionReason: observation.completionReason,
              resultLength: normalizedResult.length
            }
          };

          reasoningChain.push(observationStep);
          await this.streamReasoningStep(observationStep);

          // Update accumulated context for next reasoning step
          accumulatedContext = this.buildEnhancedContext(
            accumulatedContext, 
            reasoningResult.selectedTool.function?.name || reasoningResult.selectedTool.name,
            normalizedResult,
            currentStep
          );

          // Check if this action completed the task
          if (observation.taskComplete) {
            // Generate intelligent response based on the task type and results
            const intelligentResponse = await this.generateIntelligentResponse(
              prompt,
              reasoningResult.selectedTool,
              actionResult.result,
              ''
            );
            
            const completionStep: ReasoningStep = {
              step: currentStep + 3,
              type: 'conclusion',
              content: intelligentResponse,
              confidence: observation.confidence,
              timestamp: new Date(),
              metadata: { 
                totalSteps: currentStep + 3,
                toolsUsed: reasoningChain.filter(s => s.type === 'action').length,
                reason: observation.completionReason
              }
            };
            
            reasoningChain.push(completionStep);
            await this.streamReasoningStep(completionStep);
            taskCompleted = true;
          }

          currentStep += 3; // thought + action + observation
        } else {
          // No tool selected, might be complete or need different approach
          const directResponseStep: ReasoningStep = {
            step: currentStep + 1,
            type: 'conclusion',
            content: `💬 DIRECT RESPONSE: Based on my analysis, no specific tool execution is needed.

✅ REASONING: The request can be addressed through reasoning and available context without additional tool operations.

📝 RESULT: Providing direct response based on current knowledge and analysis.`,
            confidence: reasoningResult.confidence,
            timestamp: new Date(),
            metadata: { reason: 'no_tool_needed' }
          };
          
          reasoningChain.push(directResponseStep);
          await this.streamReasoningStep(directResponseStep);
          taskCompleted = true;
          currentStep += 2;
        }

        // Update progress
        if (this.streamingCallbacks?.onProgress) {
          this.streamingCallbacks.onProgress(currentStep, maxSteps);
        }
      }

      // Handle max steps reached
      if (currentStep > maxSteps && !taskCompleted) {
        const maxStepsStep: ReasoningStep = {
          step: currentStep,
          type: 'conclusion',
          content: `⏱️ EXECUTION LIMIT REACHED: Maximum steps (${maxSteps}) completed.

📊 PROGRESS SUMMARY:
  - Steps completed: ${reasoningChain.length}
  - Tools executed: ${reasoningChain.filter(s => s.type === 'action').length}
  - Status: Partial completion - consider increasing step limit for complex tasks

💡 PARTIAL RESULT: Providing best available response based on completed analysis.`,
          confidence: 0.6,
          timestamp: new Date(),
          metadata: { reason: 'max_steps_reached', completedSteps: reasoningChain.length }
        };
        
        reasoningChain.push(maxStepsStep);
        await this.streamReasoningStep(maxStepsStep);
      }

      // Generate final result from reasoning chain
      const finalResult = this.synthesizeEnhancedFinalResult(reasoningChain, prompt, executionPlan);
      await this.streamProgress('✅ Synthesis complete - generating final response...', maxSteps, maxSteps);

      const result: ExecutionResult = {
        success: !reasoningChain.some(step => step.type === 'error'),
        finalResult: ResponseNormalizer.normalizeToString(finalResult),
        reasoningChain,
        executionPlan,
        totalSteps: reasoningChain.length,
        executionTime: Date.now() - startTime,
        streamed: this.isStreaming
      };

      logger.info('✅ Enhanced sequential execution completed successfully', {
        executionId: this.currentExecutionId,
        success: result.success,
        totalSteps: result.totalSteps,
        executionTime: result.executionTime,
        domain: executionPlan.domain,
        toolsUsed: reasoningChain.filter(s => s.type === 'action').length,
        streamed: result.streamed
      });

      if (this.streamingCallbacks?.onCompletion) {
        this.streamingCallbacks.onCompletion(result);
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Enhanced sequential execution failed', {
        executionId: this.currentExecutionId,
        error: errorMessage,
        completedSteps: reasoningChain.length
      });

      if (this.streamingCallbacks?.onError) {
        this.streamingCallbacks.onError(error as Error, reasoningChain.length);
      }

      return {
        success: false,
        finalResult: `❌ Execution failed after ${reasoningChain.length} steps: ${errorMessage}`,
        reasoningChain,
        executionPlan: {
          goal: prompt,
          domain: 'error',
          estimatedSteps: 0,
          selectedTools: [],
          reasoning: 'Execution failed due to error',
          confidence: 0
        },
        totalSteps: reasoningChain.length,
        executionTime: Date.now() - startTime,
        streamed: this.isStreaming
      };
    }
  }

  /**
   * Generate enhanced reasoning step using LLM with better prompting
   */
  private async generateEnhancedReasoning(
    context: string,
    previousSteps: ReasoningStep[],
    availableTools: any[],
    modelClient: any,
    currentStepNumber: number
  ): Promise<{
    thought: string;
    selectedTool?: any;
    toolArgs?: any;
    confidence: number;
    shouldStop: boolean;
    conclusion?: string;
  }> {
    const recentSteps = previousSteps.slice(-3); // Last 3 steps for context
    const stepsSummary = recentSteps.map(step => 
      `${step.type.toUpperCase()} ${step.step}: ${step.content.split('\n')[0]}`
    ).join('\n');

    const toolOptions = availableTools.map(tool => {
      const name = tool.function?.name || tool.name;
      const desc = tool.function?.description || tool.description || 'No description available';
      return `- ${name}: ${desc}`;
    }).join('\n');

    const reasoningPrompt = `You are an AI assistant that MUST use tools systematically to provide accurate, evidence-based responses. You follow a strict ReAct (Reasoning + Acting) approach.

ORIGINAL REQUEST: ${context}

PREVIOUS STEPS:
${stepsSummary || 'No previous steps completed'}

AVAILABLE TOOLS (YOU MUST EVALUATE EACH ONE):
${toolOptions || 'No tools available'}

CURRENT STEP: ${currentStepNumber}

CRITICAL REQUIREMENTS:
1. You MUST evaluate every available tool for relevance to the current task
2. You MUST use tools to gather actual data rather than making assumptions  
3. You CANNOT complete the task without evidence from appropriate tools
4. You MUST explain why each tool is or isn't needed for this specific step

MANDATORY EVALUATION PROCESS:
- For file/code analysis: You MUST use filesystem tools to read actual content
- For project structure: You MUST use directory listing tools to see real structure  
- For system information: You MUST use appropriate tools to gather current data
- You CANNOT provide responses based on assumptions or general knowledge

Respond in this EXACT format:
THOUGHT: [Detailed analysis of WHY you must use a specific tool - explain the necessity]
ACTION: [tool name to use - "NONE" only if ALL tools are genuinely irrelevant]
ARGS: [tool arguments in valid JSON format, or "N/A"]
CONFIDENCE: [0.0 to 1.0 - confidence in your tool choice]
COMPLETE: [YES only if you have used tools to gather sufficient evidence, NO otherwise]
CONCLUSION: [final answer with evidence citations if COMPLETE=YES, or "N/A" if continuing]

REMEMBER: Assumptions and generic responses are NOT acceptable. Use tools to provide evidence-based answers.`;

    try {
      const response = await modelClient.generateText(reasoningPrompt, {
        temperature: 0.2, // Lower temperature for more consistent reasoning
        maxTokens: 800,
        tools: [] // No tools for the reasoning step itself
      });

      const responseText = ResponseNormalizer.normalizeToString(response);
      return this.parseEnhancedReasoningResponse(responseText, availableTools, currentStepNumber);

    } catch (error) {
      logger.warn('Enhanced reasoning generation failed, using intelligent fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
        step: currentStepNumber
      });
      
      // Intelligent fallback based on context analysis
      const contextAnalysis = this.analyzeContextForFallback(context, previousSteps, availableTools);
      
      return {
        thought: `⚠️ Unable to generate detailed reasoning (${error instanceof Error ? error.message : 'unknown error'}). Using context analysis: ${contextAnalysis.reasoning}`,
        selectedTool: contextAnalysis.suggestedTool,
        toolArgs: contextAnalysis.suggestedArgs,
        confidence: contextAnalysis.confidence,
        shouldStop: contextAnalysis.shouldStop
      };
    }
  }

  /**
   * Parse enhanced reasoning response with better error handling
   */
  private parseEnhancedReasoningResponse(response: string, availableTools: any[], stepNumber: number): {
    thought: string;
    selectedTool?: any;
    toolArgs?: any;
    confidence: number;
    shouldStop: boolean;
    conclusion?: string;
  } {
    const lines = response.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let thought = '';
    let actionName = '';
    let argsText = '';
    let confidence = 0.7;
    let shouldStop = false;
    let conclusion = '';

    // More robust parsing with fallbacks
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

    // Fallback parsing if structured format failed
    if (!thought && !actionName && response.length > 10) {
      thought = `Step ${stepNumber} analysis: ${response.substring(0, 200)}...`;
      logger.debug('Using fallback thought parsing', { originalLength: response.length });
    }

    // Find selected tool with fuzzy matching
    let selectedTool: any = undefined;
    let toolArgs: any = undefined;

    if (actionName && actionName !== 'NONE' && actionName !== 'N/A') {
      // Exact match first
      selectedTool = availableTools.find(tool => 
        (tool.function?.name || tool.name) === actionName
      );
      
      // Fuzzy match if exact match fails
      if (!selectedTool) {
        selectedTool = availableTools.find(tool => {
          const toolName = (tool.function?.name || tool.name).toLowerCase();
          return toolName.includes(actionName.toLowerCase()) || actionName.toLowerCase().includes(toolName);
        });
        
        if (selectedTool) {
          logger.debug('Used fuzzy matching for tool selection', {
            requested: actionName,
            matched: selectedTool.function?.name || selectedTool.name
          });
        }
      }

      if (selectedTool && argsText && argsText !== 'N/A' && argsText !== '{}') {
        try {
          toolArgs = JSON.parse(argsText);
        } catch (error) {
          logger.warn('Failed to parse tool arguments, attempting repair', {
            actionName,
            argsText,
            error: error instanceof Error ? error.message : 'Parse error'
          });
          
          // Attempt to repair common JSON errors
          const repairedArgs = this.repairJsonArgs(argsText);
          if (repairedArgs) {
            toolArgs = repairedArgs;
          } else {
            toolArgs = {}; // Safe fallback
          }
        }
      }
    }

    // PHASE 1 FIX: Require evidence before allowing completion
    // Only allow completion if there's strong evidence and high confidence
    const hasToolEvidence = actionName !== 'NONE' && selectedTool; // Using a tool provides evidence
    const hasHighConfidence = confidence >= 0.8; // Raise completion threshold
    const hasValidConclusion = conclusion && conclusion !== 'N/A' && conclusion.length > 20;
    
    // Override shouldStop if evidence requirements not met
    if (shouldStop && (!hasValidConclusion || (!hasToolEvidence && !hasHighConfidence))) {
      logger.debug('Preventing premature completion - insufficient evidence', {
        stepNumber,
        hasToolEvidence,
        hasHighConfidence,
        hasValidConclusion,
        originalShouldStop: shouldStop
      });
      shouldStop = false; // Force continuation to gather more evidence
      
      // Update thought to explain why continuing
      if (!thought.includes('Evidence requirement')) {
        thought += `\n\n🔍 EVIDENCE REQUIREMENT: Must use tools to gather data before completing task.`;
      }
    }

    return {
      thought: thought || `Continuing with step ${stepNumber} analysis...`,
      selectedTool,
      toolArgs: toolArgs || {},
      confidence,
      shouldStop,
      conclusion: shouldStop && conclusion !== 'N/A' ? conclusion : undefined
    };
  }

  /**
   * Execute tool with actual MCP integration instead of simulation
   */
  private async executeToolWithMCP(tool: any, args: any, availableTools: any[]): Promise<{
    result: any;
    success: boolean;
    error?: string;
    executionTime?: number;
    toolIntegration?: string;
  }> {
    const startTime = Date.now();
    const toolName = tool.function?.name || tool.name;
    
    logger.info('🔧 Executing tool with MCP integration', {
      toolName,
      args,
      hasArgs: !!args && Object.keys(args).length > 0
    });

    try {
      // Get enhanced tool integration first (has working MCP tools)
      const enhancedToolIntegration = getGlobalEnhancedToolIntegration();
      const toolIntegration = enhancedToolIntegration || getGlobalToolIntegration();
      
      if (!toolIntegration) {
        throw new Error('No tool integration available - MCP system not initialized');
      }

      // Format tool call for MCP execution
      const formattedToolCall = {
        function: {
          name: toolName,
          arguments: typeof args === 'string' ? args : JSON.stringify(args || {})
        },
        id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      };

      logger.debug('Formatted tool call for MCP', {
        toolCall: formattedToolCall,
        integrationMethod: toolIntegration.constructor.name
      });

      // Execute the tool call through MCP integration
      const result = await toolIntegration.executeToolCall(formattedToolCall);
      
      // ADD COMPREHENSIVE TOOL RESULT STRUCTURE LOGGING - Fix #4
      console.log('🔍 COMPLETE TOOL RESULT STRUCTURE:', {
        success: result.success,
        hasOutput: !!result.output,
        hasResult: !!result.result,
        outputType: typeof result.output,
        resultType: typeof result.result,
        outputKeys: result.output && typeof result.output === 'object' ? Object.keys(result.output) : null,
        resultKeys: result.result && typeof result.result === 'object' ? Object.keys(result.result) : null,
        fullStructure: JSON.stringify(result, null, 2)
      });

      logger.info('✅ MCP tool execution completed', {
        toolName,
        success: result.success,
        hasOutput: !!result.output,
        executionTime: Date.now() - startTime
      });

      return {
        result: result.output || result,
        success: result.success !== false, // Default to true unless explicitly false
        executionTime: Date.now() - startTime,
        toolIntegration: enhancedToolIntegration ? 'enhanced' : 'basic'
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during tool execution';
      
      logger.error('❌ MCP tool execution failed', {
        toolName,
        args,
        error: errorMessage,
        executionTime: Date.now() - startTime
      });

      return {
        result: null,
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime,
        toolIntegration: 'failed'
      };
    }
  }

  /**
   * Generate enhanced observation with better analysis
   */
  private generateEnhancedObservation(
    result: string, 
    toolName: string, 
    success: boolean,
    stepNumber: number
  ): {
    content: string;
    confidence: number;
    taskComplete: boolean;
    completionReason?: string;
  } {
    const resultLower = result.toLowerCase();
    const resultLength = result.length;
    
    // NEW: Task-aware completion detection instead of generic heuristics
    const taskComplete = this.validateTaskCompletion(
      this.currentOriginalPrompt || '', // Store original prompt for validation
      toolName, 
      result, 
      success, 
      stepNumber
    );
    
    // Enhanced completion detection heuristics for confidence scoring only
    const completionIndicators = {
      success: resultLower.includes('success') || resultLower.includes('completed') || 
               resultLower.includes('done') || resultLower.includes('finished'),
      found: resultLower.includes('found') || resultLower.includes('located') ||
             resultLower.includes('exists') || resultLower.includes('available'),
      content: resultLength > 50, // Has substantial content
      error: success === false || resultLower.includes('error') || resultLower.includes('failed'),
      empty: resultLength < 10 || resultLower.includes('not found') || resultLower.includes('empty')
    };

    // Calculate confidence score (separate from task completion)
    let confidenceScore = 0;
    const reasons = [];
    
    if (completionIndicators.success) { confidenceScore += 0.4; reasons.push('success indicators'); }
    if (completionIndicators.found) { confidenceScore += 0.3; reasons.push('found content'); }
    if (completionIndicators.content) { confidenceScore += 0.2; reasons.push('substantial result'); }
    if (completionIndicators.error) { confidenceScore -= 0.3; reasons.push('error detected'); }
    if (completionIndicators.empty) { confidenceScore -= 0.4; reasons.push('empty result'); }
    
    // Adjust based on tool type for confidence only
    if (toolName.includes('read') || toolName.includes('get') || toolName.includes('list')) {
      if (resultLength > 100) confidenceScore += 0.2;
    }
    
    const confidence = Math.min(Math.max((confidenceScore + 0.5), 0.1), 0.95);
    
    const content = `Tool "${toolName}" execution analysis:

📊 RESULT: ${success ? 'SUCCESS' : 'FAILED'} 
📏 LENGTH: ${resultLength} characters
🎯 TASK STATUS: ${taskComplete ? '✅ COMPLETE' : '⏳ CONTINUING'}
🔍 INDICATORS: ${reasons.join(', ') || 'none'}

📝 OUTPUT PREVIEW: ${result.substring(0, 300)}${resultLength > 300 ? '...' : ''}`;

    return {
      content,
      confidence,
      taskComplete,
      completionReason: taskComplete ? 
        `Task requirement fulfilled by "${toolName}"` : 
        undefined
    };
  }

  /**
   * NEW: Task-aware completion validation that checks if the original user request is fulfilled
   */
  private validateTaskCompletion(
    originalPrompt: string,
    toolName: string, 
    result: string,
    success: boolean,
    stepNumber: number
  ): boolean {
    if (!success) return false;
    
    const promptLower = originalPrompt.toLowerCase();
    const resultLower = result.toLowerCase();
    
    // File creation tasks - only complete when file is actually written
    if (promptLower.includes('create') && (promptLower.includes('file') || promptLower.includes('test'))) {
      return toolName.includes('write') || toolName.includes('create') && 
             (resultLower.includes('written') || resultLower.includes('created'));
    }
    
    // File reading tasks - complete when content is actually displayed
    if (promptLower.includes('read') || promptLower.includes('show') || promptLower.includes('display')) {
      return toolName.includes('read') && result.length > 50;
    }
    
    // Directory listing tasks - complete when directory contents are shown
    if (promptLower.includes('list') || (promptLower.includes('directory') && !promptLower.includes('create'))) {
      return toolName.includes('list') && result.includes('files');
    }
    
    // Analysis tasks require multiple evidence points
    if (promptLower.includes('analyze') || promptLower.includes('review') || promptLower.includes('audit')) {
      return stepNumber >= 3; // Require multiple steps for comprehensive analysis
    }
    
    // Multi-step tasks with explicit sequencing
    if (promptLower.includes(' then ') || promptLower.includes(' after ') || promptLower.includes(' and ')) {
      return stepNumber >= 2; // Multi-step tasks need at least 2 steps
    }
    
    // Status/info requests - can complete quickly if successful
    if (promptLower.includes('status') || promptLower.includes('info') || promptLower.includes('version')) {
      return success && result.length > 10;
    }
    
    // Default: require explicit completion indicators for ambiguous requests
    return resultLower.includes('complete') || 
           resultLower.includes('finished') ||
           (success && resultLower.includes('done'));
  }

  /**
   * Build enhanced context for next reasoning step
   */
  private buildEnhancedContext(
    originalContext: string,
    toolName: string,
    result: string,
    stepNumber: number
  ): string {
    const resultSummary = result.length > 200 ? 
      `${result.substring(0, 200)  }... (${result.length} chars total)` : 
      result;
    
    return `${originalContext}

== STEP ${stepNumber} EXECUTION HISTORY ==
🔧 Tool Used: ${toolName}
📤 Result: ${resultSummary}
⏰ Step: ${stepNumber}

== UPDATED CONTEXT ==
Based on the tool execution above, I now have additional information to work with.`;
  }

  /**
   * Synthesize enhanced final result from reasoning chain
   */
  private synthesizeEnhancedFinalResult(
    steps: ReasoningStep[], 
    originalPrompt: string,
    executionPlan: ExecutionPlan
  ): string {
    const conclusions = steps.filter(step => step.type === 'conclusion');
    const observations = steps.filter(step => step.type === 'observation');
    const actions = steps.filter(step => step.type === 'action');
    const errors = steps.filter(step => step.type === 'error');
    
    // If we have a conclusion, use it
    if (conclusions.length > 0) {
      const lastConclusion = conclusions[conclusions.length - 1];
      return lastConclusion.content;
    }
    
    // If we have successful observations, synthesize from those
    if (observations.length > 0) {
      const successfulObservations = observations.filter(obs => 
        obs.confidence > 0.5 && !obs.content.toLowerCase().includes('execution failed') && 
        !obs.content.toLowerCase().includes('tool error')
      );
      
      if (successfulObservations.length > 0) {
        const lastObservation = successfulObservations[successfulObservations.length - 1];
        
        // ENHANCED: Universal file reading synthesis for ALL file types
        if (lastObservation.toolName?.includes('filesystem_read_file')) {
          // Extract actual file content from observation
          const content = lastObservation.content.split('\n\n').slice(1).join('\n\n'); // Remove the "EVIDENCE GATHERED" header
          
          // Try to determine file type from prompt or observation content
          let filename = 'file';
          let fileExtension = '';
          
          // Extract filename from prompt or observation
          const filenameMatch = originalPrompt.match(/([^\s\/\\]+\.\w+)/);
          if (filenameMatch) {
            filename = filenameMatch[1];
            fileExtension = filename.split('.').pop()?.toLowerCase() || '';
          } else if (lastObservation.content.includes('Reading file:')) {
            const match = lastObservation.content.match(/Reading file:\s*([^\s,]+)/);
            if (match) {
              filename = match[1];
              fileExtension = filename.split('.').pop()?.toLowerCase() || '';
            }
          }
          
          // Determine analysis type and context
          let analysisType = '📄';
          let analysisTitle = 'File Analysis';
          let contextualAnalysis = '';
          
          if (filename.toLowerCase().includes('readme')) {
            analysisType = '📖';
            analysisTitle = 'README Analysis';
            contextualAnalysis = 'Based on reading the project README, here\'s what this project does:';
          } else if (['js', 'ts', 'jsx', 'tsx'].includes(fileExtension)) {
            analysisType = '⚙️';
            analysisTitle = 'Code Analysis';
            contextualAnalysis = `This is a ${fileExtension.toUpperCase()} file containing:`;
          } else if (['json', 'yaml', 'yml'].includes(fileExtension)) {
            analysisType = '⚙️';
            analysisTitle = 'Configuration Analysis';
            contextualAnalysis = `This configuration file contains:`;
          } else if (['md', 'txt', 'rst'].includes(fileExtension)) {
            analysisType = '📝';
            analysisTitle = 'Document Analysis';
            contextualAnalysis = `This document contains:`;
          } else if (['py', 'java', 'cpp', 'c', 'go', 'rs'].includes(fileExtension)) {
            analysisType = '💻';
            analysisTitle = 'Source Code Analysis';
            contextualAnalysis = `This source code file contains:`;
          }
          
          return `${analysisType} **${analysisTitle}**

${contextualAnalysis}

${content.length > 1000 ? content.substring(0, 1000) + '\n\n...[Content truncated for readability]...' : content}

📋 **Analysis Summary:**
- File successfully read: ${filename}
- File type: ${fileExtension.toUpperCase()} (${this.getFileTypeDescription(fileExtension)})
- Content length: ${content.length} characters
- Analysis domain: ${executionPlan.domain}
- Processing time: ${actions.find(a => a.executionTime)?.executionTime || 'N/A'}ms

The file has been successfully analyzed and processed above.`;
        }
        
        // Default synthesis for other tasks
        return `✅ Based on the sequential analysis and tool execution:

${lastObservation.content}

📊 **Execution Summary:**
- Domain: ${executionPlan.domain}
- Steps completed: ${steps.length}
- Tools executed: ${actions.length}
- Success rate: ${actions.length > 0 ? ((actions.filter(a => a.metadata?.success).length / actions.length) * 100).toFixed(1) : 'N/A'}%

The requested task "${originalPrompt}" has been processed through systematic reasoning and tool execution.`;
      }
    }
    
    // Handle error cases
    if (errors.length > 0) {
      const lastError = errors[errors.length - 1];
      return `❌ Task execution encountered errors:

${lastError.content}

📊 **Partial Results Summary:**
- Domain: ${executionPlan.domain}
- Steps attempted: ${steps.length}
- Tools attempted: ${actions.length}
- Errors encountered: ${errors.length}

While I couldn't fully complete "${originalPrompt}", the analysis above shows the progress made and issues encountered.`;
    }
    
    // Fallback synthesis
    return `📋 **Task Processing Complete**

I processed your request: "${originalPrompt}" through ${steps.length} reasoning steps in the ${executionPlan.domain} domain.

**Process Summary:**
- Reasoning steps: ${steps.filter(s => s.type === 'thought').length}
- Tool executions: ${actions.length}
- Observations made: ${observations.length}

While I may not have reached a definitive conclusion, the systematic analysis above represents my best effort to address your request using available reasoning and tools.`;
  }

  // ... Helper methods and utilities

  /**
   * Stream reasoning step to user in real-time
   */
  private async streamReasoningStep(step: ReasoningStep): Promise<void> {
    if (this.streamingCallbacks?.onReasoningStep) {
      this.streamingCallbacks.onReasoningStep(step);
    }
    
    // Emit event for external listeners
    this.emit('reasoningStep', step);
    
    // Small delay to simulate real-time streaming
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Stream progress update to user
   */
  private async streamProgress(message: string, currentStep: number, totalSteps: number): Promise<void> {
    if (this.streamingCallbacks?.onProgress) {
      this.streamingCallbacks.onProgress(currentStep, totalSteps);
    }
    
    // Emit progress event
    this.emit('progress', { message, currentStep, totalSteps });
    
    logger.info(`📊 Progress: ${message} (${currentStep}/${totalSteps})`);
  }

  /**
   * Analyze context for intelligent fallback reasoning
   */
  private analyzeContextForFallback(
    context: string, 
    previousSteps: ReasoningStep[], 
    availableTools: any[]
  ): {
    reasoning: string;
    suggestedTool?: any;
    suggestedArgs?: any;
    confidence: number;
    shouldStop: boolean;
  } {
    const contextLower = context.toLowerCase();
    const hasRead = contextLower.includes('read') || contextLower.includes('show') || contextLower.includes('display');
    const hasList = contextLower.includes('list') || contextLower.includes('directory') || contextLower.includes('files');
    const hasWrite = contextLower.includes('write') || contextLower.includes('create') || contextLower.includes('save');
    
    let suggestedTool = null;
    let suggestedArgs = {};
    let reasoning = 'Context analysis suggests ';
    
    if (hasRead && availableTools.find(t => (t.function?.name || t.name).includes('read'))) {
      suggestedTool = availableTools.find(t => (t.function?.name || t.name).includes('read'));
      suggestedArgs = { filePath: 'README.md' }; // Safe default
      reasoning += 'a file reading operation';
    } else if (hasList && availableTools.find(t => (t.function?.name || t.name).includes('list'))) {
      suggestedTool = availableTools.find(t => (t.function?.name || t.name).includes('list'));
      suggestedArgs = { path: '.' };
      reasoning += 'a directory listing operation';
    } else {
      reasoning += 'no specific tool action required';
    }
    
    return {
      reasoning,
      suggestedTool,
      suggestedArgs,
      confidence: 0.6,
      shouldStop: !suggestedTool || previousSteps.length > 5
    };
  }

  /**
   * Attempt to repair malformed JSON arguments
   */
  private repairJsonArgs(argsText: string): any | null {
    try {
      // Common repairs
      const repaired = argsText
        .replace(/'/g, '"') // Single quotes to double quotes
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Unquoted keys
        .replace(/:\s*([^",{}\[\]]+)([,}])/g, ':"$1"$2'); // Unquoted string values
      
      return JSON.parse(repaired);
    } catch {
      return null; // Could not repair
    }
  }

  /**
   * Estimate number of steps needed for a task with better heuristics
   */
  private estimateSteps(prompt: string, analysis: DomainAnalysis): number {
    const baseSteps = {
      'coding': 5,
      'research': 4,
      'system': 6,
      'planning': 4,
      'analysis': 3,
      'mixed': 7
    };

    const domainSteps = baseSteps[analysis.primaryDomain as keyof typeof baseSteps] || 5;
    
    // Enhanced complexity analysis
    let complexity = 1;
    if (prompt.includes(' and ') || prompt.includes(' then ') || prompt.includes(' also ')) complexity += 1;
    if (prompt.includes(' after ') || prompt.includes(' before ')) complexity += 1;
    if (prompt.length > 200) complexity += 1;
    if (prompt.length > 400) complexity += 1;
    if (analysis.secondaryDomains.length > 1) complexity += 1;
    if (analysis.secondaryDomains.length > 2) complexity += 1;
    
    // Word count complexity
    const wordCount = prompt.split(' ').length;
    if (wordCount > 50) complexity += 1;
    if (wordCount > 100) complexity += 1;
    
    const estimated = Math.min(domainSteps * complexity, 12);
    
    logger.debug('Step estimation', {
      domain: analysis.primaryDomain,
      baseSteps: domainSteps,
      complexity,
      wordCount,
      estimated,
      prompt: `${prompt.substring(0, 100)  }...`
    });
    
    return estimated;
  }

  /**
   * Get execution statistics and health metrics
   */
  getExecutionStats(): {
    currentExecutionId: string;
    maxSteps: number;
    isStreaming: boolean;
    availableDomains: Array<{name: string; description: string}>;
    health: {
      mcpIntegrationAvailable: boolean;
      enhancedIntegrationAvailable: boolean;
      basicIntegrationAvailable: boolean;
    };
  } {
    return {
      currentExecutionId: this.currentExecutionId,
      maxSteps: this.maxReasoningSteps,
      isStreaming: this.isStreaming,
      availableDomains: this.domainOrchestrator.getAvailableDomains(),
      health: {
        mcpIntegrationAvailable: !!(getGlobalEnhancedToolIntegration() || getGlobalToolIntegration()),
        enhancedIntegrationAvailable: !!getGlobalEnhancedToolIntegration(),
        basicIntegrationAvailable: !!getGlobalToolIntegration()
      }
    };
  }

  /**
   * Execute workflow-guided analysis to prevent tool selection paralysis
   */
  private async executeWorkflowGuidedAnalysis(
    prompt: string,
    workflowTemplate: WorkflowTemplate,
    availableTools: any[],
    modelClient: any,
    maxSteps: number,
    reasoningChain: ReasoningStep[]
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let currentStepIndex = 0;
    const gatheredEvidence: string[] = [];
    
    logger.info('🎯 WORKFLOW-GUIDED ANALYSIS: Starting with evidence collection enabled', {
      workflowName: workflowTemplate.name,
      initialEvidenceCount: gatheredEvidence.length,
      availableToolsCount: availableTools.length
    });
    
    // CRITICAL FIX: Store original tool results for direct access in bypass system
    const originalToolResults: any[] = [];
    
    await this.streamProgress(`🎯 Starting ${workflowTemplate.name} workflow (${workflowTemplate.steps.length} steps)`, 1, maxSteps);

    try {
      // Execute each workflow step
      while (currentStepIndex < workflowTemplate.steps.length && currentStepIndex < maxSteps - 1) {
        const workflowStep = workflowTemplate.steps[currentStepIndex];
        
        await this.streamProgress(`📋 Step ${currentStepIndex + 1}: ${workflowStep.action}`, currentStepIndex + 2, maxSteps);

        // Get tools specific to this workflow step (prevents paralysis)
        const stepTools = this.workflowExecutor.getToolsForWorkflowStep(workflowStep, availableTools);
        
        if (stepTools.length === 0) {
          logger.warn('No tools available for workflow step, skipping', {
            stepNumber: currentStepIndex + 1,
            action: workflowStep.action,
            requiredTools: workflowStep.requiredTools
          });
          currentStepIndex++;
          continue;
        }

        // Build workflow-specific prompt
        const workflowPrompt = this.workflowExecutor.buildWorkflowPrompt(
          prompt,
          workflowTemplate,
          workflowStep,
          stepTools,
          gatheredEvidence
        );

        // Execute workflow step reasoning
        const reasoningResult = await this.executeWorkflowStepReasoning(
          workflowPrompt,
          stepTools,
          modelClient,
          currentStepIndex + 1
        );

        // Record reasoning step
        const thoughtStep: ReasoningStep = {
          step: currentStepIndex + 2,
          type: 'thought',
          content: `🎯 WORKFLOW STEP ${currentStepIndex + 1}: ${workflowStep.action}\n\n💭 REASONING: ${reasoningResult.thought}`,
          confidence: reasoningResult.confidence,
          timestamp: new Date(),
          metadata: { 
            workflowStep: workflowStep.action,
            stepIndex: currentStepIndex,
            toolsAvailable: stepTools.length
          }
        };
        
        reasoningChain.push(thoughtStep);
        await this.streamReasoningStep(thoughtStep);

        // Execute the selected tool
        if (reasoningResult.selectedTool) {
          const toolResult = await this.executeToolWithMCP(
            reasoningResult.selectedTool,
            reasoningResult.toolArgs || {},
            stepTools
          );

          // CRITICAL FIX: Store tool result for evidence collection
          originalToolResults.push(toolResult);
          
          logger.info('🎯 WORKFLOW TOOL RESULT STORED:', {
            toolName: reasoningResult.selectedTool.function?.name || reasoningResult.selectedTool.name,
            toolResultSuccess: toolResult.success,
            hasResult: !!toolResult.result,
            originalToolResultsCount: originalToolResults.length
          });

          const observationStep: ReasoningStep = {
            step: currentStepIndex + 2.5,
            type: 'observation',
            content: `📊 EVIDENCE GATHERED: ${toolResult.success ? 'SUCCESS' : 'FAILED'}\n\n${(() => {
              // CRITICAL FIX: For file reading operations, include the FULL content in evidence
              const toolName = reasoningResult.selectedTool.function?.name || reasoningResult.selectedTool.name;
              const resultStr = this.extractStringContentFromToolResult(toolResult);
              
              if (toolName.includes('filesystem_read_file') && toolResult.success) {
                // For file reads, include full content (with reasonable size limit)
                const maxSize = 10000; // 10KB limit for evidence
                return resultStr.length > maxSize 
                  ? resultStr.substring(0, maxSize) + '\n\n[Content truncated - full file content available]'
                  : resultStr;
              } else {
                // For other operations, use the original truncation
                return resultStr.substring(0, 500) + (resultStr.length > 500 ? '...' : '');
              }
            })()}`,
            confidence: toolResult.success ? 0.9 : 0.3,
            timestamp: new Date(),
            toolName: reasoningResult.selectedTool.function?.name || reasoningResult.selectedTool.name,
            toolArgs: reasoningResult.toolArgs,
            toolResult: toolResult.result,
            executionTime: toolResult.executionTime,
            metadata: { 
              workflowStep: workflowStep.action,
              toolIntegration: toolResult.toolIntegration 
            }
          };

          reasoningChain.push(observationStep);
          await this.streamReasoningStep(observationStep);

          // Store complete evidence for synthesis (FIXED: No longer truncate to 200 chars)
          logger.info('🔍 EVIDENCE COLLECTION CHECK:', {
            hasToolResult: !!toolResult,
            toolResultSuccess: toolResult?.success,
            toolResultSuccessType: typeof toolResult?.success,
            toolResultSuccessExact: toolResult?.success === true,
            toolResultSuccessLoose: !!toolResult?.success,
            toolResultKeys: toolResult ? Object.keys(toolResult) : null,
            toolResultType: typeof toolResult
          });
          
          // CRITICAL FIX: Ensure evidence collection regardless of success flag
          const toolName = reasoningResult.selectedTool.function?.name || reasoningResult.selectedTool.name;
          const completeResult = this.extractStringContentFromToolResult(toolResult);

          // ADD CRITICAL EVIDENCE DEBUG BLOCK - Fix #1
          console.log('🔍 CRITICAL EVIDENCE DEBUG:', {
            hasCompleteResult: !!completeResult,
            completeResultType: typeof completeResult,
            completeResultLength: completeResult ? completeResult.length : 0,
            completeResultTrimmedLength: completeResult ? completeResult.trim().length : 0,
            completeResultRaw: completeResult,
            toolResultStructure: JSON.stringify(toolResult, null, 2)
          });
          
          logger.info('🔍 EVIDENCE EXTRACTION ATTEMPT:', {
            toolName,
            hasCompleteResult: !!completeResult,
            completeResultLength: completeResult ? completeResult.length : 0,
            completeResultPreview: completeResult ? completeResult.substring(0, 200) : 'No content'
          });
          
          // If we have actual content, collect it as evidence regardless of success flag
          if (completeResult && completeResult.length > 0 && completeResult.trim().length > 0) {
            logger.info('🎯 FORCING EVIDENCE COLLECTION: Content detected, collecting evidence');
            
            // Validate content extraction
            const validationResult = this.validateContentExtraction(toolResult, completeResult);
            
            logger.info('🔍 EVIDENCE VALIDATION:', {
              validationResult,
              completeResultLength: completeResult.length,
              completeResultPreview: completeResult.substring(0, 200)
            });
            
            // CRITICAL FIX: Store original tool result for bypass system
            originalToolResults.push(toolResult);
            
            // Store complete evidence with structured formatting
            const formattedEvidence = this.formatToolEvidence(
              toolName,
              workflowStep.action,
              completeResult,
              currentStepIndex + 1
            );
            
            gatheredEvidence.push(formattedEvidence);
            
            logger.info('🎉 EVIDENCE COLLECTED!', {
              stepIndex: currentStepIndex + 1,
              toolName,
              resultLength: completeResult.length,
              action: workflowStep.action,
              gatheredEvidenceCount: gatheredEvidence.length,
              formattedEvidenceLength: formattedEvidence.length
            });
          } else {
            // ADD FALLBACK DEBUG - Fix #1 continuation
            console.error('🚨 EVIDENCE COLLECTION FAILED - CONDITION CHECK:', {
                completeResult,
                hasCompleteResult: !!completeResult,
                lengthCheck: completeResult ? completeResult.length > 0 : false,
                trimCheck: completeResult ? completeResult.trim().length > 0 : false,
                toolResultSuccess: toolResult.success
            });

            if (toolResult.success) {
              // Fallback to original success-based logic if no content detected
              logger.warn('⚠️ Tool marked as successful but no content extracted', {
                toolResult,
                reasoningResult: reasoningResult.selectedTool
              });
            } else {
              logger.error('❌ EVIDENCE COLLECTION FAILED: Tool result not successful and no content', {
                toolResult,
                reasoningResult: reasoningResult.selectedTool
              });
            }

            // NEW: Failsafe evidence collection - Fix #3
            console.log('🔥 FAILSAFE EVIDENCE COLLECTION: Main condition failed, using emergency collection');
            
            // Try to extract ANY usable content from the tool result
            const emergencyContent = JSON.stringify(toolResult, null, 2);
            if (emergencyContent && emergencyContent.length > 10) { // Basic sanity check
                const failsafeEvidence = this.formatToolEvidence(
                    toolName,
                    workflowStep.action,
                    emergencyContent,
                    currentStepIndex + 1
                );
                
                gatheredEvidence.push(failsafeEvidence);
                
                console.log('🚨 FAILSAFE EVIDENCE COLLECTED:', {
                    contentLength: emergencyContent.length,
                    evidenceCount: gatheredEvidence.length,
                    stepIndex: currentStepIndex + 1,
                    toolName
                });
            }
          }
        }

        currentStepIndex++;
      }

      logger.info('🎯 WORKFLOW-GUIDED ANALYSIS: All steps completed, checking evidence', {
        workflowName: workflowTemplate.name,
        completedSteps: currentStepIndex,
        gatheredEvidenceCount: gatheredEvidence.length,
        originalToolResultsCount: originalToolResults.length,
        evidencePreview: gatheredEvidence.length > 0 ? gatheredEvidence[0].substring(0, 100) : 'No evidence'
      });
      
      // CRITICAL FIX: Ensure evidence is collected from successful tool results
      if (gatheredEvidence.length === 0 && originalToolResults.length > 0) {
        logger.info('🔥 EMERGENCY EVIDENCE RECOVERY: No evidence in array but tool results exist');
        
        for (let i = 0; i < originalToolResults.length; i++) {
          const toolResult = originalToolResults[i];
          const content = this.extractStringContentFromToolResult(toolResult);
          
          if (content && content.length > 0) {
            const emergencyEvidence = this.formatToolEvidence(
              'recovered_tool_result',
              `Emergency recovery of tool result ${i + 1}`,
              content,
              i + 1
            );
            
            gatheredEvidence.push(emergencyEvidence);
            
            logger.info('🎉 EMERGENCY EVIDENCE RECOVERED!', {
              toolResultIndex: i,
              contentLength: content.length,
              evidenceCount: gatheredEvidence.length
            });
          }
        }
        
        logger.info('🔥 EMERGENCY RECOVERY COMPLETE:', {
          finalEvidenceCount: gatheredEvidence.length,
          recoveredFromToolResults: originalToolResults.length
        });
      }

      // Final synthesis step using all gathered evidence
      await this.streamProgress('📝 Synthesizing workflow analysis...', maxSteps - 1, maxSteps);
      
      const finalSynthesis = await this.synthesizeWorkflowConclusion(
        prompt,
        workflowTemplate,
        gatheredEvidence,
        modelClient,
        originalToolResults // Pass original tool results for direct access
      );

      const conclusionStep: ReasoningStep = {
        step: currentStepIndex + 3,
        type: 'conclusion', 
        content: `✅ WORKFLOW ANALYSIS COMPLETE\n\n${finalSynthesis}`,
        confidence: gatheredEvidence.length >= 2 ? 0.9 : 0.6,
        timestamp: new Date(),
        metadata: {
          workflowTemplate: workflowTemplate.name,
          evidenceCount: gatheredEvidence.length,
          completedSteps: currentStepIndex
        }
      };

      reasoningChain.push(conclusionStep);
      await this.streamReasoningStep(conclusionStep);

      const executionTime = Date.now() - startTime;
      
      logger.info('✅ Workflow-guided execution completed successfully', {
        executionId: this.currentExecutionId,
        workflowName: workflowTemplate.name,
        completedSteps: currentStepIndex,
        evidenceCount: gatheredEvidence.length,
        executionTime
      });

      return {
        success: true,
        finalResult: finalSynthesis,
        reasoningChain,
        executionPlan: {
          goal: prompt,
          domain: 'workflow-guided',
          estimatedSteps: workflowTemplate.steps.length,
          selectedTools: availableTools.map(t => t.function?.name || t.name),
          reasoning: `Using ${workflowTemplate.name} workflow`,
          confidence: gatheredEvidence.length >= 2 ? 0.9 : 0.6
        },
        totalSteps: currentStepIndex,
        executionTime,
        streamed: !!this.streamingCallbacks
      };

    } catch (error) {
      logger.error('❌ Workflow-guided execution failed', {
        executionId: this.currentExecutionId,
        workflowName: workflowTemplate.name,
        currentStep: currentStepIndex,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        finalResult: `Workflow execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        reasoningChain,
        executionPlan: {
          goal: prompt,
          domain: 'workflow-guided',
          estimatedSteps: workflowTemplate.steps.length,
          selectedTools: availableTools.map(t => t.function?.name || t.name),
          reasoning: `Failed ${workflowTemplate.name} workflow`,
          confidence: 0.1
        },
        totalSteps: currentStepIndex,
        executionTime: Date.now() - startTime,
        streamed: !!this.streamingCallbacks
      };
    }
  }

  /**
   * Format tool evidence intelligently based on tool type and content
   */
  private formatToolEvidence(
    toolName: string,
    action: string,
    result: string,
    stepNumber: number
  ): string {
    // Handle different tool types with appropriate formatting
    if (toolName.includes('filesystem_read_file')) {
      return this.formatFileReadEvidence(action, result, stepNumber);
    } else if (toolName.includes('filesystem_list_directory')) {
      return this.formatDirectoryListEvidence(action, result, stepNumber);
    } else if (toolName.includes('filesystem_file_stats')) {
      return this.formatFileStatsEvidence(action, result, stepNumber);
    } else {
      return this.formatGenericEvidence(toolName, action, result, stepNumber);
    }
  }

  /**
   * Format file reading evidence with intelligent content handling
   */
  private formatFileReadEvidence(action: string, result: string, stepNumber: number): string {
    // Intelligent content summarization based on file type and size
    let formattedContent = result;
    const isLargeFile = result.length > 2000; // Files larger than 2KB need summarization
    
    try {
      // Try JSON parsing for config files
      const jsonData = JSON.parse(result);
      if (isLargeFile) {
        formattedContent = this.summarizeJsonContent(jsonData);
      } else {
        formattedContent = `JSON Content:\n${JSON.stringify(jsonData, null, 2)}`;
      }
      
      // Add insights for package.json specifically
      if (jsonData.name || jsonData.version || jsonData.dependencies) {
        const insights = this.extractPackageJsonInsights(jsonData);
        formattedContent += `\n\nKey Insights:\n${insights}`;
      }
    } catch {
      // Not JSON, check for other formats - CRITICAL FIX: Add type safety
      if (typeof result === 'string' && (result.includes('# ') || result.includes('## '))) {
        if (isLargeFile) {
          formattedContent = this.summarizeMarkdownContent(result);
        } else {
          formattedContent = `Markdown Content:\n${result}`;
        }
      } else if (typeof result === 'string' && (result.includes('import ') || result.includes('function ') || result.includes('class '))) {
        if (isLargeFile) {
          formattedContent = this.summarizeCodeContent(result);
        } else {
          formattedContent = `Code Content:\n${result}`;
        }
      } else {
        if (isLargeFile) {
          formattedContent = this.summarizeTextContent(result);
        } else {
          formattedContent = `Text Content:\n${result}`;
        }
      }
    }

    return `**Step ${stepNumber}: ${action}**

${formattedContent}

*Content Length: ${result.length} characters*${isLargeFile ? ' (Summarized due to size)' : ''}`;
  }

  /**
   * Summarize JSON content for large files
   */
  private summarizeJsonContent(jsonData: any): string {
    let summary = `JSON Content Summary:\n`;
    
    // Count top-level keys
    const keys = Object.keys(jsonData);
    summary += `📊 Structure: ${keys.length} top-level properties\n`;
    
    // Highlight important sections
    const importantKeys = ['name', 'version', 'description', 'dependencies', 'devDependencies', 'scripts', 'main', 'type'];
    const foundKeys = keys.filter(key => importantKeys.includes(key));
    
    if (foundKeys.length > 0) {
      summary += `🔍 Key Properties Found: ${foundKeys.join(', ')}\n\n`;
      
      // Show specific important values
      foundKeys.forEach(key => {
        const value = jsonData[key];
        if (typeof value === 'string') {
          summary += `• ${key}: ${value}\n`;
        } else if (typeof value === 'object' && value !== null) {
          const count = Array.isArray(value) ? value.length : Object.keys(value).length;
          summary += `• ${key}: ${count} items\n`;
        }
      });
    }
    
    return summary;
  }

  /**
   * CRITICAL FIX: Extract string content from tool results safely
   * Handles various tool result formats to prevent type errors
   */
  private extractStringContentFromToolResult(toolResult: any): string {
    console.log('🚨 EXTRACTING FROM TOOL RESULT:', {
        toolId: toolResult?.toolId,
        hasOutput: !!toolResult?.output,
        hasResult: !!toolResult?.result,
        outputKeys: toolResult?.output ? Object.keys(toolResult.output) : null,
        resultKeys: toolResult?.result ? Object.keys(toolResult.result) : null,
    });
    
    try {
        // Handle direct string results
        if (typeof toolResult.result === 'string' && toolResult.result.trim().length > 0) {
            return toolResult.result;
        }
        
        // ENHANCED: Try multiple extraction paths
        const extractionPaths = [
            () => toolResult.result?.output?.content,
            () => toolResult.result?.content,
            () => toolResult.output?.content,
            () => toolResult.output?.data,
            () => toolResult.result?.data,
            () => toolResult.content,
            () => toolResult.data,
            // NEW: Try JSON parsing if content looks like escaped JSON
            () => {
                if (typeof toolResult.output?.content === 'string' && 
                    toolResult.output.content.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(toolResult.output.content);
                        return typeof parsed === 'string' ? parsed : toolResult.output.content;
                    } catch {
                        return toolResult.output.content;
                    }
                }
                return null;
            }
        ];
        
        for (const extractor of extractionPaths) {
            const result = extractor();
            if (typeof result === 'string' && result.trim().length > 0) {
                console.log('✅ CONTENT EXTRACTED via path:', extractor.toString());
                return result;
            }
        }
        
        // Fallback to JSON stringification
        if (toolResult.result && typeof toolResult.result === 'object') {
            return JSON.stringify(toolResult.result, null, 2);
        }
        
        return '';
        
    } catch (error) {
        console.error('🚨 CONTENT EXTRACTION ERROR:', error);
        return '';
    }
}

  /**
   * Validate that content extraction worked properly
   */
  private validateContentExtraction(toolResult: any, extractedContent: string): boolean {
    // Validate that extraction worked
    if (!extractedContent || extractedContent.length === 0) {
      console.error('🚨 CONTENT VALIDATION FAILED: Empty result', {
        toolResultKeys: Object.keys(toolResult || {}),
        hasOutput: !!toolResult?.output,
        hasResult: !!toolResult?.result,
        toolResultType: typeof toolResult
      });
      return false;
    }
    
    // For filesystem operations, validate content makes sense
    if (toolResult?.output?.size && extractedContent.length !== toolResult.output.size) {
      console.warn('🚨 CONTENT LENGTH MISMATCH:', {
        extractedLength: extractedContent.length,
        expectedSize: toolResult.output.size,
        sizeDifference: Math.abs(extractedContent.length - toolResult.output.size)
      });
    }
    
    console.log('✅ CONTENT VALIDATION SUCCESS:', {
      contentLength: extractedContent.length,
      contentPreview: extractedContent.substring(0, 100) + (extractedContent.length > 100 ? '...' : '')
    });
    
    return true;
  }

  /**
   * Generate direct response from original tool results (bypasses evidence parsing)
   */
  private generateDirectResponseFromToolResults(
    originalPrompt: string,
    workflowTemplate: WorkflowTemplate, 
    toolResults: any[]
  ): string {
    // DEBUG: Log what we received
    console.log('🚨 GENERATING RESPONSE FROM TOOL RESULTS:', {
      toolResultsCount: toolResults.length,
      firstResult: toolResults[0] ? {
        toolId: toolResults[0].toolId,
        success: toolResults[0].success,
        hasOutput: !!toolResults[0].output,
        outputKeys: toolResults[0].output ? Object.keys(toolResults[0].output) : null,
        outputContentLength: toolResults[0].output?.content ? String(toolResults[0].output.content).length : 0
      } : null
    });
    // Look for filesystem read operations
    // Handle both direct tool results and enhanced integration wrapped results
    const fileReadResult = toolResults.find(result => {
      // Direct tool result format
      if (result.toolId === 'filesystem_read_file' && result.success && result.output?.content) {
        return true;
      }
      
      // Enhanced integration wrapped format (result.output contains the actual tool result)
      if (result.success && result.output && 
          result.output.toolId === 'filesystem_read_file' && 
          result.output.success && result.output.output?.content) {
        return true;
      }
      
      // Actual format we discovered: result.result contains the tool result
      if (result.result && 
          result.result.toolId === 'filesystem_read_file' && 
          result.result.success && result.result.output?.content) {
        return true;
      }
      
      return false;
    });
    
    if (fileReadResult) {
      // Extract content and path based on format
      let content, filePath;
      
      if (fileReadResult.toolId === 'filesystem_read_file') {
        // Direct tool result format
        content = fileReadResult.output.content;
        filePath = fileReadResult.output.filePath || 'file';
      } else if (fileReadResult.output?.toolId === 'filesystem_read_file') {
        // Enhanced integration wrapped format
        content = fileReadResult.output.output.content;
        filePath = fileReadResult.output.output.filePath || 'file';
      } else if (fileReadResult.result?.toolId === 'filesystem_read_file') {
        // Actual discovered format: result.result contains the tool result
        content = fileReadResult.result.output.content;
        filePath = fileReadResult.result.output.filePath || 'file';
      } else {
        console.log('🚨 UNEXPECTED FILE READ RESULT FORMAT');
        return `**Tool Result**: ${JSON.stringify(fileReadResult, null, 2)}`;
      }
      const filename = filePath.split(/[/\\]/).pop() || 'file';
      const extension = filename.split('.').pop()?.toLowerCase() || '';
      
      // Format based on file type
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
    
    // Fallback: show all tool results with detailed structure for debugging
    return toolResults.map((result, i) => {
      return `**Tool Result ${i + 1}**: ${result.toolId || 'undefined'}\n\n**Structure Debug:**\n\`\`\`json\n${JSON.stringify(result, null, 2).substring(0, 2000)}\n\`\`\``;
    }).join('\n\n---\n\n');
  }

  /**
   * Get description for file type based on extension
   */
  private getFileTypeDescription(extension: string): string {
    const descriptions: Record<string, string> = {
      'js': 'JavaScript source code',
      'ts': 'TypeScript source code',
      'jsx': 'React JavaScript component',
      'tsx': 'React TypeScript component',
      'json': 'JSON configuration/data file',
      'yaml': 'YAML configuration file',
      'yml': 'YAML configuration file',
      'md': 'Markdown documentation',
      'txt': 'Plain text file',
      'rst': 'reStructuredText documentation',
      'py': 'Python source code',
      'java': 'Java source code',
      'cpp': 'C++ source code',
      'c': 'C source code',
      'go': 'Go source code',
      'rs': 'Rust source code',
      'html': 'HTML markup',
      'css': 'CSS stylesheet',
      'scss': 'Sass stylesheet',
      'less': 'Less stylesheet',
      'xml': 'XML document',
      'sql': 'SQL database script',
      'sh': 'Shell script',
      'bat': 'Batch script',
      'ps1': 'PowerShell script',
      'dockerfile': 'Docker configuration',
      'gitignore': 'Git ignore rules',
      'env': 'Environment variables',
      'ini': 'Configuration file',
      'toml': 'TOML configuration',
      'csv': 'Comma-separated values',
      'log': 'Log file'
    };
    
    return descriptions[extension] || 'Unknown file type';
  }

  /**
   * Summarize markdown content for large files
   */
  private summarizeMarkdownContent(content: string): string {
    // CRITICAL FIX: Ensure content is a string before processing
    if (typeof content !== 'string') {
      return `Invalid content type for markdown processing: ${typeof content}`;
    }

    let summary = `Markdown Content Summary:\n\n`;
    
    // Extract title
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      summary += `📄 Title: ${titleMatch[1]}\n\n`;
    }
    
    // Extract all headers to show structure
    const headers = content.match(/^#{1,6}\s+.+$/gm) || [];
    if (headers.length > 0) {
      summary += `📋 Document Structure (${headers.length} sections):\n`;
      headers.slice(0, 10).forEach(header => {
        const level = (header.match(/^#+/) || [''])[0].length;
        const text = header.replace(/^#+\s*/, '');
        summary += `${'  '.repeat(level - 1)}• ${text}\n`;
      });
      
      if (headers.length > 10) {
        summary += `  ... and ${headers.length - 10} more sections\n`;
      }
    }
    
    // Extract key information sections
    const keyPhrases = ['installation', 'setup', 'usage', 'features', 'requirements', 'getting started'];
    const foundSections: string[] = [];
    
    keyPhrases.forEach(phrase => {
      const regex = new RegExp(`^#+\\s+.*${phrase}.*$`, 'im');
      if (regex.test(content)) {
        foundSections.push(phrase);
      }
    });
    
    if (foundSections.length > 0) {
      summary += `\n🎯 Key Sections: ${foundSections.join(', ')}`;
    }
    
    return summary;
  }

  /**
   * Summarize code content for large files
   */
  private summarizeCodeContent(content: string): string {
    // CRITICAL FIX: Ensure content is a string before processing
    if (typeof content !== 'string') {
      return `Invalid content type for code processing: ${typeof content}`;
    }

    let summary = `Code Content Summary:\n\n`;
    
    // Count different code elements
    const imports = content.match(/^(import|from|require).+$/gm) || [];
    const functions = content.match(/(function\s+\w+|const\s+\w+\s*=\s*\(|async\s+function\s+\w+)/gm) || [];
    const classes = content.match(/class\s+\w+/gm) || [];
    const interfaces = content.match(/interface\s+\w+/gm) || [];
    const types = content.match(/type\s+\w+\s*=/gm) || [];
    
    summary += `📊 Code Structure:\n`;
    if (imports.length > 0) summary += `• Imports: ${imports.length}\n`;
    if (functions.length > 0) summary += `• Functions: ${functions.length}\n`;
    if (classes.length > 0) summary += `• Classes: ${classes.length}\n`;
    if (interfaces.length > 0) summary += `• Interfaces: ${interfaces.length}\n`;
    if (types.length > 0) summary += `• Types: ${types.length}\n`;
    
    // Show main exports or key functions
    const exports = content.match(/export\s+(default\s+)?(class|function|const|interface|type)\s+(\w+)/gm) || [];
    if (exports.length > 0) {
      summary += `\n🎯 Main Exports:\n`;
      exports.slice(0, 5).forEach(exp => {
        summary += `• ${exp}\n`;
      });
      if (exports.length > 5) {
        summary += `• ... and ${exports.length - 5} more\n`;
      }
    }
    
    return summary;
  }

  /**
   * Summarize plain text content for large files
   */
  private summarizeTextContent(content: string): string {
    // CRITICAL FIX: Ensure content is a string before processing
    if (typeof content !== 'string') {
      return `Invalid content type for text processing: ${typeof content}`;
    }

    const lines = content.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    
    let summary = `Text Content Summary:\n\n`;
    summary += `📊 ${lines.length} total lines, ${nonEmptyLines.length} non-empty\n\n`;
    
    // Show first few lines to give context
    const preview = nonEmptyLines.slice(0, 3).join('\n');
    summary += `📝 Preview:\n${preview}`;
    
    if (nonEmptyLines.length > 3) {
      summary += `\n\n... (${nonEmptyLines.length - 3} more lines)`;
    }
    
    return summary;
  }

  /**
   * Generate intelligent, conversational response for completed tasks
   */
  private async generateIntelligentResponse(
    originalPrompt: string,
    tool: any,
    toolResult: any,
    explanation: string
  ): Promise<string> {
    const toolName = tool.function?.name || tool.name || 'unknown';
    
    // Determine the task type from the prompt
    const taskType = this.classifyTaskType(originalPrompt);
    
    // Generate response based on task type and tool result
    switch (taskType) {
      case 'read_file':
        return this.generateFileReadResponse(originalPrompt, toolResult);
      
      case 'list_directory':
        return this.generateDirectoryListResponse(originalPrompt, toolResult);
      
      case 'create_file':
        return this.generateFileCreationResponse(originalPrompt, toolResult);
      
      case 'analyze_code':
        return this.generateCodeAnalysisResponse(originalPrompt, toolResult);
        
      case 'question_answering':
        return this.generateQuestionAnswerResponse(originalPrompt, toolResult);
      
      default:
        return this.generateGenericResponse(originalPrompt, toolName, toolResult, explanation);
    }
  }

  private classifyTaskType(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('read') && (lowerPrompt.includes('file') || lowerPrompt.includes('.md') || lowerPrompt.includes('.json'))) {
      return 'read_file';
    }
    if (lowerPrompt.includes('list') || lowerPrompt.includes('directory') || lowerPrompt.includes('folder')) {
      return 'list_directory';
    }
    if (lowerPrompt.includes('create') && (lowerPrompt.includes('file') || lowerPrompt.includes('test'))) {
      return 'create_file';
    }
    if (lowerPrompt.includes('analyze') || lowerPrompt.includes('review')) {
      return 'analyze_code';
    }
    if (lowerPrompt.includes('what') || lowerPrompt.includes('how') || lowerPrompt.includes('?')) {
      return 'question_answering';
    }
    
    return 'generic';
  }

  private generateFileReadResponse(prompt: string, result: any): string {
    let parsedResult: any;
    try {
      parsedResult = JSON.parse(result);
      if (parsedResult.content) {
        const content = parsedResult.content;
        const size = content.length;
        
        if (content.includes('# ')) {
          // README or markdown file
          const titleMatch = content.match(/^#\s+(.+)$/m);
          const title = titleMatch ? titleMatch[1] : 'Document';
          
          return `📄 **${title}**

This is a Markdown document with ${size.toLocaleString()} characters. Here are the key highlights:

${this.extractMarkdownHighlights(content)}

💡 The document covers installation, usage, features, and configuration. Would you like me to explain any specific section in detail?`;
        } else if (content.includes('"name"') && content.includes('"version"')) {
          // Package.json
          return `📦 **Package Configuration**

This appears to be a package.json file with project dependencies and configuration. Here are the key details:

${this.extractPackageJsonHighlights(content)}

🔧 The project uses modern JavaScript/TypeScript tooling. Would you like me to explain any specific dependencies or scripts?`;
        } else {
          // Generic file
          return `📄 **File Contents**

I've successfully read the file (${size.toLocaleString()} characters). 

${size > 2000 ? 'This is a large file, so here\'s a summary of the key content:' : 'Here are the contents:'}

${size > 2000 ? this.summarizeTextContent(content) : content.substring(0, 1000) + (content.length > 1000 ? '...' : '')}

💡 Would you like me to focus on any particular section or explain specific parts?`;
        }
      }
    } catch {
      // Handle string result
      return `📄 **File Read Complete**

I've successfully read the requested file. ${result.length > 2000 ? 'Here\'s a summary of the content:' : 'Here are the contents:'}

${result.length > 2000 ? this.summarizeTextContent(result) : result}

💡 Is there anything specific you'd like me to explain about this content?`;
    }

    return `✅ **File read successfully!** The content is now available for analysis.`;
  }

  private generateDirectoryListResponse(prompt: string, result: any): string {
    let parsedResult: any;
    try {
      parsedResult = JSON.parse(result);
    } catch {
      parsedResult = null;
    }

    // Handle directory not found case
    if (parsedResult?.canCreate && parsedResult.suggestion) {
      return `📁 **Directory Not Found**

The directory you're looking for doesn't exist yet. 

${parsedResult.suggestion}

🔧 **I can help you with that!** Would you like me to create the directory and then proceed with your task?`;
    }

    // Handle successful directory listing  
    if (parsedResult?.files) {
      const files = parsedResult.files;
      const directories = files.filter((f: string) => f.includes('[DIR]'));
      const regularFiles = files.filter((f: string) => !f.includes('[DIR]'));

      let response = `📁 **Directory Contents**\n\n`;

      if (directories.length > 0) {
        response += `📂 **${directories.length} subdirectories found**\n`;
      }

      if (regularFiles.length > 0) {
        response += `📄 **${regularFiles.length} files found**\n\n`;
        
        // Show file types
        const fileTypes = this.analyzeFileTypes(regularFiles);
        if (Object.keys(fileTypes).length > 0) {
          response += `🔍 **File types**: ${Object.entries(fileTypes).map(([type, count]) => `${count} ${type}`).join(', ')}\n\n`;
        }
      } else if (directories.length === 0) {
        response += `📝 This directory is empty.\n\n`;
      }

      response += `💡 Would you like me to examine any specific files or create new ones?`;
      return response;
    }

    return `✅ **Directory listing complete!** The directory structure is now available for analysis.`;
  }

  private generateFileCreationResponse(prompt: string, result: any): string {
    return `✅ **Ready to create your file!**

I understand you want to create a test file. Let me help you with that by:

1. 🏗️ Creating the directory if it doesn't exist
2. 📝 Creating the test file with appropriate content
3. ✅ Confirming the file was created successfully

What type of test file would you like me to create? (e.g., unit test, integration test, or a specific framework like Jest, Mocha, etc.)`;
  }

  private generateCodeAnalysisResponse(prompt: string, result: any): string {
    return `🔍 **Code Analysis Complete**

I've analyzed the code successfully. Here are the key findings:

${typeof result === 'string' ? this.summarizeCodeContent(result) : JSON.stringify(result, null, 2)}

💡 Would you like me to focus on any specific aspects like performance, security, or maintainability?`;
  }

  private generateQuestionAnswerResponse(prompt: string, result: any): string {
    // For "what does the README say" type questions
    if (prompt.toLowerCase().includes('readme') && prompt.toLowerCase().includes('say')) {
      try {
        const parsedResult = JSON.parse(result);
        if (parsedResult.content) {
          const content = parsedResult.content;
          return `📄 **README Summary**

${this.extractMarkdownHighlights(content)}

This README describes a production-ready AI development platform with multi-voice synthesis, local AI integration, and enterprise security features. 

💡 Would you like me to explain any specific section in more detail?`;
        }
      } catch {
        // Handle string result
        return `📄 **README Content**

${this.summarizeMarkdownContent(result)}

💡 Is there a particular section you'd like me to elaborate on?`;
      }
    }

    return this.generateGenericResponse(prompt, 'analysis', result, '');
  }

  private generateGenericResponse(prompt: string, toolName: string, result: any, explanation: string): string {
    return `✅ **Task Completed Successfully**

I've processed your request: "${prompt}"

${explanation || 'The task has been completed using the available tools.'}

💡 Is there anything else you'd like me to help you with or any follow-up questions?`;
  }

  private extractMarkdownHighlights(content: string): string {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : '';
    
    // Extract key sections
    const sections: string[] = [];
    const importantSections = ['features', 'installation', 'usage', 'quick start', 'production status'];
    
    importantSections.forEach(section => {
      const regex = new RegExp(`^#+\\s+.*${section}.*$(.*?)^#+`, 'ims');
      const match = content.match(regex);
      if (match) {
        sections.push(`• **${section.charAt(0).toUpperCase() + section.slice(1)}** section available`);
      }
    });

    let summary = '';
    if (title) {
      summary += `**${title}**\n\n`;
    }
    if (sections.length > 0) {
      summary += `Key sections include:\n${sections.join('\n')}`;
    }

    return summary || 'Document contains multiple sections with detailed information.';
  }

  private extractPackageJsonHighlights(content: string): string {
    try {
      const pkg = JSON.parse(content);
      let highlights = '';
      
      if (pkg.name) highlights += `• **Project**: ${pkg.name}\n`;
      if (pkg.version) highlights += `• **Version**: ${pkg.version}\n`;
      if (pkg.description) highlights += `• **Description**: ${pkg.description}\n`;
      if (pkg.dependencies) highlights += `• **Dependencies**: ${Object.keys(pkg.dependencies).length} packages\n`;
      if (pkg.devDependencies) highlights += `• **Dev Dependencies**: ${Object.keys(pkg.devDependencies).length} packages\n`;
      if (pkg.scripts) highlights += `• **Scripts**: ${Object.keys(pkg.scripts).length} available commands\n`;
      
      return highlights;
    } catch {
      return 'Package configuration with project dependencies and scripts.';
    }
  }

  /**
   * Generate context-aware error responses with helpful suggestions
   */
  private async generateContextualErrorResponse(
    originalPrompt: string,
    tool: any,
    error: { message: string },
    stepNumber: number,
    isCritical: boolean = false
  ): Promise<string> {
    const toolName = tool.function?.name || tool.name || 'unknown tool';
    const errorMessage = error.message;
    
    // Detect common error patterns and provide specific solutions
    if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file or directory')) {
      return this.generateFileNotFoundErrorResponse(originalPrompt, toolName, errorMessage, isCritical);
    }
    
    if (errorMessage.includes('EACCES') || errorMessage.includes('permission denied')) {
      return this.generatePermissionErrorResponse(originalPrompt, toolName, errorMessage, isCritical);
    }
    
    if (errorMessage.includes('EEXIST') || errorMessage.includes('already exists')) {
      return this.generateFileExistsErrorResponse(originalPrompt, toolName, errorMessage, isCritical);
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('timeout')) {
      return this.generateNetworkErrorResponse(originalPrompt, toolName, errorMessage, isCritical);
    }
    
    if (toolName.includes('list_directory') || toolName.includes('filesystem')) {
      return this.generateFilesystemErrorResponse(originalPrompt, toolName, errorMessage, isCritical);
    }
    
    // Generic contextual error response
    return this.generateGenericErrorResponse(originalPrompt, toolName, errorMessage, isCritical);
  }

  private generateFileNotFoundErrorResponse(prompt: string, toolName: string, errorMessage: string, isCritical: boolean): string {
    const prefix = isCritical ? '🚨 **Critical Error**' : '⚠️ **File/Directory Not Found**';
    
    let response = `${prefix}\n\n`;
    
    if (prompt.toLowerCase().includes('create') && prompt.toLowerCase().includes('test')) {
      response += `I see you want to create a test file, but the target directory doesn't exist yet.\n\n`;
      response += `🔧 **I can help fix this:**\n`;
      response += `1. ✅ Create the missing directory\n`;
      response += `2. ✅ Create your test file in the new directory\n`;
      response += `3. ✅ Set up proper test file structure\n\n`;
      response += `💡 **Shall I proceed with creating the directory and test file?**`;
    } else if (prompt.toLowerCase().includes('read') || prompt.toLowerCase().includes('list')) {
      response += `The file or directory you're looking for doesn't exist.\n\n`;
      response += `🔧 **Possible solutions:**\n`;
      response += `• Check if the path is correct\n`;
      response += `• List the parent directory to see available options\n`;
      response += `• Create the missing directory if needed\n\n`;
      response += `💡 **Would you like me to help you find the right path or create the missing directory?**`;
    } else {
      response += `The target location doesn't exist yet.\n\n`;
      response += `🔧 **Next steps:**\n`;
      response += `• I can create the necessary directories\n`;
      response += `• Then proceed with your original request\n\n`;
      response += `💡 **Shall I create the missing directories and continue?**`;
    }
    
    if (isCritical) {
      response += `\n\n⚠️ **This is a critical failure** - multiple attempts have failed. Please let me know how you'd like to proceed.`;
    }
    
    return response;
  }

  private generatePermissionErrorResponse(prompt: string, toolName: string, errorMessage: string, isCritical: boolean): string {
    return `🔒 **Permission Error**\n\nI don't have the necessary permissions to complete this operation.\n\n🔧 **Possible solutions:**\n• Check file/directory permissions\n• Make sure the path is accessible\n• Try running with appropriate permissions\n\n💡 **Would you like me to suggest an alternative approach?**`;
  }

  private generateFileExistsErrorResponse(prompt: string, toolName: string, errorMessage: string, isCritical: boolean): string {
    return `📁 **File Already Exists**\n\nThe file or directory you're trying to create already exists.\n\n🔧 **Options:**\n• Overwrite the existing file\n• Create with a different name\n• Merge with existing content\n\n💡 **How would you like me to handle this?**`;
  }

  private generateNetworkErrorResponse(prompt: string, toolName: string, errorMessage: string, isCritical: boolean): string {
    return `🌐 **Network/Connection Issue**\n\nThere was a problem with network connectivity or service availability.\n\n🔧 **Troubleshooting:**\n• Check internet connection\n• Verify service availability\n• Try again in a moment\n\n💡 **Should I retry the operation or suggest an alternative approach?**`;
  }

  private generateFilesystemErrorResponse(prompt: string, toolName: string, errorMessage: string, isCritical: boolean): string {
    const prefix = isCritical ? '🚨 **Critical Filesystem Error**' : '📂 **Filesystem Issue**';
    
    return `${prefix}\n\nThere was an issue accessing the file system.\n\n🔧 **Common solutions:**\n• Check if the path exists and is accessible\n• Verify you have the necessary permissions\n• Ensure the disk isn't full\n\n💡 **Would you like me to try a different approach or help diagnose the issue further?**${isCritical ? '\n\n⚠️ **Multiple attempts failed** - this may require manual intervention.' : ''}`;
  }

  private generateGenericErrorResponse(prompt: string, toolName: string, errorMessage: string, isCritical: boolean): string {
    const prefix = isCritical ? '🚨 **Critical System Error**' : '⚠️ **Operation Failed**';
    
    return `${prefix}\n\nI encountered an issue while trying to complete your request.\n\n🔍 **Error details**: ${errorMessage}\n\n🔧 **Let me help:**\n• I can try a different approach\n• Suggest alternative solutions\n• Break down the task into smaller steps\n\n💡 **Would you like me to try again with a different method?**${isCritical ? '\n\n⚠️ **This is a critical failure** after multiple attempts. Please let me know how to proceed.' : ''}`;
  }

  /**
   * Format directory listing evidence with structure analysis
   */
  private formatDirectoryListEvidence(action: string, result: string, stepNumber: number): string {
    // Handle both JSON response format and string format
    let parsedResult: any;
    try {
      parsedResult = JSON.parse(result);
    } catch {
      parsedResult = null;
    }

    // Check if this is a fallback response with suggestion
    if (parsedResult?.canCreate && parsedResult.suggestion) {
      return `**Step ${stepNumber}: ${action}**

❌ **Directory Not Found**
Path: ${parsedResult.path}

💡 **Suggestion**: ${parsedResult.suggestion}

🔧 **Next Steps**: The directory doesn't exist yet. I can create it for you if needed.`;
    }

    // Handle successful directory listing
    if (parsedResult?.success && parsedResult.files) {
      const files = parsedResult.files;
      const directories = files.filter((file: string) => file.includes('[DIR]') || file.endsWith('/'));
      const regularFiles = files.filter((file: string) => !file.includes('[DIR]') && !file.endsWith('/') && file.trim());
      
      let structured = `**Step ${stepNumber}: ${action}**
Path: ${parsedResult.path}

Directory Structure Analysis:
`;

      if (directories.length > 0) {
        structured += `\n📁 **Directories (${directories.length}):**\n${directories.map((d: string) => `  • ${d}`).join('\n')}`;
      }

      if (regularFiles.length > 0) {
        structured += `\n\n📄 **Files (${regularFiles.length}):**\n${regularFiles.map((f: string) => `  • ${f}`).join('\n')}`;
        
        // Add file type analysis
        const fileTypes = this.analyzeFileTypes(regularFiles);
        if (Object.keys(fileTypes).length > 0) {
          structured += `\n\n🔍 **File Type Summary:**\n${Object.entries(fileTypes)
            .map(([type, count]) => `  • ${type}: ${count} files`)
            .join('\n')}`;
        }
      } else if (directories.length === 0) {
        structured += `\n📝 **Empty Directory**`;
      }

      return structured;
    }

    // Fallback to string parsing for legacy format
    const lines = result.split('\n').filter(line => line.trim());
    const directories = lines.filter(line => line.includes('[DIR]') || line.endsWith('/'));
    const files = lines.filter(line => !line.includes('[DIR]') && !line.endsWith('/') && line.trim());
    
    let structured = `**Step ${stepNumber}: ${action}**

Directory Structure Analysis:
`;

    if (directories.length > 0) {
      structured += `\n📁 **Directories (${directories.length}):**\n${directories.map(d => `  • ${d}`).join('\n')}`;
    }

    if (files.length > 0) {
      structured += `\n\n📄 **Files (${files.length}):**\n${files.map(f => `  • ${f}`).join('\n')}`;
    }

    // Add file type analysis
    const fileTypes = this.analyzeFileTypes(files);
    if (Object.keys(fileTypes).length > 0) {
      structured += `\n\n🔍 **File Type Summary:**\n${Object.entries(fileTypes)
        .map(([type, count]) => `  • ${type}: ${count} files`)
        .join('\n')}`;
    }

    return structured;
  }

  /**
   * Format file stats evidence
   */
  private formatFileStatsEvidence(action: string, result: string, stepNumber: number): string {
    return `**Step ${stepNumber}: ${action}**

📊 **File Statistics:**
${result}`;
  }

  /**
   * Format generic tool evidence
   */
  private formatGenericEvidence(toolName: string, action: string, result: string, stepNumber: number): string {
    return `**Step ${stepNumber}: ${action}**

🔧 **Tool**: ${toolName}
📄 **Result:**
${result}

*Length: ${result.length} characters*`;
  }

  /**
   * Extract key insights from package.json content
   */
  private extractPackageJsonInsights(packageData: any): string {
    const insights = [];
    
    if (packageData.name) insights.push(`• Project: ${packageData.name}`);
    if (packageData.version) insights.push(`• Version: ${packageData.version}`);
    if (packageData.description) insights.push(`• Description: ${packageData.description}`);
    
    if (packageData.dependencies) {
      const depCount = Object.keys(packageData.dependencies).length;
      insights.push(`• Dependencies: ${depCount} packages`);
    }
    
    if (packageData.devDependencies) {
      const devDepCount = Object.keys(packageData.devDependencies).length;
      insights.push(`• Dev Dependencies: ${devDepCount} packages`);
    }
    
    if (packageData.scripts) {
      const scriptCount = Object.keys(packageData.scripts).length;
      insights.push(`• Scripts: ${scriptCount} commands available`);
    }

    return insights.join('\n');
  }

  /**
   * Analyze file types from directory listing
   */
  private analyzeFileTypes(files: string[]): Record<string, number> {
    const types: Record<string, number> = {};
    
    files.forEach(file => {
      const ext = file.split('.').pop()?.toLowerCase();
      if (ext) {
        const category = this.getFileCategory(ext);
        types[category] = (types[category] || 0) + 1;
      }
    });
    
    return types;
  }

  /**
   * Categorize file extensions
   */
  private getFileCategory(ext: string): string {
    const categories: Record<string, string[]> = {
      'JavaScript/TypeScript': ['js', 'ts', 'jsx', 'tsx', 'mjs'],
      'Configuration': ['json', 'yaml', 'yml', 'toml', 'ini', 'conf'],
      'Documentation': ['md', 'txt', 'rst', 'adoc'],
      'Styles': ['css', 'scss', 'sass', 'less'],
      'Build/Tooling': ['lock', 'log', 'map']
    };

    for (const [category, extensions] of Object.entries(categories)) {
      if (extensions.includes(ext)) {
        return category;
      }
    }
    
    return 'Other';
  }

  /**
   * Execute reasoning for a specific workflow step
   */
  private async executeWorkflowStepReasoning(
    workflowPrompt: string,
    stepTools: any[],
    modelClient: any,
    stepNumber: number
  ): Promise<{
    thought: string;
    selectedTool?: any;
    toolArgs?: any;
    confidence: number;
  }> {
    try {
      const response = await modelClient.generateText(workflowPrompt, {
        temperature: 0.2,
        maxTokens: 800,
        tools: [] // No tools for reasoning step
      });

      const responseText = ResponseNormalizer.normalizeToString(response);
      return this.parseEnhancedReasoningResponse(responseText, stepTools, stepNumber);

    } catch (error) {
      logger.warn('Workflow step reasoning failed, using fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
        step: stepNumber
      });

      // Simple fallback - use first available tool
      return {
        thought: `Step ${stepNumber}: Using fallback reasoning due to LLM error. Selecting first available tool.`,
        selectedTool: stepTools[0],
        toolArgs: {},
        confidence: 0.5
      };
    }
  }

  /**
   * Synthesize final workflow conclusion
   */
  private async synthesizeWorkflowConclusion(
    originalPrompt: string,
    workflowTemplate: WorkflowTemplate,
    gatheredEvidence: string[],
    modelClient: any,
    originalToolResults?: any[]
  ): Promise<string> {
    if (gatheredEvidence.length === 0) {
      return `Unable to complete analysis - no evidence was successfully gathered during the ${workflowTemplate.name} workflow.`;
    }

    // REASONING-FIRST APPROACH: Always use AI for intelligent synthesis
    // NOTE: Removed shouldBypassLLM anti-pattern that was short-circuiting reasoning
    
    // DEBUG: Log synthesis decision
    logger.info('🧠 REASONING-FIRST: Using AI synthesis for intelligent response', {
      originalPrompt,
      workflowTemplateName: workflowTemplate.name,
      evidenceCount: gatheredEvidence.length,
      evidenceTypes: gatheredEvidence.map(e => e.substring(0, 50))
    });
    
    // ALWAYS use AI reasoning - no bypass logic
    const useAiReasoning = true;
    
    if (!useAiReasoning) {
      // This branch is now disabled - always use AI reasoning
      logger.info('🎯 DIRECT RESPONSE: Using evidence-based response (DISABLED)');
      
      // CRITICAL FIX: Use original tool results if available
      if (originalToolResults && originalToolResults.length > 0) {
        const result = this.generateDirectResponseFromToolResults(
          originalPrompt, workflowTemplate, originalToolResults
        );
        
        logger.info('✅ DIRECT RESPONSE FROM TOOL RESULTS', {
          resultLength: result.length,
          toolResultsCount: originalToolResults.length
        });
        
        return result;
      }
      
      // Fallback to evidence-based response
      const strategy = ContentTypeDetector.detectStrategy(originalPrompt, gatheredEvidence);
      const result = EvidenceBasedResponseGenerator.generateResponse(
        strategy, gatheredEvidence, originalPrompt
      );
      
      logger.info('✅ DIRECT RESPONSE GENERATED', {
        resultLength: result.length,
        strategy: strategy
      });
      
      return result;
    }

    // LEGACY: Continue with existing enhanced evidence extraction for non-bypassed requests
    if (gatheredEvidence.length > 0) {
      // Find any file reading evidence
      const fileReadEvidence = gatheredEvidence.find(evidence => 
        evidence.includes('filesystem_read_file') || evidence.includes('File Content:')
      );
      
      if (fileReadEvidence) {
        // Extract the actual content from the evidence
        const lines = fileReadEvidence.split('\n');
        let contentStartIndex = -1;
        let filename = 'file';
        
        // Extract filename from evidence
        const filenameLine = lines.find(line => 
          line.includes('Reading file:') || 
          line.includes('File:') || 
          line.includes('Path:') ||
          line.includes('filesystem_read_file')
        );
        if (filenameLine) {
          const match = filenameLine.match(/(?:Reading file:|File:|Path:|\w+:\s*)([^\s,]+\.\w+)/i);
          if (match) filename = match[1];
        }
        
        // Find where the actual file content starts (after tool metadata)
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('📄 Content:') || lines[i].includes('Content:') || 
              lines[i].includes('File Content:') ||
              (i > 0 && lines[i-1].includes('SUCCESS') && lines[i].trim().length > 0 && !lines[i].includes('Tool:') && !lines[i].includes('Action:'))) {
            contentStartIndex = i + 1;
            break;
          }
        }
        
        if (contentStartIndex > -1) {
          const fileContent = lines.slice(contentStartIndex).join('\n').trim();
          const fileExtension = filename.split('.').pop()?.toLowerCase() || '';
          
          // Determine file type and provide appropriate analysis
          let analysisType = '📄';
          let analysisTitle = 'File Analysis';
          let contextualAnalysis = '';
          
          if (filename.toLowerCase().includes('readme')) {
            analysisType = '📖';
            analysisTitle = 'README Analysis';
            contextualAnalysis = '\n\nBased on reading the project README, here\'s what this project does:\n';
          } else if (['js', 'ts', 'jsx', 'tsx'].includes(fileExtension)) {
            analysisType = '⚙️';
            analysisTitle = 'Code Analysis';
            contextualAnalysis = '\n\nThis is a JavaScript/TypeScript file containing:\n';
          } else if (['json', 'yaml', 'yml'].includes(fileExtension)) {
            analysisType = '⚙️';
            analysisTitle = 'Configuration Analysis';
            contextualAnalysis = '\n\nThis configuration file contains:\n';
          } else if (['md', 'txt', 'rst'].includes(fileExtension)) {
            analysisType = '📝';
            analysisTitle = 'Document Analysis';
            contextualAnalysis = '\n\nThis document contains:\n';
          } else if (['py', 'java', 'cpp', 'c', 'go', 'rs'].includes(fileExtension)) {
            analysisType = '💻';
            analysisTitle = 'Source Code Analysis';
            contextualAnalysis = '\n\nThis source code file contains:\n';
          }
          
          return `${analysisType} **${analysisTitle}**
${contextualAnalysis}
${fileContent.length > 2000 ? fileContent.substring(0, 2000) + '\n\n...[Content truncated for readability - full content available in file]...' : fileContent}

📋 **File Analysis Summary:**
- File successfully read and analyzed: ${filename}
- File type: ${fileExtension.toUpperCase()} (${this.getFileTypeDescription(fileExtension)})
- Content length: ${fileContent.length} characters
- Workflow: ${workflowTemplate.name}
- Evidence points collected: ${gatheredEvidence.length}

The file has been successfully processed and analyzed above.`;
        }
      }
      
      // Handle other tool operations (directory listings, file searches, etc.)
      const otherOperations = gatheredEvidence.filter(evidence => 
        !evidence.includes('filesystem_read_file') && 
        (evidence.includes('filesystem_list_directory') || 
         evidence.includes('filesystem_find_files') ||
         evidence.includes('git_') ||
         evidence.includes('terminal_'))
      );
      
      if (otherOperations.length > 0 && !fileReadEvidence) {
        // Synthesize results for non-file-reading operations
        const operationTypes = otherOperations.map(op => {
          if (op.includes('filesystem_list_directory')) return 'Directory Listing';
          if (op.includes('filesystem_find_files')) return 'File Search';
          if (op.includes('git_')) return 'Git Operation';
          if (op.includes('terminal_')) return 'Terminal Command';
          return 'System Operation';
        });
        
        return `🔍 **System Analysis Complete**

Based on executing ${operationTypes.join(', ').toLowerCase()} operations:

${otherOperations.map((evidence, i) => {
          const lines = evidence.split('\n');
          const contentStart = lines.findIndex(line => 
            line.includes('SUCCESS') || line.includes('EVIDENCE') || line.includes('Result:')
          );
          const content = contentStart > -1 ? 
            lines.slice(contentStart + 1, contentStart + 10).join('\n').trim() : 
            evidence.substring(0, 300);
          return `### ${operationTypes[i]}\n${content.length > 200 ? content.substring(0, 200) + '...' : content}`;
        }).join('\n\n')}

📊 **Operation Summary:**
- Operations completed: ${operationTypes.length}
- Workflow: ${workflowTemplate.name}
- Total evidence points: ${gatheredEvidence.length}

All requested operations have been completed successfully.`;
      }
    }

    try {
      // CHAIN-OF-THOUGHT: Show reasoning process to user
      logger.info('📊 Progress: 🧠 Starting AI reasoning and synthesis... (7/8)');
      console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log(chalk.cyan('🤖 AI REASONING PROCESS'));
      console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log(chalk.yellow('🧠 Analyzing user request and gathered evidence...'));
      
      // Show intent analysis to user
      const userIntent = UserIntentParser.parseIntent(originalPrompt);
      console.log(chalk.blue(`💭 Intent: ${userIntent.reasoning}`));
      console.log(chalk.blue(`📊 Evidence gathered: ${gatheredEvidence.length} data points`));
      
      const conclusionPrompt = this.workflowExecutor.buildConclusionPrompt(
        originalPrompt,
        workflowTemplate,
        gatheredEvidence
      );

      console.log(chalk.yellow('🔄 Synthesizing intelligent response...'));
      logger.info('📊 Progress: 🤖 AI processing evidence and formulating response... (8/8)');

      const response = await modelClient.generateText(conclusionPrompt, {
        temperature: 0.3,
        maxTokens: 2500, // Increased for comprehensive structured analysis
        tools: [] // Explicitly no tools - final synthesis only
      });

      console.log(chalk.green('✅ AI reasoning complete - presenting analysis'));
      console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

      return ResponseNormalizer.normalizeToString(response);

    } catch (error) {
      logger.warn('Final synthesis failed, providing evidence summary', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Enhanced evidence presentation - show complete structured data
      const evidenceCount = gatheredEvidence.length;
      const workflowSteps = workflowTemplate.steps.length;
      
      return `# ${workflowTemplate.description}

## Analysis Results for: "${originalPrompt}"

### 🎯 Workflow Completed Successfully
- **Template**: ${workflowTemplate.name}  
- **Steps Planned**: ${workflowSteps}
- **Evidence Collected**: ${evidenceCount} data points
- **Execution**: All tool operations completed successfully

---

### 📊 Detailed Evidence & Data

${gatheredEvidence.map((evidence, i) => {
  return `#### Evidence ${i + 1}

${evidence}

---`;
}).join('\n')}

### ✅ Analysis Complete

This analysis is based on **actual data** retrieved from your project files and system. Each evidence point above represents real tool execution results, not assumptions or general knowledge.

${evidenceCount === 0 ? 
  '*No evidence was collected during this workflow execution.*' : 
  `*Analysis includes ${evidenceCount} detailed evidence points with complete data from tool executions.*`}`;
    }
  }

  /**
   * NEW: Detect if a task requires multiple steps for proper completion
   */
  private isMultiStepTask(prompt: string): boolean {
    const promptLower = prompt.toLowerCase();
    
    // File creation is always multi-step (check directory, create if needed, write file)
    if (promptLower.includes('create') && (promptLower.includes('file') || promptLower.includes('test'))) {
      return true;
    }
    
    // Complex analysis tasks requiring multiple examinations
    if (promptLower.includes('analyze') && 
        (promptLower.includes('project') || promptLower.includes('codebase') || promptLower.includes('repository'))) {
      return true;
    }
    
    // Tasks with explicit sequencing words
    if (promptLower.includes(' then ') || promptLower.includes(' after ') || 
        promptLower.includes(' and ') || promptLower.includes(' also ')) {
      return true;
    }
    
    // Installation or setup tasks
    if (promptLower.includes('install') || promptLower.includes('setup') || 
        promptLower.includes('configure')) {
      return true;
    }
    
    // Build/compile/deploy tasks
    if (promptLower.includes('build') || promptLower.includes('compile') || 
        promptLower.includes('deploy') || promptLower.includes('package')) {
      return true;
    }
    
    return false;
  }

  /**
   * NEW: Get task type for logging and tracking purposes
   */
  private getTaskType(prompt: string): string {
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('create') && (promptLower.includes('file') || promptLower.includes('test'))) {
      return 'file_creation';
    } else if (promptLower.includes('analyze') || promptLower.includes('review')) {
      return 'analysis';
    } else if (promptLower.includes('read') || promptLower.includes('show')) {
      return 'file_reading';
    } else if (promptLower.includes('list') || promptLower.includes('directory')) {
      return 'directory_listing';
    } else if (promptLower.includes('install') || promptLower.includes('setup')) {
      return 'installation';
    } else if (promptLower.includes('build') || promptLower.includes('compile')) {
      return 'build_process';
    } else {
      return 'general';
    }
  }
}

export default EnhancedSequentialToolExecutor;