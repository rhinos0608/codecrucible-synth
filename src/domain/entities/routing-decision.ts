/**
 * Routing Decision Domain Entity
 * Pure business logic for AI model routing decisions
 *
 * Living Spiral Council Applied:
 * - Domain-driven design with pure business entities
 * - No external dependencies or infrastructure concerns
 * - Business rules for intelligent model selection and routing
 */

import { ConfidenceScore } from './reasoning-step.js';

/**
 * Task Complexity Value Object
 */
export class TaskComplexity {
  private static readonly VALID_COMPLEXITIES = [
    'simple',
    'moderate',
    'complex',
    'advanced',
  ] as const;

  private constructor(
    private readonly _value: (typeof TaskComplexity.VALID_COMPLEXITIES)[number]
  ) {}

  static create(value: string): TaskComplexity {
    const normalizedValue = value.toLowerCase();
    if (!this.VALID_COMPLEXITIES.includes(normalizedValue as any)) {
      return new TaskComplexity('moderate'); // Default fallback
    }
    return new TaskComplexity(normalizedValue as any);
  }

  static simple(): TaskComplexity {
    return new TaskComplexity('simple');
  }

  static moderate(): TaskComplexity {
    return new TaskComplexity('moderate');
  }

  static complex(): TaskComplexity {
    return new TaskComplexity('complex');
  }

  static advanced(): TaskComplexity {
    return new TaskComplexity('advanced');
  }

  /**
   * Business rule: Infer complexity from task characteristics
   */
  static fromTaskDescription(description: string): TaskComplexity {
    const lowerDesc = description.toLowerCase();

    // Simple tasks
    if (
      lowerDesc.includes('list') ||
      lowerDesc.includes('show') ||
      lowerDesc.includes('read') ||
      lowerDesc.includes('get')
    ) {
      return TaskComplexity.simple();
    }

    // Advanced tasks
    if (
      lowerDesc.includes('implement') ||
      lowerDesc.includes('design') ||
      lowerDesc.includes('architect') ||
      lowerDesc.includes('optimize') ||
      lowerDesc.includes('refactor')
    ) {
      return TaskComplexity.advanced();
    }

    // Complex tasks
    if (
      lowerDesc.includes('analyze') ||
      lowerDesc.includes('debug') ||
      lowerDesc.includes('solve') ||
      lowerDesc.includes('create')
    ) {
      return TaskComplexity.complex();
    }

    return TaskComplexity.moderate();
  }

  get value(): string {
    return this._value;
  }

  equals(other: TaskComplexity): boolean {
    return this._value === other._value;
  }

  isSimple(): boolean {
    return this._value === 'simple';
  }

  isModerate(): boolean {
    return this._value === 'moderate';
  }

  isComplex(): boolean {
    return this._value === 'complex';
  }

  isAdvanced(): boolean {
    return this._value === 'advanced';
  }

  /**
   * Business rule: Get numeric complexity score for routing decisions
   */
  getComplexityScore(): number {
    switch (this._value) {
      case 'simple':
        return 0.2;
      case 'moderate':
        return 0.5;
      case 'complex':
        return 0.8;
      case 'advanced':
        return 1.0;
      default:
        return 0.5;
    }
  }

  /**
   * Business rule: Determine if task requires high-capability models
   */
  requiresHighCapabilityModel(): boolean {
    return this._value === 'complex' || this._value === 'advanced';
  }

  /**
   * Business rule: Determine if task can be handled by fast/lightweight models
   */
  canUseSimpleModel(): boolean {
    return this._value === 'simple' || this._value === 'moderate';
  }
}

/**
 * Model Capability Value Object
 */
export class ModelCapability {
  private static readonly VALID_CAPABILITIES = [
    'text-generation',
    'code-generation',
    'analysis',
    'reasoning',
    'conversation',
    'debugging',
    'refactoring',
    'documentation',
    'image-analysis',
    'multimodal-reasoning',
    'function-calling',
  ] as const;

  private constructor(private readonly _capabilities: readonly string[]) {}

