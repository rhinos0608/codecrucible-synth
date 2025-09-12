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
  OrchestratorDependencies,
  WorkflowContext,
  WorkflowRequest,
  WorkflowResponse,
} from '../../domain/interfaces/workflow-orchestrator.js';
import { IUserInteraction } from '../../domain/interfaces/user-interaction.js';
import { IEventBus } from '../../domain/interfaces/event-bus.js';
import {
  IModelClient,
  ModelRequest,
  ModelResponse,
  ModelTool,
  RequestContext,
} from '../../domain/interfaces/model-client.js';
import { IMcpManager } from '../../domain/interfaces/mcp-manager.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { toErrorOrUndefined, toReadonlyRecord } from '../../utils/type-guards.js';
import { randomUUID } from 'crypto';
import { RequestExecutionManager } from '../../infrastructure/execution/request-execution-manager.js';
import { ToolRegistry } from './orchestrator/tool-registry.js';
import type { IStreamingManager } from '../../domain/interfaces/streaming-manager.js';
import type { IToolExecutionRouter } from '../../domain/interfaces/tool-execution-router.js';
import type { IProviderCapabilityRegistry } from '../../domain/interfaces/provider-capability-registry.js';
import type { ToolExecutionResult } from '../../domain/interfaces/tool-execution.js';
import type { IModelProvider } from '../../domain/interfaces/model-client.js';
import type { ProviderType, ProjectContext } from '../../domain/types/unified-types.js';
import type { Provider } from '../../infrastructure/execution/request-execution-manager.js';
import { toError } from '../../utils/type-guards.js';
import { SequentialToolExecutor } from '../../infrastructure/tools/sequential-tool-executor.js';
import { unifiedToolRegistry } from '../../infrastructure/tools/unified-tool-registry.js';

/**
 * ToolExecutionError type definition for error mapping in executeTool
 */
type ToolExecutionError = {
  code: string;
  message: string;
  stack?: string;
  details?: Record<string, unknown>;
};

export interface WorkflowMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  activeRequests: number;
}

export interface ProviderCapabilities {
  readonly streaming: boolean;
  readonly toolCalling: boolean;
}

/**
 * Concrete Workflow Orchestrator implementation
 */
export class ConcreteWorkflowOrchestrator extends EventEmitter implements IWorkflowOrchestrator {
  /**
   * Adapter to provide a getProvider method for the modelClient.
   */
  public static createProviderRepositoryAdapter(modelClient?: IModelClient): {
    getProvider: (providerType: ProviderType) => Provider | undefined;
  } {
    return {
      getProvider: (providerType: ProviderType): Provider | undefined => {
        // Create a Provider interface compatible with RequestExecutionManager
        if (modelClient) {
          return {
            processRequest: async (
              request: Readonly<ModelRequest>,
              context?: Readonly<ProjectContext>
            ) => {
              return await modelClient.request(request);
            },
            // Provide an actual model name hint when available for capability checks
            getModelName: () =>
              process.env.DEFAULT_MODEL && process.env.DEFAULT_MODEL.trim().length > 0
                ? (process.env.DEFAULT_MODEL as string)
                : 'llama3.1:8b',
          } as Provider;
        }
        return undefined;
      },
    };
  }

  private userInteraction!: IUserInteraction;
  private eventBus!: IEventBus;
  private modelClient?: IModelClient;
  private mcpManager?: IMcpManager;
  private requestExecutionManager?: RequestExecutionManager;
  private isInitialized = false;
  private toolRegistry?: ToolRegistry;
  private readonly streamingManager: IStreamingManager;
  private readonly toolExecutionRouter: IToolExecutionRouter;
  private readonly providerCapabilityRegistry: IProviderCapabilityRegistry;
  private readonly sequentialToolExecutor: SequentialToolExecutor;

  // Request tracking
  private readonly activeRequests: Map<
    string,
    {
      request: WorkflowRequest;
      startTime: number;
      context: WorkflowContext;
    }
  > = new Map();

