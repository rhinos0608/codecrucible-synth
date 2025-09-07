import { execFile } from 'child_process';
import { promisify } from 'util';
import type { GitCommitInfo } from '../git-types.js';

const execFileAsync = promisify(execFile);

export class CommitManager {
  public constructor(private readonly repoPath: string = process.cwd()) {}

  public async commit(message: string, files: string[] = []): Promise<void> {
    if (files.length > 0) {
      await execFileAsync('git', ['add', ...files], { cwd: this.repoPath });
    } else {
      await execFileAsync('git', ['add', '-A'], { cwd: this.repoPath });
    }
    await execFileAsync('git', ['commit', '-m', message], {
      cwd: this.repoPath,
    });
  }

  public async log(limit = 10): Promise<GitCommitInfo[]> {
    const { stdout } = await execFileAsync(
      'git',
      ['log', '-n', String(limit), '--pretty=format:%H%x09%an%x09%ad%x09%s'],
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
