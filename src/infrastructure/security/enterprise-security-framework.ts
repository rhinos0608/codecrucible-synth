/**
 * Enterprise Security Framework - Claude Code Pattern Implementation
 * Defensive security implementation following enterprise standards
 * Provides comprehensive multi-layer security validation for all agent actions
 */

import { logger } from '../logger.js';
import * as ts from 'typescript';
import { createHash } from 'crypto';

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
  confidence?: number; // 0-100 confidence score
  location?: {
    line: number;
    column: number;
    length: number;
  };
  context?: string; // surrounding code context
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
  analysisMethod?: 'string_matching' | 'ast_analysis' | 'hybrid';
  confidence?: number;
}

export interface PolicyCompliance {
  compliant: boolean;
  violations: SecurityViolation[];
}

// AST-based Security Analysis Interfaces
export interface ASTSecurityRule {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  nodeTypes: ts.SyntaxKind[];
  check: (node: ts.Node, sourceFile: ts.SourceFile) => SecurityViolation | null;
  languages: ('typescript' | 'javascript' | 'python')[];
}

export interface ASTAnalysisResult {
  violations: SecurityViolation[];
  riskScore: number;
  confidence: number;
  analysisTime: number;
  language: string;
  nodeCount: number;
  cacheHit: boolean;
}

export interface ASTCacheEntry {
  hash: string;
  result: ASTAnalysisResult;
  timestamp: number;
  language: string;
}

export class EnterpriseSecurityFramework {
  private policyEngine: PolicyEngine;
  private auditLogger: AuditLogger;
  private threatDetector: ThreatDetector;
  private maliciousPatterns!: Set<string>;
  private astAnalyzer: ASTSecurityAnalyzer;
  private astCache: Map<string, ASTCacheEntry>;
  private readonly cacheMaxAge = 5 * 60 * 1000; // 5 minutes
  private readonly cacheMaxSize = 1000;

  constructor() {
    this.policyEngine = new PolicyEngine();
    this.auditLogger = new AuditLogger();
    this.threatDetector = new ThreatDetector();
    this.astAnalyzer = new ASTSecurityAnalyzer();
    this.astCache = new Map();
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

    const codeAnalysis = await this.analyzeGeneratedCode(
      action.payload.code, 
      action.payload.language
    );

    // Enhanced validation with confidence scoring
    const highConfidenceThreshold = 80;
    const isHighConfidence = codeAnalysis.confidence >= highConfidenceThreshold;
    
    if (codeAnalysis.containsMaliciousPatterns) {
      // Get the highest severity violation for the main response
      const primaryViolation = codeAnalysis.violations.reduce((max, current) => {
        const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
        return severityOrder[current.severity] > severityOrder[max.severity] ? current : max;
      }, codeAnalysis.violations[0]);

      return {
        passed: false,
        violation: {
          type: 'malicious_code_detected',
          severity: codeAnalysis.severity,
          patterns: codeAnalysis.maliciousPatterns,
          description: `Generated code contains potentially malicious patterns (${codeAnalysis.analysisMethod}, confidence: ${codeAnalysis.confidence}%)`,
          remediation: isHighConfidence 
            ? 'Code generation blocked due to high-confidence security risks'
            : 'Code generation flagged for manual review due to potential security risks',
          confidence: codeAnalysis.confidence,
          location: primaryViolation.location,
          context: primaryViolation.context
        },
      };
    }

    return { passed: true };
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

  private async analyzeGeneratedCode(code: string, language?: string): Promise<{
    containsMaliciousPatterns: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    maliciousPatterns: string[];
    confidence: number;
    analysisMethod: 'string_matching' | 'ast_analysis' | 'hybrid';
    violations: SecurityViolation[];
  }> {
    const startTime = Date.now();
    
    // Determine language if not provided
    const detectedLanguage = language || this.detectLanguage(code);
    
    // Check cache first
    const cacheKey = this.generateCacheKey(code, detectedLanguage);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return this.convertCacheToResult(cached);
    }
    
    // Perform AST-based analysis for supported languages
    if (['typescript', 'javascript'].includes(detectedLanguage)) {
      try {
        const astResult = await this.astAnalyzer.analyzeCode(code, detectedLanguage as 'typescript' | 'javascript');
        const analysis = {
          containsMaliciousPatterns: astResult.violations.length > 0,
          severity: this.calculateMaxSeverity(astResult.violations),
          maliciousPatterns: astResult.violations.map((v: SecurityViolation) => v.type),
          confidence: astResult.confidence,
          analysisMethod: 'ast_analysis' as const,
          violations: astResult.violations
        };
        
        // Cache the result
        this.addToCache(cacheKey, astResult, detectedLanguage);
        
        return analysis;
      } catch (error) {
        logger.warn('AST analysis failed, falling back to string matching:', error);
        // Fall back to string matching
      }
    }
    
    // Fallback to enhanced string matching with better pattern detection
    const stringAnalysis = await this.performEnhancedStringMatching(code);
    
    return {
      ...stringAnalysis,
      analysisMethod: 'string_matching' as const,
      confidence: 60, // Lower confidence for string matching
      violations: stringAnalysis.violations
    };
  }
  
