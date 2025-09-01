/**
 * Model Selection Domain Service
 * Pure business logic for intelligent model selection and routing
 *
 * Living Spiral Council Applied:
 * - Domain service for model selection business rules
 * - Pure business logic without infrastructure dependencies
 * - Strategic model routing based on capabilities and performance
 */

import { Model } from '../entities/model.js';
import { ProcessingRequest } from '../entities/request.js';
import { IModelRepository } from '../repositories/model-repository.js';
import { ProviderType } from '../value-objects/voice-values.js';

/**
 * Model Selection Service Interface
 */
export interface IModelSelectionService {
  selectOptimalModel(
    request: ProcessingRequest,
    preferences?: ModelSelectionPreferences
  ): Promise<ModelSelection>;

  selectHybridModels(
    request: ProcessingRequest,
    preferences?: HybridSelectionPreferences
  ): Promise<HybridModelSelection>;

  selectLoadBalancedModels(
    requests: ProcessingRequest[],
    preferences?: LoadBalancingPreferences
  ): Promise<LoadBalancingPlan>;

  handleModelFailure(
    failedModel: Model,
    request: ProcessingRequest,
    originalSelection: ModelSelection
  ): Promise<FailoverResult>;
}

/**
 * Model Selection Service
 * Handles business logic for intelligent model selection and routing
 */
export class ModelSelectionService implements IModelSelectionService {
  constructor(private modelRepository: IModelRepository) {}

  /**
   * Select the optimal model for a given request
   * Business rule: Balance capabilities, performance, and availability
   */
  async selectOptimalModel(
    request: ProcessingRequest,
    preferences?: ModelSelectionPreferences
  ): Promise<ModelSelection> {
    const availableModels = await this.modelRepository.findAvailableModels();

    if (availableModels.length === 0) {
      throw new Error('No models available for processing');
    }

    const requiredCapabilities = request.requiresCapabilities();
    const complexity = request.calculateComplexity();
    const estimatedTime = request.estimateProcessingTime();

    // Filter models by hard constraints
    let candidateModels = this.filterModelsByConstraints(availableModels, request, preferences);

    if (candidateModels.length === 0) {
      // Fallback: relax constraints and try again
      candidateModels = availableModels.filter(model =>
        model.hasCapability(requiredCapabilities[0] || 'text-generation')
      );
    }

    // Score and rank models
    const scoredModels = candidateModels.map(model => ({
      model,
      score: this.calculateModelScore(model, request, complexity),
    }));

    // Sort by score (descending)
    scoredModels.sort((a, b) => b.score - a.score);

    // Select primary and fallback models
    const primaryModel = scoredModels[0]?.model;
    if (!primaryModel) {
      throw new Error('No suitable model found for request');
    }

    const fallbackModels = scoredModels.slice(1, 3).map(sm => sm.model);

    return {
      primaryModel,
      fallbackModels,
      selectionReason: this.generateSelectionReason(
        primaryModel,
        fallbackModels,
        request,
        scoredModels[0].score
      ),
      routingStrategy: this.determineRoutingStrategy(request, primaryModel),
      estimatedCost: this.estimateProcessingCost(primaryModel, request),
      estimatedLatency: this.estimateProcessingLatency(primaryModel, request),
    };
  }

