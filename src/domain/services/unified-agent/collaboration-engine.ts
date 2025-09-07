import { IAgent, CollaborativeTask, CollaborativeResponse } from './agent-types.js';
import { sequentialCollaboration } from './collaboration-strategies/sequential-collaboration.js';
import { parallelCollaboration } from './collaboration-strategies/parallel-collaboration.js';
import { hierarchicalCollaboration } from './collaboration-strategies/hierarchical-collaboration.js';
import { consensusCollaboration } from './collaboration-strategies/consensus-collaboration.js';

type StrategyName = 'sequential' | 'parallel' | 'hierarchical' | 'consensus';

type StrategyHandler = (
  agents: IAgent[],
  task: CollaborativeTask
) => Promise<CollaborativeResponse>;

export class CollaborationEngine {
  private strategies: Record<StrategyName, StrategyHandler> = {
    sequential: sequentialCollaboration,
    parallel: parallelCollaboration,
    hierarchical: hierarchicalCollaboration,
    consensus: consensusCollaboration,
  };

  async collaborate(
    strategy: StrategyName,
    agents: IAgent[],
    task: CollaborativeTask
  ): Promise<CollaborativeResponse> {
    const handler = this.strategies[strategy];
    return handler(agents, task);
  }
}
