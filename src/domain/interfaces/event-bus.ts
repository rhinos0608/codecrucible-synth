/**
 * Event Bus Interface for Decoupled Communication
 *
 * Domain layer contract only. No concrete implementations or Node APIs here.
 * Components communicate via events without direct references to each other.
 */

export interface IEventBus<TEventMap = Record<string, unknown>> {
  /** Emit an event */
  emit: <K extends keyof TEventMap>(event: K, data: TEventMap[K]) => void;

  /** Subscribe to an event */
  on: <K extends keyof TEventMap>(event: K, handler: (data: TEventMap[K]) => void) => void;

  /** Subscribe once */
  once: <K extends keyof TEventMap>(event: K, handler: (data: TEventMap[K]) => void) => void;

  /** Unsubscribe */
  off: <K extends keyof TEventMap>(event: K, handler: (data: TEventMap[K]) => void) => void;

  /** Remove all listeners for an event */
  removeAllListeners: (event?: keyof TEventMap) => void;
}

/**
 * System Events for decoupled communication
 */
export interface SystemEvents {
  // User Interaction Events
  'user:display': { message: string; type?: 'info' | 'warn' | 'error' | 'success' };
  'user:prompt': { question: string; options?: Record<string, unknown> };
  'user:progress': { message: string; progress?: number };

  // Tool Execution Events
  'tool:execute': { toolName: string; args: Record<string, unknown> };
  'tool:result': { toolName: string; result: unknown };
  'tool:error': { toolName: string; error: Error };

  // Model Events
  'model:request': { request: unknown };
  'model:response': { response: unknown };
  'model:error': { error: Error };

  // System Events
  'system:initialize': { component: string };
  'system:shutdown': { component: string };
  'system:error': { component: string; error: Error };

  // Security Events
  'security:violation': { type: string; details: Record<string, unknown> };
  'security:audit': { action: string; result: 'allow' | 'deny' };

  // Performance Events
  'performance:operation_start': {
    operationId: string;
    operationType: string;
    metadata?: Record<string, unknown>;
  };
  'performance:operation_end': {
    operationId: string;
    duration: number;
    status: 'success' | 'error';
    error?: Error;
  };
  'performance:slow_operation': {
    operationId: string;
    operationType: string;
    duration: number;
    threshold: number;
  };
  'performance:session_start': { sessionId: string; sessionType: string };
  'performance:session_end': { sessionId: string; summary: Record<string, unknown> };
}

// Global event bus reference for system-wide communication.
// Must be set by infrastructure or application layer.
let globalEventBus: IEventBus | null = null;

export function getGlobalEventBus(): IEventBus {
  if (!globalEventBus) {
    throw new Error(
      'Global event bus not initialized. Call setGlobalEventBus(...) during bootstrap.'
    );
  }
  return globalEventBus;
}

export function setGlobalEventBus(eventBus: Readonly<IEventBus>): void {
  globalEventBus = eventBus;
}
