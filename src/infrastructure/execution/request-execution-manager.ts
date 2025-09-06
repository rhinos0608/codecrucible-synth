/**
 * Request Execution Manager - Extracted from UnifiedModelClient
 * Manages request processing, execution strategies, and fallback logic following Living Spiral methodology
 *
 * Council Perspectives Applied:
 * - Performance Engineer: Optimized execution strategies and timeout handling
 * - Maintainer: Reliable request processing and error recovery
 * - Security Guardian: Safe request validation and execution sandboxing
 * - Explorer: Flexible execution modes and strategy adaptation
 * - Architect: Clean separation between strategy, execution, and coordination
 */

import { EventEmitter } from 'events';
import { logger } from '../logging/logger.js';
import { getErrorMessage, toError } from '../../utils/error-utils.js';
import { ModelRequest, ModelResponse } from '../../domain/interfaces/model-client.js';
import { ProjectContext, ComplexityAnalysis, TaskType } from '../../domain/types/unified-types.js';
import {
  ActiveProcess,
  ActiveProcessManager,
} from '../../infrastructure/performance/active-process-manager.js';
import {
  EnhancedToolIntegration,
  getGlobalEnhancedToolIntegration,
} from '../../infrastructure/tools/enhanced-tool-integration.js';
import { getGlobalToolIntegration } from '../../infrastructure/tools/tool-integration.js';
import { requestBatcher } from '../performance/intelligent-request-batcher.js';
import { adaptiveTuner } from '../performance/adaptive-performance-tuner.js';
import { requestTimeoutOptimizer } from '../performance/request-timeout-optimizer.js';
import { RustExecutionBackend } from './rust-executor/index.js';
import { contextualToolFilter, ToolFilterContext } from '../tools/contextual-tool-filter.js';

// Import the extracted GlobalEvidenceCollector from dedicated module
import { GlobalEvidenceCollector } from '../evidence/global-evidence-collector.js';
import { unifiedResultFormatter } from '../formatting/unified-result-formatter.js';

export type ExecutionMode = 'fast' | 'quality' | 'balanced';
export type ProviderType = 'ollama' | 'lm-studio' | 'huggingface' | 'auto';

export interface ExecutionStrategy {
  mode: ExecutionMode;
  provider: ProviderType;
  timeout: number;
  complexity: string;
}

export interface RequestMetrics {
  provider: ProviderType;
  model: string;
  startTime: number;
  endTime?: number;
  success: boolean;
  tokenCount?: number;
  error?: string;
}

export interface ExecutionConfig {
  maxConcurrentRequests: number;
  defaultTimeout: number;
  complexityTimeouts: {
    simple: number;
    medium: number;
    complex: number;
  };
  memoryThresholds: {
    low: number;
    medium: number;
    high: number;
  };
}

export interface IRequestExecutionManager {
  processRequest(request: ModelRequest, context?: ProjectContext): Promise<ModelResponse>;
  executeWithFallback(
    requestId: string,
    request: ModelRequest,
    context: ProjectContext | undefined,
    strategy: ExecutionStrategy,
    abortSignal?: AbortSignal
  ): Promise<ModelResponse>;
  determineExecutionStrategy(request: ModelRequest, context?: ProjectContext): ExecutionStrategy;
  getActiveRequests(): Map<string, RequestMetrics>;
}

export class RequestExecutionManager extends EventEmitter implements IRequestExecutionManager {
  private config: ExecutionConfig;
  private activeRequests = new Map<string, RequestMetrics>();
  private requestQueue: Array<{
    request: ModelRequest;
    context?: ProjectContext;
    resolve: (value: ModelResponse) => void;
    reject: (reason?: any) => void;
  }> = [];
  private processManager: ActiveProcessManager;
  private providerRepository: any;
  private rustBackend: RustExecutionBackend | null;
  private isShuttingDown = false;
  private queueProcessor: NodeJS.Timeout | null = null;

