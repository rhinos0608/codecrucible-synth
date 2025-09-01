/**
 * Structured Logger using Pino
 * 
 * Provides structured logging capabilities to replace console usage
 * and improve production debugging and tracing.
 */

import pino from 'pino';
import { randomUUID } from 'crypto';

export interface LoggerConfig {
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  prettyPrint?: boolean;
  destination?: string;
}

export interface CorrelationContext {
  correlationId: string;
  userId?: string;
  sessionId?: string;
  component?: string;
  [key: string]: any;
}

/**
 * Correlation ID helper for request tracing
 */
export class CorrelationIdHelper {
  private static correlationStore = new Map<string, CorrelationContext>();
  
  /**
   * Generate a new correlation ID
   */
  static generate(): string {
    return randomUUID();
  }
  
  /**
   * Set correlation context for current operation
   */
  static setContext(correlationId: string, context: Partial<CorrelationContext>): void {
    this.correlationStore.set(correlationId, {
      correlationId,
      ...context
    });
  }
  
  /**
   * Get correlation context
   */
  static getContext(correlationId: string): CorrelationContext | undefined {
    return this.correlationStore.get(correlationId);
  }
  
  /**
   * Clear correlation context
   */
  static clear(correlationId: string): void {
    this.correlationStore.delete(correlationId);
  }
  
  /**
   * Clear all correlation contexts (useful for cleanup)
   */
  static clearAll(): void {
    this.correlationStore.clear();
  }
}

/**
 * Structured Logger wrapper using Pino
 */
export class StructuredLogger {
  private pinoLogger: pino.Logger;
  private defaultContext: Record<string, any> = {};
  
  constructor(config: LoggerConfig = {}) {
    const logLevel = config.level || 
                    (process.env.LOG_LEVEL as LoggerConfig['level']) || 
                    'info';
    
    const pinoConfig: pino.LoggerOptions = {
      level: logLevel,
      base: {
        pid: process.pid,
        hostname: process.env.HOSTNAME || 'unknown'
      },
      timestamp: pino.stdTimeFunctions.isoTime
    };
    
    // Add pretty printing for development
    if (config.prettyPrint || process.env.NODE_ENV === 'development') {
      pinoConfig.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      };
    }
    
    // Create pino logger with optional destination
    if (config.destination) {
      this.pinoLogger = pino(pinoConfig, pino.destination(config.destination));
    } else {
      this.pinoLogger = pino(pinoConfig);
    }
  }
  
  /**
   * Set default context that will be included in all log entries
   */
  setContext(context: Record<string, any>): void {
    this.defaultContext = { ...this.defaultContext, ...context };
  }
  
  /**
   * Create child logger with additional context
   */
  child(context: Record<string, any>): StructuredLogger {
    const childLogger = new StructuredLogger();
    childLogger.pinoLogger = this.pinoLogger.child(context);
    childLogger.defaultContext = { ...this.defaultContext, ...context };
    return childLogger;
  }
  
  /**
   * Log at trace level
   */
  trace(message: string, meta?: Record<string, any>, correlationId?: string): void {
    this.log('trace', message, meta, correlationId);
  }
  
  /**
   * Log at debug level
   */
  debug(message: string, meta?: Record<string, any>, correlationId?: string): void {
    this.log('debug', message, meta, correlationId);
  }
  
  /**
   * Log at info level
   */
  info(message: string, meta?: Record<string, any>, correlationId?: string): void {
    this.log('info', message, meta, correlationId);
  }
  
  /**
   * Log at warn level
   */
  warn(message: string, meta?: Record<string, any>, correlationId?: string): void {
    this.log('warn', message, meta, correlationId);
  }
  
  /**
   * Log at error level
   */
  error(message: string, error?: Error | Record<string, any>, correlationId?: string): void {
    let meta: Record<string, any> = {};
    
    if (error instanceof Error) {
      meta = {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      };
    } else if (error && typeof error === 'object') {
      meta = error;
    }
    
    this.log('error', message, meta, correlationId);
  }
  
  /**
   * Log at fatal level
   */
  fatal(message: string, error?: Error | Record<string, any>, correlationId?: string): void {
    let meta: Record<string, any> = {};
    
    if (error instanceof Error) {
      meta = {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      };
    } else if (error && typeof error === 'object') {
      meta = error;
    }
    
    this.log('fatal', message, meta, correlationId);
  }
  
  /**
   * Core logging method
   */
  private log(level: string, message: string, meta?: Record<string, any>, correlationId?: string): void {
    const logData = {
      ...this.defaultContext,
      ...meta
    };
    
    // Add correlation context if available
    if (correlationId) {
      const correlationContext = CorrelationIdHelper.getContext(correlationId);
      if (correlationContext) {
        logData.correlation = correlationContext;
      } else {
        logData.correlationId = correlationId;
      }
    }
    
    this.pinoLogger[level as keyof pino.Logger](logData, message);
  }
  
  /**
   * Get the underlying Pino logger instance for advanced usage
   */
  getPinoInstance(): pino.Logger {
    return this.pinoLogger;
  }
}

// Default logger instance
const defaultLogger = new StructuredLogger({
  prettyPrint: process.env.NODE_ENV === 'development'
});

// Export convenience functions that use the default logger
export const logger = {
  trace: (message: string, meta?: Record<string, any>, correlationId?: string) => 
    defaultLogger.trace(message, meta, correlationId),
  debug: (message: string, meta?: Record<string, any>, correlationId?: string) => 
    defaultLogger.debug(message, meta, correlationId),
  info: (message: string, meta?: Record<string, any>, correlationId?: string) => 
    defaultLogger.info(message, meta, correlationId),
  warn: (message: string, meta?: Record<string, any>, correlationId?: string) => 
    defaultLogger.warn(message, meta, correlationId),
  error: (message: string, error?: Error | Record<string, any>, correlationId?: string) => 
    defaultLogger.error(message, error, correlationId),
  fatal: (message: string, error?: Error | Record<string, any>, correlationId?: string) => 
    defaultLogger.fatal(message, error, correlationId),
  child: (context: Record<string, any>) => defaultLogger.child(context),
  setContext: (context: Record<string, any>) => defaultLogger.setContext(context)
};

// Export types and classes
export default StructuredLogger;
export { CorrelationIdHelper as correlationId };