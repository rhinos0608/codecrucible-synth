import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class RepositoryManager {
  public constructor(private readonly repoPath: string = process.cwd()) {}

  public async init(): Promise<void> {
    await execAsync('git init', { cwd: this.repoPath });
  }
}
