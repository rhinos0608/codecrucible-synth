/**
 * Routing Repository Domain Interface
 * Pure domain interface - NO infrastructure dependencies
 *
 * Living Spiral Council Applied:
 * - Domain-driven repository pattern
 * - Interface segregation principle
 * - No concrete implementations (those go in infrastructure layer)
 */

import { RoutingDecision } from '../entities/routing-decision.js';
import { Model } from '../entities/model.js';

/**
 * Repository for managing routing decisions and model selection
 */
export interface RoutingDecisionRepository {
  /**
   * Save a routing decision
   */
  save(decision: RoutingDecision): Promise<void>;

  /**
   * Find routing decision by request ID
   */
  findByRequestId(requestId: string): Promise<RoutingDecision | null>;

  /**
   * Find routing decisions by selected model
   */
  findBySelectedModel(modelId: string): Promise<RoutingDecision[]>;

  /**
   * Find low confidence routing decisions for review
   */
  findLowConfidenceDecisions(): Promise<RoutingDecision[]>;

  /**
   * Find routing decisions by task complexity
   */
  findByTaskComplexity(complexity: string): Promise<RoutingDecision[]>;

  /**
   * Find routing decisions by priority level
   */
  findByPriority(priority: string): Promise<RoutingDecision[]>;

  /**
   * Get routing performance metrics
   */
  getRoutingMetrics(modelId?: string): Promise<RoutingMetrics>;

  /**
   * Find decisions that should be reviewed
   */
  findDecisionsForReview(): Promise<RoutingDecision[]>;

  /**
   * Remove old routing decisions (cleanup)
   */
  removeOlderThan(date: Date): Promise<number>;
}

/**
 * Repository for managing model information and availability
 */
export interface ModelAvailabilityRepository {
  /**
   * Save or update model information
   */
  save(model: Model): Promise<void>;

  /**
   * Find model by name and provider
   */
  findByNameAndProvider(name: string, provider: string): Promise<Model | null>;

  /**
   * Find all available models
   */
  findAvailable(): Promise<Model[]>;

  /**
   * Find models by capability
   */
  findByCapability(capability: string): Promise<Model[]>;

  /**
   * Find models suitable for task complexity
   */
  findSuitableForComplexity(
    complexity: 'simple' | 'moderate' | 'complex' | 'advanced'
  ): Promise<Model[]>;

  /**
   * Update model health status
   */
  updateHealthStatus(modelId: string, isHealthy: boolean): Promise<void>;

  /**
   * Get model performance history
   */
  getPerformanceHistory(modelId: string): Promise<ModelPerformanceHistory>;

  /**
   * Find models with performance issues
   */
  findUnhealthyModels(): Promise<Model[]>;

  /**
   * Get model usage statistics
   */
  getUsageStatistics(modelId: string): Promise<ModelUsageStatistics>;
}

/**
 * Repository for routing analytics and optimization
 */
export interface RoutingAnalyticsRepository {
  /**
   * Record routing outcome for learning
   */
  recordRoutingOutcome(decision: RoutingDecision, outcome: RoutingOutcome): Promise<void>;

  /**
   * Get routing success rates by model
   */
  getSuccessRatesByModel(): Promise<Map<string, number>>;

  /**
   * Get routing performance trends
   */
  getPerformanceTrends(timeRange: TimeRange): Promise<RoutingTrends>;

  /**
   * Find routing patterns for optimization
   */
  findRoutingPatterns(): Promise<RoutingPattern[]>;

  /**
   * Get routing recommendations
   */
  getRoutingRecommendations(): Promise<RoutingRecommendation[]>;

  /**
   * Get model comparison data
   */
  getModelComparison(modelIds: string[]): Promise<ModelComparison>;
}

/**
 * Domain value objects for routing repository operations
 */

export interface RoutingMetrics {
  totalDecisions: number;
  highConfidenceDecisions: number;
  lowConfidenceDecisions: number;
  averageConfidence: number;
  modelDistribution: Map<string, number>;
  complexityDistribution: Map<string, number>;
  decisionTime: number; // average time to make routing decisions
}

export interface ModelPerformanceHistory {
  modelId: string;
  entries: Array<{
    timestamp: Date;
    latency: number;
    throughput: number;
    reliability: number;
    errorRate: number;
  }>;
  trends: {
    latencyTrend: 'improving' | 'stable' | 'degrading';
    reliabilityTrend: 'improving' | 'stable' | 'degrading';
  };
}

export interface ModelUsageStatistics {
  modelId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  taskComplexityDistribution: Map<string, number>;
  timeOfDayDistribution: Map<number, number>; // hour -> count
  errorPatterns: Array<{ error: string; count: number }>;
}

