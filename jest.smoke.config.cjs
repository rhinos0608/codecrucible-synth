/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  testMatch: [
    "<rootDir>/tests/smoke.test.ts"
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
  // NO MOCKS - Real system testing only
  setupFiles: [],
  setupFilesAfterEnv: [],
  transformIgnorePatterns: [
    "node_modules/(?!(ora|chalk|inquirer|commander)/)"
  ],
  // Minimal module name mapping for TypeScript import resolution only
  moduleNameMapper: {
    '^(\\.{1,2}/.*)(\\.js)$': '$1'
  },
  testPathIgnorePatterns: [
    "<rootDir>/archive/",
    "<rootDir>/tests/__mocks__/",
    "<rootDir>/tests/setup/",
    "<rootDir>/node_modules/",
    "<rootDir>/dist/",
    "<rootDir>/build/"
  ],
  testTimeout: 60000, // Real operations may take longer
  verbose: true,
  // Single worker for real system testing to avoid conflicts
  maxWorkers: 1,
  // Longer timeout for real operations
  openHandlesTimeout: 30000
};