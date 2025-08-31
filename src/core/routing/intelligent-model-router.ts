/**
 * Intelligent Model Router with Cost Optimization
 * Routes requests between LM Studio (fast tasks) and Ollama (complex reasoning)
 * based on query complexity, confidence, and cost constraints
 */

import { EventEmitter } from 'events';
import { createLogger } from '../logger.js';
import { ILogger } from '../../domain/interfaces/logger.js';
import { UnifiedModelClient } from '../../application/services/client.js';

// Core Router Interfaces
export interface ModelProvider {
  id: string;
  name: string;
  type: 'lm-studio' | 'ollama' | 'openai' | 'anthropic' | 'local';
  endpoint: string;
  models: ModelSpec[];
  capabilities: ProviderCapability[];
  costProfile: CostProfile;
  performanceProfile: PerformanceProfile;
  healthStatus: HealthStatus;
}

export interface ModelSpec {
  id: string;
  name: string;
  displayName: string;
  contextWindow: number;
  maxTokens: number;
  strengthProfiles: StrengthProfile[];
  costPerToken: {
    input: number;
    output: number;
  };
  latencyProfile: {
    firstToken: number; // ms
    tokensPerSecond: number;
  };
  qualityScore: number; // 0-1
  supportedFeatures: string[];
}

export interface StrengthProfile {
  category:
    | 'code-generation'
    | 'analysis'
    | 'editing'
    | 'documentation'
    | 'debugging'
    | 'refactoring';
  score: number; // 0-1
  examples: string[];
}

export interface ProviderCapability {
  feature: 'streaming' | 'function-calling' | 'vision' | 'embeddings' | 'fine-tuning';
  supported: boolean;
  metadata?: Record<string, any>;
}

export interface CostProfile {
  tier: 'free' | 'local' | 'paid' | 'premium';
  dailyQuota?: number;
  monthlyQuota?: number;
  costPerRequest: number;
  costOptimized: boolean;
}

export interface PerformanceProfile {
  averageLatency: number;
  throughput: number; // requests per second
  reliability: number; // 0-1
  uptime: number; // percentage
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unavailable';
  lastChecked: Date;
  responseTime: number;
  errorRate: number;
  availableModels: string[];
}

export interface RoutingRequest {
  query: string;
  context?: string;
  taskType: TaskType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  constraints: RoutingConstraints;
  userPreferences?: UserPreferences;
  sessionContext?: SessionContext;
}

export interface TaskType {
  category:
    | 'code-generation'
    | 'analysis'
    | 'editing'
    | 'documentation'
    | 'debugging'
    | 'refactoring'
    | 'general';
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  estimatedTokens: number;
  timeConstraint?: number; // max response time in ms
  qualityRequirement: 'draft' | 'production' | 'critical';
}

export interface RoutingConstraints {
  maxCost: number;
  maxLatency: number;
  preferredProviders?: string[];
  excludedProviders?: string[];
  requireLocal?: boolean;
  requireStreaming?: boolean;
}

export interface UserPreferences {
  preferredSpeed: 'fast' | 'balanced' | 'quality';
  costSensitivity: 'low' | 'medium' | 'high';
  privacyLevel: 'low' | 'medium' | 'high';
  qualityThreshold: number; // 0-1
}

export interface SessionContext {
  sessionId: string;
  previousRequests: RoutingDecision[];
  userSatisfaction: number; // 0-1
  domainContext?: string;
  projectType?: string;
}

export interface RoutingDecision {
  provider: ModelProvider;
  model: ModelSpec;
  confidence: number; // 0-1
  estimatedCost: number;
  estimatedLatency: number;
  reasoning: string;
  fallbackProviders: ModelProvider[];
  routingStrategy: RoutingStrategy;
  metadata: RoutingMetadata;
}

export interface RoutingMetadata {
  taskComplexityScore: number;
  costOptimizationScore: number;
  performanceScore: number;
  confidenceFactors: string[];
  alternativesConsidered: number;
  routingTime: number;
}

export interface RoutingStrategy {
  primary: 'cost-optimized' | 'performance-optimized' | 'quality-optimized' | 'balanced';
  fallback: 'escalate' | 'degrade' | 'retry' | 'fail';
  escalationTriggers: EscalationTrigger[];
}

export interface EscalationTrigger {
  condition: 'low-confidence' | 'high-cost' | 'timeout' | 'error' | 'quality-threshold';
  threshold: number;
  action: 'upgrade-model' | 'change-provider' | 'retry' | 'abort';
}

export interface RouterConfig {
  providers: ModelProvider[];
  defaultStrategy: RoutingStrategy;
  costOptimization: {
    enabled: boolean;
    budgetLimits: {
      daily: number;
      monthly: number;
    };
    thresholds: {
      lowCost: number;
      mediumCost: number;
      highCost: number;
    };
  };
  performance: {
    healthCheckInterval: number;
    timeoutMs: number;
    retryAttempts: number;
    circuitBreakerThreshold: number;
  };
  intelligence: {
    learningEnabled: boolean;
    adaptiveRouting: boolean;
    qualityFeedbackWeight: number;
    costFeedbackWeight: number;
  };
}

// Intelligent Model Router
export class IntelligentModelRouter extends EventEmitter {
  private logger: ILogger;
  private config: RouterConfig;
  private providers: Map<string, ModelProvider> = new Map();
  private modelSpecs: Map<string, ModelSpec> = new Map();
  private routingHistory: RoutingDecision[] = [];
  private performanceMetrics: RouterMetrics;
  private costTracker: CostTracker;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private adaptiveLearning: AdaptiveLearning;
  private healthMonitor: HealthMonitor;

  constructor(config: RouterConfig) {
    super();
    this.logger = createLogger('IntelligentModelRouter');
    this.config = config;
    this.performanceMetrics = new RouterMetrics();
    this.costTracker = new CostTracker(config.costOptimization);
    this.adaptiveLearning = new AdaptiveLearning(config.intelligence);
    this.healthMonitor = new HealthMonitor(this);

    this.initializeProviders();
    this.startHealthMonitoring();
  }

