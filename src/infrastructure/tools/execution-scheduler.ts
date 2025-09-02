export class ExecutionScheduler {
  constructor(private concurrency: number = 1) {}

  async schedule<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let nextIndex = 0;

    const runTask = async (): Promise<void> => {
      const current = nextIndex++;
      if (current >= tasks.length) {
        return;
      }
      try {
        results[current] = await tasks[current]();
      } finally {
        await runTask();
      }
    };

    const workers = Array(Math.min(this.concurrency, tasks.length))
      .fill(0)
      .map(() => runTask());

    await Promise.all(workers);
    return results;
  }
}
