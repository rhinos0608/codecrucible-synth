// Generic tool handler types
export interface ToolRequest {
  [key: string]: unknown;
}

export interface ToolResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  warning?: string;
  suggestion?: string;
}

export type ToolHandler<TReq extends ToolRequest = ToolRequest, TRes = unknown> = (
  args: TReq
) => Promise<ToolResponse<TRes>>;

// Simple base class for MCP servers to maintain compatibility
class BaseMCPServer {
  protected tools: Record<string, ToolHandler> = {};

  constructor(
    public id: string,
    public description: string
  ) {}
}
import {
  ApprovalManager,
  Operation,
  OperationContext,
} from '../domain/approval/approval-manager.js';
import { logger } from '../infrastructure/logging/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitStatus {
  branch: string;
  staged: string[];
  modified: string[];
  untracked: string[];
  ahead: number;
  behind: number;
  clean: boolean;
}

export interface GitCommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
  files: string[];
}

export interface GitDiffResult {
  file: string;
  additions: number;
  deletions: number;
  patch: string;
}

export interface CommitArgs {
  message: string;
  files?: string[];
  amend?: boolean;
  signoff?: boolean;
}

export interface BranchArgs {
  name: string;
  checkout?: boolean;
  delete?: boolean;
  remote?: string;
}

export interface MergeArgs {
  branch: string;
  strategy?: 'merge' | 'rebase' | 'squash';
  noFastForward?: boolean;
}

export interface TagArgs {
  name: string;
  message?: string;
  delete?: boolean;
  push?: boolean;
}

// Request/response interfaces for Git tool handlers
export interface GitDiffRequest {
  files?: string[];
  staged?: boolean;
  commit?: string;
}

export interface GitLogRequest {
  limit?: number;
  since?: string;
  author?: string;
  grep?: string;
}

export interface GitAddRequest {
  files: string[];
  all?: boolean;
}

export interface GitPushRequest {
  remote?: string;
  branch?: string;
  force?: boolean;
  setUpstream?: boolean;
}

export interface GitPullRequest {
  remote?: string;
  branch?: string;
  rebase?: boolean;
}

export interface GitCheckoutRequest {
  target: string;
  createBranch?: boolean;
  force?: boolean;
}

export interface GitResetRequest {
  mode?: 'soft' | 'mixed' | 'hard';
  target?: string;
}

export interface GitRebaseRequest {
  target: string;
  interactive?: boolean;
  abort?: boolean;
  continue?: boolean;
}

export interface GitRemoteRequest {
  action: 'add' | 'remove' | 'list' | 'show';
  name?: string;
  url?: string;
}

export interface GitStashRequest {
  action: 'save' | 'pop' | 'list' | 'show' | 'drop';
  message?: string;
  index?: number;
}

export interface GitCleanRequest {
  dryRun?: boolean;
  force?: boolean;
  directories?: boolean;
  ignored?: boolean;
}

export interface GitAddResponse {
  staged: string[] | 'all files';
}

export interface GitPushResponse {
  remote: string;
  branch: string;
  output: string;
}

export interface GitPullResponse {
  remote: string;
  branch: string;
  output: string;
  rebase?: boolean;
}

/**
 * Git operations MCP server with approval workflow integration
 * Provides safe Git operations with user confirmation for destructive actions
 */
export class GitMCPServer extends BaseMCPServer {
  private approvalManager: ApprovalManager;
  private workspaceRoot: string;

