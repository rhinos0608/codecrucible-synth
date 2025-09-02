/**
 * Test cleanup for singleton instances that create timers/intervals
 * This file contains global setup and teardown hooks
 */

import { subAgentIsolationSystem } from '../../src/domain/agents/sub-agent-isolation-system.js';
import { unifiedCache } from '../../src/infrastructure/cache/unified-cache-system.js';

// Enhanced cleanup after each test to prevent timer and EventEmitter leaks
if (typeof afterEach !== 'undefined') {
  afterEach(async () => {
    try {
      // Clean up singleton instances that may have EventEmitters
      await subAgentIsolationSystem.destroyInstance();
      await unifiedCache.destroy();
      
      // Clear any remaining timers
      jest.clearAllTimers();
      jest.useRealTimers();
      
      // Ensure process cleanup (but preserve critical listeners)
      const criticalEvents = ['exit', 'SIGTERM', 'SIGINT', 'uncaughtException', 'unhandledRejection'];
      if (process && process.eventNames) {
        process.eventNames().forEach(eventName => {
          if (!criticalEvents.includes(eventName as string)) {
            process.removeAllListeners(eventName);
          }
        });
      }
    } catch (error) {
      // Ignore cleanup errors in tests but log in verbose mode
      if (process.env.JEST_VERBOSE) {
        console.warn('Cleanup warning:', error);
      }
    }
  });
}

// Final cleanup - more thorough resource cleanup
if (typeof afterAll !== 'undefined') {
  afterAll(async () => {
    try {
      await subAgentIsolationSystem.destroyInstance();
      await unifiedCache.destroy();
      
      // Final timer cleanup
      jest.clearAllTimers();
      jest.useRealTimers();
      
      // Force garbage collection if available
      if (typeof global.gc === 'function') {
        global.gc();
      }
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });
}

// Prevent this file from being treated as a test
export {};