/**
 * Enterprise Input Validation Middleware
 * Implements comprehensive input sanitization and validation with security rules
 */

import { logger } from '../logger.js';

export interface ValidationRule {
  type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'email'
    | 'url'
    | 'uuid'
    | 'json'
    | 'array'
    | 'object'
    | 'custom';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
  sanitize?: boolean;
  errorMessage?: string;
}

export interface ValidationSchema {
  [fieldPath: string]: ValidationRule;
}

export interface ValidationOptions {
  allowExtraFields?: boolean;
  stripExtraFields?: boolean;
  abortEarly?: boolean;
  skipMissing?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: any;
  warnings: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  value: any;
  rule: string;
}

export interface SecurityConfig {
  maxDepth: number;
  maxKeys: number;
  maxStringLength: number;
  maxArrayLength: number;
  allowedTags: string[];
  blockedPatterns: RegExp[];
  sqlInjectionPatterns: RegExp[];
  xssPatterns: RegExp[];
  pathTraversalPatterns: RegExp[];
}

export class InputValidator {
  private securityConfig: SecurityConfig;

  constructor(securityConfig?: Partial<SecurityConfig>) {
    this.securityConfig = {
      maxDepth: 10,
      maxKeys: 100,
      maxStringLength: 10000,
      maxArrayLength: 1000,
      allowedTags: [],
      blockedPatterns: [
        /\b(eval|function|script|javascript|vbscript|onload|onerror|onclick)\b/gi,
        /\b(document|window|alert|confirm|prompt)\b/gi,
        /<\s*script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ],
      sqlInjectionPatterns: [
        /(\b(select|insert|update|delete|drop|create|alter|exec|execute|union|declare)\b)/gi,
        /(\b(or|and)\b\s*[\'\"]?\s*[\'\"]?\s*=\s*[\'\"]?\s*[\'\"]?)/gi,
        /(;|\-\-|\#|\/\*|\*\/)/gi,
        /(\b(sleep|benchmark|waitfor)\b\s*\()/gi,
      ],
      xssPatterns: [
        /<\s*script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript\s*:/gi,
        /on\w+\s*=/gi,
        /<\s*iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
        /<\s*object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
        /<\s*embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
      ],
      pathTraversalPatterns: [
        /\.\.\//gi,
        /\.\.\\\\]/gi,
        /%2e%2e%2f/gi,
        /%2e%2e%5c/gi,
        /\.\.\%2f/gi,
        /\.\.\%5c/gi,
      ],
      ...securityConfig,
    };
  }

  /**
   * Validate data against schema
   */
  validate(data: any, schema: ValidationSchema, options: ValidationOptions = {}): ValidationResult {
    const opts: ValidationOptions = {
      allowExtraFields: false,
      stripExtraFields: true,
      abortEarly: false,
      skipMissing: false,
      ...options,
    };

    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    let sanitizedData = JSON.parse(JSON.stringify(data)); // Deep clone

    try {
      // Security validation first
      const securityResult = this.performSecurityValidation(data);
      if (!securityResult.isValid) {
        errors.push(...securityResult.errors);
        warnings.push(...securityResult.warnings);
      }

      // Schema validation
      const schemaResult = this.validateSchema(sanitizedData, schema, opts);
      errors.push(...schemaResult.errors);
      warnings.push(...schemaResult.warnings);
      sanitizedData = schemaResult.sanitizedData;

      // Log validation issues
      if (errors.length > 0) {
        logger.warn('Input validation failed', {
          errorCount: errors.length,
          errors: errors.map(e => ({ field: e.field, rule: e.rule, message: e.message })),
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitizedData: errors.length === 0 ? sanitizedData : undefined,
        warnings,
      };
    } catch (error) {
      logger.error('Input validation error', error as Error);
      return {
        isValid: false,
        errors: [
          {
            field: 'root',
            message: 'Validation system error',
            value: data,
            rule: 'system',
          },
        ],
        warnings,
      };
    }
  }

  /**
   * Perform security validation
   */
  private performSecurityValidation(data: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Check data structure depth and complexity
    const complexity = this.analyzeComplexity(data);

    if (complexity.depth > this.securityConfig.maxDepth) {
      errors.push({
        field: 'root',
        message: `Data structure too deep (max: ${this.securityConfig.maxDepth})`,
        value: complexity.depth,
        rule: 'max_depth',
      });
    }

    if (complexity.keys > this.securityConfig.maxKeys) {
      errors.push({
        field: 'root',
        message: `Too many keys (max: ${this.securityConfig.maxKeys})`,
        value: complexity.keys,
        rule: 'max_keys',
      });
    }

    // Scan for security threats
    this.scanForThreats(data, '', errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate against schema
   */
  private validateSchema(
    data: any,
    schema: ValidationSchema,
    options: ValidationOptions
  ): {
    errors: ValidationError[];
    warnings: string[];
    sanitizedData: any;
  } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const sanitizedData = { ...data };

    // Validate each field in schema
    for (const [fieldPath, rule] of Object.entries(schema)) {
      const value = this.getNestedValue(data, fieldPath);
      const fieldResult = this.validateField(fieldPath, value, rule);

      if (!fieldResult.isValid) {
        errors.push(...fieldResult.errors);
      }

      warnings.push(...fieldResult.warnings);

      // Apply sanitization
      if (fieldResult.sanitizedValue !== undefined) {
        this.setNestedValue(sanitizedData, fieldPath, fieldResult.sanitizedValue);
      }

      // Remove field if validation failed and stripExtraFields is true
      if (!fieldResult.isValid && options.stripExtraFields) {
        this.deleteNestedValue(sanitizedData, fieldPath);
      }

      // Abort early if configured
      if (options.abortEarly && errors.length > 0) {
        break;
      }
    }

    // Handle extra fields
    if (!options.allowExtraFields) {
      const extraFields = this.findExtraFields(data, schema);

      for (const extraField of extraFields) {
        if (options.stripExtraFields) {
          this.deleteNestedValue(sanitizedData, extraField);
          warnings.push(`Removed extra field: ${extraField}`);
        } else {
          errors.push({
            field: extraField,
            message: 'Field not allowed',
            value: this.getNestedValue(data, extraField),
            rule: 'extra_field',
          });
        }
      }
    }

    return { errors, warnings, sanitizedData };
  }

  /**
   * Validate a single field
   */
  private validateField(
    fieldPath: string,
    value: any,
    rule: ValidationRule
  ): {
    isValid: boolean;
    errors: ValidationError[];
    warnings: string[];
    sanitizedValue?: any;
  } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    let sanitizedValue = value;

    // Check if field is required
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: fieldPath,
        message: rule.errorMessage || `${fieldPath} is required`,
        value,
        rule: 'required',
      });
      return { isValid: false, errors, warnings };
    }

    // Skip validation if value is undefined/null and not required
    if ((value === undefined || value === null) && !rule.required) {
      return { isValid: true, errors, warnings };
    }

    // Type validation
    const typeResult = this.validateType(fieldPath, value, rule.type);
    if (!typeResult.isValid) {
      errors.push(...typeResult.errors);
    } else {
      sanitizedValue = typeResult.sanitizedValue;
    }

    // Length/size validation
    if (rule.min !== undefined || rule.max !== undefined) {
      const sizeResult = this.validateSize(fieldPath, value, rule.min, rule.max);
      if (!sizeResult.isValid) {
        errors.push(...sizeResult.errors);
      }
    }

    // Pattern validation
    if (rule.pattern && typeof value === 'string') {
      if (!rule.pattern.test(value)) {
        errors.push({
          field: fieldPath,
          message: rule.errorMessage || `${fieldPath} format is invalid`,
          value,
          rule: 'pattern',
        });
      }
    }

    // Enum validation
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push({
        field: fieldPath,
        message: rule.errorMessage || `${fieldPath} must be one of: ${rule.enum.join(', ')}`,
        value,
        rule: 'enum',
      });
    }

    // Custom validation
    if (rule.custom) {
      const customResult = rule.custom(value);
      if (customResult !== true) {
        errors.push({
          field: fieldPath,
          message:
            rule.errorMessage ||
            (typeof customResult === 'string'
              ? customResult
              : `${fieldPath} failed custom validation`),
          value,
          rule: 'custom',
        });
      }
    }

    // Sanitization
    if (rule.sanitize && typeof value === 'string') {
      sanitizedValue = this.sanitizeString(value);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedValue,
    };
  }

  /**
   * Validate data type
   */
  private validateType(
    fieldPath: string,
    value: any,
    type: string
  ): {
    isValid: boolean;
    errors: ValidationError[];
    sanitizedValue: any;
  } {
    const errors: ValidationError[] = [];
    let sanitizedValue = value;

    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          // Try to convert to string
          sanitizedValue = String(value);
          if (sanitizedValue === '[object Object]') {
            errors.push({
              field: fieldPath,
              message: `${fieldPath} must be a string`,
              value,
              rule: 'type',
            });
          }
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          const num = Number(value);
          if (isNaN(num)) {
            errors.push({
              field: fieldPath,
              message: `${fieldPath} must be a number`,
              value,
              rule: 'type',
            });
          } else {
            sanitizedValue = num;
          }
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          if (value === 'true' || value === '1' || value === 1) {
            sanitizedValue = true;
          } else if (value === 'false' || value === '0' || value === 0) {
            sanitizedValue = false;
          } else {
            errors.push({
              field: fieldPath,
              message: `${fieldPath} must be a boolean`,
              value,
              rule: 'type',
            });
          }
        }
        break;

      case 'email':
        if (typeof value !== 'string' || !this.isValidEmail(value)) {
          errors.push({
            field: fieldPath,
            message: `${fieldPath} must be a valid email`,
            value,
            rule: 'type',
          });
        }
        break;

      case 'url':
        if (typeof value !== 'string' || !this.isValidUrl(value)) {
          errors.push({
            field: fieldPath,
            message: `${fieldPath} must be a valid URL`,
            value,
            rule: 'type',
          });
        }
        break;

      case 'uuid':
        if (typeof value !== 'string' || !this.isValidUuid(value)) {
          errors.push({
            field: fieldPath,
            message: `${fieldPath} must be a valid UUID`,
            value,
            rule: 'type',
          });
        }
        break;

      case 'json':
        if (typeof value === 'string') {
          try {
            sanitizedValue = JSON.parse(value);
          } catch {
            errors.push({
              field: fieldPath,
              message: `${fieldPath} must be valid JSON`,
              value,
              rule: 'type',
            });
          }
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          errors.push({
            field: fieldPath,
            message: `${fieldPath} must be an array`,
            value,
            rule: 'type',
          });
        }
        break;

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors.push({
            field: fieldPath,
            message: `${fieldPath} must be an object`,
            value,
            rule: 'type',
          });
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue,
    };
  }

  /**
   * Validate size/length constraints
   */
  private validateSize(
    fieldPath: string,
    value: any,
    min?: number,
    max?: number
  ): {
    isValid: boolean;
    errors: ValidationError[];
  } {
    const errors: ValidationError[] = [];
    let size: number;

    if (typeof value === 'string' || Array.isArray(value)) {
      size = value.length;
    } else if (typeof value === 'number') {
      size = value;
    } else {
      return { isValid: true, errors };
    }

    if (min !== undefined && size < min) {
      errors.push({
        field: fieldPath,
        message: `${fieldPath} must be at least ${min}`,
        value,
        rule: 'min',
      });
    }

    if (max !== undefined && size > max) {
      errors.push({
        field: fieldPath,
        message: `${fieldPath} must be at most ${max}`,
        value,
        rule: 'max',
      });
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Scan for security threats
   */
  private scanForThreats(
    data: any,
    path: string,
    errors: ValidationError[],
    warnings: string[]
  ): void {
    if (typeof data === 'string') {
      // Check string length
      if (data.length > this.securityConfig.maxStringLength) {
        errors.push({
          field: path || 'string_field',
          message: `String too long (max: ${this.securityConfig.maxStringLength})`,
          value: data.length,
          rule: 'max_string_length',
        });
      }

      // Scan for malicious patterns
      for (const pattern of this.securityConfig.blockedPatterns) {
        if (pattern.test(data)) {
          errors.push({
            field: path || 'string_field',
            message: 'Potentially malicious content detected',
            value: data.substring(0, 100),
            rule: 'blocked_pattern',
          });
        }
      }

      // SQL injection detection
      for (const pattern of this.securityConfig.sqlInjectionPatterns) {
        if (pattern.test(data)) {
          warnings.push(`Potential SQL injection attempt in field: ${path || 'string_field'}`);
        }
      }

      // XSS detection
      for (const pattern of this.securityConfig.xssPatterns) {
        if (pattern.test(data)) {
          warnings.push(`Potential XSS attempt in field: ${path || 'string_field'}`);
        }
      }

      // Path traversal detection
      for (const pattern of this.securityConfig.pathTraversalPatterns) {
        if (pattern.test(data)) {
          warnings.push(`Potential path traversal attempt in field: ${path || 'string_field'}`);
        }
      }
    } else if (Array.isArray(data)) {
      if (data.length > this.securityConfig.maxArrayLength) {
        errors.push({
          field: path || 'array_field',
          message: `Array too long (max: ${this.securityConfig.maxArrayLength})`,
          value: data.length,
          rule: 'max_array_length',
        });
      }

      data.forEach((item, index) => {
        this.scanForThreats(item, `${path}[${index}]`, errors, warnings);
      });
    } else if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        const newPath = path ? `${path}.${key}` : key;
        this.scanForThreats(value, newPath, errors, warnings);
      }
    }
  }

  /**
   * Analyze data complexity
   */
  private analyzeComplexity(data: any, depth: number = 0): { depth: number; keys: number } {
    if (depth > this.securityConfig.maxDepth) {
      return { depth, keys: 0 };
    }

    let maxDepth = depth;
    let totalKeys = 0;

    if (Array.isArray(data)) {
      for (const item of data) {
        const itemComplexity = this.analyzeComplexity(item, depth + 1);
        maxDepth = Math.max(maxDepth, itemComplexity.depth);
        totalKeys += itemComplexity.keys;
      }
    } else if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      totalKeys += keys.length;

      for (const value of Object.values(data)) {
        const valueComplexity = this.analyzeComplexity(value, depth + 1);
        maxDepth = Math.max(maxDepth, valueComplexity.depth);
        totalKeys += valueComplexity.keys;
      }
    }

    return { depth: maxDepth, keys: totalKeys };
  }

  /**
   * Sanitize string input
   */
  private sanitizeString(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .trim();
  }

  /**
   * Validation helper methods
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isValidUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Utility methods for nested object access
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current)) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  private deleteNestedValue(obj: any, path: string): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => current?.[key], obj);
    if (target) {
      delete target[lastKey];
    }
  }

  private findExtraFields(data: any, schema: ValidationSchema): string[] {
    const schemaFields = new Set(Object.keys(schema));
    const dataFields = this.getAllFieldPaths(data);
    return dataFields.filter(field => !schemaFields.has(field));
  }

  private getAllFieldPaths(obj: any, prefix: string = ''): string[] {
    const paths: string[] = [];

    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
      for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        paths.push(path);

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          paths.push(...this.getAllFieldPaths(value, path));
        }
      }
    }

    return paths;
  }

  /**
   * Express middleware factory
   */
  static middleware(schema: ValidationSchema, options: ValidationOptions = {}) {
    const validator = new InputValidator();

    return (req: any, res: any, next: any) => {
      try {
        // Validate request body
        if (req.body && Object.keys(req.body).length > 0) {
          const result = validator.validate(req.body, schema, options);

          if (!result.isValid) {
            logger.warn('Request body validation failed', {
              path: req.path,
              method: req.method,
              errors: result.errors.map(e => ({ field: e.field, rule: e.rule })),
            });

            return res.status(400).json({
              error: 'Invalid request data',
              details: result.errors.map(e => ({
                field: e.field,
                message: e.message,
                rule: e.rule,
              })),
            });
          }

          // Replace body with sanitized data
          req.body = result.sanitizedData;

          // Log warnings
          if (result.warnings.length > 0) {
            logger.warn('Request validation warnings', {
              path: req.path,
              warnings: result.warnings,
            });
          }
        }

        next();
      } catch (error) {
        logger.error('Input validation middleware error', error as Error);
        return res.status(500).json({
          error: 'Validation system error',
        });
      }
    };
  }

  /**
   * Create common validation schemas
   */
  static createCommonSchemas(): Record<string, ValidationSchema> {
    return {
      // User registration
      userRegistration: {
        email: { type: 'email', required: true, max: 254, sanitize: true },
        password: { type: 'string', required: true, min: 8, max: 128 },
        username: {
          type: 'string',
          required: true,
          min: 3,
          max: 50,
          pattern: /^[a-zA-Z0-9_-]+$/,
          sanitize: true,
        },
        fullName: { type: 'string', required: false, max: 100, sanitize: true },
      },

      // User login
      userLogin: {
        email: { type: 'email', required: true, sanitize: true },
        password: { type: 'string', required: true },
      },

      // Code generation request
      codeGeneration: {
        prompt: { type: 'string', required: true, min: 10, max: 5000, sanitize: true },
        language: {
          type: 'string',
          required: false,
          enum: ['javascript', 'typescript', 'python', 'java', 'cpp', 'rust', 'go'],
        },
        voices: { type: 'array', required: false, max: 5 },
        maxTokens: { type: 'number', required: false, min: 100, max: 4000 },
      },

      // File analysis request
      fileAnalysis: {
        filePath: { type: 'string', required: true, max: 500, sanitize: true },
        analysisType: {
          type: 'string',
          required: false,
          enum: ['security', 'performance', 'quality', 'comprehensive'],
        },
        includeMetrics: { type: 'boolean', required: false },
      },

      // Configuration update
      configUpdate: {
        key: { type: 'string', required: true, max: 100, pattern: /^[a-zA-Z0-9._-]+$/ },
        value: { type: 'string', required: true, max: 1000 },
        sensitive: { type: 'boolean', required: false },
      },
    };
  }
}
