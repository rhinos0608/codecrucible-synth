/**
 * SecurityValidator - Extracted from UnifiedModelClient
 * Centralizes all security validation logic following Living Spiral methodology
 *
 * Council Perspectives Applied:
 * - Security Guardian: Primary focus on threat detection and prevention
 * - Maintainer: Clean abstraction for security operations
 * - Architect: Clear separation between security validation and client logic
 * - Explorer: Extensible security rules and validation strategies
 * - Performance Engineer: Efficient validation with minimal overhead
 */

import { SecurityUtils } from '../security.js';
import { SecurityValidation } from '../types.js';
import { logger } from '../logger.js';

export interface SecurityValidationOptions {
  enableSandbox?: boolean;
  maxInputLength?: number;
  strictMode?: boolean;
  logViolations?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  riskLevel?: string;
  sanitizedInput?: string;
  violationType?: string;
}

export interface ISecurityValidator {
  // Core validation
  validateInput(input: string, options?: SecurityValidationOptions): Promise<ValidationResult>;
  validateRequest(request: any, options?: SecurityValidationOptions): Promise<ValidationResult>;
  
  // Security analysis
  analyzeRisk(input: string): Promise<{ level: string; threats: string[] }>;
  detectSuspiciousPatterns(input: string): string[];
  
  // Configuration
  updateSecurityConfig(config: SecurityValidationOptions): void;
  getSecurityStatus(): { enabled: boolean; rulesCount: number; lastUpdate: number };
}

/**
 * SecurityValidator Implementation
 * Centralizes all security validation with comprehensive threat detection
 */
export class SecurityValidator implements ISecurityValidator {
  private securityUtils: SecurityUtils;
  private validationOptions: SecurityValidationOptions;
  private validationStats = {
    totalValidations: 0,
    violations: 0,
    blocked: 0,
    sanitized: 0,
  };

  constructor(options: SecurityValidationOptions = {}) {
    this.validationOptions = {
      enableSandbox: true,
      maxInputLength: 50000,
      strictMode: false,
      logViolations: true,
      ...options,
    };

    this.securityUtils = new SecurityUtils({
      enableSandbox: this.validationOptions.enableSandbox,
      maxInputLength: this.validationOptions.maxInputLength,
    });
  }

  /**
   * Core input validation with comprehensive security checks
   */
  async validateInput(input: string, options?: SecurityValidationOptions): Promise<ValidationResult> {
    const config = { ...this.validationOptions, ...options };
    this.validationStats.totalValidations++;

    try {
      // Use SecurityUtils for core validation
      const validation = await this.securityUtils.validateInput(input);
      
      // Convert SecurityValidation to ValidationResult format
      const result: ValidationResult = {
        isValid: validation.isValid,
        reason: validation.reason,
        riskLevel: validation.riskLevel,
        sanitizedInput: validation.sanitizedInput,
      };

      // Additional validation logic specific to client context
      if (!validation.isValid) {
        this.validationStats.violations++;
        
        if (config.logViolations) {
          logger.error('🚨 SECURITY VIOLATION: Input validation failed', {
            reason: validation.reason,
            riskLevel: validation.riskLevel,
            prompt: input.substring(0, 100) + '...',
          });
        }

        // Determine violation type for better error handling
        result.violationType = this.categorizeViolation(validation.reason || '');
        
        // In strict mode, block all violations
        if (config.strictMode) {
          this.validationStats.blocked++;
          return result;
        }
      }

      // Track sanitization
      if (validation.sanitizedInput && validation.sanitizedInput !== input) {
        this.validationStats.sanitized++;
      }

      return result;
    } catch (error) {
      this.validationStats.violations++;
      
      if (config.logViolations) {
        logger.error('🚨 SECURITY ERROR: Validation process failed', error);
      }

      return {
        isValid: false,
        reason: 'Security validation process failed',
        riskLevel: 'high',
        violationType: 'system_error',
      };
    }
  }

  /**
   * Validate entire request object with context-aware security
   */
  async validateRequest(request: any, options?: SecurityValidationOptions): Promise<ValidationResult> {
    if (!request?.prompt) {
      return {
        isValid: false,
        reason: 'Request missing required prompt field',
        riskLevel: 'medium',
        violationType: 'malformed_request',
      };
    }

    // Validate the main prompt
    const promptValidation = await this.validateInput(request.prompt, options);
    
    if (!promptValidation.isValid) {
      return promptValidation;
    }

    // Additional request-level validations
    const contextValidation = this.validateRequestContext(request);
    if (!contextValidation.isValid) {
      return contextValidation;
    }

    return {
      isValid: true,
      sanitizedInput: promptValidation.sanitizedInput,
    };
  }

