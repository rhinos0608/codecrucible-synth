/**
 * Model Selection Coordinator - Single Source of Truth for Model Selection
 * Implements audit report recommendations for fixing model inconsistency
 * Created: August 21, 2025
 */

import { EventEmitter } from 'events';
import { createLogger } from './logger.js';
import { ILogger } from '../domain/interfaces/logger.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

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

  // Configuration loaded from .env and unified config - NO HARDCODED VALUES
  private getModelPriority() {
    let llmConfig: any = {};
    
    try {
      // Try to read unified config YAML file
      const configPath = join(process.cwd(), 'config', 'unified-model-config.yaml');
      const configContent = readFileSync(configPath, 'utf8');
      const yamlConfig = YAML.parse(configContent);
      llmConfig = yamlConfig?.llm || {};
    } catch (error) {
      this.logger.warn('Could not read unified-model-config.yaml, using environment defaults');
    }
    
    return {
      ollama: {
        preferred: llmConfig?.providers?.ollama?.models?.preferred || 
          (process.env.MODEL_DEFAULT_NAME ? [process.env.MODEL_DEFAULT_NAME] : []),
        fallback: llmConfig?.providers?.ollama?.models?.fallback || [],
        taskTypes: llmConfig?.providers?.ollama?.optimal_for || [],
      },
      'lm-studio': {
        preferred: llmConfig?.providers?.['lm-studio']?.models?.preferred || [],
        fallback: llmConfig?.providers?.['lm-studio']?.models?.fallback || [],
        taskTypes: llmConfig?.providers?.['lm-studio']?.optimal_for || [],
      },
    };
  }

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
    const modelPriority = this.getModelPriority();
    const providerConfig = modelPriority[provider as keyof typeof modelPriority];
    if (!providerConfig) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    // Find best available model
    let selectedModel: string | undefined;
    let confidence = 1.0;
    let reason = 'Model selected based on availability and task type';

    // Try preferred models first
    for (const preferred of providerConfig.preferred) {
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
    if (!selectedModel && providerConfig.fallback.length > 0) {
      selectedModel = providerConfig.fallback[0];
      confidence = 0.5;
      reason = 'Using fallback model (provider may be unavailable)';
    }

    // If still no model, throw error - no hardcoded fallbacks
    if (!selectedModel) {
      throw new Error(`No models configured for provider ${provider}. Check .env and unified-model-config.yaml`);
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
      this.logger.warn(`No model selected for ${provider}, checking configuration`);
      const modelPriority = this.getModelPriority();
      const providerConfig = modelPriority[provider as keyof typeof modelPriority];
      
      if (providerConfig?.preferred.length > 0) {
        return providerConfig.preferred[0];
      }
      
      // No hardcoded fallback - return undefined or throw error
      throw new Error(`No model configured for provider ${provider}. Check .env and unified-model-config.yaml`);
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
