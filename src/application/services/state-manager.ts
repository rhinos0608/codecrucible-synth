import type { OrchestrationRequest, OrchestrationResponse } from './orchestration-types.js';

/**
 * StateManager maintains workflow state and checkpoints for recovery.
 */
export class StateManager {
  private readonly responses = new Map<string, OrchestrationResponse>();

  public checkpoint(request: OrchestrationRequest, response: OrchestrationResponse): void {
    this.responses.set(request.id, response);
  }

  public getState(id: string): OrchestrationResponse | undefined {
    return this.responses.get(id);
  }
}
