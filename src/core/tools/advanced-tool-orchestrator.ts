// Advanced Tool Orchestrator
// Core layer tool orchestration and coordination

import { EventEmitter } from 'events';

export interface ToolOrchestrationContext {
  requestId: string;
  userId?: string;
  priority: 'low' | 'medium' | 'high';
  timeout: number;
  metadata?: Record<string, unknown>;
}

export interface ToolChain {
  id: string;
  tools: ToolStep[];
  parallelExecution?: boolean;
  rollbackOnFailure?: boolean;
}

export interface ToolStep {
  toolName: string;
  parameters: Record<string, unknown>;
  dependsOn?: string[];
  optional?: boolean;
  retryCount?: number;
}

export interface OrchestrationResult {
  success: boolean;
  results: Map<string, unknown>;
  errors: Map<string, string>;
  executionTime: number;
  stepsExecuted: number;
  stepsSkipped: number;
}

export interface AdvancedToolOrchestratorInterface {
  executeToolChain(chain: ToolChain, context: ToolOrchestrationContext): Promise<OrchestrationResult>;
  validateToolChain(chain: ToolChain): Promise<boolean>;
  optimizeToolChain(chain: ToolChain): Promise<ToolChain>;
  cancelExecution(requestId: string): Promise<boolean>;
}

export class AdvancedToolOrchestrator extends EventEmitter implements AdvancedToolOrchestratorInterface {
  private activeExecutions = new Map<string, AbortController>();
  private toolRegistry = new Map<string, ToolExecutor>();

  constructor() {
    super();
    this.initializeToolRegistry();
  }

  private initializeToolRegistry() {
    // Mock tool executors - would be replaced with actual implementations
    this.toolRegistry.set('filesystem', new MockToolExecutor('filesystem'));
    this.toolRegistry.set('git', new MockToolExecutor('git'));
    this.toolRegistry.set('terminal', new MockToolExecutor('terminal'));
    this.toolRegistry.set('analysis', new MockToolExecutor('analysis'));
    this.toolRegistry.set('generation', new MockToolExecutor('generation'));
  }

  async executeToolChain(chain: ToolChain, context: ToolOrchestrationContext): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const abortController = new AbortController();
    this.activeExecutions.set(context.requestId, abortController);

    const results = new Map<string, unknown>();
    const errors = new Map<string, string>();
    let stepsExecuted = 0;
    let stepsSkipped = 0;

