/**
 * Model Selection Coordinator - Single Source of Truth for Model Selection
 * Implements audit report recommendations for fixing model inconsistency
 * Created: August 21, 2025
 */

import { EventEmitter } from 'events';
import { createLogger } from './logger.js';
import { ILogger } from '../domain/interfaces/logger.js';

export interface ModelSelectionConfig {
  provider: 'ollama' | 'lm-studio' | 'auto';
  model: string;
  reason: string;
  confidence: number;
  taskType?: string;
}

export interface ProviderCapabilities {
  provider: string;
  available: boolean;
  models: string[];
  preferredModels: string[];
  strengths: string[];
  responseTime: string;
}

/**
 * Single authoritative model selection system
 * Resolves conflicts between multiple routing systems
 */
export class ModelSelectionCoordinator extends EventEmitter {
  private logger: ILogger;
  private selectedModels: Map<string, ModelSelectionConfig> = new Map();
  private providerCapabilities: Map<string, ProviderCapabilities> = new Map();
  private routingHistory: ModelSelectionConfig[] = [];

  // Unified configuration (INTELLIGENT FUNCTION CALLING ROUTING)
  private readonly modelPriority = {
    ollama: {
      preferred: [
        'gpt-oss:20b',
        'llama3.1:8b',
        'qwen2.5-coder:7b',
        'qwen2.5-coder:14b',
        'qwen2.5:32b',
      ], // Function calling capable models prioritized
      fallback: ['qwen2.5-coder:3b', 'deepseek-coder:8b', 'llama3.2:latest', 'gemma:latest'],
      taskTypes: ['analysis', 'planning', 'complex', 'multi-file'],
    },
    'lm-studio': {
      preferred: ['codellama-7b-instruct', 'gemma-2b-it'],
      fallback: ['qwen/qwen2.5-coder-14b'],
      taskTypes: ['template', 'edit', 'format', 'boilerplate'],
    },
  };

  constructor() {
    super();
    this.logger = createLogger('ModelSelectionCoordinator');
  }

  /**
   * Select model based on task requirements and provider availability
   * This is the ONLY method that should be used for model selection
   */
  async selectModel(
    provider: string,
    taskType: string,
    availableModels: string[] = []
  ): Promise<ModelSelectionConfig> {
    this.logger.info(`Selecting model for ${provider} - task: ${taskType}`);

    // Check if we already have a selection for this provider
    const existing = this.selectedModels.get(provider);
    if (existing && existing.confidence > 0.8) {
      this.logger.info(`Using cached selection: ${existing.model}`);
      return existing;
    }

    // Determine best model based on unified configuration
    const config = this.modelPriority[provider as keyof typeof this.modelPriority];
    if (!config) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    // Find best available model
    let selectedModel: string | undefined;
    let confidence = 1.0;
    let reason = 'Model selected based on availability and task type';

    // Try preferred models first
    for (const preferred of config.preferred) {
      if (availableModels.length === 0 || availableModels.includes(preferred)) {
        selectedModel = preferred;
        reason = `Preferred model for ${taskType} tasks`;
        break;
      }
    }

    // Fall back to any available model
    if (!selectedModel && availableModels.length > 0) {
      selectedModel = availableModels[0];
      confidence = 0.7;
      reason = 'Using first available model';
    }

    // Use fallback if nothing available
    if (!selectedModel) {
      selectedModel = config.fallback[0];
      confidence = 0.5;
      reason = 'Using fallback model (provider may be unavailable)';
    }

    const selection: ModelSelectionConfig = {
      provider: provider as 'ollama' | 'lm-studio',
      model: selectedModel,
      reason,
      confidence,
      taskType,
    };

    // Cache the selection
    this.selectedModels.set(provider, selection);
    this.routingHistory.push(selection);

    // Emit event for monitoring
    this.emit('model-selected', selection);

    this.logger.info(`Selected ${selectedModel} with confidence ${confidence}: ${reason}`);
    return selection;
  }

  /**
   * Get the currently selected model for a provider
   * Returns consistent model throughout the session
   */
  getSelectedModel(provider: string): string {
    const selection = this.selectedModels.get(provider);
    if (!selection) {
      this.logger.warn(`No model selected for ${provider}, using default`);
      return (
        this.modelPriority[provider as keyof typeof this.modelPriority]?.preferred[0] || 'unknown'
      );
    }
    return selection.model;
  }

  /**
   * Update provider capabilities (called when providers report available models)
   */
  updateProviderCapabilities(provider: string, capabilities: Partial<ProviderCapabilities>): void {
    const existing = this.providerCapabilities.get(provider) || {
      provider,
      available: false,
      models: [],
      preferredModels: [],
      strengths: [],
      responseTime: 'unknown',
    };

    this.providerCapabilities.set(provider, {
      ...existing,
      ...capabilities,
    });

    this.logger.info(`Updated capabilities for ${provider}:`, capabilities);
    this.emit('capabilities-updated', { provider, capabilities });
  }

  /**
   * Determine which provider to use based on task complexity
   * This replaces the conflicting routing logic in multiple places
   */
  async routeToProvider(
    taskType: string,
    complexity: 'simple' | 'complex' | 'auto'
  ): Promise<string> {
    // Simple routing based on task complexity
    if (complexity === 'simple' || ['template', 'edit', 'format'].includes(taskType)) {
      // Check if LM Studio is available
      const lmStudioCap = this.providerCapabilities.get('lm-studio');
      if (lmStudioCap?.available) {
        return 'lm-studio';
      }
    }

    // Default to Ollama for complex tasks or when LM Studio unavailable
    return 'ollama';
  }

  /**
   * Get routing statistics for monitoring
   */
  getRoutingStats(): any {
    const stats = {
      totalRoutings: this.routingHistory.length,
      providerDistribution: {} as Record<string, number>,
      averageConfidence: 0,
      modelUsage: {} as Record<string, number>,
    };

    for (const routing of this.routingHistory) {
      // Provider distribution
      stats.providerDistribution[routing.provider] =
        (stats.providerDistribution[routing.provider] || 0) + 1;

      // Model usage
      stats.modelUsage[routing.model] = (stats.modelUsage[routing.model] || 0) + 1;

      // Confidence sum
      stats.averageConfidence += routing.confidence;
    }

    if (this.routingHistory.length > 0) {
      stats.averageConfidence /= this.routingHistory.length;
    }

    return stats;
  }

  /**
   * Clear cached selections (useful for testing or provider changes)
   */
  clearSelections(): void {
    this.selectedModels.clear();
    this.logger.info('Cleared all cached model selections');
  }

  /**
   * Export current configuration for persistence
   */
  exportConfiguration(): any {
    return {
      selectedModels: Array.from(this.selectedModels.entries()),
      providerCapabilities: Array.from(this.providerCapabilities.entries()),
      routingHistory: this.routingHistory.slice(-100), // Keep last 100 for analysis
    };
  }

  /**
   * Import configuration from persistence
   */
  importConfiguration(config: any): void {
    if (config.selectedModels) {
      this.selectedModels = new Map(config.selectedModels);
    }
    if (config.providerCapabilities) {
      this.providerCapabilities = new Map(config.providerCapabilities);
    }
    if (config.routingHistory) {
      this.routingHistory = config.routingHistory;
    }
    this.logger.info('Imported configuration successfully');
  }
}

// Singleton instance for global access
export const modelCoordinator = new ModelSelectionCoordinator();
