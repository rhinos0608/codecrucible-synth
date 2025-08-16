import { LocalModelClient } from './local-model-client.js';
import { AgentMemorySystem } from './agent-memory-system.js';
import { logger } from './logger.js';
import { Task, WorkflowContext } from './agent-orchestrator.js';

export interface TaskSuggestion {
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  reasoning: string;
  category: string;
  estimatedBenefit: number;
  estimatedEffort: number;
  dependencies: string[];
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
}

export interface ProactiveContext {
  recentTasks: Task[];
  projectState: any;
  userPatterns: any;
  systemPerformance: any;
}

/**
 * Proactive Task Suggestion System
 * 
 * Intelligently suggests next steps and improvements based on:
 * - Current project state and context
 * - User behavior patterns and preferences
 * - Best practices and optimization opportunities
 * - Past successful workflows and outcomes
 * - System performance and health metrics
 */
export class ProactiveTaskSuggester {
  private model: LocalModelClient;
  private memory: AgentMemorySystem;
  private suggestionPatterns: Map<string, TaskSuggestion[]> = new Map();

  constructor(model: LocalModelClient, memory: AgentMemorySystem) {
    this.model = model;
    this.memory = memory;
    this.initializeSuggestionPatterns();
  }

  /**
   * Initialize common suggestion patterns based on project states
   */
  private initializeSuggestionPatterns(): void {
    const patterns = new Map<string, TaskSuggestion[]>([
      ['after_code_analysis', [
        {
          description: 'Run comprehensive linting to identify code quality issues',
          priority: 'medium',
          confidence: 0.8,
          reasoning: 'Code analysis often reveals areas that need linting verification',
          category: 'quality_assurance',
          estimatedBenefit: 7,
          estimatedEffort: 3,
          dependencies: [],
          timeframe: 'immediate'
        },
        {
          description: 'Check git status for uncommitted changes and repository health',
          priority: 'medium',
          confidence: 0.7,
          reasoning: 'After analyzing code, it\'s good practice to check version control status',
          category: 'version_control',
          estimatedBenefit: 6,
          estimatedEffort: 2,
          dependencies: [],
          timeframe: 'immediate'
        },
        {
          description: 'Generate or update documentation based on code analysis findings',
          priority: 'low',
          confidence: 0.6,
          reasoning: 'Code analysis may reveal areas where documentation is needed',
          category: 'documentation',
          estimatedBenefit: 8,
          estimatedEffort: 6,
          dependencies: [],
          timeframe: 'short_term'
        }
      ]],

      ['after_file_exploration', [
        {
          description: 'Analyze key configuration files (package.json, tsconfig.json, etc.)',
          priority: 'high',
          confidence: 0.9,
          reasoning: 'After exploring structure, configuration analysis provides crucial project insights',
          category: 'configuration_analysis',
          estimatedBenefit: 9,
          estimatedEffort: 4,
          dependencies: [],
          timeframe: 'immediate'
        },
        {
          description: 'Examine main entry points and application structure',
          priority: 'medium',
          confidence: 0.8,
          reasoning: 'Understanding entry points is essential after structural exploration',
          category: 'architecture_analysis',
          estimatedBenefit: 8,
          estimatedEffort: 5,
          dependencies: [],
          timeframe: 'immediate'
        }
      ]],

      ['after_problem_solving', [
        {
          description: 'Write tests to prevent similar issues in the future',
          priority: 'high',
          confidence: 0.8,
          reasoning: 'After solving problems, adding tests helps prevent regression',
          category: 'testing',
          estimatedBenefit: 9,
          estimatedEffort: 7,
          dependencies: [],
          timeframe: 'short_term'
        },
        {
          description: 'Document the solution for future reference',
          priority: 'medium',
          confidence: 0.7,
          reasoning: 'Documenting solutions helps with knowledge management',
          category: 'documentation',
          estimatedBenefit: 7,
          estimatedEffort: 4,
          dependencies: [],
          timeframe: 'short_term'
        },
        {
          description: 'Review related code areas for similar potential issues',
          priority: 'medium',
          confidence: 0.6,
          reasoning: 'Problems often indicate systemic issues worth investigating',
          category: 'preventive_analysis',
          estimatedBenefit: 8,
          estimatedEffort: 6,
          dependencies: [],
          timeframe: 'medium_term'
        }
      ]],

      ['after_refactoring', [
        {
          description: 'Run comprehensive tests to ensure functionality is preserved',
          priority: 'critical',
          confidence: 0.95,
          reasoning: 'Refactoring requires thorough testing to prevent regressions',
          category: 'testing',
          estimatedBenefit: 10,
          estimatedEffort: 5,
          dependencies: [],
          timeframe: 'immediate'
        },
        {
          description: 'Performance benchmark to measure refactoring impact',
          priority: 'medium',
          confidence: 0.7,
          reasoning: 'Refactoring often aims to improve performance - should be measured',
          category: 'performance',
          estimatedBenefit: 8,
          estimatedEffort: 4,
          dependencies: [],
          timeframe: 'short_term'
        }
      ]],

      ['multiple_failures', [
        {
          description: 'Simplify approach and break down complex tasks into smaller steps',
          priority: 'high',
          confidence: 0.9,
          reasoning: 'Multiple failures often indicate tasks are too complex',
          category: 'process_improvement',
          estimatedBenefit: 9,
          estimatedEffort: 3,
          dependencies: [],
          timeframe: 'immediate'
        },
        {
          description: 'Review system logs and error patterns for systematic issues',
          priority: 'high',
          confidence: 0.8,
          reasoning: 'Multiple failures may indicate underlying system problems',
          category: 'system_analysis',
          estimatedBenefit: 9,
          estimatedEffort: 5,
          dependencies: [],
          timeframe: 'immediate'
        }
      ]],

      ['low_confidence_results', [
        {
          description: 'Seek additional context or clarification on requirements',
          priority: 'medium',
          confidence: 0.8,
          reasoning: 'Low confidence often indicates unclear or insufficient requirements',
          category: 'requirements_clarification',
          estimatedBenefit: 8,
          estimatedEffort: 3,
          dependencies: [],
          timeframe: 'immediate'
        },
        {
          description: 'Research best practices and alternative approaches',
          priority: 'medium',
          confidence: 0.7,
          reasoning: 'Low confidence suggests need for more research and options',
          category: 'research',
          estimatedBenefit: 7,
          estimatedEffort: 6,
          dependencies: [],
          timeframe: 'short_term'
        }
      ]]
    ]);

    this.suggestionPatterns = patterns;
    logger.info(`🔮 Initialized ${patterns.size} proactive suggestion patterns`);
  }

