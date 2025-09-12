import { getRustExecutor } from '../../infrastructure/execution/rust/index.js';


export class RemoteManager {
  public constructor(private readonly repoPath: string = process.cwd()) {}

  public async add(name: string, url: string): Promise<void> {
    await this.runGit(['remote', 'add', name, url]);
  }

  public async remove(name: string): Promise<void> {
    await this.runGit(['remote', 'remove', name]);
  }

  public async list(): Promise<string[]> {
    const res = await this.runGit(['remote'], true);
    const stdout = res ?? '';
    return stdout.split('\n').filter(Boolean);
  }

  public async push(remote = 'origin', branch = 'HEAD'): Promise<void> {
    await this.runGit(['push', remote, branch]);
  }

  public async pull(remote = 'origin', branch = 'HEAD'): Promise<void> {
    await this.runGit(['pull', remote, branch]);
  }

  private async runGit(args: string[], returnStdout = false): Promise<string | void> {
    const rust = getRustExecutor();
    await rust.initialize();
    const res = await rust.execute({
      toolId: 'command',
      arguments: { command: 'git', args },
      context: {
        sessionId: 'git-remote',
        workingDirectory: this.repoPath,
        environment: process.env as Record<string, string>,
        securityLevel: 'low',
        permissions: [],
        timeoutMs: 60000,
      },
    } as any);
    if (!res.success) throw new Error('git command failed');
    if (returnStdout) {
      const data: any = res.result;
      return typeof data?.stdout === 'string' ? data.stdout : '';
    }
  }
}
