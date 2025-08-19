/**
 * Unified Configuration System
 * Consolidates: src/core/config.ts, src/core/enhanced-config.ts, src/core/config-manager.ts
 * Created: 2024-12-19 | Purpose: Single source of truth for all configuration
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

// Configuration schemas
const ModelConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'huggingface', 'ollama', 'lmstudio']),
  model: z.string(),
  apiKey: z.string().optional(),
  endpoint: z.string().url().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().default(4000),
  timeout: z.number().positive().default(30000),
  retries: z.number().min(0).max(5).default(3)
});

const AgentConfigSchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(['fast', 'balanced', 'thorough', 'auto']).default('balanced'),
  maxConcurrency: z.number().positive().default(3),
  enableCaching: z.boolean().default(true),
  enableMetrics: z.boolean().default(true),
  enableSecurity: z.boolean().default(true)
});

const SystemConfigSchema = z.object({
  models: z.record(ModelConfigSchema),
  agent: AgentConfigSchema,
  performance: z.object({
    enableMonitoring: z.boolean().default(true),
    alertThreshold: z.number().positive().default(5000),
    metricsRetention: z.number().positive().default(86400000)
  }),
  security: z.object({
    enableValidation: z.boolean().default(true),
    sandboxMode: z.boolean().default(true),
    allowUnsafeCommands: z.boolean().default(false)
  }),
  debug: z.object({
    enabled: z.boolean().default(false),
    verbose: z.boolean().default(false),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info')
  })
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type SystemConfig = z.infer<typeof SystemConfigSchema>;

/**
 * Unified Configuration Manager
 * Handles all configuration loading, validation, and management
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: SystemConfig | null = null;
  private readonly configPath: string;
  private readonly defaultConfigPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || join(process.cwd(), 'codecrucible.config.json');
    this.defaultConfigPath = join(process.cwd(), 'codecrucible.config.default.json');
  }

  static getInstance(configPath?: string): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(configPath);
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration from file with validation
   */
  async loadConfig(): Promise<SystemConfig> {
    try {
      // Load from custom config file if exists
      if (existsSync(this.configPath)) {
        const configData = JSON.parse(readFileSync(this.configPath, 'utf-8'));
        this.config = this.validateConfig(configData);
        return this.config;
      }

      // Load from default config
      if (existsSync(this.defaultConfigPath)) {
        const defaultData = JSON.parse(readFileSync(this.defaultConfigPath, 'utf-8'));
        this.config = this.validateConfig(defaultData);
        return this.config;
      }

      // Create default configuration
      this.config = this.createDefaultConfig();
      await this.saveConfig();
      return this.config;

    } catch (error) {
      console.error('Failed to load configuration:', error);
      this.config = this.createDefaultConfig();
      return this.config;
    }
  }

  /**
   * Get current configuration (load if not cached)
   */
  async getConfig(): Promise<SystemConfig> {
    if (!this.config) {
      return await this.loadConfig();
    }
    return this.config;
  }

  /**
   * Update configuration and save to file
   */
  async updateConfig(updates: Partial<SystemConfig>): Promise<SystemConfig> {
    const currentConfig = await this.getConfig();
    const updatedConfig = { ...currentConfig, ...updates };
    
    this.config = this.validateConfig(updatedConfig);
    await this.saveConfig();
    return this.config;
  }

  /**
   * Get model configuration by name
   */
  async getModelConfig(modelName: string): Promise<ModelConfig | null> {
    const config = await this.getConfig();
    return config.models[modelName] || null;
  }

  /**
   * Add or update model configuration
   */
  async setModelConfig(modelName: string, modelConfig: ModelConfig): Promise<void> {
    const config = await this.getConfig();
    config.models[modelName] = this.validateModelConfig(modelConfig);
    this.config = config;
    await this.saveConfig();
  }

  /**
   * Get agent configuration
   */
  async getAgentConfig(): Promise<AgentConfig> {
    const config = await this.getConfig();
    return config.agent;
  }

  /**
   * Update agent configuration
   */
  async updateAgentConfig(updates: Partial<AgentConfig>): Promise<AgentConfig> {
    const config = await this.getConfig();
    config.agent = { ...config.agent, ...updates };
    this.config = config;
    await this.saveConfig();
    return config.agent;
  }

  /**
   * Validate configuration against schema
   */
  private validateConfig(config: unknown): SystemConfig {
    const result = SystemConfigSchema.safeParse(config);
    if (!result.success) {
      console.warn('Configuration validation failed:', result.error.format());
      return this.createDefaultConfig();
    }
    return result.data;
  }

  /**
   * Validate model configuration
   */
  private validateModelConfig(config: unknown): ModelConfig {
    const result = ModelConfigSchema.safeParse(config);
    if (!result.success) {
      throw new Error(`Invalid model configuration: ${result.error.message}`);
    }

    // Basic validation - more detailed security validation can be added later
    const configData = result.data;
    if (configData.apiKey && configData.apiKey.length < 10) {
      throw new Error('Invalid API key format');
    }

    if (configData.endpoint && !configData.endpoint.startsWith('http')) {
      throw new Error('Invalid endpoint URL');
    }

    return result.data;
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(): SystemConfig {
    return {
      models: {
        'gpt-4': {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 4000,
          timeout: 30000,
          retries: 3
        },
        'claude-3-sonnet': {
          provider: 'anthropic',
          model: 'claude-3-sonnet-20240229',
          temperature: 0.7,
          maxTokens: 4000,
          timeout: 30000,
          retries: 3
        },
        'local-llama': {
          provider: 'ollama',
          model: 'llama2',
          endpoint: 'http://localhost:11434',
          temperature: 0.7,
          maxTokens: 4000,
          timeout: 60000,
          retries: 2
        }
      },
      agent: {
        enabled: true,
        mode: 'balanced',
        maxConcurrency: 3,
        enableCaching: true,
        enableMetrics: true,
        enableSecurity: true
      },
      performance: {
        enableMonitoring: true,
        alertThreshold: 5000,
        metricsRetention: 86400000
      },
      security: {
        enableValidation: true,
        sandboxMode: true,
        allowUnsafeCommands: false
      },
      debug: {
        enabled: false,
        verbose: false,
        logLevel: 'info'
      }
    };
  }

  /**
   * Save configuration to file
   */
  private async saveConfig(): Promise<void> {
    if (!this.config) return;

    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw error;
    }
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfig(): Promise<SystemConfig> {
    this.config = this.createDefaultConfig();
    await this.saveConfig();
    return this.config;
  }

  /**
   * Check if configuration is valid
   */
  async validateCurrentConfig(): Promise<boolean> {
    try {
      const config = await this.getConfig();
      const result = SystemConfigSchema.safeParse(config);
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Get configuration summary for debugging
   */
  async getConfigSummary(): Promise<{
    modelsCount: number;
    agentMode: string;
    securityEnabled: boolean;
    debugEnabled: boolean;
  }> {
    const config = await this.getConfig();
    return {
      modelsCount: Object.keys(config.models).length,
      agentMode: config.agent.mode,
      securityEnabled: config.security.enableValidation,
      debugEnabled: config.debug.enabled
    };
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();
