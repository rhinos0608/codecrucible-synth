/**
 * Configuration Manager - Centralizes configuration management, validation, and defaults
 * Extracted from UnifiedModelClient to provide focused configuration handling with validation
 */

import { logger } from '../logger.js';
import { UnifiedClientConfig } from '../../application/services/client.js';
import { ProviderType, ProviderConfig } from '../providers/provider-repository.js';
import { StreamConfig } from '../../infrastructure/streaming/streaming-manager.js';

export interface ConfigurationDefaults {
  providers: ProviderConfig[];
  executionMode: 'fast' | 'auto' | 'quality';
  fallbackChain: ProviderType[];
  performanceThresholds: {
    fastModeMaxTokens: number;
    timeoutMs: number;
    maxConcurrentRequests: number;
  };
  security: {
    enableSandbox: boolean;
    maxInputLength: number;
    allowedCommands: string[];
  };
  streaming: StreamConfig;
}

export interface ConfigurationValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: UnifiedClientConfig;
}

export interface IConfigurationManager {
  /**
   * Get default configuration with all necessary defaults
   */
  getDefaultConfig(): UnifiedClientConfig;

  /**
   * Create default unified client configuration with overrides
   */
  createDefaultUnifiedClientConfig(overrides?: Partial<UnifiedClientConfig>): UnifiedClientConfig;

  /**
   * Validate configuration for security and consistency
   */
  validateConfiguration(config: Partial<UnifiedClientConfig>): ConfigurationValidation;

  /**
   * Merge configuration with defaults and validate
   */
  mergeConfigurationWithDefaults(
    config: Partial<UnifiedClientConfig>,
    baseConfig?: UnifiedClientConfig
  ): UnifiedClientConfig;

  /**
   * Get environment-specific configuration overrides
   */
  getEnvironmentOverrides(): Partial<UnifiedClientConfig>;

  /**
   * Sanitize configuration for security (remove sensitive data from logs)
   */
  sanitizeConfigForLogging(config: UnifiedClientConfig): any;
}

export class ConfigurationManager implements IConfigurationManager {
  private readonly defaults: ConfigurationDefaults;

  constructor() {
    this.defaults = {
      providers: [
        { type: 'ollama', endpoint: 'http://localhost:11434' },
        { type: 'lm-studio', endpoint: 'http://localhost:1234' },
      ],
      executionMode: 'auto',
      fallbackChain: ['ollama', 'lm-studio', 'huggingface'],
      performanceThresholds: {
        fastModeMaxTokens: 1000,
        timeoutMs: 180000, // 3 minutes default timeout
        maxConcurrentRequests: 3, // Increased back to 3 for faster parallel processing
      },
      security: {
        enableSandbox: true,
        maxInputLength: 50000,
        allowedCommands: ['npm', 'node', 'git'],
      },
      streaming: {
        chunkSize: 50,
        bufferSize: 1024,
        enableBackpressure: true,
        timeout: 30000,
        encoding: 'utf8',
      },
    };

    logger.debug('ConfigurationManager initialized with defaults');
  }

  /**
   * Get default configuration with all necessary defaults
   */
  getDefaultConfig(): UnifiedClientConfig {
    const defaultConfig: UnifiedClientConfig = {
      endpoint: 'http://localhost:11434',
      providers: [...this.defaults.providers], // Clone array
      executionMode: this.defaults.executionMode,
      fallbackChain: [...this.defaults.fallbackChain], // Clone array
      performanceThresholds: { ...this.defaults.performanceThresholds }, // Clone object
      security: {
        ...this.defaults.security,
        allowedCommands: [...this.defaults.security.allowedCommands], // Clone array
      },
      streaming: { ...this.defaults.streaming }, // Clone object
    };

    logger.debug('Generated default configuration', {
      providersCount: defaultConfig.providers.length,
      executionMode: defaultConfig.executionMode,
      timeoutMs: defaultConfig.performanceThresholds.timeoutMs,
    });

    return defaultConfig;
  }

  /**
   * Create default unified client configuration with overrides
   */
  createDefaultUnifiedClientConfig(
    overrides: Partial<UnifiedClientConfig> = {}
  ): UnifiedClientConfig {
    const baseConfig = this.getDefaultConfig();
    const mergedConfig = this.mergeConfigurationWithDefaults(overrides, baseConfig);

    logger.debug('Created unified client configuration', {
      hasOverrides: Object.keys(overrides).length > 0,
      overrideKeys: Object.keys(overrides),
    });

    return mergedConfig;
  }

