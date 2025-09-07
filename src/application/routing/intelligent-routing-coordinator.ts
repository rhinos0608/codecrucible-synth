import { EventEmitter } from 'events';
import { logger } from '../../infrastructure/logging/logger.js';
import { ModelParameters } from '../../domain/entities/model.js';
import { ModelName, ProviderType } from '../../domain/value-objects/voice-values.js';
import {
  IIntelligentRoutingCoordinator,
  RoutingContext,
  IntelligentRoutingDecision,
  RoutingPerformance,
  RoutingAnalytics,
} from './routing-types.js';
import { RoutingCacheManager } from './routing-cache-manager.js';
import { RoutingAnalyticsTracker } from './routing-analytics.js';
import { RoutingDecisionEngine } from './routing-decision-engine.js';
import { ModelSelectionCoordinator } from './model-selection-coordinator.js';
import { VoiceIntegrationHandler } from './voice-integration-handler.js';
import { RoutingPerformanceMonitor } from './routing-performance-monitor.js';
import {
  IModelSelectionService,
  RoutingStrategy,
} from '../../domain/services/model-selection-service.js';
import {
  IVoiceOrchestrationService,
  SynthesisMode,
} from '../../domain/services/voice-orchestration-service.js';
import { 
  IProviderSelectionStrategy,
  ProviderType as ProviderStrategyType,
} from '../../providers/provider-selection-strategy.js';
import { HybridLLMRouter } from '../../providers/hybrid/hybrid-llm-router.js';
import { PerformanceMonitor } from '../../utils/performance.js';
import { Model } from '../../domain/entities/model.js';
import { Voice } from '../../domain/entities/voice.js';

// Logger already imported as singleton

export class IntelligentRoutingCoordinator
  extends EventEmitter
  implements IIntelligentRoutingCoordinator
{
  private readonly cache: RoutingCacheManager;
  private readonly analytics: RoutingAnalyticsTracker;
  private readonly decisionEngine: RoutingDecisionEngine;
  private readonly performance: RoutingPerformanceMonitor;
  private readonly CACHE_TTL = 300000; // 5 minutes

  public constructor(
    modelService: Readonly<IModelSelectionService>,
    voiceService: Readonly<IVoiceOrchestrationService>,
    providerStrategy: Readonly<IProviderSelectionStrategy>,
    hybridRouter: Readonly<HybridLLMRouter>,
    performanceMonitor: Readonly<PerformanceMonitor>
  ) {
    super();
    const modelCoordinator = new ModelSelectionCoordinator(modelService, providerStrategy);
    const voiceHandler = new VoiceIntegrationHandler(voiceService);
    this.decisionEngine = new RoutingDecisionEngine(modelCoordinator, voiceHandler, hybridRouter);
    this.cache = new RoutingCacheManager(this.CACHE_TTL);
    this.analytics = new RoutingAnalyticsTracker();
    this.performance = new RoutingPerformanceMonitor(performanceMonitor);
  }

  public async routeRequest(
    context: Readonly<RoutingContext>
  ): Promise<IntelligentRoutingDecision> {
    const cached = this.cache.get(context);
    const routingId = this.generateRoutingId();
    if (cached) {
      const cloned: IntelligentRoutingDecision = {
        ...cached,
        routingId,
        timestamp: Date.now(),
        context,
      };
      return Object.freeze(cloned);
    }

    try {
      const decision = await this.decisionEngine.makeDecision(context, routingId);
      this.cache.set(context, decision);
      this.analytics.addDecision(routingId, decision);
      this.emit('routingDecision', decision);
      return decision;
    } catch (error) {
      logger.error('Routing decision failed, returning failsafe decision', error);
      // Create a proper fallback Model instance
      const fallbackParams: ModelParameters = {
        maxTokens: 4096,
        contextWindow: 4096,
        isMultimodal: false,
        estimatedLatency: 1000,
        qualityRating: 0.5,
      };
      
      const fallbackModel = new Model(
        ModelName.create('fallback-model'),
        ProviderType.create('lm-studio'),
        ['text-generation'],
        fallbackParams
      );

      const failsafeDecision: IntelligentRoutingDecision = Object.freeze({
        modelSelection: {
          primaryModel: fallbackModel,
          fallbackModels: [],
          selectionReason: 'Failsafe model selection',
          routingStrategy: RoutingStrategy.SHARED,
          estimatedCost: 0,
          estimatedLatency: 0,
        },
        voiceSelection: {
          primaryVoice: {
            id: 'guardian',
            name: 'Failsafe Voice',
            expertise: [],
            languages: [],
            isActive: true,
          } as unknown as Voice,
          supportingVoices: [],
          synthesisMode: SynthesisMode.SINGLE,
          reasoning: 'Failsafe voice selection',
        },
        providerSelection: {
          provider: 'lm-studio' as ProviderStrategyType,
          reason: 'Failsafe provider',
          confidence: 0,
          fallbackChain: [],
        },
        routingStrategy: 'single-model',
        confidence: 0.3,
        reasoning: `Failsafe decision due to error: ${(error as Error).message}`,
        estimatedCost: 0,
        estimatedLatency: 0,
        estimatedQuality: 0,
        fallbackChain: [
          {
            type: 'model' as const,
            option: 'fallback-model',
            reason: 'Default failsafe model',
          },
        ],
        routingId,
        timestamp: Date.now(),
        context,
      });
      this.analytics.addDecision(routingId, failsafeDecision);
      this.emit('routingDecision', failsafeDecision);
      return failsafeDecision;
    }
  }

  public recordPerformance(routingId: string, performance: Readonly<RoutingPerformance>): void {
    const decision = this.analytics.getDecision(routingId);
    if (decision) {
      this.performance.record(decision, performance);
    }
    this.analytics.recordPerformance(routingId, performance);
    this.emit('performanceRecorded', { routingId, performance });
  }

  public getAnalytics(): RoutingAnalytics {
    return this.analytics.getAnalytics();
  }

  public async optimizeRouting(): Promise<void> {
    // Placeholder for optimization logic based on analytics
    logger.debug('optimizeRouting called');
  }

  private generateRoutingId(): string {
    return `route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export type {
  RoutingContext,
  RoutingPreferences,
  IntelligentRoutingDecision,
  RoutingPerformance,
  RoutingAnalytics,
  IIntelligentRoutingCoordinator,
} from './routing-types.js';
