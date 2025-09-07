import { randomBytes } from 'crypto';
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

export class E2BBackend extends ExecutionBackend {
  private readonly sandboxes = new Map<string, unknown>();

  public constructor(config: Readonly<BackendConfig>) {
    super({
      ...config,
      e2bTemplate: config.e2bTemplate ?? 'python3',
    });
    if (!config.e2bApiKey) {
      throw new Error('E2B API key is required for E2B backend');
    }
  }

  public async execute(
    command: string,
    options: Readonly<ExecutionOptions> = {}
  ): Promise<ServiceResponse<ExecutionResult>> {
    const acquired = await this.acquireExecutionSlot();
    if (!acquired) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          'Too many concurrent E2B sandboxes',
          ErrorCategory.SYSTEM,
          ErrorSeverity.MEDIUM,
          {
            context: {
              operation: 'e2bExecute',
              timestamp: Date.now(),
              component: 'e2b-backend',
            },
            recoverable: true,
            suggestedActions: ['Wait for current executions to complete'],
          }
        )
      );
    }

    const startTime = Date.now();
    const sandboxId = `sb_${randomBytes(8).toString('hex')}`;

    try {
      let Sandbox: typeof import('e2b').Sandbox;
      try {
        const { Sandbox: ImportedSandbox } = await import('e2b');
        Sandbox = ImportedSandbox;
      } catch {
        return ErrorHandler.createErrorResponse(
          ErrorFactory.createError(
            'E2B SDK not installed',
            ErrorCategory.CONFIGURATION,
            ErrorSeverity.HIGH,
            {
              context: {
                operation: 'e2bExecute',
                timestamp: Date.now(),
                component: 'e2b-backend',
              },
            }
          )
        );
      }

      logger.debug(`Creating E2B sandbox: ${sandboxId}`);

      const sandbox = await Sandbox.create(this.config.e2bTemplate ?? 'python3', {
        apiKey: this.config.e2bApiKey,
        envs: options.environment,
      });

      this.sandboxes.set(sandboxId, sandbox);

      interface ProcessType {
        wait: () => Promise<{ stdout: string; stderr: string; exitCode: number }>;
      }

      const processObj = sandbox as unknown as {
        process: {
          start: (opts: Readonly<{ cmd: string; timeout: number }>) => Promise<ProcessType>;
        };
        close: () => Promise<void>;
      };
      const proc = await processObj.process.start({
        cmd: command,
        timeout: options.timeout ?? 30000,
      });

      const result = await proc.wait();
      const duration = Date.now() - startTime;

      await processObj.close();
      this.sandboxes.delete(sandboxId);

      return ErrorHandler.createSuccessResponse({
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        success: result.exitCode === 0,
        duration,
        backend: 'e2b',
        metadata: {
          sandboxId,
        },
      });
    } catch (error) {
      let errorMessage = 'Unknown error';
      const errorObj: unknown = error;
      if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message: unknown }).message === 'string'
      ) {
        errorMessage = (error as { message: string }).message;
      }

      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `E2B execution failed: ${errorMessage}`,
          ErrorCategory.EXTERNAL_API,
          ErrorSeverity.HIGH,
          {
            context: {
              operation: 'e2bExecute',
              timestamp: Date.now(),
              component: 'e2b-backend',
              metadata: { sandboxId, command },
              error: errorObj,
            },
          }
        )
      );
    } finally {
      this.releaseExecutionSlot();
      const sandbox = this.sandboxes.get(sandboxId);
      if (sandbox) {
        try {
          await (sandbox as { close: () => Promise<void> }).close();
        } catch {
          // ignore
        }
        this.sandboxes.delete(sandboxId);
      }
    }
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up E2B backend');
    for (const [id, sandbox] of this.sandboxes) {
      try {
        await (sandbox as { close: () => Promise<void> }).close();
      } catch (error) {
        logger.warn(`Failed to close sandbox ${id}:`, error);
      }
    }
    this.sandboxes.clear();
    this.activeExecutions = 0;
  }

  public getStatus(): {
    type: string;
    active: number;
    available: boolean;
    config: {
      template?: string;
      endpoint?: string;
      activeSandboxes: number;
    };
  } {
    return {
      type: 'e2b',
      active: this.activeExecutions,
      available: this.canExecute(),
      config: {
        template: this.config.e2bTemplate,
        endpoint: this.config.e2bEndpoint ?? 'api.e2b.dev',
        activeSandboxes: this.sandboxes.size,
      },
    };
  }
}
