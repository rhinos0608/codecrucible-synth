import { EventEmitter } from 'events';
import { createLogger } from '../../infrastructure/logging/logger-adapter.js';
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
import { IModelSelectionService } from '../../domain/services/model-selection-service.js';
import { IVoiceOrchestrationService } from '../../domain/services/voice-orchestration-service.js';
import { IProviderSelectionStrategy } from '../../providers/provider-selection-strategy.js';
import { HybridLLMRouter } from '../../providers/hybrid/hybrid-llm-router.js';
import { PerformanceMonitor } from '../../utils/performance.js';

const logger = createLogger('IntelligentRoutingCoordinator');

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

    const decision = await this.decisionEngine.makeDecision(context, routingId);
    this.cache.set(context, decision);
    this.analytics.addDecision(routingId, decision);
    this.emit('routingDecision', decision);
    return decision;
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
