/**
 * Event Bus Interface for Decoupled Communication
 *
 * Domain layer contract only. No concrete implementations or Node APIs here.
 * Components communicate via events without direct references to each other.
 */

export interface IEventBus {
  /** Emit an event */
  emit<T = any>(event: string, data: T): void;

  /** Subscribe to an event */
  on<T = any>(event: string, handler: (data: T) => void): void;

  /** Subscribe once */
  once<T = any>(event: string, handler: (data: T) => void): void;

  /** Unsubscribe */
  off<T = any>(event: string, handler: (data: T) => void): void;

  /** Remove all listeners for an event */
  removeAllListeners(event?: string): void;
}

/**
 * System Events for decoupled communication
 */
export interface SystemEvents {
  // User Interaction Events
  'user:display': { message: string; type?: 'info' | 'warn' | 'error' | 'success' };
  'user:prompt': { question: string; options?: any };
  'user:progress': { message: string; progress?: number };

  // Tool Execution Events
  'tool:execute': { toolName: string; args: any };
  'tool:result': { toolName: string; result: any };
  'tool:error': { toolName: string; error: Error };

  // Model Events
  'model:request': { request: any };
  'model:response': { response: any };
  'model:error': { error: Error };

  // System Events
  'system:initialize': { component: string };
  'system:shutdown': { component: string };
  'system:error': { component: string; error: Error };

  // Security Events
  'security:violation': { type: string; details: any };
  'security:audit': { action: string; result: 'allow' | 'deny' };

  // Performance Events
  'performance:operation_start': { operationId: string; operationType: string; metadata?: any };
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
  'performance:session_end': { sessionId: string; summary: any };
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

export function setGlobalEventBus(eventBus: IEventBus): void {
  globalEventBus = eventBus;
}
