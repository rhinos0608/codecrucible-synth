export interface ToolExecutionMetrics {
  executionTime: number;
  success: boolean;
  toolName: string;
  timestamp: number;
  cacheHit?: boolean;
  retryCount?: number;
}

export class PerformanceMonitor {
  private readonly metrics: ToolExecutionMetrics[] = [];

  public record(
    toolName: string,
    startTime: number,
    success: boolean,
    cacheHit = false,
    retryCount = 0
  ): void {
    const metric: ToolExecutionMetrics = {
      toolName,
      executionTime: Date.now() - startTime,
      success,
      timestamp: Date.now(),
      cacheHit,
      retryCount,
    };
    this.metrics.push(metric);
    if (this.metrics.length > 10000) {
      this.metrics.shift();
    }
  }

  public getMetrics(): ToolExecutionMetrics[] {
    return [...this.metrics];
  }
}
