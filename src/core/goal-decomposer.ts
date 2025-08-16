import { LocalModelClient } from './local-model-client.js';
import { logger } from './logger.js';
import { Task, WorkflowContext } from './agent-orchestrator.js';
import { Intent } from './intent-classifier.js';

export interface DecompositionStrategy {
  name: string;
  description: string;
  applicableCategories: string[];
  maxTasks: number;
  minTaskComplexity: number;
}

/**
 * Advanced Goal Decomposition Engine
 * 
 * Breaks down complex user goals into actionable, atomic tasks.
 * Uses intelligent strategies based on:
 * - Intent category and complexity
 * - Project context and state
 * - Past successful decompositions
 * - Dynamic dependency analysis
 */
export class GoalDecomposer {
  private model: LocalModelClient;
  private strategies: DecompositionStrategy[] = [];
  private taskIdCounter = 0;

  constructor(model: LocalModelClient) {
    this.model = model;
    this.initializeStrategies();
  }

  /**
   * Initialize decomposition strategies for different types of goals
   */
  private initializeStrategies(): void {
    this.strategies = [
      {
        name: 'sequential_analysis',
        description: 'Step-by-step analysis workflow',
        applicableCategories: ['code_analysis'],
        maxTasks: 6,
        minTaskComplexity: 1
      },
      {
        name: 'exploration_first',
        description: 'Explore structure before detailed analysis',
        applicableCategories: ['file_operations', 'project_management'],
        maxTasks: 4,
        minTaskComplexity: 1
      },
      {
        name: 'research_and_apply',
        description: 'Research solutions then apply',
        applicableCategories: ['problem_solving', 'code_generation'],
        maxTasks: 5,
        minTaskComplexity: 2
      },
      {
        name: 'iterative_improvement',
        description: 'Iterative refinement approach',
        applicableCategories: ['refactoring', 'performance'],
        maxTasks: 7,
        minTaskComplexity: 2
      },
      {
        name: 'comprehensive_review',
        description: 'Thorough multi-perspective review',
        applicableCategories: ['architecture_design', 'testing'],
        maxTasks: 8,
        minTaskComplexity: 3
      }
    ];

    logger.info(`🎯 Initialized ${this.strategies.length} decomposition strategies`);
  }

  /**
   * Decompose a goal into actionable tasks
   */
  async decompose(
    userGoal: string,
    intent: Intent,
    context: WorkflowContext
  ): Promise<Task[]> {
    try {
      // Select optimal decomposition strategy
      const strategy = this.selectStrategy(intent, context);
      logger.info(`📋 Using decomposition strategy: ${strategy.name}`);

      // Generate tasks using selected strategy
      const tasks = await this.generateTasks(userGoal, intent, context, strategy);

      // Validate and optimize task sequence
      const optimizedTasks = this.optimizeTaskSequence(tasks, intent);

      // Add dependencies based on logical flow (temporarily disabled for debugging)
      // this.addTaskDependencies(optimizedTasks, strategy);
      
      // Ensure all tasks have empty dependencies for now
      optimizedTasks.forEach(task => task.dependencies = []);

      logger.info(`✅ Decomposed goal into ${optimizedTasks.length} tasks`);
      return optimizedTasks;

    } catch (error) {
      logger.error('Goal decomposition failed:', error);
      
      // Fallback to simple decomposition
      return this.createFallbackTasks(userGoal, intent);
    }
  }

  /**
   * Select optimal decomposition strategy
   */
  private selectStrategy(intent: Intent, context: WorkflowContext): DecompositionStrategy {
    // Find strategies applicable to this intent category
    const applicableStrategies = this.strategies.filter(strategy =>
      strategy.applicableCategories.includes(intent.category)
    );

    if (applicableStrategies.length === 0) {
      // Use default strategy for unknown categories
      return this.strategies[0];
    }

    // Select based on complexity and context
    if (intent.complexity === 'complex' || context.goals.length > 1) {
      // Use more comprehensive strategies for complex goals
      return applicableStrategies.find(s => s.maxTasks >= 6) || applicableStrategies[0];
    } else if (intent.complexity === 'simple') {
      // Use simpler strategies for simple goals
      return applicableStrategies.find(s => s.maxTasks <= 4) || applicableStrategies[0];
    }

    // Default to first applicable strategy
    return applicableStrategies[0];
  }

