import {
  IAgent,
  CollaborativeTask,
  CollaborativeResponse,
  ExecutionResult,
} from '../agent-types.js';

export async function consensusCollaboration(
  agents: IAgent[],
  task: CollaborativeTask
): Promise<CollaborativeResponse> {
  const contributions = new Map<string, ExecutionResult>();
  const results: ExecutionResult[] = [];
  for (const agent of agents) {
    const res = await agent.process({
      id: task.id,
      type: 'collaborate',
      input: task.description,
      priority: 'medium',
    });
    contributions.set(agent.id, res);
    results.push(res);
  }
  const successVotes = results.filter(r => r.success).length;
  const success = successVotes > results.length / 2;
  const duration = Math.max(...results.map(r => r.duration));
  return {
    taskId: task.id,
    participants: agents.map(a => a.id),
    result: { success, output: '', duration },
    contributions,
    consensus: success,
    conflictsResolved: results.length - successVotes,
    executionTime: duration,
  };
}
