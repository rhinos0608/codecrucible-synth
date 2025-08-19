/**
 * Enhanced Base Tool with Comprehensive Error Handling
 * 
 * Extends the basic BaseTool with structured error handling,
 * input validation, logging, and security measures.
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { 
  ErrorHandler, 
  ErrorFactory, 
  InputValidator,
  ErrorCategory, 
  ErrorSeverity,
  ServiceResponse,
  ErrorResponse
} from '../error-handling/structured-error-system.js';
import { logger } from '../logger.js';

export interface EnhancedToolConfig {
  name: string;
  description: string;
  category: string;
  parameters: z.ZodTypeAny;
  requiresAuth?: boolean;
  rateLimitPerMinute?: number;
  timeoutMs?: number;
  securityLevel?: 'low' | 'medium' | 'high';
  retryable?: boolean;
  maxRetries?: number;
}

export interface ToolExecutionContext {
  requestId: string;
  userId?: string;
  workingDirectory: string;
  timestamp: number;
  environment: Record<string, any>;
}

export interface ToolExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: any;
  executionTime: number;
  requestId: string;
  metadata?: Record<string, any>;
}

/**
 * Enhanced base tool class with comprehensive error handling and security
 */
export abstract class EnhancedBaseTool extends BaseTool {
  protected config: EnhancedToolConfig;
  private executionCount = 0;
  private lastExecutionTimes: number[] = [];
  private readonly maxExecutionHistory = 10;

  constructor(config: EnhancedToolConfig) {
    super({
      name: config.name,
      description: config.description,
      category: config.category,
      parameters: config.parameters as z.ZodObject<any>
    });
    
    this.config = {
      requiresAuth: false,
      rateLimitPerMinute: 60,
      timeoutMs: 30000,
      securityLevel: 'medium',
      retryable: true,
      maxRetries: 3,
      ...config
    };
  }

  /**
   * Enhanced execute method with error handling and security
   */
  async execute(params: any, context?: Partial<ToolExecutionContext>): Promise<ToolExecutionResult> {
    const executionContext: ToolExecutionContext = {
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workingDirectory: process.cwd(),
      timestamp: Date.now(),
      environment: {},
      ...context
    };

    const startTime = Date.now();

    try {
      // Pre-execution checks
      await this.preExecutionChecks(params, executionContext);

      // Validate and sanitize input
      const validationResult = await this.validateAndSanitizeInput(params);
      if (!validationResult.success) {
        return this.createErrorResult((validationResult as ErrorResponse).error, executionContext, startTime);
      }

      // Execute with timeout and retry logic
      const result = await this.executeWithTimeoutAndRetry(
        validationResult.data,
        executionContext
      );

      // Post-execution processing
      const finalResult = await this.postExecutionProcessing(result, executionContext);

      this.recordExecution(Date.now() - startTime);
      
      return {
        success: true,
        data: finalResult,
        executionTime: Date.now() - startTime,
        requestId: executionContext.requestId,
        metadata: {
          tool: this.config.name,
          category: this.config.category,
          execution_count: this.executionCount
        }
      };

    } catch (error) {
      const structuredError = await ErrorHandler.handleError(error as Error, {
        tool: this.config.name,
        requestId: executionContext.requestId,
        params: this.sanitizeParamsForLogging(params)
      });

      return this.createErrorResult(structuredError, executionContext, startTime);
    }
  }

  /**
   * Abstract method that concrete tools must implement
   */
  protected abstract executeCore(params: any, context: ToolExecutionContext): Promise<any>;

  /**
   * Pre-execution security and validation checks
   */
  protected async preExecutionChecks(params: any, context: ToolExecutionContext): Promise<void> {
    // Rate limiting check
    if (this.isRateLimited()) {
      throw ErrorFactory.createError(
        'Rate limit exceeded',
        ErrorCategory.SYSTEM,
        ErrorSeverity.MEDIUM,
        {
          userMessage: 'Too many requests, please wait before trying again',
          suggestedActions: ['Wait a moment and try again'],
          retryable: true,
          metadata: { rate_limit: this.config.rateLimitPerMinute }
        }
      );
    }

    // Authentication check
    if (this.config.requiresAuth && !context.userId) {
      throw ErrorFactory.createError(
        'Authentication required',
        ErrorCategory.AUTHENTICATION,
        ErrorSeverity.HIGH,
        {
          userMessage: 'This operation requires authentication',
          suggestedActions: ['Please authenticate and try again'],
          recoverable: false
        }
      );
    }

    // Security level checks
    if (this.config.securityLevel === 'high') {
      await this.performHighSecurityChecks(params, context);
    }
  }

