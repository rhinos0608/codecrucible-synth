/**
 * Event Bus Interface for Decoupled Communication
 *
 * Domain layer contract only. No concrete implementations or Node APIs here.
 * Components communicate via events without direct references to each other.
 */
// Global event bus reference for system-wide communication.
// Must be set by infrastructure or application layer.
let globalEventBus = null;
export function getGlobalEventBus() {
  if (!globalEventBus) {
    throw new Error(
      'Global event bus not initialized. Call setGlobalEventBus(...) during bootstrap.'
    );
  }
  return globalEventBus;
}
export function setGlobalEventBus(eventBus) {
  globalEventBus = eventBus;
}
