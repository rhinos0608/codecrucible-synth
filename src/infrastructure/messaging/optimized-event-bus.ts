/**
 * Optimized Event Bus Implementation - Phase 2 Final Optimization
 *
 * Implements comprehensive event bus optimization with:
 * - Batch event processing
 * - Priority queue for critical events
 * - Event deduplication
 * - Performance profiling integration
 * - Resource management and monitoring
 */

import { EventEmitter } from 'events';
import { IEventBus } from '../../domain/interfaces/event-bus.js';
import { PerformanceProfiler } from '../performance/profiler.js';
import { createLogger } from '../logging/logger-adapter.js';

export interface EventBusConfig {
  batching: {
    enabled: boolean;
    batchSize: number;
    batchTimeoutMs: number;
    maxBatchWaitMs: number;
  };
  priorityQueue: {
    enabled: boolean;
    maxQueueSize: number;
    priorities: Record<string, number>;
    dropPolicy: 'oldest' | 'lowest-priority';
  };
  deduplication: {
    enabled: boolean;
    windowMs: number;
    maxDuplicates: number;
    keyExtractor?: (event: string, data: unknown) => string;
  };
  profiling: {
    enabled: boolean;
    profileHandlers: boolean;
    profileBatches: boolean;
  };
}

export interface QueuedEvent<T = unknown> {
  id: string;
  event: string;
  data: T;
  priority: number;
  timestamp: number;
  attempts: number;
  batchId?: string;
}

export interface BatchProcessingResult {
  batchId: string;
  eventCount: number;
  processingTime: number;
  successCount: number;
  errorCount: number;
  eventTypes: string[];
}

export interface EventBusStats {
  totalEvents: number;
  batchedEvents: number;
  priorityQueuedEvents: number;
  deduplicatedEvents: number;
  droppedEvents: number;
  averageBatchSize: number;
  averageProcessingTime: number;
  currentQueueSizes: {
    eventQueue: number;
    priorityQueue: number;
  };
  deduplicationMapSize: number;
}

/**
 * Enterprise-grade optimized EventBus with advanced processing capabilities
 */
export class OptimizedEventBus extends EventEmitter implements IEventBus {
  private readonly performanceProfiler?: PerformanceProfiler;
  private config: EventBusConfig;
  private logger = createLogger('OptimizedEventBus');

  // Performance profiling
  private readonly eventSessions = new Map<string, string>();
  private readonly handlerTimings = new Map<string, number>();

  // Batching system
  private eventQueue: QueuedEvent[] = [];
  private batchTimer?: NodeJS.Timeout;
  private batchCounter = 0;
  private currentBatchId?: string;

  // Priority queue system
  private priorityQueue: QueuedEvent[] = [];

  // Deduplication system
  private readonly recentEvents = new Map<string, { count: number; lastSeen: number }>();
  private deduplicationCleanupTimer?: NodeJS.Timeout;

  // Statistics
  private readonly stats: EventBusStats = {
    totalEvents: 0,
    batchedEvents: 0,
    priorityQueuedEvents: 0,
    deduplicatedEvents: 0,
    droppedEvents: 0,
    averageBatchSize: 0,
    averageProcessingTime: 0,
    currentQueueSizes: {
      eventQueue: 0,
      priorityQueue: 0,
    },
    deduplicationMapSize: 0,
  };

  public constructor(
    performanceProfiler?: PerformanceProfiler,
    config?: Readonly<Partial<EventBusConfig>>
  ) {
    super();
    this.setMaxListeners(100);

    this.performanceProfiler = performanceProfiler;
    this.config = {
      batching: {
        enabled: true,
        batchSize: 10,
        batchTimeoutMs: 100,
        maxBatchWaitMs: 1000,
      },
      priorityQueue: {
        enabled: true,
        maxQueueSize: 1000,
        priorities: {
          'system:error': 10,
          'security:violation': 9,
          'tool:error': 8,
          'model:error': 7,
          'performance:slow_operation': 6,
          'user:display': 5,
          'tool:execute': 4,
          'model:request': 3,
          'performance:operation_start': 2,
          'performance:operation_end': 1,
        },
        dropPolicy: 'lowest-priority',
      },
      deduplication: {
        enabled: true,
        windowMs: 5000,
        maxDuplicates: 3,
        keyExtractor: (event: string, data: unknown): string => {
          const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
          return `${event}:${dataStr}`;
        },
      },
      profiling: {
        enabled: true,
        profileHandlers: true,
        profileBatches: true,
      },
      ...config,
    };

    this.setupBatchProcessing();
    this.setupDeduplicationCleanup();

    this.logger.info('OptimizedEventBus initialized', {
      batchingEnabled: this.config.batching.enabled,
      priorityQueueEnabled: this.config.priorityQueue.enabled,
      deduplicationEnabled: this.config.deduplication.enabled,
    });
  }

