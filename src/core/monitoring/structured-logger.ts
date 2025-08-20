/**
 * Enterprise Structured Logging System
 * Implements correlation IDs, structured JSON logs, and multiple transport layers
 */

import winston from 'winston';
import crypto from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  version: string;
  correlationId: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  operation?: string;
  duration?: number;
  statusCode?: number;
  error?: {
    name: string;
    message: string;
    stack: string;
    code?: string;
  };
  metadata: Record<string, any>;
}

export interface LogConfig {
  level: string;
  format: 'json' | 'text';
  environment: string;
  service: string;
  version: string;
  outputs: {
    console: boolean;
    file: boolean;
    remote?: {
      endpoint: string;
      apiKey: string;
    };
  };
  rotation: {
    enabled: boolean;
    maxSize: string;
    maxFiles: number;
  };
}

// Context storage for correlation IDs
const correlationStorage = new AsyncLocalStorage<string>();

export class StructuredLogger {
  private logger: winston.Logger;
  private config: LogConfig;
  private service: string;
  private version: string;

  constructor(config: LogConfig) {
    this.config = config;
    this.service = config.service;
    this.version = config.version;
    
    this.logger = winston.createLogger({
      level: config.level,
      format: this.createFormat(),
      defaultMeta: {
        service: this.service,
        version: this.version,
        environment: config.environment
      },
      transports: this.createTransports()
    });

    // Handle uncaught exceptions and unhandled rejections
    this.logger.exceptions.handle(
      new winston.transports.File({ filename: 'exceptions.log' })
    );

    this.logger.rejections.handle(
      new winston.transports.File({ filename: 'rejections.log' })
    );
  }