  constructor(
    config: ExecutionConfig,
    processManager: ActiveProcessManager,
    providerRepository: any,
    rustBackend?: RustExecutionBackend | null
  ) {
    super();
    this.config = config;
    this.processManager = processManager;
    this.providerRepository = providerRepository;
    // Domain orchestrator removed - AI now intelligently selects tools
    this.rustBackend = rustBackend ?? null;

    // If no injected backend, lazily create one
    if (!this.rustBackend) {
      // Initialize Rust backend asynchronously
      this.initializeRustBackend().catch((e) => {
        logger.warn('RequestExecutionManager: Failed to initialize Rust backend', e);
      });
    } else {
      // If an injected backend exists, we may optionally initialize/verify it
      try {
        if (typeof (this.rustBackend as any).initialize === 'function') {
          // Fire-and-forget initialization
          (this.rustBackend as any)
            .initialize()
            .catch((err: any) => logger.warn('Injected rustBackend failed to initialize', err));
        }
      } catch (err) {
        logger.warn('Error while initializing injected rustBackend', err);
      }
    }

    // Start event-driven queue processor instead of infinite loop
    this.scheduleQueueProcessor();

    // Handle shutdown gracefully
    process.once('SIGTERM', async () => this.shutdown());
    process.once('SIGINT', async () => this.shutdown());
  }

  private async initializeRustBackend(): Promise<void> {
    // If rustBackend doesn't exist, try to load it dynamically
    if (!this.rustBackend) {
      try {
        // Use dynamic import for ESM compatibility
        const rustModule = await import('./rust-executor/index.js');
        const { RustExecutionBackend } = rustModule;
        
        this.rustBackend = new RustExecutionBackend({
          enableProfiling: true,
          maxConcurrency: 4,
          timeoutMs: this.config.defaultTimeout,
          logLevel: 'info',
        });
        
        logger.info('RequestExecutionManager: Rust backend loaded dynamically');
      } catch (e) {
        logger.warn('RequestExecutionManager: Rust backend not available', e);
        return;
      }
    }

    try {
      const initialized = await this.rustBackend.initialize();
      if (initialized === true) {
        logger.info('🚀 RequestExecutionManager: Rust backend initialized', {
          available: this.rustBackend.isAvailable(),
          strategy: this.rustBackend.getStrategy(),
        });
      } else {
        logger.warn(
          '⚠️ RequestExecutionManager: Rust backend module not found, using TypeScript fallback'
        );
      }
    } catch (error) {
      logger.error('❌ RequestExecutionManager: Rust backend initialization failed', error);
    }
  }

  /**
   * Main request processing method
   */
  async processRequest(request: ModelRequest, context?: ProjectContext): Promise<ModelResponse> {
    const requestId = this.generateRequestId();
    const strategy = this.determineExecutionStrategy(request, context);
    const startTime = Date.now();

    logger.info(
      `🚀 Processing request ${requestId} with ${strategy.mode} mode via ${strategy.provider}`
    );

    // Check if request is eligible for batching (non-streaming, non-tool requests)
    const isBatchEligible =
      !request.stream && (!request.tools || request.tools.length === 0) && strategy.mode !== 'fast'; // Fast mode bypasses batching

    if (isBatchEligible) {
      logger.debug(`Request ${requestId} eligible for batching`);
      try {
        // Use intelligent batching for similar requests
        const batchResult = await requestBatcher.batchRequest(
          request.prompt,
          strategy.provider,
          strategy.provider,
          {
            temperature: request.temperature,
            maxTokens: request.maxTokens,
            mode: strategy.mode,
            priority: this.getRequestPriority(request),
            tools: request.tools,
          }
        );

        // Record performance metrics for adaptive tuning
        const responseTime = Date.now() - startTime;
        const errorRate = 0; // Successful batch response
        adaptiveTuner.recordMetrics(responseTime, 1, errorRate);

        logger.info(`✅ Request ${requestId} completed via batching in ${responseTime}ms`);

        return {
          id: `batch_${requestId}_${Date.now()}`,
          content: batchResult.content,
          model: strategy.provider,
          provider: strategy.provider,
          metadata: {
            tokens: batchResult.usage?.totalTokens || 0,
            latency: responseTime,
            selectedProvider: strategy.provider,
            fromBatch: true,
          },
        };
      } catch (error) {
        logger.warn(
          `Batching failed for ${requestId}, falling back to individual processing:`,
          error
        );
        // Fall through to normal processing
      }
    }

    // Register process with process manager
    const processType = this.getProcessType(request);
    const priority = this.getRequestPriority(request);
    const memoryUsage = this.estimateMemoryUsage(request);

    const activeProcess = this.processManager.registerProcess({
      type: processType,
      modelName: strategy.provider,
      estimatedMemoryUsage: memoryUsage,
      promise: Promise.resolve(),
      priority,
    });

    try {
      const response = await this.executeWithFallback(requestId, request, context, strategy);

      // Mark process as completed
      this.processManager.unregisterProcess(activeProcess.id);

      // Record performance metrics for adaptive tuning
      const responseTime = Date.now() - startTime;
      const throughput = 1; // 1 request completed
      const errorRate = 0; // Successful response
      adaptiveTuner.recordMetrics(responseTime, throughput, errorRate);

      logger.info(`✅ Request ${requestId} completed successfully in ${responseTime}ms`);
      return response;
    } catch (error: unknown) {
      // Mark process as failed
      this.processManager.unregisterProcess(activeProcess.id);

      // Record failed request metrics
      const responseTime = Date.now() - startTime;
      const throughput = 0; // Failed request
      const errorRate = 1; // 100% error rate for this request
      adaptiveTuner.recordMetrics(responseTime, throughput, errorRate);

      logger.error(
        `❌ Request ${requestId} failed after ${responseTime}ms:`,
        getErrorMessage(error)
      );
      throw toError(error);
    }
  }

