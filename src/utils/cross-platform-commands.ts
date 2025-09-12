/**
 * Cross-Platform Command Handler
 *
 * Replaces brittle regex-based command translation with structured, testable command mapping.
 * Provides robust cross-platform command execution without relying on fragile pattern matching.
 *
 * Addresses Issue: Heuristic Windows command fallback is brittle
 */

import { logger } from '../infrastructure/logging/unified-logger.js';
import { getRustExecutor } from '../infrastructure/execution/rust/index.js';
import type { ToolExecutionRequest, ToolExecutionResult } from '@/domain/interfaces/tool-system.js';
import * as path from 'path';

export interface CommandMapping {
  command: string;
  args: string[];
  workingDirectory?: string;
  timeout?: number;
  platformSpecific: {
    win32?: {
      command: string;
      args: string[];
      shell?: boolean;
    };
    linux?: {
      command: string;
      args: string[];
      shell?: boolean;
    };
    darwin?: {
      command: string;
      args: string[];
      shell?: boolean;
    };
  };
}

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  originalCommand: string;
  translatedCommand: string;
}

/**
 * Structured command mappings for common POSIX commands to Windows equivalents
 */
class CrossPlatformCommandRegistry {
  private readonly commandMappings = new Map<string, (args: string[]) => CommandMapping | null>();

  constructor() {
    this.registerBuiltinMappings();
  }

  private registerBuiltinMappings(): void {
    // ls -> dir
    this.commandMappings.set('ls', (args: string[]) => ({
      command: 'ls',
      args,
      platformSpecific: {
        win32: {
          command: 'dir',
          args: this.translateLsArgs(args),
          shell: true,
        },
        linux: { command: 'ls', args },
        darwin: { command: 'ls', args },
      },
    }));

    // cat -> type
    this.commandMappings.set('cat', (args: string[]) => ({
      command: 'cat',
      args,
      platformSpecific: {
        win32: {
          command: 'type',
          args: args.map(arg => path.win32.normalize(arg)),
          shell: true,
        },
        linux: { command: 'cat', args },
        darwin: { command: 'cat', args },
      },
    }));

    // pwd -> cd (no args)
    this.commandMappings.set('pwd', (args: string[]) => ({
      command: 'pwd',
      args,
      platformSpecific: {
        win32: {
          command: 'cd',
          args: [],
          shell: true,
        },
        linux: { command: 'pwd', args },
        darwin: { command: 'pwd', args },
      },
    }));

    // grep -> findstr (with improved translation)
    this.commandMappings.set('grep', (args: string[]) => ({
      command: 'grep',
      args,
      platformSpecific: {
        win32: {
          command: 'findstr',
          args: this.translateGrepArgs(args),
          shell: true,
        },
        linux: { command: 'grep', args },
        darwin: { command: 'grep', args },
      },
    }));

    // find -> where/dir
    this.commandMappings.set('find', (args: string[]) => ({
      command: 'find',
      args,
      platformSpecific: {
        win32: {
          command: 'dir',
          args: this.translateFindArgs(args),
          shell: true,
        },
        linux: { command: 'find', args },
        darwin: { command: 'find', args },
      },
    }));

    // head -> more (partial implementation)
    this.commandMappings.set('head', (args: string[]) => ({
      command: 'head',
      args,
      platformSpecific: {
        win32: {
          command: 'powershell',
          args: this.translateHeadArgs(args),
          shell: false,
        },
        linux: { command: 'head', args },
        darwin: { command: 'head', args },
      },
    }));

    // tail -> powershell Get-Content -Tail
    this.commandMappings.set('tail', (args: string[]) => ({
      command: 'tail',
      args,
      platformSpecific: {
        win32: {
          command: 'powershell',
          args: this.translateTailArgs(args),
          shell: false,
        },
        linux: { command: 'tail', args },
        darwin: { command: 'tail', args },
      },
    }));
  }

  /**
   * Translate ls arguments to Windows dir equivalents
   */
  private translateLsArgs(args: string[]): string[] {
    const result: string[] = [];
    let hasLongFormat = false;
    let hasAll = false;

    for (const arg of args) {
      if (arg === '-l' || arg === '--long') {
        hasLongFormat = true;
      } else if (arg === '-a' || arg === '--all') {
        hasAll = true;
      } else if (arg === '-la' || arg === '-al') {
        hasLongFormat = true;
        hasAll = true;
      } else if (!arg.startsWith('-')) {
        // Path argument
        result.push(path.win32.normalize(arg));
      }
    }

    // Add Windows-specific flags
    if (hasAll) {
      result.unshift('/A'); // Show all files including hidden
    }
    if (hasLongFormat) {
      // No direct equivalent, but we can add more detail
    }

    return result;
  }

