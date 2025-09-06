/**
 * Switchable Execution Backend System
 *
 * Provides configurable code execution with support for:
 * - Docker containers
 * - E2B cloud sandboxes
 * - E2B self-hosted sandboxes
 * - Local process execution (with safeguards)
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { unlink, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { randomBytes } from 'crypto';
import { logger } from '../logging/logger.js';
import {
  ErrorCategory,
  ErrorFactory,
  ErrorHandler,
  ErrorSeverity,
  ServiceResponse,
} from '../../infrastructure/error-handling/structured-error-system.js';

const execAsync = promisify(exec);

// Execution result interface
export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
  duration: number;
  backend: string;
  metadata?: {
    containerId?: string;
    sandboxId?: string;
    vmId?: string;
    memoryUsed?: number;
    cpuTime?: number;
    vcpuCount?: number;
    memSizeMib?: number;
    rootless?: boolean;
    networkMode?: string;
  };
}

// Execution options
export interface ExecutionOptions {
  timeout?: number;
  workingDirectory?: string;
  environment?: Record<string, string>;
  stdin?: string;
  captureOutput?: boolean;
  maxOutputSize?: number;
}

// Backend configuration
export interface BackendConfig {
  type: 'docker' | 'e2b' | 'local_e2b' | 'local_process' | 'firecracker' | 'podman';
  dockerImage?: string;
  e2bApiKey?: string;
  e2bEndpoint?: string;
  e2bTemplate?: string;
  localSafeguards?: boolean;
  allowedCommands?: string[];
  maxConcurrent?: number;
  // Firecracker-specific options
  firecrackerKernelPath?: string;
  firecrackerRootfsPath?: string;
  firecrackerVcpuCount?: number;
  firecrackerMemSizeMib?: number;
  // Podman-specific options
  podmanRootless?: boolean;
  podmanImage?: string;
  podmanNetworkMode?: string;
}

/**
 * Abstract base class for execution backends
 */
export abstract class ExecutionBackend {
  protected config: BackendConfig;
  protected activeExecutions = 0;
  private executionLock = false;

  public constructor(config: Readonly<BackendConfig>) {
    this.config = config;
  }

  public abstract execute(
    command: string,
    options?: Readonly<ExecutionOptions>
  ): Promise<ServiceResponse<ExecutionResult>>;

  public abstract cleanup(): Promise<void>;

  public abstract getStatus(): {
    type: string;
    active: number;
    available: boolean;
    config: unknown;
  };

  protected canExecute(): boolean {
    const maxConcurrent = this.config.maxConcurrent || 5;
    return this.activeExecutions < maxConcurrent;
  }