  constructor(approvalManager: ApprovalManager, workspaceRoot: string) {
    super('git-operations', 'Git version control operations with safety checks');
    this.approvalManager = approvalManager;
    this.workspaceRoot = workspaceRoot;

    // Register tool handlers
    this.tools = {
      git_status: this.handleGitStatus.bind(this),
      git_diff: this.handleGitDiff.bind(this),
      git_log: this.handleGitLog.bind(this),
      git_add: this.handleGitAdd.bind(this) as unknown as ToolHandler<ToolRequest, unknown>,
      git_commit: this.handleGitCommit.bind(this) as unknown as ToolHandler<ToolRequest, unknown>,
      git_push: this.handleGitPush.bind(this) as unknown as ToolHandler<ToolRequest, unknown>,
      git_pull: this.handleGitPull.bind(this) as unknown as ToolHandler<ToolRequest, unknown>,
      git_branch: this.handleGitBranch.bind(this) as unknown as ToolHandler<ToolRequest, unknown>,
      git_checkout: this.handleGitCheckout.bind(this) as unknown as ToolHandler<ToolRequest, unknown>,
      git_merge: this.handleGitMerge.bind(this) as unknown as ToolHandler<ToolRequest, unknown>,
      git_rebase: this.handleGitRebase.bind(this) as unknown as ToolHandler<ToolRequest, unknown>,
      git_reset: this.handleGitReset.bind(this) as unknown as ToolHandler<ToolRequest, unknown>,
      git_tag: this.handleGitTag.bind(this) as unknown as ToolHandler<ToolRequest, unknown>,
      git_remote: this.handleGitRemote.bind(this) as unknown as ToolHandler<ToolRequest, unknown>,
      git_stash: this.handleGitStash.bind(this) as unknown as ToolHandler<ToolRequest, unknown>,
      git_clean: this.handleGitClean.bind(this) as unknown as ToolHandler<ToolRequest, unknown>,
    } satisfies Record<string, ToolHandler>;

    logger.info('Git MCP server initialized', { workspaceRoot });
  }

  /**
   * Get Git repository status
   */
  async handleGitStatus(): Promise<ToolResponse<GitStatus>> {
    try {
      const isRepo = await this.isGitRepository();
      if (!isRepo) {
        return {
          success: false,
          error: 'Not a Git repository',
        };
      }

      const status = await this.getGitStatus();

      return {
        success: true,
        data: status,
      };
    } catch (error) {
      logger.error('Git status failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git status failed',
      };
    }
  }

  /**
   * Get Git diff
   */
  async handleGitDiff(args: GitDiffRequest): Promise<ToolResponse<GitDiffResult[]>> {
    try {
      const { files = [], staged = false, commit } = args;

      let command = 'git diff';
      if (staged) command += ' --cached';
      if (commit) command += ` ${commit}`;
      if (files.length > 0) command += ` -- ${files.join(' ')}`;

      const { stdout } = await execAsync(command, { cwd: this.workspaceRoot });

      // Parse diff output
      const diffs = this.parseDiffOutput(stdout);

      return {
        success: true,
        data: diffs,
      };
    } catch (error) {
      logger.error('Git diff failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git diff failed',
      };
    }
  }

  /**
   * Get Git log
   */
  async handleGitLog(args: GitLogRequest): Promise<ToolResponse<GitCommitInfo[]>> {
    try {
      const { limit = 10, since, author, grep } = args;

      let command = `git log --oneline --graph --decorate -${limit}`;
      if (since) command += ` --since="${since}"`;
      if (author) command += ` --author="${author}"`;
      if (grep) command += ` --grep="${grep}"`;

      const { stdout } = await execAsync(command, { cwd: this.workspaceRoot });

      // Parse log output
      const commits = this.parseLogOutput(stdout);

      return {
        success: true,
        data: commits,
      };
    } catch (error) {
      logger.error('Git log failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git log failed',
      };
    }
  }

  /**
   * Add files to Git staging area
   */
  async handleGitAdd(args: GitAddRequest): Promise<ToolResponse<GitAddResponse>> {
    try {
      const { files, all = false } = args;

      const operation: Operation = {
        type: 'git-operation',
        target: all ? 'all files' : files.join(', '),
        description: `Add ${all ? 'all files' : `${files.length} file(s)`} to staging area`,
      };

      const context: OperationContext = {
        sandboxMode: 'workspace-write', // Git operations are generally safe in workspace
        workspaceRoot: this.workspaceRoot,
        userIntent: 'Stage files for commit',
        sessionId: this.generateSessionId(),
      };

      const approval = await this.approvalManager.requestApproval(operation, context);
      if (!approval.granted) {
        return {
          success: false,
          error: 'Operation not approved',
          suggestion: approval.suggestions?.[0],
        };
      }

      let command = 'git add';
      if (all) {
        command += ' .';
      } else {
        command += ` ${files.map(f => `"${f}"`).join(' ')}`;
      }

      await execAsync(command, { cwd: this.workspaceRoot });

      return {
        success: true,
        data: { staged: all ? 'all files' : files },
      };
    } catch (error) {
      logger.error('Git add failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git add failed',
      };
    }
  }

