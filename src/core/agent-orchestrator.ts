import { CLIContext } from './cli.js';
import { LocalModelClient } from './local-model-client.js';
import { logger } from './logger.js';
import { ReActAgent } from './react-agent.js';
import { VoiceArchetypeSystem } from '../voices/voice-archetype-system.js';
import { AgentMemorySystem } from './agent-memory-system.js';
import { IntentClassifier } from './intent-classifier.js';
import { GoalDecomposer } from './goal-decomposer.js';
import { SelfCorrectionFramework } from './self-correction-framework.js';
import { ProactiveTaskSuggester } from './proactive-task-suggester.js';
import { AutonomousCodebaseAnalyzer } from './autonomous-codebase-analyzer.js';
import { timeoutManager } from './timeout-manager.js';

export interface Task {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  dependencies: string[];
  agent?: string;
  context?: any;
  createdAt: number;
  updatedAt: number;
  estimatedComplexity: number;
  actualComplexity?: number;
  result?: any;
  errorCount: number;
  maxRetries: number;
}

export interface WorkflowContext {
  userId: string;
  sessionId: string;
  projectPath: string;
  projectType?: string;
  goals: string[];
  currentTask?: Task;
  taskQueue: Task[];
  completedTasks: Task[];
  failedTasks: Task[];
  memory: Map<string, any>;
  learnings: any[];
  confidence: number;
  timestamp: number;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  isAvailable: boolean;
  currentTask?: string;
  performanceHistory: AgentPerformance[];
}

export interface AgentPerformance {
  taskId: string;
  success: boolean;
  duration: number;
  complexity: number;
  quality: number;
  timestamp: number;
}

/**
 * Enhanced Agent Orchestrator for autonomous multi-agent workflows
 * 
 * This orchestrator provides:
 * - Intelligent task decomposition and routing
 * - Multi-agent coordination and collaboration
 * - Autonomous decision making and self-correction
 * - Learning from past interactions
 * - Proactive task suggestion and execution
 */
export class AgentOrchestrator {
  private context: CLIContext;
  private model: LocalModelClient;
  private voiceSystem: VoiceArchetypeSystem;
  private memorySystem: AgentMemorySystem;
  private intentClassifier: IntentClassifier;
  private goalDecomposer: GoalDecomposer;
  private selfCorrection: SelfCorrectionFramework;
  private taskSuggester: ProactiveTaskSuggester;
  
  private agents: Map<string, Agent> = new Map();
  private workflows: Map<string, WorkflowContext> = new Map();
  private taskIdCounter = 0;

  constructor(context: CLIContext) {
    this.context = context;
    this.model = context.modelClient;
    this.voiceSystem = context.voiceSystem;
    
    // Initialize agentic subsystems
    this.memorySystem = new AgentMemorySystem();
    this.intentClassifier = new IntentClassifier(this.model);
    this.goalDecomposer = new GoalDecomposer(this.model);
    this.selfCorrection = new SelfCorrectionFramework(this.model);
    this.taskSuggester = new ProactiveTaskSuggester(this.model, this.memorySystem);
    
    // Initialize specialized agents
    this.initializeAgents();
  }

