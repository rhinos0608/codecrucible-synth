import { ToolExecutionRouter } from '../../../../src/application/services/orchestrator/tool-execution-router.js';
import type { IMcpManager } from '../../../../src/domain/interfaces/mcp-manager.js';
import type { WorkflowRequest } from '../../../../src/domain/interfaces/workflow-orchestrator.js';
import type {
  ModelRequest,
  ModelResponse,
} from '../../../../src/domain/interfaces/model-client.js';

describe('ToolExecutionRouter', () => {
  it('returns original response when no tool calls', async () => {
    const mcpManager = { executeTool: jest.fn() } as unknown as IMcpManager;
    const router = new ToolExecutionRouter(mcpManager);
    const response = { content: 'hi' } as ModelResponse;
    const request = { payload: { input: 'hello' } } as WorkflowRequest;
    const modelRequest = {} as ModelRequest;
    const processModelRequest = jest.fn();
    const result = await router.handleToolCalls(
      response,
      request,
      modelRequest,
      processModelRequest
    );
    expect(result).toBe(response);
    expect(mcpManager.executeTool).not.toHaveBeenCalled();
  });
});
