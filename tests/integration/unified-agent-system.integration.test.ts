import { describe, expect, it, beforeEach } from '@jest/globals';
import {
  UnifiedAgentSystem,
  IAgent,
  AgentRequest,
  AgentResponse,
  CollaborativeTask,
  CollaborativeResponse,
} from '../../src/domain/services/unified-agent/index.js';

class DummyAgent implements IAgent {
  id = 'agent-1';
  name = 'Dummy';
  role = {
    type: 'developer',
    description: 'test agent',
    responsibilities: [],
    authority: 'implementation',
    scope: 'project',
    expertise: [],
  } as const;
  status: 'idle' = 'idle';
  capabilities = [];
  expertiseDomains = ['general'];
  async initialize(): Promise<void> {}
  async process(request: AgentRequest): Promise<AgentResponse> {
    return {
      taskId: request.id,
      output: `processed: ${request.input}`,
      success: true,
      duration: 1,
    };
  }
  async collaborate(
    agents: ReadonlyArray<IAgent>,
    task: CollaborativeTask
  ): Promise<CollaborativeResponse> {
    return {
      taskId: task.id,
      participants: agents.map(a => a.id),
      result: { success: true, output: 'collab', duration: 1 },
      contributions: new Map(),
      consensus: true,
      conflictsResolved: 0,
      executionTime: 1,
    };
  }
  async learn(): Promise<void> {}
  async shutdown(): Promise<void> {}
}

describe('UnifiedAgentSystem integration', () => {
  let system: UnifiedAgentSystem;

  beforeEach(async () => {
    system = new UnifiedAgentSystem();
    await system.initialize();
  });

  it('registers agents and executes tasks', async () => {
    const agent = new DummyAgent();
    system.registerAgent(agent);

    const agents = system.getAllAgents();
    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe('agent-1');

    const response = await system.processRequest({
      id: 'task-1',
      type: 'test',
      input: 'hello',
      priority: 'medium',
    });

    expect(response.result).toBeDefined();
    const result = response.result as { output: string; success: boolean };
    expect(result.output).toBe('processed: hello');
    expect(result.success).toBe(true);

    const stats = system.getSystemStats();
    expect(stats.completedTasks).toBe(1);
  });
});
