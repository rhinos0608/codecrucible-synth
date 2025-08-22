import { UnifiedModelClient } from '../client.js';
import { MCPServerManager } from '../../mcp-servers/mcp-server-manager.js';
import { VoiceArchetypeSystem } from '../../voices/voice-archetype-system.js';
import { logger } from '../logger.js';

export interface Task {
  id: string;
  description: string;
  tool: string;
  args: any;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  estimatedDuration?: number;
  priority: 'low' | 'medium' | 'high';
  retryCount: number;
  maxRetries: number;
}

export interface Plan {
  id: string;
  objective: string;
  tasks: Task[];
  estimatedTime: number;
  complexity: 'low' | 'medium' | 'high';
  riskFactors: string[];
  recoveryStrategies: string[];
  contextRequirements: string[];
}

export interface ExecutionContext {
  workingDirectory: string;
  variables: Record<string, any>;
  history: ExecutionStep[];
  projectContext: any;
  sessionId: string;
  startTime: Date;
}

export interface ExecutionStep {
  taskId: string;
  timestamp: Date;
  tool: string;
  args: any;
  result: any;
  duration: number;
  success: boolean;
  errorDetails?: string;
}

/**
 * Enhanced Agentic Planning Engine
 *
 * Implements sophisticated task planning with dependency management,
 * auto-recovery, and context-aware execution strategies following
 * the patterns from the Agentic CLI guide.
 */
export class EnhancedAgenticPlanner {
  private modelClient: UnifiedModelClient;
  private mcpManager: MCPServerManager;
  private voiceSystem: VoiceArchetypeSystem;
  private context: ExecutionContext;

  constructor(
    modelClient: UnifiedModelClient,
    mcpManager: MCPServerManager,
    voiceSystem: VoiceArchetypeSystem
  ) {
    this.modelClient = modelClient;
    this.mcpManager = mcpManager;
    this.voiceSystem = voiceSystem;
    this.context = {
      workingDirectory: process.cwd(),
      variables: {},
      history: [],
      projectContext: {},
      sessionId: this.generateId(),
      startTime: new Date(),
    };
  }

  /**
   * Create a comprehensive execution plan using multi-voice analysis
   * Follows the "Think → Plan → Act → Verify" pattern
   */
  async createPlan(objective: string): Promise<Plan> {
    logger.info(`Creating plan for objective: ${objective}`);

    // THINK: Analyze the objective with multiple perspectives
    const analysis = await this.analyzeObjective(objective);

    // PLAN: Generate detailed task breakdown
    const planData = await this.generateTaskBreakdown(objective, analysis);

    // Validate and optimize the plan
    const optimizedPlan = await this.optimizePlan(planData);

    // Add meta-information
    const plan: Plan = {
      id: this.generateId(),
      objective,
      ...optimizedPlan,
      contextRequirements: await this.identifyContextRequirements(objective),
    };

    logger.info(
      `Plan created with ${plan.tasks.length} tasks, estimated ${plan.estimatedTime} minutes`
    );
    return plan;
  }

  /**
   * Analyze objective using multiple voice perspectives
   */
  private async analyzeObjective(objective: string): Promise<any> {
    const analysisPrompt = `Analyze this coding objective from multiple perspectives:

Objective: "${objective}"

Please provide:
1. Technical complexity assessment (1-5 scale)
2. Required tools and technologies
3. Potential challenges and risks
4. Success criteria
5. Context dependencies

Consider security, performance, maintainability, and user experience aspects.`;

    const analysisVoices = ['architect', 'analyzer', 'security'];
    const responses = await this.voiceSystem.generateMultiVoiceSolutions(
      analysisVoices,
      analysisPrompt
    );

    const synthesis = await this.voiceSystem.synthesizeVoiceResponses(responses);

    try {
      return this.extractJsonFromText((synthesis as any).combinedCode || synthesis.content);
    } catch (error) {
      logger.warn('Failed to parse objective analysis JSON, using text response');
      return { analysis: (synthesis as any).combinedCode || synthesis.content };
    }
  }

