
import { BaseSpecializedAgent } from '../base-specialized-agent.js';
import { BaseAgentConfig, AgentDependencies, BaseAgentOutput } from '../base-agent.js';
import { ReActAgent } from '../react-agent.js';

export class FileExplorerAgent extends BaseSpecializedAgent {
  constructor(dependencies: AgentDependencies) {
    const config: BaseAgentConfig = {
      name: 'FileExplorerAgent',
      description: 'Expert at file system navigation and project structure analysis',
      rateLimit: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, backoffMultiplier: 2 },
      timeout: 60000,
    };
    super(config, dependencies);
  }

  public async processRequest(input: string, streaming?: boolean): Promise<BaseAgentOutput> {
    const reactAgent = new ReActAgent(this.dependencies.context, this.dependencies.workingDirectory);
    const enhancedPrompt = `File Exploration Task: ${input}
    
Focus on:
- Project structure and organization
- Key files and directories
- Configuration files
- Documentation
- Build and deployment files

Provide a comprehensive overview of the project layout.`;

    const result = await reactAgent.processRequest(enhancedPrompt);
    return new BaseAgentOutput(true, result);
  }
}
