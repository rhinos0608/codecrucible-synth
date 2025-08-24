/**
 * Request Processing Core Manager - Centralizes request preparation, queuing, and processing logic
 * Extracted from UnifiedModelClient to provide focused request processing management
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { ModelRequest, ProjectContext } from '../types.js';
import { ActiveProcess, ActiveProcessManager } from '../performance/active-process-manager.js';
import { ProviderType } from '../providers/provider-repository.js';
import { toError } from '../../utils/error-utils.js';

export interface RequestMetrics {
  provider: string;
  model: string;
  startTime: number;
  endTime?: number;
  tokenCount?: number;
  success: boolean;
  error?: string;
}

export interface QueuedRequest {
  id: string;
  request: ModelRequest;
  resolve: (value: any) => void;
  reject: (reason?: Error) => void;
}

export interface ExecutionStrategy {
  mode: 'fast' | 'quality'; // Remove 'auto' to match ExecutionMode
  provider: ProviderType;
  timeout: number;
  complexity: string; // Change to string to match client expectation
}

export interface RequestProcessingConfig {
  maxConcurrentRequests: number;
  defaultTimeoutMs: number;
  memoryThresholds: {
    base: number;
    lengthMultiplier: number;
    complexityMultiplier: number;
  };
}

export interface IRequestProcessingCoreManager {
  /**
   * Estimate memory usage for a request
   */
  estimateMemoryUsage(request: ModelRequest): number;

  /**
   * Determine process type based on request content
   */
  getProcessType(request: ModelRequest): ActiveProcess['type'];

  /**
   * Determine request priority
   */
  getRequestPriority(request: ModelRequest): ActiveProcess['priority'];

  /**
   * Assess complexity quickly for timeout determination
   */
  assessComplexityFast(prompt: string): 'simple' | 'medium' | 'complex';

  /**
   * Determine execution strategy for a request
   */
  determineExecutionStrategy(
    request: ModelRequest,
    context?: ProjectContext,
    executionMode?: 'fast' | 'auto' | 'quality'
  ): ExecutionStrategy;

  /**
   * Create timeout promise for request handling
   */
  createTimeoutPromise(timeoutMs: number): Promise<never>;

  /**
   * Queue request for processing when at capacity
   */
  queueRequest(
    request: ModelRequest,
    activeRequestsCount: number,
    processRequest: (req: ModelRequest, ctx?: ProjectContext) => Promise<any>,
    context?: ProjectContext
  ): Promise<any>;

  /**
   * Process request queue
   */
  processQueue(
    activeRequestsCount: number,
    maxConcurrent: number,
    processRequest: (req: ModelRequest) => Promise<any>
  ): Promise<void>;

  /**
   * Get current queue statistics
   */
  getQueueStats(): {
    queueLength: number;
    isProcessing: boolean;
    totalProcessed: number;
  };

  /**
   * Clear request queue (for shutdown)
   */
  clearQueue(): void;

  /**
   * Cleanup resources
   */
  cleanup(): Promise<void>;
}

