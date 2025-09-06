/**
 * Execution Orchestration Domain Service
 * Pure business logic for orchestrating AI executions
 *
 * Living Spiral Council Applied:
 * - Domain service pattern for complex business operations
 * - No infrastructure dependencies
 * - Encapsulates business rules that don't belong in entities
 */

import {
  Domain,
  ExecutionPlan,
  Goal,
  SelectedTools,
  StepEstimate,
} from '../entities/execution-plan.js';
import { ConfidenceScore, ReasoningStep, ToolArguments } from '../entities/reasoning-step.js';
import { WorkflowTemplate } from '../entities/workflow-template.js';

/**
 * Execution Context Value Object
 */
export class ExecutionContext {
  private constructor(
    private readonly _executionId: string,
    private readonly _originalPrompt: string,
    private readonly _availableTools: readonly string[],
    private readonly _maxSteps: number,
    private readonly _timeoutMs: number,
    private readonly _userPreferences: ExecutionPreferences
  ) {}

  public static create(
    executionId: string,
    originalPrompt: string,
    availableTools: readonly string[],
    maxSteps: number = 10,
    timeoutMs: number = 300000,
    preferences: ExecutionPreferences = ExecutionPreferences.balanced()
  ): ExecutionContext {
    return new ExecutionContext(
      executionId,
      originalPrompt,
      Object.freeze([...availableTools]),
      maxSteps,
      timeoutMs,
      preferences
    );
  }

  public get executionId(): string {
    return this._executionId;
  }
  public get originalPrompt(): string {
    return this._originalPrompt;
  }
  public get availableTools(): readonly string[] {
    return this._availableTools;
  }
  public get maxSteps(): number {
    return this._maxSteps;
  }
  public get timeoutMs(): number {
    return this._timeoutMs;
  }
  public get userPreferences(): ExecutionPreferences {
    return this._userPreferences;
  }

  public hasAvailableTool(toolName: string): boolean {
    return this._availableTools.includes(toolName);
  }
}

/**
 * Execution Preferences Value Object
 */
export class ExecutionPreferences {
  private constructor(
    private readonly _preferSpeed: boolean,
    private readonly _preferQuality: boolean,
    private readonly _allowOptionalSteps: boolean,
    private readonly _maxExecutionTime: number,
    private readonly _confidenceThreshold: number
  ) {}

  public static create(
    preferSpeed: boolean,
    preferQuality: boolean,
    allowOptionalSteps: boolean = true,
    maxExecutionTime: number = 300000,
    confidenceThreshold: number = 0.7
  ): ExecutionPreferences {
    return new ExecutionPreferences(
      preferSpeed,
      preferQuality,
      allowOptionalSteps,
      maxExecutionTime,
      confidenceThreshold
    );
  }

  public static balanced(): ExecutionPreferences {
    return new ExecutionPreferences(false, false, true, 300000, 0.7);
  }

  public static speedFocused(): ExecutionPreferences {
    return new ExecutionPreferences(true, false, false, 120000, 0.6);
  }

  public static qualityFocused(): ExecutionPreferences {
    return new ExecutionPreferences(false, true, true, 600000, 0.8);
  }

  public get preferSpeed(): boolean {
    return this._preferSpeed;
  }
  public get preferQuality(): boolean {
    return this._preferQuality;
  }
  public get allowOptionalSteps(): boolean {
    return this._allowOptionalSteps;
  }
  public get maxExecutionTime(): number {
    return this._maxExecutionTime;
  }
  public get confidenceThreshold(): number {
    return this._confidenceThreshold;
  }
}

/**
 * Execution Result Value Object
 */
export class ExecutionResult {
  private constructor(
    private readonly _success: boolean,
    private readonly _finalResult: string,
    private readonly _reasoningChain: ReadonlyArray<ReasoningStep>,
    private readonly _executionPlan: ExecutionPlan,
    private readonly _totalSteps: number,
    private readonly _executionTime: number,
    private readonly _tokensUsed: number,
    private readonly _streamed: boolean,
    private readonly _insights: ReadonlyArray<string>
  ) {}

  public static create(
    success: boolean,
    finalResult: string,
    reasoningChain: ReadonlyArray<ReasoningStep>,
    executionPlan: ExecutionPlan,
    executionTime: number,
    tokensUsed: number = 0,
    streamed: boolean = false,
    insights: readonly string[] = []
  ): ExecutionResult {
    return new ExecutionResult(
      success,
      finalResult,
      Object.freeze([...reasoningChain]),
      executionPlan,
      reasoningChain.length,
      executionTime,
      tokensUsed,
      streamed,
      Object.freeze([...insights])
    );
  }

