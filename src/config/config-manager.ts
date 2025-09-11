/**
 * Legacy Config Manager - Backward Compatibility Wrapper
 *
 * This is a temporary wrapper around the new UnifiedConfigurationManager
 * to maintain backward compatibility during the architectural migration.
 *
 * @deprecated Use UnifiedConfigurationManager from domain/services instead
 */

import { UnifiedConfigurationManager } from '../domain/config/config-manager.js';
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
    providers: Record<string, unknown>;
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
  private readonly unifiedManager: UnifiedConfigurationManager;

  public constructor() {
    console.warn('⚠️ ConfigManager is deprecated. Use UnifiedConfigurationManager instead.');
    const configLogger = createLogger('UnifiedConfigurationManager');
    this.unifiedManager = new UnifiedConfigurationManager(configLogger);
  }

  public async loadConfiguration(): Promise<AppConfig> {
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

  private convertToLegacyFormat(unified: Readonly<UnifiedConfiguration>): AppConfig {
    return {
      model: {
        endpoint:
          unified.model.providers[0]?.endpoint ??
          process.env.OLLAMA_ENDPOINT ??
          'http://localhost:11434',
        name: unified.model.defaultModel,
        timeout: unified.model.timeout ?? parseInt(process.env.REQUEST_TIMEOUT ?? '30000', 10),
        maxTokens:
          unified.model.maxTokens ?? parseInt(process.env.MODEL_MAX_TOKENS ?? '131072', 10),
        temperature:
          unified.model.temperature ?? parseFloat(process.env.MODEL_TEMPERATURE ?? '0.7'),
      },
      llmProviders: {
        default: unified.model.defaultProvider || 'ollama',
        providers: this.convertProviders(
          unified.model.providers.map(p => ({
            name: p.name ?? '',
            type: p.type ?? '',
            endpoint: p.endpoint ?? '',
            enabled: p.enabled ?? false,
            models: p.models ?? [],
          })) as readonly {
            name: string;
            type: string;
            endpoint: string;
            enabled: boolean;
            models: string[];
          }[]
        ),
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
        default: unified.voice.defaultVoices,
        available: unified.voice.availableVoices ?? ['explorer', 'maintainer', 'architect'],
        parallel: unified.voice.parallelVoices ?? true,
        maxConcurrent: unified.voice.maxConcurrentVoices ?? 3,
      },
      database: {
        path: unified.infrastructure.database.path ?? './data.db',
        inMemory: unified.infrastructure.database.inMemory ?? false,
      },
    };
  }

  private convertProviders(
    providers: readonly {
      name: string;
      type: string;
      endpoint: string;
      enabled: boolean;
      models: string[];
    }[]
  ): Record<string, { provider: string; endpoint: string; enabled: boolean; models: string[] }> {
    const result: Record<
      string,
      { provider: string; endpoint: string; enabled: boolean; models: string[] }
    > = {};

    for (const provider of providers) {
      if (!provider.name) {
        // Skip providers without a valid name
        continue;
      }
      result[provider.name] = {
        provider: provider.type,
        endpoint: provider.endpoint,
        enabled: provider.enabled,
        models: provider.models,
      };
    }

    return result;
  }

  public async getAgentConfig(): Promise<AppConfig> {
    return this.loadConfiguration();
  }

  private getDefaultConfig(): AppConfig {
    return {
      model: {
        endpoint: process.env.OLLAMA_ENDPOINT ?? 'http://localhost:11434',
        name: process.env.MODEL_DEFAULT_NAME ?? 'default',
        timeout: parseInt(process.env.REQUEST_TIMEOUT ?? '30000', 10),
        maxTokens: parseInt(process.env.MODEL_MAX_TOKENS ?? '131072', 10),
        temperature: parseFloat(process.env.MODEL_TEMPERATURE ?? '0.7'),
      },
      llmProviders: {
        default: 'ollama',
        providers: {
          ollama: {
            provider: 'ollama',
            endpoint: 'http://localhost:11434',
            enabled: true,
            models: [
              process.env.MODEL_DEFAULT_NAME, // No hardcoded default - use dynamic selection
              'deepseek-coder:8b',
            ].filter(Boolean),
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
