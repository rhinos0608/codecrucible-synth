/**
 * Unified Security Validator
 * 
 * Consolidates all security validation functionality from:
 * - /core/security.ts (SecurityUtils)
 * - /infrastructure/security/security-validator.ts (ISecurityValidator)
 * - /core/e2b/security-validator.ts (E2B SecurityValidator)
 *
 * Provides comprehensive security validation for all use cases.
 */

import { createHash, randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import { IEventBus } from '../interfaces/event-bus.js';
import { ILogger } from '../interfaces/logger.js';

/**
 * Unified security configuration combining all previous configs
 */
export interface UnifiedSecurityConfig {
  // Basic settings
  enabled: boolean;
  securityLevel: 'low' | 'medium' | 'high' | 'strict';
  
  // Input validation
  maxInputLength: number;
  enableInputSanitization: boolean;
  enablePatternMatching: boolean;
  
  // Sandbox settings
  enableSandbox: boolean;
  sandboxTimeout: number;
  
  // Command validation
  allowedCommands: string[];
  blockedCommands: string[];
  allowedShells: string[];
  
  // File system access
  allowedPaths: string[];
  restrictedPaths: string[];
  allowFileSystemWrite: boolean;
  allowFileSystemRead: boolean;
  
  // Process control
  allowProcessSpawning: boolean;
  allowProcessKilling: boolean;
  maxProcesses: number;
  
  // Network access
  allowNetworkAccess: boolean;
  allowedDomains: string[];
  blockedDomains: string[];
  allowedPorts: number[];
  
  // Environment access
  allowEnvironmentAccess: boolean;
  allowEnvironmentModification: boolean;
  protectedEnvironmentVars: string[];
  
  // Code execution
  allowedLanguages: string[];
  blockedLanguages: string[];
  allowCodeEvaluation: boolean;
  allowDynamicImports: boolean;
  
  // Audit settings
  enableAuditLogging: boolean;
  auditLogPath?: string;
  logSecurityViolations: boolean;
  alertOnCriticalViolations: boolean;
}

/**
 * Security validation result with comprehensive information
 */
export interface SecurityValidationResult {
  isValid: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  violations: SecurityViolation[];
  sanitizedInput?: string;
  recommendations: string[];
  metadata: Record<string, any>;
}

export interface SecurityViolation {
  type: SecurityViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  pattern?: string;
  location?: { line?: number; column?: number };
  suggestedFix?: string;
}

export type SecurityViolationType = 
  | 'command_injection'
  | 'file_system_abuse'
  | 'privilege_escalation'
  | 'network_access_violation'
  | 'process_manipulation'
  | 'environment_manipulation'
  | 'code_injection'
  | 'path_traversal'
  | 'input_length_exceeded'
  | 'blocked_command'
  | 'blocked_language'
  | 'sandbox_violation'
  | 'unknown_threat';

/**
 * Context for security validation
 */
export interface SecurityValidationContext {
  sessionId: string;
  userId?: string;
  operationType: 'input' | 'command' | 'code' | 'file' | 'network' | 'process';
  language?: string;
  environment: 'development' | 'production' | 'testing' | 'sandbox';
  permissions: string[];
  metadata?: Record<string, any>;
}

/**
 * Unified Security Validator Interface
 */
export interface IUnifiedSecurityValidator {
  // Core validation methods
  validateInput(input: string, context: SecurityValidationContext): Promise<SecurityValidationResult>;
  validateCommand(command: string, context: SecurityValidationContext): Promise<SecurityValidationResult>;
  validateCode(code: string, language: string, context: SecurityValidationContext): Promise<SecurityValidationResult>;
  validateFileOperation(operation: string, path: string, context: SecurityValidationContext): Promise<SecurityValidationResult>;
  validateNetworkRequest(url: string, method: string, context: SecurityValidationContext): Promise<SecurityValidationResult>;
  
  // Batch validation
  validateBatch(requests: SecurityValidationRequest[]): Promise<SecurityValidationResult[]>;
  
  // Configuration management
  updateConfig(config: Partial<UnifiedSecurityConfig>): void;
  getConfig(): UnifiedSecurityConfig;
  
  // Security analysis
  analyzeRisk(input: string, context: SecurityValidationContext): Promise<RiskAnalysis>;
  detectThreats(input: string): ThreatDetectionResult[];
  
  // Sanitization
  sanitizeInput(input: string, options?: SanitizationOptions): string;
  
  // Audit and logging
  logSecurityEvent(event: SecurityEvent): void;
  getSecurityMetrics(): SecurityMetrics;
}

export interface SecurityValidationRequest {
  id: string;
  type: 'input' | 'command' | 'code' | 'file' | 'network';
  content: string;
  context: SecurityValidationContext;
}

export interface RiskAnalysis {
  overallRisk: 'none' | 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  threatCategories: string[];
  confidenceLevel: number;
  recommendations: string[];
}

export interface RiskFactor {
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  weight: number;
}

export interface ThreatDetectionResult {
  threatType: SecurityViolationType;
  confidence: number;
  pattern: string;
  description: string;
  mitigation: string;
}

export interface SanitizationOptions {
  removeComments?: boolean;
  escapeSpecialChars?: boolean;
  removeDangerousPatterns?: boolean;
  normalizeWhitespace?: boolean;
}

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: 'violation' | 'blocked' | 'warning' | 'allowed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: SecurityValidationContext;
  content: string;
  result: SecurityValidationResult;
}

