import type { ModelProvider } from './router-coordinator.js';

/**
 * Very small load balancer using round-robin with optional provider weights.
 */
export class LoadBalancer {
  private index = 0;

  constructor(private providers: ModelProvider[]) {}

  /**
   * Returns a rotated list of providers starting after the given id.
   */
  getFallbackProviders(currentId: string, count = 2): ModelProvider[] {
    const ordered = this.providers.filter(p => p.id !== currentId);
    // simple rotation based on internal index
    const rotated = ordered.slice(this.index).concat(ordered.slice(0, this.index));
    this.index = (this.index + 1) % Math.max(1, ordered.length);
    return rotated.slice(0, count);
  }
}
