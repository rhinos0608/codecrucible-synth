import {
  IAgent,
  CollaborativeTask,
  CollaborativeResponse,
  ExecutionResult,
} from '../agent-types.js';

export async function hierarchicalCollaboration(
  agents: IAgent[],
  task: CollaborativeTask
): Promise<CollaborativeResponse> {
  const [leader, ...workers] = agents;
  const leaderResult = await leader.process({
    id: task.id,
    type: 'collaborate',
    input: task.description,
    priority: 'high',
  });
  const contributions = new Map<string, ExecutionResult>();
  contributions.set(leader.id, leaderResult);
  for (const worker of workers) {
    const res = await worker.process({
      id: task.id,
      type: 'collaborate',
      input: leaderResult.output,
      priority: 'medium',
    });
    contributions.set(worker.id, res);
  }
  return {
    taskId: task.id,
    participants: agents.map(a => a.id),
    result: leaderResult,
    contributions,
    consensus: true,
    conflictsResolved: 0,
    executionTime: leaderResult.duration,
  };
}
