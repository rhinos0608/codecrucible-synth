/**
 * Jest Test Setup Configuration
 * Sets up global test environment for CodeCrucible Synth
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.CI = 'true';

// Increase test timeout for slow AI operations
jest.setTimeout(30000);

// Mock console methods to reduce test noise
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

// Only show errors in test output by default
console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

// Restore console methods for debugging when needed
global.restoreConsole = () => {
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
};

// Mock process.exit to prevent tests from actually exiting
const originalExit = process.exit;
process.exit = jest.fn();

// Note: afterAll will be available in individual test files
// This setup file doesn't need it since it's imported by each test

// Set up global test utilities
global.testUtils = {
  // Helper to create mock configurations
  createMockConfig: () => ({
    model: {
      endpoint: 'http://localhost:11434',
      name: 'test-model',
      timeout: 30000,
      maxTokens: 1000,
      temperature: 0.7
    },
    voices: {
      available: ['developer', 'analyzer', 'security'],
      default: ['developer']
    },
    mcp: {
      servers: []
    }
  }),
  
  // Helper to create mock project context
  createMockProjectContext: () => ({
    files: [
      {
        path: 'test.js',
        content: 'console.log("hello world");',
        language: 'javascript'
      }
    ],
    projectType: 'node',
    dependencies: ['express', 'jest'],
    gitStatus: 'clean'
  }),
  
  // Helper to wait for async operations
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// Suppress specific warnings that are expected in test environment
const originalWarning = console.warn;
console.warn = (...args) => {
  const message = args.join(' ');
  if (
    message.includes('ExperimentalWarning') ||
    message.includes('DeprecationWarning') ||
    message.includes('punycode')
  ) {
    return; // Suppress these warnings
  }
  originalWarning.apply(console, args);
};
