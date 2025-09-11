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
  public constructor(private readonly context?: string) {}

  public info(message: string, meta?: unknown): void {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.info(
      contextMessage,
      meta && typeof meta === 'object' && meta !== null
        ? (meta as Record<string, unknown>)
        : undefined
    );
  }

  public error(message: string, error?: unknown): void {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.error(contextMessage, error instanceof Error ? error : undefined);
  }

  public warn(message: string, meta?: unknown): void {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.warn(
      contextMessage,
      meta && typeof meta === 'object' && meta !== null
        ? (meta as Readonly<Record<string, unknown>>)
        : undefined
    );
  }

  public debug(message: string, meta?: unknown): void {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.debug(
      contextMessage,
      meta && typeof meta === 'object' && meta !== null
        ? (meta as Record<string, unknown>)
        : undefined
    );
  }

  public trace(message: string, meta?: unknown): void {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.trace(
      contextMessage,
      meta && typeof meta === 'object' && meta !== null
        ? (meta as Record<string, unknown>)
        : undefined
    );
  }
}

/**
 * Create a logger instance with optional context
 */
export function createLogger(context?: string): ILogger {
  return new LoggerAdapter(context);
}
