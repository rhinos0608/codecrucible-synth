/**
 * Intelligent Batch Processor
 * Based on research-driven optimization report: 64 requests per batch optimal for Llama models
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';

export interface BatchRequest {
  id: string;
  prompt: string;
  options: any;
  priority: number;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

export interface BatchConfig {
  optimalBatchSize: number;
  batchTimeoutMs: number;
  maxConcurrentBatches: number;
  priorityLevels: string[];
}

export interface BatchResult {
  batchId: string;
  results: any[];
  processingTime: number;
  successCount: number;
  errorCount: number;
}

/**
 * Intelligent batch processor with priority queuing and optimal sizing
 */
export class IntelligentBatchProcessor extends EventEmitter {
  private batchQueues: Map<string, BatchRequest[]> = new Map();
  private processingTasks: Map<string, Promise<any>> = new Map();
  private batchTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private config: BatchConfig;
  private activeBatches = 0;
  
  constructor(config: Partial<BatchConfig> = {}) {
    super();
    
    // Research-optimized defaults
    this.config = {
      optimalBatchSize: 64, // Optimal for Llama-based models per research
      batchTimeoutMs: 500,  // 500ms max wait
      maxConcurrentBatches: 3,
      priorityLevels: ['high', 'medium', 'low'],
      ...config
    };
    
    this.initializePriorityQueues();
  }
  
  /**
   * Initialize priority queues for each level
   */
  private initializePriorityQueues(): void {
    this.config.priorityLevels.forEach(priority => {
      this.batchQueues.set(priority, []);
    });
  }
  