  /**
   * Select models for hybrid processing
   * Business rule: Combine fast and high-quality models for optimal results
   */
  async selectHybridModels(
    request: ProcessingRequest,
    preferences?: HybridSelectionPreferences
  ): Promise<HybridModelSelection> {
    const availableModels = await this.modelRepository.findAvailableModels();
    const requiredCapabilities = request.requiresCapabilities();

    // Separate models by performance characteristics
    const fastModels = availableModels.filter(
      model => model.parameters.estimatedLatency < (preferences?.maxLatency || 5000)
    );

    const qualityModels = availableModels.filter(
      model => model.parameters.qualityRating >= (preferences?.minQuality || 0.7)
    );

    // Select fast model for initial processing
    const fastModelSelection = await this.selectOptimalFromCandidates(fastModels, request, {
      prioritize: 'speed',
    });

    // Select quality model for refinement/validation
    const qualityModelSelection = await this.selectOptimalFromCandidates(qualityModels, request, {
      prioritize: 'quality',
    });

    return {
      fastModel: fastModelSelection?.model || null,
      qualityModel: qualityModelSelection?.model || null,
      processingStrategy: this.determineHybridStrategy(
        fastModelSelection?.model ?? null,
        qualityModelSelection?.model ?? null,
        request
      ),
      expectedSpeedup: this.calculateExpectedSpeedup(
        fastModelSelection?.model ?? null,
        qualityModelSelection?.model ?? null
      ),
      qualityTradeoff: this.calculateQualityTradeoff(
        fastModelSelection?.model ?? null,
        qualityModelSelection?.model ?? null
      ),
    };
  }

  /**
   * Select models for load balancing
   * Business rule: Distribute load across available models
   */
  async selectLoadBalancedModels(
    requests: ProcessingRequest[],
    preferences?: LoadBalancingPreferences
  ): Promise<LoadBalancingPlan> {
    const availableModels = await this.modelRepository.findAvailableModels();

    // Group requests by complexity and type
    const requestGroups = this.groupRequestsByComplexity(requests);

    // Assign models to request groups
    const assignments: RequestModelAssignment[] = [];

    for (const group of requestGroups) {
      const suitableModels = availableModels.filter(model =>
        group.requests[0].requiresCapabilities().some(cap => model.hasCapability(cap))
      );

      // Distribute requests across suitable models
      const modelsToUse = this.selectModelsForLoadBalancing(
        suitableModels,
        group.requests.length,
        preferences
      );

      group.requests.forEach((request, index) => {
        const assignedModel = modelsToUse[index % modelsToUse.length];
        assignments.push({
          request,
          assignedModel,
          estimatedStartTime: new Date(Date.now() + index * 1000),
          estimatedDuration: request.estimateProcessingTime(),
        });
      });
    }

    return {
      assignments,
      totalEstimatedTime: this.calculateTotalProcessingTime(assignments),
      loadDistribution: this.calculateLoadDistribution(assignments),
      efficiency: this.calculateLoadBalancingEfficiency(assignments),
    };
  }

  /**
   * Handle model failure and failover
   * Business rule: Seamlessly switch to backup models on failure
   */
  async handleModelFailure(
    failedModel: Model,
    request: ProcessingRequest,
    originalSelection: ModelSelection
  ): Promise<FailoverResult> {
    // Mark model as unhealthy
    const updatedModel = failedModel.recordHealthCheckFailure();
    await this.modelRepository.save(updatedModel);

    // Try fallback models from original selection
    for (const fallbackModel of originalSelection.fallbackModels) {
      if (fallbackModel.isAvailable()) {
        return {
          newModel: fallbackModel,
          failoverReason: `Primary model ${failedModel.name.value} failed, using fallback`,
          failoverLatency: 100, // Minimal latency for switching
          success: true,
        };
      }
    }

    // If no fallbacks available, select new model
    try {
      const newSelection = await this.selectOptimalModel(request, {
        excludeModels: [failedModel.name.value],
      });

      return {
        newModel: newSelection.primaryModel,
        failoverReason: `All fallbacks failed, selected new optimal model`,
        failoverLatency: 500, // Higher latency for new selection
        success: true,
      };
    } catch (error) {
      return {
        newModel: null,
        failoverReason: `No alternative models available: ${error}`,
        failoverLatency: 0,
        success: false,
      };
    }
  }

  // Private helper methods

