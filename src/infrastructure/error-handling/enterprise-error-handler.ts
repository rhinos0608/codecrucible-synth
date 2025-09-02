/**
 * Enterprise Error Handler
 * Integrates all enterprise error handling components for unified error management
 */

import {
  ErrorHandler as BaseErrorHandler,
  ErrorFactory as BaseErrorFactory,
} from './structured-error-system.js';
import {
  SecurityAuditLogger,
  AuditEventType,
  AuditSeverity,
  AuditOutcome,
} from '../security/security-audit-logger.js';
import { EnterpriseConfigManager } from '../../application/config/enterprise-config-manager.js';
import { AdvancedInputValidator } from '../security/input-validation-system.js';
import {
  ErrorHandler as AdvancedErrorHandler,
  ErrorFactory,
  StructuredError,
  ErrorCategory,
  ErrorSeverity,
  ServiceResponse,
} from './structured-error-system.js';

export interface EnterpriseErrorConfig {
  enableAuditLogging: boolean;
  enableMetrics: boolean;
  enableAlerts: boolean;
  maxRetryAttempts: number;
  circuitBreakerThreshold: number;
  rateLimitingEnabled: boolean;
  securityValidationEnabled: boolean;
}

export class EnterpriseErrorHandler {
  private auditLogger?: SecurityAuditLogger;
  private configManager?: EnterpriseConfigManager;
  private config: EnterpriseErrorConfig;
  private errorMetrics = new Map<
    string,
    {
      count: number;
      lastOccurrence: Date;
      severity: ErrorSeverity;
      category: ErrorCategory;
    }
  >();

  constructor(
    auditLogger?: SecurityAuditLogger,
    configManager?: EnterpriseConfigManager,
    config: Partial<EnterpriseErrorConfig> = {}
  ) {
    this.auditLogger = auditLogger;
    this.configManager = configManager;
    this.config = {
      enableAuditLogging: true,
      enableMetrics: true,
      enableAlerts: true,
      maxRetryAttempts: 3,
      circuitBreakerThreshold: 5,
      rateLimitingEnabled: true,
      securityValidationEnabled: true,
      ...config,
    };
  }

  /**
   * Handle error with enterprise features
   */
  async handleEnterpriseError(
    error: Error | StructuredError,
    context: {
      userId?: string;
      sessionId?: string;
      requestId?: string;
      ipAddress?: string;
      userAgent?: string;
      operation?: string;
      resource?: string;
      [key: string]: any;
    } = {}
  ): Promise<StructuredError> {
    // First handle with static error handler
    const structuredError = await AdvancedErrorHandler.handleError(error, context);

    // Enhanced error processing
    await this.processEnterpriseError(structuredError, context);

    return structuredError;
  }

  /**
   * Process error with enterprise features
   */
  private async processEnterpriseError(error: StructuredError, context: any): Promise<void> {
    try {
      // Update metrics
      if (this.config.enableMetrics) {
        this.updateErrorMetrics(error);
      }

      // Security audit logging
      if (this.config.enableAuditLogging && this.auditLogger) {
        await this.logToSecurityAudit(error, context);
      }

      // Check for security implications
      if (this.config.securityValidationEnabled) {
        await this.validateSecurityImplications(error, context);
      }

      // Alert handling
      if (this.config.enableAlerts) {
        await this.processAlerts(error, context);
      }
    } catch (processingError) {
      // If enterprise processing fails, log but don't throw
      console.error('Enterprise error processing failed:', processingError);
    }
  }

  /**
   * Create enterprise error with enhanced context
   */
  static createEnterpriseError(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context: {
      userId?: string;
      sessionId?: string;
      requestId?: string;
      ipAddress?: string;
      operation?: string;
      resource?: string;
      securityImplications?: string[];
      businessImpact?: string;
      complianceIssues?: string[];
      [key: string]: any;
    } = {}
  ): StructuredError {
    return ErrorFactory.createError(message, category, severity, {
      context,
      userMessage: this.generateEnterpriseUserMessage(category, severity),
      suggestedActions: this.generateEnterpriseSuggestedActions(category, severity),
      retryable: this.isEnterpriseRetryable(category, severity),
      recoverable: this.isEnterpriseRecoverable(category, severity),
      metadata: {
        estimatedResolutionTime: this.estimateResolutionTime(category, severity),
        impactLevel: this.determineImpactLevel(severity),
        affectedComponents: this.identifyAffectedComponents(category, context),
        mitigations: this.generateMitigations(category, severity),
        httpStatusCode: this.getHttpStatusCode(category, severity),
      },
    });
  }

