import { ApprovalManager } from '../domain/approval/approval-manager.js';
import { logger } from '../infrastructure/logging/logger.js';
import type { ToolHandler, ToolRequest, ToolResponse, GitStatus } from './git-types.js';
import { RepositoryManager } from './git-operations/repository-manager.js';
import { BranchManager } from './git-operations/branch-manager.js';
import { CommitManager } from './git-operations/commit-manager.js';
import { DiffAnalyzer } from './git-operations/diff-analyzer.js';
import { StatusTracker } from './git-operations/status-tracker.js';
import { RemoteManager } from './git-operations/remote-manager.js';
import { cacheStatus, getCachedStatus, cacheDiff, getCachedDiff } from './git-performance.js';

class BaseMCPServer {
  protected tools: Record<string, ToolHandler> = {};

  public constructor(
    public id: string,
    public description: string
  ) {}
}

export class GitMCPServer extends BaseMCPServer {
  private readonly repository = new RepositoryManager();
  private readonly branches = new BranchManager();
  private readonly commits = new CommitManager();
  private readonly diffs = new DiffAnalyzer();
  private readonly status = new StatusTracker();
  private readonly remotes = new RemoteManager();

  public constructor(private readonly approvals = new ApprovalManager()) {
    super('git', 'Git MCP Server');
    this.registerTools();
  }

  private registerTools(): void {
    this.tools['git_status'] = async () => {
      const cached = getCachedStatus(process.cwd());
      if (cached) return { success: true, data: cached };
      const current = await this.status.status();
      cacheStatus(process.cwd(), current);
      return { success: true, data: current };
    };

    this.tools['git_commit'] = async (args: { message: string; files?: string[] }) => {
      await this.commits.commit(args.message, args.files);
      return { success: true };
    };

    this.tools['git_log'] = async () => {
      const entries = await this.commits.log();
      return { success: true, data: entries };
    };

    this.tools['git_branch'] = async (args: { name: string; checkout?: boolean }) => {
      await this.branches.create(args.name, args.checkout);
      return { success: true };
    };

    this.tools['git_checkout'] = async (args: { target: string; create?: boolean }) => {
      await this.branches.checkout(args.target, args.create);
      return { success: true };
    };

    this.tools['git_merge'] = async (args: { branch: string; noFF?: boolean }) => {
      await this.branches.merge(args.branch, args.noFF);
      return { success: true };
    };

    this.tools['git_diff'] = async (args: { files?: string[] }) => {
      const key = `${process.cwd()}::${(args.files ?? []).join(',')}`;
      const cached = getCachedDiff(key);
      if (cached) return { success: true, data: cached };
      const diff = await this.diffs.diff(args.files);
      cacheDiff(key, diff);
      return { success: true, data: diff };
    };

    this.tools['git_remote'] = async (args: {
      action: string;
      name?: string;
      url?: string;
      branch?: string;
    }) => {
      switch (args.action) {
        case 'add':
          if (args.name && args.url) {
            await this.remotes.add(args.name, args.url);
          }
          break;
        case 'remove':
          if (args.name) {
            await this.remotes.remove(args.name);
          }
          break;
        case 'list':
          return { success: true, data: await this.remotes.list() };
        case 'push':
          await this.remotes.push(args.name, args.branch);
          break;
        case 'pull':
          await this.remotes.pull(args.name, args.branch);
          break;
        default:
          logger.warn(`Unknown remote action: ${args.action}`);
      }
      return { success: true };
    };
  }

  public async handleTool<TReq extends ToolRequest, TRes>(
    name: string,
    args: TReq
  ): Promise<ToolResponse<TRes>> {
    const handler = this.tools[name];
    if (!handler) {
      return { success: false, error: `Unknown tool: ${name}` };
    }
    try {
      return (await handler(args)) as ToolResponse<TRes>;
    } catch (error) {
      logger.error(error);
      return { success: false, error: 'Git operation failed' };
    }
  }
}
