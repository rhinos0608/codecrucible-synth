import type { RoutingDecision, RoutingRequest } from './router-coordinator.js';

/**
 * Minimal performance tracker capturing response times and counts.
 */
export class PerformanceTracker {
  private decisions: RoutingDecision[] = [];

  recordDecision(decision: RoutingDecision, _request: RoutingRequest): void {
    this.decisions.push(decision);
    if (this.decisions.length > 1000) {
      this.decisions = this.decisions.slice(-500);
    }
  }

  getAverageLatency(): number {
    if (this.decisions.length === 0) return 0;
    const total = this.decisions.reduce((sum, d) => sum + (d.estimatedLatency || 0), 0);
    return total / this.decisions.length;
  }
}