  /**
   * Generate tasks using the selected strategy
   */
  private async generateTasks(
    userGoal: string,
    intent: Intent,
    context: WorkflowContext,
    strategy: DecompositionStrategy
  ): Promise<Task[]> {
    const decompositionPrompt = `Decompose the following user goal into specific, actionable tasks using the "${strategy.name}" strategy.

USER GOAL: "${userGoal}"

INTENT ANALYSIS:
- Category: ${intent.category}
- Subcategory: ${intent.subcategory || 'N/A'}
- Complexity: ${intent.complexity}
- Scope: ${intent.scope}
- Estimated Duration: ${intent.estimatedDuration}s

STRATEGY: ${strategy.description}
- Maximum Tasks: ${strategy.maxTasks}
- Minimum Task Complexity: ${strategy.minTaskComplexity}

PROJECT CONTEXT:
${context.projectType ? `- Project Type: ${context.projectType}` : ''}
${context.completedTasks.length > 0 ? `- Previous Tasks: ${context.completedTasks.length} completed` : ''}
${context.failedTasks.length > 0 ? `- Failed Tasks: ${context.failedTasks.length}` : ''}

TASK DECOMPOSITION GUIDELINES:
1. Each task should be atomic and actionable
2. Tasks should build upon each other logically
3. Include both exploration and execution tasks
4. Consider error handling and validation
5. Ensure tasks match the required capabilities: ${intent.requiredCapabilities.join(', ')}

RESPOND WITH A JSON ARRAY OF TASKS:
[
  {
    "description": "Specific, actionable task description",
    "priority": "low|medium|high|critical",
    "estimatedComplexity": 1-10,
    "capabilities": ["required", "capabilities"],
    "category": "task_category"
  }
]

Example for code analysis:
[
  {
    "description": "Explore project structure to understand codebase organization",
    "priority": "high",
    "estimatedComplexity": 2,
    "capabilities": ["file_listing", "directory_exploration"],
    "category": "exploration"
  },
  {
    "description": "Read key configuration files (package.json, tsconfig.json)",
    "priority": "high", 
    "estimatedComplexity": 3,
    "capabilities": ["file_reading"],
    "category": "configuration_analysis"
  }
]`;

    const response = await this.model.generate(decompositionPrompt);
    return this.parseTasksFromResponse(response, userGoal, intent, strategy);
  }

