import { EventEmitter } from 'events';

/**
 * EventCoordinator centralizes event-driven workflow coordination.
 */
export class EventCoordinator extends EventEmitter {
  public emitEvent(event: string, payload?: unknown): void {
    this.emit(event, payload);
  }

  public onEvent(event: string, handler: (payload: unknown) => void): void {
    this.on(event, handler);
  }
}
