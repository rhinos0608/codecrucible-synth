import { getRustExecutor } from '../../infrastructure/execution/rust/index.js';
import type { GitDiffResult } from '../git-types.js';


export class DiffAnalyzer {
  public constructor(private readonly repoPath: string = process.cwd()) {}

  public async diff(files: string[] = []): Promise<GitDiffResult[]> {
    const target = files.length > 0 ? files.join(' ') : '';
    const rust = getRustExecutor();
    await rust.initialize();
    const args = ['diff', '--numstat'];
    if (target) args.push(target);
    const res = await rust.execute({
      toolId: 'command',
      arguments: { command: 'git', args },
      context: {
        sessionId: 'git-diff',
        workingDirectory: this.repoPath,
        environment: process.env as Record<string, string>,
        securityLevel: 'low',
        permissions: [],
        timeoutMs: 20000,
      },
    } as any);
    const data: any = res.result;
    const stdout: string = typeof data?.stdout === 'string' ? data.stdout : '';
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
