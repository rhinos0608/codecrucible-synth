/**
 * Unified Configuration Service - Consolidates all configuration functionality
 * Combines features from:
 * - core/config/configuration-manager.ts (core config management)
 * - core/config/enterprise-config-manager.ts (enterprise features)
 * - config/config-manager.ts (app config management)
 *
 * Provides:
 * - Centralized configuration management with validation
 * - Enterprise security and compliance features
 * - Environment-based overrides and encryption
 * - Agent, voice, MCP, and LLM provider configurations
 * - Configuration persistence and hot-reloading
 * - Audit logging and compliance tracking
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import YAML from 'yaml';
import { logger } from '../logger.js';
import { SecurityUtils } from '../security-utils.js';

// Combined interfaces from all config managers
export interface LLMProviderConfig {
  provider: 'openai' | 'google' | 'anthropic' | 'ollama' | 'lm-studio' | 'huggingface';
  apiKey?: string;
  endpoint?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  enabled: boolean;
}

export interface AgentConfig {
  enabled: boolean;
  mode: 'fast' | 'balanced' | 'thorough' | 'auto';
  maxConcurrency: number;
  enableCaching: boolean;
  enableMetrics: boolean;
  enableSecurity: boolean;
}

export interface EnterpriseSecurityConfig {
  enableAuditLogging: boolean;
  enableThreatDetection: boolean;
  sessionTimeout: number;
  maxLoginAttempts: number;
  enableSandbox: boolean;
  maxInputLength: number;
  allowedCommands: string[];
}

export interface EnterpriseMonitoringConfig {
  enableMetrics: boolean;
  enableAlerts: boolean;
  performanceThreshold: number;
  healthCheckInterval: number;
}

export interface EnterpriseBackupConfig {
  enabled: boolean;
  schedule: string;
  retentionDays: number;
  compressionEnabled: boolean;
}

export interface EnterpriseComplianceConfig {
  enableSOX: boolean;
  enableGDPR: boolean;
  enableHIPAA: boolean;
  auditRetentionDays: number;
}

export interface PerformanceConfig {
  fastModeMaxTokens: number;
  timeoutMs: number;
  maxConcurrentRequests: number;
  responseCache: {
    enabled: boolean;
    maxAge: number;
    maxSize: number;
  };
  voiceParallelism: {
    maxConcurrent: number;
    batchSize: number;
  };
  contextManagement: {
    maxContextLength: number;
    compressionThreshold: number;
    retentionStrategy: string;
  };
}

export interface StreamingConfig {
  chunkSize: number;
  bufferSize: number;
  enableBackpressure: boolean;
  timeout: number;
  encoding: string;
}

export interface MCPServerConfig {
  filesystem: {
    enabled: boolean;
    restrictedPaths: string[];
    allowedPaths: string[];
  };
  git: {
    enabled: boolean;
    autoCommitMessages: boolean;
    safeModeEnabled: boolean;
  };
  terminal: {
    enabled: boolean;
    allowedCommands: string[];
    blockedCommands: string[];
  };
  packageManager: {
    enabled: boolean;
    autoInstall: boolean;
    securityScan: boolean;
  };
  smithery: {
    enabled: boolean;
    apiKey?: string;
    profile?: string;
    baseUrl?: string;
  };
}

export interface UnifiedAppConfig {
  // Core model configuration
  model: {
    endpoint: string;
    name: string;
    timeout: number;
    maxTokens: number;
    temperature: number;
  };

  // LLM providers configuration
  llmProviders: {
    default: string;
    providers: Record<string, LLMProviderConfig>;
  };

  // Execution modes and fallback chains
  executionMode: 'fast' | 'auto' | 'quality';
  fallbackChain: string[];

  // Agent configuration
  agent: AgentConfig;

  // Voice system configuration
  voices: {
    default: string[];
    available: string[];
    parallel: boolean;
    maxConcurrent: number;
  };

  // Performance configuration
  performance: PerformanceConfig;

  // Streaming configuration
  streaming: StreamingConfig;

  // Enterprise security configuration
  security: EnterpriseSecurityConfig;

  // Enterprise monitoring configuration
  monitoring: EnterpriseMonitoringConfig;

  // Enterprise backup configuration
  backup: EnterpriseBackupConfig;

  // Enterprise compliance configuration
  compliance: EnterpriseComplianceConfig;

  // MCP server configuration
  mcp: {
    servers: MCPServerConfig;
  };

  // Database configuration
  database: {
    path: string;
    inMemory: boolean;
    enableWAL: boolean;
    backupEnabled: boolean;
    backupInterval: number;
  };

  // Terminal configuration
  terminal: {
    shell: string;
    prompt: string;
    historySize: number;
    colorOutput: boolean;
  };

  // VS Code configuration
  vscode: {
    autoActivate: boolean;
    inlineGeneration: boolean;
    showVoicePanel: boolean;
  };

  // Logging configuration
  logging: {
    level: string;
    toFile: boolean;
    maxFileSize: string;
    maxFiles: number;
  };

  // Safety configuration
  safety: {
    commandValidation: boolean;
    fileSystemRestrictions: boolean;
    requireConsent: string[];
  };
}

export interface ConfigurationValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: UnifiedAppConfig;
}

export interface ConfigOptions {
  validateOnLoad?: boolean;
  encryptSensitive?: boolean;
  enableHotReload?: boolean;
  auditChanges?: boolean;
}

/**
 * Unified Configuration Service - Main Implementation
 */