  /**
   * Analyze risk level of input without blocking
   */
  async analyzeRisk(input: string): Promise<{ level: string; threats: string[] }> {
    const threats: string[] = [];
    let riskLevel = 'low';

    // Check for suspicious patterns
    const suspiciousPatterns = this.detectSuspiciousPatterns(input);
    threats.push(...suspiciousPatterns);

    // Determine risk level based on threat count and severity
    if (threats.length === 0) {
      riskLevel = 'low';
    } else if (threats.length <= 2) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'high';
    }

    // Check for high-severity threats
    const highSeverityPatterns = ['code_injection', 'command_execution', 'file_manipulation'];
    if (threats.some(threat => highSeverityPatterns.includes(threat))) {
      riskLevel = 'high';
    }

    return { level: riskLevel, threats };
  }

  /**
   * Detect suspicious patterns in input
   */
  detectSuspiciousPatterns(input: string): string[] {
    const patterns: string[] = [];
    const lowerInput = input.toLowerCase();

    // Command injection patterns
    if (/rm\s+-rf|sudo\s+rm|exec\s*\(|eval\s*\(/gi.test(input)) {
      patterns.push('command_injection');
    }

    // Code injection patterns
    if (/\$\{.*\}|\$\(.*\)|`.*`/gi.test(input)) {
      patterns.push('code_injection');
    }

    // File manipulation patterns
    if (/\.\.\/|\.\.\\|\.\.\./gi.test(input)) {
      patterns.push('path_traversal');
    }

    // Script injection patterns
    if (/<script|javascript:|data:|vbscript:/gi.test(input)) {
      patterns.push('script_injection');
    }

    // SQL injection patterns (even though not directly applicable, good to detect)
    if (/union\s+select|drop\s+table|insert\s+into/gi.test(input)) {
      patterns.push('sql_injection');
    }

    return patterns;
  }

  /**
   * Validate request context and metadata
   */
  private validateRequestContext(request: any): ValidationResult {
    // Check for suspicious model requests
    if (request.model && typeof request.model === 'string') {
      if (request.model.includes('..') || request.model.includes('/')) {
        return {
          isValid: false,
          reason: 'Invalid model specification with path traversal attempt',
          riskLevel: 'high',
          violationType: 'path_traversal',
        };
      }
    }

    // Check for suspicious parameter manipulation
    if (request.temperature && (request.temperature < 0 || request.temperature > 2)) {
      return {
        isValid: false,
        reason: 'Invalid temperature parameter outside safe range',
        riskLevel: 'medium',
        violationType: 'parameter_manipulation',
      };
    }

    // Check for excessively large max tokens (potential DoS)
    if (request.maxTokens && request.maxTokens > 100000) {
      return {
        isValid: false,
        reason: 'Excessive maxTokens parameter (potential DoS)',
        riskLevel: 'high',
        violationType: 'resource_exhaustion',
      };
    }

    return { isValid: true };
  }

  /**
   * Categorize violation type for better error handling
   */
  private categorizeViolation(reason: string): string {
    const lowerReason = reason.toLowerCase();
    
    if (lowerReason.includes('command') || lowerReason.includes('exec')) {
      return 'command_injection';
    }
    if (lowerReason.includes('path') || lowerReason.includes('traversal')) {
      return 'path_traversal';
    }
    if (lowerReason.includes('script') || lowerReason.includes('injection')) {
      return 'script_injection';
    }
    if (lowerReason.includes('length') || lowerReason.includes('size')) {
      return 'input_overflow';
    }
    if (lowerReason.includes('pattern') || lowerReason.includes('blocked')) {
      return 'pattern_violation';
    }
    
    return 'unknown_violation';
  }

  /**
   * Update security configuration
   */
  updateSecurityConfig(config: SecurityValidationOptions): void {
    this.validationOptions = { ...this.validationOptions, ...config };
    
    // Reinitialize SecurityUtils with new config
    this.securityUtils = new SecurityUtils({
      enableSandbox: this.validationOptions.enableSandbox,
      maxInputLength: this.validationOptions.maxInputLength,
    });
  }

  /**
   * Get current security status and statistics
   */
  getSecurityStatus(): { enabled: boolean; rulesCount: number; lastUpdate: number } {
    return {
      enabled: this.validationOptions.enableSandbox || false,
      rulesCount: 15, // Approximate number of security rules
      lastUpdate: Date.now(),
    };
  }

  /**
   * Get validation statistics
   */
  getValidationStats() {
    return {
      ...this.validationStats,
      violationRate: this.validationStats.totalValidations > 0 
        ? ((this.validationStats.violations / this.validationStats.totalValidations) * 100).toFixed(2) + '%'
        : '0%',
    };
  }

  /**
   * Reset validation statistics
   */
  resetStats(): void {
    this.validationStats = {
      totalValidations: 0,
      violations: 0,
      blocked: 0,
      sanitized: 0,
    };
  }
}