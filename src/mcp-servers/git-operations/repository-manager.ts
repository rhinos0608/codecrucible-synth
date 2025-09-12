import { getRustExecutor } from '../../infrastructure/execution/rust/index.js';


export class RepositoryManager {
  public constructor(private readonly repoPath: string = process.cwd()) {}

  public async init(): Promise<void> {
    const rust = getRustExecutor();
    await rust.initialize();
    const res = await rust.execute({
      toolId: 'command',
      arguments: { command: 'git', args: ['init'] },
      context: {
        sessionId: 'git-init',
        workingDirectory: this.repoPath,
        environment: process.env as Record<string, string>,
        securityLevel: 'low',
        permissions: [],
        timeoutMs: 15000,
      },
    } as any);
    if (!res.success) throw new Error('git init failed');
  }
}
