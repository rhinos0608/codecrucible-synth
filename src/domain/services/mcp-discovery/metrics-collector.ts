import { MCPServerProfile } from './discovery-types.js';

/**
 * Collects metrics related to server discovery and performance.
 */
export class MetricsCollector {
  private readonly records: Array<{
    serverId: string;
    metric: string;
    value: number;
    timestamp: Date;
  }> = [];

  record(server: MCPServerProfile, metric: string, value: number): void {
    this.records.push({
      serverId: server.id,
      metric,
      value,
      timestamp: new Date(),
    });
  }

  getRecords(): ReadonlyArray<{
    serverId: string;
    metric: string;
    value: number;
    timestamp: Date;
  }> {
    return this.records;
  }
}
