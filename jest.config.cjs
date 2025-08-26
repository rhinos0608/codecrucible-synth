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
      // isolatedModules setting moved to tsconfig.json to avoid deprecation warning
      tsconfig: {
        module: 'ES2022',
        target: 'ES2022',
        moduleResolution: 'node',
        isolatedModules: true // PERFORMANCE FIX: Disable type-checking during tests
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
  testTimeout: 180000, // Increased to 3 minutes for heavy initialization
  verbose: true,
  // Prevent hanging tests
  forceExit: true,
  detectOpenHandles: true,
  // Optimize workers for better parallelization (use 50% of CPU cores)
  maxWorkers: "50%"
};