  /**
   * Validate input with enterprise security
   */
  static async validateEnterpriseInput(
    input: any,
    fieldName: string,
    options: {
      required?: boolean;
      maxLength?: number;
      allowedPatterns?: RegExp[];
      securityLevel?: 'basic' | 'standard' | 'strict' | 'paranoid';
      sanitize?: boolean;
    } = {}
  ): Promise<ServiceResponse<any>> {
    try {
      // Use advanced input validator for security validation
      const validation = AdvancedInputValidator.validateInput(input, fieldName, {
        level: (options.securityLevel as any) || 'standard',
        maxLength: options.maxLength || 10000,
        allowHtml: false,
        allowScripts: false,
        allowFileOperations: false,
        allowSystemCommands: false,
        customPatterns: options.allowedPatterns || [],
      });

      if (!validation.success) {
        const error = this.createEnterpriseError(
          `Input validation failed for ${fieldName}`,
          ErrorCategory.VALIDATION,
          ErrorSeverity.HIGH,
          {
            field: fieldName,
            securityImplications: ['potential_injection_attack', 'malicious_input'],
            complianceIssues: ['data_validation_required'],
          }
        );

        return BaseErrorHandler.createErrorResponse(error);
      }

      const sanitizedValue =
        options.sanitize && validation.data.sanitizedValue ? validation.data.sanitizedValue : input;

      return BaseErrorHandler.createSuccessResponse(sanitizedValue);
    } catch (error) {
      const enterpriseError = this.createEnterpriseError(
        'Input validation system error',
        ErrorCategory.SYSTEM,
        ErrorSeverity.CRITICAL,
        {
          field: fieldName,
          originalError: error as Error,
        }
      );

      return BaseErrorHandler.createErrorResponse(enterpriseError);
    }
  }

