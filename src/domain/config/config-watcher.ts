import { FSWatcher, watch } from 'fs';

export class ConfigWatcher {
  private watcher?: FSWatcher;

  public constructor(
    private readonly filePath: string,
    private readonly onChange: () => Promise<void>
  ) {}

  public start(): void {
    if (this.watcher) return;

    this.watcher = watch(this.filePath, eventType => {
      if (eventType === 'change') {
        this.onChange()
          .catch(error => {
            console.error('Error in ConfigWatcher onChange callback:', error);
          });
      }
    });
  }

    public stop(): void {
      this.watcher?.close();
      this.watcher = undefined;
    }
  }
