import { DependencyResolver } from './dependency-resolver.js';
import { ExecutionScheduler } from './execution-scheduler.js';
import { ResultAggregator, ToolRunResult } from './result-aggregator.js';
import {
  unifiedToolRegistry,
  ToolExecutionContext,
  ToolExecutionResult,
} from './unified-tool-registry.js';

export interface WorkflowStep {
  tool: string;
  input: any;
  dependsOn?: string[];
}

export interface WorkflowResult {
  successes: ToolRunResult[];
  errors: ToolRunResult[];
}

export class WorkflowEngine {
  private resolver: DependencyResolver;
  private scheduler: ExecutionScheduler;
  private aggregator: ResultAggregator;

  constructor(
    resolver = new DependencyResolver(),
    scheduler = new ExecutionScheduler(),
    aggregator = new ResultAggregator()
  ) {
    this.resolver = resolver;
    this.scheduler = scheduler;
    this.aggregator = aggregator;
  }

  async run(steps: WorkflowStep[], context: ToolExecutionContext): Promise<WorkflowResult> {
    steps.forEach(step => this.resolver.register(step.tool, step.dependsOn));
    const order = this.resolver.resolveOrder(steps.map(s => s.tool));

    const tasks = order.map(toolId => {
      const step = steps.find(s => s.tool === toolId)!;
      return async () => unifiedToolRegistry.executeTool(toolId, step.input, context);
    });

    const results: ToolExecutionResult[] = await this.scheduler.schedule(tasks);
    results.forEach((res, idx) => {
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
