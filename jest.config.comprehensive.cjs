module.exports = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapping: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
    }],
  },
  testEnvironment: 'node',
  testMatch: [
    '**/tests/integration/**/*.test.js',
    '**/tests/integration/**/*.test.ts'
  ],
  testTimeout: 300000, // 5 minutes for comprehensive AI tests
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: 1, // Run tests sequentially for AI model stability
  setupFilesAfterEnv: ['<rootDir>/tests/setup/comprehensive-setup.js'],
  collectCoverage: false, // Disable for integration tests
  testSequencer: '<rootDir>/tests/setup/test-sequencer.js'
};