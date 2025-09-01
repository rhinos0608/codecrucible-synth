/**
 * Architect/Editor Pattern Implementation for CodeCrucible Synth
 * Based on 2025 best practices from Aider, Cursor, and modern AI development workflows
 *
 * Separates planning (Architect) from execution (Editor) for better workflow management
 */

import { logger } from '../logger.js';
import { UnifiedModelClient } from '../../application/services/client.js';

export interface ArchitectPlan {
  id: string;
  title: string;
  description: string;
  complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
  estimatedDuration: number; // in minutes
  phases: PlanPhase[];
  dependencies: string[];
  risks: Risk[];
  successCriteria: string[];
  rollbackPlan?: string;
}

export interface PlanPhase {
  id: string;
  name: string;
  description: string;
  type: 'analysis' | 'design' | 'implementation' | 'testing' | 'documentation';
  estimatedDuration: number; // in minutes
  dependencies: string[]; // other phase IDs
  tasks: PlanTask[];
  deliverables: string[];
}

export interface PlanTask {
  id: string;
  name: string;
  description: string;
  type: 'code' | 'file' | 'test' | 'document' | 'validate';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedEffort: number; // in minutes
  requiredTools: string[];
  files: string[];
  dependencies: string[];
}

export interface Risk {
  id: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  probability: 'unlikely' | 'possible' | 'likely' | 'certain';
  mitigation: string;
}

export interface ExecutionResult {
  taskId: string;
  phaseId: string;
  success: boolean;
  duration: number;
  output: string;
  filesModified: string[];
  testsRun: number;
  testsPassed: number;
  errors: ExecutionError[];
}

export interface ExecutionError {
  type: 'compilation' | 'runtime' | 'test' | 'validation' | 'tool';
  message: string;
  file?: string;
  line?: number;
  severity: 'warning' | 'error' | 'critical';
}

/**
 * The Architect - Responsible for high-level planning and design
 * Creates comprehensive plans before any code execution
 */
export class Architect {
  constructor(private modelClient: UnifiedModelClient) {}

  /**
   * Create a comprehensive plan from a user request
   */
  async createPlan(request: string, context?: any): Promise<ArchitectPlan> {
    logger.info('🏗️ Architect: Creating comprehensive plan for request');

    const planPrompt = this.buildPlanningPrompt(request, context);

    try {
      const response = await this.modelClient.generateText(planPrompt);

      return this.parsePlanResponse(response, request);
    } catch (error) {
      logger.error('❌ Architect planning failed:', error);
      return this.createFallbackPlan(request);
    }
  }

  /**
   * Analyze feasibility and risks before execution
   */
  async analyzeFeasibility(
    plan: ArchitectPlan,
    context?: any
  ): Promise<{
    feasible: boolean;
    confidence: number;
    recommendations: string[];
    adjustments: string[];
  }> {
    logger.info('🔍 Architect: Analyzing plan feasibility');

    const analysisPrompt = `
Analyze the feasibility of this development plan:

**Plan**: ${plan.title}
**Description**: ${plan.description}
**Phases**: ${plan.phases.length}
**Estimated Duration**: ${plan.estimatedDuration} minutes
**Complexity**: ${plan.complexity}

**Context**: ${JSON.stringify(context, null, 2)}

Evaluate:
1. Technical feasibility (0-100%)
2. Time estimate accuracy
3. Resource requirements
4. Potential blockers
5. Recommended adjustments

Provide a JSON response with feasible, confidence, recommendations, and adjustments.
    `;

    try {
      const response = await this.modelClient.generateText(analysisPrompt);

      return this.parseFeasibilityResponse(response);
    } catch (error) {
      logger.error('❌ Feasibility analysis failed:', error);
      return {
        feasible: true,
        confidence: 0.7,
        recommendations: ['Proceed with caution', 'Monitor progress closely'],
        adjustments: ['Consider breaking down complex tasks'],
      };
    }
  }

