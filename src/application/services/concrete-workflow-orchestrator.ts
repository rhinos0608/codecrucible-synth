/**
 * Concrete Workflow Orchestrator Implementation - Application Layer
 *
 * Implementation of IWorkflowOrchestrator that coordinates between
 * CLI, UnifiedModelClient, MCP-Manager, and Tools without circular dependencies.
 * Uses dependency injection and mediator pattern for clean separation.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import {
  IWorkflowOrchestrator,
  WorkflowRequest,
  WorkflowResponse,
  WorkflowContext,
  OrchestratorDependencies,
} from '../../domain/interfaces/workflow-orchestrator.js';
import { IUserInteraction } from '../../domain/interfaces/user-interaction.js';
import { IEventBus } from '../../domain/interfaces/event-bus.js';
import {
  IModelClient,
  ModelRequest,
  ModelTool,
  ModelResponse,
} from '../../domain/interfaces/model-client.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { getErrorMessage } from '../../utils/error-utils.js';
import { randomUUID } from 'crypto';
import { RequestExecutionManager } from '../../infrastructure/execution/request-execution-manager.js';
import fs from 'fs';
import yaml from 'js-yaml';
import { executeWithStreaming } from './orchestrator/streaming-handler.js';
import { ToolRegistry } from './orchestrator/tool-registry.js';

export interface WorkflowMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  activeRequests: number;
}

/**
 * Concrete Workflow Orchestrator implementation
 */
export class ConcreteWorkflowOrchestrator extends EventEmitter implements IWorkflowOrchestrator {
  private userInteraction!: IUserInteraction;
  private eventBus!: IEventBus;
  private modelClient?: IModelClient;
  private mcpManager?: any;
  private requestExecutionManager?: RequestExecutionManager;
  private isInitialized = false;
  private toolRegistry?: ToolRegistry;

  // Request tracking
  private activeRequests: Map<
    string,
    {
      request: WorkflowRequest;
      startTime: number;
      context: WorkflowContext;
    }
  > = new Map();

