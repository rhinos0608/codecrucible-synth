import { logger } from '../../infrastructure/logging/logger.js';

export interface Disposable {
  dispose(): Promise<void>;
}

export interface Shutdownable {
  shutdown(): void;
}

export function setupCleanup(cli: Shutdownable, serviceFactory: Disposable) {
  let cleanedUp = false;
  const cleanup = async (): Promise<void> => {
    if (cleanedUp) return;
    cleanedUp = true;
    logger.info('Application shutdown initiated');
    console.log('\n🔻 Shutting down gracefully...');
    cli.shutdown();
    await serviceFactory.dispose();
  };

  process.on('SIGINT', () => {
    void cleanup();
  });
  process.on('SIGTERM', () => {
    void cleanup();
  });

  return cleanup;
}

export default setupCleanup;
