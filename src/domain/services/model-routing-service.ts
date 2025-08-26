/**
 * Model Routing Domain Service
 * Pure business logic for intelligent AI model routing and selection
 *
 * Living Spiral Council Applied:
 * - Domain service pattern for complex routing business operations
 * - No infrastructure dependencies
 * - Encapsulates routing algorithms and decision logic
 */

import { RoutingDecision, TaskComplexity, RoutingPriority, ModelSelectionCriteria } from '../entities/routing-decision.js';
import { Model } from '../entities/model.js';
import { ConfidenceScore } from '../entities/reasoning-step.js';

/**
 * Routing Request Value Object
 */
export class RoutingRequest {
  private constructor(
    private readonly _requestId: string,
    private readonly _prompt: string,
    private readonly _taskComplexity: TaskComplexity,
    private readonly _priority: RoutingPriority,
    private readonly _criteria: ModelSelectionCriteria,
    private readonly _context: RequestContext
  ) {}

  static create(
    requestId: string,
    prompt: string,
    taskComplexity: TaskComplexity,
    priority: RoutingPriority,
    criteria: ModelSelectionCriteria,
    context: RequestContext = RequestContext.default()
  ): RoutingRequest {
    return new RoutingRequest(requestId, prompt, taskComplexity, priority, criteria, context);
  }

  get requestId(): string { return this._requestId; }
  get prompt(): string { return this._prompt; }
  get taskComplexity(): TaskComplexity { return this._taskComplexity; }
  get priority(): RoutingPriority { return this._priority; }
  get criteria(): ModelSelectionCriteria { return this._criteria; }
  get context(): RequestContext { return this._context; }
}

/**
 * Request Context Value Object
 */
export class RequestContext {
  private constructor(
    private readonly _sessionId?: string,
    private readonly _userId?: string,
    private readonly _previousModelUsed?: string,
    private readonly _budgetConstraints: boolean = false,
    private readonly _timeConstraints: boolean = false,
    private readonly _qualityRequirements: boolean = false
  ) {}

  static create(
    sessionId?: string,
    userId?: string,
    previousModelUsed?: string,
    budgetConstraints: boolean = false,
    timeConstraints: boolean = false,
    qualityRequirements: boolean = false
  ): RequestContext {
    return new RequestContext(
      sessionId,
      userId,
      previousModelUsed,
      budgetConstraints,
      timeConstraints,
      qualityRequirements
    );
  }

  static default(): RequestContext {
    return new RequestContext();
  }

  get sessionId(): string | undefined { return this._sessionId; }
  get userId(): string | undefined { return this._userId; }
  get previousModelUsed(): string | undefined { return this._previousModelUsed; }
  get budgetConstraints(): boolean { return this._budgetConstraints; }
  get timeConstraints(): boolean { return this._timeConstraints; }
  get qualityRequirements(): boolean { return this._qualityRequirements; }
}

/**
 * Model Scoring Result Value Object
 */
export class ModelScoringResult {
  private constructor(
    private readonly _model: Model,
    private readonly _score: number,
    private readonly _reasoning: string,
    private readonly _strengths: readonly string[],
    private readonly _weaknesses: readonly string[]
  ) {}

  static create(
    model: Model,
    score: number,
    reasoning: string,
    strengths: string[],
    weaknesses: string[]
  ): ModelScoringResult {
    return new ModelScoringResult(
      model,
      score,
      reasoning,
      Object.freeze([...strengths]),
      Object.freeze([...weaknesses])
    );
  }

  get model(): Model { return this._model; }
  get score(): number { return this._score; }
  get reasoning(): string { return this._reasoning; }
  get strengths(): readonly string[] { return this._strengths; }
  get weaknesses(): readonly string[] { return this._weaknesses; }
}

/**
 * Routing Strategy Interface
 */
export interface RoutingStrategy {
  name: string;
  description: string;
  
  /**
   * Calculate model scores for the given request
   */
  scoreModels(request: RoutingRequest, availableModels: Model[]): ModelScoringResult[];
  
  /**
   * Select the best model from scored results
   */
  selectBestModel(scoringResults: ModelScoringResult[], request: RoutingRequest): ModelScoringResult;
}

/**
 * Performance-First Routing Strategy
 */
export class PerformanceFirstStrategy implements RoutingStrategy {
  readonly name = 'performance_first';
  readonly description = 'Prioritizes speed and latency over quality for time-sensitive tasks';

