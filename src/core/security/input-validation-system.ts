/**
 * Comprehensive Input Validation and Sanitization System
 *
 * Provides robust input validation, sanitization, and security
 * measures to prevent injection attacks and ensure data integrity.
 */

import { z } from 'zod';
import { logger } from '../logger.js';
import {
  ErrorFactory,
  ErrorCategory,
  ErrorSeverity,
  ServiceResponse,
  ErrorResponse,
  ErrorHandler,
} from '../error-handling/structured-error-system.js';

// Security patterns for detecting potential threats
const SECURITY_PATTERNS = {
  // Command injection patterns
  COMMAND_INJECTION: [
    /[;&|`$()]/,
    /\b(rm|del|format|shutdown|reboot|killall|pkill)\b/i,
    /\b(sudo|su|chmod|chown)\b/i,
    /[<>|&;`]/,
    /\$\([^)]*\)/,
    /`[^`]*`/,
  ],

  // Script injection patterns
  SCRIPT_INJECTION: [
    /<script[^>]*>/i,
    /<\/script>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /setTimeout\s*\(/i,
    /setInterval\s*\(/i,
    /Function\s*\(/i,
  ],

  // SQL injection patterns
  SQL_INJECTION: [
    /('\s*(or|and)\s*')/i,
    /(union\s+select)/i,
    /(drop\s+table)/i,
    /(insert\s+into)/i,
    /(delete\s+from)/i,
    /(update\s+\w+\s+set)/i,
    /--/,
    /\/\*/,
  ],

  // Path traversal patterns
  PATH_TRAVERSAL: [/\.\./, /~+/, /\/\.\./, /\\\.\./, /%2e%2e/i, /%c0%ae/i],

  // File system manipulation
  FILE_SYSTEM_ATTACKS: [
    /\/proc\//,
    /\/dev\//,
    /\/sys\//,
    /\/etc\/passwd/,
    /\/etc\/shadow/,
    /\.ssh\//,
    /\.aws\//,
    /\.env/,
  ],

  // Code execution patterns
  CODE_EXECUTION: [
    /require\s*\(/,
    /import\s+\w+/,
    /__import__/,
    /exec\s*\(/,
    /system\s*\(/,
    /subprocess/,
    /os\.system/,
    /shell_exec/,
  ],
};

// Common dangerous file extensions
const DANGEROUS_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.pif',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.jar',
  '.app',
  '.deb',
  '.pkg',
  '.dmg',
  '.iso',
  '.msi',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.psm1',
  '.psd1',
  '.ps1xml',
  '.psc1',
  '.ps2',
  '.ps2xml',
  '.psc2',
  '.msh',
  '.msh1',
  '.msh2',
  '.mshxml',
  '.msh1xml',
  '.msh2xml',
];

export enum ValidationLevel {
  BASIC = 'basic',
  STANDARD = 'standard',
  STRICT = 'strict',
  PARANOID = 'paranoid',
}

export interface ValidationOptions {
  level: ValidationLevel;
  allowHtml: boolean;
  allowScripts: boolean;
  allowFileOperations: boolean;
  allowSystemCommands: boolean;
  maxLength: number;
  customPatterns: RegExp[];
}

export interface SanitizationOptions {
  removeHtml: boolean;
  escapeSpecialChars: boolean;
  normalizeWhitespace: boolean;
  removeControlChars: boolean;
  maxLength: number;
  allowedChars: RegExp | null;
}

export interface ValidationResult {
  isValid: boolean;
  sanitizedValue: string;
  threats: string[];
  warnings: string[];
  confidence: number;
}

/**
 * Advanced Input Validator with threat detection
 */
export class AdvancedInputValidator {
  private static defaultValidationOptions: ValidationOptions = {
    level: ValidationLevel.STANDARD,
    allowHtml: false,
    allowScripts: false,
    allowFileOperations: false,
    allowSystemCommands: false,
    maxLength: 10000,
    customPatterns: [],
  };

  private static defaultSanitizationOptions: SanitizationOptions = {
    removeHtml: true,
    escapeSpecialChars: true,
    normalizeWhitespace: true,
    removeControlChars: true,
    maxLength: 10000,
    allowedChars: null,
  };

  /**
   * Comprehensive input validation with threat detection
   */
  static validateInput(
    input: any,
    fieldName: string,
    options: Partial<ValidationOptions> = {}
  ): ServiceResponse<ValidationResult> {
    try {
      const opts = { ...this.defaultValidationOptions, ...options };

      // Convert to string for analysis
      const stringInput = String(input || '');

      // Basic validation
      if (stringInput.length === 0) {
        return ErrorHandler.createErrorResponse(
          ErrorFactory.createError(
            `${fieldName} cannot be empty`,
            ErrorCategory.VALIDATION,
            ErrorSeverity.MEDIUM,
            {
              userMessage: `Please provide a value for ${fieldName}`,
              suggestedActions: [`Enter a valid ${fieldName}`],
            }
          )
        );
      }

      if (stringInput.length > opts.maxLength) {
        return ErrorHandler.createErrorResponse(
          ErrorFactory.createError(
            `${fieldName} exceeds maximum length of ${opts.maxLength}`,
            ErrorCategory.VALIDATION,
            ErrorSeverity.MEDIUM,
            {
              context: { current_length: stringInput.length, max_length: opts.maxLength },
              userMessage: `Input is too long (${stringInput.length} characters)`,
              suggestedActions: [`Reduce input to ${opts.maxLength} characters or less`],
            }
          )
        );
      }

      // Threat detection
      const threats = this.detectThreats(stringInput, opts);
      const warnings = this.detectWarnings(stringInput, opts);

      // Security assessment
      const securityScore = this.assessSecurityRisk(stringInput, threats, warnings);

      if (threats.length > 0 && opts.level !== ValidationLevel.BASIC) {
        return ErrorHandler.createErrorResponse(
          ErrorFactory.createError(
            `Security threat detected in ${fieldName}: ${threats.join(', ')}`,
            ErrorCategory.AUTHORIZATION,
            ErrorSeverity.HIGH,
            {
              context: { threats, field: fieldName, input_sample: stringInput.substring(0, 100) },
              userMessage: 'Input contains potentially dangerous content',
              suggestedActions: [
                'Remove suspicious patterns from input',
                'Use simpler, safer input',
                'Contact administrator if legitimate',
              ],
              recoverable: false,
            }
          )
        );
      }

      // Sanitization
      const sanitized = this.sanitizeInput(stringInput, {
        ...this.defaultSanitizationOptions,
        maxLength: opts.maxLength,
      });

      const result: ValidationResult = {
        isValid: threats.length === 0,
        sanitizedValue: sanitized,
        threats,
        warnings,
        confidence: securityScore,
      };

      return ErrorHandler.createSuccessResponse(result);
    } catch (error) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `Validation failed for ${fieldName}: ${(error as Error).message}`,
          ErrorCategory.VALIDATION,
          ErrorSeverity.HIGH,
          {
            originalError: error as Error,
            userMessage: 'Input validation error',
            suggestedActions: ['Check input format', 'Try with simpler input'],
          }
        )
      );
    }
  }

  /**
   * Validate file path with security checks
   */
  static validateFilePath(path: any): ServiceResponse<string> {
    const validation = this.validateInput(path, 'file path', {
      level: ValidationLevel.STRICT,
      allowFileOperations: true,
      maxLength: 1000,
    });

    if (!validation.success) {
      return ErrorHandler.createErrorResponse((validation as ErrorResponse).error);
    }

    const { sanitizedValue, threats } = validation.data;

    // Additional file path specific checks
    const pathThreats: string[] = [];

    // Check for dangerous extensions
    const lowerPath = sanitizedValue.toLowerCase();
    for (const ext of DANGEROUS_EXTENSIONS) {
      if (lowerPath.endsWith(ext)) {
        pathThreats.push(`dangerous_file_extension:${ext}`);
      }
    }

    // Check for system directories
    const systemPaths = ['/proc/', '/dev/', '/sys/', '/etc/', '/bin/', '/sbin/'];
    for (const sysPath of systemPaths) {
      if (sanitizedValue.startsWith(sysPath)) {
        pathThreats.push(`system_directory:${sysPath}`);
      }
    }

    if (pathThreats.length > 0) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `Dangerous file path detected: ${pathThreats.join(', ')}`,
          ErrorCategory.AUTHORIZATION,
          ErrorSeverity.HIGH,
          {
            context: { path: sanitizedValue, threats: pathThreats },
            userMessage: 'File path contains security risks',
            suggestedActions: [
              'Use safe file paths within project directory',
              'Avoid system directories and executable files',
            ],
            recoverable: false,
          }
        )
      );
    }

    return ErrorHandler.createSuccessResponse(sanitizedValue);
  }

  /**
   * Validate command input with strict security
   */
  static validateCommand(command: any): ServiceResponse<string> {
    const validation = this.validateInput(command, 'command', {
      level: ValidationLevel.PARANOID,
      allowSystemCommands: false,
      maxLength: 500,
    });

    if (!validation.success) {
      return ErrorHandler.createErrorResponse((validation as ErrorResponse).error);
    }

    const { sanitizedValue, threats } = validation.data;

    // Additional command-specific security checks
    const commandThreats: string[] = [...threats];

    // Check for shell metacharacters
    const shellMetaChars = /[;&|<>`$()]/;
    if (shellMetaChars.test(sanitizedValue)) {
      commandThreats.push('shell_metacharacters');
    }

    // Check for dangerous commands
    const dangerousCommands = [
      'rm',
      'del',
      'format',
      'fdisk',
      'mkfs',
      'dd',
      'sudo',
      'su',
      'chmod',
      'chown',
      'passwd',
      'useradd',
      'userdel',
      'shutdown',
      'reboot',
      'halt',
    ];

    for (const cmd of dangerousCommands) {
      if (new RegExp(`\\b${cmd}\\b`, 'i').test(sanitizedValue)) {
        commandThreats.push(`dangerous_command:${cmd}`);
      }
    }

    if (commandThreats.length > 0) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `Dangerous command detected: ${commandThreats.join(', ')}`,
          ErrorCategory.AUTHORIZATION,
          ErrorSeverity.CRITICAL,
          {
            context: { command: sanitizedValue, threats: commandThreats },
            userMessage: 'Command contains potentially dangerous operations',
            suggestedActions: [
              'Use safer alternative commands',
              'Avoid system administration commands',
              'Contact administrator for privileged operations',
            ],
            recoverable: false,
          }
        )
      );
    }

    return ErrorHandler.createSuccessResponse(sanitizedValue);
  }

  /**
   * Validate URL with security checks
   */
  static validateUrl(url: any): ServiceResponse<string> {
    const validation = this.validateInput(url, 'URL', {
      level: ValidationLevel.STANDARD,
      maxLength: 2000,
    });

    if (!validation.success) {
      return ErrorHandler.createErrorResponse((validation as ErrorResponse).error);
    }

    const { sanitizedValue } = validation.data;

    try {
      const parsedUrl = new URL(sanitizedValue);

      // Check for dangerous protocols
      const dangerousProtocols = ['file:', 'ftp:', 'javascript:', 'data:', 'vbscript:'];
      if (dangerousProtocols.includes(parsedUrl.protocol)) {
        return ErrorHandler.createErrorResponse(
          ErrorFactory.createError(
            `Dangerous URL protocol: ${parsedUrl.protocol}`,
            ErrorCategory.AUTHORIZATION,
            ErrorSeverity.HIGH,
            {
              context: { url: sanitizedValue, protocol: parsedUrl.protocol },
              userMessage: 'URL uses an unsafe protocol',
              suggestedActions: ['Use HTTP or HTTPS URLs only'],
              recoverable: false,
            }
          )
        );
      }

      // Check for localhost/internal network access
      const hostname = parsedUrl.hostname.toLowerCase();
      const internalHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
      const privateNetworks = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/;

      if (internalHosts.includes(hostname) || privateNetworks.test(hostname)) {
        logger.warn(`Potential internal network access attempt: ${hostname}`);
      }

      return ErrorHandler.createSuccessResponse(sanitizedValue);
    } catch (error) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `Invalid URL format: ${(error as Error).message}`,
          ErrorCategory.VALIDATION,
          ErrorSeverity.MEDIUM,
          {
            context: { url: sanitizedValue },
            userMessage: 'URL format is invalid',
            suggestedActions: ['Check URL syntax', 'Include protocol (http:// or https://)'],
          }
        )
      );
    }
  }

  /**
   * Detect security threats in input
   */
  private static detectThreats(input: string, options: ValidationOptions): string[] {
    const threats: string[] = [];

    // Check based on validation level
    const patternGroups = this.getPatternGroups(options);

    for (const [category, patterns] of Object.entries(patternGroups)) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          threats.push(category);
          break; // One threat per category is enough
        }
      }
    }

    // Check custom patterns
    for (const pattern of options.customPatterns) {
      if (pattern.test(input)) {
        threats.push('custom_pattern');
        break;
      }
    }

    return threats;
  }

  /**
   * Detect potential warnings in input
   */
  private static detectWarnings(input: string, options: ValidationOptions): string[] {
    const warnings: string[] = [];

    // Check for suspicious but not necessarily dangerous patterns
    if (input.includes('..')) warnings.push('path_traversal_attempt');
    if (input.includes('${') || input.includes('#{')) warnings.push('variable_interpolation');
    if (input.match(/\s{10,}/)) warnings.push('excessive_whitespace');
    if (input.match(/(.)\1{20,}/)) warnings.push('repetitive_characters');
    if (input.includes('\x00')) warnings.push('null_bytes');

    return warnings;
  }

  /**
   * Get pattern groups based on validation level
   */
  private static getPatternGroups(options: ValidationOptions): Record<string, RegExp[]> {
    const groups: Record<string, RegExp[]> = {};

    // Add patterns based on validation level (cumulative)
    if (options.level === ValidationLevel.PARANOID) {
      groups.code_execution = SECURITY_PATTERNS.CODE_EXECUTION;
      groups.file_system_attacks = SECURITY_PATTERNS.FILE_SYSTEM_ATTACKS;
    }

    if (options.level === ValidationLevel.PARANOID || options.level === ValidationLevel.STRICT) {
      groups.sql_injection = SECURITY_PATTERNS.SQL_INJECTION;
    }

    // All levels include these patterns
    groups.command_injection = SECURITY_PATTERNS.COMMAND_INJECTION;
    groups.path_traversal = SECURITY_PATTERNS.PATH_TRAVERSAL;

    if (!options.allowScripts) {
      groups.script_injection = SECURITY_PATTERNS.SCRIPT_INJECTION;
    }

    switch (options.level) {
      case ValidationLevel.BASIC:
        // Basic patterns always checked
        break;
    }

    return groups;
  }

  /**
   * Assess security risk score (0-1, higher is more dangerous)
   */
  private static assessSecurityRisk(input: string, threats: string[], warnings: string[]): number {
    let score = 0;

    // Base score for threats
    score += threats.length * 0.3;

    // Base score for warnings
    score += warnings.length * 0.1;

    // Additional factors
    if (input.length > 1000) score += 0.1;
    if (input.includes('\x00')) score += 0.2;
    if (input.match(/[^\x20-\x7E]/)) score += 0.1; // Non-printable chars

    return Math.min(score, 1.0);
  }

  /**
   * Sanitize input by removing/escaping dangerous content
   */
  private static sanitizeInput(input: string, options: SanitizationOptions): string {
    let sanitized = input;

    // Remove control characters
    if (options.removeControlChars) {
      sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    }

    // Remove HTML tags
    if (options.removeHtml) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }

    // Escape special characters
    if (options.escapeSpecialChars) {
      sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }

    // Normalize whitespace
    if (options.normalizeWhitespace) {
      sanitized = sanitized.replace(/\s+/g, ' ').trim();
    }

    // Apply character whitelist
    if (options.allowedChars) {
      sanitized = sanitized.replace(new RegExp(`[^${options.allowedChars.source}]`, 'g'), '');
    }

    // Truncate to max length
    if (sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized;
  }
}