  // Metrics
  private metrics: WorkflowMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageProcessingTime: 0,
    activeRequests: 0,
  };

  constructor() {
    super();
  }

  /**
   * Helper method to route model requests through RequestExecutionManager when available
   */
  public async processModelRequest(request: ModelRequest, context?: any): Promise<ModelResponse> {
    if (this.requestExecutionManager && this.modelClient) {
      // Use RequestExecutionManager for advanced execution strategies
      logger.debug('Routing model request through RequestExecutionManager');
      return await this.requestExecutionManager.processRequest(request, context);
    } else if (this.modelClient) {
      // Fallback to direct ModelClient
      logger.debug('Using direct ModelClient for request');
      return await this.modelClient.request(request);
    } else {
      throw new Error('No model client available for request processing');
    }
  }

  /**
   * Initialize the orchestrator with dependencies
   */
  async initialize(dependencies: OrchestratorDependencies): Promise<void> {
    try {
      // Prefer runtimeContext if provided (incremental migration)
      if (dependencies.runtimeContext) {
        this.eventBus = dependencies.runtimeContext.eventBus;
      } else {
        this.eventBus = dependencies.eventBus;
      }
      this.userInteraction = dependencies.userInteraction;
      this.modelClient = dependencies.modelClient;
      this.mcpManager = dependencies.mcpManager;
      this.toolRegistry = new ToolRegistry(this.mcpManager);

      // DEBUG: Verify critical dependencies
      logger.info('🔧 ConcreteWorkflowOrchestrator dependency injection:');
      logger.info(`  - modelClient: ${this.modelClient ? '✅ Available' : '❌ NULL/UNDEFINED'}`);
      logger.info(
        `  - userInteraction: ${this.userInteraction ? '✅ Available' : '❌ NULL/UNDEFINED'}`
      );
      logger.info(`  - eventBus: ${this.eventBus ? '✅ Available' : '❌ NULL/UNDEFINED'}`);

      if (!this.modelClient) {
        throw new Error(
          'CRITICAL: ModelClient dependency is null/undefined - AI functionality will not work'
        );
      }

      // Initialize RequestExecutionManager for advanced request processing
      try {
        const config = {
          maxConcurrentRequests: 3,
          defaultTimeout: 30000,
          complexityTimeouts: { simple: 10000, medium: 30000, complex: 60000 },
          memoryThresholds: { low: 100, medium: 500, high: 1000 },
        };
        const { HardwareAwareModelSelector } = await import(
          '../../infrastructure/performance/hardware-aware-model-selector.js'
        );
        const hardwareSelector = new HardwareAwareModelSelector();
        const processManager = new (
          await import('../../infrastructure/performance/active-process-manager.js')
        ).ActiveProcessManager(hardwareSelector);
        this.requestExecutionManager = new RequestExecutionManager(config, processManager, null);
        logger.info(
          '  - requestExecutionManager: ✅ Initialized with advanced execution strategies'
        );
      } catch (error) {
        logger.warn(
          'Failed to initialize RequestExecutionManager, falling back to direct ModelClient:',
          error
        );
        this.requestExecutionManager = undefined;
      }

      this.isInitialized = true;

      logger.info('ConcreteWorkflowOrchestrator initialized successfully');
      this.eventBus.emit('orchestrator:initialized', { timestamp: Date.now() });
    } catch (error) {
      logger.error('Failed to initialize ConcreteWorkflowOrchestrator:', error);
      throw error;
    }
  }

  /**
   * Process a workflow request
   */
  async processRequest(request: WorkflowRequest): Promise<WorkflowResponse> {
    if (!this.isInitialized) {
      throw new Error('WorkflowOrchestrator not initialized');
    }

    const startTime = performance.now();
    this.metrics.totalRequests++;
    this.metrics.activeRequests++;

    this.activeRequests.set(request.id, {
      request,
      startTime,
      context: request.context || this.createDefaultContext(),
    });

    try {
      this.eventBus.emit('workflow:started', { id: request.id, type: request.type });

      let result: any;
      switch (request.type) {
        case 'prompt':
          result = await this.handlePromptRequest(request);
          break;
        case 'tool-execution':
          result = await this.handleToolExecution(request);
          break;
        case 'model-request':
          result = await this.handleModelRequest(request);
          break;
        case 'analysis':
          result = await this.handleAnalysisRequest(request);
          break;
        default:
          throw new Error('Unknown request type');
      }

      const processingTime = performance.now() - startTime;
      this.updateMetrics(processingTime, true);

      const response: WorkflowResponse = {
        id: request.id,
        success: true,
        result,
        metadata: { processingTime, timestamp: Date.now() },
      };

      this.eventBus.emit('workflow:completed', { id: request.id, result });
      return response;
    } catch (error) {
      const processingTime = performance.now() - startTime;
      this.updateMetrics(processingTime, false);

      this.eventBus.emit('workflow:failed', { id: request.id, error });

      return {
        id: request.id,
        success: false,
        error: error as Error,
        metadata: { processingTime, timestamp: Date.now() },
      };
    } finally {
      this.activeRequests.delete(request.id);
      this.metrics.activeRequests--;
    }
  }

  /**
   * Execute a tool with proper context and security
   */
  async executeTool(toolName: string, args: any, context: WorkflowContext): Promise<any> {
    const request: WorkflowRequest = {
      id: randomUUID(),
      type: 'tool-execution',
      payload: { toolName, args },
      context,
    };

    const response = await this.processRequest(request);

    if (response.success) {
      return response.result;
    } else {
      throw response.error || new Error(`Tool execution failed: ${toolName}`);
    }
  }

  /**
   * Analyze code or files
   */
  async analyzeCode(filePath: string, context: WorkflowContext): Promise<any> {
    const request: WorkflowRequest = {
      id: randomUUID(),
      type: 'analysis',
      payload: { filePath, analysisType: 'code' },
      context,
    };

    const response = await this.processRequest(request);

    if (response.success) {
      return response.result;
    } else {
      throw response.error || new Error(`Code analysis failed: ${filePath}`);
    }
  }

  private async getMCPToolsForModel(userQuery?: string): Promise<ModelTool[]> {
    return this.toolRegistry?.getToolsForModel(userQuery) ?? [];
  }

  /**
   * Create enhanced prompt with explicit tool usage instructions
   * This is critical to ensure AI uses available tools instead of hallucinating responses
   */
  private createEnhancedPrompt(userPrompt: string, toolsAvailable: boolean): string {
    if (!toolsAvailable) {
      return userPrompt;
    }

    const systemInstructions = `SYSTEM INSTRUCTIONS: You have access to powerful tools for file system operations, code analysis, and project management. You MUST use these tools when:

1. **Reading/analyzing files**: Use filesystem_read_file to read actual file contents instead of guessing
2. **Listing directories**: Use filesystem_list_directory to see what files exist instead of assuming
3. **Writing/modifying files**: Use filesystem_write_file to make actual changes instead of showing example code
4. **Getting file information**: Use filesystem_get_stats to check if files exist and get metadata
5. **Code analysis**: Read the actual files first, then provide analysis based on real content
6. **Making changes**: Always read existing files first, then make informed modifications

DO NOT:
- Generate responses based on assumptions about file contents
- Provide generic code examples without checking actual project structure
- Make recommendations without examining the actual codebase first
- Describe files or code without actually reading them

ALWAYS:
- Use tools to examine the actual state of the project before responding
- Base your responses on real file contents, not knowledge or assumptions
- Read configuration files, source code, and project structure when relevant
- Verify file existence before making recommendations

User Request: ${userPrompt}`;

    return systemInstructions;
  }

  private async handlePromptRequest(request: WorkflowRequest): Promise<any> {
    const { payload } = request;

    if (this.modelClient) {
      // Get MCP tools for AI model with smart selection (unless disabled)
      const mcpTools =
        payload.options?.useTools !== false
          ? await this.getMCPToolsForModel(payload.input || payload.prompt)
          : [];

      // CRITICAL FIX: Create enhanced prompt with explicit tool usage instructions
      const originalPrompt = payload.input || payload.prompt;
      const enhancedPrompt = this.createEnhancedPrompt(originalPrompt, mcpTools.length > 0);

      const modelRequest: ModelRequest = {
        id: request.id,
        prompt: enhancedPrompt,
        model: payload.options?.model,
        temperature: payload.options?.temperature,
        maxTokens: payload.options?.maxTokens,
        stream: false, // Temporarily disable streaming to test tool usage
        tools: mcpTools, // Include MCP tools for AI model (empty array if useTools is false)
        context: request.context,
        // CRITICAL FIX: Always include num_ctx to override Ollama's 4096 default
        num_ctx: parseInt(process.env.OLLAMA_NUM_CTX || '131072'),
        options: payload.options,
      };

      // Log when enhanced prompt is used
      if (mcpTools.length > 0) {
        logger.info(
          `🎯 Enhanced prompt with explicit tool usage instructions (${mcpTools.length} tools available)`
        );
      }

      // Log when tools are disabled for simple questions
      if (payload.options?.useTools === false) {
        logger.info('🚫 Tools disabled for simple question to enable pure streaming');
      }

      let response: ModelResponse;

      if (payload.options?.stream && this.modelClient) {
        logger.info('🌊 Using streaming response for Ollama');
        try {
          response = await executeWithStreaming(this.modelClient, modelRequest);
        } catch (streamError) {
          logger.error('❌ Streaming failed, falling back to standard request:', streamError);
          response = await this.processModelRequest(modelRequest);
        }
      } else {
        response = await this.processModelRequest(modelRequest);
      }

      // Handle any tool calls from the AI model
      logger.debug('ConcreteWorkflowOrchestrator: Checking for tool calls');
      logger.debug('ConcreteWorkflowOrchestrator: response keys:', Object.keys(response));
      logger.debug(
        'ConcreteWorkflowOrchestrator: response.toolCalls exists:',
        !!response.toolCalls
      );
      logger.debug(
        'ConcreteWorkflowOrchestrator: response.toolCalls length:',
        response.toolCalls?.length
      );

      if (response.toolCalls && response.toolCalls.length > 0) {
        logger.debug('ConcreteWorkflowOrchestrator: entering tool execution');
        logger.info(`🔧 AI model made ${response.toolCalls.length} tool calls`);

        // Execute all tool calls and collect results
        const toolResults: Array<{ id: string; result: any; error?: string }> = [];

        if (!this.mcpManager) {
          throw new Error('MCP manager not available');
        }

        for (const toolCall of response.toolCalls) {
          try {
            const toolResult = await this.mcpManager.executeTool(
              toolCall.function.name,
              JSON.parse(toolCall.function.arguments),
              request.context
            );
            logger.info(`✅ Tool call ${toolCall.function.name} executed successfully`);

            toolResults.push({
              id: toolCall.id || toolCall.function.name,
              result: toolResult,
            });
          } catch (error) {
            logger.error(`❌ Tool call ${toolCall.function.name} failed:`, error);
            toolResults.push({
              id: toolCall.id || toolCall.function.name,
              result: null,
              error: getErrorMessage(error),
            });
          }
        }

        // CRITICAL FIX: Send tool results back to AI model using structured messages
        if (toolResults.length > 0) {
          logger.info(
            `🔄 Sending ${toolResults.length} tool results back to AI model for synthesis (STRUCTURED)`
          );

          // IMPROVED: Use structured message format instead of plain text embedding
          const structuredMessages = [
            {
              role: 'user' as const,
              content: payload.input || payload.prompt,
            },
            {
              role: 'assistant' as const,
              content: response.content || 'I need to use tools to help with this request.',
              tool_calls: response.toolCalls,
            },
            {
              role: 'tool' as const,
              content: JSON.stringify(toolResults, null, 2),
              tool_call_id: 'batch_results',
            },
          ];

          // Create structured follow-up request WITHOUT tools to force text synthesis
          const followUpRequest: ModelRequest = {
            id: `${request.id}-structured-followup`,
            prompt: `User request: ${payload.input || payload.prompt}\n\nTool execution results are provided in the conversation history. Please provide a comprehensive, well-formatted response based on these results. Do not make any additional tool calls - just synthesize the information provided.`,
            model: modelRequest.model,
            temperature: modelRequest.temperature,
            maxTokens: modelRequest.maxTokens,
            // CRITICAL FIX: Remove tools to prevent infinite tool calling
            tools: [],
            messages: structuredMessages,
            context: request.context,
          };

          const finalResponse = await this.processModelRequest(followUpRequest);
          logger.info(`✅ AI model synthesized structured tool results into final response`);

          return finalResponse;
        }
      }

      return response;
    } else {
      return {
        response: 'Model client not available. Please ensure the system is properly configured.',
        fallback: true,
      };
    }
  }

  private async handleToolExecution(request: WorkflowRequest): Promise<any> {
    const { payload } = request;
    const { toolName, args } = payload;

    if (this.mcpManager) {
      return await this.mcpManager.executeTool(toolName, args, request.context);
    } else {
      logger.warn(`Tool execution requested but no MCP manager available: ${toolName}`);
      return {
        result: `Tool ${toolName} would execute with args: ${JSON.stringify(args)}`,
        simulated: true,
      };
    }
  }

  private async handleModelRequest(request: WorkflowRequest): Promise<any> {
    const { payload } = request;

    return await this.processModelRequest(payload);
  }

  private async handleAnalysisRequest(request: WorkflowRequest): Promise<any> {
    const { payload } = request;

    // DEBUG: Check if modelClient is available
    if (!this.modelClient) {
      logger.error(
        '🚨 CRITICAL: ModelClient is null/undefined in ConcreteWorkflowOrchestrator.handleAnalysisRequest'
      );
      logger.error('🚨 This breaks all AI-powered analysis capabilities');
      throw new Error('ModelClient not available in orchestrator - dependency injection failed');
    }

    // Construct analysis prompt
    let analysisPrompt: string;
    if (payload.filePath) {
      analysisPrompt = payload.prompt || `Analyze the following file: ${payload.filePath}`;
    } else if (payload.content) {
      analysisPrompt = payload.prompt || `Analyze the following content: ${payload.content}`;
    } else if (payload.input) {
      analysisPrompt = payload.prompt || payload.input;
    } else {
      analysisPrompt = payload.prompt || 'Please provide analysis.';
    }

    logger.info(
      `🔍 Making AI analysis request with prompt: "${analysisPrompt.substring(0, 100)}..."`
    );

    // Get MCP tools for AI model with smart selection
    const mcpTools = await this.getMCPToolsForModel(analysisPrompt);

    // CRITICAL FIX: Create enhanced analysis prompt with explicit tool usage instructions
    const enhancedAnalysisPrompt = this.createEnhancedPrompt(analysisPrompt, mcpTools.length > 0);

    const modelRequest: ModelRequest = {
      id: request.id,
      prompt: enhancedAnalysisPrompt,
      model: payload.options?.model,
      temperature: payload.options?.temperature || 0.3, // Lower temperature for analysis
      maxTokens: payload.options?.maxTokens || 32768, // Increased from 2000 for comprehensive responses
      tools: mcpTools, // Include MCP tools for analysis too
      context: request.context,
    };

    // Log when enhanced analysis prompt is used
    if (mcpTools.length > 0) {
      logger.info(
        `🔍 Enhanced analysis prompt with explicit tool usage instructions (${mcpTools.length} tools available)`
      );
    }

    const result = await this.processModelRequest(modelRequest);

    // Handle any tool calls from the AI model during analysis
    if (result.toolCalls && result.toolCalls.length > 0) {
      logger.info(`🔧 AI made ${result.toolCalls.length} tool calls during analysis`);

      // Execute all tool calls and collect results
      const toolResults: Array<{ id: string; result: any; error?: string }> = [];

      if (!this.mcpManager) {
        throw new Error('MCP manager not available');
      }

      for (const toolCall of result.toolCalls) {
        try {
          const toolResult = await this.mcpManager.executeTool(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments),
            request.context
          );
          logger.info(`✅ Analysis tool call ${toolCall.function.name} executed`);

          toolResults.push({
            id: toolCall.id || toolCall.function.name,
            result: toolResult,
          });
        } catch (error) {
          logger.error(`❌ Analysis tool call failed:`, error);
          toolResults.push({
            id: toolCall.id || toolCall.function.name,
            result: null,
            error: getErrorMessage(error),
          });
        }
      }

      // CRITICAL FIX: Send tool results back to AI model using structured messages
      if (toolResults.length > 0) {
        logger.info(
          `🔄 Sending ${toolResults.length} tool results back to AI for analysis synthesis (STRUCTURED)`
        );

        // IMPROVED: Use structured message format for analysis too
        const structuredMessages = [
          {
            role: 'user' as const,
            content: analysisPrompt,
          },
          {
            role: 'assistant' as const,
            content: result.content || 'I need to use tools to analyze this.',
            tool_calls: result.toolCalls,
          },
          {
            role: 'tool' as const,
            content: JSON.stringify(toolResults, null, 2),
            tool_call_id: 'analysis_batch_results',
          },
        ];

        // Create structured follow-up analysis request
        const followUpRequest: ModelRequest = {
          id: `${request.id}-structured-analysis-followup`,
          prompt: `Analysis request: ${analysisPrompt}\n\nTool execution results are provided in the conversation history. Please provide a comprehensive analysis based on these results.`,
          model: modelRequest.model,
          temperature: modelRequest.temperature,
          maxTokens: modelRequest.maxTokens,
          tools: mcpTools,
          messages: structuredMessages,
          context: request.context,
        };

        const finalAnalysis = await this.processModelRequest(followUpRequest);
        logger.info(`✅ AI completed structured analysis synthesis with tool results`);

        return finalAnalysis;
      }
    }
    logger.info(`✅ AI analysis completed: ${result.usage?.totalTokens || 'unknown'} tokens`);
    return result;
  }

  private createDefaultContext(): WorkflowContext {
    return {
      sessionId: randomUUID(),
      workingDirectory: process.cwd(),
      permissions: ['read'],
      securityLevel: 'medium',
    };
  }

  private updateMetrics(processingTime: number, success: boolean): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    const totalProcessingTime =
      this.metrics.averageProcessingTime * (this.metrics.totalRequests - 1);
    this.metrics.averageProcessingTime =
      (totalProcessingTime + processingTime) / this.metrics.totalRequests;
  }

  /**
   * Get configuration from unified config file
   */
  private getConfig(): any {
    try {
      const configPath = 'config/unified-config.yaml';
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        return yaml.load(configContent);
      }
    } catch (error) {
      logger.warn('Failed to load configuration:', error);
    }
    return null;
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down ConcreteWorkflowOrchestrator');

    const shutdownTimeout = 10000;
    const startTime = performance.now();

    while (this.metrics.activeRequests > 0 && performance.now() - startTime < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.activeRequests.clear();
    this.isInitialized = false;
    this.removeAllListeners();

    this.eventBus.emit('orchestrator:shutdown', { timestamp: Date.now() });
  }
}

export default ConcreteWorkflowOrchestrator;
