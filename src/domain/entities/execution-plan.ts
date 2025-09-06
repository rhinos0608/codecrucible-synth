/**
 * Execution Plan Domain Entity
 * Pure business logic for AI execution planning
 *
 * Living Spiral Council Applied:
 * - Domain-driven design with pure business entities
 * - No external dependencies or infrastructure concerns
 * - Business rules for execution planning and optimization
 */

import { ConfidenceScore } from './reasoning-step.js';

/**
 * Domain Identifier Value Object
 */
export class Domain {
  private static readonly VALID_DOMAINS = [
    'coding',
    'analysis',
    'debugging',
    'documentation',
    'testing',
    'deployment',
    'research',
    'creative',
    'general',
  ] as const;

  private constructor(private readonly _value: (typeof Domain.VALID_DOMAINS)[number]) {}

  public static create(value: string): Domain {
    const normalizedValue = value.toLowerCase();
    if (!this.VALID_DOMAINS.includes(normalizedValue as (typeof Domain.VALID_DOMAINS)[number])) {
      // Default to general for unknown domains
      return new Domain('general');
    }
    return new Domain(normalizedValue as (typeof Domain.VALID_DOMAINS)[number]);
  }

  public static coding(): Domain {
    return new Domain('coding');
  }

  public static analysis(): Domain {
    return new Domain('analysis');
  }

  public static debugging(): Domain {
    return new Domain('debugging');
  }

  public static general(): Domain {
    return new Domain('general');
  }

  public get value(): string {
    return this._value;
  }

  public equals(other: Readonly<Domain>): boolean {
    return this._value === other.value;
  }

  public isCodingDomain(): boolean {
    return this._value === 'coding' || this._value === 'debugging' || this._value === 'testing';
  }

  public isAnalyticalDomain(): boolean {
    return this._value === 'analysis' || this._value === 'research';
  }

  public requiresHighPrecision(): boolean {
    return this._value === 'debugging' || this._value === 'testing' || this._value === 'deployment';
  }
}

/**
 * Goal Description Value Object
 */
export class Goal {
  private constructor(private readonly _description: string) {
    this.validateDescription(_description);
  }

  public static create(description: string): Goal {
    return new Goal(description);
  }

  public get description(): string {
    return this._description;
  }

  public get truncatedDescription(): string {
    return this._description.length > 100
      ? `${this._description.substring(0, 100)}...`
      : this._description;
  }

  /**
   * Business rule: Determine complexity based on goal description
   */
  public estimateComplexity(): 'simple' | 'moderate' | 'complex' {
    const description = this._description.toLowerCase();

    // Simple tasks - single operations
    if (
      description.includes('list') ||
      description.includes('show') ||
      description.includes('read')
    ) {
      return 'simple';
    }

    // Complex tasks - multiple operations or analysis
    if (
      description.includes('analyze') ||
      description.includes('implement') ||
      description.includes('refactor') ||
      description.includes('optimize')
    ) {
      return 'complex';
    }

    // Default to moderate
    return 'moderate';
  }

  /**
   * Business rule: Determine if goal requires multiple steps
   */
  public requiresMultipleSteps(): boolean {
    const complexityIndicators = ['and', 'then', 'also', 'analyze', 'implement', 'create', 'build'];
    const description = this._description.toLowerCase();
    return complexityIndicators.some(indicator => description.includes(indicator));
  }

  private validateDescription(description: string): void {
    if (!description || description.trim().length === 0) {
      throw new Error('Goal description cannot be empty');
    }

    if (description.length > 1000) {
      throw new Error('Goal description too long (max 1000 characters)');
    }
  }
}

/**
 * Selected Tools Value Object
 */
export class SelectedTools {
  private constructor(private readonly _tools: readonly string[]) {}

  public static create(tools: readonly string[]): SelectedTools {
    // Remove duplicates and ensure non-empty tool names
    const uniqueTools = Array.from(new Set(tools.filter(tool => tool && tool.trim().length > 0)));
    return new SelectedTools(Object.freeze(uniqueTools));
  }

  public static empty(): SelectedTools {
    return new SelectedTools(Object.freeze([]));
  }

  public get tools(): readonly string[] {
    return this._tools;
  }

  public get count(): number {
    return this._tools.length;
  }

  public isEmpty(): boolean {
    return this._tools.length === 0;
  }

  public hasTool(toolName: string): boolean {
    return this._tools.includes(toolName);
  }

  public hasFileSystemTools(): boolean {
    return this._tools.some(tool => tool.includes('filesystem'));
  }

