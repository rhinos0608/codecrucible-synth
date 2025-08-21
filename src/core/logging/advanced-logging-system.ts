/**
 * Advanced Logging System with Structured Format and Levels
 *
 * Provides comprehensive logging with structured data, multiple outputs,
 * log aggregation, security logging, and performance monitoring.
 */

import { writeFile, mkdir, access, readdir, stat, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import { logger as baseLogger } from '../logger.js';

// Enhanced log levels with numeric priorities
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

// Log categories for better organization
export enum LogCategory {
  SYSTEM = 'system',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  AGENT = 'agent',
  TOOL = 'tool',
  MCP = 'mcp',
  USER = 'user',
  MODEL = 'model',
  FILE_SYSTEM = 'file_system',
  NETWORK = 'network',
  API = 'api',
  ERROR = 'error',
  AUDIT = 'audit',
}

// Structured log entry interface
export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: Record<string, any>;
  metadata?: {
    requestId?: string;
    userId?: string;
    sessionId?: string;
    source?: string;
    component?: string;
    operation?: string;
    duration?: number;
    tags?: string[];
  };
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
  };
  sensitive?: boolean;
  correlationId?: string;
}

// Advanced logger configuration
export interface AdvancedLoggerConfig {
  level: LogLevel;
  categories: LogCategory[];
  outputs: LogOutput[];
  retention: {
    maxFiles: number;
    maxAge: number; // days
    maxSize: number; // bytes
  };
  security: {
    enableSecurityLogging: boolean;
    enableAuditLogging: boolean;
    maskSensitiveData: boolean;
    sensitiveFields: string[];
  };
  performance: {
    enablePerformanceLogging: boolean;
    slowOperationThreshold: number; // ms
    enableMemoryTracking: boolean;
  };
  correlation: {
    enableCorrelation: boolean;
    correlationIdHeader: string;
  };
}

// Log output configurations
export interface LogOutput {
  type: 'console' | 'file' | 'remote' | 'database';
  config: any;
  formatter?: LogFormatter;
  filter?: LogFilter;
}

export interface LogFormatter {
  format(entry: StructuredLogEntry): string;
}

export interface LogFilter {
  shouldLog(entry: StructuredLogEntry): boolean;
}

// Performance metrics interface
export interface PerformanceMetrics {
  operation: string;
  duration: number;
  memory: {
    used: number;
    total: number;
    external: number;
  };
  timestamp: string;
  context?: Record<string, any>;
}

/**
 * Advanced Structured Logger
 */
export class AdvancedLogger {
  private config: AdvancedLoggerConfig;
  private logQueue: StructuredLogEntry[] = [];
  private isProcessing = false;
  private correlationCounter = 0;
  private performanceMetrics: PerformanceMetrics[] = [];
  private activeOperations = new Map<string, { start: number; context?: any }>();