export class UnifiedConfigService {
  private static instance: UnifiedConfigService | null = null;
  private config: UnifiedAppConfig | null = null;
  private configPath: string;
  private defaultConfigPath: string;
  private options: ConfigOptions;
  private watchers: Map<string, any> = new Map();
  private auditLog: Array<{ timestamp: number; action: string; key: string; value: any }> = [];

  constructor(options: ConfigOptions = {}) {
    this.configPath = join(homedir(), '.codecrucible', 'config.yaml');
    this.defaultConfigPath = join(process.cwd(), 'config', 'default.yaml');
    this.options = {
      validateOnLoad: true,
      encryptSensitive: true,
      enableHotReload: false,
      auditChanges: true,
      ...options,
    };
  }

  static async getInstance(options?: ConfigOptions): Promise<UnifiedConfigService> {
    if (!UnifiedConfigService.instance) {
      const instance = new UnifiedConfigService(options);
      await instance.loadConfiguration();
      UnifiedConfigService.instance = instance;
    }
    return UnifiedConfigService.instance;
  }

  /**
   * Load configuration from multiple sources with validation
   */
  async loadConfiguration(): Promise<UnifiedAppConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      // Initialize encryption if needed
      if (this.options.encryptSensitive) {
        await SecurityUtils.initializeEncryption();
      }

      // Try loading user config first
      let configLoaded = false;
      try {
        await access(this.configPath);
        const userConfigContent = await readFile(this.configPath, 'utf8');
        this.config = YAML.parse(userConfigContent);
        
        if (this.options.encryptSensitive) {
          this.decryptSensitiveFields(this.config as UnifiedAppConfig);
        }

        logger.info('Loaded user configuration', { path: this.configPath });
        configLoaded = true;
      } catch (error) {
        logger.debug('User config not found, trying default config');
      }

      // Fall back to default config
      if (!configLoaded) {
        try {
          const defaultConfigContent = await readFile(this.defaultConfigPath, 'utf8');
          this.config = YAML.parse(defaultConfigContent);
          logger.info('Loaded default configuration', { path: this.defaultConfigPath });
          await this.saveUserConfig();
        } catch (defaultError) {
          // Use hardcoded defaults as last resort
          this.config = this.getHardcodedDefaults();
          logger.warn('Using hardcoded configuration - no config files found');
          await this.saveUserConfig();
        }
      }

      // Apply environment overrides
      const envOverrides = this.getEnvironmentOverrides();
      if (Object.keys(envOverrides).length > 0) {
        this.config = this.mergeConfigurationWithDefaults(envOverrides, this.config || undefined);
      }

      // Validate configuration if enabled
      if (this.options.validateOnLoad) {
        const validation = this.validateConfiguration(this.config || {} as any);
        if (!validation.isValid) {
          logger.error('Configuration validation failed', { errors: validation.errors });
          // Fall back to defaults if validation fails
          this.config = this.getHardcodedDefaults();
        } else if (validation.warnings.length > 0) {
          logger.warn('Configuration loaded with warnings', { warnings: validation.warnings });
        }
      }

