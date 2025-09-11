import { CollaborativeResponse, CollaborativeTask, IAgent } from './agent-types.js';
import { sequentialCollaboration } from './collaboration-strategies/sequential-collaboration.js';
import { parallelCollaboration } from './collaboration-strategies/parallel-collaboration.js';
import { hierarchicalCollaboration } from './collaboration-strategies/hierarchical-collaboration.js';
import { consensusCollaboration } from './collaboration-strategies/consensus-collaboration.js';

type StrategyName = 'sequential' | 'parallel' | 'hierarchical' | 'consensus';

type StrategyHandler = (
  agents: IAgent[],
  task: Readonly<CollaborativeTask>
) => Promise<CollaborativeResponse>;

export class CollaborationEngine {
  private readonly strategies: Record<StrategyName, StrategyHandler> = {
    sequential: sequentialCollaboration,
    parallel: parallelCollaboration,
    hierarchical: hierarchicalCollaboration,
    consensus: consensusCollaboration,
  };

  public async collaborate(
    strategy: StrategyName,
    agents: readonly IAgent[],
    task: Readonly<CollaborativeTask>
  ): Promise<CollaborativeResponse> {
    const handler = this.strategies[strategy];
    const mutableAgents: IAgent[] = [...agents];
    return handler(mutableAgents, task);
  }

  public async initialize(): Promise<void> {
    // Initialize collaboration engine
  }

  public async shutdown(): Promise<void> {
    // Cleanup collaboration engine
  }
}
