/**
 * Claude Code-inspired Security System
 * Based on research of Claude Code security patterns (2024-2025)
 *
 * Key principles from Claude Code:
 * 1. User consent for potentially dangerous operations
 * 2. Path validation and CWD restrictions
 * 3. Command whitelisting with user approval for outliers
 * 4. Context-aware security rather than blanket blocking
 * 5. Audit logging for security monitoring
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

export interface SecurityContext {
  operation: string;
  filePath?: string;
  command?: string;
  userInput: string;
  workingDirectory: string;
  timestamp: Date;
}

export interface SecurityDecision {
  action: 'allow' | 'block' | 'askUser';
  reason: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresConsent?: boolean;
  suggestedActions?: string[];
}

export interface UserConsentRequest {
  id: string;
  context: SecurityContext;
  decision: SecurityDecision;
  message: string;
  options: ConsentOption[];
}

export interface ConsentOption {
  id: string;
  label: string;
  description: string;
  action: 'allow' | 'deny' | 'modify';
}

export interface SecurityPolicy {
  // Path-based restrictions (Claude Code pattern)
  allowedPaths: string[];
  blockedPaths: string[];
  requireConsentForPaths: string[];

  // Command restrictions (Claude Code pattern)
  whitelistedCommands: string[];
  dangerousCommands: string[];
  requireConsentForCommands: string[];

  // File operation restrictions
  allowedFileExtensions: string[];
  dangerousFileExtensions: string[];
  requireConsentForExtensions: string[];

  // Developer-friendly patterns (not blocked, but logged)
  developmentKeywords: string[];
  sqlKeywords: string[];
  systemCommands: string[];
}

/**
 * Claude Code-inspired security system that prioritizes user consent over blanket blocking
 */
export class ClaudeCodeSecurity extends EventEmitter {
  private workingDirectory: string;
  private policy: SecurityPolicy;
  private auditLog: SecurityContext[] = [];
  private pendingConsentRequests = new Map<string, UserConsentRequest>();

  constructor(workingDirectory: string = process.cwd()) {
    super();
    this.workingDirectory = path.resolve(workingDirectory);
    this.policy = this.createDefaultPolicy();
  }

  private createDefaultPolicy(): SecurityPolicy {
    return {
      // Path-based security (Claude Code CWD pattern)
      allowedPaths: [
        this.workingDirectory,
        path.join(this.workingDirectory, '**'),
        '~/', // User home directory
        './src/**',
        './dist/**',
        './docs/**',
        './config/**',
        './tests/**',
      ],

      blockedPaths: ['/etc/**', '/sys/**', '/proc/**', 'C:\\Windows\\System32\\**', '/usr/bin/**'],

      requireConsentForPaths: [
        '../**', // Outside project directory
        '/tmp/**',
        'C:\\Users\\**\\AppData\\**',
      ],

      // Command security (Claude Code pattern)
      whitelistedCommands: [
        'ls',
        'dir',
        'cat',
        'type',
        'echo',
        'pwd',
        'cd',
        'git',
        'npm',
        'node',
        'python',
        'pip',
        'grep',
        'find',
        'sort',
        'head',
        'tail',
        'mkdir',
        'touch',
      ],

      dangerousCommands: [
        'rm -rf',
        'del /s',
        'format',
        'shutdown',
        'reboot',
        'halt',
        'dd',
        'fdisk',
        'mkfs',
        'chmod 777',
      ],

      requireConsentForCommands: [
        'rm',
        'del',
        'move',
        'mv',
        'cp',
        'copy',
        'chmod',
        'chown',
        'sudo',
        'su',
        'curl',
        'wget',
        'ssh',
        'scp',
      ],

      // File extension security
      allowedFileExtensions: [
        '.js',
        '.ts',
        '.json',
        '.md',
        '.txt',
        '.yaml',
        '.yml',
        '.css',
        '.html',
        '.jsx',
        '.tsx',
        '.py',
        '.java',
        '.c',
        '.cpp',
        '.h',
        '.go',
        '.rs',
        '.php',
      ],

      dangerousFileExtensions: ['.exe', '.bat', '.cmd', '.ps1', '.sh', '.com', '.scr'],

      requireConsentForExtensions: ['.env', '.key', '.pem', '.p12', '.jks'],

      // Developer-friendly keywords (allowed but logged)
      developmentKeywords: [
        'refactor',
        'update',
        'modify',
        'change',
        'fix',
        'implement',
        'create',
        'generate',
        'build',
        'compile',
        'test',
        'debug',
      ],

      sqlKeywords: [
        'select',
        'insert',
        'update',
        'delete',
        'create',
        'drop',
        'alter',
        'union',
        'join',
        'where',
        'group',
        'order',
      ],

      systemCommands: ['process', 'system', 'exec', 'spawn', 'fork', 'kill'],
    };
  }

