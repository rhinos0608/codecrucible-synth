#!/usr/bin/env node

/**
 * Secure Execution Manager - SECURITY CRITICAL COMPONENT
 *
 * This component enforces secure code execution policies and replaces
 * all unsafe direct execution with E2B sandboxed execution.
 *
 * CRITICAL SECURITY FIXES:
 * - Blocks direct shell command execution
 * - Enforces E2B sandboxing for all code execution
 * - Implements comprehensive command validation
 * - Removes environment variable exposure
 * - Adds audit logging for security monitoring
 */

import { E2BService } from '../tools/e2b/e2b-service.js';
import { SecurityValidator } from '../tools/e2b/security-validator.js';
import { logger } from '../logging/logger.js';
import { z } from 'zod';

export interface SecureExecutionConfig {
  enforceE2BOnly: boolean;
  allowLocalExecution: boolean;
  auditLog: boolean;
  maxExecutionTime: number;
  allowedCommands: string[];
  blockedPatterns: RegExp[];
}

export interface ExecutionRequest {
  command: string;
  language?: string;
  workingDirectory?: string;
  timeout?: number;
  environment?: Record<string, string>;
  sessionId?: string;
}

export interface ExecutionResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode: number;
  executionTime: number;
  sessionId: string;
  securityWarnings?: string[];
  backend: 'e2b' | 'blocked' | 'error';
}

/**
 * Secure Execution Manager - Enforces security policies for all code execution
 */
export class SecureExecutionManager {
  private e2bService: E2BService;
  private securityValidator: SecurityValidator;
  private config: SecureExecutionConfig;
  private isInitialized: boolean = false;