  /**
   * Initialize specialized agents for different types of work
   */
  private initializeAgents(): void {
    const agentDefinitions = [
      {
        id: 'codeAnalyzer',
        name: 'Code Analyzer',
        description: 'Specialized in code analysis, review, and quality assessment',
        capabilities: ['code_analysis', 'lint_checking', 'ast_parsing', 'dependency_analysis']
      },
      {
        id: 'fileExplorer',
        name: 'File Explorer',
        description: 'Expert at file system navigation and project structure analysis',
        capabilities: ['file_listing', 'directory_exploration', 'file_reading', 'structure_analysis']
      },
      {
        id: 'gitManager',
        name: 'Git Manager',
        description: 'Handles all git operations and version control analysis',
        capabilities: ['git_status', 'git_diff', 'commit_analysis', 'branch_management']
      },
      {
        id: 'researchAgent',
        name: 'Research Agent',
        description: 'Conducts research, documentation lookup, and web searches',
        capabilities: ['web_search', 'documentation_search', 'pattern_research', 'best_practices']
      },
      {
        id: 'problemSolver',
        name: 'Problem Solver',
        description: 'Focused on identifying and solving specific problems',
        capabilities: ['problem_identification', 'solution_design', 'debugging', 'optimization']
      },
      {
        id: 'coordinator',
        name: 'Coordinator',
        description: 'Manages workflow coordination and agent collaboration',
        capabilities: ['task_coordination', 'agent_management', 'workflow_optimization', 'decision_making']
      }
    ];

    agentDefinitions.forEach(def => {
      const agent: Agent = {
        id: def.id,
        name: def.name,
        description: def.description,
        capabilities: def.capabilities,
        isAvailable: true,
        performanceHistory: []
      };
      this.agents.set(def.id, agent);
    });

    logger.info(`🤖 Initialized ${this.agents.size} specialized agents`);
  }

  /**
   * Main entry point for autonomous agentic processing
   */
  async processAgenticRequest(
    userInput: string, 
    projectPath: string, 
    options: any = {}
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    logger.info(`🎯 Starting agentic processing session: ${sessionId}`);

    try {
      // Initialize workflow context
      const workflowContext = await this.initializeWorkflowContext(
        userInput, 
        projectPath, 
        sessionId,
        options
      );

      // Classify intent and determine approach
      const intent = await this.intentClassifier.classifyIntent(userInput, workflowContext);
      logger.info(`🧠 Classified intent: ${intent.category} (confidence: ${intent.confidence})`);

      // Decompose goal into actionable tasks
      const tasks = await this.goalDecomposer.decompose(userInput, intent, workflowContext);
      logger.info(`📋 Decomposed into ${tasks.length} tasks`);

      // Add tasks to workflow
      workflowContext.taskQueue.push(...tasks);
      this.workflows.set(sessionId, workflowContext);

      // Check if this requires autonomous codebase analysis
      if (this.shouldRunCodebaseAnalysis(userInput, intent)) {
        logger.info('🔍 Running autonomous codebase analysis...');
        
        const analyzer = new AutonomousCodebaseAnalyzer(projectPath);
        const analysis = await timeoutManager.executeWithRetry(
          () => analyzer.analyzeCodebase(),
          'autonomous_codebase_analysis',
          { maxRetries: 2, timeoutMs: 45000 }
        );
        
        // Store analysis in workflow context
        workflowContext.memory.set('codebase_analysis', analysis);
        logger.info('✅ Codebase analysis completed successfully');
      }

      // Execute workflow autonomously
      const result = await this.executeWorkflow(sessionId);

      // Generate proactive suggestions for follow-up
      const suggestions = await this.taskSuggester.generateSuggestions(
        workflowContext, 
        result
      );

      // Store learnings in memory
      await this.memorySystem.storeLearning({
        sessionId,
        userInput,
        intent: intent.category,
        tasksCompleted: workflowContext.completedTasks.length,
        success: workflowContext.failedTasks.length === 0,
        duration: Date.now() - workflowContext.timestamp,
        learnings: workflowContext.learnings,
        suggestions: suggestions.map(s => s as unknown as Record<string, unknown>),
        confidence: workflowContext.confidence,
        metadata: { intent, projectType: workflowContext.projectType }
      });

      // Format final response
      return this.formatAgenticResponse(result, suggestions, workflowContext);

    } catch (error) {
      logger.error('Agentic processing failed:', error);
      
      // Use self-correction to analyze failure and suggest improvements
      const correction = await this.selfCorrection.analyzeFailure(
        userInput,
        error instanceof Error ? error.message : 'Unknown error',
        { sessionId, projectPath }
      );

      return `❌ **Agentic Processing Failed**

Error: ${error instanceof Error ? error.message : 'Unknown error'}

**Self-Correction Analysis:**
${correction.analysis}

**Suggested Improvements:**
${correction.suggestions.map(s => `- ${s}`).join('\n')}

**Fallback Approach:**
${correction.fallbackStrategy}`;
    }
  }