  /**
   * Main security evaluation method - Claude Code inspired
   */
  async evaluateSecurity(context: SecurityContext): Promise<SecurityDecision> {
    // Log the operation for audit
    this.auditLog.push(context);
    this.emit('securityEvaluation', context);

    // Path-based security check (Claude Code CWD pattern)
    if (context.filePath) {
      const pathDecision = this.evaluatePathSecurity(context.filePath);
      if (pathDecision.action === 'block') {
        return pathDecision;
      }
      if (pathDecision.action === 'askUser') {
        return pathDecision;
      }
    }

    // Command-based security check (Claude Code whitelist pattern)
    if (context.command) {
      const commandDecision = this.evaluateCommandSecurity(context.command);
      if (commandDecision.action === 'block') {
        return commandDecision;
      }
      if (commandDecision.action === 'askUser') {
        return commandDecision;
      }
    }

    // Content analysis (contextual, not keyword blocking)
    const contentDecision = this.evaluateContentSecurity(context.userInput);
    if (contentDecision.action !== 'allow') {
      return contentDecision;
    }

    // Default: allow with logging
    return {
      action: 'allow',
      reason: 'Operation within security policy',
      riskLevel: 'low',
    };
  }

  private evaluatePathSecurity(filePath: string): SecurityDecision {
    const resolvedPath = path.resolve(filePath);

    // Check blocked paths first
    for (const blockedPattern of this.policy.blockedPaths) {
      if (this.matchesPattern(resolvedPath, blockedPattern)) {
        return {
          action: 'block',
          reason: `Access to blocked path: ${blockedPattern}`,
          riskLevel: 'high',
        };
      }
    }

    // Check if requires consent
    for (const consentPattern of this.policy.requireConsentForPaths) {
      if (this.matchesPattern(resolvedPath, consentPattern)) {
        return {
          action: 'askUser',
          reason: `Access outside working directory requires consent`,
          riskLevel: 'medium',
          requiresConsent: true,
          suggestedActions: ['Allow once', 'Allow for this session', 'Deny'],
        };
      }
    }

    // Check if within allowed paths
    for (const allowedPattern of this.policy.allowedPaths) {
      if (this.matchesPattern(resolvedPath, allowedPattern)) {
        return {
          action: 'allow',
          reason: 'Path within allowed directory',
          riskLevel: 'low',
        };
      }
    }

    // Default: ask for consent for unknown paths
    return {
      action: 'askUser',
      reason: 'Path not in predefined allowed list',
      riskLevel: 'medium',
      requiresConsent: true,
    };
  }

  private evaluateCommandSecurity(command: string): SecurityDecision {
    const cmdLower = command.toLowerCase().trim();

    // Check dangerous commands
    for (const dangerous of this.policy.dangerousCommands) {
      if (cmdLower.includes(dangerous.toLowerCase())) {
        return {
          action: 'block',
          reason: `Dangerous command detected: ${dangerous}`,
          riskLevel: 'critical',
        };
      }
    }

    // Check commands requiring consent
    for (const consentCmd of this.policy.requireConsentForCommands) {
      if (cmdLower.startsWith(consentCmd.toLowerCase())) {
        return {
          action: 'askUser',
          reason: `Command '${consentCmd}' requires user consent`,
          riskLevel: 'medium',
          requiresConsent: true,
          suggestedActions: ['Allow this command', 'Modify command', 'Deny'],
        };
      }
    }

    // Check whitelisted commands
    for (const allowed of this.policy.whitelistedCommands) {
      if (cmdLower.startsWith(allowed.toLowerCase())) {
        return {
          action: 'allow',
          reason: `Whitelisted command: ${allowed}`,
          riskLevel: 'low',
        };
      }
    }

    // Default: ask for consent for unknown commands
    return {
      action: 'askUser',
      reason: 'Command not in whitelist',
      riskLevel: 'medium',
      requiresConsent: true,
    };
  }