  /**
   * Generate detailed task breakdown with dependency management
   */
  private async generateTaskBreakdown(objective: string, analysis: any): Promise<any> {
    const availableTools = await this.getAvailableTools();

    const planningPrompt = `Create a detailed execution plan for this objective:

Objective: "${objective}"
Analysis: ${JSON.stringify(analysis, null, 2)}

Available Tools:
${availableTools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

Create a JSON plan with this structure:
{
  "tasks": [
    {
      "id": "task_1",
      "description": "What this task accomplishes",
      "tool": "tool_name",
      "args": {...},
      "dependencies": ["task_id_that_must_complete_first"],
      "priority": "low|medium|high",
      "estimatedDuration": 5,
      "reasoning": "Why this approach"
    }
  ],
  "estimatedTime": 30,
  "complexity": "low|medium|high",
  "riskFactors": ["potential issues"],
  "recoveryStrategies": ["fallback approaches"]
}

IMPORTANT:
- Make tasks atomic and specific
- Consider file dependencies (read before write)
- Include validation and testing steps
- Plan for error handling and recovery
- Use realistic time estimates`;

    const planningVoices = ['architect', 'implementor', 'maintainer'];
    const responses = await this.voiceSystem.generateMultiVoiceSolutions(
      planningVoices,
      planningPrompt
    );

    const synthesis = await this.voiceSystem.synthesizeVoiceResponses(responses);

    return this.extractJsonFromText((synthesis as any).combinedCode || synthesis.content);
  }

  /**
   * Execute plan with sophisticated dependency management and recovery
   */
  async executePlan(plan: Plan, onProgress?: (task: Task) => void): Promise<void> {
    logger.info(`Executing plan: ${plan.objective}`);

    // Build dependency graph and calculate execution order
    const executionOrder = this.calculateExecutionOrder(plan.tasks);

    // Set up execution context
    this.context.variables['plan_id'] = plan.id;
    this.context.variables['objective'] = plan.objective;

    for (const taskId of executionOrder) {
      const task = plan.tasks.find(t => t.id === taskId);
      if (!task) continue;

      // Check if dependencies are satisfied
      if (!this.areDependenciesSatisfied(task, plan.tasks)) {
        task.status = 'failed';
        task.error = 'Dependencies not satisfied';
        continue;
      }

      try {
        task.status = 'running';
        onProgress?.(task);

        // ACT: Execute the task
        const result = await this.executeTask(task);

        // VERIFY: Validate the result
        const isValid = await this.validateTaskResult(task, result);

        if (isValid) {
          task.result = result;
          task.status = 'completed';

          // Update context with results
          this.context.variables[`task_${task.id}_result`] = result;

          logger.info(`Task completed: ${task.description}`);
        } else {
          throw new Error('Task result validation failed');
        }

        onProgress?.(task);
      } catch (error) {
        await this.handleTaskFailure(task, plan, error);
        onProgress?.(task);
      }
    }

    // Final validation
    await this.validatePlanCompletion(plan);
  }

  /**
   * Execute individual task with enhanced error handling
   */
  private async executeTask(task: Task): Promise<any> {
    const startTime = Date.now();

    try {
      // Resolve variables in arguments
      const resolvedArgs = this.resolveVariables(task.args);

      // Add execution context
      const contextualArgs = {
        ...resolvedArgs,
        workingDirectory: this.context.workingDirectory,
        sessionId: this.context.sessionId,
        taskContext: this.buildTaskContext(task),
      };

      // Execute based on tool type
      let result;
      switch (task.tool) {
        case 'filesystem':
          result = await this.executeFilesystemTask(contextualArgs);
          break;
        case 'git':
          result = await this.executeGitTask(contextualArgs);
          break;
        case 'terminal':
          result = await this.executeTerminalTask(contextualArgs);
          break;
        case 'smithery':
          result = await this.executeSmitheryTask(contextualArgs);
          break;
        case 'voice_generation':
          result = await this.executeVoiceTask(contextualArgs);
          break;
        case 'package_manager':
          result = await this.executePackageManagerTask(contextualArgs);
          break;
        default:
          throw new Error(`Unknown tool: ${task.tool}`);
      }

      // Record successful execution
      this.recordExecutionStep(task, contextualArgs, result, Date.now() - startTime, true);

      return result;
    } catch (error) {
      // Record failed execution
      this.recordExecutionStep(task, task.args, null, Date.now() - startTime, false, error);
      throw error;
    }
  }

