import { exec } from 'child_process';
import { promisify } from 'util';
import type { GitStatus } from '../git-types.js';

const execAsync = promisify(exec);

export class StatusTracker {
  public constructor(private readonly repoPath: string = process.cwd()) {}

  public async status(): Promise<GitStatus> {
    const { stdout } = await execAsync('git status --porcelain=v1 -b', {
      cwd: this.repoPath,
    });
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
      } else if (/^[A-Z]/.test(line[0])) {
        staged.push(line.slice(3));
      } else {
        modified.push(line.slice(3));
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
