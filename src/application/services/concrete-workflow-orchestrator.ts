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
import { IMcpManager } from '../../domain/interfaces/mcp-manager.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { getErrorMessage } from '../../utils/error-utils.js';
import { randomUUID } from 'crypto';
import { RequestExecutionManager } from '../../infrastructure/execution/request-execution-manager.js';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { ToolRegistry } from './orchestrator/tool-registry.js';
import { StreamingManager } from './orchestrator/streaming-manager.js';
import { ToolExecutionRouter } from './orchestrator/tool-execution-router.js';
import { providerCapabilityRegistry } from './provider-capability-registry.js';

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
  private mcpManager?: IMcpManager;
  private requestExecutionManager?: RequestExecutionManager;
  private isInitialized = false;
  private toolRegistry?: ToolRegistry;
  private streamingManager = new StreamingManager();
  private toolExecutionRouter?: ToolExecutionRouter;

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

  constructor(providerCapabilities: Record<string, any> = { streaming: true, toolCalling: true }) {
    super();
    // Register default provider capabilities (now configurable)
    providerCapabilityRegistry.register('default', providerCapabilities);
    
    // CRITICAL FIX: Register all supported providers with their capabilities
    // This fixes the tool execution issue where providers weren't recognized for tool calling
    providerCapabilityRegistry.register('ollama', { 
      streaming: true, 
      toolCalling: true  // Ollama supports tool calling
    });
    providerCapabilityRegistry.register('lm-studio', { 
      streaming: true, 
      toolCalling: true  // LM Studio supports tool calling
    });
    providerCapabilityRegistry.register('claude', { 
      streaming: false,  // Claude API typically doesn't support streaming in our implementation
      toolCalling: true  // Claude strongly supports tool calling
    });
    providerCapabilityRegistry.register('huggingface', { 
      streaming: false,  // HuggingFace typically doesn't support streaming
      toolCalling: false // Most HuggingFace models don't support tool calling
    });
  }

  /**
   * Helper method to route model requests through RequestExecutionManager when available
   */
  public async processModelRequest(
    request: ModelRequest,
    context?: WorkflowContext
  ): Promise<ModelResponse> {
    if (this.requestExecutionManager && this.modelClient) {
      // Use RequestExecutionManager for advanced execution strategies
      logger.debug('Routing model request through RequestExecutionManager');
      return await this.requestExecutionManager.processRequest(request, context as any);
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
      if (this.mcpManager) {
        this.toolExecutionRouter = new ToolExecutionRouter(this.mcpManager);
      }

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
        // Create a proper provider repository adapter to bridge the interface mismatch
        const providerRepository = this.createProviderRepositoryAdapter(this.modelClient);
        
        this.requestExecutionManager = new RequestExecutionManager(config, processManager, providerRepository);
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
    if (!this.modelClient) {
      return {
        response: 'Model client not available. Please ensure the system is properly configured.',
        fallback: true,
      };
    }

    // Prepare tools and prompt
    const { mcpTools, enhancedPrompt } = await this.prepareMCPToolsAndPrompt(request);
    
    // Build model request
    const modelRequest = this.buildModelRequest(request, enhancedPrompt, mcpTools);
    
    // Execute request (streaming or non-streaming)
    const response = await this.executeModelRequest(modelRequest);
    
    // Handle tool calls if present
    return await this.processToolCalls(response, request, modelRequest);
  }

  /**
   * Prepare MCP tools and enhanced prompt for the request
   */
  private async prepareMCPToolsAndPrompt(request: WorkflowRequest): Promise<{
    mcpTools: ModelTool[];
    enhancedPrompt: string;
  }> {
    const { payload } = request;
    const payloadAny = payload as any; // Type assertion to access dynamic properties
    const originalPrompt = payloadAny.input || payloadAny.prompt;

    // Get MCP tools for AI model with smart selection (unless disabled)
    const mcpTools = payloadAny.options?.useTools !== false
      ? await this.getMCPToolsForModel(originalPrompt)
      : [];

    // Create enhanced prompt with explicit tool usage instructions
    const enhancedPrompt = this.createEnhancedPrompt(originalPrompt, mcpTools.length > 0);

    // Log tool usage status
    if (mcpTools.length > 0) {
      logger.info(
        `🎯 Enhanced prompt with explicit tool usage instructions (${mcpTools.length} tools available)`
      );
    }

    if (payloadAny.options?.useTools === false) {
      logger.info('🚫 Tools disabled for simple question to enable pure streaming');
    }

    return { mcpTools, enhancedPrompt };
  }

  /**
   * Build the model request with all necessary parameters
   */
  private buildModelRequest(
    request: WorkflowRequest, 
    enhancedPrompt: string, 
    mcpTools: ModelTool[]
  ): ModelRequest {
    const { payload } = request;
    const payloadAny = payload as any; // Type assertion to access dynamic properties

    return {
      id: request.id,
      prompt: enhancedPrompt,
      model: payloadAny.options?.model,
      // Let ModelClient use its properly configured defaultProvider from model selection
      temperature: payloadAny.options?.temperature,
      maxTokens: payloadAny.options?.maxTokens,
      stream: payloadAny.options?.stream ?? true,
      tools: mcpTools,
      context: request.context,
      // Always include num_ctx to override Ollama's 4096 default
      num_ctx: parseInt(process.env.OLLAMA_NUM_CTX || '131072'),
      options: payloadAny.options,
    };
  }

  /**
   * Execute the model request with appropriate streaming strategy
   */
  private async executeModelRequest(modelRequest: ModelRequest): Promise<ModelResponse> {
    if (!modelRequest.stream) {
      return await this.processModelRequest(modelRequest);
    }

    // Check provider streaming capability
    if (modelRequest.provider && 
        !providerCapabilityRegistry.supports(modelRequest.provider, 'streaming')) {
      logger.warn(
        `Provider ${modelRequest.provider} does not support streaming; falling back to non-streaming`
      );
      modelRequest.stream = false;
      return await this.processModelRequest(modelRequest);
    }

    return await this.streamingManager.stream(this.modelClient!, modelRequest);
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
    logger.debug('ConcreteWorkflowOrchestrator: response keys:', Object.keys(response));
    logger.debug('ConcreteWorkflowOrchestrator: response.toolCalls exists:', !!response.toolCalls);
    logger.debug('ConcreteWorkflowOrchestrator: response.toolCalls length:', response.toolCalls?.length);

    if (response.toolCalls && 
        response.toolCalls.length > 0 && 
        this.toolExecutionRouter &&
        (!modelRequest.provider || 
         providerCapabilityRegistry.supports(modelRequest.provider, 'toolCalling'))) {
      
      return await this.toolExecutionRouter.handleToolCalls(
        response,
        request,
        modelRequest,
        req => this.processModelRequest(req)
      );
    }

    return response;
  }

  // Tool execution handler
  private async handleToolExecution(request: WorkflowRequest): Promise<any> {
    const { payload } = request;
    const payloadAny = payload as any; // Type assertion to access dynamic properties
    const { toolName, args } = payloadAny;

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
    const payloadAny = payload as any; // Type assertion to access dynamic properties

    // Convert WorkflowPayload to ModelRequest format
    const modelRequest: any = {
      prompt: payloadAny.prompt || payloadAny.input || payloadAny.messages?.[0]?.content || '',
      model: payloadAny.model,
      temperature: payloadAny.temperature,
      maxTokens: payloadAny.maxTokens,
      stream: payloadAny.stream,
      provider: payloadAny.provider,
      context: payloadAny.context,
      ...payloadAny // Spread any additional properties
    };

    return await this.processModelRequest(modelRequest);
  }

  private async handleAnalysisRequest(request: WorkflowRequest): Promise<any> {
    const { payload } = request;
    const payloadAny = payload as any; // Type assertion to access dynamic properties

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
    if (payloadAny.filePath) {
      analysisPrompt = payloadAny.prompt || `Analyze the following file: ${payloadAny.filePath}`;
    } else if (payloadAny.content) {
      analysisPrompt = payloadAny.prompt || `Analyze the following content: ${payloadAny.content}`;
    } else if (payloadAny.input) {
      analysisPrompt = payloadAny.prompt || payloadAny.input;
    } else {
      analysisPrompt = payloadAny.prompt || 'Please provide analysis.';
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
      model: payloadAny.options?.model,
      temperature: payloadAny.options?.temperature || 0.3, // Lower temperature for analysis
      maxTokens: payloadAny.options?.maxTokens || 32768, // Increased from 2000 for comprehensive responses
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

  /**
   * Create a provider repository adapter to bridge interface mismatch
   * between IModelClient and RequestExecutionManager expectations
   */
  private createProviderRepositoryAdapter(modelClient: IModelClient): any {
    // Define which providers are actually available/implemented
    const availableProviders = new Set(['ollama', 'lm-studio', 'claude', 'huggingface']);
    
    return {
      getProvider: (providerType: string) => {
        logger.debug(`Provider repository adapter: requested provider ${providerType}`);
        
        // Check if provider is actually available before returning adapter
        if (!availableProviders.has(providerType)) {
          logger.warn(`Provider ${providerType} is not implemented or available`);
          return null; // Return null instead of falling back silently
        }
        
        // Return an adapter that delegates to the modelClient for actual requests
        return {
          // Main method that RequestExecutionManager calls
          processRequest: async (request: ModelRequest, context?: any): Promise<ModelResponse> => {
            // Set the provider preference in the request
            const requestWithProvider = {
              ...request,
              provider: providerType,
            };
            logger.debug(`Provider adapter: delegating processRequest to modelClient with provider: ${providerType}`);
            return await modelClient.request(requestWithProvider);
          },
          
          // Legacy request method for compatibility
          request: async (request: ModelRequest): Promise<ModelResponse> => {
            const requestWithProvider = {
              ...request,
              provider: providerType,
            };
            return await modelClient.request(requestWithProvider);
          },
          
          // Streaming method that RequestExecutionManager expects for streaming support detection
          stream: async function*(request: ModelRequest): AsyncIterable<any> {
            // Get the actual ProviderAdapter from ModelClient's internal adapters
            const adapters = (modelClient as any).adapters;
            if (adapters && adapters.has(providerType)) {
              const actualAdapter = adapters.get(providerType);
              if (actualAdapter && typeof actualAdapter.stream === 'function') {
                logger.debug(`Provider repository adapter: delegating stream to actual ${providerType} adapter`);
                yield* actualAdapter.stream(request);
                return;
              }
            }
            
            // Fallback: if no streaming support, throw error to trigger fallback to processRequest
            throw new Error(`Provider ${providerType} does not support streaming`);
          },
          
          // Methods that RequestExecutionManager expects
          getModelName: () => providerType,
          isAvailable: () => true, // Assume modelClient handles availability
          getCapabilities: () => ['text-generation', 'tool-calling'],
          getName: () => providerType,
          getType: () => providerType,
        };
      },
      
      // Provide other methods that RequestExecutionManager might expect
      listProviders: () => {
        // Return the same providers as availableProviders for consistency
        return Array.from(availableProviders);
      },
      
      isProviderAvailable: (providerType: string) => true,
    };
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
