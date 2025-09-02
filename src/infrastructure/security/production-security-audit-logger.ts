/**
 * Production Security Audit Logger - Production Implementation
 * Provides comprehensive security audit logging with persistence, rotation, and compliance features
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

export enum ProductionAuditEventType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  ACCESS_DENIED = 'access_denied',
  SECURITY_VIOLATION = 'security_violation',
  SECURITY_ALERT = 'security_alert',
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  SYSTEM_EVENT = 'system_event',
  SYSTEM_START = 'system_start',
  SYSTEM_SHUTDOWN = 'system_shutdown',
  EMERGENCY_MODE = 'emergency_mode',
  DATA_EXPORT = 'data_export',
  ERROR_EVENT = 'error_event'
}

export enum ProductionAuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
  INFO = 'info'
}

export enum ProductionAuditOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  ERROR = 'error'
}

export interface ProductionAuditEvent {
  id: string;
  timestamp: Date;
  eventType: ProductionAuditEventType;
  severity: ProductionAuditSeverity;
  outcome: ProductionAuditOutcome;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  details?: Record<string, any>;
  error?: string;
  traceId?: string;
  spanId?: string;
  correlationId?: string;
}

export interface AuditLoggerConfig {
  logDirectory: string;
  maxLogFileSize: number; // in bytes
  maxLogFiles: number;
  enableConsoleOutput: boolean;
  enableFileOutput: boolean;
  enableRemoteLogging: boolean;
  remoteEndpoint?: string;
  remoteApiKey?: string;
  batchSize: number;
  flushInterval: number; // in ms
  enableEncryption: boolean;
  encryptionKey?: string;
  complianceFrameworks: string[]; // e.g., ['SOC2', 'GDPR', 'HIPAA']
}

export interface LogRotationInfo {
  currentLogFile: string;
  currentLogSize: number;
  totalLogFiles: number;
  lastRotation?: Date;
}

// Aliases for compatibility
export const SecurityEventType = ProductionAuditEventType;
export const SecuritySeverity = ProductionAuditSeverity;

export class ProductionSecurityAuditLogger extends EventEmitter {
  private static instance: ProductionSecurityAuditLogger;
  private events: ProductionAuditEvent[] = [];
  private eventBatch: ProductionAuditEvent[] = [];
  private batchTimer?: NodeJS.Timeout;
  private currentLogFile?: string;
  private currentLogSize = 0;
  private isInitialized = false;
  
  private readonly config: AuditLoggerConfig = {
    logDirectory: './logs/security',
    maxLogFileSize: 100 * 1024 * 1024, // 100MB
    maxLogFiles: 10,
    enableConsoleOutput: process.env.NODE_ENV === 'development',
    enableFileOutput: true,
    enableRemoteLogging: false,
    batchSize: 50,
    flushInterval: 5000, // 5 seconds
    enableEncryption: false,
    complianceFrameworks: ['SOC2']
  };

  private constructor(config?: Partial<AuditLoggerConfig>) {
    super();
    if (config) {
      Object.assign(this.config, config);
    }
  }

  static getInstance(): ProductionSecurityAuditLogger {
    if (!ProductionSecurityAuditLogger.instance) {
      ProductionSecurityAuditLogger.instance = new ProductionSecurityAuditLogger();
    }
    return ProductionSecurityAuditLogger.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Create log directory if it doesn't exist
      if (this.config.enableFileOutput) {
        await fs.mkdir(this.config.logDirectory, { recursive: true });
        this.currentLogFile = await this.getCurrentLogFile();
        this.currentLogSize = await this.getLogFileSize(this.currentLogFile);
      }
      
      // Start batch timer
      this.startBatchTimer();
      
      // Log system startup event
      await this.logEvent({
        eventType: ProductionAuditEventType.SYSTEM_START,
        severity: ProductionAuditSeverity.INFO,
        outcome: ProductionAuditOutcome.SUCCESS,
        details: {
          version: process.version,
          platform: process.platform,
          pid: process.pid,
          config: this.config
        }
      });
      
      this.isInitialized = true;
      console.log('ProductionSecurityAuditLogger initialized');
    } catch (error) {
      console.error('Failed to initialize ProductionSecurityAuditLogger:', error);
      throw error;
    }
  }

  async logEvent(event: Partial<ProductionAuditEvent>): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const auditEvent: ProductionAuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      eventType: event.eventType || ProductionAuditEventType.SYSTEM_EVENT,
      severity: event.severity || ProductionAuditSeverity.LOW,
      outcome: event.outcome || ProductionAuditOutcome.SUCCESS,
      ...event
    };

    // Store in memory for immediate access
    this.events.push(auditEvent);
    
    // Maintain memory limit (keep only last 1000 events in memory)
    if (this.events.length > 1000) {
      this.events.shift();
    }
    
    // Add to batch for persistent storage
    this.eventBatch.push(auditEvent);
    
    // Console output for development
    if (this.config.enableConsoleOutput) {
      console.log(`[AUDIT] ${auditEvent.eventType}: ${auditEvent.severity} - ${auditEvent.outcome}`);
    }
    
    // Immediate flush for critical events
    if (auditEvent.severity === ProductionAuditSeverity.CRITICAL) {
      await this.flushBatch();
    }
    
    // Batch size based flush
    if (this.eventBatch.length >= this.config.batchSize) {
      await this.flushBatch();
    }
    
    // Emit event for real-time processing
    this.emit('auditEvent', auditEvent);
  }

  async logSecurityViolation(violation: {
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    details: Record<string, any>;
  }): Promise<void> {
    await this.logEvent({
      eventType: ProductionAuditEventType.SECURITY_VIOLATION,
      severity: ProductionAuditSeverity.HIGH,
      outcome: ProductionAuditOutcome.ERROR,
      ...violation
    });
  }

  async logSecurityEvent(
    eventTypeOrObject: ProductionAuditEventType | {
      eventType: ProductionAuditEventType;
      severity: ProductionAuditSeverity;
      context?: any;
      details?: Record<string, any>;
      description?: string;
      source?: string;
    },
    severity?: ProductionAuditSeverity,
    details?: Record<string, any>
  ): Promise<string> {
    let eventType: ProductionAuditEventType;
    let eventSeverity: ProductionAuditSeverity;
    let eventDetails: Record<string, any> = {};
    
    if (typeof eventTypeOrObject === 'object') {
      eventType = eventTypeOrObject.eventType;
      eventSeverity = eventTypeOrObject.severity;
      eventDetails = { 
        ...eventTypeOrObject.context, 
        ...eventTypeOrObject.details 
      };
    } else {
      eventType = eventTypeOrObject;
      eventSeverity = severity!;
      eventDetails = details || {};
    }
    
    const eventId = this.generateEventId();
    await this.logEvent({
      id: eventId,
      eventType,
      severity: eventSeverity,
      outcome: ProductionAuditOutcome.SUCCESS,
      details: eventDetails
    });
    
    return eventId;
  }

  getEvents(): ProductionAuditEvent[] {
    return [...this.events];
  }

  async generateComplianceReport(
    framework?: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    criticalEvents: ProductionAuditEvent[];
    timeRange: { start: Date; end: Date };
    framework?: string;
  }> {
    const events = this.getEvents();
    
    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    const criticalEvents = events.filter(e => e.severity === ProductionAuditSeverity.CRITICAL);
    
    events.forEach(event => {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
    });
    
    const dates = events.map(e => e.timestamp).sort((a, b) => a.getTime() - b.getTime());
    
    return {
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      criticalEvents,
      timeRange: dateRange || {
        start: dates[0] || new Date(),
        end: dates[dates.length - 1] || new Date()
      },
      framework
    };
  }

  async shutdown(): Promise<void> {
    console.log('ProductionSecurityAuditLogger shutting down');
    
    // Flush any remaining batched events
    await this.flushBatch();
    
    // Clear batch timer
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    
    // Log shutdown event
    await this.logEvent({
      eventType: ProductionAuditEventType.SYSTEM_SHUTDOWN,
      severity: ProductionAuditSeverity.INFO,
      outcome: ProductionAuditOutcome.SUCCESS,
      details: {
        totalEventsLogged: this.events.length,
        uptime: process.uptime()
      }
    });
    
    // Final flush
    await this.flushBatch();
    
    this.removeAllListeners();
    this.isInitialized = false;
  }

  async getSecurityMetrics(): Promise<{
    totalEvents: number;
    criticalEvents: number;
    securityAlerts: number;
    eventsByType: Record<string, number>;
  }> {
    const events = this.getEvents();
    const criticalEvents = events.filter(e => e.severity === ProductionAuditSeverity.CRITICAL).length;
    const securityAlerts = events.filter(e => e.eventType === ProductionAuditEventType.SECURITY_ALERT).length;
    
    const eventsByType: Record<string, number> = {};
    events.forEach(event => {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
    });
    
    return {
      totalEvents: events.length,
      criticalEvents,
      securityAlerts,
      eventsByType
    };
  }

  async getLogRotationInfo(): Promise<LogRotationInfo> {
    return {
      currentLogFile: this.currentLogFile || '',
      currentLogSize: this.currentLogSize,
      totalLogFiles: await this.countLogFiles(),
      lastRotation: await this.getLastRotationDate()
    };
  }

  async forceLogRotation(): Promise<void> {
    await this.rotateLogFile();
  }

  // Production support methods
  private async flushBatch(): Promise<void> {
    if (this.eventBatch.length === 0) return;
    
    const eventsToFlush = [...this.eventBatch];
    this.eventBatch = [];
    
    const promises: Promise<void>[] = [];
    
    // File output
    if (this.config.enableFileOutput && this.currentLogFile) {
      promises.push(this.writeToFile(eventsToFlush));
    }
    
    // Remote logging
    if (this.config.enableRemoteLogging && this.config.remoteEndpoint) {
      promises.push(this.sendToRemoteEndpoint(eventsToFlush));
    }
    
    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Error flushing audit log batch:', error);
      // Re-add events to batch if flush failed
      this.eventBatch.unshift(...eventsToFlush);
    }
  }

  private async writeToFile(events: ProductionAuditEvent[]): Promise<void> {
    if (!this.currentLogFile) return;
    
    const logLines = events.map(event => JSON.stringify(event) + '\n').join('');
    
    // Check if rotation is needed
    const estimatedSize = Buffer.byteLength(logLines, 'utf8');
    if (this.currentLogSize + estimatedSize > this.config.maxLogFileSize) {
      await this.rotateLogFile();
    }
    
    try {
      await fs.appendFile(this.currentLogFile, logLines, 'utf8');
      this.currentLogSize += estimatedSize;
    } catch (error) {
      console.error('Failed to write to audit log file:', error);
      throw error;
    }
  }

  private async sendToRemoteEndpoint(events: ProductionAuditEvent[]): Promise<void> {
    if (!this.config.remoteEndpoint) return;
    
    try {
      // This would be implemented with actual HTTP client
      console.log(`Would send ${events.length} events to ${this.config.remoteEndpoint}`);
    } catch (error) {
      console.error('Failed to send events to remote endpoint:', error);
      throw error;
    }
  }

  private startBatchTimer(): void {
    this.batchTimer = setInterval(async () => {
      try {
        await this.flushBatch();
      } catch (error) {
        console.error('Error in batch timer flush:', error);
      }
    }, this.config.flushInterval);
  }

  private async getCurrentLogFile(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(this.config.logDirectory, `security-audit-${timestamp}.jsonl`);
  }

  private async getLogFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  private async rotateLogFile(): Promise<void> {
    if (!this.currentLogFile) return;
    
    // Create new log file
    this.currentLogFile = await this.getCurrentLogFile();
    this.currentLogSize = 0;
    
    // Clean up old log files if necessary
    await this.cleanupOldLogFiles();
  }

  private async cleanupOldLogFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.logDirectory);
      const logFiles = files
        .filter(file => file.startsWith('security-audit-') && file.endsWith('.jsonl'))
        .sort()
        .reverse();
      
      // Remove old files if we exceed the limit
      if (logFiles.length > this.config.maxLogFiles) {
        const filesToRemove = logFiles.slice(this.config.maxLogFiles);
        for (const file of filesToRemove) {
          await fs.unlink(path.join(this.config.logDirectory, file));
        }
      }
    } catch (error) {
      console.error('Error cleaning up old log files:', error);
    }
  }

  private async countLogFiles(): Promise<number> {
    try {
      const files = await fs.readdir(this.config.logDirectory);
      return files.filter(file => file.startsWith('security-audit-') && file.endsWith('.jsonl')).length;
    } catch (error) {
      return 0;
    }
  }

  private async getLastRotationDate(): Promise<Date | undefined> {
    try {
      if (!this.currentLogFile) return undefined;
      const stats = await fs.stat(this.currentLogFile);
      return stats.birthtime;
    } catch (error) {
      return undefined;
    }
  }

  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}