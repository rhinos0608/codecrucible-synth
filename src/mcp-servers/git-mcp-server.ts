import { ApprovalManager } from '../domain/approval/approval-manager.js';
import { logger } from '../infrastructure/logging/logger.js';
import type { ToolHandler, ToolRequest, ToolResponse } from './git-types.js';
import { RepositoryManager } from './git-operations/repository-manager.js';
import { BranchManager } from './git-operations/branch-manager.js';
import { CommitManager } from './git-operations/commit-manager.js';
import { DiffAnalyzer } from './git-operations/diff-analyzer.js';
import { StatusTracker } from './git-operations/status-tracker.js';
import { RemoteManager } from './git-operations/remote-manager.js';
import { cacheDiff, cacheStatus, getCachedDiff, getCachedStatus } from './git-performance.js';

class BaseMCPServer {
  protected tools: Record<string, ToolHandler | undefined> = {};

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

  public constructor(private readonly approvals: Readonly<ApprovalManager> = new ApprovalManager()) {
    super('git', 'Git MCP Server');
    this.registerTools();
  }

  private registerTools(): void {
    this.tools['git-status'] = async (_args: Readonly<ToolRequest>): Promise<ToolResponse> => {
      const cached = getCachedStatus(process.cwd());
      if (cached) return { success: true, data: cached };
      const current = await this.status.status();
      cacheStatus(process.cwd(), current);
      return { success: true, data: current };
    };

    this.tools['git-commit'] = async (args: Readonly<ToolRequest>): Promise<ToolResponse> => {
      const { message, files } = args as { message: string; files?: readonly string[] };
      // Convert readonly string[] to string[] if present
      await this.commits.commit(message, files ? Array.from(files) : undefined);
      return { success: true };
    };
    this.tools['git-log'] = async (_args: Readonly<ToolRequest>): Promise<ToolResponse> => {
      const entries = await this.commits.log();
      return { success: true, data: entries };
    };
    this.tools['git-branch'] = async (args: Readonly<ToolRequest>): Promise<ToolResponse> => {
      const { name, checkout } = args as { name: string; checkout?: boolean };
      await this.branches.create(name, checkout);
      return { success: true };
    };
    this.tools['git-checkout'] = async (args: Readonly<ToolRequest>): Promise<ToolResponse> => {
      const { target, create } = args as { target: string; create?: boolean };
      await this.branches.checkout(target, create);
      return { success: true };
    };
    this.tools['git-merge'] = async (args: Readonly<ToolRequest>): Promise<ToolResponse> => {
      const { branch, noFF } = args as { branch: string; noFF?: boolean };
      await this.branches.merge(branch, noFF);
      return { success: true };
    };
    this.tools['git-diff'] = async (args: Readonly<ToolRequest>): Promise<ToolResponse> => {
      const { files } = args as { files?: readonly string[] };
      const key = `${process.cwd()}::${(files ?? []).join(',')}`;
      const cached = getCachedDiff(key);
      if (cached) return { success: true, data: cached };
      const diff = await this.diffs.diff(files ? Array.from(files) : undefined);
      cacheDiff(key, diff);
      return { success: true, data: diff };
    };
    this.tools['git-remote'] = async (args: Readonly<ToolRequest>): Promise<ToolResponse> => {
      const { action, name, url } = args as { action: string; name?: string; url?: string };
      switch (action) {
        case 'add':
          if (name && url) {
            await this.remotes.add(name, url);
          }
          break;
        case 'remove':
          if (name) {
            await this.remotes.remove(name);
          }
          break;
        case 'list':
          return { success: true, data: await this.remotes.list() };
        case 'push':
          await this.remotes.push(name, url);
          break;
        case 'pull':
          await this.remotes.pull(name, url);
          break;
        default:
          logger.warn(`Unknown remote action: ${action}`);
      }
      return { success: true };
    };
  }

  public async handleTool<TReq extends ToolRequest, TRes>(
    toolName: string,
    args: TReq
  ): Promise<ToolResponse<TRes>> {
    const handler = this.tools[toolName];
    if (!handler) {
      logger.error(`Unknown tool: ${toolName}`);
      return { success: false, error: `Unknown tool: ${toolName}` };
    }
    try {
      return (await handler(args)) as ToolResponse<TRes>;
    } catch (error) {
      logger.error('Git operation failed:', error);
      return { success: false, error: 'Git operation failed' };
    }
  }
}
