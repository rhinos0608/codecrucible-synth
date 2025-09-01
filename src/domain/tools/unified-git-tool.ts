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
  constructor(context?: { workingDirectory?: string }) {
    const workingDirectory = context?.workingDirectory || process.cwd();

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

  async execute(
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    try {
      const operation = args.operation || 'status';
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
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'git_operation_failed',
          message: error instanceof Error ? error.message : 'Unknown git error',
        },
      };
    }
  }

  private buildGitArgs(operation: string, args: any): string[] {
    const gitArgs: string[] = [operation];

    switch (operation) {
      case 'add':
        if (args.files && Array.isArray(args.files)) {
          gitArgs.push(...args.files);
        } else {
          gitArgs.push('.');
        }
        break;
      case 'commit':
        if (args.message) {
          gitArgs.push('-m', args.message);
        }
        break;
      case 'branch':
        if (args.branch) {
          gitArgs.push(args.branch);
        }
        break;
      case 'log':
        gitArgs.push('--oneline', '--max-count=10'); // Sensible defaults
        break;
      case 'diff':
        if (args.files && Array.isArray(args.files)) {
          gitArgs.push(...args.files);
        }
        break;
    }

    // Add additional arguments
    if (args.args && Array.isArray(args.args)) {
      gitArgs.push(...args.args);
    }

    return gitArgs;
  }

  private async runGitCommand(args: string[], context: ToolExecutionContext): Promise<string> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, { cwd: context.workingDirectory });
      let stdout = '';
      let stderr = '';

      git.stdout.on('data', data => {
        stdout += data.toString();
      });

      git.stderr.on('data', data => {
        stderr += data.toString();
      });

      git.on('close', code => {
        if (code === 0) {
          resolve(stdout || 'Git command completed successfully');
        } else {
          reject(new Error(`Git command failed (exit code ${code}): ${stderr || stdout}`));
        }
      });

      git.on('error', error => {
        reject(new Error(`Failed to spawn git: ${error.message}`));
      });
    });
  }
}