  /**
   * Execute workflow autonomously with intelligent agent coordination
   */
  private async executeWorkflow(sessionId: string): Promise<any> {
    const workflowContext = this.workflows.get(sessionId);
    if (!workflowContext) {
      throw new Error('Workflow context not found');
    }

    const results: any[] = [];
    let iterationCount = 0;
    const maxIterations = 20;

    while (workflowContext.taskQueue.length > 0 && iterationCount < maxIterations) {
      iterationCount++;
      
      // Select next task based on priority and dependencies
      const nextTask = this.selectNextTask(workflowContext);
      if (!nextTask) {
        logger.warn('No executable tasks found, ending workflow');
        break;
      }

      logger.info(`🔄 Executing task ${nextTask.id}: ${nextTask.description}`);
      workflowContext.currentTask = nextTask;
      nextTask.status = 'in_progress';

      try {
        // Select optimal agent for this task
        const agent = this.selectOptimalAgent(nextTask, workflowContext);
        logger.info(`👤 Assigned to agent: ${agent.name}`);

        // Execute task with selected agent
        const taskResult = await this.executeTask(nextTask, agent, workflowContext);
        
        // Record success
        nextTask.status = 'completed';
        nextTask.result = taskResult;
        nextTask.updatedAt = Date.now();
        
        // Move task from queue to completed
        workflowContext.taskQueue = workflowContext.taskQueue.filter(t => t.id !== nextTask.id);
        workflowContext.completedTasks.push(nextTask);
        
        // Record agent performance
        this.recordAgentPerformance(agent, nextTask, true, taskResult);
        
        results.push(taskResult);
        
        // Check if this completion enables new tasks
        await this.checkForNewTasks(workflowContext, nextTask);
        
        logger.info(`✅ Task ${nextTask.id} completed successfully`);

      } catch (error) {
        logger.error(`❌ Task ${nextTask.id} failed:`, error);
        
        nextTask.errorCount++;
        nextTask.status = nextTask.errorCount >= nextTask.maxRetries ? 'failed' : 'pending';
        nextTask.updatedAt = Date.now();

        if (nextTask.status === 'failed') {
          workflowContext.taskQueue = workflowContext.taskQueue.filter(t => t.id !== nextTask.id);
          workflowContext.failedTasks.push(nextTask);
        }

        // Record agent performance
        const agent = this.agents.get(nextTask.agent || 'unknown');
        if (agent) {
          this.recordAgentPerformance(agent, nextTask, false, error);
        }

        // Use self-correction to adapt
        const correction = await this.selfCorrection.analyzeTaskFailure(
          nextTask,
          error instanceof Error ? error.message : 'Unknown error',
          workflowContext
        );

        // Apply corrections if possible
        if (correction.retryWithModifications && nextTask.errorCount < nextTask.maxRetries) {
          nextTask.description = correction.modifiedTaskDescription || nextTask.description;
          nextTask.context = { ...nextTask.context, ...correction.modifiedContext };
          nextTask.status = 'pending';
          logger.info(`🔧 Applied self-correction to task ${nextTask.id}`);
        }
      }

      // Update workflow confidence based on progress
      this.updateWorkflowConfidence(workflowContext);
    }

    // Synthesize results using voice system if multiple results
    if (results.length > 1) {
      return await this.synthesizeWorkflowResults(results, workflowContext);
    } else if (results.length === 1) {
      return results[0];
    } else {
      return {
        success: false,
        message: 'No tasks were completed successfully',
        completedTasks: workflowContext.completedTasks.length,
        failedTasks: workflowContext.failedTasks.length
      };
    }
  }

