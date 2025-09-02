import { watch, FSWatcher } from 'fs';

export class ConfigWatcher {
  private watcher?: FSWatcher;

  constructor(
    private filePath: string,
    private onChange: () => Promise<void>
  ) {}

  start(): void {
    if (this.watcher) return;
        try {
          await this.onChange();
        } catch (error) {
          console.error('Error in ConfigWatcher onChange callback:', error);
        }
      }
    });
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = undefined;
  }
}