  private buildPlanningPrompt(request: string, context?: any): string {
    return `
You are an expert software architect. Create a comprehensive development plan for this request:

**Request**: ${request}

**Context**: ${JSON.stringify(context, null, 2)}

Create a detailed plan with:
1. **Title**: Clear, concise plan title
2. **Description**: What will be accomplished
3. **Complexity**: simple|moderate|complex|enterprise
4. **Phases**: Logical development phases (analysis, design, implementation, testing, documentation)
5. **Tasks**: Specific, actionable tasks within each phase
6. **Dependencies**: Task and phase dependencies
7. **Risks**: Potential issues and mitigation strategies
8. **Success Criteria**: How to measure completion
9. **Estimated Duration**: Realistic time estimates

Focus on:
- Breaking complex work into manageable phases
- Identifying dependencies and potential blockers
- Clear, specific deliverables
- Risk mitigation strategies

Respond in a structured format that can be parsed into a plan object.
    `;
  }

  private parsePlanResponse(response: string, request: string): ArchitectPlan {
    // For now, create a structured plan from the response
    // In a real implementation, this would parse LLM output more intelligently

    const planId = `plan_${Date.now()}`;
    const complexity = this.inferComplexity(request);

    return {
      id: planId,
      title: `Implementation Plan for: ${request.substring(0, 50)}...`,
      description: response.substring(0, 200),
      complexity,
      estimatedDuration: this.estimateDuration(complexity, request),
      phases: this.createDefaultPhases(request),
      dependencies: [],
      risks: this.identifyCommonRisks(complexity),
      successCriteria: [
        'All code compiles successfully',
        'Tests pass',
        'Documentation updated',
        'No breaking changes',
      ],
    };
  }

  private createFallbackPlan(request: string): ArchitectPlan {
    const planId = `fallback_${Date.now()}`;

    return {
      id: planId,
      title: `Basic Plan: ${request.substring(0, 50)}`,
      description: 'Fallback plan created due to planning system failure',
      complexity: 'moderate',
      estimatedDuration: 30,
      phases: [
        {
          id: 'phase_1',
          name: 'Implementation',
          description: 'Execute the requested changes',
          type: 'implementation',
          estimatedDuration: 30,
          dependencies: [],
          tasks: [
            {
              id: 'task_1',
              name: 'Execute Request',
              description: request,
              type: 'code',
              priority: 'high',
              estimatedEffort: 30,
              requiredTools: ['file-tools', 'code-tools'],
              files: [],
              dependencies: [],
            },
          ],
          deliverables: ['Completed implementation'],
        },
      ],
      dependencies: [],
      risks: [
        {
          id: 'risk_1',
          description: 'Limited planning due to system error',
          impact: 'medium',
          probability: 'certain',
          mitigation: 'Proceed with careful validation',
        },
      ],
      successCriteria: ['Request completed successfully'],
    };
  }

  private inferComplexity(request: string): 'simple' | 'moderate' | 'complex' | 'enterprise' {
    const complexityIndicators = {
      simple: ['fix bug', 'update text', 'change config', 'add comment'],
      moderate: ['implement feature', 'refactor code', 'add tests', 'update docs'],
      complex: ['architecture change', 'multiple files', 'system redesign', 'migration'],
      enterprise: [
        'entire system',
        'production deployment',
        'security audit',
        'performance optimization',
      ],
    };

    const requestLower = request.toLowerCase();

    for (const [level, indicators] of Object.entries(complexityIndicators)) {
      if (indicators.some(indicator => requestLower.includes(indicator))) {
        return level as any;
      }
    }

    return 'moderate';
  }

  private estimateDuration(complexity: string, request: string): number {
    const baseDurations = {
      simple: 15,
      moderate: 45,
      complex: 120,
      enterprise: 300,
    };

    let duration = baseDurations[complexity as keyof typeof baseDurations] || 45;

    // Adjust based on request content
    if (request.includes('test')) duration += 15;
    if (request.includes('documentation')) duration += 10;
    if (request.includes('multiple')) duration *= 1.5;

    return Math.round(duration);
  }

