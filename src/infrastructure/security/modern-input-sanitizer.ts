/**
 * Modern Input Sanitizer - Claude Code Security Pattern Implementation
 * Replaces keyword-blocking approach with contextual security and user consent
 */

import { ClaudeCodeSecurity, SecurityContext, SecurityDecision } from './claude-code-security.js';
import { EventEmitter } from 'events';

export interface SanitizationResult {
  sanitized: string;
  isValid: boolean;
  violations: string[];
  originalCommand?: string;
  securityDecision?: SecurityDecision;
  requiresConsent?: boolean;
  consentRequestId?: string;
}

export interface ConsentManager extends EventEmitter {
  requestConsent(requestId: string, message: string, options: string[]): Promise<string>;
}

/**
 * Modern input sanitizer using Claude Code security patterns
 */
export class ModernInputSanitizer {
  private static securitySystem = new ClaudeCodeSecurity();
  private static consentManager: ConsentManager | null = null;

  /**
   * Set consent manager for user interaction
   */
  static setConsentManager(manager: ConsentManager): void {
    this.consentManager = manager;
  }

  /**
   * Sanitize prompt with contextual security analysis
   */
  static async sanitizePrompt(
    prompt: string,
    context: Partial<SecurityContext> = {}
  ): Promise<SanitizationResult> {
    const violations: string[] = [];
    let sanitized = prompt.trim();

    // Basic cleanup - remove only truly dangerous characters
    sanitized = this.basicCleanup(sanitized);

    // Length validation
    if (sanitized.length > 50000) {
      // Increased from 10k to 50k for enterprise use
      violations.push('Prompt too long (max 50000 characters)');
      sanitized = sanitized.substring(0, 50000);
    }

    // Create security context
    const securityContext: SecurityContext = {
      operation: context.operation || 'prompt_processing',
      filePath: context.filePath,
      command: context.command,
      userInput: prompt,
      workingDirectory: context.workingDirectory || process.cwd(),
      timestamp: new Date(),
    };

    // Evaluate security using Claude Code patterns
    const securityDecision = await this.securitySystem.evaluateSecurity(securityContext);

    // Handle security decision
    switch (securityDecision.action) {
      case 'allow':
        return {
          sanitized,
          isValid: true,
          violations,
          originalCommand: prompt,
          securityDecision,
        };

      case 'block':
        violations.push(securityDecision.reason);
        return {
          sanitized: '',
          isValid: false,
          violations,
          originalCommand: prompt,
          securityDecision,
        };

      case 'askUser':
        // For now, we'll allow but mark as requiring consent
        // In a full implementation, this would trigger user consent flow
        return {
          sanitized,
          isValid: true,
          violations: [], // No violations - just requires consent
          originalCommand: prompt,
          securityDecision,
          requiresConsent: true,
        };

      default:
        return {
          sanitized,
          isValid: true,
          violations,
          originalCommand: prompt,
          securityDecision,
        };
    }
  }

  /**
   * Sanitize with user consent handling
   */
  static async sanitizeWithConsent(
    prompt: string,
    context: Partial<SecurityContext> = {}
  ): Promise<SanitizationResult> {
    const result = await this.sanitizePrompt(prompt, context);

    if (result.requiresConsent && this.consentManager) {
      try {
        const consentRequest = await this.securitySystem.requestUserConsent(
          {
            operation: context.operation || 'prompt_processing',
            filePath: context.filePath,
            command: context.command,
            userInput: prompt,
            workingDirectory: context.workingDirectory || process.cwd(),
            timestamp: new Date(),
          },
          result.securityDecision!
        );

        const userResponse = await this.consentManager.requestConsent(
          consentRequest.id,
          consentRequest.message,
          consentRequest.options.map(opt => opt.label)
        );

        // Update result based on user consent
        if (userResponse === 'Deny') {
          result.isValid = false;
          result.violations = ['User denied consent'];
        } else if (userResponse === 'Allow') {
          result.requiresConsent = false;
        }

        result.consentRequestId = consentRequest.id;
      } catch (error) {
        // If consent fails, default to allowing (non-blocking)
        console.warn('Consent request failed, allowing operation:', error);
      }
    }

    return result;
  }

  /**
   * Basic cleanup - only remove truly dangerous characters
   */
  private static basicCleanup(input: string): string {
    // Remove null bytes and most control characters (keep newlines and tabs)
    // eslint-disable-next-line no-control-regex
    return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  }

