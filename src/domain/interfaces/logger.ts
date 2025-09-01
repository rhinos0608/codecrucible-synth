/**
 * Logger Interface - Domain Layer
 *
 * Domain interface for logging abstraction following clean architecture principles.
 * Domain layer should depend on abstractions, not concrete implementations.
 */

export interface ILogger {
  /**
   * Log informational message
   */
  info(message: string, meta?: any): void;

  /**
   * Log error message
   */
  error(message: string, error?: any): void;

  /**
   * Log warning message
   */
  warn(message: string, meta?: any): void;

  /**
   * Log debug message
   */
  debug(message: string, meta?: any): void;

  /**
   * Log trace message
   */
  trace(message: string, meta?: any): void;
}

/**
 * Logger Factory Interface
 */
export interface ILoggerFactory {
  createLogger(name: string): ILogger;
}
