import type { RoutingDecision, RoutingRequest } from './router-coordinator.js';

/**
 * Minimal performance tracker capturing response times and counts.
 */
export class PerformanceTracker {
  private records: { decision: RoutingDecision; actualLatency: number }[] = [];

  /**
   * Records a routing decision along with the actual response time (in ms).
   * @param decision The routing decision made.
   * @param request The routing request, which should contain the actual response time.
   */
  recordDecision(decision: RoutingDecision, request: RoutingRequest): void {
    // Try to get actual latency from the request, fallback to 0 if not available
    // (You may need to adjust the property name if it's different)
    const actualLatency = (request as any).actualLatency ?? 0;
    this.records.push({ decision, actualLatency });
    if (this.records.length > 1000) {
      this.records = this.records.slice(-500);
    }
  }

  getAverageLatency(): number {
    if (this.records.length === 0) return 0;
    const total = this.records.reduce((sum, r) => sum + (r.actualLatency || 0), 0);
    return total / this.records.length;
  }
}
