import { getRustExecutor } from '../../infrastructure/execution/rust/index.js';
import type { GitStatus } from '../git-types.js';


export class StatusTracker {
  public constructor(private readonly repoPath: string = process.cwd()) {}

  public async status(): Promise<GitStatus> {
    const rust = getRustExecutor();
    await rust.initialize();
    const res = await rust.execute({
      toolId: 'command',
      arguments: { command: 'git', args: ['status', '--porcelain=v1', '-b'] },
      context: {
        sessionId: 'git-status',
        workingDirectory: this.repoPath,
        environment: process.env as Record<string, string>,
        securityLevel: 'low',
        permissions: [],
        timeoutMs: 15000,
      },
    } as any);
    const data: any = res.result;
    const stdout: string = typeof data?.stdout === 'string' ? data.stdout : '';
    const lines = stdout.trim().split('\n');
    const branchLine = lines.shift() ?? '';
    const branchMatch = /## (?<branch>[^.]+)(\.\.\.(?<remote>\S+))?/.exec(branchLine);
    const branch = branchMatch?.groups?.branch ?? 'unknown';
    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];
    for (const line of lines) {
      if (line.startsWith('??')) {
        untracked.push(line.slice(3));
      } else {
        // line is at least 3 chars: XY filename
        const [indexStatus, workTreeStatus] = line;
        const filename = line.slice(3);
        if (indexStatus !== ' ' && indexStatus !== '?') {
          staged.push(filename);
        }
        if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
          modified.push(filename);
        }
      }
    }
    return {
      branch,
      staged,
      modified,
      untracked,
      ahead: 0,
      behind: 0,
      clean: staged.length === 0 && modified.length === 0 && untracked.length === 0,
    };
  }
}