  constructor(config?: Partial<SecureExecutionConfig>) {
    this.config = {
      enforceE2BOnly: true, // ✅ SECURITY: Only allow E2B execution
      allowLocalExecution: false, // ❌ SECURITY: Block unsafe local execution
      auditLog: true, // ✅ SECURITY: Enable audit logging
      maxExecutionTime: 30000, // 30 second timeout
      allowedCommands: [
        'ls',
        'cat',
        'grep',
        'find',
        'pwd',
        'whoami',
        'git',
        'npm',
        'node',
        'python',
        'pip',
        'tsc',
        'jest',
        'echo',
        'mkdir',
        'touch',
      ],
      blockedPatterns: [
        /rm\s+-rf\s*\/[^/\s]*/gi, // Dangerous delete commands
        /sudo\s+(rm|chmod|chown|passwd)/gi, // Sudo with dangerous commands
        /eval\s*\(\s*[^)]*\$[^)]*\)/gi, // Dynamic code evaluation
        /exec\s*\(\s*[^)]*\$[^)]*\)/gi, // Dynamic code execution
        /system\s*\(\s*[^)]*\$[^)]*\)/gi, // System calls with variables
        /shell_exec\s*\(\s*[^)]*\$[^)]*\)/gi, // Shell execution with variables
        /\|\s*(sh|bash|zsh|fish|csh)/gi, // Piping to shell
        />\s*\/dev\/(zero|null|random)/gi, // Redirecting to device files
        /dd\s+if=/gi, // Disk dump commands
        /mkfs/gi, // File system creation
        /fdisk/gi, // Disk partitioning
        /format/gi, // Format commands
        /shutdown|reboot|halt|poweroff/gi, // System shutdown commands
        /&&\s*(rm|del|format)/gi, // Chained dangerous commands
        /;\s*(rm|del|format)/gi, // Semicolon chained commands
        /\$\(.*\)/gi, // Command substitution
        /`.*`/gi, // Backtick command execution
        /curl\s+.*\|\s*(sh|bash)/gi, // Remote code execution
        /wget\s+.*\|\s*(sh|bash)/gi, // Remote code execution
        /nc\s+-[^s]*e/gi, // Netcat with command execution
      ],
      ...config,
    };

    this.e2bService = new E2BService();
    this.securityValidator = new SecurityValidator();
  }

  /**
   * Initialize the secure execution manager
   */
  async initialize(): Promise<void> {
    try {
      await this.e2bService.initialize();
      this.isInitialized = true;

      logger.info('🔒 Secure Execution Manager initialized - E2B enforcement active');

      if (this.config.enforceE2BOnly) {
        logger.warn('⚠️  SECURITY ENFORCEMENT: Local command execution is BLOCKED');
        logger.info('✅ All code execution will be sandboxed via E2B');
      }
    } catch (error) {
      logger.error('❌ Failed to initialize Secure Execution Manager:', error);

      if (this.config.enforceE2BOnly) {
        throw new Error(
          'SECURITY CRITICAL: Cannot initialize E2B service. Code execution disabled for security.'
        );
      }

      throw error;
    }
  }

  /**
   * Execute code securely with comprehensive security validation
   */
  async executeSecurely(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Audit log the execution request
      if (this.config.auditLog) {
        this.auditLogExecution(request);
      }

      // Validate that E2B is available if enforced
      if (this.config.enforceE2BOnly && !this.isInitialized) {
        return this.createBlockedResult(
          'E2B service not available and local execution is blocked for security',
          startTime,
          request.sessionId
        );
      }

      // Comprehensive security validation
      const securityValidation = await this.validateExecutionSecurity(request);
      if (!securityValidation.isValid) {
        return this.createBlockedResult(
          `Security validation failed: ${securityValidation.reason}`,
          startTime,
          request.sessionId,
          [securityValidation.reason || 'Security validation failed']
        );
      }

      // Force E2B execution if enforcement is enabled
      if (this.config.enforceE2BOnly) {
        return await this.executeViaE2B(request, startTime);
      }

      // This should never be reached in production with enforceE2BOnly=true
      logger.error('🚨 SECURITY WARNING: Execution request not handled by E2B enforcement');
      return this.createBlockedResult(
        'Execution blocked: No secure execution path available',
        startTime,
        request.sessionId
      );
    } catch (error) {
      logger.error('❌ Secure execution failed:', error);

      return {
        success: false,
        stderr: `Secure execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        exitCode: 1,
        executionTime: Date.now() - startTime,
        sessionId: request.sessionId || 'unknown',
        backend: 'error',
      };
    }
  }

  /**
   * Execute code via E2B sandbox
   */
  private async executeViaE2B(
    request: ExecutionRequest,
    startTime: number
  ): Promise<ExecutionResult> {
    try {
      const sessionId = request.sessionId || this.generateSessionId();

      // Prepare secure execution environment
      const sanitizedRequest = this.sanitizeExecutionRequest(request);

      // Execute in E2B sandbox
      const result = await this.e2bService.executeCode(
        sessionId,
        sanitizedRequest.command,
        sanitizedRequest.language || 'python'
      );

      logger.info(
        `✅ E2B execution completed - Success: ${result.success}, Time: ${result.executionTime}ms`
      );

      return {
        success: result.success,
        stdout: result.output,
        stderr: result.error,
        exitCode: result.success ? 0 : 1,
        executionTime: Date.now() - startTime,
        sessionId,
        backend: 'e2b',
      };
    } catch (error) {
      logger.error('❌ E2B execution failed:', error);

      return {
        success: false,
        stderr: `E2B execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        exitCode: 1,
        executionTime: Date.now() - startTime,
        sessionId: request.sessionId || 'unknown',
        backend: 'error',
      };
    }
  }

  /**
   * Validate execution security
   */
  private async validateExecutionSecurity(
    request: ExecutionRequest
  ): Promise<{ isValid: boolean; reason?: string; severity?: string }> {
    try {
      // Basic input validation
      if (!request.command || typeof request.command !== 'string') {
        return {
          isValid: false,
          reason: 'Invalid command: must be a non-empty string',
          severity: 'high',
        };
      }

      if (request.command.length > 10000) {
        return {
          isValid: false,
          reason: 'Command too long (max 10,000 characters)',
          severity: 'high',
        };
      }

      // Check against blocked patterns
      for (const pattern of this.config.blockedPatterns) {
        if (pattern.test(request.command)) {
          return {
            isValid: false,
            reason: `Command matches blocked security pattern: ${pattern.source}`,
            severity: 'critical',
          };
        }
      }

      // Command allowlist validation (if enforcing allowlist)
      if (this.config.allowedCommands.length > 0) {
        const firstWord = request.command.trim().split(/\s+/)[0];
        const isAllowed = this.config.allowedCommands.some(
          allowed => firstWord === allowed || firstWord.startsWith(`${allowed}.`)
        );

        if (!isAllowed) {
          return {
            isValid: false,
            reason: `Command not in allowlist: ${firstWord}`,
            severity: 'high',
          };
        }
      }

      // Use the advanced security validator
      const validationResult = await this.securityValidator.validateCode({
        code: request.command,
        language: request.language || 'javascript',
        environment: typeof request.environment === 'string' ? request.environment : 'node18-safe',
      });

      if (!validationResult.isValid) {
        return {
          isValid: false,
          reason: validationResult.reason,
          severity: validationResult.severity,
        };
      }

      return { isValid: true };
    } catch (error) {
      logger.error('Security validation error:', error);
      return {
        isValid: false,
        reason: 'Security validation system error',
        severity: 'critical',
      };
    }
  }

  /**
   * Sanitize execution request to remove potentially dangerous elements
   */
  private sanitizeExecutionRequest(request: ExecutionRequest): ExecutionRequest {
    const sanitized: ExecutionRequest = {
      command: request.command.trim(),
      language: request.language || 'python',
      workingDirectory: request.workingDirectory || '/tmp',
      timeout: Math.min(request.timeout || 30000, this.config.maxExecutionTime),
      sessionId: request.sessionId,
    };

    // Remove dangerous environment variables
    if (request.environment) {
      sanitized.environment = {};
      for (const [key, value] of Object.entries(request.environment)) {
        // Only allow safe environment variables
        if (this.isSafeEnvironmentVariable(key, value)) {
          sanitized.environment[key] = value;
        }
      }
    }

    return sanitized;
  }

  /**
   * Check if environment variable is safe to pass through
   */
  private isSafeEnvironmentVariable(key: string, value: string): boolean {
    // Block dangerous environment variables
    const dangerousEnvVars = [
      'PATH',
      'LD_LIBRARY_PATH',
      'LD_PRELOAD',
      'DYLD_LIBRARY_PATH',
      'HOME',
      'USER',
      'USERNAME',
      'SHELL',
      'TERM',
      'SSH_AUTH_SOCK',
      'SSH_AGENT_PID',
      'SSH_CONNECTION',
      'SUDO_USER',
      'SUDO_UID',
      'SUDO_GID',
      'SUDO_COMMAND',
    ];

    if (dangerousEnvVars.includes(key.toUpperCase())) {
      return false;
    }

    // Block environment variables with dangerous patterns
    if (
      key.startsWith('_') ||
      key.includes('PASSWORD') ||
      key.includes('SECRET') ||
      key.includes('TOKEN')
    ) {
      return false;
    }

    // Block values with dangerous patterns
    if (
      value.includes(';') ||
      value.includes('&&') ||
      value.includes('||') ||
      value.includes('`')
    ) {
      return false;
    }

    return true;
  }

  /**
   * Create a blocked execution result
   */
  private createBlockedResult(
    reason: string,
    startTime: number,
    sessionId?: string,
    securityWarnings?: string[]
  ): ExecutionResult {
    logger.warn(`🚨 Execution blocked: ${reason}`);

    return {
      success: false,
      stderr: `Execution blocked for security: ${reason}`,
      exitCode: 403, // Forbidden
      executionTime: Date.now() - startTime,
      sessionId: sessionId || 'unknown',
      securityWarnings,
      backend: 'blocked',
    };
  }

  /**
   * Audit log execution requests for security monitoring
   */
  private auditLogExecution(request: ExecutionRequest): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action: 'code_execution',
      command: request.command,
      language: request.language,
      sessionId: request.sessionId,
      workingDirectory: request.workingDirectory,
      hasEnvironment: !!request.environment,
      environmentVarCount: request.environment ? Object.keys(request.environment).length : 0,
      commandLength: request.command.length,
      timeout: request.timeout,
    };

    logger.info('🔍 AUDIT: Code execution request', auditEntry);
  }

  /**
   * Generate a secure session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `sec_${timestamp}_${random}`;
  }

  /**
   * Get execution statistics for monitoring
   */
  getStats(): {
    e2bService: any;
    config: SecureExecutionConfig;
    isInitialized: boolean;
  } {
    return {
      e2bService: this.e2bService.getStats(),
      config: this.config,
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Shutdown and cleanup resources
   */
  async shutdown(): Promise<void> {
    await this.e2bService.shutdown();
    this.isInitialized = false;
    logger.info('🔒 Secure Execution Manager shut down');
  }
}

/**
 * Default secure execution manager instance
 */
export const secureExecutionManager = new SecureExecutionManager();
