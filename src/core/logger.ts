import { writeFile, mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  data?: any;
  error?: Error;
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
 * Enhanced Logger with file and console output
 * 
 * Provides structured logging with different levels, file rotation,
 * and pretty console output with colors
 */
class Logger {
  private config: LoggerConfig;
  private logQueue: LogEntry[] = [];
  private isWriting = false;
  private logDirectory: string;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: 'info',
      toFile: true,
      toConsole: true,
      maxFileSize: '10MB',
      maxFiles: 5,
      ...config
    };

    this.logDirectory = this.config.logDirectory || join(homedir(), '.codecrucible', 'logs');
    this.ensureLogDirectory();
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
      const dataStr = typeof entry.data === 'string' 
        ? entry.data 
        : JSON.stringify(entry.data, null, 2);
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
      const dataStr = typeof entry.data === 'string' 
        ? entry.data 
        : JSON.stringify(entry.data);
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
   * Log a message with specified level
   */
  private async log(level: LogLevel, message: string, data?: any, error?: Error): Promise<void> {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data,
      error
    };

    // Console output
    if (this.config.toConsole) {
      console.log(this.formatConsoleMessage(entry));
    }

    // File output
    if (this.config.toFile) {
      this.logQueue.push(entry);
      this.processLogQueue();
    }
  }

  /**
   * Process log queue and write to file
   */
  private async processLogQueue(): Promise<void> {
    if (this.isWriting || this.logQueue.length === 0) {
      return;
    }

    this.isWriting = true;

    try {
      const entries = this.logQueue.splice(0, 100); // Process in batches
      const logContent = entries
        .map(entry => this.formatFileMessage(entry))
        .join('\\n') + '\\n';

      const logFile = join(this.logDirectory, `codecrucible-${this.getCurrentDateString()}.log`);
      
      await writeFile(logFile, logContent, { flag: 'a' });

    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write to log file:', error);
    } finally {
      this.isWriting = false;

      // Process remaining queue if any
      if (this.logQueue.length > 0) {
        setTimeout(() => this.processLogQueue(), 100);
      }
    }
  }

  /**
   * Get current date string for log file naming
   */
  private getCurrentDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

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
   * Flush pending logs to file
   */
  async flush(): Promise<void> {
    while (this.logQueue.length > 0 || this.isWriting) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: string): Logger {
    const childLogger = new Logger(this.config);
    
    // Override log method to include context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: LogLevel, message: string, data?: any, error?: Error) => {
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
      cwd: process.cwd()
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

// Graceful shutdown - flush logs
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