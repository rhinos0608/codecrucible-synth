/**
 * Intelligent Routing Coordinator
 * Central system that orchestrates smart routing decisions across all models and voice archetypes
 * 
 * Integrates:
 * - Model Selection Service (domain logic)
 * - Voice Orchestration Service (domain logic) 
 * - Provider Selection Strategy (core logic)
 * - Hybrid LLM Router (performance-optimized routing)
 * - Living Spiral Process coordination
 * 
 * Living Spiral Council Applied:
 * - Architect: Clean routing architecture with proper separation of concerns
 * - Performance Engineer: Optimized routing decisions based on metrics
 * - Explorer: Context-aware adaptive routing strategies
 * - Guardian: Safe fallback chains and validation
 * - Maintainer: Reliable routing with comprehensive error handling
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';

// Domain imports
import { IModelSelectionService, ModelSelection } from '../../domain/services/model-selection-service.js';
import { IVoiceOrchestrationService, VoiceSelection } from '../../domain/services/voice-orchestration-service.js';
import { ProcessingRequest } from '../../domain/entities/request.js';

// Core imports
import { IProviderSelectionStrategy, SelectionContext, SelectionResult } from '../providers/provider-selection-strategy.js';
import { HybridLLMRouter, RoutingDecision, TaskComplexityMetrics } from '../hybrid/hybrid-llm-router.js';
import { PerformanceMonitor } from '../../utils/performance.js';

export interface RoutingContext {
  request: ProcessingRequest;
  priority: 'low' | 'medium' | 'high' | 'critical';
  phase?: 'collapse' | 'council' | 'synthesis' | 'rebirth' | 'reflection';
  preferences?: RoutingPreferences;
  metrics?: TaskComplexityMetrics;
}

export interface RoutingPreferences {
  // Performance preferences
  prioritizeSpeed?: boolean;
  prioritizeQuality?: boolean;
  maxLatency?: number;
  
  // Cost preferences
  optimizeForCost?: boolean;
  maxCostPerRequest?: number;
  
  // Voice preferences
  preferredVoices?: string[];
  maxVoices?: number;
  enableMultiVoice?: boolean;
  
  // Provider preferences
  preferredProviders?: string[];
  excludeProviders?: string[];
  
  // Advanced preferences
  enableHybridRouting?: boolean;
  enableLoadBalancing?: boolean;
  learningEnabled?: boolean;
}

export interface IntelligentRoutingDecision {
  // Core decisions
  modelSelection: ModelSelection;
  voiceSelection: VoiceSelection;
  providerSelection: SelectionResult;
  hybridRouting?: RoutingDecision;
  
  // Routing metadata
  routingStrategy: 'single-model' | 'hybrid' | 'multi-voice' | 'load-balanced';
  confidence: number;
  reasoning: string;
  
  // Performance estimates
  estimatedCost: number;
  estimatedLatency: number;
  estimatedQuality: number;
  
  // Fallback information
  fallbackChain: Array<{
    type: 'model' | 'voice' | 'provider';
    option: string;
    reason: string;
  }>;
  
  // Analytics
  routingId: string;
  timestamp: number;
  context: RoutingContext;
}

export interface RoutingAnalytics {
  totalRequests: number;
  successRate: number;
  averageLatency: number;
  averageCost: number;
  routingAccuracy: number;
  
  // By strategy
  strategyPerformance: Map<string, {
    requests: number;
    successRate: number;
    avgLatency: number;
    avgCost: number;
  }>;
  
  // By phase (for Living Spiral)
  phasePerformance: Map<string, {
    requests: number;
    avgQuality: number;
    preferredStrategy: string;
  }>;
}

export interface IIntelligentRoutingCoordinator {
  routeRequest(context: RoutingContext): Promise<IntelligentRoutingDecision>;
  recordPerformance(routingId: string, performance: RoutingPerformance): void;
  getAnalytics(): RoutingAnalytics;
  optimizeRouting(): Promise<void>;
}

export interface RoutingPerformance {
  success: boolean;
  actualLatency: number;
  actualCost: number;
  qualityScore: number;
  errorType?: string;
  userSatisfaction?: number;
}

/**
 * Intelligent Routing Coordinator
 * Orchestrates all routing decisions with context-aware optimization
 */
export class IntelligentRoutingCoordinator extends EventEmitter implements IIntelligentRoutingCoordinator {
  private modelSelectionService: IModelSelectionService;
  private voiceOrchestrationService: IVoiceOrchestrationService;
  private providerSelectionStrategy: IProviderSelectionStrategy;
  private hybridRouter: HybridLLMRouter;
  private performanceMonitor: PerformanceMonitor;
  
  // Analytics and learning
  private routingHistory: Map<string, IntelligentRoutingDecision> = new Map();
  private performanceHistory: Map<string, RoutingPerformance> = new Map();
  private routingCache: Map<string, { decision: IntelligentRoutingDecision; timestamp: number }> = new Map();
  
  // Configuration
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_HISTORY_SIZE = 10000;
  private readonly LEARNING_ENABLED = true;

  constructor(
    modelSelectionService: IModelSelectionService,
    voiceOrchestrationService: IVoiceOrchestrationService,
    providerSelectionStrategy: IProviderSelectionStrategy,
    hybridRouter: HybridLLMRouter,
    performanceMonitor: PerformanceMonitor
  ) {
    super();
    this.modelSelectionService = modelSelectionService;
    this.voiceOrchestrationService = voiceOrchestrationService;
    this.providerSelectionStrategy = providerSelectionStrategy;
    this.hybridRouter = hybridRouter;
    this.performanceMonitor = performanceMonitor;
    
    this.setupEventHandlers();
  }

