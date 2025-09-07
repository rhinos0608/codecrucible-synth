#!/usr/bin/env node

/**
 * Secure Terminal Tools - SECURITY HARDENED REPLACEMENT
 *
 * This file replaces the insecure terminal-tools.ts with E2B-enforced
 * secure execution that blocks all direct shell command execution.
 *
 * SECURITY FIXES IMPLEMENTED:
 * ✅ All commands executed in E2B sandboxes only
 * ✅ No direct shell command execution
 * ✅ No environment variable exposure
 * ✅ Comprehensive command validation
 * ✅ Audit logging for security monitoring
 * ✅ Resource limits and timeouts enforced
 */

import { z } from 'zod';
import { BaseTool } from './base-tool';
import { SecureExecutionManager } from '../security/secure-execution-manager';
import { logger } from '../logging/logger';

// Schema definitions
const SecureTerminalExecuteSchema = z.object({
  command: z.string().describe('Command to execute in secure sandbox'),
  language: z
    .enum(['bash', 'shell', 'python'])
    .optional()
    .default('bash')
    .describe('Execution language/environment'),
  workingDirectory: z.string().optional().describe('Working directory (sandboxed)'),
  timeout: z.number().optional().default(30000).describe('Timeout in milliseconds (max 30s)'),
  sessionId: z.string().optional().describe('Session ID for sandbox reuse'),
});

const SecureProcessManagementSchema = z.object({
  action: z
    .enum(['list', 'status'])
    .describe('Process management action (kill operations not allowed for security)'),
  sessionId: z.string().optional().describe('Sandbox session ID'),
});

const SecureShellEnvironmentSchema = z.object({
  action: z.enum(['pwd', 'whoami', 'which', 'env']).describe('Environment query action'),
  command: z.string().optional().describe('Command to locate with which'),
  sessionId: z.string().optional().describe('Sandbox session ID'),
});

const TerminalExecuteSchema = z.object({
  command: z.string(),
});

/**
 * Secure Terminal Command Execution Tool
 *
 * This tool replaces the unsafe TerminalExecuteTool with secure E2B execution.
 * All commands are executed in isolated E2B sandboxes with no access to the host system.
 */
export class SecureTerminalExecuteTool extends BaseTool<typeof SecureTerminalExecuteSchema.shape> {
  private readonly secureExecutionManager: SecureExecutionManager;

  public constructor(private readonly _agentContext: Readonly<{ workingDirectory: string }>) {
    const parameters = SecureTerminalExecuteSchema;

    super({
      name: 'executeSecureCommand',
      description:
        'Execute terminal commands in secure E2B sandbox environment (NO DIRECT HOST ACCESS)',
      category: 'SecureTerminal',
      parameters,
    });

    this.secureExecutionManager = new SecureExecutionManager();
  }