  /**
   * Validate configuration for security and consistency
   */
  validateConfiguration(config: Partial<UnifiedClientConfig>): ConfigurationValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate providers
    if (config.providers) {
      if (!Array.isArray(config.providers) || config.providers.length === 0) {
        errors.push('Providers must be a non-empty array');
      } else {
        config.providers.forEach((provider, index) => {
          if (!provider.type) {
            errors.push(`Provider at index ${index} missing type`);
          }
          if (!provider.endpoint) {
            errors.push(`Provider at index ${index} missing endpoint`);
          }
          if (provider.endpoint && !this.isValidEndpoint(provider.endpoint)) {
            errors.push(`Provider at index ${index} has invalid endpoint format`);
          }
        });
      }
    }

    // Validate execution mode
    if (config.executionMode && !['fast', 'auto', 'quality'].includes(config.executionMode)) {
      errors.push('ExecutionMode must be one of: fast, auto, quality');
    }

    // Validate performance thresholds
    if (config.performanceThresholds) {
      const perf = config.performanceThresholds;
      if (perf.timeoutMs && (perf.timeoutMs < 5000 || perf.timeoutMs > 600000)) {
        warnings.push('TimeoutMs should be between 5 seconds and 10 minutes');
      }
      if (
        perf.maxConcurrentRequests &&
        (perf.maxConcurrentRequests < 1 || perf.maxConcurrentRequests > 10)
      ) {
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
      sanitized: isValid ? (config as UnifiedClientConfig) : undefined,
    };
  }

  /**
   * Merge configuration with defaults and validate
   */
  mergeConfigurationWithDefaults(
    config: Partial<UnifiedClientConfig>,
    baseConfig?: UnifiedClientConfig
  ): UnifiedClientConfig {
    const base = baseConfig || this.getDefaultConfig();

    // Deep merge configuration with defaults
    const merged: UnifiedClientConfig = {
      ...base,
      ...config,
      // Deep merge nested objects
      performanceThresholds: {
        ...base.performanceThresholds,
        ...(config.performanceThresholds || {}),
      },
      security: {
        ...base.security,
        ...(config.security || {}),
        // Preserve array references or merge them properly
        allowedCommands: config.security?.allowedCommands || base.security.allowedCommands,
      },
      streaming: {
        ...base.streaming,
        ...(config.streaming || {}),
      },
      // Arrays should be replaced, not merged
      providers: config.providers || base.providers,
      fallbackChain: config.fallbackChain || base.fallbackChain,
    };

    // Validate merged configuration
    const validation = this.validateConfiguration(merged);
    if (!validation.isValid) {
      logger.warn('Merged configuration is invalid, using base configuration', {
        errors: validation.errors,
      });
      return base;
    }

    return merged;
  }

  /**
   * Get environment-specific configuration overrides
   */
  getEnvironmentOverrides(): Partial<UnifiedClientConfig> {
    const overrides: Partial<UnifiedClientConfig> = {};

    // Check for environment variables
    if (process.env.AI_TIMEOUT_MS) {
      const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS, 10);
      if (!isNaN(timeoutMs)) {
        overrides.performanceThresholds = {
          ...this.defaults.performanceThresholds,
          timeoutMs,
        };
      }
    }

    if (process.env.AI_MAX_CONCURRENT) {
      const maxConcurrent = parseInt(process.env.AI_MAX_CONCURRENT, 10);
      if (!isNaN(maxConcurrent)) {
        overrides.performanceThresholds = {
          ...this.defaults.performanceThresholds,
          ...(overrides.performanceThresholds || {}),
          maxConcurrentRequests: maxConcurrent,
        };
      }
    }

    if (process.env.AI_EXECUTION_MODE) {
      const mode = process.env.AI_EXECUTION_MODE;
      if (['fast', 'auto', 'quality'].includes(mode)) {
        overrides.executionMode = mode as 'fast' | 'auto' | 'quality';
      }
    }

    if (Object.keys(overrides).length > 0) {
      logger.debug('Applied environment overrides', { overrides });
    }

    return overrides;
  }

  /**
   * Sanitize configuration for security (remove sensitive data from logs)
   */
  sanitizeConfigForLogging(config: UnifiedClientConfig): any {
    const sanitized = { ...config };

    // Remove or mask sensitive endpoint information
    if (sanitized.providers) {
      sanitized.providers = sanitized.providers.map(provider => ({
        ...provider,
        endpoint: provider.endpoint ? this.maskEndpoint(provider.endpoint) : '[NO_ENDPOINT]',
      }));
    }

    if (sanitized.endpoint) {
      sanitized.endpoint = this.maskEndpoint(sanitized.endpoint);
    }

    return sanitized;
  }

  /**
   * Validate endpoint format
   */
  private isValidEndpoint(endpoint: string): boolean {
    try {
      const url = new URL(endpoint);
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Mask sensitive parts of endpoint for logging
   */
  private maskEndpoint(endpoint: string): string {
    try {
      const url = new URL(endpoint);
      const port = url.port || (url.protocol === 'https:' ? '443' : '80');
      return `${url.protocol}//${url.hostname}:${port}${url.pathname}`;
    } catch {
      return '[INVALID_ENDPOINT]';
    }
  }
}