  private evaluateContentSecurity(content: string): SecurityDecision {
    const contentLower = content.toLowerCase();

    // Check for development keywords (allow but note)
    const foundKeywords = {
      sql: this.policy.sqlKeywords.filter(kw => contentLower.includes(kw.toLowerCase())),
      development: this.policy.developmentKeywords.filter(kw =>
        contentLower.includes(kw.toLowerCase())
      ),
      system: this.policy.systemCommands.filter(kw => contentLower.includes(kw.toLowerCase())),
    };

    // Contextual analysis - this is the key improvement over keyword blocking
    const isDevelopmentContext = this.isDevelopmentContext(content, foundKeywords);
    const isSQLContext = this.isSQLContext(content, foundKeywords);
    const isSystemContext = this.isSystemContext(content, foundKeywords);

    // Log for audit but don't block development work
    if (
      foundKeywords.sql.length > 0 ||
      foundKeywords.system.length > 0 ||
      foundKeywords.development.length > 0
    ) {
      this.emit('keywordDetected', {
        sql: foundKeywords.sql,
        development: foundKeywords.development,
        system: foundKeywords.system,
        context: { isDevelopmentContext, isSQLContext, isSystemContext },
        content: `${content.substring(0, 200)}...`,
      });
    }

    // Only block or request consent for truly dangerous patterns
    const dangerousPatterns = [
      // System commands
      {
        pattern: /rm\s+-rf\s+[\/\\]\*?/,
        reason: 'Recursive file deletion detected',
        risk: 'critical',
      },
      { pattern: /format\s+[cC]:/i, reason: 'Disk format command detected', risk: 'critical' },
      { pattern: /shutdown\s+-[rf]/i, reason: 'System shutdown command detected', risk: 'high' },
      {
        pattern: /del\s+[\/\\].*\*.*[\/\\]s/i,
        reason: 'Recursive delete command detected',
        risk: 'critical',
      },
      {
        pattern: /echo\s+.*>\s*\/dev\/(null|zero|random)/i,
        reason: 'System device manipulation detected',
        risk: 'high',
      },

      // AI-specific prompt injection patterns (2024 threats)
      {
        pattern: /ignore\s+(?:all\s+)?(?:previous|above)\s+instructions?/i,
        reason: 'Prompt injection attempt detected',
        risk: 'high',
      },
      {
        pattern:
          /forget\s+(everything|all|previous)(?:\s+(?:and\s+)?(?:start\s+over|instructions?|prompts?))?/i,
        reason: 'Memory manipulation attempt detected',
        risk: 'high',
      },
      {
        pattern: /new\s+(instructions?|system\s+prompt|role):\s*/i,
        reason: 'Role hijacking attempt detected',
        risk: 'high',
      },
      {
        pattern: /system\s*:\s*you\s+(are\s+now|must\s+now)/i,
        reason: 'System override attempt detected',
        risk: 'high',
      },
      {
        pattern: /override\s+security/i,
        reason: 'Security bypass attempt detected',
        risk: 'critical',
      },
    ];

    for (const { pattern, reason, risk } of dangerousPatterns) {
      if (pattern.test(content)) {
        return {
          action: 'askUser',
          reason,
          riskLevel: risk as 'high' | 'critical',
          requiresConsent: true,
          suggestedActions: ['Review and confirm', 'Modify operation', 'Cancel'],
        };
      }
    }

    // Handle file modification requests FIRST (higher priority than development context)
    if (this.isFileModificationRequest(content)) {
      return {
        action: 'askUser',
        reason: 'File modification requested - requires confirmation',
        riskLevel: 'medium',
        requiresConsent: true,
        suggestedActions: ['Allow file changes', 'Review changes first', 'Deny'],
      };
    }

    // Handle development contexts appropriately (only for non-file operations)
    if (
      isDevelopmentContext &&
      (foundKeywords.sql.length > 0 || foundKeywords.development.length > 0)
    ) {
      // This is legitimate development work - allow with low risk
      return {
        action: 'allow',
        reason: 'Development operation in appropriate context',
        riskLevel: 'low',
      };
    }

    return {
      action: 'allow',
      reason: 'Content passed contextual security analysis',
      riskLevel: 'low',
    };
  }

  /**
   * Determine if content is in a development context
   */
  private isDevelopmentContext(content: string, keywords: any): boolean {
    const contentLower = content.toLowerCase();

    // Look for development indicators
    const devIndicators = [
      'refactor',
      'implement',
      'create function',
      'modify code',
      'update code',
      'code review',
      'test',
      'debug',
      'file.js',
      'file.ts',
      'component',
      'database',
      'query',
      'migration',
      'schema',
      'table',
    ];

    return (
      devIndicators.some(indicator => contentLower.includes(indicator)) ||
      keywords.development.length > 0
    );
  }