  /**
   * Commit changes
   */
  async handleGitCommit(
    args: CommitArgs
  ): Promise<ToolResponse<{ hash: string; message: string; amend: boolean; files: string[] }>> {
    try {
      const { message, files, amend = false, signoff = false } = args;

      // Check if there are staged changes
      const status = await this.getGitStatus();
      if (!amend && status.staged.length === 0) {
        return {
          success: false,
          error: 'No staged changes to commit',
          suggestion: 'Use git_add to stage files first',
        };
      }

      const operation: Operation = {
        type: 'git-operation',
        target: amend ? 'previous commit' : 'staged changes',
        description: `${amend ? 'Amend' : 'Create'} commit: "${message}"`,
        metadata: { files, amend, signoff },
      };

      const context: OperationContext = {
        sandboxMode: 'workspace-write',
        workspaceRoot: this.workspaceRoot,
        userIntent: 'Commit changes to repository',
        sessionId: this.generateSessionId(),
      };

      const approval = await this.approvalManager.requestApproval(operation, context);
      if (!approval.granted) {
        return {
          success: false,
          error: 'Commit not approved',
          suggestion: approval.suggestions?.[0],
        };
      }

      let command = `git commit -m "${message}"`;
      if (amend) command += ' --amend';
      if (signoff) command += ' --signoff';

      const { stdout } = await execAsync(command, { cwd: this.workspaceRoot });

      // Extract commit hash from output
      const commitHash = this.extractCommitHash(stdout);

      return {
        success: true,
        data: {
          hash: commitHash,
          message,
          amend,
          files: files || status.staged,
        },
      };
    } catch (error) {
      logger.error('Git commit failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git commit failed',
      };
    }
  }

  /**
   * Push changes to remote
   */
  async handleGitPush(args: GitPushRequest): Promise<ToolResponse<GitPushResponse>> {
    try {
      const { remote = 'origin', branch, force = false, setUpstream = false } = args;

      const operation: Operation = {
        type: 'git-operation',
        target: `${remote}/${branch || 'current branch'}`,
        description: `Push changes to remote repository${force ? ' (force push)' : ''}`,
        metadata: { remote, branch, force, setUpstream },
      };

      const context: OperationContext = {
        sandboxMode: force ? 'full-access' : 'workspace-write', // Force push is more dangerous
        workspaceRoot: this.workspaceRoot,
        userIntent: 'Push commits to remote repository',
        sessionId: this.generateSessionId(),
      };

      const approval = await this.approvalManager.requestApproval(operation, context);
      if (!approval.granted) {
        return {
          success: false,
          error: 'Push not approved',
          suggestion: approval.suggestions?.[0],
        };
      }

      let command = `git push ${remote}`;
      if (branch) command += ` ${branch}`;
      if (force) command += ' --force-with-lease'; // Safer than --force
      if (setUpstream) command += ' --set-upstream';

      const { stdout, stderr } = await execAsync(command, { cwd: this.workspaceRoot });

      return {
        success: true,
        data: {
          remote,
          branch: branch || 'current',
          output: stdout + stderr,
        },
      };
    } catch (error) {
      logger.error('Git push failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git push failed',
      };
    }
  }

  /**
   * Pull changes from remote
   */
  async handleGitPull(args: GitPullRequest): Promise<ToolResponse<GitPullResponse>> {
    try {
      const { remote = 'origin', branch, rebase = false } = args;

      const operation: Operation = {
        type: 'git-operation',
        target: `${remote}/${branch || 'current branch'}`,
        description: `Pull changes from remote repository${rebase ? ' (with rebase)' : ''}`,
        metadata: { remote, branch, rebase },
      };

      const context: OperationContext = {
        sandboxMode: 'workspace-write',
        workspaceRoot: this.workspaceRoot,
        userIntent: 'Pull latest changes from remote',
        sessionId: this.generateSessionId(),
      };

      const approval = await this.approvalManager.requestApproval(operation, context);
      if (!approval.granted) {
        return {
          success: false,
          error: 'Pull not approved',
          suggestion: approval.suggestions?.[0],
        };
      }

      let command = `git pull ${remote}`;
      if (branch) command += ` ${branch}`;
      if (rebase) command += ' --rebase';

      const { stdout, stderr } = await execAsync(command, { cwd: this.workspaceRoot });

      return {
        success: true,
        data: {
          remote,
          branch: branch || 'current',
          rebase,
          output: stdout + stderr,
        },
      };
    } catch (error) {
      logger.error('Git pull failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git pull failed',
      };
    }
  }

