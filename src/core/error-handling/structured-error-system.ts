// Structured Error System
// Core layer structured error handling

export interface ErrorContext {
  operation: string;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  component: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorDetails {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'user' | 'system' | 'network' | 'security' | 'validation' | 'authorization' | 'tool_execution' | 'configuration' | 'external_api';
  recoverable: boolean;
  suggestions?: string[];
}

export interface StructuredError extends Error {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'user' | 'system' | 'network' | 'security' | 'validation' | 'authorization' | 'tool_execution' | 'configuration' | 'external_api';
  context: ErrorContext;
  details: ErrorDetails;
  recoverable: boolean;
  timestamp: number;
}

export interface ErrorReport {
  error: StructuredError;
  stackTrace: string;
  context: ErrorContext;
  suggestions: string[];
  relatedErrors?: StructuredError[];
}

export interface StructuredErrorSystemInterface {
  createError(details: ErrorDetails, context: ErrorContext, originalError?: Error): StructuredError;
  handleError(error: Error | StructuredError, context?: ErrorContext): Promise<ErrorReport>;
  reportError(error: StructuredError): Promise<void>;
  getErrorHistory(limit?: number): ErrorReport[];
  isRecoverable(error: Error): boolean;
}

export class StructuredErrorSystem implements StructuredErrorSystemInterface {
  private errorHistory: ErrorReport[] = [];
  private maxHistorySize = 1000;
  private errorCounts = new Map<string, number>();

  createError(details: ErrorDetails, context: ErrorContext, originalError?: Error): StructuredError {
    const structuredError = Object.assign(new Error(details.message), {
      code: details.code,
      severity: details.severity,
      category: details.category,
      context,
      details,
      recoverable: details.recoverable,
      timestamp: Date.now(),
      name: 'StructuredError'
    }) as StructuredError;

    if (originalError) {
      structuredError.stack = originalError.stack;
      structuredError.cause = originalError;
    }

    return structuredError;
  }

  async handleError(error: Error | StructuredError, context?: ErrorContext): Promise<ErrorReport> {
    let structuredError: StructuredError;

    if (this.isStructuredError(error)) {
      structuredError = error;
    } else {
      // Convert regular error to structured error
      structuredError = this.createError(
        {
          code: 'UNHANDLED_ERROR',
          message: error.message,
          severity: 'medium',
          category: 'system',
          recoverable: false
        },
        context || {
          operation: 'unknown',
          timestamp: Date.now(),
          component: 'error-handler'
        },
        error
      );
    }

    const report: ErrorReport = {
      error: structuredError,
      stackTrace: structuredError.stack || 'No stack trace available',
      context: structuredError.context,
      suggestions: this.generateSuggestions(structuredError),
      relatedErrors: this.findRelatedErrors(structuredError)
    };

    // Add to history
    this.addToHistory(report);

    // Track error frequency
    this.trackErrorFrequency(structuredError.code);

    // Report error (could be to logging service, monitoring, etc.)
    await this.reportError(structuredError);

    return report;
  }

  async reportError(error: StructuredError): Promise<void> {
    // In a real implementation, this would send to logging service, 
    // monitoring service, etc.
    console.error('Structured Error Report:', {
      code: error.code,
      severity: error.severity,
      category: error.category,
      message: error.message,
      context: error.context,
      timestamp: new Date(error.timestamp).toISOString()
    });

    // Could also send to external monitoring services
    if (error.severity === 'critical') {
      // Alert mechanism for critical errors
      this.alertCriticalError(error);
    }
  }

  getErrorHistory(limit: number = 100): ErrorReport[] {
    return this.errorHistory.slice(-limit);
  }

  isRecoverable(error: Error): boolean {
    if (this.isStructuredError(error)) {
      return error.recoverable;
    }

    // Heuristics for regular errors
    if (error instanceof TypeError || error instanceof ReferenceError) {
      return false; // Programming errors are typically not recoverable
    }

    if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
      return true; // Network errors are often recoverable
    }

    return false; // Default to not recoverable
  }

  // Utility methods
  getErrorStatistics(): {
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    mostFrequentErrors: Array<{ code: string; count: number }>;
  } {
    const errorsByCategory: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};

    for (const report of this.errorHistory) {
      const category = report.error.category;
      const severity = report.error.severity;

      errorsByCategory[category] = (errorsByCategory[category] || 0) + 1;
      errorsBySeverity[severity] = (errorsBySeverity[severity] || 0) + 1;
    }

