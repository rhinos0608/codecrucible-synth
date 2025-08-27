/**
 * Event Bus Interface for Decoupled Communication
 * 
 * This breaks circular dependencies by allowing components to communicate
 * through events without direct references to each other.
 */

import { EventEmitter } from 'events';

export interface IEventBus {
  /**
   * Emit an event
   */
  emit<T = any>(event: string, data: T): void;
  
  /**
   * Subscribe to an event
   */
  on<T = any>(event: string, handler: (data: T) => void): void;
  
  /**
   * Subscribe to an event once
   */
  once<T = any>(event: string, handler: (data: T) => void): void;
  
  /**
   * Unsubscribe from an event
   */
  off<T = any>(event: string, handler: (data: T) => void): void;
  
  /**
   * Remove all listeners for an event
   */
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
}

/**
 * Concrete Event Bus Implementation
 */
export class EventBus extends EventEmitter implements IEventBus {
  constructor() {
    super();
    this.setMaxListeners(100); // Prevent memory leaks with many listeners
  }
  
  emit<T = any>(event: string, data: T): boolean {
    return super.emit(event, data);
  }
  
  on<T = any>(event: string, handler: (data: T) => void): this {
    return super.on(event, handler);
  }
  
  once<T = any>(event: string, handler: (data: T) => void): this {
    return super.once(event, handler);
  }
  
  off<T = any>(event: string, handler: (data: T) => void): this {
    return super.off(event, handler);
  }
}

/**
 * Global event bus singleton for system-wide communication
 */
let globalEventBus: IEventBus | null = null;

export function getGlobalEventBus(): IEventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}

export function setGlobalEventBus(eventBus: IEventBus): void {
  globalEventBus = eventBus;
}