import { exec } from 'child_process';
import { promisify } from 'util';
import type { GitCommitInfo } from '../git-types.js';

const execAsync = promisify(exec);

export class CommitManager {
  public constructor(private readonly repoPath: string = process.cwd()) {}

  public async commit(message: string, files: string[] = []): Promise<void> {
    if (files.length > 0) {
      await execAsync(`git add ${files.join(' ')}`, { cwd: this.repoPath });
    } else {
      await execAsync('git add -A', { cwd: this.repoPath });
    }
    await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      cwd: this.repoPath,
    });
  }

  public async log(limit = 10): Promise<GitCommitInfo[]> {
    const { stdout } = await execAsync(
      `git log -n ${limit} --pretty=format:%H%x09%an%x09%ad%x09%s`,
      { cwd: this.repoPath }
    );
    return stdout
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [hash, author, date, message] = line.split('\t');
        return { hash, author, date, message, files: [] };
      });
  }
}
