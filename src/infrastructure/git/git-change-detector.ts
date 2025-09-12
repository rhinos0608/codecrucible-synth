import { exec as _exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ProjectPaths } from '../../utils/project-paths.js';

const exec = promisify(_exec);

export interface GitChangeSummary {
  baseRef: string | null;
  head: string | null;
  added: string[];
  modified: string[];
  deleted: string[];
}

export class GitChangeDetector {
  private indexDir = ProjectPaths.resolveFromRoot('.crucible/index');
  private lastCommitFile = join(this.indexDir, 'last_indexed_commit');

  public async getHead(): Promise<string | null> {
    try {
      const { stdout } = await exec('git rev-parse HEAD');
      return stdout.trim();
    } catch {
      return null;
    }
  }

  public async getChangedSince(ref: string | null): Promise<GitChangeSummary> {
    const head = await this.getHead();
    if (!ref || !head) {
      return { baseRef: ref, head, added: [], modified: [], deleted: [] };
    }
    try {
      const { stdout } = await exec(`git diff --name-status ${ref} ${head}`);
      const lines = stdout.split(/\r?\n/).filter(Boolean);
      const added: string[] = [];
      const modified: string[] = [];
      const deleted: string[] = [];
      for (const line of lines) {
        const [status, path] = line.split(/\s+/, 2);
        if (!status || !path) continue;
        if (status.startsWith('A')) added.push(path);
        else if (status.startsWith('M') || status.startsWith('R')) modified.push(path);
        else if (status.startsWith('D')) deleted.push(path);
      }
      return { baseRef: ref, head, added, modified, deleted };
    } catch {
      return { baseRef: ref, head, added: [], modified: [], deleted: [] };
    }
  }

  public async readLastIndexedCommit(): Promise<string | null> {
    try {
      const data = await fs.readFile(this.lastCommitFile, 'utf-8');
      return data.trim();
    } catch {
      return null;
    }
  }

  public async writeLastIndexedCommit(commit: string | null): Promise<void> {
    if (!commit) return;
    await fs.mkdir(this.indexDir, { recursive: true });
    await fs.writeFile(this.lastCommitFile, commit, 'utf-8');
  }
}

export default GitChangeDetector;