  /**
   * Generate contextual suggestions based on current workflow state
   */
  async generateSuggestions(
    workflowContext: WorkflowContext,
    recentResult: any
  ): Promise<TaskSuggestion[]> {
    try {
      const suggestions: TaskSuggestion[] = [];

      // Analyze current context
      const context = await this.analyzeProactiveContext(workflowContext, recentResult);

      // Generate pattern-based suggestions
      const patternSuggestions = this.generatePatternBasedSuggestions(context, workflowContext);
      suggestions.push(...patternSuggestions);

      // Generate AI-based suggestions for novel situations
      const aiSuggestions = await this.generateAISuggestions(context, workflowContext);
      suggestions.push(...aiSuggestions);

      // Generate memory-based suggestions from past successful workflows
      const memorySuggestions = await this.generateMemoryBasedSuggestions(context, workflowContext);
      suggestions.push(...memorySuggestions);

      // Deduplicate and rank suggestions
      const rankedSuggestions = this.rankAndDeduplicateSuggestions(suggestions);

      logger.info(`🔮 Generated ${rankedSuggestions.length} proactive suggestions`);
      return rankedSuggestions.slice(0, 5); // Return top 5

    } catch (error) {
      logger.error('Failed to generate proactive suggestions:', error);
      return this.generateFallbackSuggestions(workflowContext);
    }
  }

  /**
   * Generate follow-up tasks based on a completed task
   */
  async generateFollowupTasks(
    completedTask: Task,
    workflowContext: WorkflowContext
  ): Promise<TaskSuggestion[]> {
    try {
      const followups: TaskSuggestion[] = [];

      // Determine task completion context
      const completionContext = this.analyzeTaskCompletion(completedTask, workflowContext);

      // Get pattern-based follow-ups
      const patternFollowups = this.getPatternBasedFollowups(completionContext, completedTask);
      followups.push(...patternFollowups);

      // Generate AI-suggested follow-ups
      const aiFollowups = await this.generateAIFollowups(completedTask, workflowContext);
      followups.push(...aiFollowups);

      // Rank by relevance and importance
      return this.rankSuggestions(followups).slice(0, 3); // Top 3 follow-ups

    } catch (error) {
      logger.error('Failed to generate follow-up tasks:', error);
      return [];
    }
  }