export interface SecurityMetrics {
  totalValidations: number;
  violationsDetected: number;
  threatsBlocked: number;
  riskLevelDistribution: Record<string, number>;
  topViolationTypes: Array<{ type: string; count: number }>;
  averageValidationTime: number;
  lastUpdated: Date;
}

/**
 * Security threat patterns consolidated from all previous implementations
 */
const SECURITY_THREAT_PATTERNS = {
  // Command injection (from all implementations)
  COMMAND_INJECTION: [
    /;\s*rm\s+-rf/gi,
    /\|\s*sh/gi,
    /\|\s*bash/gi,
    /\$\(.*\)/g,
    /`.*`/g,
    /&&\s*rm/gi,
    /\|\s*nc/gi,
    />\s*\/dev\/null.*&/gi,
    /eval\s*\(\s*[^)]*\$_/gi,
    /exec\s*\(\s*[^)]*\$_/gi,
    /system\s*\(\s*[^)]*\$_/gi,
    /shell_exec\s*\(\s*[^)]*\$_/gi,
  ],

  // File system abuse (consolidated)
  FILE_SYSTEM_ABUSE: [
    /rm\s+-rf\s+\/[^/\s]*/gi,
    /chmod\s+777/gi,
    /chown\s+root/gi,
    />>\s*\/etc\//gi,
    />\s*\/etc\//gi,
    /\/dev\/sd[a-z]/gi,
    /\/proc\//gi,
    /\/sys\//gi,
    /\.\.\/\.\.\//gi, // Path traversal
  ],

  // Privilege escalation (consolidated)
  PRIVILEGE_ESCALATION: [
    /sudo\s+rm/gi,
    /su\s+/gi,
    /passwd\s*$/gi,
    /setuid\s*\(/gi,
    /setgid\s*\(/gi,
    /net\s+user\s+.*\/add/gi,
    /useradd/gi,
    /usermod/gi,
  ],

  // Network access (from E2B implementation)
  NETWORK_ACCESS: [
    /curl\s+.*\|\s*sh/gi,
    /wget\s+.*\|\s*sh/gi,
    /nc\s+.*\d+/gi,
    /ssh\s+/gi,
    /scp\s+/gi,
    /ftp\s+/gi,
    /telnet\s+/gi,
    /rsync\s+.*::/gi,
  ],

  // Process manipulation (from E2B implementation)
  PROCESS_MANIPULATION: [
    /kill\s+-9/gi,
    /killall\s+/gi,
    /pkill\s+/gi,
    /nohup\s+/gi,
    /&\s*$/gi,
    /fork\s*\(/gi,
    /clone\s*\(/gi,
  ],

  // Environment manipulation (from E2B implementation)
  ENVIRONMENT_MANIPULATION: [
    /export\s+PATH=/gi,
    /export\s+LD_/gi,
    /unset\s+/gi,
    /env\s+-i/gi,
    /exec\s+env/gi,
  ],

  // Code injection (language-specific)
  PYTHON_CODE_INJECTION: [
    /__import__\s*\(\s*['""]os['""]\s*\)/gi,
    /__import__\s*\(\s*['""]subprocess['""]\s*\)/gi,
    /import\s+os\b/gi,
    /import\s+subprocess\b/gi,
    /from\s+os\s+import/gi,
    /__builtins__/gi,
    /globals\s*\(\s*\)/gi,
    /locals\s*\(\s*\)/gi,
    /getattr\s*\(/gi,
    /setattr\s*\(/gi,
  ],

  JAVASCRIPT_CODE_INJECTION: [
    /require\s*\(\s*['"]child_process['"]/gi,
    /require\s*\(\s*['"]fs['"]/gi,
    /require\s*\(\s*['"]os['"]/gi,
    /process\.env/gi,
    /process\.exit/gi,
    /Function\s*\(/gi,
    /setTimeout\s*\(.*eval/gi,
  ],

  // Windows-specific threats (from SecurityUtils)
  WINDOWS_THREATS: [
    /powershell\s+-[Cc]ommand/gi,
    /cmd\s+\/c\s+.*&/gi,
    /reg\s+add\s+HKEY/gi,
    /schtasks/gi,
    /wmic/gi,
  ],
};

/**
 * Default security configuration based on medium security level
 */
const DEFAULT_SECURITY_CONFIG: UnifiedSecurityConfig = {
  enabled: true,
  securityLevel: 'medium',
  maxInputLength: 50000,
  enableInputSanitization: true,
  enablePatternMatching: true,
  enableSandbox: true,
  sandboxTimeout: 30000,
  allowedCommands: ['ls', 'cat', 'echo', 'pwd', 'grep', 'find', 'head', 'tail', 'wc', 'git', 'npm', 'node'],
  blockedCommands: ['rm', 'rmdir', 'sudo', 'su', 'chmod', 'chown', 'mount', 'umount', 'kill', 'killall'],
  allowedShells: ['bash', 'sh', 'zsh'],
  allowedPaths: [process.cwd()],
  restrictedPaths: ['/etc', '/proc', '/sys', '/dev', '/root', '/boot'],
  allowFileSystemWrite: true,
  allowFileSystemRead: true,
  allowProcessSpawning: false,
  allowProcessKilling: false,
  maxProcesses: 3,
  allowNetworkAccess: false,
  allowedDomains: [],
  blockedDomains: [],
  allowedPorts: [80, 443],
  allowEnvironmentAccess: false,
  allowEnvironmentModification: false,
  protectedEnvironmentVars: ['PATH', 'HOME', 'USER', 'SHELL'],
  allowedLanguages: ['javascript', 'python', 'bash', 'shell'],
  blockedLanguages: [],
  allowCodeEvaluation: false,
  allowDynamicImports: false,
  enableAuditLogging: true,
  logSecurityViolations: true,
  alertOnCriticalViolations: true,
};

/**
 * Unified Security Validator Implementation
 */
export class UnifiedSecurityValidator extends EventEmitter implements IUnifiedSecurityValidator {
  private config: UnifiedSecurityConfig;
  private eventBus?: IEventBus;
  private metrics: SecurityMetrics;
  private threatDatabase: Map<string, ThreatDetectionResult>;
  private sessionCache: Map<string, SecurityEvent[]>;

  constructor(
    private logger: ILogger,
    config?: Partial<UnifiedSecurityConfig>, 
    eventBus?: IEventBus
  ) {
    super();
    this.logger.info('UnifiedSecurityValidator initialized');
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
    this.eventBus = eventBus;
    this.metrics = this.initializeMetrics();
    this.threatDatabase = new Map();
    this.sessionCache = new Map();
    this.initializeThreatDatabase();
  }

  async validateInput(input: string, context: SecurityValidationContext): Promise<SecurityValidationResult> {
    const startTime = Date.now();
    const violations: SecurityViolation[] = [];
    const recommendations: string[] = [];

    try {
      // Check input length
      if (input.length > this.config.maxInputLength) {
        violations.push({
          type: 'input_length_exceeded',
          severity: 'high',
          message: `Input length ${input.length} exceeds maximum allowed ${this.config.maxInputLength}`,
          suggestedFix: 'Reduce input size or increase maxInputLength limit',
        });
      }

      // Check for threat patterns
      const threatResults = this.detectThreats(input);
      for (const threat of threatResults) {
        violations.push({
          type: threat.threatType,
          severity: this.mapConfidenceToSeverity(threat.confidence),
          message: threat.description,
          pattern: threat.pattern,
          suggestedFix: threat.mitigation,
        });
      }

      // Additional validation based on operation type
      if (context.operationType === 'command') {
        const commandResult = await this.validateCommand(input, context);
        violations.push(...commandResult.violations);
        recommendations.push(...commandResult.recommendations);
      }

      // Determine overall risk level
      const riskLevel = this.calculateRiskLevel(violations);
      
      // Create result
      const result: SecurityValidationResult = {
        isValid: violations.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0,
        riskLevel,
        violations,
        recommendations,
        metadata: {
          validationTime: Date.now() - startTime,
          inputLength: input.length,
          patternMatches: threatResults.length,
        },
      };

      // Apply sanitization if needed
      if (this.config.enableInputSanitization && !result.isValid) {
        result.sanitizedInput = this.sanitizeInput(input);
      }

      // Log security event
      this.logSecurityEvent({
        id: this.generateEventId(),
        timestamp: new Date(),
        type: result.isValid ? 'allowed' : 'violation',
        severity: this.mapRiskLevelToSeverity(riskLevel),
        context,
        content: input.substring(0, 200),
        result,
      });

      this.updateMetrics(result, Date.now() - startTime);
      return result;

    } catch (error) {
      this.logger.error('Security validation error:', error);
      return {
        isValid: false,
        riskLevel: 'critical',
        violations: [{
          type: 'unknown_threat',
          severity: 'critical',
          message: 'Security validation failed due to internal error',
        }],
        recommendations: ['Contact system administrator'],
        metadata: { error: String(error) },
      };
    }
  }

  async validateCommand(command: string, context: SecurityValidationContext): Promise<SecurityValidationResult> {
    const violations: SecurityViolation[] = [];
    const recommendations: string[] = [];

    // Extract command word
    const commandWord = command.trim().split(' ')[0].toLowerCase();

    // Check blocked commands
    if (this.config.blockedCommands.includes(commandWord)) {
      violations.push({
        type: 'blocked_command',
        severity: 'critical',
        message: `Command '${commandWord}' is explicitly blocked`,
        suggestedFix: this.getSafeCommandAlternative(commandWord),
      });
    }

    // Check allowed commands (if allowlist is used)
    if (this.config.allowedCommands.length > 0 && !this.config.allowedCommands.includes(commandWord)) {
      violations.push({
        type: 'blocked_command',
        severity: 'high',
        message: `Command '${commandWord}' is not in the allowed commands list`,
        suggestedFix: 'Use one of the allowed commands or request access',
      });
    }

    // Validate against general input patterns
    const baseResult = await this.validateInput(command, context);
    violations.push(...baseResult.violations);
    recommendations.push(...baseResult.recommendations);

    return {
      isValid: violations.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0,
      riskLevel: this.calculateRiskLevel(violations),
      violations,
      recommendations,
      metadata: { commandWord },
    };
  }

  async validateCode(code: string, language: string, context: SecurityValidationContext): Promise<SecurityValidationResult> {
    const violations: SecurityViolation[] = [];
    const recommendations: string[] = [];

    // Check if language is allowed
    if (this.config.blockedLanguages.includes(language.toLowerCase())) {
      violations.push({
        type: 'blocked_language',
        severity: 'critical',
        message: `Language '${language}' is blocked`,
      });
    }

    if (this.config.allowedLanguages.length > 0 && !this.config.allowedLanguages.includes(language.toLowerCase())) {
      violations.push({
        type: 'blocked_language',
        severity: 'high',
        message: `Language '${language}' is not in allowed languages`,
      });
    }

    // Language-specific validation
    switch (language.toLowerCase()) {
      case 'python':
        violations.push(...this.validatePythonCode(code));
        break;
      case 'javascript':
        violations.push(...this.validateJavaScriptCode(code));
        break;
      case 'bash':
      case 'shell':
        const commandResult = await this.validateCommand(code, context);
        violations.push(...commandResult.violations);
        break;
    }

    // General code validation
    const baseResult = await this.validateInput(code, context);
    violations.push(...baseResult.violations);
    recommendations.push(...baseResult.recommendations);

    return {
      isValid: violations.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0,
      riskLevel: this.calculateRiskLevel(violations),
      violations,
      recommendations,
      metadata: { language, codeLength: code.length },
    };
  }

  async validateFileOperation(operation: string, path: string, context: SecurityValidationContext): Promise<SecurityValidationResult> {
    const violations: SecurityViolation[] = [];
    const recommendations: string[] = [];
    
    const normalizedPath = this.normalizePath(path);

    // Check restricted paths
    for (const restrictedPath of this.config.restrictedPaths) {
      if (normalizedPath.startsWith(restrictedPath)) {
        violations.push({
          type: 'path_traversal',
          severity: 'critical',
          message: `Access to restricted path '${restrictedPath}' is not allowed`,
        });
      }
    }

    // Check allowed paths
    if (this.config.allowedPaths.length > 0) {
      const isAllowed = this.config.allowedPaths.some(allowedPath => 
        normalizedPath.startsWith(allowedPath)
      );
      if (!isAllowed) {
        violations.push({
          type: 'path_traversal',
          severity: 'high',
          message: 'Path is not within allowed directories',
        });
      }
    }

    // Check operation permissions
    if (operation === 'write' && !this.config.allowFileSystemWrite) {
      violations.push({
        type: 'file_system_abuse',
        severity: 'high',
        message: 'File write operations are not allowed',
      });
    }

    if (operation === 'read' && !this.config.allowFileSystemRead) {
      violations.push({
        type: 'file_system_abuse',
        severity: 'medium',
        message: 'File read operations are not allowed',
      });
    }

    return {
      isValid: violations.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0,
      riskLevel: this.calculateRiskLevel(violations),
      violations,
      recommendations,
      metadata: { operation, normalizedPath },
    };
  }

  async validateNetworkRequest(url: string, method: string, context: SecurityValidationContext): Promise<SecurityValidationResult> {
    const violations: SecurityViolation[] = [];
    const recommendations: string[] = [];

    if (!this.config.allowNetworkAccess) {
      violations.push({
        type: 'network_access_violation',
        severity: 'critical',
        message: 'Network access is not allowed',
      });
    }

    try {
      const urlObj = new URL(url);
      
      // Check blocked domains
      if (this.config.blockedDomains.includes(urlObj.hostname)) {
        violations.push({
          type: 'network_access_violation',
          severity: 'high',
          message: `Access to domain '${urlObj.hostname}' is blocked`,
        });
      }

      // Check allowed domains
      if (this.config.allowedDomains.length > 0 && !this.config.allowedDomains.includes(urlObj.hostname)) {
        violations.push({
          type: 'network_access_violation',
          severity: 'medium',
          message: `Domain '${urlObj.hostname}' is not in allowed domains`,
        });
      }

      // Check allowed ports
      const port = urlObj.port ? parseInt(urlObj.port) : (urlObj.protocol === 'https:' ? 443 : 80);
      if (this.config.allowedPorts.length > 0 && !this.config.allowedPorts.includes(port)) {
        violations.push({
          type: 'network_access_violation',
          severity: 'medium',
          message: `Port ${port} is not in allowed ports`,
        });
      }

    } catch (error) {
      violations.push({
        type: 'network_access_violation',
        severity: 'high',
        message: 'Invalid URL format',
      });
    }

    return {
      isValid: violations.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0,
      riskLevel: this.calculateRiskLevel(violations),
      violations,
      recommendations,
      metadata: { url, method },
    };
  }

  async validateBatch(requests: SecurityValidationRequest[]): Promise<SecurityValidationResult[]> {
    const results: SecurityValidationResult[] = [];
    
    for (const request of requests) {
      let result: SecurityValidationResult;
      
      switch (request.type) {
        case 'input':
          result = await this.validateInput(request.content, request.context);
          break;
        case 'command':
          result = await this.validateCommand(request.content, request.context);
          break;
        case 'code':
          result = await this.validateCode(request.content, request.context.language || 'unknown', request.context);
          break;
        default:
          result = await this.validateInput(request.content, request.context);
      }
      
      results.push(result);
    }
    
    return results;
  }

  updateConfig(config: Partial<UnifiedSecurityConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
    
    if (this.eventBus) {
      this.eventBus.emit('security:config-updated', { config: this.config });
    }
    
    this.logger.info('Security configuration updated');
  }

  getConfig(): UnifiedSecurityConfig {
    return { ...this.config };
  }

  async analyzeRisk(input: string, context: SecurityValidationContext): Promise<RiskAnalysis> {
    const threats = this.detectThreats(input);
    const riskFactors: RiskFactor[] = [];
    const threatCategories: string[] = [];

    for (const threat of threats) {
      riskFactors.push({
        category: threat.threatType,
        severity: this.mapConfidenceToSeverity(threat.confidence),
        description: threat.description,
        weight: threat.confidence,
      });
      
      if (!threatCategories.includes(threat.threatType)) {
        threatCategories.push(threat.threatType);
      }
    }

    // Calculate overall risk
    const totalWeight = riskFactors.reduce((sum, factor) => sum + factor.weight, 0);
    const averageWeight = totalWeight / (riskFactors.length || 1);
    
    let overallRisk: 'none' | 'low' | 'medium' | 'high' | 'critical';
    if (averageWeight < 0.2) overallRisk = 'none';
    else if (averageWeight < 0.4) overallRisk = 'low';
    else if (averageWeight < 0.6) overallRisk = 'medium';
    else if (averageWeight < 0.8) overallRisk = 'high';
    else overallRisk = 'critical';

    return {
      overallRisk,
      riskFactors,
      threatCategories,
      confidenceLevel: Math.min(averageWeight, 1.0),
      recommendations: this.generateRiskRecommendations(riskFactors),
    };
  }

  detectThreats(input: string): ThreatDetectionResult[] {
    const results: ThreatDetectionResult[] = [];

    // Check all pattern categories
    for (const [category, patterns] of Object.entries(SECURITY_THREAT_PATTERNS)) {
      for (const pattern of patterns) {
        const matches = input.match(pattern);
        if (matches) {
          const threat = this.threatDatabase.get(category);
          if (threat) {
            results.push({
              ...threat,
              pattern: pattern.toString(),
              confidence: this.calculatePatternConfidence(pattern, matches),
            });
          } else {
            // Create generic threat result
            results.push({
              threatType: this.mapCategoryToThreatType(category),
              confidence: 0.7,
              pattern: pattern.toString(),
              description: `Potentially dangerous pattern detected: ${category}`,
              mitigation: 'Review and sanitize the input',
            });
          }
        }
      }
    }

    return results;
  }

  sanitizeInput(input: string, options: SanitizationOptions = {}): string {
    let sanitized = input;

    if (options.removeComments !== false) {
      // Remove comments (basic implementation)
      sanitized = sanitized.replace(/\/\/.*$/gm, ''); // // comments
      sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, ''); // /* */ comments
      sanitized = sanitized.replace(/#.*$/gm, ''); // # comments
    }

    if (options.escapeSpecialChars !== false) {
      // Escape special characters
      sanitized = sanitized.replace(/[<>&"']/g, (char) => {
        const escapes: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          '"': '&quot;',
          "'": '&#x27;',
        };
        return escapes[char] || char;
      });
    }

    if (options.removeDangerousPatterns !== false) {
      // Remove known dangerous patterns
      const dangerousPatterns = [
        /rm\s+-rf/gi,
        /sudo\s+/gi,
        /eval\s*\(/gi,
        /exec\s*\(/gi,
        /system\s*\(/gi,
        /\$\(.*\)/g,
        /`.*`/g,
      ];
      
      for (const pattern of dangerousPatterns) {
        sanitized = sanitized.replace(pattern, '[REMOVED_DANGEROUS_PATTERN]');
      }
    }

    if (options.normalizeWhitespace !== false) {
      // Normalize whitespace
      sanitized = sanitized.replace(/\s+/g, ' ').trim();
    }

    return sanitized;
  }

  logSecurityEvent(event: SecurityEvent): void {
    // Store in session cache
    if (!this.sessionCache.has(event.context.sessionId)) {
      this.sessionCache.set(event.context.sessionId, []);
    }
    this.sessionCache.get(event.context.sessionId)!.push(event);

    // Log to system logger
    const logLevel = event.severity === 'critical' || event.severity === 'high' ? 'error' : 'warn';
    if (logLevel === 'error') {
      this.logger.error(`Security event: ${event.type}`, {
      id: event.id,
      severity: event.severity,
      sessionId: event.context.sessionId,
      operationType: event.context.operationType,
        violations: event.result.violations.length,
        riskLevel: event.result.riskLevel,
      });
    } else {
      this.logger.warn(`Security event: ${event.type}`, {
        id: event.id,
        severity: event.severity,
        sessionId: event.context.sessionId,
        operationType: event.context.operationType,
        violations: event.result.violations.length,
        riskLevel: event.result.riskLevel,
      });
    }

    // Emit events
    this.emit('securityEvent', event);
    
    if (this.eventBus) {
      this.eventBus.emit('security:event', event);
      
      if (event.severity === 'critical' && this.config.alertOnCriticalViolations) {
        this.eventBus.emit('security:critical-violation', event);
      }
    }
  }

  getSecurityMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  // Private helper methods
  private initializeMetrics(): SecurityMetrics {
    return {
      totalValidations: 0,
      violationsDetected: 0,
      threatsBlocked: 0,
      riskLevelDistribution: {},
      topViolationTypes: [],
      averageValidationTime: 0,
      lastUpdated: new Date(),
    };
  }

  private initializeThreatDatabase(): void {
    // Initialize threat database with detailed information
    this.threatDatabase.set('COMMAND_INJECTION', {
      threatType: 'command_injection',
      confidence: 0.9,
      pattern: '',
      description: 'Command injection attempt detected',
      mitigation: 'Sanitize input and use parameterized commands',
    });

    // Add more threat definitions...
  }

  private calculateRiskLevel(violations: SecurityViolation[]): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    if (violations.some(v => v.severity === 'critical')) return 'critical';
    if (violations.some(v => v.severity === 'high')) return 'high';
    if (violations.some(v => v.severity === 'medium')) return 'medium';
    if (violations.length > 0) return 'low';
    return 'none';
  }

  private mapConfidenceToSeverity(confidence: number): 'low' | 'medium' | 'high' | 'critical' {
    if (confidence >= 0.8) return 'critical';
    if (confidence >= 0.6) return 'high';
    if (confidence >= 0.4) return 'medium';
    return 'low';
  }

  private mapRiskLevelToSeverity(riskLevel: string): 'low' | 'medium' | 'high' | 'critical' {
    return riskLevel as 'low' | 'medium' | 'high' | 'critical';
  }

  private mapCategoryToThreatType(category: string): SecurityViolationType {
    const mapping: Record<string, SecurityViolationType> = {
      'COMMAND_INJECTION': 'command_injection',
      'FILE_SYSTEM_ABUSE': 'file_system_abuse',
      'PRIVILEGE_ESCALATION': 'privilege_escalation',
      'NETWORK_ACCESS': 'network_access_violation',
      'PROCESS_MANIPULATION': 'process_manipulation',
      'ENVIRONMENT_MANIPULATION': 'environment_manipulation',
      'PYTHON_CODE_INJECTION': 'code_injection',
      'JAVASCRIPT_CODE_INJECTION': 'code_injection',
    };
    
    return mapping[category] || 'unknown_threat';
  }

  private calculatePatternConfidence(pattern: RegExp, matches: RegExpMatchArray): number {
    // Simple confidence calculation based on pattern complexity and matches
    const baseConfidence = 0.7;
    const matchCount = matches.length;
    const patternComplexity = pattern.toString().length / 50; // Normalized complexity
    
    return Math.min(baseConfidence + (matchCount * 0.1) + (patternComplexity * 0.1), 1.0);
  }

  private validatePythonCode(code: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    
    for (const pattern of SECURITY_THREAT_PATTERNS.PYTHON_CODE_INJECTION) {
      if (pattern.test(code)) {
        violations.push({
          type: 'code_injection',
          severity: 'high',
          message: 'Dangerous Python pattern detected',
          pattern: pattern.toString(),
        });
      }
    }
    
    return violations;
  }

  private validateJavaScriptCode(code: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    
    for (const pattern of SECURITY_THREAT_PATTERNS.JAVASCRIPT_CODE_INJECTION) {
      if (pattern.test(code)) {
        violations.push({
          type: 'code_injection',
          severity: 'high',
          message: 'Dangerous JavaScript pattern detected',
          pattern: pattern.toString(),
        });
      }
    }
    
    return violations;
  }

  private normalizePath(path: string): string {
    return path.replace(/\/+/g, '/').replace(/\.\./g, '').replace(/^\/+/, '/');
  }

  private getSafeCommandAlternative(command: string): string {
    const alternatives: Record<string, string> = {
      'rm': 'Use file management operations instead',
      'sudo': 'Operations run in isolated environment',
      'chmod': 'File permissions managed automatically',
      'chown': 'File ownership managed automatically',
      'mount': 'Filesystem managed automatically',
      'kill': 'Process management not available',
    };
    
    return alternatives[command] || 'Use alternative approach';
  }

  private generateRiskRecommendations(riskFactors: RiskFactor[]): string[] {
    const recommendations: string[] = [];
    
    if (riskFactors.some(f => f.category === 'command_injection')) {
      recommendations.push('Sanitize command inputs and use parameterized queries');
    }
    
    if (riskFactors.some(f => f.category === 'file_system_abuse')) {
      recommendations.push('Restrict file system access and validate paths');
    }
    
    if (riskFactors.some(f => f.category === 'privilege_escalation')) {
      recommendations.push('Run operations with minimal privileges');
    }
    
    return recommendations;
  }

  private updateMetrics(result: SecurityValidationResult, validationTime: number): void {
    this.metrics.totalValidations++;
    this.metrics.averageValidationTime = 
      (this.metrics.averageValidationTime * (this.metrics.totalValidations - 1) + validationTime) / 
      this.metrics.totalValidations;
    
    if (result.violations.length > 0) {
      this.metrics.violationsDetected++;
    }
    
    if (result.riskLevel === 'critical' || result.riskLevel === 'high') {
      this.metrics.threatsBlocked++;
    }
    
    this.metrics.riskLevelDistribution[result.riskLevel] = 
      (this.metrics.riskLevelDistribution[result.riskLevel] || 0) + 1;
    
    this.metrics.lastUpdated = new Date();
  }

  private generateEventId(): string {
    return `sec_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }
}