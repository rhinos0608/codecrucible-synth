import { WorkflowEngine, WorkflowResult, WorkflowStep } from './workflow-engine.js';
import { ToolExecutionContext } from './unified-tool-registry.js';

export class ToolOrchestrator {
  private readonly engine: WorkflowEngine;

  public constructor(engine: WorkflowEngine = new WorkflowEngine()) {
    this.engine = engine;
  }

  public async executeWorkflow(
    steps: ReadonlyArray<WorkflowStep<Readonly<Record<string, unknown>>>>,
    context: ToolExecutionContext
  ): Promise<WorkflowResult> {
    return this.engine.run(steps, context);
  }
}

export const toolOrchestrator = new ToolOrchestrator();
