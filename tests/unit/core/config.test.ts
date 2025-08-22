/**
 * Configuration System Test Suite
 * Testing enterprise configuration management
 */

import { ConfigManager } from '../../../src/core/config.js';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const testConfigPath = join(process.cwd(), 'test-config.json');

  test('should load default configuration', async () => {
    configManager = new ConfigManager();
    const config = await configManager.loadConfig();
    
    expect(config).toBeTruthy();
    expect(config.models).toBeTruthy();
    expect(config.environment).toBe('development');
    expect(config.security.enableValidation).toBeTruthy();
  });

  test('should validate configuration schema', async () => {
    configManager = new ConfigManager();
    const isValid = await configManager.validateCurrentConfig();
    
    expect(isValid).toBe(true);
  });

  test('should handle feature flags', async () => {
    configManager = new ConfigManager();
    const isEnabled = await configManager.isFeatureEnabled('enableVoiceSystem');
    const value = await configManager.getFeatureValue('maxConcurrentVoices');
    
    expect(isEnabled).toBe(true);
    expect(value).toBe(5);
  });

  test('should get environment correctly', async () => {
    configManager = new ConfigManager();
    const env = await configManager.getEnvironment();
    
    expect(env).toBe('development');
  });

  test('should handle model configuration', async () => {
    configManager = new ConfigManager();
    const modelConfig = await configManager.getModelConfig('gpt-4');
    
    expect(modelConfig).toBeTruthy();
    expect(modelConfig?.provider).toBe('openai');
    expect(modelConfig?.model).toBe('gpt-4');
  });

  // Cleanup
  afterEach(() => {
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });
});