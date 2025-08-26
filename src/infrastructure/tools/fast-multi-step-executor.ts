/**
 * Fast Multi-Step Executor for CodeCrucible Synth
 * Agent 2: Implementation of 2025 best practices for multi-step problem solving
 * Based on research of Aider, Cursor, and modern AI orchestration patterns
 */

import { logger } from '../logging/logger.js';
import { UnifiedModelClient } from '../client.js';

export interface MultiStepTask {
  id: string;
  description: string;
  steps: Step[];
  context?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface Step {
  id: string;
  name: string;
  description: string;
  inputs: string[];
  outputs: string[];
  estimatedDuration: number; // in milliseconds
  dependencies?: string[]; // step IDs that must complete first
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
}

export interface ExecutionPlan {
  taskId: string;
  totalSteps: number;
  estimatedDuration: number;
  parallelGroups: Step[][];
  sequentialOrder: string[];
}

export interface ExecutionResult {
  taskId: string;
  success: boolean;
  duration: number;
  completedSteps: number;
  failedSteps: number;
  results: Map<string, any>;
  errors: Map<string, Error>;
  performance: {
    avgStepDuration: number;
    parallelEfficiency: number;
    contextPreservation: number;
  };
}

/**
 * Fast Multi-Step Executor implementing 2025 best practices:
 * - Architect/Editor pattern separation
 * - Parallel execution where possible
 * - Context preservation across steps
 * - Performance optimization
 * - Streaming progress updates
 */
export class FastMultiStepExecutor {
  private modelClient: UnifiedModelClient;
  private activeExecutions: Map<string, ExecutionPlan> = new Map();
  private maxConcurrentSteps: number = 3;

  constructor(modelClient: UnifiedModelClient, options?: { maxConcurrentSteps?: number }) {
    this.modelClient = modelClient;
    this.maxConcurrentSteps = options?.maxConcurrentSteps || 3;
  }

  /**
   * Analyze a complex prompt and decompose it into optimized multi-step execution plan
   * Following Aider's architect/editor pattern
   */
  async analyzeAndPlan(prompt: string): Promise<MultiStepTask> {
    logger.info('🏗️ Fast Multi-Step: Analyzing task for decomposition');

    const planningPrompt = `
Act as an ARCHITECT AI. Analyze this complex request and decompose it into an optimized execution plan:

REQUEST: ${prompt}

Provide a JSON response with this structure:
{
  "task": {
    "id": "unique_task_id",
    "description": "Brief task summary",
    "priority": "high|medium|low",
    "estimatedComplexity": 1-10
  },
  "steps": [
    {
      "id": "step_1",
      "name": "Step Name",
      "description": "What this step does",
      "type": "analysis|implementation|validation|synthesis",
      "inputs": ["required inputs"],
      "outputs": ["expected outputs"],
      "estimatedDuration": milliseconds,
      "dependencies": ["prerequisite step IDs"],
      "canRunInParallel": true/false
    }
  ],
  "optimizations": {
    "parallelGroups": [["step_1", "step_2"], ["step_3"]],
    "criticalPath": ["step_1", "step_3", "step_4"],
    "contextRequired": true/false
  }
}

Focus on:
1. Breaking complex tasks into 3-7 manageable steps
2. Identifying which steps can run in parallel
3. Minimizing dependencies for better performance
4. Clear inputs/outputs for each step
`;

    const response = await this.modelClient.generate({
      prompt: planningPrompt,
      temperature: 0.3 // Lower temperature for more structured planning
    });

    try {
      const plan = JSON.parse(response.content);
      
      const task: MultiStepTask = {
        id: plan.task.id || `task_${Date.now()}`,
        description: plan.task.description || prompt.substring(0, 100),
        priority: plan.task.priority || 'medium',
        steps: plan.steps.map((step: any, index: number) => ({
          ...step,
          id: step.id || `step_${index + 1}`,
          status: 'pending' as const
        })),
        context: prompt
      };

      logger.info('✅ Task decomposition completed', {
        taskId: task.id,
        stepCount: task.steps.length,
        estimatedDuration: task.steps.reduce((sum, step) => sum + (step.estimatedDuration || 5000), 0)
      });

      return task;
    } catch (error) {
      // Fallback to simple step-by-step approach if JSON parsing fails
      logger.warn('⚠️ JSON parsing failed, using fallback decomposition');
      return this.createFallbackTask(prompt);
    }
  }

