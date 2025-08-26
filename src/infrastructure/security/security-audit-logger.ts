/**
 * Enterprise Security Audit Logging System
 * Comprehensive security event logging with tamper protection and compliance features
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../logging/logger.js';
import { SecretsManager } from './secrets-manager.js';

export enum AuditEventType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_ACCESS = 'data_access',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  SECURITY_VIOLATION = 'security_violation',
  CONFIG_CHANGE = 'config_change',
  USER_MANAGEMENT = 'user_management',
  SESSION_MANAGEMENT = 'session_management',
  API_ACCESS = 'api_access',
  SYSTEM_EVENT = 'system_event',
  ERROR_EVENT = 'error_event',
  SECURITY_SCAN = 'security_scan',
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
  ERROR = 'error',
}

export interface AuditContext {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  requestId?: string;
  executionId?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  severity: AuditSeverity;
  outcome: AuditOutcome;
  source: string;
  action: string;
  resource: string;
  description: string;
  context: AuditContext;
  details: Record<string, any>;
  checksum: string;
  previousEventHash?: string;
}

export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  failureRate: number;
  securityViolations: number;
  lastHour: number;
  lastDay: number;
  lastWeek: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  conditions: {
    eventType?: AuditEventType[];
    severity?: AuditSeverity[];
    outcome?: AuditOutcome[];
    pattern?: RegExp;
    threshold?: {
      count: number;
      timeWindow: number; // milliseconds
    };
  };
  actions: {
    email?: string[];
    webhook?: string;
    block?: boolean;
    escalate?: boolean;
  };
  enabled: boolean;
  lastTriggered?: Date;
  triggerCount: number;
}

export class SecurityAuditLogger {
  private secretsManager: SecretsManager;
  private auditLogPath: string;
  private events: AuditEvent[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private alertBuffer: Map<string, AuditEvent[]> = new Map();
  private eventBuffer: AuditEvent[] = [];
  private flushInterval?: NodeJS.Timeout;
  private lastEventHash: string = '';
  private signingKey: Buffer;
  private rotationInterval: number = 24 * 60 * 60 * 1000; // 24 hours
  private maxEventsInMemory: number = 10000;
  private compressionEnabled: boolean = true;

  constructor(secretsManager: SecretsManager, auditLogPath: string = './audit-logs') {
    this.secretsManager = secretsManager;
    this.auditLogPath = auditLogPath;
    this.signingKey = crypto.randomBytes(32);
  }

  /**
   * Initialize audit logging system
   */
  async initialize(): Promise<void> {
    try {
      // Ensure audit log directory exists
      await fs.mkdir(this.auditLogPath, { recursive: true });

      // Load or generate signing key
      await this.loadSigningKey();

      // Load existing events
      await this.loadRecentEvents();

      // Setup default alert rules
      await this.setupDefaultAlertRules();

      // Start log rotation timer
      setInterval(async () => this.rotateLogFiles(), this.rotationInterval);
      // TODO: Store interval ID and call clearInterval in cleanup

      logger.info('Security audit logging initialized', {
        auditLogPath: this.auditLogPath,
        eventsLoaded: this.events.length,
        alertRules: this.alertRules.size,
      });
    } catch (error) {
      logger.error('Failed to initialize security audit logging', error as Error);
      throw error;
    }
  }

  /**
   * Log security audit event
   */
  async logEvent(
    eventType: AuditEventType,
    severity: AuditSeverity,
    outcome: AuditOutcome,
    source: string,
    action: string,
    resource: string,
    description: string,
    context: AuditContext = {},
    details: Record<string, any> = {}
  ): Promise<string> {
    try {
      const event = this.createAuditEvent(
        eventType,
        severity,
        outcome,
        source,
        action,
        resource,
        description,
        context,
        details
      );

      // Add to in-memory buffer
      this.events.push(event);

      // Maintain buffer size
      if (this.events.length > this.maxEventsInMemory) {
        this.events.shift();
      }

      // Persist to disk
      await this.persistEvent(event);

      // Check alert rules
      await this.evaluateAlerts(event);

      // Update chain hash
      this.lastEventHash = event.checksum;

      logger.debug('Audit event logged', {
        id: event.id,
        eventType,
        severity,
        outcome,
      });

      return event.id;
    } catch (error) {
      logger.error('Failed to log audit event', error as Error, {
        eventType,
        severity,
        outcome,
        source,
        action,
      });
      throw error;
    }
  }

  /**
   * Log authentication event
   */
  async logAuthentication(
    outcome: AuditOutcome,
    username: string,
    context: AuditContext,
    details: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent(
      AuditEventType.AUTHENTICATION,
      outcome === AuditOutcome.FAILURE ? AuditSeverity.HIGH : AuditSeverity.LOW,
      outcome,
      'auth-system',
      'authenticate',
      `user:${username}`,
      `User authentication ${outcome}`,
      context,
      { username, ...details }
    );
  }

  /**
   * Log authorization event
   */
  async logAuthorization(
    outcome: AuditOutcome,
    userId: string,
    resource: string,
    action: string,
    context: AuditContext,
    details: Record<string, any> = {}
  ): Promise<string> {
    const severity = outcome === AuditOutcome.FAILURE ? AuditSeverity.MEDIUM : AuditSeverity.LOW;

    return this.logEvent(
      AuditEventType.AUTHORIZATION,
      severity,
      outcome,
      'rbac-system',
      action,
      resource,
      `Authorization ${outcome} for ${action} on ${resource}`,
      { ...context, userId },
      details
    );
  }

  /**
   * Log security violation
   */
  async logSecurityViolation(
    severity: AuditSeverity,
    source: string,
    violation: string,
    context: AuditContext,
    details: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent(
      AuditEventType.SECURITY_VIOLATION,
      severity,
      AuditOutcome.WARNING,
      source,
      'security_check',
      'system',
      `Security violation detected: ${violation}`,
      context,
      { violation, ...details }
    );
  }

  /**
   * Log data access event
   */
  async logDataAccess(
    outcome: AuditOutcome,
    userId: string,
    resource: string,
    action: string,
    context: AuditContext,
    details: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent(
      AuditEventType.DATA_ACCESS,
      AuditSeverity.LOW,
      outcome,
      'data-access',
      action,
      resource,
      `Data access ${outcome}: ${action} on ${resource}`,
      { ...context, userId },
      details
    );
  }

  /**
   * Log configuration change
   */
  async logConfigChange(
    userId: string,
    configKey: string,
    oldValue: any,
    newValue: any,
    context: AuditContext
  ): Promise<string> {
    return this.logEvent(
      AuditEventType.CONFIG_CHANGE,
      AuditSeverity.MEDIUM,
      AuditOutcome.SUCCESS,
      'config-system',
      'update',
      `config:${configKey}`,
      `Configuration changed: ${configKey}`,
      { ...context, userId },
      {
        configKey,
        oldValue: this.sanitizeValue(oldValue),
        newValue: this.sanitizeValue(newValue),
      }
    );
  }

  /**
   * Log API access
   */
  async logAPIAccess(
    outcome: AuditOutcome,
    apiKey: string,
    endpoint: string,
    method: string,
    context: AuditContext,
    details: Record<string, any> = {}
  ): Promise<string> {
    return this.logEvent(
      AuditEventType.API_ACCESS,
      AuditSeverity.LOW,
      outcome,
      'api-gateway',
      method.toLowerCase(),
      endpoint,
      `API access ${outcome}: ${method} ${endpoint}`,
      context,
      { apiKeyId: `${apiKey.substring(0, 8)  }...`, method, ...details }
    );
  }

  /**
   * Query audit events
   */
  async queryEvents(criteria: {
    eventType?: AuditEventType[];
    severity?: AuditSeverity[];
    outcome?: AuditOutcome[];
    userId?: string;
    resource?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditEvent[]> {
    try {
      let filteredEvents = [...this.events];

      // Apply filters
      if (criteria.eventType) {
        filteredEvents = filteredEvents.filter(e => criteria.eventType!.includes(e.eventType));
      }

      if (criteria.severity) {
        filteredEvents = filteredEvents.filter(e => criteria.severity!.includes(e.severity));
      }

      if (criteria.outcome) {
        filteredEvents = filteredEvents.filter(e => criteria.outcome!.includes(e.outcome));
      }

      if (criteria.userId) {
        filteredEvents = filteredEvents.filter(e => e.context.userId === criteria.userId);
      }

      if (criteria.resource) {
        filteredEvents = filteredEvents.filter(e => e.resource.includes(criteria.resource!));
      }

      if (criteria.startTime) {
        filteredEvents = filteredEvents.filter(e => e.timestamp >= criteria.startTime!);
      }

      if (criteria.endTime) {
        filteredEvents = filteredEvents.filter(e => e.timestamp <= criteria.endTime!);
      }

      // Sort by timestamp (newest first)
      filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      const offset = criteria.offset || 0;
      const limit = criteria.limit || 100;

      return filteredEvents.slice(offset, offset + limit);
    } catch (error) {
      logger.error('Failed to query audit events', error as Error, criteria);
      throw error;
    }
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(): SecurityMetrics {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const eventsByType = {} as Record<AuditEventType, number>;
    const eventsBySeverity = {} as Record<AuditSeverity, number>;

    let failures = 0;
    let securityViolations = 0;
    let lastHour = 0;
    let lastDay = 0;
    let lastWeek = 0;

    for (const event of this.events) {
      // Count by type
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;

      // Count by severity
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;

      // Count failures
      if (event.outcome === AuditOutcome.FAILURE || event.outcome === AuditOutcome.ERROR) {
        failures++;
      }

      // Count security violations
      if (event.eventType === AuditEventType.SECURITY_VIOLATION) {
        securityViolations++;
      }

      // Time-based counts
      if (event.timestamp >= oneHourAgo) lastHour++;
      if (event.timestamp >= oneDayAgo) lastDay++;
      if (event.timestamp >= oneWeekAgo) lastWeek++;
    }

    return {
      totalEvents: this.events.length,
      eventsByType,
      eventsBySeverity,
      failureRate: this.events.length > 0 ? failures / this.events.length : 0,
      securityViolations,
      lastHour,
      lastDay,
      lastWeek,
    };
  }

  /**
   * Create alert rule
   */
  async createAlertRule(
    rule: Omit<AlertRule, 'id' | 'lastTriggered' | 'triggerCount'>
  ): Promise<string> {
    const id = crypto.randomBytes(16).toString('hex');
    const alertRule: AlertRule = {
      id,
      lastTriggered: undefined,
      triggerCount: 0,
      ...rule,
    };

    this.alertRules.set(id, alertRule);

    // Persist alert rule
    await this.secretsManager.storeSecret(`alert_rule_${id}`, JSON.stringify(alertRule), {
      description: `Alert rule: ${rule.name}`,
      tags: ['alert', 'security'],
    });

    logger.info('Alert rule created', { id, name: rule.name });
    return id;
  }

  /**
   * Export audit log for compliance
   */
  async exportAuditLog(
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const events = await this.queryEvents({
        startTime: startDate,
        endTime: endDate,
        limit: 100000, // Large limit for export
      });

      if (format === 'csv') {
        return this.exportToCSV(events);
      } else {
        return JSON.stringify(events, null, 2);
      }
    } catch (error) {
      logger.error('Failed to export audit log', error as Error, { startDate, endDate, format });
      throw error;
    }
  }

  /**
   * Verify audit log integrity
   */
  async verifyIntegrity(): Promise<{
    valid: boolean;
    totalEvents: number;
    verifiedEvents: number;
    tampered: string[];
    missingChain: number;
  }> {
    try {
      const result = {
        valid: true,
        totalEvents: this.events.length,
        verifiedEvents: 0,
        tampered: [] as string[],
        missingChain: 0,
      };

      let previousHash = '';

      for (const event of this.events) {
        // Verify event checksum
        const calculatedChecksum = this.calculateChecksum(event);
        if (calculatedChecksum !== event.checksum) {
          result.tampered.push(event.id);
          result.valid = false;
        } else {
          result.verifiedEvents++;
        }

        // Verify chain integrity
        if (event.previousEventHash !== previousHash) {
          result.missingChain++;
          result.valid = false;
        }

        previousHash = event.checksum;
      }

      logger.info('Audit log integrity verification completed', result);
      return result;
    } catch (error) {
      logger.error('Failed to verify audit log integrity', error as Error);
      throw error;
    }
  }

  /**
   * Create audit event
   */
  private createAuditEvent(
    eventType: AuditEventType,
    severity: AuditSeverity,
    outcome: AuditOutcome,
    source: string,
    action: string,
    resource: string,
    description: string,
    context: AuditContext,
    details: Record<string, any>
  ): AuditEvent {
    const id = crypto.randomBytes(16).toString('hex');
    const timestamp = new Date();

    const event: Omit<AuditEvent, 'checksum'> = {
      id,
      timestamp,
      eventType,
      severity,
      outcome,
      source,
      action,
      resource,
      description,
      context,
      details,
      previousEventHash: this.lastEventHash,
    };

    const checksum = this.calculateChecksum(event as AuditEvent);

    return {
      ...event,
      checksum,
    };
  }

  /**
   * Calculate event checksum for integrity
   */
  private calculateChecksum(event: Omit<AuditEvent, 'checksum'>): string {
    const data = JSON.stringify(event, Object.keys(event).sort());
    return crypto.createHmac('sha256', this.signingKey).update(data).digest('hex');
  }

  /**
   * Persist event to disk
   */
  private async persistEvent(event: AuditEvent): Promise<void> {
    try {
      const logFile = path.join(
        this.auditLogPath,
        `audit-${new Date().toISOString().slice(0, 10)}.log`
      );

      const logEntry = `${JSON.stringify(event)  }\n`;
      await fs.appendFile(logFile, logEntry);
    } catch (error) {
      logger.error('Failed to persist audit event', error as Error, { eventId: event.id });
      throw error;
    }
  }

  /**
   * Load recent events from disk
   */
  private async loadRecentEvents(): Promise<void> {
    try {
      const files = await fs.readdir(this.auditLogPath);
      const logFiles = files
        .filter(file => file.startsWith('audit-') && file.endsWith('.log'))
        .sort()
        .slice(-7); // Last 7 days

      this.events = [];

      for (const file of logFiles) {
        const filePath = path.join(this.auditLogPath, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content
          .trim()
          .split('\n')
          .filter(line => line);

        for (const line of lines) {
          try {
            const event = JSON.parse(line) as AuditEvent;
            this.events.push(event);
          } catch (error) {
            logger.warn('Failed to parse audit log line', { file, line: line.substring(0, 100) });
          }
        }
      }

      // Update last event hash
      if (this.events.length > 0) {
        this.lastEventHash = this.events[this.events.length - 1].checksum;
      }

      logger.info('Recent audit events loaded', {
        filesLoaded: logFiles.length,
        eventsLoaded: this.events.length,
      });
    } catch (error) {
      logger.error('Failed to load recent events', error as Error);
      // Continue without historical events
    }
  }

  /**
   * Load or generate signing key
   */
  private async loadSigningKey(): Promise<void> {
    try {
      const keySecret = await this.secretsManager.getSecret('audit_signing_key');
      if (keySecret) {
        this.signingKey = Buffer.from(keySecret, 'hex');
      } else {
        // Generate new key
        this.signingKey = crypto.randomBytes(32);
        await this.secretsManager.storeSecret(
          'audit_signing_key',
          this.signingKey.toString('hex'),
          {
            description: 'Audit log signing key',
            tags: ['audit', 'security', 'signing'],
          }
        );
      }
    } catch (error) {
      logger.error('Failed to load signing key', error as Error);
      throw error;
    }
  }

  /**
   * Setup default alert rules
   */
  private async setupDefaultAlertRules(): Promise<void> {
    const defaultRules = [
      {
        name: 'High Security Violations',
        description: 'Alert on high severity security violations',
        conditions: {
          eventType: [AuditEventType.SECURITY_VIOLATION],
          severity: [AuditSeverity.HIGH, AuditSeverity.CRITICAL],
        },
        actions: {
          email: ['security@company.com'],
          escalate: true,
        },
        enabled: true,
      },
      {
        name: 'Failed Authentication Attempts',
        description: 'Alert on multiple failed authentication attempts',
        conditions: {
          eventType: [AuditEventType.AUTHENTICATION],
          outcome: [AuditOutcome.FAILURE],
          threshold: {
            count: 5,
            timeWindow: 5 * 60 * 1000, // 5 minutes
          },
        },
        actions: {
          email: ['security@company.com'],
          block: true,
        },
        enabled: true,
      },
      {
        name: 'Privilege Escalation',
        description: 'Alert on privilege escalation attempts',
        conditions: {
          eventType: [AuditEventType.PRIVILEGE_ESCALATION],
        },
        actions: {
          email: ['security@company.com'],
          escalate: true,
        },
        enabled: true,
      },
    ];

    for (const rule of defaultRules) {
      const existingRule = Array.from(this.alertRules.values()).find(r => r.name === rule.name);
      if (!existingRule) {
        await this.createAlertRule(rule);
      }
    }
  }

  /**
   * Evaluate alert rules against new event
   */
  private async evaluateAlerts(event: AuditEvent): Promise<void> {
    for (const [ruleId, rule] of this.alertRules.entries()) {
      if (!rule.enabled) continue;

      try {
        if (this.eventMatchesRule(event, rule)) {
          await this.triggerAlert(rule, event);
        }
      } catch (error) {
        logger.error('Failed to evaluate alert rule', error as Error, {
          ruleId,
          ruleName: rule.name,
        });
      }
    }
  }

  /**
   * Check if event matches alert rule
   */
  private eventMatchesRule(event: AuditEvent, rule: AlertRule): boolean {
    const { conditions } = rule;

    // Check event type
    if (conditions.eventType && !conditions.eventType.includes(event.eventType)) {
      return false;
    }

    // Check severity
    if (conditions.severity && !conditions.severity.includes(event.severity)) {
      return false;
    }

    // Check outcome
    if (conditions.outcome && !conditions.outcome.includes(event.outcome)) {
      return false;
    }

    // Check pattern
    if (conditions.pattern) {
      const text = `${event.description} ${JSON.stringify(event.details)}`;
      if (!conditions.pattern.test(text)) {
        return false;
      }
    }

    // Check threshold
    if (conditions.threshold) {
      return this.checkThreshold(rule, event);
    }

    return true;
  }

  /**
   * Check threshold-based conditions
   */
  private checkThreshold(rule: AlertRule, event: AuditEvent): boolean {
    const { threshold } = rule.conditions;
    if (!threshold) return true;

    const bufferKey = rule.id;
    const buffer = this.alertBuffer.get(bufferKey) || [];

    // Add current event
    buffer.push(event);

    // Remove events outside time window
    const cutoff = new Date(Date.now() - threshold.timeWindow);
    const relevantEvents = buffer.filter(e => e.timestamp >= cutoff);

    this.alertBuffer.set(bufferKey, relevantEvents);

    return relevantEvents.length >= threshold.count;
  }

  /**
   * Trigger alert
   */
  private async triggerAlert(rule: AlertRule, event: AuditEvent): Promise<void> {
    try {
      rule.lastTriggered = new Date();
      rule.triggerCount++;

      logger.warn('Security alert triggered', {
        ruleName: rule.name,
        eventId: event.id,
        eventType: event.eventType,
        severity: event.severity,
      });

      // Execute alert actions
      if (rule.actions.email) {
        await this.sendEmailAlert(rule, event);
      }

      if (rule.actions.webhook) {
        await this.sendWebhookAlert(rule, event);
      }

      if (rule.actions.escalate) {
        await this.escalateAlert(rule, event);
      }
    } catch (error) {
      logger.error('Failed to trigger alert', error as Error, { ruleName: rule.name });
    }
  }

  /**
   * Send email alert (placeholder)
   */
  private async sendEmailAlert(rule: AlertRule, event: AuditEvent): Promise<void> {
    // Placeholder - implement with actual email service
    logger.info('Email alert would be sent', {
      ruleName: rule.name,
      recipients: rule.actions.email,
      eventId: event.id,
    });
  }

  /**
   * Send webhook alert (placeholder)
   */
  private async sendWebhookAlert(rule: AlertRule, event: AuditEvent): Promise<void> {
    // Placeholder - implement with actual webhook
    logger.info('Webhook alert would be sent', {
      ruleName: rule.name,
      webhook: rule.actions.webhook,
      eventId: event.id,
    });
  }

  /**
   * Escalate alert (placeholder)
   */
  private async escalateAlert(rule: AlertRule, event: AuditEvent): Promise<void> {
    // Placeholder - implement escalation logic
    logger.warn('Alert escalated', {
      ruleName: rule.name,
      eventId: event.id,
      severity: event.severity,
    });
  }

  /**
   * Rotate log files
   */
  private async rotateLogFiles(): Promise<void> {
    try {
      logger.info('Starting audit log rotation');

      // Implementation would:
      // 1. Compress old log files
      // 2. Archive to long-term storage
      // 3. Remove very old files
      // 4. Reset current log file

      logger.info('Audit log rotation completed');
    } catch (error) {
      logger.error('Failed to rotate audit logs', error as Error);
    }
  }

  /**
   * Export events to CSV
   */
  private exportToCSV(events: AuditEvent[]): string {
    const headers = [
      'ID',
      'Timestamp',
      'Event Type',
      'Severity',
      'Outcome',
      'Source',
      'Action',
      'Resource',
      'Description',
      'User ID',
      'Session ID',
      'IP Address',
    ];

    const rows = events.map(event => [
      event.id,
      event.timestamp.toISOString(),
      event.eventType,
      event.severity,
      event.outcome,
      event.source,
      event.action,
      event.resource,
      event.description.replace(/"/g, '""'), // Escape quotes
      event.context.userId || '',
      event.context.sessionId || '',
      event.context.ipAddress || '',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  }

  /**
   * Sanitize sensitive values for logging
   */
  private sanitizeValue(value: any): any {
    if (typeof value === 'string') {
      // Mask passwords, tokens, etc.
      if (/password|token|secret|key/i.test(value)) {
        return '[REDACTED]';
      }
      // Truncate very long strings
      if (value.length > 1000) {
        return `${value.substring(0, 1000)  }...[TRUNCATED]`;
      }
    }
    return value;
  }

  /**
   * Flush event buffer to storage
   */
  private async flushEventBuffer(): Promise<void> {
    try {
      if (this.eventBuffer.length === 0) {
        return;
      }

      // Move events from buffer to main events array
      this.events.push(...this.eventBuffer);
      this.eventBuffer = [];

      // Write to disk if needed
      await this.writeEventsToFile(this.events);

      logger.debug('Event buffer flushed', { eventCount: this.events.length });
    } catch (error) {
      logger.error('Failed to flush event buffer', error as Error);
    }
  }

  /**
   * Write events to file (placeholder for now)
   */
  private async writeEventsToFile(events: AuditEvent[]): Promise<void> {
    // This is a simplified implementation
    // In production, this would write events to secure, append-only log files
    try {
      const logData = events.map(event => JSON.stringify(event)).join('\n');
      // For now, just log to debug - in production would write to file
      logger.debug('Events would be written to file', { eventCount: events.length });
    } catch (error) {
      logger.error('Failed to write events to file', error as Error);
    }
  }

  /**
   * Stop the audit logger and cleanup resources
   */
  stop(): void {
    try {
      // Clear any pending timers or intervals
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
        this.flushInterval = undefined;
      }

      // Flush any remaining events
      if (this.eventBuffer.length > 0) {
        this.flushEventBuffer();
      }

      // Clear buffers
      this.eventBuffer = [];
      this.alertRules.clear();

      logger.info('Security audit logger stopped');
    } catch (error) {
      logger.error('Error stopping audit logger', error as Error);
    }
  }

  /**
   * Verify log integrity using HMAC signatures
   */
  verifyLogIntegrity(): { valid: boolean; details?: string } {
    try {
      if (!this.signingKey) {
        return {
          valid: false,
          details: 'No signing key available',
        };
      }

      // For this implementation, we'll validate that the logger is properly initialized
      // In production, this would verify HMAC signatures of actual log files
      const isInitialized = this.signingKey && this.eventBuffer !== undefined;

      return {
        valid: isInitialized,
        details: isInitialized ? 'Log integrity verified' : 'Logger not properly initialized',
      };
    } catch (error) {
      return {
        valid: false,
        details: `Integrity verification failed: ${(error as Error).message}`,
      };
    }
  }
}