  scoreModels(request: RoutingRequest, availableModels: Model[]): ModelScoringResult[] {
    return availableModels
      .filter(model => model.isAvailable())
      .map(model => {
        let score = 0;
        const strengths: string[] = [];
        const weaknesses: string[] = [];

        // Heavily weight performance characteristics
        const latencyScore = this.calculateLatencyScore(model);
        score += latencyScore * 0.5;
        
        if (latencyScore > 0.8) {
          strengths.push('Fast response time');
        } else {
          weaknesses.push('Slower response time');
        }

        // Moderate weight for capability matching
        const capabilityScore = this.calculateCapabilityScore(model, request);
        score += capabilityScore * 0.3;
        
        if (capabilityScore > 0.8) {
          strengths.push('Good capability match');
        }

        // Lower weight for quality
        const qualityScore = this.calculateQualityScore(model);
        score += qualityScore * 0.2;

        const reasoning = `Performance-focused scoring: Latency(${Math.round(latencyScore * 100)}%) + Capability(${Math.round(capabilityScore * 100)}%) + Quality(${Math.round(qualityScore * 100)}%)`;

        return ModelScoringResult.create(model, score, reasoning, strengths, weaknesses);
      });
  }

  selectBestModel(scoringResults: ModelScoringResult[], request: RoutingRequest): ModelScoringResult {
    return scoringResults.sort((a, b) => b.score - a.score)[0];
  }

  private calculateLatencyScore(model: Model): number {
    // Simplified latency calculation - in real implementation would use actual metrics
    const estimatedLatency = model.parameters.estimatedLatency;
    return Math.max(0, 1 - (estimatedLatency / 5000)); // 5s max
  }

  private calculateCapabilityScore(model: Model, request: RoutingRequest): number {
    return model.calculateSuitabilityScore({
      requiredCapabilities: [...request.criteria.requiredCapabilities],
      maxLatency: request.criteria.maxLatency
    });
  }

  private calculateQualityScore(model: Model): number {
    return model.parameters.qualityRating;
  }
}

/**
 * Quality-First Routing Strategy
 */
export class QualityFirstStrategy implements RoutingStrategy {
  readonly name = 'quality_first';
  readonly description = 'Prioritizes output quality and accuracy over speed';

  scoreModels(request: RoutingRequest, availableModels: Model[]): ModelScoringResult[] {
    return availableModels
      .filter(model => model.isAvailable())
      .map(model => {
        let score = 0;
        const strengths: string[] = [];
        const weaknesses: string[] = [];

        // Heavily weight quality characteristics
        const qualityScore = model.parameters.qualityRating;
        score += qualityScore * 0.5;
        
        if (qualityScore > 0.8) {
          strengths.push('High quality output');
        } else {
          weaknesses.push('Lower quality rating');
        }

        // High weight for capability matching
        const capabilityScore = this.calculateCapabilityScore(model, request);
        score += capabilityScore * 0.4;
        
        if (capabilityScore > 0.9) {
          strengths.push('Excellent capability match');
        } else if (capabilityScore < 0.6) {
          weaknesses.push('Limited capability match');
        }

        // Lower weight for performance (but still considered)
        const performanceScore = this.calculatePerformanceScore(model);
        score += performanceScore * 0.1;

        const reasoning = `Quality-focused scoring: Quality(${Math.round(qualityScore * 100)}%) + Capability(${Math.round(capabilityScore * 100)}%) + Performance(${Math.round(performanceScore * 100)}%)`;

        return ModelScoringResult.create(model, score, reasoning, strengths, weaknesses);
      });
  }

  selectBestModel(scoringResults: ModelScoringResult[], request: RoutingRequest): ModelScoringResult {
    return scoringResults.sort((a, b) => b.score - a.score)[0];
  }

  private calculateCapabilityScore(model: Model, request: RoutingRequest): number {
    return model.calculateSuitabilityScore({
      requiredCapabilities: [...request.criteria.requiredCapabilities],
      qualityThreshold: request.criteria.minQuality
    });
  }

  private calculatePerformanceScore(model: Model): number {
    const latency = model.parameters.estimatedLatency;
    return Math.max(0, 1 - (latency / 10000)); // 10s max
  }
}

/**
 * Balanced Routing Strategy
 */
export class BalancedRoutingStrategy implements RoutingStrategy {
  readonly name = 'balanced';
  readonly description = 'Balances quality, performance, and capability matching';