  private detectLanguage(code: string): string {
    // Simple language detection based on syntax patterns
    if (code.includes('function') && (code.includes('=>') || code.includes('const ') || code.includes('let '))) {
      return code.includes('interface') || code.includes(': ') ? 'typescript' : 'javascript';
    }
    if (code.includes('def ') || code.includes('import ') || code.includes('from ')) {
      return 'python';
    }
    return 'javascript'; // default
  }
  
  private generateCacheKey(code: string, language: string): string {
    return createHash('sha256').update(`${code}:${language}`).digest('hex');
  }
  
  private getFromCache(key: string): ASTCacheEntry | null {
    const entry = this.astCache.get(key);
    if (!entry) return null;
    
    // Check if cache entry is expired
    if (Date.now() - entry.timestamp > this.cacheMaxAge) {
      this.astCache.delete(key);
      return null;
    }
    
    return entry;
  }
  
  private addToCache(key: string, result: ASTAnalysisResult, language: string): void {
    // Clean old entries if cache is full
    if (this.astCache.size >= this.cacheMaxSize) {
      const oldestKey = this.astCache.keys().next().value;
      this.astCache.delete(oldestKey);
    }
    
    this.astCache.set(key, {
      hash: key,
      result: { ...result, cacheHit: false },
      timestamp: Date.now(),
      language
    });
  }
  
  private convertCacheToResult(cached: ASTCacheEntry): {
    containsMaliciousPatterns: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    maliciousPatterns: string[];
    confidence: number;
    analysisMethod: 'string_matching' | 'ast_analysis' | 'hybrid';
    violations: SecurityViolation[];
  } {
    const result = cached.result;
    return {
      containsMaliciousPatterns: result.violations.length > 0,
      severity: this.calculateMaxSeverity(result.violations),
      maliciousPatterns: result.violations.map((v: SecurityViolation) => v.type),
      confidence: result.confidence,
      analysisMethod: 'ast_analysis',
      violations: result.violations
    };
  }
  
  private calculateMaxSeverity(violations: SecurityViolation[]): 'low' | 'medium' | 'high' | 'critical' {
    if (violations.length === 0) return 'low';
    
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    const maxSeverity = violations.reduce((max, violation) => {
      return severityOrder[violation.severity] > severityOrder[max] ? violation.severity : max;
    }, 'low' as 'low' | 'medium' | 'high' | 'critical');
    
    return maxSeverity;
  }
  
  private async performEnhancedStringMatching(code: string): Promise<{
    containsMaliciousPatterns: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    maliciousPatterns: string[];
    violations: SecurityViolation[];
  }> {
    const violations: SecurityViolation[] = [];
    const detectedPatterns: string[] = [];
    
    // Enhanced pattern matching with context awareness
    for (const pattern of this.maliciousPatterns) {
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = [...code.matchAll(regex)];
      
      for (const match of matches) {
        // Skip if pattern is in comments or strings
        if (this.isInCommentOrString(code, match.index!)) {
          continue;
        }
        
        detectedPatterns.push(pattern);
        violations.push({
          type: `malicious_pattern_${pattern}`,
          severity: this.getPatternSeverity(pattern),
          description: `Detected potentially malicious pattern: ${pattern}`,
          remediation: `Review and validate the use of '${pattern}' in the code`,
          patterns: [pattern],
          confidence: 70,
          location: this.getLocationInfo(code, match.index!)
        });
      }
    }
    
    return {
      containsMaliciousPatterns: violations.length > 0,
      severity: this.calculateMaxSeverity(violations),
      maliciousPatterns: detectedPatterns,
      violations
    };
  }
  
