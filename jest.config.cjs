/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    "<rootDir>/tests/**/*.ts",
    "<rootDir>/?(*.)+(spec|test).ts"
  ],
  moduleFileExtensions: ["ts", "js", "json", "node"],
  transform: {
    '^.+\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'ES2020'
      }
    }],
  },
  modulePaths: [
    "<rootDir>"
  ],
  setupFiles: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!ora|chalk)/"
  ],
  moduleNameMapper: {
    '^(\.{1,2}/.*)\.js$': '$1',
    '^chalk$': '<rootDir>/tests/__mocks__/chalk.js',
    '^ora$': '<rootDir>/tests/__mocks__/ora.js',
    '^inquirer$': '<rootDir>/tests/__mocks__/inquirer.js',
    '^src/core/cli$': '<rootDir>/tests/__mocks__/src/core/cli.ts'
  },
  testPathIgnorePatterns: [
    "<rootDir>/archive/",
    "<rootDir>/tests/setup.ts",
    "<rootDir>/tests/integration/cli.test.ts",
    "<rootDir>/tests/__mocks__/",
    "<rootDir>/tests/unit/voice-system.test.ts"
  ],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/*.test.ts",
    "!src/**/*.spec.ts"
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  testTimeout: 10000
};
