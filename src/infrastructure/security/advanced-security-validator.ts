/**
 * Advanced Security Validator
 * Enhanced security validation with enterprise-grade features
 */

import { UnifiedSecurityValidator } from '../../domain/services/unified-security-validator.js';
import { ModernInputSanitizer } from './modern-input-sanitizer.js';
import { logger } from '../../core/logger.js';
import type { ILogger } from '../../domain/interfaces/logger.js';

export interface SecurityValidationOptions {
  enableStrictMode: boolean;
  maxInputLength: number;
  allowedPatterns: RegExp[];
  blockedPatterns: RegExp[];
  enableLogging: boolean;
  requireEncryption: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedInput?: any;
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
  validationTime: number;
  // Add missing properties for compatibility
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  violations: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    pattern?: string;
  }>;
}

export class AdvancedSecurityValidator {
  private unifiedValidator: UnifiedSecurityValidator;
  private inputSanitizer: ModernInputSanitizer;
  private options: SecurityValidationOptions;

  constructor(options?: Partial<SecurityValidationOptions>) {
    this.options = {
      enableStrictMode: true,
      maxInputLength: 10000,
      allowedPatterns: [],
      blockedPatterns: [
        /\beval\b/i,
        /\bexec\b/i,
        /\bspawn\b/i,
        /\bchild_process\b/i,
        /\bfs\.\w+Sync\b/i,
        /\bprocess\.env\b/i,
        /\b__dirname\b/i,
        /\b__filename\b/i,
      ],
      enableLogging: true,
      requireEncryption: false,
      ...options,
    };

    // Create a logger for the validator
    const validatorLogger = {
      info: (msg: string) => console.log(`[SecurityValidator] ${msg}`),
      error: (msg: string, error?: any) => console.error(`[SecurityValidator] ${msg}`, error),
      warn: (msg: string) => console.warn(`[SecurityValidator] ${msg}`),
      debug: (msg: string) => console.debug(`[SecurityValidator] ${msg}`),
      trace: (msg: string) => console.trace(`[SecurityValidator] ${msg}`),
    } as ILogger;

    this.unifiedValidator = new UnifiedSecurityValidator(validatorLogger, {
      enabled: true,
      securityLevel: this.options.enableStrictMode ? 'strict' : 'medium',
      maxInputLength: this.options.maxInputLength,
      enableInputSanitization: true,
      enablePatternMatching: true,
      enableSandbox: true,
      sandboxTimeout: 30000,
      allowedCommands: [],
      blockedCommands: ['rm', 'del', 'format', 'shutdown'],
      allowedShells: ['bash', 'sh', 'zsh'],
      allowedPaths: [],
      restrictedPaths: ['/etc', '/usr', '/var'],
      allowFileSystemWrite: false,
      allowFileSystemRead: true,
      allowProcessSpawning: false,
      allowProcessKilling: false,
      maxProcesses: 5,
      allowNetworkAccess: false,
      allowedDomains: [],
      blockedDomains: [],
      allowedPorts: [80, 443],
      allowEnvironmentAccess: false,
      allowEnvironmentModification: false,
      protectedEnvironmentVars: ['PATH', 'HOME'],
      allowedLanguages: ['javascript', 'typescript', 'python'],
      blockedLanguages: ['bash'],
      allowCodeEvaluation: false,
      allowDynamicImports: false,
      enableAuditLogging: this.options.enableLogging,
      logSecurityViolations: true,
      alertOnCriticalViolations: true,
    });
    this.inputSanitizer = new ModernInputSanitizer();
  }

  async validate(input: any, context: any = {}): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let securityLevel: ValidationResult['securityLevel'] = 'low';

    try {
      // Basic validation using unified validator
      const basicValidation = await this.unifiedValidator.validateInput(input.toString(), {
        sessionId: context.sessionId || 'default',
        requestId: `advanced-${Date.now()}`,
        userAgent: 'CodeCrucible-AdvancedSecurityValidator',
        ipAddress: '127.0.0.1',
        timestamp: new Date(),
        operationType: 'advanced-security-validation',
        userId: context.userId,
        workingDirectory: context.workingDirectory || process.cwd(),
        environment: this.options.enableStrictMode ? 'production' : 'development',
        permissions: context.permissions || [],
        metadata: {
          securityLevel: this.options.enableStrictMode ? 'high' : 'medium',
          timeoutMs: 30000,
        },
      });

      if (!basicValidation.isValid) {
        errors.push(...basicValidation.violations.map(v => v.message));
        securityLevel = basicValidation.riskLevel === 'critical' ? 'critical' : 'high';
      }

      // Advanced pattern-based validation
      const patternValidation = this.validatePatterns(input);
      if (!patternValidation.isValid) {
        errors.push(...patternValidation.errors);
        securityLevel = 'critical';
      }

      // Length validation
      const lengthValidation = this.validateLength(input);
      if (!lengthValidation.isValid) {
        errors.push(...lengthValidation.errors);
        if (securityLevel === 'low') securityLevel = 'medium';
      }

      // Structure validation
      const structureValidation = this.validateStructure(input, context);
      if (!structureValidation.isValid) {
        errors.push(...structureValidation.errors);
        warnings.push(...structureValidation.warnings);
      }

      // Encryption requirement check
      if (this.options.requireEncryption && !this.isEncrypted(input)) {
        errors.push('Input must be encrypted for this security level');
        securityLevel = 'critical';
      }

      // Sanitize input if validation passes
      let sanitizedInput;
      if (errors.length === 0) {
        sanitizedInput = await this.inputSanitizer.sanitize(input);
      }

      const result: ValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        sanitizedInput,
        securityLevel,
        validationTime: Date.now() - startTime,
        riskLevel:
          securityLevel === 'critical'
            ? 'critical'
            : securityLevel === 'high'
              ? 'high'
              : securityLevel === 'medium'
                ? 'medium'
                : 'low',
        violations: errors.map(error => ({
          type: 'validation_error',
          severity:
            securityLevel === 'critical'
              ? 'critical'
              : securityLevel === 'high'
                ? 'high'
                : 'medium',
          message: error,
        })),
      };

