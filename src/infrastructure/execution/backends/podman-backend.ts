import { randomBytes } from 'crypto';
import { resolve } from 'path';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../logging/logger.js';
import {
  ErrorCategory,
  ErrorFactory,
  ErrorHandler,
  ErrorSeverity,
  ServiceResponse,
} from '../../error-handling/structured-error-system.js';
import type { ExecutionOptions, ExecutionResult, BackendConfig } from '../execution-types.js';
import { ExecutionBackend } from '../base-execution-backend.js';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export class PodmanBackend extends ExecutionBackend {
  private readonly containerPrefix = 'codecrucible_pod';
  private readonly activeContainers = new Set<string>();

  public constructor(config: Readonly<BackendConfig>) {
    super({
      ...config,
      podmanImage: config.podmanImage ?? 'python:3.11-slim',
      podmanRootless: config.podmanRootless !== false,
      podmanNetworkMode: config.podmanNetworkMode ?? 'none',
    });
  }

  public async execute(
    command: string,
    options: Readonly<ExecutionOptions> = {}
  ): Promise<ServiceResponse<ExecutionResult>> {
    const acquired = await this.acquireExecutionSlot();
    if (!acquired) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          'Too many concurrent Podman containers',
          ErrorCategory.SYSTEM,
          ErrorSeverity.MEDIUM,
          {
            context: {
              operation: 'podmanExecute',
              timestamp: Date.now(),
              component: 'podman-backend',
            },
            recoverable: true,
            suggestedActions: ['Wait for current executions to complete'],
          }
        )
      );
    }

    const startTime = Date.now();
    const containerId = `${this.containerPrefix}_${randomBytes(8).toString('hex')}`;

    try {
      const podmanArgs = [
        'run',
        '--rm',
        '--name',
        containerId,
        '--memory',
        '512m',
        '--cpus',
        '1',
        '--network',
        this.config.podmanNetworkMode || 'none',
      ];

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
        podmanArgs.push('-w', '/workspace');
        podmanArgs.push('-v', `${resolve(options.workingDirectory)}:/workspace:ro,Z`);
      }

      if (options.environment) {
        const safeEnvVars = this.filterEnvironmentVariables(options.environment);
        for (const [key, value] of Object.entries(safeEnvVars)) {
          podmanArgs.push('-e', `${key}=${value}`);
        }
      }

      if (this.config.podmanRootless) {
        podmanArgs.push('--security-opt', 'no-new-privileges');
        podmanArgs.push('--cap-drop', 'ALL');
        podmanArgs.push('--read-only');
      }

      if (!this.config.podmanImage) {
        return ErrorHandler.createErrorResponse(
          ErrorFactory.createError(
            'Podman image is not defined',
            ErrorCategory.CONFIGURATION,
            ErrorSeverity.HIGH,
            {
              context: { command, containerId },
              userMessage: 'Podman image must be specified in the backend configuration',
              suggestedActions: ['Set podmanImage in the backend config'],
            }
          )
        );
      }
      podmanArgs.push(this.config.podmanImage, 'bash', '-c', command);

      logger.debug(`Executing in Podman: ${command}`, { containerId });
      this.activeContainers.add(containerId);

      const result = await execFileAsync('podman', podmanArgs, {
        timeout: options.timeout || 30000,
        maxBuffer: options.maxOutputSize || 1024 * 1024 * 10,
      });

      const duration = Date.now() - startTime;

      return ErrorHandler.createSuccessResponse({
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
        success: true,
        duration,
        backend: 'podman',
        metadata: { containerId },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      if (
        (error as { killed?: boolean; signal?: string })?.killed &&
        (error as { signal?: string }).signal === 'SIGTERM'
      ) {
        return ErrorHandler.createErrorResponse(
          ErrorFactory.createError(
            'Execution timeout',
            ErrorCategory.SYSTEM,
            ErrorSeverity.MEDIUM,
            {
              context: { command, timeout: options.timeout },
              userMessage: 'Command execution timed out',
              suggestedActions: ['Increase timeout', 'Optimize command'],
              retryable: true,
            }
          )
        );
      }

      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `Podman execution failed: ${
            typeof error === 'object' && error !== null && 'message' in error
              ? (error as { message?: string }).message
              : 'Unknown error'
          }`,
          ErrorCategory.TOOL_EXECUTION,
          ErrorSeverity.HIGH,
          {
            context: { command, containerId },
            originalError: error instanceof Error ? error : undefined,
            userMessage: 'Podman container execution failed',
            suggestedActions: [
              'Check Podman installation',
              'Verify image availability',
              'Try Docker or local execution',
            ],
            retryable: true,
            metadata: {
              stdout:
                typeof error === 'object' && error !== null && 'stdout' in error
                  ? ((error as { stdout?: string }).stdout ?? '')
                  : '',
              stderr:
                typeof error === 'object' && error !== null && 'stderr' in error
                  ? ((error as { stderr?: string }).stderr ??
                    (error as { message?: string }).message ??
                    '')
                  : typeof error === 'object' && error !== null && 'message' in error
                    ? ((error as { message?: string }).message ?? '')
                    : '',
              exitCode:
                typeof error === 'object' && error !== null && 'code' in error
                  ? ((error as { code?: number }).code ?? 1)
                  : 1,
              duration,
              backend: 'podman',
            },
          }
        )
      );
    } finally {
      this.releaseExecutionSlot();
      this.activeContainers.delete(containerId);
      try {
        await execAsync(`podman rm -f ${containerId} 2>/dev/null`);
      } catch {
        // ignore
      }
    }
  }

  private filterEnvironmentVariables(env: Record<string, string>): Record<string, string> {
    const safeVars: Record<string, string> = {};
    const allowedPrefixes = ['LANG', 'LC_', 'TZ', 'TERM', 'PATH'];
    const blockedVars = ['HOME', 'USER', 'SSH_', 'AWS_', 'GCP_', 'AZURE_'];

    for (const [key, value] of Object.entries(env)) {
      if (allowedPrefixes.some(prefix => key.startsWith(prefix))) {
        safeVars[key] = value;
        continue;
      }
      if (blockedVars.some(blocked => key.startsWith(blocked))) {
        continue;
      }
      if (key.startsWith('APP_') || key.startsWith('DEBUG') || key.startsWith('NODE_')) {
        safeVars[key] = value;
      }
    }

    return safeVars;
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up Podman backend');
    for (const containerId of this.activeContainers) {
      try {
        await execAsync(`podman rm -f ${containerId}`);
      } catch (error) {
        logger.warn(`Failed to remove container ${containerId}:`, error);
      }
    }
    this.activeContainers.clear();
    this.activeExecutions = 0;
  }

  public getStatus(): {
    type: string;
    active: number;
    available: boolean;
    config: {
      image?: string;
      rootless?: boolean;
      networkMode?: string;
      activeContainers: number;
    };
  } {
    return {
      type: 'podman',
      active: this.activeExecutions,
      available: this.canExecute(),
      config: {
        image: this.config.podmanImage,
        rootless: this.config.podmanRootless,
        networkMode: this.config.podmanNetworkMode,
        activeContainers: this.activeContainers.size,
      },
    };
  }
}
