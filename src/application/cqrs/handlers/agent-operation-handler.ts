import type { Command, CommandHandler } from '../command-bus.js';
import type { OrchestrationRequest } from '../../services/unified-orchestration-service.js';

export class AgentOperationHandler<TResponse>
  implements CommandHandler<{ request: OrchestrationRequest }, TResponse>
{
  public constructor(
    public readonly type: string,
    private readonly processAgentRequest: (
      req: Readonly<OrchestrationRequest>
    ) => Promise<TResponse>
  ) {}

  public async handle(
    command: Command<{ readonly request: OrchestrationRequest }>
  ): Promise<TResponse> {
    return this.processAgentRequest(command.payload.request);
  }
}
