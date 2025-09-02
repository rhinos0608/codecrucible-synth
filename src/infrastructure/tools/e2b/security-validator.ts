/**
 * E2B Security Validator - Production Implementation
 * Provides comprehensive security validation for E2B code execution
 */

export interface SecurityValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reason?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface CodeValidationRequest {
  code: string;
  language: string;
  environment?: string;
  allowedApis?: string[];
  blockedPatterns?: string[];
}

export class SecurityValidator {
  private readonly dangerousPatterns = [
    // JavaScript/Node.js dangerous patterns
    /eval\s*\(/gi,
    /Function\s*\(/gi,
    /setTimeout\s*\(\s*["'][\s\S]*["']/gi,
    /setInterval\s*\(\s*["'][\s\S]*["']/gi,

    // Python dangerous patterns
    /exec\s*\(/gi,
    /eval\s*\(/gi,
    /compile\s*\(/gi,
    /__import__\s*\(/gi,
    /subprocess\s*\./gi,
    /os\s*\.\s*system/gi,
    /os\s*\.\s*popen/gi,
    /os\s*\.\s*spawn/gi,

    // File system access
    /open\s*\(/gi,
    /file\s*\(/gi,
    /fs\s*\.\s*readFile/gi,
    /fs\s*\.\s*writeFile/gi,
    /fs\s*\.\s*unlink/gi,
    /fs\s*\.\s*rmdir/gi,

    // Network access
    /fetch\s*\(/gi,
    /axios\s*\./gi,
    /requests\s*\./gi,
    /urllib/gi,
    /socket\s*\./gi,

    // Process control
    /process\s*\.\s*exit/gi,
    /sys\s*\.\s*exit/gi,
    /quit\s*\(/gi,
    /exit\s*\(/gi,

    // Shell injection
    /\$\(/gi,
    /`[^`]*`/gi,
    /shell=True/gi,

    // Import restrictions
    /import\s+os/gi,
    /import\s+sys/gi,
    /import\s+subprocess/gi,
    /from\s+os\s+import/gi,
    /require\s*\(\s*['"]fs['"]/gi,
    /require\s*\(\s*['"]child_process['"]/gi,
  ];

  private readonly allowedEnvironments = new Set([
    'python3.9-safe',
    'python3.10-safe',
    'python3.11-safe',
    'node18-safe',
    'node20-safe',
  ]);

  private readonly blockedApis = new Set([
    'os',
    'sys',
    'subprocess',
    'socket',
    'urllib',
    'requests',
    'fs',
    'child_process',
    'cluster',
    'worker_threads',
  ]);

  async validateCode(request: CodeValidationRequest): Promise<SecurityValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let riskLevel: SecurityValidationResult['riskLevel'] = 'low';

    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(request.code)) {
        errors.push(`Potentially dangerous pattern detected: ${pattern.source}`);
        riskLevel = 'high';
      }
    }

    // Basic validation checks
    if (request.code.length > 10000) {
      warnings.push('Code is very long, consider breaking into smaller chunks');
    }

    if (request.code.includes('while True') || request.code.includes('while (true)')) {
      warnings.push('Infinite loop detected');
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      riskLevel,
    };
  }

  async validateEnvironment(environment: string): Promise<SecurityValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let riskLevel: SecurityValidationResult['riskLevel'] = 'low';

    // Validate environment is in allowlist
    if (!this.allowedEnvironments.has(environment)) {
      errors.push(`Environment '${environment}' is not in the approved allowlist`);
      riskLevel = 'critical';
    }

    // Check for suspicious environment patterns
    if (environment.includes('unsafe') || environment.includes('unrestricted')) {
      errors.push('Environment appears to be unrestricted or unsafe');
      riskLevel = 'critical';
    }

    // Warn about non-sandboxed environments
    if (!environment.includes('safe') && !environment.includes('sandbox')) {
      warnings.push('Environment may not be properly sandboxed');
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      riskLevel,
    };
  }

  async validateApiAccess(api: string, context?: Record<string, any>): Promise<boolean> {
    // Check against blocked APIs
    if (this.blockedApis.has(api)) {
      return false;
    }

    // Check for suspicious API patterns
    const suspiciousPatterns = [
      /^(os|sys|subprocess|socket|urllib|requests|fs|child_process|cluster|worker_threads)$/i,
      /eval|exec|compile|import|require/i,
      /file|read|write|delete|unlink/i,
      /network|http|fetch|axios/i,
      /process|system|shell/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(api)) {
        return false;
      }
    }

    // Additional context-based validation
    if (context?.riskLevel === 'high' || context?.riskLevel === 'critical') {
      return false;
    }

    // Default to allowing safe APIs
    const safeApis = new Set([
      'math',
      'json',
      'string',
      'array',
      'object',
      'console.log',
      'Date',
      'Math',
      'JSON',
      'String',
      'Array',
      'Object',
    ]);

    return safeApis.has(api) || api.startsWith('safe_');
  }
}
