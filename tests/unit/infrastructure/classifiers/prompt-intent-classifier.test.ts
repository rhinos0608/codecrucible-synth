import { PromptIntentClassifier } from '../../../src/infrastructure/classifiers/prompt-intent-classifier.js';
import type {
  IWorkflowOrchestrator,
  WorkflowRequest,
  WorkflowResponse,
  ToolExecutionArgs,
  ToolExecutionResult,
  ModelRequest,
  ModelResponse,
  WorkflowContext,
} from '../../../src/domain/interfaces/workflow-orchestrator.js';

describe('PromptIntentClassifier', () => {
  class StubOrchestrator implements IWorkflowOrchestrator {
    public async processRequest(_req: Readonly<WorkflowRequest>): Promise<WorkflowResponse> {
      return {
        id: '1',
        success: true,
        result: '{"intent":"code_generation","riskLevel":"high"}',
      };
    }
    public async executeTool(
      _toolName: string,
      _args: Readonly<ToolExecutionArgs>,
      _context: Readonly<WorkflowContext>
    ): Promise<ToolExecutionResult> {
      return { success: true } as ToolExecutionResult;
    }
    public async processModelRequest(
      _req: Readonly<ModelRequest>,
      _context?: Readonly<WorkflowContext>
    ): Promise<ModelResponse> {
      return { id: '1', success: true } as ModelResponse;
    }
    public async initialize(): Promise<void> {}
    public async shutdown(): Promise<void> {}
  }

  it('parses classification JSON from orchestrator', async () => {
    const classifier = new PromptIntentClassifier(new StubOrchestrator());
    const result = await classifier.classify('generate a file');
    expect(result.intent).toBe('code_generation');
    expect(result.riskLevel).toBe('high');
  });
});