    const mostFrequentErrors = Array.from(this.errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({ code, count }));

    return {
      totalErrors: this.errorHistory.length,
      errorsByCategory,
      errorsBySeverity,
      mostFrequentErrors
    };
  }

  clearHistory(): void {
    this.errorHistory = [];
    this.errorCounts.clear();
  }

  // Helper methods for creating service responses
  createErrorResponse(error: StructuredError): ServiceResponse<any> {
    return {
      success: false,
      error: error,
      timestamp: Date.now()
    };
  }

  createSuccessResponse<T>(data: T): ServiceResponse<T> {
    return {
      success: true,
      data: data,
      timestamp: Date.now()
    };
  }

  // Private methods
  private isStructuredError(error: Error): error is StructuredError {
    return 'code' in error && 'severity' in error && 'category' in error && 'context' in error;
  }

  private generateSuggestions(error: StructuredError): string[] {
    const suggestions: string[] = [];

    switch (error.category) {
      case 'network':
        suggestions.push('Check network connectivity', 'Retry the operation', 'Verify server endpoints');
        break;
      case 'validation':
        suggestions.push('Check input format', 'Verify required fields', 'Review validation rules');
        break;
      case 'security':
        suggestions.push('Check permissions', 'Verify authentication', 'Review security policies');
        break;
      case 'user':
        suggestions.push('Check user input', 'Verify user permissions', 'Review user workflow');
        break;
      case 'system':
        suggestions.push('Check system resources', 'Review configuration', 'Check logs for more details');
        break;
      case 'authorization':
        suggestions.push('Check permissions', 'Verify authentication', 'Review access policies');
        break;
      case 'tool_execution':
        suggestions.push('Check tool configuration', 'Verify tool availability', 'Review execution environment');
        break;
      case 'configuration':
        suggestions.push('Check configuration files', 'Verify environment variables', 'Review settings');
        break;
      case 'external_api':
        suggestions.push('Check API connectivity', 'Verify API keys', 'Check rate limits', 'Retry request');
        break;
    }

    if (error.details.suggestions) {
      suggestions.push(...error.details.suggestions);
    }

    return suggestions;
  }

  private findRelatedErrors(error: StructuredError): StructuredError[] {
    const relatedErrors: StructuredError[] = [];
    const recentErrors = this.errorHistory.slice(-10);

    for (const report of recentErrors) {
      if (report.error.code === error.code && report.error !== error) {
        relatedErrors.push(report.error);
      }
    }

    return relatedErrors;
  }

  private addToHistory(report: ErrorReport): void {
    this.errorHistory.push(report);

    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }

  private trackErrorFrequency(errorCode: string): void {
    const currentCount = this.errorCounts.get(errorCode) || 0;
    this.errorCounts.set(errorCode, currentCount + 1);
  }

  private alertCriticalError(error: StructuredError): void {
    // In a real implementation, this would trigger alerts
    console.warn('🚨 CRITICAL ERROR DETECTED:', error.code, error.message);
  }
}

export const structuredErrorSystem = new StructuredErrorSystem();

// Export type aliases for backward compatibility
export type ErrorFactory = StructuredErrorSystem;
export type ErrorCategory = 'user' | 'system' | 'network' | 'security' | 'validation' | 'authorization' | 'tool_execution' | 'configuration' | 'external_api';
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Error category constants (for use as values)
export const ErrorCategory = {
  USER: 'user' as const,
  SYSTEM: 'system' as const,
  NETWORK: 'network' as const,
  SECURITY: 'security' as const,
  VALIDATION: 'validation' as const,
  AUTHORIZATION: 'authorization' as const,
  TOOL_EXECUTION: 'tool_execution' as const,
  CONFIGURATION: 'configuration' as const,
  EXTERNAL_API: 'external_api' as const
} as const;

// Error severity constants (for use as values)
export const ErrorSeverity = {
  LOW: 'low' as const,
  MEDIUM: 'medium' as const,
  HIGH: 'high' as const,
  CRITICAL: 'critical' as const
} as const;
export type ServiceResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: StructuredError;
  timestamp: number;
};
export type ErrorHandler = StructuredErrorSystem;

// Export the error system instance as ErrorFactory for compatibility
export const ErrorFactory = structuredErrorSystem;
export const ErrorHandler = structuredErrorSystem;

// Additional type exports
export type ErrorResponse = ErrorReport;