
import { BaseAgent, BaseAgentConfig, AgentDependencies, BaseAgentOutput } from './base-agent.js';
import { BaseTool } from './tools/base-tool.js';

export abstract class BaseSpecializedAgent extends BaseAgent<BaseAgentOutput> {
  constructor(config: BaseAgentConfig, dependencies: AgentDependencies) {
    super(config, dependencies);
  }

  protected async createAgent(): Promise<this> {
    return this;
  }

  protected async executeAgent(agent: this, input: string, streaming?: boolean): Promise<BaseAgentOutput> {
    return this.processRequest(input, streaming);
  }

  protected generateSystemPrompt(): string {
    // Default system prompt for specialized agents
    return `You are ${this.config.name}, a specialized agent. ${this.config.description}`;
  }

  public getAvailableTools(): BaseTool[] {
    // Default empty tools - override in subclasses
    return [];
  }

  public abstract processRequest(input: string, streaming?: boolean): Promise<BaseAgentOutput>;
}
