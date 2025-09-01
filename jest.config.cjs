/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  testMatch: [
    "<rootDir>/tests/**/*.ts",
    "<rootDir>/?(*.)+(spec|test).ts"
  ],
  moduleFileExtensions: ["ts", "js", "json", "node"],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ES2022',
        target: 'ES2022',
        moduleResolution: 'node',
        isolatedModules: true
      }
    }],
  },
  modulePaths: [
    "<rootDir>"
  ],
  setupFiles: ["<rootDir>/jest.setup.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup/cleanup-singletons.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(ora|chalk|inquirer|commander)/)"
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)(\\.js)$': '$1',
    '^chalk$': '<rootDir>/tests/__mocks__/chalk.js',
    '^ora$': '<rootDir>/tests/__mocks__/ora.js',
    '^inquirer$': '<rootDir>/tests/__mocks__/inquirer.js'
  },
  testPathIgnorePatterns: [
    "<rootDir>/archive/",
    "<rootDir>/tests/__mocks__/",
    "<rootDir>/tests/setup/",
    "<rootDir>/node_modules/",
    "<rootDir>/dist/",
    "<rootDir>/build/"
  ],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/*.test.ts",
    "!src/**/*.spec.ts",
    "!src/desktop/**",
    "!src/**/index.ts"
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  // Enhanced coverage thresholds - Build system optimization 2025
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 75,
      branches: 70,
      statements: 80
    },
    // Critical components require higher coverage
    './src/core/security/': {
      lines: 90,
      functions: 85,
      branches: 80,
      statements: 90
    },
    './src/core/client.ts': {
      lines: 85,
      functions: 80,
      branches: 75,
      statements: 85
    },
    './src/core/agent.ts': {
      lines: 85,
      functions: 80,
      branches: 75,
      statements: 85
    },
    './src/core/cli.ts': {
      lines: 80,
      functions: 75,
      branches: 70,
      statements: 80
    }
  },
  testTimeout: 180000, // Increased to 3 minutes for heavy initialization
  verbose: true,
  // Optimize workers for better parallelization (use 50% of CPU cores)
  maxWorkers: "50%",
  // Modern Jest 30 configuration for better resource management
  openHandlesTimeout: 10000
};
