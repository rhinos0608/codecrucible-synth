/**
 * Enterprise Security Framework - Claude Code Pattern Implementation
 * Defensive security implementation following enterprise standards
 * Provides comprehensive multi-layer security validation for all agent actions
 */

import { logger } from '../logger.js';

export interface AgentAction {
  type: 'code_generation' | 'file_access' | 'tool_usage' | 'network_access' | 'command_execution';
  agentId: string;
  payload: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SecurityContext {
  userId?: string;
  sessionId: string;
  permissions: string[];
  environment: 'development' | 'testing' | 'production';
  riskProfile: 'low' | 'medium' | 'high';
}

export interface SecurityViolation {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediation: string;
  patterns?: string[];
}

export interface ValidationResult {
  passed: boolean;
  violation?: SecurityViolation;
}

export interface SecurityValidation {
  allowed: boolean;
  violations: SecurityViolation[];
  mitigations: string[];
  riskScore: number;
  auditTrail: AuditEntry;
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  agentId: string;
  action: string;
  allowed: boolean;
  riskScore: number;
  violations: SecurityViolation[];
  context: SecurityContext;
}

export interface ThreatAssessment {
  safe: boolean;
  threats: SecurityViolation[];
  riskScore: number;
}

export interface PolicyCompliance {
  compliant: boolean;
  violations: SecurityViolation[];
}

export class EnterpriseSecurityFramework {
  private policyEngine: PolicyEngine;
  private auditLogger: AuditLogger;
  private threatDetector: ThreatDetector;
  private maliciousPatterns!: Set<string>;

  constructor() {
    this.policyEngine = new PolicyEngine();
    this.auditLogger = new AuditLogger();
    this.threatDetector = new ThreatDetector();
    this.initializeMaliciousPatterns();
  }

  async validateAgentAction(
    agentId: string,
    action: AgentAction,
    context: SecurityContext
  ): Promise<SecurityValidation> {
    // Multi-layer validation
    const validations = await Promise.all([
      this.validateDataAccess(action, context),
      this.validateToolUsage(action, context),
      this.validateCodeGeneration(action, context),
      this.validateNetworkAccess(action, context),
      this.validateResourceLimits(action, context),
    ]);

    // Threat detection
    const threatAssessment = await this.threatDetector.assess(action, context);

    // Policy compliance check
    const policyCompliance = await this.policyEngine.evaluate(action, context);

    const result: SecurityValidation = {
      allowed:
        validations.every(v => v.passed) && threatAssessment.safe && policyCompliance.compliant,
      violations: [
        ...validations.filter(v => !v.passed).map(v => v.violation!),
        ...threatAssessment.threats,
        ...policyCompliance.violations,
      ],
      mitigations: this.generateMitigations(validations, threatAssessment, policyCompliance),
      riskScore: this.calculateRiskScore(validations, threatAssessment, policyCompliance),
      auditTrail: await this.createAuditEntry(agentId, action, validations, context),
    };

    // Log for compliance
    await this.auditLogger.log({
      agentId,
      action: action.type,
      allowed: result.allowed,
      riskScore: result.riskScore,
      violations: result.violations,
      timestamp: new Date(),
      context,
    });

    return result;
  }

  private async validateCodeGeneration(
    action: AgentAction,
    context: SecurityContext
  ): Promise<ValidationResult> {
    if (action.type !== 'code_generation') {
      return { passed: true };
    }

    const codeAnalysis = await this.analyzeGeneratedCode(action.payload.code);

    return {
      passed: !codeAnalysis.containsMaliciousPatterns,
      violation: codeAnalysis.containsMaliciousPatterns
        ? {
            type: 'malicious_code_detected',
            severity: codeAnalysis.severity,
            patterns: codeAnalysis.maliciousPatterns,
            description: 'Generated code contains potentially malicious patterns',
            remediation: 'Code generation blocked due to potential security risks',
          }
        : undefined,
    };
  }

  private async validateDataAccess(
    action: AgentAction,
    context: SecurityContext
  ): Promise<ValidationResult> {
    if (action.type !== 'file_access') {
      return { passed: true };
    }

    const path = action.payload.path;

    // Check for sensitive file access
    const sensitivePatterns = [
      '/etc/passwd',
      '/etc/shadow',
      '/.env',
      '/secrets/',
      'private_key',
      'id_rsa',
      '.ssh/',
      'api_key',
      'password',
    ];

    const isSensitive = sensitivePatterns.some(pattern =>
      path.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isSensitive && context.riskProfile !== 'low') {
      return {
        passed: false,
        violation: {
          type: 'sensitive_file_access',
          severity: 'high',
          description: `Attempted access to sensitive file: ${path}`,
          remediation: 'Access to sensitive files requires elevated permissions',
        },
      };
    }

    return { passed: true };
  }