  constructor(config: Partial<AdvancedLoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      categories: Object.values(LogCategory),
      outputs: [
        {
          type: 'console',
          config: { colors: true },
          formatter: new ConsoleFormatter(),
          filter: new LevelFilter(LogLevel.INFO),
        },
        {
          type: 'file',
          config: {
            path: join(homedir(), '.codecrucible', 'logs'),
            filename: 'codecrucible-structured.log',
          },
          formatter: new JSONFormatter(),
          filter: new LevelFilter(LogLevel.DEBUG),
        },
      ],
      retention: {
        maxFiles: 10,
        maxAge: 30,
        maxSize: 100 * 1024 * 1024, // 100MB
      },
      security: {
        enableSecurityLogging: true,
        enableAuditLogging: true,
        maskSensitiveData: true,
        sensitiveFields: ['password', 'token', 'key', 'secret', 'api_key', 'auth'],
      },
      performance: {
        enablePerformanceLogging: true,
        slowOperationThreshold: 1000,
        enableMemoryTracking: true,
      },
      correlation: {
        enableCorrelation: true,
        correlationIdHeader: 'X-Correlation-ID',
      },
      ...config,
    };
  }

  /**
   * Log with structured data
   */
  log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    context?: Record<string, any>,
    metadata?: StructuredLogEntry['metadata'],
    error?: Error
  ): void {
    if (!this.shouldLog(level, category)) {
      return;
    }

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      context: this.sanitizeContext(context),
      metadata: {
        ...metadata,
      },
      correlationId: metadata?.requestId || this.generateCorrelationId(),
      error: error ? this.serializeError(error) : undefined,
      sensitive: this.detectSensitiveData(message, context),
    };

    this.enqueueLog(entry);
  }

  /**
   * Trace level logging (most verbose)
   */
  trace(
    category: LogCategory,
    message: string,
    context?: Record<string, any>,
    metadata?: StructuredLogEntry['metadata']
  ): void {
    this.log(LogLevel.TRACE, category, message, context, metadata);
  }

  /**
   * Debug level logging
   */
  debug(
    category: LogCategory,
    message: string,
    context?: Record<string, any>,
    metadata?: StructuredLogEntry['metadata']
  ): void {
    this.log(LogLevel.DEBUG, category, message, context, metadata);
  }

  /**
   * Info level logging
   */
  info(
    category: LogCategory,
    message: string,
    context?: Record<string, any>,
    metadata?: StructuredLogEntry['metadata']
  ): void {
    this.log(LogLevel.INFO, category, message, context, metadata);
  }

  /**
   * Warning level logging
   */
  warn(
    category: LogCategory,
    message: string,
    context?: Record<string, any>,
    metadata?: StructuredLogEntry['metadata']
  ): void {
    this.log(LogLevel.WARN, category, message, context, metadata);
  }

  /**
   * Error level logging
   */
  error(
    category: LogCategory,
    message: string,
    error?: Error,
    context?: Record<string, any>,
    metadata?: StructuredLogEntry['metadata']
  ): void {
    this.log(LogLevel.ERROR, category, message, context, metadata, error);
  }

  /**
   * Fatal level logging (highest severity)
   */
  fatal(
    category: LogCategory,
    message: string,
    error?: Error,
    context?: Record<string, any>,
    metadata?: StructuredLogEntry['metadata']
  ): void {
    this.log(LogLevel.FATAL, category, message, context, metadata, error);
  }

  /**
   * Security-specific logging
   */
  security(
    message: string,
    context?: Record<string, any>,
    metadata?: StructuredLogEntry['metadata']
  ): void {
    if (this.config.security.enableSecurityLogging) {
      this.log(LogLevel.WARN, LogCategory.SECURITY, message, context, {
        ...metadata,
        tags: [...(metadata?.tags || []), 'security'],
      });
    }
  }

  /**
   * Audit logging for compliance
   */
  audit(
    message: string,
    context?: Record<string, any>,
    metadata?: StructuredLogEntry['metadata']
  ): void {
    if (this.config.security.enableAuditLogging) {
      this.log(LogLevel.INFO, LogCategory.AUDIT, message, context, {
        ...metadata,
        tags: [...(metadata?.tags || []), 'audit'],
      });
    }
  }

  /**
   * Performance logging
   */
  performance(operation: string, duration: number, context?: Record<string, any>): void {
    if (this.config.performance.enablePerformanceLogging) {
      const metrics: PerformanceMetrics = {
        operation,
        duration,
        memory: this.getMemoryUsage(),
        timestamp: new Date().toISOString(),
        context,
      };

      this.performanceMetrics.push(metrics);

      // Log slow operations
      if (duration > this.config.performance.slowOperationThreshold) {
        this.warn(LogCategory.PERFORMANCE, `Slow operation detected: ${operation}`, {
          duration,
          threshold: this.config.performance.slowOperationThreshold,
          memory: metrics.memory,
          ...context,
        });
      }

      // Keep only recent metrics - reduced to prevent memory pressure
      if (this.performanceMetrics.length > 100) {
        this.performanceMetrics = this.performanceMetrics.slice(-50);
      }
    }
  }

  /**
   * Start performance tracking for an operation
   */
  startOperation(operationId: string, context?: any): void {
    this.activeOperations.set(operationId, {
      start: Date.now(),
      context,
    });
  }

  /**
   * End performance tracking and log results
   */
  endOperation(operationId: string, additionalContext?: any): void {
    const operation = this.activeOperations.get(operationId);
    if (operation) {
      const duration = Date.now() - operation.start;
      this.performance(operationId, duration, {
        ...operation.context,
        ...additionalContext,
      });
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, any>): AdvancedLogger {
    const childLogger = new AdvancedLogger(this.config);

    // Override log method to include context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level, category, message, childContext, metadata, error) => {
      return originalLog(
        level,
        category,
        message,
        { ...context, ...childContext },
        metadata,
        error
      );
    };

    return childLogger;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    totalOperations: number;
    averageDuration: number;
    slowOperations: number;
    memoryUsage: any;
    recentMetrics: PerformanceMetrics[];
  } {
    const total = this.performanceMetrics.length;
    const avgDuration =
      total > 0 ? this.performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / total : 0;
    const slowOps = this.performanceMetrics.filter(
      m => m.duration > this.config.performance.slowOperationThreshold
    ).length;

    return {
      totalOperations: total,
      averageDuration: avgDuration,
      slowOperations: slowOps,
      memoryUsage: this.getMemoryUsage(),
      recentMetrics: this.performanceMetrics.slice(-10),
    };
  }

  /**
   * Clear performance metrics
   */
  clearPerformanceMetrics(): void {
    this.performanceMetrics = [];
  }

  /**
   * Flush all pending logs
   */
  async flush(): Promise<void> {
    while (this.logQueue.length > 0 || this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AdvancedLoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private shouldLog(level: LogLevel, category: LogCategory): boolean {
    return level >= this.config.level && this.config.categories.includes(category);
  }

  private sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
    if (!context || !this.config.security.maskSensitiveData) {
      return context;
    }

    const sanitized = { ...context };

    for (const field of this.config.security.sensitiveFields) {
      this.maskSensitiveField(sanitized, field);
    }

    return sanitized;
  }

  private maskSensitiveField(obj: any, fieldName: string): void {
    if (typeof obj === 'object' && obj !== null) {
      for (const key of Object.keys(obj)) {
        if (key.toLowerCase().includes(fieldName.toLowerCase())) {
          obj[key] = '[MASKED]';
        } else if (typeof obj[key] === 'object') {
          this.maskSensitiveField(obj[key], fieldName);
        }
      }
    }
  }

  private detectSensitiveData(message: string, context?: Record<string, any>): boolean {
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /api[_-]?key/i,
      /auth/i,
      /credential/i,
    ];

    const textToCheck = message + (context ? JSON.stringify(context) : '');
    return sensitivePatterns.some(pattern => pattern.test(textToCheck));
  }

  private serializeError(error: Error): StructuredLogEntry['error'] {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    };
  }

  private generateCorrelationId(): string {
    if (this.config.correlation.enableCorrelation) {
      return `${Date.now()}-${++this.correlationCounter}`;
    }
    return '';
  }

  private getMemoryUsage(): any {
    if (this.config.performance.enableMemoryTracking) {
      return process.memoryUsage();
    }
    return null;
  }

  private enqueueLog(entry: StructuredLogEntry): void {
    this.logQueue.push(entry);
    this.processLogQueue();
  }

  private async processLogQueue(): Promise<void> {
    if (this.isProcessing || this.logQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const entries = this.logQueue.splice(0, 50); // Process in batches

      await Promise.all(this.config.outputs.map(output => this.processOutput(output, entries)));
    } catch (error) {
      console.error('Failed to process log queue:', error);
    } finally {
      this.isProcessing = false;

      // Process remaining queue if any
      if (this.logQueue.length > 0) {
        setTimeout(() => this.processLogQueue(), 10);
      }
    }
  }

  private async processOutput(output: LogOutput, entries: StructuredLogEntry[]): Promise<void> {
    const filteredEntries = entries.filter(
      entry => !output.filter || output.filter.shouldLog(entry)
    );

    if (filteredEntries.length === 0) {
      return;
    }

    switch (output.type) {
      case 'console':
        this.outputToConsole(output, filteredEntries);
        break;
      case 'file':
        await this.outputToFile(output, filteredEntries);
        break;
      case 'remote':
        await this.outputToRemote(output, filteredEntries);
        break;
      default:
        console.warn(`Unknown output type: ${output.type}`);
    }
  }

  private outputToConsole(output: LogOutput, entries: StructuredLogEntry[]): void {
    for (const entry of entries) {
      const formatted = output.formatter?.format(entry) || this.defaultConsoleFormat(entry);
      console.log(formatted);
    }
  }

  private async outputToFile(output: LogOutput, entries: StructuredLogEntry[]): Promise<void> {
    try {
      const { path, filename } = output.config;
      await mkdir(path, { recursive: true });

      const logFile = join(path, filename);
      const content =
        entries.map(entry => output.formatter?.format(entry) || JSON.stringify(entry)).join('\n') +
        '\n';

      await writeFile(logFile, content, { flag: 'a' });

      // Manage log retention
      await this.manageLogRetention(path);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private async outputToRemote(output: LogOutput, entries: StructuredLogEntry[]): Promise<void> {
    // Implementation for remote logging (e.g., to log aggregation service)
    // This would send logs to external services like ELK, Splunk, etc.
    console.log('Remote logging not implemented yet');
  }

  private defaultConsoleFormat(entry: StructuredLogEntry): string {
    const timestamp = chalk.gray(entry.timestamp);
    const level = this.getColoredLevel(entry.level);
    const category = chalk.cyan(`[${entry.category}]`);

    let message = `${timestamp} ${level} ${category} ${entry.message}`;

    if (entry.context) {
      message += `\n${chalk.gray(JSON.stringify(entry.context, null, 2))}`;
    }

    if (entry.error) {
      message += `\n${chalk.red(entry.error.stack || entry.error.message)}`;
    }

    return message;
  }

  private getColoredLevel(level: LogLevel): string {
    const levelName = LogLevel[level].padEnd(5);

    switch (level) {
      case LogLevel.TRACE:
        return chalk.gray(levelName);
      case LogLevel.DEBUG:
        return chalk.blue(levelName);
      case LogLevel.INFO:
        return chalk.green(levelName);
      case LogLevel.WARN:
        return chalk.yellow(levelName);
      case LogLevel.ERROR:
        return chalk.red(levelName);
      case LogLevel.FATAL:
        return chalk.magenta(levelName);
      default:
        return levelName;
    }
  }

  private async manageLogRetention(logPath: string): Promise<void> {
    try {
      const files = await readdir(logPath);
      const logFiles = files.filter(f => f.endsWith('.log'));

      // Remove old files
      const now = Date.now();
      const maxAge = this.config.retention.maxAge * 24 * 60 * 60 * 1000;

      for (const file of logFiles) {
        const filePath = join(logPath, file);
        const stats = await stat(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          await unlink(filePath);
        }
      }

      // Remove excess files if too many
      if (logFiles.length > this.config.retention.maxFiles) {
        const filesToRemove = logFiles
          .sort()
          .slice(0, logFiles.length - this.config.retention.maxFiles);

        for (const file of filesToRemove) {
          await unlink(join(logPath, file));
        }
      }
    } catch (error) {
      console.warn('Failed to manage log retention:', error);
    }
  }
}

/**
 * Console formatter for human-readable output
 */
export class ConsoleFormatter implements LogFormatter {
  format(entry: StructuredLogEntry): string {
    const timestamp = chalk.gray(entry.timestamp);
    const level = this.getColoredLevel(entry.level);
    const category = chalk.cyan(`[${entry.category}]`);

    return `${timestamp} ${level} ${category} ${entry.message}`;
  }

  private getColoredLevel(level: LogLevel): string {
    const levelName = LogLevel[level].padEnd(5);

    switch (level) {
      case LogLevel.TRACE:
        return chalk.gray(levelName);
      case LogLevel.DEBUG:
        return chalk.blue(levelName);
      case LogLevel.INFO:
        return chalk.green(levelName);
      case LogLevel.WARN:
        return chalk.yellow(levelName);
      case LogLevel.ERROR:
        return chalk.red(levelName);
      case LogLevel.FATAL:
        return chalk.magenta(levelName);
      default:
        return levelName;
    }
  }
}

/**
 * JSON formatter for structured output
 */
export class JSONFormatter implements LogFormatter {
  format(entry: StructuredLogEntry): string {
    return JSON.stringify(entry);
  }
}

/**
 * Level-based filter
 */
export class LevelFilter implements LogFilter {
  constructor(private minLevel: LogLevel) {}

  shouldLog(entry: StructuredLogEntry): boolean {
    return entry.level >= this.minLevel;
  }
}

/**
 * Category-based filter
 */
export class CategoryFilter implements LogFilter {
  constructor(private allowedCategories: LogCategory[]) {}

  shouldLog(entry: StructuredLogEntry): boolean {
    return this.allowedCategories.includes(entry.category);
  }
}

// Create default advanced logger instance
export const advancedLogger = new AdvancedLogger();

// Export main class for use elsewhere