  private filterModelsByConstraints(
    models: Model[],
    request: ProcessingRequest,
    preferences?: ModelSelectionPreferences
  ): Model[] {
    return models.filter(model => {
      // Check required capabilities
      const requiredCapabilities = request.requiresCapabilities();
      const hasRequiredCapabilities = requiredCapabilities.every(cap => model.hasCapability(cap));

      if (!hasRequiredCapabilities) return false;

      // Check constraint preferences
      if (preferences?.maxLatency && model.parameters.estimatedLatency > preferences.maxLatency) {
        return false;
      }

      if (preferences?.minQuality && model.parameters.qualityRating < preferences.minQuality) {
        return false;
      }

      if (preferences?.excludeProviders?.includes(model.providerType)) {
        return false;
      }

      if (preferences?.excludeModels?.includes(model.name.value)) {
        return false;
      }

      return true;
    });
  }

  private calculateModelScore(
    model: Model,
    request: ProcessingRequest,
    complexity: number
  ): number {
    // Base suitability score (40%)
    const suitabilityScore = model.calculateSuitabilityScore({
      requiredCapabilities: request.requiresCapabilities(),
      maxLatency: request.constraints.maxResponseTime,
      qualityThreshold: request.constraints.requiredQuality,
    });

    // Performance score (30%)
    const performanceScore = this.calculatePerformanceScore(model, request);

    // Reliability score (20%)
    const reliabilityScore = this.calculateReliabilityScore(model);

    // Context match score (10%)
    const contextScore = this.calculateContextScore(model, request);

    return (
      suitabilityScore * 0.4 + performanceScore * 0.3 + reliabilityScore * 0.2 + contextScore * 0.1
    );
  }

  private calculatePerformanceScore(model: Model, request: ProcessingRequest): number {
    const maxAcceptableLatency = request.constraints.maxResponseTime || 30000;
    const latencyScore = Math.max(0, 1 - model.parameters.estimatedLatency / maxAcceptableLatency);

    const qualityScore = model.parameters.qualityRating;

    // Balance latency and quality based on request priority
    const priorityWeight = request.priority.numericValue / 4; // 0.25 to 1.0
    return latencyScore * (1 - priorityWeight) + qualityScore * priorityWeight;
  }

  private calculateReliabilityScore(model: Model): number {
    if (!model.isHealthy) return 0;

    // Simple reliability based on error count and health status
    const baseScore = 0.8;
    const errorPenalty = Math.min(model.errorCount * 0.1, 0.3);

    return Math.max(0, baseScore - errorPenalty);
  }

  private calculateContextScore(model: Model, request: ProcessingRequest): number {
    // Score based on how well the model matches the request context
    let score = 0.5; // Base score

    // Language-specific models get bonus for matching languages
    if (request.context.languages) {
      const hasLanguageSupport = request.context.languages.some(lang =>
        model.capabilities.some(cap => cap.includes(lang.toLowerCase()))
      );
      if (hasLanguageSupport) score += 0.3;
    }

    // Multimodal bonus for complex requests
    if (model.parameters.isMultimodal && request.context.existingCode) {
      score += 0.2;
    }

    return Math.min(1.0, score);
  }

  private async selectOptimalFromCandidates(
    candidates: Model[],
    request: ProcessingRequest,
    criteria: { prioritize: 'speed' | 'quality' }
  ): Promise<{ model: Model; score: number } | null> {
    if (candidates.length === 0) return null;

    const scoredModels = candidates.map(model => {
      let score = 0;

      if (criteria.prioritize === 'speed') {
        // Prioritize low latency
        const latencyScore = 1 - model.parameters.estimatedLatency / 10000;
        score = Math.max(0, latencyScore) * 0.7 + model.parameters.qualityRating * 0.3;
      } else {
        // Prioritize quality
        score =
          model.parameters.qualityRating * 0.7 +
          (1 - model.parameters.estimatedLatency / 30000) * 0.3;
      }

      return { model, score: Math.max(0, score) };
    });

    scoredModels.sort((a, b) => b.score - a.score);
    return scoredModels[0];
  }