  /**
   * Route a request to the optimal model provider
   */
  async route(request: RoutingRequest): Promise<RoutingDecision> {
    const startTime = Date.now();
    this.logger.info(
      `Routing request: ${request.taskType.category} (${request.taskType.complexity})`
    );

    try {
      // Analyze task complexity and requirements
      const taskAnalysis = await this.analyzeTask(request);

      // Score all available providers
      const candidates = await this.scoreProviders(request, taskAnalysis);

      // Apply cost optimization
      const costOptimizedCandidates = this.applyCostOptimization(candidates, request);

      // Select best provider based on strategy
      const decision = this.selectProvider(costOptimizedCandidates, request, taskAnalysis);

      // Apply circuit breaker pattern
      const healthyDecision = await this.applyCircuitBreaker(decision);

      // Record decision for learning
      this.recordDecision(healthyDecision, request);

      const routingTime = Date.now() - startTime;
      healthyDecision.metadata.routingTime = routingTime;

      this.emit('routing:completed', { request, decision: healthyDecision });
      return healthyDecision;
    } catch (error) {
      this.logger.error('Routing failed:', error);
      this.emit('routing:failed', { request, error });

      // Return fallback decision
      return this.createFallbackDecision(request);
    }
  }

  /**
   * Provide feedback on routing decision quality
   */
  async provideFeedback(decision: RoutingDecision, feedback: RoutingFeedback): Promise<void> {
    this.logger.debug(`Received feedback for routing decision: ${feedback.satisfaction}`);

    // Update provider metrics
    this.updateProviderMetrics(decision.provider.id, feedback);

    // Update adaptive learning
    if (this.config.intelligence.learningEnabled) {
      await this.adaptiveLearning.processFeedback(decision, feedback);
    }

    // Update cost tracking
    this.costTracker.recordActualCost(decision, feedback.actualCost);

    this.emit('feedback:received', { decision, feedback });
  }

