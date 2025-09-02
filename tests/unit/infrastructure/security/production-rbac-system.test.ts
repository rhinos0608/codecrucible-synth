import { ProductionRBACSystem } from '../../../../src/infrastructure/security/production-rbac-system.js';

describe('ProductionRBACSystem cache cleanup', () => {
  it('clears interval on shutdown', () => {
    jest.useFakeTimers();
    const rbac = new ProductionRBACSystem({} as any, {} as any);
    (rbac as any).startCacheCleanup();
    rbac.shutdown();
    expect((rbac as any).cacheCleanupInterval).toBeNull();
  });
});
