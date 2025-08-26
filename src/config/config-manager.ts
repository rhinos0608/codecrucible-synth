import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import YAML from 'yaml';
import { logger } from '../core/logger.js';
import { SecurityUtils } from '../core/security-utils.js';

export interface LLMProviderConfig {
  provider: 'openai' | 'google' | 'anthropic' | 'ollama';
  apiKey?: string;
  endpoint?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  enabled: boolean;
}

// Consolidated from core/config.ts - Agent configuration
export interface AgentConfig {
  enabled: boolean;
  mode: 'fast' | 'balanced' | 'thorough' | 'auto';
  maxConcurrency: number;
  enableCaching: boolean;
  enableMetrics: boolean;
  enableSecurity: boolean;
}

export interface AppConfig {
  model: {
    endpoint: string;
    name: string;
    timeout: number;
    maxTokens: number;
    temperature: number;
  };
  llmProviders: {
    default: string;
    providers: Record<string, LLMProviderConfig>;
  };
  agent: AgentConfig;
  voices: {
    default: string[];
    available: string[];
    parallel: boolean;
    maxConcurrent: number;
  };
  database: {
    path: string;
    inMemory: boolean;
    enableWAL: boolean;
    backupEnabled: boolean;
    backupInterval: number;
  };
  safety: {
    commandValidation: boolean;
    fileSystemRestrictions: boolean;
    requireConsent: string[];
  };
  terminal: {
    shell: string;
    prompt: string;
    historySize: number;
    colorOutput: boolean;
  };
  vscode: {
    autoActivate: boolean;
    inlineGeneration: boolean;
    showVoicePanel: boolean;
  };
  mcp: {
    servers: {
      filesystem: { enabled: boolean; restrictedPaths: string[]; allowedPaths: string[] };
      git: { enabled: boolean; autoCommitMessages: boolean; safeModeEnabled: boolean };
      terminal: { enabled: boolean; allowedCommands: string[]; blockedCommands: string[] };
      packageManager: { enabled: boolean; autoInstall: boolean; securityScan: boolean };
      smithery: { enabled: boolean; apiKey?: string; profile?: string; baseUrl?: string };
    };
  };
  performance: {
    responseCache: { enabled: boolean; maxAge: number; maxSize: number };
    voiceParallelism: { maxConcurrent: number; batchSize: number };
    contextManagement: {
      maxContextLength: number;
      compressionThreshold: number;
      retentionStrategy: string;
    };
  };
  logging: {
    level: string;
    toFile: boolean;
    maxFileSize: string;
    maxFiles: number;
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig | null = null;
  private configPath: string;
  private defaultConfigPath: string;

  constructor() {
    this.configPath = join(homedir(), '.codecrucible', 'config.yaml');
    this.defaultConfigPath = join(process.cwd(), 'config', 'default.yaml');
  }

  static async load(): Promise<AppConfig> {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
      // Initialize encryption for sensitive data
      await SecurityUtils.initializeEncryption();
    }
    return await ConfigManager.instance.loadConfiguration();
  }

  static async getInstance(): Promise<ConfigManager> {
    if (!ConfigManager.instance) {
      const instance = new ConfigManager();
      await instance.loadConfiguration();
      ConfigManager.instance = instance;
    }
    return ConfigManager.instance;
  }

  public async loadConfiguration(): Promise<AppConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      // Check if user config exists
      await access(this.configPath);
      const userConfigContent = await readFile(this.configPath, 'utf8');
      this.config = YAML.parse(userConfigContent);

      // Decrypt sensitive fields
      this.decryptSensitiveFields(this.config as AppConfig);

