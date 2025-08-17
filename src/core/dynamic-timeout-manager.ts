import { logger } from './logger.js';

export interface TimeoutConfig {
  base: number;
  multiplier: number;
  maximum: number;
  minimum: number;
}

export interface TaskComplexityMap {
  simple: TimeoutConfig;
  medium: TimeoutConfig;
  complex: TimeoutConfig;
}

export interface ProviderTimeouts {
  lmstudio: TaskComplexityMap;
  ollama: TaskComplexityMap;
}

/**
 * Dynamic timeout manager that adjusts timeouts based on:
 * - Task complexity
 * - Provider capabilities
 * - Historical performance
 * - System load
 */
export class DynamicTimeoutManager {
  private performanceHistory = new Map<string, number[]>();
  private defaultTimeouts: ProviderTimeouts;
  private adaptiveMode: boolean = true;

  constructor() {
    // Initialize with research-based timeouts
    this.defaultTimeouts = {
      lmstudio: {
        simple: { base: 5000, multiplier: 1.0, maximum: 15000, minimum: 2000 },
        medium: { base: 15000, multiplier: 1.5, maximum: 45000, minimum: 5000 },
        complex: { base: 30000, multiplier: 2.0, maximum: 90000, minimum: 10000 }
      },
      ollama: {
        simple: { base: 30000, multiplier: 1.0, maximum: 60000, minimum: 15000 },
        medium: { base: 60000, multiplier: 1.5, maximum: 120000, minimum: 30000 },
        complex: { base: 120000, multiplier: 2.0, maximum: 300000, minimum: 60000 }
      }
    };

    logger.info('Dynamic timeout manager initialized with adaptive timeouts');
  }

  /**
   * Get timeout for a specific provider and task
   */
  getTimeout(
    provider: 'lmstudio' | 'ollama',
    taskType: string,
    complexity: 'simple' | 'medium' | 'complex' = 'medium',
    modelSize?: string
  ): number {
    const config = this.defaultTimeouts[provider][complexity];
    let timeout = config.base;

    // Adjust based on historical performance
    if (this.adaptiveMode) {
      const historyKey = `${provider}_${taskType}_${complexity}`;
      const history = this.performanceHistory.get(historyKey) || [];
      
      if (history.length > 0) {
        // Use 95th percentile + buffer
        const sorted = [...history].sort((a, b) => a - b);
        const p95Index = Math.floor(sorted.length * 0.95);
        const p95Time = sorted[p95Index] || sorted[sorted.length - 1];
        
        // Add 50% buffer to 95th percentile
        const adaptiveTimeout = Math.ceil(p95Time * 1.5);
        
        // Apply within configured bounds
        timeout = Math.max(
          config.minimum,
          Math.min(config.maximum, adaptiveTimeout)
        );
        
        logger.debug(`Adaptive timeout for ${historyKey}: ${timeout}ms (based on ${history.length} samples)`);
      }
    }

    // Adjust for model size
    if (modelSize) {
      const sizeMultiplier = this.getModelSizeMultiplier(modelSize);
      timeout = Math.ceil(timeout * sizeMultiplier);
    }

    // Apply provider-specific adjustments
    timeout = this.applyProviderAdjustments(provider, timeout, taskType);

    // Ensure within bounds
    timeout = Math.max(config.minimum, Math.min(config.maximum, timeout));

    logger.debug(`Calculated timeout: ${timeout}ms`, {
      provider,
      taskType,
      complexity,
      modelSize,
      adaptive: this.adaptiveMode
    });

    return timeout;
  }

  /**
   * Record performance for adaptive learning
   */
  recordPerformance(
    provider: 'lmstudio' | 'ollama',
    taskType: string,
    complexity: 'simple' | 'medium' | 'complex',
    duration: number,
    success: boolean
  ): void {
    if (!success) {
      return; // Only learn from successful requests
    }

    const historyKey = `${provider}_${taskType}_${complexity}`;
    const history = this.performanceHistory.get(historyKey) || [];
    
    // Add new measurement
    history.push(duration);
    
    // Keep only recent history (last 50 measurements)
    if (history.length > 50) {
      history.shift();
    }
    
    this.performanceHistory.set(historyKey, history);
    
    logger.debug(`Recorded performance: ${duration}ms for ${historyKey} (${history.length} samples)`);
  }