  /**
   * Get routing recommendations for a task type
   */
  async getRecommendations(taskType: TaskType): Promise<ProviderRecommendation[]> {
    const recommendations: ProviderRecommendation[] = [];

    for (const provider of this.providers.values()) {
      if (provider.healthStatus.status !== 'healthy') continue;

      for (const model of provider.models) {
        const score = this.calculateModelScore(model, taskType);
        const estimatedCost = this.estimateCost(model, taskType.estimatedTokens);
        const estimatedLatency = this.estimateLatency(model, taskType.estimatedTokens);

        recommendations.push({
          provider,
          model,
          score,
          estimatedCost,
          estimatedLatency,
          reasoning: this.generateRecommendationReasoning(model, taskType, score),
        });
      }
    }

    return recommendations.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  /**
   * Get current router statistics
   */
  getStats(): RouterStats {
    return {
      providers: Array.from(this.providers.values()),
      performance: this.performanceMetrics.getStats(),
      costs: this.costTracker.getStats(),
      health: this.getHealthStats(),
      routing: {
        totalDecisions: this.routingHistory.length,
        successRate: this.calculateSuccessRate(),
        averageRoutingTime: this.calculateAverageRoutingTime(),
        topProviders: this.getTopProviders(),
        costSavings: this.calculateCostSavings(),
      },
    };
  }

  /**
   * Private Methods
   */

  private initializeProviders(): void {
    for (const providerConfig of this.config.providers) {
      this.providers.set(providerConfig.id, providerConfig);

      // Initialize circuit breaker for each provider
      this.circuitBreakers.set(
        providerConfig.id,
        new CircuitBreaker(providerConfig.id, this.config.performance)
      );

      // Index models by ID
      for (const model of providerConfig.models) {
        this.modelSpecs.set(model.id, model);
      }
    }

    this.logger.info(
      `Initialized ${this.providers.size} providers with ${this.modelSpecs.size} models`
    );
  }

  private async analyzeTask(request: RoutingRequest): Promise<TaskAnalysis> {
    const complexity = this.calculateComplexityScore(request);
    const requirements = this.extractRequirements(request);
    const constraints = this.analyzeConstraints(request.constraints);

    return {
      complexityScore: complexity,
      requirements,
      constraints,
      categories: this.categorizeTask(request),
      estimatedResources: this.estimateRequiredResources(request),
    };
  }

  private calculateComplexityScore(request: RoutingRequest): number {
    let score = 0;

    // Base complexity from task type
    const complexityMap = {
      simple: 0.2,
      moderate: 0.5,
      complex: 0.8,
      expert: 1.0,
    };
    score += complexityMap[request.taskType.complexity] || 0.5;

    // Adjust based on query length and content
    const queryComplexity = this.analyzeQueryComplexity(request.query);
    score = (score + queryComplexity) / 2;

    // Context complexity
    if (request.context) {
      const contextComplexity = this.analyzeQueryComplexity(request.context);
      score = score * 0.8 + contextComplexity * 0.2;
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  private analyzeQueryComplexity(query: string): number {
    let complexity = 0;

    // Length factor
    const lengthFactor = Math.min(1.0, query.length / 1000);
    complexity += lengthFactor * 0.3;

    // Technical terms
    const technicalTerms = [
      'algorithm',
      'optimize',
      'refactor',
      'debug',
      'architecture',
      'design pattern',
      'performance',
      'security',
      'scalability',
    ];
    const technicalScore =
      technicalTerms.filter(term => query.toLowerCase().includes(term)).length /
      technicalTerms.length;
    complexity += technicalScore * 0.4;

    // Code patterns
    const codePatterns = [
      /function\s+\w+/,
      /class\s+\w+/,
      /interface\s+\w+/,
      /import\s+.*from/,
      /export\s+/,
      /async\s+/,
      /await\s+/,
    ];
    const codeScore =
      codePatterns.filter(pattern => pattern.test(query)).length / codePatterns.length;
    complexity += codeScore * 0.3;

    return Math.min(1.0, complexity);
  }

  private async scoreProviders(
    request: RoutingRequest,
    taskAnalysis: TaskAnalysis
  ): Promise<ScoredProvider[]> {
    const scoredProviders: ScoredProvider[] = [];

    for (const provider of this.providers.values()) {
      if (provider.healthStatus.status === 'unavailable') continue;

      for (const model of provider.models) {
        const score = await this.calculateProviderScore(provider, model, request, taskAnalysis);

        scoredProviders.push({
          provider,
          model,
          score,
          reasons: this.getScoreReasons(provider, model, request, taskAnalysis),
        });
      }
    }

    return scoredProviders.sort((a, b) => b.score.total - a.score.total);
  }

  private async calculateProviderScore(
    provider: ModelProvider,
    model: ModelSpec,
    request: RoutingRequest,
    taskAnalysis: TaskAnalysis
  ): Promise<ProviderScore> {
    // Base scores
    let qualityScore = this.calculateQualityScore(model, request.taskType);
    let performanceScore = this.calculatePerformanceScore(provider, request);
    let costScore = this.calculateCostScore(model, request);
    const reliabilityScore = provider.performanceProfile.reliability;

    // Apply user preferences
    if (request.userPreferences) {
      const prefWeights = this.calculatePreferenceWeights(request.userPreferences);
      qualityScore *= prefWeights.quality;
      performanceScore *= prefWeights.performance;
      costScore *= prefWeights.cost;
    }

    // Apply adaptive learning adjustments
    if (this.config.intelligence.adaptiveRouting) {
      const learningAdjustment = await this.adaptiveLearning.getProviderAdjustment(
        provider.id,
        model.id,
        request.taskType
      );
      qualityScore *= learningAdjustment;
    }

    // Constraint penalties
    const constraintPenalty = this.calculateConstraintPenalty(provider, model, request.constraints);

    // Weighted total score
    const weights = {
      quality: 0.35,
      performance: 0.25,
      cost: 0.25,
      reliability: 0.15,
    };

    const total =
      (qualityScore * weights.quality +
        performanceScore * weights.performance +
        costScore * weights.cost +
        reliabilityScore * weights.reliability) *
      (1 - constraintPenalty);

    return {
      total,
      quality: qualityScore,
      performance: performanceScore,
      cost: costScore,
      reliability: reliabilityScore,
      constraintPenalty,
    };
  }

  private calculateQualityScore(model: ModelSpec, taskType: TaskType): number {
    // Find matching strength profile
    const strengthProfile = model.strengthProfiles.find(
      profile => profile.category === taskType.category
    );

    const baseScore = strengthProfile?.score || model.qualityScore;

    // Adjust for quality requirement
    const qualityMap = {
      draft: 0.7,
      production: 1.0,
      critical: 1.2,
    };

    return Math.min(1.0, baseScore * (qualityMap[taskType.qualityRequirement] || 1.0));
  }

  private calculatePerformanceScore(provider: ModelProvider, request: RoutingRequest): number {
    const latency = provider.performanceProfile.averageLatency;
    const maxLatency = request.constraints.maxLatency || 10000;

    // Latency score (lower is better)
    const latencyScore = Math.max(0, 1 - latency / maxLatency);

    // Throughput score
    const throughputScore = Math.min(1.0, provider.performanceProfile.throughput / 10);

    // Health status modifier
    const healthModifier = provider.healthStatus.status === 'healthy' ? 1.0 : 0.5;

    return (latencyScore * 0.6 + throughputScore * 0.4) * healthModifier;
  }

  private calculateCostScore(model: ModelSpec, request: RoutingRequest): number {
    const estimatedCost = this.estimateCost(model, request.taskType.estimatedTokens);
    const maxCost = request.constraints.maxCost || 1.0;

    // Invert cost (lower cost = higher score)
    return Math.max(0, 1 - estimatedCost / maxCost);
  }

  private estimateCost(model: ModelSpec, estimatedTokens: number): number {
    const inputTokens = estimatedTokens * 0.7; // Assume 70% input
    const outputTokens = estimatedTokens * 0.3; // Assume 30% output

    return inputTokens * model.costPerToken.input + outputTokens * model.costPerToken.output;
  }

  private estimateLatency(model: ModelSpec, estimatedTokens: number): number {
    const outputTokens = estimatedTokens * 0.3;
    return (
      model.latencyProfile.firstToken + (outputTokens / model.latencyProfile.tokensPerSecond) * 1000
    );
  }

  private applyCostOptimization(
    candidates: ScoredProvider[],
    request: RoutingRequest
  ): ScoredProvider[] {
    if (!this.config.costOptimization.enabled) return candidates;

    const budget = this.costTracker.getRemainingBudget();
    if (!budget.hasRemaining) {
      // Filter to only free/local providers
      return candidates.filter(
        c => c.provider.costProfile.tier === 'free' || c.provider.costProfile.tier === 'local'
      );
    }

    // Boost cost-optimized providers
    return candidates.map(candidate => {
      if (candidate.provider.costProfile.costOptimized) {
        candidate.score.total *= 1.1;
      }
      return candidate;
    });
  }

  private selectProvider(
    candidates: ScoredProvider[],
    request: RoutingRequest,
    taskAnalysis: TaskAnalysis
  ): RoutingDecision {
    if (candidates.length === 0) {
      throw new Error('No suitable providers available');
    }

    const selectedCandidate = candidates[0];
    const fallbacks = candidates.slice(1, 4).map(c => c.provider);

    const estimatedCost = this.estimateCost(
      selectedCandidate.model,
      request.taskType.estimatedTokens
    );

    const estimatedLatency = this.estimateLatency(
      selectedCandidate.model,
      request.taskType.estimatedTokens
    );

    return {
      provider: selectedCandidate.provider,
      model: selectedCandidate.model,
      confidence: selectedCandidate.score.total,
      estimatedCost,
      estimatedLatency,
      reasoning: this.generateRoutingReasoning(selectedCandidate, taskAnalysis),
      fallbackProviders: fallbacks,
      routingStrategy: this.determineRoutingStrategy(request, selectedCandidate),
      metadata: {
        taskComplexityScore: taskAnalysis.complexityScore,
        costOptimizationScore: selectedCandidate.score.cost,
        performanceScore: selectedCandidate.score.performance,
        confidenceFactors: selectedCandidate.reasons,
        alternativesConsidered: candidates.length,
        routingTime: 0, // Will be set later
      },
    };
  }

  private generateRoutingReasoning(candidate: ScoredProvider, taskAnalysis: TaskAnalysis): string {
    const reasons = [];

    if (candidate.score.quality > 0.8) {
      reasons.push(`high quality score (${(candidate.score.quality * 100).toFixed(0)}%)`);
    }

    if (candidate.score.performance > 0.8) {
      reasons.push(`excellent performance (${(candidate.score.performance * 100).toFixed(0)}%)`);
    }

    if (candidate.score.cost > 0.8) {
      reasons.push(`cost-effective (${(candidate.score.cost * 100).toFixed(0)}%)`);
    }

    if (candidate.provider.costProfile.tier === 'local') {
      reasons.push('local execution for privacy');
    }

    return `Selected ${candidate.provider.name}/${candidate.model.name} for ${reasons.join(', ')}`;
  }

  private async applyCircuitBreaker(decision: RoutingDecision): Promise<RoutingDecision> {
    const circuitBreaker = this.circuitBreakers.get(decision.provider.id);

    if (circuitBreaker && !circuitBreaker.canExecute()) {
      this.logger.warn(`Circuit breaker open for ${decision.provider.name}, using fallback`);

      // Use first available fallback
      for (const fallback of decision.fallbackProviders) {
        const fallbackCircuitBreaker = this.circuitBreakers.get(fallback.id);
        if (!fallbackCircuitBreaker || fallbackCircuitBreaker.canExecute()) {
          return {
            ...decision,
            provider: fallback,
            model: fallback.models[0], // Use default model
            reasoning: `${decision.reasoning} (fallback due to circuit breaker)`,
          };
        }
      }

      throw new Error('All providers unavailable due to circuit breakers');
    }

    return decision;
  }

  private createFallbackDecision(request: RoutingRequest): RoutingDecision {
    // Find any healthy local provider
    const localProvider = Array.from(this.providers.values()).find(
      p => p.costProfile.tier === 'local' && p.healthStatus.status === 'healthy'
    );

    if (!localProvider) {
      throw new Error('No fallback providers available');
    }

    return {
      provider: localProvider,
      model: localProvider.models[0],
      confidence: 0.3,
      estimatedCost: 0,
      estimatedLatency: 5000,
      reasoning: 'Fallback to local provider due to routing failure',
      fallbackProviders: [],
      routingStrategy: {
        primary: 'cost-optimized',
        fallback: 'fail',
        escalationTriggers: [],
      },
      metadata: {
        taskComplexityScore: 0.5,
        costOptimizationScore: 1.0,
        performanceScore: 0.3,
        confidenceFactors: ['fallback'],
        alternativesConsidered: 0,
        routingTime: 0,
      },
    };
  }

  private recordDecision(decision: RoutingDecision, request: RoutingRequest): void {
    this.routingHistory.push(decision);

    // Keep only recent history
    if (this.routingHistory.length > 1000) {
      this.routingHistory = this.routingHistory.slice(-500);
    }

    // Update metrics
    this.performanceMetrics.recordDecision(decision, request);
  }

  private updateProviderMetrics(providerId: string, feedback: RoutingFeedback): void {
    const provider = this.providers.get(providerId);
    if (!provider) return;

    // Update performance profile
    if (feedback.actualLatency) {
      provider.performanceProfile.averageLatency =
        provider.performanceProfile.averageLatency * 0.9 + feedback.actualLatency * 0.1;
    }

    // Update reliability based on success
    const successWeight = feedback.success ? 0.05 : -0.1;
    provider.performanceProfile.reliability = Math.max(
      0,
      Math.min(1, provider.performanceProfile.reliability + successWeight)
    );
  }

  private startHealthMonitoring(): void {
    this.healthMonitor.start();
    this.logger.info('Health monitoring started');
  }

  /**
   * Shutdown the router and clean up resources
   */
  public shutdown(): void {
    this.logger.info('🛑 Shutting down IntelligentModelRouter...');

    // Stop health monitoring
    if (this.healthMonitor) {
      this.healthMonitor.stop();
    }

    // Clear all collections to prevent memory leaks
    this.providers.clear();
    this.routingHistory.length = 0;
    this.circuitBreakers.clear();

    this.logger.info('✅ IntelligentModelRouter shutdown complete');
  }

  private calculateSuccessRate(): number {
    if (this.routingHistory.length === 0) return 0;

    const recentDecisions = this.routingHistory.slice(-100);
    const successful = recentDecisions.filter(d => d.confidence > 0.7).length;

    return successful / recentDecisions.length;
  }

  private calculateAverageRoutingTime(): number {
    if (this.routingHistory.length === 0) return 0;

    const recentDecisions = this.routingHistory.slice(-100);
    const totalTime = recentDecisions.reduce((sum, d) => sum + d.metadata.routingTime, 0);

    return totalTime / recentDecisions.length;
  }

  private getTopProviders(): Array<{ providerId: string; usage: number }> {
    const usage = new Map<string, number>();

    for (const decision of this.routingHistory.slice(-100)) {
      const count = usage.get(decision.provider.id) || 0;
      usage.set(decision.provider.id, count + 1);
    }

    return Array.from(usage.entries())
      .map(([providerId, count]) => ({ providerId, usage: count }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 5);
  }

  private calculateCostSavings(): number {
    // Calculate estimated savings from intelligent routing
    return this.costTracker.getEstimatedSavings();
  }

  private getHealthStats(): HealthStats {
    const providers = Array.from(this.providers.values());

    return {
      totalProviders: providers.length,
      healthyProviders: providers.filter(p => p.healthStatus.status === 'healthy').length,
      degradedProviders: providers.filter(p => p.healthStatus.status === 'degraded').length,
      unavailableProviders: providers.filter(p => p.healthStatus.status === 'unavailable').length,
      circuitBreakers: Object.fromEntries(
        Array.from(this.circuitBreakers.entries()).map(([id, cb]) => [id, cb.getState()])
      ),
    };
  }

  // Additional helper methods would be implemented here...
  private extractRequirements(request: RoutingRequest): string[] {
    return [];
  }
  private analyzeConstraints(constraints: RoutingConstraints): any {
    return {};
  }
  private categorizeTask(request: RoutingRequest): string[] {
    return [];
  }
  private estimateRequiredResources(request: RoutingRequest): any {
    return {};
  }
  private getScoreReasons(
    provider: ModelProvider,
    model: ModelSpec,
    request: RoutingRequest,
    analysis: TaskAnalysis
  ): string[] {
    return [];
  }
  private calculatePreferenceWeights(preferences: UserPreferences): any {
    return { quality: 1, performance: 1, cost: 1 };
  }
  private calculateConstraintPenalty(
    provider: ModelProvider,
    model: ModelSpec,
    constraints: RoutingConstraints
  ): number {
    return 0;
  }
  private determineRoutingStrategy(
    request: RoutingRequest,
    candidate: ScoredProvider
  ): RoutingStrategy {
    return { primary: 'balanced', fallback: 'escalate', escalationTriggers: [] };
  }
  private calculateModelScore(model: ModelSpec, taskType: TaskType): number {
    return 0.5;
  }
  private generateRecommendationReasoning(
    model: ModelSpec,
    taskType: TaskType,
    score: number
  ): string {
    return '';
  }

  /**
   * Destroy the router and clean up all resources
   */
  destroy(): void {
    this.logger.info('Destroying IntelligentModelRouter and cleaning up resources');

    // Stop health monitoring
    if (this.healthMonitor) {
      this.healthMonitor.destroy();
    }

    // Clear circuit breakers
    this.circuitBreakers.clear();

    // Clear providers
    this.providers.clear();

    // Clear model specs
    this.modelSpecs.clear();

    // Clear routing history to free memory
    this.routingHistory = [];

    // Remove all listeners
    this.removeAllListeners();

    this.logger.info('IntelligentModelRouter destroyed successfully');
  }
}

// Supporting classes and interfaces
interface TaskAnalysis {
  complexityScore: number;
  requirements: string[];
  constraints: any;
  categories: string[];
  estimatedResources: any;
}

interface ScoredProvider {
  provider: ModelProvider;
  model: ModelSpec;
  score: ProviderScore;
  reasons: string[];
}

interface ProviderScore {
  total: number;
  quality: number;
  performance: number;
  cost: number;
  reliability: number;
  constraintPenalty: number;
}

interface ProviderRecommendation {
  provider: ModelProvider;
  model: ModelSpec;
  score: number;
  estimatedCost: number;
  estimatedLatency: number;
  reasoning: string;
}

export interface RoutingFeedback {
  success: boolean;
  satisfaction: number; // 0-1
  actualCost?: number;
  actualLatency?: number;
  qualityRating?: number;
  comments?: string;
}

interface RouterStats {
  providers: ModelProvider[];
  performance: any;
  costs: any;
  health: HealthStats;
  routing: {
    totalDecisions: number;
    successRate: number;
    averageRoutingTime: number;
    topProviders: Array<{ providerId: string; usage: number }>;
    costSavings: number;
  };
}

interface HealthStats {
  totalProviders: number;
  healthyProviders: number;
  degradedProviders: number;
  unavailableProviders: number;
  circuitBreakers: Record<string, any>;
}

// Full implementations of supporting classes
class RouterMetrics {
  private decisions: RoutingDecision[] = [];
  private requestsByCategory: Map<string, number> = new Map();
  private latencyByProvider: Map<string, number[]> = new Map();
  private successByProvider: Map<string, number[]> = new Map();
  private costByProvider: Map<string, number> = new Map();
  private startTime: Date = new Date();

  recordDecision(decision: RoutingDecision, request: RoutingRequest): void {
    this.decisions.push(decision);

    // Track requests by category
    const category = request.taskType.category;
    this.requestsByCategory.set(category, (this.requestsByCategory.get(category) || 0) + 1);

    // Initialize provider tracking
    const providerId = decision.provider.id;
    if (!this.latencyByProvider.has(providerId)) {
      this.latencyByProvider.set(providerId, []);
      this.successByProvider.set(providerId, []);
      this.costByProvider.set(providerId, 0);
    }

    // Record estimated latency
    this.latencyByProvider.get(providerId)!.push(decision.estimatedLatency);

    // Record estimated cost
    this.costByProvider.set(
      providerId,
      (this.costByProvider.get(providerId) || 0) + decision.estimatedCost
    );

    // Cleanup old data (keep last 1000 decisions)
    if (this.decisions.length > 1000) {
      this.decisions = this.decisions.slice(-500);
    }
  }

  recordFeedback(decision: RoutingDecision, feedback: RoutingFeedback): void {
    const providerId = decision.provider.id;
    const successArray = this.successByProvider.get(providerId);
    if (successArray) {
      successArray.push(feedback.success ? 1 : 0);
      // Keep only recent data
      if (successArray.length > 100) {
        successArray.splice(0, successArray.length - 50);
      }
    }
  }

  getStats(): RouterMetricsStats {
    const totalDecisions = this.decisions.length;
    const uptimeMs = Date.now() - this.startTime.getTime();

    return {
      totalDecisions,
      decisionsPerHour: totalDecisions / (uptimeMs / (1000 * 60 * 60)),
      averageRoutingTime: this.calculateAverageRoutingTime(),
      requestsByCategory: Object.fromEntries(this.requestsByCategory),
      providerPerformance: this.calculateProviderPerformance(),
      costBreakdown: Object.fromEntries(this.costByProvider),
      confidenceDistribution: this.calculateConfidenceDistribution(),
      uptime: uptimeMs / (1000 * 60 * 60 * 24), // days
    };
  }

  private calculateAverageRoutingTime(): number {
    if (this.decisions.length === 0) return 0;
    const total = this.decisions.reduce((sum, d) => sum + d.metadata.routingTime, 0);
    return total / this.decisions.length;
  }

  private calculateProviderPerformance(): Record<string, ProviderPerformanceStats> {
    const performance: Record<string, ProviderPerformanceStats> = {};

    for (const [providerId, latencies] of this.latencyByProvider.entries()) {
      const successes = this.successByProvider.get(providerId) || [];
      const totalCost = this.costByProvider.get(providerId) || 0;

      performance[providerId] = {
        averageLatency: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
        successRate:
          successes.length > 0 ? successes.reduce((sum, s) => sum + s, 0) / successes.length : 0,
        totalRequests: latencies.length,
        totalCost,
        p95Latency: this.calculatePercentile(latencies, 0.95),
        p99Latency: this.calculatePercentile(latencies, 0.99),
      };
    }

    return performance;
  }

  private calculateConfidenceDistribution(): Record<string, number> {
    const buckets = { low: 0, medium: 0, high: 0 };

    for (const decision of this.decisions) {
      if (decision.confidence < 0.4) buckets.low++;
      else if (decision.confidence < 0.7) buckets.medium++;
      else buckets.high++;
    }

    return buckets;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }
}

class CostTracker {
  private dailySpend: number = 0;
  private monthlySpend: number = 0;
  private lastResetDay: Date = new Date();
  private lastResetMonth: Date = new Date();
  private costByProvider: Map<string, number> = new Map();
  private estimatedVsActual: Array<{ estimated: number; actual: number }> = [];
  private savingsFromOptimization: number = 0;

  constructor(private config: { budgetLimits: { daily: number; monthly: number } }) {
    this.resetIfNeeded();
  }

  recordEstimatedCost(decision: RoutingDecision): void {
    const cost = decision.estimatedCost;
    this.dailySpend += cost;
    this.monthlySpend += cost;

    const providerId = decision.provider.id;
    this.costByProvider.set(providerId, (this.costByProvider.get(providerId) || 0) + cost);

    // Track potential savings if we chose a more expensive option
    this.calculateOptimizationSavings(decision);

    this.resetIfNeeded();
  }

  recordActualCost(decision: RoutingDecision, actualCost?: number): void {
    if (actualCost !== undefined) {
      const estimated = decision.estimatedCost;
      this.estimatedVsActual.push({ estimated, actual: actualCost });

      // Keep only recent data
      if (this.estimatedVsActual.length > 1000) {
        this.estimatedVsActual = this.estimatedVsActual.slice(-500);
      }

      // Adjust spending tracking with actual cost
      const difference = actualCost - estimated;
      this.dailySpend += difference;
      this.monthlySpend += difference;

      const providerId = decision.provider.id;
      this.costByProvider.set(providerId, (this.costByProvider.get(providerId) || 0) + difference);
    }
  }

  getRemainingBudget(): {
    hasRemaining: boolean;
    daily: number;
    monthly: number;
    dailyPercent: number;
    monthlyPercent: number;
  } {
    this.resetIfNeeded();

    const dailyRemaining = Math.max(0, this.config.budgetLimits.daily - this.dailySpend);
    const monthlyRemaining = Math.max(0, this.config.budgetLimits.monthly - this.monthlySpend);

    return {
      hasRemaining: dailyRemaining > 0 && monthlyRemaining > 0,
      daily: dailyRemaining,
      monthly: monthlyRemaining,
      dailyPercent: (this.dailySpend / this.config.budgetLimits.daily) * 100,
      monthlyPercent: (this.monthlySpend / this.config.budgetLimits.monthly) * 100,
    };
  }

  getStats(): CostTrackerStats {
    const budget = this.getRemainingBudget();

    return {
      currentSpending: {
        daily: this.dailySpend,
        monthly: this.monthlySpend,
      },
      budgetUtilization: {
        daily: budget.dailyPercent,
        monthly: budget.monthlyPercent,
      },
      costByProvider: Object.fromEntries(this.costByProvider),
      estimationAccuracy: this.calculateEstimationAccuracy(),
      totalSavingsFromOptimization: this.savingsFromOptimization,
      averageCostPerRequest: this.calculateAverageCostPerRequest(),
      costTrends: this.calculateCostTrends(),
    };
  }

  getEstimatedSavings(): number {
    return this.savingsFromOptimization;
  }

  private resetIfNeeded(): void {
    const now = new Date();

    // Reset daily if new day
    if (
      now.getDate() !== this.lastResetDay.getDate() ||
      now.getMonth() !== this.lastResetDay.getMonth() ||
      now.getFullYear() !== this.lastResetDay.getFullYear()
    ) {
      this.dailySpend = 0;
      this.lastResetDay = now;
    }

    // Reset monthly if new month
    if (
      now.getMonth() !== this.lastResetMonth.getMonth() ||
      now.getFullYear() !== this.lastResetMonth.getFullYear()
    ) {
      this.monthlySpend = 0;
      this.lastResetMonth = now;
    }
  }

  private calculateOptimizationSavings(decision: RoutingDecision): void {
    // Estimate savings by assuming we could have chosen a more expensive provider
    // This is a simplified calculation - in practice, you'd track alternative costs
    const averageMarketCost = decision.estimatedCost * 2; // Assume 2x cost for premium providers
    this.savingsFromOptimization += Math.max(0, averageMarketCost - decision.estimatedCost);
  }

  private calculateEstimationAccuracy(): number {
    if (this.estimatedVsActual.length === 0) return 0;

    const accuracies = this.estimatedVsActual.map(({ estimated, actual }) => {
      if (actual === 0) return estimated === 0 ? 1 : 0;
      return 1 - Math.abs(estimated - actual) / actual;
    });

    return accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
  }

  private calculateAverageCostPerRequest(): number {
    const totalCost = Array.from(this.costByProvider.values()).reduce((sum, cost) => sum + cost, 0);
    const totalRequests =
      this.costByProvider.size > 0 ? Array.from(this.costByProvider.values()).length : 1;
    return totalCost / totalRequests;
  }

  private calculateCostTrends(): { increasing: boolean; weeklyGrowth: number } {
    // Simplified trend calculation
    return {
      increasing: this.monthlySpend > this.config.budgetLimits.monthly * 0.25,
      weeklyGrowth: (this.dailySpend * 7) / (this.monthlySpend || 1),
    };
  }
}

class AdaptiveLearning {
  private providerPerformance: Map<string, ProviderLearningData> = new Map();
  private taskTypeAdjustments: Map<string, Map<string, number>> = new Map();
  private feedbackHistory: RoutingFeedback[] = [];
  private learningRate: number = 0.1;

  constructor(
    private config: {
      learningEnabled: boolean;
      adaptiveRouting: boolean;
      qualityFeedbackWeight: number;
      costFeedbackWeight: number;
    }
  ) {
    this.learningRate = config.qualityFeedbackWeight || 0.1;
  }

  async processFeedback(decision: RoutingDecision, feedback: RoutingFeedback): Promise<void> {
    if (!this.config.learningEnabled) return;

    this.feedbackHistory.push(feedback);

    // Keep only recent feedback
    if (this.feedbackHistory.length > 1000) {
      this.feedbackHistory = this.feedbackHistory.slice(-500);
    }

    const providerId = decision.provider.id;
    const modelId = decision.model.id;
    const taskCategory = decision.metadata.taskComplexityScore > 0.7 ? 'complex' : 'simple';

    // Update provider performance data
    this.updateProviderPerformance(providerId, modelId, feedback);

    // Update task-specific adjustments
    this.updateTaskAdjustments(providerId, taskCategory, feedback);

    // Learn from cost accuracy
    if (feedback.actualCost !== undefined) {
      this.updateCostPrediction(decision, feedback.actualCost);
    }
  }

  async getProviderAdjustment(
    providerId: string,
    modelId: string,
    taskType: TaskType
  ): Promise<number> {
    if (!this.config.adaptiveRouting) return 1.0;

    const performance = this.providerPerformance.get(providerId);
    if (!performance) return 1.0;

    const taskCategory =
      taskType.complexity === 'expert' || taskType.complexity === 'complex' ? 'complex' : 'simple';
    const taskAdjustments = this.taskTypeAdjustments.get(providerId);
    const taskAdjustment = taskAdjustments?.get(taskCategory) || 1.0;

    // Combine overall performance with task-specific performance
    const overallAdjustment = this.calculateOverallAdjustment(performance);

    return overallAdjustment * 0.7 + taskAdjustment * 0.3;
  }

  getLearningStats(): AdaptiveLearningStats {
    return {
      totalFeedback: this.feedbackHistory.length,
      averageSatisfaction: this.calculateAverageSatisfaction(),
      providerAdjustments: this.getProviderAdjustmentSummary(),
      learningTrends: this.calculateLearningTrends(),
      confidenceInPredictions: this.calculatePredictionConfidence(),
    };
  }

  private updateProviderPerformance(
    providerId: string,
    modelId: string,
    feedback: RoutingFeedback
  ): void {
    if (!this.providerPerformance.has(providerId)) {
      this.providerPerformance.set(providerId, {
        satisfactionHistory: [],
        qualityHistory: [],
        costAccuracy: [],
        latencyAccuracy: [],
        totalFeedback: 0,
      });
    }

    const performance = this.providerPerformance.get(providerId)!;

    performance.satisfactionHistory.push(feedback.satisfaction);
    performance.totalFeedback++;

    if (feedback.qualityRating !== undefined) {
      performance.qualityHistory.push(feedback.qualityRating);
    }

    // Keep history manageable
    if (performance.satisfactionHistory.length > 100) {
      performance.satisfactionHistory = performance.satisfactionHistory.slice(-50);
    }
    if (performance.qualityHistory.length > 100) {
      performance.qualityHistory = performance.qualityHistory.slice(-50);
    }
  }

  private updateTaskAdjustments(
    providerId: string,
    taskCategory: string,
    feedback: RoutingFeedback
  ): void {
    if (!this.taskTypeAdjustments.has(providerId)) {
      this.taskTypeAdjustments.set(providerId, new Map());
    }

    const adjustments = this.taskTypeAdjustments.get(providerId)!;
    const currentAdjustment = adjustments.get(taskCategory) || 1.0;

    // Adjust based on satisfaction
    const satisfactionDelta = (feedback.satisfaction - 0.5) * this.learningRate;
    const newAdjustment = Math.max(0.1, Math.min(2.0, currentAdjustment + satisfactionDelta));

    adjustments.set(taskCategory, newAdjustment);
  }

  private updateCostPrediction(decision: RoutingDecision, actualCost: number): void {
    const providerId = decision.provider.id;
    const performance = this.providerPerformance.get(providerId);

    if (performance) {
      const accuracy =
        1 - Math.abs(decision.estimatedCost - actualCost) / Math.max(actualCost, 0.01);
      performance.costAccuracy.push(Math.max(0, Math.min(1, accuracy)));

      if (performance.costAccuracy.length > 50) {
        performance.costAccuracy = performance.costAccuracy.slice(-25);
      }
    }
  }

  private calculateOverallAdjustment(performance: ProviderLearningData): number {
    const avgSatisfaction =
      performance.satisfactionHistory.reduce((sum, s) => sum + s, 0) /
      performance.satisfactionHistory.length;
    const avgQuality =
      performance.qualityHistory.length > 0
        ? performance.qualityHistory.reduce((sum, q) => sum + q, 0) /
          performance.qualityHistory.length
        : 0.5;

    // Combine satisfaction and quality with weights
    const combinedScore = avgSatisfaction * 0.6 + avgQuality * 0.4;

    // Convert to adjustment factor (0.5 satisfaction = 1.0 adjustment)
    return 0.5 + combinedScore;
  }

  private calculateAverageSatisfaction(): number {
    if (this.feedbackHistory.length === 0) return 0;
    return (
      this.feedbackHistory.reduce((sum, f) => sum + f.satisfaction, 0) / this.feedbackHistory.length
    );
  }

  private getProviderAdjustmentSummary(): Record<string, number> {
    const summary: Record<string, number> = {};

    for (const [providerId, performance] of this.providerPerformance.entries()) {
      summary[providerId] = this.calculateOverallAdjustment(performance);
    }

    return summary;
  }

  private calculateLearningTrends(): { improving: boolean; stabilizing: boolean } {
    if (this.feedbackHistory.length < 10) {
      return { improving: false, stabilizing: false };
    }

    const recent = this.feedbackHistory.slice(-10).map(f => f.satisfaction);
    const older = this.feedbackHistory.slice(-20, -10).map(f => f.satisfaction);

    const recentAvg = recent.reduce((sum, s) => sum + s, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s, 0) / older.length;

    const improving = recentAvg > olderAvg;
    const variance = recent.reduce((sum, s) => sum + Math.pow(s - recentAvg, 2), 0) / recent.length;
    const stabilizing = variance < 0.1; // Low variance indicates stability

    return { improving, stabilizing };
  }

  private calculatePredictionConfidence(): number {
    const allPerformance = Array.from(this.providerPerformance.values());
    if (allPerformance.length === 0) return 0;

    const avgAccuracies = allPerformance.map(p => {
      if (p.costAccuracy.length === 0) return 0.5;
      return p.costAccuracy.reduce((sum, acc) => sum + acc, 0) / p.costAccuracy.length;
    });

    return avgAccuracies.reduce((sum, acc) => sum + acc, 0) / avgAccuracies.length;
  }
}

class CircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: Date | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private successCount: number = 0;

  constructor(
    private providerId: string,
    private config: {
      circuitBreakerThreshold: number;
      timeoutMs: number;
      retryAttempts: number;
    }
  ) {}

  canExecute(): boolean {
    const now = new Date();

    switch (this.state) {
      case 'closed':
        return true;

      case 'open':
        // Check if enough time has passed to try again
        if (
          this.lastFailureTime &&
          now.getTime() - this.lastFailureTime.getTime() > this.config.timeoutMs
        ) {
          this.state = 'half-open';
          this.successCount = 0;
          return true;
        }
        return false;

      case 'half-open':
        return true;

      default:
        return false;
    }
  }

  recordSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'half-open') {
      this.successCount++;
      // After a few successes, close the circuit
      if (this.successCount >= 3) {
        this.state = 'closed';
      }
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.config.circuitBreakerThreshold) {
      this.state = 'open';
    }
  }

  getState(): CircuitBreakerState {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      providerId: this.providerId,
    };
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
}

class HealthMonitor {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private logger: ILogger;