  /**
   * Validate and sanitize input parameters
   */
  protected async validateAndSanitizeInput(params: any): Promise<ServiceResponse<any>> {
    try {
      // Zod schema validation
      const validatedParams = this.config.parameters.parse(params);

      // Additional security sanitization
      const sanitizedParams = this.sanitizeInput(validatedParams);

      return ErrorHandler.createSuccessResponse(sanitizedParams);

    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        
        return ErrorHandler.createErrorResponse(
          ErrorFactory.createError(
            `Validation failed: ${errorMessage}`,
            ErrorCategory.VALIDATION,
            ErrorSeverity.MEDIUM,
            {
              context: { validation_errors: error.errors },
              userMessage: 'Invalid input provided',
              suggestedActions: ['Check parameter types and required fields', 'Review input format']
            }
          )
        );
      }

      return ErrorHandler.createErrorResponse(error as Error);
    }
  }

  /**
   * Execute with timeout and retry logic
   */
  protected async executeWithTimeoutAndRetry(
    params: any,
    context: ToolExecutionContext
  ): Promise<any> {
    if (this.config.retryable && this.config.maxRetries! > 1) {
      const result = await ErrorHandler.retryWithBackoff(
        () => this.executeWithTimeout(params, context),
        this.config.maxRetries!,
        1000,
        { tool: this.config.name, requestId: context.requestId }
      );

      if (!result.success) {
        throw (result as ErrorResponse).error;
      }

      return result.data;
    } else {
      return await this.executeWithTimeout(params, context);
    }
  }

  /**
   * Execute with timeout protection
   */
  protected async executeWithTimeout(params: any, context: ToolExecutionContext): Promise<any> {
    return Promise.race([
      this.executeCore(params, context),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(ErrorFactory.createError(
            `Tool execution timeout after ${this.config.timeoutMs}ms`,
            ErrorCategory.SYSTEM,
            ErrorSeverity.HIGH,
            {
              context: { timeout: this.config.timeoutMs, tool: this.config.name },
              userMessage: 'Operation timed out',
              suggestedActions: ['Try again with simpler input', 'Check system performance'],
              retryable: true
            }
          ));
        }, this.config.timeoutMs!);
      })
    ]);
  }

  /**
   * Post-execution processing and cleanup
   */
  protected async postExecutionProcessing(result: any, context: ToolExecutionContext): Promise<any> {
    // Log successful execution
    logger.info(`Tool executed successfully: ${this.config.name}`, {
      requestId: context.requestId,
      tool: this.config.name,
      executionTime: Date.now() - context.timestamp
    });

    // Override in subclasses for custom post-processing
    return result;
  }

  /**
   * Sanitize input for security
   */
  protected sanitizeInput(params: any): any {
    if (typeof params === 'string') {
      return InputValidator.sanitizeInput(params);
    }

    if (Array.isArray(params)) {
      return params.map(item => this.sanitizeInput(item));
    }

    if (params && typeof params === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(params)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return params;
  }

  /**
   * High security checks for sensitive operations
   */
  protected async performHighSecurityChecks(params: any, context: ToolExecutionContext): Promise<void> {
    // Check for suspicious patterns
    const paramString = JSON.stringify(params);
    const suspiciousPatterns = [
      /rm\s+-rf/,
      /del\s+\/[sf]/,
      /sudo\s+/,
      /eval\s*\(/,
      /exec\s*\(/,
      /system\s*\(/,
      /require\s*\(/,
      /import\s+os/,
      /__import__/
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(paramString)) {
        throw ErrorFactory.createError(
          'Potentially dangerous input detected',
          ErrorCategory.AUTHORIZATION,
          ErrorSeverity.CRITICAL,
          {
            context: { suspicious_pattern: pattern.source },
            userMessage: 'Input contains potentially dangerous commands',
            suggestedActions: ['Review input for security concerns', 'Use safer alternatives'],
            recoverable: false
          }
        );
      }
    }
  }

  /**
   * Check rate limiting
   */
  protected isRateLimited(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old executions
    this.lastExecutionTimes = this.lastExecutionTimes.filter(time => time > oneMinuteAgo);
    
    if (this.lastExecutionTimes.length >= this.config.rateLimitPerMinute!) {
      return true;
    }

    this.lastExecutionTimes.push(now);
    return false;
  }

  /**
   * Record execution for performance monitoring
   */
  protected recordExecution(executionTime: number): void {
    this.executionCount++;
    
    // Keep track of recent execution times for performance analysis
    if (this.lastExecutionTimes.length >= this.maxExecutionHistory) {
      this.lastExecutionTimes.shift();
    }
  }

  /**
   * Create error result
   */
  protected createErrorResult(
    error: any,
    context: ToolExecutionContext,
    startTime: number
  ): ToolExecutionResult {
    return {
      success: false,
      error,
      executionTime: Date.now() - startTime,
      requestId: context.requestId,
      metadata: {
        tool: this.config.name,
        category: this.config.category,
        error_category: error.category || 'unknown'
      }
    };
  }

  /**
   * Sanitize parameters for logging (remove sensitive data)
   */
  protected sanitizeParamsForLogging(params: any): any {
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'api_key', 'auth'];
    
    if (typeof params === 'object' && params !== null) {
      const sanitized = { ...params };
      for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          sanitized[key] = '[REDACTED]';
        }
      }
      return sanitized;
    }
    
    return params;
  }

  /**
   * Get tool performance statistics
   */
  getPerformanceStats(): {
    total_executions: number;
    average_execution_time: number;
    last_execution_times: number[];
    rate_limit: number;
    security_level: string;
  } {
    const avgTime = this.lastExecutionTimes.length > 0
      ? this.lastExecutionTimes.reduce((sum, time) => sum + time, 0) / this.lastExecutionTimes.length
      : 0;

    return {
      total_executions: this.executionCount,
      average_execution_time: avgTime,
      last_execution_times: [...this.lastExecutionTimes],
      rate_limit: this.config.rateLimitPerMinute!,
      security_level: this.config.securityLevel!
    };
  }
}

export default EnhancedBaseTool;