  /**
   * Main routing coordination method
   * Orchestrates intelligent routing across all systems
   */
  async routeRequest(context: RoutingContext): Promise<IntelligentRoutingDecision> {
    const startTime = Date.now();
    const routingId = this.generateRoutingId();
    
    try {
      logger.debug('Starting intelligent routing', { routingId, context });
      
      // Check cache first
      const cached = this.getCachedDecision(context);
      if (cached) {
        logger.debug('Using cached routing decision', { routingId });
        return this.cloneDecisionWithNewId(cached, routingId);
      }
      
      // Analyze request context and determine routing strategy
      const routingStrategy = this.determineRoutingStrategy(context);
      
      // Execute routing based on strategy
      const decision = await this.executeRoutingStrategy(routingStrategy, context, routingId);
      
      // Apply learning and optimization
      if (this.LEARNING_ENABLED) {
        this.applyLearningOptimizations(decision, context);
      }
      
      // Cache decision
      this.cacheDecision(context, decision);
      
      // Store for analytics
      this.routingHistory.set(routingId, decision);
      this.cleanupHistory();
      
      // Emit routing event
      this.emit('routingDecision', decision);
      
      const duration = Date.now() - startTime;
      logger.info('Routing decision completed', { 
        routingId, 
        strategy: decision.routingStrategy, 
        duration: `${duration}ms`
      });
      
      return decision;
      
    } catch (error) {
      logger.error('Error in intelligent routing', { routingId, error });
      return this.createFailsafeDecision(context, routingId);
    }
  }

  /**
   * Record actual performance for learning and optimization
   */
  recordPerformance(routingId: string, performance: RoutingPerformance): void {
    this.performanceHistory.set(routingId, performance);
    
    const decision = this.routingHistory.get(routingId);
    if (decision) {
      // Update analytics
      this.updateAnalytics(decision, performance);
      
      // Learn from performance
      this.learnFromPerformance(decision, performance);
      
      // Emit performance event
      this.emit('performanceRecorded', { routingId, decision, performance });
    }
    
    logger.debug('Performance recorded', { routingId, performance });
  }

  /**
   * Get comprehensive routing analytics
   */
  getAnalytics(): RoutingAnalytics {
    const allDecisions = Array.from(this.routingHistory.values());
    const allPerformance = Array.from(this.performanceHistory.values());
    
    const analytics: RoutingAnalytics = {
      totalRequests: allDecisions.length,
      successRate: this.calculateSuccessRate(allPerformance),
      averageLatency: this.calculateAverageLatency(allPerformance),
      averageCost: this.calculateAverageCost(allPerformance),
      routingAccuracy: this.calculateRoutingAccuracy(),
      strategyPerformance: this.calculateStrategyPerformance(allDecisions, allPerformance),
      phasePerformance: this.calculatePhasePerformance(allDecisions, allPerformance),
    };
    
    return analytics;
  }

  /**
   * Optimize routing based on historical performance
   */
  async optimizeRouting(): Promise<void> {
    logger.info('Starting routing optimization');
    
    const analytics = this.getAnalytics();
    
    // Optimize provider selection strategy
    await this.optimizeProviderStrategy(analytics);
    
    // Optimize hybrid routing parameters
    this.optimizeHybridRouting(analytics);
    
    // Optimize voice selection preferences
    await this.optimizeVoiceSelection(analytics);
    
    // Clean up old data
    this.performanceCleanup();
    
    this.emit('routingOptimized', analytics);
    logger.info('Routing optimization completed');
  }

  // Private implementation methods

  private determineRoutingStrategy(context: RoutingContext): string {
    const { request, preferences, phase } = context;
    
    // Phase-specific routing for Living Spiral
    if (phase) {
      switch (phase) {
        case 'collapse':
          return 'single-voice-fast'; // Explorer archetype, fast routing
        case 'council':
          return 'multi-voice-collaborative'; // Multiple voices, collaborative synthesis
        case 'synthesis':
          return 'single-voice-quality'; // Architect archetype, quality-focused
        case 'rebirth':
          return 'hybrid-implementation'; // Implementor with hybrid model routing
        case 'reflection':
          return 'single-voice-analytical'; // Guardian archetype, analytical review
      }
    }
    
    // Request complexity-based routing
    const complexity = request.calculateComplexity();
    
    if (complexity > 0.8) {
      return preferences?.enableHybridRouting ? 'hybrid-quality' : 'single-model-quality';
    } else if (complexity < 0.3) {
      return 'single-model-fast';
    } else {
      return preferences?.enableMultiVoice ? 'multi-voice-balanced' : 'hybrid-balanced';
    }
  }

