import type { EventCoordinator } from './event-coordinator.js';

/**
 * ExecutionMonitor emits monitoring events for observability.
 */
export class ExecutionMonitor {
  public constructor(private readonly events: EventCoordinator) {}

  public track(event: string, data?: unknown): void {
    this.events.emitEvent(`monitor.${event}`, data);
  }
}
