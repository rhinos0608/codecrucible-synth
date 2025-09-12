// Use path with .js extension per ESM import style in repo
import { BackupCoordinator } from '../../../src/infrastructure/production/backup-coordinator.js';

describe('BackupCoordinator', () => {
  it('calls performFullBackup on the provided manager', async () => {
    const performFullBackup = jest.fn().mockResolvedValue({
      id: 'backup_1',
      timestamp: new Date(),
      type: 'full',
      size: 123,
      compressed: true,
      encrypted: false,
      checksum: 'abc',
      version: '0.0.0-test',
      source: 'test',
      destination: '/tmp/test',
    });

    const initialize = jest.fn().mockResolvedValue(undefined);

    const manager = {
      initialize,
      performFullBackup,
    } as unknown as import('../../../src/infrastructure/backup/backup-manager.js').BackupManager;

    const coordinator = new BackupCoordinator({ manager });
    await coordinator.backup();

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(performFullBackup).toHaveBeenCalledTimes(1);
  });
});
