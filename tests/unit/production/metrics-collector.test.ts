// Ensure ESM-style .js import paths
import { MetricsCollector } from '../../../src/infrastructure/production/metrics-collector.js';

describe('Production MetricsCollector', () => {
  it('collects metrics without throwing (no global observability)', async () => {
    const collector = new MetricsCollector({ exportInterval: 0, exporters: [], enabled: true, retentionDays: 1 } as any);
    await expect(collector.collect()).resolves.toBeUndefined();
  });
});

