// Store logging utilities
// Following AI_INSTRUCTIONS.md patterns with structured logging

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

class StoreLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  
  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    error?: Error,
    context?: Record<string, any>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error
    };
  }
  
  private addLog(entry: LogEntry): void {
    this.logs.unshift(entry);
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    
    // Console output in development
    if (process.env.NODE_ENV === 'development') {
      const contextStr = entry.context ? JSON.stringify(entry.context) : '';
      const logMessage = `[Store] ${entry.message} ${contextStr}`;
      
      switch (entry.level) {
        case 'error':
          console.error(logMessage, entry.error);
          break;
        case 'warn':
          console.warn(logMessage);
          break;
        case 'debug':
          console.debug(logMessage);
          break;
        default:
          console.log(logMessage);
      }
    }
  }
  
  info(message: string, context?: Record<string, any>): void {
    this.addLog(this.createLogEntry('info', message, undefined, context));
  }
  
  warn(message: string, context?: Record<string, any>): void {
    this.addLog(this.createLogEntry('warn', message, undefined, context));
  }
  
  error(message: string, error: Error, context?: Record<string, any>): void {
    this.addLog(this.createLogEntry('error', message, error, context));
  }
  
  debug(message: string, context?: Record<string, any>): void {
    this.addLog(this.createLogEntry('debug', message, undefined, context));
  }
  
  // Get recent logs for debugging
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(0, count);
  }
  
  // Get logs by level
  getLogsByLevel(level: LogEntry['level']): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }
  
  // Clear all logs
  clearLogs(): void {
    this.logs = [];
    this.info('Store logs cleared');
  }
  
  // Export logs for debugging
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const storeLogger = new StoreLogger();