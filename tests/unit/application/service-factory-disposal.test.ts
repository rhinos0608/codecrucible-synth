import { ServiceFactory } from '../../../src/application/services/service-factory.js';
import type { ILogger } from '../../../src/domain/interfaces/logger.js';

describe('ServiceFactory disposal', () => {
  function createTestLogger(): ILogger {
    return {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
    };
  }

  it('disposes runtime context resources and resource coordinator', async () => {
    const logger = createTestLogger();
    const factory = new ServiceFactory({}, logger);
    const context = factory.getRuntimeContext();

    const handler = jest.fn();
    context.eventBus.on('test-event', handler);

    const coordinator = await factory.createResourceCoordinator();
    const disposeSpy = jest.spyOn(coordinator, 'dispose');
    const configManager = await factory.createConfigurationManager();
    const configListener = jest.fn();
    configManager.on('config-test', configListener);

    await factory.dispose();

    expect(disposeSpy).toHaveBeenCalled();
    expect(context.eventBus.listenerCount('test-event')).toBe(0);
    expect(configManager.listenerCount('config-test')).toBe(0);
  });
});