  /**
   * Branch operations
   */
  async handleGitBranch(
    args: BranchArgs
  ): Promise<ToolResponse<{ currentBranch: string; action?: string; branch?: string }>> {
    try {
      const { name, checkout = false, delete: deleteBranch = false, remote } = args;

      if (deleteBranch) {
        const operation: Operation = {
          type: 'git-operation',
          target: `branch: ${name}`,
          description: `Delete branch "${name}"`,
          metadata: { name, delete: true, remote },
        };

        const context: OperationContext = {
          sandboxMode: 'workspace-write',
          workspaceRoot: this.workspaceRoot,
          userIntent: 'Delete Git branch',
          sessionId: this.generateSessionId(),
        };

        const approval = await this.approvalManager.requestApproval(operation, context);
        if (!approval.granted) {
          return {
            success: false,
            error: 'Branch deletion not approved',
            suggestion: approval.suggestions?.[0],
          };
        }

        const command = `git branch -d "${name}"`;
        await execAsync(command, { cwd: this.workspaceRoot });

        return {
          success: true,
          data: { currentBranch: name, action: 'deleted', branch: name },
        };
      }

      // Create and optionally checkout branch
      let command = `git branch "${name}"`;
      if (remote) command = `git branch "${name}" "${remote}/${name}"`;

      await execAsync(command, { cwd: this.workspaceRoot });

      if (checkout) {
        await execAsync(`git checkout "${name}"`, { cwd: this.workspaceRoot });
      }

      return {
        success: true,
        data: {
          currentBranch: name,
          action: checkout ? 'created_and_checked_out' : 'created',
          branch: name,
        },
      };
    } catch (error) {
      logger.error('Git branch operation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git branch operation failed',
      };
    }
  }

  /**
   * Checkout branch or commit
   */
  async handleGitCheckout(
    args: GitCheckoutRequest
  ): Promise<
    ToolResponse<{ target: string; createBranch: boolean; force: boolean; output: string }>
  > {
    try {
      const { target, createBranch = false, force = false } = args;

      // Check if there are uncommitted changes
      const status = await this.getGitStatus();
      if (!force && (status.modified.length > 0 || status.staged.length > 0)) {
        return {
          success: false,
          error: 'Uncommitted changes would be lost',
          suggestion: 'Commit or stash changes before checkout, or use force option',
        };
      }

      let command = 'git checkout';
      if (createBranch) command += ' -b';
      if (force) command += ' --force';
      command += ` "${target}"`;

      const { stdout } = await execAsync(command, { cwd: this.workspaceRoot });

      return {
        success: true,
        data: {
          target,
          createBranch,
          force,
          output: stdout,
        },
      };
    } catch (error) {
      logger.error('Git checkout failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git checkout failed',
      };
    }
  }

  /**
   * Reset repository state
   */
  async handleGitReset(
    args: GitResetRequest
  ): Promise<ToolResponse<{ mode: string; target: string; output: string }>> {
    try {
      const { mode = 'mixed', target = 'HEAD' } = args;

      const operation: Operation = {
        type: 'git-operation',
        target: `${target} (${mode} reset)`,
        description: `Reset repository to ${target} with ${mode} mode`,
        metadata: { mode, target },
      };

      const context: OperationContext = {
        sandboxMode: mode === 'hard' ? 'full-access' : 'workspace-write',
        workspaceRoot: this.workspaceRoot,
        userIntent: 'Reset repository state',
        sessionId: this.generateSessionId(),
      };

      const approval = await this.approvalManager.requestApproval(operation, context);
      if (!approval.granted) {
        return {
          success: false,
          error: 'Reset not approved',
          suggestion: approval.suggestions?.[0],
        };
      }

      const command = `git reset --${mode} "${target}"`;
      const { stdout } = await execAsync(command, { cwd: this.workspaceRoot });

      return {
        success: true,
        data: {
          mode,
          target,
          output: stdout,
        },
      };
    } catch (error) {
      logger.error('Git reset failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git reset failed',
      };
    }
  }