  /**
   * Analyze context for proactive suggestions
   */
  private async analyzeProactiveContext(
    workflowContext: WorkflowContext,
    recentResult: any
  ): Promise<ProactiveContext> {
    const context: ProactiveContext = {
      recentTasks: [...workflowContext.completedTasks, ...workflowContext.failedTasks].slice(-5),
      projectState: {
        type: workflowContext.projectType,
        confidence: workflowContext.confidence,
        totalTasks: workflowContext.completedTasks.length + workflowContext.failedTasks.length,
        successRate: workflowContext.completedTasks.length / 
          Math.max(1, workflowContext.completedTasks.length + workflowContext.failedTasks.length),
        hasFailures: workflowContext.failedTasks.length > 0,
        recentResult: recentResult
      },
      userPatterns: await this.analyzeUserPatterns(workflowContext),
      systemPerformance: this.analyzeSystemPerformance(workflowContext)
    };

    return context;
  }

  /**
   * Analyze user behavior patterns
   */
  private async analyzeUserPatterns(workflowContext: WorkflowContext): Promise<any> {
    try {
      // Retrieve user's historical patterns from memory
      const userMemories = await this.memory.retrieveRelevantMemories(
        workflowContext.goals.join(' '),
        workflowContext.projectPath,
        10
      );

      const patterns = {
        preferredTaskTypes: this.extractPreferredTaskTypes(workflowContext.completedTasks),
        commonWorkflows: this.identifyCommonWorkflows(workflowContext.completedTasks),
        urgencyPatterns: this.analyzeUrgencyPatterns(workflowContext.completedTasks),
        historicalSuccesses: userMemories.filter(m => m.key.includes('successful'))
      };

      return patterns;

    } catch (error) {
      logger.warn('Failed to analyze user patterns:', error);
      return { preferredTaskTypes: [], commonWorkflows: [], urgencyPatterns: {} };
    }
  }

  /**
   * Analyze system performance metrics
   */
  private analyzeSystemPerformance(workflowContext: WorkflowContext): any {
    const totalTasks = workflowContext.completedTasks.length + workflowContext.failedTasks.length;
    
    return {
      overallSuccessRate: totalTasks > 0 ? workflowContext.completedTasks.length / totalTasks : 1.0,
      averageTaskComplexity: this.calculateAverageComplexity(workflowContext.completedTasks),
      recentPerformanceTrend: this.calculatePerformanceTrend(workflowContext),
      systemLoad: totalTasks,
      confidence: workflowContext.confidence
    };
  }

  /**
   * Generate pattern-based suggestions
   */
  private generatePatternBasedSuggestions(
    context: ProactiveContext,
    workflowContext: WorkflowContext
  ): TaskSuggestion[] {
    const suggestions: TaskSuggestion[] = [];

    // Analyze recent task patterns
    const recentTaskTypes = context.recentTasks.map(t => 
      this.categorizeTask(t.description)
    );

    // Check for applicable patterns
    for (const [patternKey, patternSuggestions] of this.suggestionPatterns.entries()) {
      if (this.isPatternApplicable(patternKey, context, workflowContext)) {
        suggestions.push(...patternSuggestions);
      }
    }

    // Add context-specific adjustments
    return suggestions.map(suggestion => ({
      ...suggestion,
      confidence: this.adjustConfidenceForContext(suggestion.confidence, context)
    }));
  }