  /**
   * Translate grep arguments to Windows findstr equivalents
   */
  private translateGrepArgs(args: string[]): string[] {
    const result: string[] = [];
    let pattern = '';
    let files: string[] = [];
    let isRecursive = false;
    let isRegex = false;
    let isCaseInsensitive = false;
    let isInvertMatch = false;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '-r' || arg === '--recursive') {
        isRecursive = true;
      } else if (arg === '-E' || arg === '--extended-regexp') {
        isRegex = true;
      } else if (arg === '-i' || arg === '--ignore-case') {
        isCaseInsensitive = true;
      } else if (arg === '-v' || arg === '--invert-match') {
        isInvertMatch = true;
      } else if (arg.startsWith('-')) {
        // Other flags - may need individual handling
        continue;
      } else if (!pattern) {
        pattern = arg;
      } else {
        files.push(path.win32.normalize(arg));
      }
    }

    // Build findstr command
    if (isRecursive) result.push('/S');
    if (isRegex) result.push('/R');
    if (isCaseInsensitive) result.push('/I');
    if (isInvertMatch) result.push('/V');

    if (pattern) {
      result.push(`"${pattern}"`);
    }

    if (files.length > 0) {
      result.push(...files);
    } else {
      result.push('*');
    }

    return result;
  }

  /**
   * Translate find arguments to Windows dir equivalents
   */
  private translateFindArgs(args: string[]): string[] {
    const result: string[] = ['/S', '/B']; // Subdirectories, bare format
    let searchPath = '.';
    let namePattern = '*';

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '-name' && nextArg) {
        namePattern = nextArg;
        i++; // Skip next arg as we consumed it
      } else if (arg === '-type' && nextArg) {
        if (nextArg === 'd') {
          result.push('/AD'); // Directories only
        } else if (nextArg === 'f') {
          result.push('/A-D'); // Files only
        }
        i++;
      } else if (!arg.startsWith('-')) {
        searchPath = path.win32.normalize(arg);
      }
    }

    result.push(path.join(searchPath, namePattern));
    return result;
  }

  /**
   * Translate head arguments to PowerShell equivalents
   */
  private translateHeadArgs(args: string[]): string[] {
    let lines = 10;
    let file = '';

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '-n' && args[i + 1]) {
        lines = parseInt(args[i + 1], 10) || 10;
        i++;
      } else if (arg.match(/^-\d+$/)) {
        lines = parseInt(arg.substring(1), 10);
      } else if (!arg.startsWith('-')) {
        file = arg;
      }
    }

    return ['-Command', `Get-Content "${file}" -Head ${lines}`];
  }

  /**
   * Translate tail arguments to PowerShell equivalents
   */
  private translateTailArgs(args: string[]): string[] {
    let lines = 10;
    let file = '';
    let follow = false;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '-n' && args[i + 1]) {
        lines = parseInt(args[i + 1], 10) || 10;
        i++;
      } else if (arg === '-f' || arg === '--follow') {
        follow = true;
      } else if (arg.match(/^-\d+$/)) {
        lines = parseInt(arg.substring(1), 10);
      } else if (!arg.startsWith('-')) {
        file = arg;
      }
    }

    if (follow) {
      return ['-Command', `Get-Content "${file}" -Tail ${lines} -Wait`];
    } else {
      return ['-Command', `Get-Content "${file}" -Tail ${lines}`];
    }
  }

  /**
   * Get command mapping for a given command
   */
  public getMapping(command: string, args: string[]): CommandMapping | null {
    const mapper = this.commandMappings.get(command.toLowerCase());
    return mapper ? mapper(args) : null;
  }

  /**
   * Register a custom command mapping
   */
  public registerMapping(command: string, mapper: (args: string[]) => CommandMapping | null): void {
    this.commandMappings.set(command.toLowerCase(), mapper);
  }

  /**
   * Get the platform-specific command for execution
   */
  public getPlatformCommand(mapping: CommandMapping): {
    command: string;
    args: string[];
    shell: boolean;
  } {
    const platform = process.platform as keyof CommandMapping['platformSpecific'];
    const platformMapping = mapping.platformSpecific[platform];

    if (platformMapping) {
      return {
        command: platformMapping.command,
        args: platformMapping.args,
        shell: platformMapping.shell ?? false,
      };
    }

    // Fallback to original command
    return {
      command: mapping.command,
      args: mapping.args,
      shell: false,
    };
  }

  /**
   * Check if a command has a mapping
   */
  public hasMapping(command: string): boolean {
    return this.commandMappings.has(command.toLowerCase());
  }

  /**
   * Get all supported commands
   */
  public getSupportedCommands(): string[] {
    return Array.from(this.commandMappings.keys());
  }
}

// Export singleton instance
export const crossPlatformCommands = new CrossPlatformCommandRegistry();

/**
 * High-level function to execute cross-platform commands
 */
export async function executeCrossPlatformCommand(
  command: string,
  args: string[],
  options: {
    workingDirectory?: string;
    timeout?: number;
    encoding?: BufferEncoding;
  } = {}
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const mapping = crossPlatformCommands.getMapping(command, args);

  if (!mapping) {
    logger.debug(`No cross-platform mapping for command: ${command}`);
    throw new Error(`Unsupported cross-platform command: ${command}`);
  }

  const platformCmd = crossPlatformCommands.getPlatformCommand(mapping);
  const originalCommand = `${command} ${args.join(' ')}`;
  const translatedCommand = `${platformCmd.command} ${platformCmd.args.join(' ')}`;

  logger.info(`Executing cross-platform command: ${originalCommand} -> ${translatedCommand}`);

  // Route execution via Rust bridge (TS orchestrates, Rust executes)
  const rust = getRustExecutor();
  await rust.initialize();
  const req: ToolExecutionRequest = {
    toolId: 'command',
    arguments: {
      command: platformCmd.command,
      args: platformCmd.args,
    },
    context: {
      sessionId: 'cross-platform-command',
      workingDirectory: options.workingDirectory || process.cwd(),
      environment: process.env as Record<string, string>,
      securityLevel: 'medium',
      permissions: [],
      timeoutMs: options.timeout || 30000,
    },
  };

  const result: ToolExecutionResult = await rust.execute(req);
  const duration = Date.now() - startTime;
  const data: any = result.result;
  const stdout = typeof data?.stdout === 'string' ? data.stdout : typeof data === 'string' ? data : '';
  const stderr = typeof data?.stderr === 'string' ? data.stderr : '';
  const exitCode = typeof data?.exitCode === 'number' ? data.exitCode : result.success ? 0 : 1;

  return {
    success: result.success,
    stdout,
    stderr,
    exitCode,
    duration,
    originalCommand,
    translatedCommand,
  };
}
