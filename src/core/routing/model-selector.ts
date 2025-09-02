import type { ModelProvider, ModelSpec, RoutingRequest } from './router-coordinator.js';

export interface SelectionResult {
  provider: ModelProvider;
  model: ModelSpec;
  reasons: string[];
}

/**
 * Basic provider selection based on simple scoring rules.
 * In a full implementation this would consider cost, latency,
 * quality metrics and hardware capabilities.
 */
export class ModelSelector {
  constructor(private providers: ModelProvider[]) {}

  select(request: RoutingRequest): SelectionResult {
    const candidates = this.providers.filter(p => this.meetsConstraints(p, request));
    if (candidates.length === 0) {
      throw new Error(
        `No providers meet the routing constraints: ${JSON.stringify(request.constraints)}`
      );
    }

    // For now choose provider by highest weight, defaulting to first.
    const sorted = candidates.sort((a, b) => (b.weight || 1) - (a.weight || 1));
    const provider = sorted[0];
    const model = provider.models[0];

    return {
      provider,
      model,
      reasons: ['basic selection'],
    };
  }

  private meetsConstraints(provider: ModelProvider, request: RoutingRequest): boolean {
    const { constraints } = request;
    if (constraints.requireLocal && provider.type !== 'local') return false;
    if (constraints.requireStreaming && !provider.capabilities?.includes('streaming')) return false;
    if (constraints.requireFunctionCalling && !provider.capabilities?.includes('function-calling'))
      return false;
    return true;
  }
}
