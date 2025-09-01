/**
 * Unit test setup - lightweight initialization for fast test execution
 */

// Disable console logs during tests unless explicitly needed
if (process.env.SHOW_TEST_LOGS !== 'true') {
  global.console.log = jest.fn();
  global.console.info = jest.fn();
  global.console.warn = jest.fn();
  // Keep error for debugging
}

// Mock environment variables for consistent testing
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock timers for consistent time-based tests
beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// Cleanup after each test - Enhanced EventEmitter resource management
afterEach(() => {
  jest.clearAllTimers();
  
  // Clean up any global EventEmitters that might have been created
  if (global.process && global.process.removeAllListeners) {
    // Don't remove critical process listeners, but clean up test-specific ones
    const criticalEvents = ['exit', 'SIGTERM', 'SIGINT', 'uncaughtException', 'unhandledRejection'];
    const allEvents = global.process.eventNames();
    allEvents.forEach(eventName => {
      if (!criticalEvents.includes(eventName as string)) {
        global.process.removeAllListeners(eventName);
      }
    });
  }
});

// Global test utilities
global.testUtils = {
  mockAsync: (value: any) => Promise.resolve(value),
  mockAsyncError: (error: any) => Promise.reject(error),
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  createCleanEventEmitter: () => {
    const { EventEmitter } = require('events');
    const emitter = new EventEmitter();
    // Auto-cleanup after test
    afterEach(() => {
      emitter.removeAllListeners();
    });
    return emitter;
  }
};

// Enhanced cleanup for EventEmitter-based tests
afterAll(() => {
  // Force garbage collection if available
  if (typeof global.gc === 'function') {
    global.gc();
  }
  
  // Clean up any remaining timers
  jest.clearAllTimers();
});

export {};