/**
 * Logger Adapter - Infrastructure Layer
 *
 * Adapts the concrete logger implementation to the domain logger interface.
 * This allows the domain layer to depend on abstractions rather than concrete implementations.
 */
import { logger as concreteLogger } from './logger.js';
export class LoggerAdapter {
  constructor(context) {
    this.context = context;
  }
  info(message, meta) {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.info(contextMessage, meta);
  }
  error(message, error) {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.error(contextMessage, error);
  }
  warn(message, meta) {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.warn(contextMessage, meta);
  }
  debug(message, meta) {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.debug(contextMessage, meta);
  }
  trace(message, meta) {
    const contextMessage = this.context ? `[${this.context}] ${message}` : message;
    concreteLogger.trace(contextMessage, meta);
  }
}
/**
 * Create a logger instance with optional context
 */
export function createLogger(context) {
  return new LoggerAdapter(context);
}
