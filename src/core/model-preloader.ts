/**
 * Model Preloader for Ollama
 * 
 * Handles model preloading, warm-up, and keep-alive to eliminate timeout issues.
 * Ensures models are ready before autonomous agent processing begins.
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from './logger.js';
import chalk from 'chalk';

export interface ModelInfo {
  name: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
  modified_at: string;
}

export interface PreloadStatus {
  model: string;
  status: 'not_loaded' | 'loading' | 'loaded' | 'failed';
  loadTime?: number;
  lastUsed?: number;
  isWarm: boolean;
  error?: string;
}

export interface PreloadConfig {
  endpoint: string;
  primaryModels: string[];
  fallbackModels: string[];
  maxConcurrentLoads: number;
  warmupPrompt: string;
  keepAliveTime: string; // e.g., "10m"
  retryAttempts: number;
  loadTimeout: number;
}

export class ModelPreloader {
  private client: AxiosInstance;
  private config: PreloadConfig;
  private modelStatus = new Map<string, PreloadStatus>();
  private loadingPromises = new Map<string, Promise<boolean>>();
  private keepAliveTimers = new Map<string, NodeJS.Timeout>();
  private availableModels: ModelInfo[] = [];

  constructor(config: Partial<PreloadConfig> = {}) {
    this.config = {
      endpoint: 'http://localhost:11434',
      primaryModels: ['gemma:latest', 'gemma:2b', 'llama3.2:latest'],
      fallbackModels: ['gemma:latest'],
      maxConcurrentLoads: 2,
      warmupPrompt: 'Hello, test response',
      keepAliveTime: '10m',
      retryAttempts: 3,
      loadTimeout: 60000, // 60 seconds
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.endpoint,
      timeout: this.config.loadTimeout,
      headers: { 'Content-Type': 'application/json' }
    });

    logger.info('🔄 Model Preloader initialized', {
      endpoint: this.config.endpoint,
      primaryModels: this.config.primaryModels.length,
      fallbackModels: this.config.fallbackModels.length
    });
  }

  /**
   * Initialize preloading system
   */
  async initialize(): Promise<void> {
    console.log(chalk.cyan('🚀 Initializing Model Preloader...'));
    
    try {
      // Discover available models
      await this.discoverModels();
      
      // Preload primary models
      await this.preloadPrimaryModels();
      
      // Setup keep-alive system
      this.setupKeepAlive();
      
      console.log(chalk.green('✅ Model Preloader initialization complete'));
      
    } catch (error) {
      logger.error('Model preloader initialization failed:', error);
      console.log(chalk.red('❌ Model preloader initialization failed'));
      throw error;
    }
  }

  /**
   * Discover available models from Ollama
   */
  private async discoverModels(): Promise<void> {
    try {
      console.log(chalk.dim('   🔍 Discovering available models...'));
      
      const response = await this.client.get('/api/tags');
      this.availableModels = response.data.models || [];
      
      console.log(chalk.green(`   📦 Found ${this.availableModels.length} available models`));
      
      // Initialize status for all models
      this.availableModels.forEach(model => {
        this.modelStatus.set(model.name, {
          model: model.name,
          status: 'not_loaded',
          isWarm: false
        });
      });
      
      // Log available models for debugging
      this.availableModels.forEach(model => {
        const size = this.formatBytes(model.size);
        logger.debug(`Available model: ${model.name} (${size})`);
      });
      
    } catch (error) {
      logger.error('Failed to discover models:', error);
      throw new Error('Could not connect to Ollama or discover models');
    }
  }

  /**
   * Preload primary models in parallel
   */
  private async preloadPrimaryModels(): Promise<void> {
    console.log(chalk.cyan('   🔄 Preloading primary models...'));
    
    // Filter to only available models
    const modelsToLoad = this.config.primaryModels.filter(modelName =>
      this.availableModels.some(m => m.name === modelName)
    );

    if (modelsToLoad.length === 0) {
      console.log(chalk.yellow('   ⚠️ No primary models available, using fallbacks'));
      return;
    }

    // Load models with concurrency control
    const results = await this.loadModelsWithConcurrency(modelsToLoad);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(chalk.green(`   ✅ Preloaded ${successful}/${modelsToLoad.length} models`));
    
    if (failed > 0) {
      console.log(chalk.yellow(`   ⚠️ ${failed} models failed to preload`));
    }
  }

  /**
   * Load models with concurrency control
   */
  private async loadModelsWithConcurrency(models: string[]): Promise<Array<{model: string, success: boolean}>> {
    const results: Array<{model: string, success: boolean}> = [];
    const activeLoads: Promise<{model: string, success: boolean}>[] = [];

    for (const model of models) {
      // Wait if we've hit concurrency limit
      if (activeLoads.length >= this.config.maxConcurrentLoads) {
        const completed = await Promise.race(activeLoads);
        results.push(completed);
        
        // Remove completed promise
        const index = activeLoads.findIndex(p => p === Promise.resolve(completed));
        if (index > -1) activeLoads.splice(index, 1);
      }

      // Start loading this model
      const loadPromise = this.loadSingleModel(model);
      activeLoads.push(loadPromise);
    }

    // Wait for remaining loads
    const remaining = await Promise.all(activeLoads);
    results.push(...remaining);

    return results;
  }

  /**
   * Load a single model with retries
   */
  private async loadSingleModel(modelName: string): Promise<{model: string, success: boolean}> {
    if (this.loadingPromises.has(modelName)) {
      const success = await this.loadingPromises.get(modelName)!;
      return { model: modelName, success };
    }

    const loadPromise = this.performModelLoad(modelName);
    this.loadingPromises.set(modelName, loadPromise);

    try {
      const success = await loadPromise;
      return { model: modelName, success };
    } finally {
      this.loadingPromises.delete(modelName);
    }
  }

  /**
   * Perform the actual model loading
   */
  private async performModelLoad(modelName: string): Promise<boolean> {
    const status = this.modelStatus.get(modelName);
    if (!status) return false;

    status.status = 'loading';
    const startTime = Date.now();

    console.log(chalk.dim(`      🔄 Loading ${modelName}...`));

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // Load the model with a simple generation
        await this.client.post('/api/generate', {
          model: modelName,
          prompt: this.config.warmupPrompt,
          stream: false,
          options: {
            num_predict: 1,
            temperature: 0.1
          },
          keep_alive: this.config.keepAliveTime
        });

        // Model loaded successfully
        const loadTime = Date.now() - startTime;
        status.status = 'loaded';
        status.loadTime = loadTime;
        status.lastUsed = Date.now();
        status.isWarm = true;

        console.log(chalk.green(`      ✅ ${modelName} loaded in ${loadTime}ms`));
        logger.info(`Model ${modelName} preloaded successfully`, { loadTime, attempt });

        return true;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.warn(`Model ${modelName} load attempt ${attempt} failed:`, errorMessage);

        if (attempt < this.config.retryAttempts) {
          // Exponential backoff
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(chalk.dim(`      ⏳ Retrying ${modelName} in ${delay}ms...`));
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    status.status = 'failed';
    status.error = 'Failed to load after all retry attempts';
    
    console.log(chalk.red(`      ❌ Failed to load ${modelName}`));
    return false;
  }

  /**
   * Setup keep-alive system for loaded models
   */
  private setupKeepAlive(): void {
    // Send keep-alive pings every 5 minutes for loaded models
    const keepAliveInterval = 5 * 60 * 1000; // 5 minutes

    setInterval(async () => {
      const loadedModels = Array.from(this.modelStatus.entries())
        .filter(([_, status]) => status.status === 'loaded')
        .map(([model, _]) => model);

      for (const model of loadedModels) {
        try {
          await this.client.post('/api/generate', {
            model,
            prompt: '',
            stream: false,
            options: { num_predict: 0 },
            keep_alive: this.config.keepAliveTime
          });

          const status = this.modelStatus.get(model)!;
          status.lastUsed = Date.now();
          status.isWarm = true;

          logger.debug(`Keep-alive sent for model: ${model}`);

        } catch (error) {
          logger.warn(`Keep-alive failed for model: ${model}`, error);
          
          const status = this.modelStatus.get(model)!;
          status.isWarm = false;
        }
      }
    }, keepAliveInterval);

    logger.info('Keep-alive system initialized', { intervalMs: keepAliveInterval });
  }

  /**
   * Get the best available model (preloaded and warm)
   */
  getBestAvailableModel(): string | null {
    // First try primary models that are loaded and warm
    for (const model of this.config.primaryModels) {
      const status = this.modelStatus.get(model);
      if (status?.status === 'loaded' && status.isWarm) {
        return model;
      }
    }

    // Then try any loaded and warm model
    for (const [model, status] of this.modelStatus.entries()) {
      if (status.status === 'loaded' && status.isWarm) {
        return model;
      }
    }

    // Then try any loaded model
    for (const [model, status] of this.modelStatus.entries()) {
      if (status.status === 'loaded') {
        return model;
      }
    }

    // Fallback to first available model
    if (this.availableModels.length > 0) {
      return this.availableModels[0].name;
    }

    return null;
  }

  /**
   * Ensure a specific model is loaded and warm
   */
  async ensureModelReady(modelName: string): Promise<boolean> {
    const status = this.modelStatus.get(modelName);
    
    if (!status) {
      logger.warn(`Model ${modelName} not found in available models`);
      return false;
    }

    if (status.status === 'loaded' && status.isWarm) {
      return true;
    }

    if (status.status === 'loading') {
      // Wait for ongoing load
      const loadPromise = this.loadingPromises.get(modelName);
      if (loadPromise) {
        return await loadPromise;
      }
    }

    // Load the model
    console.log(chalk.cyan(`🔄 Ensuring ${modelName} is ready...`));
    const result = await this.loadSingleModel(modelName);
    return result.success;
  }

  /**
   * Get preloading status report
   */
  getStatusReport(): {
    totalModels: number;
    loadedModels: number;
    warmModels: number;
    failedModels: number;
    bestModel: string | null;
    statusDetails: PreloadStatus[];
  } {
    const statusArray = Array.from(this.modelStatus.values());
    
    return {
      totalModels: this.availableModels.length,
      loadedModels: statusArray.filter(s => s.status === 'loaded').length,
      warmModels: statusArray.filter(s => s.isWarm).length,
      failedModels: statusArray.filter(s => s.status === 'failed').length,
      bestModel: this.getBestAvailableModel(),
      statusDetails: statusArray
    };
  }

  /**
   * Display status in console
   */
  displayStatus(): void {
    const report = this.getStatusReport();
    
    console.log(chalk.cyan('\n📊 Model Preloader Status:'));
    console.log(chalk.white(`   Total Models: ${report.totalModels}`));
    console.log(chalk.green(`   Loaded: ${report.loadedModels}`));
    console.log(chalk.blue(`   Warm: ${report.warmModels}`));
    console.log(chalk.red(`   Failed: ${report.failedModels}`));
    console.log(chalk.yellow(`   Best Model: ${report.bestModel || 'None'}`));

    if (report.statusDetails.length > 0) {
      console.log(chalk.dim('\n   Detailed Status:'));
      report.statusDetails.forEach(status => {
        const statusIcon = {
          'loaded': '✅',
          'loading': '🔄',
          'failed': '❌',
          'not_loaded': '⏳'
        }[status.status];
        
        const warmIcon = status.isWarm ? '🔥' : '❄️';
        const loadTime = status.loadTime ? `${status.loadTime}ms` : 'N/A';
        
        console.log(chalk.dim(`      ${statusIcon} ${warmIcon} ${status.model} (${loadTime})`));
      });
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Clear all timers
    this.keepAliveTimers.forEach(timer => clearTimeout(timer));
    this.keepAliveTimers.clear();
    
    logger.info('Model preloader cleanup completed');
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}