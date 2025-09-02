import type { ModelProvider, RoutingDecision } from './router-coordinator.js';

/**
 * Simple failover manager that cycles through fallback providers
 * when errors occur.
 */
export class FailoverManager {
  constructor(private providers: ModelProvider[]) {}

  /**
   * Return next provider from the fallback list when a request fails.
   */
  getFallback(decision: RoutingDecision): RoutingDecision {
    const [next, ...remainingFallbacks] = decision.fallbackProviders;
    if (!next) {
      throw new Error('No fallback providers available');
    }
    return {
      ...decision,
      provider: next,
      model: next.models[0],
      fallbackProviders: remainingFallbacks,
      reasoning: `${decision.reasoning} -> fallback to ${next.name}`,
    };
  }
}
