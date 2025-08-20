/**
 * Encrypted Configuration Management
 * Provides secure configuration loading with environment-specific encryption
 */

import path from 'path';
import { SecretsManager } from './secrets-manager.js';
import { logger } from '../logger.js';

export interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    default?: any;
    sensitive?: boolean;
    validation?: (value: any) => boolean;
    description?: string;
  };
}

export interface EncryptedConfigOptions {
  environment: string;
  configPath: string;
  secretsPath: string;
  schema?: ConfigSchema;
  validateOnLoad?: boolean;
  watchForChanges?: boolean;
}

export class EncryptedConfig {
  private secretsManager: SecretsManager;
  private config: Record<string, any> = {};
  private schema?: ConfigSchema;
  private environment: string;
  private options: EncryptedConfigOptions;
  private watchers: Array<(key: string, value: any, oldValue: any) => void> = [];

  constructor(options: EncryptedConfigOptions) {
    this.options = options;
    this.environment = options.environment;
    this.schema = options.schema;

    this.secretsManager = new SecretsManager({
      storePath: options.secretsPath,
      masterKeyPath: path.join(options.secretsPath, 'master.key')
    });
  }

  /**
   * Initialize encrypted configuration
   */
  async initialize(masterPassword?: string): Promise<void> {
    try {
      await this.secretsManager.initialize(masterPassword);
      await this.loadConfiguration();

      if (this.options.validateOnLoad && this.schema) {
        this.validateConfiguration();
      }

      logger.info('Encrypted configuration initialized', {
        environment: this.environment,
        configKeys: Object.keys(this.config).length
      });

    } catch (error) {
      logger.error('Failed to initialize encrypted configuration', error as Error);
      throw error;
    }
  }

  /**
   * Get configuration value
   */
  async get<T = any>(key: string, defaultValue?: T): Promise<T> {
    try {
      // Check if value exists in memory cache
      if (this.config.hasOwnProperty(key)) {
        return this.config[key] as T;
      }

      // Check schema for default value
      if (this.schema && this.schema[key] && this.schema[key].default !== undefined) {
        return this.schema[key].default as T;
      }

      // Try to load from secrets (for sensitive values)
      if (this.schema && this.schema[key] && this.schema[key].sensitive) {
        const secretValue = await this.secretsManager.getSecret(this.getSecretKey(key));
        if (secretValue !== null) {
          const parsedValue = this.parseValue(secretValue, this.schema[key].type);
          this.config[key] = parsedValue;
          return parsedValue as T;
        }
      }

      // Return default value if provided
      if (defaultValue !== undefined) {
        return defaultValue;
      }

      // Check if required in schema
      if (this.schema && this.schema[key] && this.schema[key].required) {
        throw new Error(`Required configuration key '${key}' not found`);
      }

      return undefined as T;

    } catch (error) {
      logger.error('Failed to get configuration value', error as Error, { key });
      throw error;
    }
  }

  /**
   * Set configuration value
   */
  async set(key: string, value: any): Promise<void> {
    try {
      // Validate against schema if available
      if (this.schema && this.schema[key]) {
        this.validateValue(key, value, this.schema[key]);
      }

      const oldValue = this.config[key];

      // Store sensitive values in secrets manager
      if (this.schema && this.schema[key] && this.schema[key].sensitive) {
        const secretKey = this.getSecretKey(key);
        const stringValue = this.stringifyValue(value);
        await this.secretsManager.storeSecret(secretKey, stringValue, {
          description: this.schema[key].description,
          tags: ['config', this.environment]
        });
      } else {
        // Store non-sensitive values in memory
        this.config[key] = value;
      }

      // Notify watchers
      this.notifyWatchers(key, value, oldValue);

      logger.debug('Configuration value updated', {
        key,
        sensitive: this.schema?.[key]?.sensitive || false
      });

    } catch (error) {
      logger.error('Failed to set configuration value', error as Error, { key });
      throw error;
    }
  }

  /**
   * Get multiple configuration values
   */
  async getAll(keys?: string[]): Promise<Record<string, any>> {
    try {
      const result: Record<string, any> = {};
      const keysToGet = keys || (this.schema ? Object.keys(this.schema) : Object.keys(this.config));

      for (const key of keysToGet) {
        try {
          result[key] = await this.get(key);
        } catch (error) {
          // Continue with other keys if one fails
          logger.warn('Failed to get configuration key', { key, error: (error as Error).message });
        }
      }

      return result;

    } catch (error) {
      logger.error('Failed to get all configuration values', error as Error);
      throw error;
    }
  }

