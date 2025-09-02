import { UserWarningSystem } from '../../../../src/infrastructure/monitoring/user-warning-system.js';

describe('UserWarningSystem long-running warnings', () => {
  it('clears interval on shutdown', () => {
    jest.useFakeTimers();
    const system = new UserWarningSystem({ longRunningWarningInterval: 1000 });
    system.shutdown();
    expect((system as any).longRunningInterval).toBeNull();
  });
});
