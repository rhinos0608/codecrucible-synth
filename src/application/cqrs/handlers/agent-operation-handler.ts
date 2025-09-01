import type { Command, CommandHandler } from '../command-bus.js';
import type { OrchestrationRequest } from '../../services/unified-orchestration-service.js';

type AgentOp = 'analyze' | 'generate' | 'refactor' | 'test' | 'document' | 'debug' | 'optimize';

export class AgentOperationHandler implements CommandHandler<{ request: OrchestrationRequest }, any> {
  constructor(
    public readonly type: string,
    private readonly processAgentRequest: (req: OrchestrationRequest) => Promise<any>
  ) {}

  async handle(command: Command<{ request: OrchestrationRequest }>): Promise<any> {
    return this.processAgentRequest(command.payload.request);
  }
}