  /**
   * Handle task failure with sophisticated recovery strategies
   */
  private async handleTaskFailure(task: Task, plan: Plan, error: any): Promise<void> {
    task.error = error instanceof Error ? error.message : 'Unknown error';
    task.retryCount = (task.retryCount || 0) + 1;

    logger.warn(`Task failed: ${task.description} (attempt ${task.retryCount})`);

    // Try recovery if retries available
    if (task.retryCount < (task.maxRetries || 3)) {
      const canRecover = await this.attemptRecovery(task, plan, error);

      if (canRecover) {
        // Reset status for retry
        task.status = 'pending';

        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, task.retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry execution
        try {
          const result = await this.executeTask(task);
          task.result = result;
          task.status = 'completed';
          this.context.variables[`task_${task.id}_result`] = result;
          return;
        } catch (retryError) {
          // Continue to failure handling
        }
      }
    }

    // Mark as failed
    task.status = 'failed';

    // Check if this is a critical failure
    const isCritical = await this.assessCriticalFailure(task, plan);
    if (isCritical) {
      throw new Error(`Critical task failed: ${task.description}`);
    }

    logger.info(`Non-critical task failed, continuing with plan execution`);
  }

  /**
   * Attempt sophisticated recovery strategies
   */
  private async attemptRecovery(task: Task, plan: Plan, error: any): Promise<boolean> {
    logger.info(`Attempting recovery for task: ${task.description}`);

    // Use analyzer voice to understand the failure and suggest recovery
    const recoveryPrompt = `Analyze this task failure and suggest a recovery strategy:

Task: ${task.description}
Tool: ${task.tool}
Args: ${JSON.stringify(task.args, null, 2)}
Error: ${error.message || error}
Context: ${JSON.stringify(this.context.variables, null, 2)}

Provide a JSON response:
{
  "canRecover": boolean,
  "strategy": "description of recovery approach",
  "modifiedArgs": {...}, // modified arguments if needed
  "alternativeApproach": "completely different approach if needed"
}`;

    try {
      const response = await this.modelClient.processRequest(
        {
          prompt: `You are an expert at analyzing failures and suggesting recovery strategies. Always respond with valid JSON.\n\n${recoveryPrompt}`,
          temperature: 0.3,
        },
        {
          files: [],
          structure: { directories: [], fileTypes: {} },
          workingDirectory: process.cwd(),
          config: {},
        }
      );

      const recovery = this.extractJsonFromText(response.content);

      if (recovery.canRecover) {
        logger.info(`Recovery strategy: ${recovery.strategy}`);

        // Apply modified arguments if provided
        if (recovery.modifiedArgs) {
          task.args = { ...task.args, ...recovery.modifiedArgs };
        }

        return true;
      }
    } catch (error) {
      logger.error('Recovery analysis failed:', error);
    }

    return false;
  }

  /**
   * Tool-specific execution methods
   */
  private async executeFilesystemTask(args: any): Promise<any> {
    const { operation, path, content, options } = args;

    switch (operation) {
      case 'read':
        return await this.mcpManager.readFileSecure(path);
      case 'write':
        await this.mcpManager.writeFileSecure(path, content);
        return { success: true, path };
      case 'list':
        return await this.mcpManager.listDirectorySecure(path);
      default:
        throw new Error(`Unknown filesystem operation: ${operation}`);
    }
  }

  private async executeGitTask(args: any): Promise<any> {
    const { operation, files, message } = args;

    switch (operation) {
      case 'status':
        return await this.mcpManager.gitStatus();
      case 'add':
        return await this.mcpManager.gitAdd(files);
      case 'commit':
        return await this.mcpManager.gitCommit(message);
      default:
        throw new Error(`Unknown git operation: ${operation}`);
    }
  }

  private async executeTerminalTask(args: any): Promise<any> {
    const { command, arguments: cmdArgs } = args;
    return await this.mcpManager.executeCommandSecure(command, cmdArgs || []);
  }