  /**
   * Execute a multi-step task with optimized performance
   * Implements parallel execution and context preservation
   */
  async execute(task: MultiStepTask, onProgress?: (step: Step, progress: number) => void): Promise<ExecutionResult> {
    logger.info('🚀 Fast Multi-Step: Starting optimized execution', {
      taskId: task.id,
      stepCount: task.steps.length
    });

    const startTime = Date.now();
    const results = new Map<string, any>();
    const errors = new Map<string, Error>();
    let completedSteps = 0;
    let context = task.context || '';

    // Create execution plan
    const plan = this.createExecutionPlan(task);
    this.activeExecutions.set(task.id, plan);

    try {
      // Execute parallel groups sequentially, but steps within each group in parallel
      for (const [groupIndex, parallelGroup] of plan.parallelGroups.entries()) {
        logger.info(`📊 Executing parallel group ${groupIndex + 1}/${plan.parallelGroups.length}`, {
          stepCount: parallelGroup.length
        });

        // Execute steps in parallel within this group
        const groupPromises = parallelGroup.map(async (step) => {
          try {
            step.status = 'in_progress';
            onProgress?.(step, (completedSteps / task.steps.length) * 100);

            const stepContext = this.buildStepContext(step, context, results);
            const stepResult = await this.executeStep(step, stepContext);
            
            step.status = 'completed';
            step.result = stepResult;
            results.set(step.id, stepResult);
            
            completedSteps++;
            onProgress?.(step, (completedSteps / task.steps.length) * 100);
            
            logger.info(`✅ Step completed: ${step.name}`, {
              stepId: step.id,
              duration: Date.now() - startTime
            });

            return stepResult;
          } catch (error) {
            step.status = 'failed';
            errors.set(step.id, error as Error);
            logger.error(`❌ Step failed: ${step.name}`, error);
            throw error;
          }
        });

        // Wait for all steps in this parallel group to complete
        await Promise.allSettled(groupPromises);

        // Update context with results from this group for next group
        context = this.updateContextWithResults(context, results);
      }

      const duration = Date.now() - startTime;
      const performance = this.calculatePerformanceMetrics(task, results, duration);

      logger.info('🎉 Multi-step execution completed successfully', {
        taskId: task.id,
        duration,
        completedSteps,
        performance
      });

      return {
        taskId: task.id,
        success: errors.size === 0,
        duration,
        completedSteps,
        failedSteps: errors.size,
        results,
        errors,
        performance
      };
    } catch (error) {
      logger.error('❌ Multi-step execution failed', error);
      throw error;
    } finally {
      this.activeExecutions.delete(task.id);
    }
  }

  /**
   * Execute a single step with context preservation
   */
  private async executeStep(step: Step, context: string): Promise<any> {
    const stepPrompt = `
Context from previous steps:
${context}

Current step to execute:
Name: ${step.name}
Description: ${step.description}
Required inputs: ${step.inputs.join(', ')}
Expected outputs: ${step.outputs.join(', ')}

Execute this step and provide the requested outputs. Be specific and actionable.
`;

    const response = await this.modelClient.generate({
      prompt: stepPrompt,
      temperature: 0.5
    });

    return {
      stepId: step.id,
      output: response.content,
      metadata: {
        timestamp: new Date(),
        tokens: response.content.length
      }
    };
  }