  /**
   * Execute request with fallback chain
   */
  async executeWithFallback(
    requestId: string,
    request: ModelRequest,
    context: ProjectContext | undefined,
    strategy: ExecutionStrategy,
    abortSignal?: AbortSignal
  ): Promise<ModelResponse> {
    const fallbackChain =
      strategy.provider === 'auto'
        ? ['ollama', 'lm-studio', 'huggingface'] // Default fallback chain
        : [strategy.provider, 'ollama', 'lm-studio', 'huggingface'].filter(
            (p, i, arr) => arr.indexOf(p) === i
          );

    let lastError: Error | null = null;

    for (const providerType of fallbackChain) {
      const provider = this.providerRepository.getProvider(providerType);
      if (!provider) {
        logger.warn(`Provider ${providerType} not available, skipping`);
        continue;
      }

      try {
        const metrics: RequestMetrics = {
          provider: providerType as ProviderType,
          model: provider.getModelName?.() || 'unknown',
          startTime: Date.now(),
          success: false,
        };

        this.activeRequests.set(requestId, metrics);
        this.emit('requestStart', { requestId, provider: providerType });

        logger.info(`🚀 Attempting request with ${providerType}`);

        // Add tool integration before calling provider
        const enhancedToolIntegration = getGlobalEnhancedToolIntegration();
        const toolIntegration = enhancedToolIntegration || getGlobalToolIntegration();

        // DEBUG: Log which tool integration is being used
        logger.info('🔥 REQUEST-EXECUTION-MANAGER: Tool integration selection', {
          hasEnhanced: !!enhancedToolIntegration,
          hasBase: !!getGlobalToolIntegration(),
          usingEnhanced: toolIntegration === enhancedToolIntegration,
          toolIntegrationType: toolIntegration?.constructor?.name,
        });
        const supportsTools = this.modelSupportsTools(
          providerType as ProviderType,
          provider.getModelName?.()
        );

        // CONTEXTUAL TOOL FILTERING: Smart filtering based on request analysis
        let tools: any[] = [];
        let domainInfo = '';
        let filterReasoning = '';

        if (toolIntegration) {
          const allTools = await toolIntegration.getLLMFunctions();

          // Build context for tool filtering
          const filterContext: ToolFilterContext = {
            prompt: request.prompt || '',
            userId: (request.context as any)?.userId,
            sessionId: (request as any).sessionId || (request.context as any)?.sessionId,
            riskLevel: this.inferRiskLevel(request),
            previousTools: (request.context as any)?.previousTools || [],
            fileContext: {
              workingDirectory: request.context?.workingDirectory || process.cwd(),
              recentFiles: (request.context as any)?.recentFiles || [],
              projectType: this.inferProjectType(request),
            },
          };

          // Apply contextual filtering to reduce prompt bloat and security risks
          const filterResult = contextualToolFilter.filterTools(allTools, filterContext);
          tools = filterResult.tools;
          domainInfo = `contextual-${filterResult.categories.join('-')}`;
          filterReasoning = filterResult.reasoning;

          logger.info('🎯 REQUEST-EXECUTION-MANAGER: Contextual tool filtering applied', {
            prompt: `${request.prompt?.substring(0, 80)}...`,
            originalToolCount: allTools.length,
            filteredToolCount: tools.length,
            categories: filterResult.categories,
            confidence: filterResult.confidence.toFixed(2),
            reasoning: filterReasoning,
            approach: 'contextual-intelligent-filtering',
          });
        }

        // ENHANCED DEBUG: Show contextual tool filtering status
        logger.info('🔧 ENHANCED TOOL DEBUG: Contextual tool filtering status', {
          provider: providerType,
          model: provider.getModelName?.() || 'unknown',
          supportsTools,
          hasEnhanced: !!enhancedToolIntegration,
          hasBasic: !!getGlobalToolIntegration(),
          hasIntegration: !!toolIntegration,
          filteredToolCount: tools.length,
          approach: 'contextual-intelligent-filtering',
          domainInfo,
        });

        if (tools.length > 0) {
          logger.info('✅ CONTEXTUALLY FILTERED TOOLS provided for AI selection', {
            toolNames: tools.map(t => t.function?.name || t.name),
            approach: 'contextual-filtering',
            toolCount: tools.length,
            reasoning: filterReasoning,
          });
        } else {
          logger.warn('⚠️ NO TOOLS AVAILABLE after contextual filtering', {
            integrationStatus: 'failed-after-filtering',
          });
        }

        // Add tools to request before calling provider
        const requestWithTools = {
          ...request,
          tools: tools,
        };

        // Create optimized timeout for this request
        const requestType = request.stream
          ? 'streaming'
          : request.tools && request.tools.length > 0
            ? 'tool_execution'
            : 'regular';

        const { abortController, timeout: optimizedTimeout } =
          requestTimeoutOptimizer.createOptimizedTimeout(
            requestId,
            requestType,
            providerType === 'fast' ? 'low' : providerType === 'quality' ? 'high' : 'medium'
          );

        // Add abort signal to request
        const requestWithAbort = {
          ...requestWithTools,
          abortSignal: abortController.signal,
        };

        // Route to streaming or regular processing based on request.stream flag
        let response;
        if (request.stream && request.onStreamingToken) {
          // For streaming requests, check if provider has streamRequest method
          const modelClient = provider as any;
          if (modelClient.streamRequest && typeof modelClient.streamRequest === 'function') {
            response = await Promise.race([
              modelClient.streamRequest(requestWithAbort, request.onStreamingToken, context),
              this.createOptimizedTimeoutPromise(optimizedTimeout, abortController),
            ]);
          } else {
            // Fallback to regular processing if provider doesn't support streaming
            logger.warn('Provider does not support streaming, falling back to regular processing');
            response = await Promise.race([
              provider.processRequest(requestWithAbort, context),
              this.createOptimizedTimeoutPromise(optimizedTimeout, abortController),
            ]);
          }
        } else {
          response = await Promise.race([
            provider.processRequest(requestWithAbort, context),
            this.createOptimizedTimeoutPromise(optimizedTimeout, abortController),
          ]);
        }

        // Mark request as completed successfully
        requestTimeoutOptimizer.completeRequest(requestId);

        // Check if response contains tool calls that need to be executed
        logger.debug('RequestExecutionManager: Checking response for tool calls', {
          responseKeys: Object.keys(response),
          hasToolCalls: !!response.toolCalls,
          toolCallsLength: response.toolCalls?.length
        });
        
        if (response.toolCalls && response.toolCalls.length > 0) {
          logger.debug('RequestExecutionManager: Entering tool execution path', {
            toolCallCount: response.toolCalls.length
          });
          logger.debug('Tool execution: Found tool calls in request execution', {
            count: response.toolCalls.length,
          });

          if (toolIntegration) {
            try {
              const toolResults = [];
              const toolExecutionStartTime = Date.now(); // Track tool execution timing

              // Execute each tool call
              for (const toolCall of response.toolCalls) {
                logger.debug('Executing tool in request execution', {
                  toolName: toolCall.name || toolCall.function?.name,
                });

                // Convert to expected format if needed
                const formattedToolCall = {
                  function: {
                    name: toolCall.name || toolCall.function?.name,
                    arguments: JSON.stringify(
                      toolCall.arguments || toolCall.function?.arguments || {}
                    ),
                  },
                };

                logger.info(
                  `🔥 REQUEST-EXECUTION-MANAGER: About to call executeToolCall for ${formattedToolCall.function.name}`
                );
                logger.info(
                  `🔥 REQUEST-EXECUTION-MANAGER: toolIntegration type: ${toolIntegration?.constructor?.name}`
                );
                const result = await toolIntegration.executeToolCall(formattedToolCall);
                logger.debug('Tool execution result in request execution', { result });
                toolResults.push(result);

                // CRITICAL FIX: Bridge tool results to evidence collection system
                const globalCollector = GlobalEvidenceCollector.getInstance();
                globalCollector.addToolResult(result);
              }

              // If we have tool results, format them using centralized formatter
              if (toolResults.length > 0) {
                const formattedResults = unifiedResultFormatter.formatMultipleToolResults(
                  toolResults, 
                  response.toolCalls, 
                  {
                    includeMetadata: true,
                    preferMarkdown: true,
                    highlightErrors: true
                  }
                );
                
                response.content = formattedResults.content;
                
                // Calculate aggregated metadata from tool executions
                const toolExecutionTime = Date.now() - toolExecutionStartTime;
                const totalTokens = this.calculateTotalTokens(toolResults);
                const toolWarnings = formattedResults.toolResults
                  .filter(tr => tr.metadata?.warnings?.length)
                  .flatMap(tr => tr.metadata?.warnings || []);
                
                // Set comprehensive metadata from actual tool execution
                response.metadata = {
                  tokens: totalTokens,
                  latency: toolExecutionTime,
                  toolExecutionStats: {
                    toolCount: formattedResults.summary.totalTools,
                    successCount: formattedResults.summary.successCount,
                    errorCount: formattedResults.summary.errorCount,
                    totalExecutionTime: toolExecutionTime,
                    averageExecutionTime: Math.round(toolExecutionTime / formattedResults.summary.totalTools)
                  },
                  toolWarnings: toolWarnings.length > 0 ? toolWarnings : undefined,
                  executedTools: formattedResults.toolResults.map(tr => tr.toolName),
                  ...response.metadata // Preserve any existing metadata
                };
                
                // Log details for all tool executions with rich metadata
                logger.info(
                  '🔧 TOOL EXECUTION: Tools successfully executed in request execution',
                  {
                    toolCount: toolResults.length,
                    totalTokens,
                    executionTime: toolExecutionTime,
                    summary: formattedResults.summary,
                    toolResults: formattedResults.toolResults.map(tr => ({
                      toolName: tr.toolName,
                      success: tr.success,
                      hasWarnings: !!tr.metadata?.warnings?.length
                    }))
                  }
                );
              }
            } catch (error) {
              logger.error('Error during tool execution in request execution', {
                error: getErrorMessage(error),
              });
              response.content = `Error executing tools: ${getErrorMessage(error)}`;
            }
          } else {
            logger.warn('Tool integration not available for tool execution in request execution');
          }
        }

        metrics.endTime = Date.now();
        metrics.success = true;
        metrics.tokenCount = response.usage?.totalTokens;

        this.activeRequests.delete(requestId);
        this.emit('requestSuccess', {
          requestId,
          provider: providerType,
          duration: metrics.endTime - metrics.startTime,
        });

        logger.info(
          `✅ Request ${requestId} succeeded with ${providerType} in ${metrics.endTime - metrics.startTime}ms`
        );
        return response;
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        lastError = toError(error);

        const metrics = this.activeRequests.get(requestId);
        if (metrics) {
          metrics.endTime = Date.now();
          metrics.error = errorMessage;
        }

        // Request failed - timeout optimizer handles cleanup automatically

        logger.warn(`❌ ${providerType} failed for request ${requestId}: ${errorMessage}`);
        this.emit('requestError', { requestId, provider: providerType, error: errorMessage });

        // Continue to next provider in fallback chain
      }
    }

    // All providers failed
    this.activeRequests.delete(requestId);
    const error = lastError || new Error('All providers in fallback chain failed');
    throw error;
  }

