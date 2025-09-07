import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class RemoteManager {
  public constructor(private readonly repoPath: string = process.cwd()) {}

  public async add(name: string, url: string): Promise<void> {
    await execAsync(`git remote add ${name} ${url}`, { cwd: this.repoPath });
  }

  public async remove(name: string): Promise<void> {
    await execAsync(`git remote remove ${name}`, { cwd: this.repoPath });
  }

  public async list(): Promise<string[]> {
    const { stdout } = await execAsync('git remote', { cwd: this.repoPath });
    return stdout.split('\n').filter(Boolean);
  }

  public async push(remote = 'origin', branch = 'HEAD'): Promise<void> {
    await execAsync(`git push ${remote} ${branch}`, { cwd: this.repoPath });
  }

  public async pull(remote = 'origin', branch = 'HEAD'): Promise<void> {
    await execAsync(`git pull ${remote} ${branch}`, { cwd: this.repoPath });
  }
}
