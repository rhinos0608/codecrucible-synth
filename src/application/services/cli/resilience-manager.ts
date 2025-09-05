import { EventEmitter } from 'events';
import { ResilientCLIWrapper } from '../../../infrastructure/resilience/resilient-cli-wrapper.js';

/**
 * Wire resilient wrapper events to the provided emitter.
 */
export function setupResilienceEvents(wrapper: ResilientCLIWrapper, emitter: EventEmitter): void {
  wrapper.on('critical_error', data => {
    emitter.emit('error:critical', data);
  });

  wrapper.on('system_overload', data => {
    emitter.emit('error:overload', data);
  });
}

export default setupResilienceEvents;