  public get success(): boolean {
    return this._success;
  }
  public get finalResult(): string {
    return this._finalResult;
  }
  public get reasoningChain(): readonly ReasoningStep[] {
    return this._reasoningChain;
  }
  public get executionPlan(): ExecutionPlan {
    return this._executionPlan;
  }
  public get totalSteps(): number {
    return this._totalSteps;
  }
  public get executionTime(): number {
    return this._executionTime;
  }
  public get tokensUsed(): number {
    return this._tokensUsed;
  }
  public get streamed(): boolean {
    return this._streamed;
  }
  public get insights(): readonly string[] {
    return this._insights;
  }

  /**
   * Business rule: Check if execution was efficient
   */
  public isEfficient(): boolean {
    const avgTimePerStep = this._executionTime / Math.max(1, this._totalSteps);
    return this._success && avgTimePerStep < 30000; // < 30s per step
  }

  /**
   * Business rule: Get quality score based on success and reasoning
   */
  public calculateQualityScore(): number {
    if (!this._success) return 0;

    let score = 0.4; // Base success score

    // High-confidence steps contribute to quality
    const highConfidenceSteps = this._reasoningChain.filter((step: Readonly<ReasoningStep>) =>
      step.confidence.isHigh()
    ).length;
    score += (highConfidenceSteps / this._totalSteps) * 0.3;

    // Successful tool executions contribute to quality
    const successfulToolSteps = this._reasoningChain.filter(
      (step: Readonly<ReasoningStep>) => step.isToolStep() && step.isSuccessful()
    ).length;
    const totalToolSteps = this._reasoningChain.filter((step: Readonly<ReasoningStep>) => step.isToolStep()).length;

    if (totalToolSteps > 0) {
      score += (successfulToolSteps / totalToolSteps) * 0.3;
    } else {
      score += 0.3; // No tool steps needed, full points
    }

    return Math.min(1.0, score);
  }
}

/**
 * Execution Orchestration Domain Service
 */
export class ExecutionOrchestrationService {
  /**
   * Business rule: Create execution plan from user prompt
   */
  public createExecutionPlan(
    prompt: string,
    availableTools: readonly string[],
    workflowTemplate?: Readonly<WorkflowTemplate>
  ): ExecutionPlan {
    const goal = Goal.create(prompt);
    const domain = this.inferDomainFromPrompt(prompt);
    const complexity = goal.estimateComplexity();

    if (workflowTemplate && workflowTemplate.matches(prompt)) {
      return this.createWorkflowBasedPlan(goal, domain, workflowTemplate as WorkflowTemplate, [...availableTools]);
    }

    return this.createHeuristicPlan(goal, domain, complexity, [...availableTools]);
  }

  /**
   * Business rule: Validate execution plan feasibility
   */
  public validateExecutionPlan(
    plan: Readonly<ExecutionPlan>,
    context: Readonly<ExecutionContext>
  ): ValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check tool availability
    const missingTools = plan.selectedTools.tools.filter(tool => !context.hasAvailableTool(tool));

    if (missingTools.length > 0) {
      issues.push(`Missing required tools: ${missingTools.join(', ')}`);
    }

    // Check execution time constraints
    const estimatedTime = plan.estimateTotalExecutionTime() * 60 * 1000; // Convert to ms
    if (estimatedTime > context.userPreferences.maxExecutionTime) {
      warnings.push(
        `Estimated execution time (${Math.round(estimatedTime / 60000)}min) exceeds preference (${Math.round(context.userPreferences.maxExecutionTime / 60000)}min)`
      );
    }

    // Check step count against limits
    if (plan.stepEstimate.value > context.maxSteps) {
      issues.push(
        `Plan requires ${plan.stepEstimate.value} steps but limit is ${context.maxSteps}`
      );
    }

    // Check plan viability
    if (!plan.isViable()) {
      issues.push('Execution plan is not viable - low confidence or missing tools');
    }

