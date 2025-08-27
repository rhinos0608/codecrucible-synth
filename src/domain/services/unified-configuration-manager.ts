/**
 * Unified Configuration Manager
 * 
 * Single authoritative configuration system that replaces all existing managers:
 * - /config/config-manager.ts (YAML-based)
 * - /core/config/configuration-manager.ts (Validation-focused)  
 * - /infrastructure/config/config-types.ts (Type definitions)
 *
 * Implements configuration hierarchy: defaults → file → environment → CLI args
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import YAML from 'yaml';
import { EventEmitter } from 'events';
import {
  UnifiedConfiguration,
  ConfigurationValidation,
  ConfigurationError,
  ConfigurationWarning,
  ConfigurationSource,
  ConfigurationSourceInfo,
  AppConfiguration,
  ModelConfiguration,
  SecurityConfiguration,
  PerformanceConfiguration,
  VoiceConfiguration,
  ToolConfiguration,
  InfrastructureConfiguration,
} from '../interfaces/configuration.js';
import { IEventBus } from '../interfaces/event-bus.js';
import { ILogger } from '../interfaces/logger.js';

export interface IUnifiedConfigurationManager {
  /**
   * Initialize the configuration manager
   */
  initialize(): Promise<void>;
  
  /**
   * Load configuration with full hierarchy resolution
   */
  loadConfiguration(): Promise<UnifiedConfiguration>;
  
  /**
   * Get current configuration
   */
  getConfiguration(): UnifiedConfiguration;
  
  /**
   * Update configuration at runtime
   */
  updateConfiguration(updates: Partial<UnifiedConfiguration>, source: ConfigurationSource): Promise<void>;
  
  /**
   * Validate configuration
   */
  validateConfiguration(config: Partial<UnifiedConfiguration>): ConfigurationValidation;
  
  /**
   * Save configuration to file
   */
  saveConfiguration(filePath?: string): Promise<void>;
  
  /**
   * Reset to defaults
   */
  resetToDefaults(): Promise<void>;
  
  /**
   * Watch for configuration changes
   */
  watchForChanges(enabled: boolean): void;
}

export class UnifiedConfigurationManager extends EventEmitter implements IUnifiedConfigurationManager {
  private currentConfig!: UnifiedConfiguration;
  private configFilePath: string;
  private eventBus?: IEventBus;
  private isInitialized = false;
  private sourcePriorities = new Map<ConfigurationSource, number>([
    ['default', 0],
    ['file', 10],
    ['environment', 20],
    ['cli-args', 30],
    ['runtime', 40],
  ]);
  private configSources = new Map<string, ConfigurationSourceInfo>();
  private isWatching = false;

  constructor(
    private logger: ILogger,
    configFilePath?: string, 
    eventBus?: IEventBus
  ) {
    super();
    this.logger.info('UnifiedConfigurationManager initialized');
    this.configFilePath = configFilePath || join(homedir(), '.codecrucible', 'config.yaml');
    this.eventBus = eventBus;
  }

  async initialize(): Promise<void> {
    try {
      // Ensure config directory exists
      const configDir = dirname(this.configFilePath);
      try {
        await access(configDir);
      } catch {
        await mkdir(configDir, { recursive: true });
      }

      // Load configuration
      this.currentConfig = await this.loadConfiguration();
      
      this.isInitialized = true;
      this.emit('initialized', this.currentConfig);
      
      if (this.eventBus) {
        this.eventBus.emit('system:initialize', { component: 'UnifiedConfigurationManager' });
      }
      
      this.logger.info('UnifiedConfigurationManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize UnifiedConfigurationManager:', error);
      throw error;
    }
  }

  async loadConfiguration(): Promise<UnifiedConfiguration> {
    try {
      // Start with defaults
      let config = this.getDefaultConfiguration();
      this.recordConfigSource('app', 'default');

      // Layer on file configuration
      config = this.mergeConfigurations(config, await this.loadFromFile());
      this.recordConfigSource('file', 'file', this.configFilePath);

      // Layer on environment variables
      config = this.mergeConfigurations(config, this.loadFromEnvironment());
      this.recordConfigSource('environment', 'environment');

      // Layer on CLI arguments
      config = this.mergeConfigurations(config, this.loadFromCliArgs());
      this.recordConfigSource('cli-args', 'cli-args');

      // Validate final configuration
      const validation = this.validateConfiguration(config);
      if (!validation.isValid) {
        this.logger.warn('Configuration validation failed:', validation.errors);
        // Use sanitized version if available
        if (validation.sanitized) {
          config = validation.sanitized;
        }
      }

      if (validation.warnings.length > 0) {
        this.logger.warn('Configuration warnings:', validation.warnings);
      }

      return config;
    } catch (error) {
      this.logger.error('Failed to load configuration:', error);
      // Fall back to defaults on error
      return this.getDefaultConfiguration();
    }
  }

