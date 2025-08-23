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
import { logger } from '../logger.js';
import { getErrorMessage, toError } from '../../utils/error-utils.js';
import { ProjectContext, ModelRequest, ModelResponse, ComplexityAnalysis, TaskType } from '../types.js';
import { ActiveProcess, ActiveProcessManager } from '../performance/active-process-manager.js';

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
  executeWithFallback(requestId: string, request: ModelRequest, context: ProjectContext | undefined, strategy: ExecutionStrategy, abortSignal?: AbortSignal): Promise<ModelResponse>;
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
    reject: (reason?: any) => void 
  }> = [];
  private processManager: ActiveProcessManager;
  private providerRepository: any;

  constructor(
    config: ExecutionConfig,
    processManager: ActiveProcessManager,
    providerRepository: any
  ) {
    super();
    this.config = config;
    this.processManager = processManager;
    this.providerRepository = providerRepository;

    // Start request queue processor
    this.processQueue();
  }

  /**
   * Main request processing method
   */
  async processRequest(request: ModelRequest, context?: ProjectContext): Promise<ModelResponse> {
    const requestId = this.generateRequestId();
    const strategy = this.determineExecutionStrategy(request, context);

    logger.info(`🚀 Processing request ${requestId} with ${strategy.mode} mode via ${strategy.provider}`);

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
      const response = await this.executeWithFallback(
        requestId,
        request,
        context,
        strategy
      );

      // Mark process as completed
      this.processManager.unregisterProcess(activeProcess.id);

      logger.info(`✅ Request ${requestId} completed successfully`);
      return response;

    } catch (error: unknown) {
      // Mark process as failed
      this.processManager.unregisterProcess(activeProcess.id);
      
      logger.error(`❌ Request ${requestId} failed:`, getErrorMessage(error));
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
    const fallbackChain = strategy.provider === 'auto'
      ? ['ollama', 'lm-studio', 'huggingface'] // Default fallback chain
      : [strategy.provider, 'ollama', 'lm-studio', 'huggingface'].filter((p, i, arr) => arr.indexOf(p) === i);

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

        const response = await Promise.race([
          provider.processRequest(request, context),
          this.createTimeoutPromise(strategy.timeout),
        ]);

        metrics.endTime = Date.now();
        metrics.success = true;
        metrics.tokenCount = response.usage?.totalTokens;

        this.activeRequests.delete(requestId);
        this.emit('requestSuccess', { 
          requestId, 
          provider: providerType, 
          duration: metrics.endTime - metrics.startTime 
        });

        logger.info(`✅ Request ${requestId} succeeded with ${providerType} in ${metrics.endTime - metrics.startTime}ms`);
        return response;

      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        lastError = toError(error);

        const metrics = this.activeRequests.get(requestId);
        if (metrics) {
          metrics.endTime = Date.now();
          metrics.error = errorMessage;
        }

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
    let strategy: ExecutionStrategy = {
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
    if (context && context.files && context.files.length > 10) {
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
    const complexKeywords = ['analyze', 'architecture', 'security', 'performance', 'optimize', 'refactor'];
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
  private getProcessType(request: ModelRequest): 'model_inference' | 'analysis' | 'generation' | 'streaming' {
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
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Process request queue
   */
  private async processQueue(): Promise<void> {
    while (true) {
      if (this.requestQueue.length > 0 && this.activeRequests.size < this.config.maxConcurrentRequests) {
        const queueItem = this.requestQueue.shift();
        if (queueItem) {
          this.processRequest(queueItem.request, queueItem.context)
            .then(queueItem.resolve)
            .catch(queueItem.reject);
        }
      }
      
      // Wait before checking queue again
      await new Promise(resolve => setTimeout(resolve, 100));
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
        reject: reject as (reason?: any) => void 
      });
      logger.info('Request queued due to capacity limit');
    });
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): any {
    return {
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.length,
      maxConcurrent: this.config.maxConcurrentRequests,
      config: this.config,
    };
  }
}