  constructor(private router: IntelligentModelRouter) {
    this.logger = createLogger('HealthMonitor');
  }

  start(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Check health every 30 seconds
    this.monitoringInterval = setInterval(() => {
      try {
        this.performHealthChecks();
      } catch (error) {
        console.error('Health monitoring error:', error);
      }
    }, 30000);

    // Prevent the interval from keeping the process alive
    if (this.monitoringInterval.unref) {
      this.monitoringInterval.unref();
    }

    // Perform initial health check
    this.performHealthChecks();
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  destroy(): void {
    this.stop();
  }

  private async performHealthChecks(): Promise<void> {
    this.logger.debug('Performing health checks on all providers');

    const providers = Array.from((this.router as any).providers.values());

    for (const provider of providers) {
      try {
        const healthStatus = await this.checkProviderHealth(provider as ModelProvider);
        (provider as ModelProvider).healthStatus = healthStatus;

        // Update circuit breaker based on health
        const circuitBreaker = (this.router as any).circuitBreakers.get(
          (provider as ModelProvider).id
        );
        if (circuitBreaker) {
          if (healthStatus.status === 'healthy') {
            circuitBreaker.recordSuccess();
          } else if (healthStatus.status === 'unavailable') {
            circuitBreaker.recordFailure();
          }
        }
      } catch (error) {
        this.logger.error(
          `Health check failed for provider ${(provider as ModelProvider).name}:`,
          error
        );
        (provider as ModelProvider).healthStatus = {
          status: 'unavailable',
          lastChecked: new Date(),
          responseTime: 0,
          errorRate: 1.0,
          availableModels: [],
        };
      }
    }
  }

  private async checkProviderHealth(provider: ModelProvider): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      // Simulate health check based on provider type
      let responseTime = 0;
      let availableModels: string[] = [];

      switch (provider.type) {
        case 'lm-studio':
          responseTime = await this.checkLMStudioHealth(provider.endpoint);
          availableModels = provider.models.map(m => m.id);
          break;

        case 'ollama':
          responseTime = await this.checkOllamaHealth(provider.endpoint);
          availableModels = await this.getOllamaModels(provider.endpoint);
          break;

        case 'local':
          responseTime = 50; // Local providers are always fast
          availableModels = provider.models.map(m => m.id);
          break;

        default:
          responseTime = await this.checkGenericHealth(provider.endpoint);
          availableModels = provider.models.map(m => m.id);
      }

      const totalTime = Date.now() - startTime;

      // Determine status based on response time and availability
      let status: 'healthy' | 'degraded' | 'unavailable';
      if (responseTime === 0) {
        status = 'unavailable';
      } else if (responseTime > 5000) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      return {
        status,
        lastChecked: new Date(),
        responseTime: totalTime,
        errorRate: 0,
        availableModels,
      };
    } catch (error) {
      return {
        status: 'unavailable',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errorRate: 1.0,
        availableModels: [],
      };
    }
  }

