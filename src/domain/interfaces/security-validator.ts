/**
 * Domain Security Validator Interface
 *
 * Defines contracts for security validation services.
 * Infrastructure implementations must implement these interfaces.
 */

/**
 * Unified security configuration combining all security settings
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
  metadata: Record<string, unknown>;
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
  requestId: string;
  userAgent: string;
  ipAddress: string;
  timestamp: Date;
  operationType: string;
  language?: string;
  environment?: 'development' | 'production' | 'testing' | 'sandbox';
  permissions?: string[];
  metadata?: Record<string, unknown>;
  workingDirectory?: string;
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
 * Unified Security Validator Interface
 *
 * This interface must be implemented by infrastructure layer security validators.
 * Domain layer should never depend on concrete implementations.
 */
export interface IUnifiedSecurityValidator {
  // Core validation methods
  validateInput(
    input: string,
    context: SecurityValidationContext
  ): Promise<SecurityValidationResult>;

  validateCommand(
    command: string,
    context: SecurityValidationContext
  ): Promise<SecurityValidationResult>;

  validateCode(
    code: string,
    language: string,
    context: SecurityValidationContext
  ): Promise<SecurityValidationResult>;

  validateFileOperation(
    operation: string,
    path: string,
    context: SecurityValidationContext
  ): Promise<SecurityValidationResult>;

  validateNetworkRequest(
    url: string,
    method: string,
    context: SecurityValidationContext
  ): Promise<SecurityValidationResult>;

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

  // Lifecycle
  initialize?(): Promise<void>;
  readonly isInitialized?: boolean;
}
