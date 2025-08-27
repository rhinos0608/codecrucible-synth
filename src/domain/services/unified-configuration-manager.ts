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
      this.logger.info('Loading configuration with unified precedence rules...');

      // Phase 1: Start with system defaults (Level 0)
      let config = this.getDefaultConfiguration();
      this.recordConfigSource('system-defaults', 'default');
      this.logger.debug('Loaded system defaults');

      // Phase 2: Load global user configuration (Level 10)
      const globalConfig = await this.loadGlobalUserConfig();
      if (globalConfig && Object.keys(globalConfig).length > 0) {
        config = this.mergeConfigurations(config, globalConfig);
        this.recordConfigSource('global-user-config', 'file', this.configFilePath);
        this.logger.debug('Loaded global user configuration');
      }

      // Phase 3: Load project default configuration (Level 20)
      const projectDefaults = await this.loadProjectDefaults();
      if (projectDefaults && Object.keys(projectDefaults).length > 0) {
        config = this.mergeConfigurations(config, projectDefaults);
        this.recordConfigSource('project-defaults', 'file', 'config/default.yaml');
        this.logger.debug('Loaded project defaults from config/default.yaml');
      }

      // Phase 4: Load specialized configuration files (Level 25)
      const specializedConfigs = await this.loadSpecializedConfigs();
      for (const [source, specializedConfig] of specializedConfigs) {
        if (specializedConfig && Object.keys(specializedConfig).length > 0) {
          config = this.mergeConfigurations(config, specializedConfig);
          this.recordConfigSource(`specialized-${source}`, 'file', `config/${source}`);
          this.logger.debug(`Loaded specialized configuration from config/${source}`);
        }
      }

      // Phase 5: Load legacy configuration files with conflict detection
      const legacyConfigs = await this.loadLegacyConfigs();
      for (const [source, legacyConfig] of legacyConfigs) {
        if (legacyConfig && Object.keys(legacyConfig).length > 0) {
          const conflicts = this.detectConflicts(config, legacyConfig);
          if (conflicts.length > 0) {
            this.logger.warn(`Configuration conflicts detected in ${source}:`, conflicts);
          }
          config = this.mergeConfigurations(config, legacyConfig);
          this.recordConfigSource(`legacy-${source}`, 'file', source);
          this.logger.debug(`Loaded legacy configuration from ${source} (with conflict detection)`);
        }
      }

      // Phase 6: Load environment-specific overrides (Level 30)
      const envConfig = await this.loadEnvironmentSpecificConfig();
      if (envConfig && Object.keys(envConfig).length > 0) {
        config = this.mergeConfigurations(config, envConfig);
        this.recordConfigSource('environment-specific', 'file', `config/${config.app.environment}.yaml`);
        this.logger.debug(`Loaded environment-specific configuration for ${config.app.environment}`);
      }

      // Phase 7: Load local overrides (Level 40)
      const localConfig = await this.loadLocalOverrides();
      if (localConfig && Object.keys(localConfig).length > 0) {
        config = this.mergeConfigurations(config, localConfig);
        this.recordConfigSource('local-overrides', 'file', 'config/local.yaml');
        this.logger.debug('Loaded local overrides from config/local.yaml');
      }

      // Phase 8: Layer on environment variables (Level 50)
      const envVarConfig = this.loadFromEnvironment();
      if (envVarConfig && Object.keys(envVarConfig).length > 0) {
        config = this.mergeConfigurations(config, envVarConfig);
        this.recordConfigSource('environment-variables', 'environment');
        this.logger.debug('Loaded environment variable overrides');
      }

      // Phase 9: Layer on CLI arguments (Level 60)
      const cliConfig = this.loadFromCliArgs();
      if (cliConfig && Object.keys(cliConfig).length > 0) {
        config = this.mergeConfigurations(config, cliConfig);
        this.recordConfigSource('cli-arguments', 'cli-args');
        this.logger.debug('Loaded CLI argument overrides');
      }

      // Phase 10: Validate final configuration
      const validation = this.validateConfiguration(config);
      if (!validation.isValid) {
        this.logger.warn('Configuration validation failed:', validation.errors);
        // Use sanitized version if available
        if (validation.sanitized) {
          config = validation.sanitized;
          this.logger.info('Applied configuration sanitization');
        }
      }

      if (validation.warnings.length > 0) {
        this.logger.warn('Configuration warnings:', validation.warnings);
      }

      // Phase 11: Log configuration summary
      this.logConfigurationSummary(config);

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

  private async loadGlobalUserConfig(): Promise<Partial<UnifiedConfiguration>> {
    try {
      await access(this.configFilePath);
      const content = await readFile(this.configFilePath, 'utf-8');
      return YAML.parse(content);
    } catch {
      // Global config file doesn't exist - return empty config
      return {};
    }
  }

  private async loadProjectDefaults(): Promise<Partial<UnifiedConfiguration>> {
    try {
      const defaultConfigPath = join(process.cwd(), 'config', 'default.yaml');
      await access(defaultConfigPath);
      const content = await readFile(defaultConfigPath, 'utf-8');
      const parsed = YAML.parse(content);
      return this.transformLegacyConfig(parsed, 'default.yaml');
    } catch {
      return {};
    }
  }

  private async loadSpecializedConfigs(): Promise<Map<string, Partial<UnifiedConfiguration>>> {
    const configs = new Map<string, Partial<UnifiedConfiguration>>();
    
    const specializedFiles = [
      'voices.yaml',
      'model-config.yaml', 
      'security.yaml',
      'performance.yaml'
    ];

    for (const filename of specializedFiles) {
      try {
        const filePath = join(process.cwd(), 'config', filename);
        await access(filePath);
        const content = await readFile(filePath, 'utf-8');
        const parsed = YAML.parse(content);
        
        if (filename === 'voices.yaml') {
          configs.set(filename, this.transformVoicesConfig(parsed));
        } else {
          configs.set(filename, this.transformSpecializedConfig(parsed, filename));
        }
      } catch {
        // File doesn't exist, skip
      }
    }

    return configs;
  }

  private async loadLegacyConfigs(): Promise<Map<string, Partial<UnifiedConfiguration>>> {
    const configs = new Map<string, Partial<UnifiedConfiguration>>();
    
    const legacyFiles = [
      'codecrucible.config.json',
      'config/unified-model-config.yaml',
      'config/hybrid.yaml',
      'config/hybrid-config.json', 
      'config/optimized-model-config.json'
    ];

    for (const filename of legacyFiles) {
      try {
        const filePath = join(process.cwd(), filename);
        await access(filePath);
        const content = await readFile(filePath, 'utf-8');
        
        let parsed: any;
        if (filename.endsWith('.json')) {
          parsed = JSON.parse(content);
        } else {
          parsed = YAML.parse(content);
        }
        
        configs.set(filename, this.transformLegacyConfig(parsed, filename));
      } catch {
        // File doesn't exist, skip
      }
    }

    return configs;
  }

  private async loadEnvironmentSpecificConfig(): Promise<Partial<UnifiedConfiguration>> {
    try {
      const environment = process.env.NODE_ENV || process.env.CC_ENVIRONMENT || 'development';
      const envConfigPath = join(process.cwd(), 'config', `${environment}.yaml`);
      await access(envConfigPath);
      const content = await readFile(envConfigPath, 'utf-8');
      return YAML.parse(content);
    } catch {
      return {};
    }
  }

  private async loadLocalOverrides(): Promise<Partial<UnifiedConfiguration>> {
    try {
      const localConfigPath = join(process.cwd(), 'config', 'local.yaml');
      await access(localConfigPath);
      const content = await readFile(localConfigPath, 'utf-8');
      return YAML.parse(content);
    } catch {
      return {};
    }
  }

  private async loadFromFile(): Promise<Partial<UnifiedConfiguration>> {
    // This method is kept for backward compatibility
    return this.loadGlobalUserConfig();
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

  private transformLegacyConfig(config: any, filename: string): Partial<UnifiedConfiguration> {
    const transformed: Partial<UnifiedConfiguration> = {};

    if (filename === 'default.yaml') {
      return this.transformDefaultYaml(config);
    } else if (filename === 'codecrucible.config.json') {
      return this.transformCodecrucibleJson(config);
    } else if (filename.includes('unified-model-config')) {
      return this.transformUnifiedModelConfig(config);
    } else if (filename.includes('hybrid')) {
      return this.transformHybridConfig(config);
    } else if (filename.includes('optimized-model-config')) {
      return this.transformOptimizedModelConfig(config);
    }

    return transformed;
  }

  private transformDefaultYaml(config: any): Partial<UnifiedConfiguration> {
    const transformed: Partial<UnifiedConfiguration> = {};

    // App configuration
    if (config.app || config.name) {
      transformed.app = {
        name: config.app?.name || config.name || 'CodeCrucible Synth',
        version: config.app?.version || '4.0.7',
        environment: config.app?.environment || 'development',
        logLevel: config.logging?.level || config.app?.logLevel || 'info',
      };
    }

    // Model configuration
    if (config.model) {
      transformed.model = {
        defaultProvider: 'ollama',
        providers: [{
          type: 'ollama',
          name: 'ollama',
          endpoint: config.model.endpoint || 'http://localhost:11434',
          enabled: true,
          priority: 1,
          models: [config.model.name || 'qwen2.5-coder:7b'],
          capabilities: [
            { type: 'completion', supported: true },
            { type: 'chat', supported: true },
            { type: 'code', supported: true },
          ],
        }],
        fallbackChain: ['ollama'],
        executionMode: 'auto',
        timeout: this.parseTimeout(config.model.timeout) || 30000,
        maxRetries: 3,
        temperature: parseFloat(config.model.temperature) || 0.7,
        maxTokens: parseInt(config.model.maxTokens) || 4096,
      };
    }

    // Security configuration
    if (config.safety || config.e2b || config.security) {
      transformed.security = {
        enableSandbox: config.e2b?.enabled || config.safety?.commandValidation || true,
        sandboxTimeout: this.parseTimeout(config.e2b?.sessionTimeout) || 60000,
        maxInputLength: 50000,
        enableInputSanitization: true,
        allowedCommands: config.terminal?.allowedCommands || config.mcp?.servers?.terminal?.allowedCommands || ['npm', 'node', 'git'],
        blockedCommands: config.terminal?.blockedCommands || config.mcp?.servers?.terminal?.blockedCommands || ['rm', 'sudo'],
        allowedPaths: [process.cwd()],
        restrictedPaths: config.mcp?.servers?.filesystem?.restrictedPaths || ['/etc', '/usr'],
        securityLevel: 'medium',
        enableAuditLogging: config.e2b?.security?.auditLog || true,
      };
    }

    // Performance configuration
    if (config.performance) {
      transformed.performance = {
        maxConcurrentRequests: parseInt(config.performance.voiceParallelism?.maxConcurrent) || 3,
        requestQueueSize: 10,
        defaultTimeout: this.parseTimeout(config.model?.timeout) || 30000,
        fastModeMaxTokens: 1000,
        enableMemoryOptimization: true,
        memoryThresholdMB: 512,
        enableCaching: config.performance.responseCache?.enabled || true,
        cacheSize: parseInt(config.performance.responseCache?.maxSize) || 100,
        cacheTTL: this.parseTimeout(config.performance.responseCache?.maxAge) || 300000,
        enableHardwareAcceleration: false,
        preferGPU: false,
      };
    }

    // Voice configuration
    if (config.voices) {
      transformed.voices = {
        defaultVoices: config.voices.default || ['explorer', 'developer'],
        availableVoices: config.voices.available || ['explorer', 'maintainer', 'architect'],
        parallelVoices: config.voices.parallel || true,
        maxConcurrentVoices: config.voices.maxConcurrent || 3,
        voiceSettings: {},
        enableCouncilMode: true,
        councilDecisionThreshold: 0.7,
      };
    }

    // Tools/MCP configuration
    if (config.mcp) {
      transformed.tools = {
        enableToolDiscovery: true,
        toolDirectories: ['./tools'],
        enableParallelExecution: true,
        maxConcurrentTools: 2,
        defaultToolTimeout: 30000,
        enableMCPServers: true,
        mcpServerConfigs: this.transformMcpServers(config.mcp.servers || {}),
        enableToolSandboxing: true,
        toolSecurityLevel: 'medium',
      };
    }

    return transformed;
  }

  private transformCodecrucibleJson(config: any): Partial<UnifiedConfiguration> {
    const transformed: Partial<UnifiedConfiguration> = {};

    // Model configuration from models section
    if (config.models) {
      const providers: any[] = [];
      
      for (const [modelKey, modelConfig] of Object.entries(config.models as any)) {
        const provider = {
          type: modelConfig.provider,
          name: modelConfig.provider,
          endpoint: modelConfig.endpoint || (modelConfig.provider === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com/v1'),
          enabled: true,
          priority: providers.length + 1,
          models: [modelConfig.model],
          capabilities: [{ type: 'completion', supported: true }],
        };
        providers.push(provider);
      }

      transformed.model = {
        defaultProvider: providers[0]?.name || 'ollama',
        providers,
        fallbackChain: providers.map(p => p.name),
        executionMode: config.agent?.mode || 'auto',
        timeout: 30000,
        maxRetries: 3,
        temperature: 0.7,
        maxTokens: 4096,
      };
    }

    // Performance configuration
    if (config.performance || config.agent) {
      transformed.performance = {
        maxConcurrentRequests: config.agent?.maxConcurrency || 3,
        requestQueueSize: 10,
        defaultTimeout: config.performance?.alertThreshold || 30000,
        fastModeMaxTokens: 1000,
        enableMemoryOptimization: true,
        memoryThresholdMB: 512,
        enableCaching: config.agent?.enableCaching || config.features?.enableCaching || true,
        cacheSize: 100,
        cacheTTL: config.features?.cacheExpiry * 1000 || 300000,
        enableHardwareAcceleration: false,
        preferGPU: false,
      };
    }

    // Security configuration
    if (config.security) {
      transformed.security = {
        enableSandbox: config.security.sandboxMode || true,
        sandboxTimeout: 60000,
        maxInputLength: 50000,
        enableInputSanitization: config.security.enableValidation || true,
        allowedCommands: ['npm', 'node', 'git'],
        blockedCommands: config.security.allowUnsafeCommands ? [] : ['rm', 'sudo'],
        allowedPaths: [process.cwd()],
        restrictedPaths: ['/etc', '/usr'],
        securityLevel: 'medium',
        enableAuditLogging: config.security.auditLogging || true,
      };
    }

    // Voice configuration
    if (config.features) {
      transformed.voices = {
        defaultVoices: ['explorer', 'developer'],
        availableVoices: ['explorer', 'maintainer', 'architect', 'developer'],
        parallelVoices: true,
        maxConcurrentVoices: config.features.maxConcurrentVoices || 3,
        voiceSettings: {},
        enableCouncilMode: config.features.enableCouncilEngine || true,
        councilDecisionThreshold: 0.7,
      };
    }

    return transformed;
  }

  private transformUnifiedModelConfig(config: any): Partial<UnifiedConfiguration> {
    const transformed: Partial<UnifiedConfiguration> = {};

    if (config.llm) {
      const providers: any[] = [];

      // Transform providers
      for (const [providerName, providerConfig] of Object.entries(config.llm.providers || {})) {
        const provider = {
          type: providerName,
          name: providerName,
          endpoint: (providerConfig as any).endpoint,
          enabled: true,
          priority: providerName === config.llm.default_provider ? 1 : 2,
          models: (providerConfig as any).models?.preferred || [],
          capabilities: [{ type: 'completion', supported: true }],
        };
        providers.push(provider);
      }

      transformed.model = {
        defaultProvider: config.llm.default_provider || 'ollama',
        providers,
        fallbackChain: config.llm.fallback_chain || [config.llm.default_provider],
        executionMode: config.llm.routing?.strategy === 'hybrid' ? 'auto' : 'quality',
        timeout: config.llm.providers?.ollama?.timeout?.response || 30000,
        maxRetries: 3,
        temperature: 0.7,
        maxTokens: 128000,
      };
    }

    return transformed;
  }

  private transformHybridConfig(config: any): Partial<UnifiedConfiguration> {
    const transformed: Partial<UnifiedConfiguration> = {};

    if (config.hybrid) {
      const providers: any[] = [];

      // LM Studio provider
      if (config.hybrid.lmStudio || config.lmStudio) {
        const lmStudioConfig = config.hybrid.lmStudio || config.lmStudio;
        providers.push({
          type: 'lm-studio',
          name: 'lm-studio',
          endpoint: lmStudioConfig.endpoint || 'http://localhost:1234',
          enabled: lmStudioConfig.enabled !== false,
          priority: 2,
          models: lmStudioConfig.models || [],
          capabilities: [{ type: 'completion', supported: true }],
        });
      }

      // Ollama provider
      if (config.hybrid.ollama || config.ollama) {
        const ollamaConfig = config.hybrid.ollama || config.ollama;
        providers.push({
          type: 'ollama',
          name: 'ollama',
          endpoint: ollamaConfig.endpoint || 'http://localhost:11434',
          enabled: ollamaConfig.enabled !== false,
          priority: 1,
          models: ollamaConfig.models || [],
          capabilities: [{ type: 'completion', supported: true }],
        });
      }

      transformed.model = {
        defaultProvider: config.hybrid?.routing?.defaultProvider || 'ollama',
        providers,
        fallbackChain: ['ollama', 'lm-studio'],
        executionMode: 'auto',
        timeout: 30000,
        maxRetries: 3,
        temperature: 0.7,
        maxTokens: 128000,
      };
    }

    return transformed;
  }

  private transformOptimizedModelConfig(config: any): Partial<UnifiedConfiguration> {
    const transformed: Partial<UnifiedConfiguration> = {};

    if (config.modelPreloader || config.hybridClient) {
      transformed.model = {
        defaultProvider: 'ollama',
        providers: [{
          type: 'ollama',
          name: 'ollama',
          endpoint: config.modelPreloader?.endpoint || 'http://localhost:11434',
          enabled: true,
          priority: 1,
          models: config.modelPreloader?.primaryModels || [],
          capabilities: [{ type: 'completion', supported: true }],
        }],
        fallbackChain: ['ollama'],
        executionMode: 'fast',
        timeout: config.hybridClient?.defaultTimeout || 60000,
        maxRetries: config.modelPreloader?.retryAttempts || 2,
        temperature: 0.7,
        maxTokens: 4096,
      };
    }

    if (config.performance) {
      transformed.performance = {
        maxConcurrentRequests: config.performance.maxConcurrentRequests || 2,
        requestQueueSize: 10,
        defaultTimeout: 30000,
        fastModeMaxTokens: 1000,
        enableMemoryOptimization: config.performance.enableMemoryOptimization !== false,
        memoryThresholdMB: 512,
        enableCaching: config.performance.enableModelCaching !== false,
        cacheSize: 100,
        cacheTTL: config.hybridClient?.cacheDuration || 300000,
        enableHardwareAcceleration: false,
        preferGPU: false,
      };
    }

    return transformed;
  }

  private transformVoicesConfig(config: any): Partial<UnifiedConfiguration> {
    const transformed: Partial<UnifiedConfiguration> = {};

    if (config.perspectives || config.roles || config.presets) {
      const voiceSettings: Record<string, any> = {};
      
      // Transform perspectives
      if (config.perspectives) {
        for (const [voiceName, voiceConfig] of Object.entries(config.perspectives)) {
          voiceSettings[voiceName] = {
            enabled: true,
            priority: 1,
            specialization: (voiceConfig as any).strengths || [],
            contextLimit: 4096,
          };
        }
      }

      // Transform roles
      if (config.roles) {
        for (const [voiceName, voiceConfig] of Object.entries(config.roles)) {
          voiceSettings[voiceName] = {
            enabled: true,
            priority: 1,
            specialization: (voiceConfig as any).strengths || [],
            contextLimit: 4096,
          };
        }
      }

      transformed.voices = {
        defaultVoices: ['explorer', 'maintainer'],
        availableVoices: Object.keys(voiceSettings),
        parallelVoices: true,
        maxConcurrentVoices: 3,
        voiceSettings,
        enableCouncilMode: true,
        councilDecisionThreshold: 0.7,
      };
    }

    return transformed;
  }

  private transformSpecializedConfig(config: any, filename: string): Partial<UnifiedConfiguration> {
    // Placeholder for future specialized config transformations
    return {};
  }

  private transformMcpServers(mcpConfig: any): any[] {
    const servers: any[] = [];

    if (mcpConfig.filesystem) {
      servers.push({
        id: 'filesystem',
        name: 'Filesystem MCP Server',
        enabled: mcpConfig.filesystem.enabled !== false,
        type: 'filesystem',
        config: {
          allowedPaths: mcpConfig.filesystem.allowedPaths || [process.cwd()],
          restrictedPaths: mcpConfig.filesystem.restrictedPaths || [],
        },
      });
    }

    if (mcpConfig.git) {
      servers.push({
        id: 'git',
        name: 'Git MCP Server',
        enabled: mcpConfig.git.enabled !== false,
        type: 'git',
        config: {
          autoCommitMessages: mcpConfig.git.autoCommitMessages || false,
          safeModeEnabled: mcpConfig.git.safeModeEnabled !== false,
        },
      });
    }

    if (mcpConfig.terminal) {
      servers.push({
        id: 'terminal',
        name: 'Terminal MCP Server',
        enabled: mcpConfig.terminal.enabled !== false,
        type: 'terminal',
        config: {
          allowedCommands: mcpConfig.terminal.allowedCommands || [],
          blockedCommands: mcpConfig.terminal.blockedCommands || [],
        },
      });
    }

    return servers;
  }

  private parseTimeout(value: any): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      if (value.endsWith('ms')) return parseInt(value);
      if (value.endsWith('s')) return parseInt(value) * 1000;
      if (value.endsWith('m')) return parseInt(value) * 60000;
      return parseInt(value);
    }
    return undefined;
  }

  private detectConflicts(baseConfig: UnifiedConfiguration, newConfig: Partial<UnifiedConfiguration>): string[] {
    const conflicts: string[] = [];

    // Model timeout conflicts
    if (newConfig.model?.timeout && baseConfig.model.timeout !== newConfig.model.timeout) {
      conflicts.push(`model.timeout: ${baseConfig.model.timeout} vs ${newConfig.model.timeout}`);
    }

    // Model provider conflicts
    if (newConfig.model?.defaultProvider && baseConfig.model.defaultProvider !== newConfig.model.defaultProvider) {
      conflicts.push(`model.defaultProvider: ${baseConfig.model.defaultProvider} vs ${newConfig.model.defaultProvider}`);
    }

    // Security level conflicts
    if (newConfig.security?.securityLevel && baseConfig.security.securityLevel !== newConfig.security.securityLevel) {
      conflicts.push(`security.securityLevel: ${baseConfig.security.securityLevel} vs ${newConfig.security.securityLevel}`);
    }

    // Performance concurrency conflicts
    if (newConfig.performance?.maxConcurrentRequests && baseConfig.performance.maxConcurrentRequests !== newConfig.performance.maxConcurrentRequests) {
      conflicts.push(`performance.maxConcurrentRequests: ${baseConfig.performance.maxConcurrentRequests} vs ${newConfig.performance.maxConcurrentRequests}`);
    }

    // Caching conflicts
    if (newConfig.performance?.enableCaching !== undefined && baseConfig.performance.enableCaching !== newConfig.performance.enableCaching) {
      conflicts.push(`performance.enableCaching: ${baseConfig.performance.enableCaching} vs ${newConfig.performance.enableCaching}`);
    }

    return conflicts;
  }

  private logConfigurationSummary(config: UnifiedConfiguration): void {
    this.logger.info('Configuration Summary:', {
      app: {
        name: config.app.name,
        version: config.app.version,
        environment: config.app.environment,
        logLevel: config.app.logLevel,
      },
      model: {
        defaultProvider: config.model.defaultProvider,
        providerCount: config.model.providers.length,
        timeout: config.model.timeout,
        maxTokens: config.model.maxTokens,
      },
      security: {
        securityLevel: config.security.securityLevel,
        sandboxEnabled: config.security.enableSandbox,
      },
      performance: {
        maxConcurrentRequests: config.performance.maxConcurrentRequests,
        cachingEnabled: config.performance.enableCaching,
      },
      voices: {
        defaultVoices: config.voices.defaultVoices.length,
        availableVoices: config.voices.availableVoices.length,
        parallelEnabled: config.voices.parallelVoices,
      },
      sources: Array.from(this.configSources.keys()),
    });
  }
}