  /**
   * Queue a request for batching
   */
  async queueRequest(
    prompt: string, 
    options: any = {}, 
    priority: string = 'medium'
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const request: BatchRequest = {
        id: this.generateRequestId(),
        prompt,
        options,
        priority: this.getPriorityLevel(priority),
        resolve,
        reject,
        timestamp: Date.now()
      };
      
      this.addToBatch(request);
    });
  }
  
  /**
   * Add request to appropriate batch queue
   */
  private addToBatch(request: BatchRequest): void {
    const priorityName = this.config.priorityLevels[request.priority] || 'medium';
    const batchKey = priorityName;
    
    if (!this.batchQueues.has(batchKey)) {
      this.batchQueues.set(batchKey, []);
    }
    
    const batch = this.batchQueues.get(batchKey)!;
    batch.push(request);
    
    // Start batch processing timer if not already started
    if (!this.batchTimeouts.has(batchKey)) {
      const timeout = setTimeout(() => {
        this.processBatch(batchKey);
      }, this.config.batchTimeoutMs);
      
      this.batchTimeouts.set(batchKey, timeout);
    }
    
    // Process immediately if batch is full
    if (batch.length >= this.config.optimalBatchSize) {
      this.processBatch(batchKey);
    }\n  }\n  \n  /**\n   * Process a batch of requests\n   */\n  private async processBatch(batchKey: string): Promise<void> {\n    const batch = this.batchQueues.get(batchKey);\n    if (!batch || batch.length === 0) return;\n    \n    // Check concurrent batch limit\n    if (this.activeBatches >= this.config.maxConcurrentBatches) {\n      logger.debug(`Batch processing delayed - concurrent limit reached (${this.activeBatches})`);\n      return;\n    }\n    \n    // Remove from queue immediately\n    this.batchQueues.set(batchKey, []);\n    \n    // Clear timeout\n    const timeout = this.batchTimeouts.get(batchKey);\n    if (timeout) {\n      clearTimeout(timeout);\n      this.batchTimeouts.delete(batchKey);\n    }\n    \n    this.activeBatches++;\n    const batchId = this.generateBatchId();\n    const startTime = Date.now();\n    \n    try {\n      logger.info(`Processing batch ${batchId} with ${batch.length} requests`);\n      \n      // Process batch with intelligent parallelization\n      const results = await this.processIntelligentBatch(batch);\n      \n      // Distribute responses back to waiting requests\n      this.distributeResponses(batch, results);\n      \n      const processingTime = Date.now() - startTime;\n      const successCount = results.filter(r => !r.error).length;\n      const errorCount = results.length - successCount;\n      \n      this.emit('batch-completed', {\n        batchId,\n        results,\n        processingTime,\n        successCount,\n        errorCount\n      } as BatchResult);\n      \n      logger.info(`Batch ${batchId} completed in ${processingTime}ms (${successCount}/${results.length} successful)`);\n      \n    } catch (error) {\n      logger.error(`Batch processing failed:`, error);\n      this.handleBatchError(batch, error as Error);\n    } finally {\n      this.activeBatches--;\n      \n      // Process next batch if any are waiting\n      this.processNextBatch();\n    }\n  }\n  \n  /**\n   * Process batch with intelligent parallelization\n   */\n  private async processIntelligentBatch(batch: BatchRequest[]): Promise<any[]> {\n    // Group requests by similarity for better processing\n    const groups = this.groupSimilarRequests(batch);\n    const results: any[] = [];\n    \n    for (const group of groups) {\n      try {\n        // Process similar requests together for efficiency\n        const groupResults = await this.processRequestGroup(group);\n        results.push(...groupResults);\n      } catch (error) {\n        // Add error results for failed group\n        group.forEach(() => {\n          results.push({ error: error instanceof Error ? error.message : 'Processing failed' });\n        });\n      }\n    }\n    \n    return results;\n  }\n  \n  /**\n   * Group similar requests for optimized processing\n   */\n  private groupSimilarRequests(batch: BatchRequest[]): BatchRequest[][] {\n    const groups: BatchRequest[][] = [];\n    const processed = new Set<string>();\n    \n    for (const request of batch) {\n      if (processed.has(request.id)) continue;\n      \n      const similarRequests = [request];\n      processed.add(request.id);\n      \n      // Find similar requests based on prompt characteristics\n      for (const other of batch) {\n        if (processed.has(other.id)) continue;\n        \n        if (this.areRequestsSimilar(request, other)) {\n          similarRequests.push(other);\n          processed.add(other.id);\n        }\n      }\n      \n      groups.push(similarRequests);\n    }\n    \n    return groups;\n  }\n  \n  /**\n   * Check if two requests are similar enough to process together\n   */\n  private areRequestsSimilar(req1: BatchRequest, req2: BatchRequest): boolean {\n    // Simple similarity check based on prompt length and keywords\n    const lengthSimilar = Math.abs(req1.prompt.length - req2.prompt.length) < 100;\n    const hasCommonKeywords = this.getKeywords(req1.prompt)\n      .some(keyword => req2.prompt.includes(keyword));\n    \n    return lengthSimilar && hasCommonKeywords;\n  }\n  \n  /**\n   * Extract keywords from prompt for similarity matching\n   */\n  private getKeywords(prompt: string): string[] {\n    return prompt.toLowerCase()\n      .split(/\\s+/)\n      .filter(word => word.length > 4 && !/^(the|and|for|are|but|not|you|all|can|her|was|one|our|had|how|what|where|when|why)$/.test(word))\n      .slice(0, 5); // Top 5 keywords\n  }\n  \n  /**\n   * Process a group of similar requests\n   */\n  private async processRequestGroup(group: BatchRequest[]): Promise<any[]> {\n    // Simulate intelligent processing (integrate with actual AI client)\n    const results = await Promise.all(group.map(async (request) => {\n      try {\n        // Placeholder for actual AI processing\n        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));\n        return {\n          content: `Response for: ${request.prompt.substring(0, 50)}...`,\n          requestId: request.id,\n          processingTime: Math.random() * 1000\n        };\n      } catch (error) {\n        return {\n          error: error instanceof Error ? error.message : 'Processing failed',\n          requestId: request.id\n        };\n      }\n    }));\n    \n    return results;\n  }\n  \n  /**\n   * Distribute responses back to waiting requests\n   */\n  private distributeResponses(batch: BatchRequest[], results: any[]): void {\n    batch.forEach((request, index) => {\n      const result = results[index];\n      \n      if (result && !result.error) {\n        request.resolve(result);\n      } else {\n        request.reject(new Error(result?.error || 'Processing failed'));\n      }\n    });\n  }\n  \n  /**\n   * Handle batch processing error\n   */\n  private handleBatchError(batch: BatchRequest[], error: Error): void {\n    batch.forEach(request => {\n      request.reject(error);\n    });\n  }\n  \n  /**\n   * Process next waiting batch\n   */\n  private processNextBatch(): void {\n    // Process highest priority batches first\n    for (const priority of this.config.priorityLevels) {\n      const batch = this.batchQueues.get(priority);\n      if (batch && batch.length > 0) {\n        setTimeout(() => this.processBatch(priority), 0);\n        break;\n      }\n    }\n  }\n  \n  /**\n   * Get priority level as number\n   */\n  private getPriorityLevel(priority: string): number {\n    const index = this.config.priorityLevels.indexOf(priority);\n    return index !== -1 ? index : 1; // Default to medium priority\n  }\n  \n  /**\n   * Generate unique request ID\n   */\n  private generateRequestId(): string {\n    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;\n  }\n  \n  /**\n   * Generate unique batch ID\n   */\n  private generateBatchId(): string {\n    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;\n  }\n  \n  /**\n   * Get current batch processing status\n   */\n  getStatus(): {\n    activeBatches: number;\n    queuedRequests: number;\n    totalQueues: number;\n  } {\n    const queuedRequests = Array.from(this.batchQueues.values())\n      .reduce((total, queue) => total + queue.length, 0);\n    \n    return {\n      activeBatches: this.activeBatches,\n      queuedRequests,\n      totalQueues: this.batchQueues.size\n    };\n  }\n  \n  /**\n   * Cleanup and destroy processor\n   */\n  async destroy(): Promise<void> {\n    // Clear all timeouts\n    for (const timeout of this.batchTimeouts.values()) {\n      clearTimeout(timeout);\n    }\n    this.batchTimeouts.clear();\n    \n    // Wait for active batches to complete (with timeout)\n    const maxWait = 10000; // 10 seconds\n    const start = Date.now();\n    \n    while (this.activeBatches > 0 && (Date.now() - start) < maxWait) {\n      await new Promise(resolve => setTimeout(resolve, 100));\n    }\n    \n    // Reject all pending requests\n    for (const queue of this.batchQueues.values()) {\n      queue.forEach(request => {\n        request.reject(new Error('Batch processor shutting down'));\n      });\n    }\n    \n    this.batchQueues.clear();\n    this.processingTasks.clear();\n    this.removeAllListeners();\n    \n    logger.info('Intelligent batch processor destroyed');\n  }\n}\n\n// Export singleton instance\nexport const intelligentBatchProcessor = new IntelligentBatchProcessor();