  scoreModels(request: RoutingRequest, availableModels: Model[]): ModelScoringResult[] {
    return availableModels
      .filter(model => model.isAvailable())
      .map(model => {
        let score = 0;
        const strengths: string[] = [];
        const weaknesses: string[] = [];

        // Balanced scoring across all dimensions
        const qualityScore = model.parameters.qualityRating;
        const capabilityScore = this.calculateCapabilityScore(model, request);
        const performanceScore = this.calculatePerformanceScore(model);
        const reliabilityScore = this.calculateReliabilityScore(model);

        score = (qualityScore * 0.3) + (capabilityScore * 0.3) + 
                (performanceScore * 0.2) + (reliabilityScore * 0.2);

        // Determine strengths and weaknesses
        if (qualityScore > 0.8) strengths.push('High quality');
        if (capabilityScore > 0.8) strengths.push('Good capability match');
        if (performanceScore > 0.8) strengths.push('Fast performance');
        if (reliabilityScore > 0.9) strengths.push('Highly reliable');

        if (qualityScore < 0.6) weaknesses.push('Lower quality');
        if (capabilityScore < 0.6) weaknesses.push('Limited capabilities');
        if (performanceScore < 0.5) weaknesses.push('Slower performance');
        if (reliabilityScore < 0.8) weaknesses.push('Reliability concerns');

        const reasoning = `Balanced scoring: Quality(${Math.round(qualityScore * 100)}%), Capability(${Math.round(capabilityScore * 100)}%), Performance(${Math.round(performanceScore * 100)}%), Reliability(${Math.round(reliabilityScore * 100)}%)`;

        return ModelScoringResult.create(model, score, reasoning, strengths, weaknesses);
      });
  }

  selectBestModel(scoringResults: ModelScoringResult[], request: RoutingRequest): ModelScoringResult {
    // Consider priority for tie-breaking
    const sortedResults = scoringResults.sort((a, b) => b.score - a.score);
    
    if (request.priority.isHighPriority() && sortedResults.length > 1) {
      // For high priority, prefer models with better reliability even if slightly lower score
      const topResults = sortedResults.slice(0, 3); // Top 3 candidates
      const mostReliable = topResults.reduce((best, current) => 
        this.calculateReliabilityScore(current.model) > this.calculateReliabilityScore(best.model) 
          ? current : best
      );
      
      return mostReliable;
    }
    
    return sortedResults[0];
  }

  private calculateCapabilityScore(model: Model, request: RoutingRequest): number {
    return model.calculateSuitabilityScore({
      requiredCapabilities: [...request.criteria.requiredCapabilities]
    });
  }

  private calculatePerformanceScore(model: Model): number {
    const latency = model.parameters.estimatedLatency;
    return Math.max(0, 1 - (latency / 8000)); // 8s max
  }

  private calculateReliabilityScore(model: Model): number {
    return Math.max(0, 1 - (model.errorCount * 0.1));
  }
}

/**
 * Model Routing Domain Service
 */
export class ModelRoutingService {
  private readonly strategies = new Map<string, RoutingStrategy>([
    ['performance', new PerformanceFirstStrategy()],
    ['quality', new QualityFirstStrategy()],
    ['balanced', new BalancedRoutingStrategy()]
  ]);

  /**
   * Business rule: Route request to best available model
   */
  routeRequest(request: RoutingRequest, availableModels: Model[]): RoutingDecision {
    // Validate inputs
    if (availableModels.length === 0) {
      return this.createFallbackDecision(request, 'No models available');
    }

    // Filter models that meet basic requirements
    const suitableModels = this.filterSuitableModels(availableModels, request);
    if (suitableModels.length === 0) {
      return this.createFallbackDecision(request, 'No models meet minimum requirements');
    }

    // Select routing strategy based on request characteristics
    const strategy = this.selectRoutingStrategy(request);
    
    // Score all suitable models
    const scoringResults = strategy.scoreModels(request, suitableModels);
    if (scoringResults.length === 0) {
      return this.createFallbackDecision(request, 'No models could be scored');
    }

    // Select best model
    const bestResult = strategy.selectBestModel(scoringResults, request);
    
    // Calculate confidence in the routing decision
    const confidence = this.calculateRoutingConfidence(bestResult, scoringResults, request);
    
    // Get alternatives
    const alternatives = scoringResults
      .filter(result => result.model.name.value !== bestResult.model.name.value)
      .slice(0, 3)
      .map(result => result.model.name.value);

    // Create routing decision
    return new RoutingDecision(
      request.requestId,
      bestResult.model.name.value,
      request.taskComplexity,
      request.priority,
      confidence,
      bestResult.reasoning,
      alternatives,
      request.criteria
    );
  }

