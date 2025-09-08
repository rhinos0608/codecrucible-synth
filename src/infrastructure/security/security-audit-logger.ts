import { appendFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { logger } from '../logging/logger.js';

export enum AuditEventType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  TOOL_EXECUTION = 'tool_execution',
  SECURITY_VALIDATION = 'security_validation',
  SECURITY_VIOLATION = 'security_violation',
  DATA_ACCESS = 'data_access',
  CONFIGURATION_CHANGE = 'configuration_change',
  SECURITY_INCIDENT = 'security_incident',
  PERMISSION_DENIED = 'permission_denied',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INPUT_VALIDATION_FAILED = 'input_validation_failed',
  SYSTEM_EVENT = 'system_event',
  ERROR_EVENT = 'error_event',
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AuditOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  WARNING = 'warning',
  BLOCKED = 'blocked',
  ERROR = 'error',
}

export interface AuditEvent {
  timestamp: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  outcome: AuditOutcome;
  userId?: string;
  sessionId?: string;
  resource?: string;
  action?: string;
  details?: Record<string, unknown>;
  errorMessage?: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
}

export class SecurityAuditLogger {
  private static instance: SecurityAuditLogger;
  private auditQueue: AuditEvent[] = [];
  private flushInterval: NodeJS.Timeout;
  private auditFilePath: string;

  private constructor() {
    this.auditFilePath = process.env.AUDIT_LOG_PATH || 'audit.log';
    this.flushInterval = setInterval(() => {
      this.flushAuditEvents();
    }, 30000); // Flush every 30 seconds
  }

  public static getInstance(): SecurityAuditLogger {
    if (!SecurityAuditLogger.instance) {
      SecurityAuditLogger.instance = new SecurityAuditLogger();
    }
    return SecurityAuditLogger.instance;
  }

  public logAuditEvent(event: Omit<AuditEvent, 'timestamp'>): void {
    const auditEvent: AuditEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    this.auditQueue.push(auditEvent);

    // Log immediately for critical events
    if (event.severity === AuditSeverity.CRITICAL) {
      this.logEvent(auditEvent);
    }

    // Flush queue if it gets too large
    if (this.auditQueue.length > 100) {
      this.flushAuditEvents();
    }
  }

  public logAuthenticationEvent(
    outcome: AuditOutcome,
    userId?: string,
    details?: Record<string, unknown>
  ): void {
    this.logAuditEvent({
      eventType: AuditEventType.AUTHENTICATION,
      severity: outcome === AuditOutcome.FAILURE ? AuditSeverity.HIGH : AuditSeverity.LOW,
      outcome,
      userId,
      details,
    });
  }

  public logAuthorizationEvent(
    outcome: AuditOutcome,
    userId?: string,
    resource?: string,
    action?: string
  ): void {
    this.logAuditEvent({
      eventType: AuditEventType.AUTHORIZATION,
      severity: outcome === AuditOutcome.BLOCKED ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
      outcome,
      userId,
      resource,
      action,
    });
  }

  public logToolExecutionEvent(
    outcome: AuditOutcome,
    toolName: string,
    userId?: string,
    details?: Record<string, unknown>
  ): void {
    this.logAuditEvent({
      eventType: AuditEventType.TOOL_EXECUTION,
      severity: outcome === AuditOutcome.FAILURE ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
      outcome,
      resource: toolName,
      userId,
      details,
    });
  }

  public logSecurityIncident(
    severity: AuditSeverity,
    description: string,
    userId?: string,
    details?: Record<string, unknown>
  ): void {
    this.logAuditEvent({
      eventType: AuditEventType.SECURITY_INCIDENT,
      severity,
      outcome: AuditOutcome.WARNING,
      userId,
      errorMessage: description,
      details,
    });
  }

  public logInputValidationFailure(input: string, reason: string, userId?: string): void {
    this.logAuditEvent({
      eventType: AuditEventType.INPUT_VALIDATION_FAILED,
      severity: AuditSeverity.MEDIUM,
      outcome: AuditOutcome.BLOCKED,
      userId,
      errorMessage: reason,
      details: { input: input.substring(0, 100) }, // Log only first 100 chars for security
    });
  }

  public logRateLimitExceeded(userId: string, resource: string, limit: number): void {
    this.logAuditEvent({
      eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
      severity: AuditSeverity.MEDIUM,
      outcome: AuditOutcome.BLOCKED,
      userId,
      resource,
      details: { limit },
    });
  }

  public logSecurityViolation(
    userId: string,
    violation: string,
    details?: Record<string, unknown>
  ): void {
    this.logAuditEvent({
      eventType: AuditEventType.SECURITY_INCIDENT,
      severity: AuditSeverity.HIGH,
      outcome: AuditOutcome.ERROR,
      userId,
      errorMessage: violation,
      details,
    });
  }

  private flushAuditEvents(): void {
    if (this.auditQueue.length === 0) {
      return;
    }

    const events = [...this.auditQueue];
    this.auditQueue = [];

    events.forEach(event => this.logEvent(event));
  }

  public logEvent(event: AuditEvent): void {
    const logLevel = this.getLogLevel(event.severity);
    const message = `[AUDIT] ${event.eventType} - ${event.outcome} (${event.severity})`;

    logger[logLevel](message, {
      auditEvent: event,
    });

    void this.sendToCentralAudit(event);
  }

  private getLogLevel(severity: AuditSeverity): 'info' | 'warn' | 'error' {
    switch (severity) {
      case AuditSeverity.LOW:
        return 'info';
      case AuditSeverity.MEDIUM:
        return 'warn';
      case AuditSeverity.HIGH:
      case AuditSeverity.CRITICAL:
        return 'error';
      default:
        return 'info';
    }
  }

  public cleanup(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushAuditEvents();
  }

  private async sendToCentralAudit(event: Readonly<AuditEvent>): Promise<void> {
    try {
      await mkdir(dirname(this.auditFilePath), { recursive: true });
      await appendFile(this.auditFilePath, `${JSON.stringify(event)}\n`);
    } catch (error) {
      logger.warn('Failed to write audit event', { error });
    }
  }
}
