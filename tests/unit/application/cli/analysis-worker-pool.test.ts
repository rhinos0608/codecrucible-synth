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

  it('recovers from worker failure', async () => {
    const pool = new AnalysisWorkerPool(1);
    await expect(pool.runTask({ crash: true })).rejects.toThrow();
    const result = await pool.runTask({ files: ['c'], delay: 10 });
    await pool.destroy();
    expect(result.totalFiles).toBe(1);
  });
});