  /**
   * Circuit breaker pattern for external services
   */
  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    serviceName: string,
    context: any = {}
  ): Promise<ServiceResponse<T>> {
    const circuitBreakerKey = `circuit_breaker_${serviceName}`;
    const failures = this.errorMetrics.get(circuitBreakerKey)?.count || 0;

    // Check if circuit breaker is open
    if (failures >= this.config.circuitBreakerThreshold) {
      const error = EnterpriseErrorHandler.createEnterpriseError(
        `Service ${serviceName} circuit breaker is open`,
        ErrorCategory.EXTERNAL_API,
        ErrorSeverity.HIGH,
        {
          serviceName,
          failureCount: failures,
          threshold: this.config.circuitBreakerThreshold,
          businessImpact: 'Service degradation',
          mitigations: ['Use fallback service', 'Implement graceful degradation'],
        }
      );

      return BaseErrorHandler.createErrorResponse(error);
    }

    try {
      const result = await operation();

      // Reset circuit breaker on success
      this.errorMetrics.delete(circuitBreakerKey);

      return BaseErrorHandler.createSuccessResponse(result);
    } catch (error) {
      // Record failure
      const currentMetric = this.errorMetrics.get(circuitBreakerKey);
      this.errorMetrics.set(circuitBreakerKey, {
        count: (currentMetric?.count || 0) + 1,
        lastOccurrence: new Date(),
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.EXTERNAL_API,
      });

      const enterpriseError = await this.handleEnterpriseError(error as Error, {
        ...context,
        serviceName,
        circuitBreakerState: 'incrementing_failures',
      });

      return BaseErrorHandler.createErrorResponse(enterpriseError);
    }
  }

  /**
   * Update error metrics
   */
  private updateErrorMetrics(error: StructuredError): void {
    const key = `${error.category}_${error.severity}`;
    const current = this.errorMetrics.get(key);

    this.errorMetrics.set(key, {
      count: (current?.count || 0) + 1,
      lastOccurrence: new Date(),
      severity: error.severity,
      category: error.category,
    });
  }

  /**
   * Log to security audit system
   */
  private async logToSecurityAudit(error: StructuredError, context: any): Promise<void> {
    if (!this.auditLogger) return;

    const auditSeverity = this.mapToAuditSeverity(error.severity);
    const auditType = this.mapToAuditEventType(error.category);

    this.auditLogger.logAuditEvent({
      eventType: auditType,
      severity: auditSeverity,
      outcome: AuditOutcome.ERROR,
      userId: context.userId,
      sessionId: context.sessionId,
      resource: context.resource || 'system',
      action: 'error_occurred',
      errorMessage: `Error: ${error.message}`,
      details: {
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        errorId: error.id,
        errorCategory: error.category,
        errorSeverity: error.severity,
        operation: context.operation,
        stackTrace: error.stackTrace?.substring(0, 1000),
        userMessage: error.userMessage,
        retryable: error.retryable,
        recoverable: error.recoverable,
      },
    });
  }

  /**
   * Validate security implications
   */
  private async validateSecurityImplications(error: StructuredError, context: any): Promise<void> {
    const securityCategories = [
      ErrorCategory.AUTHENTICATION,
      ErrorCategory.AUTHORIZATION,
      ErrorCategory.VALIDATION,
    ];

    if (securityCategories.includes(error.category) && this.auditLogger) {
      this.auditLogger.logSecurityViolation(
        context.userId || 'unknown',
        `Security-related error: ${error.message}`,
        {
          sessionId: context.sessionId,
          ipAddress: context.ipAddress,
          errorId: error.id,
          errorCategory: error.category,
          operation: context.operation,
          potentialThreat: this.assessSecurityThreat(error, context),
        }
      );
    }
  }

  /**
   * Process alerts for critical errors
   */
  private async processAlerts(error: StructuredError, context: any): Promise<void> {
    if (error.severity === ErrorSeverity.CRITICAL) {
      // Critical alerts would trigger immediate notifications
      console.error('🚨 CRITICAL ERROR ALERT:', {
        errorId: error.id,
        message: error.message,
        category: error.category,
        context: context,
        timestamp: new Date().toISOString(),
      });

      // In a real system, this would integrate with:
      // - PagerDuty/OpsGenie for on-call alerts
      // - Slack/Teams for team notifications
      // - Email for stakeholder alerts
      // - SMS for critical system failures
    }
  }

  /**
   * Helper methods for enterprise error handling
   */
  private static generateEnterpriseUserMessage(
    category: ErrorCategory,
    severity: ErrorSeverity
  ): string {
    const enterpriseMessages: Record<ErrorCategory, Record<ErrorSeverity, string>> = {
      [ErrorCategory.VALIDATION]: {
        [ErrorSeverity.LOW]: 'Please review your input',
        [ErrorSeverity.MEDIUM]: 'Input validation failed - please check your data',
        [ErrorSeverity.HIGH]: 'Security validation failed - input rejected',
        [ErrorSeverity.CRITICAL]: 'Critical input security violation detected',
      },
      [ErrorCategory.AUTHENTICATION]: {
        [ErrorSeverity.LOW]: 'Authentication issue detected',
        [ErrorSeverity.MEDIUM]: 'Authentication failed - please verify credentials',
        [ErrorSeverity.HIGH]: 'Authentication security issue - access denied',
        [ErrorSeverity.CRITICAL]: 'Critical authentication security breach detected',
      },
      [ErrorCategory.AUTHORIZATION]: {
        [ErrorSeverity.LOW]: 'Permission check required',
        [ErrorSeverity.MEDIUM]: 'Access denied - insufficient permissions',
        [ErrorSeverity.HIGH]: 'Unauthorized access attempt blocked',
        [ErrorSeverity.CRITICAL]: 'Critical authorization violation detected',
      },
      [ErrorCategory.SYSTEM]: {
        [ErrorSeverity.LOW]: 'Minor system issue',
        [ErrorSeverity.MEDIUM]: 'System error occurred',
        [ErrorSeverity.HIGH]: 'Serious system malfunction',
        [ErrorSeverity.CRITICAL]: 'Critical system failure - immediate attention required',
      },
      [ErrorCategory.NETWORK]: {
        [ErrorSeverity.LOW]: 'Network connectivity issue',
        [ErrorSeverity.MEDIUM]: 'Network service unavailable',
        [ErrorSeverity.HIGH]: 'Critical network failure',
        [ErrorSeverity.CRITICAL]: 'Complete network outage detected',
      },
    } as any;

    return enterpriseMessages[category]?.[severity] || 'An error occurred in the system';
  }

  private static generateEnterpriseSuggestedActions(
    category: ErrorCategory,
    severity: ErrorSeverity
  ): string[] {
    // Use the static method from ErrorHandler to get base actions
    const baseActions: string[] = [];

    if (severity === ErrorSeverity.CRITICAL) {
      return [
        'Contact system administrator immediately',
        'Escalate to on-call engineer',
        'Check system status dashboard',
        'Review security incident procedures',
        ...baseActions,
      ];
    }

    if (severity === ErrorSeverity.HIGH) {
      return ['Contact support team', 'Check service status', 'Review error logs', ...baseActions];
    }

    return baseActions;
  }

  private static isEnterpriseRetryable(category: ErrorCategory, severity: ErrorSeverity): boolean {
    // Critical errors are generally not retryable
    if (severity === ErrorSeverity.CRITICAL) return false;

    // Security-related errors are not retryable
    const securityCategories = [
      ErrorCategory.AUTHENTICATION,
      ErrorCategory.AUTHORIZATION,
      ErrorCategory.VALIDATION,
    ];

    if (securityCategories.includes(category)) return false;

    return [
      ErrorCategory.NETWORK,
      ErrorCategory.EXTERNAL_API,
      ErrorCategory.TIMEOUT,
      ErrorCategory.RATE_LIMIT,
    ].includes(category);
  }

  private static isEnterpriseRecoverable(
    category: ErrorCategory,
    severity: ErrorSeverity
  ): boolean {
    // Critical system errors are not recoverable
    if (severity === ErrorSeverity.CRITICAL && category === ErrorCategory.SYSTEM) {
      return false;
    }

    return severity !== ErrorSeverity.CRITICAL;
  }

  private static estimateResolutionTime(category: ErrorCategory, severity: ErrorSeverity): string {
    if (severity === ErrorSeverity.CRITICAL) return '1-4 hours';
    if (severity === ErrorSeverity.HIGH) return '4-24 hours';
    if (severity === ErrorSeverity.MEDIUM) return '1-3 days';
    return '3-7 days';
  }

  private static determineImpactLevel(
    severity: ErrorSeverity
  ): 'low' | 'medium' | 'high' | 'critical' {
    return severity as any;
  }

  private static identifyAffectedComponents(category: ErrorCategory, context: any): string[] {
    const components: string[] = [];

    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        components.push('auth-service', 'user-management');
        break;
      case ErrorCategory.AUTHORIZATION:
        components.push('rbac-system', 'permission-engine');
        break;
      case ErrorCategory.NETWORK:
        components.push('api-gateway', 'load-balancer');
        break;
      case ErrorCategory.DATABASE:
        components.push('database', 'data-layer');
        break;
      case ErrorCategory.EXTERNAL_API:
        components.push('external-apis', 'third-party-services');
        break;
    }

    if (context.operation) {
      components.push(`operation:${context.operation}`);
    }

    return components;
  }

  private static generateMitigations(category: ErrorCategory, severity: ErrorSeverity): string[] {
    const mitigations: string[] = [];

    if (severity === ErrorSeverity.CRITICAL) {
      mitigations.push('Activate incident response plan');
      mitigations.push('Enable fallback systems');
      mitigations.push('Notify stakeholders');
    }

    switch (category) {
      case ErrorCategory.NETWORK:
        mitigations.push('Switch to backup connectivity');
        mitigations.push('Enable offline mode if available');
        break;
      case ErrorCategory.EXTERNAL_API:
        mitigations.push('Use cached data if available');
        mitigations.push('Switch to backup service provider');
        break;
      case ErrorCategory.DATABASE:
        mitigations.push('Failover to replica database');
        mitigations.push('Enable read-only mode');
        break;
    }

    return mitigations;
  }

  private static getHttpStatusCode(category: ErrorCategory, severity: ErrorSeverity): number {
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        return 401;
      case ErrorCategory.AUTHORIZATION:
        return 403;
      case ErrorCategory.VALIDATION:
        return 400;
      case ErrorCategory.NOT_FOUND:
        return 404;
      case ErrorCategory.CONFLICT:
        return 409;
      case ErrorCategory.RATE_LIMIT:
        return 429;
      case ErrorCategory.TIMEOUT:
        return 408;
      case ErrorCategory.NETWORK:
      case ErrorCategory.EXTERNAL_API:
        return 503;
      case ErrorCategory.SYSTEM:
        return severity === ErrorSeverity.CRITICAL ? 503 : 500;
      default:
        return 500;
    }
  }

  private mapToAuditSeverity(severity: ErrorSeverity): AuditSeverity {
    switch (severity) {
      case ErrorSeverity.LOW:
        return AuditSeverity.LOW;
      case ErrorSeverity.MEDIUM:
        return AuditSeverity.MEDIUM;
      case ErrorSeverity.HIGH:
        return AuditSeverity.HIGH;
      case ErrorSeverity.CRITICAL:
        return AuditSeverity.CRITICAL;
      default:
        return AuditSeverity.MEDIUM;
    }
  }

  private mapToAuditEventType(category: ErrorCategory): AuditEventType {
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        return AuditEventType.AUTHENTICATION;
      case ErrorCategory.AUTHORIZATION:
        return AuditEventType.AUTHORIZATION;
      case ErrorCategory.SECURITY:
        return AuditEventType.SECURITY_VIOLATION;
      case ErrorCategory.SYSTEM:
        return AuditEventType.SYSTEM_EVENT;
      default:
        return AuditEventType.ERROR_EVENT;
    }
  }

  private assessSecurityThreat(error: StructuredError, context: any): string {
    if (error.category === ErrorCategory.AUTHENTICATION) {
      return 'potential_credential_attack';
    }
    if (error.category === ErrorCategory.AUTHORIZATION) {
      return 'potential_privilege_escalation';
    }
    if (error.category === ErrorCategory.VALIDATION) {
      return 'potential_injection_attack';
    }
    return 'unknown_threat';
  }

  /**
   * Get enterprise error metrics
   */
  getEnterpriseMetrics(): {
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recentErrors: Array<{ key: string; count: number; lastOccurrence: Date }>;
    circuitBreakerStatus: Record<string, boolean>;
  } {
    const errorsByCategory: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    const circuitBreakerStatus: Record<string, boolean> = {};

    let totalErrors = 0;

    for (const [key, metric] of this.errorMetrics.entries()) {
      totalErrors += metric.count;

      const categoryKey = metric.category.toString();
      const severityKey = metric.severity.toString();

      errorsByCategory[categoryKey] = (errorsByCategory[categoryKey] || 0) + metric.count;
      errorsBySeverity[severityKey] = (errorsBySeverity[severityKey] || 0) + metric.count;

      // Check circuit breaker status
      if (key.startsWith('circuit_breaker_')) {
        const serviceName = key.replace('circuit_breaker_', '');
        circuitBreakerStatus[serviceName] = metric.count >= this.config.circuitBreakerThreshold;
      }
    }

    const recentErrors = Array.from(this.errorMetrics.entries())
      .map(([key, metric]) => ({ key, count: metric.count, lastOccurrence: metric.lastOccurrence }))
      .sort((a, b) => b.lastOccurrence.getTime() - a.lastOccurrence.getTime())
      .slice(0, 10);

    return {
      totalErrors,
      errorsByCategory,
      errorsBySeverity,
      recentErrors,
      circuitBreakerStatus,
    };
  }
}

// Export singleton instance
export const enterpriseErrorHandler = new EnterpriseErrorHandler();