  /**
   * Determine if content is in a SQL/database context
   */
  private isSQLContext(content: string, keywords: any): boolean {
    const contentLower = content.toLowerCase();

    // Look for SQL/database context indicators
    const sqlIndicators = ['database', 'table', 'query', 'migration', 'schema', 'sql'];

    return (
      sqlIndicators.some(indicator => contentLower.includes(indicator)) || keywords.sql.length >= 2
    ); // Multiple SQL keywords suggest SQL context
  }

  /**
   * Determine if content is in a system administration context
   */
  private isSystemContext(content: string, keywords: any): boolean {
    const contentLower = content.toLowerCase();

    // Look for system administration context
    const sysIndicators = ['server', 'deploy', 'production', 'system', 'process'];

    return (
      sysIndicators.some(indicator => contentLower.includes(indicator)) ||
      keywords.system.length > 0
    );
  }

  /**
   * Check if content is requesting file modifications
   */
  private isFileModificationRequest(content: string): boolean {
    const contentLower = content.toLowerCase();

    const fileModificationPatterns = [
      /write\s+to\s+file/,
      /modify\s+.*\.js/,
      /change\s+.*\.ts/,
      /update\s+.*file/,
      /edit\s+.*\.json/,
      /create\s+.*\.js/,
    ];

    return (
      fileModificationPatterns.some(pattern => pattern.test(contentLower)) ||
      (contentLower.includes('file') &&
        (contentLower.includes('write') ||
          contentLower.includes('modify') ||
          contentLower.includes('change')))
    );
  }

  private matchesPattern(path: string, pattern: string): boolean {
    // Simple glob-like pattern matching
    const regex = new RegExp(
      pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/\\\\]*').replace(/\?/g, '.')
    );
    return regex.test(path);
  }

  /**
   * Create user consent request (Claude Code pattern)
   */
  async requestUserConsent(
    context: SecurityContext,
    decision: SecurityDecision
  ): Promise<UserConsentRequest> {
    const requestId = `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const request: UserConsentRequest = {
      id: requestId,
      context,
      decision,
      message: this.formatConsentMessage(context, decision),
      options: this.createConsentOptions(decision),
    };

    this.pendingConsentRequests.set(requestId, request);
    this.emit('consentRequired', request);

    return request;
  }

  private formatConsentMessage(context: SecurityContext, decision: SecurityDecision): string {
    let message = `Security Review Required\n\n`;
    message += `Operation: ${context.operation}\n`;
    message += `Risk Level: ${decision.riskLevel.toUpperCase()}\n`;
    message += `Reason: ${decision.reason}\n\n`;

    if (context.filePath) {
      message += `File: ${context.filePath}\n`;
    }
    if (context.command) {
      message += `Command: ${context.command}\n`;
    }

    message += `\nInput: ${context.userInput.substring(0, 200)}${context.userInput.length > 200 ? '...' : ''}\n\n`;
    message += `Would you like to proceed?`;

    return message;
  }

  private createConsentOptions(decision: SecurityDecision): ConsentOption[] {
    const baseOptions: ConsentOption[] = [
      {
        id: 'allow',
        label: 'Allow',
        description: 'Proceed with this operation',
        action: 'allow',
      },
      {
        id: 'deny',
        label: 'Deny',
        description: 'Block this operation',
        action: 'deny',
      },
    ];

    if (decision.suggestedActions?.includes('Modify')) {
      baseOptions.splice(1, 0, {
        id: 'modify',
        label: 'Modify',
        description: 'Suggest a safer alternative',
        action: 'modify',
      });
    }

    return baseOptions;
  }

  /**
   * Get security audit log
   */
  getAuditLog(limit?: number): SecurityContext[] {
    return limit ? this.auditLog.slice(-limit) : [...this.auditLog];
  }

  /**
   * Clear audit log (for privacy)
   */
  clearAuditLog(): void {
    this.auditLog = [];
    this.emit('auditLogCleared');
  }

  /**
   * Update security policy
   */
  updatePolicy(updates: Partial<SecurityPolicy>): void {
    this.policy = { ...this.policy, ...updates };
    this.emit('policyUpdated', this.policy);
  }
}