  /**
   * Create Winston format with structured logging
   */
  private createFormat(): winston.Logform.Format {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, service, version, ...meta }) => {
        const correlationId = this.getCorrelationId();
        
        const logEntry: LogEntry = {
          timestamp: timestamp as string,
          level: level as string,
          message: message as string,
          service: service as string,
          version: version as string,
          correlationId,
          metadata: meta
        };

        // Add tracing information if available
        if (meta.traceId) logEntry.traceId = meta.traceId as string;
        if (meta.spanId) logEntry.spanId = meta.spanId as string;
        if (meta.userId) logEntry.userId = meta.userId as string;
        if (meta.sessionId) logEntry.sessionId = meta.sessionId as string;
        if (meta.operation) logEntry.operation = meta.operation as string;
        if (meta.duration) logEntry.duration = meta.duration as number;
        if (meta.statusCode) logEntry.statusCode = meta.statusCode as number;

        // Handle error objects
        if (meta.error && meta.error instanceof Error) {
          logEntry.error = {
            name: meta.error.name,
            message: meta.error.message,
            stack: meta.error.stack || '',
            code: (meta.error as any).code
          };
        }

        return JSON.stringify(logEntry);
      })
    );
  }

  /**
   * Create Winston transports based on configuration
   */
  private createTransports(): winston.transport[] {
    const transports: winston.transport[] = [];

    // Console transport
    if (this.config.outputs.console) {
      transports.push(
        new winston.transports.Console({
          format: this.config.format === 'text' 
            ? winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
              )
            : winston.format.json()
        })
      );
    }

    // File transport
    if (this.config.outputs.file) {
      transports.push(
        new winston.transports.File({
          filename: 'application.log',
          maxsize: this.parseSize(this.config.rotation.maxSize),
          maxFiles: this.config.rotation.maxFiles,
          tailable: true
        })
      );

      // Separate error log
      transports.push(
        new winston.transports.File({
          filename: 'error.log',
          level: 'error',
          maxsize: this.parseSize(this.config.rotation.maxSize),
          maxFiles: this.config.rotation.maxFiles,
          tailable: true
        })
      );
    }

    // Remote transport (e.g., ELK, Splunk, DataDog)
    if (this.config.outputs.remote) {
      // In production, add HTTP transport to send logs to centralized system
      transports.push(
        new winston.transports.Http({
          host: new URL(this.config.outputs.remote.endpoint).hostname,
          port: parseInt(new URL(this.config.outputs.remote.endpoint).port) || 443,
          path: new URL(this.config.outputs.remote.endpoint).pathname,
          ssl: this.config.outputs.remote.endpoint.startsWith('https'),
          headers: {
            'Authorization': `Bearer ${this.config.outputs.remote.apiKey}`,
            'Content-Type': 'application/json'
          }
        })
      );
    }

    return transports;
  }

  /**
   * Parse size string to bytes
   */
  private parseSize(size: string): number {
    const units = { k: 1024, m: 1024 * 1024, g: 1024 * 1024 * 1024 };
    const match = size.toLowerCase().match(/^(\d+)([kmg]?)b?$/);
    if (!match) return 10 * 1024 * 1024; // Default 10MB
    
    const value = parseInt(match[1]);
    const unit = match[2] as keyof typeof units;
    return value * (units[unit] || 1);
  }

  /**
   * Get or generate correlation ID
   */
  private getCorrelationId(): string {
    return correlationStorage.getStore() || crypto.randomUUID();
  }

  /**
   * Set correlation ID for async context
   */
  setCorrelationId(id: string): void {
    correlationStorage.enterWith(id);
  }

  /**
   * Generate new correlation ID
   */
  generateCorrelationId(): string {
    const id = crypto.randomUUID();
    this.setCorrelationId(id);
    return id;
  }

  /**
   * Run function with correlation ID context
   */
  withCorrelationId<T>(id: string, fn: () => T): T {
    return correlationStorage.run(id, fn);
  }

  /**
   * Structured logging methods
   */
  info(message: string, metadata: Record<string, any> = {}): void {
    this.logger.info(message, metadata);
  }

  warn(message: string, metadata: Record<string, any> = {}): void {
    this.logger.warn(message, metadata);
  }

  error(message: string, error?: Error, metadata: Record<string, any> = {}): void {
    this.logger.error(message, { ...metadata, error });
  }

  debug(message: string, metadata: Record<string, any> = {}): void {
    this.logger.debug(message, metadata);
  }

  /**
   * Operation-specific logging with timing
   */
  async logOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata: Record<string, any> = {}
  ): Promise<T> {
    const startTime = Date.now();
    const operationId = crypto.randomUUID();
    
    this.info(`Operation started: ${operation}`, {
      operation,
      operationId,
      ...metadata
    });

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      this.info(`Operation completed: ${operation}`, {
        operation,
        operationId,
        duration,
        status: 'success',
        ...metadata
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.error(`Operation failed: ${operation}`, error as Error, {
        operation,
        operationId,
        duration,
        status: 'error',
        ...metadata
      });

      throw error;
    }
  }

  /**
   * HTTP request logging
   */
  logHttpRequest(req: any, res: any, duration: number): void {
    this.info('HTTP request processed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.userId,
      sessionId: req.sessionId
    });
  }

  /**
   * Security event logging
   */
  logSecurityEvent(event: string, metadata: Record<string, any> = {}): void {
    this.warn(`Security event: ${event}`, {
      securityEvent: event,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  /**
   * Performance metrics logging
   */
  logPerformanceMetric(metric: string, value: number, unit: string, metadata: Record<string, any> = {}): void {
    this.info(`Performance metric: ${metric}`, {
      metric,
      value,
      unit,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  /**
   * Business event logging
   */
  logBusinessEvent(event: string, metadata: Record<string, any> = {}): void {
    this.info(`Business event: ${event}`, {
      businessEvent: event,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  /**
   * Express middleware for request logging
   */
  middleware() {
    return (req: any, res: any, next: any) => {
      // Generate correlation ID for request
      const correlationId = req.headers['x-correlation-id'] || this.generateCorrelationId();
      req.correlationId = correlationId;
      res.setHeader('X-Correlation-ID', correlationId);

      const startTime = Date.now();

      // Log request
      this.info('HTTP request received', {
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        correlationId
      });

      // Override res.end to log response
      const originalEnd = res.end;
      res.end = function(chunk: any, encoding: any) {
        const duration = Date.now() - startTime;
        
        // Use the logger instance through closure
        (req as any).logger.logHttpRequest(req, res, duration);
        
        originalEnd.call(this, chunk, encoding);
      };

      // Attach logger to request for use in route handlers
      req.logger = this;

      this.withCorrelationId(correlationId, () => next());
    };
  }

  /**
   * Child logger with additional context
   */
  child(metadata: Record<string, any>): StructuredLogger {
    const childLogger = Object.create(this);
    childLogger.logger = this.logger.child(metadata);
    return childLogger;
  }

  /**
   * Flush logs (useful for graceful shutdown)
   */
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }
}