  /**
   * Parse tasks from LLM response
   */
  private parseTasksFromResponse(
    response: string,
    userGoal: string,
    intent: Intent,
    strategy: DecompositionStrategy
  ): Task[] {
    try {
      // Extract JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const taskData = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(taskData)) {
        throw new Error('Response is not an array');
      }

      // Convert to Task objects
      const tasks: Task[] = taskData.map((data, index) => {
        return this.createTask(
          data.description || `Task ${index + 1} from goal: ${userGoal}`,
          data.priority || 'medium',
          [],
          data.estimatedComplexity || 3,
          {
            capabilities: data.capabilities || intent.requiredCapabilities,
            category: data.category || intent.category,
            strategy: strategy.name,
            originalGoal: userGoal
          }
        );
      });

      // Limit tasks based on strategy
      return tasks.slice(0, strategy.maxTasks);

    } catch (error) {
      logger.warn('Failed to parse tasks from LLM response:', error);
      
      // Fallback to rule-based decomposition
      return this.createRuleBasedTasks(userGoal, intent, strategy);
    }
  }

  /**
   * Create rule-based tasks as fallback
   */
  private createRuleBasedTasks(
    userGoal: string,
    intent: Intent,
    strategy: DecompositionStrategy
  ): Task[] {
    const tasks: Task[] = [];
    
    // Create tasks based on intent category
    switch (intent.category) {
      case 'code_analysis':
        tasks.push(
          this.createTask('Explore project structure and identify key files', 'high', [], 2),
          this.createTask('Read and analyze main configuration files', 'high', [], 3),
          this.createTask('Perform code quality analysis on source files', 'medium', [], 4),
          this.createTask('Generate comprehensive analysis report', 'medium', [], 3)
        );
        break;

      case 'file_operations':
        if (intent.subcategory === 'explore_structure') {
          // Check for specific directory requests
          if (/src\s*(directory|dir|folder)/i.test(userGoal) || /files\s+in\s+src/i.test(userGoal)) {
            tasks.push(
              this.createTask('List files in src directory specifically', 'high', [], 1, { 
                targetPath: 'src',
                specificRequest: true 
              })
            );
          } else if (/what\s+files/i.test(userGoal) && userGoal.length < 50) {
            // Simple "what files" requests - start with root then explore
            tasks.push(
              this.createTask('List all files in the project root', 'high', [], 1),
              this.createTask('Explore key subdirectories like src/ and config/', 'medium', [], 2)
            );
          } else {
            // General structure exploration
            tasks.push(
              this.createTask('List files in root directory', 'high', [], 1),
              this.createTask('Explore source code directories', 'medium', [], 2),
              this.createTask('Examine configuration and documentation files', 'medium', [], 2)
            );
          }
        } else {
          tasks.push(
            this.createTask('Locate and read requested files', 'high', [], 2),
            this.createTask('Analyze file contents and structure', 'medium', [], 3)
          );
        }
        break;

      case 'problem_solving':
        tasks.push(
          this.createTask('Identify and understand the problem', 'critical', [], 3),
          this.createTask('Research potential solutions and approaches', 'high', [], 4),
          this.createTask('Analyze existing code for error patterns', 'high', [], 3),
          this.createTask('Develop and propose solution strategy', 'medium', [], 4)
        );
        break;

      case 'code_generation':
        tasks.push(
          this.createTask('Research best practices and patterns', 'high', [], 3),
          this.createTask('Design code structure and architecture', 'high', [], 4),
          this.createTask('Generate initial code implementation', 'medium', [], 5),
          this.createTask('Review and refine generated code', 'medium', [], 3)
        );
        break;

      default:
        // Generic task decomposition
        tasks.push(
          this.createTask('Understand and analyze the request', 'high', [], 2),
          this.createTask('Gather necessary information and context', 'medium', [], 3),
          this.createTask('Execute the main task', 'medium', [], 4),
          this.createTask('Validate and summarize results', 'low', [], 2)
        );
    }

    // Limit tasks based on strategy and complexity
    const maxTasks = intent.complexity === 'simple' ? 3 : 
                    intent.complexity === 'medium' ? 5 : strategy.maxTasks;
    
    return tasks.slice(0, maxTasks);
  }

  /**
   * Optimize task sequence for better execution flow
   */
  private optimizeTaskSequence(tasks: Task[], intent: Intent): Task[] {
    // Sort tasks by priority and logical flow
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    
    // First, group by logical categories
    const explorationTasks = tasks.filter(t => 
      t.description.toLowerCase().includes('explore') || 
      t.description.toLowerCase().includes('list') ||
      t.description.toLowerCase().includes('understand')
    );
    
    const analysisTasks = tasks.filter(t => 
      t.description.toLowerCase().includes('analyze') ||
      t.description.toLowerCase().includes('read') ||
      t.description.toLowerCase().includes('examine')
    );
    
    const executionTasks = tasks.filter(t => 
      !explorationTasks.includes(t) && !analysisTasks.includes(t)
    );

    // Sort each group by priority
    const sortByPriority = (a: Task, b: Task) => 
      priorityOrder[b.priority] - priorityOrder[a.priority];

    explorationTasks.sort(sortByPriority);
    analysisTasks.sort(sortByPriority);
    executionTasks.sort(sortByPriority);

    // Return optimized sequence: exploration → analysis → execution
    const optimized = [...explorationTasks, ...analysisTasks, ...executionTasks];

    // Ensure we don't exceed reasonable limits
    const maxTasks = intent.complexity === 'simple' ? 4 : 
                    intent.complexity === 'medium' ? 6 : 8;

    return optimized.slice(0, maxTasks);
  }

  /**
   * Add logical dependencies between tasks
   */
  private addTaskDependencies(tasks: Task[], strategy: DecompositionStrategy): void {
    if (tasks.length <= 1) return;

    // Clear any existing dependencies first
    tasks.forEach(task => task.dependencies = []);

    // Add dependencies based on logical flow
    for (let i = 1; i < tasks.length; i++) {
      const currentTask = tasks[i];
      const previousTask = tasks[i - 1];

      // Analysis tasks depend on exploration tasks
      if (this.isAnalysisTask(currentTask) && this.isExplorationTask(previousTask)) {
        currentTask.dependencies.push(previousTask.id);
      }
      
      // Execution tasks depend on analysis tasks
      else if (this.isExecutionTask(currentTask) && this.isAnalysisTask(previousTask)) {
        currentTask.dependencies.push(previousTask.id);
      }
      
      // For sequential strategies, each task depends on the previous one
      else if (strategy.name === 'sequential_analysis') {
        currentTask.dependencies.push(previousTask.id);
      }
      
      // Critical tasks should have minimal dependencies
      else if (currentTask.priority === 'critical') {
        // Only depend on other critical tasks
        const criticalPredecessors = tasks.slice(0, i).filter(t => t.priority === 'critical');
        if (criticalPredecessors.length > 0) {
          currentTask.dependencies.push(criticalPredecessors[criticalPredecessors.length - 1].id);
        }
      }
      
      // Default: high priority tasks may depend on previous high priority tasks
      else if (currentTask.priority === 'high' && previousTask.priority === 'high') {
        currentTask.dependencies.push(previousTask.id);
      }
    }

    logger.debug(`Added dependencies for ${tasks.length} tasks`);
  }

  /**
   * Check if task is an exploration task
   */
  private isExplorationTask(task: Task): boolean {
    const description = task.description.toLowerCase();
    return description.includes('explore') || 
           description.includes('list') || 
           description.includes('structure') ||
           description.includes('understand') ||
           description.includes('identify');
  }

  /**
   * Check if task is an analysis task
   */
  private isAnalysisTask(task: Task): boolean {
    const description = task.description.toLowerCase();
    return description.includes('analyze') || 
           description.includes('read') || 
           description.includes('examine') ||
           description.includes('review') ||
           description.includes('assess');
  }

  /**
   * Check if task is an execution task
   */
  private isExecutionTask(task: Task): boolean {
    const description = task.description.toLowerCase();
    return description.includes('generate') || 
           description.includes('create') || 
           description.includes('implement') ||
           description.includes('build') ||
           description.includes('fix') ||
           description.includes('optimize');
  }

  /**
   * Create fallback tasks for failed decomposition
   */
  private createFallbackTasks(userGoal: string, intent: Intent): Task[] {
    return [
      this.createTask(
        `Analyze and understand: ${userGoal}`,
        'high',
        [],
        3,
        { fallback: true, originalGoal: userGoal }
      ),
      this.createTask(
        `Execute the main task: ${intent.category}`,
        'medium',
        [],
        intent.complexity === 'simple' ? 2 : 
        intent.complexity === 'medium' ? 4 : 6,
        { fallback: true, originalGoal: userGoal }
      )
    ];
  }

  /**
   * Create a new task with proper structure
   */
  private createTask(
    description: string,
    priority: Task['priority'] = 'medium',
    dependencies: string[] = [],
    estimatedComplexity: number = 3,
    context: any = {}
  ): Task {
    return {
      id: `task_${++this.taskIdCounter}_${Date.now()}`,
      description,
      priority,
      status: 'pending',
      dependencies,
      context,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      estimatedComplexity: Math.max(1, Math.min(10, estimatedComplexity)),
      errorCount: 0,
      maxRetries: priority === 'critical' ? 5 : 3
    };
  }

  /**
   * Get decomposition statistics
   */
  getDecompositionStats(): any {
    return {
      totalStrategies: this.strategies.length,
      strategiesBy: {
        category: this.strategies.reduce((acc, strategy) => {
          strategy.applicableCategories.forEach(cat => {
            acc[cat] = (acc[cat] || 0) + 1;
          });
          return acc;
        }, {} as Record<string, number>),
        maxTasks: this.strategies.reduce((acc, strategy) => {
          acc[strategy.maxTasks] = (acc[strategy.maxTasks] || 0) + 1;
          return acc;
        }, {} as Record<number, number>)
      },
      taskIdCounter: this.taskIdCounter
    };
  }
}