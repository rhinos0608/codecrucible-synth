import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createServer, Server } from 'http';
import { HealthMonitor } from '../../../src/domain/services/mcp-discovery/health-monitor.js';
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

describe('HealthMonitor.checkHealth', () => {
  let server: Server;
  let baseUrl = '';

  beforeAll(done => {
    server = createServer((req, res) => {
      if (req.url === '/fail') {
        res.statusCode = 500;
        res.end('fail');
      } else {
        res.statusCode = 200;
        res.end('ok');
      }
    }).listen(0, () => {
      const address = server.address();
      if (typeof address === 'object' && address) {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
      done();
    });
  });

  afterAll(done => {
    server.close(done);
  });

  test('marks server active on successful ping', async () => {
    const profile = createProfile(baseUrl);
    const monitor = new HealthMonitor();
    await monitor.checkHealth(profile);
    expect(profile.status).toBe(ServerProfileStatus.ACTIVE);
    expect(profile.reliability.consecutiveFailures).toBe(0);
    expect(profile.performance.averageLatency).toBeGreaterThan(0);
  });

  test('records failure on error response', async () => {
    const profile = createProfile(`${baseUrl}/fail`);
    const monitor = new HealthMonitor();
    await monitor.checkHealth(profile);
    expect(profile.status).toBe(ServerProfileStatus.INACTIVE);
    expect(profile.reliability.errorCount).toBe(1);
    expect(profile.reliability.consecutiveFailures).toBe(1);
    expect(profile.reliability.lastFailure).toBeInstanceOf(Date);
  });
});