  /**
   * Create optimized execution plan with parallel groups
   */
  private createExecutionPlan(task: MultiStepTask): ExecutionPlan {
    const steps = task.steps;
    const parallelGroups: Step[][] = [];
    const processed = new Set<string>();

    // Simple algorithm: Group steps without dependencies together
    while (processed.size < steps.length) {
      const currentGroup: Step[] = [];
      
      for (const step of steps) {
        if (processed.has(step.id)) continue;
        
        // Check if all dependencies are satisfied
        const dependenciesSatisfied = (step.dependencies || []).every(depId => 
          processed.has(depId)
        );
        
        if (dependenciesSatisfied && currentGroup.length < this.maxConcurrentSteps) {
          currentGroup.push(step);
          processed.add(step.id);
        }
      }
      
      if (currentGroup.length > 0) {
        parallelGroups.push(currentGroup);
      }
    }

    const totalDuration = parallelGroups.reduce((sum, group) => 
      sum + Math.max(...group.map(step => step.estimatedDuration || 5000))
    , 0);

    return {
      taskId: task.id,
      totalSteps: steps.length,
      estimatedDuration: totalDuration,
      parallelGroups,
      sequentialOrder: parallelGroups.flat().map(step => step.id)
    };
  }

  /**
   * Build context for step execution
   */
  private buildStepContext(step: Step, baseContext: string, previousResults: Map<string, any>): string {
    let context = baseContext;
    
    // Add relevant results from previous steps
    if (step.dependencies) {
      for (const depId of step.dependencies) {
        const depResult = previousResults.get(depId);
        if (depResult) {
          context += `\n\nResult from ${depId}:\n${JSON.stringify(depResult.output)}`;
        }
      }
    }
    
    return context;
  }

  /**
   * Update context with new results
   */
  private updateContextWithResults(context: string, results: Map<string, any>): string {
    const recentResults = Array.from(results.values()).slice(-3); // Keep last 3 results
    const resultSummary = recentResults.map(result => 
      `- ${result.stepId}: ${result.output.substring(0, 200)}...`
    ).join('\n');
    
    return context + '\n\nRecent progress:\n' + resultSummary;
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(task: MultiStepTask, results: Map<string, any>, duration: number) {
    const avgStepDuration = duration / task.steps.length;
    const sequentialDuration = task.steps.reduce((sum, step) => sum + (step.estimatedDuration || 5000), 0);
    const parallelEfficiency = Math.max(0, (sequentialDuration - duration) / sequentialDuration);
    const contextPreservation = results.size / task.steps.length; // Simple metric

    return {
      avgStepDuration,
      parallelEfficiency: parallelEfficiency * 100, // Percentage
      contextPreservation: contextPreservation * 100 // Percentage
    };
  }

  /**
   * Fallback task creation for when JSON parsing fails
   */
  private createFallbackTask(prompt: string): MultiStepTask {
    return {
      id: `fallback_${Date.now()}`,
      description: 'Fallback multi-step task',
      priority: 'medium',
      steps: [
        {
          id: 'step_1',
          name: 'Analyze Request',
          description: 'Understand the requirements',
          inputs: ['original prompt'],
          outputs: ['analysis'],
          estimatedDuration: 5000,
          status: 'pending'
        },
        {
          id: 'step_2',
          name: 'Plan Solution',
          description: 'Create implementation plan',
          inputs: ['analysis'],
          outputs: ['plan'],
          estimatedDuration: 3000,
          dependencies: ['step_1'],
          status: 'pending'
        },
        {
          id: 'step_3',
          name: 'Execute Solution',
          description: 'Implement the planned solution',
          inputs: ['plan'],
          outputs: ['result'],
          estimatedDuration: 7000,
          dependencies: ['step_2'],
          status: 'pending'
        }
      ],
      context: prompt
    };
  }

  /**
   * Get active execution status
   */
  getExecutionStatus(taskId: string): ExecutionPlan | undefined {
    return this.activeExecutions.get(taskId);
  }

  /**
   * Cancel an active execution
   */
  cancelExecution(taskId: string): boolean {
    return this.activeExecutions.delete(taskId);
  }
}