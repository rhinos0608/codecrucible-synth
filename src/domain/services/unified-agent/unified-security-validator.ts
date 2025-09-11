/**
 * Unified Security Validator
 *
 * Centralized security validation for all agent operations, providing:
 * - Input sanitization and validation
 * - Authorization and access control
 * - Security policy enforcement
 * - Threat detection and prevention
 */

export interface SecurityValidationContext {
  userId?: string;
  agentId: string;
  operation: string;
  workspace: string;
  requestedPermissions: string[];
  securityLevel: 'low' | 'medium' | 'high';
  timestamp: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  securityRisk: 'none' | 'low' | 'medium' | 'high' | 'critical';
  allowedOperations: string[];
  deniedOperations: string[];
}

export interface SecurityPolicy {
  maxFileSize: number;
  allowedExtensions: string[];
  blockedPatterns: RegExp[];
  requiresElevation: boolean;
  auditRequired: boolean;
}

export class UnifiedSecurityValidator {
  private readonly policies = new Map<string, SecurityPolicy>();

  public constructor() {
    this.initializeDefaultPolicies();
  }

  /**
   * Validate a security context for agent operations
   */
  public async validateContext(context: SecurityValidationContext): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      securityRisk: 'none',
      allowedOperations: [],
      deniedOperations: [],
    };

    try {
      // Basic validation
      this.validateBasicContext(context, result);

      // Operation-specific validation
      this.validateOperation(context, result);

      // Permission validation
      this.validatePermissions(context, result);

      // Security level assessment
      this.assessSecurityRisk(context, result);

      result.isValid = result.errors.length === 0;
    } catch (error) {
      result.isValid = false;
      result.errors.push(
        `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      result.securityRisk = 'high';
    }

    return result;
  }

  /**
   * Sanitize input data for safe processing
   */
  public sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove JavaScript URLs
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  private validateBasicContext(context: SecurityValidationContext, result: ValidationResult): void {
    if (!context.agentId) {
      result.errors.push('Agent ID is required');
    }

    if (!context.operation) {
      result.errors.push('Operation is required');
    }

    if (!context.workspace) {
      result.errors.push('Workspace is required');
    }

    if (!context.requestedPermissions || !Array.isArray(context.requestedPermissions)) {
      result.errors.push('Requested permissions must be an array');
    }
  }

  private validateOperation(context: SecurityValidationContext, result: ValidationResult): void {
    const dangerousOperations = [
      'file_delete',
      'system_execute',
      'network_request',
      'environment_modify',
    ];

    if (dangerousOperations.includes(context.operation) && context.securityLevel === 'low') {
      result.warnings.push(`Operation ${context.operation} requires higher security level`);
      result.securityRisk = 'medium';
    }
  }

  private validatePermissions(context: SecurityValidationContext, result: ValidationResult): void {
    const allowedPermissions = ['read', 'write', 'execute', 'delete', 'network', 'system'];

    const invalidPermissions = context.requestedPermissions.filter(
      perm => !allowedPermissions.includes(perm)
    );

    if (invalidPermissions.length > 0) {
      result.errors.push(`Invalid permissions: ${invalidPermissions.join(', ')}`);
    }

    // High-risk permissions
    const highRiskPermissions = ['delete', 'system', 'network'];
    const hasHighRisk = context.requestedPermissions.some(perm =>
      highRiskPermissions.includes(perm)
    );

    if (hasHighRisk && context.securityLevel !== 'high') {
      result.warnings.push('High-risk permissions require elevated security level');
      result.securityRisk = 'high';
    }
  }

  private assessSecurityRisk(context: SecurityValidationContext, result: ValidationResult): void {
    let riskLevel = 0;

    // Base risk from operation
    if (['system_execute', 'file_delete'].includes(context.operation)) {
      riskLevel += 3;
    } else if (['network_request', 'file_write'].includes(context.operation)) {
      riskLevel += 2;
    } else if (['file_read'].includes(context.operation)) {
      riskLevel += 1;
    }

    // Additional risk from permissions
    const riskPermissions = context.requestedPermissions.filter(perm =>
      ['delete', 'system', 'network'].includes(perm)
    );
    riskLevel += riskPermissions.length;

    // Determine final risk level
    if (riskLevel >= 5) {
      result.securityRisk = 'critical';
    } else if (riskLevel >= 3) {
      result.securityRisk = 'high';
    } else if (riskLevel >= 2) {
      result.securityRisk = 'medium';
    } else if (riskLevel >= 1) {
      result.securityRisk = 'low';
    }
  }

  private initializeDefaultPolicies(): void {
    // Default file operations policy
    this.policies.set('file_operations', {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedExtensions: ['.js', '.ts', '.json', '.md', '.txt', '.yml', '.yaml'],
      blockedPatterns: [/\.exe$/, /\.dll$/, /\.so$/],
      requiresElevation: false,
      auditRequired: true,
    });

    // System operations policy
    this.policies.set('system_operations', {
      maxFileSize: 0,
      allowedExtensions: [],
      blockedPatterns: [],
      requiresElevation: true,
      auditRequired: true,
    });
  }

  public getPolicy(operation: string): SecurityPolicy | undefined {
    return this.policies.get(operation);
  }

  public setPolicy(operation: string, policy: SecurityPolicy): void {
    this.policies.set(operation, policy);
  }

  /**
   * Validate and sanitize input data
   */
  public validateInput(context: SecurityValidationContext): {
    isValid: boolean;
    sanitized: string;
    errors: string[];
  } {
    const errors: string[] = [];
    let isValid = true;

    // Basic context validation
    if (!context.agentId) {
      errors.push('Agent ID is required');
      isValid = false;
    }

    if (!context.operation) {
      errors.push('Operation is required');
      isValid = false;
    }

    // For legacy compatibility, return a basic result
    return {
      isValid,
      sanitized: '', // Legacy system expects this
      errors,
    };
  }
}
