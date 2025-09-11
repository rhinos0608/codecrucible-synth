export class ExecutionScheduler {
  public constructor(private readonly concurrency: number = 1) {}

  public async schedule<T>(tasks: ReadonlyArray<() => Promise<T>>): Promise<T[]> {
    const results: T[] = Array.from({ length: tasks.length });
    let nextIndex = 0;

    const runTask = async (): Promise<void> => {
      for (;;) {
        const current = nextIndex++;
        if (current >= tasks.length) {
          return;
        }
        results[current] = await tasks[current]();
      }
    };

    const workers = Array.from({ length: Math.min(this.concurrency, tasks.length) }, async () =>
      runTask()
    );

    await Promise.all(workers);
    return results;
  }
}