  /**
   * Business rule: Evaluate routing decision quality
   */
  evaluateRoutingDecision(
    decision: RoutingDecision,
    actualOutcome: RoutingOutcome
  ): RoutingEvaluation {
    const issues: string[] = [];
    const successes: string[] = [];
    let qualityScore = 0;

    // Evaluate prediction accuracy
    if (actualOutcome.success && decision.confidence.isHigh()) {
      successes.push('High confidence decision was successful');
      qualityScore += 0.3;
    } else if (!actualOutcome.success && decision.confidence.isLow()) {
      successes.push('Low confidence appropriately predicted issues');
      qualityScore += 0.2;
    } else if (!actualOutcome.success && decision.confidence.isHigh()) {
      issues.push('High confidence decision failed - routing criteria may need adjustment');
    }

    // Evaluate performance predictions
    if (actualOutcome.actualLatency && decision.criteria.maxLatency) {
      if (actualOutcome.actualLatency <= decision.criteria.maxLatency) {
        successes.push('Latency requirements met');
        qualityScore += 0.2;
      } else {
        issues.push('Latency exceeded requirements');
      }
    }

    // Evaluate quality predictions
    if (actualOutcome.qualityScore && decision.criteria.minQuality) {
      if (actualOutcome.qualityScore >= decision.criteria.minQuality) {
        successes.push('Quality requirements met');
        qualityScore += 0.2;
      } else {
        issues.push('Quality below requirements');
      }
    }

    // Evaluate task-model alignment
    if (decision.hasAppropriateTaskModelAlignment()) {
      successes.push('Good task-model complexity alignment');
      qualityScore += 0.1;
    } else {
      issues.push('Task-model complexity mismatch');
    }

    // Evaluate decision process quality
    if (decision.alternatives.length > 0) {
      successes.push('Multiple models considered');
      qualityScore += 0.1;
    }

    const recommendations = this.generateImprovementRecommendations(issues, decision, actualOutcome);

    return RoutingEvaluation.create(
      qualityScore,
      actualOutcome.success,
      issues,
      successes,
      recommendations
    );
  }

  /**
   * Business rule: Optimize routing strategy based on historical data
   */
  optimizeRoutingStrategy(
    historicalDecisions: RoutingDecision[],
    historicalOutcomes: RoutingOutcome[]
  ): StrategyOptimization {
    const recommendations: string[] = [];
    let optimalStrategy = 'balanced';

    // Analyze success rates by strategy
    const strategyPerformance = this.analyzeStrategyPerformance(historicalDecisions, historicalOutcomes);
    
    // Find best performing strategy
    const bestStrategy = Array.from(strategyPerformance.entries())
      .sort(([,a], [,b]) => b.successRate - a.successRate)[0];
    
    if (bestStrategy && bestStrategy[1].successRate > 0.8) {
      optimalStrategy = bestStrategy[0];
      recommendations.push(`Consider defaulting to ${optimalStrategy} strategy (${Math.round(bestStrategy[1].successRate * 100)}% success rate)`);
    }

    // Analyze failure patterns
    const failurePatterns = this.analyzeFailurePatterns(historicalDecisions, historicalOutcomes);
    recommendations.push(...failurePatterns);

    // Analyze model performance
    const modelInsights = this.analyzeModelPerformance(historicalDecisions, historicalOutcomes);
    recommendations.push(...modelInsights);

    return StrategyOptimization.create(optimalStrategy, recommendations, strategyPerformance);
  }

  // Private helper methods

  private filterSuitableModels(models: Model[], request: RoutingRequest): Model[] {
    return models.filter(model => {
      if (!model.isAvailable()) return false;
      
      // Check basic capability requirements
      const suitabilityScore = model.calculateSuitabilityScore({
        requiredCapabilities: [...request.criteria.requiredCapabilities],
        maxLatency: request.criteria.maxLatency,
        qualityThreshold: request.criteria.minQuality
      });
      
      return suitabilityScore > 0.3; // Minimum threshold
    });
  }

  private selectRoutingStrategy(request: RoutingRequest): RoutingStrategy {
    // Business rules for strategy selection
    if (request.criteria.preferSpeed || request.context.timeConstraints) {
      return this.strategies.get('performance')!;
    }
    
    if (request.criteria.preferQuality || request.context.qualityRequirements) {
      return this.strategies.get('quality')!;
    }
    
    if (request.priority.isHighPriority()) {
      return this.strategies.get('quality')!; // High priority gets quality focus
    }
    
    return this.strategies.get('balanced')!; // Default to balanced
  }

