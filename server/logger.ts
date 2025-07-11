// Error logging system following AI_INSTRUCTIONS.md security patterns
import { Request, Response, NextFunction } from 'express';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: Record<string, any>;
  error?: Error;
  userId?: number;
  sessionId?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs in memory

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private addLog(level: LogEntry['level'], message: string, context?: Record<string, any>, error?: Error) {
    const logEntry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level,
      message,
      context,
      error,
      userId: context?.userId,
      sessionId: context?.sessionId
    };

    this.logs.unshift(logEntry);
    
    // Keep only maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Console output for development
    if (process.env.NODE_ENV === 'development') {
      const timestamp = logEntry.timestamp.toISOString();
      const prefix = `[${timestamp}] ${level.toUpperCase()}:`;
      
      if (error) {
        console.error(prefix, message, error);
      } else {
        console.log(prefix, message, context ? JSON.stringify(context, null, 2) : '');
      }
    }
  }

  info(message: string, context?: Record<string, any>) {
    this.addLog('info', message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.addLog('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    this.addLog('error', message, context, error);
  }

  debug(message: string, context?: Record<string, any>) {
    this.addLog('debug', message, context);
  }

  // Get recent logs for debugging
  getRecentLogs(limit = 50, level?: LogEntry['level']): LogEntry[] {
    let filteredLogs = this.logs;
    
    if (level) {
      filteredLogs = this.logs.filter(log => log.level === level);
    }
    
    return filteredLogs.slice(0, limit);
  }

  // Get logs for specific session
  getSessionLogs(sessionId: string): LogEntry[] {
    return this.logs.filter(log => log.sessionId === sessionId);
  }

  // Clear old logs
  clearLogs() {
    this.logs = [];
  }
}

// API Error class following AI_INSTRUCTIONS.md patterns
export class APIError extends Error {
  constructor(public status: number, message: string, public context?: Record<string, any>) {
    super(message);
    this.name = 'APIError';
  }
}

// Express error middleware
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const context = {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    body: req.body,
    userId: (req as any).user?.id
  };

  if (err instanceof APIError) {
    logger.error(`API Error: ${err.message}`, err, { ...context, status: err.status });
    res.status(err.status).json({
      error: err.message,
      status: err.status,
      timestamp: new Date().toISOString()
    });
  } else {
    logger.error(`Unexpected Error: ${err.message}`, err, context);
    res.status(500).json({
      error: 'An unexpected error occurred',
      status: 500,
      timestamp: new Date().toISOString()
    });
  }
}

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const context = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };
    
    if (res.statusCode >= 400) {
      logger.warn(`HTTP ${res.statusCode}: ${req.method} ${req.url}`, context);
    } else {
      logger.info(`HTTP ${res.statusCode}: ${req.method} ${req.url}`, context);
    }
  });
  
  next();
}

export const logger = new Logger();