  private determineRoutingStrategy(request: ProcessingRequest, model: Model): RoutingStrategy {
    const complexity = request.calculateComplexity();

    if (complexity > 0.8) {
      return RoutingStrategy.HYBRID;
    } else if (request.priority.value === 'critical') {
      return RoutingStrategy.DEDICATED;
    } else {
      return RoutingStrategy.SHARED;
    }
  }

  private generateSelectionReason(
    primaryModel: Model,
    fallbackModels: Model[],
    request: ProcessingRequest,
    score: number
  ): string {
    const reasons = [
      `Selected ${primaryModel.name.value} (${primaryModel.providerType.value}) as primary model`,
      `Score: ${score.toFixed(3)} based on capabilities, performance, and reliability`,
      `Capabilities: ${primaryModel.capabilities.slice(0, 3).join(', ')}`,
      `Estimated latency: ${primaryModel.parameters.estimatedLatency}ms`,
      `Quality rating: ${primaryModel.parameters.qualityRating}`,
    ];

    if (fallbackModels.length > 0) {
      reasons.push(`Fallback models: ${fallbackModels.map(m => m.name.value).join(', ')}`);
    }

    return reasons.join('\n');
  }

  private estimateProcessingCost(model: Model, request: ProcessingRequest): number {
    // Simple cost estimation based on model size and request complexity
    const baseCost = 0.01; // Base cost per request
    const complexityMultiplier = 1 + request.calculateComplexity();
    const modelSizeMultiplier = model.parameters.maxTokens / 4000;

    return baseCost * complexityMultiplier * modelSizeMultiplier;
  }

  private estimateProcessingLatency(model: Model, request: ProcessingRequest): number {
    const baseLatency = model.parameters.estimatedLatency;
    const complexityMultiplier = 1 + request.calculateComplexity() * 0.5;

    return Math.round(baseLatency * complexityMultiplier);
  }

  private determineHybridStrategy(
    fastModel: Model | null,
    qualityModel: Model | null,
    request: ProcessingRequest
  ): HybridProcessingStrategy {
    if (!fastModel && !qualityModel) {
      return HybridProcessingStrategy.SINGLE_MODEL;
    }

    if (!fastModel || !qualityModel) {
      return HybridProcessingStrategy.SINGLE_MODEL;
    }

    const complexity = request.calculateComplexity();

    if (complexity > 0.7) {
      return HybridProcessingStrategy.PARALLEL_VALIDATION;
    } else {
      return HybridProcessingStrategy.SEQUENTIAL_REFINEMENT;
    }
  }

  private calculateExpectedSpeedup(fastModel: Model | null, qualityModel: Model | null): number {
    if (!fastModel || !qualityModel) return 1.0;

    const fastLatency = fastModel.parameters.estimatedLatency;
    const qualityLatency = qualityModel.parameters.estimatedLatency;

    // Estimated speedup when using fast model for initial processing
    return Math.max(1.0, qualityLatency / (fastLatency + qualityLatency * 0.3));
  }

  private calculateQualityTradeoff(fastModel: Model | null, qualityModel: Model | null): number {
    if (!fastModel || !qualityModel) return 0;

    const qualityDifference =
      qualityModel.parameters.qualityRating - fastModel.parameters.qualityRating;
    return Math.max(0, Math.min(1, qualityDifference));
  }

  private groupRequestsByComplexity(requests: ProcessingRequest[]): RequestGroup[] {
    const groups: Map<string, ProcessingRequest[]> = new Map();

    requests.forEach(request => {
      const complexity = request.calculateComplexity();
      let groupKey: string;

      if (complexity < 0.3) groupKey = 'simple';
      else if (complexity < 0.7) groupKey = 'medium';
      else groupKey = 'complex';

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(request);
    });

    return Array.from(groups.entries()).map(([complexity, requests]) => ({
      complexity,
      requests,
    }));
  }

