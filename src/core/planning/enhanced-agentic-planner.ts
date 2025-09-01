/**
 * Enhanced Agentic Planner
 * Provides intelligent task planning and decomposition
 */

export interface Task {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
  estimatedDuration?: number;
  createdAt: number;
  updatedAt: number;
  metadata?: {
    tags: string[];
    category: string;
    complexity: 'simple' | 'moderate' | 'complex';
    requiredResources?: string[];
  };
}

export interface PlanningContext {
  objective: string;
  constraints: string[];
  availableResources: string[];
  timeframe?: {
    start: number;
    end: number;
  };
  preferences?: {
    parallelism: boolean;
    riskTolerance: 'low' | 'medium' | 'high';
  };
}

export interface ExecutionPlan {
  tasks: Task[];
  executionOrder: string[];
  parallelGroups: string[][];
  criticalPath: string[];
  estimatedTotalTime: number;
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    mitigations: string[];
  };
}

export class EnhancedAgenticPlanner {
  private taskQueue: Map<string, Task> = new Map();
  private completedTasks: Set<string> = new Set();
  private failedTasks: Map<string, string> = new Map(); // taskId -> failure reason

  constructor() {
    // Initialize planner
  }

  /**
   * Create a comprehensive execution plan from a high-level objective
   */
  async createPlan(context: PlanningContext): Promise<ExecutionPlan> {
    const tasks = await this.decomposeObjective(context.objective);
    const dependencies = this.analyzeDependencies(tasks);
    const executionOrder = this.calculateExecutionOrder(tasks, dependencies);
    const parallelGroups = this.identifyParallelGroups(tasks, dependencies);
    const criticalPath = this.findCriticalPath(tasks, dependencies);

    const estimatedTotalTime = this.estimateTotalTime(tasks, executionOrder);
    const riskAssessment = this.assessRisks(tasks, context);

    return {
      tasks,
      executionOrder,
      parallelGroups,
      criticalPath,
      estimatedTotalTime,
      riskAssessment,
    };
  }

  /**
   * Decompose a high-level objective into actionable tasks
   */
  private async decomposeObjective(objective: string): Promise<Task[]> {
    // Simple decomposition logic - in practice this could use AI/ML
    const keywords = objective.toLowerCase().split(' ');
    const tasks: Task[] = [];

    // Generate basic tasks based on common patterns
    if (keywords.includes('analyze') || keywords.includes('review')) {
      tasks.push(this.createTask('Gather and review requirements', 'high'));
      tasks.push(this.createTask('Analyze current state', 'high'));
    }

    if (
      keywords.includes('implement') ||
      keywords.includes('build') ||
      keywords.includes('create')
    ) {
      tasks.push(this.createTask('Design solution architecture', 'high'));
      tasks.push(this.createTask('Implement core functionality', 'high'));
      tasks.push(this.createTask('Add error handling and validation', 'medium'));
    }

    if (keywords.includes('test') || keywords.includes('verify')) {
      tasks.push(this.createTask('Create test cases', 'medium'));
      tasks.push(this.createTask('Execute testing', 'high'));
    }

    // Always add planning and review tasks
    tasks.unshift(this.createTask('Plan execution approach', 'high'));
    tasks.push(this.createTask('Review and validate results', 'medium'));

    return tasks;
  }