  /**
   * Generate AI-based suggestions for novel situations
   */
  private async generateAISuggestions(
    context: ProactiveContext,
    workflowContext: WorkflowContext
  ): Promise<TaskSuggestion[]> {
    const suggestionPrompt = `Based on the current workflow context, suggest 3-5 proactive next steps that would add value:

WORKFLOW CONTEXT:
- Completed Tasks: ${workflowContext.completedTasks.length}
- Failed Tasks: ${workflowContext.failedTasks.length}
- Overall Confidence: ${Math.round(workflowContext.confidence * 100)}%
- Project Type: ${workflowContext.projectType || 'Unknown'}

RECENT TASKS:
${context.recentTasks.slice(-3).map(t => `- ${t.description} (${t.status})`).join('\n')}

PROJECT STATE:
- Success Rate: ${Math.round(context.projectState.successRate * 100)}%
- System Performance: ${context.systemPerformance.confidence > 0.8 ? 'Good' : 'Needs Improvement'}

TASK PATTERNS:
${context.userPatterns.preferredTaskTypes?.slice(0, 3).join(', ') || 'No clear patterns'}

Based on this context, suggest valuable next steps that would:
1. Build on current progress
2. Address potential issues or gaps
3. Improve overall project quality
4. Leverage best practices

Respond with JSON array:
[
  {
    "description": "specific actionable task",
    "priority": "low|medium|high|critical",
    "confidence": 0.0-1.0,
    "reasoning": "why this task adds value",
    "category": "task_category",
    "estimatedBenefit": 1-10,
    "estimatedEffort": 1-10,
    "timeframe": "immediate|short_term|medium_term|long_term"
  }
]`;

    try {
      const response = await this.model.generate(suggestionPrompt);
      return this.parseAISuggestions(response);

    } catch (error) {
      logger.warn('AI suggestion generation failed:', error);
      return [];
    }
  }

  /**
   * Generate suggestions based on memory patterns
   */
  private async generateMemoryBasedSuggestions(
    context: ProactiveContext,
    workflowContext: WorkflowContext
  ): Promise<TaskSuggestion[]> {
    try {
      // Look for similar successful workflows in memory
      const similarWorkflows = await this.memory.retrieveMemories({
        category: 'successful_workflow',
        projectPath: workflowContext.projectPath,
        minConfidence: 0.7,
        limit: 5
      });

      const suggestions: TaskSuggestion[] = [];

      for (const memory of similarWorkflows) {
        if (memory.value && memory.value.nextSteps && Array.isArray(memory.value.nextSteps)) {
          for (const step of memory.value.nextSteps) {
            suggestions.push({
              description: step.description || step,
              priority: step.priority || 'medium',
              confidence: memory.confidence * 0.8, // Slightly reduce confidence for memory-based
              reasoning: `Based on similar successful workflow: ${memory.key}`,
              category: step.category || 'general',
              estimatedBenefit: step.benefit || 6,
              estimatedEffort: step.effort || 4,
              dependencies: [],
              timeframe: step.timeframe || 'short_term'
            });
          }
        }
      }

      return suggestions;

    } catch (error) {
      logger.warn('Memory-based suggestion generation failed:', error);
      return [];
    }
  }

  /**
   * Generate follow-up tasks using AI analysis
   */
  private async generateAIFollowups(
    completedTask: Task,
    workflowContext: WorkflowContext
  ): Promise<TaskSuggestion[]> {
    const followupPrompt = `A task was just completed. Suggest logical next steps:

COMPLETED TASK:
- Description: "${completedTask.description}"
- Priority: ${completedTask.priority}
- Complexity: ${completedTask.estimatedComplexity}/10
- Result: ${completedTask.result ? JSON.stringify(completedTask.result).slice(0, 200) : 'No result available'}

WORKFLOW CONTEXT:
- Total Completed: ${workflowContext.completedTasks.length}
- Project Type: ${workflowContext.projectType || 'Unknown'}
- Current Confidence: ${Math.round(workflowContext.confidence * 100)}%

What are 2-3 logical next steps that would:
1. Build on this task's results
2. Add value to the project
3. Follow best practices

Respond with JSON array:
[
  {
    "description": "specific follow-up task",
    "priority": "low|medium|high",
    "confidence": 0.0-1.0,
    "reasoning": "why this follows logically",
    "category": "category",
    "estimatedBenefit": 1-10,
    "estimatedEffort": 1-10
  }
]`;

    try {
      const response = await this.model.generate(followupPrompt);
      return this.parseAISuggestions(response);

    } catch (error) {
      logger.warn('AI follow-up generation failed:', error);
      return [];
    }
  }

