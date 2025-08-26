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

// Cleanup after each test
afterEach(() => {
  jest.clearAllTimers();
});

// Global test utilities
global.testUtils = {
  mockAsync: (value: any) => Promise.resolve(value),
  mockAsyncError: (error: any) => Promise.reject(error),
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};

// Prevent memory leaks from event emitters
if (typeof global.gc === 'function') {
  afterAll(() => {
    global.gc();
  });
}

export {};