  getConfiguration(): UnifiedConfiguration {
    if (!this.isInitialized) {
      throw new Error('Configuration manager not initialized');
    }
    return this.currentConfig;
  }

  async updateConfiguration(updates: Partial<UnifiedConfiguration>, source: ConfigurationSource): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Configuration manager not initialized');
    }

    try {
      const newConfig = this.mergeConfigurations(this.currentConfig, updates);
      
      // Validate the updated configuration
      const validation = this.validateConfiguration(newConfig);
      if (!validation.isValid) {
        throw new Error(`Configuration update invalid: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      this.currentConfig = validation.sanitized || newConfig;
      this.recordConfigSource('runtime-update', source);
      
      this.emit('configurationChanged', { 
        config: this.currentConfig, 
        updates, 
        source 
      });
      
      if (this.eventBus) {
        this.eventBus.emit('system:configuration-changed', { 
          config: this.currentConfig, 
          source 
        });
      }

      this.logger.info('Configuration updated successfully', { source, updates: Object.keys(updates) });
    } catch (error) {
      this.logger.error('Failed to update configuration:', error);
      throw error;
    }
  }

  validateConfiguration(config: Partial<UnifiedConfiguration>): ConfigurationValidation {
    const errors: ConfigurationError[] = [];
    const warnings: ConfigurationWarning[] = [];

    // Validate app configuration
    if (config.app) {
      if (!config.app.name) {
        errors.push({ field: 'app.name', message: 'App name is required', severity: 'error' });
      }
      if (!['development', 'production', 'testing'].includes(config.app.environment)) {
        errors.push({ field: 'app.environment', message: 'Invalid environment', severity: 'error' });
      }
    }

    // Validate model configuration
    if (config.model) {
      if (config.model.providers && config.model.providers.length === 0) {
        warnings.push({ 
          field: 'model.providers', 
          message: 'No model providers configured', 
          suggestion: 'Add at least one provider' 
        });
      }
      
      if (config.model.timeout && config.model.timeout < 1000) {
        warnings.push({ 
          field: 'model.timeout', 
          message: 'Timeout very low', 
          suggestion: 'Consider increasing timeout' 
        });
      }
    }

    // Validate security configuration
    if (config.security) {
      if (config.security.maxInputLength && config.security.maxInputLength < 100) {
        warnings.push({ 
          field: 'security.maxInputLength', 
          message: 'Input length limit very low' 
        });
      }
      
      if (config.security.securityLevel === 'low') {
        warnings.push({ 
          field: 'security.securityLevel', 
          message: 'Low security level enabled' 
        });
      }
    }

    // Validate performance configuration
    if (config.performance) {
      if (config.performance.maxConcurrentRequests && config.performance.maxConcurrentRequests > 10) {
        warnings.push({ 
          field: 'performance.maxConcurrentRequests', 
          message: 'High concurrency may cause issues' 
        });
      }
    }

    // Create sanitized config if there are validation issues
    let sanitized: UnifiedConfiguration | undefined;
    if (errors.length > 0) {
      // For now, return undefined - in practice you'd fix the errors
      sanitized = undefined;
    } else if (warnings.length > 0) {
      // Apply automatic fixes for warnings where possible
      sanitized = this.applySanitization(config as UnifiedConfiguration, warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized,
    };
  }

  async saveConfiguration(filePath?: string): Promise<void> {
    const targetPath = filePath || this.configFilePath;
    
    try {
      // Ensure directory exists
      await mkdir(dirname(targetPath), { recursive: true });
      
      // Convert to YAML and save
      const yamlContent = YAML.stringify(this.currentConfig, { 
        indent: 2,
        quotingType: '"',
        forceQuotes: false,
      });
      
      await writeFile(targetPath, yamlContent, 'utf-8');
      
      this.logger.info(`Configuration saved to ${targetPath}`);
      this.emit('configurationSaved', { path: targetPath });
    } catch (error) {
      this.logger.error('Failed to save configuration:', error);
      throw error;
    }
  }

  async resetToDefaults(): Promise<void> {
    this.currentConfig = this.getDefaultConfiguration();
    this.configSources.clear();
    this.recordConfigSource('reset', 'runtime');
    
    this.emit('configurationReset', this.currentConfig);
    
    if (this.eventBus) {
      this.eventBus.emit('system:configuration-reset', { config: this.currentConfig });
    }
    
    this.logger.info('Configuration reset to defaults');
  }

  watchForChanges(enabled: boolean): void {
    if (enabled && !this.isWatching) {
      // TODO: Implement file watching
      this.isWatching = true;
      this.logger.info('Configuration file watching enabled');
    } else if (!enabled && this.isWatching) {
      // TODO: Stop file watching
      this.isWatching = false;
      this.logger.info('Configuration file watching disabled');
    }
  }

  private getDefaultConfiguration(): UnifiedConfiguration {
    return {
      app: {
        name: 'CodeCrucible Synth',
        version: '4.0.7',
        environment: 'development',
        logLevel: 'info',
      },
      model: {
        defaultProvider: 'ollama',
        providers: [
          {
            type: 'ollama',
            name: 'ollama',
            endpoint: 'http://localhost:11434',
            enabled: true,
            priority: 1,
            models: ['qwen2.5-coder:7b', 'deepseek-coder:8b'],
            capabilities: [
              { type: 'completion', supported: true },
              { type: 'chat', supported: true },
              { type: 'tools', supported: true },
              { type: 'code', supported: true },
            ],
          },
          {
            type: 'lm-studio',
            name: 'lm-studio',
            endpoint: 'http://localhost:1234',
            enabled: true,
            priority: 2,
            models: [],
            capabilities: [
              { type: 'completion', supported: true },
              { type: 'chat', supported: true },
            ],
          },
        ],
        fallbackChain: ['ollama', 'lm-studio'],
        executionMode: 'auto',
        timeout: 30000,
        maxRetries: 3,
        temperature: 0.7,
        maxTokens: 4096,
      },
      security: {
        enableSandbox: true,
        sandboxTimeout: 60000,
        maxInputLength: 50000,
        enableInputSanitization: true,
        allowedCommands: ['npm', 'node', 'git', 'ls', 'cat', 'head', 'tail'],
        blockedCommands: ['rm', 'rmdir', 'sudo', 'su'],
        allowedPaths: [process.cwd()],
        restrictedPaths: ['/etc', '/usr', '/bin'],
        securityLevel: 'medium',
        enableAuditLogging: true,
      },
      performance: {
        maxConcurrentRequests: 3,
        requestQueueSize: 10,
        defaultTimeout: 30000,
        fastModeMaxTokens: 1000,
        enableMemoryOptimization: true,
        memoryThresholdMB: 512,
        enableCaching: true,
        cacheSize: 100,
        cacheTTL: 300000,
        enableHardwareAcceleration: false,
        preferGPU: false,
      },
      voices: {
        defaultVoices: ['explorer', 'developer'],
        availableVoices: ['explorer', 'maintainer', 'architect', 'developer', 'analyzer', 'optimizer', 'guardian'],
        parallelVoices: true,
        maxConcurrentVoices: 3,
        voiceSettings: {},
        enableCouncilMode: true,
        councilDecisionThreshold: 0.7,
      },
      tools: {
        enableToolDiscovery: true,
        toolDirectories: ['./tools', '~/.codecrucible/tools'],
        enableParallelExecution: true,
        maxConcurrentTools: 2,
        defaultToolTimeout: 30000,
        enableMCPServers: true,
        mcpServerConfigs: [
          {
            id: 'filesystem',
            name: 'Filesystem MCP Server',
            enabled: true,
            type: 'filesystem',
            config: { restrictedPaths: [], allowedPaths: [process.cwd()] },
          },
          {
            id: 'git',
            name: 'Git MCP Server',
            enabled: true,
            type: 'git',
            config: { autoCommitMessages: false, safeModeEnabled: true },
          },
        ],
        enableToolSandboxing: true,
        toolSecurityLevel: 'medium',
      },
      infrastructure: {
        database: {
          type: 'sqlite',
          path: join(homedir(), '.codecrucible', 'data.db'),
          inMemory: false,
          enableMigrations: true,
        },
        streaming: {
          enabled: true,
          bufferSize: 1024,
          flushInterval: 100,
          chunkSize: 256,
          timeout: 5000,
        },
        monitoring: {
          enableMetrics: true,
          enableTracing: false,
          enableProfiling: false,
          healthCheckInterval: 30000,
        },
        integrations: {
          smithery: {
            enabled: false,
            autoDiscovery: false,
            servers: [],
          },
          e2b: {
            enabled: false,
          },
        },
      },
    };
  }

  private async loadFromFile(): Promise<Partial<UnifiedConfiguration>> {
    try {
      await access(this.configFilePath);
      const content = await readFile(this.configFilePath, 'utf-8');
      return YAML.parse(content);
    } catch {
      // File doesn't exist or can't be read - return empty config
      return {};
    }
  }

  private loadFromEnvironment(): Partial<UnifiedConfiguration> {
    const config: Partial<UnifiedConfiguration> = {};
    
    // Map environment variables to configuration
    if (process.env.CC_LOG_LEVEL) {
      config.app = { ...config.app, logLevel: process.env.CC_LOG_LEVEL as any };
    }
    
    if (process.env.CC_ENVIRONMENT) {
      config.app = { ...config.app, environment: process.env.CC_ENVIRONMENT as any };
    }
    
    if (process.env.CC_OLLAMA_ENDPOINT) {
      // Update ollama endpoint in providers
      // This would be more complex in practice
    }
    
    if (process.env.SMITHERY_API_KEY) {
      config.infrastructure = {
        ...config.infrastructure,
        integrations: {
          ...config.infrastructure?.integrations,
          smithery: {
            enabled: true,
            apiKey: process.env.SMITHERY_API_KEY,
            autoDiscovery: true,
            servers: [],
          },
        },
      };
    }
    
    return config;
  }

  private loadFromCliArgs(): Partial<UnifiedConfiguration> {
    const config: Partial<UnifiedConfiguration> = {};
    const args = process.argv;
    
    // Parse CLI arguments
    if (args.includes('--verbose')) {
      config.app = { ...config.app, logLevel: 'debug' };
    }
    
    if (args.includes('--no-stream')) {
      config.infrastructure = {
        ...config.infrastructure,
        streaming: { ...config.infrastructure?.streaming, enabled: false },
      };
    }
    
    // Add more CLI argument parsing as needed
    
    return config;
  }

  private mergeConfigurations(base: UnifiedConfiguration, override: Partial<UnifiedConfiguration>): UnifiedConfiguration {
    // Deep merge configurations
    // This is a simplified version - in practice you'd use a proper deep merge utility
    return {
      app: { ...base.app, ...override.app },
      model: { ...base.model, ...override.model },
      security: { ...base.security, ...override.security },
      performance: { ...base.performance, ...override.performance },
      voices: { ...base.voices, ...override.voices },
      tools: { ...base.tools, ...override.tools },
      infrastructure: {
        ...base.infrastructure,
        ...override.infrastructure,
        database: { ...base.infrastructure.database, ...override.infrastructure?.database },
        streaming: { ...base.infrastructure.streaming, ...override.infrastructure?.streaming },
        monitoring: { ...base.infrastructure.monitoring, ...override.infrastructure?.monitoring },
        integrations: {
          ...base.infrastructure.integrations,
          ...override.infrastructure?.integrations,
          smithery: { ...base.infrastructure.integrations.smithery, ...override.infrastructure?.integrations?.smithery },
          e2b: { ...base.infrastructure.integrations.e2b, ...override.infrastructure?.integrations?.e2b },
        },
      },
    };
  }

  private recordConfigSource(key: string, source: ConfigurationSource, path?: string): void {
    this.configSources.set(key, {
      source,
      priority: this.sourcePriorities.get(source) || 0,
      timestamp: new Date(),
      path,
    });
  }

  private applySanitization(config: UnifiedConfiguration, warnings: ConfigurationWarning[]): UnifiedConfiguration {
    // Apply automatic fixes for common issues
    const sanitized = { ...config };
    
    for (const warning of warnings) {
      switch (warning.field) {
        case 'model.timeout':
          if (sanitized.model.timeout < 1000) {
            sanitized.model.timeout = 5000;
          }
          break;
        case 'security.maxInputLength':
          if (sanitized.security.maxInputLength < 100) {
            sanitized.security.maxInputLength = 1000;
          }
          break;
        // Add more automatic fixes as needed
      }
    }
    
    return sanitized;
  }
}