      logger.info('Loaded user configuration', { path: this.configPath });
    } catch (error) {
      // User config doesn't exist, try default config
      try {
        const defaultConfigContent = await readFile(this.defaultConfigPath, 'utf8');
        this.config = YAML.parse(defaultConfigContent);
        logger.info('Loaded default configuration', { path: this.defaultConfigPath });

        // Create user config from default
        await this.saveUserConfig();
      } catch (defaultError) {
        // Neither config exists, use hardcoded defaults
        this.config = this.getHardcodedDefaults();
        logger.warn('Using hardcoded configuration - no config files found');
        await this.saveUserConfig();
      }
    }
    
    // At this point config should always be populated
    if (!this.config) {
      throw new Error('Failed to load configuration');
    }

    return this.config;
  }

  async set(key: string, value: unknown): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    const keys = key.split('.');
    let current: Record<string, unknown> = this.config as unknown as Record<string, unknown>;

    // Navigate to parent object
    for (let i = 0; i < keys.length - 1; i++) {
      const currentKey = keys[i];
      if (currentKey && !current[currentKey]) {
        current[currentKey] = {};
      }
      if (currentKey) {
        current = current[currentKey] as Record<string, unknown>;
      }
    }

    // Set the value
    const finalKey = keys[keys.length - 1];
    if (finalKey) {
      current[finalKey] = value;
    }

    await this.saveUserConfig();
    logger.info(`Configuration updated: ${key} = ${JSON.stringify(value)}`);
  }

  async get(key: string): Promise<unknown> {
    if (!this.config) {
      await this.loadConfiguration();
    }

    const keys = key.split('.');
    let current: Record<string, unknown> = this.config as unknown as Record<string, unknown>;

    for (const k of keys) {
      if (current === null || current === undefined || typeof current !== 'object' || current[k] === undefined) {
        return undefined;
      }
      current = current[k] as Record<string, unknown>;
    }

    return current;
  }

  async reset(): Promise<void> {
    this.config = this.getHardcodedDefaults();
    await this.saveUserConfig();
    logger.info('Configuration reset to defaults');
  }

  getAll(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return { ...this.config };
  }

  private async saveUserConfig(): Promise<void> {
    try {
      const configDir = dirname(this.configPath);
      await mkdir(configDir, { recursive: true });

      // Create a copy of config with encrypted sensitive fields
      const configToSave = JSON.parse(JSON.stringify(this.config));
      this.encryptSensitiveFields(configToSave);

      const yamlContent = YAML.stringify(configToSave);
      await writeFile(this.configPath, yamlContent, 'utf8');

      logger.debug('User configuration saved', { path: this.configPath });
    } catch (error) {
      logger.error('Failed to save user configuration:', error);
      throw error;
    }
  }

  private getHardcodedDefaults(): AppConfig {
    return {
      model: {
        endpoint: 'http://localhost:11434',
        name: '', // Will be auto-detected from available models
        timeout: 180000, // 3 minutes for cold model starts
        maxTokens: 20000,
        temperature: 0.7,
      },
      llmProviders: {
        default: 'ollama-local',
        providers: {
          'ollama-local': {
            provider: 'ollama',
            endpoint: 'http://localhost:11434',
            model: 'auto',
            maxTokens: 4096,
            temperature: 0.7,
            timeout: 110000, // Optimized for Ollama 2-minute hard limit
            enabled: true,
          },
          'openai-gpt4': {
            provider: 'openai',
            model: 'gpt-4o',
            maxTokens: 4096,
            temperature: 0.7,
            timeout: 30000,
            enabled: false,
          },
          'anthropic-claude': {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            maxTokens: 4096,
            temperature: 0.7,
            timeout: 30000,
            enabled: false,
          },
          'google-gemini': {
            provider: 'google',
            model: 'gemini-1.5-pro',
            maxTokens: 4096,
            temperature: 0.7,
            timeout: 30000,
            enabled: false,
          },
        },
      },
      agent: {
        enabled: true,
        mode: 'balanced',
        maxConcurrency: 3,
        enableCaching: true,
        enableMetrics: true,
        enableSecurity: true,
      },
      voices: {
        default: ['explorer', 'maintainer'],
        available: [
          'explorer',
          'maintainer',
          'analyzer',
          'developer',
          'implementor',
          'security',
          'architect',
          'designer',
          'optimizer',
        ],
        parallel: true,
        maxConcurrent: 3,
      },
      database: {
        path: 'codecrucible.db',
        inMemory: false,
        enableWAL: true,
        backupEnabled: true,
        backupInterval: 86400000, // 24 hours in milliseconds
      },
      safety: {
        commandValidation: true,
        fileSystemRestrictions: true,
        requireConsent: ['delete', 'execute'],
      },
      terminal: {
        shell: 'auto',
        prompt: 'CC> ',
        historySize: 1000,
        colorOutput: true,
      },
      vscode: {
        autoActivate: true,
        inlineGeneration: true,
        showVoicePanel: true,
      },
      mcp: {
        servers: {
          filesystem: { enabled: true, restrictedPaths: ['/etc', '/sys', '/proc'], allowedPaths: ['./'] },
          git: { enabled: true, autoCommitMessages: true, safeModeEnabled: true },
          terminal: { enabled: true, allowedCommands: ['ls', 'pwd', 'echo'], blockedCommands: ['rm', 'sudo'] },
          packageManager: { enabled: true, autoInstall: false, securityScan: true },
          smithery: { enabled: true, apiKey: '', profile: 'default', baseUrl: 'https://api.smithery.ai' },
        },
      },
      performance: {
        responseCache: { enabled: true, maxAge: 3600000, maxSize: 100 },
        voiceParallelism: { maxConcurrent: 4, batchSize: 3 },
        contextManagement: {
          maxContextLength: 16384,
          compressionThreshold: 8192,
          retentionStrategy: 'sliding-window',
        },
      },
      logging: {
        level: 'info',
        toFile: true,
        maxFileSize: '10MB',
        maxFiles: 5,
      },
    };
  }

  /**
   * Encrypt sensitive configuration fields
   */
  private encryptSensitiveFields(config: AppConfig): void {
    const sensitiveFields = [
      'mcp.servers.smithery.apiKey',
      'model.apiKey',
      'database.password',
      'security.encryptionKey',
    ];

    for (const fieldPath of sensitiveFields) {
      const value = this.getNestedValue(config, fieldPath);
      if (
        value &&
        typeof value === 'string' &&
        value.length > 0 &&
        !SecurityUtils.isEncrypted(value)
      ) {
        try {
          const encrypted = SecurityUtils.encrypt(value);
          this.setNestedValue(config, fieldPath, encrypted);
        } catch (error) {
          logger.warn(`Failed to encrypt field ${fieldPath}:`, error);
        }
      }
    }
  }

  /**
   * Decrypt sensitive configuration fields
   */
  private decryptSensitiveFields(config: AppConfig): void {
    const sensitiveFields = [
      'mcp.servers.smithery.apiKey',
      'model.apiKey',
      'database.password',
      'security.encryptionKey',
    ];

    for (const fieldPath of sensitiveFields) {
      const value = this.getNestedValue(config, fieldPath);
      if (value && typeof value === 'string' && SecurityUtils.isEncrypted(value)) {
        try {
          const decrypted = SecurityUtils.decrypt(value);
          this.setNestedValue(config, fieldPath, decrypted);
        } catch (error) {
          logger.warn(`Failed to decrypt field ${fieldPath}:`, error);
          // Leave the field encrypted if decryption fails
        }
      }
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      if (current === null || current === undefined) {
        return undefined;
      }
      return (current as Record<string, unknown>)[key];
    }, obj);
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: unknown, path: string, value: unknown): void {
    const keys = path.split('.');
    const lastKey = keys.pop();
    if (!lastKey) {
      return;
    }

    let current = obj as Record<string, any>;
    for (const key of keys) {
      if (current[key] === undefined || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    current[lastKey] = value;
  }

  /**
   * Get agent configuration (consolidated from core/config.ts)
   */
  async getAgentConfig(): Promise<AgentConfig> {
    const config = await this.loadConfiguration();
    return config.agent;
  }

  /**
   * Update agent configuration (consolidated from core/config.ts)
   */
  async updateAgentConfig(newConfig: AgentConfig): Promise<void> {
    const config = await this.loadConfiguration();
    config.agent = newConfig;
    await this.saveUserConfig();
  }
}

export const configManager = new ConfigManager();