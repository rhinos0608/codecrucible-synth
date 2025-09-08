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
import { toErrorOrUndefined, toReadonlyRecord } from '../../utils/type-guards.js';
import { ModelRequest, ModelResponse } from '../../domain/interfaces/model-client.js';
import { ProjectContext, ProviderType } from '../../domain/types/unified-types.js';
import {
  ActiveProcess,
  ActiveProcessManager,
} from '../../infrastructure/performance/active-process-manager.js';
import {
  getGlobalEnhancedToolIntegration,
} from '../../infrastructure/tools/enhanced-tool-integration.js';
import { getGlobalToolIntegration } from '../../infrastructure/tools/tool-integration.js';
import { DomainAwareToolOrchestrator } from '../tools/domain-aware-tool-orchestrator.js';
import { requestBatcher } from '../performance/intelligent-request-batcher.js';
import { adaptiveTuner } from '../performance/adaptive-performance-tuner.js';
import { requestTimeoutOptimizer } from '../performance/request-timeout-optimizer.js';
import { RustExecutionBackend } from './rust-executor/index.js';

// Define a type for tool results to avoid 'any' and unsafe property access
export interface ToolResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

// GlobalEvidenceCollector class for collecting tool results
export class GlobalEvidenceCollector {
  private static instance: GlobalEvidenceCollector | null = null;
  private toolResults: ToolResult[] = [];
  private readonly evidenceCollectors: Set<(toolResult: ToolResult) => void> = new Set();

  public static getInstance(): GlobalEvidenceCollector {
    if (GlobalEvidenceCollector.instance === null) {
      GlobalEvidenceCollector.instance = new GlobalEvidenceCollector();
    }
    return GlobalEvidenceCollector.instance;
  }

  public addToolResult(toolResult: Readonly<ToolResult>): void {
    logger.debug('addToolResult called', { collectors: this.evidenceCollectors.size });
    logger.info('🔥 GLOBAL EVIDENCE COLLECTOR: Tool result captured', {
      hasResult: !!toolResult,
      success: toolResult.success,
      hasOutput: !!toolResult.output,
      collectorCount: this.evidenceCollectors.size,
    });

    this.toolResults.push(toolResult);

    // Notify all registered evidence collectors
    this.evidenceCollectors.forEach(collector => {
      try {
        logger.debug('Calling collector callback');
        collector(toolResult);
      } catch (error) {
        logger.error('Evidence collector callback failed', { error });
        logger.warn('Evidence collector callback failed:', toReadonlyRecord(error));
      }
    });
  }

  public registerEvidenceCollector(callback: (toolResult: Readonly<ToolResult>) => void): void {
    logger.debug('registerEvidenceCollector called');
    this.evidenceCollectors.add(callback);
    logger.info('🔥 GLOBAL EVIDENCE COLLECTOR: Evidence collector registered', {
      totalCollectors: this.evidenceCollectors.size,
    });
  }

  public unregisterEvidenceCollector(callback: (toolResult: Readonly<ToolResult>) => void): void {
    this.evidenceCollectors.delete(callback);
  }

  public getToolResults(): ToolResult[] {
    return [...this.toolResults];
  }

  public clearToolResults(): void {
    this.toolResults = [];
  }
}

// Export the GlobalEvidenceCollector for use by other modules
// (Removed duplicate export to avoid redeclaration error)

export type ExecutionMode = 'fast' | 'quality' | 'balanced';

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

export interface Provider {
  getModelName?: () => string;
  processRequest: (request: Readonly<ModelRequest>, context?: Readonly<ProjectContext>) => Promise<ModelResponse>;
}

export interface IRequestExecutionManager {
  processRequest: (
    request: Readonly<ModelRequest>,
    context?: Readonly<ProjectContext>
  ) => Promise<ModelResponse>;
  executeWithFallback: (
    requestId: string,
    request: Readonly<ModelRequest>,
    context: Readonly<ProjectContext> | undefined,
    strategy: Readonly<ExecutionStrategy>,
    abortSignal?: Readonly<AbortSignal>
  ) => Promise<ModelResponse>;
  determineExecutionStrategy: (
    request: Readonly<ModelRequest>,
    context?: Readonly<ProjectContext>
  ) => ExecutionStrategy;
  getActiveRequests: () => Map<string, RequestMetrics>;
}

