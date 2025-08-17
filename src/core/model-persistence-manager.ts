import { logger } from './logger.js';
import axios from 'axios';

export interface ModelStatus {
  name: string;
  loaded: boolean;
  lastUsed: number;
  loadTime: number;
  memoryUsage: number;
  loadCount: number;
}

export interface PersistenceConfig {
  maxLoadedModels: number;
  modelTtl: number; // Time to live in ms
  preloadEnabled: boolean;
  smartEviction: boolean;
  persistentModels: string[]; // Always keep loaded
}

/**
 * Advanced model persistence manager for optimal performance
 * Implements intelligent model caching, preloading, and eviction
 */
export class ModelPersistenceManager {
  private modelStatus = new Map<string, ModelStatus>();
  private preloadQueue: string[] = [];
  private isPreloading = false;
  private config: PersistenceConfig;
  private lmStudioEndpoint: string;
  private ollamaEndpoint: string;

  constructor(config: Partial<PersistenceConfig> = {}) {
    this.config = {
      maxLoadedModels: config.maxLoadedModels || 2,
      modelTtl: config.modelTtl || 300000, // 5 minutes
      preloadEnabled: config.preloadEnabled !== false,
      smartEviction: config.smartEviction !== false,
      persistentModels: config.persistentModels || []
    };

    this.lmStudioEndpoint = 'http://localhost:1234';
    this.ollamaEndpoint = 'http://localhost:11434';

    logger.info('Model persistence manager initialized', this.config);
    
    if (this.config.preloadEnabled) {
      this.startPeriodicMaintenance();
    }
  }

  /**
   * Ensure a model is loaded and ready
   */
  async ensureModelLoaded(provider: 'lmstudio' | 'ollama', modelName: string): Promise<boolean> {
    const key = `${provider}:${modelName}`;
    const status = this.modelStatus.get(key);

    // Check if model is already loaded and fresh
    if (status?.loaded && this.isModelFresh(status)) {
      logger.debug(`Model ${modelName} already loaded and fresh`);
      this.updateLastUsed(key);
      return true;
    }

    // Load the model
    return this.loadModel(provider, modelName);
  }

