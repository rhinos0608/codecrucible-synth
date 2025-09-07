import { randomBytes } from 'crypto';
import { resolve } from 'path';
import { execFile } from 'child_process';
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

const execFileAsync = promisify(execFile);

export class DockerBackend extends ExecutionBackend {
  private readonly containerPrefix = 'codecrucible';
  private readonly activeContainers = new Set<string>();

  public constructor(config: Readonly<BackendConfig>) {
    super({
      ...config,
      dockerImage: config.dockerImage ?? 'python:3.11-slim',
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
          'Too many concurrent executions',
          ErrorCategory.SYSTEM,
          ErrorSeverity.MEDIUM,
          {
            userMessage: 'Execution queue is full',
            suggestedActions: ['Wait for current executions to complete'],
            recoverable: true,
            retryable: true,
            context: { operation: 'executeCode', component: 'execution-backend' },
          }
        )
      );
    }

    const startTime = Date.now();
    const containerId = `${this.containerPrefix}_${randomBytes(8).toString('hex')}`;

    try {
      const dockerArgs = [
        'run',
        '--rm',
        '--name',
        containerId,
        '--memory',
        '512m',
        '--cpus',
        '1',
        '--network',
        'none',
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
                userMessage: 'Working directory is not safe',
                suggestedActions: ['Use a directory within the current project'],
                recoverable: false,
                context: {
                  operation: 'validateWorkingDirectory',
                  component: 'docker-backend',
                  workingDirectory: options.workingDirectory,
                },
              }
            )
          );
        }
        dockerArgs.push('-w', '/workspace');
        dockerArgs.push(`${'-v'}`, `${resolve(options.workingDirectory)}:/workspace:ro`);
      }

      if (options.environment) {
        for (const [key, value] of Object.entries(options.environment)) {
          dockerArgs.push('-e', `${key}=${value}`);
        }
      }

      dockerArgs.push(this.config.dockerImage as string, 'bash', '-c', command);

      logger.debug(`Executing in Docker: ${command}`, { containerId });
      this.activeContainers.add(containerId);

      const result = await execFileAsync(
        "docker",
        dockerArgs,
        {
          timeout: options.timeout ?? 30000,
          maxBuffer: options.maxOutputSize ?? 1024 * 1024 * 10,
        }
      );

      const duration = Date.now() - startTime;

      return ErrorHandler.createSuccessResponse({
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
        success: true,
        duration,
        backend: 'docker',
        metadata: {
          containerId,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as {
        killed?: boolean;
        signal?: string;
        message?: string;
        stdout?: string;
        stderr?: string;
        code?: number;
      };

      if (err?.killed && err?.signal === 'SIGTERM') {
        return ErrorHandler.createErrorResponse(
          ErrorFactory.createError(
            'Execution timeout',
            ErrorCategory.SYSTEM,
            ErrorSeverity.MEDIUM,
            {
              userMessage: 'Command execution timed out',
              suggestedActions: ['Increase timeout', 'Optimize command'],
              recoverable: true,
              retryable: true,
              context: { command, timeout: options.timeout, component: 'docker-backend' },
            }
          )
        );
      }

      const errObj = error as {
        message?: string;
        stdout?: string;
        stderr?: string;
        code?: number;
      };
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `Docker execution failed: ${errObj.message ?? 'Unknown error'}`,
          ErrorCategory.TOOL_EXECUTION,
          ErrorSeverity.HIGH,
          {
            userMessage: 'Docker container execution failed',
            suggestedActions: [
              'Check Docker daemon status',
              'Verify image availability',
              'Try E2B or local execution',
            ],
            recoverable: true,
            retryable: true,
            context: {
              command,
              containerId,
              stdout: errObj.stdout ?? '',
              stderr: errObj.stderr ?? errObj.message ?? '',
              exitCode: errObj.code ?? 1,
              duration,
              backend: 'docker',
              component: 'docker-backend',
            },
            originalError: error as Error,
          }
        )
      );
    } finally {
      this.releaseExecutionSlot();
      this.activeContainers.delete(containerId);
      try {
        await execFileAsync('docker', ['rm', '-f', containerId]);
      } catch {
        // ignore
      }
    }
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up Docker backend');
    for (const containerId of this.activeContainers) {
      try {
        await execFileAsync('docker', ['rm', '-f', containerId]);
      } catch (error) {
        logger.warn(`Failed to remove container ${containerId}:`, { error: error instanceof Error ? error.message : String(error) });
      }
    }
    this.activeContainers.clear();
    this.activeExecutions = 0;
  }

  public getStatus(): {
    type: string;
    active: number;
    available: boolean;
    config: unknown;
  } {
    return {
      type: 'docker',
      active: this.activeExecutions,
      available: this.canExecute(),
      config: {
        image: this.config.dockerImage,
        activeContainers: this.activeContainers.size,
      },
    };
  }
}
