const mockOra = jest.fn(() => ({
  start: jest.fn(() => ({
    succeed: jest.fn(),
    fail: jest.fn(),
    text: jest.fn(),
  })),
}));

const mockChalk = {
  blue: jest.fn(text => text),
  gray: jest.fn(text => text),
  yellow: jest.fn(text => text),
  red: jest.fn(text => text),
  cyan: jest.fn(text => text),
  magenta: jest.fn(text => text),
  green: jest.fn(text => text),
  bold: jest.fn(text => text),
};

// Mock the actual module to control its dependencies
jest.mock('ora', () => mockOra);
jest.mock('chalk', () => mockChalk);

// Re-export the actual CodeCrucibleCLI, but with mocked dependencies
export * from '../../../../src/core/cli';