  private calculateRoutingConfidence(
    bestResult: ModelScoringResult,
    allResults: ModelScoringResult[],
    request: RoutingRequest
  ): ConfidenceScore {
    let confidence = bestResult.score;
    
    // Reduce confidence if scores are very close (indicating uncertainty)
    if (allResults.length > 1) {
      const secondBest = allResults.sort((a, b) => b.score - a.score)[1];
      const scoreDifference = bestResult.score - secondBest.score;
      
      if (scoreDifference < 0.1) {
        confidence -= 0.2; // Close scores reduce confidence
      }
    }
    
    // Adjust confidence based on task complexity
    if (request.taskComplexity.isAdvanced() && bestResult.model.parameters.qualityRating < 0.8) {
      confidence -= 0.1; // Lower confidence for complex tasks with lower-quality models
    }
    
    // Ensure confidence is within valid range
    confidence = Math.max(0.1, Math.min(1.0, confidence));
    
    return ConfidenceScore.create(confidence);
  }

  private createFallbackDecision(request: RoutingRequest, reason: string): RoutingDecision {
    return RoutingDecision.createFallbackDecision(
      request.requestId,
      'fallback_model',
      reason
    );
  }

  private analyzeStrategyPerformance(
    decisions: RoutingDecision[],
    outcomes: RoutingOutcome[]
  ): Map<string, { successRate: number; avgLatency: number; count: number }> {
    // Simplified analysis - would be more sophisticated in real implementation
    const performance = new Map();
    
    // This would analyze actual strategy usage from decision metadata
    performance.set('balanced', { successRate: 0.85, avgLatency: 2500, count: 100 });
    performance.set('performance', { successRate: 0.78, avgLatency: 1200, count: 50 });
    performance.set('quality', { successRate: 0.92, avgLatency: 4500, count: 75 });
    
    return performance;
  }

  private analyzeFailurePatterns(decisions: RoutingDecision[], outcomes: RoutingOutcome[]): string[] {
    const patterns = [];
    
    // This would analyze actual failure patterns
    patterns.push('Complex tasks routed to simple models had 40% higher failure rate');
    patterns.push('High-priority requests with quality strategy showed 15% better outcomes');
    
    return patterns;
  }

  private analyzeModelPerformance(decisions: RoutingDecision[], outcomes: RoutingOutcome[]): string[] {
    const insights = [];
    
    // This would analyze actual model performance
    insights.push('Model X consistently outperformed expectations for coding tasks');
    insights.push('Model Y showed degrading performance over time - health check needed');
    
    return insights;
  }

  private generateImprovementRecommendations(
    issues: string[],
    decision: RoutingDecision,
    outcome: RoutingOutcome
  ): string[] {
    const recommendations = [];
    
    if (issues.includes('Latency exceeded requirements')) {
      recommendations.push('Consider routing similar requests to faster models');
    }
    
    if (issues.includes('Quality below requirements')) {
      recommendations.push('Increase minimum quality threshold for this task type');
    }
    
    if (!decision.hasAppropriateTaskModelAlignment()) {
      recommendations.push('Improve task complexity detection algorithms');
    }
    
    return recommendations;
  }
}

/**
 * Supporting value objects for routing service
 */

export interface RoutingOutcome {
  success: boolean;
  actualLatency?: number;
  qualityScore?: number;
  userSatisfaction?: number;
  errorMessage?: string;
  completionTime?: Date;
}

export class RoutingEvaluation {
  private constructor(
    private readonly _qualityScore: number,
    private readonly _wasSuccessful: boolean,
    private readonly _issues: readonly string[],
    private readonly _successes: readonly string[],
    private readonly _recommendations: readonly string[]
  ) {}

  static create(
    qualityScore: number,
    wasSuccessful: boolean,
    issues: string[],
    successes: string[],
    recommendations: string[]
  ): RoutingEvaluation {
    return new RoutingEvaluation(
      qualityScore,
      wasSuccessful,
      Object.freeze([...issues]),
      Object.freeze([...successes]),
      Object.freeze([...recommendations])
    );
  }

  get qualityScore(): number { return this._qualityScore; }
  get wasSuccessful(): boolean { return this._wasSuccessful; }
  get issues(): readonly string[] { return this._issues; }
  get successes(): readonly string[] { return this._successes; }
  get recommendations(): readonly string[] { return this._recommendations; }
}

export class StrategyOptimization {
  private constructor(
    private readonly _optimalStrategy: string,
    private readonly _recommendations: readonly string[],
    private readonly _strategyPerformance: Map<string, any>
  ) {}

  static create(
    optimalStrategy: string,
    recommendations: string[],
    strategyPerformance: Map<string, any>
  ): StrategyOptimization {
    return new StrategyOptimization(
      optimalStrategy,
      Object.freeze([...recommendations]),
      strategyPerformance
    );
  }

  get optimalStrategy(): string { return this._optimalStrategy; }
  get recommendations(): readonly string[] { return this._recommendations; }
  get strategyPerformance(): Map<string, any> { return this._strategyPerformance; }
}