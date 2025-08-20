/**
 * Test cleanup for singleton instances that create timers/intervals
 * This file contains global setup and teardown hooks
 */

import { subAgentIsolationSystem } from '../../src/core/agents/sub-agent-isolation-system.js';

// Clean up after each test to prevent timer leaks
if (typeof afterEach !== 'undefined') {
  afterEach(async () => {
    try {
      await subAgentIsolationSystem.destroyInstance();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });
}

// Final cleanup
if (typeof afterAll !== 'undefined') {
  afterAll(async () => {
    try {
      await subAgentIsolationSystem.destroyInstance();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });
}

// Prevent this file from being treated as a test
export {};