export class RequestProcessingCoreManager
  extends EventEmitter
  implements IRequestProcessingCoreManager
{
  private readonly config: RequestProcessingConfig;
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;
  private totalProcessed = 0;

  constructor(config?: Partial<RequestProcessingConfig>) {
    super();

    this.config = {
      maxConcurrentRequests: 3,
      defaultTimeoutMs: 180000,
      memoryThresholds: {
        base: 50, // Base memory in MB
        lengthMultiplier: 0.01, // MB per character
        complexityMultiplier: 30, // Additional MB for complex operations
      },
      ...config,
    };

    logger.debug('RequestProcessingCoreManager initialized', { config: this.config });
  }

  /**
   * Estimate memory usage for a request
   */
  estimateMemoryUsage(request: ModelRequest): number {
    const baseMemory = this.config.memoryThresholds.base;
    const promptLength = request.prompt?.length || 0;

    // Estimate based on prompt length and complexity
    let estimatedMemory = baseMemory;

    // Length-based estimation
    estimatedMemory += promptLength * this.config.memoryThresholds.lengthMultiplier;

    // Add memory for complex operations
    if (request.prompt) {
      const prompt = request.prompt.toLowerCase();
      if (prompt.includes('analyze') || prompt.includes('review')) {
        estimatedMemory += this.config.memoryThresholds.complexityMultiplier;
      }
      if (prompt.includes('generate') || prompt.includes('create')) {
        estimatedMemory += this.config.memoryThresholds.complexityMultiplier * 1.3;
      }
      if (prompt.includes('refactor') || prompt.includes('architecture')) {
        estimatedMemory += this.config.memoryThresholds.complexityMultiplier * 2;
      }
    }

    const finalEstimate = Math.round(estimatedMemory);
    logger.debug('Memory estimation', {
      promptLength,
      baseMemory,
      estimatedMemory: finalEstimate,
    });

    return finalEstimate;
  }

  /**
   * Determine process type based on request content
   */
  getProcessType(request: ModelRequest): ActiveProcess['type'] {
    if (!request.prompt) {
      return 'model_inference';
    }

    const prompt = request.prompt.toLowerCase();

    if (prompt.includes('analyze') || prompt.includes('review')) {
      return 'analysis';
    }
    if (prompt.includes('generate') || prompt.includes('create') || prompt.includes('write')) {
      return 'generation';
    }
    if (prompt.includes('stream')) {
      return 'streaming';
    }

    return 'model_inference';
  }

  /**
   * Determine request priority
   */
  getRequestPriority(request: ModelRequest): ActiveProcess['priority'] {
    // Simple priority determination - could be enhanced with explicit priority in request
    if (request.prompt?.toLowerCase().includes('urgent') || request.stream) {
      return 'high';
    }
    if (request.prompt?.toLowerCase().includes('background')) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * OPTIMIZED: Fast complexity assessment for timeout determination
   */
  assessComplexityFast(prompt: string): 'simple' | 'medium' | 'complex' {
    const length = prompt.length;

    // Fast bit-flag classification
    let flags = 0;
    if (length > 200) flags |= 1;
    if (prompt.includes('analyze')) flags |= 2;
    if (prompt.includes('review')) flags |= 2;
    if (prompt.includes('debug')) flags |= 2;
    if (prompt.includes('function')) flags |= 4;
    if (prompt.includes('class')) flags |= 4;
    if (prompt.includes('interface')) flags |= 4;

    // Fast O(1) classification
    if (flags >= 4 || flags & 2) return 'complex';
    if (length < 50 && flags === 0) return 'simple';
    return 'medium';
  }

  /**
   * Determine execution strategy for a request
   */
  determineExecutionStrategy(
    request: ModelRequest,
    context?: ProjectContext,
    executionMode: 'fast' | 'auto' | 'quality' = 'auto'
  ): ExecutionStrategy {
    // OPTIMIZED: Fast complexity assessment
    const complexity = this.assessComplexityFast(request.prompt || '');

    // Auto-determine execution mode if not specified
    let mode = executionMode;
    if (mode === 'auto') {
      const hasContext = context && Object.keys(context).length > 0;

      if (complexity === 'simple' && !hasContext) {
        mode = 'fast';
      } else if (complexity === 'complex' || (hasContext && context.files?.length > 10)) {
        mode = 'quality';
      } else {
        mode = 'auto';
      }
    }

    // Select provider based on mode and availability - simplified selection
    let provider: ProviderType = 'ollama'; // Default provider
    let timeout = this.config.defaultTimeoutMs;

    // OPTIMIZED: Adaptive timeouts based on complexity
    switch (mode) {
      case 'fast':
        provider = 'lm-studio'; // Prefer fast provider
        timeout = complexity === 'simple' ? 120000 : 180000; // 2min for simple, 3min for others
        break;

      case 'quality':
        provider = 'ollama'; // Prefer quality provider
        timeout = complexity === 'complex' ? 240000 : 180000; // 4min for complex, 3min for others
        break;

      case 'auto':
      default:
        mode = 'quality'; // Convert 'auto' to concrete mode
        provider = 'ollama'; // Balanced provider
        timeout = complexity === 'simple' ? 120000 : complexity === 'complex' ? 240000 : 180000;
        break;
    }

    const strategy: ExecutionStrategy = { mode, provider, timeout, complexity };

    logger.debug('Execution strategy determined', strategy);
    this.emit('strategy-determined', {
      request: { prompt: request.prompt?.substring(0, 50) },
      strategy,
    });

    return strategy;
  }

  /**
   * Create timeout promise for request handling
   */
  createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Queue request for processing when at capacity
   */
  async queueRequest(
    request: ModelRequest,
    activeRequestsCount: number,
    processRequest: (req: ModelRequest, ctx?: ProjectContext) => Promise<any>,
    context?: ProjectContext
  ): Promise<any> {
    if (activeRequestsCount < this.config.maxConcurrentRequests) {
      return processRequest(request, context);
    }

    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: this.generateRequestId(),
        request,
        resolve,
        reject,
      };

      this.requestQueue.push(queuedRequest);
      this.emit('request-queued', {
        requestId: queuedRequest.id,
        queueLength: this.requestQueue.length,
      });

      logger.debug('Request queued', {
        requestId: queuedRequest.id,
        queueLength: this.requestQueue.length,
        activeRequests: activeRequestsCount,
      });

      // Attempt to process queue
      this.processQueue(
        activeRequestsCount,
        this.config.maxConcurrentRequests,
        processRequest
      ).catch(error => {
        logger.error('Queue processing failed', error);
      });
    });
  }

  /**
   * Process request queue
   */
  async processQueue(
    activeRequestsCount: number,
    maxConcurrent: number,
    processRequest: (req: ModelRequest) => Promise<any>
  ): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    logger.debug('Started processing request queue', {
      queueLength: this.requestQueue.length,
      activeRequests: activeRequestsCount,
    });

    while (this.requestQueue.length > 0 && activeRequestsCount < maxConcurrent) {
      const queuedRequest = this.requestQueue.shift();
      if (!queuedRequest) break;

      try {
        logger.debug('Processing queued request', { requestId: queuedRequest.id });
        const response = await processRequest(queuedRequest.request);
        queuedRequest.resolve(response);
        this.totalProcessed++;

        this.emit('request-processed', {
          requestId: queuedRequest.id,
          success: true,
          totalProcessed: this.totalProcessed,
        });
      } catch (error) {
        logger.error('Queued request failed', {
          requestId: queuedRequest.id,
          error: error instanceof Error ? error.message : error,
        });
        queuedRequest.reject(toError(error));

        this.emit('request-processed', {
          requestId: queuedRequest.id,
          success: false,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    this.isProcessingQueue = false;
    logger.debug('Finished processing request queue', {
      remainingQueue: this.requestQueue.length,
    });
  }

  /**
   * Get current queue statistics
   */
  getQueueStats(): {
    queueLength: number;
    isProcessing: boolean;
    totalProcessed: number;
  } {
    return {
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessingQueue,
      totalProcessed: this.totalProcessed,
    };
  }

  /**
   * Clear request queue (for shutdown)
   */
  clearQueue(): void {
    const queuedCount = this.requestQueue.length;

    // Reject all queued requests
    this.requestQueue.forEach(queuedRequest => {
      queuedRequest.reject(new Error('System shutdown - request cancelled'));
    });

    this.requestQueue = [];
    this.isProcessingQueue = false;

    if (queuedCount > 0) {
      logger.info(`Cleared ${queuedCount} queued requests during shutdown`);
      this.emit('queue-cleared', { clearedCount: queuedCount });
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.clearQueue();
    this.removeAllListeners();
    this.totalProcessed = 0;
    logger.debug('RequestProcessingCoreManager cleaned up');
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 9);
    return `req_${timestamp}_${randomStr}`;
  }
}