      // Setup hot reloading if enabled
      if (this.options.enableHotReload) {
        this.setupHotReloading();
      }

      if (!this.config) {
        throw new Error('Failed to load configuration');
      }

      return this.config;
    } catch (error) {
      logger.error('Failed to load configuration', error as Error);
      throw error;
    }
  }

  /**
   * Get configuration value with dot notation support
   */
  async get<T = any>(key: string): Promise<T | undefined> {
    if (!this.config) {
      await this.loadConfiguration();
    }

    const keys = key.split('.');
    let current: any = this.config;

    for (const k of keys) {
      if (current === null || current === undefined || typeof current !== 'object' || current[k] === undefined) {
        return undefined;
      }
      current = current[k];
    }

    return current as T;
  }

  /**
   * Set configuration value with dot notation support
   */
  async set(key: string, value: any): Promise<void> {
    if (!this.config) {
      await this.loadConfiguration();
    }

    const keys = key.split('.');
    let current: any = this.config;

    // Navigate to parent object
    for (let i = 0; i < keys.length - 1; i++) {
      const currentKey = keys[i];
      if (currentKey && !current[currentKey]) {
        current[currentKey] = {};
      }
      if (currentKey) {
        current = current[currentKey];
      }
    }

    // Set the value
    const finalKey = keys[keys.length - 1];
    if (finalKey) {
      const oldValue = current[finalKey];
      current[finalKey] = value;

      // Audit the change if enabled
      if (this.options.auditChanges) {
        this.auditLog.push({
          timestamp: Date.now(),
          action: 'set',
          key,
          value: this.sanitizeValueForLogging(value),
        });
      }

      await this.saveUserConfig();
      logger.info(`Configuration updated: ${key}`, { 
        oldValue: this.sanitizeValueForLogging(oldValue),
        newValue: this.sanitizeValueForLogging(value)
      });
    }
  }

  /**
   * Update entire configuration section
   */
  async updateSection<T extends keyof UnifiedAppConfig>(
    section: T,
    newConfig: Partial<UnifiedAppConfig[T]>
  ): Promise<void> {
    if (!this.config) {
      await this.loadConfiguration();
    }

    const currentSection = this.config?.[section] as any;
    if (this.config) {
      this.config[section] = { ...currentSection, ...newConfig };
    }

    if (this.options.auditChanges) {
      this.auditLog.push({
        timestamp: Date.now(),
        action: 'updateSection',
        key: section as string,
        value: this.sanitizeValueForLogging(newConfig),
      });
    }

    await this.saveUserConfig();
    logger.info(`Configuration section updated: ${section as string}`);
  }

  /**
   * Validate configuration with comprehensive checks
   */
  validateConfiguration(config: Partial<UnifiedAppConfig>): ConfigurationValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate LLM providers
    if (config.llmProviders) {
      const providers = config.llmProviders.providers;
      if (!providers || Object.keys(providers).length === 0) {
        errors.push('At least one LLM provider must be configured');
      } else {
        Object.entries(providers).forEach(([name, provider]) => {
          if (!provider.provider || !provider.model) {
            errors.push(`Provider ${name} missing required fields: provider, model`);
          }
          if (provider.enabled && !provider.endpoint && provider.provider !== 'ollama') {
            warnings.push(`Provider ${name} is enabled but missing endpoint`);
          }
        });
      }

      if (config.llmProviders.default && !providers?.[config.llmProviders.default]) {
        errors.push(`Default provider '${config.llmProviders.default}' not found in providers`);
      }
    }

    // Validate execution mode
    if (config.executionMode && !['fast', 'auto', 'quality'].includes(config.executionMode)) {
      errors.push('ExecutionMode must be one of: fast, auto, quality');
    }

    // Validate performance thresholds
    if (config.performance) {
      const perf = config.performance;
      if (perf.timeoutMs && (perf.timeoutMs < 5000 || perf.timeoutMs > 600000)) {
        warnings.push('TimeoutMs should be between 5 seconds and 10 minutes');
      }
      if (perf.maxConcurrentRequests && (perf.maxConcurrentRequests < 1 || perf.maxConcurrentRequests > 10)) {
        warnings.push('MaxConcurrentRequests should be between 1 and 10');
      }
    }

    // Validate security settings
    if (config.security) {
      const sec = config.security;
      if (sec.maxInputLength && sec.maxInputLength > 100000) {
        warnings.push('MaxInputLength over 100KB may cause performance issues');
      }
      if (sec.allowedCommands && sec.allowedCommands.includes('rm')) {
        errors.push('Command "rm" is not allowed for security reasons');
      }
      if (sec.sessionTimeout && sec.sessionTimeout < 300000) {
        warnings.push('Session timeout should be at least 5 minutes for security');
      }
    }

    // Validate streaming configuration
    if (config.streaming) {
      const stream = config.streaming;
      if (stream.chunkSize && (stream.chunkSize < 1 || stream.chunkSize > 1000)) {
        warnings.push('Streaming chunkSize should be between 1 and 1000');
      }
      if (stream.timeout && stream.timeout < 1000) {
        warnings.push('Streaming timeout should be at least 1 second');
      }
    }

    // Validate voice configuration
    if (config.voices) {
      const voices = config.voices;
      if (voices.maxConcurrent && voices.maxConcurrent > 10) {
        warnings.push('Too many concurrent voices may impact performance');
      }
      if (voices.default && voices.available) {
        voices.default.forEach(voice => {
          if (!voices.available.includes(voice)) {
            errors.push(`Default voice '${voice}' not found in available voices`);
          }
        });
      }
    }

    // Validate MCP configuration
    if (config.mcp?.servers) {
      const mcp = config.mcp.servers;
      if (mcp.terminal?.enabled && (!mcp.terminal.allowedCommands || mcp.terminal.allowedCommands.length === 0)) {
        warnings.push('Terminal MCP server enabled but no allowed commands specified');
      }
      if (mcp.smithery?.enabled && !mcp.smithery.apiKey) {
        warnings.push('Smithery MCP server enabled but no API key configured');
      }
    }

    // Validate compliance settings
    if (config.compliance) {
      const comp = config.compliance;
      if (comp.auditRetentionDays && comp.auditRetentionDays < 30) {
        warnings.push('Audit retention should be at least 30 days for compliance');
      }
      if ((comp.enableSOX || comp.enableGDPR || comp.enableHIPAA) && !config.security?.enableAuditLogging) {
        errors.push('Compliance features require audit logging to be enabled');
      }
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      logger.warn('Configuration validation failed', { errors, warnings });
    } else if (warnings.length > 0) {
      logger.info('Configuration validation passed with warnings', { warnings });
    }

    return {
      isValid,
      errors,
      warnings,
      sanitized: isValid ? (config as UnifiedAppConfig) : undefined,
    };
  }

  /**
   * Merge configuration with defaults using deep merge
   */
  mergeConfigurationWithDefaults(
    config: Partial<UnifiedAppConfig>,
    baseConfig?: UnifiedAppConfig
  ): UnifiedAppConfig {
    const base = baseConfig || this.getHardcodedDefaults();

    // Deep merge configuration
    const merged: UnifiedAppConfig = {
      ...base,
      ...config,
      // Deep merge nested objects
      model: { ...base.model, ...(config.model || {}) },
      llmProviders: {
        ...base.llmProviders,
        ...(config.llmProviders || {}),
        providers: {
          ...base.llmProviders.providers,
          ...(config.llmProviders?.providers || {}),
        },
      },
      agent: { ...base.agent, ...(config.agent || {}) },
      voices: { ...base.voices, ...(config.voices || {}) },
      performance: { 
        ...base.performance, 
        ...(config.performance || {}),
        responseCache: { ...base.performance.responseCache, ...(config.performance?.responseCache || {}) },
        voiceParallelism: { ...base.performance.voiceParallelism, ...(config.performance?.voiceParallelism || {}) },
        contextManagement: { ...base.performance.contextManagement, ...(config.performance?.contextManagement || {}) },
      },
      streaming: { ...base.streaming, ...(config.streaming || {}) },
      security: { ...base.security, ...(config.security || {}) },
      monitoring: { ...base.monitoring, ...(config.monitoring || {}) },
      backup: { ...base.backup, ...(config.backup || {}) },
      compliance: { ...base.compliance, ...(config.compliance || {}) },
      mcp: {
        ...base.mcp,
        ...(config.mcp || {}),
        servers: { ...base.mcp.servers, ...(config.mcp?.servers || {}) },
      },
      database: { ...base.database, ...(config.database || {}) },
      terminal: { ...base.terminal, ...(config.terminal || {}) },
      vscode: { ...base.vscode, ...(config.vscode || {}) },
      logging: { ...base.logging, ...(config.logging || {}) },
      safety: { ...base.safety, ...(config.safety || {}) },
    };

    return merged;
  }

  /**
   * Get environment-specific configuration overrides
   */
  getEnvironmentOverrides(): Partial<UnifiedAppConfig> {
    const overrides: Partial<UnifiedAppConfig> = {};

    // Performance overrides
    if (process.env.AI_TIMEOUT_MS) {
      const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS, 10);
      if (!isNaN(timeoutMs)) {
        overrides.performance = {
          ...this.getHardcodedDefaults().performance,
          timeoutMs,
        };
      }
    }

    if (process.env.AI_MAX_CONCURRENT) {
      const maxConcurrent = parseInt(process.env.AI_MAX_CONCURRENT, 10);
      if (!isNaN(maxConcurrent)) {
        overrides.performance = {
          ...this.getHardcodedDefaults().performance,
          ...(overrides.performance || {}),
          maxConcurrentRequests: maxConcurrent,
        };
      }
    }

    // Execution mode override
    if (process.env.AI_EXECUTION_MODE) {
      const mode = process.env.AI_EXECUTION_MODE;
      if (['fast', 'auto', 'quality'].includes(mode)) {
        overrides.executionMode = mode as 'fast' | 'auto' | 'quality';
      }
    }

    // Security overrides
    if (process.env.ENABLE_SANDBOX !== undefined) {
      overrides.security = {
        ...this.getHardcodedDefaults().security,
        enableSandbox: process.env.ENABLE_SANDBOX.toLowerCase() === 'true',
      };
    }

    // Logging overrides
    if (process.env.LOG_LEVEL) {
      overrides.logging = {
        ...this.getHardcodedDefaults().logging,
        level: process.env.LOG_LEVEL,
      };
    }

    if (Object.keys(overrides).length > 0) {
      logger.debug('Applied environment overrides', { overrides: this.sanitizeConfigForLogging(overrides) });
    }

    return overrides;
  }

  /**
   * Get all configuration
   */
  getAll(): UnifiedAppConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return { ...this.config };
  }

  /**
   * Reset configuration to defaults
   */
  async reset(): Promise<void> {
    this.config = this.getHardcodedDefaults();
    
    if (this.options.auditChanges) {
      this.auditLog.push({
        timestamp: Date.now(),
        action: 'reset',
        key: 'all',
        value: 'reset_to_defaults',
      });
    }

    await this.saveUserConfig();
    logger.info('Configuration reset to defaults');
  }

  /**
   * Enterprise feature methods
   */
  isFeatureEnabled(feature: string): boolean {
    if (!this.config) return false;

    switch (feature) {
      case 'audit_logging':
        return this.config.security.enableAuditLogging;
      case 'threat_detection':
        return this.config.security.enableThreatDetection;
      case 'metrics':
        return this.config.monitoring.enableMetrics;
      case 'alerts':
        return this.config.monitoring.enableAlerts;
      case 'backup':
        return this.config.backup.enabled;
      case 'sox_compliance':
        return this.config.compliance.enableSOX;
      case 'gdpr_compliance':
        return this.config.compliance.enableGDPR;
      case 'hipaa_compliance':
        return this.config.compliance.enableHIPAA;
      case 'caching':
        return this.config.agent.enableCaching;
      case 'security':
        return this.config.agent.enableSecurity;
      case 'sandbox':
        return this.config.security.enableSandbox;
      default:
        return false;
    }
  }

  /**
   * Get audit log for compliance
   */
  getAuditLog(): Array<{ timestamp: number; action: string; key: string; value: any }> {
    return [...this.auditLog];
  }

  /**
   * Private utility methods
   */
  private async saveUserConfig(): Promise<void> {
    try {
      if (!this.config) return;

      const configDir = dirname(this.configPath);
      await mkdir(configDir, { recursive: true });

      // Create a copy with encrypted sensitive fields
      const configToSave = JSON.parse(JSON.stringify(this.config));
      if (this.options.encryptSensitive) {
        this.encryptSensitiveFields(configToSave);
      }

      const yamlContent = YAML.stringify(configToSave);
      await writeFile(this.configPath, yamlContent, 'utf8');

      logger.debug('Configuration saved', { path: this.configPath });
    } catch (error) {
      logger.error('Failed to save configuration:', error);
      throw error;
    }
  }

  private encryptSensitiveFields(config: UnifiedAppConfig): void {
    const sensitiveFields = [
      'mcp.servers.smithery.apiKey',
      'llmProviders.providers.*.apiKey',
      'security.encryptionKey',
      'database.password',
    ];

    for (const fieldPath of sensitiveFields) {
      if (fieldPath.includes('*')) {
        // Handle wildcard paths (like providers.*.apiKey)
        const [basePath, , field] = fieldPath.split('.');
        const baseObj = this.getNestedValue(config, basePath);
        if (baseObj && typeof baseObj === 'object') {
          for (const [key, value] of Object.entries(baseObj)) {
            if (value && typeof value === 'object' && field in value) {
              const fieldValue = (value as any)[field];
              if (fieldValue && typeof fieldValue === 'string' && !SecurityUtils.isEncrypted(fieldValue)) {
                try {
                  (value as any)[field] = SecurityUtils.encrypt(fieldValue);
                } catch (error) {
                  logger.warn(`Failed to encrypt field ${basePath}.${key}.${field}:`, error);
                }
              }
            }
          }
        }
      } else {
        // Handle direct paths
        const value = this.getNestedValue(config, fieldPath);
        if (value && typeof value === 'string' && !SecurityUtils.isEncrypted(value)) {
          try {
            const encrypted = SecurityUtils.encrypt(value);
            this.setNestedValue(config, fieldPath, encrypted);
          } catch (error) {
            logger.warn(`Failed to encrypt field ${fieldPath}:`, error);
          }
        }
      }
    }
  }

  private decryptSensitiveFields(config: UnifiedAppConfig): void {
    const sensitiveFields = [
      'mcp.servers.smithery.apiKey',
      'llmProviders.providers.*.apiKey',
      'security.encryptionKey',
      'database.password',
    ];

    for (const fieldPath of sensitiveFields) {
      if (fieldPath.includes('*')) {
        // Handle wildcard paths
        const [basePath, , field] = fieldPath.split('.');
        const baseObj = this.getNestedValue(config, basePath);
        if (baseObj && typeof baseObj === 'object') {
          for (const [key, value] of Object.entries(baseObj)) {
            if (value && typeof value === 'object' && field in value) {
              const fieldValue = (value as any)[field];
              if (fieldValue && typeof fieldValue === 'string' && SecurityUtils.isEncrypted(fieldValue)) {
                try {
                  (value as any)[field] = SecurityUtils.decrypt(fieldValue);
                } catch (error) {
                  logger.warn(`Failed to decrypt field ${basePath}.${key}.${field}:`, error);
                }
              }
            }
          }
        }
      } else {
        // Handle direct paths
        const value = this.getNestedValue(config, fieldPath);
        if (value && typeof value === 'string' && SecurityUtils.isEncrypted(value)) {
          try {
            const decrypted = SecurityUtils.decrypt(value);
            this.setNestedValue(config, fieldPath, decrypted);
          } catch (error) {
            logger.warn(`Failed to decrypt field ${fieldPath}:`, error);
          }
        }
      }
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (current === null || current === undefined) {
        return undefined;
      }
      return current[key];
    }, obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop();
    if (!lastKey) return;

    let current = obj;
    for (const key of keys) {
      if (current[key] === undefined || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    current[lastKey] = value;
  }

  private sanitizeConfigForLogging(config: any): any {
    const sanitized = JSON.parse(JSON.stringify(config));
    
    // Remove or mask sensitive data
    const sensitiveKeys = ['apiKey', 'password', 'secret', 'token', 'key'];
    
    const maskSensitive = (obj: any, path = ''): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (sensitiveKeys.some(sensitiveKey => key.toLowerCase().includes(sensitiveKey))) {
          obj[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          maskSensitive(value, currentPath);
        }
      }
      
      return obj;
    };

    return maskSensitive(sanitized);
  }

  private sanitizeValueForLogging(value: any): any {
    if (typeof value === 'string' && (value.includes('key') || value.includes('secret') || value.includes('token'))) {
      return '[REDACTED]';
    }
    return value;
  }

  private setupHotReloading(): void {
    // Implementation would watch config files for changes
    logger.debug('Hot reloading setup (placeholder)');
  }

  private getHardcodedDefaults(): UnifiedAppConfig {
    return {
      model: {
        endpoint: 'http://localhost:11434',
        name: '',
        timeout: 180000,
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
            timeout: 110000,
            enabled: true,
          },
          'lm-studio-local': {
            provider: 'lm-studio',
            endpoint: 'http://localhost:1234',
            model: 'auto',
            maxTokens: 4096,
            temperature: 0.7,
            timeout: 110000,
            enabled: false,
          },
        },
      },
      executionMode: 'auto',
      fallbackChain: ['ollama', 'lm-studio', 'huggingface'],
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
          'explorer', 'maintainer', 'analyzer', 'developer', 
          'implementor', 'security', 'architect', 'designer', 'optimizer'
        ],
        parallel: true,
        maxConcurrent: 3,
      },
      performance: {
        fastModeMaxTokens: 1000,
        timeoutMs: 180000,
        maxConcurrentRequests: 3,
        responseCache: {
          enabled: true,
          maxAge: 3600000,
          maxSize: 100,
        },
        voiceParallelism: {
          maxConcurrent: 4,
          batchSize: 3,
        },
        contextManagement: {
          maxContextLength: 16384,
          compressionThreshold: 8192,
          retentionStrategy: 'sliding-window',
        },
      },
      streaming: {
        chunkSize: 50,
        bufferSize: 1024,
        enableBackpressure: true,
        timeout: 30000,
        encoding: 'utf8',
      },
      security: {
        enableAuditLogging: true,
        enableThreatDetection: true,
        sessionTimeout: 3600000,
        maxLoginAttempts: 3,
        enableSandbox: true,
        maxInputLength: 50000,
        allowedCommands: ['npm', 'node', 'git'],
      },
      monitoring: {
        enableMetrics: true,
        enableAlerts: true,
        performanceThreshold: 5000,
        healthCheckInterval: 30000,
      },
      backup: {
        enabled: true,
        schedule: '0 2 * * *',
        retentionDays: 30,
        compressionEnabled: true,
      },
      compliance: {
        enableSOX: false,
        enableGDPR: true,
        enableHIPAA: false,
        auditRetentionDays: 365,
      },
      mcp: {
        servers: {
          filesystem: {
            enabled: true,
            restrictedPaths: ['/etc', '/sys', '/proc'],
            allowedPaths: ['./'],
          },
          git: {
            enabled: true,
            autoCommitMessages: true,
            safeModeEnabled: true,
          },
          terminal: {
            enabled: true,
            allowedCommands: ['ls', 'pwd', 'echo'],
            blockedCommands: ['rm', 'sudo'],
          },
          packageManager: {
            enabled: true,
            autoInstall: false,
            securityScan: true,
          },
          smithery: {
            enabled: true,
            apiKey: '',
            profile: 'default',
            baseUrl: 'https://api.smithery.ai',
          },
        },
      },
      database: {
        path: 'codecrucible.db',
        inMemory: false,
        enableWAL: true,
        backupEnabled: true,
        backupInterval: 86400000,
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
      logging: {
        level: 'info',
        toFile: true,
        maxFileSize: '10MB',
        maxFiles: 5,
      },
      safety: {
        commandValidation: true,
        fileSystemRestrictions: true,
        requireConsent: ['delete', 'execute'],
      },
    };
  }
}

// Global instance
export const unifiedConfigService = UnifiedConfigService.getInstance();