  /**
   * Validate file path using Claude Code CWD pattern with AI preprocessing
   */
  static async validateFilePath(filePath: string): Promise<SanitizationResult> {
    const violations: string[] = [];
    let sanitized = filePath.trim();

    // CRITICAL: Preprocess AI-generated placeholder paths BEFORE security validation
    const originalPath = sanitized;
    
    // Handle placeholder paths like "/path/to/filename.ext"
    if (sanitized.includes('/path/to/') || sanitized.startsWith('/path/')) {
      sanitized = sanitized.split('/').pop() || sanitized;
      console.log(`🔧 MODERN-SECURITY: Converting AI placeholder path "${originalPath}" to filename "${sanitized}"`);
    }
    // Handle simple absolute paths like "/README.md"
    else if (sanitized.startsWith('/') && !sanitized.includes('/', 1)) {
      sanitized = sanitized.substring(1);
      console.log(`🔧 MODERN-SECURITY: Converting AI-generated absolute path "${originalPath}" to relative "${sanitized}"`);
    }
    // Handle any other absolute-looking paths by extracting filename
    else if (sanitized.startsWith('/') && sanitized.split('/').length > 2) {
      sanitized = sanitized.split('/').pop() || sanitized;
      console.log(`🔧 MODERN-SECURITY: Converting complex absolute path "${originalPath}" to filename "${sanitized}"`);
    }

    // Basic path cleanup
    sanitized = sanitized.replace(/\\/g, '/'); // Normalize separators

    // Create security context for file operation
    const context: SecurityContext = {
      operation: 'file_access',
      filePath: sanitized,
      userInput: filePath,
      workingDirectory: process.cwd(),
      timestamp: new Date(),
    };

    const securityDecision = await this.securitySystem.evaluateSecurity(context);

    return {
      sanitized,
      isValid: securityDecision.action === 'allow',
      violations: securityDecision.action === 'block' ? [securityDecision.reason] : [],
      originalCommand: filePath,
      securityDecision,
      requiresConsent: securityDecision.action === 'askUser',
    };
  }

  /**
   * Sanitize voice names (keeping original logic as it's appropriate)
   */
  static sanitizeVoiceNames(voiceNames: string[]): string[] {
    const allowedVoices = new Set([
      'explorer',
      'maintainer',
      'analyzer',
      'developer',
      'implementor',
      'security',
      'architect',
      'designer',
      'optimizer',
    ]);

    return voiceNames
      .map(name => name.trim().toLowerCase())
      .filter(name => allowedVoices.has(name) && /^[a-z]+$/.test(name));
  }

  /**
   * Sanitize slash command (keeping original logic with minor improvements)
   */
  static sanitizeSlashCommand(command: string): SanitizationResult {
    const violations: string[] = [];
    let sanitized = command.trim();

    const ALLOWED_SLASH_COMMANDS = new Set([
      '/help',
      '/voices',
      '/voice',
      '/mode',
      '/todo',
      '/plan',
      '/dual',
      '/dualagent',
      '/stream',
      '/audit',
      '/autoconfig',
      '/config',
    ]);

    // Extract command and arguments
    const parts = sanitized.split(' ');
    const cmd = parts[0]?.toLowerCase() || '';
    const args = parts.slice(1).join(' ');

    // Validate command is in allowed list
    if (!ALLOWED_SLASH_COMMANDS.has(cmd)) {
      violations.push(`Unauthorized command: ${cmd}`);
      return {
        sanitized: '',
        isValid: false,
        violations,
        originalCommand: command,
      };
    }

    // Basic argument cleanup
    const sanitizedArgs = this.basicCleanup(args);

    // Reconstruct command
    sanitized = sanitizedArgs ? `${cmd} ${sanitizedArgs}` : cmd;

    return {
      sanitized,
      isValid: violations.length === 0,
      violations,
      originalCommand: command,
    };
  }

  /**
   * Create security error for audit logging
   */
  static createSecurityError(result: SanitizationResult, context: string): Error {
    const error = new Error(
      `Security review required for ${context}: ${result.violations.join(', ')}`
    );

    // Add metadata for security logging
    (error as any).securityContext = {
      originalInput: result.originalCommand,
      sanitizedInput: result.sanitized,
      violations: result.violations,
      requiresConsent: result.requiresConsent,
      securityDecision: result.securityDecision,
      timestamp: new Date().toISOString(),
      context,
    };

    return error;
  }

  /**
   * Get security audit log
   */
  static getAuditLog(limit?: number): SecurityContext[] {
    return this.securitySystem.getAuditLog(limit);
  }

  /**
   * Clear security audit log
   */
  static clearAuditLog(): void {
    this.securitySystem.clearAuditLog();
  }

  /**
   * Update security policy
   */
  static updateSecurityPolicy(updates: any): void {
    this.securitySystem.updatePolicy(updates);
  }
}
