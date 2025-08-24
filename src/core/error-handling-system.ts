#!/usr/bin/env node

/**
 * Comprehensive Error Handling and Observability System
 * Provides centralized error handling, tracking, and observability
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { logger } from './logger.js';

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  operation: string;
  component: string;
  timestamp: number;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorInfo {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  context: ErrorContext;
  count: number;
  firstOccurrence: number;
  lastOccurrence: number;
  resolution?: string;
  status: 'active' | 'acknowledged' | 'resolved' | 'ignored';
}

export type ErrorType =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'network'
  | 'database'
  | 'file_system'
  | 'external_api'
  | 'configuration'
  | 'business_logic'
  | 'system'
  | 'performance'
  | 'security'
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorPattern {
  id: string;
  pattern: RegExp;
  type: ErrorType;
  severity: ErrorSeverity;
  description: string;
  recommendation: string;
  autoFixable: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (error: ErrorInfo) => boolean;
  severity: ErrorSeverity;
  enabled: boolean;
  cooldownMs: number;
  lastTriggered?: number;
  actions: AlertAction[];
}

export interface AlertAction {
  type: 'log' | 'email' | 'webhook' | 'restart' | 'circuit_breaker';
  config: Record<string, any>;
}

export interface ObservabilityMetrics {
  errorRate: number;
  errorsByType: Record<ErrorType, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByComponent: Record<string, number>;
  meanTimeToResolve: number;
  circuitBreakerStatus: Record<string, 'open' | 'closed' | 'half_open'>;
  healthScore: number;
}

export class ErrorHandlingSystem extends EventEmitter {
  private errors: Map<string, ErrorInfo> = new Map();
  private errorPatterns: ErrorPattern[] = [];
  private alertRules: AlertRule[] = [];
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private correlationContext: Map<string, Record<string, any>> = new Map();
  private isInitialized = false;

  /**
   * Initialize the error handling system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await this.loadErrorPatterns();
    await this.setupDefaultAlertRules();
    this.setupDefaultCircuitBreakers();

    this.isInitialized = true;
    logger.info('🚨 Error handling system initialized');
  }

  /**
   * Handle an error with comprehensive context
   */
  async handleError(error: Error | string, context: Partial<ErrorContext>): Promise<string> {
    const errorId = this.generateErrorId();
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Classify error
    const { type, severity } = this.classifyError(errorMessage, errorStack);

    // Build full context
    const fullContext: ErrorContext = {
      operation: 'unknown',
      component: 'system',
      timestamp: Date.now(),
      requestId: this.generateRequestId(),
      ...context,
    };

    // Check for existing error
    let errorInfo = this.findExistingError(errorMessage, fullContext);

    if (errorInfo) {
      // Update existing error
      errorInfo.count++;
      errorInfo.lastOccurrence = Date.now();
      this.emit('error-updated', errorInfo);
    } else {
      // Create new error
      errorInfo = {
        id: errorId,
        type,
        severity,
        message: errorMessage,
        stack: errorStack,
        context: fullContext,
        count: 1,
        firstOccurrence: Date.now(),
        lastOccurrence: Date.now(),
        status: 'active',
      };

      this.errors.set(errorId, errorInfo);
      this.emit('error-created', errorInfo);
    }

    // Log error with context
    this.logError(errorInfo);

    // Check alert rules
    await this.checkAlertRules(errorInfo);

    // Update circuit breakers
    this.updateCircuitBreakers(errorInfo);

    // Store correlation context
    if (fullContext.requestId) {
      this.correlationContext.set(fullContext.requestId, {
        ...fullContext.metadata,
        errorId: errorInfo.id,
        timestamp: Date.now(),
      });
    }

    return errorInfo.id;
  }

  /**
   * Classify error type and severity
   */
  private classifyError(
    message: string,
    stack?: string
  ): { type: ErrorType; severity: ErrorSeverity } {
    const text = (message + (stack || '')).toLowerCase();

    // Check against patterns
    for (const pattern of this.errorPatterns) {
      if (pattern.pattern.test(text)) {
        return { type: pattern.type, severity: pattern.severity };
      }
    }

    // Default classification based on keywords
    if (text.includes('unauthorized') || text.includes('forbidden')) {
      return { type: 'authorization', severity: 'high' };
    }

    if (text.includes('not found') || text.includes('enoent')) {
      return { type: 'file_system', severity: 'medium' };
    }

    if (text.includes('timeout') || text.includes('network')) {
      return { type: 'network', severity: 'medium' };
    }

    if (text.includes('database') || text.includes('sql')) {
      return { type: 'database', severity: 'high' };
    }

    if (text.includes('memory') || text.includes('heap')) {
      return { type: 'performance', severity: 'high' };
    }

    if (text.includes('security') || text.includes('xss') || text.includes('injection')) {
      return { type: 'security', severity: 'critical' };
    }

    return { type: 'unknown', severity: 'medium' };
  }

  /**
   * Find existing error by similarity
   */
  private findExistingError(message: string, context: ErrorContext): ErrorInfo | null {
    for (const error of this.errors.values()) {
      // Same message and component
      if (error.message === message && error.context.component === context.component) {
        // If occurred within last 5 minutes, consider it the same error
        if (Date.now() - error.lastOccurrence < 5 * 60 * 1000) {
          return error;
        }
      }
    }
    return null;
  }

  /**
   * Log error with appropriate level
   */
  private logError(errorInfo: ErrorInfo): void {
    const logData = {
      errorId: errorInfo.id,
      type: errorInfo.type,
      component: errorInfo.context.component,
      operation: errorInfo.context.operation,
      count: errorInfo.count,
      requestId: errorInfo.context.requestId,
    };

    switch (errorInfo.severity) {
      case 'critical':
        logger.error(`🚨 CRITICAL ERROR: ${errorInfo.message}`, logData);
        break;
      case 'high':
        logger.error(`🔴 HIGH SEVERITY: ${errorInfo.message}`, logData);
        break;
      case 'medium':
        logger.warn(`🟡 MEDIUM SEVERITY: ${errorInfo.message}`, logData);
        break;
      case 'low':
        logger.info(`🔵 LOW SEVERITY: ${errorInfo.message}`, logData);
        break;
    }

    if (errorInfo.stack && errorInfo.severity !== 'low') {
      logger.error('Stack trace:', errorInfo.stack);
    }
  }

  /**
   * Check and trigger alert rules
   */
  private async checkAlertRules(errorInfo: ErrorInfo): Promise<void> {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered && Date.now() - rule.lastTriggered < rule.cooldownMs) {
        continue;
      }

      if (rule.condition(errorInfo)) {
        rule.lastTriggered = Date.now();
        await this.executeAlertActions(rule, errorInfo);
        this.emit('alert-triggered', { rule, error: errorInfo });
      }
    }
  }

  /**
   * Execute alert actions
   */
  private async executeAlertActions(rule: AlertRule, errorInfo: ErrorInfo): Promise<void> {
    for (const action of rule.actions) {
      try {
        switch (action.type) {
          case 'log':
            logger.error(`🚨 ALERT: ${rule.name}`, { errorInfo, rule });
            break;

          case 'webhook':
            await this.executeWebhookAction(action.config, rule, errorInfo);
            break;

          case 'circuit_breaker':
            this.triggerCircuitBreaker(action.config.component);
            break;

          case 'restart':
            logger.warn(`🔄 Restart triggered by alert: ${rule.name}`);
            // Implementation would depend on deployment method
            break;
        }
      } catch (actionError) {
        logger.error(`Failed to execute alert action ${action.type}:`, actionError);
      }
    }
  }

  /**
   * Execute webhook alert action
   */
  private async executeWebhookAction(
    config: Record<string, any>,
    rule: AlertRule,
    errorInfo: ErrorInfo
  ): Promise<void> {
    // Webhook implementation would go here
    logger.info(`📡 Webhook alert for rule: ${rule.name}`, { errorInfo });
  }

  /**
   * Update circuit breakers based on errors
   */
  private updateCircuitBreakers(errorInfo: ErrorInfo): void {
    const component = errorInfo.context.component;
    let breaker = this.circuitBreakers.get(component);

    if (!breaker) {
      breaker = new CircuitBreaker(component);
      this.circuitBreakers.set(component, breaker);
    }

    breaker.recordError(errorInfo);
  }

  /**
   * Trigger circuit breaker manually
   */
  private triggerCircuitBreaker(component: string): void {
    const breaker = this.circuitBreakers.get(component);
    if (breaker) {
      breaker.open();
      logger.warn(`⚡ Circuit breaker opened for component: ${component}`);
    }
  }

  /**
   * Get comprehensive observability metrics
   */
  getMetrics(): ObservabilityMetrics {
    const activeErrors = Array.from(this.errors.values()).filter(e => e.status === 'active');

    const errorsByType = activeErrors.reduce(
      (acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
      },
      {} as Record<ErrorType, number>
    );

    const errorsBySeverity = activeErrors.reduce(
      (acc, error) => {
        acc[error.severity] = (acc[error.severity] || 0) + 1;
        return acc;
      },
      {} as Record<ErrorSeverity, number>
    );

    const errorsByComponent = activeErrors.reduce(
      (acc, error) => {
        const component = error.context.component;
        acc[component] = (acc[component] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Calculate resolution time for resolved errors
    const resolvedErrors = Array.from(this.errors.values()).filter(e => e.status === 'resolved');

    const meanTimeToResolve =
      resolvedErrors.length > 0
        ? resolvedErrors.reduce((sum, error) => {
            return sum + (error.lastOccurrence - error.firstOccurrence);
          }, 0) / resolvedErrors.length
        : 0;

    // Circuit breaker status
    const circuitBreakerStatus = Object.fromEntries(
      Array.from(this.circuitBreakers.entries()).map(([name, breaker]) => [
        name,
        breaker.getState(),
      ])
    );

    // Calculate health score (0-100)
    const criticalErrors = errorsBySeverity.critical || 0;
    const highErrors = errorsBySeverity.high || 0;
    const healthScore = Math.max(0, 100 - criticalErrors * 25 - highErrors * 10);

    return {
      errorRate: activeErrors.length,
      errorsByType,
      errorsBySeverity,
      errorsByComponent,
      meanTimeToResolve,
      circuitBreakerStatus,
      healthScore,
    };
  }

  /**
   * Load error patterns from configuration
   */
  private async loadErrorPatterns(): Promise<void> {
    this.errorPatterns = [
      {
        id: 'sql-injection',
        pattern: /sql.*injection|union.*select|drop.*table/i,
        type: 'security',
        severity: 'critical',
        description: 'Potential SQL injection attempt',
        recommendation: 'Use parameterized queries and input validation',
        autoFixable: false,
      },
      {
        id: 'xss-attack',
        pattern: /<script|javascript:|on\w+\s*=/i,
        type: 'security',
        severity: 'critical',
        description: 'Potential XSS attack',
        recommendation: 'Sanitize user input and use CSP headers',
        autoFixable: false,
      },
      {
        id: 'memory-leak',
        pattern: /memory.*leak|heap.*out.*of.*memory|maximum.*call.*stack/i,
        type: 'performance',
        severity: 'high',
        description: 'Memory-related performance issue',
        recommendation: 'Review memory management and disposal patterns',
        autoFixable: false,
      },
      {
        id: 'authentication-failure',
        pattern: /unauthorized|invalid.*token|authentication.*failed/i,
        type: 'authentication',
        severity: 'high',
        description: 'Authentication failure',
        recommendation: 'Verify credentials and token validity',
        autoFixable: false,
      },
      {
        id: 'database-connection',
        pattern: /connection.*refused|database.*unavailable|timeout.*database/i,
        type: 'database',
        severity: 'high',
        description: 'Database connectivity issue',
        recommendation: 'Check database status and connection settings',
        autoFixable: false,
      },
      {
        id: 'file-not-found',
        pattern: /enoent|file.*not.*found|no.*such.*file/i,
        type: 'file_system',
        severity: 'medium',
        description: 'File system access issue',
        recommendation: 'Verify file paths and permissions',
        autoFixable: false,
      },
    ];
  }

  /**
   * Setup default alert rules
   */
  private async setupDefaultAlertRules(): Promise<void> {
    this.alertRules = [
      {
        id: 'critical-error-burst',
        name: 'Critical Error Burst',
        condition: error => error.severity === 'critical' && error.count >= 3,
        severity: 'critical',
        enabled: true,
        cooldownMs: 5 * 60 * 1000, // 5 minutes
        actions: [
          { type: 'log', config: {} },
          { type: 'circuit_breaker', config: { component: 'system' } },
        ],
      },
      {
        id: 'security-threat',
        name: 'Security Threat Detected',
        condition: error => error.type === 'security',
        severity: 'critical',
        enabled: true,
        cooldownMs: 1 * 60 * 1000, // 1 minute
        actions: [
          { type: 'log', config: {} },
          { type: 'webhook', config: { url: '${SECURITY_WEBHOOK_URL}' } },
        ],
      },
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        condition: error => {
          const recentErrors = Array.from(this.errors.values()).filter(
            e => Date.now() - e.lastOccurrence < 60000
          ); // Last minute
          return recentErrors.length >= 10;
        },
        severity: 'high',
        enabled: true,
        cooldownMs: 10 * 60 * 1000, // 10 minutes
        actions: [{ type: 'log', config: {} }],
      },
    ];
  }

  /**
   * Setup default circuit breakers
   */
  private setupDefaultCircuitBreakers(): void {
    const components = ['database', 'external_api', 'file_system', 'cache'];

    for (const component of components) {
      this.circuitBreakers.set(component, new CircuitBreaker(component));
    }
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique request ID for correlation
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Resolve an error manually
   */
  resolveError(errorId: string, resolution: string): boolean {
    const error = this.errors.get(errorId);
    if (!error) return false;

    error.status = 'resolved';
    error.resolution = resolution;

    this.emit('error-resolved', error);
    logger.info(`✅ Error resolved: ${errorId}`, { resolution });

    return true;
  }

  /**
   * Get error details
   */
  getError(errorId: string): ErrorInfo | null {
    return this.errors.get(errorId) || null;
  }

  /**
   * Get correlation context for request
   */
  getCorrelationContext(requestId: string): Record<string, any> | null {
    return this.correlationContext.get(requestId) || null;
  }

  /**
   * Generate error report
   */
  generateReport(): string {
    const metrics = this.getMetrics();
    const activeErrors = Array.from(this.errors.values())
      .filter(e => e.status === 'active')
      .sort((a, b) => b.lastOccurrence - a.lastOccurrence);

    let report = `
🚨 ERROR HANDLING & OBSERVABILITY REPORT
=======================================

SYSTEM HEALTH:
• Health Score: ${metrics.healthScore}/100
• Active Errors: ${metrics.errorRate}
• Mean Time to Resolve: ${Math.round(metrics.meanTimeToResolve / 1000 / 60)} minutes

ERROR BREAKDOWN:
`;

    // By severity
    for (const [severity, count] of Object.entries(metrics.errorsBySeverity)) {
      const icon =
        severity === 'critical'
          ? '🚨'
          : severity === 'high'
            ? '🔴'
            : severity === 'medium'
              ? '🟡'
              : '🔵';
      report += `${icon} ${severity}: ${count}\n`;
    }

    // By type
    report += '\nERROR TYPES:\n';
    for (const [type, count] of Object.entries(metrics.errorsByType)) {
      report += `• ${type}: ${count}\n`;
    }

    // Recent errors
    if (activeErrors.length > 0) {
      report += '\n🔥 RECENT ACTIVE ERRORS:\n';
      report += `${'─'.repeat(50)}\n`;

      for (const error of activeErrors.slice(0, 10)) {
        const icon =
          error.severity === 'critical'
            ? '🚨'
            : error.severity === 'high'
              ? '🔴'
              : error.severity === 'medium'
                ? '🟡'
                : '🔵';

        const timeSince = Math.round((Date.now() - error.lastOccurrence) / 1000 / 60);
        report += `${icon} [${error.count}x] ${error.message}\n`;
        report += `   📍 ${error.context.component}:${error.context.operation} (${timeSince}min ago)\n`;
        if (error.context.requestId) {
          report += `   🔗 Request: ${error.context.requestId}\n`;
        }
        report += '\n';
      }
    }

    // Circuit breaker status
    if (Object.keys(metrics.circuitBreakerStatus).length > 0) {
      report += '⚡ CIRCUIT BREAKER STATUS:\n';
      report += `${'─'.repeat(50)}\n`;

      for (const [component, status] of Object.entries(metrics.circuitBreakerStatus)) {
        const icon = status === 'open' ? '🔴' : status === 'half_open' ? '🟡' : '🟢';
        report += `${icon} ${component}: ${status}\n`;
      }
      report += '\n';
    }

    return report;
  }

  /**
   * Cleanup old errors and correlation data
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up old errors
    for (const [id, error] of this.errors) {
      if (now - error.lastOccurrence > maxAge && error.status === 'resolved') {
        this.errors.delete(id);
      }
    }

    // Clean up old correlation context
    for (const [id, context] of this.correlationContext) {
      if (now - context.timestamp > maxAge) {
        this.correlationContext.delete(id);
      }
    }
  }

  /**
   * Dispose of the error handling system
   */
  dispose(): void {
    this.errors.clear();
    this.correlationContext.clear();
    this.circuitBreakers.clear();
    this.removeAllListeners();
    logger.info('🗑️ Error handling system disposed');
  }
}

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 5;
  private readonly timeoutMs = 60000; // 1 minute

  constructor(private name: string) {}

  recordError(error: ErrorInfo): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.open();
    }
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  open(): void {
    this.state = 'open';
    logger.warn(`⚡ Circuit breaker opened: ${this.name}`);
  }

  isOpen(): boolean {
    if (this.state === 'closed') return false;

    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeoutMs) {
        this.state = 'half_open';
        return false;
      }
      return true;
    }

    return false; // half_open
  }

  getState(): 'closed' | 'open' | 'half_open' {
    // Check if we should transition from open to half_open
    if (this.state === 'open' && Date.now() - this.lastFailureTime > this.timeoutMs) {
      this.state = 'half_open';
    }

    return this.state;
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const errorSystem = new ErrorHandlingSystem();

  errorSystem
    .initialize()
    .then(() => {
      console.log('🚨 Error handling system initialized');
      console.log(errorSystem.generateReport());
    })
    .catch(error => {
      console.error('Failed to initialize error handling system:', error);
      process.exit(1);
    });
}
