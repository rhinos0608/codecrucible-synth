import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import YAML from 'yaml';
import { logger } from './logger.js';
import { cliOutput, CLIError } from './cli-output-manager.js';
import { AppConfig } from '../config/config-manager.js';

/**
 * Enhanced Configuration Manager following CLI best practices
 * 
 * Features:
 * - XDG Base Directory Specification compliance
 * - Configuration validation and migration
 * - Environment variable override support
 * - Secure credential storage
 * - Configuration profiles
 */
export class EnhancedConfigManager {
  private static instance: EnhancedConfigManager;
  private config: AppConfig | null = null;
  private configPath: string;
  private credentialsPath: string;
  private currentProfile = 'default';

  private constructor() {
    // Follow XDG Base Directory Specification
    const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
    const dataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
    
    this.configPath = join(configHome, 'codecrucible', 'config.yaml');
    this.credentialsPath = join(dataHome, 'codecrucible', 'credentials.yaml');
  }

  static getInstance(): EnhancedConfigManager {
    if (!EnhancedConfigManager.instance) {
      EnhancedConfigManager.instance = new EnhancedConfigManager();
    }
    return EnhancedConfigManager.instance;
  }

  /**
   * Initialize configuration with validation and migration
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureConfigDirectories();
      await this.loadConfig();
      await this.validateConfig();
      await this.migrateConfigIfNeeded();
    } catch (error) {
      throw CLIError.configurationError(
        error instanceof Error ? error.message : 'Failed to initialize configuration'
      );
    }
  }

  /**
   * Get configuration value with environment variable override support
   */
  async get<T = any>(key: string, profile?: string): Promise<T | undefined> {
    await this.ensureConfigLoaded();
    
    // Check environment variable override first
    const envKey = this.keyToEnvVar(key);
    const envValue = process.env[envKey];
    if (envValue !== undefined) {
      return this.parseEnvironmentValue(envValue) as T;
    }

    // Get from configuration
    const targetProfile = profile || this.currentProfile;
    const config = await this.getProfileConfig(targetProfile);
    
    return this.getNestedValue(config, key) as T;
  }

  /**
   * Set configuration value
   */
  async set(key: string, value: any, profile?: string): Promise<void> {
    await this.ensureConfigLoaded();
    
    const targetProfile = profile || this.currentProfile;
    let config = await this.getProfileConfig(targetProfile);
    
    this.setNestedValue(config, key, value);
    await this.saveConfig();
    
    cliOutput.outputDebug(`Configuration updated: ${key} = ${JSON.stringify(value)}`);
  }

  /**
   * Get all configuration for current profile
   */
  async getAll(profile?: string): Promise<AppConfig> {
    await this.ensureConfigLoaded();
    const targetProfile = profile || this.currentProfile;
    return await this.getProfileConfig(targetProfile);
  }

  /**
   * List available configuration profiles
   */
  async listProfiles(): Promise<string[]> {
    await this.ensureConfigLoaded();
    if (!this.config) return ['default'];
    
    // In future implementation, support multiple profiles
    return ['default'];
  }

  /**
   * Switch to different configuration profile
   */
  async switchProfile(profileName: string): Promise<void> {
    const profiles = await this.listProfiles();
    if (!profiles.includes(profileName)) {
      throw CLIError.invalidArgument(
        'profile',
        `Profile '${profileName}' does not exist. Available profiles: ${profiles.join(', ')}`
      );
    }
    
    this.currentProfile = profileName;
    cliOutput.outputInfo(`Switched to profile: ${profileName}`);
  }

  /**
   * Reset configuration to defaults
   */
  async reset(profile?: string): Promise<void> {
    const targetProfile = profile || this.currentProfile;
    
    if (targetProfile === 'default') {
      this.config = this.getDefaultConfig();
      await this.saveConfig();
      cliOutput.outputSuccess('Configuration reset to defaults');
    } else {
      throw CLIError.invalidArgument('profile', 'Can only reset default profile');
    }
  }

