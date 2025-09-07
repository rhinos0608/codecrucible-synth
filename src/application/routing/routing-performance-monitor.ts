import { PerformanceMonitor } from '../../utils/performance.js';
import { RoutingPerformance, IntelligentRoutingDecision } from './routing-types.js';

export class RoutingPerformanceMonitor {
  public constructor(private readonly monitor: Readonly<PerformanceMonitor>) {}

  public record(decision: IntelligentRoutingDecision, performance: RoutingPerformance): void {
    // TODO: Implement proper metric recording or analysis here.
    void this.monitor.getProviderMetrics();
    // Real implementation would persist or analyze metrics
  }
}