  static create(capabilities: string[]): ModelCapability {
    const validCapabilities = capabilities.filter(cap =>
      this.VALID_CAPABILITIES.includes(cap as any)
    );
    return new ModelCapability(Object.freeze(validCapabilities));
  }

  static coding(): ModelCapability {
    return new ModelCapability(['code-generation', 'debugging', 'refactoring', 'analysis']);
  }

  static general(): ModelCapability {
    return new ModelCapability(['text-generation', 'reasoning', 'conversation']);
  }

  static advanced(): ModelCapability {
    return new ModelCapability([
      'code-generation',
      'analysis',
      'reasoning',
      'debugging',
      'refactoring',
      'multimodal-reasoning',
      'function-calling',
    ]);
  }

  get capabilities(): readonly string[] {
    return this._capabilities;
  }

  hasCapability(capability: string): boolean {
    return this._capabilities.includes(capability);
  }

  /**
   * Business rule: Check if capabilities match task requirements
   */
  matchesTaskRequirements(requiredCapabilities: string[]): boolean {
    return requiredCapabilities.every(required => this.hasCapability(required));
  }

  /**
   * Business rule: Calculate capability score for task matching
   */
  calculateMatchScore(requiredCapabilities: string[]): number {
    if (requiredCapabilities.length === 0) return 1.0;

    const matchingCapabilities = requiredCapabilities.filter(required =>
      this.hasCapability(required)
    );

    return matchingCapabilities.length / requiredCapabilities.length;
  }

  isCodingCapable(): boolean {
    return this.hasCapability('code-generation') || this.hasCapability('debugging');
  }

  isAnalysisCapable(): boolean {
    return this.hasCapability('analysis') || this.hasCapability('reasoning');
  }

  isMultimodal(): boolean {
    return this.hasCapability('multimodal-reasoning') || this.hasCapability('image-analysis');
  }
}

/**
 * Performance Profile Value Object
 */
export class PerformanceProfile {
  private constructor(
    private readonly _latency: number, // milliseconds
    private readonly _throughput: number, // tokens per second
    private readonly _reliability: number // 0-1 score
  ) {
    this.validateMetrics(_latency, _throughput, _reliability);
  }

  static create(latency: number, throughput: number, reliability: number): PerformanceProfile {
    return new PerformanceProfile(latency, throughput, reliability);
  }

  static fast(): PerformanceProfile {
    return new PerformanceProfile(500, 100, 0.95);
  }

  static balanced(): PerformanceProfile {
    return new PerformanceProfile(2000, 50, 0.98);
  }

  static highQuality(): PerformanceProfile {
    return new PerformanceProfile(5000, 20, 0.99);
  }

  get latency(): number {
    return this._latency;
  }

  get throughput(): number {
    return this._throughput;
  }

  get reliability(): number {
    return this._reliability;
  }

  /**
   * Business rule: Check if performance meets requirements
   */
  meetsRequirements(maxLatency?: number, minThroughput?: number, minReliability?: number): boolean {
    if (maxLatency && this._latency > maxLatency) return false;
    if (minThroughput && this._throughput < minThroughput) return false;
    if (minReliability && this._reliability < minReliability) return false;
    return true;
  }

  /**
   * Business rule: Calculate performance score for routing decisions
   */
  calculatePerformanceScore(preferSpeed: boolean = false): number {
    // Normalize metrics to 0-1 scale
    const latencyScore = Math.max(0, 1 - this._latency / 10000); // 10s max
    const throughputScore = Math.min(1, this._throughput / 100); // 100 tokens/s max
    const reliabilityScore = this._reliability;

    if (preferSpeed) {
      return latencyScore * 0.5 + throughputScore * 0.3 + reliabilityScore * 0.2;
    } else {
      return reliabilityScore * 0.5 + throughputScore * 0.3 + latencyScore * 0.2;
    }
  }

  isFastModel(): boolean {
    return this._latency < 1000 && this._throughput > 50;
  }

  isHighQualityModel(): boolean {
    return this._reliability > 0.95;
  }

