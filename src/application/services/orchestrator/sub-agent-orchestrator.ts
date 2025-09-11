import { randomUUID } from 'crypto';
import type { IModelClient, ModelRequest, ModelResponse } from '../../../domain/interfaces/model-client.js';
import type { IMcpManager } from '../../../domain/interfaces/mcp-manager.js';
import type { WorkflowRequest } from '../../../domain/interfaces/workflow-orchestrator.js';
import { ToolExecutionRouter } from './tool-execution-router.js';
import { createLogger } from '../../../infrastructure/logging/logger-adapter.js';

const logger = createLogger('SubAgent');

export interface SubAgentOptions {
  model?: string;
  provider?: string;
  maxSteps?: number;
  maxChars?: number; // context window approximation
  temperature?: number;
}

export class SubAgentOrchestrator {
  private readonly modelClient: IModelClient;
  private readonly mcpManager: IMcpManager;
  private readonly toolRouter: ToolExecutionRouter;
  private messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string }> = [];

  public constructor(modelClient: IModelClient, mcpManager: IMcpManager) {
    this.modelClient = modelClient;
    this.mcpManager = mcpManager;
    this.toolRouter = new ToolExecutionRouter(mcpManager);
  }

  public async run(goal: string, options: Readonly<SubAgentOptions> = {}): Promise<{
    success: boolean;
    content: string;
    steps: Array<{ action: string; result: unknown }>;
  }> {
    const maxSteps = options.maxSteps ?? 8;
    const maxChars = options.maxChars ?? 16000;
    const workflowId = randomUUID();
    this.messages = [{ role: 'user', content: goal }];
    const steps: Array<{ action: string; result: unknown }> = [];

    const trimContext = (): void => {
      let total = this.messages.reduce((acc, m) => acc + m.content.length, 0);
      while (total > maxChars && this.messages.length > 1) {
        // Remove oldest non-system message
        const [removed] = this.messages.splice(1, 1);
        total -= removed.content.length;
      }
    };

    for (let i = 0; i < maxSteps; i++) {
      trimContext();
      const req: ModelRequest = {
        id: `${workflowId}_step_${i}`,
        prompt: '',
        model: options.model,
        temperature: options.temperature ?? 0.7,
        stream: false,
        messages: this.messages.map(m => ({ role: m.role === 'tool' ? 'assistant' : m.role as 'system' | 'user' | 'assistant', content: m.content })),
      } as ModelRequest;

      logger.info('SubAgent step request', { step: i + 1, goal: goal.substring(0, 60) });
      let response: ModelResponse = await this.modelClient.request(req);

      // If tool calls present, process via ToolExecutionRouter to ensure MCP JSON-RPC path
      if (response.toolCalls && response.toolCalls.length > 0) {
        const wfReq: WorkflowRequest = {
          id: workflowId,
          type: 'tool-execution',
          payload: {},
          context: { sessionId: workflowId, workingDirectory: process.cwd(), securityLevel: 'medium' },
        } as unknown as WorkflowRequest;

        response = await this.toolRouter.handleToolCalls(
          response,
          wfReq,
          req,
          async (r: Readonly<ModelRequest>) => this.modelClient.request(r)
        );
      }

      if (response.content) {
        this.messages.push({ role: 'assistant', content: response.content });
        steps.push({ action: 'model_response', result: response.content });
      }

      // Simple termination condition
      if (!response.toolCalls || response.toolCalls.length === 0) {
        break;
      }
    }

    const final = this.messages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n');
    return { success: true, content: final, steps };
  }
}