  /**
   * Update multiple configuration values
   */
  async setMany(values: Record<string, any>): Promise<void> {
    try {
      const updates = Object.entries(values);
      
      for (const [key, value] of updates) {
        await this.set(key, value);
      }

      logger.info('Multiple configuration values updated', {
        keysUpdated: updates.length
      });

    } catch (error) {
      logger.error('Failed to set multiple configuration values', error as Error);
      throw error;
    }
  }

  /**
   * Remove configuration value
   */
  async remove(key: string): Promise<boolean> {
    try {
      let removed = false;

      // Remove from secrets if sensitive
      if (this.schema && this.schema[key] && this.schema[key].sensitive) {
        const secretKey = this.getSecretKey(key);
        removed = await this.secretsManager.deleteSecret(secretKey);
      }

      // Remove from memory
      if (this.config.hasOwnProperty(key)) {
        delete this.config[key];
        removed = true;
      }

      if (removed) {
        this.notifyWatchers(key, undefined, this.config[key]);
        logger.debug('Configuration value removed', { key });
      }

      return removed;

    } catch (error) {
      logger.error('Failed to remove configuration value', error as Error, { key });
      throw error;
    }
  }

  /**
   * Watch for configuration changes
   */
  watch(callback: (key: string, value: any, oldValue: any) => void): void {
    this.watchers.push(callback);
  }

  /**
   * Unwatch configuration changes
   */
  unwatch(callback: (key: string, value: any, oldValue: any) => void): void {
    const index = this.watchers.indexOf(callback);
    if (index > -1) {
      this.watchers.splice(index, 1);
    }
  }

