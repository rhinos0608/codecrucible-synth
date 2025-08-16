import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

/**
 * Comprehensive Git Operations Tool
 */
export class GitOperationsTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      operation: z.enum([
        'status', 'diff', 'log', 'add', 'commit', 'push', 'pull', 'fetch',
        'branch', 'checkout', 'merge', 'rebase', 'stash', 'remote', 'tag',
        'reset', 'revert', 'cherry-pick', 'clone', 'init'
      ]),
      
      // File/path parameters
      files: z.array(z.string()).optional().describe('Files to add/modify'),
      path: z.string().optional().describe('Specific path for operations'),
      
      // Commit parameters
      message: z.string().optional().describe('Commit message'),
      amend: z.boolean().optional().default(false).describe('Amend last commit'),
      
      // Branch parameters
      branchName: z.string().optional().describe('Branch name'),
      remoteBranch: z.string().optional().describe('Remote branch name'),
      createBranch: z.boolean().optional().default(false).describe('Create new branch'),
      
      // Remote parameters
      remote: z.string().optional().default('origin').describe('Remote name'),
      url: z.string().optional().describe('Remote URL'),
      
      // Log parameters
      limit: z.number().optional().default(10).describe('Number of commits to show'),
      oneline: z.boolean().optional().default(false).describe('Show one line per commit'),
      
      // Diff parameters
      staged: z.boolean().optional().default(false).describe('Show staged changes'),
      cached: z.boolean().optional().default(false).describe('Show cached changes'),
      
      // Reset parameters
      mode: z.enum(['soft', 'mixed', 'hard']).optional().default('mixed').describe('Reset mode'),
      commit: z.string().optional().describe('Commit hash'),
      
      // Stash parameters
      stashName: z.string().optional().describe('Stash name/message'),
      pop: z.boolean().optional().default(false).describe('Pop stash after applying'),
      
      // Additional flags
      force: z.boolean().optional().default(false).describe('Force operation'),
      all: z.boolean().optional().default(false).describe('All files/branches'),
      verbose: z.boolean().optional().default(false).describe('Verbose output'),
    });

    super({
      name: 'gitOperations',
      description: 'Comprehensive Git operations: status, commit, branch, merge, and all Git functionality',
      category: 'Version Control',
      parameters,
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<any> {
    try {
      // Check if we're in a Git repository
      if (!await this.isGitRepository()) {
        if (args.operation !== 'init' && args.operation !== 'clone') {
          return { error: 'Not in a Git repository. Use "init" to initialize or "clone" to clone a repository.' };
        }
      }

      const command = this.buildGitCommand(args);
      if (!command) {
        return { error: `Unable to build Git command for operation: ${args.operation}` };
      }

      const result = await execAsync(command, {
        cwd: this.agentContext.workingDirectory,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large diffs
      });

      return {
        success: true,
        operation: args.operation,
        command,
        output: result.stdout,
        stderr: result.stderr,
        workingDirectory: this.agentContext.workingDirectory
      };

    } catch (error: any) {
      return {
        success: false,
        operation: args.operation,
        error: error.message,
        output: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code
      };
    }
  }

  private async isGitRepository(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir', {
        cwd: this.agentContext.workingDirectory
      });
      return true;
    } catch {
      return false;
    }
  }

  private buildGitCommand(args: any): string | null {
    let cmd = 'git';

    switch (args.operation) {
      case 'status':
        cmd += ' status';
        if (args.verbose) cmd += ' --verbose';
        break;

      case 'diff':
        cmd += ' diff';
        if (args.staged || args.cached) cmd += ' --staged';
        if (args.files) cmd += ` ${args.files.join(' ')}`;
        break;

      case 'log':
        cmd += ' log';
        if (args.oneline) cmd += ' --oneline';
        if (args.limit) cmd += ` -${args.limit}`;
        if (args.path) cmd += ` -- ${args.path}`;
        break;

      case 'add':
        cmd += ' add';
        if (args.all) {
          cmd += ' .';
        } else if (args.files) {
          cmd += ` ${args.files.join(' ')}`;
        } else {
          cmd += ' .';
        }
        break;

      case 'commit':
        cmd += ' commit';
        if (args.message) cmd += ` -m "${args.message}"`;
        if (args.amend) cmd += ' --amend';
        if (args.all) cmd += ' -a';
        break;

      case 'push':
        cmd += ' push';
        if (args.remote) cmd += ` ${args.remote}`;
        if (args.branchName) cmd += ` ${args.branchName}`;
        if (args.force) cmd += ' --force';
        break;

      case 'pull':
        cmd += ' pull';
        if (args.remote) cmd += ` ${args.remote}`;
        if (args.branchName) cmd += ` ${args.branchName}`;
        break;

      case 'fetch':
        cmd += ' fetch';
        if (args.remote) cmd += ` ${args.remote}`;
        if (args.all) cmd += ' --all';
        break;

      case 'branch':
        cmd += ' branch';
        if (args.branchName) {
          if (args.createBranch) {
            cmd += ` ${args.branchName}`;
          } else {
            cmd += ` ${args.branchName}`;
          }
        }
        if (args.all) cmd += ' -a';
        if (args.verbose) cmd += ' -v';
        break;

      case 'checkout':
        cmd += ' checkout';
        if (args.createBranch) cmd += ' -b';
        if (args.branchName) cmd += ` ${args.branchName}`;
        if (args.files) cmd += ` ${args.files.join(' ')}`;
        break;

      case 'merge':
        cmd += ' merge';
        if (args.branchName) cmd += ` ${args.branchName}`;
        break;

      case 'rebase':
        cmd += ' rebase';
        if (args.branchName) cmd += ` ${args.branchName}`;
        break;

      case 'stash':
        cmd += ' stash';
        if (args.stashName) {
          cmd += ` push -m "${args.stashName}"`;
        } else if (args.pop) {
          cmd += ' pop';
        }
        break;

      case 'remote':
        cmd += ' remote';
        if (args.url) {
          cmd += ` add ${args.remote} ${args.url}`;
        } else {
          cmd += ' -v';
        }
        break;

      case 'tag':
        cmd += ' tag';
        if (args.branchName) cmd += ` ${args.branchName}`;
        if (args.message) cmd += ` -m "${args.message}"`;
        break;

      case 'reset':
        cmd += ' reset';
        if (args.mode) cmd += ` --${args.mode}`;
        if (args.commit) cmd += ` ${args.commit}`;
        if (args.files) cmd += ` ${args.files.join(' ')}`;
        break;

      case 'revert':
        cmd += ' revert';
        if (args.commit) cmd += ` ${args.commit}`;
        break;

      case 'cherry-pick':
        cmd += ' cherry-pick';
        if (args.commit) cmd += ` ${args.commit}`;
        break;

      case 'clone':
        cmd += ' clone';
        if (args.url) cmd += ` ${args.url}`;
        if (args.path) cmd += ` ${args.path}`;
        break;

      case 'init':
        cmd += ' init';
        if (args.path) cmd += ` ${args.path}`;
        break;

      default:
        return null;
    }

    return cmd;
  }
}

