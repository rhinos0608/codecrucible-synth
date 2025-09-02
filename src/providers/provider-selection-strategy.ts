/**
 * Provider Selection Strategy - Extracted from UnifiedModelClient
 * Manages intelligent provider selection and fallback logic following Living Spiral methodology
 *
 * Council Perspectives Applied:
 * - Performance Engineer: Optimal provider selection based on metrics
 * - Maintainer: Reliable fallback chains and strategy consistency
 * - Security Guardian: Safe provider validation and tool support checking
 * - Explorer: Adaptive selection strategies for different scenarios
 * - Architect: Clean separation between selection strategy and execution
 */

import { EventEmitter } from 'events';
import { logger } from '../infrastructure/logging/logger.js';
import { PerformanceMonitor } from '../utils/performance.js';

export type ProviderType = 'ollama' | 'lm-studio' | 'huggingface' | 'auto';
export type ExecutionMode = 'fast' | 'quality' | 'balanced';

export interface ProviderSelectionConfig {
  fallbackChain: ProviderType[];
  selectionStrategy: 'fastest' | 'most-capable' | 'balanced' | 'adaptive';
  timeoutMs: number;
  maxRetries: number;
}

export interface SelectionContext {
  taskType?: string;
  complexity?: string;
  requiresTools?: boolean;
  prioritizeSpeed?: boolean;
  model?: string;
  // Added for intelligent routing system integration
  selectionStrategy?: string;
  phase?: string;
  voiceArchetype?: string;
}

export interface SelectionResult {
  provider: ProviderType;
  reason: string;
  confidence: number;
  fallbackChain: ProviderType[];
}

export interface IProviderSelectionStrategy {
  selectProvider(context: SelectionContext): SelectionResult;
  createFallbackChain(primaryProvider: ProviderType, context: SelectionContext): ProviderType[];
  validateProviderForContext(provider: ProviderType, context: SelectionContext): boolean;
}

export class ProviderSelectionStrategy extends EventEmitter implements IProviderSelectionStrategy {
  private config: ProviderSelectionConfig;
  private performanceMonitor: PerformanceMonitor;

