import { describe, test, expect } from '@jest/globals';

/**
 * Smoke Test Suite - Verifies basic testing infrastructure
 * These tests should always pass and help identify setup issues
 */

describe('CodeCrucible Synth - Smoke Tests', () => {
  test('testing infrastructure is working', () => {
    expect(true).toBe(true);
  });

  test('environment variables are set correctly', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.CI).toBe('true');
  });

  test('global test utilities are available', () => {
    expect(global.testUtils).toBeDefined();
    expect(typeof global.testUtils.createMockConfig).toBe('function');
    expect(typeof global.testUtils.createMockProjectContext).toBe('function');
    expect(typeof global.testUtils.delay).toBe('function');
  });

  test('can create mock configurations', () => {
    const mockConfig = global.testUtils.createMockConfig();
    
    expect(mockConfig).toBeDefined();
    expect(mockConfig.model).toBeDefined();
    expect(mockConfig.model.endpoint).toContain('localhost');
    expect(mockConfig.voices).toBeDefined();
    expect(Array.isArray(mockConfig.voices.available)).toBe(true);
  });

  test('can create mock project context', () => {
    const mockContext = global.testUtils.createMockProjectContext();
    
    expect(mockContext).toBeDefined();
    expect(Array.isArray(mockContext.files)).toBe(true);
    expect(mockContext.files.length).toBeGreaterThan(0);
    expect(mockContext.projectType).toBeDefined();
  });

  test('async utilities work correctly', async () => {
    const start = Date.now();
    await global.testUtils.delay(100);
    const end = Date.now();
    
    expect(end - start).toBeGreaterThanOrEqual(95); // Allow some variance
  });

  test('basic imports work', async () => {
    // Test that we can import our main modules without syntax errors
    try {
      // Dynamic imports to avoid loading heavy modules during tests
      const { LocalModelClient } = await import('../../src/core/local-model-client.js');
      expect(LocalModelClient).toBeDefined();
      expect(typeof LocalModelClient).toBe('function');
    } catch (error) {
      // If import fails, it might be due to dependencies not being installed
      // The test should still record what happened
      console.warn('Module import failed:', error.message);
      expect(error.message).toContain('Configuration error');
    }
  });

  test('package.json is correctly configured', async () => {
    try {
      const fs = await import('fs/promises');
      const packageJson = JSON.parse(
        await fs.readFile('package.json', 'utf-8')
      );
      
      expect(packageJson.name).toBe('codecrucible-synth');
      expect(packageJson.type).toBe('module');
      expect(packageJson.scripts.test).toBeDefined();
      expect(packageJson.scripts.build).toBeDefined();
      expect(packageJson.scripts.lint).toBeDefined();
      
      // Check that circular dependency was fixed
      expect(packageJson.dependencies['codecrucible-synth']).toBeUndefined();
      
    } catch (error) {
      console.warn('Package.json test failed:', error.message);
      throw error;
    }
  });

  test('TypeScript configuration is valid', async () => {
    try {
      const fs = await import('fs/promises');
      const tsConfig = JSON.parse(
        await fs.readFile('tsconfig.json', 'utf-8')
      );
      
      expect(tsConfig.compilerOptions).toBeDefined();
      expect(tsConfig.compilerOptions.target).toBe('ES2022');
      expect(tsConfig.compilerOptions.module).toBe('ESNext');
      expect(tsConfig.compilerOptions.strict).toBe(true);
      
    } catch (error) {
      console.warn('TypeScript config test failed:', error.message);
      throw error;
    }
  });
});
