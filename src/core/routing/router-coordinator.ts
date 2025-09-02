import { EventEmitter } from 'events';
import { createLogger } from '../logger.js';
import { ModelSelector } from './model-selector.js';
import { FailoverManager } from './failover-manager.js';
import { LoadBalancer } from './load-balancer.js';
import { PerformanceTracker } from './performance-tracker.js';

export interface ModelSpec {
  id?: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
  qualityScore?: number;
}

export interface ModelProvider {
  id: string;
  name: string;
  type: 'lm-studio' | 'ollama' | 'openai' | 'anthropic' | 'local';
  endpoint?: string;
  models: ModelSpec[];
  weight?: number;
  capabilities?: string[];
}

export interface TaskType {
  category: string;
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  estimatedTokens: number;
  qualityRequirement?: string;
}

export interface RoutingConstraints {
  maxCost: number;
  maxLatency: number;
  requireLocal?: boolean;
  requireStreaming?: boolean;
  requireFunctionCalling?: boolean;
}

export interface RoutingRequest {
  query: string;
  context?: string;
  taskType: TaskType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  constraints: RoutingConstraints;
  tools?: any[];
  requiresFunctionCalling?: boolean;
}

export interface RoutingStrategy {
  primary: 'cost-optimized' | 'performance-optimized' | 'quality-optimized' | 'balanced';
  fallback: 'escalate' | 'degrade' | 'retry' | 'fail';
  escalationTriggers: Array<{
    condition: string;
    threshold: number;
    action: string;
  }>;
}

export interface RoutingMetadata {
  taskComplexityScore: number;
  costOptimizationScore: number;
  performanceScore: number;
  confidenceFactors: string[];
  alternativesConsidered: number;
  routingTime: number;
}

export interface RoutingDecision {
  provider: ModelProvider;
  model: ModelSpec;
  confidence: number;
  estimatedCost: number;
  estimatedLatency: number;
  reasoning: string;
  fallbackProviders: ModelProvider[];
  routingStrategy: RoutingStrategy;
  metadata: RoutingMetadata;
}

export interface RouterConfig {
  providers: ModelProvider[];
}

/**
 * Coordinates routing by delegating to specialized modules.
 */
export class RouterCoordinator extends EventEmitter {
  private selector: ModelSelector;
  private failover: FailoverManager;
  private balancer: LoadBalancer;
  private performance: PerformanceTracker;
  private logger = createLogger('RouterCoordinator');

  constructor(private config: RouterConfig) {
    super();
    this.selector = new ModelSelector(config.providers);
    this.balancer = new LoadBalancer(config.providers);
    this.failover = new FailoverManager(config.providers);
    this.performance = new PerformanceTracker();
  }

  async route(request: RoutingRequest): Promise<RoutingDecision> {
    const start = Date.now();
    const selection = this.selector.select(request);
    const fallbacks = this.balancer.getFallbackProviders(selection.provider.id);

    const decision: RoutingDecision = {
      provider: selection.provider,
      model: selection.model,
      confidence: 1,
      estimatedCost: 0,
      estimatedLatency: 0,
      reasoning: selection.reasons.join(', '),
      fallbackProviders: fallbacks,
      routingStrategy: { primary: 'balanced', fallback: 'retry', escalationTriggers: [] },
      metadata: {
        taskComplexityScore: 0,
        costOptimizationScore: 0,
        performanceScore: 0,
        confidenceFactors: selection.reasons,
        alternativesConsidered: this.config.providers.length,
        routingTime: 0,
      },
    };

    decision.metadata.routingTime = Date.now() - start;
    this.performance.recordDecision(decision, request);

    this.logger.debug?.(`Routed to ${decision.provider.name}/${decision.model.name}`);
    return decision;
  }
}
