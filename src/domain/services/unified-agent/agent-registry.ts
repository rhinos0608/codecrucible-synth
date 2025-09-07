import { IAgent } from './agent-types.js';

/**
 * Agent discovery and registration service.
 * Maintains a registry of available agents and supports dynamic loading.
 */
export class AgentRegistry {
  private agents: Map<string, IAgent> = new Map();

  registerAgent(agent: IAgent): void {
    this.agents.set(agent.id, agent);
  }

  getAgent(id: string): IAgent | undefined {
    return this.agents.get(id);
  }

  listAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }
}