  public hasCodeTools(): boolean {
    return this._tools.some(tool => tool.includes('code') || tool.includes('git'));
  }

  public hasAnalysisTools(): boolean {
    return this._tools.some(tool => tool.includes('analysis') || tool.includes('search'));
  }

  /**
   * Business rule: Estimate execution complexity based on tool selection
   */
  public estimateComplexity(): number {
    if (this.isEmpty()) return 0;

    let complexity = this._tools.length * 0.2; // Base complexity per tool

    // File system operations add moderate complexity
    if (this.hasFileSystemTools()) {
      complexity += 0.3;
    }

    // Code operations add higher complexity
    if (this.hasCodeTools()) {
      complexity += 0.5;
    }

    // Analysis operations add highest complexity
    if (this.hasAnalysisTools()) {
      complexity += 0.7;
    }

    return Math.min(1.0, complexity);
  }

  public withAdditionalTool(toolName: string): SelectedTools {
    if (!toolName || toolName.trim().length === 0) {
      return this;
    }

    if (this._tools.includes(toolName)) {
      return this;
    }

    return new SelectedTools(Object.freeze([...this._tools, toolName]));
  }
}

/**
 * Step Estimation Value Object
 */
export class StepEstimate {
  private constructor(private readonly _estimatedSteps: number) {
    this.validateStepCount(_estimatedSteps);
  }

  public static create(steps: number): StepEstimate {
    return new StepEstimate(steps);
  }

  public static fromComplexity(complexity: 'simple' | 'moderate' | 'complex'): StepEstimate {
    switch (complexity) {
      case 'simple':
        return new StepEstimate(2);
      case 'moderate':
        return new StepEstimate(4);
      case 'complex':
        return new StepEstimate(8);
      default:
        return new StepEstimate(4);
    }
  }

  public get value(): number {
    return this._estimatedSteps;
  }

  public isSimple(): boolean {
    return this._estimatedSteps <= 3;
  }

  public isModerate(): boolean {
    return this._estimatedSteps > 3 && this._estimatedSteps <= 6;
  }

  public isComplex(): boolean {
    return this._estimatedSteps > 6;
  }

  /**
   * Business rule: Calculate estimated execution time in minutes
   */
  public estimateExecutionTime(): number {
    // Assume 2-5 minutes per step on average, with complexity scaling
    const baseTimePerStep = this.isComplex() ? 5 : this.isModerate() ? 3 : 2;
    return this._estimatedSteps * baseTimePerStep;
  }

  public adjustForTools(toolComplexity: number): StepEstimate {
    const adjustment = Math.ceil(this._estimatedSteps * toolComplexity);
    return new StepEstimate(Math.min(20, this._estimatedSteps + adjustment)); // Cap at 20 steps
  }

  private validateStepCount(steps: number): void {
    if (steps < 1) {
      throw new Error('Estimated steps must be at least 1');
    }

    if (steps > 20) {
      throw new Error('Estimated steps cannot exceed 20 (task too complex)');
    }
  }
}

/**
 * Execution Plan Entity - Core business object representing an AI execution plan
 */
export class ExecutionPlan {
  private readonly _goal: Goal;
  private readonly _domain: Domain;
  private readonly _stepEstimate: StepEstimate;
  private readonly _selectedTools: SelectedTools;
  private readonly _reasoning: string;
  private readonly _confidence: ConfidenceScore;
  private readonly _createdAt: Date;

  constructor(
    goal: Goal,
    domain: Domain,
    stepEstimate: StepEstimate,
    selectedTools: SelectedTools,
    reasoning: string,
    confidence: ConfidenceScore,
    createdAt: Date = new Date()
  ) {
    this.validateInputs(reasoning);

    this._goal = goal;
    this._domain = domain;
    this._stepEstimate = stepEstimate;
    this._selectedTools = selectedTools;
    this._reasoning = reasoning;
    this._confidence = confidence;
    this._createdAt = new Date(createdAt);
  }

  // Getters
  get goal(): Goal {
    return this._goal;
  }

  get domain(): Domain {
    return this._domain;
  }

  get stepEstimate(): StepEstimate {
    return this._stepEstimate;
  }

  get selectedTools(): SelectedTools {
    return this._selectedTools;
  }

  get reasoning(): string {
    return this._reasoning;
  }