  private async checkLMStudioHealth(endpoint: string): Promise<number> {
    // Simulate LM Studio health check
    // In real implementation, would make HTTP request to /v1/models or similar
    return new Promise(resolve => {
      setTimeout(() => resolve(Math.random() * 1000 + 200), 100);
    });
  }

  private async checkOllamaHealth(endpoint: string): Promise<number> {
    // Simulate Ollama health check
    // In real implementation, would make HTTP request to /api/tags
    return new Promise(resolve => {
      setTimeout(() => resolve(Math.random() * 2000 + 500), 200);
    });
  }

  private async getOllamaModels(endpoint: string): Promise<string[]> {
    // Simulate getting available models from Ollama
    // In real implementation, would parse response from /api/tags
    return ['llama3.3:latest', 'codellama:34b', 'qwen2.5-coder:32b'];
  }

  private async checkGenericHealth(endpoint: string): Promise<number> {
    // Generic health check for other providers
    return new Promise(resolve => {
      setTimeout(() => resolve(Math.random() * 3000 + 1000), 300);
    });
  }
}

// Additional interfaces for the supporting classes
interface RouterMetricsStats {
  totalDecisions: number;
  decisionsPerHour: number;
  averageRoutingTime: number;
  requestsByCategory: Record<string, number>;
  providerPerformance: Record<string, ProviderPerformanceStats>;
  costBreakdown: Record<string, number>;
  confidenceDistribution: Record<string, number>;
  uptime: number;
}

