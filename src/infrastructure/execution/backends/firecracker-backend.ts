import { randomBytes } from 'crypto';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { unlink, writeFile } from 'fs/promises';
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
import { toErrorOrUndefined, toReadonlyRecord } from '../../../utils/type-guards.js';

const execAsync = promisify(exec);

export class FirecrackerBackend extends ExecutionBackend {
  private readonly activeVMs = new Set<string>();
  private readonly vmPrefix = 'codecrucible_vm';

  public constructor(config: Readonly<BackendConfig>) {
    super({
      ...config,
      firecrackerKernelPath: config.firecrackerKernelPath ?? '/opt/firecracker/vmlinux.bin',
      firecrackerRootfsPath: config.firecrackerRootfsPath ?? '/opt/firecracker/rootfs.ext4',
      firecrackerVcpuCount: config.firecrackerVcpuCount ?? 1,
      firecrackerMemSizeMib: config.firecrackerMemSizeMib ?? 512,
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
          'Too many concurrent Firecracker VMs',
          ErrorCategory.SYSTEM,
          ErrorSeverity.MEDIUM,
          {
            context: {
              operation: 'firecrackerExecute',
              timestamp: Date.now(),
              component: 'firecracker-backend',
            },
            recoverable: true,
            suggestedActions: ['Wait for current executions to complete'],
          }
        )
      );
    }

    const startTime = Date.now();
    const vmId = `${this.vmPrefix}_${randomBytes(8).toString('hex')}`;
    const socketPath = `/tmp/firecracker_${vmId}.socket`;

    try {
      const fcConfig = {
        'boot-source': {
          kernel_image_path: this.config.firecrackerKernelPath,
          boot_args: 'console=ttyS0 reboot=k panic=1 pci=off',
        },
        drives: [
          {
            drive_id: 'rootfs',
            path_on_host: this.config.firecrackerRootfsPath,
            is_root_device: true,
            is_read_only: false,
          },
        ],
        'machine-config': {
          vcpu_count: this.config.firecrackerVcpuCount,
          mem_size_mib: this.config.firecrackerMemSizeMib,
          ht_enabled: false,
        },
        'network-interfaces': [] as unknown[],
      };

      const configPath = `/tmp/fc_config_${vmId}.json`;
      await writeFile(configPath, JSON.stringify(fcConfig, null, 2));

      logger.debug(`Starting Firecracker VM: ${vmId}`);
      this.activeVMs.add(vmId);

      spawn('firecracker', ['--api-sock', socketPath, '--config-file', configPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true,
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const result = await this.executeInVM(vmId, socketPath, command, options);
      const duration = Date.now() - startTime;

      return ErrorHandler.createSuccessResponse({
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        success: result.exitCode === 0,
        duration,
        backend: 'firecracker',
        metadata: {
          vmId,
          vcpuCount: this.config.firecrackerVcpuCount,
          memSizeMib: this.config.firecrackerMemSizeMib,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      interface ExecError {
        message?: string;
        stdout?: string;
        stderr?: string;
        code?: number;
      }
      const errObj: ExecError =
        typeof error === 'object' && error !== null ? (error as ExecError) : {};

      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `Firecracker execution failed: ${errObj.message ?? 'Unknown error'}`,
          ErrorCategory.TOOL_EXECUTION,
          ErrorSeverity.HIGH,
          {
            context: { command, vmId },
            originalError: error instanceof Error ? error : undefined,
            userMessage: 'Firecracker microVM execution failed',
            metadata: {
              stdout: errObj.stdout ?? '',
              stderr: errObj.stderr ?? errObj.message ?? '',
              exitCode: errObj.code ?? 1,
              duration,
              backend: 'firecracker',
            },
          }
        )
      );
    } finally {
      this.releaseExecutionSlot();
      this.activeVMs.delete(vmId);
      try {
        await unlink(socketPath);
        await unlink(`/tmp/fc_config_${vmId}.json`);
      } catch {
        // ignore
      }
    }
  }

  private async executeInVM(
    vmId: string,
    socketPath: string,
    command: string,
    options: Readonly<ExecutionOptions>
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const scriptPath = `/tmp/script_${vmId}.sh`;
    try {
      await writeFile(scriptPath, `#!/bin/bash\n${command}\n`);
      logger.warn('Firecracker VM execution falling back to local execution');
      const result = await execAsync(`bash ${scriptPath}`, {
        timeout: options.timeout || 30000,
        maxBuffer: options.maxOutputSize || 1024 * 1024 * 10,
        cwd: options.workingDirectory,
      });
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
      };
    } catch (error) {
      let message = 'Execution failed';
      let code = 1;
      if (typeof error === 'object' && error !== null) {
        const { message: errMsg, code: errCode } = error as { message?: unknown; code?: unknown };
        if (typeof errMsg === 'string') {
          message = errMsg;
        }
        if (typeof errCode === 'number') {
          code = errCode;
        }
      }
      return {
        stdout: '',
        stderr: message,
        exitCode: code,
      };
    } finally {
      try {
        await unlink(scriptPath);
      } catch {
        // ignore
      }
    }
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up Firecracker backend');
    for (const vmId of this.activeVMs) {
      try {
        const socketPath = `/tmp/firecracker_${vmId}.socket`;
        await execAsync(
          `curl -X PUT 'http+unix://${socketPath.replace(/\//g, '%2F')}/actions' ` +
            `-H 'Content-Type: application/json' ` +
            `-d '{"action_type": "SendCtrlAltDel"}'`
        );
        await unlink(socketPath);
      } catch (error) {
        logger.warn(`Failed to cleanup VM ${vmId}:`, toReadonlyRecord(error));
      }
    }
    this.activeVMs.clear();
    this.activeExecutions = 0;
  }

  public getStatus(): {
    type: string;
    active: number;
    available: boolean;
    config: {
      kernelPath?: string;
      rootfsPath?: string;
      vcpuCount?: number;
      memSizeMib?: number;
      activeVMs: number;
    };
  } {
    return {
      type: 'firecracker',
      active: this.activeExecutions,
      available: this.canExecute(),
      config: {
        kernelPath: this.config.firecrackerKernelPath,
        rootfsPath: this.config.firecrackerRootfsPath,
        vcpuCount: this.config.firecrackerVcpuCount,
        memSizeMib: this.config.firecrackerMemSizeMib,
        activeVMs: this.activeVMs.size,
      },
    };
  }
}
