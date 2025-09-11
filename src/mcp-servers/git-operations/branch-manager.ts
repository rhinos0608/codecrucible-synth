import { exec } from 'child_process';
import { promisify } from 'util';
// Simple branch name validation (alphanumeric, dashes, underscores, slashes, no spaces)
function validateBranchName(name: string): void {
  if (!/^[\w\-/]+$/.test(name)) {
    throw new Error(`Invalid branch name: ${name}`);
  }
}

// Escape a string for safe use as a shell argument (single-quoted)
function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

const execAsync = promisify(exec);

export class BranchManager {
  public constructor(private readonly repoPath: string = process.cwd()) {}

  public async create(name: string, checkout = false): Promise<void> {
    validateBranchName(name);
    const safeName = escapeShellArg(name);
    await execAsync(`git branch ${safeName}`, { cwd: this.repoPath });
    if (checkout) {
      await this.checkout(name);
    }
  }

  public async checkout(target: string, create = false): Promise<void> {
    validateBranchName(target);
    const safeTarget = escapeShellArg(target);
    const cmd = create ? `git checkout -b ${safeTarget}` : `git checkout ${safeTarget}`;
    await execAsync(cmd, { cwd: this.repoPath });
  }

  public async merge(branch: string, noFastForward = false): Promise<void> {
    validateBranchName(branch);
    const safeBranch = escapeShellArg(branch);
    const flag = noFastForward ? '--no-ff ' : '';
    await execAsync(`git merge ${flag}${safeBranch}`, { cwd: this.repoPath });
  }
}
