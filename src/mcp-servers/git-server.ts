/**
 * Git MCP Server
 * Provides secure git operations via MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getRustExecutor } from '../infrastructure/execution/rust/index.js';
import type { ToolExecutionRequest, ToolExecutionResult } from '@/domain/interfaces/tool-system.js';
import { logger } from '../infrastructure/logging/logger.js';


interface GitConfig {
  repoPath?: string;
  allowedOperations?: string[];
  blockedOperations?: string[];
  maxDiffSize?: number;
}

interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class GitMCPServer {
  private readonly server: Server;
  private readonly config: GitConfig;
  private initialized: boolean = false;

  public constructor(config: Readonly<GitConfig> = {}) {
    this.config = {
      repoPath: config.repoPath ?? process.cwd(),
      allowedOperations: config.allowedOperations ?? [
        'status',
        'log',
        'diff',
        'branch',
        'add',
        'commit',
        'push',
        'pull',
        'fetch',
        'checkout',
        'merge',
      ],
      blockedOperations: config.blockedOperations ?? ['reset --hard', 'force', 'clean -fd'],
      maxDiffSize: config.maxDiffSize ?? 1000000, // 1MB diff limit
    };

    this.server = new Server(
      {
        name: 'git-mcp-server',
        version: '1.0.0',
        description: 'Secure git operations via MCP protocol',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupRequestHandlers();
  }

  private setupRequestHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, () => {
      return {
        tools: [
          {
            name: 'git_status',
            description: 'Get git repository status',
            inputSchema: {
              type: 'object',
              properties: {
                short: { type: 'boolean', description: 'Show short format' },
              },
            },
          },
          {
            name: 'git_log',
            description: 'Get git commit history',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Number of commits to show' },
                oneline: { type: 'boolean', description: 'Show in oneline format' },
              },
            },
          },
          {
            name: 'git_diff',
            description: 'Show changes between commits or working tree',
            inputSchema: {
              type: 'object',
              properties: {
                staged: { type: 'boolean', description: 'Show staged changes' },
                commit: { type: 'string', description: 'Specific commit to diff against' },
              },
            },
          },
          {
            name: 'git_branch',
            description: 'List, create, or delete branches',
            inputSchema: {
              type: 'object',
              properties: {
                list: { type: 'boolean', description: 'List branches' },
                create: { type: 'string', description: 'Create new branch' },
                delete: { type: 'string', description: 'Delete branch' },
                current: { type: 'boolean', description: 'Show current branch' },
              },
            },
          },
          {
            name: 'git_add',
            description: 'Add files to staging area',
            inputSchema: {
              type: 'object',
              properties: {
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Files to add',
                },
                all: { type: 'boolean', description: 'Add all changes' },
              },
            },
          },
          {
            name: 'git_commit',
            description: 'Commit staged changes',
            inputSchema: {
              type: 'object',
              properties: {
                message: { type: 'string', description: 'Commit message' },
                amend: { type: 'boolean', description: 'Amend previous commit' },
              },
              required: ['message'],
            },
          },
          {
            name: 'git_push',
            description: 'Push commits to remote',
            inputSchema: {
              type: 'object',
              properties: {
                remote: { type: 'string', description: 'Remote name (default: origin)' },
                branch: { type: 'string', description: 'Branch name' },
                setUpstream: { type: 'boolean', description: 'Set upstream branch' },
              },
            },
          },
          {
            name: 'git_pull',
            description: 'Pull changes from remote',
            inputSchema: {
              type: 'object',
              properties: {
                remote: { type: 'string', description: 'Remote name (default: origin)' },
                branch: { type: 'string', description: 'Branch name' },
                rebase: { type: 'boolean', description: 'Rebase instead of merge' },
              },
            },
          },
          {
            name: 'git_checkout',
            description: 'Switch branches or restore files',
            inputSchema: {
              type: 'object',
              properties: {
                branch: { type: 'string', description: 'Branch to checkout' },
                createNew: { type: 'boolean', description: 'Create new branch' },
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Files to restore',
                },
              },
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;
      const typedArgs = (args ?? {}) as { [key: string]: unknown };

      try {
        switch (name) {
          case 'git_status':
            return await this.gitStatus(typedArgs.short as boolean);

          case 'git_log':
            return await this.gitLog(typedArgs.limit as number, typedArgs.oneline as boolean);

          case 'git_diff':
            return await this.gitDiff(typedArgs.staged as boolean, typedArgs.commit as string);

          case 'git_branch':
            return await this.gitBranch(typedArgs);

          case 'git_add':
            return await this.gitAdd(typedArgs.files as string[], typedArgs.all as boolean);

          case 'git_commit':
            return await this.gitCommit(typedArgs.message as string, typedArgs.amend as boolean);

          case 'git_push':
            return await this.gitPush(
              typedArgs.remote as string,
              typedArgs.branch as string,
              typedArgs.setUpstream as boolean
            );

          case 'git_pull':
            return await this.gitPull(
              typedArgs.remote as string,
              typedArgs.branch as string,
              typedArgs.rebase as boolean
            );

          case 'git_checkout':
            return await this.gitCheckout(
              typedArgs.branch as string,
              typedArgs.createNew as boolean,
              typedArgs.files as string[]
            );

          default:
            return {
              content: [{ type: 'text', text: `Unknown tool: ${name}` }],
              isError: true,
            };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Git operation failed: ${errorMessage}`);
        return {
          content: [{ type: 'text', text: `Error: ${errorMessage}` }],
          isError: true,
        };
      }
    });
  }

  private async executeGitCommand(command: string): Promise<GitResult> {
    const split = (cmd: string): { c: string; a: string[] } => {
      const parts = cmd.split(/\s+/).filter(Boolean);
      const c = parts.shift() || 'git';
      return { c, a: parts };
    };
    const { c, a } = split(command);
    const rust = getRustExecutor();
    await rust.initialize();
    const req: ToolExecutionRequest = {
      toolId: 'command',
      arguments: { command: c, args: a },
      context: {
        sessionId: 'git-mcp',
        workingDirectory: this.config.repoPath || process.cwd(),
        environment: process.env as Record<string, string>,
        securityLevel: 'medium',
        permissions: [],
        timeoutMs: 60000,
      },
    };
    const result: ToolExecutionResult = await rust.execute(req);
    const data: unknown = result.result;
    const outObj = (typeof data === 'object' && data !== null ? (data as any) : {}) as {
      stdout?: string;
      stderr?: string;
      exitCode?: number;
    };
    const stdout = typeof outObj.stdout === 'string' ? outObj.stdout : typeof data === 'string' ? (data as string) : '';
    const stderr = typeof outObj.stderr === 'string' ? outObj.stderr : '';
    const exitCode = typeof outObj.exitCode === 'number' ? outObj.exitCode : result.success ? 0 : 1;
    return { stdout, stderr, exitCode };
  }

  private async gitStatus(
    short?: boolean
  ): Promise<{ content: { type: string; text: string }[]; isError: boolean }> {
    const command = short ? 'git status -s' : 'git status';
    const result = await this.executeGitCommand(command);
    return {
      content: [{ type: 'text', text: result.stdout || result.stderr }],
      isError: result.exitCode !== 0,
    };
  }

  private async gitLog(
    limit?: number,
    oneline?: boolean
  ): Promise<{ content: { type: string; text: string }[]; isError: boolean }> {
    let command = 'git log';
    if (oneline) command += ' --oneline';
    if (limit) command += ` -n ${limit}`;

    const result = await this.executeGitCommand(command);
    return {
      content: [{ type: 'text', text: result.stdout || result.stderr }],
      isError: result.exitCode !== 0,
    };
  }

  private async gitDiff(
    staged?: boolean,
    commit?: string
  ): Promise<{ content: { type: string; text: string }[]; isError: boolean }> {
    let command = 'git diff';
    if (staged) command += ' --staged';
    if (commit) command += ` ${commit}`;

    const result = await this.executeGitCommand(command);

    // Check diff size
    const maxDiffSize = this.config.maxDiffSize ?? 1000000;
    if (result.stdout.length > maxDiffSize) {
      return {
        content: [
          { type: 'text', text: 'Diff too large. Use more specific file paths or commits.' },
        ],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text', text: result.stdout || 'No changes' }],
      isError: result.exitCode !== 0,
    };
  }

  private async gitBranch(
    options: Readonly<{
      list?: boolean;
      create?: string;
      delete?: string;
      current?: boolean;
    }>
  ): Promise<{ content: { type: string; text: string }[]; isError: boolean }> {
    let command = 'git branch';

    if (options.list) {
      command += ' -a';
    } else if (options.create) {
      command += ` ${options.create}`;
    } else if (options.delete) {
      command += ` -d ${options.delete}`;
    } else if (options.current) {
      command = 'git branch --show-current';
    }

    const result = await this.executeGitCommand(command);
    return {
      content: [{ type: 'text', text: result.stdout || result.stderr }],
      isError: result.exitCode !== 0,
    };
  }

  private async gitAdd(
    files?: readonly string[],
    all?: boolean
  ): Promise<{ content: { type: string; text: string }[]; isError: boolean }> {
    let command = 'git add';

    if (all) {
      command += ' -A';
    } else if (files && files.length > 0) {
      // Sanitize file paths
      const sanitizedFiles = files.map(f => `"${f.replace(/"/g, '\\"')}"`);
      command += ` ${sanitizedFiles.join(' ')}`;
    } else {
      return {
        content: [{ type: 'text', text: 'No files specified' }],
        isError: true,
      };
    }

    const result = await this.executeGitCommand(command);
    return {
      content: [{ type: 'text', text: result.stdout || 'Files added to staging' }],
      isError: result.exitCode !== 0,
    };
  }

  private async gitCommit(
    message: string,
    amend?: boolean
  ): Promise<{ content: { type: string; text: string }[]; isError: boolean }> {
    if (!message && !amend) {
      return {
        content: [{ type: 'text', text: 'Commit message required' }],
        isError: true,
      };
    }

    // Sanitize commit message
    const sanitizedMessage = message.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    let command = `git commit -m "${sanitizedMessage}"`;

    if (amend) {
      command = message
        ? `git commit --amend -m "${sanitizedMessage}"`
        : 'git commit --amend --no-edit';
    }

    const result = await this.executeGitCommand(command);
    return {
      content: [{ type: 'text', text: result.stdout || result.stderr }],
      isError: result.exitCode !== 0,
    };
  }

  private async gitPush(
    remote?: string,
    branch?: string,
    setUpstream?: boolean
  ): Promise<{ content: { type: string; text: string }[]; isError: boolean }> {
    let command = 'git push';

    if (remote) command += ` ${remote}`;
    if (branch) command += ` ${branch}`;
    if (setUpstream) command += ' -u';

    const result = await this.executeGitCommand(command);
    return {
      content: [{ type: 'text', text: result.stdout || result.stderr }],
      isError: result.exitCode !== 0,
    };
  }

  private async gitPull(
    remote?: string,
    branch?: string,
    rebase?: boolean
  ): Promise<{ content: { type: string; text: string }[]; isError: boolean }> {
    let command = 'git pull';

    if (rebase) command += ' --rebase';
    if (remote) command += ` ${remote}`;
    if (branch) command += ` ${branch}`;

    const result = await this.executeGitCommand(command);
    return {
      content: [{ type: 'text', text: result.stdout || result.stderr }],
      isError: result.exitCode !== 0,
    };
  }

  private async gitCheckout(
    branch?: string,
    createNew?: boolean,
    files?: readonly string[]
  ): Promise<{ content: { type: string; text: string }[]; isError: boolean }> {
    let command = 'git checkout';

    if (createNew && branch) {
      command += ` -b ${branch}`;
    } else if (branch) {
      command += ` ${branch}`;
    } else if (files && files.length > 0) {
      const sanitizedFiles = files.map(f => `"${f.replace(/"/g, '\\"')}"`);
      command += ` -- ${sanitizedFiles.join(' ')}`;
    } else {
      return {
        content: [{ type: 'text', text: 'No branch or files specified' }],
        isError: true,
      };
    }

    const result = await this.executeGitCommand(command);
    return {
      content: [{ type: 'text', text: result.stdout || result.stderr }],
      isError: result.exitCode !== 0,
    };
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    // Check if current directory is a git repository
    const result = await this.executeGitCommand('git rev-parse --git-dir');
    if (result.exitCode !== 0) {
      logger.warn('Not in a git repository');
    }

    this.initialized = true;
    logger.info('Git MCP Server initialized');
  }

  public shutdown(): void {
    this.initialized = false;
    logger.info('Git MCP Server shutdown');
  }

  public getServer(): Server {
    return this.server;
  }
}
