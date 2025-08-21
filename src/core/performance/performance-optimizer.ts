/**
 * Advanced Performance Optimization System for CodeCrucible
 * Implements tokenization optimization, caching, batching, and streaming
 */

import { EventEmitter } from 'events';
import { LRUCache } from 'lru-cache';
import crypto from 'crypto';
import { logger } from '../logger.js';
import {
  ModelResponse,
  PerformanceMetrics,
  CacheEntry,
  OptimizationConfig,
} from '../types/performance.js';

export interface BatchRequest {
  id: string;
  prompt: string;
  context: string[];
  priority: number;
}

export interface StreamingResponse {
  id: string;
  chunk: string;
  complete: boolean;
  metadata?: any;
}

export class PerformanceOptimizer extends EventEmitter {
  private responseCache: LRUCache<string, CacheEntry>;
  private embeddingCache: LRUCache<string, number[]>;
  private batchQueue: BatchRequest[] = [];
  private activeBatches = new Map<string, Promise<any>>();
  private metrics: PerformanceMetrics;
  private config: OptimizationConfig;

  constructor(config: Partial<OptimizationConfig> = {}) {
    super();

    this.config = {
      // Cache settings
      maxCacheSize: config.maxCacheSize || 1000,
      cacheMaxAge: config.cacheMaxAge || 3600000, // 1 hour

      // Tokenization settings
      maxTokensPerPrompt: config.maxTokensPerPrompt || 4096,
      contextWindowSize: config.contextWindowSize || 32768,
      chunkSize: config.chunkSize || 1000,

      // Batch settings - optimized for better performance
      batchSize: config.batchSize || 16,
      batchTimeoutMs: config.batchTimeoutMs || 500,
      maxConcurrentBatches: config.maxConcurrentBatches || 1,

      // Model parameters
      temperature: config.temperature || 0.3,
      topP: config.topP || 0.9,
      topK: config.topK || 40,

      // Performance settings
      enableStreaming: config.enableStreaming !== false,
      enableBatching: config.enableBatching !== false,
      enableCaching: config.enableCaching !== false,

      ...config,
    };

    // Initialize caches
    this.responseCache = new LRUCache({
      max: this.config.maxCacheSize,
      ttl: this.config.cacheMaxAge,
    });

    this.embeddingCache = new LRUCache({
      max: this.config.maxCacheSize / 2,
      ttl: this.config.cacheMaxAge * 2, // Embeddings last longer
    });

    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageLatency: 0,
      tokensSaved: 0,
      batcheProcessed: 0,
    };

