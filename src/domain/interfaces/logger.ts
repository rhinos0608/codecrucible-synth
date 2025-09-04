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
  info: (message: string, meta?: unknown) => void;

  /**
   * Log error message
   */
  error: (message: string, error?: unknown) => void;

  /**
   * Log warning message
   */
  warn: (message: string, meta?: unknown) => void;

  /**
   * Log debug message
   */
  debug: (message: string, meta?: unknown) => void;

  /**
   * Log trace message
   */
  trace: (message: string, meta?: unknown) => void;
}

/**
 * Logger Factory Interface
 */
export interface ILoggerFactory {
  createLogger: (name: string) => ILogger;
}

/**
 * Simple console-backed ILogger factory used as a safe default in the domain layer.
 * This avoids importing infrastructure logging from the domain layer while still
 * providing a reasonable default for runtime and tests.
 */
export function createConsoleLogger(name: string = 'domain'): ILogger {
  const prefixed = (level: string, msg: string, meta?: unknown): void => {
    const tag = `[${name}] ${level}`;
    if (meta) {
      // Keep output small and safe
      // eslint-disable-next-line no-console
      console.log(tag, msg, meta);
    } else {
      // eslint-disable-next-line no-console
      console.log(tag, msg);
    }
  };

  return {
    info: (message: string, meta?: unknown): void => { prefixed('INFO', message, meta); },
    error: (message: string, error?: unknown): void => { prefixed('ERROR', message, error); },
    warn: (message: string, meta?: unknown): void => { prefixed('WARN', message, meta); },
    debug: (message: string, meta?: unknown): void => { prefixed('DEBUG', message, meta); },
    trace: (message: string, meta?: unknown): void => { prefixed('TRACE', message, meta); },
  };
}