  /**
   * Determine execution strategy based on request characteristics
   */
  determineExecutionStrategy(request: ModelRequest, context?: ProjectContext): ExecutionStrategy {
    const prompt = request.prompt || '';
    const complexity = this.assessComplexityFast(prompt);

    // Default strategy
    const strategy: ExecutionStrategy = {
      mode: 'balanced',
      provider: 'auto',
      timeout: this.config.complexityTimeouts.medium,
      complexity,
    };

    // Adjust based on request characteristics
    if (request.stream) {
      strategy.mode = 'fast';
      strategy.timeout = this.config.complexityTimeouts.simple;
    }

    if (request.tools && request.tools.length > 0) {
      strategy.provider = 'lm-studio'; // Prefer LM Studio for tool use
      strategy.timeout = this.config.complexityTimeouts.complex;
    }

    // Adjust timeout based on complexity
    switch (complexity) {
      case 'simple':
        strategy.timeout = this.config.complexityTimeouts.simple;
        if (strategy.mode === 'balanced') strategy.mode = 'fast';
        break;
      case 'complex':
        strategy.timeout = this.config.complexityTimeouts.complex;
        if (strategy.mode === 'fast') strategy.mode = 'balanced';
        break;
      default:
        strategy.timeout = this.config.complexityTimeouts.medium;
    }

    // Consider context if available (could be enhanced with more context analysis)
    if (context?.files && context.files.length > 10) {
      // Large project context might need more time
      strategy.timeout = Math.max(strategy.timeout, this.config.complexityTimeouts.complex);
    }

    logger.debug('Execution strategy determined:', strategy);
    return strategy;
  }