  /**
   * Handle Git merges
   */
  async handleGitMerge(
    args: MergeArgs
  ): Promise<
    ToolResponse<{ branch: string; strategy: string; noFastForward?: boolean; output?: string }>
  > {
    try {
      const { branch, strategy = 'merge', noFastForward = false } = args;

      const operation: Operation = {
        type: 'git-operation',
        target: `branch: ${branch}`,
        description: `Merge branch "${branch}" using ${strategy} strategy`,
        metadata: { branch, strategy, noFastForward },
      };

      const context: OperationContext = {
        sandboxMode: 'workspace-write',
        workspaceRoot: this.workspaceRoot,
        userIntent: 'Merge Git branch',
        sessionId: this.generateSessionId(),
      };

      const approval = await this.approvalManager.requestApproval(operation, context);
      if (!approval.granted) {
        return {
          success: false,
          error: 'Merge not approved',
          suggestion: approval.suggestions?.[0],
        };
      }

      let command = `git merge "${branch}"`;
      if (noFastForward) command += ' --no-ff';
      if (strategy === 'squash') command += ' --squash';

      const { stdout } = await execAsync(command, { cwd: this.workspaceRoot });

      return {
        success: true,
        data: {
          branch,
          strategy,
          noFastForward,
          output: stdout,
        },
      };
    } catch (error) {
      logger.error('Git merge failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git merge failed',
        suggestion: 'Check for merge conflicts and resolve them manually',
      };
    }
  }

  /**
   * Handle Git rebase
   */
  async handleGitRebase(
    args: GitRebaseRequest
  ): Promise<
    ToolResponse<{ action?: string; target?: string; interactive?: boolean; output?: string }>
  > {
    try {
      const { target, interactive = false, abort = false, continue: continueRebase = false } = args;

      if (abort) {
        await execAsync('git rebase --abort', { cwd: this.workspaceRoot });
        return {
          success: true,
          data: { action: 'aborted' },
        };
      }

      if (continueRebase) {
        await execAsync('git rebase --continue', { cwd: this.workspaceRoot });
        return {
          success: true,
          data: { action: 'continued' },
        };
      }

      const operation: Operation = {
        type: 'git-operation',
        target: `rebase onto ${target}`,
        description: `Rebase current branch onto "${target}"${interactive ? ' (interactive)' : ''}`,
        metadata: { target, interactive },
      };

      const context: OperationContext = {
        sandboxMode: 'workspace-write',
        workspaceRoot: this.workspaceRoot,
        userIntent: 'Rebase Git branch',
        sessionId: this.generateSessionId(),
      };

      const approval = await this.approvalManager.requestApproval(operation, context);
      if (!approval.granted) {
        return {
          success: false,
          error: 'Rebase not approved',
          suggestion: approval.suggestions?.[0],
        };
      }

      let command = `git rebase "${target}"`;
      if (interactive) command += ' -i';

      const { stdout } = await execAsync(command, { cwd: this.workspaceRoot });

      return {
        success: true,
        data: {
          target,
          interactive,
          output: stdout,
        },
      };
    } catch (error) {
      logger.error('Git rebase failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git rebase failed',
        suggestion: 'Check for conflicts and resolve them, then use git_rebase with continue=true',
      };
    }
  }

  /**
   * Handle Git tags
   */
  async handleGitTag(
    args: TagArgs
  ): Promise<ToolResponse<{ name: string; message?: string; action?: string; tag?: string }>> {
    try {
      const { name, message, delete: deleteTag = false, push = false } = args;

      if (deleteTag) {
        const operation: Operation = {
          type: 'git-operation',
          target: `tag: ${name}`,
          description: `Delete tag "${name}"`,
          metadata: { name, delete: true },
        };

        const context: OperationContext = {
          sandboxMode: 'workspace-write',
          workspaceRoot: this.workspaceRoot,
          userIntent: 'Delete Git tag',
          sessionId: this.generateSessionId(),
        };

        const approval = await this.approvalManager.requestApproval(operation, context);
        if (!approval.granted) {
          return {
            success: false,
            error: 'Tag deletion not approved',
            suggestion: approval.suggestions?.[0],
          };
        }

        await execAsync(`git tag -d "${name}"`, { cwd: this.workspaceRoot });

        return {
          success: true,
          data: { name, action: 'deleted', tag: name },
        };
      }

      // Create tag
      let command = `git tag "${name}"`;
      if (message) command += ` -m "${message}"`;

      await execAsync(command, { cwd: this.workspaceRoot });

      // Push tag if requested
      if (push) {
        await execAsync(`git push origin "${name}"`, { cwd: this.workspaceRoot });
      }

      return {
        success: true,
        data: {
          name,
          action: 'created',
          tag: name,
          message,
        },
      };
    } catch (error) {
      logger.error('Git tag operation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git tag operation failed',
      };
    }
  }

