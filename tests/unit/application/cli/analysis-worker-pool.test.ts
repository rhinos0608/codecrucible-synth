import { AnalysisWorkerPool } from '../../../src/application/cli/analysis-worker-pool.js';

describe('AnalysisWorkerPool', () => {
  it('processes tasks concurrently', async () => {
    const pool = new AnalysisWorkerPool(2);
    const start = Date.now();
    await Promise.all([
      pool.runTask({ files: ['a'], delay: 100 }),
      pool.runTask({ files: ['b'], delay: 100 }),
    ]);
    const duration = Date.now() - start;
    await pool.destroy();
    expect(duration).toBeLessThan(180);
  });
});
