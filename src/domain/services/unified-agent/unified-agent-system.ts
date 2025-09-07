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
  private initialized = false;

  registerAgent(agent: IAgent): void {
    this.registry.registerAgent(agent);
  }

  async executeTask(
    task: AgentTask,
    strategy: 'sequential' | 'parallel' | 'hierarchical' | 'consensus'
  ): Promise<AgentResponse> {
    const agents = this.matcher.matchAgents(task, this.registry.listAgents());
    const totalResources = this.coordinator.calculateTotalResources(agents);
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
      duration: Date.now() - Date.now(), // TODO: Implement proper duration tracking
    };
  }

  async provideFeedback(agent: IAgent, feedback: AgentFeedback): Promise<void> {
    await this.feedback.process(agent, feedback);
  }

  async analyzeProject(rootPath: string) {
    return this.contextAnalyzer.analyze(rootPath);
  }

  // Missing methods required by UnifiedOrchestrationService

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    // Initialize internal components
    await Promise.all([
      this.registry.initialize?.() || Promise.resolve(),
      this.matcher.initialize?.() || Promise.resolve(),
      this.coordinator.initialize?.() || Promise.resolve(),
      this.feedback.initialize?.() || Promise.resolve(),
      this.contextAnalyzer.initialize?.() || Promise.resolve(),
      this.collaboration.initialize?.() || Promise.resolve(),
    ]);
    
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }
    
    // Shutdown internal components
    await Promise.all([
      this.registry.shutdown?.() || Promise.resolve(),
      this.matcher.shutdown?.() || Promise.resolve(),
      this.coordinator.shutdown?.() || Promise.resolve(),
      this.feedback.shutdown?.() || Promise.resolve(),
      this.contextAnalyzer.shutdown?.() || Promise.resolve(),
      this.collaboration.shutdown?.() || Promise.resolve(),
    ]);
    
    this.initialized = false;
  }

  async processRequest(request: {
    id: string;
    type: string;
    input: string;
    priority: string;
    constraints?: { maxExecutionTime?: number; securityLevel: string };
    preferences?: { mode: string; outputFormat: string; includeReasoning: boolean; verboseLogging: boolean; interactiveMode: boolean };
    context?: unknown;
  }): Promise<{ result: unknown }> {
    const task: AgentTask = {
      id: request.id,
      description: request.input,
      type: request.type as any,
      priority: this.mapPriority(request.priority),
      context: request.context || {},
      constraints: {
        maxDuration: request.constraints?.maxExecutionTime,
        resourceLimits: {},
      },
    };

    const strategy = this.determineStrategy(request.preferences?.mode || 'balanced');
    const response = await this.executeTask(task, strategy);
    
    return {
      result: {
        output: response.output,
        success: response.success,
        taskId: response.taskId,
      },
    };
  }

  getAllAgents(): IAgent[] {
    return this.registry.listAgents();
  }

  getSystemStats(): {
    totalAgents: number;
    activeAgents: number;
    completedTasks: number;
    averageResponseTime: number;
  } {
    const agents = this.registry.listAgents();
    
    return {
      totalAgents: agents.length,
      activeAgents: agents.filter(agent => agent.isActive ?? true).length,
      completedTasks: 0, // Would need to track this
      averageResponseTime: 0, // Would need to track this
    };
  }

  // Helper methods
  
  private mapPriority(priority: string): 'low' | 'medium' | 'high' | 'critical' {
    const mapping: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      low: 'low',
      medium: 'medium',
      high: 'high',
      critical: 'critical',
    };
    return mapping[priority] || 'medium';
  }

  private determineStrategy(mode: string): 'sequential' | 'parallel' | 'hierarchical' | 'consensus' {
    const strategyMapping: Record<string, 'sequential' | 'parallel' | 'hierarchical' | 'consensus'> = {
      fast: 'parallel',
      balanced: 'sequential',
      thorough: 'consensus',
    };
    return strategyMapping[mode] || 'sequential';
  }
}
