import { describe, test, expect } from '@jest/globals';
import { MetricsCollector } from '../../../src/domain/services/mcp-discovery/metrics-collector.js';
import {
  MCPServerProfile,
  ServerProfileStatus,
} from '../../../src/domain/services/mcp-discovery/discovery-types.js';

function createProfile(id: string): MCPServerProfile {
  return {
    id,
    name: 'mock',
    description: 'mock server',
    version: '1.0.0',
    capabilities: [],
    performance: {
      averageLatency: 0,
      throughput: 0,
      concurrentConnectionLimit: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      errorRate: 0,
      uptime: 0,
    },
    reliability: {
      availabilityScore: 1,
      mttr: 0,
      mtbf: 0,
      errorCount: 0,
      successRate: 1,
      consecutiveFailures: 0,
    },
    compatibility: {
      protocolVersions: [],
      requiredFeatures: [],
      optionalFeatures: [],
      platformSupport: [],
      dependencies: [],
    },
    cost: undefined,
    lastSeen: new Date(0),
    status: ServerProfileStatus.INACTIVE,
  };
}

describe('MetricsCollector.record', () => {
  test('stores metrics entries', () => {
    const collector = new MetricsCollector();
    const profile = createProfile('server-1');
    collector.record(profile, 'latency', 123);
    const records = collector.getRecords();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      serverId: 'server-1',
      metric: 'latency',
      value: 123,
    });
    expect(records[0].timestamp).toBeInstanceOf(Date);
  });
});
