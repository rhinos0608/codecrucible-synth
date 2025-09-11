import {
  CollaborativeResponse,
  CollaborativeTask,
  ExecutionResult,
  IAgent,
} from '../agent-types.js';

export async function consensusCollaboration(
  agents: readonly IAgent[],
  task: Readonly<CollaborativeTask>
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
  const successVotes = results.filter((r: Readonly<ExecutionResult>) => r.success).length;
  const success = successVotes > results.length / 2;
  const duration = Math.max(...results.map((r: Readonly<ExecutionResult>) => r.duration));
  return {
    taskId: task.id,
    participants: agents.map((a: Readonly<IAgent>) => a.id),
    result: { success, output: '', duration },
    contributions,
    consensus: success,
    conflictsResolved: results.length - successVotes,
    executionTime: duration,
  };
}
