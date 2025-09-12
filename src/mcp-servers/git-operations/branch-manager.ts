import { getRustExecutor } from '../../infrastructure/execution/rust/index.js';
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


export class BranchManager {
  public constructor(private readonly repoPath: string = process.cwd()) {}

  public async create(name: string, checkout = false): Promise<void> {
    validateBranchName(name);
    const safeName = escapeShellArg(name);
    await this.runGit(['branch', safeName]);
    if (checkout) {
      await this.checkout(name);
    }
  }

  public async checkout(target: string, create = false): Promise<void> {
    validateBranchName(target);
    const safeTarget = escapeShellArg(target);
    const cmd = create ? `git checkout -b ${safeTarget}` : `git checkout ${safeTarget}`;
    if (create) await this.runGit(['checkout', '-b', safeTarget]);
    else await this.runGit(['checkout', safeTarget]);
  }

  public async merge(branch: string, noFastForward = false): Promise<void> {
    validateBranchName(branch);
    const safeBranch = escapeShellArg(branch);
    const flag = noFastForward ? '--no-ff ' : '';
    const args = ['merge'];
    if (noFastForward) args.push('--no-ff');
    args.push(safeBranch);
    await this.runGit(args);
  }

  private async runGit(args: string[]): Promise<void> {
    const rust = getRustExecutor();
    await rust.initialize();
    const res = await rust.execute({
      toolId: 'command',
      arguments: { command: 'git', args },
      context: {
        sessionId: 'git-branch',
        workingDirectory: this.repoPath,
        environment: process.env as Record<string, string>,
        securityLevel: 'low',
        permissions: [],
        timeoutMs: 20000,
      },
    } as any);
    if (!res.success) throw new Error('git command failed');
  }
}
