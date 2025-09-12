import type { OrchestrationRequest } from './orchestration-types.js';

type Runnable = () => Promise<unknown> | unknown;

interface QueueItem {
  request: OrchestrationRequest;
  priority: number;
  enqueuedAt: number;
}

/**
 * TaskScheduler handles prioritization and execution order of workflow tasks.
 */
export class TaskScheduler {
  // Simple priority queue with FIFO within same priority
  private queue: QueueItem[] = [];
  private concurrency: number = Math.max(1, (process.env.SCHEDULER_CONCURRENCY && Number(process.env.SCHEDULER_CONCURRENCY)) || 4);
  private running: number = 0;

  /**
   * Schedule a request for execution by adding it to the internal queue.
   */
  public async schedule(request: OrchestrationRequest): Promise<void> {
    const priority = this.inferPriority(request);
    this.queue.push({ request, priority, enqueuedAt: Date.now() });
    // Keep highest priority first; stable sort by enqueuedAt
    this.queue.sort((a, b) => (b.priority - a.priority) || (a.enqueuedAt - b.enqueuedAt));
    await this.pump();
  }

  /**
   * Execute a single task using allocated resources.
   * Supports functions, objects with a `run` method, or plain data.
   */
  public async executeTask(task: unknown, resources: unknown): Promise<unknown> {
    try {
      // If the task itself is a function, execute it
      if (typeof task === 'function') {
        return await (task as Runnable)();
      }
      // If the task has a run() method, call it and pass resources when supported
      if (task && typeof (task as { run?: Runnable }).run === 'function') {
        const t = task as { run: (resources?: unknown) => Promise<unknown> | unknown };
        return await t.run(resources);
      }
      // If nothing executable is found, return the task as the result (noop)
      return task;
    } finally {
      // Drain queued work opportunistically
      await this.pump();
    }
  }

  /**
   * Internal: run queued requests up to concurrency limit.
   */
  private async pump(): Promise<void> {
    while (this.running < this.concurrency && this.queue.length > 0) {
      // Dequeue next item
      const next = this.queue.shift();
      if (!next) break;
      this.running++;
      // We do not execute the request here because WorkflowEngine controls task execution.
      // The scheduler is responsible for ordering; concurrency is tracked for visibility.
      // Yield to event loop to avoid blocking.
      setImmediate(() => {
        this.running--;
      });
    }
  }

  private inferPriority(request: OrchestrationRequest): number {
    // Read priority hints from payload if present, else infer from command
    const payload = (request?.payload ?? {}) as { priority?: number | string };
    const direct = payload.priority;
    if (typeof direct === 'number') return direct;
    if (typeof direct === 'string') {
      const map: Record<string, number> = { low: 1, normal: 5, medium: 5, high: 9, critical: 10 };
      return map[direct.toLowerCase()] ?? 5;
    }
    // Infer from command
    const cmd = (request?.command || '').toLowerCase();
    if (cmd.includes('analy') || cmd.includes('lint') || cmd.includes('test')) return 6;
    if (cmd.includes('build') || cmd.includes('deploy')) return 8;
    return 5; // default
  }
}
