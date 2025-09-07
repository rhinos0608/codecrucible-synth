/**
 * Comprehensive Error Handling System
 *
 * Provides structured error handling, logging, recovery mechanisms,
 * and user-friendly error reporting across the entire application.
 */

import { logger } from '../logging/logger.js';
import chalk from 'chalk';
import { normalizePathSeparators } from '../../utils/path-utilities.js';

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Error categories
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NETWORK = 'network',
  FILE_SYSTEM = 'file_system',
  MODEL = 'model',
  TOOL_EXECUTION = 'tool_execution',
  CONFIGURATION = 'configuration',
  SYSTEM = 'system',
  USER_INPUT = 'user_input',
  EXTERNAL_API = 'external_api',
  MCP_SERVICE = 'mcp_service',
  DATABASE = 'database',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  SECURITY = 'security',
  INFRASTRUCTURE = 'infrastructure',
  APPLICATION = 'application',
}

// Structured error interface
export interface StructuredError {
  id: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: number;
  context?: Record<string, unknown>;
  stackTrace?: string;
  userMessage?: string;
  suggestedActions?: string[];
  recoverable: boolean;
  retryable: boolean;
  metadata?: Record<string, unknown>;
}

// Error response interface for APIs and tools
export interface ErrorResponse {
  success: false;
  error: StructuredError;
  request_id?: string;
  service?: string;
  recovery_suggestions?: string[];
}

// Success response interface
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  request_id?: string;
  service?: string;
  metadata?: Record<string, unknown>;
}

// Union type for all responses
export type ServiceResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

/**
 * Error factory for creating structured errors
 */
export class ErrorFactory {
  private static errorCounter = 0;

  public static createError(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    options: Readonly<{
      context?: Readonly<Record<string, unknown>>;
      userMessage?: string;
      suggestedActions?: ReadonlyArray<string>;
      recoverable?: boolean;
      retryable?: boolean;
      metadata?: Readonly<Record<string, unknown>>;
      originalError?: Error;
    }> = {}
  ): StructuredError {
    const id = `ERR_${Date.now()}_${++this.errorCounter}`;

    return {
      id,
      message,
      category,
      severity,
      timestamp: Date.now(),
      context: options.context,
      stackTrace: options.originalError?.stack,
      userMessage: options.userMessage ?? this.generateUserMessage(message, category),
      suggestedActions: options.suggestedActions ? Array.from(options.suggestedActions) : this.generateSuggestedActions(category),
      recoverable: options.recoverable ?? this.isRecoverable(category, severity),
      retryable: options.retryable ?? this.isRetryable(category),
      metadata: options.metadata,
    };
  }

  private static generateUserMessage(message: string, category: ErrorCategory): string {
    const categoryMessages: Record<ErrorCategory, string> = {
      [ErrorCategory.VALIDATION]: 'Invalid input provided',
      [ErrorCategory.AUTHENTICATION]: 'Authentication failed',
      [ErrorCategory.AUTHORIZATION]: 'Access denied',
      [ErrorCategory.NETWORK]: 'Network connection issue',
      [ErrorCategory.FILE_SYSTEM]: 'File operation failed',
      [ErrorCategory.MODEL]: 'AI model processing error',
      [ErrorCategory.TOOL_EXECUTION]: 'Tool execution failed',
      [ErrorCategory.CONFIGURATION]: 'Configuration error',
      [ErrorCategory.SYSTEM]: 'System error occurred',
      [ErrorCategory.USER_INPUT]: 'Invalid user input',
      [ErrorCategory.EXTERNAL_API]: 'External service unavailable',
      [ErrorCategory.MCP_SERVICE]: 'MCP service error',
      [ErrorCategory.DATABASE]: 'Database operation failed',
      [ErrorCategory.TIMEOUT]: 'Operation timed out',
      [ErrorCategory.RATE_LIMIT]: 'Rate limit exceeded',
      [ErrorCategory.NOT_FOUND]: 'Resource not found',
      [ErrorCategory.CONFLICT]: 'Resource conflict detected',
      [ErrorCategory.SECURITY]: 'Security violation detected',
      [ErrorCategory.INFRASTRUCTURE]: 'Infrastructure error',
      [ErrorCategory.APPLICATION]: 'Application error',
    };

    return categoryMessages[category] || 'An error occurred';
  }

