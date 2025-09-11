/**
 * Unified Git Tool
 *
 * Consolidates git-tools.ts and enhanced-git-tools.ts into single implementation
 * with configurable strategies for different git operations.
 */

import { spawn } from 'child_process';
import { BaseTool } from './unified-tool-system.js';
import {
  ToolExecutionContext,
  ToolExecutionResult,
  ToolParameterSchema,
} from '../interfaces/tool-system.js';

export class UnifiedGitTool extends BaseTool {
  public constructor(context?: Readonly<{ workingDirectory?: string }>) {
    const workingDirectory = context?.workingDirectory ?? process.cwd();

    const parameters: ToolParameterSchema = {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'Git operation to perform',
          enum: [
            'status',
            'log',
            'diff',
            'branch',
            'remote',
            'add',
            'commit',
            'push',
            'pull',
            'stash',
          ],
          default: 'status',
        },
        args: {
          type: 'array',
          description: 'Additional git command arguments',
          default: [],
        },
        files: {
          type: 'array',
          description: 'Specific files to operate on (for add, diff, etc.)',
        },
        message: {
          type: 'string',
          description: 'Commit message (for commit operation)',
        },
        branch: {
          type: 'string',
          description: 'Branch name (for branch operations)',
        },
      },
      required: ['operation'],
    };

    super({
      name: 'Unified Git Tool',
      description: 'Comprehensive git operations - replaces multiple git tool implementations',
      category: 'git',
      parameters,
      securityLevel: 'restricted',
      permissions: [
        { type: 'read', resource: workingDirectory, scope: 'directory' },
        { type: 'execute', resource: 'git', scope: 'system' },
      ],
    });
  }

  public async execute(
    args: Readonly<{
      operation?:
        | 'status'
        | 'log'
        | 'diff'
        | 'branch'
        | 'remote'
        | 'add'
        | 'commit'
        | 'push'
        | 'pull'
        | 'stash';
      args?: readonly string[];
      files?: readonly string[];
      message?: string;
      branch?: string;
    }>,
    context: Readonly<ToolExecutionContext>
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    try {
      const operation:
        | 'status'
        | 'log'
        | 'diff'
        | 'branch'
        | 'remote'
        | 'add'
        | 'commit'
        | 'push'
        | 'pull'
        | 'stash' = args.operation ?? 'status';
      const gitArgs = this.buildGitArgs(operation, args);
      const result = await this.runGitCommand(gitArgs, context);

      return {
        success: true,
        result,
        metadata: {
          operation,
          workingDirectory: context.workingDirectory,
          timestamp: new Date().toISOString(),
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'git_operation_failed',
          message: error instanceof Error ? error.message : 'Unknown git error',
        },
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private buildGitArgs(
    operation:
      | 'status'
      | 'log'
      | 'diff'
      | 'branch'
      | 'remote'
      | 'add'
      | 'commit'
      | 'push'
      | 'pull'
      | 'stash',
    args: Readonly<{
      args?: readonly string[];
      files?: readonly string[];
      message?: string;
      branch?: string;
    }>
  ): string[] {
    const gitArgs: string[] = [operation];

    switch (operation) {
      case 'add':
        if (Array.isArray(args.files) && args.files.length > 0) {
          gitArgs.push(...(args.files as readonly string[]));
        } else {
          gitArgs.push('.');
        }
        break;
      case 'commit':
        if (typeof args.message === 'string') {
          gitArgs.push('-m', args.message);
        }
        break;
      case 'branch':
        if (typeof args.branch === 'string') {
          gitArgs.push(args.branch);
        }
        break;
      case 'log':
        gitArgs.push('--oneline', '--max-count=10'); // Sensible defaults
        break;
      case 'diff':
        if (Array.isArray(args.files) && args.files.length > 0) {
          gitArgs.push(...(args.files as readonly string[]));
        }
        break;
      default:
        // No additional arguments for other operations
        break;
    }

    // Add additional arguments
    if (Array.isArray(args.args) && args.args.length > 0) {
      gitArgs.push(...(args.args as readonly string[]));
    }

    return gitArgs;
  }

  private async runGitCommand(
    args: ReadonlyArray<string>,
    context: Readonly<ToolExecutionContext>
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, { cwd: context.workingDirectory });
      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data: Readonly<Buffer>) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data: Readonly<Buffer>) => {
        stderr += data.toString();
      });

      git.on('close', code => {
        if (code === 0) {
          resolve(stdout || 'Git command completed successfully');
        } else {
          reject(new Error(`Git command failed (exit code ${code}): ${stderr || stdout}`));
        }
      });

      git.on('error', (error: Readonly<Error>) => {
        reject(new Error(`Failed to spawn git: ${error.message}`));
      });
    });
  }
}