/**
 * Git Repository Analysis Tool
 */
export class GitAnalysisTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      analysis: z.enum([
        'summary', 'branches', 'contributors', 'fileHistory', 'commitStats', 
        'conflicts', 'remotes', 'tags', 'blame', 'bisect'
      ]),
      file: z.string().optional().describe('File path for file-specific analysis'),
      author: z.string().optional().describe('Author name for filtering'),
      since: z.string().optional().describe('Date since (e.g., "2 weeks ago")'),
      until: z.string().optional().describe('Date until'),
      branch: z.string().optional().describe('Branch to analyze'),
    });

    super({
      name: 'gitAnalysis',
      description: 'Analyze Git repository: contributors, history, statistics, conflicts',
      category: 'Version Control',
      parameters,
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<any> {
    try {
      switch (args.analysis) {
        case 'summary':
          return await this.getRepositorySummary();
        
        case 'branches':
          return await this.getBranchAnalysis();
        
        case 'contributors':
          return await this.getContributorAnalysis(args.since, args.until);
        
        case 'fileHistory':
          return await this.getFileHistory(args.file!);
        
        case 'commitStats':
          return await this.getCommitStatistics(args.author, args.since, args.until);
        
        case 'conflicts':
          return await this.getConflictAnalysis();
        
        case 'remotes':
          return await this.getRemoteAnalysis();
        
        case 'tags':
          return await this.getTagAnalysis();
        
        case 'blame':
          return await this.getBlameAnalysis(args.file!);
        
        default:
          return { error: `Unknown analysis type: ${args.analysis}` };
      }

    } catch (error) {
      return { 
        error: `Git analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private async getRepositorySummary(): Promise<any> {
    try {
      const [
        totalCommits,
        branches,
        contributors,
        recentActivity,
        remotes
      ] = await Promise.all([
        execAsync('git rev-list --count HEAD', { cwd: this.agentContext.workingDirectory }),
        execAsync('git branch -a', { cwd: this.agentContext.workingDirectory }),
        execAsync('git shortlog -sn', { cwd: this.agentContext.workingDirectory }),
        execAsync('git log --oneline -10', { cwd: this.agentContext.workingDirectory }),
        execAsync('git remote -v', { cwd: this.agentContext.workingDirectory }).catch(() => ({ stdout: '' }))
      ]);

      return {
        summary: {
          totalCommits: parseInt(totalCommits.stdout.trim()),
          branches: branches.stdout.split('\n').filter(b => b.trim()).length,
          contributors: contributors.stdout.split('\n').filter(c => c.trim()).length,
          hasRemotes: remotes.stdout.trim().length > 0
        },
        details: {
          recentCommits: recentActivity.stdout.trim().split('\n').slice(0, 5),
          topContributors: contributors.stdout.split('\n').slice(0, 5),
          branches: branches.stdout.split('\n').map(b => b.trim()).filter(b => b),
          remotes: remotes.stdout.split('\n').map(r => r.trim()).filter(r => r)
        }
      };

    } catch (error) {
      return { error: `Failed to get repository summary: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private async getBranchAnalysis(): Promise<any> {
    try {
      const [localBranches, remoteBranches, currentBranch] = await Promise.all([
        execAsync('git branch', { cwd: this.agentContext.workingDirectory }),
        execAsync('git branch -r', { cwd: this.agentContext.workingDirectory }).catch(() => ({ stdout: '' })),
        execAsync('git branch --show-current', { cwd: this.agentContext.workingDirectory })
      ]);

      return {
        current: currentBranch.stdout.trim(),
        local: localBranches.stdout.split('\n').map(b => b.replace('*', '').trim()).filter(b => b),
        remote: remoteBranches.stdout.split('\n').map(b => b.trim()).filter(b => b),
        analysis: {
          totalLocal: localBranches.stdout.split('\n').filter(b => b.trim()).length,
          totalRemote: remoteBranches.stdout.split('\n').filter(b => b.trim()).length
        }
      };

    } catch (error) {
      return { error: `Failed to analyze branches: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private async getContributorAnalysis(since?: string, until?: string): Promise<any> {
    try {
      let cmd = 'git shortlog -sne';
      if (since) cmd += ` --since="${since}"`;
      if (until) cmd += ` --until="${until}"`;

      const result = await execAsync(cmd, { cwd: this.agentContext.workingDirectory });
      
      const contributors = result.stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const match = line.match(/^\s*(\d+)\s+(.+)/);
          return match ? {
            commits: parseInt(match[1]),
            author: match[2]
          } : null;
        })
        .filter(Boolean);

      return {
        contributors,
        summary: {
          total: contributors.length,
          totalCommits: contributors.reduce((sum, c) => sum + (c?.commits || 0), 0),
          period: { since, until }
        }
      };

    } catch (error) {
      return { error: `Failed to analyze contributors: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private async getFileHistory(file: string): Promise<any> {
    try {
      const [history, stats] = await Promise.all([
        execAsync(`git log --oneline --follow -- "${file}"`, { cwd: this.agentContext.workingDirectory }),
        execAsync(`git log --numstat --follow -- "${file}"`, { cwd: this.agentContext.workingDirectory })
      ]);

      return {
        file,
        commits: history.stdout.split('\n').filter(line => line.trim()),
        statistics: stats.stdout,
        totalCommits: history.stdout.split('\n').filter(line => line.trim()).length
      };

    } catch (error) {
      return { error: `Failed to get file history: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private async getCommitStatistics(author?: string, since?: string, until?: string): Promise<any> {
    try {
      let cmd = 'git log --pretty=format:"%h|%an|%ad|%s" --date=short';
      if (author) cmd += ` --author="${author}"`;
      if (since) cmd += ` --since="${since}"`;
      if (until) cmd += ` --until="${until}"`;

      const result = await execAsync(cmd, { cwd: this.agentContext.workingDirectory });
      
      const commits = result.stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [hash, author, date, message] = line.split('|');
          return { hash, author, date, message };
        });

      // Analyze patterns
      const byAuthor = commits.reduce((acc, commit) => {
        acc[commit.author] = (acc[commit.author] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const byDate = commits.reduce((acc, commit) => {
        acc[commit.date] = (acc[commit.date] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        commits,
        statistics: {
          total: commits.length,
          byAuthor,
          byDate,
          period: { since, until }
        }
      };

    } catch (error) {
      return { error: `Failed to get commit statistics: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private async getConflictAnalysis(): Promise<any> {
    try {
      // Check for merge conflicts
      const status = await execAsync('git status --porcelain', { cwd: this.agentContext.workingDirectory });
      
      const conflicts = status.stdout.split('\n')
        .filter(line => line.startsWith('UU') || line.startsWith('AA') || line.startsWith('DD'))
        .map(line => line.substring(3));

      // Get unmerged paths
      const unmerged = await execAsync('git diff --name-only --diff-filter=U', { 
        cwd: this.agentContext.workingDirectory 
      }).catch(() => ({ stdout: '' }));

      return {
        hasConflicts: conflicts.length > 0,
        conflicts,
        unmergedFiles: unmerged.stdout.split('\n').filter(f => f.trim()),
        totalConflicts: conflicts.length
      };

    } catch (error) {
      return { error: `Failed to analyze conflicts: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private async getRemoteAnalysis(): Promise<any> {
    try {
      const [remotes, branches] = await Promise.all([
        execAsync('git remote -v', { cwd: this.agentContext.workingDirectory }),
        execAsync('git branch -vv', { cwd: this.agentContext.workingDirectory })
      ]);

      const remoteInfo = remotes.stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [name, url, type] = line.split(/\s+/);
          return { name, url, type: type?.replace(/[()]/g, '') };
        });

      return {
        remotes: remoteInfo,
        tracking: branches.stdout,
        hasUpstream: branches.stdout.includes('['),
        totalRemotes: new Set(remoteInfo.map(r => r.name)).size
      };

    } catch (error) {
      return { error: `Failed to analyze remotes: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private async getTagAnalysis(): Promise<any> {
    try {
      const [tags, annotated] = await Promise.all([
        execAsync('git tag -l', { cwd: this.agentContext.workingDirectory }),
        execAsync('git tag -l -n', { cwd: this.agentContext.workingDirectory })
      ]);

      const tagList = tags.stdout.split('\n').filter(t => t.trim());
      
      return {
        tags: tagList,
        annotatedTags: annotated.stdout.split('\n').filter(t => t.trim()),
        totalTags: tagList.length,
        hasReleases: tagList.some(tag => /v?\d+\.\d+\.\d+/.test(tag))
      };

    } catch (error) {
      return { error: `Failed to analyze tags: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private async getBlameAnalysis(file: string): Promise<any> {
    try {
      const blame = await execAsync(`git blame --line-porcelain "${file}"`, { 
        cwd: this.agentContext.workingDirectory 
      });

      // Parse blame output
      const lines = blame.stdout.split('\n');
      const annotations: any[] = [];
      
      for (let i = 0; i < lines.length; i += 10) { // Rough parsing
        const line = lines[i];
        if (line && !line.startsWith('\t')) {
          const [hash, lineNum] = line.split(' ');
          annotations.push({ hash, lineNum: parseInt(lineNum) });
        }
      }

      return {
        file,
        annotations,
        totalLines: annotations.length
      };

    } catch (error) {
      return { error: `Failed to get blame analysis: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }
}

// Re-export existing tools for compatibility
export { GitStatusTool, GitDiffTool } from './git-tools.js';