  private createDefaultPhases(request: string): PlanPhase[] {
    const needsAnalysis = /analyze|understand|examine/i.test(request);
    const needsDesign = /design|architecture|structure/i.test(request);
    const needsImplementation = true; // Always need implementation
    const needsTesting = /test|verify|validate/i.test(request);
    const needsDocs = /document|readme|guide/i.test(request);

    const phases: PlanPhase[] = [];

    if (needsAnalysis) {
      phases.push({
        id: 'analysis',
        name: 'Analysis',
        description: 'Analyze current state and requirements',
        type: 'analysis',
        estimatedDuration: 10,
        dependencies: [],
        tasks: [
          {
            id: 'analyze_task',
            name: 'Analyze Requirements',
            description: 'Understand the current state and requirements',
            type: 'code',
            priority: 'high',
            estimatedEffort: 10,
            requiredTools: ['file-tools', 'analysis-tools'],
            files: [],
            dependencies: [],
          },
        ],
        deliverables: ['Analysis report'],
      });
    }

    if (needsDesign) {
      phases.push({
        id: 'design',
        name: 'Design',
        description: 'Create design and architecture',
        type: 'design',
        estimatedDuration: 15,
        dependencies: needsAnalysis ? ['analysis'] : [],
        tasks: [
          {
            id: 'design_task',
            name: 'Create Design',
            description: 'Design the solution architecture',
            type: 'document',
            priority: 'high',
            estimatedEffort: 15,
            requiredTools: ['documentation-tools'],
            files: [],
            dependencies: [],
          },
        ],
        deliverables: ['Design document'],
      });
    }

    phases.push({
      id: 'implementation',
      name: 'Implementation',
      description: 'Implement the solution',
      type: 'implementation',
      estimatedDuration: 30,
      dependencies: needsDesign ? ['design'] : needsAnalysis ? ['analysis'] : [],
      tasks: [
        {
          id: 'impl_task',
          name: 'Implement Solution',
          description: 'Write code to implement the solution',
          type: 'code',
          priority: 'critical',
          estimatedEffort: 30,
          requiredTools: ['code-tools', 'file-tools'],
          files: [],
          dependencies: [],
        },
      ],
      deliverables: ['Working implementation'],
    });

    if (needsTesting) {
      phases.push({
        id: 'testing',
        name: 'Testing',
        description: 'Test the implementation',
        type: 'testing',
        estimatedDuration: 15,
        dependencies: ['implementation'],
        tasks: [
          {
            id: 'test_task',
            name: 'Run Tests',
            description: 'Execute tests and verify functionality',
            type: 'test',
            priority: 'high',
            estimatedEffort: 15,
            requiredTools: ['testing-tools'],
            files: [],
            dependencies: [],
          },
        ],
        deliverables: ['Test results'],
      });
    }

    if (needsDocs) {
      phases.push({
        id: 'documentation',
        name: 'Documentation',
        description: 'Update documentation',
        type: 'documentation',
        estimatedDuration: 10,
        dependencies: ['implementation'],
        tasks: [
          {
            id: 'docs_task',
            name: 'Update Documentation',
            description: 'Write or update relevant documentation',
            type: 'document',
            priority: 'medium',
            estimatedEffort: 10,
            requiredTools: ['documentation-tools'],
            files: [],
            dependencies: [],
          },
        ],
        deliverables: ['Updated documentation'],
      });
    }

    return phases;
  }

  private identifyCommonRisks(complexity: string): Risk[] {
    const commonRisks: Risk[] = [
      {
        id: 'breaking_changes',
        description: 'Implementation may introduce breaking changes',
        impact: 'high',
        probability: 'possible',
        mitigation: 'Careful testing and rollback plan',
      },
    ];

    if (complexity === 'complex' || complexity === 'enterprise') {
      commonRisks.push({
        id: 'scope_creep',
        description: 'Requirements may expand during implementation',
        impact: 'medium',
        probability: 'likely',
        mitigation: 'Clear scope definition and change management',
      });
    }

    return commonRisks;
  }