  isReliable(): boolean {
    return this._reliability > 0.9;
  }

  private validateMetrics(latency: number, throughput: number, reliability: number): void {
    if (latency < 0) throw new Error('Latency cannot be negative');
    if (throughput < 0) throw new Error('Throughput cannot be negative');
    if (reliability < 0 || reliability > 1) throw new Error('Reliability must be between 0 and 1');
  }
}

/**
 * Routing Priority Value Object
 */
export class RoutingPriority {
  private static readonly VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

  private constructor(private readonly _value: (typeof RoutingPriority.VALID_PRIORITIES)[number]) {}

  static create(value: string): RoutingPriority {
    const normalizedValue = value.toLowerCase();
    if (!this.VALID_PRIORITIES.includes(normalizedValue as any)) {
      return new RoutingPriority('medium'); // Default fallback
    }
    return new RoutingPriority(normalizedValue as any);
  }

  static low(): RoutingPriority {
    return new RoutingPriority('low');
  }

  static medium(): RoutingPriority {
    return new RoutingPriority('medium');
  }

  static high(): RoutingPriority {
    return new RoutingPriority('high');
  }

  static critical(): RoutingPriority {
    return new RoutingPriority('critical');
  }

  get value(): string {
    return this._value;
  }

  equals(other: RoutingPriority): boolean {
    return this._value === other._value;
  }

  /**
   * Business rule: Get priority weight for routing decisions
   */
  getWeight(): number {
    switch (this._value) {
      case 'critical':
        return 1.0;
      case 'high':
        return 0.8;
      case 'medium':
        return 0.5;
      case 'low':
        return 0.2;
      default:
        return 0.5;
    }
  }

  isHighPriority(): boolean {
    return this._value === 'high' || this._value === 'critical';
  }

  isCritical(): boolean {
    return this._value === 'critical';
  }
}

/**
 * Model Selection Criteria Value Object
 */
export class ModelSelectionCriteria {
  private constructor(
    private readonly _requiredCapabilities: readonly string[],
    private readonly _maxLatency?: number,
    private readonly _minQuality?: number,
    private readonly _preferSpeed: boolean = false,
    private readonly _preferQuality: boolean = false
  ) {}

  static create(
    requiredCapabilities: string[],
    maxLatency?: number,
    minQuality?: number,
    preferSpeed: boolean = false,
    preferQuality: boolean = false
  ): ModelSelectionCriteria {
    return new ModelSelectionCriteria(
      Object.freeze([...requiredCapabilities]),
      maxLatency,
      minQuality,
      preferSpeed,
      preferQuality
    );
  }

  static forCoding(): ModelSelectionCriteria {
    return new ModelSelectionCriteria(
      ['code-generation', 'debugging', 'analysis'],
      undefined,
      0.8,
      false,
      true
    );
  }

  static forQuickQuery(): ModelSelectionCriteria {
    return new ModelSelectionCriteria(
      ['text-generation'],
      2000, // 2s max latency
      undefined,
      true,
      false
    );
  }

  static forAnalysis(): ModelSelectionCriteria {
    return new ModelSelectionCriteria(['analysis', 'reasoning'], undefined, 0.9, false, true);
  }

  get requiredCapabilities(): readonly string[] {
    return this._requiredCapabilities;
  }

  get maxLatency(): number | undefined {
    return this._maxLatency;
  }

  get minQuality(): number | undefined {
    return this._minQuality;
  }

  get preferSpeed(): boolean {
    return this._preferSpeed;
  }

  get preferQuality(): boolean {
    return this._preferQuality;
  }

  /**
   * Business rule: Check if model meets all criteria
   */
  isSatisfiedBy(
    capabilities: ModelCapability,
    performance: PerformanceProfile,
    qualityScore: number
  ): boolean {
    // Check capability requirements
    if (!capabilities.matchesTaskRequirements([...this._requiredCapabilities])) {
      return false;
    }

    // Check performance requirements
    if (!performance.meetsRequirements(this._maxLatency, undefined, undefined)) {
      return false;
    }

    // Check quality requirements
    if (this._minQuality && qualityScore < this._minQuality) {
      return false;
    }

    return true;
  }

