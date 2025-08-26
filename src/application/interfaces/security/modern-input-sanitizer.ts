// Modern Input Sanitizer Interface
// Application layer security interface

import { SecurityValidation } from '../../../infrastructure/security/security-types.js';

export interface ModernInputSanitizerInterface {
  sanitize(input: string): SecurityValidation;
  validateAndSanitize(input: string, context?: Record<string, unknown>): Promise<SecurityValidation>;
  isSecure(input: string): boolean;
}

export class ModernInputSanitizer implements ModernInputSanitizerInterface {
  sanitize(input: string): SecurityValidation {
    // Basic sanitization implementation
    if (typeof input !== 'string') {
      return {
        isValid: false,
        reason: 'Input must be a string',
        riskLevel: 'high'
      };
    }

    // Remove potentially dangerous patterns
    const sanitized = input
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');

    return {
      isValid: true,
      sanitizedInput: sanitized,
      riskLevel: 'low'
    };
  }

  async validateAndSanitize(input: string, context?: Record<string, unknown>): Promise<SecurityValidation> {
    const result = this.sanitize(input);
    
    // Additional context-based validation could go here
    if (context && context.requireStrict) {
      // More strict validation for certain contexts
      if (input.includes('eval') || input.includes('Function')) {
        return {
          isValid: false,
          reason: 'Potentially dangerous code detected',
          riskLevel: 'high'
        };
      }
    }

    return result;
  }

  isSecure(input: string): boolean {
    const result = this.sanitize(input);
    return result.isValid && result.riskLevel !== 'high';
  }
}

export const modernInputSanitizer = new ModernInputSanitizer();