  get confidence(): ConfidenceScore {
    return this._confidence;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  // Business methods

  /**
   * Business rule: A plan is considered viable if it has reasonable confidence and tool selection
   */
  isViable(): boolean {
    return !this._confidence.isLow() && !this._selectedTools.isEmpty();
  }

  /**
   * Business rule: A plan requires review if confidence is low or complexity is high
   */
  requiresReview(): boolean {
    return this._confidence.isLow() || this._stepEstimate.isComplex();
  }

  /**
   * Business rule: Calculate overall execution risk
   */
  calculateRisk(): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    // Low confidence increases risk
    if (this._confidence.isLow()) {
      riskScore += 0.4;
    }

    // Complex tasks increase risk
    if (this._stepEstimate.isComplex()) {
      riskScore += 0.3;
    }

    // High-precision domains increase risk
    if (this._domain.requiresHighPrecision()) {
      riskScore += 0.2;
    }

    // No tool selection increases risk
    if (this._selectedTools.isEmpty()) {
      riskScore += 0.5;
    }

    if (riskScore >= 0.7) return 'high';
    if (riskScore >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * Business rule: Estimate total execution time considering all factors
   */
  estimateTotalExecutionTime(): number {
    let baseTime = this._stepEstimate.estimateExecutionTime();

    // Domain adjustments
    if (this._domain.requiresHighPrecision()) {
      baseTime *= 1.3; // 30% more time for precision-critical tasks
    }

    // Tool complexity adjustments
    const toolComplexity = this._selectedTools.estimateComplexity();
    baseTime *= 1 + toolComplexity;

    return Math.ceil(baseTime);
  }

  /**
   * Create an optimized version of the plan with better tool selection
   */
  withOptimizedTools(newTools: SelectedTools): ExecutionPlan {
    // Only accept optimization if it improves the plan
    if (newTools.count > this._selectedTools.count * 1.5) {
      // Too many tools, might be over-optimization
      return this;
    }

    return new ExecutionPlan(
      this._goal,
      this._domain,
      this._stepEstimate.adjustForTools(newTools.estimateComplexity()),
      newTools,
      this._reasoning,
      this._confidence,
      this._createdAt
    );
  }

  /**
   * Create a revised plan with updated confidence based on execution feedback
   */
  withUpdatedConfidence(newConfidence: ConfidenceScore, newReasoning?: string): ExecutionPlan {
    return new ExecutionPlan(
      this._goal,
      this._domain,
      this._stepEstimate,
      this._selectedTools,
      newReasoning || this._reasoning,
      newConfidence,
      this._createdAt
    );
  }

  /**
   * Export to configuration object for external systems
   */
  toConfig(): ExecutionPlanConfiguration {
    return {
      goal: this._goal.description,
      domain: this._domain.value,
      estimatedSteps: this._stepEstimate.value,
      selectedTools: [...this._selectedTools.tools],
      reasoning: this._reasoning,
      confidence: this._confidence.value,
      createdAt: this._createdAt.toISOString(),
    };
  }

  /**
   * Create ExecutionPlan from configuration
   */
  static fromConfig(config: ExecutionPlanConfiguration): ExecutionPlan {
    return new ExecutionPlan(
      Goal.create(config.goal),
      Domain.create(config.domain),
      StepEstimate.create(config.estimatedSteps),
      SelectedTools.create(config.selectedTools),
      config.reasoning,
      ConfidenceScore.create(config.confidence),
      new Date(config.createdAt)
    );
  }

  // Factory methods

  static createSimplePlan(
    goalDescription: string,
    domain: string,
    tools: string[],
    confidence: number = 0.8
  ): ExecutionPlan {
    const goal = Goal.create(goalDescription);
    const domainObj = Domain.create(domain);
    const selectedTools = SelectedTools.create(tools);

    return new ExecutionPlan(
      goal,
      domainObj,
      StepEstimate.fromComplexity(goal.estimateComplexity()),
      selectedTools,
      `Simple execution plan for ${domain} task`,
      ConfidenceScore.create(confidence)
    );
  }

  static createAnalysisPlan(
    goalDescription: string,
    analysisTools: string[],
    reasoning: string
  ): ExecutionPlan {
    const goal = Goal.create(goalDescription);

    return new ExecutionPlan(
      goal,
      Domain.analysis(),
      StepEstimate.fromComplexity('complex'),
      SelectedTools.create(analysisTools),
      reasoning,
      ConfidenceScore.high()
    );
  }

  private validateInputs(reasoning: string): void {
    if (!reasoning || reasoning.trim().length === 0) {
      throw new Error('Execution plan reasoning cannot be empty');
    }
  }
}

/**
 * Configuration interface for external systems
 */
export interface ExecutionPlanConfiguration {
  goal: string;
  domain: string;
  estimatedSteps: number;
  selectedTools: string[];
  reasoning: string;
  confidence: number;
  createdAt: string;
}