    return ValidationResult.create(issues.length === 0, issues, warnings);
  }

  /**
   * Business rule: Optimize execution plan based on preferences
   */
  public optimizeExecutionPlan(plan: ExecutionPlan, context: Readonly<ExecutionContext>): ExecutionPlan {
    let optimizedPlan = plan;

    // Speed optimization: reduce optional tools
    if (context.userPreferences.preferSpeed) {
      const coreTools = this.identifyCoreTools(plan.selectedTools.tools, plan.domain);
      if (coreTools.length < plan.selectedTools.tools.length) {
        optimizedPlan = plan.withOptimizedTools(SelectedTools.create(coreTools));
      }
    }

    // Quality optimization: add analysis tools if available
    if (context.userPreferences.preferQuality && plan.domain.isAnalyticalDomain()) {
      const analysisTools = context.availableTools.filter(
        tool => tool.includes('analysis') || tool.includes('research')
      );

      if (analysisTools.length > 0) {
        const enhancedTools = [...plan.selectedTools.tools, ...analysisTools];
        optimizedPlan = plan.withOptimizedTools(SelectedTools.create(enhancedTools));
      }
    }

    return optimizedPlan;
  }

  /**
   * Business rule: Create next reasoning step in execution chain
   */
  public createNextReasoningStep(
    currentChain: ReadonlyArray<ReasoningStep>,
    context: Readonly<ExecutionContext>,
    plan: Readonly<ExecutionPlan>,
    aiGeneratedContent?: string,
    toolResult?: Readonly<{ error?: string; success?: boolean; [key: string]: unknown }>
  ): ReasoningStep | null {
    const stepNumber = currentChain.length + 1;

    // Check if we've exceeded maximum steps
    if (stepNumber > context.maxSteps) {
      return ReasoningStep.createConclusionStep(
        stepNumber,
        'Maximum steps reached. Concluding execution.',
        ConfidenceScore.low()
      );
    }

    // If we have AI-generated content, process it
    if (aiGeneratedContent) {
      return this.processAIReasoningContent(stepNumber, aiGeneratedContent, context as ExecutionContext);
    }

    // If we have a tool result, create observation step
    if (toolResult) {
      return this.processToolResult(stepNumber, toolResult, context);
    }

    // Determine next logical step based on current chain
    return this.determineNextStep(stepNumber, currentChain, plan, context);
  }

  /**
   * Business rule: Check if execution should continue
   */
  public shouldContinueExecution(
    currentChain: ReadonlyArray<ReasoningStep>,
    context: Readonly<ExecutionContext>,
    plan: Readonly<ExecutionPlan>
  ): ContinuationDecision {
    // Check step limit
    if (currentChain.length >= context.maxSteps) {
      return ContinuationDecision.stop('Maximum steps reached');
    }

    // Check for successful conclusion
    const lastStep = currentChain[currentChain.length - 1];
    if (lastStep.type.value === 'conclusion' && lastStep.confidence.isHigh()) {
      return ContinuationDecision.stop('High-confidence conclusion reached');
    }

    // Check for consecutive errors
    const recentErrors = currentChain.slice(-3).filter((step: Readonly<ReasoningStep>) => step.hasError()).length;
    if (recentErrors >= 2) {
      return ContinuationDecision.stop('Too many consecutive errors');
    }

    // Check if goal appears to be achieved
    if (this.isGoalAchieved(currentChain as ReasoningStep[], plan.goal)) {
      return ContinuationDecision.stop('Goal appears to be achieved');
    }

    // Check confidence trajectory
    const recentConfidence = this.calculateRecentConfidence(currentChain.slice(-3));
    if (recentConfidence.isLow() && currentChain.length > 5) {
      return ContinuationDecision.review('Low confidence trend - may need intervention');
    }

    return ContinuationDecision.continue();
  }

  /**
   * Business rule: Calculate final execution result
   */
  public synthesizeFinalResult(
    reasoningChain: ReadonlyArray<ReasoningStep>,
    plan: Readonly<ExecutionPlan>,
    context: Readonly<ExecutionContext>,
    executionTime: number
  ): ExecutionResult {
    const success = this.determineExecutionSuccess(reasoningChain as ReasoningStep[], plan as ExecutionPlan);
    const finalResult = this.extractFinalResult(reasoningChain as ReasoningStep[], plan as ExecutionPlan);
    const insights = this.generateExecutionInsights(reasoningChain as ReasoningStep[], plan as ExecutionPlan, context as ExecutionContext);

    return ExecutionResult.create(
      success,
      finalResult,
      reasoningChain as ReasoningStep[],
      plan as ExecutionPlan,
      executionTime,
      0, // tokens - would be calculated by infrastructure
      false, // streamed - would be set by infrastructure
      insights
    );
  }

  // Private helper methods

  private inferDomainFromPrompt(prompt: string): Domain {
    const lowerPrompt = prompt.toLowerCase();

    if (
      lowerPrompt.includes('code') ||
      lowerPrompt.includes('function') ||
      lowerPrompt.includes('program') ||
      lowerPrompt.includes('debug')
    ) {
      return Domain.coding();
    }

    if (
      lowerPrompt.includes('analyze') ||
      lowerPrompt.includes('research') ||
      lowerPrompt.includes('study') ||
      lowerPrompt.includes('examine')
    ) {
      return Domain.analysis();
    }

    if (
      lowerPrompt.includes('bug') ||
      lowerPrompt.includes('error') ||
      lowerPrompt.includes('fix') ||
      lowerPrompt.includes('debug')
    ) {
      return Domain.debugging();
    }

    return Domain.general();
  }

  private createWorkflowBasedPlan(
    goal: Goal,
    domain: Domain,
    template: Readonly<WorkflowTemplate>,
    availableTools: readonly string[]
  ): ExecutionPlan {
    const executableSteps = template.getExecutableSteps(Array.from(availableTools));
    const allRequiredTools = template.getAllRequiredTools();

    return new ExecutionPlan(
      goal,
      domain,
      StepEstimate.create(executableSteps.length),
      SelectedTools.create(allRequiredTools),
      `Workflow-guided execution using ${template.name} template`,
      ConfidenceScore.high()
    );
  }

  private createHeuristicPlan(
    goal: Goal,
    domain: Domain,
    complexity: 'simple' | 'moderate' | 'complex',
    availableTools: string[]
  ): ExecutionPlan {
    const relevantTools = this.selectRelevantTools(domain, availableTools);
    const stepEstimate = StepEstimate.fromComplexity(complexity);

    return new ExecutionPlan(
      goal,
      domain,
      stepEstimate,
      SelectedTools.create(relevantTools),
      `Heuristic plan for ${complexity} ${domain.value} task`,
      ConfidenceScore.medium()
    );
  }

  private selectRelevantTools(domain: Domain, availableTools: string[]): string[] {
    if (domain.isCodingDomain()) {
      return availableTools.filter(
        tool =>
          tool.includes('filesystem') ||
          tool.includes('git') ||
          tool.includes('code') ||
          tool.includes('analysis')
      );
    }

    if (domain.isAnalyticalDomain()) {
      return availableTools.filter(
        tool =>
          tool.includes('research') ||
          tool.includes('analysis') ||
          tool.includes('filesystem') ||
          tool.includes('search')
      );
    }

    return availableTools.slice(0, 5); // Default selection
  }

  private identifyCoreTools(tools: readonly string[], domain: Domain): string[] {
    if (domain.isCodingDomain()) {
      return tools.filter(tool => tool.includes('filesystem') || tool.includes('code'));
    }

    return tools.slice(0, Math.ceil(tools.length * 0.7)); // Keep 70% of tools
  }

  private processAIReasoningContent(
    stepNumber: number,
    content: string,
    _context: Readonly<ExecutionContext>
  ): ReasoningStep {
    // Simplified AI content processing - would be more sophisticated in real implementation
    if (content.toLowerCase().includes('conclusion') || content.toLowerCase().includes('result')) {
      return ReasoningStep.createConclusionStep(stepNumber, content, ConfidenceScore.high());
    }

    if (content.toLowerCase().includes('action') || content.toLowerCase().includes('execute')) {
      return ReasoningStep.createActionStep(
        stepNumber,
        content,
        'inferred_tool',
        ToolArguments.empty(),
        ConfidenceScore.medium()
      );
    }

    return ReasoningStep.createThoughtStep(stepNumber, content, ConfidenceScore.medium());
  }

  private processToolResult(
    stepNumber: number,
    toolResult: Readonly<{ error?: string; success?: boolean; [key: string]: unknown }>,
    _context: Readonly<ExecutionContext>
  ): ReasoningStep {
    const hasError = typeof toolResult.error === 'string' || toolResult.success === false;

    if (hasError) {
      return ReasoningStep.createErrorStep(stepNumber, typeof toolResult.error === 'string' ? toolResult.error : 'Tool execution failed');
    }

    const observation = `Tool executed successfully. Result: ${JSON.stringify(toolResult).substring(0, 200)}`;
    return ReasoningStep.createObservationStep(stepNumber, observation, ConfidenceScore.high());
  }

  private determineNextStep(
    stepNumber: number,
    currentChain: ReadonlyArray<ReasoningStep>,
    plan: Readonly<ExecutionPlan>,
    _context: Readonly<ExecutionContext>
  ): ReasoningStep {
    // Simplified next step determination - would be more sophisticated in real implementation
    if (currentChain.length === 0) {
      return ReasoningStep.createThoughtStep(
        stepNumber,
        `Starting execution for: ${plan.goal.truncatedDescription}`,
        ConfidenceScore.high()
      );
    }

    const lastStep = currentChain[currentChain.length - 1];

    if (lastStep.type.value === 'thought') {
      // After thought, usually comes action
      return ReasoningStep.createActionStep(
        stepNumber,
        'Preparing to execute next action',
        'filesystem_read_file',
        ToolArguments.create({ path: '.' }),
        ConfidenceScore.medium()
      );
    }

    return ReasoningStep.createConclusionStep(
      stepNumber,
      'Execution completed',
      ConfidenceScore.medium()
    );
  }

  private isGoalAchieved(currentChain: ReadonlyArray<ReasoningStep>, _goal: Readonly<Goal>): boolean {
    // Simplified goal achievement check
    const successfulSteps = currentChain.filter(step => step.isSuccessful()).length;
    const totalSteps = currentChain.length;

    return successfulSteps >= totalSteps * 0.8 && totalSteps >= 3;
  }

  private calculateRecentConfidence(recentSteps: ReadonlyArray<ReasoningStep>): ConfidenceScore {
    if (recentSteps.length === 0) return ConfidenceScore.medium();

    const avgConfidence =
      recentSteps.reduce((sum, step) => sum + step.confidence.value, 0) / recentSteps.length;

    return ConfidenceScore.create(avgConfidence);
  }

  private determineExecutionSuccess(reasoningChain: ReadonlyArray<ReasoningStep>, _plan: Readonly<ExecutionPlan>): boolean {
    if (reasoningChain.length === 0) return false;

    const successfulSteps = reasoningChain.filter(step => step.isSuccessful()).length;
    const errorSteps = reasoningChain.filter(step => step.hasError()).length;

    return successfulSteps > errorSteps && successfulSteps >= reasoningChain.length * 0.6;
  }

  private extractFinalResult(reasoningChain: ReadonlyArray<ReasoningStep>, _plan: Readonly<ExecutionPlan>): string {
    // Find the last conclusion step
    const conclusionSteps = reasoningChain.filter(step => step.type.value === 'conclusion');
    if (conclusionSteps.length > 0) {
      return conclusionSteps[conclusionSteps.length - 1].content;
    }

    // Fallback to last successful step
    const successfulSteps = reasoningChain.filter(step => step.isSuccessful());
    if (successfulSteps.length > 0) {
      return successfulSteps[successfulSteps.length - 1].content;
    }

    return 'Execution completed with mixed results';
  }

  private generateExecutionInsights(
    reasoningChain: ReadonlyArray<ReasoningStep>,
    plan: Readonly<ExecutionPlan>,
    _context: Readonly<ExecutionContext>
  ): string[] {
    const insights: string[] = [];

    // Efficiency insights
    if (reasoningChain.length > plan.stepEstimate.value * 1.5) {
      insights.push(
        'Execution took more steps than estimated - plan estimation may need improvement'
      );
    }

    // Tool usage insights
    const toolSteps = reasoningChain.filter(step => step.isToolStep());
    if (toolSteps.length === 0) {
      insights.push('No tools were executed - task may have been purely analytical');
    }

    // Confidence insights
    const lowConfidenceSteps = reasoningChain.filter(step => step.confidence.isLow());
    if (lowConfidenceSteps.length > reasoningChain.length * 0.3) {
      insights.push('Many steps had low confidence - execution may benefit from better guidance');
    }

    return insights;
  }
}

