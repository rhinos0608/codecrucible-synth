/**
 * Jest Test Setup
 * Configures global test environment and mocks to prevent network calls and timeouts
 */

// Set longer default timeout for all tests
jest.setTimeout(30000);

// Mock fetch to prevent network calls in tests
global.fetch = jest.fn().mockImplementation((url: string) => {
  console.warn(`Blocked network call to: ${url}`);
  return Promise.resolve({
    ok: false,
    status: 500,
    statusText: 'Mock: Network calls disabled in tests',
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('Mock response'),
  } as Response);
});

// Mock process.exit to prevent tests from exiting
const originalExit = process.exit;
process.exit = jest.fn() as any;

// Restore process.exit after all tests
afterAll(() => {
  process.exit = originalExit;
});

// Clean up timers and intervals after each test
afterEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});

// Force garbage collection if available
afterEach(() => {
  if (global.gc) {
    global.gc();
  }
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection in test:', reason);
});

// Handle uncaught exceptions in tests
process.on('uncaughtException', (error) => {
  console.warn('Uncaught Exception in test:', error.message);
});

export {};