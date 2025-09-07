import {
  CollaborativeResponse,
  CollaborativeTask,
  ExecutionResult,
  IAgent,
} from '../agent-types.js';

export async function sequentialCollaboration(
  agents: IAgent[],
  task: CollaborativeTask
): Promise<CollaborativeResponse> {
  const contributions = new Map<string, ExecutionResult>();
  let result: ExecutionResult = { success: true, output: '', duration: 0 };
  for (const agent of agents) {
    result = await agent.process({
      id: task.id,
      type: 'collaborate',
      input: task.description,
      priority: 'medium',
    });
    contributions.set(agent.id, result);
    if (!result.success) break;
  }
  return {
    taskId: task.id,
    participants: agents.map(a => a.id),
    result,
    contributions,
    consensus: result.success,
    conflictsResolved: 0,
    executionTime: result.duration,
  };
}