  private async executeRoutingStrategy(
    strategy: string,
    context: RoutingContext,
    routingId: string
  ): Promise<IntelligentRoutingDecision> {
    const { request } = context;
    
    switch (strategy) {
      case 'single-voice-fast':
        return this.executeSingleVoiceFastStrategy(context, routingId);
      case 'single-voice-quality':
        return this.executeSingleVoiceQualityStrategy(context, routingId);
      case 'single-voice-analytical':
        return this.executeSingleVoiceAnalyticalStrategy(context, routingId);
      case 'multi-voice-collaborative':
        return this.executeMultiVoiceCollaborativeStrategy(context, routingId);
      case 'multi-voice-balanced':
        return this.executeMultiVoiceBalancedStrategy(context, routingId);
      case 'hybrid-quality':
        return this.executeHybridQualityStrategy(context, routingId);
      case 'hybrid-balanced':
        return this.executeHybridBalancedStrategy(context, routingId);
      case 'hybrid-implementation':
        return this.executeHybridImplementationStrategy(context, routingId);
      case 'single-model-fast':
        return this.executeSingleModelFastStrategy(context, routingId);
      case 'single-model-quality':
        return this.executeSingleModelQualityStrategy(context, routingId);
      default:
        logger.warn('Unknown routing strategy, using balanced fallback', { strategy });
        return this.executeHybridBalancedStrategy(context, routingId);
    }
  }

  private async executeSingleVoiceFastStrategy(
    context: RoutingContext,
    routingId: string
  ): Promise<IntelligentRoutingDecision> {
    const { request, preferences } = context;
    
    // Select fast provider
    const providerSelection = this.providerSelectionStrategy.selectProvider({
      prioritizeSpeed: true,
      complexity: 'simple',
    });
    
    // Select appropriate model (prefer fast models)
    const modelSelection = await this.modelSelectionService.selectOptimalModel(request, {
      prioritize: 'speed',
      maxLatency: 5000,
    });
    
    // Select single voice (Explorer for collapse phase)
    const voiceSelection = await this.voiceOrchestrationService.selectVoicesForRequest(request, {
      maxVoices: 1,
      preferredVoices: context.phase === 'collapse' ? ['explorer'] : undefined,
    });
    
    return this.buildRoutingDecision(
      'single-model',
      modelSelection,
      voiceSelection,
      providerSelection,
      undefined,
      context,
      routingId,
      0.8,
      'Fast single-voice routing optimized for speed'
    );
  }

  private async executeSingleVoiceQualityStrategy(
    context: RoutingContext,
    routingId: string
  ): Promise<IntelligentRoutingDecision> {
    const { request, preferences } = context;
    
    // Select quality-focused provider
    const providerSelection = this.providerSelectionStrategy.selectProvider({
      complexity: 'complex',
      prioritizeSpeed: false,
    });
    
    // Select high-quality model
    const modelSelection = await this.modelSelectionService.selectOptimalModel(request, {
      prioritize: 'quality',
      minQuality: 0.8,
    });
    
    // Select single voice (Architect for synthesis phase)
    const voiceSelection = await this.voiceOrchestrationService.selectVoicesForRequest(request, {
      maxVoices: 1,
      preferredVoices: context.phase === 'synthesis' ? ['architect'] : undefined,
    });
    
    return this.buildRoutingDecision(
      'single-model',
      modelSelection,
      voiceSelection,
      providerSelection,
      undefined,
      context,
      routingId,
      0.9,
      'Quality-focused single-voice routing'
    );
  }

  private async executeSingleVoiceAnalyticalStrategy(
    context: RoutingContext,
    routingId: string
  ): Promise<IntelligentRoutingDecision> {
    const { request, preferences } = context;
    
    // Select analytical-capable provider
    const providerSelection = this.providerSelectionStrategy.selectProvider({
      complexity: 'complex',
      taskType: 'analysis',
    });
    
    // Select analytical model
    const modelSelection = await this.modelSelectionService.selectOptimalModel(request, {
      prioritize: 'quality',
      minQuality: 0.7,
    });
    
    // Select Guardian voice for reflection
    const voiceSelection = await this.voiceOrchestrationService.selectVoicesForRequest(request, {
      maxVoices: 1,
      preferredVoices: ['guardian'],
    });
    
    return this.buildRoutingDecision(
      'single-model',
      modelSelection,
      voiceSelection,
      providerSelection,
      undefined,
      context,
      routingId,
      0.85,
      'Analytical single-voice routing for quality assessment'
    );
  }

  private async executeMultiVoiceCollaborativeStrategy(
    context: RoutingContext,
    routingId: string
  ): Promise<IntelligentRoutingDecision> {
    const { request, preferences } = context;
    
    // Select balanced provider for multi-voice coordination
    const providerSelection = this.providerSelectionStrategy.selectProvider({
      complexity: 'medium',
      selectionStrategy: 'balanced',
    });
    
    // Select balanced model for multi-voice synthesis
    const modelSelection = await this.modelSelectionService.selectOptimalModel(request, {
      prioritize: 'reliability',
    });
    
    // Select multiple voices for collaborative synthesis
    const voiceSelection = await this.voiceOrchestrationService.selectVoicesForRequest(request, {
      maxVoices: 3,
      minVoices: 2,
      synthesisMode: 'COLLABORATIVE' as any,
      diversityWeight: 0.7,
    });
    
    return this.buildRoutingDecision(
      'multi-voice',
      modelSelection,
      voiceSelection,
      providerSelection,
      undefined,
      context,
      routingId,
      0.85,
      'Multi-voice collaborative synthesis with balanced performance'
    );
  }

