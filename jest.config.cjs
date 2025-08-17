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
        moduleResolution: 'node'
      }
    }],
  },
  modulePaths: [
    "<rootDir>"
  ],
  setupFiles: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!(ora|chalk|inquirer|commander)/)"
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)(\\.js)$': '$1',
    '^chalk$': '<rootDir>/tests/__mocks__/chalk.js',
    '^ora$': '<rootDir>/tests/__mocks__/ora.js',
    '^inquirer$': '<rootDir>/tests/__mocks__/inquirer.js'
  },
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  testPathIgnorePatterns: [
    "<rootDir>/archive/",
    "<rootDir>/tests/__mocks__/",
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
  testTimeout: 30000,
  // Better error reporting
  verbose: true,
  // Handle CommonJS modules better - moved to transform config above
};