  /**
   * Load a model with intelligent persistence
   */
  private async loadModel(provider: 'lmstudio' | 'ollama', modelName: string): Promise<boolean> {
    const key = `${provider}:${modelName}`;
    const startTime = Date.now();

    try {
      // Check if we need to evict models first
      await this.enforceModelLimits(provider);

      logger.info(`Loading model: ${modelName} (${provider})`);

      let success = false;
      if (provider === 'lmstudio') {
        success = await this.loadLMStudioModel(modelName);
      } else {
        success = await this.loadOllamaModel(modelName);
      }

      const loadTime = Date.now() - startTime;

      if (success) {
        // Update model status
        const status: ModelStatus = {
          name: modelName,
          loaded: true,
          lastUsed: Date.now(),
          loadTime,
          memoryUsage: this.estimateMemoryUsage(modelName),
          loadCount: (this.modelStatus.get(key)?.loadCount || 0) + 1
        };

        this.modelStatus.set(key, status);
        logger.info(`Model ${modelName} loaded successfully in ${loadTime}ms`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Failed to load model ${modelName}:`, error);
      return false;
    }
  }

  /**
   * Load LM Studio model using direct API
   */
  private async loadLMStudioModel(modelName: string): Promise<boolean> {
    try {
      // Send a minimal request to trigger model loading
      const response = await axios.post(`${this.lmStudioEndpoint}/v1/chat/completions`, {
        model: modelName,
        messages: [{ role: 'user', content: 'load' }],
        max_tokens: 1,
        temperature: 0
      }, {
        timeout: 120000 // 2 minutes for model loading
      });

      return response.status === 200;
    } catch (error) {
      logger.debug(`LM Studio model load failed: ${error}`);
      return false;
    }
  }

  /**
   * Load Ollama model using direct API
   */
  private async loadOllamaModel(modelName: string): Promise<boolean> {
    try {
      // Use Ollama's generate endpoint to trigger model loading
      const response = await axios.post(`${this.ollamaEndpoint}/api/generate`, {
        model: modelName,
        prompt: 'load',
        stream: false,
        options: {
          num_predict: 1,
          temperature: 0
        }
      }, {
        timeout: 180000 // 3 minutes for CPU model loading
      });

      return response.status === 200;
    } catch (error) {
      logger.debug(`Ollama model load failed: ${error}`);
      return false;
    }
  }

  /**
   * Preload high-priority models
   */
  async preloadModels(models: string[], provider: 'lmstudio' | 'ollama'): Promise<void> {
    if (!this.config.preloadEnabled || this.isPreloading) {
      return;
    }

    this.isPreloading = true;
    logger.info(`Preloading ${models.length} models for ${provider}`);

    for (const model of models) {
      try {
        await this.ensureModelLoaded(provider, model);
        // Small delay between preloads to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.warn(`Failed to preload model ${model}:`, error);
      }
    }

    this.isPreloading = false;
    logger.info(`Preloading completed for ${provider}`);
  }

  /**
   * Enforce model loading limits with intelligent eviction
   */
  private async enforceModelLimits(provider: 'lmstudio' | 'ollama'): Promise<void> {
    const loadedModels = Array.from(this.modelStatus.entries())
      .filter(([key, status]) => key.startsWith(provider) && status.loaded);

    if (loadedModels.length >= this.config.maxLoadedModels) {
      // Find the best candidate for eviction
      const candidate = this.selectEvictionCandidate(loadedModels);
      if (candidate) {
        await this.evictModel(candidate[0]);
      }
    }
  }

  /**
   * Select the best model for eviction using smart criteria
   */
  private selectEvictionCandidate(loadedModels: [string, ModelStatus][]): [string, ModelStatus] | null {
    if (loadedModels.length === 0) return null;

    // Filter out persistent models
    const evictableModels = loadedModels.filter(([key, status]) => {
      const modelName = status.name;
      return !this.config.persistentModels.includes(modelName);
    });

    if (evictableModels.length === 0) return null;

    // Smart eviction criteria:
    // 1. Least recently used
    // 2. Not frequently accessed
    // 3. Older models
    const scoredModels = evictableModels.map(([key, status]) => {
      const timeSinceUsed = Date.now() - status.lastUsed;
      const frequency = status.loadCount;
      const age = Date.now() - (status.lastUsed - status.loadTime);

      // Higher score = better candidate for eviction
      const score = (timeSinceUsed * 0.5) + (age * 0.3) - (frequency * 1000);
      
      return { key, status, score };
    });

    // Sort by eviction score (highest first)
    scoredModels.sort((a, b) => b.score - a.score);
    
    const candidate = scoredModels[0];
    return [candidate.key, candidate.status];
  }

  /**
   * Evict a model from memory
   */
  private async evictModel(key: string): Promise<void> {
    const status = this.modelStatus.get(key);
    if (!status) return;

    logger.info(`Evicting model: ${status.name}`);
    
    // Mark as unloaded
    status.loaded = false;
    this.modelStatus.set(key, status);

    // Note: Most model servers don't have explicit unload APIs
    // The model will be garbage collected naturally
  }

  /**
   * Check if a model is still fresh (within TTL)
   */
  private isModelFresh(status: ModelStatus): boolean {
    const age = Date.now() - status.lastUsed;
    return age < this.config.modelTtl;
  }

  /**
   * Update last used timestamp
   */
  private updateLastUsed(key: string): void {
    const status = this.modelStatus.get(key);
    if (status) {
      status.lastUsed = Date.now();
      this.modelStatus.set(key, status);
    }
  }

  /**
   * Estimate memory usage for a model
   */
  private estimateMemoryUsage(modelName: string): number {
    const name = modelName.toLowerCase();
    
    // Rough memory estimates in MB
    if (name.includes('34b') || name.includes('30b')) return 20000;
    if (name.includes('13b') || name.includes('12b')) return 8000;
    if (name.includes('7b') || name.includes('8b')) return 4000;
    if (name.includes('3b') || name.includes('2b')) return 2000;
    
    return 4000; // Default estimate
  }

  /**
   * Start periodic maintenance tasks
   */
  private startPeriodicMaintenance(): void {
    // Clean up stale models every 5 minutes
    setInterval(() => {
      this.cleanupStaleModels();
    }, 300000);

    // Preload priority models every 10 minutes
    setInterval(() => {
      this.maintainPriorityModels();
    }, 600000);

    logger.info('Periodic maintenance started');
  }

  /**
   * Clean up models that exceed TTL
   */
  private cleanupStaleModels(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, status] of this.modelStatus.entries()) {
      if (status.loaded && (now - status.lastUsed) > this.config.modelTtl) {
        // Don't evict persistent models
        if (!this.config.persistentModels.includes(status.name)) {
          this.evictModel(key);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} stale models`);
    }
  }

  /**
   * Maintain priority models in loaded state
   */
  private async maintainPriorityModels(): Promise<void> {
    for (const modelName of this.config.persistentModels) {
      const lmKey = `lmstudio:${modelName}`;
      const ollamaKey = `ollama:${modelName}`;

      // Check both providers
      const lmStatus = this.modelStatus.get(lmKey);
      const ollamaStatus = this.modelStatus.get(ollamaKey);

      if (lmStatus && !lmStatus.loaded) {
        await this.loadModel('lmstudio', modelName);
      }
      if (ollamaStatus && !ollamaStatus.loaded) {
        await this.loadModel('ollama', modelName);
      }
    }
  }

  /**
   * Get current model status
   */
  getModelStatus(): Record<string, ModelStatus> {
    const status: Record<string, ModelStatus> = {};
    for (const [key, modelStatus] of this.modelStatus.entries()) {
      status[key] = { ...modelStatus };
    }
    return status;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    totalModels: number;
    loadedModels: number;
    averageLoadTime: number;
    totalMemoryUsage: number;
  } {
    const allModels = Array.from(this.modelStatus.values());
    const loadedModels = allModels.filter(m => m.loaded);
    
    const avgLoadTime = allModels.length > 0 
      ? allModels.reduce((sum, m) => sum + m.loadTime, 0) / allModels.length
      : 0;
      
    const totalMemory = loadedModels.reduce((sum, m) => sum + m.memoryUsage, 0);

    return {
      totalModels: allModels.length,
      loadedModels: loadedModels.length,
      averageLoadTime: Math.round(avgLoadTime),
      totalMemoryUsage: totalMemory
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PersistenceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Model persistence configuration updated', newConfig);
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    // Clear all intervals
    // Note: In production, you'd want to track interval IDs
    this.modelStatus.clear();
    this.preloadQueue = [];
    logger.info('Model persistence manager disposed');
  }
}

// Global instance
export const modelPersistenceManager = new ModelPersistenceManager({
  maxLoadedModels: 2,
  modelTtl: 600000, // 10 minutes
  preloadEnabled: true,
  smartEviction: true,
  persistentModels: ['gemma:latest', 'codellama:7b'] // Keep these loaded
});