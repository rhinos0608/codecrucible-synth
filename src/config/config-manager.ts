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
    contextManagement: { maxContextLength: number; compressionThreshold: number; retentionStrategy: string };
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
      ConfigManager.instance = new ConfigManager();
      await ConfigManager.instance.loadConfiguration();
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
      this.decryptSensitiveFields(this.config);
      
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

    return this.config!;
  }

  async set(key: string, value: any): Promise<void> { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!this.config) {
      await this.loadConfiguration();
    }

    const keys = key.split('.');
    let current: Record<string, any> = this.config as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    // Navigate to parent object
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
      }
      current = current[keys[i]]; // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    // Set the value
    current[keys[keys.length - 1]] = value;

    await this.saveUserConfig();
    logger.info(`Configuration updated: ${key} = ${JSON.stringify(value)}`);
  }

  async get(key: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!this.config) {
      await this.loadConfiguration();
    }

    const keys = key.split('.');
    let current: Record<string, any> = this.config as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    for (const k of keys) {
      if (current[k] === undefined) {
        return undefined;
      }
      current = current[k]; // eslint-disable-line @typescript-eslint/no-explicit-any
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
        endpoint: "http://localhost:11434",
        name: "", // Will be auto-detected from available models
        timeout: 180000, // 3 minutes for cold model starts
        maxTokens: 20000,
        temperature: 0.7
      },
      llmProviders: {
        default: "ollama-local",
        providers: {
          "ollama-local": {
            provider: "ollama",
            endpoint: "http://localhost:11434",
            model: "auto",
            maxTokens: 4096,
            temperature: 0.7,
            timeout: 30000,
            enabled: true
          },
          "openai-gpt4": {
            provider: "openai",
            model: "gpt-4o",
            maxTokens: 4096,
            temperature: 0.7,
            timeout: 30000,
            enabled: false
          },
          "anthropic-claude": {
            provider: "anthropic",
            model: "claude-3-5-sonnet-20241022",
            maxTokens: 4096,
            temperature: 0.7,
            timeout: 30000,
            enabled: false
          },
          "google-gemini": {
            provider: "google",
            model: "gemini-1.5-pro",
            maxTokens: 4096,
            temperature: 0.7,
            timeout: 30000,
            enabled: false
          }
        }
      },
      voices: {
        default: ["explorer", "maintainer"],
        available: ["explorer", "maintainer", "analyzer", "developer", "implementor", "security", "architect", "designer", "optimizer"],
        parallel: true,
        maxConcurrent: 3
      },
      database: {
        path: "codecrucible.db",
        inMemory: false,
        enableWAL: true,
        backupEnabled: true,
        backupInterval: 86400000 // 24 hours in milliseconds
      },
      safety: {
        commandValidation: true,
        fileSystemRestrictions: true,
        requireConsent: ["delete", "execute"]
      },
      terminal: {
        shell: "auto",
        prompt: "CC> ",
        historySize: 1000,
        colorOutput: true
      },
      vscode: {
        autoActivate: true,
        inlineGeneration: true,
        showVoicePanel: true
      },
      mcp: {
        servers: {
          filesystem: {
            enabled: true,
            restrictedPaths: ["/etc", "/sys", "/proc"],
            allowedPaths: ["~/", "./"]
          },
          git: {
            enabled: true,
            autoCommitMessages: false,
            safeModeEnabled: true
          },
          terminal: {
            enabled: true,
            allowedCommands: ["ls", "cat", "grep", "find", "git", "npm", "node", "python"],
            blockedCommands: ["rm -rf", "sudo", "su", "chmod +x"]
          },
          packageManager: {
            enabled: true,
            autoInstall: false,
            securityScan: true
          },
          smithery: {
            enabled: false,
            apiKey: "",
            profile: "",
            baseUrl: "https://server.smithery.ai"
          }
        }
      },
      performance: {
        responseCache: {
          enabled: true,
          maxAge: 3600000,
          maxSize: 100
        },
        voiceParallelism: {
          maxConcurrent: 3,
          batchSize: 2
        },
        contextManagement: {
          maxContextLength: 100000,
          compressionThreshold: 80000,
          retentionStrategy: "sliding"
        }
      },
      logging: {
        level: "info",
        toFile: true,
        maxFileSize: "10MB",
        maxFiles: 5
      }
    };
  }

  /**
   * Encrypt sensitive configuration fields
   */
  private encryptSensitiveFields(config: any): void {
    const sensitiveFields = [
      'mcp.servers.smithery.apiKey',
      'model.apiKey',
      'database.password',
      'security.encryptionKey'
    ];

    for (const fieldPath of sensitiveFields) {
      const value = this.getNestedValue(config, fieldPath);
      if (value && typeof value === 'string' && value.length > 0 && !SecurityUtils.isEncrypted(value)) {
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
  private decryptSensitiveFields(config: any): void {
    const sensitiveFields = [
      'mcp.servers.smithery.apiKey',
      'model.apiKey',
      'database.password',
      'security.encryptionKey'
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
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
}