  /**
   * Business rule: Calculate model score based on criteria
   */
  calculateModelScore(
    capabilities: ModelCapability,
    performance: PerformanceProfile,
    qualityScore: number
  ): number {
    if (!this.isSatisfiedBy(capabilities, performance, qualityScore)) {
      return 0; // Doesn't meet basic requirements
    }

    let score = 0;

    // Capability matching (40% weight)
    const capabilityScore = capabilities.calculateMatchScore([...this._requiredCapabilities]);
    score += capabilityScore * 0.4;

    // Performance score (30% weight)
    const performanceScore = performance.calculatePerformanceScore(this._preferSpeed);
    score += performanceScore * 0.3;

    // Quality score (30% weight)
    const normalizedQuality = Math.min(1.0, qualityScore);
    score += normalizedQuality * 0.3;

    return score;
  }
}

/**
 * Routing Decision Entity - Core business object representing a model routing decision
 */
export class RoutingDecision {
  private readonly _requestId: string;
  private readonly _selectedModelId: string;
  private readonly _taskComplexity: TaskComplexity;
  private readonly _priority: RoutingPriority;
  private readonly _confidence: ConfidenceScore;
  private readonly _reasoning: string;
  private readonly _alternatives: readonly string[];
  private readonly _decisionTime: Date;
  private readonly _criteria: ModelSelectionCriteria;

  constructor(
    requestId: string,
    selectedModelId: string,
    taskComplexity: TaskComplexity,
    priority: RoutingPriority,
    confidence: ConfidenceScore,
    reasoning: string,
    alternatives: string[],
    criteria: ModelSelectionCriteria,
    decisionTime: Date = new Date()
  ) {
    this.validateInputs(requestId, selectedModelId, reasoning);

    this._requestId = requestId;
    this._selectedModelId = selectedModelId;
    this._taskComplexity = taskComplexity;
    this._priority = priority;
    this._confidence = confidence;
    this._reasoning = reasoning;
    this._alternatives = Object.freeze([...alternatives]);
    this._criteria = criteria;
    this._decisionTime = new Date(decisionTime);
  }

  // Getters
  get requestId(): string {
    return this._requestId;
  }

  get selectedModelId(): string {
    return this._selectedModelId;
  }

  get taskComplexity(): TaskComplexity {
    return this._taskComplexity;
  }

  get priority(): RoutingPriority {
    return this._priority;
  }

  get confidence(): ConfidenceScore {
    return this._confidence;
  }

  get reasoning(): string {
    return this._reasoning;
  }

  get alternatives(): readonly string[] {
    return this._alternatives;
  }

  get criteria(): ModelSelectionCriteria {
    return this._criteria;
  }

  get decisionTime(): Date {
    return new Date(this._decisionTime);
  }

  // Business methods

  /**
   * Business rule: Check if routing decision is high confidence
   */
  isHighConfidenceDecision(): boolean {
    return this._confidence.isHigh();
  }

  /**
   * Business rule: Check if decision should be reviewed
   */
  shouldBeReviewed(): boolean {
    return (
      this._confidence.isLow() || (this._priority.isHighPriority() && !this._confidence.isHigh())
    );
  }

  /**
   * Business rule: Check if task-model alignment is appropriate
   */
  hasAppropriateTaskModelAlignment(): boolean {
    // Simple tasks shouldn't use high-capability models (cost efficiency)
    if (this._taskComplexity.canUseSimpleModel() && this.isHighCapabilityModel()) {
      return false;
    }

    // Complex tasks should use high-capability models (quality assurance)
    if (this._taskComplexity.requiresHighCapabilityModel() && !this.isHighCapabilityModel()) {
      return false;
    }

    return true;
  }

