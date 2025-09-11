import { DependencyResolver } from './dependency-resolver.js';
import { ExecutionScheduler } from './execution-scheduler.js';
import { ResultAggregator, ToolRunResult } from './result-aggregator.js';
import {
  ToolExecutionContext,
  ToolExecutionResult,
  unifiedToolRegistry,
} from './unified-tool-registry.js';

export interface WorkflowStep<InputType = unknown> {
  tool: string;
  input: InputType;
  dependsOn?: string[];
}

export interface WorkflowResult {
  successes: ToolRunResult[];
  errors: ToolRunResult[];
}

export class WorkflowEngine {
  private readonly resolver: DependencyResolver;
  private readonly scheduler: ExecutionScheduler;
  private readonly aggregator: ResultAggregator;

  public constructor(
    resolver: Readonly<DependencyResolver> = new DependencyResolver(),
    scheduler: Readonly<ExecutionScheduler> = new ExecutionScheduler(),
    aggregator: Readonly<ResultAggregator> = new ResultAggregator()
  ) {
    this.resolver = resolver as DependencyResolver;
    this.scheduler = scheduler as ExecutionScheduler;
    this.aggregator = aggregator as ResultAggregator;
  }

  public async run(
    steps: ReadonlyArray<Readonly<WorkflowStep<Readonly<Record<string, unknown>>>>>,
    context: Readonly<ToolExecutionContext>
  ): Promise<WorkflowResult> {
    steps.forEach((step: Readonly<WorkflowStep<Readonly<Record<string, unknown>>>>) => {
      this.resolver.register(step.tool, step.dependsOn);
    });
    const order = this.resolver.resolveOrder(
      steps.map((s: Readonly<WorkflowStep<Readonly<Record<string, unknown>>>>) => s.tool)
    );

    const tasks = order.map((toolId: string) => {
      const step = steps.find(
        (s: Readonly<WorkflowStep<Readonly<Record<string, unknown>>>>) => s.tool === toolId
      );
      if (!step) {
        throw new Error(`Workflow step for toolId "${toolId}" not found.`);
      }
      // Ensure step.input is Readonly<Record<string, unknown>>
      return async () => unifiedToolRegistry.executeTool(toolId, step.input, context);
    });

    const results: ReadonlyArray<ToolExecutionResult> = await this.scheduler.schedule(tasks);
    results.forEach((res: Readonly<ToolExecutionResult>, idx: number) => {
      this.aggregator.add({
        toolId: order[idx],
        success: res.success,
        data: res.data,
        error: res.error,
      });
    });

    return this.aggregator.combine();
  }
}
