import {
  CollaborativeResponse,
  CollaborativeTask,
  ExecutionResult,
  IAgent,
} from '../agent-types.js';

export async function parallelCollaboration(
  agents: readonly IAgent[],
  task: Readonly<CollaborativeTask>
): Promise<CollaborativeResponse> {
  const contributions = new Map<string, ExecutionResult>();
  const results = await Promise.all(
    agents.map(async (agent: Readonly<IAgent>) =>
      agent.process({
        id: task.id,
        type: 'collaborate',
        input: task.description,
        priority: 'medium',
      })
    )
  );
  results.forEach((res, idx) => contributions.set(agents[idx].id, res));
  const success = results.every(r => r.success);
  return {
    taskId: task.id,
    participants: agents.map(a => a.id),
    result: success
      ? { success: true, output: '', duration: Math.max(...results.map(r => r.duration)) }
      : { success: false, output: '', duration: Math.max(...results.map(r => r.duration)) },
    contributions,
    consensus: success,
    conflictsResolved: 0,
    executionTime: Math.max(...results.map(r => r.duration)),
  };
}