  public async execute(
    args: Readonly<z.infer<typeof this.definition.parameters>>
  ): Promise<{
    success: boolean;
    command: string;
    exitCode: number;
    stdout: string;
    stderr: string;
    executionTime: number;
    backend: string;
    sessionId: string;
    securityWarnings?: string[];
    workingDirectory: string;
    sandboxed: true;
    message: string;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Initialize secure execution manager if needed
      if (!this.secureExecutionManager.getStats().isInitialized) {
        await this.secureExecutionManager.initialize();
      }

      const commandStr = typeof args.command === 'string' ? args.command : '';
      logger.info(
        `🔒 Executing secure command: ${commandStr.substring(0, 50)}${commandStr.length > 50 ? '...' : ''}`
      );

      // Execute securely via E2B sandbox
      const result = await this.secureExecutionManager.executeSecurely({
        command: commandStr,
        language: args.language === 'bash' || args.language === 'shell' ? 'bash' : (args.language as 'bash' | 'python'),
        workingDirectory: typeof args.workingDirectory === 'string' ? args.workingDirectory : '/tmp',
        timeout: Math.min(typeof args.timeout === 'number' ? args.timeout : 30000, 30000), // Max 30 seconds
        sessionId: typeof args.sessionId === 'string' ? args.sessionId : undefined,
      });

      // Log security warnings if any
      if (result.securityWarnings && result.securityWarnings.length > 0) {
        logger.warn('🚨 Security warnings during execution:', result.securityWarnings);
      }

      return {
        success: result.success,
        command: args.command as string,
        exitCode: result.exitCode,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        executionTime: result.executionTime,
        backend: result.backend,
        sessionId: result.sessionId,
        securityWarnings: result.securityWarnings,
        workingDirectory: args.workingDirectory as string,
        sandboxed: true, // Always true for this secure implementation
        message: result.success
          ? 'Command executed successfully in secure sandbox'
          : 'Command failed in secure sandbox',
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('❌ Secure terminal execution failed:', error);

      return {
        success: false,
        command: args.command as string,
        exitCode: 1,
        stdout: '',
        stderr: `Secure execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime,
        backend: 'error',
        sessionId: (args.sessionId as string) ?? 'unknown',
        sandboxed: true,
        workingDirectory: '/tmp',
        message: 'Secure execution failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Secure Process Management Tool
 *
 * Provides safe process management within E2B sandboxes only.
 * No access to host system processes.
 */
interface ProcessManagementResult {
  success: boolean;
  error?: string;
  message?: string;
  processes?: string;
  sandboxed?: boolean;
  sessionId?: string;
  sandboxStats?: Record<string, unknown>;
  securityConfig?: {
    enforceE2BOnly: boolean;
    auditLog: boolean;
    maxExecutionTime: number;
  };
  isInitialized?: boolean;
}

interface _ListProcessesResult {
  success: boolean;
  processes?: string;
  sandboxed?: boolean;
  message?: string;
  sessionId?: string;
  error?: string;
}

interface _SandboxStatusResult {
  success: boolean;
  sandboxStats?: Record<string, unknown>;
  securityConfig?: {
    enforceE2BOnly: boolean;
    auditLog: boolean;
    maxExecutionTime: number;
  };
  isInitialized?: boolean;
  message?: string;
  error?: string;
}

export class SecureProcessManagementTool extends BaseTool<typeof SecureProcessManagementSchema.shape> {
  private readonly secureExecutionManager: SecureExecutionManager;

  public constructor() {
    const parameters = SecureProcessManagementSchema;

    super({
      name: 'manageSecureProcesses',
      description: 'Manage processes within secure sandbox environment only (NO HOST ACCESS)',
      category: 'SecureTerminal',
      parameters,
    });

    this.secureExecutionManager = new SecureExecutionManager();
  }

  public async execute(args: Readonly<z.infer<typeof this.definition.parameters>>): Promise<ProcessManagementResult> {
    try {
      // Initialize secure execution manager if needed
      if (!this.secureExecutionManager.getStats().isInitialized) {
        await this.secureExecutionManager.initialize();
      }

      switch (args.action) {
        case 'list':
          return await this.listSandboxProcesses(
            typeof args.sessionId === 'string' ? args.sessionId : undefined
          );

        case 'status':
          return this.getSandboxStatus();

        default:
          return {
            success: false,
            error: `Action not allowed for security: ${args.action}`,
            message: 'Only list and status operations are permitted in secure mode',
          };
      }
    } catch (error) {
      logger.error('❌ Secure process management failed:', error);
      return {
        success: false,
        error: `Process management failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async listSandboxProcesses(sessionId?: string): Promise<_ListProcessesResult> {
    try {
      const result = await this.secureExecutionManager.executeSecurely({
        command: 'ps aux',
        language: 'bash',
        sessionId: sessionId ?? 'temp_ps',
        timeout: 10000,
      });

      return {
        success: result.success,
        processes: result.stdout ?? '',
        sandboxed: true,
        message: 'Process list from secure sandbox environment',
        sessionId: result.sessionId,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list sandbox processes: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private getSandboxStatus(): _SandboxStatusResult {
    try {
      const stats = this.secureExecutionManager.getStats();

      return {
        success: true,
        sandboxStats: stats.e2bService as Record<string, unknown>,
        securityConfig: {
          enforceE2BOnly: stats.config.enforceE2BOnly,
          auditLog: stats.config.auditLog,
          maxExecutionTime: stats.config.maxExecutionTime,
        },
        isInitialized: stats.isInitialized,
        message: 'Secure execution environment status',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get sandbox status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

/**
 * Secure Shell Environment Tool
 *
 * Provides safe environment information from sandbox only.
 * No access to host environment variables or system information.
 */
export class SecureShellEnvironmentTool extends BaseTool<typeof SecureShellEnvironmentSchema.shape> {
  private readonly secureExecutionManager: SecureExecutionManager;

  public constructor(private readonly _agentContext: Readonly<{ workingDirectory: string }>) {
    const parameters = SecureShellEnvironmentSchema;

    super({
      name: 'secureShellEnvironment',
      description: 'Get sandbox environment information safely (NO HOST ACCESS)',
      category: 'SecureTerminal',
      parameters,
    });

    this.secureExecutionManager = new SecureExecutionManager();
  }

  public async execute(
    args: Readonly<z.infer<typeof this.definition.parameters>>
  ): Promise<{
    success: boolean;
    action: 'pwd' | 'whoami' | 'which' | 'env';
    output: string;
    error: string;
    sandboxed: boolean;
    message: string;
    sessionId: string;
  } | { success: false; error: string }> {
    try {
      // Initialize secure execution manager if needed
      if (!this.secureExecutionManager.getStats().isInitialized) {
        await this.secureExecutionManager.initialize();
      }

      let command: string;

      switch (args.action) {
        case 'pwd':
          command = 'pwd';
          break;

        case 'whoami':
          command = 'whoami';
          break;

        case 'which':
          if (!args.command) {
            return { success: false, error: 'Command parameter required for which action' };
          }
          command = `which ${args.command}`;
          break;

        case 'env':
          command = 'env | head -20'; // Limit environment output
          break;

        default:
          return { success: false, error: `Unknown action: ${String(args.action)}` };
      }

      const result = await this.secureExecutionManager.executeSecurely({
        command,
        language: 'bash',
        sessionId: typeof args.sessionId === 'string' ? args.sessionId : 'temp_env',
        timeout: 10000,
      });

      return {
        success: result.success,
        action: args.action as 'pwd' | 'whoami' | 'which' | 'env',
        output: result.stdout ?? '',
        error: result.stderr ?? '',
        sandboxed: true,
        message: `Environment query executed in secure sandbox`,
        sessionId: result.sessionId ?? '',
      };
    } catch (error) {
      logger.error('❌ Secure environment query failed:', error);
      return {
        success: false,
        error: `Environment query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

/**
 * Legacy Terminal Tool Blocker
 *
 * This class replaces the original TerminalExecuteTool to block
 * any remaining references to unsafe execution.
 */
export class TerminalExecuteTool extends BaseTool<typeof TerminalExecuteSchema.shape> {
  public constructor(_agentContext: unknown) {
    const parameters = TerminalExecuteSchema;

    super({
      name: 'blockedUnsafeTerminal',
      description: 'SECURITY BLOCKED: Use SecureTerminalExecuteTool instead',
      category: 'SecurityBlocked',
      parameters,
    });

    logger.warn(
      '🚨 SECURITY WARNING: TerminalExecuteTool is blocked. Use SecureTerminalExecuteTool.'
    );
  }

  public async execute(_args: unknown): Promise<{
    success: false;
    error: string;
    exitCode: number;
    blocked: true;
    recommendation: string;
    securityReason: string;
  }> {
    logger.error(`🚨 SECURITY BLOCK: Attempt to use unsafe TerminalExecuteTool blocked`);
    logger.info('✅ Use SecureTerminalExecuteTool for safe command execution');

    return {
      success: false,
      error:
        'SECURITY BLOCKED: Direct terminal execution is disabled for security. Use SecureTerminalExecuteTool instead.',
      exitCode: 403,
      blocked: true,
      recommendation: 'Use SecureTerminalExecuteTool for safe, sandboxed command execution',
      securityReason:
        'Direct shell access poses security risks including command injection and host system compromise',
    };
  }
}

// Export legacy class names for compatibility but block their usage
export { TerminalExecuteTool as UnsafeTerminalExecuteTool };
export { SecureTerminalExecuteTool as DefaultTerminalExecuteTool };