  private async executeSmitheryTask(args: any): Promise<any> {
    const { query, numResults } = args;
    return await this.mcpManager.smitheryWebSearch(query, numResults);
  }

  private async executePackageManagerTask(args: any): Promise<any> {
    const { operation, packageName, dev } = args;

    switch (operation) {
      case 'install':
        return await this.mcpManager.installPackage(packageName, dev);
      case 'run':
        return await this.mcpManager.runScript(packageName); // packageName is script name here
      default:
        throw new Error(`Unknown package manager operation: ${operation}`);
    }
  }

  private async executeVoiceTask(args: any): Promise<any> {
    const { prompt, voices, mode, context } = args;

    const responses = await this.voiceSystem.generateMultiVoiceSolutions(
      voices || ['developer'],
      prompt,
      context || { files: [], structure: {}, metadata: {} }
    );

    return await this.voiceSystem.synthesizeVoiceResponses(responses);
  }

  /**
   * Validation and utility methods
   */
  private async validateTaskResult(task: Task, result: any): Promise<boolean> {
    // Basic validation - can be enhanced with tool-specific validation
    if (result === null || result === undefined) {
      return false;
    }

    // Tool-specific validation
    switch (task.tool) {
      case 'filesystem':
        if (task.args.operation === 'read') {
          return typeof result === 'string' && result.length > 0;
        }
        return result.success === true;

      case 'voice_generation':
        return result.combinedCode && result.confidence > 0.3;

      default:
        return true; // Basic validation passed
    }
  }

  private async validatePlanCompletion(plan: Plan): Promise<void> {
    const completedTasks = plan.tasks.filter(t => t.status === 'completed');
    const failedTasks = plan.tasks.filter(t => t.status === 'failed');

    logger.info(
      `Plan completion: ${completedTasks.length}/${plan.tasks.length} tasks completed, ${failedTasks.length} failed`
    );

    if (completedTasks.length === 0) {
      throw new Error('Plan execution failed: No tasks completed successfully');
    }

    // Check if critical tasks failed
    const criticalFailures = failedTasks.filter(t => t.priority === 'high');
    if (criticalFailures.length > 0) {
      logger.warn(`Critical tasks failed: ${criticalFailures.map(t => t.description).join(', ')}`);
    }
  }

  private async assessCriticalFailure(task: Task, plan: Plan): Promise<boolean> {
    // High priority tasks are always critical
    if (task.priority === 'high') {
      return true;
    }

    // Check if other tasks depend on this one
    const dependentTasks = plan.tasks.filter(t => t.dependencies.includes(task.id));
    if (dependentTasks.length > 0) {
      logger.warn(`Task failure affects ${dependentTasks.length} dependent tasks`);
      return dependentTasks.some(t => t.priority === 'high');
    }

    return false;
  }

  private areDependenciesSatisfied(task: Task, allTasks: Task[]): boolean {
    return task.dependencies.every(depId => {
      const dependency = allTasks.find(t => t.id === depId);
      return dependency?.status === 'completed';
    });
  }

  private calculateExecutionOrder(tasks: Task[]): string[] {
    // Topological sort for dependency resolution
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (taskId: string) => {
      if (visiting.has(taskId)) {
        throw new Error(`Circular dependency detected: ${taskId}`);
      }
      if (visited.has(taskId)) return;

      visiting.add(taskId);

      const task = tasks.find(t => t.id === taskId);
      if (task) {
        for (const depId of task.dependencies) {
          visit(depId);
        }
      }

      visiting.delete(taskId);
      visited.add(taskId);
      result.push(taskId);
    };

    for (const task of tasks) {
      visit(task.id);
    }

    return result;
  }

  /**
   * Context and variable management
   */
  private resolveVariables(args: any): any {
    if (typeof args === 'string') {
      return args.replace(/\$\{([^}]+)\}/g, (match, varName) => {
        return this.context.variables[varName] || match;
      });
    }

    if (Array.isArray(args)) {
      return args.map(arg => this.resolveVariables(arg));
    }

