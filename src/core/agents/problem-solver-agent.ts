
import { BaseSpecializedAgent } from '../base-specialized-agent.js';
import { BaseAgentConfig, AgentDependencies, BaseAgentOutput } from '../base-agent.js';
import { ReActAgent } from '../react-agent.js';

export class ProblemSolverAgent extends BaseSpecializedAgent {
  constructor(dependencies: AgentDependencies) {
    const config: BaseAgentConfig = {
      name: 'ProblemSolverAgent',
      description: 'Focused on identifying and solving specific problems',
      rateLimit: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, backoffMultiplier: 2 },
      timeout: 60000,
    };
    super(config, dependencies);
  }

  public async processRequest(input: string, streaming?: boolean): Promise<BaseAgentOutput> {
    const reactAgent = new ReActAgent(this.dependencies.context, this.dependencies.workingDirectory);
    const enhancedPrompt = `Problem Solving Task: ${input}
    
Approach:
1. Identify the root cause of the problem
2. Analyze potential solutions
3. Recommend the best approach
4. Consider implementation steps
5. Anticipate potential issues`;

    const result = await reactAgent.processRequest(enhancedPrompt);
    return new BaseAgentOutput(true, result);
  }
}
