import { resolve } from 'path';
import type { BackendConfig, ExecutionOptions, ExecutionResult } from './execution-types.js';
import type { ServiceResponse } from '../error-handling/structured-error-system.js';

export abstract class ExecutionBackend {
  protected config: BackendConfig;
  protected activeExecutions = 0;
  private executionLock = false;

  protected constructor(config: Readonly<BackendConfig>) {
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

  protected validateWorkingDirectory(path: string): {
    safe: boolean;
    reason?: string;
  } {
    try {
      const resolvedPath = resolve(path);
      if (path.includes('..') || path.includes('~')) {
        return { safe: false, reason: 'Path traversal detected' };
      }
      const systemPaths = ['/etc', '/bin', '/usr', '/var', '/root', '/sys', '/proc'];
      const windowsSystemPaths = ['C:\\Windows', 'C:\\Program Files', 'C:\\Users\\All Users'];
      for (const sysPath of [...systemPaths, ...windowsSystemPaths]) {
        if (resolvedPath.toLowerCase().startsWith(sysPath.toLowerCase())) {
          return { safe: false, reason: 'Access to system directory denied' };
        }
      }
      if (resolvedPath === '/' || resolvedPath.match(/^[A-Z]:\\?$/)) {
        return { safe: false, reason: 'Root directory access denied' };
      }
      return { safe: true };
    } catch {
      return { safe: false, reason: 'Invalid path format' };
    }
  }
}