  private async validateToolUsage(
    action: AgentAction,
    context: SecurityContext
  ): Promise<ValidationResult> {
    if (action.type !== 'tool_usage') {
      return { passed: true };
    }

    const toolName = action.payload.toolName;
    const args = action.payload.args || [];

    // Check for dangerous tool combinations
    const dangerousTools = ['rm', 'del', 'sudo', 'chmod', 'chown'];
    const dangerousArgs = ['-rf', '--force', '777', '+x'];

    const isDangerousTool = dangerousTools.includes(toolName);
    const hasDangerousArgs = args.some((arg: string) => dangerousArgs.includes(arg));

    if (isDangerousTool || hasDangerousArgs) {
      return {
        passed: false,
        violation: {
          type: 'dangerous_tool_usage',
          severity: 'critical',
          description: `Dangerous tool usage detected: ${toolName} ${args.join(' ')}`,
          remediation: 'Use of potentially destructive tools is prohibited',
        },
      };
    }

    return { passed: true };
  }

  private async validateNetworkAccess(
    action: AgentAction,
    context: SecurityContext
  ): Promise<ValidationResult> {
    if (action.type !== 'network_access') {
      return { passed: true };
    }

    const url = action.payload.url;

    // Block access to internal/localhost unless explicitly allowed
    const isInternal = ['localhost', '127.0.0.1', '0.0.0.0', '192.168.'].some(pattern =>
      url.includes(pattern)
    );

    if (isInternal && !context.permissions.includes('internal_network_access')) {
      return {
        passed: false,
        violation: {
          type: 'unauthorized_network_access',
          severity: 'medium',
          description: `Unauthorized access to internal network: ${url}`,
          remediation: 'Internal network access requires specific permissions',
        },
      };
    }

    return { passed: true };
  }

  private async validateResourceLimits(
    action: AgentAction,
    context: SecurityContext
  ): Promise<ValidationResult> {
    // Check memory/CPU limits based on action type
    const memoryLimit = context.environment === 'production' ? 512 : 1024; // MB
    const cpuLimit = context.environment === 'production' ? 50 : 80; // %

    // Simplified resource check - in production would integrate with actual monitoring
    const estimatedMemory = this.estimateMemoryUsage(action);
    const estimatedCpu = this.estimateCpuUsage(action);

    if (estimatedMemory > memoryLimit) {
      return {
        passed: false,
        violation: {
          type: 'memory_limit_exceeded',
          severity: 'medium',
          description: `Action would exceed memory limit: ${estimatedMemory}MB > ${memoryLimit}MB`,
          remediation: 'Reduce memory usage or request elevated resource limits',
        },
      };
    }

    if (estimatedCpu > cpuLimit) {
      return {
        passed: false,
        violation: {
          type: 'cpu_limit_exceeded',
          severity: 'medium',
          description: `Action would exceed CPU limit: ${estimatedCpu}% > ${cpuLimit}%`,
          remediation: 'Reduce CPU usage or request elevated resource limits',
        },
      };
    }

    return { passed: true };
  }

  private async analyzeGeneratedCode(code: string): Promise<{
    containsMaliciousPatterns: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    maliciousPatterns: string[];
  }> {
    const detectedPatterns: string[] = [];
    let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    for (const pattern of this.maliciousPatterns) {
      if (code.toLowerCase().includes(pattern.toLowerCase())) {
        detectedPatterns.push(pattern);

        // Determine severity based on pattern
        if (['eval(', 'exec(', 'system(', 'shell_exec'].includes(pattern)) {
          maxSeverity = 'critical';
        } else if (['rm -rf', 'del /f', 'format c:'].includes(pattern)) {
          maxSeverity = 'critical';
        } else if (['password', 'secret', 'api_key'].includes(pattern)) {
          maxSeverity = 'high';
        } else {
          maxSeverity = maxSeverity === 'low' ? 'medium' : maxSeverity;
        }
      }
    }

    return {
      containsMaliciousPatterns: detectedPatterns.length > 0,
      severity: maxSeverity,
      maliciousPatterns: detectedPatterns,
    };
  }

  private initializeMaliciousPatterns(): void {
    this.maliciousPatterns = new Set([
      // Code execution patterns
      'eval(',
      'exec(',
      'system(',
      'shell_exec',
      'passthru',
      'proc_open',
      'popen',
      'file_get_contents',

      // Destructive commands
      'rm -rf',
      'del /f',
      'format c:',
      'mkfs',
      'dd if=',
      'sudo rm',
      'sudo del',
      '> /dev/null',

      // Network/security patterns
      'curl -X POST',
      'wget -O',
      'nc -l',
      'netcat',
      'reverse shell',
      'bind shell',
      'backdoor',

      // Sensitive data patterns
      'password',
      'passwd',
      'secret',
      'api_key',
      'private_key',
      'access_token',
      'auth_token',
      'session_id',

      // SQL injection patterns
      'DROP TABLE',
      'DELETE FROM',
      'UNION SELECT',
      'OR 1=1',
      'AND 1=1',
      "' OR '",

      // Path traversal
      '../',
      '..\\',
      '/etc/passwd',
      '/etc/shadow',
      'C:\\Windows\\System32',
    ]);
  }

