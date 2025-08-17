import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { logger } from './logger.js';
import { HybridRoutingConfig } from './intelligent-model-selector.js';

export interface HybridPerformanceConfig {
  metricsCollection: boolean;
  healthChecking: boolean;
  healthCheckInterval: number;
  autoOptimization: boolean;
  cacheEnabled: boolean;
  cacheDuration: number;
}

export interface HybridResourceConfig {
  memory: {
    maxUsagePercent: number;
    gcThreshold: number;
  };
  vram: {
    enabled: boolean;
    reservedMB: number;
    swappingStrategy: 'intelligent' | 'lru' | 'manual';
  };
  cpu: {
    maxUsagePercent: number;
    threadPoolSize: number;
  };
}

export interface HybridFallbackConfig {
  autoFallback: boolean;
  retryAttempts: number;
  retryDelay: number;
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeout: number;
  };
}

export interface HybridDevelopmentConfig {
  detailedLogging: boolean;
  logRoutingDecisions: boolean;
  debugMode: boolean;
  saveMetrics: boolean;
  metricsFile: string;
}

export interface HybridFullConfig {
  hybrid: HybridRoutingConfig;
  performance: HybridPerformanceConfig;
  resources: HybridResourceConfig;
  fallback: HybridFallbackConfig;
  development: HybridDevelopmentConfig;
}

/**
 * Configuration Manager for Hybrid LLM Architecture
 * Handles loading, saving, and validation of hybrid configuration
 */
