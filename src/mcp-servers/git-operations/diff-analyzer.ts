import { exec } from 'child_process';
import { promisify } from 'util';
import type { GitDiffResult } from '../git-types.js';

const execAsync = promisify(exec);

export class DiffAnalyzer {
  public constructor(private readonly repoPath: string = process.cwd()) {}

  public async diff(files: string[] = []): Promise<GitDiffResult[]> {
    const target = files.length > 0 ? files.join(' ') : '';
    const { stdout } = await execAsync(`git diff --numstat ${target}`, {
      cwd: this.repoPath,
    });
    return stdout
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [additions, deletions, file] = line.split('\t');
        return {
          file,
          additions: Number.parseInt(additions, 10) || 0,
          deletions: Number.parseInt(deletions, 10) || 0,
          patch: '',
        };
      });
  }
}