  private static generateSuggestedActions(category: ErrorCategory): string[] {
    const categoryActions: Record<ErrorCategory, string[]> = {
      [ErrorCategory.VALIDATION]: [
        'Check input format and required fields',
        'Review parameter types and constraints',
      ],
      [ErrorCategory.AUTHENTICATION]: [
        'Verify API keys and credentials',
        'Check authentication configuration',
      ],
      [ErrorCategory.AUTHORIZATION]: ['Verify user permissions', 'Check access rights and roles'],
      [ErrorCategory.NETWORK]: [
        'Check internet connection',
        'Verify endpoint availability',
        'Try again in a moment',
      ],
      [ErrorCategory.FILE_SYSTEM]: [
        'Check file permissions',
        'Verify file path exists',
        'Ensure sufficient disk space',
      ],
      [ErrorCategory.MODEL]: [
        'Check if AI model is running',
        'Verify model configuration',
        'Try with a different model',
      ],
      [ErrorCategory.TOOL_EXECUTION]: [
        'Review tool parameters',
        'Check tool availability',
        'Try alternative tools',
      ],
      [ErrorCategory.CONFIGURATION]: [
        'Review configuration settings',
        'Check environment variables',
        'Reset to default configuration',
      ],
      [ErrorCategory.SYSTEM]: [
        'Restart the application',
        'Check system resources',
        'Contact support if issue persists',
      ],
      [ErrorCategory.USER_INPUT]: [
        'Review input format',
        'Check for special characters',
        'Try simplified input',
      ],
      [ErrorCategory.EXTERNAL_API]: [
        'Check service status',
        'Verify API credentials',
        'Try again later',
      ],
      [ErrorCategory.MCP_SERVICE]: [
        'Check MCP server status',
        'Verify service configuration',
        'Try fallback options',
      ],
      [ErrorCategory.DATABASE]: [
        'Check database connection',
        'Verify database credentials',
        'Try reconnecting to database',
      ],
      [ErrorCategory.TIMEOUT]: [
        'Increase timeout limit',
        'Check network connectivity',
        'Try again later',
      ],
      [ErrorCategory.RATE_LIMIT]: [
        'Wait before retrying',
        'Reduce request frequency',
        'Check rate limit settings',
      ],
      [ErrorCategory.NOT_FOUND]: [
        'Check resource path',
        'Verify resource exists',
        'Update resource references',
      ],
      [ErrorCategory.CONFLICT]: [
        'Resolve resource conflicts',
        'Check for duplicate entries',
        'Update resource state',
      ],
      [ErrorCategory.SECURITY]: [
        'Review security permissions',
        'Check authentication status',
        'Contact security administrator',
      ],
      [ErrorCategory.INFRASTRUCTURE]: [
        'Check system health',
        'Verify infrastructure status',
        'Contact system administrator',
      ],
      [ErrorCategory.APPLICATION]: [
        'Restart application',
        'Check application logs',
        'Update application configuration',
      ],
    };

    return categoryActions[category] || ['Try again', 'Contact support if issue persists'];
  }

  private static isRecoverable(category: ErrorCategory, severity: ErrorSeverity): boolean {
    if (severity === ErrorSeverity.CRITICAL) return false;

    const recoverableCategories = [
      ErrorCategory.NETWORK,
      ErrorCategory.EXTERNAL_API,
      ErrorCategory.MCP_SERVICE,
      ErrorCategory.TOOL_EXECUTION,
      ErrorCategory.MODEL,
    ];

    return recoverableCategories.includes(category);
  }