  /**
   * Get model size multiplier based on model name/size
   */
  private getModelSizeMultiplier(modelSize: string): number {
    const size = modelSize.toLowerCase();
    
    // Extract size information
    if (size.includes('34b') || size.includes('30b')) {
      return 2.0; // Large models take longer
    } else if (size.includes('13b') || size.includes('12b')) {
      return 1.5; // Medium models
    } else if (size.includes('7b') || size.includes('8b')) {
      return 1.2; // Small-medium models
    } else if (size.includes('3b') || size.includes('2b')) {
      return 1.0; // Small models
    }
    
    // Default multiplier
    return 1.0;
  }

  /**
   * Apply provider-specific timeout adjustments
   */
  private applyProviderAdjustments(
    provider: 'lmstudio' | 'ollama',
    timeout: number,
    taskType: string
  ): number {
    if (provider === 'lmstudio') {
      // LM Studio specific adjustments
      if (taskType === 'template' || taskType === 'format') {
        return Math.ceil(timeout * 0.8); // Faster for simple tasks
      }
      
      // Add buffer for model loading
      return Math.ceil(timeout * 1.2);
    }
    
    if (provider === 'ollama') {
      // Ollama specific adjustments
      if (taskType === 'analysis' || taskType === 'planning') {
        return Math.ceil(timeout * 1.3); // More time for complex reasoning
      }
      
      // Add buffer for CPU processing
      return Math.ceil(timeout * 1.1);
    }
    
    return timeout;
  }

  /**
   * Get timeout for model loading specifically
   */
  getModelLoadTimeout(
    provider: 'lmstudio' | 'ollama',
    modelName: string,
    isFirstLoad: boolean = false
  ): number {
    const baseTimeout = provider === 'lmstudio' ? 30000 : 60000;
    let timeout = baseTimeout;
    
    // Apply model size multiplier
    timeout *= this.getModelSizeMultiplier(modelName);
    
    // First load takes longer
    if (isFirstLoad) {
      timeout *= 2.0;
    }
    
    // Apply provider-specific limits
    const maxTimeout = provider === 'lmstudio' ? 120000 : 300000;
    timeout = Math.min(timeout, maxTimeout);
    
    logger.debug(`Model load timeout: ${timeout}ms`, {
      provider,
      modelName,
      isFirstLoad
    });
    
    return timeout;
  }

  /**
   * Get streaming timeout
   */
  getStreamingTimeout(provider: 'lmstudio' | 'ollama'): number {
    // Streaming should be faster once started
    return provider === 'lmstudio' ? 30000 : 60000;
  }

  /**
   * Enable or disable adaptive mode
   */
  setAdaptiveMode(enabled: boolean): void {
    this.adaptiveMode = enabled;
    logger.info(`Adaptive timeout mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): Record<string, { count: number; avg: number; p95: number }> {
    const stats: Record<string, { count: number; avg: number; p95: number }> = {};
    
    for (const [key, history] of this.performanceHistory.entries()) {
      if (history.length > 0) {
        const sorted = [...history].sort((a, b) => a - b);
        const avg = history.reduce((sum, val) => sum + val, 0) / history.length;
        const p95Index = Math.floor(sorted.length * 0.95);
        const p95 = sorted[p95Index] || sorted[sorted.length - 1];
        
        stats[key] = {
          count: history.length,
          avg: Math.round(avg),
          p95: Math.round(p95)
        };
      }
    }
    
    return stats;
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.performanceHistory.clear();
    logger.info('Performance history cleared');
  }

  /**
   * Export timeout configuration
   */
  exportConfig(): ProviderTimeouts {
    return JSON.parse(JSON.stringify(this.defaultTimeouts));
  }

  /**
   * Import timeout configuration
   */
  importConfig(config: Partial<ProviderTimeouts>): void {
    this.defaultTimeouts = { ...this.defaultTimeouts, ...config };
    logger.info('Timeout configuration updated');
  }
}

// Global timeout manager instance
export const dynamicTimeoutManager = new DynamicTimeoutManager();