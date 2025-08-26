/**
 * Security Validator
 * Validates inputs and operations for security compliance
 */

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  validate: (input: any, context?: ValidationContext) => ValidationResult;
}

export interface ValidationContext {
  operation: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message?: string;
  details?: Record<string, any>;
  suggestedActions?: string[];
}

export interface SecurityConfig {
  enableSqlInjectionDetection: boolean;
  enableXssDetection: boolean;
  enablePathTraversalDetection: boolean;
  enableCommandInjectionDetection: boolean;
  maxInputLength: number;
  allowedFileExtensions: string[];
  blockedKeywords: string[];
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
}

export class SecurityValidator {
  private rules: Map<string, SecurityRule> = new Map();
  private config: SecurityConfig;
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      enableSqlInjectionDetection: true,
      enableXssDetection: true,
      enablePathTraversalDetection: true,
      enableCommandInjectionDetection: true,
      maxInputLength: 10000,
      allowedFileExtensions: ['.txt', '.json', '.md', '.js', '.ts', '.py', '.html', '.css'],
      blockedKeywords: ['password', 'secret', 'token', 'key', 'admin'],
      rateLimits: {
        requestsPerMinute: 60,
        requestsPerHour: 1000
      },
      ...config
    };

    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // SQL Injection Detection
    this.addRule({
      id: 'sql-injection',
      name: 'SQL Injection Detection',
      description: 'Detects potential SQL injection attempts',
      severity: 'critical',
      enabled: this.config.enableSqlInjectionDetection,
      validate: (input: any) => this.validateSqlInjection(input)
    });

    // XSS Detection
    this.addRule({
      id: 'xss-detection',
      name: 'XSS Detection',
      description: 'Detects potential cross-site scripting attempts',
      severity: 'high',
      enabled: this.config.enableXssDetection,
      validate: (input: any) => this.validateXss(input)
    });

    // Path Traversal Detection
    this.addRule({
      id: 'path-traversal',
      name: 'Path Traversal Detection',
      description: 'Detects directory traversal attempts',
      severity: 'high',
      enabled: this.config.enablePathTraversalDetection,
      validate: (input: any) => this.validatePathTraversal(input)
    });

    // Command Injection Detection
    this.addRule({
      id: 'command-injection',
      name: 'Command Injection Detection',
      description: 'Detects command injection attempts',
      severity: 'critical',
      enabled: this.config.enableCommandInjectionDetection,
      validate: (input: any) => this.validateCommandInjection(input)
    });

    // Input Length Validation
    this.addRule({
      id: 'input-length',
      name: 'Input Length Validation',
      description: 'Validates input length limits',
      severity: 'medium',
      enabled: true,
      validate: (input: any) => this.validateInputLength(input)
    });
  }

  addRule(rule: SecurityRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  updateRule(ruleId: string, updates: Partial<SecurityRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.set(ruleId, { ...rule, ...updates });
      return true;
    }
    return false;
  }

  enableRule(ruleId: string): boolean {
    return this.updateRule(ruleId, { enabled: true });
  }

  disableRule(ruleId: string): boolean {
    return this.updateRule(ruleId, { enabled: false });
  }

  validate(input: any, context?: ValidationContext): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    for (const rule of this.rules.values()) {
      if (rule.enabled) {
        try {
          const result = rule.validate(input, context);
          if (result) {
            results.push(result);
          }
        } catch (error) {
          results.push({
            valid: false,
            ruleId: rule.id,
            severity: 'medium',
            message: `Rule validation error: ${error}`,
            details: { error: String(error) }
          });
        }
      }
    }

    return results;
  }

  validateSafe(input: any, context?: ValidationContext): boolean {
    const results = this.validate(input, context);
    return results.every(result => result.valid);
  }

  getSecurityReport(input: any, context?: ValidationContext): {
    safe: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    violations: ValidationResult[];
    recommendations: string[];
  } {
    const violations = this.validate(input, context).filter(r => !r.valid);
    const riskLevel = this.calculateRiskLevel(violations);
    const recommendations = this.generateRecommendations(violations);

    return {
      safe: violations.length === 0,
      riskLevel,
      violations,
      recommendations
    };
  }

  private calculateRiskLevel(violations: ValidationResult[]): 'low' | 'medium' | 'high' | 'critical' {
    if (violations.length === 0) return 'low';
    
    const hasCritical = violations.some(v => v.severity === 'critical');
    const hasHigh = violations.some(v => v.severity === 'high');
    const hasMedium = violations.some(v => v.severity === 'medium');

    if (hasCritical) return 'critical';
    if (hasHigh) return 'high';
    if (hasMedium) return 'medium';
    return 'low';
  }

  private generateRecommendations(violations: ValidationResult[]): string[] {
    const recommendations = new Set<string>();
    
    for (const violation of violations) {
      if (violation.suggestedActions) {
        violation.suggestedActions.forEach(action => recommendations.add(action));
      }
    }

    // Add general recommendations
    if (violations.length > 0) {
      recommendations.add('Review and sanitize all input data');
      recommendations.add('Implement proper input validation');
      recommendations.add('Use parameterized queries for database operations');
    }

    return Array.from(recommendations);
  }

  // Specific validation methods
  private validateSqlInjection(input: any): ValidationResult {
    const text = String(input).toLowerCase();
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
      /(;|\-\-|\/\*|\*\/)/,
      /(\b(or|and)\s+\w+\s*=\s*\w+)/i,
      /(1\s*=\s*1|1\s*=\s*0)/
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(text)) {
        return {
          valid: false,
          ruleId: 'sql-injection',
          severity: 'critical',
          message: 'Potential SQL injection detected',
          suggestedActions: ['Use parameterized queries', 'Sanitize input']
        };
      }
    }

    return {
      valid: true,
      ruleId: 'sql-injection',
      severity: 'critical'
    };
  }

  private validateXss(input: any): ValidationResult {
    const text = String(input).toLowerCase();
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
      /javascript:/i,
      /on\w+\s*=\s*["\']?[^"\'>]*["\']?/i,
      /<iframe\b[^>]*>/i,
      /<object\b[^>]*>/i,
      /<embed\b[^>]*>/i
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(text)) {
        return {
          valid: false,
          ruleId: 'xss-detection',
          severity: 'high',
          message: 'Potential XSS attack detected',
          suggestedActions: ['Encode HTML entities', 'Use content security policy']
        };
      }
    }

    return {
      valid: true,
      ruleId: 'xss-detection',
      severity: 'high'
    };
  }

  private validatePathTraversal(input: any): ValidationResult {
    const text = String(input);
    const pathPatterns = [
      /\.\.\//,
      /\.\.\\\\/,
      /\/etc\/passwd/i,
      /\/proc\/self\/environ/i,
      /c:\\\\windows\\\\system32/i
    ];

    for (const pattern of pathPatterns) {
      if (pattern.test(text)) {
        return {
          valid: false,
          ruleId: 'path-traversal',
          severity: 'high',
          message: 'Potential path traversal detected',
          suggestedActions: ['Validate file paths', 'Use absolute paths', 'Implement access controls']
        };
      }
    }

    return {
      valid: true,
      ruleId: 'path-traversal',
      severity: 'high'
    };
  }

  private validateCommandInjection(input: any): ValidationResult {
    const text = String(input);
    const commandPatterns = [
      /[;&|`$(){}]/,
      /\b(cat|ls|ps|kill|rm|mv|cp|chmod|chown)\b/i,
      /\b(powershell|cmd|bash|sh)\b/i
    ];

    for (const pattern of commandPatterns) {
      if (pattern.test(text)) {
        return {
          valid: false,
          ruleId: 'command-injection',
          severity: 'critical',
          message: 'Potential command injection detected',
          suggestedActions: ['Sanitize input', 'Use safe command execution', 'Validate command parameters']
        };
      }
    }

    return {
      valid: true,
      ruleId: 'command-injection',
      severity: 'critical'
    };
  }

  private validateInputLength(input: any): ValidationResult {
    const text = String(input);
    const maxLength = this.config.maxInputLength;

    if (text.length > maxLength) {
      return {
        valid: false,
        ruleId: 'input-length',
        severity: 'medium',
        message: `Input exceeds maximum length of ${maxLength} characters`,
        details: { inputLength: text.length, maxLength },
        suggestedActions: ['Reduce input size', 'Use pagination for large data']
      };
    }

    return {
      valid: true,
      ruleId: 'input-length',
      severity: 'medium'
    };
  }

  updateConfig(updates: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...updates };
    // Reinitialize rules with new config
    this.rules.clear();
    this.initializeDefaultRules();
  }

  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  getRules(): SecurityRule[] {
    return Array.from(this.rules.values());
  }
}

export default SecurityValidator;