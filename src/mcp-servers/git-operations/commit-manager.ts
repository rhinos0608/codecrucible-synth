import { getRustExecutor } from '../../infrastructure/execution/rust/index.js';
import type { GitCommitInfo } from '../git-types.js';


export class CommitManager {
  public constructor(private readonly repoPath: string = process.cwd()) {}

  public async commit(message: string, files: string[] = []): Promise<void> {
    const rust = getRustExecutor();
    await rust.initialize();
    const run = async (args: string[], timeoutMs = 60000) =>
      rust.execute({
        toolId: 'command',
        arguments: { command: 'git', args },
        context: {
          sessionId: 'git-commit',
          workingDirectory: this.repoPath,
          environment: process.env as Record<string, string>,
          securityLevel: 'low',
          permissions: [],
          timeoutMs,
        },
      } as any);
    if (files.length > 0) await run(['add', ...files]);
    else await run(['add', '-A']);
    const res = await run(['commit', '-m', message]);
    if (!res.success) throw new Error('git commit failed');
  }

  public async log(limit = 10): Promise<GitCommitInfo[]> {
    const rust = getRustExecutor();
    await rust.initialize();
    const res = await rust.execute({
      toolId: 'command',
      arguments: {
        command: 'git',
        args: ['log', '-n', String(limit), '--pretty=format:%H%x09%an%x09%ad%x09%s'],
      },
      context: {
        sessionId: 'git-log',
        workingDirectory: this.repoPath,
        environment: process.env as Record<string, string>,
        securityLevel: 'low',
        permissions: [],
        timeoutMs: 30000,
      },
    } as any);
    const data: any = res.result;
    const stdout: string = typeof data?.stdout === 'string' ? data.stdout : '';
    return stdout
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [hash, author, date, message] = line.split('\t');
        return { hash, author, date, message, files: [] };
      });
  }
}