  /**
   * Export configuration for backup or sharing
   */
  async exportConfig(outputPath?: string, includeCredentials = false): Promise<string> {
    await this.ensureConfigLoaded();
    
    const exportData: any = {
      version: '2.5.0',
      profile: this.currentProfile,
      config: this.config,
      exportedAt: new Date().toISOString()
    };

    if (includeCredentials) {
      exportData.credentials = await this.loadCredentials();
      cliOutput.outputWarning('Exported configuration includes sensitive credentials');
    }

    const yamlContent = YAML.stringify(exportData, { indent: 2 });
    
    if (outputPath) {
      await writeFile(outputPath, yamlContent, 'utf8');
      cliOutput.outputSuccess(`Configuration exported to: ${outputPath}`);
    }
    
    return yamlContent;
  }

  /**
   * Import configuration from backup
   */
  async importConfig(inputPath: string, overwrite = false): Promise<void> {
    try {
      const yamlContent = await readFile(inputPath, 'utf8');
      const importData = YAML.parse(yamlContent);
      
      if (!importData.config) {
        throw new Error('Invalid configuration file format');
      }

      if (!overwrite && this.config) {
        throw CLIError.validationError(
          'Configuration already exists. Use --overwrite to replace it'
        );
      }

      this.config = importData.config;
      await this.validateConfig();
      await this.saveConfig();
      
      if (importData.credentials) {
        await this.saveCredentials(importData.credentials);
        cliOutput.outputWarning('Imported configuration includes credentials');
      }
      
      cliOutput.outputSuccess(`Configuration imported from: ${inputPath}`);
      
    } catch (error) {
      throw CLIError.configurationError(
        error instanceof Error ? error.message : 'Failed to import configuration'
      );
    }
  }

  /**
   * Validate current configuration
   */
  async validateConfig(): Promise<{ valid: boolean; errors: string[] }> {
    if (!this.config) {
      return { valid: false, errors: ['Configuration not loaded'] };
    }

    const errors: string[] = [];

    // Validate model configuration
    if (!this.config.model?.name) {
      errors.push('Model name is required');
    }

    if (!this.config.model?.endpoint) {
      errors.push('Model endpoint is required');
    }

    // Validate voices
    if (!Array.isArray(this.config.voices?.available) || this.config.voices.available.length === 0) {
      errors.push('At least one voice must be available');
    }

    // Validate timeout values
    if (this.config.model?.timeout && this.config.model.timeout < 1000) {
      errors.push('Model timeout must be at least 1000ms');
    }

    // Validate temperature
    if (this.config.model?.temperature !== undefined) {
      if (this.config.model.temperature < 0 || this.config.model.temperature > 2) {
        errors.push('Model temperature must be between 0 and 2');
      }
    }

    // Validate LLM providers
    if (this.config.llmProviders?.providers) {
      for (const [name, provider] of Object.entries(this.config.llmProviders.providers)) {
        if (!provider.model) {
          errors.push(`LLM provider '${name}' missing model configuration`);
        }
        
        if (provider.apiKey && provider.apiKey.length < 10) {
          errors.push(`LLM provider '${name}' has invalid API key format`);
        }
      }
    }

    const valid = errors.length === 0;
    if (!valid) {
      cliOutput.outputWarning(`Configuration validation found ${errors.length} issues`);
      errors.forEach(error => cliOutput.outputDebug(`  • ${error}`));
    }

    return { valid, errors };
  }

  /**
   * Get configuration file paths for debugging
   */
  getConfigPaths(): { config: string; credentials: string } {
    return {
      config: this.configPath,
      credentials: this.credentialsPath
    };
  }

  /**
   * Check if configuration exists
   */
  async configExists(): Promise<boolean> {
    try {
      await access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Private helper methods
   */

  private async ensureConfigLoaded(): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }
  }

  private async ensureConfigDirectories(): Promise<void> {
    await mkdir(dirname(this.configPath), { recursive: true });
    await mkdir(dirname(this.credentialsPath), { recursive: true });
  }