export class RequestExecutionManager extends EventEmitter implements IRequestExecutionManager {
  private readonly activeRequests = new Map<string, RequestMetrics>();
  private readonly requestQueue: Array<{
    request: Readonly<ModelRequest>;
    context?: Readonly<ProjectContext>;
    resolve: (value: ModelResponse) => void;
    reject: (reason?: unknown) => void;
  }> = [];
  private readonly domainOrchestrator: DomainAwareToolOrchestrator;
  private isShuttingDown = false;
  private queueProcessor: NodeJS.Timeout | null = null;

  // Add missing property declarations
  private readonly config: Readonly<ExecutionConfig>;
  private readonly processManager: Readonly<ActiveProcessManager>;
  private readonly providerRepository: Readonly<{ getProvider: (providerType: ProviderType) => Provider | undefined }>;
  private _rustBackend: RustExecutionBackend | null;

  public constructor(
    config: Readonly<ExecutionConfig>,
    processManager: Readonly<ActiveProcessManager>,
    providerRepository: Readonly<{ getProvider: (providerType: ProviderType) => Provider | undefined }>,
    rustBackend: RustExecutionBackend | null = null
  ) {
    super();
    this.config = config;
    this.processManager = processManager;
    this.providerRepository = providerRepository;
    this.domainOrchestrator = new DomainAwareToolOrchestrator();
    this._rustBackend = rustBackend ?? null;

    // If no injected backend, lazily create one
    if (!this._rustBackend) {
      try {
        import('./rust-executor/index.js').then(async ({ RustExecutionBackend }) => {
          this._rustBackend = new RustExecutionBackend({
            enableProfiling: true,
            maxConcurrency: 4,
            timeoutMs: config.defaultTimeout,
            logLevel: 'info',
          });
          // Initialize asynchronously
          // Fire-and-forget async initialization of Rust backend
          await this.initializeRustBackend();
        }).catch((e) => {
          // If import fails, leave rustBackend null and continue
          logger.warn('RequestExecutionManager: Rust backend not available at construction', { error: e instanceof Error ? e.message : String(e) });
          this._rustBackend = null;
        });
      } catch (e) {
        logger.warn('RequestExecutionManager: Rust backend initialization error', { error: e instanceof Error ? e.message : String(e) });
      }
    } else {
      // If an injected backend exists, we may optionally initialize/verify it
      try {
        if (typeof this._rustBackend.initialize === 'function') {
          // Fire-and-forget initialization
          this._rustBackend.initialize().catch((err: unknown) => {
            logger.warn('Injected rustBackend failed to initialize', { error: err instanceof Error ? err.message : String(err) });
          });
        }
      } catch (err) {
        logger.warn('Error while initializing injected rustBackend', { error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Start event-driven queue processor instead of infinite loop
    this.scheduleQueueProcessor();

    // Handle shutdown gracefully
    process.once('SIGTERM', () => {
      this.shutdown().catch(err => {
        logger.error('Shutdown error', err instanceof Error ? err : new Error(String(err)));
      });
    });
    process.once('SIGINT', () => {
      this.shutdown().catch(err => {
        logger.error('Shutdown error', err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  private async initializeRustBackend(): Promise<void> {
    try {
      if (!this._rustBackend) return;
      const initialized = await this._rustBackend.initialize();
      if (initialized) {
        logger.info('🚀 RequestExecutionManager: Rust backend initialized', {
          available: this._rustBackend.isAvailable(),
          strategy: this._rustBackend.getStrategy(),
        });
      } else {
        logger.warn(
          '⚠️ RequestExecutionManager: Rust backend module not found, using TypeScript fallback'
        );
      }
    } catch (error) {
      logger.error('❌ RequestExecutionManager: Rust backend initialization failed', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Main request processing method
   */
  public async processRequest(
    request: Readonly<ModelRequest>,
    context?: Readonly<ProjectContext>
  ): Promise<ModelResponse> {
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

        // Define a type for batchResult to avoid unsafe any usage
        interface BatchResult {
          content: string;
          usage?: { totalTokens?: number };
        }

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
        ) as BatchResult;

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
          toReadonlyRecord(error)
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
        toReadonlyRecord({ message: getErrorMessage(error) })
      );
      throw toError(error);
    }
  }

  /**
   * Execute request with fallback chain
   */
  public async executeWithFallback(
    requestId: string,
    request: Readonly<ModelRequest>,
    context: Readonly<ProjectContext> | undefined,
    strategy: Readonly<ExecutionStrategy>,
    _abortSignal?: Readonly<AbortSignal>
  ): Promise<ModelResponse> {
    const fallbackChain =
      strategy.provider === 'ollama'
        ? ['ollama', 'lm-studio', 'huggingface'] // Default fallback chain
        : [strategy.provider, 'ollama', 'lm-studio', 'huggingface'].filter(
            (p: string, i: number, arr: string[]) => arr.indexOf(p) === i
          );

    let lastError: Error | null = null;

    for (const providerType of fallbackChain) {
      const provider = this.providerRepository.getProvider(providerType as ProviderType);
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

        // DOMAIN-AWARE TOOL SELECTION: Smart filtering based on request analysis
        interface Tool { function?: { name?: string }; name?: string }
        let tools: Tool[] = [];
        let domainInfo = '';

        if (supportsTools && toolIntegration) {
          const allTools = await toolIntegration.getLLMFunctions();

          // Use domain orchestrator to select relevant tools only
          const mappedTools = allTools.map(tool => ({
            name: tool.function.name,
            function: { name: tool.function.name }
          }));
          const { tools: selectedTools, analysis, reasoning } = this.domainOrchestrator.getToolsForPrompt(
            request.prompt || '',
            mappedTools
          );

          tools = (selectedTools ?? []) as Tool[];
          domainInfo = `${analysis.primaryDomain} (${(analysis.confidence * 100).toFixed(1)}%)`;

          logger.info('🎯 REQUEST-EXECUTION-MANAGER: Domain-aware tool selection', {
            prompt: `${request.prompt.substring(0, 80)}...`,
            primaryDomain: analysis.primaryDomain,
            confidence: analysis.confidence.toFixed(2),
            originalToolCount: allTools.length,
            selectedToolCount: tools.length,
            toolNames: tools.map((t: Readonly<Tool>) => (t.function && typeof t.function.name === 'string' ? t.function.name : t.name ?? 'unknown')),
            reasoning,
          });
        }

        // ENHANCED DEBUG: Show domain-aware tool selection results
        logger.info('🔧 ENHANCED TOOL DEBUG: Domain-aware request execution status', {
          provider: providerType,
          model: provider.getModelName?.() || 'unknown',
          supportsTools,
          hasEnhanced: !!enhancedToolIntegration,
          hasBasic: !!getGlobalToolIntegration(),
          hasIntegration: !!toolIntegration,
          selectedToolCount: tools.length,
          domainInfo,
        });

        if (tools.length > 0) {
          logger.info('🎯 DOMAIN-SELECTED TOOLS for request execution', {
            toolNames: tools.map(t => t.function?.name || t.name),
            domain: domainInfo,
            sampleTool: tools[0],
          });
        } else {
          logger.warn('⚠️ NO DOMAIN TOOLS SELECTED for request execution', {
            domain: domainInfo,
          });
        }

        // Map domain-selected tools to ModelTool format required by ModelRequest
        const modelTools = tools
          .filter(
            (t): t is { function: { name: string; description?: string; parameters?: object } } =>
              !!t.function && typeof t.function.name === 'string'
          )
          .map((t: Readonly<{ readonly function: { readonly name: string; readonly description?: string; readonly parameters?: object } }>) => {
            // Use object destructuring and type guard for parameters
            const { parameters } = t.function;
            // Always set type: "object" as required by ModelTool
            const safeProperties: Record<string, unknown> =
              typeof parameters === 'object' &&
              parameters !== null &&
              'properties' in parameters &&
              typeof (parameters as { properties: unknown }).properties === 'object' &&
              (parameters as { properties: unknown }).properties !== null
                ? (parameters as { properties: Record<string, unknown> }).properties
                : {};

            const safeParameters: { type: "object"; properties: Record<string, unknown> } = {
              type: "object",
              properties: safeProperties,
            };

            return {
              type: "function" as const,
              function: {
                name: t.function.name,
                description: typeof t.function.description === 'string' ? t.function.description : '',
                parameters: safeParameters,
              },
            };
          });

        // Add tools to request before calling provider
        const requestWithTools = {
          ...request,
          tools: modelTools,
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

        const response = await Promise.race([
          provider.processRequest(requestWithAbort, context),
          this.createOptimizedTimeoutPromise(optimizedTimeout, abortController),
        ]);

        // Mark request as completed successfully
        requestTimeoutOptimizer.completeRequest(requestId);

        // Check if response contains tool calls that need to be executed
        if (response.toolCalls && response.toolCalls.length > 0) {
          logger.debug('Tool execution: Found tool calls in request execution', {
            count: response.toolCalls.length,
          });

          if (toolIntegration) {
            try {
              const toolResults = [];

              // Execute each tool call
              for (const toolCall of response.toolCalls) {
                logger.debug('Executing tool in request execution', {
                  toolName: toolCall.function?.name,
                });

                // Convert to expected format if needed
                const formattedToolCall = {
                  function: {
                    name: toolCall.function?.name,
                    arguments: JSON.stringify(
                      toolCall.function?.arguments || {}
                    ),
                  },
                };

                logger.info(
                  `🔥 REQUEST-EXECUTION-MANAGER: About to call executeToolCall for ${formattedToolCall.function.name}`
                );
                logger.info(
                  `🔥 REQUEST-EXECUTION-MANAGER: toolIntegration type: ${toolIntegration?.constructor?.name}`
                );
                const result = await toolIntegration.executeToolCall(formattedToolCall) as ToolResult;
                logger.debug('Tool execution result in request execution', { result });
                toolResults.push(result);

                // CRITICAL FIX: Bridge tool results to evidence collection system
                const globalCollector = GlobalEvidenceCollector.getInstance();
                globalCollector.addToolResult(result as Readonly<ToolResult>);
              }

              // If we have tool results, format them into a readable response
              if (toolResults.length > 0) {
                const [firstResult] = toolResults;

                if (firstResult?.success && firstResult.output !== undefined) {
                  // Return the actual tool result as the content
                  const content =
                    typeof firstResult.output === 'object' && firstResult.output !== null && Object.prototype.hasOwnProperty.call(firstResult.output, 'content')
                      ? (firstResult.output as { content: string }).content
                      : firstResult.output;
                  response.content = content as string;
                  response.metadata = {
                    tokens: 0,
                    latency: 0,
                    ...response.metadata,
                  };

                  logger.info(
                    '🔧 TOOL EXECUTION: Tool successfully executed in request execution',
                    {
                      toolName:
                        response.toolCalls[0]?.function?.name,
                      resultContent: content,
                    }
                  );
                } else if (firstResult.error) {
                  response.content = `Error executing tool: ${firstResult.error}`;
                  logger.error('Tool execution error in request execution', {
                    error: firstResult.error,
                  });
                }
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
  public determineExecutionStrategy(
    request: Readonly<ModelRequest>,
    context?: Readonly<ProjectContext>
  ): ExecutionStrategy {
    const prompt = request.prompt || '';
    const complexity = this.assessComplexityFast(prompt);

    // Default strategy
    const strategy: ExecutionStrategy = {
      mode: 'balanced',
      provider: 'ollama',
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

    logger.debug('Execution strategy determined:', toReadonlyRecord(strategy));
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
    const { length } = prompt;
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
      void this.processQueueBatch();
    }, 50); // Reduced from 100ms for better responsiveness
  }

  /**
   * Process queue batch efficiently
   */
  private async processQueueBatch(): Promise<void> {
    // Ensure at least one await expression to satisfy async method requirements
    await Promise.resolve();

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
    void Promise.allSettled(batchPromises);

    // Reschedule if there are more items to process
    if (this.requestQueue.length > 0) {
      this.scheduleQueueProcessor();
    }
  }

  /**
   * Queue request if at capacity
   */
  public async queueRequest(request: Readonly<ModelRequest>, context?: Readonly<ProjectContext>): Promise<ModelResponse> {
    if (this.activeRequests.size < this.config.maxConcurrentRequests) {
      return this.processRequest(request, context);
    }

    return new Promise<ModelResponse>((resolve, reject) => {
      this.requestQueue.push({
        request,
        context,
        resolve: resolve as (value: ModelResponse) => void,
        reject: reject as (reason?: unknown) => void,
      });
      logger.info('Request queued due to capacity limit');

      // Trigger queue processor
      this.scheduleQueueProcessor();
    });
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
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
      rustBackendAvailable: this._rustBackend ? this._rustBackend.isAvailable() : false,
      rustBackendStats: this._rustBackend ? this._rustBackend.getPerformanceStats() : undefined,
      config: this.config,
    };
  }

  /**
   * Get the Rust execution backend instance
   */
  public getRustBackend(): RustExecutionBackend | null {
    return this._rustBackend;
  }
}