  /**
   * Select the next task to execute based on priority and dependencies
   */
  private selectNextTask(workflowContext: WorkflowContext): Task | null {
    // Debug logging
    logger.info(`🔍 Task selection debug:`);
    logger.info(`  Total tasks in queue: ${workflowContext.taskQueue.length}`);
    workflowContext.taskQueue.forEach((task, i) => {
      logger.info(`  Task ${i + 1}: "${task.description}" - Status: ${task.status}, Dependencies: [${task.dependencies.join(', ')}]`);
    });
    
    const executableTasks = workflowContext.taskQueue.filter(task => {
      if (task.status !== 'pending') return false;
      
      // Check if all dependencies are completed
      return task.dependencies.every(depId => 
        workflowContext.completedTasks.some(completed => completed.id === depId)
      );
    });

    logger.info(`  Executable tasks: ${executableTasks.length}`);
    if (executableTasks.length === 0) return null;

    // Sort by priority and then by creation order
    executableTasks.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt - b.createdAt;
    });

    return executableTasks[0];
  }

  /**
   * Select optimal agent for a specific task
   */
  private selectOptimalAgent(task: Task, workflowContext: WorkflowContext): Agent {
    const availableAgents = Array.from(this.agents.values()).filter(agent => agent.isAvailable);
    
    if (availableAgents.length === 0) {
      throw new Error('No available agents');
    }

    // Score agents based on capabilities and performance history
    const agentScores = availableAgents.map(agent => {
      let score = 0;
      
      // Capability matching
      const taskRequirements = this.extractTaskRequirements(task);
      const capabilityMatch = taskRequirements.filter(req => 
        agent.capabilities.some(cap => cap.includes(req) || req.includes(cap))
      ).length;
      score += capabilityMatch * 3;
      
      // Performance history
      if (agent.performanceHistory.length > 0) {
        const avgSuccess = agent.performanceHistory.reduce((sum, perf) => 
          sum + (perf.success ? 1 : 0), 0) / agent.performanceHistory.length;
        const avgQuality = agent.performanceHistory.reduce((sum, perf) => 
          sum + perf.quality, 0) / agent.performanceHistory.length;
        score += avgSuccess * 2 + avgQuality;
      } else {
        score += 1; // Neutral score for new agents
      }
      
      return { agent, score };
    });

    // Select agent with highest score
    agentScores.sort((a, b) => b.score - a.score);
    const selectedAgent = agentScores[0].agent;
    
    // Mark agent as busy
    selectedAgent.isAvailable = false;
    selectedAgent.currentTask = task.id;
    
    return selectedAgent;
  }

  /**
   * Extract task requirements from task description and context
   */
  private extractTaskRequirements(task: Task): string[] {
    const requirements: string[] = [];
    const description = task.description.toLowerCase();
    
    if (description.includes('analyze') || description.includes('review')) {
      requirements.push('code_analysis');
    }
    if (description.includes('file') || description.includes('read') || description.includes('explore')) {
      requirements.push('file_listing', 'file_reading');
    }
    if (description.includes('git') || description.includes('commit') || description.includes('diff')) {
      requirements.push('git_status', 'git_diff');
    }
    if (description.includes('search') || description.includes('research') || description.includes('documentation')) {
      requirements.push('web_search', 'documentation_search');
    }
    if (description.includes('problem') || description.includes('debug') || description.includes('fix')) {
      requirements.push('problem_identification', 'debugging');
    }
    
    return requirements;
  }

  /**
   * Execute a specific task with the assigned agent
   */
  private async executeTask(task: Task, agent: Agent, workflowContext: WorkflowContext): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Create specialized execution context based on agent type
      let result;
      
      switch (agent.id) {
        case 'codeAnalyzer':
          result = await this.executeCodeAnalysisTask(task, workflowContext);
          break;
        case 'fileExplorer':
          result = await this.executeFileExplorationTask(task, workflowContext);
          break;
        case 'gitManager':
          result = await this.executeGitTask(task, workflowContext);
          break;
        case 'researchAgent':
          result = await this.executeResearchTask(task, workflowContext);
          break;
        case 'problemSolver':
          result = await this.executeProblemSolvingTask(task, workflowContext);
          break;
        default:
          // Use ReAct agent as fallback
          result = await this.executeWithReActAgent(task, workflowContext);
      }
      
      // Calculate actual complexity
      const duration = Date.now() - startTime;
      task.actualComplexity = Math.min(duration / 1000, 10); // Cap at 10 for scoring
      
      return result;
      
    } finally {
      // Release agent
      agent.isAvailable = true;
      agent.currentTask = undefined;
    }
  }

  /**
   * Execute code analysis task
   */
  private async executeCodeAnalysisTask(task: Task, workflowContext: WorkflowContext): Promise<any> {
    const reactAgent = new ReActAgent(this.context, workflowContext.projectPath);
    
    // Enhance task description for code analysis
    const enhancedPrompt = `Code Analysis Task: ${task.description}
    
Focus on:
- Code quality and maintainability
- Potential bugs and issues
- Performance optimization opportunities
- Best practices compliance
- Security considerations

Project Context: ${workflowContext.projectType || 'Unknown'}
Previous Findings: ${workflowContext.learnings.map(l => l.summary).join(', ')}`;

    const result = await reactAgent.processRequest(enhancedPrompt);
    
    // Extract learnings for future use
    const learnings = this.extractLearnings(result, 'code_analysis');
    workflowContext.learnings.push(...learnings);
    
    return { type: 'code_analysis', result, learnings };
  }

  /**
   * Execute file exploration task
   */
  private async executeFileExplorationTask(task: Task, workflowContext: WorkflowContext): Promise<any> {
    const reactAgent = new ReActAgent(this.context, workflowContext.projectPath);
    
    const enhancedPrompt = `File Exploration Task: ${task.description}
    
Focus on:
- Project structure and organization
- Key files and directories
- Configuration files
- Documentation
- Build and deployment files

Provide a comprehensive overview of the project layout.`;

    const result = await reactAgent.processRequest(enhancedPrompt);
    
    // Update project type based on findings
    if (!workflowContext.projectType) {
      workflowContext.projectType = this.inferProjectType(result);
    }
    
    return { type: 'file_exploration', result, projectType: workflowContext.projectType };
  }

  /**
   * Execute git management task
   */
  private async executeGitTask(task: Task, workflowContext: WorkflowContext): Promise<any> {
    const reactAgent = new ReActAgent(this.context, workflowContext.projectPath);
    
    const enhancedPrompt = `Git Management Task: ${task.description}
    
Focus on:
- Repository status and health
- Uncommitted changes
- Branch information
- Recent commits
- Potential conflicts or issues`;

    const result = await reactAgent.processRequest(enhancedPrompt);
    return { type: 'git_management', result };
  }

  /**
   * Execute research task
   */
  private async executeResearchTask(task: Task, workflowContext: WorkflowContext): Promise<any> {
    const reactAgent = new ReActAgent(this.context, workflowContext.projectPath);
    
    const enhancedPrompt = `Research Task: ${task.description}
    
Use available research tools to:
- Find relevant documentation
- Search for best practices
- Look up error solutions
- Research patterns and examples

Project Context: ${workflowContext.projectType || 'Unknown'}`;

    const result = await reactAgent.processRequest(enhancedPrompt);
    return { type: 'research', result };
  }

  /**
   * Execute problem solving task
   */
  private async executeProblemSolvingTask(task: Task, workflowContext: WorkflowContext): Promise<any> {
    const reactAgent = new ReActAgent(this.context, workflowContext.projectPath);
    
    const enhancedPrompt = `Problem Solving Task: ${task.description}
    
Approach:
1. Identify the root cause of the problem
2. Analyze potential solutions
3. Recommend the best approach
4. Consider implementation steps
5. Anticipate potential issues

Context: ${JSON.stringify(task.context || {})}
Previous Attempts: ${workflowContext.failedTasks.filter(t => t.description.includes(task.description.split(' ')[0])).length}`;

    const result = await reactAgent.processRequest(enhancedPrompt);
    return { type: 'problem_solving', result };
  }

  /**
   * Execute task with ReAct agent as fallback
   */
  private async executeWithReActAgent(task: Task, workflowContext: WorkflowContext): Promise<any> {
    const reactAgent = new ReActAgent(this.context, workflowContext.projectPath);
    const result = await reactAgent.processRequest(task.description);
    return { type: 'general', result };
  }

  /**
   * Check for new tasks that may be enabled by task completion
   */
  private async checkForNewTasks(workflowContext: WorkflowContext, completedTask: Task): Promise<void> {
    // Use proactive task suggester to identify follow-up tasks
    const suggestions = await this.taskSuggester.generateFollowupTasks(
      completedTask,
      workflowContext
    );

    // Add high-value suggestions as new tasks
    const newTasks = suggestions
      .filter(s => s.confidence > 0.7)
      .map(s => this.createTask(s.description, s.priority, []));

    workflowContext.taskQueue.push(...newTasks);
    
    if (newTasks.length > 0) {
      logger.info(`🔍 Added ${newTasks.length} proactive follow-up tasks`);
    }
  }

  /**
   * Record agent performance for learning
   */
  private recordAgentPerformance(
    agent: Agent, 
    task: Task, 
    success: boolean, 
    result: any
  ): void {
    const performance: AgentPerformance = {
      taskId: task.id,
      success,
      duration: Date.now() - task.updatedAt,
      complexity: task.actualComplexity || task.estimatedComplexity,
      quality: this.assessResultQuality(result, success),
      timestamp: Date.now()
    };

    agent.performanceHistory.push(performance);
    
    // Keep only last 50 performance records
    if (agent.performanceHistory.length > 50) {
      agent.performanceHistory.shift();
    }
  }

  /**
   * Assess the quality of a task result
   */
  private assessResultQuality(result: any, success: boolean): number {
    if (!success) return 0;
    
    let quality = 0.5; // Base quality for successful completion
    
    if (typeof result === 'object' && result.result) {
      const resultText = result.result.toString();
      
      // Assess based on content richness
      if (resultText.length > 500) quality += 0.2;
      if (resultText.includes('Analysis') || resultText.includes('Found')) quality += 0.1;
      if (resultText.includes('Recommendation') || resultText.includes('Suggestion')) quality += 0.1;
      if (result.learnings && result.learnings.length > 0) quality += 0.1;
    }
    
    return Math.min(quality, 1.0);
  }

  /**
   * Update workflow confidence based on progress
   */
  private updateWorkflowConfidence(workflowContext: WorkflowContext): void {
    const total = workflowContext.completedTasks.length + workflowContext.failedTasks.length;
    if (total === 0) return;
    
    const successRate = workflowContext.completedTasks.length / total;
    const qualityScore = workflowContext.completedTasks.reduce((sum, task) => 
      sum + (task.result?.quality || 0.5), 0) / Math.max(workflowContext.completedTasks.length, 1);
    
    workflowContext.confidence = (successRate * 0.7) + (qualityScore * 0.3);
  }

  /**
   * Synthesize workflow results using voice system
   */
  private async synthesizeWorkflowResults(results: any[], workflowContext: WorkflowContext): Promise<any> {
    const synthesisPrompt = `Synthesize the following autonomous workflow results into a comprehensive response:

${results.map((result, index) => `
## Result ${index + 1}: ${result.type}
${JSON.stringify(result.result, null, 2)}
`).join('\n')}

Workflow Context:
- Completed Tasks: ${workflowContext.completedTasks.length}
- Failed Tasks: ${workflowContext.failedTasks.length}
- Confidence: ${Math.round(workflowContext.confidence * 100)}%
- Project Type: ${workflowContext.projectType || 'Unknown'}

Provide a unified, actionable response that:
1. Summarizes key findings
2. Highlights important issues or opportunities
3. Provides clear recommendations
4. Suggests next steps`;

    // Use competitive synthesis for best results
    const voiceResponses = await this.voiceSystem.generateMultiVoiceSolutions(
      synthesisPrompt,
      ['analyzer', 'maintainer', 'architect'],
      { files: [] }
    );

    const synthesis = await this.voiceSystem.synthesizeVoiceResponses(
      voiceResponses,
      'competitive'
    );

    return {
      type: 'workflow_synthesis',
      result: synthesis.combinedCode,
      reasoning: synthesis.reasoning,
      confidence: synthesis.confidence,
      qualityScore: synthesis.qualityScore,
      workflowStats: {
        completedTasks: workflowContext.completedTasks.length,
        failedTasks: workflowContext.failedTasks.length,
        overallConfidence: workflowContext.confidence
      }
    };
  }

  /**
   * Initialize workflow context for a new session
   */
  private async initializeWorkflowContext(
    userInput: string,
    projectPath: string,
    sessionId: string,
    options: any
  ): Promise<WorkflowContext> {
    // Load relevant memories from past interactions
    const relevantMemories = await this.memorySystem.retrieveRelevantMemories(
      userInput,
      projectPath
    );

    return {
      userId: options.userId || 'anonymous',
      sessionId,
      projectPath,
      goals: [userInput],
      taskQueue: [],
      completedTasks: [],
      failedTasks: [],
      memory: new Map(relevantMemories.map(m => [m.key, m.value])),
      learnings: [],
      confidence: 1.0,
      timestamp: Date.now()
    };
  }

  /**
   * Create a new task
   */
  private createTask(
    description: string,
    priority: Task['priority'] = 'medium',
    dependencies: string[] = [],
    estimatedComplexity: number = 5
  ): Task {
    return {
      id: `task_${++this.taskIdCounter}`,
      description,
      priority,
      status: 'pending',
      dependencies,
      context: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      estimatedComplexity,
      errorCount: 0,
      maxRetries: 3
    };
  }

  /**
   * Extract learnings from task results
   */
  private extractLearnings(result: string, taskType: string): any[] {
    const learnings: any[] = [];
    
    // Simple pattern-based learning extraction
    if (result.includes('Error') || result.includes('Issue')) {
      learnings.push({
        type: 'error_pattern',
        category: taskType,
        summary: 'Identified potential issues',
        details: result.slice(0, 200),
        timestamp: Date.now()
      });
    }
    
    if (result.includes('Recommendation') || result.includes('Suggest')) {
      learnings.push({
        type: 'best_practice',
        category: taskType,
        summary: 'Found improvement recommendations',
        details: result.slice(0, 200),
        timestamp: Date.now()
      });
    }
    
    return learnings;
  }

  /**
   * Infer project type from exploration results
   */
  private inferProjectType(result: string): string {
    const resultLower = result.toLowerCase();
    
    if (resultLower.includes('package.json') && resultLower.includes('node')) {
      return 'node.js';
    }
    if (resultLower.includes('tsconfig.json') || resultLower.includes('typescript')) {
      return 'typescript';
    }
    if (resultLower.includes('react') || resultLower.includes('jsx')) {
      return 'react';
    }
    if (resultLower.includes('python') || resultLower.includes('.py')) {
      return 'python';
    }
    if (resultLower.includes('java') || resultLower.includes('.java')) {
      return 'java';
    }
    
    return 'general';
  }

  /**
   * Format the final agentic response
   */
  private formatAgenticResponse(
    result: any,
    suggestions: any[],
    workflowContext: WorkflowContext
  ): string {
    let response = `## 🤖 Autonomous Agentic Analysis Complete

**Workflow Summary:**
- ✅ Completed Tasks: ${workflowContext.completedTasks.length}
- ❌ Failed Tasks: ${workflowContext.failedTasks.length}
- 🎯 Confidence Score: ${Math.round(workflowContext.confidence * 100)}%
- 📁 Project Type: ${workflowContext.projectType || 'Unknown'}

**Analysis Results:**
${typeof result.result === 'string' ? result.result : JSON.stringify(result, null, 2)}
`;

    // Include codebase analysis if available
    const codebaseAnalysis = workflowContext.memory.get('codebase_analysis');
    if (codebaseAnalysis) {
      response += `
**🔍 Autonomous Codebase Analysis:**

**Project Structure:**
- Total Files: ${codebaseAnalysis.structure.totalFiles}
- Total Lines: ${codebaseAnalysis.structure.totalLines.toLocaleString()}
- Languages: ${Object.entries(codebaseAnalysis.structure.fileTypes)
  .map(([lang, count]) => `${lang} (${count})`)
  .join(', ')}

**Architecture Patterns:**
${codebaseAnalysis.architecture.patterns.length > 0 
  ? codebaseAnalysis.architecture.patterns.map((p: string) => `- ${p}`).join('\n')
  : '- No specific patterns detected'}

**Code Quality:**
- Modularity: ${codebaseAnalysis.architecture.modularity}
- Test Coverage: ${codebaseAnalysis.codeQuality.testCoverage.toFixed(1)}%
- Maintainability Index: ${codebaseAnalysis.codeQuality.maintainabilityIndex.toFixed(1)}/100

**Key Directories:**
${codebaseAnalysis.structure.directories
  .filter((d: any) => d.importance === 'high')
  .map((d: any) => `- ${d.path} (${d.fileCount} files) - ${d.purpose}`)
  .join('\n')}

**Improvement Suggestions:**
${codebaseAnalysis.suggestions.length > 0
  ? codebaseAnalysis.suggestions
      .slice(0, 5) // Show top 5 suggestions
      .map((s: any) => `- **${s.title}** (${s.priority}): ${s.description}`)
      .join('\n')
  : '- No immediate improvements suggested'}
`;
    }

    if (result.reasoning) {
      response += `\n**AI Reasoning:**
${result.reasoning}`;
    }

    if (suggestions.length > 0) {
      response += `\n**🔮 Proactive Suggestions:**
${suggestions.map(s => `- ${s.description} (Priority: ${s.priority}, Confidence: ${Math.round(s.confidence * 100)}%)`).join('\n')}`;
    }

    if (workflowContext.learnings.length > 0) {
      response += `\n**📚 Learnings Captured:**
${workflowContext.learnings.map(l => `- ${l.summary}`).join('\n')}`;
    }

    response += `\n\n*This analysis was performed autonomously using ${this.agents.size} specialized AI agents with self-correction and learning capabilities.*`;

    return response;
  }

  /**
   * Check if request requires autonomous codebase analysis
   */
  private shouldRunCodebaseAnalysis(userInput: string, intent: any): boolean {
    const analysisKeywords = [
      'analyze', 'structure', 'architecture', 'codebase', 'project',
      'files', 'organization', 'patterns', 'framework', 'overview',
      'examine', 'review', 'assess', 'evaluate', 'inspect'
    ];
    
    const input = userInput.toLowerCase();
    const intentCategory = intent.category?.toLowerCase() || '';
    
    // Check if input contains analysis keywords
    const hasAnalysisKeywords = analysisKeywords.some(keyword => 
      input.includes(keyword)
    );
    
    // Check if intent is related to analysis
    const isAnalysisIntent = ['analysis', 'architecture_design', 'code_review'].includes(intentCategory);
    
    return hasAnalysisKeywords || isAnalysisIntent;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get workflow statistics
   */
  getWorkflowStats(): any {
    const allWorkflows = Array.from(this.workflows.values());
    
    return {
      activeWorkflows: allWorkflows.length,
      totalAgents: this.agents.size,
      agentPerformance: Array.from(this.agents.entries()).map(([id, agent]) => ({
        id,
        name: agent.name,
        isAvailable: agent.isAvailable,
        totalTasks: agent.performanceHistory.length,
        successRate: agent.performanceHistory.length > 0 
          ? agent.performanceHistory.filter(p => p.success).length / agent.performanceHistory.length 
          : 0,
        avgQuality: agent.performanceHistory.length > 0
          ? agent.performanceHistory.reduce((sum, p) => sum + p.quality, 0) / agent.performanceHistory.length
          : 0
      }))
    };
  }
}