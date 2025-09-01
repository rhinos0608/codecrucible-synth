/**
 * Configuration Loader Unit Tests
 * Tests the typed configuration loader with zod validation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Configuration Loader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env to a clean state for each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('should load default configuration in test environment', async () => {
    // Set minimal required environment
    process.env.NODE_ENV = 'test';
    
    // Dynamic import to ensure fresh config loading
    const { config } = await import('../../src/config/index.js');
    
    expect(config.NODE_ENV).toBe('test');
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.DEBUG_MODE).toBe(false);
    expect(config.OLLAMA_ENDPOINT).toBe('http://localhost:11434');
    expect(config.LM_STUDIO_ENDPOINT).toBe('http://localhost:1234');
    expect(config.MODEL_MAX_TOKENS).toBe(3000);
    expect(config.MODEL_TEMPERATURE).toBe(0.7);
    expect(config.SERVER_PORT).toBe(3002);
    expect(config.INTERNAL_API_PORT).toBe(3000);
    expect(config.STRICT_MODE).toBe(true);
    expect(config.VALIDATE_INPUTS).toBe(true);
  });

  it('should validate port conflicts', async () => {
    process.env.NODE_ENV = 'test';
    process.env.SERVER_PORT = '3000';
    process.env.INTERNAL_API_PORT = '3000';

    // Expect the config loading to fail due to port conflict
    await expect(async () => {
      await import('../../src/config/index.js');
    }).rejects.toThrow();
  });

  it('should validate model configuration bounds', async () => {
    process.env.NODE_ENV = 'test';
    process.env.MODEL_TEMPERATURE = '3.0'; // Invalid: exceeds max of 2.0
    
    await expect(async () => {
      await import('../../src/config/index.js');
    }).rejects.toThrow();
  });

  it('should validate timeout configuration minimums', async () => {
    process.env.NODE_ENV = 'test';
    process.env.REQUEST_TIMEOUT = '500'; // Invalid: below minimum of 1000ms
    
    await expect(async () => {
      await import('../../src/config/index.js');
    }).rejects.toThrow();
  });

  it('should require DATABASE_URL and REDIS_URL in production', async () => {
    process.env.NODE_ENV = 'production';
    // Don't set DATABASE_URL and REDIS_URL
    
    await expect(async () => {
      await import('../../src/config/index.js');
    }).rejects.toThrow();
  });

  it('should enforce security settings in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.STRICT_MODE = 'false'; // Invalid in production
    
    await expect(async () => {
      await import('../../src/config/index.js');
    }).rejects.toThrow();
  });

  it('should accept valid production configuration', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.STRICT_MODE = 'true';
    process.env.VALIDATE_INPUTS = 'true';
    process.env.LOG_LEVEL = 'warn';
    
    const { config } = await import('../../src/config/index.js');
    
    expect(config.NODE_ENV).toBe('production');
    expect(config.DATABASE_URL).toBe('postgres://localhost:5432/test');
    expect(config.REDIS_URL).toBe('redis://localhost:6379');
    expect(config.STRICT_MODE).toBe(true);
    expect(config.VALIDATE_INPUTS).toBe(true);
    expect(config.LOG_LEVEL).toBe('warn');
  });

  it('should properly parse environment variable types', async () => {
    process.env.NODE_ENV = 'test';
    process.env.MODEL_MAX_TOKENS = '4096';
    process.env.MODEL_TEMPERATURE = '0.8';
    process.env.DEBUG_MODE = 'true';
    process.env.MAX_CONCURRENT_REQUESTS = '20';
    
    const { config } = await import('../../src/config/index.js');
    
    expect(typeof config.MODEL_MAX_TOKENS).toBe('number');
    expect(config.MODEL_MAX_TOKENS).toBe(4096);
    expect(typeof config.MODEL_TEMPERATURE).toBe('number');
    expect(config.MODEL_TEMPERATURE).toBe(0.8);
    expect(typeof config.DEBUG_MODE).toBe('boolean');
    expect(config.DEBUG_MODE).toBe(true);
    expect(typeof config.MAX_CONCURRENT_REQUESTS).toBe('number');
    expect(config.MAX_CONCURRENT_REQUESTS).toBe(20);
  });
});