  private async executeMultiVoiceBalancedStrategy(
    context: RoutingContext,
    routingId: string
  ): Promise<IntelligentRoutingDecision> {
    const { request, preferences } = context;
    
    // Select balanced provider
    const providerSelection = this.providerSelectionStrategy.selectProvider({
      complexity: 'medium',
      selectionStrategy: 'balanced',
    });
    
    // Select balanced model
    const modelSelection = await this.modelSelectionService.selectOptimalModel(request);
    
    // Select optimal voice set for balanced approach
    const voiceSelection = await this.voiceOrchestrationService.selectVoicesForRequest(request, {
      maxVoices: preferences?.maxVoices || 2,
      synthesisMode: 'WEIGHTED' as any,
    });
    
    return this.buildRoutingDecision(
      'multi-voice',
      modelSelection,
      voiceSelection,
      providerSelection,
      undefined,
      context,
      routingId,
      0.8,
      'Balanced multi-voice routing optimizing speed and quality'
    );
  }

  private async executeHybridQualityStrategy(
    context: RoutingContext,
    routingId: string
  ): Promise<IntelligentRoutingDecision> {
    const { request, preferences } = context;
    
    // Use hybrid router for quality-focused routing
    const hybridDecision = await this.hybridRouter.routeTask(
      request.type,
      request.prompt,
      context.metrics
    );
    
    // Select model optimized for quality
    const modelSelection = await this.modelSelectionService.selectOptimalModel(request, {
      prioritize: 'quality',
      minQuality: 0.8,
    });
    
    // Select provider based on hybrid routing
    const providerSelection = this.providerSelectionStrategy.selectProvider({
      complexity: 'complex',
      prioritizeSpeed: false,
    });
    
    // Single voice for focused quality output
    const voiceSelection = await this.voiceOrchestrationService.selectVoicesForRequest(request, {
      maxVoices: 1,
    });
    
    return this.buildRoutingDecision(
      'hybrid',
      modelSelection,
      voiceSelection,
      providerSelection,
      hybridDecision,
      context,
      routingId,
      0.9,
      'Hybrid routing optimized for maximum quality'
    );
  }

  private async executeHybridBalancedStrategy(
    context: RoutingContext,
    routingId: string
  ): Promise<IntelligentRoutingDecision> {
    const { request, preferences } = context;
    
    // Use hybrid router for balanced routing
    const hybridDecision = await this.hybridRouter.routeTask(
      request.type,
      request.prompt,
      context.metrics
    );
    
    // Select balanced model
    const modelSelection = await this.modelSelectionService.selectOptimalModel(request);
    
    // Select provider based on hybrid routing decision
    const providerType = hybridDecision.selectedLLM === 'lm-studio' ? 'lm-studio' : 'ollama';
    const providerSelection = this.providerSelectionStrategy.selectProvider({
      complexity: 'medium',
      selectionStrategy: 'balanced',
    });
    
    // Select voice based on preferences or single voice
    const voiceSelection = await this.voiceOrchestrationService.selectVoicesForRequest(request, {
      maxVoices: preferences?.enableMultiVoice ? 2 : 1,
    });
    
    return this.buildRoutingDecision(
      'hybrid',
      modelSelection,
      voiceSelection,
      providerSelection,
      hybridDecision,
      context,
      routingId,
      hybridDecision.confidence,
      `Hybrid balanced routing: ${hybridDecision.reasoning}`
    );
  }

  private async executeHybridImplementationStrategy(
    context: RoutingContext,
    routingId: string
  ): Promise<IntelligentRoutingDecision> {
    const { request, preferences } = context;
    
    // Use hybrid router with implementation focus
    const hybridDecision = await this.hybridRouter.routeTask(
      'implementation',
      request.prompt,
      { ...context.metrics, requiresDeepAnalysis: false }
    );
    
    // Select model good for implementation
    const modelSelection = await this.modelSelectionService.selectOptimalModel(request, {
      prioritize: 'speed',
      maxLatency: 15000,
    });
    
    // Provider selection based on hybrid decision
    const providerSelection = this.providerSelectionStrategy.selectProvider({
      complexity: 'medium',
      prioritizeSpeed: true,
    });
    
    // Implementor voice for rebirth phase
    const voiceSelection = await this.voiceOrchestrationService.selectVoicesForRequest(request, {
      maxVoices: 1,
      preferredVoices: ['implementor'],
    });
    
    return this.buildRoutingDecision(
      'hybrid',
      modelSelection,
      voiceSelection,
      providerSelection,
      hybridDecision,
      context,
      routingId,
      0.85,
      'Hybrid implementation routing optimized for practical solutions'
    );
  }

  private async executeSingleModelFastStrategy(
    context: RoutingContext,
    routingId: string
  ): Promise<IntelligentRoutingDecision> {
    const { request, preferences } = context;
    
    // Fast provider selection
    const providerSelection = this.providerSelectionStrategy.selectProvider({
      prioritizeSpeed: true,
      complexity: 'simple',
    });
    
    // Fast model selection
    const modelSelection = await this.modelSelectionService.selectOptimalModel(request, {
      prioritize: 'speed',
      maxLatency: 3000,
    });
    
    // Single voice for speed
    const voiceSelection = await this.voiceOrchestrationService.selectVoicesForRequest(request, {
      maxVoices: 1,
    });
    
    return this.buildRoutingDecision(
      'single-model',
      modelSelection,
      voiceSelection,
      providerSelection,
      undefined,
      context,
      routingId,
      0.7,
      'Single model fast routing for simple tasks'
    );
  }

