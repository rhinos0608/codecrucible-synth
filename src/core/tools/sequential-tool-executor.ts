/**
 * Sequential Tool Executor
 * Executes tools in sequence with proper error handling and context passing
 */

import { BaseToolImplementation, ToolContext, ToolResult } from './base-tool-implementation.js';

export interface ExecutionStep {
  tool: BaseToolImplementation;
  input: any;
  continueOnError?: boolean;
  transformOutput?: (output: any, previousResults: ToolResult[]) => any;
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  stopOnFirstError?: boolean;
  timeout?: number;
  context?: ToolContext;
}

export interface ExecutionSummary {
  totalSteps: number;
  completedSteps: number;
  successfulSteps: number;
  failedSteps: number;
  totalExecutionTime: number;
  results: ToolResult[];
  errors: Array<{
    stepIndex: number;
    toolName: string;
    error: string;
  }>;
}

export class SequentialToolExecutor {
  private executing = false;
  private currentExecution: Promise<ExecutionSummary> | null = null;

  async executeSequence(plan: ExecutionPlan): Promise<ExecutionSummary> {
    if (this.executing) {
      throw new Error('Executor is already running. Wait for current execution to complete.');
    }

    this.executing = true;
    this.currentExecution = this.executeSequenceInternal(plan);
    
    try {
      return await this.currentExecution;
    } finally {
      this.executing = false;
      this.currentExecution = null;
    }
  }

  private async executeSequenceInternal(plan: ExecutionPlan): Promise<ExecutionSummary> {
    const startTime = Date.now();
    const results: ToolResult[] = [];
    const errors: Array<{ stepIndex: number; toolName: string; error: string }> = [];
    
    let completedSteps = 0;
    let successfulSteps = 0;
    let failedSteps = 0;

    const timeout = plan.timeout || 300000; // 5 minutes default
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Execution timeout')), timeout);
    });

    try {
      await Promise.race([
        this.executeSteps(plan, results, errors),
        timeoutPromise
      ]);
    } catch (error) {
      // Handle timeout or other execution errors
      errors.push({
        stepIndex: completedSteps,
        toolName: 'executor',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Calculate statistics
    for (const result of results) {
      completedSteps++;
      if (result.success) {
        successfulSteps++;
      } else {
        failedSteps++;
      }
    }

    const totalExecutionTime = Date.now() - startTime;

    return {
      totalSteps: plan.steps.length,
      completedSteps,
      successfulSteps,
      failedSteps,
      totalExecutionTime,
      results,
      errors
    };
  }

  private async executeSteps(
    plan: ExecutionPlan,
    results: ToolResult[],
    errors: Array<{ stepIndex: number; toolName: string; error: string }>
  ): Promise<void> {
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      
      try {
        console.log(`Executing step ${i + 1}/${plan.steps.length}: ${step.tool.name}`);
        
        // Prepare input (possibly transformed based on previous results)
        let input = step.input;
        if (step.transformOutput && results.length > 0) {
          input = step.transformOutput(step.input, results);
        }

        // Create execution context
        const context: ToolContext = {
          ...plan.context,
          timestamp: Date.now(),
          metadata: {
            stepIndex: i,
            totalSteps: plan.steps.length,
            previousResults: results.length,
            ...plan.context?.metadata
          }
        };

        // Validate input before execution
        const isValid = await step.tool.validate(input, context);
        if (!isValid) {
          const error = `Invalid input for tool ${step.tool.name} at step ${i + 1}`;
          errors.push({ stepIndex: i, toolName: step.tool.name, error });
          
          const errorResult: ToolResult = {
            success: false,
            error,
            executionTime: 0
          };
          results.push(errorResult);

          if (!step.continueOnError && (plan.stopOnFirstError !== false)) {
            break;
          }
          continue;
        }

        // Execute the tool
        const result = await step.tool.execute(input, context);
        results.push(result);

        // Handle execution failure
        if (!result.success) {
          const error = result.error || `Tool ${step.tool.name} failed at step ${i + 1}`;
          errors.push({ stepIndex: i, toolName: step.tool.name, error });

          if (!step.continueOnError && (plan.stopOnFirstError !== false)) {
            console.log(`Stopping execution due to failure at step ${i + 1}`);
            break;
          }
        }

        // Cleanup after execution
        await step.tool.cleanup(context);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ stepIndex: i, toolName: step.tool.name, error: errorMessage });
        
        const errorResult: ToolResult = {
          success: false,
          error: errorMessage,
          executionTime: 0
        };
        results.push(errorResult);

        if (!step.continueOnError && (plan.stopOnFirstError !== false)) {
          console.log(`Stopping execution due to exception at step ${i + 1}: ${errorMessage}`);
          break;
        }
      }
    }
  }

  isExecuting(): boolean {
    return this.executing;
  }

  getCurrentExecution(): Promise<ExecutionSummary> | null {
    return this.currentExecution;
  }

  // Utility methods for creating execution plans
  static createSequentialPlan(
    tools: BaseToolImplementation[],
    inputs: any[],
    options: {
      stopOnFirstError?: boolean;
      timeout?: number;
      context?: ToolContext;
    } = {}
  ): ExecutionPlan {
    if (tools.length !== inputs.length) {
      throw new Error('Number of tools must match number of inputs');
    }

    const steps: ExecutionStep[] = tools.map((tool, index) => ({
      tool,
      input: inputs[index],
      continueOnError: false
    }));

    return {
      steps,
      stopOnFirstError: options.stopOnFirstError,
      timeout: options.timeout,
      context: options.context
    };
  }

  static createPipelinePlan(
    tools: BaseToolImplementation[],
    initialInput: any,
    options: {
      stopOnFirstError?: boolean;
      timeout?: number;
      context?: ToolContext;
      transformers?: Array<(output: any, previousResults: ToolResult[]) => any>;
    } = {}
  ): ExecutionPlan {
    const steps: ExecutionStep[] = tools.map((tool, index) => ({
      tool,
      input: index === 0 ? initialInput : null, // First step uses initial input
      transformOutput: index > 0 ? (
        options.transformers?.[index] || ((_, previous) => previous[previous.length - 1]?.data)
      ) : undefined
    }));

    return {
      steps,
      stopOnFirstError: options.stopOnFirstError,
      timeout: options.timeout,
      context: options.context
    };
  }
}

export default SequentialToolExecutor;