  // Metrics
  private readonly metrics: WorkflowMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageProcessingTime: 0,
    activeRequests: 0,
  };

  public constructor(
    streamingManager: IStreamingManager,
    toolExecutionRouter: IToolExecutionRouter,
    providerCapabilityRegistry: IProviderCapabilityRegistry,
    providerCapabilities: Readonly<ProviderCapabilities> = { streaming: true, toolCalling: true }
  ) {
    super();
    this.streamingManager = streamingManager;
    this.toolExecutionRouter = toolExecutionRouter;
    this.providerCapabilityRegistry = providerCapabilityRegistry;
    this.sequentialToolExecutor = new SequentialToolExecutor();
    // Register default provider capabilities (now configurable)
    this.providerCapabilityRegistry.register('default', providerCapabilities);

    // CRITICAL FIX: Register all supported providers with their capabilities
    // This fixes the tool execution issue where providers weren't recognized for tool calling
    this.providerCapabilityRegistry.register('ollama', {
      streaming: true,
      toolCalling: true, // Ollama supports tool calling
    });
    this.providerCapabilityRegistry.register('huggingface', {
      streaming: false, // HuggingFace typically doesn't support streaming
      toolCalling: false, // Most HuggingFace models don't support tool calling
    });
  }
  /**
   * Gracefully shuts down the orchestrator and releases resources.
   */
  public async shutdown(): Promise<void> {
    logger.info('ConcreteWorkflowOrchestrator: Shutting down...');
    // Attempt to clean up any managed resources
    try {
      // If the requestExecutionManager has a shutdown/close method, call it
      if (
        this.requestExecutionManager &&
        typeof (this.requestExecutionManager as any).shutdown === 'function'
      ) {
        await (this.requestExecutionManager as any).shutdown();
      }
      // If the modelClient has a shutdown/close method, call it
      if (this.modelClient && typeof (this.modelClient as any).shutdown === 'function') {
        await (this.modelClient as any).shutdown();
      }
      // If the mcpManager has a shutdown/close method, call it
      if (this.mcpManager && typeof (this.mcpManager as any).shutdown === 'function') {
        await (this.mcpManager as any).shutdown();
      }
      // Remove all event listeners
      this.removeAllListeners();
      // Mark as not initialized
      this.isInitialized = false;
      logger.info('ConcreteWorkflowOrchestrator: Shutdown complete.');
      this.eventBus?.emit('orchestrator:shutdown', { timestamp: Date.now() });
    } catch (err) {
      logger.error('Error during orchestrator shutdown', toErrorOrUndefined(err));
      throw err;
    }
  }

  /**
   * Helper method to route model requests through RequestExecutionManager when available
   */
  public async processModelRequest(
    request: Readonly<ModelRequest>,
    context?: Readonly<WorkflowContext>
  ): Promise<ModelResponse> {
    if (this.requestExecutionManager && this.modelClient) {
      // Use RequestExecutionManager for advanced execution strategies
      logger.debug('Routing model request through RequestExecutionManager');
      // Convert WorkflowContext to ProjectContext if needed
      const projectContext = this.workflowContextToProjectContext(context);
      return this.requestExecutionManager.processRequest(request, projectContext);
    } else if (this.modelClient) {
      // Fallback to direct ModelClient
      logger.debug('Using direct ModelClient for request');
      return this.modelClient.request(request);
    } else {
      throw new Error('No model client available for request processing');
    }
  }

  /**
   * Converts a WorkflowContext to a ProjectContext for compatibility with RequestExecutionManager.
   */
  private workflowContextToProjectContext(context?: Readonly<WorkflowContext>):
    | Readonly<{
        workingDirectory: string;
        config: Record<string, unknown>;
        files: Array<{
          path: string;
          content: string;
          type: string;
          language?: string;
        }>;
        structure?: {
          directories: string[];
          fileTypes: Record<string, number>;
        };
      }>
    | undefined {
    if (!context) return undefined;
    // Provide dummy config/files if missing to satisfy ProjectContext shape
    const { config, files, workingDirectory, structure } = context as {
      config?: Record<string, unknown>;
      files?: Array<{ path: string; content: string; type: string; language?: string }>;
      workingDirectory?: string;
      structure?: { directories: string[]; fileTypes: Record<string, number> };
    };

    return {
      workingDirectory: workingDirectory ?? process.cwd(),
      config: config ?? {},
      files: Array.isArray(files) ? files : [],
      ...(structure ? { structure } : {}),
    };
  }

  /**
   * Initialize the orchestrator with dependencies
   */
  public async initialize(dependencies: Readonly<OrchestratorDependencies>): Promise<void> {
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
      logger.info(`  - userInteraction: ✅ Available`);
      logger.info(`  - eventBus: ✅ Available`);

      try {
        // Create a proper provider repository adapter to bridge the interface mismatch
        const providerRepository: Readonly<{
          getProvider: (providerType: ProviderType) => Provider | undefined;
        }> = ConcreteWorkflowOrchestrator.createProviderRepositoryAdapter(this.modelClient);

        const { HardwareAwareModelSelector } = await import(
          '../../infrastructure/performance/hardware-aware-model-selector.js'
        );
        const hardwareSelector = new HardwareAwareModelSelector();
        const { ActiveProcessManager } = await import(
          '../../infrastructure/performance/active-process-manager.js'
        );
        const processManager = new ActiveProcessManager(hardwareSelector);

        // Provide a properly typed ExecutionConfig object
        const config: Readonly<{
          maxConcurrentRequests: number;
          defaultTimeout: number;
          complexityTimeouts: { simple: number; medium: number; complex: number };
          memoryThresholds: { low: number; medium: number; high: number };
        }> = {
          maxConcurrentRequests: 4,
          defaultTimeout: 60000,
          complexityTimeouts: {
            simple: 30000,
            medium: 60000,
            complex: 120000,
          },
          memoryThresholds: {
            low: 512,
            medium: 1024,
            high: 2048,
          },
        };

        // Inject the Rust backend from the runtime context to avoid duplicate initialization
        const injectedRustBackend = (
          dependencies.runtimeContext as unknown as {
            rustBackend?: unknown;
          }
        )?.rustBackend as unknown;

        this.requestExecutionManager = new RequestExecutionManager(
          config,
          processManager,
          providerRepository,
          injectedRustBackend as unknown as
            | import('../../infrastructure/execution/rust/index.js').ConsolidatedRustSystem
            | null
        );
        logger.info(
          '  - requestExecutionManager: ✅ Initialized with advanced execution strategies'
        );
      } catch (innerError: unknown) {
        logger.error('Failed to initialize requestExecutionManager:', toError(innerError));
        throw toError(innerError);
      }

      this.isInitialized = true;

      logger.info('ConcreteWorkflowOrchestrator initialized successfully');
      this.eventBus.emit('orchestrator:initialized', { timestamp: Date.now() });
    } catch (error: unknown) {
      logger.error('Failed to initialize ConcreteWorkflowOrchestrator:', toError(error));
      throw toError(error);
    }
  }
  /**
   * Process a workflow request
   */
  public async processRequest(
    request: WorkflowRequest,
    context?: WorkflowContext
  ): Promise<WorkflowResponse> {
    const startTime = performance.now();
    this.metrics.totalRequests++;
    this.metrics.activeRequests++;

    try {
      let result: unknown;
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

      if (this.eventBus) {
        this.eventBus.emit('workflow:failed', { id: request.id, error });
      }

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
  public async executeTool(
    toolName: string,
    args: Readonly<Record<string, unknown>>,
    context: WorkflowContext
  ): Promise<ToolExecutionResult<unknown>> {
    const request: WorkflowRequest = {
      id: randomUUID(),
      type: 'tool-execution',
      payload: { toolName, args } as Readonly<{
        toolName: string;
        args: Readonly<Record<string, unknown>>;
      }>,
      context,
    };

    const response = await this.processRequest(request);

    if (response.success) {
      return {
        success: true,
        data: response.result,
        error: undefined,
      };
    } else {
      // Map Error to ToolExecutionError shape
      let errorObj: ToolExecutionError | undefined;
      if (response.error) {
        if (
          typeof response.error === 'object' &&
          response.error !== null &&
          'code' in response.error &&
          'message' in response.error
        ) {
          errorObj = {
            code: (response.error as { code: string }).code,
            message: (response.error as { message: string }).message,
            stack: (response.error as { stack?: string }).stack,
            details: (response.error as { details?: Record<string, unknown> }).details ?? {},
          };
        } else if (response.error instanceof Error) {
          errorObj = {
            code: 'TOOL_EXECUTION_ERROR',
            message: response.error.message,
            stack: response.error.stack,
            details: {},
          };
        } else {
          errorObj = {
            code: 'TOOL_EXECUTION_ERROR',
            message: String(response.error),
            details: {},
          };
        }
      } else {
        errorObj = {
          code: 'TOOL_EXECUTION_ERROR',
          message: `Tool execution failed: ${toolName}`,
          details: {} as Record<string, unknown>,
        };
      }
      return {
        success: false,
        data: undefined,
        error: errorObj,
      };
    }
  }

  private async getMCPToolsForModel(userQuery?: string): Promise<ModelTool[]> {
    return this.toolRegistry?.getToolsForModel(userQuery) ?? [];
  }

  /**
   * Detect if we're using a small model (8B or less) that needs simplified prompting
   */
  private isSmallModel(modelName?: string): boolean {
    if (!modelName) return false;

    // Check for common 8B or smaller model patterns
    const smallModelPatterns = [/8b/i, /7b/i, /3b/i, /1b/i, /0.5b/i, /small/i, /mini/i, /lite/i];

    return smallModelPatterns.some(pattern => pattern.test(modelName));
  }

  /**
   * Create enhanced prompt with adaptive strategy based on model capabilities
   * Small models (8B and under) get simplified zero-shot prompts
   * Large models get comprehensive tool instructions
   */
  private createEnhancedPrompt(
    userPrompt: string,
    toolsAvailable: boolean,
    toolNames?: readonly string[],
    modelName?: string
  ): string {
    if (!toolsAvailable) {
      return userPrompt;
    }

    const isSmall = this.isSmallModel(modelName);

    if (isSmall) {
      // Simplified zero-shot approach for small models (8B and under)
      return this.createZeroShotToolPrompt(userPrompt, toolNames);
    } else {
      // Comprehensive approach for larger models
      return this.createComprehensiveToolPrompt(userPrompt, toolNames);
    }
  }

  /**
   * Pseudo code + natural language hybrid prompt for small models (8B and under)
   * Uses code-like structures that AI models parse more efficiently
   */
  private createZeroShotToolPrompt(userPrompt: string, toolNames?: readonly string[]): string {
    // Limit tools to avoid overwhelming small models
    const limitedTools = Array.isArray(toolNames) ? toolNames.slice(0, 3) : [];
    const toolList =
      limitedTools.length > 0
        ? `\nAVAILABLE_TOOLS = [${limitedTools.map(t => `"${t}"`).join(', ')}]`
        : '';

    return `${userPrompt}

// ALGORITHM: ProcessUserRequest
// INPUT: user_query, available_tools
// OUTPUT: tool_call_json OR direct_response

FUNCTION process_request(user_query):
    IF requires_tool_execution(user_query) THEN
        selected_tool = analyze_requirements(user_query, AVAILABLE_TOOLS)
        RETURN tool_call_json(selected_tool, extract_parameters(user_query))
    ELSE
        RETURN direct_text_response(user_query)
    END IF

// TOOL_CALL_JSON FORMAT:
// {"name": "tool_name", "parameters": {...}}

// EXAMPLES:
// execute_command: {"name": "execute_command", "parameters": {"command": "node", "args": ["--version"], "workingDirectory": "PROJECT_ROOT_DIRECTORY"}}
// filesystem_read: {"name": "filesystem_read_file", "parameters": {"path": "/path/to/file"}}

EXECUTE process_request("${userPrompt}")${toolList}`;
  }

  /**
   * Pseudo code enhanced comprehensive prompt for larger models
   * Combines the clarity of pseudo code with comprehensive tool instructions
   */
  private createComprehensiveToolPrompt(userPrompt: string, toolNames?: readonly string[]): string {
    const toolList =
      Array.isArray(toolNames) && toolNames.length > 0
        ? `\nAVAILABLE_TOOLS = [${toolNames
            .slice(0, 20)
            .map(t => `"${t}"`)
            .join(', ')}]`
        : '';

    return `${userPrompt}

// COMPREHENSIVE ALGORITHM: AdvancedTaskProcessor
// CAPABILITIES: filesystem_ops, git_ops, system_commands, analysis
// STRATEGY: proactive_tool_usage, real_results_only

CLASS TaskProcessor:
    PROPERTY tools = AVAILABLE_TOOLS
    PROPERTY strategy = "proactive_execution"
    
    METHOD process_request(user_query):
        analysis = analyze_task_requirements(user_query)
        
        WHILE NOT task_complete(analysis):
            IF requires_file_operation(analysis) THEN
                CALL filesystem_tool(extract_file_params(analysis))
            ELIF requires_command_execution(analysis) THEN
                CALL execute_command_tool(extract_cmd_params(analysis))
            ELIF requires_git_operation(analysis) THEN
                CALL git_tool(extract_git_params(analysis))
            END IF
            
            UPDATE analysis WITH tool_results
        END WHILE
        
        RETURN comprehensive_response(analysis, tool_results)
    
    // TOOL CALL SPECIFICATIONS:
    METHOD execute_command_tool(params):
        // Use direct system commands only
        VALID_COMMANDS = ["node", "npm", "git", "tsc", "eslint", "python", "curl"]
        INVALID_COMMANDS = ["bash_run", "shell_exec", "wrapper_cmd"]
        
        RETURN {"name": "execute_command", "parameters": {
            "command": select_from(VALID_COMMANDS),
            "args": split_arguments_array(params.arguments),
            "workingDirectory": resolve_path(params.directory)
        }}

// EXECUTION DIRECTIVE: Don't describe actions - execute them
// OUTPUT REQUIREMENT: Provide real results from actual tool usage

EXECUTE TaskProcessor.process_request("${userPrompt}")${toolList}`;
  }

  private async handlePromptRequest(request: WorkflowRequest): Promise<any> {
    if (!this.modelClient) {
      return {
        response: 'Model client not available. Please ensure the system is properly configured.',
        fallback: true,
      };
    }

    // Prepare tools and prompt
    const { mcpTools, enhancedPrompt } = await this.prepareMCPToolsAndPrompt(request);
    if (mcpTools.length > 0) {
      const toolDefs = unifiedToolRegistry.getAllTools();
      const availableTools = toolDefs.map(def => ({
        name: def.name,
        function: { name: def.name, description: def.description },
      }));

      const modelClientAdapter = {
        generateText: async (
          prompt: string,
          options: { temperature?: number; maxTokens?: number; tools?: unknown[] }
        ): Promise<string> => {
          const res = await this.processModelRequest({
            id: request.id,
            prompt,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            tools: options.tools as ModelTool[],
          });
          return typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
        },
      };

      return this.sequentialToolExecutor.executeWithReasoning(
        enhancedPrompt,
        availableTools,
        modelClientAdapter,
        5
      );
    }

    const modelRequest = this.buildModelRequest(request, enhancedPrompt, mcpTools);
    const response = await this.executeModelRequest(modelRequest);
    return this.processToolCalls(response, request, modelRequest);
  }

  /**
   * Prepare MCP tools and enhanced prompt for the request
   */
  private async prepareMCPToolsAndPrompt(request: Readonly<WorkflowRequest>): Promise<{
    mcpTools: ModelTool[];
    enhancedPrompt: string;
  }> {
    interface PromptPayload {
      input?: string;
      prompt?: string;
      options?: {
        useTools?: boolean;
        model?: string;
      };
    }
    const { payload } = request;
    const payloadTyped = payload as PromptPayload;
    const originalPrompt = (payloadTyped.input || payloadTyped.prompt) ?? '';
    const modelName = payloadTyped.options?.model;

    // Get MCP tools for AI model with smart selection (unless disabled)
    const mcpTools =
      payloadTyped.options?.useTools !== false
        ? await this.getMCPToolsForModel(originalPrompt)
        : [];

    // Create enhanced prompt with adaptive strategy based on model capabilities
    const enhancedPrompt = this.createEnhancedPrompt(
      originalPrompt,
      mcpTools.length > 0,
      mcpTools.map(t => t.function.name),
      modelName
    );

    // Log tool usage status
    if (mcpTools.length > 0) {
      logger.info(
        `🎯 Enhanced prompt with explicit tool usage instructions (${mcpTools.length} tools available)`
      );
    }

    if (payloadTyped.options?.useTools === false) {
      logger.info('🚫 Tools disabled for simple question to enable pure streaming');
    }

    return { mcpTools, enhancedPrompt };
  }

  /**
   * Build the model request with all necessary parameters
   */
  private buildModelRequest(
    request: Readonly<WorkflowRequest>,
    enhancedPrompt: string,
    mcpTools: ReadonlyArray<ModelTool>
  ): ModelRequest {
    const { payload } = request;
    interface PayloadWithOptions {
      options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        stream?: boolean;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    }
    const payloadTyped: PayloadWithOptions = payload as PayloadWithOptions;

    return {
      id: request.id,
      prompt: enhancedPrompt,
      // Ensure the model string is present for downstream capability checks (e.g., tool calling support)
      model: payloadTyped.options?.model ?? process.env.DEFAULT_MODEL,
      // Let ModelClient use its properly configured defaultProvider from model selection
      temperature: payloadTyped.options?.temperature,
      maxTokens: payloadTyped.options?.maxTokens,
      stream: payloadTyped.options?.stream ?? true,
      tools: mcpTools as ModelTool[],
      context: request.context,
      // Always include num_ctx to override Ollama's 4096 default
      num_ctx: parseInt(process.env.OLLAMA_NUM_CTX ?? '131072', 10),
      options: payloadTyped.options,
    };
  }

  /**
   * Execute the model request with appropriate streaming strategy
   */
  private async executeModelRequest(modelRequest: Readonly<ModelRequest>): Promise<ModelResponse> {
    if (!modelRequest.stream) {
      return this.processModelRequest(modelRequest);
    }

    // Check provider streaming capability
    if (
      modelRequest.provider &&
      !this.providerCapabilityRegistry.supports(modelRequest.provider, 'streaming')
    ) {
      logger.warn(
        `Provider ${modelRequest.provider} does not support streaming; falling back to non-streaming`
      );
      const nonStreamingRequest = { ...modelRequest, stream: false };
      return this.processModelRequest(nonStreamingRequest);
    }

    if (!this.modelClient) {
      throw new Error('Model client not available');
    }
    return this.streamingManager.stream(this.modelClient, modelRequest);
  }

  /**
   * Process tool calls from the AI response if present
   */
  private async processToolCalls(
    response: ModelResponse,
    request: WorkflowRequest,
    modelRequest: ModelRequest
  ): Promise<ModelResponse> {
    logger.debug('ConcreteWorkflowOrchestrator: Checking for tool calls');
    logger.debug('ConcreteWorkflowOrchestrator: response keys:', { keys: Object.keys(response) });
    logger.debug('ConcreteWorkflowOrchestrator: response.toolCalls exists:', {
      hasToolCalls: !!response.toolCalls,
    });
    logger.debug('ConcreteWorkflowOrchestrator: response.toolCalls length:', {
      length: response.toolCalls?.length,
    });

    // Always give ToolExecutionRouter a chance to extract structured tool calls
    // from plain text (JSON-as-intent) even when provider didn't emit toolCalls.
    // The router will no-op and return the original response when nothing is found.
    try {
      return await this.toolExecutionRouter.handleToolCalls(
        response,
        request,
        modelRequest,
        async (req: Readonly<ModelRequest>) => this.processModelRequest(req)
      );
    } catch {
      // If routing fails for any reason, fall back to the original response
      return response;
    }
  }

  // Tool execution handler
  private async handleToolExecution(
    request: Readonly<WorkflowRequest>
  ): Promise<ToolExecutionResult> {
    const { payload } = request;
    // Define a type for the expected payload structure
    interface ToolExecutionPayload {
      toolName: string;
      args: Readonly<Record<string, unknown>>;
    }
    const { toolName, args } = payload as unknown as ToolExecutionPayload;

    if (this.mcpManager) {
      // Ensure correct types for arguments
      return this.mcpManager.executeTool(toolName, args, request.context);
    } else {
      logger.warn(`Tool execution requested but no MCP manager available: ${toolName}`);
      return {
        success: false,
        data: undefined,
        error: {
          code: 'MCP_MANAGER_UNAVAILABLE',
          message: `Tool ${toolName} would execute with args: ${JSON.stringify(args)}`,
          details: {},
        },
      };
    }
  }

  private async handleModelRequest(request: Readonly<WorkflowRequest>): Promise<ModelResponse> {
    const { payload } = request;

    interface PayloadWithOptions {
      prompt?: string;
      input?: string;
      messages?: Array<{ content?: string }>;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      provider?: string;
      context?: RequestContext;
      [key: string]: unknown;
    }

    const payloadTyped: PayloadWithOptions =
      typeof payload === 'object' && payload !== null ? (payload as PayloadWithOptions) : {};

    const prompt =
      payloadTyped.prompt ??
      payloadTyped.input ??
      (Array.isArray(payloadTyped.messages) && payloadTyped.messages[0]?.content
        ? payloadTyped.messages[0].content
        : '');

    // Map messages to the correct type if present
    let messages:
      | {
          role: 'user' | 'assistant' | 'tool';
          content: string;
          tool_calls?: Record<string, unknown>[];
          tool_call_id?: string;
        }[]
      | undefined = undefined;
    if (Array.isArray(payloadTyped.messages)) {
      messages = payloadTyped.messages.map(msg => ({
        role: 'user',
        content: msg.content ?? '',
      }));
    }

    const modelRequest: ModelRequest = {
      id: request.id,
      prompt,
      model: payloadTyped.model,
      temperature: payloadTyped.temperature,
      maxTokens: payloadTyped.maxTokens,
      stream: payloadTyped.stream,
      context: payloadTyped.context,
      ...(messages ? { messages } : {}),
      // Do not spread payloadTyped directly to avoid type errors
    };

    return this.processModelRequest(modelRequest);
  }

  private async handleAnalysisRequest(
    request: Readonly<WorkflowRequest>
  ): Promise<Record<string, unknown>> {
    const { payload } = request;
    const filePath = (payload as { filePath?: string }).filePath ?? '';
    if (!filePath) {
      throw new Error('File path is required for analysis');
    }

    // Resolve path relative to workflow/project context if available
    const projectContext = this.workflowContextToProjectContext(request.context);
    const workingDirectory = projectContext?.workingDirectory ?? process.cwd();
    const pathModule = await import('path');
    const resolvedPath = pathModule.isAbsolute(filePath)
      ? filePath
      : pathModule.resolve(workingDirectory, filePath);

    let fileContent: string | undefined;
    let stats: Record<string, unknown> | undefined;
    let usedMcp = false;
    const toolResults: Array<{ tool: string; result: unknown }> = [];

    try {
      // Prefer MCP tools for filesystem ops if available (they respect project sandboxing)
      if (this.mcpManager) {
        usedMcp = true;

        // 1) Get stats (existence, size, mode, etc.)
        try {
          const statsRes = await this.mcpManager.executeTool(
            'filesystem_get_stats',
            { path: resolvedPath },
            request.context
          );
          toolResults.push({ tool: 'filesystem_get_stats', result: statsRes });

          if (statsRes.success && statsRes.data) {
            stats = statsRes.data as Record<string, unknown>;
          } else {
            // If tool reported not found or failure, ensure we surface that
            if (!statsRes.success) {
              // Fall back to checking with node fs
              throw new Error(
                `filesystem_get_stats reported failure: ${JSON.stringify(statsRes.error ?? statsRes)}`
              );
            }
          }
        } catch (err) {
          // If MCP tool failed, allow fallback to local fs below
          logger.debug('MCP stats tool failed, falling back to fs.stat', {
            error: toReadonlyRecord(err),
          });
          usedMcp = false;
        }
      }

      // If we haven't obtained file content/stats via MCP, use node fs
      if (!usedMcp) {
        const fs = await import('fs/promises');
        try {
          const st: import('fs').Stats = await fs.stat(resolvedPath);
          stats = {
            size: st.size,
            mtime: st.mtime,
            birthtime: st.birthtime,
            isFile: typeof st.isFile === 'function' ? st.isFile() : true,
          };
        } catch (err) {
          throw new Error(`File not found or inaccessible: ${resolvedPath}`);
        }
      }

      // Read file contents (prefer MCP read tool)
      if (this.mcpManager && !usedMcp) {
        try {
          const readRes = await this.mcpManager.executeTool(
            'filesystem_read_file',
            { path: resolvedPath, encoding: 'utf-8' },
            request.context
          );
          toolResults.push({ tool: 'filesystem_read_file', result: readRes });
          if (readRes.success && typeof readRes.data === 'string') {
            fileContent = readRes.data;
          } else {
            // If read tool failed, fallback to local fs
            logger.debug(
              'MCP read tool failed or returned non-string, falling back to fs.readFile'
            );
            fileContent = undefined;
          }
        } catch (err) {
          logger.debug('MCP read tool threw, falling back to fs.readFile', {
            error: toReadonlyRecord(err),
          });
          fileContent = undefined;
        }
      }

      if (fileContent === undefined) {
        const fs = await import('fs/promises');
        try {
          fileContent = await fs.readFile(resolvedPath, 'utf-8');
        } catch (err) {
          throw new Error(`Unable to read file: ${resolvedPath} (${String(err)})`);
        }
      }

      // If we still don't have content, fail
      if (typeof fileContent !== 'string') {
        throw new Error(`File content could not be obtained for ${resolvedPath}`);
      }

      // Build an analysis prompt for the model (structured output requested)
      const userPrompt = [
        `You are an expert code reviewer and static analysis assistant.`,
        `Analyze the file at path: ${resolvedPath}`,
        'Produce a JSON object with the following fields:',
        '  - summary: short (1-3 sentences) summary of what this file does',
        '  - issues: array of { severity: "low"|"medium"|"high", line?: number, message: string }',
        '  - security: array of security-related findings with explanation and mitigation',
        '  - suggestions: array of concrete code changes; for each include { description, patch } where patch is a unified-diff or exact changed lines',
        '  - tests: suggestions for tests to add (short descriptions and example assertions)',
        'Return ONLY valid JSON. Do not include any markdown or surrounding commentary.',
      ].join('\n');

      const enhancedPrompt = this.createEnhancedPrompt(userPrompt, !!this.mcpManager);

      // Attach the file content and explicit instruction markers to avoid truncation or confusion
      const fullPrompt = `${enhancedPrompt}\n\n=== BEGIN FILE CONTENT (${resolvedPath}) ===\n${fileContent}\n=== END FILE CONTENT ===\n\nPlease respond with the requested JSON object.`;

      // If a model client is available, use it for deep analysis
      let modelResponse: ModelResponse | undefined;
      if (this.modelClient) {
        const modelRequest: ModelRequest = {
          id: request.id,
          prompt: fullPrompt,
          // model left undefined to allow ModelClient selection
          temperature: 0.0,
          maxTokens: 2000,
          stream: false,
          context: request.context,
          options: { purpose: 'analysis', format: 'json' },
        };

        modelResponse = await this.processModelRequest(modelRequest);

        // If the model produced tool calls (e.g., to run linters or tests), route them
        try {
          modelResponse = await this.processToolCalls(modelResponse, request, modelRequest);
        } catch (err) {
          logger.warn('Processing tool calls during analysis failed', {
            error: toReadonlyRecord(err),
          });
        }

        // Try to parse model text into JSON result if the model returned plain text
        let parsedAnalysis: unknown = undefined;
        // modelResponse is always truthy here
        if (typeof modelResponse.text === 'string') {
          try {
            parsedAnalysis = JSON.parse(modelResponse.text);
          } catch {
            // Attempt to extract JSON substring
            const [jsonMatch] = modelResponse.text.match(/\{[\s\S]*\}$/) ?? [];
            if (jsonMatch) {
              try {
                parsedAnalysis = JSON.parse(jsonMatch);
              } catch {
                parsedAnalysis = { modelRaw: modelResponse.text };
              }
            } else {
              parsedAnalysis = { modelRaw: modelResponse.text };
            }
          }
        } else {
          parsedAnalysis = { modelResponse };
        }

        // Emit event and return structured analysis
        const result = {
          path: resolvedPath,
          stats,
          content: fileContent,
          analysis: parsedAnalysis,
          modelResponse,
          toolResults,
        };

        this.eventBus.emit('workflow:analysis_completed', { id: request.id, path: resolvedPath });
        return result;
      }

      // No model client: perform deterministic, local heuristic analysis
      // fileContent is always string here due to previous checks
      const lines = (fileContent ?? '').split(/\r?\n/);
      const longLines = lines
        .map((l, i) => ({ line: i + 1, length: l.length }))
        .filter(x => x.length > 200)
        .slice(0, 10);

      const todoMatches = lines
        .map((l, i) => ({ line: i + 1, text: l }))
        .filter(x => /TODO|FIXME|BUG|HACK/i.test(x.text));

      const issues = [
        ...longLines.map(l => ({
          severity: 'low',
          line: l.line,
          message: `Long line (${l.length} chars)`,
        })),
        ...todoMatches.map(t => ({
          severity: 'medium',
          line: t.line,
          message: `Contains TODO/FIXME: ${t.text.trim()}`,
        })),
      ];

      const localAnalysis = {
        summary: `Local heuristics: ${pathModule.basename(resolvedPath)} contains ${lines.length} lines.`,
        issues,
        security: [], // we can't do deep security checks without a model or linters
        suggestions: longLines.length
          ? [
              {
                description: 'Wrap or refactor long lines for readability',
                patch: null,
              },
            ]
          : [],
        tests: [],
      };

      const result = {
        path: resolvedPath,
        stats,
        content: fileContent,
        analysis: localAnalysis,
        toolResults,
      };

      this.eventBus.emit('workflow:analysis_completed', { id: request.id, path: resolvedPath });
      return result;
    } catch (err: unknown) {
      logger.error('Analysis request failed', toErrorOrUndefined(err));
      this.eventBus.emit('workflow:analysis_failed', {
        id: request?.id,
        path: typeof resolvedPath !== 'undefined' ? resolvedPath : '',
        error: err,
      });
      throw err;
    }
  }

  public updateMetrics(processingTime: number, success: boolean): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Guard against division by zero; totalRequests is incremented at the start of processRequest
    const total = Math.max(1, this.metrics.totalRequests);
    const prevTotalProcessing = this.metrics.averageProcessingTime * Math.max(0, total - 1);
    const newAvg = (prevTotalProcessing + processingTime) / total;
    if (Number.isFinite(newAvg)) {
      this.metrics.averageProcessingTime = newAvg;
    }
  }
}
