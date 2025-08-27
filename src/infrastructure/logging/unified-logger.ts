/**
 * Unified Logger System
 * 
 * Consolidates 6 different logging implementations into one comprehensive system.
 * Replaces: core/logger.ts, structured-logger.ts, security-audit-logger.ts, etc.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { IEventBus } from '../../domain/interfaces/event-bus.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
  AUDIT = 5,
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: Record<string, any>;
  error?: Error;
  traceId?: string;
  userId?: string;
  sessionId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  destinations: LogDestination[];
  format: 'json' | 'text' | 'structured';
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
  enableAudit: boolean;
  auditPath?: string;
}

export interface LogDestination {
  type: 'console' | 'file' | 'syslog' | 'http' | 'event';
  config: any;
  filter?: (entry: LogEntry) => boolean;
}

export class UnifiedLogger extends EventEmitter {
  private config: LoggerConfig;
  private fileStream?: fs.WriteStream;
  private auditStream?: fs.WriteStream;

  constructor(config?: Partial<LoggerConfig>, private eventBus?: IEventBus) {
    super();
    this.config = {
      level: LogLevel.INFO,
      destinations: [],
      format: 'json',
      enableConsole: true,
      enableFile: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      enableAudit: false,
      ...config
    };
    
    this.initialize();
  }

  private initialize(): void {
    if (this.config.enableFile && this.config.filePath) {
      this.fileStream = fs.createWriteStream(this.config.filePath, { flags: 'a' });
    }
    
    if (this.config.enableAudit && this.config.auditPath) {
      this.auditStream = fs.createWriteStream(this.config.auditPath, { flags: 'a' });
    }
  }

  debug(message: string, metadata?: any): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: any): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: any): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, error?: Error | any, metadata?: any): void {
    if (error instanceof Error) {
      this.log(LogLevel.ERROR, message, { ...metadata, error: error.message, stack: error.stack });
    } else {
      this.log(LogLevel.ERROR, message, { ...metadata, error });
    }
  }

  fatal(message: string, error?: Error, metadata?: any): void {
    this.log(LogLevel.FATAL, message, { ...metadata, error });
    // Fatal errors might trigger system shutdown
    this.emit('fatal', { message, error, metadata });
  }

  audit(action: string, result: 'success' | 'failure', metadata?: any): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.AUDIT,
      message: `AUDIT: ${action} - ${result}`,
      metadata: { ...metadata, action, result }
    };
    
    this.writeAudit(entry);
  }

  log(level: LogLevel, message: string, metadata?: any): void {
    if (level < this.config.level) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      metadata,
      context: this.getContext()
    };

    this.writeLog(entry);
  }

  private writeLog(entry: LogEntry): void {
    const formatted = this.format(entry);
    
    if (this.config.enableConsole) {
      this.writeToConsole(entry, formatted);
    }
    
    if (this.config.enableFile && this.fileStream) {
      this.fileStream.write(formatted + '\n');
    }
    
    // Emit to event bus
    if (this.eventBus) {
      this.eventBus.emit('log:entry', entry);
    }
    
    // Emit local event
    this.emit('log', entry);
  }

  private writeAudit(entry: LogEntry): void {
    if (this.auditStream) {
      const formatted = this.format(entry);
      this.auditStream.write(formatted + '\n');
    }
    
    // Always write audit logs to main log as well
    this.writeLog(entry);
  }

  private format(entry: LogEntry): string {
    switch (this.config.format) {
      case 'json':
        return JSON.stringify(entry);
      case 'structured':
        return this.structuredFormat(entry);
      case 'text':
      default:
        return this.textFormat(entry);
    }
  }

  private structuredFormat(entry: LogEntry): string {
    const level = LogLevel[entry.level];
    const timestamp = entry.timestamp.toISOString();
    const metadata = entry.metadata ? JSON.stringify(entry.metadata) : '';
    return `[${timestamp}] [${level}] ${entry.message} ${metadata}`;
  }

  private textFormat(entry: LogEntry): string {
    const level = LogLevel[entry.level];
    const timestamp = entry.timestamp.toLocaleTimeString();
    return `${timestamp} [${level}] ${entry.message}`;
  }

  private writeToConsole(entry: LogEntry, formatted: string): void {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[90m', // gray
      [LogLevel.INFO]: '\x1b[36m',  // cyan
      [LogLevel.WARN]: '\x1b[33m',  // yellow
      [LogLevel.ERROR]: '\x1b[31m', // red
      [LogLevel.FATAL]: '\x1b[35m', // magenta
      [LogLevel.AUDIT]: '\x1b[32m', // green
    };
    
    const resetColor = '\x1b[0m';
    const color = colors[entry.level] || resetColor;
    
    if (entry.level >= LogLevel.ERROR) {
      console.error(`${color}${formatted}${resetColor}`);
    } else {
      console.log(`${color}${formatted}${resetColor}`);
    }
  }

  private getContext(): string {
    // Get calling context from stack trace
    const stack = new Error().stack;
    if (!stack) return 'unknown';
    
    const lines = stack.split('\n');
    const callerLine = lines[3]; // Skip Error, this method, and log method
    const match = callerLine?.match(/at\s+(\S+)/);
    return match ? match[1] : 'unknown';
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  close(): void {
    if (this.fileStream) {
      this.fileStream.end();
    }
    if (this.auditStream) {
      this.auditStream.end();
    }
  }
}

// Global logger instance
let globalLogger: UnifiedLogger | null = null;

export function getGlobalLogger(config?: Partial<LoggerConfig>): UnifiedLogger {
  if (!globalLogger) {
    globalLogger = new UnifiedLogger(config);
  }
  return globalLogger;
}

// Convenience exports
export const logger = getGlobalLogger();

// For backward compatibility
export class Logger extends UnifiedLogger {
  constructor(name: string, config?: Partial<LoggerConfig>) {
    super({ ...config, context: name });
  }
}