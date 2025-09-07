import type { OrchestrationRequest, OrchestrationResponse } from './orchestration-types.js';
import { TaskScheduler } from './task-scheduler.js';
import { ResourceAllocator } from './resource-allocator.js';
import { StateManager } from './state-manager.js';
import { EventCoordinator } from './event-coordinator.js';
import { ExecutionMonitor } from './execution-monitor.js';
import { ErrorRecovery } from './error-recovery.js';

interface WorkflowEngineDeps {
  scheduler: TaskScheduler;
  resources: ResourceAllocator;
  state: StateManager;
  events: EventCoordinator;
  monitor: ExecutionMonitor;
  recovery: ErrorRecovery;
}

/**
 * WorkflowEngine executes orchestration requests using provided dependencies.
 */
export class WorkflowEngine {
  public constructor(private readonly deps: WorkflowEngineDeps) {}

  public async execute(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    try {
      await this.deps.scheduler.schedule(request);
      this.deps.events.emitEvent('workflow.start', request);

      // Basic workflow orchestration logic
      let taskResults: any[] = [];
      const tasks = Array.isArray(request.payload?.tasks) ? request.payload.tasks : [request.payload];
      for (const task of tasks) {
        // Allocate resources for the task
        const resources = await this.deps.resources.allocate(task);
        // Simulate task execution (could be replaced with actual logic)
        const result = await this.deps.scheduler.executeTask(task, resources);
        taskResults.push({ taskId: task.id, result });
      }
      const response: OrchestrationResponse = {
        id: request.id,
        success: true,
        result: taskResults,
      };

      this.deps.state.checkpoint(request, response);
      this.deps.monitor.track('complete', response);
      this.deps.events.emitEvent('workflow.complete', response);
      return response;
    } catch (err) {
      await this.deps.recovery.handleError(err as Error, request);
      return {
        id: request.id,
        success: false,
        error: err as Error,
      };
    }
  }
}