  /**
   * Parse AI suggestions from response
   */
  private parseAISuggestions(response: string): TaskSuggestion[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed.map(item => ({
        description: item.description || 'AI-suggested task',
        priority: item.priority || 'medium',
        confidence: Math.max(0, Math.min(1, item.confidence || 0.6)),
        reasoning: item.reasoning || 'AI analysis',
        category: item.category || 'general',
        estimatedBenefit: Math.max(1, Math.min(10, item.estimatedBenefit || 5)),
        estimatedEffort: Math.max(1, Math.min(10, item.estimatedEffort || 5)),
        dependencies: [],
        timeframe: item.timeframe || 'short_term'
      }));

    } catch (error) {
      logger.warn('Failed to parse AI suggestions:', error);
      return [];
    }
  }

  /**
   * Rank and deduplicate suggestions
   */
  private rankAndDeduplicateSuggestions(suggestions: TaskSuggestion[]): TaskSuggestion[] {
    // Remove duplicates based on description similarity
    const unique = this.deduplicateSuggestions(suggestions);
    
    // Rank by value score
    return this.rankSuggestions(unique);
  }

  /**
   * Remove duplicate suggestions
   */
  private deduplicateSuggestions(suggestions: TaskSuggestion[]): TaskSuggestion[] {
    const seen = new Set<string>();
    const unique: TaskSuggestion[] = [];

    for (const suggestion of suggestions) {
      const key = this.createSuggestionKey(suggestion);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(suggestion);
      }
    }

    return unique;
  }

  /**
   * Create a unique key for suggestion deduplication
   */
  private createSuggestionKey(suggestion: TaskSuggestion): string {
    // Use first few words of description and category
    const descWords = suggestion.description.toLowerCase().split(' ').slice(0, 4).join(' ');
    return `${suggestion.category}:${descWords}`;
  }

  /**
   * Rank suggestions by value score
   */
  private rankSuggestions(suggestions: TaskSuggestion[]): TaskSuggestion[] {
    return suggestions
      .map(suggestion => ({
        ...suggestion,
        valueScore: this.calculateValueScore(suggestion)
      }))
      .sort((a, b) => (b as any).valueScore - (a as any).valueScore);
  }

  /**
   * Calculate value score for ranking
   */
  private calculateValueScore(suggestion: TaskSuggestion): number {
    let score = 0;

    // Base score from confidence
    score += suggestion.confidence * 30;

    // Benefit/effort ratio
    const efficiency = suggestion.estimatedBenefit / Math.max(1, suggestion.estimatedEffort);
    score += efficiency * 20;

    // Priority weighting
    const priorityWeights = { critical: 25, high: 20, medium: 15, low: 10 };
    score += priorityWeights[suggestion.priority];

    // Timeframe weighting (immediate tasks get boost)
    const timeframeWeights = { immediate: 15, short_term: 10, medium_term: 5, long_term: 2 };
    score += timeframeWeights[suggestion.timeframe];

    // Category weighting (some categories are more valuable)
    const categoryWeights: Record<string, number> = {
      'quality_assurance': 10,
      'testing': 12,
      'performance': 8,
      'security': 15,
      'documentation': 6,
      'general': 5
    };
    score += categoryWeights[suggestion.category] || 5;

    return score;
  }

  /**
   * Helper methods for pattern analysis
   */
  private isPatternApplicable(
    patternKey: string,
    context: ProactiveContext,
    workflowContext: WorkflowContext
  ): boolean {
    switch (patternKey) {
      case 'after_code_analysis':
        return context.recentTasks.some(t => 
          t.description.toLowerCase().includes('analyz') ||
          t.description.toLowerCase().includes('review')
        );
      
      case 'after_file_exploration':
        return context.recentTasks.some(t => 
          t.description.toLowerCase().includes('explor') ||
          t.description.toLowerCase().includes('list') ||
          t.description.toLowerCase().includes('structure')
        );
      
      case 'after_problem_solving':
        return context.recentTasks.some(t => 
          t.description.toLowerCase().includes('fix') ||
          t.description.toLowerCase().includes('solve') ||
          t.description.toLowerCase().includes('debug')
        );
      
      case 'multiple_failures':
        return workflowContext.failedTasks.length >= 2;
      
      case 'low_confidence_results':
        return workflowContext.confidence < 0.6;
      
      default:
        return false;
    }
  }

  /**
   * Additional helper methods
   */
  private categorizeTask(description: string): string {
    const desc = description.toLowerCase();
    
    if (desc.includes('analyz') || desc.includes('review')) return 'analysis';
    if (desc.includes('explor') || desc.includes('list')) return 'exploration';
    if (desc.includes('fix') || desc.includes('debug')) return 'problem_solving';
    if (desc.includes('test')) return 'testing';
    if (desc.includes('document')) return 'documentation';
    if (desc.includes('refactor')) return 'refactoring';
    
    return 'general';
  }

  private adjustConfidenceForContext(baseConfidence: number, context: ProactiveContext): number {
    let adjusted = baseConfidence;
    
    // Boost confidence for high-performing contexts
    if (context.systemPerformance.overallSuccessRate > 0.8) {
      adjusted += 0.1;
    }
    
    // Reduce confidence for underperforming contexts
    if (context.systemPerformance.overallSuccessRate < 0.5) {
      adjusted -= 0.2;
    }
    
    return Math.max(0.1, Math.min(1.0, adjusted));
  }

  private extractPreferredTaskTypes(tasks: Task[]): string[] {
    const typeCounts = new Map<string, number>();
    
    tasks.forEach(task => {
      const type = this.categorizeTask(task.description);
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });
    
    return Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type)
      .slice(0, 3);
  }

  private identifyCommonWorkflows(tasks: Task[]): string[] {
    // Simplified workflow identification
    const workflows: string[] = [];
    
    if (tasks.some(t => t.description.includes('explor')) && 
        tasks.some(t => t.description.includes('analyz'))) {
      workflows.push('exploration_then_analysis');
    }
    
    return workflows;
  }

  private analyzeUrgencyPatterns(tasks: Task[]): any {
    const priorityCounts = tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      mostCommonPriority: Object.entries(priorityCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'medium',
      priorityDistribution: priorityCounts
    };
  }

  private calculateAverageComplexity(tasks: Task[]): number {
    if (tasks.length === 0) return 5;
    
    const total = tasks.reduce((sum, task) => sum + task.estimatedComplexity, 0);
    return total / tasks.length;
  }

  private calculatePerformanceTrend(workflowContext: WorkflowContext): string {
    const recentTasks = [...workflowContext.completedTasks, ...workflowContext.failedTasks]
      .slice(-5);
    
    if (recentTasks.length < 3) return 'insufficient_data';
    
    const recentSuccesses = recentTasks.filter(t => t.status === 'completed').length;
    const successRate = recentSuccesses / recentTasks.length;
    
    if (successRate > 0.8) return 'improving';
    if (successRate < 0.4) return 'declining';
    return 'stable';
  }

  private analyzeTaskCompletion(task: Task, workflowContext: WorkflowContext): string {
    const category = this.categorizeTask(task.description);
    const hasFollowupNeeds = task.result && 
      (task.result.issues || task.result.recommendations || task.result.nextSteps);
    
    if (hasFollowupNeeds) return `${category}_with_followups`;
    return `${category}_completed`;
  }

  private getPatternBasedFollowups(
    completionContext: string,
    completedTask: Task
  ): TaskSuggestion[] {
    // Map completion contexts to follow-up patterns
    const followupMap: Record<string, TaskSuggestion[]> = {
      'analysis_completed': [
        {
          description: 'Implement fixes for identified issues',
          priority: 'high',
          confidence: 0.8,
          reasoning: 'Analysis typically reveals actionable improvements',
          category: 'implementation',
          estimatedBenefit: 8,
          estimatedEffort: 6,
          dependencies: [completedTask.id],
          timeframe: 'short_term'
        }
      ],
      'exploration_completed': [
        {
          description: 'Deep dive analysis of key components identified',
          priority: 'medium',
          confidence: 0.7,
          reasoning: 'Exploration should be followed by detailed analysis',
          category: 'analysis',
          estimatedBenefit: 7,
          estimatedEffort: 5,
          dependencies: [completedTask.id],
          timeframe: 'immediate'
        }
      ]
    };
    
    return followupMap[completionContext] || [];
  }

  private generateFallbackSuggestions(workflowContext: WorkflowContext): TaskSuggestion[] {
    return [
      {
        description: 'Review and consolidate completed work',
        priority: 'medium',
        confidence: 0.6,
        reasoning: 'General consolidation is always valuable',
        category: 'review',
        estimatedBenefit: 6,
        estimatedEffort: 3,
        dependencies: [],
        timeframe: 'short_term'
      },
      {
        description: 'Check for any remaining issues or improvements',
        priority: 'low',
        confidence: 0.5,
        reasoning: 'Fallback suggestion for continuous improvement',
        category: 'quality_assurance',
        estimatedBenefit: 5,
        estimatedEffort: 4,
        dependencies: [],
        timeframe: 'medium_term'
      }
    ];
  }
}