  private async loadConfig(): Promise<void> {
    try {
      const configExists = await this.configExists();
      
      if (!configExists) {
        cliOutput.outputInfo('No configuration found, creating default configuration');
        this.config = this.getDefaultConfig();
        await this.saveConfig();
      } else {
        const yamlContent = await readFile(this.configPath, 'utf8');
        this.config = YAML.parse(yamlContent);
      }
    } catch (error) {
      cliOutput.outputWarning('Failed to load configuration, using defaults');
      this.config = this.getDefaultConfig();
    }
  }

  private async saveConfig(): Promise<void> {
    const yamlContent = YAML.stringify(this.config, { indent: 2 });
    await writeFile(this.configPath, yamlContent, 'utf8');
  }

  private async getProfileConfig(profile: string): Promise<AppConfig> {
    // For now, only default profile is supported
    if (profile !== 'default') {
      throw CLIError.invalidArgument('profile', `Profile '${profile}' not found`);
    }
    
    return this.config!;
  }

  private keyToEnvVar(key: string): string {
    return `CODECRUCIBLE_${key.toUpperCase().replace(/\./g, '_')}`;
  }

  private parseEnvironmentValue(value: string): any {
    // Try to parse as JSON, fallback to string
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    
    // Try parsing as number
    const num = Number(value);
    if (!isNaN(num)) return num;
    
    // Try parsing as JSON
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }

  private async loadCredentials(): Promise<any> {
    try {
      const credentialsContent = await readFile(this.credentialsPath, 'utf8');
      return YAML.parse(credentialsContent);
    } catch {
      return {};
    }
  }

  private async saveCredentials(credentials: any): Promise<void> {
    const yamlContent = YAML.stringify(credentials, { indent: 2 });
    await writeFile(this.credentialsPath, yamlContent, 'utf8');
  }

  private async migrateConfigIfNeeded(): Promise<void> {
    // Future implementation: handle configuration version migrations
    // For now, this is a placeholder
  }

  private getDefaultConfig(): AppConfig {
    return {
      model: {
        endpoint: 'http://localhost:11434',
        name: 'qwen2.5-coder',
        timeout: 120000,
        maxTokens: 8192,
        temperature: 0.1
      },
      llmProviders: {
        default: 'ollama',
        providers: {
          ollama: {
            provider: 'ollama',
            endpoint: 'http://localhost:11434',
            model: 'qwen2.5-coder',
            enabled: true
          }
        }
      },
      voices: {
        default: ['developer', 'analyzer'],
        available: ['developer', 'analyzer', 'optimizer', 'explorer', 'maintainer', 'documenter'],
        parallel: true,
        maxConcurrent: 3
      },
      database: {
        path: join(homedir(), '.codecrucible', 'database.db'),
        inMemory: false,
        enableWAL: true,
        backupEnabled: true,
        backupInterval: 24 * 60 * 60 * 1000
      },
      safety: {
        commandValidation: true,
        fileSystemRestrictions: true,
        requireConsent: ['delete', 'execute', 'network']
      },
      terminal: {
        shell: process.platform === 'win32' ? 'cmd' : 'bash',
        prompt: '$ ',
        historySize: 1000,
        colorOutput: true
      },
      vscode: {
        autoActivate: false,
        inlineGeneration: true,
        showVoicePanel: true
      },
      mcp: {
        servers: {
          filesystem: { enabled: true, restrictedPaths: [], allowedPaths: [] },
          git: { enabled: true, autoCommitMessages: false, safeModeEnabled: true },
          terminal: { enabled: false, allowedCommands: [], blockedCommands: [] },
          packageManager: { enabled: false, autoInstall: false, securityScan: true },
          smithery: { enabled: false }
        }
      },
      performance: {
        responseCache: { enabled: true, maxAge: 3600000, maxSize: 100 },
        voiceParallelism: { maxConcurrent: 3, batchSize: 5 },
        contextManagement: { maxContextLength: 8192, compressionThreshold: 4096, retentionStrategy: 'lru' }
      },
      logging: {
        level: 'info',
        toFile: true,
        maxFileSize: '10MB',
        maxFiles: 5
      }
    };
  }
}