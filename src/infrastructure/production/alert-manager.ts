import { EventEmitter } from 'events';
import { createLogger } from '../../logging/logger-adapter.js';

export class AlertManager extends EventEmitter {
  private log = createLogger('AlertManager');

  notify(level: 'info' | 'warn' | 'error', message: string, meta?: any): void {
    this.log[level](message, meta);
    this.emit('alert', { level, message, meta, timestamp: Date.now() });
  }
}