  /**
   * Validate entire configuration against schema
   */
  validateConfiguration(): void {
    if (!this.schema) return;

    const errors: string[] = [];

    for (const [key, definition] of Object.entries(this.schema)) {
      try {
        if (definition.required && !this.config.hasOwnProperty(key)) {
          // Check if it's available as a secret
          if (!definition.sensitive) {
            errors.push(`Required configuration key '${key}' is missing`);
          }
        }

        if (this.config.hasOwnProperty(key)) {
          this.validateValue(key, this.config[key], definition);
        }

      } catch (error) {
        errors.push(`Validation failed for '${key}': ${(error as Error).message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Export configuration (excluding sensitive values)
   */
  async exportConfig(includeSensitive: boolean = false): Promise<Record<string, any>> {
    try {
      const exported: Record<string, any> = {};

      if (this.schema) {
        for (const [key, definition] of Object.entries(this.schema)) {
          if (definition.sensitive && !includeSensitive) {
            exported[key] = '[REDACTED]';
          } else {
            exported[key] = await this.get(key);
          }
        }
      } else {
        // Export all non-sensitive values from memory
        for (const [key, value] of Object.entries(this.config)) {
          exported[key] = value;
        }
      }

      return exported;

    } catch (error) {
      logger.error('Failed to export configuration', error as Error);
      throw error;
    }
  }

  /**
   * Reload configuration from storage
   */
  async reload(): Promise<void> {
    try {
      this.config = {};
      await this.loadConfiguration();

      logger.info('Configuration reloaded', {
        environment: this.environment
      });

    } catch (error) {
      logger.error('Failed to reload configuration', error as Error);
      throw error;
    }
  }

  /**
   * Get configuration schema
   */
  getSchema(): ConfigSchema | undefined {
    return this.schema;
  }

  /**
   * Update configuration schema
   */
  updateSchema(schema: ConfigSchema): void {
    this.schema = schema;
    
    if (this.options.validateOnLoad) {
      this.validateConfiguration();
    }

    logger.info('Configuration schema updated', {
      keys: Object.keys(schema).length
    });
  }

  /**
   * Check if configuration has a specific key
   */
  async has(key: string): Promise<boolean> {
    try {
      const value = await this.get(key);
      return value !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Get configuration statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    sensitiveKeys: number;
    memoryKeys: number;
    secretKeys: number;
    environment: string;
  }> {
    const sensitiveKeys = this.schema 
      ? Object.values(this.schema).filter(def => def.sensitive).length 
      : 0;

    const secrets = await this.secretsManager.listSecrets(['config', this.environment]);
    const secretKeys = secrets.filter(secret => 
      secret.name.startsWith(`config_${this.environment}_`)
    ).length;

    return {
      totalKeys: this.schema ? Object.keys(this.schema).length : Object.keys(this.config).length,
      sensitiveKeys,
      memoryKeys: Object.keys(this.config).length,
      secretKeys,
      environment: this.environment
    };
  }

  /**
   * Load configuration from various sources
   */
  private async loadConfiguration(): Promise<void> {
    // Load from environment variables
    await this.loadFromEnvironment();

    // Load from file if specified
    if (this.options.configPath) {
      await this.loadFromFile();
    }

    // Load sensitive values from secrets manager
    await this.loadSensitiveValues();
  }

  /**
   * Load configuration from environment variables
   */
  private async loadFromEnvironment(): Promise<void> {
    if (!this.schema) return;

    for (const [key, definition] of Object.entries(this.schema)) {
      const envKey = this.getEnvironmentKey(key);
      const envValue = process.env[envKey];

      if (envValue !== undefined) {
        try {
          const parsedValue = this.parseValue(envValue, definition.type);
          
          if (definition.sensitive) {
            // Store sensitive env values in secrets
            await this.secretsManager.storeSecret(this.getSecretKey(key), envValue, {
              description: `Environment variable: ${envKey}`,
              tags: ['config', 'env', this.environment]
            });
          } else {
            this.config[key] = parsedValue;
          }
        } catch (error) {
          logger.warn('Failed to parse environment variable', {
            key: envKey,
            error: (error as Error).message
          });
        }
      }
    }
  }

  /**
   * Load configuration from file
   */
  private async loadFromFile(): Promise<void> {
    try {
      // Implementation would load from YAML/JSON file
      // For now, we'll skip file loading in this example
      logger.debug('File configuration loading not implemented');
    } catch (error) {
      logger.error('Failed to load configuration from file', error as Error);
    }
  }

  /**
   * Load sensitive values from secrets manager
   */
  private async loadSensitiveValues(): Promise<void> {
    if (!this.schema) return;

    for (const [key, definition] of Object.entries(this.schema)) {
      if (definition.sensitive) {
        try {
          const secretValue = await this.secretsManager.getSecret(this.getSecretKey(key));
          if (secretValue !== null) {
            const parsedValue = this.parseValue(secretValue, definition.type);
            this.config[key] = parsedValue;
          }
        } catch (error) {
          logger.debug('Failed to load sensitive configuration value', {
            key,
            error: (error as Error).message
          });
        }
      }
    }
  }

  /**
   * Generate secret key for configuration
   */
  private getSecretKey(configKey: string): string {
    return `config_${this.environment}_${configKey}`;
  }

  /**
   * Generate environment variable key
   */
  private getEnvironmentKey(configKey: string): string {
    return `CODECRUCIBLE_${configKey.toUpperCase()}`;
  }

  /**
   * Validate a configuration value against schema definition
   */
  private validateValue(key: string, value: any, definition: any): void {
    // Type validation
    if (!this.isCorrectType(value, definition.type)) {
      throw new Error(`Expected ${definition.type}, got ${typeof value}`);
    }

    // Custom validation
    if (definition.validation && !definition.validation(value)) {
      throw new Error('Custom validation failed');
    }
  }

  /**
   * Check if value matches expected type
   */
  private isCorrectType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Parse string value to correct type
   */
  private parseValue(value: string, type: string): any {
    switch (type) {
      case 'string':
        return value;
      case 'number':
        const num = Number(value);
        if (isNaN(num)) throw new Error(`Cannot parse '${value}' as number`);
        return num;
      case 'boolean':
        return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
      case 'object':
      case 'array':
        try {
          return JSON.parse(value);
        } catch {
          throw new Error(`Cannot parse '${value}' as JSON`);
        }
      default:
        return value;
    }
  }

  /**
   * Convert value to string for storage
   */
  private stringifyValue(value: any): string {
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value);
  }

  /**
   * Notify watchers of configuration changes
   */
  private notifyWatchers(key: string, value: any, oldValue: any): void {
    for (const watcher of this.watchers) {
      try {
        watcher(key, value, oldValue);
      } catch (error) {
        logger.error('Configuration watcher error', error as Error, { key });
      }
    }
  }

  /**
   * Clean up resources
   */
  async stop(): Promise<void> {
    await this.secretsManager.stop();
    this.watchers = [];
    this.config = {};
    
    logger.info('Encrypted configuration stopped');
  }
}