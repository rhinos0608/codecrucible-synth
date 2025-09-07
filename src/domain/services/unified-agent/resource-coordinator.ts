import { IAgent } from './agent-types.js';

/**
 * Aggregates and optimizes resource requirements across agents.
 */
export class ResourceCoordinator {
  calculateTotalResources(agents: IAgent[]): { memory: number; cpu: number } {
    return agents.reduce(
      (acc, agent) => {
        for (const capability of agent.capabilities) {
          acc.memory += capability.resources.memory;
          acc.cpu += capability.resources.cpu;
        }
        return acc;
      },
      { memory: 0, cpu: 0 }
    );
  }
}
