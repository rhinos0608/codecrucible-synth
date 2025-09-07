import type { OrchestrationRequest } from './orchestration-types.js';

/**
 * TaskScheduler handles prioritization and execution order of workflow tasks.
 */
export class TaskScheduler {
  /**
   * Internal queue to store scheduled orchestration requests.
   */
  private queue: OrchestrationRequest[] = [];

  /**
   * Schedule a request for execution by adding it to the internal queue.
   */
  public async schedule(request: OrchestrationRequest): Promise<void> {
    this.queue.push(request);
  }
}