  private selectModelsForLoadBalancing(
    models: Model[],
    requestCount: number,
    preferences?: LoadBalancingPreferences
  ): Model[] {
    const maxModels = preferences?.maxConcurrentModels || Math.min(models.length, 3);
    const minModels = preferences?.minConcurrentModels || 1;

    // Select top models based on performance and availability
    const selectedCount = Math.min(maxModels, Math.max(minModels, Math.ceil(requestCount / 3)));

    return models
      .sort(
        (a, b) =>
          b.parameters.qualityRating -
          a.parameters.qualityRating +
          (a.parameters.estimatedLatency - b.parameters.estimatedLatency) / 10000
      )
      .slice(0, selectedCount);
  }

  private calculateTotalProcessingTime(assignments: RequestModelAssignment[]): number {
    if (assignments.length === 0) return 0;

    const endTimes = assignments.map(a => a.estimatedStartTime.getTime() + a.estimatedDuration);

    return Math.max(...endTimes) - Date.now();
  }

  private calculateLoadDistribution(assignments: RequestModelAssignment[]): Map<string, number> {
    const distribution = new Map<string, number>();

    assignments.forEach(assignment => {
      const modelName = assignment.assignedModel.name.value;
      distribution.set(modelName, (distribution.get(modelName) || 0) + 1);
    });

    return distribution;
  }

  private calculateLoadBalancingEfficiency(assignments: RequestModelAssignment[]): number {
    const distribution = this.calculateLoadDistribution(assignments);
    const values = Array.from(distribution.values());

    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

    // Efficiency is inversely related to variance (lower variance = better distribution)
    return Math.max(0, 1 - variance / (mean * mean));
  }
}

// Supporting interfaces and types

export interface ModelSelectionPreferences {
  maxLatency?: number;
  minQuality?: number;
  preferredProviders?: ProviderType[];
  excludeProviders?: ProviderType[];
  excludeModels?: string[];
  prioritize?: 'speed' | 'quality' | 'cost' | 'reliability';
}

export interface HybridSelectionPreferences {
  maxLatency?: number;
  minQuality?: number;
  speedQualityRatio?: number;
}

export interface LoadBalancingPreferences {
  maxConcurrentModels?: number;
  minConcurrentModels?: number;
  distributionStrategy?: 'round-robin' | 'capability-based' | 'performance-based';
}

export interface ModelSelection {
  primaryModel: Model;
  fallbackModels: Model[];
  selectionReason: string;
  routingStrategy: RoutingStrategy;
  estimatedCost: number;
  estimatedLatency: number;
  generateResponse?: (prompt: string) => Promise<string>;
}

export interface HybridModelSelection {
  fastModel: Model | null;
  qualityModel: Model | null;
  processingStrategy: HybridProcessingStrategy;
  expectedSpeedup: number;
  qualityTradeoff: number;
}

export interface LoadBalancingPlan {
  assignments: RequestModelAssignment[];
  totalEstimatedTime: number;
  loadDistribution: Map<string, number>;
  efficiency: number;
}

export interface RequestModelAssignment {
  request: ProcessingRequest;
  assignedModel: Model;
  estimatedStartTime: Date;
  estimatedDuration: number;
}

export interface FailoverResult {
  newModel: Model | null;
  failoverReason: string;
  failoverLatency: number;
  success: boolean;
}

export interface RequestGroup {
  complexity: string;
  requests: ProcessingRequest[];
}

export enum RoutingStrategy {
  SHARED = 'shared',
  DEDICATED = 'dedicated',
  HYBRID = 'hybrid',
}

export enum HybridProcessingStrategy {
  SINGLE_MODEL = 'single-model',
  SEQUENTIAL_REFINEMENT = 'sequential-refinement',
  PARALLEL_VALIDATION = 'parallel-validation',
}