  /**
   * Business rule: Calculate decision quality score
   */
  calculateDecisionQuality(): number {
    let qualityScore = this._confidence.value * 0.4; // Base confidence

    // Task-model alignment
    if (this.hasAppropriateTaskModelAlignment()) {
      qualityScore += 0.3;
    }

    // Priority handling
    if (this._priority.isHighPriority() && this._confidence.isHigh()) {
      qualityScore += 0.2;
    }

    // Alternative consideration (having alternatives shows thorough evaluation)
    if (this._alternatives.length > 0) {
      qualityScore += 0.1;
    }

    return Math.min(1.0, qualityScore);
  }

  /**
   * Business rule: Get routing insights for optimization
   */
  getRoutingInsights(): string[] {
    const insights: string[] = [];

    if (!this.hasAppropriateTaskModelAlignment()) {
      if (this._taskComplexity.canUseSimpleModel() && this.isHighCapabilityModel()) {
        insights.push('Consider using a faster, simpler model for this task type');
      } else {
        insights.push('Task complexity may require a more capable model');
      }
    }

    if (this._confidence.isLow()) {
      insights.push('Low confidence decision - consider adding more routing criteria');
    }

    if (this._alternatives.length === 0) {
      insights.push('No alternative models considered - routing may be too rigid');
    }

    if (this._priority.isHighPriority() && !this._confidence.isHigh()) {
      insights.push('High priority task with low confidence routing - review criteria');
    }

    return insights;
  }

  /**
   * Create a revised decision with updated confidence
   */
  withUpdatedConfidence(newConfidence: ConfidenceScore, newReasoning?: string): RoutingDecision {
    return new RoutingDecision(
      this._requestId,
      this._selectedModelId,
      this._taskComplexity,
      this._priority,
      newConfidence,
      newReasoning || this._reasoning,
      [...this._alternatives],
      this._criteria,
      this._decisionTime
    );
  }

  private isHighCapabilityModel(): boolean {
    // This is a simplified check - in real implementation, this would check model capabilities
    // For now, assume models with certain naming patterns are high-capability
    const modelName = this._selectedModelId.toLowerCase();
    return (
      modelName.includes('large') ||
      modelName.includes('advanced') ||
      modelName.includes('gpt-4') ||
      modelName.includes('claude')
    );
  }

  private validateInputs(requestId: string, selectedModelId: string, reasoning: string): void {
    if (!requestId || requestId.trim().length === 0) {
      throw new Error('Request ID cannot be empty');
    }

    if (!selectedModelId || selectedModelId.trim().length === 0) {
      throw new Error('Selected model ID cannot be empty');
    }

    if (!reasoning || reasoning.trim().length === 0) {
      throw new Error('Routing decision reasoning cannot be empty');
    }
  }

  // Factory methods

  static createHighConfidenceDecision(
    requestId: string,
    selectedModelId: string,
    taskComplexity: TaskComplexity,
    priority: RoutingPriority,
    reasoning: string,
    criteria: ModelSelectionCriteria
  ): RoutingDecision {
    return new RoutingDecision(
      requestId,
      selectedModelId,
      taskComplexity,
      priority,
      ConfidenceScore.high(),
      reasoning,
      [],
      criteria
    );
  }

  static createFallbackDecision(
    requestId: string,
    fallbackModelId: string,
    originalReason: string
  ): RoutingDecision {
    return new RoutingDecision(
      requestId,
      fallbackModelId,
      TaskComplexity.moderate(),
      RoutingPriority.medium(),
      ConfidenceScore.low(),
      `Fallback routing due to: ${originalReason}`,
      [],
      ModelSelectionCriteria.forQuickQuery()
    );
  }
}

/**
 * Configuration interface for external systems
 */
export interface RoutingDecisionConfiguration {
  requestId: string;
  selectedModelId: string;
  taskComplexity: string;
  priority: string;
  confidence: number;
  reasoning: string;
  alternatives: string[];
  decisionTime: string;
  criteria: {
    requiredCapabilities: string[];
    maxLatency?: number;
    minQuality?: number;
    preferSpeed: boolean;
    preferQuality: boolean;
  };
}