    try {
      this.emit('orchestration:started', { chain, context });

      if (chain.parallelExecution) {
        await this.executeParallel(chain, context, results, errors, abortController.signal);
        stepsExecuted = chain.tools.length - errors.size;
      } else {
        const executionResult = await this.executeSequential(chain, context, results, errors, abortController.signal);
        stepsExecuted = executionResult.executed;
        stepsSkipped = executionResult.skipped;
      }

      const success = errors.size === 0 || chain.tools.some(step => step.optional && !errors.has(step.toolName));

      const orchestrationResult: OrchestrationResult = {
        success,
        results,
        errors,
        executionTime: Date.now() - startTime,
        stepsExecuted,
        stepsSkipped
      };

      this.emit('orchestration:completed', { chain, context, result: orchestrationResult });
      return orchestrationResult;

    } catch (error) {
      const orchestrationResult: OrchestrationResult = {
        success: false,
        results,
        errors,
        executionTime: Date.now() - startTime,
        stepsExecuted,
        stepsSkipped
      };

      if (error instanceof Error) {
        errors.set('orchestrator', error.message);
      }

      this.emit('orchestration:error', { chain, context, error });
      return orchestrationResult;

    } finally {
      this.activeExecutions.delete(context.requestId);
    }
  }

  private async executeSequential(
    chain: ToolChain,
    context: ToolOrchestrationContext,
    results: Map<string, unknown>,
    errors: Map<string, string>,
    signal: AbortSignal
  ): Promise<{ executed: number; skipped: number }> {
    let executed = 0;
    let skipped = 0;

    for (const step of chain.tools) {
      if (signal.aborted) {
        skipped += chain.tools.length - executed - skipped;
        break;
      }

      // Check dependencies
      if (step.dependsOn) {
        const dependenciesMet = step.dependsOn.every(dep => 
          results.has(dep) && !errors.has(dep)
        );
        
        if (!dependenciesMet) {
          if (!step.optional) {
            errors.set(step.toolName, 'Dependencies not met');
          }
          skipped++;
          continue;
        }
      }

      try {
        const result = await this.executeToolStep(step, context, signal);
        results.set(step.toolName, result);
        executed++;
        
        this.emit('step:completed', { step, result, context });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.set(step.toolName, errorMessage);
        
        this.emit('step:error', { step, error, context });

        if (!step.optional && chain.rollbackOnFailure) {
          // Implement rollback logic here
          this.emit('orchestration:rollback', { chain, context, failedStep: step });
          break;
        }
      }
    }

    return { executed, skipped };
  }

  private async executeParallel(
    chain: ToolChain,
    context: ToolOrchestrationContext,
    results: Map<string, unknown>,
    errors: Map<string, string>,
    signal: AbortSignal
  ): Promise<void> {
    const promises = chain.tools.map(async (step) => {
      try {
        const result = await this.executeToolStep(step, context, signal);
        results.set(step.toolName, result);
        this.emit('step:completed', { step, result, context });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.set(step.toolName, errorMessage);
        this.emit('step:error', { step, error, context });
      }
    });

    await Promise.allSettled(promises);
  }

  private async executeToolStep(
    step: ToolStep,
    context: ToolOrchestrationContext,
    signal: AbortSignal
  ): Promise<unknown> {
    const executor = this.toolRegistry.get(step.toolName);
    if (!executor) {
      throw new Error(`Tool not found: ${step.toolName}`);
    }

    let lastError: Error | null = null;
    const maxRetries = step.retryCount || 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal.aborted) {
        throw new Error('Execution cancelled');
      }

      try {
        this.emit('step:started', { step, attempt, context });
        return await executor.execute(step.parameters, context, signal);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < maxRetries) {
          this.emit('step:retry', { step, attempt, error, context });
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError;
  }

  async validateToolChain(chain: ToolChain): Promise<boolean> {
    // Validate tool existence
    for (const step of chain.tools) {
      if (!this.toolRegistry.has(step.toolName)) {
        return false;
      }
    }

    // Validate dependencies
    const toolNames = new Set(chain.tools.map(t => t.toolName));
    for (const step of chain.tools) {
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!toolNames.has(dep)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  async optimizeToolChain(chain: ToolChain): Promise<ToolChain> {
    // Create optimized copy
    const optimizedChain: ToolChain = {
      ...chain,
      tools: [...chain.tools]
    };

    // Remove duplicate tools
    const seen = new Set<string>();
    optimizedChain.tools = optimizedChain.tools.filter(tool => {
      if (seen.has(tool.toolName)) {
        return false;
      }
      seen.add(tool.toolName);
      return true;
    });

    // Sort by dependencies for sequential execution
    if (!chain.parallelExecution) {
      optimizedChain.tools = this.topologicalSort(optimizedChain.tools);
    }

    return optimizedChain;
  }

  private topologicalSort(tools: ToolStep[]): ToolStep[] {
    const sorted: ToolStep[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (toolName: string) => {
      if (visited.has(toolName)) return;
      if (visiting.has(toolName)) {
        throw new Error('Circular dependency detected');
      }

      visiting.add(toolName);

      const tool = tools.find(t => t.toolName === toolName);
      if (tool && tool.dependsOn) {
        for (const dep of tool.dependsOn) {
          visit(dep);
        }
      }

      visiting.delete(toolName);
      visited.add(toolName);
      
      if (tool) {
        sorted.push(tool);
      }
    };

    for (const tool of tools) {
      visit(tool.toolName);
    }

    return sorted;
  }

  async cancelExecution(requestId: string): Promise<boolean> {
    const abortController = this.activeExecutions.get(requestId);
    if (abortController) {
      abortController.abort();
      this.activeExecutions.delete(requestId);
      this.emit('orchestration:cancelled', { requestId });
      return true;
    }
    return false;
  }
}

// Mock tool executor for demonstration
class MockToolExecutor implements ToolExecutor {
  constructor(private toolName: string) {}

  async execute(
    parameters: Record<string, unknown>,
    context: ToolOrchestrationContext,
    signal: AbortSignal
  ): Promise<unknown> {
    // Simulate execution time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    if (signal.aborted) {
      throw new Error('Execution cancelled');
    }

    return {
      tool: this.toolName,
      parameters,
      result: 'success',
      timestamp: Date.now()
    };
  }
}

interface ToolExecutor {
  execute(
    parameters: Record<string, unknown>,
    context: ToolOrchestrationContext,
    signal: AbortSignal
  ): Promise<unknown>;
}

export const advancedToolOrchestrator = new AdvancedToolOrchestrator();