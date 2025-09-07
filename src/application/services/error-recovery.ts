import type { EventCoordinator } from './event-coordinator.js';
import type { OrchestrationRequest } from './orchestration-types.js';

/**
 * ErrorRecovery provides centralized workflow error handling and retry hooks.
 */
export class ErrorRecovery {
  public constructor(private readonly events: EventCoordinator) {}

  public async handleError(error: Error, request: OrchestrationRequest): Promise<void> {
    // Emit standardized error event for monitoring and potential retries
    this.events.emitEvent('error', { error, request });
  }
}