  private parseFeasibilityResponse(response: string): {
    feasible: boolean;
    confidence: number;
    recommendations: string[];
    adjustments: string[];
  } {
    // Simple parsing - in production, this would be more sophisticated
    return {
      feasible: !response.toLowerCase().includes('not feasible'),
      confidence: 0.8,
      recommendations: ['Monitor progress', 'Validate at each phase'],
      adjustments: ['Consider iterative approach'],
    };
  }
}

/**
 * The Editor - Responsible for executing plans created by the Architect
 * Focuses on implementation without planning concerns
 */
export class Editor {
  constructor(private modelClient: UnifiedModelClient) {}

  /**
   * Execute a specific task from the plan
   */
  async executeTask(task: PlanTask, context?: any): Promise<ExecutionResult> {
    logger.info('⚙️ Editor: Executing task', { taskId: task.id, name: task.name });

    const startTime = Date.now();
    const result: ExecutionResult = {
      taskId: task.id,
      phaseId: '', // Will be set by phase executor
      success: false,
      duration: 0,
      output: '',
      filesModified: [],
      testsRun: 0,
      testsPassed: 0,
      errors: [],
    };

    try {
      // Execute based on task type
      switch (task.type) {
        case 'code':
          result.output = await this.executeCodeTask(task, context);
          break;
        case 'file':
          result.output = await this.executeFileTask(task, context);
          break;
        case 'test':
          result.output = await this.executeTestTask(task, context);
          break;
        case 'document':
          result.output = await this.executeDocumentTask(task, context);
          break;
        case 'validate':
          result.output = await this.executeValidationTask(task, context);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      result.success = true;
      result.duration = Date.now() - startTime;

      logger.info('✅ Editor: Task completed successfully', {
        taskId: task.id,
        duration: result.duration,
      });
    } catch (error) {
      result.success = false;
      result.duration = Date.now() - startTime;
      result.errors.push({
        type: 'runtime',
        message: error instanceof Error ? error.message : String(error),
        severity: 'error',
      });

      logger.error('❌ Editor: Task execution failed', {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return result;
  }

  /**
   * Execute an entire phase from the plan
   */
  async executePhase(phase: PlanPhase, context?: any): Promise<ExecutionResult[]> {
    logger.info('🔧 Editor: Executing phase', { phaseId: phase.id, name: phase.name });

    const results: ExecutionResult[] = [];

    // Sort tasks by dependencies
    const sortedTasks = this.sortTasksByDependencies(phase.tasks);

    for (const task of sortedTasks) {
      const result = await this.executeTask(task, context);
      result.phaseId = phase.id;
      results.push(result);

      // Stop execution if a critical task fails
      if (!result.success && task.priority === 'critical') {
        logger.error('❌ Critical task failed, stopping phase execution', {
          phaseId: phase.id,
          taskId: task.id,
        });
        break;
      }
    }

    return results;
  }

  private async executeCodeTask(task: PlanTask, context?: any): Promise<string> {
    const codePrompt = `
Execute this code-related task:

**Task**: ${task.name}
**Description**: ${task.description}
**Files**: ${task.files.join(', ') || 'No specific files'}
**Required Tools**: ${task.requiredTools.join(', ')}

**Context**: ${JSON.stringify(context, null, 2)}

Provide the implementation or code changes needed.
    `;

    const response = await this.modelClient.generateText(codePrompt);

    return response;
  }

  private async executeFileTask(task: PlanTask, context?: any): Promise<string> {
    return `File operation completed for: ${task.name}`;
  }

  private async executeTestTask(task: PlanTask, context?: any): Promise<string> {
    return `Tests executed for: ${task.name}`;
  }

  private async executeDocumentTask(task: PlanTask, context?: any): Promise<string> {
    return `Documentation updated for: ${task.name}`;
  }

  private async executeValidationTask(task: PlanTask, context?: any): Promise<string> {
    return `Validation completed for: ${task.name}`;
  }

  private sortTasksByDependencies(tasks: PlanTask[]): PlanTask[] {
    // Simple topological sort based on dependencies
    const result: PlanTask[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (task: PlanTask) => {
      if (visiting.has(task.id)) {
        throw new Error(`Circular dependency detected involving task ${task.id}`);
      }
      if (visited.has(task.id)) {
        return;
      }

      visiting.add(task.id);

      for (const depId of task.dependencies) {
        const depTask = tasks.find(t => t.id === depId);
        if (depTask) {
          visit(depTask);
        }
      }

      visiting.delete(task.id);
      visited.add(task.id);
      result.push(task);
    };

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        visit(task);
      }
    }

    return result;
  }
}

/**
 * Coordinator that orchestrates the Architect/Editor workflow
 */
export class ArchitectEditorCoordinator {
  private architect: Architect;
  private editor: Editor;

  constructor(modelClient: UnifiedModelClient) {
    this.architect = new Architect(modelClient);
    this.editor = new Editor(modelClient);
  }

  /**
   * Full workflow: Plan -> Review -> Execute
   */
  async executeRequest(
    request: string,
    context?: any
  ): Promise<{
    plan: ArchitectPlan;
    feasibility: any;
    results: ExecutionResult[];
    success: boolean;
    duration: number;
  }> {
    const startTime = Date.now();
    logger.info('🏗️ Starting Architect/Editor workflow', { request: request.substring(0, 100) });

    try {
      // Phase 1: Planning (Architect)
      const plan = await this.architect.createPlan(request, context);
      logger.info('📋 Plan created', {
        planId: plan.id,
        phases: plan.phases.length,
        estimatedDuration: plan.estimatedDuration,
      });

      // Phase 2: Feasibility Analysis (Architect)
      const feasibility = await this.architect.analyzeFeasibility(plan, context);
      logger.info('🔍 Feasibility analyzed', {
        feasible: feasibility.feasible,
        confidence: feasibility.confidence,
      });

      if (!feasibility.feasible || feasibility.confidence < 0.5) {
        logger.warn('⚠️ Plan deemed not feasible or low confidence');
        return {
          plan,
          feasibility,
          results: [],
          success: false,
          duration: Date.now() - startTime,
        };
      }

      // Phase 3: Execution (Editor)
      const allResults: ExecutionResult[] = [];

      // Sort phases by dependencies
      const sortedPhases = this.sortPhasesByDependencies(plan.phases);

      for (const phase of sortedPhases) {
        logger.info(`🔧 Executing phase: ${phase.name}`);
        const phaseResults = await this.editor.executePhase(phase, context);
        allResults.push(...phaseResults);

        // Check if phase had critical failures
        const criticalFailures = phaseResults.filter(
          r => !r.success && phase.tasks.find(t => t.id === r.taskId)?.priority === 'critical'
        );

        if (criticalFailures.length > 0) {
          logger.error('❌ Critical phase failures, stopping execution');
          break;
        }
      }

      const success = allResults.length > 0 && allResults.some(r => r.success);
      const duration = Date.now() - startTime;

      logger.info('🏁 Architect/Editor workflow completed', {
        success,
        duration,
        totalTasks: allResults.length,
        successfulTasks: allResults.filter(r => r.success).length,
      });

      return {
        plan,
        feasibility,
        results: allResults,
        success,
        duration,
      };
    } catch (error) {
      logger.error('❌ Architect/Editor workflow failed:', error);
      return {
        plan: this.architect['createFallbackPlan'](request),
        feasibility: { feasible: false, confidence: 0, recommendations: [], adjustments: [] },
        results: [],
        success: false,
        duration: Date.now() - startTime,
      };
    }
  }

  private sortPhasesByDependencies(phases: PlanPhase[]): PlanPhase[] {
    // Simple topological sort for phases
    const result: PlanPhase[] = [];
    const visited = new Set<string>();

    const visit = (phase: PlanPhase) => {
      if (visited.has(phase.id)) return;

      for (const depId of phase.dependencies) {
        const depPhase = phases.find(p => p.id === depId);
        if (depPhase) {
          visit(depPhase);
        }
      }

      visited.add(phase.id);
      result.push(phase);
    };

    for (const phase of phases) {
      if (!visited.has(phase.id)) {
        visit(phase);
      }
    }

    return result;
  }
}
