/**
 * Logger Adapter - Infrastructure Layer
 *
 * Adapts the concrete logger implementation to the domain logger interface.
 * This allows the domain layer to depend on abstractions rather than concrete implementations.
 */

import { ILogger } from '../../domain/interfaces/logger.js';
import { logger as concreteLogger } from './logger.js';
import { createSerializableObject, safeLogger } from '../../utils/safe-json.js';

// Re-export ILogger interface for convenience
export type { ILogger };

export class LoggerAdapter implements ILogger {
  public constructor(private readonly context?: string) {}

  /**
   * Safely serialize metadata for logging to prevent circular reference errors
   */
  private safeMeta(meta: unknown): Record<string, unknown> | undefined {
    if (!meta || typeof meta !== 'object' || meta === null) {
      return undefined;
    }

    try {
      // Use safe serialization to prevent circular reference errors
      const safeMeta = createSerializableObject(meta, {
        maxDepth: 4,
        maxStringLength: 300,
        showTypeInfo: false,
      });
      return safeMeta as Record<string, unknown>;
    } catch {
      // Final fallback - just return type info
      return {
        type: typeof meta,
        constructor: (meta as any)?.constructor?.name,
        serialization_error: 'Failed to serialize metadata safely',
      };
    }
  }

  public info(message: string, meta?: unknown): void {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.info(contextMessage, this.safeMeta(meta));
  }

  public error(message: string, error?: unknown): void {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;

    // Special handling for errors to preserve stack traces
    if (error instanceof Error) {
      concreteLogger.error(contextMessage, {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause ? this.safeMeta(error.cause) : undefined,
      });
    } else if (error !== undefined) {
      concreteLogger.error(contextMessage, this.safeMeta(error));
    } else {
      concreteLogger.error(contextMessage);
    }
  }

  public warn(message: string, meta?: unknown): void {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.warn(contextMessage, this.safeMeta(meta));
  }

  public debug(message: string, meta?: unknown): void {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.debug(contextMessage, this.safeMeta(meta));
  }

  public trace(message: string, meta?: unknown): void {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.trace(contextMessage, this.safeMeta(meta));
  }
}

/**
 * Create a logger instance with optional context
 */
export function createLogger(context?: string): ILogger {
  return new LoggerAdapter(context);
}
