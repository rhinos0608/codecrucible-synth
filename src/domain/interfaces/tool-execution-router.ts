import type { WorkflowRequest } from './workflow-orchestrator.js';
import type { ModelRequest, ModelResponse } from './model-client.js';

export interface IToolExecutionRouter {
  handleToolCalls(
    response: Readonly<ModelResponse>,
    request: Readonly<WorkflowRequest>,
    modelRequest: Readonly<ModelRequest>,
    processModelRequest: (req: Readonly<ModelRequest>) => Promise<ModelResponse>
  ): Promise<ModelResponse>;
}