  private isInCommentOrString(code: string, index: number): boolean {
    // Simple check for comments and strings
    const beforeIndex = code.substring(0, index);
    const lines = beforeIndex.split('\n');
    const currentLine = lines[lines.length - 1];
    
    // Check for single-line comments
    const commentIndex = currentLine.indexOf('//');
    if (commentIndex !== -1 && commentIndex < currentLine.length - beforeIndex.length + index) {
      return true;
    }
    
    // Check for strings (basic check)
    const singleQuotes = (beforeIndex.match(/'/g) || []).length;
    const doubleQuotes = (beforeIndex.match(/"/g) || []).length;
    const backticks = (beforeIndex.match(/`/g) || []).length;
    
    return singleQuotes % 2 === 1 || doubleQuotes % 2 === 1 || backticks % 2 === 1;
  }
  
  private getLocationInfo(code: string, index: number): { line: number; column: number; length: number } {
    const lines = code.substring(0, index).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
      length: 0 // Would be calculated based on pattern length
    };
  }
  
  private getPatternSeverity(pattern: string): 'low' | 'medium' | 'high' | 'critical' {
    if (['eval(', 'exec(', 'system(', 'shell_exec', 'rm -rf', 'del /f', 'format c:'].includes(pattern)) {
      return 'critical';
    } else if (['password', 'secret', 'api_key', 'DROP TABLE', 'DELETE FROM'].includes(pattern)) {
      return 'high';
    } else if (['curl -X POST', 'wget -O', '../', '..\\'].includes(pattern)) {
      return 'medium';
    }
    return 'low';
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
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// AST-based Security Analysis System
class ASTSecurityAnalyzer {
  private securityRules: ASTSecurityRule[];

  constructor() {
    this.securityRules = this.initializeSecurityRules();
  }

  async analyzeCode(code: string, language: 'typescript' | 'javascript'): Promise<ASTAnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Parse code into AST
      const sourceFile = this.parseCode(code, language);
      const violations: SecurityViolation[] = [];
      let nodeCount = 0;

      // Traverse AST and apply security rules
      const visitNode = (node: ts.Node) => {
        nodeCount++;
        
        // Apply applicable rules to this node
        for (const rule of this.securityRules) {
          if (rule.languages.includes(language) && rule.nodeTypes.includes(node.kind)) {
            const violation = rule.check(node, sourceFile);
            if (violation) {
              violations.push({
                ...violation,
                location: this.getNodeLocation(node, sourceFile),
                context: this.getNodeContext(node, sourceFile)
              });
            }
          }
        }
        
        ts.forEachChild(node, visitNode);
      };

      visitNode(sourceFile);

      const analysisTime = Date.now() - startTime;
      const confidence = this.calculateConfidence(violations, nodeCount, analysisTime);
      const riskScore = this.calculateRiskScore(violations);

      return {
        violations,
        riskScore,
        confidence,
        analysisTime,
        language,
        nodeCount,
        cacheHit: false
      };
    } catch (error) {
      logger.error('AST analysis failed:', error);
      throw new Error(`AST parsing failed: ${error.message}`);
    }
  }

  private parseCode(code: string, language: 'typescript' | 'javascript'): ts.SourceFile {
    const scriptKind = language === 'typescript' ? ts.ScriptKind.TS : ts.ScriptKind.JS;
    
    return ts.createSourceFile(
      'security-analysis.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      scriptKind
    );
  }

  private initializeSecurityRules(): ASTSecurityRule[] {
    return [
      // Rule 1: Detect eval() calls
      {
        id: 'detect-eval-calls',
        name: 'Eval Function Detection',
        description: 'Detects potentially dangerous eval() function calls',
        severity: 'critical',
        nodeTypes: [ts.SyntaxKind.CallExpression],
        languages: ['typescript', 'javascript'],
        check: (node: ts.Node, sourceFile: ts.SourceFile) => {
          const callExpr = node as ts.CallExpression;
          if (ts.isIdentifier(callExpr.expression) && callExpr.expression.text === 'eval') {
            return {
              type: 'dangerous_eval_call',
              severity: 'critical' as const,
              description: 'Direct eval() call detected - potential code injection vulnerability',
              remediation: 'Replace eval() with safer alternatives like JSON.parse() or function constructors',
              confidence: 95
            };
          }
          return null;
        }
      },

      // Rule 2: Detect Function constructor calls
      {
        id: 'detect-function-constructor',
        name: 'Function Constructor Detection',
        description: 'Detects Function() constructor calls that can execute arbitrary code',
        severity: 'high',
        nodeTypes: [ts.SyntaxKind.NewExpression, ts.SyntaxKind.CallExpression],
        languages: ['typescript', 'javascript'],
        check: (node: ts.Node, sourceFile: ts.SourceFile) => {
          let expression: ts.Expression | undefined;
          
          if (ts.isNewExpression(node)) {
            expression = node.expression;
          } else if (ts.isCallExpression(node)) {
            expression = node.expression;
          }
          
          if (expression && ts.isIdentifier(expression) && expression.text === 'Function') {
            return {
              type: 'function_constructor_call',
              severity: 'high' as const,
              description: 'Function constructor call detected - potential code injection risk',
              remediation: 'Use regular function declarations or arrow functions instead',
              confidence: 90
            };
          }
          return null;
        }
      },

      // Rule 3: Detect setTimeout/setInterval with string arguments
      {
        id: 'detect-timer-string-args',
        name: 'Timer String Argument Detection',
        description: 'Detects setTimeout/setInterval calls with string arguments',
        severity: 'medium',
        nodeTypes: [ts.SyntaxKind.CallExpression],
        languages: ['typescript', 'javascript'],
        check: (node: ts.Node, sourceFile: ts.SourceFile) => {
          const callExpr = node as ts.CallExpression;
          if (ts.isIdentifier(callExpr.expression)) {
            const functionName = callExpr.expression.text;
            if (['setTimeout', 'setInterval'].includes(functionName)) {
              // Check if first argument is a string
              if (callExpr.arguments.length > 0 && 
                  ts.isStringLiteral(callExpr.arguments[0])) {
                return {
                  type: 'timer_string_argument',
                  severity: 'medium' as const,
                  description: `${functionName} called with string argument - potential code injection`,
                  remediation: 'Use function references instead of string arguments',
                  confidence: 85
                };
              }
            }
          }
          return null;
        }
      },

      // Rule 4: Detect document.write calls
      {
        id: 'detect-document-write',
        name: 'Document Write Detection',
        description: 'Detects document.write calls that can lead to XSS',
        severity: 'medium',
        nodeTypes: [ts.SyntaxKind.CallExpression],
        languages: ['typescript', 'javascript'],
        check: (node: ts.Node, sourceFile: ts.SourceFile) => {
          const callExpr = node as ts.CallExpression;
          if (ts.isPropertyAccessExpression(callExpr.expression)) {
            const propAccess = callExpr.expression;
            if (ts.isIdentifier(propAccess.expression) && 
                propAccess.expression.text === 'document' &&
                ts.isIdentifier(propAccess.name) &&
                ['write', 'writeln'].includes(propAccess.name.text)) {
              return {
                type: 'document_write_call',
                severity: 'medium' as const,
                description: 'document.write() call detected - potential XSS vulnerability',
                remediation: 'Use safer DOM manipulation methods like createElement()',
                confidence: 80
              };
            }
          }
          return null;
        }
      },

      // Rule 5: Detect innerHTML assignments
      {
        id: 'detect-innerhtml-assignment',
        name: 'InnerHTML Assignment Detection',
        description: 'Detects innerHTML assignments that can lead to XSS',
        severity: 'medium',
        nodeTypes: [ts.SyntaxKind.BinaryExpression],
        languages: ['typescript', 'javascript'],
        check: (node: ts.Node, sourceFile: ts.SourceFile) => {
          const binaryExpr = node as ts.BinaryExpression;
          if (binaryExpr.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            if (ts.isPropertyAccessExpression(binaryExpr.left)) {
              const propAccess = binaryExpr.left;
              if (ts.isIdentifier(propAccess.name) && 
                  propAccess.name.text === 'innerHTML') {
                return {
                  type: 'innerHTML_assignment',
                  severity: 'medium' as const,
                  description: 'innerHTML assignment detected - potential XSS vulnerability',
                  remediation: 'Use textContent or createElement() with proper sanitization',
                  confidence: 75
                };
              }
            }
          }
          return null;
        }
      },

      // Rule 6: Detect require() calls with dynamic arguments
      {
        id: 'detect-dynamic-require',
        name: 'Dynamic Require Detection',
        description: 'Detects require() calls with dynamic arguments',
        severity: 'high',
        nodeTypes: [ts.SyntaxKind.CallExpression],
        languages: ['typescript', 'javascript'],
        check: (node: ts.Node, sourceFile: ts.SourceFile) => {
          const callExpr = node as ts.CallExpression;
          if (ts.isIdentifier(callExpr.expression) && callExpr.expression.text === 'require') {
            if (callExpr.arguments.length > 0 && 
                !ts.isStringLiteral(callExpr.arguments[0]) &&
                !ts.isNoSubstitutionTemplateLiteral(callExpr.arguments[0])) {
              return {
                type: 'dynamic_require_call',
                severity: 'high' as const,
                description: 'Dynamic require() call detected - potential code injection',
                remediation: 'Use static require paths or implement proper input validation',
                confidence: 85
              };
            }
          }
          return null;
        }
      },

      // Rule 7: Detect process.env access patterns that might leak secrets
      {
        id: 'detect-env-access-patterns',
        name: 'Environment Variable Access Detection',
        description: 'Detects potentially unsafe environment variable access',
        severity: 'low',
        nodeTypes: [ts.SyntaxKind.PropertyAccessExpression],
        languages: ['typescript', 'javascript'],
        check: (node: ts.Node, sourceFile: ts.SourceFile) => {
          const propAccess = node as ts.PropertyAccessExpression;
          if (ts.isPropertyAccessExpression(propAccess.expression)) {
            const parentProp = propAccess.expression;
            if (ts.isIdentifier(parentProp.expression) && 
                parentProp.expression.text === 'process' &&
                ts.isIdentifier(parentProp.name) && 
                parentProp.name.text === 'env') {
              
              // Check for sensitive environment variable patterns
              if (ts.isIdentifier(propAccess.name)) {
                const envVar = propAccess.name.text.toLowerCase();
                if (envVar.includes('password') || envVar.includes('secret') || 
                    envVar.includes('key') || envVar.includes('token')) {
                  return {
                    type: 'sensitive_env_access',
                    severity: 'low' as const,
                    description: `Access to potentially sensitive environment variable: ${propAccess.name.text}`,
                    remediation: 'Ensure proper handling and do not log sensitive environment variables',
                    confidence: 70
                  };
                }
              }
            }
          }
          return null;
        }
      }
    ];
  }

  private getNodeLocation(node: ts.Node, sourceFile: ts.SourceFile): { line: number; column: number; length: number } {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    
    return {
      line: start.line + 1, // Convert to 1-based line numbers
      column: start.character + 1,
      length: node.getEnd() - node.getStart(sourceFile)
    };
  }

  private getNodeContext(node: ts.Node, sourceFile: ts.SourceFile): string {
    const start = Math.max(0, node.getStart(sourceFile) - 50);
    const end = Math.min(sourceFile.text.length, node.getEnd() + 50);
    return sourceFile.text.substring(start, end);
  }

  private calculateConfidence(violations: SecurityViolation[], nodeCount: number, analysisTime: number): number {
    // Base confidence starts at 90% for AST analysis
    let confidence = 90;
    
    // Reduce confidence if analysis was too quick (might indicate parsing issues)
    if (analysisTime < 10) {
      confidence -= 10;
    }
    
    // Increase confidence if we have detailed location information
    if (violations.every(v => v.location)) {
      confidence += 5;
    }
    
    // Ensure confidence is within valid range
    return Math.max(50, Math.min(100, confidence));
  }

  private calculateRiskScore(violations: SecurityViolation[]): number {
    if (violations.length === 0) return 0;
    
    const severityWeights = { low: 10, medium: 25, high: 50, critical: 80 };
    const totalScore = violations.reduce((sum, violation) => {
      return sum + severityWeights[violation.severity];
    }, 0);
    
    // Normalize to 0-100 scale
    return Math.min(100, totalScore);
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
