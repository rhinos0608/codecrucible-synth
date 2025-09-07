import {
  IntelligentRoutingDecision,
  RoutingAnalytics,
  RoutingPerformance,
} from './routing-types.js';

export class RoutingAnalyticsTracker {
  private readonly routingHistory = new Map<string, IntelligentRoutingDecision>();
  private readonly performanceHistory = new Map<string, RoutingPerformance>();
  private readonly MAX_HISTORY = 10000;

  public addDecision(id: string, decision: IntelligentRoutingDecision): void {
    this.routingHistory.set(id, decision);
    this.cleanup();
  }

  public recordPerformance(id: string, performance: Readonly<RoutingPerformance>): void {
    this.performanceHistory.set(id, performance);
  }

  public getDecision(id: string): IntelligentRoutingDecision | undefined {
    return this.routingHistory.get(id);
  }

  public getAnalytics(): RoutingAnalytics {
    const decisions = Array.from(this.routingHistory.values());
    const performances = Array.from(this.performanceHistory.values());
    const successCount = performances.filter(p => p.success).length;
    const averageLatency =
      performances.reduce((s, p) => s + p.actualLatency, 0) / (performances.length || 1);
    const averageCost =
      performances.reduce((s, p) => s + p.actualCost, 0) / (performances.length || 1);

    return {
      totalRequests: decisions.length,
      successRate: performances.length ? successCount / performances.length : 0,
      averageLatency,
      averageCost,
      routingAccuracy: performances.length ? successCount / performances.length : 0,
      strategyPerformance: new Map(),
      phasePerformance: new Map(),
    };
  }

  private cleanup(): void {
    if (this.routingHistory.size <= this.MAX_HISTORY) return;
    const excess = this.routingHistory.size - this.MAX_HISTORY;
    const keys = Array.from(this.routingHistory.keys());
    for (let i = 0; i < excess; i++) {
      const key = keys[i];
      this.routingHistory.delete(key);
      this.performanceHistory.delete(key);
    }
  }
}
