import { PerformanceMonitor } from '../../utils/performance.js';
import { IntelligentRoutingDecision, RoutingPerformance } from './routing-types.js';

export class RoutingPerformanceMonitor {
  public constructor(private readonly monitor: Readonly<PerformanceMonitor>) {}

  public record(_decision: IntelligentRoutingDecision, _performance: RoutingPerformance): void {
    // TODO: Implement proper metric recording or analysis here.
    undefined as unknown as ReturnType<typeof this.monitor.getProviderMetrics>;
    // Real implementation would persist or analyze metrics
  }
}
