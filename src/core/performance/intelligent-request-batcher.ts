// Intelligent Request Batcher
// Core layer intelligent request batching

import { EventEmitter } from 'events';

export interface BatchRequest {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  priority: 'low' | 'medium' | 'high';
  timestamp: number;
}

export interface BatchResult {
  batchId: string;
  requests: BatchRequest[];
  results: Map<string, unknown>;
  executionTime: number;
  efficiency: number;
}

export interface BatchingConfig {
  maxBatchSize: number;
  maxWaitTime: number;
  enableIntelligentGrouping: boolean;
  priorityWeighting: boolean;
}

export interface IntelligentRequestBatcherInterface {
  addRequest(request: BatchRequest): Promise<string>;
  forceBatch(type?: string): Promise<BatchResult | null>;
  getQueuedRequests(): BatchRequest[];
  getBatchingStatistics(): Record<string, number>;
}

export class IntelligentRequestBatcher extends EventEmitter implements IntelligentRequestBatcherInterface {
  private config: BatchingConfig;
  private requestQueue = new Map<string, BatchRequest[]>();
  private batchTimeouts = new Map<string, NodeJS.Timeout>();
  private statistics = {
    totalRequests: 0,
    totalBatches: 0,
    averageBatchSize: 0,
    averageWaitTime: 0
  };

  constructor(config: Partial<BatchingConfig> = {}) {
    super();
    
    this.config = {
      maxBatchSize: 10,
      maxWaitTime: 1000, // 1 second
      enableIntelligentGrouping: true,
      priorityWeighting: true,
      ...config
    };
  }

  async addRequest(request: BatchRequest): Promise<string> {
    this.statistics.totalRequests++;

    const requestType = this.config.enableIntelligentGrouping 
      ? this.determineIntelligentType(request)
      : request.type;

    if (!this.requestQueue.has(requestType)) {
      this.requestQueue.set(requestType, []);
    }

    const queue = this.requestQueue.get(requestType)!;
    queue.push(request);

    // Sort by priority if enabled
    if (this.config.priorityWeighting) {
      queue.sort((a, b) => {
        const priorityValues = { high: 3, medium: 2, low: 1 };
        return priorityValues[b.priority] - priorityValues[a.priority];
      });
    }

    this.emit('request:queued', { requestId: request.id, type: requestType, queueSize: queue.length });

    // Check if batch is ready
    if (queue.length >= this.config.maxBatchSize) {
      return this.executeBatch(requestType);
    }

    // Set timeout for batch execution
    this.scheduleTimeout(requestType);

    return `queued:${request.id}`;
  }

  async forceBatch(type?: string): Promise<BatchResult | null> {
    if (type) {
      return this.executeBatch(type);
    }

    // Execute all pending batches
    const results: BatchResult[] = [];
    for (const requestType of this.requestQueue.keys()) {
      const result = await this.executeBatch(requestType);
      if (result) {
        results.push(result);
      }
    }

    return results.length > 0 ? results[0] : null;
  }

  getQueuedRequests(): BatchRequest[] {
    const allRequests: BatchRequest[] = [];
    for (const queue of this.requestQueue.values()) {
      allRequests.push(...queue);
    }
    return allRequests;
  }

  getBatchingStatistics(): Record<string, number> {
    return { ...this.statistics };
  }

  private determineIntelligentType(request: BatchRequest): string {
    // Intelligent grouping based on request characteristics
    const payload = request.payload;
    
    if (payload.operation === 'read' || payload.operation === 'query') {
      return 'read_batch';
    }
    
    if (payload.operation === 'write' || payload.operation === 'update') {
      return 'write_batch';
    }

    if (payload.model || payload.ai_request) {
      return 'ai_batch';
    }

    return request.type;
  }

