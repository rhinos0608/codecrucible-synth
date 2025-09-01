/**
 * Legacy Config Manager - Backward Compatibility Wrapper
 *
 * This is a temporary wrapper around the new UnifiedConfigurationManager
 * to maintain backward compatibility during the architectural migration.
 *
 * @deprecated Use UnifiedConfigurationManager from domain/services instead
 */

import { UnifiedConfigurationManager } from '../domain/services/unified-configuration-manager.js';
import { UnifiedConfiguration } from '../domain/types/index.js';
import { createLogger } from '../infrastructure/logging/logger-adapter.js';

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
    providers: Record<string, any>;
  };
  agent: {
    enabled: boolean;
    mode: 'fast' | 'balanced' | 'thorough' | 'auto';
    maxConcurrency: number;
    enableCaching: boolean;
    enableMetrics: boolean;
    enableSecurity: boolean;
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
  };
}

/**
 * @deprecated Use UnifiedConfigurationManager instead
 */
export class ConfigManager {
  private unifiedManager: UnifiedConfigurationManager;

  constructor() {
    console.warn('⚠️ ConfigManager is deprecated. Use UnifiedConfigurationManager instead.');
    const configLogger = createLogger('UnifiedConfigurationManager');
    this.unifiedManager = new UnifiedConfigurationManager(configLogger);
  }

  async loadConfiguration(): Promise<AppConfig> {
    try {
      await this.unifiedManager.initialize();
      const unified = this.unifiedManager.getConfiguration();

      // Convert unified config to legacy format
      return this.convertToLegacyFormat(unified);
    } catch (error) {
      console.error('Failed to load configuration, using defaults:', error);
      return this.getDefaultConfig();
    }
  }

  private convertToLegacyFormat(unified: UnifiedConfiguration): AppConfig {
    return {
      model: {
        endpoint: unified.model.providers[0]?.endpoint || 'http://localhost:11434',
        name: unified.model.defaultModel || 'qwen2.5-coder:7b',
        timeout: unified.model.timeout || 30000,
        maxTokens: unified.model.maxTokens || 4096,
        temperature: unified.model.temperature || 0.7,
      },
      llmProviders: {
        default: unified.model.defaultProvider || 'ollama',
        providers: this.convertProviders(unified.model.providers),
      },
      agent: {
        enabled: true,
        mode: 'auto',
        maxConcurrency: unified.performance.maxConcurrentRequests || 3,
        enableCaching: unified.performance.enableCaching || true,
        enableMetrics: true, // Default since monitoring not in PerformanceConfiguration
        enableSecurity: unified.security.enableSandbox || true, // Use enableSandbox as security indicator
      },
      voices: {
        default: unified.voice.defaultVoices || ['explorer', 'developer'],
        available: unified.voice.availableVoices || ['explorer', 'maintainer', 'architect'],
        parallel: unified.voice.parallelVoices || true,
        maxConcurrent: unified.voice.maxConcurrentVoices || 3,
      },
      database: {
        path: unified.infrastructure.database.path || './data.db',
        inMemory: unified.infrastructure.database.inMemory || false,
      },
    };
  }

  private convertProviders(providers: any[]): Record<string, any> {
    const result: Record<string, any> = {};

    for (const provider of providers) {
      result[provider.name] = {
        provider: provider.type,
        endpoint: provider.endpoint,
        enabled: provider.enabled,
        models: provider.models,
      };
    }

    return result;
  }

  async getAgentConfig(): Promise<AppConfig> {
    return await this.loadConfiguration();
  }

  private getDefaultConfig(): AppConfig {
    return {
      model: {
        endpoint: 'http://localhost:11434',
        name: 'qwen2.5-coder:7b',
        timeout: 30000,
        maxTokens: 4096,
        temperature: 0.7,
      },
      llmProviders: {
        default: 'ollama',
        providers: {
          ollama: {
            provider: 'ollama',
            endpoint: 'http://localhost:11434',
            enabled: true,
            models: ['qwen2.5-coder:7b', 'deepseek-coder:8b'],
          },
        },
      },
      agent: {
        enabled: true,
        mode: 'auto',
        maxConcurrency: 3,
        enableCaching: true,
        enableMetrics: true,
        enableSecurity: true,
      },
      voices: {
        default: ['explorer', 'developer'],
        available: ['explorer', 'maintainer', 'architect', 'developer', 'analyzer'],
        parallel: true,
        maxConcurrent: 3,
      },
      database: {
        path: './data.db',
        inMemory: false,
      },
    };
  }
}