  private createTask(description: string, priority: Task['priority']): Task {
    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      id,
      description,
      priority,
      status: 'pending',
      dependencies: [],
      estimatedDuration: this.estimateTaskDuration(description),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        tags: this.extractTags(description),
        category: this.categorizeTask(description),
        complexity: this.assessComplexity(description),
      },
    };
  }

  private analyzeDependencies(tasks: Task[]): Map<string, string[]> {
    const dependencies = new Map<string, string[]>();

    // Basic dependency analysis based on task types
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const deps: string[] = [];

      // Tasks typically depend on previous tasks in sequence
      if (i > 0) {
        deps.push(tasks[i - 1].id);
      }

      // Special dependency rules
      if (task.description.includes('test') || task.description.includes('verify')) {
        // Testing depends on implementation tasks
        const implTasks = tasks.filter(
          t => t.description.includes('implement') || t.description.includes('build')
        );
        deps.push(...implTasks.map(t => t.id));
      }

      dependencies.set(task.id, deps);
    }

    return dependencies;
  }

  private calculateExecutionOrder(tasks: Task[], dependencies: Map<string, string[]>): string[] {
    // Simple topological sort
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const deps = dependencies.get(taskId) || [];
      deps.forEach(depId => visit(depId));

      order.push(taskId);
    };

    tasks.forEach(task => visit(task.id));
    return order;
  }

  private identifyParallelGroups(tasks: Task[], dependencies: Map<string, string[]>): string[][] {
    // Simple parallel group identification
    const groups: string[][] = [];
    const processed = new Set<string>();

    for (const task of tasks) {
      if (processed.has(task.id)) continue;

      const group = [task.id];
      const deps = dependencies.get(task.id) || [];

      // Find other tasks with the same dependencies that can run in parallel
      for (const otherTask of tasks) {
        if (otherTask.id === task.id || processed.has(otherTask.id)) continue;

        const otherDeps = dependencies.get(otherTask.id) || [];
        if (this.arraysEqual(deps, otherDeps)) {
          group.push(otherTask.id);
        }
      }

      group.forEach(id => processed.add(id));
      if (group.length > 0) {
        groups.push(group);
      }
    }

    return groups;
  }

  private findCriticalPath(tasks: Task[], dependencies: Map<string, string[]>): string[] {
    // Find the longest path through the dependency graph
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const memo = new Map<string, number>();

    const getLongestPath = (taskId: string): number => {
      if (memo.has(taskId)) return memo.get(taskId)!;

      const task = taskMap.get(taskId);
      if (!task) return 0;

      const deps = dependencies.get(taskId) || [];
      const maxDepTime = Math.max(0, ...deps.map(depId => getLongestPath(depId)));
      const totalTime = maxDepTime + (task.estimatedDuration || 0);

      memo.set(taskId, totalTime);
      return totalTime;
    };

    // Find the task with the longest path
    let maxTime = 0;
    let criticalTaskId = '';

    for (const task of tasks) {
      const time = getLongestPath(task.id);
      if (time > maxTime) {
        maxTime = time;
        criticalTaskId = task.id;
      }
    }

    // Reconstruct the critical path
    const path: string[] = [];
    let currentId = criticalTaskId;

    while (currentId) {
      path.unshift(currentId);
      const deps = dependencies.get(currentId) || [];
      currentId = deps.length > 0 ? deps[0] : ''; // Simplified - take first dependency
    }

    return path;
  }

  private estimateTotalTime(tasks: Task[], executionOrder: string[]): number {
    return tasks.reduce((total, task) => total + (task.estimatedDuration || 0), 0);
  }

  private assessRisks(tasks: Task[], context: PlanningContext): ExecutionPlan['riskAssessment'] {
    const factors: string[] = [];
    let level: 'low' | 'medium' | 'high' = 'low';

    // Check for complex tasks
    const complexTasks = tasks.filter(t => t.metadata?.complexity === 'complex');
    if (complexTasks.length > 0) {
      factors.push(`${complexTasks.length} complex tasks identified`);
      level = 'medium';
    }

    // Check for tight timeframes
    if (context.timeframe) {
      const availableTime = context.timeframe.end - context.timeframe.start;
      const estimatedTime = this.estimateTotalTime(tasks, []);
      if (estimatedTime > availableTime * 0.8) {
        factors.push('Tight timeline may cause delays');
        level = 'high';
      }
    }

    // Check for missing resources
    if (context.availableResources.length < 3) {
      factors.push('Limited resources available');
      if (level === 'low') level = 'medium';
    }

    const mitigations = [
      'Monitor progress regularly',
      'Identify blockers early',
      'Have contingency plans ready',
    ];

    return { level, factors, mitigations };
  }

  // Helper methods
  private estimateTaskDuration(description: string): number {
    // Simple duration estimation based on keywords
    const complexityWords = ['implement', 'build', 'create', 'develop'];
    const simpleWords = ['review', 'analyze', 'check', 'verify'];

    if (complexityWords.some(word => description.toLowerCase().includes(word))) {
      return 60 * 60 * 1000; // 1 hour
    }
    if (simpleWords.some(word => description.toLowerCase().includes(word))) {
      return 30 * 60 * 1000; // 30 minutes
    }
    return 45 * 60 * 1000; // 45 minutes default
  }

  private extractTags(description: string): string[] {
    const words = description.toLowerCase().split(/\s+/);
    return words.filter(word => word.length > 3).slice(0, 3);
  }

  private categorizeTask(description: string): string {
    if (description.includes('test') || description.includes('verify')) return 'testing';
    if (description.includes('implement') || description.includes('build')) return 'development';
    if (description.includes('analyze') || description.includes('review')) return 'analysis';
    if (description.includes('plan') || description.includes('design')) return 'planning';
    return 'general';
  }

  private assessComplexity(description: string): 'simple' | 'moderate' | 'complex' {
    const complexWords = ['architecture', 'algorithm', 'integration', 'system'];
    const simpleWords = ['review', 'check', 'list', 'copy'];

    if (complexWords.some(word => description.toLowerCase().includes(word))) return 'complex';
    if (simpleWords.some(word => description.toLowerCase().includes(word))) return 'simple';
    return 'moderate';
  }

  private arraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((val, index) => val === b[index]);
  }
}