  private async executeSingleModelQualityStrategy(
    context: RoutingContext,
    routingId: string
  ): Promise<IntelligentRoutingDecision> {
    const { request, preferences } = context;
    
    // Quality-focused provider selection
    const providerSelection = this.providerSelectionStrategy.selectProvider({
      complexity: 'complex',
      selectionStrategy: 'most-capable',
    });
    
    // Quality model selection
    const modelSelection = await this.modelSelectionService.selectOptimalModel(request, {
      prioritize: 'quality',
      minQuality: 0.8,
    });
    
    // Single voice for focused output
    const voiceSelection = await this.voiceOrchestrationService.selectVoicesForRequest(request, {
      maxVoices: 1,
    });
    
    return this.buildRoutingDecision(
      'single-model',
      modelSelection,
      voiceSelection,
      providerSelection,
      undefined,
      context,
      routingId,
      0.9,
      'Single model quality routing for complex analysis'
    );
  }

  private buildRoutingDecision(
    strategy: 'single-model' | 'hybrid' | 'multi-voice' | 'load-balanced',
    modelSelection: ModelSelection,
    voiceSelection: VoiceSelection,
    providerSelection: SelectionResult,
    hybridRouting: RoutingDecision | undefined,
    context: RoutingContext,
    routingId: string,
    confidence: number,
    reasoning: string
  ): IntelligentRoutingDecision {
    const estimatedCost = this.estimateCost(modelSelection, voiceSelection, strategy);
    const estimatedLatency = this.estimateLatency(modelSelection, providerSelection, strategy);
    const estimatedQuality = this.estimateQuality(modelSelection, voiceSelection, strategy);
    
    const fallbackChain = this.buildFallbackChain(modelSelection, voiceSelection, providerSelection);
    
    return {
      modelSelection,
      voiceSelection,
      providerSelection,
      hybridRouting,
      routingStrategy: strategy,
      confidence,
      reasoning,
      estimatedCost,
      estimatedLatency,
      estimatedQuality,
      fallbackChain,
      routingId,
      timestamp: Date.now(),
      context,
    };
  }

  private estimateCost(
    modelSelection: ModelSelection,
    voiceSelection: VoiceSelection,
    strategy: string
  ): number {
    let baseCost = modelSelection.estimatedCost || 0.01;
    
    // Multi-voice multiplier
    const voiceCount = 1 + voiceSelection.supportingVoices.length;
    baseCost *= voiceCount;
    
    // Strategy multiplier
    const strategyMultipliers = {
      'single-model': 1.0,
      'hybrid': 1.3,
      'multi-voice': 1.5,
      'load-balanced': 1.2,
    };
    
    return baseCost * (strategyMultipliers[strategy as keyof typeof strategyMultipliers] || 1.0);
  }

  private estimateLatency(
    modelSelection: ModelSelection,
    providerSelection: SelectionResult,
    strategy: string
  ): number {
    let baseLatency = modelSelection.estimatedLatency || 5000;
    
    // Strategy adjustments
    switch (strategy) {
      case 'multi-voice':
        baseLatency *= 0.8; // Parallel processing
        break;
      case 'hybrid':
        baseLatency *= 1.2; // Additional routing overhead
        break;
      case 'load-balanced':
        baseLatency *= 0.9; // Better resource utilization
        break;
    }
    
    return Math.round(baseLatency);
  }

  private estimateQuality(
    modelSelection: ModelSelection,
    voiceSelection: VoiceSelection,
    strategy: string
  ): number {
    let baseQuality = 0.7; // Base quality score
    
    // Model quality contribution
    if (modelSelection.primaryModel.parameters.qualityRating) {
      baseQuality = Math.max(baseQuality, modelSelection.primaryModel.parameters.qualityRating * 0.8);
    }
    
    // Multi-voice quality boost
    const voiceCount = 1 + voiceSelection.supportingVoices.length;
    if (voiceCount > 1) {
      baseQuality += Math.min(0.2, voiceCount * 0.05);
    }
    
    // Strategy quality adjustments
    const strategyBoosts = {
      'single-model': 0,
      'hybrid': 0.05,
      'multi-voice': 0.1,
      'load-balanced': 0.02,
    };
    
    baseQuality += strategyBoosts[strategy as keyof typeof strategyBoosts] || 0;
    
    return Math.min(1.0, baseQuality);
  }

  private buildFallbackChain(
    modelSelection: ModelSelection,
    voiceSelection: VoiceSelection,
    providerSelection: SelectionResult
  ): Array<{ type: 'model' | 'voice' | 'provider'; option: string; reason: string }> {
    const fallbackChain: Array<{ type: 'model' | 'voice' | 'provider'; option: string; reason: string }> = [];
    
    // Model fallbacks
    modelSelection.fallbackModels.forEach((model, index) => {
      fallbackChain.push({
        type: 'model',
        option: model.name.value,
        reason: `Fallback model ${index + 1}`,
      });
    });
    
    // Provider fallbacks
    providerSelection.fallbackChain.forEach((provider, index) => {
      fallbackChain.push({
        type: 'provider',
        option: provider,
        reason: `Fallback provider ${index + 1}`,
      });
    });
    
    // Voice fallbacks (supporting voices can be fallbacks for primary)
    voiceSelection.supportingVoices.forEach((voice, index) => {
      fallbackChain.push({
        type: 'voice',
        option: voice.id,
        reason: `Supporting voice as fallback`,
      });
    });
    
    return fallbackChain;
  }