  /**
   * Get currently active requests
   */
  getActiveRequests(): Map<string, RequestMetrics> {
    return new Map(this.activeRequests);
  }

  /**
   * Assess request complexity quickly
   */
  private assessComplexityFast(prompt: string): 'simple' | 'medium' | 'complex' {
    const length = prompt.length;
    const complexKeywords = [
      'analyze',
      'architecture',
      'security',
      'performance',
      'optimize',
      'refactor',
    ];
    const hasComplexKeywords = complexKeywords.some(keyword =>
      prompt.toLowerCase().includes(keyword)
    );

    if (length < 100 && !hasComplexKeywords) return 'simple';
    if (length > 500 || hasComplexKeywords) return 'complex';
    return 'medium';
  }

  /**
   * Estimate memory usage for request
   */
  private estimateMemoryUsage(request: ModelRequest): number {
    const baseUsage = 50; // MB base usage
    const promptSize = (request.prompt?.length || 0) * 0.001; // Rough estimate
    const contextSize = request.context ? Object.keys(request.context).length * 5 : 0;

    return Math.round(baseUsage + promptSize + contextSize);
  }

  /**
   * Determine process type for process manager
   */
  private getProcessType(
    request: ModelRequest
  ): 'model_inference' | 'analysis' | 'generation' | 'streaming' {
    if (request.stream) return 'streaming';
    if (request.tools && request.tools.length > 0) return 'generation';
    return 'model_inference';
  }