      if (this.options.enableLogging) {
        this.logValidationResult(result, input, context);
      }

      return result;
    } catch (error) {
      logger.error('Advanced security validation failed:', error);

      return {
        isValid: false,
        errors: [`Validation error: ${error}`],
        warnings: [],
        securityLevel: 'critical',
        validationTime: Date.now() - startTime,
        riskLevel: 'critical',
        violations: [
          {
            type: 'system_error',
            severity: 'critical',
            message: `Validation error: ${error}`,
          },
        ],
      };
    }
  }

  /**
   * Validate input (alias for validate method for backward compatibility)
   */
  async validateInput(input: any, context: any = {}): Promise<ValidationResult> {
    return await this.validate(input, context);
  }

  async validateBatch(inputs: any[], context: any = {}): Promise<ValidationResult[]> {
    const results = await Promise.all(inputs.map(async input => this.validate(input, context)));

    // Log batch summary if logging is enabled
    if (this.options.enableLogging) {
      const valid = results.filter(r => r.isValid).length;
      const invalid = results.length - valid;
      logger.info(`Batch validation complete: ${valid} valid, ${invalid} invalid`);
    }

    return results;
  }

  updateOptions(newOptions: Partial<SecurityValidationOptions>): void {
    this.options = { ...this.options, ...newOptions };
    logger.info('Advanced security validator options updated');
  }

  getSecurityReport(): any {
    return {
      options: this.options,
      validationCount: 0, // Would track in real implementation
      blockCount: 0, // Would track blocked attempts
      lastValidation: Date.now(),
      securityLevel: this.options.enableStrictMode ? 'high' : 'medium',
    };
  }

  // Private validation methods
  private validatePatterns(input: any): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const inputStr = typeof input === 'string' ? input : JSON.stringify(input);

    // Check blocked patterns
    for (const pattern of this.options.blockedPatterns) {
      if (pattern.test(inputStr)) {
        errors.push(`Input contains blocked pattern: ${pattern.source}`);
      }
    }

    // Check allowed patterns if specified
    if (this.options.allowedPatterns.length > 0) {
      const hasAllowedPattern = this.options.allowedPatterns.some(pattern =>
        pattern.test(inputStr)
      );

      if (!hasAllowedPattern) {
        warnings.push('Input does not match any allowed patterns');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateLength(input: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input);

    if (inputStr.length > this.options.maxInputLength) {
      errors.push(
        `Input exceeds maximum length: ${inputStr.length} > ${this.options.maxInputLength}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private validateStructure(
    input: any,
    context: any
  ): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for suspicious object structures
    if (typeof input === 'object' && input !== null) {
      const keys = Object.keys(input);

      // Check for prototype pollution attempts
      if (
        keys.includes('__proto__') ||
        keys.includes('constructor') ||
        keys.includes('prototype')
      ) {
        errors.push('Input contains potentially dangerous object properties');
      }

      // Check for deeply nested objects
      if (this.getObjectDepth(input) > 10) {
        warnings.push('Input object is deeply nested, potential performance impact');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private isEncrypted(input: any): boolean {
    // Simple heuristic to check if input might be encrypted
    if (typeof input !== 'string') return false;

    // Check for base64 encoding patterns or common encryption prefixes
    return /^[A-Za-z0-9+/]+=*$/.test(input) && input.length > 20;
  }

  private getObjectDepth(obj: any, depth: number = 0): number {
    if (depth > 20) return depth; // Prevent stack overflow

    if (typeof obj !== 'object' || obj === null) {
      return depth;
    }

    const depths = Object.values(obj).map(value => this.getObjectDepth(value, depth + 1));

    return Math.max(depth, ...depths);
  }

  private logValidationResult(result: ValidationResult, input: any, context: any): void {
    const level = result.isValid ? 'info' : 'warn';
    const message =
      `Security validation ${result.isValid ? 'passed' : 'failed'}: ` +
      `level=${result.securityLevel}, errors=${result.errors.length}, warnings=${result.warnings.length}`;

    logger[level](message);

    if (result.errors.length > 0) {
      logger.warn('Validation errors:', result.errors);
    }
  }
}
