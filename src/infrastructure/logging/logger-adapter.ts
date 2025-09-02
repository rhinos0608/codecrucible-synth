/**
 * Logger Adapter - Infrastructure Layer
 *
 * Adapts the concrete logger implementation to the domain logger interface.
 * This allows the domain layer to depend on abstractions rather than concrete implementations.
 */

import { ILogger } from '../../domain/interfaces/logger.js';
import { logger as concreteLogger } from './logger.js';

// Re-export ILogger interface for convenience
export type { ILogger };

export class LoggerAdapter implements ILogger {
  constructor(private context?: string) {}

  info(message: string, meta?: any): void {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.info(contextMessage, meta);
  }

  error(message: string, error?: any): void {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.error(contextMessage, error);
  }

  warn(message: string, meta?: any): void {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.warn(contextMessage, meta);
  }

  debug(message: string, meta?: any): void {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.debug(contextMessage, meta);
  }

  trace(message: string, meta?: any): void {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.trace(contextMessage, meta);
  }
}

/**
 * Create a logger instance with optional context
 */
export function createLogger(context?: string): ILogger {
  return new LoggerAdapter(context);
}
