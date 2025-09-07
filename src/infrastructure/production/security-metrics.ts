export interface MetricRecord {
  name: string;
  value: number;
  timestamp: number;
}

export class SecurityMetrics {
  private readonly records: MetricRecord[] = [];

  public record(name: string, value: number): void {
    this.records.push({ name, value, timestamp: Date.now() });
  }

  public getMetrics(): MetricRecord[] {
    return [...this.records];
  }
}
