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
    }
  }
  
  /**
   * Process a batch of requests
   */
  private async processBatch(batchKey: string): Promise<void> {
    const batch = this.batchQueues.get(batchKey);
    if (!batch || batch.length === 0) return;
    
    // Check concurrent batch limit
    if (this.activeBatches >= this.config.maxConcurrentBatches) {
      logger.debug(`Batch processing delayed - concurrent limit reached (${this.activeBatches})`);
      return;
    }
    
    // Remove from queue immediately
    this.batchQueues.set(batchKey, []);
    
    // Clear timeout
    const timeout = this.batchTimeouts.get(batchKey);
    if (timeout) {
      clearTimeout(timeout);
      this.batchTimeouts.delete(batchKey);
    }
    
    this.activeBatches++;
    const batchId = this.generateBatchId();
    const startTime = Date.now();
    
    try {
      logger.info(`Processing batch ${batchId} with ${batch.length} requests`);
      
      // Process batch with intelligent parallelization
      const results = await this.processIntelligentBatch(batch);
      
      // Distribute responses back to waiting requests
      this.distributeResponses(batch, results);
      
      const processingTime = Date.now() - startTime;
      const successCount = results.filter(r => !r.error).length;
      const errorCount = results.length - successCount;
      
      this.emit('batch-completed', {
        batchId,
        results,
        processingTime,
        successCount,
        errorCount
      } as BatchResult);
      
      logger.info(`Batch ${batchId} completed in ${processingTime}ms (${successCount}/${results.length} successful)`);
      
    } catch (error) {
      logger.error(`Batch processing failed:`, error);
      this.handleBatchError(batch, error as Error);
    } finally {
      this.activeBatches--;
      
      // Process next batch if any are waiting
      this.processNextBatch();
    }
  }
  
  /**
   * Process batch with intelligent parallelization
   */
  private async processIntelligentBatch(batch: BatchRequest[]): Promise<any[]> {
    // Simulate processing for now - integrate with actual AI client later
    const results = await Promise.all(batch.map(async (request) => {
      try {
        // Placeholder for actual AI processing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        return {
          content: `Response for: ${request.prompt.substring(0, 50)}...`,
          requestId: request.id,
          processingTime: Math.random() * 1000
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Processing failed',
          requestId: request.id
        };
      }
    }));
    
    return results;
  }
  
  /**
   * Distribute responses back to waiting requests
   */
  private distributeResponses(batch: BatchRequest[], results: any[]): void {
    batch.forEach((request, index) => {
      const result = results[index];
      
      if (result && !result.error) {
        request.resolve(result);
      } else {
        request.reject(new Error(result?.error || 'Processing failed'));
      }
    });
  }
  
  /**
   * Handle batch processing error
   */
  private handleBatchError(batch: BatchRequest[], error: Error): void {
    batch.forEach(request => {
      request.reject(error);
    });
  }
  
  /**
   * Process next waiting batch
   */
  private processNextBatch(): void {
    // Process highest priority batches first
    for (const priority of this.config.priorityLevels) {
      const batch = this.batchQueues.get(priority);
      if (batch && batch.length > 0) {
        setTimeout(() => this.processBatch(priority), 0);
        break;
      }
    }
  }
  
  /**
   * Get priority level as number
   */
  private getPriorityLevel(priority: string): number {
    const index = this.config.priorityLevels.indexOf(priority);
    return index !== -1 ? index : 1; // Default to medium priority
  }
  
  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get current batch processing status
   */
  getStatus(): {
    activeBatches: number;
    queuedRequests: number;
    totalQueues: number;
  } {
    const queuedRequests = Array.from(this.batchQueues.values())
      .reduce((total, queue) => total + queue.length, 0);
    
    return {
      activeBatches: this.activeBatches,
      queuedRequests,
      totalQueues: this.batchQueues.size
    };
  }
  
  /**
   * Cleanup and destroy processor
   */
  async destroy(): Promise<void> {
    // Clear all timeouts
    for (const timeout of this.batchTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.batchTimeouts.clear();
    
    // Wait for active batches to complete (with timeout)
    const maxWait = 10000; // 10 seconds
    const start = Date.now();
    
    while (this.activeBatches > 0 && (Date.now() - start) < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Reject all pending requests
    for (const queue of this.batchQueues.values()) {
      queue.forEach(request => {
        request.reject(new Error('Batch processor shutting down'));
      });
    }
    
    this.batchQueues.clear();
    this.processingTasks.clear();
    this.removeAllListeners();
    
    logger.info('Intelligent batch processor destroyed');
  }
}

// Export singleton instance
export const intelligentBatchProcessor = new IntelligentBatchProcessor();