import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../logging/logger.js';
import {
  ErrorCategory,
  ErrorFactory,
  ErrorHandler,
  ErrorSeverity,
  ServiceResponse,
} from '../../error-handling/structured-error-system.js';
import type { BackendConfig, ExecutionOptions, ExecutionResult } from '../execution-types.js';
import { ExecutionBackend } from '../base-execution-backend.js';

const execAsync = promisify(exec);

export class LocalProcessBackend extends ExecutionBackend {
  private readonly dangerousCommands = [
    'rm',
    'del',
    'format',
    'fdisk',
    'dd',
    'mkfs',
    'shutdown',
    'reboot',
    'halt',
    'poweroff',
    'sudo',
    'su',
    'chmod',
    'chown',
    'passwd',
  ];

  public constructor(config: Readonly<BackendConfig>) {
    super({
      ...config,
      localSafeguards: config.localSafeguards !== false,
    });
  }

  public async execute(
    command: string,
    options: Readonly<ExecutionOptions> = {}
  ): Promise<ServiceResponse<ExecutionResult>> {
    if (this.config.localSafeguards) {
      const safety = this.checkCommandSafety(command);
      if (!safety.safe) {
        return ErrorHandler.createErrorResponse(
          ErrorFactory.createError(
            `Dangerous command blocked: ${safety.reason}`,
            ErrorCategory.AUTHORIZATION,
            ErrorSeverity.HIGH,
            {
              context: {
                operation: 'localProcessExecute',
                timestamp: Date.now(),
                component: 'local-process-backend',
                metadata: { command, blocked: safety.reason },
              },
              recoverable: false,
              suggestedActions: [
                'Use Docker or E2B backend for dangerous commands',
                'Disable safeguards if you understand the risks',
              ],
            }
          )
        );
      }
    }

    const acquired = await this.acquireExecutionSlot();
    if (!acquired) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          'Too many concurrent local executions',
          ErrorCategory.SYSTEM,
          ErrorSeverity.MEDIUM,
          {
            userMessage: 'Execution queue is full',
            suggestedActions: ['Wait for current executions to complete'],
            retryable: true,
          }
        )
      );
    }

    const startTime = Date.now();

    try {
      if (options.workingDirectory) {
        const validatedDir = this.validateWorkingDirectory(options.workingDirectory);
        if (!validatedDir.safe) {
          return ErrorHandler.createErrorResponse(
            ErrorFactory.createError(
              `Invalid working directory: ${validatedDir.reason}`,
              ErrorCategory.AUTHORIZATION,
              ErrorSeverity.HIGH,
              {
                context: { workingDirectory: options.workingDirectory },
                userMessage: 'Working directory is not safe',
                suggestedActions: ['Use a directory within the current project'],
              }
            )
          );
        }
      }

      logger.debug(`Executing locally: ${command}`);

      const safeEnvVars = {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? process.env.USERPROFILE ?? '',
        TEMP: process.env.TEMP ?? process.env.TMP ?? '/tmp',
        USER: process.env.USER ?? process.env.USERNAME ?? 'unknown',
      };

      const result = await execAsync(command, {
        cwd: options.workingDirectory,
        env: { ...safeEnvVars, ...options.environment },
        timeout: options.timeout ?? 30000,
        maxBuffer: options.maxOutputSize ?? 1024 * 1024 * 10,
      });

      const duration = Date.now() - startTime;

      return ErrorHandler.createSuccessResponse({
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
        success: true,
        duration,
        backend: 'local_process',
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errObj = error as {
        killed?: boolean;
        signal?: string;
        message?: string;
        stdout?: string;
        stderr?: string;
        code?: number;
      };

      if (errObj?.killed && errObj?.signal === 'SIGTERM') {
        return ErrorHandler.createErrorResponse(
          ErrorFactory.createError(
            'Execution timeout',
            ErrorCategory.SYSTEM,
            ErrorSeverity.MEDIUM,
            {
              userMessage: 'Command execution timed out',
              suggestedActions: ['Increase timeout', 'Optimize command'],
              retryable: true,
            }
          )
        );
      }

      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `Local execution failed: ${errObj.message ?? 'Unknown error'}`,
          ErrorCategory.TOOL_EXECUTION,
          ErrorSeverity.MEDIUM,
          {
            context: { command },
            originalError: error instanceof Error ? error : undefined,
            userMessage: 'Local command execution failed',
            suggestedActions: [
              'Check command syntax',
              'Verify required tools are installed',
              'Try Docker or E2B backend for isolation',
            ],
            retryable: true,
            metadata: {
              stdout: errObj.stdout ?? '',
              stderr: errObj.stderr ?? errObj.message ?? '',
              exitCode: errObj.code ?? 1,
              duration,
              backend: 'local_process',
            },
          }
        )
      );
    } finally {
      this.releaseExecutionSlot();
    }
  }

  private checkCommandSafety(command: string): {
    safe: boolean;
    reason?: string;
  } {
    const lowerCommand = command.toLowerCase();
    const dangerousPatterns = [
      /\b(rm|del|format|fdisk|dd|mkfs)\b/,
      /\b(shutdown|reboot|halt|poweroff)\b/,
      /\b(sudo|su|chmod|chown|passwd)\b/,
      /subprocess\.(call|run|popen)/,
      /os\.system/,
      /os\.popen/,
      /exec\(/,
      /eval\(/,
      /[;&`$()]/,
      />\s*\/dev\//,
      /\|\s*sh/,
      /\|\s*bash/,
      /\/\/+|\.\.\/|~\//,
      /\/etc\/|\/bin\/|\/usr\/|\/var\/|\/root\//,
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(lowerCommand)) {
        return { safe: false, reason: `Potentially dangerous pattern detected: ${pattern.source}` };
      }
    }
    const tokens = command.split(/\s+/);
    const firstToken = tokens[0]?.toLowerCase();
    if (this.dangerousCommands.includes(firstToken)) {
      return { safe: false, reason: `Dangerous command: ${firstToken}` };
    }
    if (this.config.allowedCommands && this.config.allowedCommands.length > 0) {
      if (!this.config.allowedCommands.includes(firstToken)) {
        return { safe: false, reason: `Command not in allowed list: ${firstToken}` };
      }
    }
    if (command.length > 10000) {
      return { safe: false, reason: 'Command too long (potential buffer overflow)' };
    }
    return { safe: true };
  }

  public async cleanup(): Promise<void> {
    logger.info('Local process backend cleanup (nothing to clean)');
    this.activeExecutions = 0;
  }

  public getStatus(): {
    type: string;
    active: number;
    available: boolean;
    config: {
      safeguards?: boolean;
      allowedCommands?: string[];
    };
  } {
    return {
      type: 'local_process',
      active: this.activeExecutions,
      available: this.canExecute(),
      config: {
        safeguards: this.config.localSafeguards,
        allowedCommands: this.config.allowedCommands,
      },
    };
  }
}
