module.exports = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  testMatch: [
    '**/tests/integration/**/*.test.ts',
    '**/tests/integration/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/tests/unit/',
    '/tests/smoke.test.ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ES2022',
        target: 'ES2022',
        moduleResolution: 'node',
        isolatedModules: false // Full type-checking for integration tests
      }
    }]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)(\\.js)$': '$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/config/(.*)$': '<rootDir>/config/$1'
  },
  setupFiles: ["<rootDir>/jest.setup.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup/cleanup-singletons.ts"],
  maxWorkers: 2, // Limited parallelization for integration tests
  testTimeout: 300000, // 5 minutes for integration tests
  verbose: true,
  // Enhanced resource management - Build System Agent completion 2025
  openHandlesTimeout: 30000, // 30 seconds to identify hanging resources
  workerIdleMemoryLimit: '1GB' // Prevent memory buildup in workers
};