  // Helper methods for caching, analytics, and learning

  private generateRoutingId(): string {
    return `route_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private getCachedDecision(context: RoutingContext): IntelligentRoutingDecision | null {
    const cacheKey = this.generateCacheKey(context);
    const cached = this.routingCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.decision;
    }
    
    if (cached) {
      this.routingCache.delete(cacheKey);
    }
    
    return null;
  }

  private cacheDecision(context: RoutingContext, decision: IntelligentRoutingDecision): void {
    const cacheKey = this.generateCacheKey(context);
    this.routingCache.set(cacheKey, { decision, timestamp: Date.now() });
  }

  private generateCacheKey(context: RoutingContext): string {
    const { request, phase, priority, preferences } = context;
    const keyParts = [
      request.type,
      request.priority.value,
      phase || 'none',
      priority,
      JSON.stringify(preferences || {}),
    ];
    
    return keyParts.join('|');
  }

  private cloneDecisionWithNewId(
    decision: IntelligentRoutingDecision,
    newRoutingId: string
  ): IntelligentRoutingDecision {
    return {
      ...decision,
      routingId: newRoutingId,
      timestamp: Date.now(),
    };
  }

  private createFailsafeDecision(
    context: RoutingContext,
    routingId: string
  ): IntelligentRoutingDecision {
    // Simple failsafe decision using defaults
    return {
      modelSelection: {
        primaryModel: { name: { value: 'fallback-model' } } as any,
        fallbackModels: [],
        selectionReason: 'Failsafe selection due to routing error',
        routingStrategy: 'SHARED' as any,
        estimatedCost: 0.02,
        estimatedLatency: 30000,
      },
      voiceSelection: {
        primaryVoice: { id: 'default', name: 'Default Voice' } as any,
        supportingVoices: [],
        synthesisMode: 'SINGLE' as any,
        reasoning: 'Failsafe voice selection',
      },
      providerSelection: {
        provider: 'ollama' as any,
        reason: 'Failsafe provider selection',
        confidence: 0.5,
        fallbackChain: ['lm-studio' as any],
      },
      routingStrategy: 'single-model',
      confidence: 0.3,
      reasoning: 'Failsafe routing due to system error',
      estimatedCost: 0.02,
      estimatedLatency: 30000,
      estimatedQuality: 0.5,
      fallbackChain: [],
      routingId,
      timestamp: Date.now(),
      context,
    };
  }

  private applyLearningOptimizations(
    decision: IntelligentRoutingDecision,
    context: RoutingContext
  ): void {
    // Apply historical performance learning to adjust confidence
    const historicalPerformance = this.getHistoricalPerformance(decision.routingStrategy, context);
    
    if (historicalPerformance.sampleSize > 10) {
      const performanceMultiplier = historicalPerformance.successRate;
      decision.confidence *= performanceMultiplier;
      decision.reasoning += ` (adjusted for historical performance: ${(performanceMultiplier * 100).toFixed(1)}% success rate)`;
    }
  }

  private getHistoricalPerformance(
    strategy: string,
    context: RoutingContext
  ): { successRate: number; avgLatency: number; sampleSize: number } {
    const relevantHistory = Array.from(this.routingHistory.values())
      .filter(decision => decision.routingStrategy === strategy)
      .filter(decision => this.performanceHistory.has(decision.routingId));
    
    if (relevantHistory.length === 0) {
      return { successRate: 0.8, avgLatency: 10000, sampleSize: 0 };
    }
    
    const performances = relevantHistory
      .map(decision => this.performanceHistory.get(decision.routingId))
      .filter(Boolean);
    
    const successCount = performances.filter(p => p!.success).length;
    const avgLatency = performances.reduce((sum, p) => sum + p!.actualLatency, 0) / performances.length;
    
    return {
      successRate: successCount / performances.length,
      avgLatency,
      sampleSize: performances.length,
    };
  }

  private updateAnalytics(decision: IntelligentRoutingDecision, performance: RoutingPerformance): void {
    // Analytics updates are handled in the getAnalytics method
    // This method could be extended for real-time metric updates
    logger.debug('Analytics updated for routing decision', {
      routingId: decision.routingId,
      strategy: decision.routingStrategy,
      success: performance.success,
    });
  }

  private learnFromPerformance(
    decision: IntelligentRoutingDecision,
    performance: RoutingPerformance
  ): void {
    // Learning algorithms could be implemented here
    // For now, we just emit an event for external learning systems
    this.emit('learningUpdate', { decision, performance });
  }

  private calculateSuccessRate(performances: RoutingPerformance[]): number {
    if (performances.length === 0) return 0;
    const successCount = performances.filter(p => p.success).length;
    return successCount / performances.length;
  }

  private calculateAverageLatency(performances: RoutingPerformance[]): number {
    if (performances.length === 0) return 0;
    return performances.reduce((sum, p) => sum + p.actualLatency, 0) / performances.length;
  }

  private calculateAverageCost(performances: RoutingPerformance[]): number {
    if (performances.length === 0) return 0;
    return performances.reduce((sum, p) => sum + p.actualCost, 0) / performances.length;
  }

  private calculateRoutingAccuracy(): number {
    // Calculate how often our routing decisions led to successful outcomes
    const decisions = Array.from(this.routingHistory.values());
    const performanceDecisions = decisions.filter(d => this.performanceHistory.has(d.routingId));
    
    if (performanceDecisions.length === 0) return 0;
    
    const accurateDecisions = performanceDecisions.filter(decision => {
      const performance = this.performanceHistory.get(decision.routingId)!;
      const latencyAccurate = Math.abs(performance.actualLatency - decision.estimatedLatency) / decision.estimatedLatency < 0.5;
      const qualityAccurate = Math.abs(performance.qualityScore - decision.estimatedQuality) < 0.3;
      
      return performance.success && latencyAccurate && qualityAccurate;
    });
    
    return accurateDecisions.length / performanceDecisions.length;
  }

  private calculateStrategyPerformance(
    decisions: IntelligentRoutingDecision[],
    performances: RoutingPerformance[]
  ): Map<string, { requests: number; successRate: number; avgLatency: number; avgCost: number }> {
    const strategyPerformance = new Map();
    
    const strategies = Array.from(new Set(decisions.map(d => d.routingStrategy)));
    
    for (const strategy of strategies) {
      const strategyDecisions = decisions.filter(d => d.routingStrategy === strategy);
      const strategyPerformances = strategyDecisions
        .map(d => this.performanceHistory.get(d.routingId))
        .filter(Boolean);
      
      if (strategyPerformances.length > 0) {
        strategyPerformance.set(strategy, {
          requests: strategyDecisions.length,
          successRate: this.calculateSuccessRate(strategyPerformances as RoutingPerformance[]),
          avgLatency: this.calculateAverageLatency(strategyPerformances as RoutingPerformance[]),
          avgCost: this.calculateAverageCost(strategyPerformances as RoutingPerformance[]),
        });
      }
    }
    
    return strategyPerformance;
  }

  private calculatePhasePerformance(
    decisions: IntelligentRoutingDecision[],
    performances: RoutingPerformance[]
  ): Map<string, { requests: number; avgQuality: number; preferredStrategy: string }> {
    const phasePerformance = new Map();
    
    const phases = Array.from(new Set(decisions.map(d => d.context.phase).filter(Boolean)));
    
    for (const phase of phases) {
      const phaseDecisions = decisions.filter(d => d.context.phase === phase);
      const phasePerformances = phaseDecisions
        .map(d => this.performanceHistory.get(d.routingId))
        .filter(Boolean);
      
      if (phasePerformances.length > 0) {
        const avgQuality = phasePerformances.reduce((sum, p) => sum + p!.qualityScore, 0) / phasePerformances.length;
        
        // Find most common successful strategy for this phase
        const successfulDecisions = phaseDecisions.filter(d => {
          const perf = this.performanceHistory.get(d.routingId);
          return perf?.success;
        });
        
        const strategyCounts = successfulDecisions.reduce((counts, d) => {
          counts[d.routingStrategy] = (counts[d.routingStrategy] || 0) + 1;
          return counts;
        }, {} as Record<string, number>);
        
        const preferredStrategy = Object.entries(strategyCounts)
          .sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown';
        
        phasePerformance.set(phase, {
          requests: phaseDecisions.length,
          avgQuality,
          preferredStrategy,
        });
      }
    }
    
    return phasePerformance;
  }

  private async optimizeProviderStrategy(analytics: RoutingAnalytics): Promise<void> {
    // Analyze provider performance and update strategy
    const bestStrategy = Array.from(analytics.strategyPerformance.entries())
      .sort(([, a], [, b]) => b.successRate - a.successRate)[0];
    
    if (bestStrategy && bestStrategy[1].successRate > 0.85) {
      logger.info('Optimizing provider strategy based on performance', { bestStrategy: bestStrategy[0] });
      // Could update provider selection strategy here
    }
  }

  private optimizeHybridRouting(analytics: RoutingAnalytics): void {
    // Optimize hybrid router parameters based on analytics
    const hybridPerformance = analytics.strategyPerformance.get('hybrid');
    
    if (hybridPerformance && hybridPerformance.successRate < 0.7) {
      logger.warn('Hybrid routing performance below threshold, consider parameter adjustment');
      // Could adjust hybrid router parameters here
    }
  }

  private async optimizeVoiceSelection(analytics: RoutingAnalytics): Promise<void> {
    // Analyze voice selection performance and optimize
    const multiVoicePerformance = analytics.strategyPerformance.get('multi-voice');
    
    if (multiVoicePerformance && multiVoicePerformance.avgLatency > 20000) {
      logger.info('Multi-voice latency high, consider optimizing voice selection');
      // Could optimize voice selection logic here
    }
  }

  private cleanupHistory(): void {
    if (this.routingHistory.size > this.MAX_HISTORY_SIZE) {
      const sortedEntries = Array.from(this.routingHistory.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      const toDelete = sortedEntries.slice(0, Math.floor(this.MAX_HISTORY_SIZE * 0.2));
      toDelete.forEach(([id]) => {
        this.routingHistory.delete(id);
        this.performanceHistory.delete(id);
      });
    }
  }

  private performanceCleanup(): void {
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    
    for (const [id, decision] of this.routingHistory.entries()) {
      if (decision.timestamp < cutoffTime) {
        this.routingHistory.delete(id);
        this.performanceHistory.delete(id);
      }
    }
    
    // Clean cache
    for (const [key, cached] of this.routingCache.entries()) {
      if (Date.now() - cached.timestamp > this.CACHE_TTL) {
        this.routingCache.delete(key);
      }
    }
  }

  private setupEventHandlers(): void {
    // Listen for provider health changes
    this.performanceMonitor.on('providerHealthChange', (event) => {
      logger.info('Provider health changed, routing may be affected', event);
    });
    
    // Listen for hybrid router events
    this.hybridRouter.on('routing-decision', (event) => {
      logger.debug('Hybrid router decision received', event);
    });
    
    // Cleanup on process exit
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  private cleanup(): void {
    this.routingHistory.clear();
    this.performanceHistory.clear();
    this.routingCache.clear();
    this.removeAllListeners();
  }

  // Public getters for system monitoring
  
  getCacheStatus(): { size: number; hitRate: number } {
    return {
      size: this.routingCache.size,
      hitRate: 0.0, // Could implement hit rate tracking
    };
  }

  getSystemStatus(): any {
    return {
      routingHistory: this.routingHistory.size,
      performanceHistory: this.performanceHistory.size,
      cacheSize: this.routingCache.size,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * Initialize the routing coordinator
   */
  async initialize(): Promise<void> {
    // Initialize performance monitoring
    this.emit('coordinator:initializing');
    
    // Warm up routing cache with common patterns
    await this.warmupCache();
    
    this.emit('coordinator:initialized');
  }

  /**
   * Integration method for SystemIntegrationCoordinator
   * Decides routing strategy based on content and context
   */
  async decideRoutingStrategy(content: string, context: any): Promise<IntelligentRoutingDecision> {
    try {
      // Convert parameters to internal format
      const routingContext: RoutingContext = {
        request: {
          id: context.requestId || 'integration-' + Date.now(),
          content,
          priority: context.priority || 'medium',
          calculateComplexity: () => this.calculateContentComplexity(content)
        } as ProcessingRequest,
        priority: context.priority || 'medium',
        phase: context.phase,
        preferences: {
          prioritizeSpeed: context.prioritizeSpeed || false,
          prioritizeQuality: context.prioritizeQuality || true,
          enableHybridRouting: context.enableHybridRouting !== false,
          enableMultiVoice: context.enableMultiVoice !== false,
          maxLatency: context.maxLatency || 30000,
          learningEnabled: true
        }
      };

      // Use existing routing logic
      return await this.route(routingContext);
      
    } catch (error) {
      logger.error('Failed to decide routing strategy:', error);
      
      // Return fallback routing decision
      return this.createFallbackRoutingDecision(content, context);
    }
  }

  /**
   * Calculate content complexity for routing decisions
   */
  private calculateContentComplexity(content: string): number {
    let complexity = 0.0;
    
    // Length-based complexity
    if (content.length > 5000) complexity += 0.3;
    else if (content.length > 1000) complexity += 0.2;
    else if (content.length > 500) complexity += 0.1;
    
    // Technical complexity indicators
    const technicalTerms = [
      'algorithm', 'architecture', 'optimization', 'performance', 
      'security', 'database', 'api', 'framework', 'integration'
    ];
    const technicalScore = technicalTerms.reduce((score, term) => {
      return score + (content.toLowerCase().includes(term) ? 0.1 : 0);
    }, 0);
    complexity += Math.min(technicalScore, 0.4);
    
    // Code-like patterns
    if (content.includes('function') || content.includes('class') || content.includes('import')) {
      complexity += 0.2;
    }
    
    // Multiple questions or requirements
    const questionCount = (content.match(/[?]/g) || []).length;
    complexity += Math.min(questionCount * 0.1, 0.2);
    
    return Math.min(complexity, 1.0);
  }

  /**
   * Create fallback routing decision when primary routing fails
   */
  private createFallbackRoutingDecision(content: string, context: any): IntelligentRoutingDecision {
    const routingId = 'fallback-' + Date.now();
    
    return {
      modelSelection: {
        selectedModel: 'default',
        confidence: 0.5,
        reasoning: 'Fallback model selection',
        alternatives: []
      },
      voiceSelection: {
        selectedVoice: 'maintainer',
        confidence: 0.5,
        reasoning: 'Fallback to stable voice',
        alternatives: []
      },
      providerSelection: {
        selectedProvider: 'ollama',
        confidence: 0.5,
        reasoning: 'Fallback provider selection',
        metrics: {},
        fallbackChain: []
      },
      routingStrategy: 'single-model',
      confidence: 0.5,
      reasoning: 'Fallback routing due to error in primary routing',
      estimatedCost: 0.01,
      estimatedLatency: 5000,
      estimatedQuality: 0.6,
      fallbackChain: [
        {
          type: 'model',
          option: 'default',
          reason: 'Primary routing failed'
        }
      ],
      routingId,
      timestamp: Date.now(),
      context: {
        request: {
          id: context.requestId || routingId,
          content,
          priority: 'medium',
          calculateComplexity: () => 0.5
        } as ProcessingRequest,
        priority: 'medium',
        phase: context.phase
      }
    };
  }

  private async warmupCache(): Promise<void> {
    // Pre-cache common routing decisions
    const commonPatterns = [
      'simple_generation',
      'complex_analysis', 
      'multi_voice_synthesis'
    ];

    for (const pattern of commonPatterns) {
      // Pre-calculate routing for common patterns
      // This would use actual pattern matching in production
    }
  }
}