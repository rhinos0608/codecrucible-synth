import { writeFile, mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import * as api from '@opentelemetry/api';
import winston from 'winston';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  data?: any;
  error?: Error;
  traceId?: string;
  spanId?: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  toFile: boolean;
  toConsole: boolean;
  maxFileSize: string;
  maxFiles: number;
  logDirectory?: string;
}

/**
 * Enterprise Logger with Winston - 2025 Best Practices
 *
 * Features:
 * - Structured JSON logging for observability
 * - High-performance async operations
 * - OpenTelemetry integration
 * - Production-grade error handling
 * - Multiple transport support
 */
class Logger {
  private config: LoggerConfig;
  private winstonLogger!: winston.Logger; // Definite assignment assertion
  private logDirectory: string;
  private name?: string;

  constructor(nameOrConfig?: string | Partial<LoggerConfig>, config?: Partial<LoggerConfig>) {
    // Handle overloaded constructor
    if (typeof nameOrConfig === 'string') {
      this.name = nameOrConfig;
      this.config = {
        level: 'info',
        toFile: true,
        toConsole: true,
        maxFileSize: '10MB',
        maxFiles: 5,
        ...config,
      };
    } else {
      this.config = {
        level: 'info',
        toFile: true,
        toConsole: true,
        maxFileSize: '10MB',
        maxFiles: 5,
        ...nameOrConfig,
      };
    }

    this.logDirectory = this.config.logDirectory || join(homedir(), '.codecrucible', 'logs');
    this.setupWinstonLogger();
    this.ensureLogDirectory();
  }

  /**
   * Setup Winston logger with structured JSON format - 2025 Best Practice
   */
  private setupWinstonLogger(): void {
    // Custom JSON formatter for structured logging
    const jsonFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(
        ({
          timestamp,
          level,
          message,
          traceId,
          spanId,
          correlationId,
          userId,
          sessionId,
          ...meta
        }) => {
          const logEntry = {
            '@timestamp': timestamp,
            level: level.toUpperCase(),
            message,
            service: this.name || 'codecrucible-synth',
            ...(traceId ? { traceId } : {}),
            ...(spanId ? { spanId } : {}),
            ...(correlationId ? { correlationId } : {}),
            ...(userId ? { userId } : {}),
            ...(sessionId ? { sessionId } : {}),
            ...meta,
          };
          return JSON.stringify(logEntry);
        }
      )
    );