/**
 * Supporting value objects
 */

export class ValidationResult {
  private constructor(
    private readonly _isValid: boolean,
    private readonly _issues: readonly string[],
    private readonly _warnings: readonly string[]
  ) {}

  public static create(isValid: boolean, issues: readonly string[], warnings: readonly string[]): ValidationResult {
    return new ValidationResult(isValid, Object.freeze([...issues]), Object.freeze([...warnings]));
  }

  public get isValid(): boolean {
    return this._isValid;
  }
  public get issues(): readonly string[] {
    return this._issues;
  }
  public get warnings(): readonly string[] {
    return this._warnings;
  }
}

export class ContinuationDecision {
  private constructor(
    private readonly _shouldContinue: boolean,
    private readonly _reason: string,
    private readonly _needsReview: boolean = false
  ) {}

  public static continue(): ContinuationDecision {
    return new ContinuationDecision(true, 'Continue execution');
  }

  public static stop(reason: string): ContinuationDecision {
    return new ContinuationDecision(false, reason);
  }

  public static review(reason: string): ContinuationDecision {
    return new ContinuationDecision(false, reason, true);
  }

  public get shouldContinue(): boolean {
    return this._shouldContinue;
  }
  public get reason(): string {
    return this._reason;
  }
  public get needsReview(): boolean {
    return this._needsReview;
  }
}
