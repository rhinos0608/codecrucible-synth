
import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { spawn } from 'child_process';

const GitStatusSchema = z.object({});

export class GitStatusTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'gitStatus',
      description: 'Gets the current git status.',
      category: 'Git',
      parameters: GitStatusSchema,
    });
  }

  async execute(args: z.infer<typeof GitStatusSchema>): Promise<string> {
    return await this.runGitCommand(['status']);
  }

  private async runGitCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, { cwd: this.agentContext.workingDirectory });
      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr));
        }
      });
    });
  }
}

const GitDiffSchema = z.object({});

export class GitDiffTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'gitDiff',
      description: 'Gets the current git diff.',
      category: 'Git',
      parameters: GitDiffSchema,
    });
  }

  async execute(args: z.infer<typeof GitDiffSchema>): Promise<string> {
    return await this.runGitCommand(['diff']);
  }

  private async runGitCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, { cwd: this.agentContext.workingDirectory });
      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr));
        }
      });
    });
  }
}