    if (typeof args === 'object' && args !== null) {
      const resolved: any = {};
      for (const [key, value] of Object.entries(args)) {
        resolved[key] = this.resolveVariables(value);
      }
      return resolved;
    }

    return args;
  }

  private buildTaskContext(task: Task): string {
    return `Task: ${task.description}\nTool: ${task.tool}\nPriority: ${task.priority}\nDependencies: ${task.dependencies.join(', ')}`;
  }

  private recordExecutionStep(
    task: Task,
    args: any,
    result: any,
    duration: number,
    success: boolean,
    error?: any
  ): void {
    this.context.history.push({
      taskId: task.id,
      timestamp: new Date(),
      tool: task.tool,
      args,
      result,
      duration,
      success,
      errorDetails: error ? error.message || error.toString() : undefined,
    });
  }

  /**
   * Utility methods
   */
  private async getAvailableTools(): Promise<Array<{ name: string; description: string }>> {
    // Get available MCP tools and built-in capabilities
    return [
      { name: 'filesystem', description: 'Read, write, and list files securely' },
      { name: 'git', description: 'Git version control operations' },
      { name: 'terminal', description: 'Execute terminal commands safely' },
      { name: 'smithery', description: 'Web search using Smithery API' },
      { name: 'voice_generation', description: 'Generate code using multi-voice AI' },
      { name: 'package_manager', description: 'NPM package management operations' },
    ];
  }

  private async optimizePlan(planData: any): Promise<any> {
    // Add default values and optimize task ordering
    const tasks = planData.tasks || [];

    tasks.forEach((task: Task, index: number) => {
      task.id = task.id || `task_${index + 1}`;
      task.status = 'pending';
      task.retryCount = 0;
      task.maxRetries = task.priority === 'high' ? 5 : 3;
      task.dependencies = task.dependencies || [];
      task.priority = task.priority || 'medium';
      task.estimatedDuration = task.estimatedDuration || 5;
    });

    return {
      tasks,
      estimatedTime:
        planData.estimatedTime ||
        tasks.reduce((sum: number, t: Task) => sum + (t.estimatedDuration || 5), 0),
      complexity: planData.complexity || 'medium',
      riskFactors: planData.riskFactors || [],
      recoveryStrategies: planData.recoveryStrategies || [],
    };
  }

  private async identifyContextRequirements(objective: string): Promise<string[]> {
    // Analyze what context is needed for this objective
    const requirements = [];

    if (objective.toLowerCase().includes('file') || objective.toLowerCase().includes('code')) {
      requirements.push('project_structure', 'file_contents');
    }

    if (objective.toLowerCase().includes('git') || objective.toLowerCase().includes('commit')) {
      requirements.push('git_status', 'git_history');
    }

    if (objective.toLowerCase().includes('test') || objective.toLowerCase().includes('build')) {
      requirements.push('package_json', 'test_configuration');
    }

    return requirements;
  }

  private extractJsonFromText(text: string): any {
    // Extract JSON from potentially markdown-formatted response
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    try {
      return JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch (error) {
      throw new Error(`Invalid JSON in response: ${error}`);
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Public API methods
   */

  /**
   * Get execution context and history
   */
  getExecutionContext(): ExecutionContext {
    return { ...this.context };
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): any {
    const history = this.context.history;
    const totalExecutions = history.length;
    const successfulExecutions = history.filter(h => h.success).length;
    const avgDuration = history.reduce((sum, h) => sum + h.duration, 0) / totalExecutions || 0;

    const toolUsage = history.reduce(
      (acc, h) => {
        acc[h.tool] = (acc[h.tool] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalExecutions,
      successfulExecutions,
      successRate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
      avgDuration: Math.round(avgDuration),
      toolUsage,
      sessionDuration: Date.now() - this.context.startTime.getTime(),
    };
  }

  /**
   * Clear execution history and reset context
   */
  resetContext(): void {
    this.context = {
      workingDirectory: process.cwd(),
      variables: {},
      history: [],
      projectContext: {},
      sessionId: this.generateId(),
      startTime: new Date(),
    };

    logger.info('Execution context reset');
  }
}
