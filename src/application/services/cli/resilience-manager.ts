import { EventEmitter } from 'events';
import { ResilientCLIWrapper } from '../../../infrastructure/resilience/resilient-cli-wrapper.js';

export class CLIResilienceManager {
  public constructor(private readonly wrapper: ResilientCLIWrapper) {}

  public wire(emitter: EventEmitter): void {
    this.wrapper.on('critical_error', data => {
      emitter.emit('error:critical', data);
    });
    this.wrapper.on('system_overload', data => {
      emitter.emit('error:overload', data);
    });
  }

  public getWrapper(): ResilientCLIWrapper {
    return this.wrapper;
  }

  public shutdown(): void {
    this.wrapper.shutdown();
  }
}

export default CLIResilienceManager;