    // Console formatter with colors for development
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, traceId, ...meta }) => {
        let output = `${timestamp}  ${level} ${message}`;
        if (Object.keys(meta).length > 0 && !meta.stack) {
          output += `\n${JSON.stringify(meta, null, 2)}`;
        }
        if (meta.stack) {
          output += `\n${meta.stack}`;
        }
        return output;
      })
    );

    const transports: winston.transport[] = [];

    if (this.config.toConsole) {
      transports.push(
        new winston.transports.Console({
          level: this.config.level,
          format: consoleFormat,
        })
      );
    }

    if (this.config.toFile) {
      transports.push(
        new winston.transports.File({
          filename: join(this.logDirectory, 'codecrucible.log'),
          level: this.config.level,
          format: jsonFormat,
          maxsize: this.parseFileSize(this.config.maxFileSize),
          maxFiles: this.config.maxFiles,
          tailable: true,
        })
      );

      // Separate error log file for high-priority issues
      transports.push(
        new winston.transports.File({
          filename: join(this.logDirectory, 'error.log'),
          level: 'error',
          format: jsonFormat,
          maxsize: this.parseFileSize(this.config.maxFileSize),
          maxFiles: this.config.maxFiles,
          tailable: true,
        })
      );
    }

    this.winstonLogger = winston.createLogger({
      level: this.config.level,
      levels: winston.config.npm.levels,
      transports,
      exitOnError: false,
      handleExceptions: true,
      handleRejections: true,
    });
  }

  /**
   * Parse file size string to bytes
   */
  private parseFileSize(sizeStr: string): number {
    const size = parseInt(sizeStr.match(/\d+/)?.[0] || '10');
    const unit = sizeStr.match(/[a-zA-Z]+/)?.[0]?.toLowerCase() || 'mb';

    const multipliers: Record<string, number> = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
    };

    return size * (multipliers[unit] || multipliers.mb);
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      await access(this.logDirectory);
    } catch {
      try {
        await mkdir(this.logDirectory, { recursive: true });
      } catch (error) {
        console.warn(`Failed to create log directory: ${this.logDirectory}`);
      }
    }
  }

  /**
   * Get numeric level for comparison
   */
  private getNumericLevel(level: LogLevel): number {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level];
  }

  /**
   * Check if message should be logged based on level
   */
  private shouldLog(level: LogLevel): boolean {
    return this.getNumericLevel(level) >= this.getNumericLevel(this.config.level);
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').replace('Z', '');
  }

  /**
   * Get colored prefix for console output
   */
  private getColoredPrefix(level: LogLevel): string {
    const timestamp = chalk.gray(this.formatTimestamp(new Date()));

    switch (level) {
      case 'debug':
        return `${timestamp} ${chalk.blue('DEBUG')}`;
      case 'info':
        return `${timestamp} ${chalk.green(' INFO')}`;
      case 'warn':
        return `${timestamp} ${chalk.yellow(' WARN')}`;
      case 'error':
        return `${timestamp} ${chalk.red('ERROR')}`;
    }
  }

  /**
   * Format message for console output
   */
  private formatConsoleMessage(entry: LogEntry): string {
    const prefix = this.getColoredPrefix(entry.level);
    let message = `${prefix} ${entry.message}`;

    if (entry.data) {
      const dataStr =
        typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data, null, 2);
      message += `\\n${chalk.gray(dataStr)}`;
    }

    if (entry.error) {
      message += `\\n${chalk.red(entry.error.stack || entry.error.message)}`;
    }

    return message;
  }

  /**
   * Format message for file output
   */
  private formatFileMessage(entry: LogEntry): string {
    const timestamp = this.formatTimestamp(entry.timestamp);
    const level = entry.level.toUpperCase().padEnd(5);

    let message = `${timestamp} ${level} ${entry.message}`;

    if (entry.data) {
      const dataStr = typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data);
      message += ` | Data: ${dataStr}`;
    }

    if (entry.error) {
      message += ` | Error: ${entry.error.message}`;
      if (entry.error.stack) {
        message += `\\n${entry.error.stack}`;
      }
    }

    return message;
  }

  /**
   * Log a message with specified level - 2025 Winston Implementation
   */
  private async log(level: LogLevel, message: string, data?: any, error?: Error): Promise<void> {
    if (!this.shouldLog(level)) {
      return;
    }

    // Get trace context from OpenTelemetry
    const span = api.trace.getActiveSpan();
    const spanContext = span?.spanContext();

    // Prepare metadata for Winston
    const metadata: any = {};
    if (data) metadata.data = data;
    if (error) metadata.error = error;
    if (spanContext?.traceId) metadata.traceId = spanContext.traceId;
    if (spanContext?.spanId) metadata.spanId = spanContext.spanId;
    if (data?.correlationId) metadata.correlationId = data.correlationId;
    if (data?.userId) metadata.userId = data.userId;
    if (data?.sessionId) metadata.sessionId = data.sessionId;

    // Use Winston for structured logging - handles both console and file automatically
    this.winstonLogger.log(level, message, metadata);
  }

  // Note: Winston handles file operations automatically - legacy queue methods removed

  /**
   * Debug level logging
   */
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  /**
   * Info level logging
   */
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error | any, data?: any): void {
    if (error instanceof Error) {
      this.log('error', message, data, error);
    } else {
      // If second parameter is not an Error, treat it as data
      this.log('error', message, error);
    }
  }

  /**
   * Update logger configuration
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Flush pending logs (Winston handles automatically)
   */
  async flush(): Promise<void> {
    // Winston handles flushing automatically
    return Promise.resolve();
  }

  /**
   * Create a child logger with additional context
   */
  child(context: string): Logger {
    const childLogger = new Logger(this.config);

    // Override log method to include context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = async (level: LogLevel, message: string, data?: any, error?: Error) => {
      return originalLog(level, `[${context}] ${message}`, data, error);
    };

    return childLogger;
  }

  /**
   * Performance timing utility
   */
  time(label: string): () => void {
    const start = Date.now();

    return () => {
      const duration = Date.now() - start;
      this.debug(`Timer ${label}: ${duration}ms`);
    };
  }

  /**
   * Log performance of async operations
   */
  async profile<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const start = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - start;
      this.debug(`Operation ${label} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`Operation ${label} failed after ${duration}ms`, error);
      throw error;
    }
  }

  /**
   * Log system information
   */
  logSystemInfo(): void {
    this.info('System Information', {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      cwd: process.cwd(),
    });
  }

  /**
   * Audit log for compliance and security
   */
  audit(
    action: string,
    details: {
      userId?: string;
      sessionId?: string;
      ip?: string;
      userAgent?: string;
      resource?: string;
      status?: 'success' | 'failure';
      [key: string]: any;
    }
  ): void {
    this.info(`AUDIT: ${action}`, {
      ...details,
      auditType: 'security',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Security event logging
   */
  security(
    event: string,
    details: {
      severity: 'low' | 'medium' | 'high' | 'critical';
      threatType?: string;
      userId?: string;
      ip?: string;
      mitigated?: boolean;
      [key: string]: any;
    }
  ): void {
    this.warn(`SECURITY: ${event}`, {
      ...details,
      eventType: 'security_event',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Performance metrics logging
   */
  metric(name: string, value: number, unit: string = 'ms', tags?: Record<string, string>): void {
    this.debug(`METRIC: ${name}`, {
      metricName: name,
      metricValue: value,
      metricUnit: unit,
      metricTags: tags,
      metricType: 'performance',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Business event logging
   */
  business(event: string, details: Record<string, any>): void {
    this.info(`BUSINESS: ${event}`, {
      ...details,
      eventType: 'business_event',
      timestamp: new Date().toISOString(),
    });
  }
}

// Create default logger instance
export const logger = new Logger();

// Export Logger class for custom instances
export { Logger };

// Convenience function to update global logger config
export function configureLogger(config: Partial<LoggerConfig>): void {
  logger.updateConfig(config);
}

// Graceful shutdown - flush logs (only register once)
let loggerShutdownRegistered = false;

if (!loggerShutdownRegistered) {
  loggerShutdownRegistered = true;

  process.on('beforeExit', async () => {
    try {
      await logger.flush();
    } catch (error) {
      console.error('Failed to flush logs on exit:', error);
    }
  });

  process.on('SIGINT', async () => {
    try {
      await logger.flush();
    } catch (error) {
      console.error('Failed to flush logs on SIGINT:', error);
    }
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    try {
      await logger.flush();
    } catch (error) {
      console.error('Failed to flush logs on SIGTERM:', error);
    }
    process.exit(0);
  });
}
