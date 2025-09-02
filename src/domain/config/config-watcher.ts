import { watch, FSWatcher } from 'fs';

export class ConfigWatcher {
  private watcher?: FSWatcher;

  constructor(
    private filePath: string,
    private onChange: () => Promise<void>
  ) {}

  start(): void {
    if (this.watcher) return;
    this.watcher = watch(this.filePath, async event => {
      if (event === 'change') {
        await this.onChange();
      }
    });
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = undefined;
  }
}