  constructor(config: ProviderSelectionConfig, performanceMonitor: PerformanceMonitor) {
    super();
    this.config = config;
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * Select optimal provider based on context and strategy
   */
  selectProvider(context: SelectionContext): SelectionResult {
    logger.debug('Selecting provider with context:', context);

    let selectedProvider: ProviderType;
    let reason: string;
    let confidence: number;

    // Check if specific provider needed for tools
    if (context.requiresTools) {
      const toolCapableProvider = this.selectToolCapableProvider(context.model);
      if (toolCapableProvider) {
        selectedProvider = toolCapableProvider;
        reason = 'Selected for tool support capability';
        confidence = 0.9;
      } else {
        selectedProvider = 'lm-studio'; // Default for tools
        reason = 'Default tool-capable provider';
        confidence = 0.7;
      }
    } else {
      // Select based on strategy
      switch (this.config.selectionStrategy) {
        case 'fastest':
          selectedProvider = this.selectFastestProvider();
          reason = 'Selected fastest available provider';
          confidence = 0.8;
          break;

        case 'most-capable':
          selectedProvider = this.selectMostCapableProvider();
          reason = 'Selected most capable provider';
          confidence = 0.85;
          break;

        case 'balanced':
          selectedProvider = this.selectBalancedProvider();
          reason = 'Selected balanced speed/quality provider';
          confidence = 0.8;
          break;

        case 'adaptive':
          const adaptiveResult = this.selectAdaptiveProvider(context);
          selectedProvider = adaptiveResult.provider;
          reason = adaptiveResult.reason;
          confidence = adaptiveResult.confidence;
          break;

        default:
          selectedProvider = this.config.fallbackChain[0];
          reason = 'Default fallback provider';
          confidence = 0.6;
      }
    }

    const fallbackChain = this.createFallbackChain(selectedProvider, context);

    const result: SelectionResult = {
      provider: selectedProvider,
      reason,
      confidence,
      fallbackChain,
    };

    this.emit('providerSelected', result);
    logger.debug(`Provider selected: ${selectedProvider} (${reason})`);

    return result;
  }

  /**
   * Create fallback chain prioritizing the selected provider
   */
  createFallbackChain(primaryProvider: ProviderType, context: SelectionContext): ProviderType[] {
    const fallbackChain =
      primaryProvider === 'auto'
        ? [...this.config.fallbackChain]
        : [primaryProvider, ...this.config.fallbackChain.filter(p => p !== primaryProvider)];

    // Filter out providers that don't support the required context
    return fallbackChain.filter(provider => this.validateProviderForContext(provider, context));
  }

  /**
   * Validate if provider can handle the given context
   */
  validateProviderForContext(provider: ProviderType, context: SelectionContext): boolean {
    // Check tool support requirement
    if (context.requiresTools && !this.modelSupportsTools(provider, context.model)) {
      return false;
    }

    // Add other validation logic as needed
    return true;
  }

  /**
   * Select provider optimized for speed
   */
  private selectFastestProvider(): ProviderType {
    const metrics = this.performanceMonitor.getProviderMetrics();
    const sortedBySpeed = Object.entries(metrics).sort(
      ([, a], [, b]) => a.averageLatency - b.averageLatency
    );

    return (sortedBySpeed[0]?.[0] as ProviderType) || this.config.fallbackChain[0];
  }

  /**
   * Select most capable provider based on success rate and quality
   */
  private selectMostCapableProvider(): ProviderType {
    const metrics = this.performanceMonitor.getProviderMetrics();
    const sortedByQuality = Object.entries(metrics).sort(
      ([, a], [, b]) => b.successRate - a.successRate
    );

    return (sortedByQuality[0]?.[0] as ProviderType) || this.config.fallbackChain[0];
  }

  /**
   * Select provider with best balance of speed and quality
   */
  private selectBalancedProvider(): ProviderType {
    const metrics = this.performanceMonitor.getProviderMetrics();
    const scored = Object.entries(metrics).map(([provider, stats]) => ({
      provider,
      score: stats.successRate * 0.6 + (1 - stats.averageLatency / 30000) * 0.4,
    }));

    scored.sort((a, b) => b.score - a.score);
    return (scored[0]?.provider as ProviderType) || this.config.fallbackChain[0];
  }

  /**
   * Adaptive provider selection based on context
   */
  private selectAdaptiveProvider(context: SelectionContext): {
    provider: ProviderType;
    reason: string;
    confidence: number;
  } {
    // High complexity tasks -> most capable
    if (context.complexity === 'complex') {
      return {
        provider: this.selectMostCapableProvider(),
        reason: 'Complex task requires most capable provider',
        confidence: 0.9,
      };
    }

    // Speed priority -> fastest
    if (context.prioritizeSpeed || context.complexity === 'simple') {
      return {
        provider: this.selectFastestProvider(),
        reason: 'Speed prioritized or simple task',
        confidence: 0.85,
      };
    }

    // Default to balanced
    return {
      provider: this.selectBalancedProvider(),
      reason: 'Balanced selection for medium complexity',
      confidence: 0.8,
    };
  }

  /**
   * Find provider capable of handling tools
   */
  private selectToolCapableProvider(model?: string): ProviderType | null {
    // Check each provider for tool support
    for (const provider of this.config.fallbackChain) {
      if (this.modelSupportsTools(provider, model)) {
        return provider;
      }
    }
    return null;
  }

  /**
   * Check if provider/model combination supports tools
   */
  private modelSupportsTools(provider: ProviderType, model?: string): boolean {
    if (provider === 'lm-studio') {
      return true; // LM Studio generally supports OpenAI-compatible function calling
    }

    if (provider === 'ollama') {
      // If no specific model provided, assume auto-selection will pick a supported model
      if (!model) {
        logger.debug(
          'No specific model provided, assuming auto-selection will pick supported model'
        );
        return true; // Trust that auto-selection picks qwen2.5-coder which supports tools
      }

      // Only certain Ollama models support function calling
      const model_name = model.toLowerCase();
      const supportedModels = [
        'llama3',
        'llama3.1',
        'llama3.2',
        'qwen2.5',
        'qwq',
        'mistral',
        'codellama',
      ];

      const isSupported = supportedModels.some(supportedModel =>
        model_name.includes(supportedModel)
      );
      logger.debug('Model tool support check', { model: model_name, isSupported });
      return isSupported;
    }

    return false; // Conservative default - no tools for unknown providers
  }

  /**
   * Get current selection metrics
   */
  getSelectionMetrics(): any {
    return {
      strategy: this.config.selectionStrategy,
      fallbackChain: this.config.fallbackChain,
      providerMetrics: this.performanceMonitor.getProviderMetrics(),
    };
  }

  /**
   * Update selection strategy
   */
  updateStrategy(strategy: ProviderSelectionConfig['selectionStrategy']): void {
    logger.info(`Updating provider selection strategy to: ${strategy}`);
    this.config.selectionStrategy = strategy;
    this.emit('strategyUpdated', { strategy });
  }

  /**
   * Update fallback chain
   */
  updateFallbackChain(fallbackChain: ProviderType[]): void {
    logger.info(`Updating fallback chain to: ${fallbackChain.join(' -> ')}`);
    this.config.fallbackChain = fallbackChain;
    this.emit('fallbackChainUpdated', { fallbackChain });
  }
}
