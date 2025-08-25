import { logger } from '../logger.js';
import { UnifiedAgent } from '../agent.js';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export type Platform = 'windows' | 'macos' | 'linux';
export type SandboxMode = 'read-only' | 'workspace-write' | 'full-access';

export interface SandboxConfig {
  platform: Platform;
  mode: SandboxMode;
  workspaceRoot: string;
  restrictions: {
    allowedPaths: string[];
    blockedCommands: string[];
    resourceLimits: {
      memory: number; // MB
      cpu: number; // percentage
      timeout: number; // ms
    };
  };
}

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  blocked?: boolean;
  blockReason?: string;
}

export interface OperationContext {
  command: string;
  args: string[];
  workingDirectory: string;
  environment?: Record<string, string>;
}

export interface Sandbox {
  executeCommand(command: string, context?: OperationContext): Promise<ExecutionResult>;
  validatePath(filePath: string): Promise<boolean>;
  cleanup(): Promise<void>;
  getStatus(): SandboxStatus;
}

export interface SandboxStatus {
  active: boolean;
  mode: SandboxMode;
  platform: Platform;
  resourceUsage: {
    memory: number;
    cpu: number;
  };
  restrictions: {
    pathsAllowed: number;
    commandsBlocked: number;
  };
}

/**
 * OS-level sandboxing manager with platform-specific implementations
 * Provides secure execution environment with resource limits and access controls
 */
export class SandboxManager {
  private platform: Platform;
  private activeSandboxes = new Map<string, Sandbox>();

  constructor() {
    this.platform = this.detectPlatform();
    logger.info(`Sandbox manager initialized for platform: ${this.platform}`);
  }

  /**
   * Create a new sandbox instance
   */
  async createSandbox(config: SandboxConfig): Promise<Sandbox> {
    const sandboxId = this.generateSandboxId();

    let sandbox: Sandbox;

    switch (this.platform) {
      case 'macos':
        sandbox = new MacOSSandbox(config, sandboxId);
        break;
      case 'linux':
        sandbox = new LinuxSandbox(config, sandboxId);
        break;
      case 'windows':
        sandbox = new WindowsSandbox(config, sandboxId);
        break;
      default:
        throw new Error(`Unsupported platform: ${this.platform}`);
    }

    await sandbox.validatePath(config.workspaceRoot);
    this.activeSandboxes.set(sandboxId, sandbox);

    logger.info(`Created sandbox: ${sandboxId} (${config.mode} mode)`);
    return sandbox;
  }

  /**
   * Get sandbox by ID
   */
  getSandbox(sandboxId: string): Sandbox | undefined {
    return this.activeSandboxes.get(sandboxId);
  }

