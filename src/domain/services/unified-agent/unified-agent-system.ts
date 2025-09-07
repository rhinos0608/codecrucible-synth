import { AgentTask, AgentResponse, AgentFeedback, IAgent } from './agent-types.js';
import { AgentRegistry } from './agent-registry.js';
import { ExpertiseMatcher } from './expertise-matcher.js';
import { ResourceCoordinator } from './resource-coordinator.js';
import { FeedbackProcessor } from './feedback-processor.js';
import { ProjectContextAnalyzer } from './project-context-analyzer.js';
import { CollaborationEngine } from './collaboration-engine.js';

export class UnifiedAgentSystem {
  private registry = new AgentRegistry();
  private matcher = new ExpertiseMatcher();
  private coordinator = new ResourceCoordinator();
  private feedback = new FeedbackProcessor();
  private contextAnalyzer = new ProjectContextAnalyzer();
  private collaboration = new CollaborationEngine();

  registerAgent(agent: IAgent): void {
    this.registry.registerAgent(agent);
  }

  async executeTask(
    task: AgentTask,
    strategy: 'sequential' | 'parallel' | 'hierarchical' | 'consensus'
  ): Promise<AgentResponse> {
    const agents = this.matcher.matchAgents(task, this.registry.listAgents());
    this.coordinator.calculateTotalResources(agents);
    const collabResponse = await this.collaboration.collaborate(strategy, agents, {
      id: task.id,
      description: task.description,
      requirements: [],
      expectedOutput: '',
      coordination: {
        type: strategy,
        participants: agents.map(a => a.id),
        coordination: 'peer-to-peer',
        conflictResolution: 'user-choice',
      },
    });
    return {
      taskId: task.id,
      output: collabResponse.result.output,
      success: collabResponse.result.success,
    };
  }

  async provideFeedback(agent: IAgent, feedback: AgentFeedback): Promise<void> {
    await this.feedback.process(agent, feedback);
  }

  async analyzeProject(rootPath: string) {
    return this.contextAnalyzer.analyze(rootPath);
  }
}
