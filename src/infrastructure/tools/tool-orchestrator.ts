import { WorkflowEngine, WorkflowStep, WorkflowResult } from './workflow-engine.js';
import { ToolExecutionContext } from './unified-tool-registry.js';

export class ToolOrchestrator {
  private engine: WorkflowEngine;

  constructor(engine = new WorkflowEngine()) {
    this.engine = engine;
  }

  async executeWorkflow(
    steps: ReadonlyArray<Readonly<WorkflowStep<Readonly<Record<string, unknown>>>>>,
    context: ToolExecutionContext
  ): Promise<WorkflowResult> {
    return this.engine.run(steps, context);
  }
}

export const toolOrchestrator = new ToolOrchestrator();