  private scheduleTimeout(requestType: string): void {
    // Clear existing timeout
    const existingTimeout = this.batchTimeouts.get(requestType);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      await this.executeBatch(requestType);
    }, this.config.maxWaitTime);

    this.batchTimeouts.set(requestType, timeout);
  }

  private async executeBatch(requestType: string): Promise<BatchResult | null> {
    const queue = this.requestQueue.get(requestType);
    if (!queue || queue.length === 0) {
      return null;
    }

    const batchId = `batch_${requestType}_${Date.now()}`;
    const requests = queue.splice(0, this.config.maxBatchSize);
    const startTime = Date.now();

    // Clear timeout
    const timeout = this.batchTimeouts.get(requestType);
    if (timeout) {
      clearTimeout(timeout);
      this.batchTimeouts.delete(requestType);
    }

    this.emit('batch:started', { batchId, requestType, requestCount: requests.length });

    try {
      const results = await this.processBatch(requests);
      const executionTime = Date.now() - startTime;
      const efficiency = this.calculateEfficiency(requests.length, executionTime);

      const batchResult: BatchResult = {
        batchId,
        requests,
        results,
        executionTime,
        efficiency
      };

      // Update statistics
      this.statistics.totalBatches++;
      this.statistics.averageBatchSize = 
        (this.statistics.averageBatchSize * (this.statistics.totalBatches - 1) + requests.length) / this.statistics.totalBatches;

      this.emit('batch:completed', { batchResult });
      return batchResult;

    } catch (error) {
      this.emit('batch:error', { batchId, requestType, error });
      return null;
    }
  }

  private async processBatch(requests: BatchRequest[]): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>();

    // Group similar requests for optimal processing
    const groupedRequests = this.groupSimilarRequests(requests);

    for (const [operation, group] of groupedRequests) {
      try {
        const batchResult = await this.executeOperation(operation, group);
        
        // Map results back to individual requests
        group.forEach((request, index) => {
          results.set(request.id, {
            success: true,
            data: batchResult[index] || batchResult,
            batchProcessed: true
          });
        });

      } catch (error) {
        // Handle partial failures
        group.forEach(request => {
          results.set(request.id, {
            success: false,
            error: (error as Error).message,
            batchProcessed: true
          });
        });
      }
    }

    return results;
  }

  private groupSimilarRequests(requests: BatchRequest[]): Map<string, BatchRequest[]> {
    const groups = new Map<string, BatchRequest[]>();

    for (const request of requests) {
      const operation = this.extractOperation(request);
      
      if (!groups.has(operation)) {
        groups.set(operation, []);
      }
      
      groups.get(operation)!.push(request);
    }

    return groups;
  }

  private extractOperation(request: BatchRequest): string {
    const payload = request.payload;
    
    if (payload.operation) {
      return String(payload.operation);
    }
    
    if (payload.method) {
      return String(payload.method);
    }
    
    return request.type;
  }

  private async executeOperation(operation: string, requests: BatchRequest[]): Promise<unknown[]> {
    // Mock batch operation execution
    const results = [];
    
    for (const request of requests) {
      // Simulate processing time savings from batching
      const result = {
        operation,
        requestId: request.id,
        processed: true,
        batchSize: requests.length,
        timestamp: Date.now()
      };
      
      results.push(result);
    }

    // Simulate batch processing delay (shorter than individual processing)
    await new Promise(resolve => setTimeout(resolve, Math.min(50 * requests.length, 200)));
    
    return results;
  }

  private calculateEfficiency(batchSize: number, executionTime: number): number {
    // Higher efficiency for larger batches and shorter execution times
    const baseEfficiency = Math.min(batchSize / this.config.maxBatchSize, 1);
    const timeEfficiency = Math.max(0, 1 - executionTime / (this.config.maxWaitTime * 2));
    
    return (baseEfficiency + timeEfficiency) / 2;
  }
}

export const intelligentRequestBatcher = new IntelligentRequestBatcher();

// Export alias for backward compatibility
export const requestBatcher = intelligentRequestBatcher;