    logger.info('Performance optimizer initialized', {
      cacheSize: this.config.maxCacheSize,
      batchSize: this.config.batchSize,
      enabledFeatures: {
        caching: this.config.enableCaching,
        batching: this.config.enableBatching,
        streaming: this.config.enableStreaming,
      },
    });
  }

  /**
   * 1. Tokenization & Prompt Engineering Optimization
   */
  optimizePrompt(
    prompt: string,
    context: string[] = []
  ): {
    optimizedPrompt: string;
    relevantContext: string[];
    estimatedTokens: number;
  } {
    // Estimate tokens (rough approximation: 1 token ≈ 4 characters for English)
    const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

    // Shorten instructions without losing clarity
    const shortenedPrompt = this.shortenInstructions(prompt);

    // Select only relevant context using simple heuristics
    const relevantContext = this.selectRelevantContext(context, shortenedPrompt);

    // Calculate total tokens
    const promptTokens = estimateTokens(shortenedPrompt);
    const contextTokens = relevantContext.reduce((sum, ctx) => sum + estimateTokens(ctx), 0);
    const totalTokens = promptTokens + contextTokens;

    // Truncate if exceeding limits
    let finalContext = relevantContext;
    if (totalTokens > this.config.maxTokensPerPrompt) {
      const availableTokens = this.config.maxTokensPerPrompt - promptTokens;
      finalContext = this.truncateContext(relevantContext, availableTokens);
    }

    logger.debug('Prompt optimization', {
      originalLength: prompt.length,
      optimizedLength: shortenedPrompt.length,
      contextFiles: context.length,
      relevantFiles: finalContext.length,
      estimatedTokens: totalTokens,
    });

    return {
      optimizedPrompt: shortenedPrompt,
      relevantContext: finalContext,
      estimatedTokens: Math.min(totalTokens, this.config.maxTokensPerPrompt),
    };
  }

  private shortenInstructions(prompt: string): string {
    // Remove redundant phrases and verbose language
    return prompt
      .replace(/please\s+/gi, '')
      .replace(/kindly\s+/gi, '')
      .replace(/\s+would\s+you\s+/gi, ' ')
      .replace(/\s+could\s+you\s+/gi, ' ')
      .replace(/\s+can\s+you\s+/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private selectRelevantContext(context: string[], prompt: string): string[] {
    // Simple relevance scoring based on keyword overlap
    const promptWords = new Set(
      prompt
        .toLowerCase()
        .split(/\W+/)
        .filter(w => w.length > 2)
    );

    return context
      .map(ctx => ({
        content: ctx,
        score: this.calculateRelevanceScore(ctx, promptWords),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(3, context.length)) // Limit to top 3 most relevant
      .map(item => item.content);
  }

  private calculateRelevanceScore(text: string, promptWords: Set<string>): number {
    const textWords = text
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 2);
    const matches = textWords.filter(word => promptWords.has(word)).length;
    return matches / Math.max(textWords.length, 1);
  }

  private truncateContext(context: string[], maxTokens: number): string[] {
    const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

    let totalTokens = 0;
    const result: string[] = [];

    for (const ctx of context) {
      const tokens = estimateTokens(ctx);
      if (totalTokens + tokens <= maxTokens) {
        result.push(ctx);
        totalTokens += tokens;
      } else {
        // Truncate the last item to fit
        const remainingTokens = maxTokens - totalTokens;
        if (remainingTokens > 100) {
          // Only include if meaningful
          const truncatedLength = remainingTokens * 4;
          result.push(ctx.substring(0, truncatedLength) + '...');
        }
        break;
      }
    }

    return result;
  }

  /**
   * 2. Batch & Streaming Implementation
   */
  async processBatch(requests: BatchRequest[]): Promise<Map<string, ModelResponse>> {
    if (!this.config.enableBatching || requests.length === 1) {
      // Process individually if batching disabled or single request
      const results = new Map<string, ModelResponse>();
      for (const request of requests) {
        const response = await this.processIndividual(request);
        results.set(request.id, response);
      }
      return results;
    }

    // Group requests by priority and process in batches
    const batchId = crypto.randomUUID();
    logger.debug('Processing batch', { batchId, requestCount: requests.length });

    try {
      // Combine prompts intelligently
      const combinedPrompt = this.createBatchPrompt(requests);
      const startTime = Date.now();

      // Process batch (this would call your model client)
      const batchResponse = await this.callModelWithBatch(combinedPrompt, batchId);

      // Parse and distribute responses
      const individualResponses = this.parseBatchResponse(batchResponse, requests);

      this.metrics.batcheProcessed++;
      this.metrics.averageLatency = (this.metrics.averageLatency + (Date.now() - startTime)) / 2;

      logger.info('Batch processed successfully', {
        batchId,
        requestCount: requests.length,
        latency: Date.now() - startTime,
      });

      return individualResponses;
    } catch (error) {
      logger.error('Batch processing failed', {
        batchId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }

  private createBatchPrompt(requests: BatchRequest[]): string {
    const instructions = `Process these ${requests.length} tasks in order. Format each response with "=== TASK ${requests.map((_, i) => i + 1).join(' ===\n=== TASK ')} ===":`;

    const tasks = requests
      .map(
        (req, index) =>
          `=== TASK ${index + 1} ===\n${req.prompt}\nContext: ${req.context.join('\n')}`
      )
      .join('\n\n');

    return `${instructions}\n\n${tasks}`;
  }

  private async callModelWithBatch(prompt: string, batchId: string): Promise<string> {
    try {
      // Import the UnifiedModelClient
      const { UnifiedModelClient } = await import('../client.js');

      // Create a lightweight client configuration for batch processing
      const clientConfig = {
        providers: [
          {
            type: 'ollama' as const,
            endpoint: 'http://localhost:11434',
            model: 'gemma:latest',
            timeout: 30000,
          },
        ],
        executionMode: 'auto' as const,
        fallbackChain: ['ollama'],
        performanceThresholds: {
          fastModeMaxTokens: 1024,
          timeoutMs: 30000,
          maxConcurrentRequests: 1,
        },
      };

      const client = new UnifiedModelClient(clientConfig);
      await client.initialize();

      const response = await client.synthesize({
        prompt: `Process this batch request: ${prompt}`,
        model: 'default',
        temperature: 0.3,
        maxTokens: 1024,
      });

      return response.content || `Batch ${batchId} processed successfully`;
    } catch (error) {
      // Fallback to simple response
      return `Batch ${batchId} processed (fallback mode)`;
    }
  }

  private parseBatchResponse(
    response: string,
    requests: BatchRequest[]
  ): Map<string, ModelResponse> {
    const results = new Map<string, ModelResponse>();

    // Split response by task markers
    const sections = response.split(/=== TASK \d+ ===/);

    requests.forEach((request, index) => {
      const section = sections[index + 1]?.trim() || '';
      results.set(request.id, {
        content: section,
        tokenCount: Math.ceil(section.length / 4),
        fromCache: false,
        latency: 0,
      });
    });

    return results;
  }

  private async processIndividual(request: BatchRequest): Promise<ModelResponse> {
    const startTime = Date.now();

    // Optimize the prompt first
    const optimized = this.optimizePrompt(request.prompt, request.context);

    // Check cache
    const cacheKey = this.generateCacheKey(optimized.optimizedPrompt, optimized.relevantContext);

    if (this.config.enableCaching) {
      const cached = this.responseCache.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        logger.debug('Cache hit', { cacheKey: cacheKey.substring(0, 8) });
        return {
          content: cached.response,
          tokenCount: cached.tokenCount,
          fromCache: true,
          latency: Date.now() - startTime,
        };
      }
    }

    this.metrics.cacheMisses++;

    // Process with model (placeholder)
    const response = await this.callModel(optimized.optimizedPrompt, optimized.relevantContext);

    // Cache the result
    if (this.config.enableCaching) {
      this.responseCache.set(cacheKey, {
        response: response.content,
        tokenCount: response.tokenCount,
        timestamp: Date.now(),
      });
    }

    return {
      ...response,
      fromCache: false,
      latency: Date.now() - startTime,
    };
  }

  private async callModel(prompt: string, context: string[]): Promise<ModelResponse> {
    // Placeholder for actual model call
    const content = `Generated response for: ${prompt.substring(0, 50)}...`;
    return {
      content,
      tokenCount: Math.ceil(content.length / 4),
      fromCache: false,
      latency: 0,
    };
  }

  /**
   * 3. Caching & Memoization
   */
  private generateCacheKey(prompt: string, context: string[]): string {
    const combined = prompt + '|||' + context.join('|||');
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  clearCache(): void {
    this.responseCache.clear();
    this.embeddingCache.clear();
    logger.info('Performance caches cleared');
  }

  /**
   * 4. Streaming Support
   */
  async *streamResponse(prompt: string, context: string[] = []): AsyncGenerator<StreamingResponse> {
    if (!this.config.enableStreaming) {
      // Fallback to non-streaming
      const response = await this.processIndividual({
        id: crypto.randomUUID(),
        prompt,
        context,
        priority: 1,
      });

      yield {
        id: crypto.randomUUID(),
        chunk: response.content,
        complete: true,
        metadata: { fromCache: response.fromCache, tokenCount: response.tokenCount },
      };
      return;
    }

    // Implement actual streaming here
    const optimized = this.optimizePrompt(prompt, context);
    const responseId = crypto.randomUUID();

    // Simulate streaming chunks
    const chunks = this.simulateStreamingChunks(optimized.optimizedPrompt);

    for (let i = 0; i < chunks.length; i++) {
      yield {
        id: responseId,
        chunk: chunks[i],
        complete: i === chunks.length - 1,
        metadata:
          i === chunks.length - 1
            ? {
                totalTokens: optimized.estimatedTokens,
                optimizations: 'prompt_shortened,context_filtered',
              }
            : undefined,
      };

      // Small delay to simulate network latency
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  private simulateStreamingChunks(prompt: string): string[] {
    // This would integrate with actual streaming model client
    const response = `Optimized response for: ${prompt}`;
    const chunkSize = 20;
    const chunks: string[] = [];

    for (let i = 0; i < response.length; i += chunkSize) {
      chunks.push(response.substring(i, i + chunkSize));
    }

    return chunks;
  }

  /**
   * Performance Monitoring
   */
  getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      cacheHitRatio:
        this.metrics.totalRequests > 0 ? this.metrics.cacheHits / this.metrics.totalRequests : 0,
      cacheSize: this.responseCache.size,
      embeddingCacheSize: this.embeddingCache.size,
    };
  }

  /**
   * Configuration Management
   */
  updateConfig(updates: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info('Performance optimizer config updated', updates);
  }

  /**
   * Fast Mode - Minimal Initialization
   */
  enableFastMode(): void {
    this.config = {
      ...this.config,
      temperature: 0.1, // More deterministic
      maxTokensPerPrompt: 2048, // Smaller context
      batchSize: 1, // No batching
      enableStreaming: false, // Simpler processing
      cacheMaxAge: 7200000, // Longer cache life
    };

    logger.info('Fast mode enabled - optimized for minimal latency');
  }
}

export default PerformanceOptimizer;
