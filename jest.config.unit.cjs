module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/tests/unit/**/*.test.ts',
    '**/tests/unit/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/tests/integration/',
    '/tests/smoke.test.ts'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/config/(.*)$': '<rootDir>/config/$1',
    
    // Mock heavy modules for unit tests
    '^.*domain-aware-tool-orchestrator$': '<rootDir>/tests/__mocks__/heavy-modules.ts',
    '^.*mcp-server-manager$': '<rootDir>/tests/__mocks__/heavy-modules.ts',
    '^.*cli\\.ts$': '<rootDir>/tests/__mocks__/heavy-modules.ts',
    '^.*unified-cache-system$': '<rootDir>/tests/__mocks__/heavy-modules.ts',
    '^.*security-audit-logger$': '<rootDir>/tests/__mocks__/heavy-modules.ts'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      isolatedModules: true,
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },
  maxWorkers: '50%',
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup/unit.setup.ts'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};