export class HybridConfigManager {
  private configPath: string;
  private config: HybridFullConfig | null = null;
  private watchers = new Map<string, any>();

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'config', 'hybrid.yaml');
  }

  /**
   * Load configuration from YAML file
   */
  async loadConfig(): Promise<HybridFullConfig> {
    try {
      // Check if config file exists
      const exists = await this.fileExists(this.configPath);
      if (!exists) {
        logger.info('Hybrid config file not found, creating default configuration');
        await this.createDefaultConfig();
      }

      const configData = await fs.readFile(this.configPath, 'utf8');
      const rawConfig = yaml.load(configData) as any;
      
      // Validate and normalize configuration
      const validatedConfig = this.validateConfig(rawConfig);
      this.config = validatedConfig;
      
      logger.info('Hybrid configuration loaded successfully', {
        path: this.configPath,
        enabled: validatedConfig.hybrid.enabled,
        providers: {
          lmStudio: validatedConfig.hybrid.lmStudio.enabled,
          ollama: validatedConfig.hybrid.ollama.enabled
        }
      });

      return validatedConfig;
    } catch (error) {
      logger.error('Failed to load hybrid configuration:', error);
      
      // Fallback to default configuration
      const defaultConfig = this.getDefaultConfig();
      this.config = defaultConfig;
      return defaultConfig;
    }
  }

  /**
   * Save configuration to YAML file
   */
  async saveConfig(config: HybridFullConfig): Promise<void> {
    try {
      const yamlData = yaml.dump(config, {
        indent: 2,
        lineWidth: 120,
        noRefs: true
      });

      // Ensure config directory exists
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });

      await fs.writeFile(this.configPath, yamlData, 'utf8');
      this.config = config;
      
      logger.info('Hybrid configuration saved successfully', {
        path: this.configPath
      });
    } catch (error) {
      logger.error('Failed to save hybrid configuration:', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): HybridFullConfig | null {
    return this.config;
  }

  /**
   * Update specific configuration section
   */
  async updateConfig(section: keyof HybridFullConfig, updates: any): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }

    if (this.config) {
      this.config[section] = { ...this.config[section], ...updates };
      await this.saveConfig(this.config);
    }
  }

  /**
   * Update hybrid routing configuration
   */
  async updateHybridConfig(updates: Partial<HybridRoutingConfig>): Promise<void> {
    await this.updateConfig('hybrid', updates);
  }

  /**
   * Watch configuration file for changes
   */
  async watchConfig(callback: (config: HybridFullConfig) => void): Promise<void> {
    try {
      const watcher = await import('chokidar');
      const fileWatcher = watcher.watch(this.configPath, {
        persistent: true,
        ignoreInitial: true
      });

      fileWatcher.on('change', async () => {
        try {
          logger.info('Hybrid configuration file changed, reloading...');
          const newConfig = await this.loadConfig();
          callback(newConfig);
        } catch (error) {
          logger.error('Failed to reload configuration after file change:', error);
        }
      });

      this.watchers.set(this.configPath, fileWatcher);
      logger.info('Watching hybrid configuration file for changes');
    } catch (error) {
      logger.warn('File watching not available, configuration changes require restart');
    }
  }

  /**
   * Stop watching configuration file
   */
  async stopWatching(): Promise<void> {
    for (const [path, watcher] of this.watchers.entries()) {
      if (watcher && typeof watcher.close === 'function') {
        await watcher.close();
        logger.debug(`Stopped watching configuration file: ${path}`);
      }
    }
    this.watchers.clear();
  }

  /**
   * Validate configuration structure and values
   */
  private validateConfig(rawConfig: any): HybridFullConfig {
    const defaultConfig = this.getDefaultConfig();
    
    // Deep merge with defaults to ensure all required fields exist
    const config = this.deepMerge(defaultConfig, rawConfig);
    
    // Validate specific constraints
    this.validateHybridConfig(config.hybrid);
    this.validatePerformanceConfig(config.performance);
    this.validateResourceConfig(config.resources);
    this.validateFallbackConfig(config.fallback);
    
    return config;
  }

  /**
   * Validate hybrid routing configuration
   */
  private validateHybridConfig(config: HybridRoutingConfig): void {
    if (config.escalationThreshold < 0 || config.escalationThreshold > 1) {
      throw new Error('Escalation threshold must be between 0 and 1');
    }

    if (!config.lmStudio.endpoint || !config.ollama.endpoint) {
      throw new Error('Both LM Studio and Ollama endpoints must be specified');
    }

    if (config.lmStudio.maxConcurrent < 1 || config.ollama.maxConcurrent < 1) {
      throw new Error('Max concurrent requests must be at least 1');
    }
  }

  /**
   * Validate performance configuration
   */
  private validatePerformanceConfig(config: HybridPerformanceConfig): void {
    if (config.healthCheckInterval < 30000) {
      logger.warn('Health check interval is very short, this may impact performance');
    }

    if (config.cacheDuration < 60000) {
      logger.warn('Cache duration is very short, this may reduce performance benefits');
    }
  }

  /**
   * Validate resource configuration
   */
  private validateResourceConfig(config: HybridResourceConfig): void {
    if (config.memory.maxUsagePercent < 50 || config.memory.maxUsagePercent > 95) {
      throw new Error('Memory max usage percent must be between 50 and 95');
    }

    if (config.cpu.maxUsagePercent < 50 || config.cpu.maxUsagePercent > 95) {
      throw new Error('CPU max usage percent must be between 50 and 95');
    }

    if (config.cpu.threadPoolSize < 1 || config.cpu.threadPoolSize > 16) {
      throw new Error('Thread pool size must be between 1 and 16');
    }
  }

  /**
   * Validate fallback configuration
   */
  private validateFallbackConfig(config: HybridFallbackConfig): void {
    if (config.retryAttempts < 0 || config.retryAttempts > 10) {
      throw new Error('Retry attempts must be between 0 and 10');
    }

    if (config.retryDelay < 100 || config.retryDelay > 30000) {
      throw new Error('Retry delay must be between 100ms and 30s');
    }
  }

  /**
   * Create default configuration file
   */
  private async createDefaultConfig(): Promise<void> {
    const defaultConfig = this.getDefaultConfig();
    await this.saveConfig(defaultConfig);
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): HybridFullConfig {
    return {
      hybrid: {
        enabled: true,
        defaultProvider: 'auto',
        escalationThreshold: 0.7,
        confidenceScoring: true,
        learningEnabled: true,
        lmStudio: {
          endpoint: 'http://localhost:1234',
          enabled: true,
          models: ['codellama-7b-instruct', 'gemma-2b-it'],
          taskTypes: ['template', 'edit', 'format', 'boilerplate'],
          streamingEnabled: true,
          maxConcurrent: 3
        },
        ollama: {
          endpoint: 'http://localhost:11434',
          enabled: true,
          models: ['codellama:34b', 'qwen2.5:72b'],
          taskTypes: ['analysis', 'planning', 'complex', 'multi-file'],
          maxConcurrent: 1
        },
        routing: {
          escalationThreshold: 0.7,
          rules: [
            {
              condition: 'taskType == "template"',
              target: 'lmstudio',
              confidence: 0.9,
              description: 'Templates are fast tasks best handled by LM Studio'
            },
            {
              condition: 'complexity == "complex"',
              target: 'ollama',
              confidence: 0.95,
              description: 'Complex tasks require Ollama\'s reasoning capabilities'
            }
          ]
        }
      },
      performance: {
        metricsCollection: true,
        healthChecking: true,
        healthCheckInterval: 300000,
        autoOptimization: true,
        cacheEnabled: true,
        cacheDuration: 3600000
      },
      resources: {
        memory: {
          maxUsagePercent: 85,
          gcThreshold: 75
        },
        vram: {
          enabled: true,
          reservedMB: 2048,
          swappingStrategy: 'intelligent'
        },
        cpu: {
          maxUsagePercent: 80,
          threadPoolSize: 4
        }
      },
      fallback: {
        autoFallback: true,
        retryAttempts: 2,
        retryDelay: 1000,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          recoveryTimeout: 30000
        }
      },
      development: {
        detailedLogging: false,
        logRoutingDecisions: true,
        debugMode: false,
        saveMetrics: true,
        metricsFile: './logs/hybrid-metrics.json'
      }
    };
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get configuration summary for display
   */
  getConfigSummary(): any {
    if (!this.config) {
      return { error: 'No configuration loaded' };
    }

    return {
      hybrid: {
        enabled: this.config.hybrid.enabled,
        defaultProvider: this.config.hybrid.defaultProvider,
        escalationThreshold: this.config.hybrid.escalationThreshold
      },
      providers: {
        lmStudio: {
          enabled: this.config.hybrid.lmStudio.enabled,
          endpoint: this.config.hybrid.lmStudio.endpoint,
          models: this.config.hybrid.lmStudio.models.length,
          maxConcurrent: this.config.hybrid.lmStudio.maxConcurrent
        },
        ollama: {
          enabled: this.config.hybrid.ollama.enabled,
          endpoint: this.config.hybrid.ollama.endpoint,
          models: this.config.hybrid.ollama.models.length,
          maxConcurrent: this.config.hybrid.ollama.maxConcurrent
        }
      },
      routing: {
        rules: this.config.hybrid.routing.rules.length,
        learningEnabled: this.config.hybrid.learningEnabled
      },
      performance: {
        caching: this.config.performance.cacheEnabled,
        monitoring: this.config.performance.metricsCollection,
        autoOptimization: this.config.performance.autoOptimization
      }
    };
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<void> {
    const defaultConfig = this.getDefaultConfig();
    await this.saveConfig(defaultConfig);
    logger.info('Hybrid configuration reset to defaults');
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    await this.stopWatching();
  }
}