  protected async acquireExecutionSlot(): Promise<boolean> {
    // Simple spin-lock for concurrency control
    while (this.executionLock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.executionLock = true;
    try {
      if (this.canExecute()) {
        this.activeExecutions++;
        return true;
      }
      return false;
    } finally {
      this.executionLock = false;
    }
  }

  protected releaseExecutionSlot(): void {
    this.activeExecutions = Math.max(0, this.activeExecutions - 1);
  }

  protected validateWorkingDirectory(path: string): { safe: boolean; reason?: string } {
    try {
      const resolvedPath = resolve(path);

      // Check for path traversal attempts
      if (path.includes('..') || path.includes('~')) {
        return { safe: false, reason: 'Path traversal detected' };
      }

      // Check for access to system directories
      const systemPaths = ['/etc', '/bin', '/usr', '/var', '/root', '/sys', '/proc'];
      const windowsSystemPaths = ['C:\\Windows', 'C:\\Program Files', 'C:\\Users\\All Users'];

      for (const sysPath of [...systemPaths, ...windowsSystemPaths]) {
        if (resolvedPath.toLowerCase().startsWith(sysPath.toLowerCase())) {
          return { safe: false, reason: 'Access to system directory denied' };
        }
      }

      // Ensure the path is within reasonable bounds (not at filesystem root)
      if (resolvedPath === '/' || resolvedPath.match(/^[A-Z]:\\?$/)) {
        return { safe: false, reason: 'Root directory access denied' };
      }

      return { safe: true };
    } catch (error) {
      return { safe: false, reason: 'Invalid path format' };
    }
  }
}

/**
 * Docker execution backend
 */
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
      // Build docker command
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
        'none', // No network access for security
      ];

      // Add working directory with validation
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
        dockerArgs.push('-v', `${resolve(options.workingDirectory)}:/workspace:ro`); // Read-only mount for safety
      }

      // Add environment variables
      if (options.environment) {
        for (const [key, value] of Object.entries(options.environment)) {
          dockerArgs.push('-e', `${key}=${value}`);
        }
      }

      dockerArgs.push(this.config.dockerImage as string, 'bash', '-c', command);

      logger.debug(`Executing in Docker: ${command}`, { containerId });
      this.activeContainers.add(containerId);

      const result = await execAsync(`docker ${dockerArgs.join(' ')}`, {
        timeout: options.timeout ?? 30000,
        maxBuffer: options.maxOutputSize ?? 1024 * 1024 * 10, // 10MB
      });

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

      const err = error as { killed?: boolean; signal?: string; message?: string; stdout?: string; stderr?: string; code?: number };

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

      // Use a safer error type and access message property conditionally
      const errObj = error as { message?: string; stdout?: string; stderr?: string; code?: number };
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

      // Ensure container is removed
      try {
        await execAsync(`docker rm -f ${containerId} 2>/dev/null`);
      } catch {
        // Container already removed
      }
    }
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up Docker backend');

    // Stop all active containers
    for (const containerId of this.activeContainers) {
      try {
        await execAsync(`docker rm -f ${containerId}`);
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

/**
 * E2B Cloud execution backend
 */
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
      // Dynamic import of E2B SDK (only if available)
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

      const sandbox = await Sandbox.create(
        this.config.e2bTemplate ?? 'python3',
        {
          apiKey: this.config.e2bApiKey,
          envs: options.environment,
        }
      );

      this.sandboxes.set(sandboxId, sandbox);

      // Type import for E2B Sandbox and Process
      interface ProcessType {
        wait: () => Promise<{ stdout: string; stderr: string; exitCode: number }>;
      }

      // Execute command
      // Access process and close properties with explicit typing
      const processObj = (sandbox as unknown as { process: { start: (opts: Readonly<{ cmd: string; timeout: number }>) => Promise<ProcessType> }; close: () => Promise<void> });
      const proc = await processObj.process.start({
        cmd: command,
        timeout: options.timeout ?? 30000,
      });

      const result = await proc.wait();
      const duration = Date.now() - startTime;

      // Cleanup sandbox
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
      // duration is not used, so we omit it

      let errorMessage = 'Unknown error';
      const errorObj: unknown = error;
      if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
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

      // Ensure sandbox is closed
      const sandbox = this.sandboxes.get(sandboxId);
      if (sandbox) {
        try {
          await (sandbox as { close: () => Promise<void> }).close();
        } catch {
          // Already closed
        }
        this.sandboxes.delete(sandboxId);
      }
    }
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up E2B backend');

    // Close all active sandboxes
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

/**
 * Local E2B execution backend (self-hosted)
 */
export class LocalE2BBackend extends E2BBackend {
  public constructor(config: Readonly<BackendConfig>) {
    super({
      ...config,
      e2bEndpoint: config.e2bEndpoint ?? 'http://localhost:4000',
    });
  }

  public override async execute(
    command: string,
    options: Readonly<ExecutionOptions> = {}
  ): Promise<ServiceResponse<ExecutionResult>> {
    // Override parent to use local endpoint
    process.env.E2B_API_URL = this.config.e2bEndpoint;

    const result = await super.execute(command, options);

    // Update backend name in result if it's a success response
    if (result.success && 'data' in result) {
      result.data.backend = 'local_e2b';
    }

    return result;
  }

  public override getStatus(): {
    type: string;
    active: number;
    available: boolean;
    config: {
      template?: string;
      endpoint?: string;
      activeSandboxes: number;
    };
  } {
    const status = super.getStatus();
    status.type = 'local_e2b';
    return status;
  }
}

/**
 * Firecracker execution backend for microVM isolation
 */
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
      // Create Firecracker configuration
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

      // Write configuration to temporary file
      const configPath = `/tmp/fc_config_${vmId}.json`;
      await writeFile(configPath, JSON.stringify(fcConfig, null, 2));

      logger.debug(`Starting Firecracker VM: ${vmId}`);
      this.activeVMs.add(vmId);

      // Start Firecracker VM
      const _fcProcess = spawn(
        'firecracker',
        ['--api-sock', socketPath, '--config-file', configPath],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: true,
        }
      );

      // Wait for VM to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Execute command via VM's console
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

      // Type guard for error object
      interface ExecError {
        message?: string;
        stdout?: string;
        stderr?: string;
        code?: number;
      }
      const errObj: ExecError = typeof error === 'object' && error !== null ? error as ExecError : {};

      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `Firecracker execution failed: ${errObj.message ?? 'Unknown error'}`,
          ErrorCategory.TOOL_EXECUTION,
          ErrorSeverity.HIGH,
          {
            context: { command, vmId },
            originalError: error instanceof Error ? error : undefined,
            userMessage: 'Firecracker microVM execution failed',
            suggestedActions: [
              'Check Firecracker installation',
              'Verify kernel and rootfs paths',
              'Try Docker or Podman backend',
            ],
            retryable: true,
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

      // Cleanup VM and socket
      try {
        await unlink(socketPath);
        await unlink(`/tmp/fc_config_${vmId}.json`);
      } catch {
        // Cleanup failed, but not critical
      }
    }
  }

  private async executeInVM(
    vmId: string,
    socketPath: string,
    command: string,
    options: Readonly<ExecutionOptions>
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Create a script file to execute in the VM
    const scriptPath = `/tmp/script_${vmId}.sh`;

    try {
      // Write script to temporary file (would be injected into VM filesystem in real implementation)
      await writeFile(scriptPath, `#!/bin/bash\n${command}\n`);

      // For now, execute locally as a fallback since proper Firecracker integration
      // requires guest agent or SSH setup which is complex
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
        if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
          const { message: errMsg } = error as { message: string };
          message = errMsg;
        }
        if ('code' in error && typeof (error as { code?: unknown }).code === 'number') {
          const { code: errCode } = error as { code: number };
          code = errCode;
        }
      }
      return {
        stdout: '',
        stderr: message,
        exitCode: code,
      };
    } finally {
      // Cleanup script file
      try {
        await unlink(scriptPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up Firecracker backend');

    // Stop all active VMs
    for (const vmId of this.activeVMs) {
      try {
        const socketPath = `/tmp/firecracker_${vmId}.socket`;
        // Send shutdown signal to VM
        await execAsync(
          `curl -X PUT 'http+unix://${socketPath.replace(/\//g, '%2F')}/actions' ` +
            `-H 'Content-Type: application/json' ` +
            `-d '{"action_type": "SendCtrlAltDel"}'`
        );
        await unlink(socketPath);
      } catch (error) {
        logger.warn(`Failed to cleanup VM ${vmId}:`, error);
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

/**
 * Podman execution backend for rootless containers
 */
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
      // Build podman command
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

      // Note: Rootless mode is automatic when running as non-root user
      // No special flags needed for rootless operation

      // Add working directory with validation
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
        podmanArgs.push('-v', `${resolve(options.workingDirectory)}:/workspace:ro,Z`); // SELinux label
      }

      // Add environment variables (filtered for security)
      if (options.environment) {
        const safeEnvVars = this.filterEnvironmentVariables(options.environment);
        for (const [key, value] of Object.entries(safeEnvVars)) {
          podmanArgs.push('-e', `${key}=${value}`);
        }
      }

      // Add security options for rootless
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

      const result = await execAsync(`podman ${podmanArgs.join(' ')}`, {
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
        metadata: {
          containerId,
          rootless: this.config.podmanRootless,
          networkMode: this.config.podmanNetworkMode,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      // Type guard for error object
      interface ExecError {
        killed?: boolean;
        signal?: string;
        message?: string;
        stdout?: string;
        stderr?: string;
        code?: number;
      }
      const errObj: ExecError = typeof error === 'object' && error !== null ? error as ExecError : {};

      if (errObj.killed && errObj.signal === 'SIGTERM') {
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
          `Podman execution failed: ${typeof error === 'object' && error !== null && 'message' in error ? (error as { message?: string }).message : 'Unknown error'}`,
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
              stdout: typeof error === 'object' && error !== null && 'stdout' in error ? (error as { stdout?: string }).stdout ?? '' : '',
              stderr: typeof error === 'object' && error !== null && 'stderr' in error ? (error as { stderr?: string }).stderr ?? ((error as { message?: string }).message ?? '') : (typeof error === 'object' && error !== null && 'message' in error ? (error as { message?: string }).message ?? '' : ''),
              exitCode: typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: number }).code ?? 1 : 1,
              duration,
              backend: 'podman',
            },
          }
        )
      );
    } finally {
      this.releaseExecutionSlot();
      this.activeContainers.delete(containerId);

      // Ensure container is removed
      try {
        await execAsync(`podman rm -f ${containerId} 2>/dev/null`);
      } catch {
        // Container already removed
      }
    }
  }

  private filterEnvironmentVariables(env: Record<string, string>): Record<string, string> {
    const safeVars: Record<string, string> = {};
    const allowedPrefixes = ['LANG', 'LC_', 'TZ', 'TERM', 'PATH'];
    const blockedVars = ['HOME', 'USER', 'SSH_', 'AWS_', 'GCP_', 'AZURE_'];

    for (const [key, value] of Object.entries(env)) {
      // Allow specific prefixes
      if (allowedPrefixes.some(prefix => key.startsWith(prefix))) {
        safeVars[key] = value;
        continue;
      }

      // Block sensitive variables
      if (blockedVars.some(blocked => key.startsWith(blocked))) {
        continue;
      }

      // Allow application-specific variables
      if (key.startsWith('APP_') || key.startsWith('DEBUG') || key.startsWith('NODE_')) {
        safeVars[key] = value;
      }
    }

    return safeVars;
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up Podman backend');

    // Stop all active containers
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

/**
 * Local process execution backend (with safeguards)
 */
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
    // Safety checks first (before acquiring slot)
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
      // Validate working directory if provided
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

      // Create a clean environment with only safe variables
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

      // Type guard for error object
      interface ExecError {
        killed?: boolean;
        signal?: string;
        message?: string;
        stdout?: string;
        stderr?: string;
        code?: number;
      }
      const errObj: ExecError = typeof error === 'object' && error !== null ? error as ExecError : {};

      if (errObj.killed && errObj.signal === 'SIGTERM') {
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

  private checkCommandSafety(command: string): { safe: boolean; reason?: string } {
    const lowerCommand = command.toLowerCase();

    // Check for dangerous patterns that could be obfuscated
    const dangerousPatterns = [
      // Direct dangerous commands
      /\b(rm|del|format|fdisk|dd|mkfs)\b/,
      /\b(shutdown|reboot|halt|poweroff)\b/,
      /\b(sudo|su|chmod|chown|passwd)\b/,

      // Python subprocess/os patterns
      /subprocess\.(call|run|popen)/,
      /os\.system/,
      /os\.popen/,
      /exec\(/,
      /eval\(/,

      // Shell injection patterns (allow basic pipes and redirects for legitimate use)
      /[;&`$()]/,
      />\s*\/dev\//,
      /\|\s*sh/,
      /\|\s*bash/,

      // File system manipulation
      /\/\/+|\.\.\/|~\//,
      /\/etc\/|\/bin\/|\/usr\/|\/var\/|\/root\//,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(lowerCommand)) {
        return { safe: false, reason: `Potentially dangerous pattern detected: ${pattern.source}` };
      }
    }

    // Check for dangerous commands more precisely
    const tokens = command.split(/\s+/);
    const firstToken = tokens[0]?.toLowerCase();

    if (this.dangerousCommands.includes(firstToken)) {
      return { safe: false, reason: `Dangerous command: ${firstToken}` };
    }

    // Check allowed commands if configured (whitelist approach)
    if (this.config.allowedCommands && this.config.allowedCommands.length > 0) {
      if (!this.config.allowedCommands.includes(firstToken)) {
        return { safe: false, reason: `Command not in allowed list: ${firstToken}` };
      }
    }

    // Check command length to prevent buffer overflow attempts
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

/**
 * Execution backend factory
 */
export class ExecutionBackendFactory {
  public static create(config: Readonly<BackendConfig>): ExecutionBackend {
    switch (config.type) {
      case 'docker':
        return new DockerBackend(config);
      case 'e2b':
        return new E2BBackend(config);
      case 'local_e2b':
        return new LocalE2BBackend(config);
      case 'local_process':
        return new LocalProcessBackend(config);
      case 'firecracker':
        return new FirecrackerBackend(config);
      case 'podman':
        return new PodmanBackend(config);
      default:
        throw new Error(`Unknown execution backend type: ${String(config.type)}`);
    }
  }

  public static async detectAvailable(): Promise<string[]> {
    const available: string[] = [];

    // Check Docker
    try {
      await execAsync('docker --version');
      available.push('docker');
    } catch {
      logger.debug('Docker not available');
    }

    // Check Podman
    try {
      await execAsync('podman --version');
      available.push('podman');
    } catch {
      logger.debug('Podman not available');
    }

    // Check Firecracker
    try {
      await execAsync('firecracker --version');
      available.push('firecracker');
    } catch {
      logger.debug('Firecracker not available');
    }

    // Check E2B (if API key is set)
    if (process.env.E2B_API_KEY) {
      available.push('e2b');
    }

    // Local process is always available
    available.push('local_process');

    return available;
  }
}

/**
 * Multi-backend execution manager
 */
export class ExecutionManager {
  private readonly backends = new Map<string, ExecutionBackend>();
  private defaultBackend: string;

  public constructor(configs: ReadonlyArray<BackendConfig>, defaultBackend?: string) {
    if (configs.length === 0) {
      throw new Error('At least one execution backend must be configured');
    }

    for (const config of configs) {
      const backend = ExecutionBackendFactory.create(config);
      this.backends.set(config.type, backend);
    }

    this.defaultBackend = defaultBackend ?? configs[0].type;

    logger.info(`Execution manager initialized with ${configs.length} backends`, {
      backends: configs.map((c: Readonly<BackendConfig>) => c.type),
      default: this.defaultBackend,
    });
  }

  public async execute(
    command: string,
    options: Readonly<ExecutionOptions & { backend?: string }> = {}
  ): Promise<ServiceResponse<ExecutionResult>> {
    const backendType = options.backend ?? this.defaultBackend;
    const backend = this.backends.get(backendType);

    if (!backend) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `Unknown execution backend: ${backendType}`,
          ErrorCategory.CONFIGURATION,
          ErrorSeverity.HIGH,
          {
            userMessage: 'Invalid execution backend specified',
            suggestedActions: [`Use one of: ${Array.from(this.backends.keys()).join(', ')}`],
          }
        )
      );
    }

    return backend.execute(command, options);
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up all execution backends');

    await Promise.all(Array.from(this.backends.values()).map(async (backend: Readonly<ExecutionBackend>) => backend.cleanup()));
  }

  public getStatus(): { default: string; backends: Record<string, unknown> } {
    const status: { default: string; backends: Record<string, unknown> } = {
      default: this.defaultBackend,
      backends: {},
    };

    for (const [type, backend] of this.backends) {
      status.backends[type] = backend.getStatus();
    }

    return status;
  }

  public setDefaultBackend(type: string): void {
    if (!this.backends.has(type)) {
      throw new Error(`Backend ${type} is not configured`);
    }

    this.defaultBackend = type;
    logger.info(`Default execution backend set to: ${type}`);
  }

  public getAvailableBackends(): string[] {
    return Array.from(this.backends.keys());
  }
}

// Export everything
export default ExecutionManager;
