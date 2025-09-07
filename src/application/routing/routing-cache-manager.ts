import { RoutingContext, IntelligentRoutingDecision } from './routing-types.js';

export class RoutingCacheManager {
  private readonly cache = new Map<
    string,
    { decision: IntelligentRoutingDecision; timestamp: number }
  >();

  public constructor(private readonly ttl: number) {}

  public get(context: RoutingContext): IntelligentRoutingDecision | null {
    const key = this.generateKey(context);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.decision;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  public set(context: RoutingContext, decision: IntelligentRoutingDecision): void {
    const key = this.generateKey(context);
    this.cache.set(key, { decision, timestamp: Date.now() });
  }

  private generateKey(context: RoutingContext): string {
    const { request, phase, priority, preferences } = context;
    return [
      request.type,
      request.priority.value,
      phase ?? 'none',
      priority,
      JSON.stringify(preferences ?? {}),
    ].join('|');
  }
}
