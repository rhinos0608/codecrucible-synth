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
import { IModelClient, ModelRequest, ModelTool } from '../../domain/interfaces/model-client.js';
import { UnifiedConfigurationManager } from '../../domain/config/config-manager.js';
import { UnifiedSecurityValidator } from '../../domain/services/unified-security-validator.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { RuntimeContext } from '../runtime/runtime-context.js';
import { getErrorMessage } from '../../utils/error-utils.js';
import { randomUUID } from 'crypto';

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
  private securityValidator?: UnifiedSecurityValidator;
  private configManager?: UnifiedConfigurationManager;
  private isInitialized = false;
  private runtimeContext?: RuntimeContext;

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
   * Initialize the orchestrator with dependencies
   */
  async initialize(dependencies: OrchestratorDependencies): Promise<void> {
    try {
      // Prefer runtimeContext if provided (incremental migration)
      if (dependencies.runtimeContext) {
        this.runtimeContext = dependencies.runtimeContext;
        this.eventBus = dependencies.runtimeContext.eventBus;
        this.securityValidator =
          dependencies.runtimeContext.securityValidator ?? dependencies.securityValidator;
        this.configManager =
          dependencies.runtimeContext.configManager ?? dependencies.configManager;
      } else {
        this.eventBus = dependencies.eventBus;
        this.securityValidator = dependencies.securityValidator;
        this.configManager = dependencies.configManager;
      }
      this.userInteraction = dependencies.userInteraction;
      this.modelClient = dependencies.modelClient;
      this.mcpManager = dependencies.mcpManager;

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
   * Process a model request with routing and fallbacks
   */
  async processModelRequest(request: any, context: WorkflowContext): Promise<any> {
    const workflowRequest: WorkflowRequest = {
      id: randomUUID(),
      type: 'model-request',
      payload: request,
      context,
    };

    const response = await this.processRequest(workflowRequest);

    if (response.success) {
      return response.result;
    } else {
      throw response.error || new Error('Model request failed');
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

  // Tool registry cache to avoid rebuilding definitions
  private toolRegistryCache: Map<string, ModelTool> | null = null;
  private toolSelectionCache: Map<string, ModelTool[]> = new Map();
  private readonly maxCacheSize = 50;

  /**
   * Initialize tool registry cache once to avoid rebuilding static definitions
   */
  private initializeToolRegistry(): Map<string, ModelTool> {
    if (this.toolRegistryCache) {
      return this.toolRegistryCache;
    }

    const registry = new Map<string, ModelTool>();

    // Filesystem tools
    registry.set('filesystem_list', {
      type: 'function',
      function: {
        name: 'filesystem_list_directory',
        description: 'List files and directories in a specified path',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'The directory path to list contents for' },
          },
          required: ['path'],
        },
      },
    });

    registry.set('filesystem_read', {
      type: 'function',
      function: {
        name: 'filesystem_read_file',
        description: 'Read the contents of a file from the filesystem',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'The path to the file to read' },
          },
          required: ['file_path'],
        },
      },
    });

    registry.set('filesystem_write', {
      type: 'function',
      function: {
        name: 'filesystem_write_file',
        description: 'Write content to a file on the filesystem',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'The path where to write the file' },
            content: { type: 'string', description: 'The content to write to the file' },
          },
          required: ['file_path', 'content'],
        },
      },
    });

    registry.set('filesystem_stats', {
      type: 'function',
      function: {
        name: 'filesystem_get_stats',
        description: 'Get file or directory statistics (size, modified time, etc.)',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'The path to get statistics for' },
          },
          required: ['file_path'],
        },
      },
    });

    // Git tools
    registry.set('git_status', {
      type: 'function',
      function: {
        name: 'git_status',
        description: 'Check the git repository status',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });

    registry.set('git_add', {
      type: 'function',
      function: {
        name: 'git_add',
        description: 'Stage files for commit',
        parameters: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of file paths to stage',
            },
          },
          required: ['files'],
        },
      },
    });

    registry.set('git_commit', {
      type: 'function',
      function: {
        name: 'git_commit',
        description: 'Commit staged changes with a message',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'The commit message' },
          },
          required: ['message'],
        },
      },
    });

    // Terminal tools
    registry.set('execute_command', {
      type: 'function',
      function: {
        name: 'execute_command',
        description: 'Execute a terminal command safely',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The command to execute' },
            args: {
              type: 'array',
              items: { type: 'string' },
              description: 'Command arguments',
              default: [],
            },
          },
          required: ['command'],
        },
      },
    });

    // Package manager tools
    registry.set('npm_install', {
      type: 'function',
      function: {
        name: 'npm_install',
        description: 'Install an npm package',
        parameters: {
          type: 'object',
          properties: {
            packageName: { type: 'string', description: 'The package name to install' },
            dev: { type: 'boolean', description: 'Install as dev dependency', default: false },
          },
          required: ['packageName'],
        },
      },
    });

    registry.set('npm_run', {
      type: 'function',
      function: {
        name: 'npm_run',
        description: 'Run an npm script',
        parameters: {
          type: 'object',
          properties: {
            scriptName: { type: 'string', description: 'The npm script name to run' },
          },
          required: ['scriptName'],
        },
      },
    });

    // Smithery tools
    registry.set('smithery_status', {
      type: 'function',
      function: {
        name: 'smithery_status',
        description: 'Get Smithery registry status and available tools',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });

    registry.set('smithery_refresh', {
      type: 'function',
      function: {
        name: 'smithery_refresh',
        description: 'Refresh Smithery servers and tools',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    });

    this.toolRegistryCache = registry;
    logger.info(`🔧 Tool registry initialized with ${registry.size} tools`);
    return registry;
  }

  /**
   * Dynamic MCP tool selection with intelligent context analysis and caching
   */
  private async getMCPToolsForModel(userQuery?: string): Promise<ModelTool[]> {
    if (!this.mcpManager) {
      return [];
    }

    try {
      // Initialize tool registry cache
      const registry = this.initializeToolRegistry();

      // If no query, return minimal essential tools
      if (!userQuery) {
        const essentialTools = ['filesystem_list', 'filesystem_read', 'git_status'];
        return essentialTools.map(key => registry.get(key)!).filter(Boolean);
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(userQuery);
      if (this.toolSelectionCache.has(cacheKey)) {
        const cached = this.toolSelectionCache.get(cacheKey)!;
        logger.debug(`🎯 Using cached tool selection: ${cached.length} tools`);
        return cached;
      }

      // Intelligent tool selection based on query analysis
      const selectedToolKeys = this.analyzeQueryForTools(userQuery);
      const selectedTools = selectedToolKeys
        .map(key => registry.get(key))
        .filter(Boolean) as ModelTool[];

      // Cache the result (with LRU eviction)
      if (this.toolSelectionCache.size >= this.maxCacheSize) {
        const firstKey = this.toolSelectionCache.keys().next().value;
        if (firstKey !== undefined) {
          this.toolSelectionCache.delete(firstKey);
        }
      }
      this.toolSelectionCache.set(cacheKey, selectedTools);

      logger.info(
        `🎯 Dynamic tool selection: ${selectedTools.length} tools for "${userQuery.substring(0, 50)}..." (from ${registry.size} available)`
      );
      return selectedTools;
    } catch (error) {
      logger.warn('Failed to get MCP tools for model:', error);
      // Return essential tools as fallback
      const registry = this.initializeToolRegistry();
      return ['filesystem_list', 'filesystem_read'].map(key => registry.get(key)!).filter(Boolean);
    }
  }

  /**
   * Analyze user query to determine which tools are needed
   */
  private analyzeQueryForTools(query: string): string[] {
    const normalizedQuery = query.toLowerCase();
    const selectedTools = new Set<string>();

    // Always include basic filesystem operations for most queries
    selectedTools.add('filesystem_list');
    selectedTools.add('filesystem_read');

    // Query intent patterns
    const patterns = [
      // Filesystem operations
      {
        pattern: /\b(write|create|save|edit|modify|update)\b.*\bfile/i,
        tools: ['filesystem_write'],
      },
      { pattern: /\b(stat|size|info|details|properties)\b/i, tools: ['filesystem_stats'] },
      { pattern: /\b(show|display|cat|view|open)\b.*\bfile/i, tools: ['filesystem_read'] },

      // Git operations
      { pattern: /\bgit\s+(status|st)\b/i, tools: ['git_status'] },
      { pattern: /\bgit\s+(add|stage)\b/i, tools: ['git_add'] },
      { pattern: /\bgit\s+(commit|ci)\b/i, tools: ['git_commit'] },
      { pattern: /\b(commit|stage|git)\b/i, tools: ['git_status', 'git_add', 'git_commit'] },

      // Terminal operations
      { pattern: /\b(run|execute|command|terminal|shell|bash)\b/i, tools: ['execute_command'] },
      { pattern: /\b(npm|yarn|node|build|test|start)\b/i, tools: ['execute_command', 'npm_run'] },
      { pattern: /\binstall\b.*\bpackage/i, tools: ['npm_install'] },

      // Smithery/MCP operations
      {
        pattern: /\b(smithery|mcp|registry|server)\b/i,
        tools: ['smithery_status', 'smithery_refresh'],
      },
    ];

    // Apply patterns
    for (const { pattern, tools } of patterns) {
      if (pattern.test(normalizedQuery)) {
        tools.forEach(tool => selectedTools.add(tool));
      }
    }

    // Context-based tool additions
    if (normalizedQuery.includes('analyze') || normalizedQuery.includes('check')) {
      selectedTools.add('filesystem_stats');
      selectedTools.add('git_status');
    }

    if (normalizedQuery.includes('fix') || normalizedQuery.includes('debug')) {
      selectedTools.add('filesystem_write');
      selectedTools.add('execute_command');
    }

    return Array.from(selectedTools);
  }

  /**
   * Generate cache key for tool selection
   */
  private generateCacheKey(query: string): string {
    // Create a normalized cache key based on query intent
    const normalized = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Use first 100 chars for cache key to balance specificity and reuse
    return normalized.substring(0, 100);
  }

  private async handlePromptRequest(request: WorkflowRequest): Promise<any> {
    const { payload } = request;

    if (this.modelClient) {
      // Get MCP tools for AI model with smart selection
      const mcpTools = await this.getMCPToolsForModel(payload.input || payload.prompt);

      const modelRequest: ModelRequest = {
        id: request.id,
        prompt: payload.input || payload.prompt,
        model: payload.options?.model,
        temperature: payload.options?.temperature,
        maxTokens: payload.options?.maxTokens,
        stream: payload.options?.stream || false,
        tools: mcpTools, // KEY FIX: Include MCP tools for AI model
        context: request.context,
        // CRITICAL FIX: Always include num_ctx to override Ollama's 4096 default
        num_ctx: parseInt(process.env.OLLAMA_NUM_CTX || '131072'),
        options: payload.options,
      };

      const response = await this.modelClient.request(modelRequest);

      // Handle any tool calls from the AI model
      if (response.toolCalls && response.toolCalls.length > 0) {
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

          // Create structured follow-up request
          const followUpRequest: ModelRequest = {
            id: `${request.id}-structured-followup`,
            prompt: `User request: ${payload.input || payload.prompt}\n\nTool execution results are provided in the conversation history. Please provide a comprehensive response based on these results.`,
            model: modelRequest.model,
            temperature: modelRequest.temperature,
            maxTokens: modelRequest.maxTokens,
            tools: mcpTools,
            messages: structuredMessages,
            context: request.context,
          };

          const finalResponse = await this.modelClient.request(followUpRequest);
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

    if (this.modelClient) {
      return await this.modelClient.request(payload);
    } else {
      throw new Error('Model client not available');
    }
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

    const modelRequest: ModelRequest = {
      id: request.id,
      prompt: analysisPrompt,
      model: payload.options?.model,
      temperature: payload.options?.temperature || 0.3, // Lower temperature for analysis
      maxTokens: payload.options?.maxTokens || 32768, // Increased from 2000 for comprehensive responses
      tools: mcpTools, // Include MCP tools for analysis too
      context: request.context,
    };

    const result = await this.modelClient.request(modelRequest);

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

        const finalAnalysis = await this.modelClient.request(followUpRequest);
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