/**
 * Schema-based validator with Zod integration
 */
export class SchemaValidator {
  /**
   * Validate data against Zod schema with security checks
   */
  static validateWithSchema<T>(
    data: any,
    schema: z.ZodSchema<T>,
    options: Partial<ValidationOptions> = {}
  ): ServiceResponse<T> {
    try {
      // First validate against schema
      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');

        return ErrorHandler.createErrorResponse(
          ErrorFactory.createError(
            `Schema validation failed: ${errors}`,
            ErrorCategory.VALIDATION,
            ErrorSeverity.MEDIUM,
            {
              context: { validation_errors: result.error.errors },
              userMessage: 'Input format is invalid',
              suggestedActions: ['Check input format and required fields'],
            }
          )
        );
      }

      // Perform security validation on string fields
      const securityCheck = this.performSecurityValidation(result.data, options);
      if (!securityCheck.success) {
        return ErrorHandler.createErrorResponse((securityCheck as ErrorResponse).error);
      }

      return ErrorHandler.createSuccessResponse(result.data);
    } catch (error) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `Schema validation error: ${(error as Error).message}`,
          ErrorCategory.VALIDATION,
          ErrorSeverity.HIGH,
          {
            originalError: error as Error,
            userMessage: 'Data validation failed',
            suggestedActions: ['Check data structure and types'],
          }
        )
      );
    }
  }

  private static performSecurityValidation(
    data: any,
    options: Partial<ValidationOptions>
  ): ServiceResponse<void> {
    try {
      this.recursiveSecurityCheck(data, options);
      return ErrorHandler.createSuccessResponse(undefined);
    } catch (error) {
      return ErrorHandler.createErrorResponse(error as any);
    }
  }

  private static recursiveSecurityCheck(
    obj: any,
    options: Partial<ValidationOptions>,
    path: string = ''
  ): void {
    if (typeof obj === 'string') {
      const validation = AdvancedInputValidator.validateInput(obj, path || 'field', options);
      if (!validation.success) {
        throw (validation as any).error;
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.recursiveSecurityCheck(item, options, `${path}[${index}]`);
      });
    } else if (obj && typeof obj === 'object') {
      Object.entries(obj).forEach(([key, value]) => {
        const newPath = path ? `${path}.${key}` : key;
        this.recursiveSecurityCheck(value, options, newPath);
      });
    }
  }
}

// Additional exports for external use
