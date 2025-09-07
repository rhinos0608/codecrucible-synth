import { IAgent } from './agent-types.js';

/**
 * Agent discovery and registration service.
 * Maintains a registry of available agents and supports dynamic loading.
 */
export class AgentRegistry {
  private readonly agents: Map<string, IAgent> = new Map();

  public registerAgent(agent: Readonly<IAgent>): void {
    this.agents.set(agent.id, agent);
  }

  public getAgent(id: string): IAgent | undefined {
    return this.agents.get(id);
  }

  public listAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }
}