  private static isRetryable(category: ErrorCategory): boolean {
    const retryableCategories = [
      ErrorCategory.NETWORK,
      ErrorCategory.EXTERNAL_API,
      ErrorCategory.MCP_SERVICE,
      ErrorCategory.MODEL,
    ];

    return retryableCategories.includes(category);
  }
}

/**
 * Error handler with recovery mechanisms
 */
export class ErrorHandler {
  private static errorHistory: StructuredError[] = [];
  private static readonly maxHistorySize = 100;

  /**
   * Handle error with logging and potential recovery
   */
  public static async handleError(
    error: Readonly<Error | StructuredError>,
    context?: Readonly<Record<string, unknown>>
  ): Promise<StructuredError> {
    const structuredError = this.ensureStructuredError(error, context);

    // Add to history
    this.errorHistory.push(structuredError);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Log error
    this.logError(structuredError);

    // Attempt recovery if possible
    if (structuredError.recoverable) {
      await this.attemptRecovery(structuredError);
    }

    return structuredError;
  }

  /**
   * Create error response for APIs and tools
   */
  public static createErrorResponse(
    error: Readonly<Error | StructuredError>,
    requestId?: string,
    service?: string
  ): ErrorResponse {
    const structuredError = this.ensureStructuredError(error);

    return {
      success: false,
      error: structuredError,
      request_id: requestId,
      service,
      recovery_suggestions: structuredError.suggestedActions,
    };
  }

  /**
   * Create success response
   */
  public static createSuccessResponse<T>(
    data: T,
    requestId?: string,
    service?: string,
    metadata?: Readonly<Record<string, unknown>>
  ): SuccessResponse<T> {
    return {
      success: true,
      data,
      request_id: requestId,
      service,
      metadata,
    };
  }

  /**
   * Wrap function with error handling
   */
  public static wrapWithErrorHandling<T extends readonly unknown[], R>(
    fn: (...args: T) => Promise<R>,
    context?: Readonly<Record<string, unknown>>
  ): (...args: T) => Promise<ServiceResponse<R>> {
    return async (...args: T): Promise<ServiceResponse<R>> => {
      try {
        const result = await fn(...args);
        return this.createSuccessResponse(result);
      } catch (error) {
        const structuredError = await this.handleError(error as Error, context);
        return this.createErrorResponse(structuredError);
      }
    };
  }

