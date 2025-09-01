import { SynthesisCoordinator } from '../../../src/core/application/synthesis-coordinator.js';
import { DependencyContainer } from '../../../src/core/di/dependency-container.js';
import {
  CLIENT_TOKEN,
  CACHE_COORDINATOR_TOKEN,
  SECURITY_VALIDATOR_TOKEN,
  PERFORMANCE_MONITOR_TOKEN,
  HYBRID_ROUTER_TOKEN,
  STREAMING_MANAGER_TOKEN,
} from '../../../src/core/di/service-tokens.js';

const recordMetric = jest.fn();

jest.mock('../../../src/core/observability/observability-system.ts', () => ({
  getTelemetryProvider: () => ({ recordMetric }),
}));

describe('SynthesisCoordinator telemetry', () => {
  it('records resource metrics during request processing', async () => {
    const container = new DependencyContainer();
    container.registerValue(SECURITY_VALIDATOR_TOKEN, {
      validateRequest: async () => ({ isValid: true }),
    });
    container.registerValue(CLIENT_TOKEN, {
      synthesize: async () => ({ content: 'ok', tokens_used: 10, cached: true }),
    });
    container.registerValue(CACHE_COORDINATOR_TOKEN, {
      getCacheStats: async () => ({ hitRate: 50 }),
    });
    container.registerValue(PERFORMANCE_MONITOR_TOKEN, {
      recordRequest: jest.fn(),
    });
    container.registerValue(HYBRID_ROUTER_TOKEN, {});
    container.registerValue(STREAMING_MANAGER_TOKEN, {});

    const coordinator = new SynthesisCoordinator(container);
    await coordinator.processRequest({ prompt: 'hello world' });

    expect(recordMetric).toHaveBeenCalledWith(
      'cpu_usage',
      expect.any(Number),
      { component: 'synthesis' },
      '%'
    );
    expect(recordMetric).toHaveBeenCalledWith(
      'memory_usage',
      expect.any(Number),
      { component: 'synthesis' },
      'MB'
    );
    expect(recordMetric).toHaveBeenCalledWith(
      'cache_hit_rate',
      expect.any(Number),
      { component: 'synthesis' },
      '%'
    );
    expect(recordMetric).toHaveBeenCalledWith(
      'cost_estimate',
      expect.any(Number),
      { component: 'synthesis' },
      'usd'
    );
  });
});