  /**
   * Get request priority
   */
  private getRequestPriority(request: ModelRequest): ActiveProcess['priority'] {
    if (request.stream) return 'high'; // Streaming requests need responsiveness
    if (request.tools && request.tools.length > 0) return 'medium'; // Tool use is important
    return 'low'; // Regular inference
  }

  /**
   * Create timeout promise for race conditions
   */
  private async createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Create optimized timeout promise with abort controller
   */
  private async createOptimizedTimeoutPromise(
    timeoutMs: number,
    abortController: AbortController
  ): Promise<never> {
    return new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        abortController.abort();
        reject(new Error(`Request timed out after optimized ${timeoutMs}ms`));
      }, timeoutMs);

      // Clear timeout if request is aborted externally
      abortController.signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new Error('Request aborted'));
      });
    });
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Schedule queue processor (event-driven, not infinite loop)
   */
  private scheduleQueueProcessor(): void {
    if (this.isShuttingDown || this.queueProcessor) {
      return;
    }

    this.queueProcessor = setTimeout(() => {
      this.queueProcessor = null;
      this.processQueueBatch();
    }, 50); // Reduced from 100ms for better responsiveness
  }

  /**
   * Process queue batch efficiently
   */
  private async processQueueBatch(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    // Process multiple items in parallel if capacity allows
    const availableSlots = this.config.maxConcurrentRequests - this.activeRequests.size;
    const batchSize = Math.min(availableSlots, this.requestQueue.length, 3); // Max 3 concurrent

    if (batchSize <= 0) {
      // No capacity, reschedule
      this.scheduleQueueProcessor();
      return;
    }

    const batch = this.requestQueue.splice(0, batchSize);

    // Process batch items concurrently
    const batchPromises = batch.map(async queueItem => {
      try {
        const response = await this.processRequest(queueItem.request, queueItem.context);
        queueItem.resolve(response);
      } catch (error) {
        queueItem.reject(error);
      }
    });

    // Process batch without blocking
    Promise.allSettled(batchPromises);

    // Reschedule if there are more items to process
    if (this.requestQueue.length > 0) {
      this.scheduleQueueProcessor();
    }
  }

  /**
   * Queue request if at capacity
   */
  async queueRequest(request: ModelRequest, context?: ProjectContext): Promise<ModelResponse> {
    if (this.activeRequests.size < this.config.maxConcurrentRequests) {
      return this.processRequest(request, context);
    }

    return new Promise<ModelResponse>((resolve, reject) => {
      this.requestQueue.push({
        request,
        context,
        resolve: resolve as (value: ModelResponse) => void,
        reject: reject as (reason?: any) => void,
      });
      logger.info('Request queued due to capacity limit');

      // Trigger queue processor
      this.scheduleQueueProcessor();
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('🔄 Shutting down RequestExecutionManager...');
    this.isShuttingDown = true;

    // Clear scheduled queue processor
    if (this.queueProcessor) {
      clearTimeout(this.queueProcessor);
      this.queueProcessor = null;
    }

    // Reject any pending requests
    while (this.requestQueue.length > 0) {
      const queueItem = this.requestQueue.shift();
      if (queueItem) {
        queueItem.reject(new Error('System shutting down'));
      }
    }

    // Wait for active requests to complete (with timeout)
    const shutdownTimeout = 10000; // 10 seconds
    const startTime = Date.now();

    while (this.activeRequests.size > 0 && Date.now() - startTime < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.activeRequests.size > 0) {
      logger.warn(`${this.activeRequests.size} requests still active during shutdown`);
    }

    logger.info('✅ RequestExecutionManager shutdown complete');
  }

  /**
   * Check if provider/model combination supports tools
   */
  private modelSupportsTools(provider: ProviderType, model?: string): boolean {
    if (provider === 'lm-studio') {
      return true; // LM Studio generally supports OpenAI-compatible function calling
    }

    if (provider === 'ollama') {
      // If no specific model provided, assume auto-selection will pick a supported model
      if (!model) {
        logger.debug(
          'No specific model provided, assuming auto-selection will pick supported model'
        );
        return true; // Trust that auto-selection picks qwen2.5-coder which supports tools
      }

      // Only certain Ollama models support function calling
      const model_name = model.toLowerCase();
      const supportedModels = [
        'llama3',
        'llama3.1',
        'llama3.2',
        'qwen2.5',
        'qwq',
        'mistral',
        'codellama',
      ];

      const isSupported = supportedModels.some(supportedModel =>
        model_name.includes(supportedModel)
      );
      logger.debug('Model tool support check', { model: model_name, isSupported });
      return isSupported;
    }

    return false; // Conservative default - no tools for unknown providers
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): any {
    return {
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.length,
      maxConcurrent: this.config.maxConcurrentRequests,
      rustBackendAvailable: this.rustBackend?.isAvailable() ?? false,
      rustBackendStats: this.rustBackend?.getPerformanceStats() ?? null,
      config: this.config,
    };
  }

  /**
   * Get the Rust execution backend instance
   */
  getRustBackend(): RustExecutionBackend {
    if (!this.rustBackend) {
      throw new Error('Rust execution backend is not available');
    }
    return this.rustBackend;
  }

  /**
   * Infer risk level from request content and context
   */
  private inferRiskLevel(request: ModelRequest): 'low' | 'medium' | 'high' {
    const prompt = (request.prompt || '').toLowerCase();
    
    // High risk indicators
    const highRiskKeywords = [
      'delete', 'remove', 'rm ', 'uninstall', 'format', 'wipe', 'destroy',
      'sudo', 'admin', 'root', 'chmod', 'chown', 'passwd', 'su ',
      'exec', 'eval', 'shell', 'cmd', 'powershell', 'bash',
      'curl', 'wget', 'download', 'install', 'git push', 'commit'
    ];
    
    // Medium risk indicators
    const mediumRiskKeywords = [
      'write', 'create', 'modify', 'edit', 'change', 'update',
      'move', 'copy', 'rename', 'mkdir', 'touch',
      'config', 'settings', 'environment', 'variables'
    ];

    if (highRiskKeywords.some(keyword => prompt.includes(keyword))) {
      return 'high';
    }
    
    if (mediumRiskKeywords.some(keyword => prompt.includes(keyword))) {
      return 'medium';
    }
    
    // Check for file paths that might indicate system areas
    if (prompt.includes('/etc/') || prompt.includes('/sys/') || prompt.includes('c:\\windows\\')) {
      return 'high';
    }
    
    return 'low';
  }

  /**
   * Infer project type from request content and context
   */
  private inferProjectType(request: ModelRequest): string {
    const prompt = (request.prompt || '').toLowerCase();
    const context = request.context;
    
    // Check working directory for clues
    if (context?.workingDirectory) {
      const workDir = context.workingDirectory.toLowerCase();
      if (workDir.includes('node_modules') || workDir.includes('package.json')) {
        return 'javascript';
      }
      if (workDir.includes('.git')) {
        return 'git-project';
      }
    }
    
    // Check for file extensions and patterns in prompt
    const typeIndicators = [
      { pattern: /\.(js|jsx|ts|tsx|json|package\.json)/, type: 'javascript' },
      { pattern: /\.(py|python|requirements\.txt|setup\.py)/, type: 'python' },
      { pattern: /\.(java|class|jar|maven|gradle)/, type: 'java' },
      { pattern: /\.(rs|cargo\.toml|cargo\.lock)/, type: 'rust' },
      { pattern: /\.(go|mod|sum)/, type: 'go' },
      { pattern: /\.(php|composer\.json)/, type: 'php' },
      { pattern: /\.(rb|gemfile|rakefile)/, type: 'ruby' },
      { pattern: /\.(cpp|c|h|cmake|makefile)/, type: 'cpp' },
      { pattern: /\.(html|css|scss|sass|vue|react)/, type: 'web' },
      { pattern: /\.(md|readme|doc|docs)/, type: 'documentation' },
    ];

    for (const indicator of typeIndicators) {
      if (indicator.pattern.test(prompt)) {
        return indicator.type;
      }
    }

    // Check for technology keywords
    if (prompt.includes('react') || prompt.includes('vue') || prompt.includes('angular')) {
      return 'web-framework';
    }
    
    if (prompt.includes('docker') || prompt.includes('kubernetes') || prompt.includes('container')) {
      return 'devops';
    }

    if (prompt.includes('database') || prompt.includes('sql') || prompt.includes('mongodb')) {
      return 'database';
    }

    return 'general';
  }

  /**
   * Calculate total tokens from tool execution results
   */
  private calculateTotalTokens(toolResults: any[]): number {
    let totalTokens = 0;

    for (const result of toolResults) {
      try {
        // Check for token count in various possible locations
        if (result && typeof result === 'object') {
          // Common token fields from different providers
          const tokenSources = [
            result.tokens,
            result.metadata?.tokens,
            result.usage?.totalTokens,
            result.usage?.total_tokens,
            result.tokenCount,
            result.token_count
          ];

          for (const tokenSource of tokenSources) {
            if (typeof tokenSource === 'number' && tokenSource > 0) {
              totalTokens += tokenSource;
              break; // Use first valid token count found
            }
          }

          // If no token count found, estimate based on content length
          if (!tokenSources.some(s => typeof s === 'number' && s > 0)) {
            const content = this.extractContentForTokenEstimation(result);
            if (content) {
              // Rough estimation: ~4 characters per token
              totalTokens += Math.ceil(content.length / 4);
            }
          }
        }
      } catch (error) {
        logger.debug('Error calculating tokens for tool result:', error);
        // Continue processing other results
      }
    }

    return totalTokens;
  }

  /**
   * Extract content from result for token estimation
   */
  private extractContentForTokenEstimation(result: any): string {
    if (typeof result === 'string') {
      return result;
    }

    if (result && typeof result === 'object') {
      // Try common content fields
      const contentFields = [
        result.content,
        result.output,
        result.data,
        result.text,
        result.message
      ];

      for (const field of contentFields) {
        if (typeof field === 'string') {
          return field;
        }
      }

      // Try JSON stringify as fallback
      try {
        return JSON.stringify(result);
      } catch {
        return '';
      }
    }

    return String(result || '');
  }

}