  /**
   * Retry function with exponential backoff
   */
  public static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    context?: Readonly<Record<string, unknown>>
  ): Promise<ServiceResponse<T>> {
    let lastError: StructuredError | undefined = undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        return this.createSuccessResponse(result);
      } catch (error) {
        lastError = await this.handleError(error as Error, {
          ...context,
          attempt,
          maxRetries,
        });

        if (attempt < maxRetries && lastError.retryable) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          logger.info(`Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    if (lastError) {
      return this.createErrorResponse(lastError);
    } else {
      // Fallback error if lastError is somehow undefined
      return this.createErrorResponse(
        ErrorFactory.createError(
          'Unknown error during retryWithBackoff',
          ErrorCategory.SYSTEM,
          ErrorSeverity.MEDIUM
        )
      );
    }
  }

  /**
   * Get error statistics
   */
  public static getErrorStatistics(): {
    total: number;
    by_category: Record<ErrorCategory, number>;
    by_severity: Record<ErrorSeverity, number>;
    recent_errors: StructuredError[];
  } {
    const byCategoryCount: Record<ErrorCategory, number> = {} as Record<ErrorCategory, number>;
    const bySeverityCount: Record<ErrorSeverity, number> = {} as Record<ErrorSeverity, number>;

    // Initialize counts
    (Object.values(ErrorCategory) as ErrorCategory[]).forEach(cat => (byCategoryCount[cat] = 0));
    (Object.values(ErrorSeverity) as ErrorSeverity[]).forEach(sev => (bySeverityCount[sev] = 0));

    // Count errors
    this.errorHistory.forEach((error: Readonly<StructuredError>) => {
      byCategoryCount[error.category]++;
      bySeverityCount[error.severity]++;
    });

    return {
      total: this.errorHistory.length,
      by_category: byCategoryCount,
      by_severity: bySeverityCount,
      recent_errors: this.errorHistory.slice(-10),
    };
  }

  /**
   * Clear error history
   */
  public static clearErrorHistory(): void {
    this.errorHistory = [];
  }

  private static ensureStructuredError(
    error: Readonly<Error | StructuredError>,
    context?: Readonly<Record<string, unknown>>
  ): StructuredError {
    if ('id' in error && 'category' in error) {
      return error;
    }

    return ErrorFactory.createError(
      error.message || 'Unknown error',
      ErrorCategory.SYSTEM,
      ErrorSeverity.MEDIUM,
      {
        context,
        originalError: error,
        metadata: {
          error_name: error.name,
          error_type: typeof error,
        },
      }
    );
  }

  private static logError(error: StructuredError): void {
    const colorMap = {
      [ErrorSeverity.LOW]: chalk.yellow,
      [ErrorSeverity.MEDIUM]: chalk.yellowBright,
      [ErrorSeverity.HIGH]: chalk.red,
      [ErrorSeverity.CRITICAL]: chalk.redBright,
    };

    const color = colorMap[error.severity] || chalk.red;

    logger.error(
      `${color(`[${error.severity.toUpperCase()}]`)} ${error.category}: ${error.message}`,
      // Cast metadata to unknown and then to Error to satisfy logger.error's expected parameter type
      { meta: {
          errorId: error.id,
          category: error.category,
          severity: error.severity,
          context: error.context,
          stackTrace: error.stackTrace,
          timestamp: error.timestamp,
        } } as unknown as Error
    );

    // Also log to console for immediate visibility
    console.error(color(`❌ ${error.userMessage || error.message}`));

    if (error.suggestedActions && error.suggestedActions.length > 0) {
      console.error(chalk.cyan('💡 Suggested actions:'));
      error.suggestedActions.forEach(action => {
        console.error(chalk.cyan(`   • ${action}`));
      });
    }
  }

  private static async attemptRecovery(error: StructuredError): Promise<void> {
    logger.info(`Attempting recovery for error: ${error.id}`);

    try {
      switch (error.category) {
        case ErrorCategory.NETWORK:
          // Wait and retry network connections
          await new Promise(resolve => setTimeout(resolve, 2000));
          break;

        case ErrorCategory.MODEL:
          // Try to reinitialize model connection
          logger.info('Attempting model recovery...');
          break;

        case ErrorCategory.MCP_SERVICE:
          // Try to reconnect to MCP services
          logger.info('Attempting MCP service recovery...');
          break;

        default:
          logger.debug(`No recovery mechanism for category: ${error.category}`);
      }
    } catch (recoveryError) {
      logger.warn('Recovery attempt failed:', { error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError) });
    }
  }
}

/**
 * Input validation with structured error responses
 */
export class InputValidator {
  /**
   * Validate required string field
   */
  public static validateString(
    value: unknown,
    fieldName: string,
    options: Readonly<{
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      allowEmpty?: boolean;
    }> = {}
  ): ServiceResponse<string> {
    if (value === undefined || value === null) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `${fieldName} is required`,
          ErrorCategory.VALIDATION,
          ErrorSeverity.MEDIUM,
          {
            userMessage: `Please provide ${fieldName}`,
            suggestedActions: [`Provide a valid ${fieldName} value`],
          }
        )
      );
    }

    const stringValue = String(value);

    if (!options.allowEmpty && stringValue.trim().length === 0) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `${fieldName} cannot be empty`,
          ErrorCategory.VALIDATION,
          ErrorSeverity.MEDIUM
        )
      );
    }

    if (options.minLength && stringValue.length < options.minLength) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `${fieldName} must be at least ${options.minLength} characters`,
          ErrorCategory.VALIDATION,
          ErrorSeverity.MEDIUM
        )
      );
    }

    if (options.maxLength && stringValue.length > options.maxLength) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `${fieldName} must not exceed ${options.maxLength} characters`,
          ErrorCategory.VALIDATION,
          ErrorSeverity.MEDIUM
        )
      );
    }

    if (options.pattern && !options.pattern.test(stringValue)) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `${fieldName} format is invalid`,
          ErrorCategory.VALIDATION,
          ErrorSeverity.MEDIUM
        )
      );
    }

    return ErrorHandler.createSuccessResponse(stringValue);
  }

  /**
   * Validate and sanitize file path
   */
  public static validateFilePath(path: unknown): ServiceResponse<string> {
    const stringResult = this.validateString(path, 'file path');
    if (!stringResult.success) return stringResult;

    const filePath = stringResult.data;

    // Check for directory traversal attempts
    if (filePath.includes('..') || filePath.includes('~')) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          'Invalid file path: directory traversal not allowed',
          ErrorCategory.VALIDATION,
          ErrorSeverity.HIGH,
          {
            context: { attempted_path: filePath },
            userMessage: 'File path contains invalid characters',
            suggestedActions: ['Use relative paths within the project directory'],
          }
        )
      );
    }

    return ErrorHandler.createSuccessResponse(filePath);
  }

  /**
   * Sanitize user input to prevent injection attacks
   */
  public static sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // SQL Injection protection - remove/escape SQL keywords and operators
    const sqlKeywords = [
      'drop',
      'delete',
      'insert',
      'update',
      'union',
      'select',
      'create',
      'alter',
      'truncate',
      'exec',
      'execute',
      'sp_',
      'xp_',
      'cmd',
      'shell',
      'script',
    ];

    sqlKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      sanitized = sanitized.replace(regex, '');
    });

    // Remove SQL operators and comment markers
    sanitized = sanitized
      .replace(/--/g, '') // SQL comments
      .replace(/\/\*/g, '') // SQL block comment start
      .replace(/\*\//g, '') // SQL block comment end
      .replace(/;/g, '') // SQL statement terminator
      .replace(/'/g, '') // Single quotes
      .replace(/"/g, '') // Double quotes
      .replace(/`/g, '') // Backticks
      .replace(/\|/g, '') // Pipe operators
      .replace(/&/g, 'and'); // Ampersand

    // XSS protection - remove script tags and event handlers
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>.*?<\/embed>/gi,
      /<svg[^>]*>.*?<\/svg>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /data:/gi,
      /on\w+\s*=/gi, // Event handlers like onclick, onerror, etc.
      /<[^>]*on\w+[^>]*>/gi, // Any tag with event handlers
    ];

    xssPatterns.forEach((pattern: Readonly<RegExp>) => {
      sanitized = sanitized.replace(pattern, '');
    });

    // Remove HTML tags completely
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Directory traversal protection - Use centralized path utilities for cross-platform consistency
    sanitized = normalizePathSeparators(sanitized)
      .replace(/\.\./g, '') // Remove .. sequences
      .replace(/~/g, '') // Remove home directory references
      .replace(/\/\//g, '/'); // Remove double slashes

    // Encoding-based attack protection
    sanitized = sanitized
      .replace(/%2e/gi, '') // Encoded dots
      .replace(/%2f/gi, '') // Encoded slashes
      .replace(/%5c/gi, '') // Encoded backslashes
      .replace(/\\u[0-9a-f]{4}/gi, '') // Unicode escape sequences
      .replace(/\\x[0-9a-f]{2}/gi, ''); // Hex escape sequences

    // Normalize and limit whitespace
    sanitized = sanitized
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 10000); // Limit length to prevent buffer overflow

    return sanitized;
  }
}

// Export default
export default ErrorHandler;