  private estimateMemoryUsage(action: AgentAction): number {
    // Simplified estimation - in production would use actual metrics
    const baseUsage = 50; // MB

    switch (action.type) {
      case 'code_generation':
        return baseUsage + (action.payload.code?.length || 0) / 1000;
      case 'file_access':
        return baseUsage + 10;
      case 'tool_usage':
        return baseUsage + 20;
      default:
        return baseUsage;
    }
  }

  private estimateCpuUsage(action: AgentAction): number {
    // Simplified estimation - in production would use actual metrics
    const baseUsage = 10; // %

    switch (action.type) {
      case 'code_generation':
        return baseUsage + 30;
      case 'file_access':
        return baseUsage + 5;
      case 'tool_usage':
        return baseUsage + 15;
      default:
        return baseUsage;
    }
  }

  private generateMitigations(
    validations: ValidationResult[],
    threatAssessment: ThreatAssessment,
    policyCompliance: PolicyCompliance
  ): string[] {
    const mitigations: string[] = [];

    // Add mitigations based on validation failures
    validations.forEach(validation => {
      if (!validation.passed && validation.violation) {
        mitigations.push(validation.violation.remediation);
      }
    });

    // Add threat-specific mitigations
    if (!threatAssessment.safe) {
      mitigations.push('Enhanced monitoring enabled due to threat detection');
    }

    // Add policy-specific mitigations
    if (!policyCompliance.compliant) {
      mitigations.push('Action requires policy review and approval');
    }

    return mitigations;
  }

  private calculateRiskScore(
    validations: ValidationResult[],
    threatAssessment: ThreatAssessment,
    policyCompliance: PolicyCompliance
  ): number {
    let score = 0;

    // Add points for each validation failure
    validations.forEach(validation => {
      if (!validation.passed && validation.violation) {
        switch (validation.violation.severity) {
          case 'critical':
            score += 40;
            break;
          case 'high':
            score += 25;
            break;
          case 'medium':
            score += 15;
            break;
          case 'low':
            score += 5;
            break;
        }
      }
    });

    // Add threat assessment score
    score += threatAssessment.riskScore;

    // Add policy violations
    if (!policyCompliance.compliant) {
      score += 20;
    }

    return Math.min(score, 100); // Cap at 100
  }

  private async createAuditEntry(
    agentId: string,
    action: AgentAction,
    validations: ValidationResult[],
    context: SecurityContext
  ): Promise<AuditEntry> {
    return {
      id: this.generateAuditId(),
      timestamp: new Date(),
      agentId,
      action: action.type,
      allowed: validations.every(v => v.passed),
      riskScore: this.calculateRiskScore(
        validations,
        { safe: true, threats: [], riskScore: 0 },
        { compliant: true, violations: [] }
      ),
      violations: validations.filter(v => !v.passed).map(v => v.violation!),
      context,
    };
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Supporting classes for the security framework
class PolicyEngine {
  async evaluate(action: AgentAction, context: SecurityContext): Promise<PolicyCompliance> {
    // Simplified policy evaluation - in production would load from external policy store
    const violations: SecurityViolation[] = [];

    // Example policy: No code generation in production without review
    if (action.type === 'code_generation' && context.environment === 'production') {
      if (!context.permissions.includes('production_code_generation')) {
        violations.push({
          type: 'policy_violation',
          severity: 'high',
          description: 'Code generation in production requires special permissions',
          remediation: 'Request production deployment permissions',
        });
      }
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }
}

class AuditLogger {
  async log(entry: any): Promise<void> {
    // In production, this would write to a secure audit log
    logger.info('Security audit entry', entry);
  }
}

class ThreatDetector {
  async assess(action: AgentAction, context: SecurityContext): Promise<ThreatAssessment> {
    // Simplified threat detection - in production would use ML models
    const threats: SecurityViolation[] = [];
    let riskScore = 0;

    // Check for suspicious patterns
    if (action.type === 'code_generation') {
      const code = action.payload.code || '';

      // Look for obfuscation patterns
      if (code.includes('base64') && code.includes('decode')) {
        threats.push({
          type: 'obfuscation_detected',
          severity: 'medium',
          description: 'Potential code obfuscation detected',
          remediation: 'Review code for legitimate base64 usage',
        });
        riskScore += 15;
      }

      // Look for external communications
      if (code.includes('http://') || code.includes('https://')) {
        riskScore += 5;
      }
    }

    return {
      safe: threats.length === 0,
      threats,
      riskScore,
    };
  }
}
