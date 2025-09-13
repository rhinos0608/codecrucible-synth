import setupCleanup from '../../../src/application/cli/setup-cleanup.js';

describe('setupCleanup', () => {
  it('registers handlers and cleans up once', async () => {
    const cli = { shutdown: jest.fn() };
    const serviceFactory = { dispose: jest.fn(async () => {}) };
    const onSpy = jest.spyOn(process, 'on');

    const cleanup = setupCleanup(cli, serviceFactory);
    expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

    await cleanup();
    await cleanup();

    expect(cli.shutdown).toHaveBeenCalledTimes(1);
    expect(serviceFactory.dispose).toHaveBeenCalledTimes(1);

    onSpy.mockRestore();
  });
});