  /**
   * Handle Git remote operations
   */
  async handleGitRemote(args: GitRemoteRequest): Promise<
    ToolResponse<{
      remotes?: string[];
      remote?: string;
      info?: string;
      action?: string;
      url?: string;
    }>
  > {
    try {
      const { action, name, url } = args;

      switch (action) {
        case 'list': {
          const { stdout: listOutput } = await execAsync('git remote -v', {
            cwd: this.workspaceRoot,
          });
          return {
            success: true,
            data: { remotes: listOutput.trim().split('\n') },
          };
        }

        case 'show': {
          if (!name) {
            return { success: false, error: 'Remote name required for show action' };
          }
          const { stdout: showOutput } = await execAsync(`git remote show "${name}"`, {
            cwd: this.workspaceRoot,
          });
          return {
            success: true,
            data: { remote: name, info: showOutput },
          };
        }

        case 'add':
          if (!name || !url) {
            return { success: false, error: 'Remote name and URL required for add action' };
          }
          await execAsync(`git remote add "${name}" "${url}"`, { cwd: this.workspaceRoot });
          return {
            success: true,
            data: { action: 'added', remote: name, url },
          };

        case 'remove':
          if (!name) {
            return { success: false, error: 'Remote name required for remove action' };
          }
          await execAsync(`git remote remove "${name}"`, { cwd: this.workspaceRoot });
          return {
            success: true,
            data: { action: 'removed', remote: name },
          };

        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error) {
      logger.error('Git remote operation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git remote operation failed',
      };
    }
  }

  /**
   * Handle Git stash operations
   */
  async handleGitStash(args: GitStashRequest): Promise<
    ToolResponse<{
      action?: string;
      message?: string;
      output?: string;
      index?: number;
      stashes?: string[];
      diff?: string;
    }>
  > {
    try {
      const { action, message, index } = args;

      switch (action) {
        case 'save': {
          let saveCommand = 'git stash';
          if (message) saveCommand += ` -m "${message}"`;
          const { stdout: saveOutput } = await execAsync(saveCommand, { cwd: this.workspaceRoot });
          return {
            success: true,
            data: { action: 'saved', message, output: saveOutput },
          };
        }

        case 'pop': {
          let popCommand = 'git stash pop';
          if (index !== undefined) popCommand += ` stash@{${index}}`;
          const { stdout: popOutput } = await execAsync(popCommand, { cwd: this.workspaceRoot });
          return {
            success: true,
            data: { action: 'popped', index, output: popOutput },
          };
        }

        case 'list': {
          const { stdout: listOutput } = await execAsync('git stash list', {
            cwd: this.workspaceRoot,
          });
          return {
            success: true,
            data: {
              stashes: listOutput
                .trim()
                .split('\n')
                .filter(line => line),
            },
          };
        }

        case 'show': {
          let showCommand = 'git stash show';
          if (index !== undefined) showCommand += ` stash@{${index}}`;
          const { stdout: showOutput } = await execAsync(showCommand, { cwd: this.workspaceRoot });
          return {
            success: true,
            data: { index, diff: showOutput },
          };
        }

        case 'drop':
          if (index === undefined) {
            return { success: false, error: 'Stash index required for drop action' };
          }
          await execAsync(`git stash drop stash@{${index}}`, { cwd: this.workspaceRoot });
          return {
            success: true,
            data: { action: 'dropped', index },
          };

        default:
          return { success: false, error: `Unknown stash action: ${action}` };
      }
    } catch (error) {
      logger.error('Git stash operation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git stash operation failed',
      };
    }
  }

  /**
   * Handle Git clean operations
   */
  async handleGitClean(args: GitCleanRequest): Promise<
    ToolResponse<{
      dryRun: boolean;
      directories: boolean;
      ignored: boolean;
      force: boolean;
      output: string;
    }>
  > {
    try {
      const { dryRun = true, directories = false, ignored = false, force = false } = args;

      const operation: Operation = {
        type: 'git-operation',
        target: 'untracked files',
        description: `Clean untracked files${dryRun ? ' (dry run)' : ''}`,
        metadata: { dryRun, directories, ignored, force },
      };

      const context: OperationContext = {
        sandboxMode: force && !dryRun ? 'full-access' : 'workspace-write',
        workspaceRoot: this.workspaceRoot,
        userIntent: 'Clean untracked files',
        sessionId: this.generateSessionId(),
      };

      if (!dryRun) {
        const approval = await this.approvalManager.requestApproval(operation, context);
        if (!approval.granted) {
          return {
            success: false,
            error: 'Clean operation not approved',
            suggestion: approval.suggestions?.[0],
          };
        }
      }

      let command = 'git clean';
      if (dryRun) command += ' -n';
      else if (force) command += ' -f';
      if (directories) command += ' -d';
      if (ignored) command += ' -x';

      const { stdout } = await execAsync(command, { cwd: this.workspaceRoot });

      return {
        success: true,
        data: {
          dryRun,
          directories,
          ignored,
          force,
          output: stdout,
        },
      };
    } catch (error) {
      logger.error('Git clean failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Git clean failed',
      };
    }
  }

  /**
   * Check if current directory is a Git repository
   */
  private async isGitRepository(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: this.workspaceRoot });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get comprehensive Git status
   */
  private async getGitStatus(): Promise<GitStatus> {
    const { stdout: statusOutput } = await execAsync('git status --porcelain', {
      cwd: this.workspaceRoot,
    });
    const { stdout: branchOutput } = await execAsync('git branch --show-current', {
      cwd: this.workspaceRoot,
    });

    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];