export interface RoutingOutcome {
  success: boolean;
  actualLatency?: number;
  qualityScore?: number;
  userSatisfaction?: number;
  errorMessage?: string;
  completionTime?: Date;
}

export interface TimeRange {
  from: Date;
  to: Date;
}

export interface RoutingTrends {
  timeRange: TimeRange;
  dataPoints: Array<{
    timestamp: Date;
    totalDecisions: number;
    averageConfidence: number;
    successRate: number;
    averageLatency: number;
  }>;
  trends: {
    confidenceTrend: 'improving' | 'stable' | 'degrading';
    successRateTrend: 'improving' | 'stable' | 'degrading';
    latencyTrend: 'improving' | 'stable' | 'degrading';
  };
}

export interface RoutingPattern {
  pattern: string;
  description: string;
  frequency: number;
  successRate: number;
  averageConfidence: number;
  recommendedAction?: string;
}

export interface RoutingRecommendation {
  type: 'model-switch' | 'criteria-adjustment' | 'performance-optimization';
  description: string;
  targetModel?: string;
  expectedImprovement: string;
  confidence: number;
  reasoning: string;
}

export interface ModelComparison {
  models: string[];
  metrics: {
    averageLatency: Map<string, number>;
    successRate: Map<string, number>;
    qualityScore: Map<string, number>;
    usageCount: Map<string, number>;
  };
  recommendations: Array<{
    scenario: string;
    recommendedModel: string;
    reasoning: string;
  }>;
}

/**
 * Query criteria interfaces for advanced repository operations
 */

export interface RoutingDecisionQuery {
  requestId?: string;
  modelId?: string;
  complexity?: string;
  priority?: string;
  minConfidence?: number;
  maxConfidence?: number;
  dateFrom?: Date;
  dateTo?: Date;
  needsReview?: boolean;
}

export interface ModelAvailabilityQuery {
  providerType?: string;
  capabilities?: string[];
  isHealthy?: boolean;
  isEnabled?: boolean;
  minQuality?: number;
  maxLatency?: number;
  complexityLevel?: string;
}

export interface RoutingAnalyticsQuery {
  modelIds?: string[];
  timeRange?: TimeRange;
  complexityLevels?: string[];
  priorities?: string[];
  includeFailures?: boolean;
}

/**
 * Advanced repository interface with query capabilities
 */
export interface RoutingQueryRepository {
  /**
   * Advanced query for routing decisions
   */
  queryRoutingDecisions(query: RoutingDecisionQuery): Promise<RoutingDecision[]>;

  /**
   * Advanced query for model availability
   */
  queryModels(query: ModelAvailabilityQuery): Promise<Model[]>;

  /**
   * Advanced analytics queries
   */
  queryAnalytics(query: RoutingAnalyticsQuery): Promise<RoutingAnalyticsResult>;

  /**
   * Get routing insights for optimization
   */
  getRoutingInsights(timeRange: TimeRange): Promise<RoutingInsights>;

  /**
   * Find optimal model for specific criteria
   */
  findOptimalModel(criteria: OptimalModelCriteria): Promise<OptimalModelRecommendation>;
}

export interface RoutingAnalyticsResult {
  totalDecisions: number;
  successRate: number;
  averageLatency: number;
  modelPerformance: Map<
    string,
    {
      decisions: number;
      successRate: number;
      avgLatency: number;
      avgQuality: number;
    }
  >;
  complexityAnalysis: Map<
    string,
    {
      count: number;
      preferredModels: string[];
      successRate: number;
    }
  >;
}

export interface RoutingInsights {
  summary: {
    totalDecisions: number;
    overallSuccessRate: number;
    averageDecisionTime: number;
  };
  modelPerformance: Array<{
    modelId: string;
    score: number;
    strengths: string[];
    weaknesses: string[];
  }>;
  optimizationOpportunities: Array<{
    opportunity: string;
    impact: 'high' | 'medium' | 'low';
    description: string;
    recommendedActions: string[];
  }>;
  trends: {
    improvingMetrics: string[];
    degradingMetrics: string[];
    stableMetrics: string[];
  };
}

export interface OptimalModelCriteria {
  taskComplexity: 'simple' | 'moderate' | 'complex' | 'advanced';
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiredCapabilities: string[];
  maxLatency?: number;
  minQuality?: number;
  preferSpeed?: boolean;
  preferQuality?: boolean;
  budgetConstraints?: boolean;
}

export interface OptimalModelRecommendation {
  primaryRecommendation: {
    modelId: string;
    score: number;
    reasoning: string;
    expectedLatency: number;
    expectedQuality: number;
  };
  alternatives: Array<{
    modelId: string;
    score: number;
    reasoning: string;
    tradeoffs: string[];
  }>;
  confidence: number;
}