  /**
   * Emit an event with comprehensive optimization pipeline
   */
  public override emit<T = unknown>(event: string, data: T): boolean {
    this.stats.totalEvents++;

    // Phase 1: Deduplication check
    if (this.config.deduplication.enabled && this.shouldDeduplicate(event, data)) {
      this.stats.deduplicatedEvents++;
      return true; // Event was "processed" (deduplicated)
    }

    // Phase 2: Create queued event
    const queuedEvent: QueuedEvent<T> = {
      id: `event_${event}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      event,
      data,
      priority: this.getEventPriority(event),
      timestamp: Date.now(),
      attempts: 0,
    };

    // Phase 3: Priority queue processing for critical events
    if (this.config.priorityQueue.enabled && this.shouldUsePriorityQueue(event)) {
      return this.addToPriorityQueue(queuedEvent);
    }

    // Phase 4: Batch processing for non-critical events
    if (this.config.batching.enabled && this.shouldBatch(event)) {
      return this.addToBatch(queuedEvent);
    }

    // Phase 5: Direct emission (fallback)
    return this.emitDirect(queuedEvent);
  }

  /**
   * Subscribe to an event with optional profiled handler
   */
  public override on<T = unknown>(event: string, handler: (data: T) => void): this {
    if (
      this.config.profiling.enabled &&
      this.config.profiling.profileHandlers &&
      this.performanceProfiler
    ) {
      const profiledHandler = this.createProfiledHandler(event, handler);
      return super.on(event, profiledHandler);
    } else {
      return super.on(event, handler);
    }
  }

  /**
   * Subscribe once with optional profiled handler
   */
  public override once<T = unknown>(event: string, handler: (data: T) => void): this {
    if (
      this.config.profiling.enabled &&
      this.config.profiling.profileHandlers &&
      this.performanceProfiler
    ) {
      const profiledHandler = this.createProfiledHandler(event, handler);
      return super.once(event, profiledHandler);
    } else {
      return super.once(event, handler);
    }
  }

  /**
   * Unsubscribe from an event
   */
  public override off<T = unknown>(event: string, handler: (data: T) => void): this {
    return super.off(event, handler);
  }

  /**
   * Remove all listeners for an event
   */
  public override removeAllListeners(event?: string): this {
    return super.removeAllListeners(event);
  }

  // ==========================================
  // OPTIMIZATION IMPLEMENTATION METHODS
  // ==========================================

  /**
   * Check if event should be deduplicated
   */
  private shouldDeduplicate<T>(event: string, data: T): boolean {
    if (!this.config.deduplication.keyExtractor) {
      throw new Error('Deduplication keyExtractor is not defined');
    }
    const deduplicationKey = this.config.deduplication.keyExtractor(event, data);
    const recentEvent = this.recentEvents.get(deduplicationKey);

    if (recentEvent) {
      const timeSinceLastSeen = Date.now() - recentEvent.lastSeen;

      if (timeSinceLastSeen < this.config.deduplication.windowMs) {
        recentEvent.count++;
        recentEvent.lastSeen = Date.now();

        // Drop if too many duplicates
        return recentEvent.count > this.config.deduplication.maxDuplicates;
      } else {
        // Reset counter if outside window
        recentEvent.count = 1;
        recentEvent.lastSeen = Date.now();
      }
    } else {
      this.recentEvents.set(deduplicationKey, { count: 1, lastSeen: Date.now() });
    }

    return false;
  }

  /**
   * Add event to priority queue
   */
  private addToPriorityQueue<T>(queuedEvent: QueuedEvent<T>): boolean {
    if (this.priorityQueue.length >= this.config.priorityQueue.maxQueueSize) {
      this.handleQueueOverflow();
    }

    this.priorityQueue.push(queuedEvent);
    this.stats.priorityQueuedEvents++;

    // Sort by priority (higher priority first)
    this.priorityQueue.sort((a, b) => b.priority - a.priority);

    // Process queue immediately for high priority events
    if (queuedEvent.priority >= 8) {
      setImmediate(() => {
        this.processPriorityQueue();
      });
    } else {
      process.nextTick(() => {
        this.processPriorityQueue();
      });
    }

    this.updateQueueSizes();
    return true;
  }

  /**
   * Add event to batch for processing
   */
  private addToBatch<T>(queuedEvent: QueuedEvent<T>): boolean {
    if (!this.currentBatchId) {
      this.currentBatchId = `batch_${Date.now()}_${++this.batchCounter}`;
    }

    queuedEvent.batchId = this.currentBatchId;
    this.eventQueue.push(queuedEvent);
    this.stats.batchedEvents++;

    // Trigger batch processing if batch is full
    if (this.eventQueue.length >= this.config.batching.batchSize) {
      void this.processBatch();
    } else if (!this.batchTimer) {
      // Set timer for batch timeout
      this.batchTimer = setTimeout(() => {
        void this.processBatch();
      }, this.config.batching.batchTimeoutMs);
    }

    this.updateQueueSizes();
    return true;
  }

  /**
   * Process events in batch
   */
  private async processBatch(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const batchStartTime = Date.now();
    if (!this.currentBatchId) {
      this.logger.error('No current batch ID when processing batch');
      return;
    }
    const batchId = this.currentBatchId;
    const batch = [...this.eventQueue];

    // Clear current batch
    this.eventQueue = [];
    this.currentBatchId = undefined;

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    let successCount = 0;
    let errorCount = 0;
    const eventTypes = new Set<string>();

    // Start batch profiling
    let profilingSessionId: string | undefined;
    let batchOperationId: string | undefined;

    if (
      this.config.profiling.enabled &&
      this.config.profiling.profileBatches &&
      this.performanceProfiler
    ) {
      profilingSessionId = this.performanceProfiler.startSession(`batch_processing_${batchId}`);
      batchOperationId = this.performanceProfiler.startOperation(
        profilingSessionId,
        'event_batch_processing',
        'event_bus',
        {
          batchId,
          batchSize: batch.length,
          eventTypes: Array.from(new Set(batch.map(e => e.event))) as readonly string[],
        }
      );
    }

    try {
      // Process all events in the batch
      const promises = batch.map(queuedEvent => {
        try {
          eventTypes.add(queuedEvent.event);
          const result = this.emitDirect(queuedEvent);
          if (result) successCount++;
          return result;
        } catch (error) {
          errorCount++;
          this.logger.error('Batch event processing error', { eventId: queuedEvent.id, error });
          return false;
        }
      });

      await Promise.allSettled(promises);

      const processingTime = Date.now() - batchStartTime;

      // Update statistics
      this.updateBatchStats(batch.length, processingTime);
      this.updateQueueSizes();

      // Emit batch processed event
      super.emit('eventbus:batch_processed', {
        batchSize: batch.length,
        processingTime,
        eventTypes: Array.from(eventTypes),
      });

      if (this.performanceProfiler && profilingSessionId && batchOperationId) {
        this.performanceProfiler.endOperation(profilingSessionId, batchOperationId);
        this.performanceProfiler.endSession(profilingSessionId);
      }

      this.logger.debug('Batch processing completed', {
        batchId,
        eventCount: batch.length,
        successCount,
        errorCount,
        processingTime,
      });
    } catch (error) {
      if (this.performanceProfiler && profilingSessionId && batchOperationId) {
        this.performanceProfiler.endOperation(profilingSessionId, batchOperationId, error as Error);
        this.performanceProfiler.endSession(profilingSessionId);
      }

      this.logger.error('Batch processing failed', { batchId, error });
      throw error;
    }
  }

  /**
   * Process priority queue
   */
  private processPriorityQueue(): void {
    if (this.priorityQueue.length === 0) return;

    // Process highest priority events first
    const eventsToProcess = this.priorityQueue.splice(0, Math.min(5, this.priorityQueue.length));

    eventsToProcess.forEach(queuedEvent => {
      try {
        this.emitDirect(queuedEvent);
      } catch (error) {
        this.logger.error('Priority queue processing error', {
          eventId: queuedEvent.id,
          priority: queuedEvent.priority,
          error,
        });
      }
    });

    // Schedule next processing if more events remain
    if (this.priorityQueue.length > 0) {
      setImmediate(() => {
        this.processPriorityQueue();
      });
    }

    this.updateQueueSizes();
  }

  /**
   * Direct event emission with optional profiling
   */
  private emitDirect<T>(queuedEvent: QueuedEvent<T>): boolean {
    const eventId = queuedEvent.id;

    // Start profiling for event emission if enabled
    let profilingSessionId: string | undefined;
    let emissionOperationId: string | undefined;

    if (this.config.profiling.enabled && this.performanceProfiler) {
      profilingSessionId = this.performanceProfiler.startSession(`direct_emission_${eventId}`);
      this.eventSessions.set(eventId, profilingSessionId);

      emissionOperationId = this.performanceProfiler.startOperation(
        profilingSessionId,
        'direct_event_emission',
        'event_bus',
        {
          eventType: queuedEvent.event,
          eventId,
          priority: queuedEvent.priority,
          handlerCount: this.listenerCount(queuedEvent.event),
        }
      );
    }

    try {
      const result = super.emit(queuedEvent.event, queuedEvent.data);

      if (this.performanceProfiler && profilingSessionId && emissionOperationId) {
        this.performanceProfiler.endOperation(profilingSessionId, emissionOperationId);
        this.performanceProfiler.endSession(profilingSessionId);
      }

      return result;
    } catch (error) {
      if (this.performanceProfiler && profilingSessionId && emissionOperationId) {
        this.performanceProfiler.endOperation(
          profilingSessionId,
          emissionOperationId,
          error as Error
        );
        this.performanceProfiler.endSession(profilingSessionId);
      }

      throw error;
    }
  }

  /**
   * Create a profiled event handler wrapper
   */
  private createProfiledHandler<T>(
    event: string,
    originalHandler: (data: T) => void
  ): (data: T) => void {
    const handlerId = `handler_${event}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    return (data: T) => {
      let handlerSessionId: string | undefined;
      let handlerOperationId: string | undefined;

      if (this.performanceProfiler) {
        handlerSessionId = this.performanceProfiler.startSession(`event_handler_${handlerId}`);
        handlerOperationId = this.performanceProfiler.startOperation(
          handlerSessionId,
          'event_handler_execution',
          'event_bus',
          {
            eventType: event,
            handlerId,
          }
        );
      }

      try {
        originalHandler(data);

        if (this.performanceProfiler && handlerSessionId && handlerOperationId) {
          this.performanceProfiler.endOperation(handlerSessionId, handlerOperationId);
          this.performanceProfiler.endSession(handlerSessionId);
        }

        return;
      } catch (error) {
        if (this.performanceProfiler && handlerSessionId && handlerOperationId) {
          this.performanceProfiler.endOperation(
            handlerSessionId,
            handlerOperationId,
            error as Error
          );
          this.performanceProfiler.endSession(handlerSessionId);
        }

        throw error;
      }
    };
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Get event priority based on event type
   */
  private getEventPriority(event: string): number {
    return this.config.priorityQueue.priorities[event] || 1;
  }

  /**
   * Determine if event should use priority queue
   */
  private shouldUsePriorityQueue(event: string): boolean {
    return this.getEventPriority(event) >= 6; // High priority events
  }

  /**
   * Determine if event should be batched
   */
  private shouldBatch(event: string): boolean {
    // Don't batch critical events
    if (this.shouldUsePriorityQueue(event)) {
      return false;
    }

    // Batch performance and monitoring events
    return (
      event.startsWith('performance:') ||
      event.startsWith('monitoring:') ||
      event === 'user:progress'
    );
  }

  /**
   * Handle queue overflow
   */
  private handleQueueOverflow(): void {
    const droppedEvents = this.priorityQueue.length - this.config.priorityQueue.maxQueueSize + 1;

    if (this.config.priorityQueue.dropPolicy === 'oldest') {
      this.priorityQueue.splice(0, droppedEvents);
    } else {
      // Drop lowest priority events
      this.priorityQueue.sort((a, b) => b.priority - a.priority);
      this.priorityQueue.splice(-droppedEvents, droppedEvents);
    }

    this.stats.droppedEvents += droppedEvents;

    // Emit queue full event
    super.emit('eventbus:priority_queue_full', {
      queueSize: this.priorityQueue.length,
      droppedEvents,
    });

    this.logger.warn('Priority queue overflow', { droppedEvents });
  }

  /**
   * Setup batch processing system
   */
  private setupBatchProcessing(): void {
    // Batch processing is handled dynamically in addToBatch
  }

  /**
   * Setup deduplication cleanup
   */
  private setupDeduplicationCleanup(): void {
    this.deduplicationCleanupTimer = setInterval(() => {
      const now = Date.now();
      const cutoff = now - this.config.deduplication.windowMs * 2;

      const originalCount = this.recentEvents.size;

      for (const [key, event] of this.recentEvents) {
        if (event.lastSeen < cutoff) {
          this.recentEvents.delete(key);
        }
      }

      const cleanedCount = originalCount - this.recentEvents.size;
      this.stats.deduplicationMapSize = this.recentEvents.size;

      if (cleanedCount > 0) {
        super.emit('eventbus:deduplication', {
          originalCount,
          deduplicatedCount: cleanedCount,
        });
      }
    }, this.config.deduplication.windowMs);
  }

  /**
   * Update batch statistics
   */
  private updateBatchStats(batchSize: number, processingTime: number): void {
    const alpha = 0.1; // Smoothing factor for exponential moving average

    this.stats.averageBatchSize = alpha * batchSize + (1 - alpha) * this.stats.averageBatchSize;

    this.stats.averageProcessingTime =
      alpha * processingTime + (1 - alpha) * this.stats.averageProcessingTime;
  }

  /**
   * Update queue size statistics
   */
  private updateQueueSizes(): void {
    this.stats.currentQueueSizes = {
      eventQueue: this.eventQueue.length,
      priorityQueue: this.priorityQueue.length,
    };
  }

  /**
   * Get comprehensive event bus statistics
   */
  public getEventBusStats(): EventBusStats & { config: EventBusConfig } {
    this.updateQueueSizes();
    this.stats.deduplicationMapSize = this.recentEvents.size;

    return {
      ...this.stats,
      config: this.config,
    };
  }

  /**
   * Update configuration at runtime
   */
  public updateConfig(updates: Readonly<Partial<EventBusConfig>>): void {
    this.config = {
      ...this.config,
      ...updates,
      batching: { ...this.config.batching, ...updates.batching },
      priorityQueue: { ...this.config.priorityQueue, ...updates.priorityQueue },
      deduplication: { ...this.config.deduplication, ...updates.deduplication },
      profiling: { ...this.config.profiling, ...updates.profiling },
    };

    this.logger.info('EventBus configuration updated', { updates });
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    // Clear timers
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    if (this.deduplicationCleanupTimer) {
      clearInterval(this.deduplicationCleanupTimer);
    }

    // Process remaining queued events
    if (this.eventQueue.length > 0) {
      void this.processBatch();
    }

    // Clear all maps and queues
    this.eventQueue = [];
    this.priorityQueue = [];
    this.recentEvents.clear();
    this.eventSessions.clear();
    this.handlerTimings.clear();

    this.logger.info('OptimizedEventBus destroyed', {
      finalStats: this.getEventBusStats(),
    });
  }
}
