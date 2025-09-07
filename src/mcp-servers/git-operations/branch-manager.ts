import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class BranchManager {
  public constructor(private readonly repoPath: string = process.cwd()) {}

  public async create(name: string, checkout = false): Promise<void> {
    await execAsync(`git branch ${name}`, { cwd: this.repoPath });
    if (checkout) {
      await this.checkout(name);
    }
  }

  public async checkout(target: string, create = false): Promise<void> {
    const cmd = create ? `git checkout -b ${target}` : `git checkout ${target}`;
    await execAsync(cmd, { cwd: this.repoPath });
  }

  public async merge(branch: string, noFastForward = false): Promise<void> {
    const flag = noFastForward ? '--no-ff ' : '';
    await execAsync(`git merge ${flag}${branch}`, { cwd: this.repoPath });
  }
}