    statusOutput.split('\n').forEach(line => {
      if (!line.trim()) return;

      const statusCode = line.substring(0, 2);
      const filename = line.substring(3);

      if (!statusCode.startsWith(' ') && !statusCode.startsWith('?')) {
        staged.push(filename);
      }
      if (statusCode[1] !== ' ') {
        modified.push(filename);
      }
      if (statusCode === '??') {
        untracked.push(filename);
      }
    });

    // Get ahead/behind info
    let ahead = 0;
    let behind = 0;
    try {
      const { stdout: aheadBehind } = await execAsync(
        'git rev-list --left-right --count HEAD...@{upstream}',
        { cwd: this.workspaceRoot }
      );
      const [aheadStr, behindStr] = aheadBehind.trim().split('\t');
      ahead = parseInt(aheadStr) || 0;
      behind = parseInt(behindStr) || 0;
    } catch {
      // No upstream branch
    }

    return {
      branch: branchOutput.trim(),
      staged,
      modified,
      untracked,
      ahead,
      behind,
      clean: staged.length === 0 && modified.length === 0 && untracked.length === 0,
    };
  }

  /**
   * Parse Git diff output
   */
  private parseDiffOutput(diffOutput: string): GitDiffResult[] {
    const diffs: GitDiffResult[] = [];
    const lines = diffOutput.split('\n');

    let currentFile = '';
    let currentPatch = '';
    let additions = 0;
    let deletions = 0;

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        // New file diff
        if (currentFile) {
          diffs.push({
            file: currentFile,
            additions,
            deletions,
            patch: currentPatch.trim(),
          });
        }

        currentFile = line.split(' ')[2].substring(2); // Remove 'a/' prefix
        currentPatch = `${line}\n`;
        additions = 0;
        deletions = 0;
      } else {
        currentPatch += `${line}\n`;

        if (line.startsWith('+') && !line.startsWith('+++')) {
          additions++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          deletions++;
        }
      }
    }

    // Add last file
    if (currentFile) {
      diffs.push({
        file: currentFile,
        additions,
        deletions,
        patch: currentPatch.trim(),
      });
    }

    return diffs;
  }

  /**
   * Parse Git log output
   */
  private parseLogOutput(logOutput: string): GitCommitInfo[] {
    const commits: GitCommitInfo[] = [];
    const lines = logOutput.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Parse oneline format: hash message
      const match = line.match(/^[*|\\\s]*([a-f0-9]+)\s+(.+)$/);
      if (match) {
        const [, hash, message] = match;
        commits.push({
          hash,
          author: 'unknown', // Would need different format to get author
          date: 'unknown', // Would need different format to get date
          message: message.trim(),
          files: [], // Would need different format to get files
        });
      }
    }

    return commits;
  }

  /**
   * Extract commit hash from git commit output
   */
  private extractCommitHash(commitOutput: string): string {
    const match = commitOutput.match(/\[.+\s([a-f0-9]+)\]/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Generate session ID for approval tracking
   */
  private generateSessionId(): string {
    return `git_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