interface ProviderPerformanceStats {
  averageLatency: number;
  successRate: number;
  totalRequests: number;
  totalCost: number;
  p95Latency: number;
  p99Latency: number;
}

interface CostTrackerStats {
  currentSpending: { daily: number; monthly: number };
  budgetUtilization: { daily: number; monthly: number };
  costByProvider: Record<string, number>;
  estimationAccuracy: number;
  totalSavingsFromOptimization: number;
  averageCostPerRequest: number;
  costTrends: { increasing: boolean; weeklyGrowth: number };
}

interface ProviderLearningData {
  satisfactionHistory: number[];
  qualityHistory: number[];
  costAccuracy: number[];
  latencyAccuracy: number[];
  totalFeedback: number;
}

interface AdaptiveLearningStats {
  totalFeedback: number;
  averageSatisfaction: number;
  providerAdjustments: Record<string, number>;
  learningTrends: { improving: boolean; stabilizing: boolean };
  confidenceInPredictions: number;
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: Date | null;
  providerId: string;
}

interface ConstraintAnalysis {
  costSensitive: boolean;
  latencySensitive: boolean;
  privacyRequired: boolean;
  streamingRequired: boolean;
  providerRestrictions: {
    preferred: string[];
    excluded: string[];
  };
}

interface ResourceEstimate {
  estimatedTokens: number;
  memoryRequirement: number;
  computeIntensity: number;
  expectedDuration: number;
  parallelizable: boolean;
}

interface PreferenceWeights {
  quality: number;
  performance: number;
  cost: number;
}