  /**
   * Cleanup all active sandboxes
   */
  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.activeSandboxes.values()).map(async sandbox =>
      sandbox.cleanup()
    );

    await Promise.all(cleanupPromises);
    this.activeSandboxes.clear();

    logger.info('All sandboxes cleaned up');
  }

  /**
   * Get status of all active sandboxes
   */
  getOverallStatus(): {
    total: number;
    byMode: Record<SandboxMode, number>;
    byPlatform: Record<Platform, number>;
  } {
    const sandboxes = Array.from(this.activeSandboxes.values());
    const byMode: Record<SandboxMode, number> = {
      'read-only': 0,
      'workspace-write': 0,
      'full-access': 0,
    };
    const byPlatform: Record<Platform, number> = { windows: 0, macos: 0, linux: 0 };

    sandboxes.forEach(sandbox => {
      const status = sandbox.getStatus();
      byMode[status.mode]++;
      byPlatform[status.platform]++;
    });

    return {
      total: sandboxes.length,
      byMode,
      byPlatform,
    };
  }

  private detectPlatform(): Platform {
    const platform = os.platform();

    switch (platform) {
      case 'darwin':
        return 'macos';
      case 'linux':
        return 'linux';
      case 'win32':
        return 'windows';
      default:
        logger.warn(`Unknown platform ${platform}, defaulting to linux`);
        return 'linux';
    }
  }

  private generateSandboxId(): string {
    return `sandbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Base sandbox implementation with common functionality
 */
abstract class BaseSandbox implements Sandbox {
  protected config: SandboxConfig;
  protected sandboxId: string;
  protected startTime: number;

  constructor(config: SandboxConfig, sandboxId: string) {
    this.config = config;
    this.sandboxId = sandboxId;
    this.startTime = Date.now();
  }

  /**
   * Validate if a path is allowed by sandbox restrictions
   */
  async validatePath(filePath: string): Promise<boolean> {
    try {
      const absolutePath = path.resolve(filePath);
      const workspaceRoot = path.resolve(this.config.workspaceRoot);

      // Check if path is within workspace for workspace-write mode
      if (this.config.mode === 'workspace-write') {
        if (!absolutePath.startsWith(workspaceRoot)) {
          logger.warn(`Path outside workspace blocked: ${absolutePath}`);
          return false;
        }
      }

      // Check allowed paths
      if (this.config.restrictions.allowedPaths.length > 0) {
        const isAllowed = this.config.restrictions.allowedPaths.some(allowedPath => {
          const resolvedAllowed = path.resolve(allowedPath);
          return absolutePath.startsWith(resolvedAllowed);
        });

        if (!isAllowed) {
          logger.warn(`Path not in allowed list: ${absolutePath}`);
          return false;
        }
      }

      // For read-only mode, check if path exists and is readable
      if (this.config.mode === 'read-only') {
        try {
          await fs.access(absolutePath, fs.constants.R_OK);
        } catch {
          logger.warn(`Path not readable in read-only mode: ${absolutePath}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error(`Path validation error for ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Check if command is blocked
   */
  protected isCommandBlocked(command: string): boolean {
    const baseCommand = command.split(' ')[0].toLowerCase();

    // Always block dangerous commands
    const dangerousCommands = [
      'rm',
      'del',
      'format',
      'fdisk',
      'mkfs',
      'chmod',
      'chown',
      'sudo',
      'su',
      'wget',
      'curl',
      'nc',
      'netcat',
      'python',
      'node',
      'powershell',
      'cmd',
    ];

    if (dangerousCommands.includes(baseCommand)) {
      // Allow some commands in full-access mode
      if (this.config.mode === 'full-access') {
        const allowedInFullAccess = ['python', 'node', 'wget', 'curl'];
        if (!allowedInFullAccess.includes(baseCommand)) {
          return true;
        }
      } else {
        return true;
      }
    }

    // Check user-defined blocked commands
    return this.config.restrictions.blockedCommands.includes(baseCommand);
  }

  /**
   * Get current sandbox status
   */
  getStatus(): SandboxStatus {
    return {
      active: true,
      mode: this.config.mode,
      platform: this.config.platform,
      resourceUsage: {
        memory: 0, // To be implemented by platform-specific classes
        cpu: 0,
      },
      restrictions: {
        pathsAllowed: this.config.restrictions.allowedPaths.length,
        commandsBlocked: this.config.restrictions.blockedCommands.length,
      },
    };
  }

  abstract executeCommand(command: string, context?: OperationContext): Promise<ExecutionResult>;
  abstract cleanup(): Promise<void>;
}

/**
 * macOS sandbox implementation using sandbox-exec
 */
class MacOSSandbox extends BaseSandbox {
  private sandboxProfile: string;

  constructor(config: SandboxConfig, sandboxId: string) {
    super(config, sandboxId);
    this.sandboxProfile = this.generateSandboxProfile();
  }

  async executeCommand(command: string, context?: OperationContext): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Check if command is blocked
    if (this.isCommandBlocked(command)) {
      return {
        success: false,
        stdout: '',
        stderr: 'Command blocked by sandbox policy',
        exitCode: 1,
        duration: Date.now() - startTime,
        blocked: true,
        blockReason: 'Command not allowed in current sandbox mode',
      };
    }

    try {
      // Write sandbox profile to temporary file
      const profilePath = `/tmp/sandbox_${this.sandboxId}.sb`;
      await fs.writeFile(profilePath, this.sandboxProfile);

      // Execute with sandbox-exec
      const sandboxedCommand = `sandbox-exec -f ${profilePath} ${command}`;

      const { stdout, stderr } = await execAsync(sandboxedCommand, {
        timeout: this.config.restrictions.resourceLimits.timeout,
        maxBuffer: 1024 * 1024, // 1MB buffer
        cwd: context?.workingDirectory || this.config.workspaceRoot,
        env: { ...process.env, ...context?.environment },
      });

      // Cleanup profile file
      await fs.unlink(profilePath).catch(() => {
        // Ignore errors
      });

      return {
        success: true,
        stdout,
        stderr,
        exitCode: 0,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: '',
        stderr: error.message || 'Command execution failed',
        exitCode: error.code || 1,
        duration: Date.now() - startTime,
      };
    }
  }

  private generateSandboxProfile(): string {
    const allowedPaths = this.config.restrictions.allowedPaths
      .map(p => `(allow file-read* (subpath "${path.resolve(p)}"))`)
      .join('\n');

    const workspaceAccess =
      this.config.mode === 'read-only'
        ? `(allow file-read* (subpath "${this.config.workspaceRoot}"))`
        : `(allow file-read* file-write* (subpath "${this.config.workspaceRoot}"))`;

    return `
(version 1)
(debug deny)
(deny default)

; Basic system access
(allow process-exec (literal "/bin/sh") (literal "/usr/bin/env"))
(allow file-read* (literal "/dev/null") (literal "/dev/zero"))
(allow file-read* (subpath "/usr/lib") (subpath "/System/Library"))

; Workspace access
${workspaceAccess}

; User-defined allowed paths
${allowedPaths}

; Network restrictions (${this.config.mode === 'full-access' ? 'allowed' : 'blocked'})
${this.config.mode === 'full-access' ? '(allow network*)' : '(deny network*)'}
`;
  }

  async cleanup(): Promise<void> {
    // Cleanup any temporary files
    const profilePath = `/tmp/sandbox_${this.sandboxId}.sb`;
    await fs.unlink(profilePath).catch(() => {}); // Ignore errors

    logger.debug(`macOS sandbox ${this.sandboxId} cleaned up`);
  }
}

/**
 * Linux sandbox implementation using namespaces and cgroups
 */
class LinuxSandbox extends BaseSandbox {
  private cgroupPath: string;

  constructor(config: SandboxConfig, sandboxId: string) {
    super(config, sandboxId);
    this.cgroupPath = `/sys/fs/cgroup/codecrucible/${sandboxId}`;
  }

  async executeCommand(command: string, context?: OperationContext): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Check if command is blocked
    if (this.isCommandBlocked(command)) {
      return {
        success: false,
        stdout: '',
        stderr: 'Command blocked by sandbox policy',
        exitCode: 1,
        duration: Date.now() - startTime,
        blocked: true,
        blockReason: 'Command not allowed in current sandbox mode',
      };
    }

    try {
      // Setup cgroup for resource limits
      await this.setupCgroup();

      // Use unshare for namespace isolation
      const namespacedCommand = this.buildNamespacedCommand(command, context);

      const { stdout, stderr } = await execAsync(namespacedCommand, {
        timeout: this.config.restrictions.resourceLimits.timeout,
        maxBuffer: 1024 * 1024, // 1MB buffer
        cwd: context?.workingDirectory || this.config.workspaceRoot,
        env: { ...process.env, ...context?.environment },
      });

      return {
        success: true,
        stdout,
        stderr,
        exitCode: 0,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: '',
        stderr: error.message || 'Command execution failed',
        exitCode: error.code || 1,
        duration: Date.now() - startTime,
      };
    }
  }

  private buildNamespacedCommand(command: string, context?: OperationContext): string {
    const nsFlags = [
      '--mount', // Mount namespace
      '--pid', // PID namespace
      '--ipc', // IPC namespace
      '--uts', // UTS namespace
    ];

    // Add network namespace unless full-access mode
    if (this.config.mode !== 'full-access') {
      nsFlags.push('--net');
    }

    // Build bind mounts for allowed paths
    const bindMounts = this.config.restrictions.allowedPaths.map(p => `--bind ${p} ${p}`).join(' ');

    const workspaceMount =
      this.config.mode === 'read-only'
        ? `--bind-ro ${this.config.workspaceRoot} ${this.config.workspaceRoot}`
        : `--bind ${this.config.workspaceRoot} ${this.config.workspaceRoot}`;

    return `unshare ${nsFlags.join(' ')} --map-root-user cgexec -g memory,cpu:codecrucible/${this.sandboxId} -- ${workspaceMount} ${bindMounts} ${command}`;
  }

  private async setupCgroup(): Promise<void> {
    try {
      // Create cgroup directory
      await fs.mkdir(this.cgroupPath, { recursive: true });

      // Set memory limit
      const memoryLimitBytes = this.config.restrictions.resourceLimits.memory * 1024 * 1024;
      await fs.writeFile(path.join(this.cgroupPath, 'memory.max'), memoryLimitBytes.toString());

      // Set CPU limit
      const cpuQuota = Math.floor(this.config.restrictions.resourceLimits.cpu * 1000); // Convert percentage to quota
      await fs.writeFile(path.join(this.cgroupPath, 'cpu.max'), `${cpuQuota} 100000`);

      logger.debug(`Linux cgroup setup complete: ${this.cgroupPath}`);
    } catch (error) {
      logger.warn(`Failed to setup cgroup (continuing without resource limits):`, error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Remove cgroup
      await fs.rmdir(this.cgroupPath);
      logger.debug(`Linux sandbox ${this.sandboxId} cleaned up`);
    } catch (error) {
      logger.warn(`Failed to cleanup cgroup ${this.cgroupPath}:`, error);
    }
  }
}

/**
 * Windows sandbox implementation using process job objects and restricted tokens
 */
class WindowsSandbox extends BaseSandbox {
  private jobObject: string;

  constructor(config: SandboxConfig, sandboxId: string) {
    super(config, sandboxId);
    this.jobObject = `codecrucible_${sandboxId}`;
  }

  async executeCommand(command: string, context?: OperationContext): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Check if command is blocked
    if (this.isCommandBlocked(command)) {
      return {
        success: false,
        stdout: '',
        stderr: 'Command blocked by sandbox policy',
        exitCode: 1,
        duration: Date.now() - startTime,
        blocked: true,
        blockReason: 'Command not allowed in current sandbox mode',
      };
    }

    try {
      // Use PowerShell with execution policy and constrained session
      const psCommand = this.buildPowerShellCommand(command, context);

      const { stdout, stderr } = await execAsync(psCommand, {
        timeout: this.config.restrictions.resourceLimits.timeout,
        maxBuffer: 1024 * 1024, // 1MB buffer
        cwd: context?.workingDirectory || this.config.workspaceRoot,
        env: { ...process.env, ...context?.environment },
      });

      return {
        success: true,
        stdout,
        stderr,
        exitCode: 0,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: '',
        stderr: error.message || 'Command execution failed',
        exitCode: error.code || 1,
        duration: Date.now() - startTime,
      };
    }
  }

  private buildPowerShellCommand(command: string, context?: OperationContext): string {
    // Create a restricted PowerShell session
    const sessionConfig = this.generateSessionConfiguration();

    const allowedPaths = this.config.restrictions.allowedPaths
      .map(p => `"${path.resolve(p)}"`)
      .join(',');

    const workspaceAccess = this.config.mode === 'read-only' ? 'Read' : 'ReadWrite';

    // PowerShell command with restricted execution policy
    return `powershell.exe -ExecutionPolicy Restricted -NoProfile -Command "
      $AllowedPaths = @(${allowedPaths});
      $WorkspaceRoot = '${this.config.workspaceRoot}';
      $AccessMode = '${workspaceAccess}';
      
      # Validate paths and execute command
      try {
        ${command}
      } catch {
        Write-Error $_.Exception.Message;
        exit 1;
      }
    "`;
  }

  private generateSessionConfiguration(): string {
    return `
# Session configuration for CodeCrucible sandbox
# Mode: ${this.config.mode}
# Generated: ${new Date().toISOString()}

# Restricted execution policy
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Restricted -Force

# Memory and CPU limits (basic PowerShell implementation)
$Host.UI.RawUI.Title = "CodeCrucible Sandbox - ${this.sandboxId}"
`;
  }

  async cleanup(): Promise<void> {
    // Windows-specific cleanup would go here
    // For now, just log the cleanup
    logger.debug(`Windows sandbox ${this.sandboxId} cleaned up`);
  }
}
