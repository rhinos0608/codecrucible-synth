import { EventEmitter } from 'events';
import { PerformanceProfiler } from '../performance/profiler.js';
import type { IEventBus } from '../../domain/interfaces/event-bus.js';

/**
 * Concrete Event Bus Implementation with optional Performance Profiling
 *
 * Infrastructure concerns (EventEmitter, profiling) live here.
 */
export class EventBus extends EventEmitter implements IEventBus {
  private performanceProfiler?: PerformanceProfiler;
  private eventSessions = new Map<string, string>(); // event -> sessionId mapping

  constructor(performanceProfiler?: PerformanceProfiler) {
    super();
    this.setMaxListeners(100); // Prevent memory leaks with many listeners
    this.performanceProfiler = performanceProfiler;
  }

  emit<T = any>(event: string, data: T): boolean {
    const eventId = `event_${event}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Start profiling for event emission if profiler is available
    let profilingSessionId: string | undefined;
    let emissionOperationId: string | undefined;

    if (this.performanceProfiler) {
      profilingSessionId = this.performanceProfiler.startSession(`event_emission_${eventId}`);
      this.eventSessions.set(eventId, profilingSessionId);

      emissionOperationId = this.performanceProfiler.startOperation(
        profilingSessionId,
        'event_emission',
        'event_bus',
        {
          eventType: event,
          eventId,
          handlerCount: this.listenerCount(event),
          dataSize: typeof data === 'object' ? JSON.stringify(data).length : String(data).length,
        }
      );
    }

    try {
      const result = super.emit(event, data);

      // End emission profiling on success
      if (this.performanceProfiler && profilingSessionId && emissionOperationId) {
        this.performanceProfiler.endOperation(profilingSessionId, emissionOperationId);
        this.performanceProfiler.endSession(profilingSessionId);
      }

      return result;
    } catch (error) {
      // End emission profiling on error
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

  on<T = any>(event: string, handler: (data: T) => void): this {
    if (this.performanceProfiler) {
      const originalHandler = handler;
      const handlerId = `handler_${event}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      const profiledHandler = (data: T) => {
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
          const result = originalHandler(data);

          if (this.performanceProfiler && handlerSessionId && handlerOperationId) {
            this.performanceProfiler.endOperation(handlerSessionId, handlerOperationId);
            this.performanceProfiler.endSession(handlerSessionId);
          }

          return result;
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

      return super.on(event, profiledHandler);
    } else {
      return super.on(event, handler);
    }
  }

  once<T = any>(event: string, handler: (data: T) => void): this {
    if (this.performanceProfiler) {
      const originalHandler = handler;
      const handlerId = `once_handler_${event}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      const profiledHandler = (data: T) => {
        let handlerSessionId: string | undefined;
        let handlerOperationId: string | undefined;

        if (this.performanceProfiler) {
          handlerSessionId = this.performanceProfiler.startSession(
            `event_once_handler_${handlerId}`
          );
          handlerOperationId = this.performanceProfiler.startOperation(
            handlerSessionId,
            'event_once_handler_execution',
            'event_bus',
            {
              eventType: event,
              handlerId,
            }
          );
        }

        try {
          const result = originalHandler(data);

          if (this.performanceProfiler && handlerSessionId && handlerOperationId) {
            this.performanceProfiler.endOperation(handlerSessionId, handlerOperationId);
            this.performanceProfiler.endSession(handlerSessionId);
          }

          return result;
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

      return super.once(event, profiledHandler);
    } else {
      return super.once(event, handler);
    }
  }
}
