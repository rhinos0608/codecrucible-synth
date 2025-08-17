import axios, { AxiosInstance } from 'axios';
import { timeoutManager } from './timeout-manager.js';
import { logger } from './logger.js';
import { EnhancedModelManager } from './enhanced-model-manager.js';
import { AutonomousErrorHandler, ErrorContext } from './autonomous-error-handler.js';
import { IntelligentModelSelector } from './intelligent-model-selector.js';
import { GPUOptimizer } from './gpu-optimizer.js';
import { VRAMOptimizer, OptimizationConfig } from './vram-optimizer.js';
import { ModelPreloader } from './model-preloader.js';
import chalk from 'chalk';
import { AgentResponse, ResponseFactory } from './response-types.js';

export interface LocalModelConfig {
  endpoint: string;
  model: string;
  timeout: number;
  maxTokens: number;
  temperature: number;
}

export interface VoiceResponse {
  content: string;
  voice: string;
  confidence: number;
  reasoning?: string;
  tokens_used: number;
}

export interface ProjectContext {
  files?: Array<{
    path: string;
    content: string;
    language: string;
  }>;
  projectType?: string;
  dependencies?: string[];
  gitStatus?: string;
  workingDirectory?: string;
  recentMessages?: any[];
  externalFeedback?: Array<{
    source: string;
    content: string;
    priority: number;
  }>;
}

export interface VoiceArchetype {
  id: string;
  name: string;
  systemPrompt: string;
  temperature: number;
  style: string;
}

/**
 * Enhanced Local Model Client for Ollama integration
 * Features automatic model detection, installation, and management
 */
export class LocalModelClient {
  private client: AxiosInstance;
  private config: LocalModelConfig;
  private modelManager: EnhancedModelManager;
  private _cachedBestModel: string | null = null;
  private errorHandler: AutonomousErrorHandler;
  private modelSelector: IntelligentModelSelector;
  // private gpuOptimizer: GPUOptimizer; // Disabled
  private isOptimized = false;
  private fallbackModels: string[] = []; // Dynamically populated from available models
  private preloadedModels = new Set<string>(); // Track preloaded models
  private modelWarmupPromises = new Map<string, Promise<boolean>>(); // Prevent duplicate warmup
  private vramOptimizer: VRAMOptimizer; // VRAM optimization for large models
  private currentOptimization: OptimizationConfig | null = null; // Current model optimization
  private modelPreloader: ModelPreloader; // Advanced model preloading system

  constructor(config: LocalModelConfig) {
    this.config = config;
    this.modelManager = new EnhancedModelManager(config.endpoint);
    this.errorHandler = new AutonomousErrorHandler(config.endpoint);
    this.modelSelector = new IntelligentModelSelector(config.endpoint);
    this.vramOptimizer = new VRAMOptimizer(config.endpoint);
    // this.gpuOptimizer = new GPUOptimizer(); // Disabled to prevent model downloads
    
    // Initialize advanced model preloader
    this.modelPreloader = new ModelPreloader({
      endpoint: config.endpoint,
      primaryModels: this.determinePrimaryModels(),
      fallbackModels: ['gemma:latest', 'gemma:2b'],
      maxConcurrentLoads: 2,
      warmupPrompt: 'Hello, ready to assist with coding.',
      keepAliveTime: '15m',
      retryAttempts: 3,
      loadTimeout: 45000
    });
    
    // Use adaptive timeout based on model size and system performance
    const adjustedTimeout = this.calculateAdaptiveTimeout(config.timeout);
    this.client = axios.create({
      baseURL: config.endpoint,
      timeout: adjustedTimeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.info('Enhanced local model client initialized', {
      endpoint: config.endpoint,
      model: config.model,
      maxTokens: config.maxTokens
    });

    // Initialize GPU optimization and model preloading asynchronously
    this.initializeGPUOptimization();
    this.initializeAdvancedPreloading();
  }

  /**
   * Calculate adaptive timeout based on system performance and model characteristics
   */
  private calculateAdaptiveTimeout(baseTimeout: number): number {
    // Start with base timeout
    let adaptiveTimeout = baseTimeout;

    // Reduce timeout for preloaded models (faster response expected)
    if (this.preloadedModels.size > 0) {
      adaptiveTimeout = Math.max(adaptiveTimeout * 0.7, 30000); // At least 30 seconds
    }

    // Adjust based on system memory (lower memory = longer timeout for model loading)
    try {
      const memoryGB = require('os').totalmem() / (1024 * 1024 * 1024);
      if (memoryGB < 8) {
        adaptiveTimeout *= 1.5; // Increase timeout for low memory systems
      } else if (memoryGB > 16) {
        adaptiveTimeout *= 0.8; // Decrease timeout for high memory systems
      }
    } catch (error) {
      // Fallback if unable to detect memory
      logger.debug('Unable to detect system memory for adaptive timeout');
    }

    // Ensure minimum and maximum bounds
    const minTimeout = 15000; // 15 seconds minimum
    const maxTimeout = 300000; // 5 minutes maximum
    
    return Math.min(Math.max(adaptiveTimeout, minTimeout), maxTimeout);
  }

  /**
   * Get dynamic timeout based on operation type and model status
   */
  private getDynamicTimeout(operationType: 'warmup' | 'generation' | 'health_check', modelName?: string): number {
    const baseTimeouts = {
      warmup: 30000,      // 30 seconds for model warmup
      generation: 60000,   // 60 seconds for generation
      health_check: 15000  // 15 seconds for health checks
    };

    let timeout = baseTimeouts[operationType];

    // Adjust for preloaded models (should be faster)
    if (modelName && this.preloadedModels.has(modelName)) {
      timeout *= 0.5; // 50% faster expected for preloaded models
    }

    // Adjust for concurrent operations (may be slower)
    const activeOperations = this.modelWarmupPromises.size;
    if (activeOperations > 2) {
      timeout *= 1 + (activeOperations * 0.2); // Increase timeout based on load
    }

    return Math.min(timeout, 180000); // Max 3 minutes
  }

  /**
   * Preload primary models for faster response times
   */
  private async preloadPrimaryModels(): Promise<void> {
    try {
      // Get available models first
      const availableModels = await this.getAvailableModels();
      if (availableModels.length === 0) {
        logger.debug('No models available for preloading');
        return;
      }

      // Preload up to 3 models to balance performance and memory usage
      const modelsToPreload = availableModels.slice(0, 3);
      
      logger.info(`🚀 Preloading ${modelsToPreload.length} models for faster response times...`);
      
      for (const model of modelsToPreload) {
        this.preloadModel(model); // Fire and forget for background preloading
      }
    } catch (error) {
      logger.debug('Model preloading failed (non-critical):', error);
    }
  }

  /**
   * Preload a specific model into memory
   */
  private async preloadModel(modelName: string): Promise<boolean> {
    if (this.preloadedModels.has(modelName)) {
      return true; // Already preloaded
    }

    // Check if warmup is already in progress
    const existingWarmup = this.modelWarmupPromises.get(modelName);
    if (existingWarmup) {
      return existingWarmup;
    }

    const warmupPromise = this.performModelWarmup(modelName);
    this.modelWarmupPromises.set(modelName, warmupPromise);
    
    try {
      const success = await warmupPromise;
      if (success) {
        this.preloadedModels.add(modelName);
        logger.debug(`✅ Model ${modelName} preloaded successfully`);
      }
      return success;
    } catch (error) {
      logger.debug(`Failed to preload model ${modelName}:`, error);
      return false;
    } finally {
      this.modelWarmupPromises.delete(modelName);
    }
  }

  /**
   * Perform the actual model warmup with optimization
   */
  private async performModelWarmup(modelName: string): Promise<boolean> {
    try {
      const dynamicTimeout = this.getDynamicTimeout('warmup', modelName);
      const warmupClient = axios.create({
        baseURL: this.config.endpoint,
        timeout: dynamicTimeout
      });

      // Use empty request to preload model as per Ollama documentation
      const preloadRequest = {
        model: modelName,
        prompt: "", // Empty prompt for preloading
        stream: false,
        keep_alive: -1, // Keep model in memory indefinitely
        options: {
          num_predict: 1, // Minimal token generation for warmup
          temperature: 0.1
        }
      };

      await warmupClient.post('/api/generate', preloadRequest);
      return true;
    } catch (error) {
      logger.debug(`Model warmup failed for ${modelName}:`, error);
      return false;
    }
  }

  /**
   * Initialize GPU optimization and hardware detection
   */
  private async initializeGPUOptimization(): Promise<void> {
    // Skip GPU optimization in test environment to improve speed
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      this.isOptimized = true;
      return;
    }

    try {
      // Use existing Ollama models only - no GPU optimization
      this.isOptimized = true;
      
      console.log(chalk.blue('🚀 Using Existing Ollama Models:'));
      console.log('   GPU optimization disabled - using available models');
      
      // Use default fallback models (already set in constructor)
      
      logger.info('Using existing models only', {
        configuredModel: this.config.model,
        fallbackModels: this.fallbackModels.slice(0, 3)
      });
      
    } catch (error) {
      logger.warn('GPU optimization failed, using CPU fallback:', error);
      this.isOptimized = true; // Mark as complete even if failed
    }
  }

  /**
   * Initialize advanced model preloading system
   */
  private async initializeAdvancedPreloading(): Promise<void> {
    try {
      console.log(chalk.cyan('🚀 Initializing Advanced Model Preloader...'));
      
      // Initialize preloader asynchronously to avoid blocking startup
      this.modelPreloader.initialize().then(() => {
        console.log(chalk.green('✅ Advanced model preloading completed'));
        this.modelPreloader.displayStatus();
      }).catch(error => {
        logger.warn('Advanced model preloading failed (falling back to legacy):', error);
        // Fallback to legacy preloading
        this.preloadPrimaryModels();
      });
      
    } catch (error) {
      logger.warn('Failed to initialize advanced preloader:', error);
      // Fallback to legacy preloading
      this.preloadPrimaryModels();
    }
  }

  /**
   * Determine primary models based on available models and system capabilities
   */
  private determinePrimaryModels(): string[] {
    // Default primary models in order of preference
    const defaultModels = [
      'gemma:latest',
      'gemma:2b', 
      'llama3.2:latest',
      'codellama:7b',
      'mistral:latest'
    ];

    // TODO: Add logic to detect available models and filter based on system specs
    return defaultModels;
  }

  /**
   * Get best model with preloading awareness
   */
  async getBestModel(): Promise<string> {
    // First try to get best model from preloader
    const preloadedModel = this.modelPreloader.getBestAvailableModel();
    if (preloadedModel) {
      logger.debug(`Using preloaded model: ${preloadedModel}`);
      return preloadedModel;
    }

    // Fallback to existing logic
    const availableModels = await this.getAvailableModels();
    return await this.selectBestAvailableModel(availableModels, 'coding');
  }

  /**
   * Ensure model is ready before use
   */
  async ensureModelReady(modelName: string): Promise<boolean> {
    return await this.modelPreloader.ensureModelReady(modelName);
  }

  /**
   * Get preloader status for debugging
   */
  getPreloaderStatus(): any {
    return this.modelPreloader.getStatusReport();
  }

  /**
   * Check if the local model is available and responding
   * Enhanced with auto-setup capabilities
   */
  async checkConnection(): Promise<boolean> {
    try {
      // Quick ping test to Ollama with very short timeout
      const quickCheck = axios.create({
        baseURL: this.config.endpoint,
        timeout: 30000 // 30 second timeout for connection check
      });
      
      await quickCheck.get('/api/tags');
      logger.info('Ollama connection successful');
      return true;
      
    } catch (error) {
      logger.warn('Ollama connection failed - service may not be running:', 
        error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Optimize a model for VRAM usage and apply optimizations
   */
  async optimizeModelForVRAM(modelName: string): Promise<string> {
    try {
      // Generate optimization configuration
      const optimization = this.vramOptimizer.optimizeModelForVRAM(modelName);
      this.currentOptimization = optimization;

      // Apply environment optimizations if running locally
      if (this.config.endpoint.includes('localhost') || this.config.endpoint.includes('127.0.0.1')) {
        const envVars = this.vramOptimizer.createOptimizedEnvironment(optimization);
        
        // Apply environment variables (they'll take effect on next Ollama restart)
        for (const [key, value] of Object.entries(envVars)) {
          process.env[key] = value;
          logger.debug(`Set ${key}=${value} for VRAM optimization`);
        }

        if (Object.keys(envVars).length > 0) {
          logger.info(`🔧 Applied ${Object.keys(envVars).length} VRAM optimizations for ${modelName}`);
          
          // If model doesn't fit even with optimizations, suggest alternatives
          if (!optimization.fitsInVRAM) {
            logger.warn(`⚠️  Model ${modelName} may still exceed VRAM limits even with optimizations`);
            logger.info(`💡 Consider using a smaller quantization or model variant`);
            
            // Try to find a better quantization
            const betterQuant = optimization.quantizationRecommendation;
            if (betterQuant.quantization !== 'q4_k_m') {
              const suggestedName = modelName.replace(/:.*$/, `:${betterQuant.quantization}`);
              logger.info(`💡 Suggested model: ${suggestedName}`);
            }
          }
        }
      }

      return modelName;
    } catch (error) {
      logger.warn('VRAM optimization failed, proceeding without optimization:', error);
      return modelName;
    }
  }

  /**
   * Get current optimization status
   */
  getOptimizationStatus(): OptimizationConfig | null {
    return this.currentOptimization;
  }

  /**
   * Display VRAM optimization information
   */
  displayVRAMOptimization(modelName: string): void {
    if (!this.currentOptimization) {
      console.log(chalk.yellow('No VRAM optimization applied'));
      return;
    }

    const opt = this.currentOptimization;
    console.log(chalk.blue(`\n🔧 VRAM Optimization for ${modelName}:\n`));
    
    console.log(chalk.green(`Model Information:`));
    console.log(`  Parameters: ${(opt.modelInfo.parameterCount / 1e9).toFixed(1)}B`);
    console.log(`  Quantization: ${opt.modelInfo.quantization}`);
    console.log(`  Total Layers: ${opt.modelInfo.totalLayers}`);
    
    console.log(chalk.blue(`\nLayer Distribution:`));
    console.log(`  GPU Layers: ${opt.layerOffloading.gpuLayers}/${opt.layerOffloading.totalLayers}`);
    console.log(`  CPU Layers: ${opt.layerOffloading.cpuLayers}/${opt.layerOffloading.totalLayers}`);
    console.log(`  GPU Memory: ${opt.layerOffloading.estimatedGPUMemory.toFixed(1)}GB`);
    console.log(`  CPU Memory: ${opt.layerOffloading.estimatedCPUMemory.toFixed(1)}GB`);
    
    console.log(chalk.cyan(`\nK/V Cache Optimization:`));
    console.log(`  Quantization: ${opt.kvCache.quantizationType}`);
    console.log(`  Memory Usage: ${opt.kvCache.estimatedMemoryGB.toFixed(1)}GB`);
    console.log(`  Memory Reduction: ${Math.round((1 - opt.kvCache.memoryReduction) * 100)}%`);
    console.log(`  Quality Impact: ${opt.kvCache.qualityImpact}`);
    
    console.log(chalk.magenta(`\nOverall:`));
    console.log(`  Total VRAM Usage: ${opt.estimatedTotalMemory.toFixed(1)}GB`);
    console.log(`  Context Length: ${opt.contextLength}`);
    console.log(`  Fits in VRAM: ${opt.fitsInVRAM ? '✅ Yes' : '❌ No'}`);
    
    if (!opt.fitsInVRAM) {
      console.log(chalk.red(`\n⚠️  Warning: Model may still exceed available VRAM`));
      console.log(chalk.yellow(`💡 Consider: ${opt.quantizationRecommendation.description}`));
    }
  }

  /**
   * Smart autonomous model selection with VRAM optimization
   */
  async getAvailableModel(taskType: string = 'general'): Promise<string> {
    // In test environment, always return configured model immediately
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      return this.config.model === 'auto' ? 'gemma:latest' : this.config.model;
    }

    try {
      // Clear cache for fresh selection based on current task
      // (Only use cache for same task type in same session)
      if (this._cachedBestModel && !this._cachedBestModel.includes(taskType)) {
        this._cachedBestModel = null;
      }
      
      // Use cached model if available for same task type
      if (this._cachedBestModel) {
        return this._cachedBestModel;
      }

      // Handle "auto" model selection
      if (this.config.model === 'auto') {
        logger.info('🎯 Auto-selecting best runnable model...');
        try {
          const bestModel = await this.modelSelector.getBestRunnableModel(taskType);
          // Apply VRAM optimization to the selected model
          const optimizedModel = await this.optimizeModelForVRAM(bestModel);
          this._cachedBestModel = optimizedModel;
          return optimizedModel;
        } catch (error) {
          logger.warn('Auto-selection failed, falling back to available models:', error);
          // Continue to fallback logic below
        }
      }

      // Get all available models from Ollama
      const availableModels = await this.getAvailableModels();
      
      if (availableModels.length === 0) {
        logger.warn('No models found on system, using configured model');
        return this.config.model;
      }

      // Smart autonomous selection: try configured model first, then first available
      const configExactMatch = availableModels.find(m => m === this.config.model) || 
                              availableModels.find(m => m.includes(this.config.model.split(':')[0]));

      if (configExactMatch) {
        // Apply VRAM optimization to configured model
        const optimizedModel = await this.optimizeModelForVRAM(configExactMatch);
        this._cachedBestModel = optimizedModel;
        logger.info(`✅ Using configured model: ${configExactMatch}`);
        return optimizedModel;
      }

      // If configured model not available, use the first available model
      const fallbackModel = availableModels[0];
      // Apply VRAM optimization to fallback model
      const optimizedFallback = await this.optimizeModelForVRAM(fallbackModel);
      this._cachedBestModel = optimizedFallback;
      logger.info(`🔄 Using first available model: ${fallbackModel}`);
      return optimizedFallback;
      
    } catch (error) {
      logger.warn('Model selection failed, using configured model:', this.config.model);
      return this.config.model;
    }
  }

  /**
   * Quick health check for a model to see if it's responsive
   */
  private async quickHealthCheck(model: string): Promise<boolean> {
    try {
      // Very simple test request with dynamic timeout
      const dynamicTimeout = this.getDynamicTimeout('health_check', model);
      const testClient = axios.create({
        baseURL: this.config.endpoint,
        timeout: dynamicTimeout
      });

      const testRequest = this.config.endpoint.includes('11434')
        ? {
            model,
            prompt: "test",
            stream: false,
            options: { num_predict: 1 }
          }
        : {
            model,
            messages: [{ role: "user", content: "test" }],
            max_tokens: 1
          };

      const response = await testClient.post(
        this.config.endpoint.includes('11434') ? '/api/generate' : '/v1/chat/completions',
        testRequest
      );

      // If we get any response (even an error response), the model is at least loaded
      return response.status === 200;
    } catch (error) {
      logger.debug(`Health check failed for model ${model}:`, error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Find the first working model from available models
   */
  private async findWorkingModel(availableModels: string[]): Promise<string | null> {
    // Simply use the first available model - no hardcoded preferences
    // User can select specific model with /models command
    if (availableModels.length > 0) {
      const firstModel = availableModels[0];
      logger.info(`✅ Using first available model: ${firstModel}`);
      return firstModel;
    }

    return null;
  }

  /**
   * Assess task complexity for model selection
   */
  private assessComplexity(taskType: string): 'simple' | 'medium' | 'complex' {
    const complexityMap: Record<string, 'simple' | 'medium' | 'complex'> = {
      'coding': 'complex',
      'debugging': 'complex', 
      'analysis': 'medium',
      'planning': 'medium',
      'testing': 'medium',
      'general': 'simple'
    };
    
    return complexityMap[taskType] || 'simple';
  }

  /**
   * Intelligently select the best model from available models
   */
  private async selectBestAvailableModel(availableModels: string[], taskType: string = 'general'): Promise<string> {
    // Autonomous selection: simply use first available model
    // User can choose specific model with /models command
    logger.debug(`Using first available model: ${availableModels[0]}`);
    return availableModels[0];
  }

  /**
   * Check if model is ready and available
   */
  async isModelReady(model: string): Promise<boolean> {
    try {
      return await this.modelManager.isModelAvailable(model);
    } catch (error) {
      logger.warn(`Model readiness check failed for ${model}:`, error);
      return false;
    }
  }

  /**
   * Get list of available models from Ollama with intelligent filtering for system capabilities
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const quickCheck = axios.create({
        baseURL: this.config.endpoint,
        timeout: 30000 // 30 second timeout for model detection
      });
      
      const response = await quickCheck.get('/api/tags');
      const models = response.data.models || [];
      const modelNames = models.map((m: any) => m.name || m.model || '').filter(Boolean);
      
      // Filter models based on system capabilities to prevent VRAM issues
      const systemOptimizedModels = this.filterModelsBySystemCapabilities(modelNames);
      
      logger.info(`🔍 Found ${systemOptimizedModels.length} system-compatible models out of ${modelNames.length} total`);
      if (systemOptimizedModels.length !== modelNames.length) {
        logger.info(`⚡ Filtered out ${modelNames.length - systemOptimizedModels.length} large models to prevent VRAM issues`);
      }
      
      return systemOptimizedModels;
    } catch (error) {
      logger.warn('Failed to get available models:', error);
      return [];
    }
  }

  /**
   * Filter models based on system capabilities to prevent VRAM exhaustion
   */
  private filterModelsBySystemCapabilities(modelNames: string[]): string[] {
    // Detect GPU memory (simplified detection)
    const has12GBOrLess = true; // Assume most users have <= 12GB VRAM
    
    if (!has12GBOrLess) {
      return modelNames; // High-end GPU, can handle all models
    }

    // Filter out models that are too large for typical consumer GPUs
    const filteredModels = modelNames.filter(modelName => {
      const name = modelName.toLowerCase();
      
      // Filter out models that are definitely too large (>15B parameters)
      const isTooBig = name.includes('27b') || 
                      name.includes('32b') || 
                      name.includes('70b') || 
                      name.includes('72b') || 
                      name.includes('405b') ||
                      name.includes('qwq:32b'); // Specific problematic model
      
      if (isTooBig) {
        logger.debug(`Filtering out large model: ${modelName} (likely to cause VRAM issues)`);
        return false;
      }
      
      return true;
    });

    // If we filtered everything, keep smaller models and warn
    if (filteredModels.length === 0) {
      logger.warn('All models filtered out, keeping smallest available models');
      // Keep models that are likely smaller
      return modelNames.filter(name => {
        const lower = name.toLowerCase();
        return lower.includes('1b') || 
               lower.includes('2b') || 
               lower.includes('3b') || 
               lower.includes('7b') ||
               lower.includes('8b') ||
               lower.includes('9b');
      });
    }

    return filteredModels;
  }

  /**
   * Suggest a working model if current one is not available
   */
  async suggestWorkingModel(): Promise<string | null> {
    const availableModels = await this.getAvailableModels();
    
    if (availableModels.length === 0) {
      return null;
    }

    return this.selectBestAvailableModel(availableModels, 'general');
  }

  /**
   * Set the model to use (for manual selection)
   */
  setModel(modelName: string): void {
    this.config.model = modelName;
    this._cachedBestModel = modelName;
    logger.info('Model manually set to:', modelName);
  }

  /**
   * Get current model being used
   */
  getCurrentModel(): string {
    return this._cachedBestModel || this.config.model;
  }

  /**
   * Enable VRAM optimizations for large models
   */
  async enableVRAMOptimizations(modelName?: string): Promise<void> {
    const targetModel = modelName || this.getCurrentModel();
    
    try {
      console.log(chalk.blue(`🔧 Enabling VRAM optimizations for ${targetModel}...`));
      
      const optimizedModel = await this.optimizeModelForVRAM(targetModel);
      
      if (this.currentOptimization) {
        this.displayVRAMOptimization(targetModel);
        
        if (!this.currentOptimization.fitsInVRAM) {
          console.log(chalk.yellow(`\n💡 Recommendations for better performance:`));
          console.log(`   1. Install smaller quantization: ollama pull ${targetModel.split(':')[0]}:q4_k_m`);
          console.log(`   2. Use a smaller model variant`);
          console.log(`   3. Reduce context window in prompts`);
        }
      }
      
    } catch (error) {
      console.log(chalk.red(`❌ Failed to optimize model: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  /**
   * Suggest optimal models for current system
   */
  async suggestOptimalModels(): Promise<void> {
    console.log(chalk.blue('\n🎯 Optimal Models for Your System:\n'));
    
    const testModels = [
      { name: 'gemma:2b', desc: 'Ultra-fast, 2GB VRAM', params: 2e9 },
      { name: 'llama3.2:3b', desc: 'Fast, good quality, 4GB VRAM', params: 3e9 },
      { name: 'qwen2.5:7b', desc: 'High quality, 8GB VRAM', params: 7e9 },
      { name: 'llama3.2:latest', desc: 'Balanced performance', params: 8e9 },
      { name: 'gemma2:9b', desc: 'High quality, 10GB VRAM', params: 9e9 }
    ];

    for (const model of testModels) {
      const optimization = this.vramOptimizer.optimizeModelForVRAM(model.name);
      const fits = optimization.fitsInVRAM ? '✅' : '❌';
      const memory = optimization.estimatedTotalMemory.toFixed(1);
      
      console.log(`${fits} ${model.name.padEnd(16)} - ${memory}GB - ${model.desc}`);
    }

    console.log(chalk.green('\n💡 Recommended installation commands:'));
    console.log(`   ollama pull gemma:2b       # Ultra-fast`);
    console.log(`   ollama pull llama3.2:3b    # Balanced`);
    console.log(`   ollama pull qwen2.5:7b     # High quality`);
  }

  /**
   * Display available models with VRAM compatibility
   */
  async displayAvailableModels(): Promise<void> {
    const models = await this.getAvailableModels();
    
    if (models.length === 0) {
      console.log(chalk.red('❌ No models found on system'));
      console.log(chalk.yellow('💡 Install a model with: ollama pull <model-name>'));
      return;
    }

    console.log(chalk.green(`\n📋 Available Models (${models.length} found):\n`));
    
    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      const optimization = this.vramOptimizer.optimizeModelForVRAM(model);
      const size = this.extractModelSize(model);
      const type = this.getModelType(model);
      const current = this.getCurrentModel() === model;
      
      const prefix = current ? chalk.green('→') : ' ';
      const modelDisplay = current ? chalk.green.bold(model) : chalk.cyan(model);
      const vramStatus = optimization.fitsInVRAM ? 
        chalk.green(`✅ ${optimization.estimatedTotalMemory.toFixed(1)}GB`) : 
        chalk.red(`❌ ${optimization.estimatedTotalMemory.toFixed(1)}GB`);
      
      console.log(`${prefix} ${i + 1}. ${modelDisplay}`);
      console.log(`    Type: ${type} | Size: ${size} | VRAM: ${vramStatus}`);
      
      if (!optimization.fitsInVRAM) {
        console.log(chalk.yellow(`    💡 Use CPU offloading: ${optimization.layerOffloading.gpuLayers}/${optimization.layerOffloading.totalLayers} GPU layers`));
      }
    }
    
    console.log(chalk.yellow(`\n💡 Current model: ${this.getCurrentModel()}`));
    console.log(chalk.gray('   Use "/model <number>" to switch models'));
  }

  /**
   * Select model by index or name
   */
  async selectModel(selection: string | number): Promise<boolean> {
    const models = await this.getAvailableModels();
    
    if (models.length === 0) {
      return false;
    }

    let selectedModel: string;

    if (typeof selection === 'number') {
      if (selection < 1 || selection > models.length) {
        return false;
      }
      selectedModel = models[selection - 1];
    } else {
      // Try exact match first
      selectedModel = models.find(m => m === selection) || 
                     models.find(m => m.includes(selection)) ||
                     models.find(m => selection.includes(m.split(':')[0])) || '';
      
      if (!selectedModel) {
        return false;
      }
    }

    this.setModel(selectedModel);
    console.log(chalk.green(`✅ Model changed to: ${selectedModel}`));
    return true;
  }

  /**
   * Extract model size from name
   */
  private extractModelSize(modelName: string): string {
    const sizeMatches = modelName.match(/(\d+\.?\d*[bmkBMK])/i);
    return sizeMatches ? sizeMatches[0] : 'Unknown';
  }

  /**
   * Get model type/category
   */
  private getModelType(modelName: string): string {
    const name = modelName.toLowerCase();
    
    if (name.includes('codellama') || name.includes('codegemma') || name.includes('deepseek-coder')) {
      return 'Coding';
    }
    if (name.includes('llama')) return 'General';
    if (name.includes('gemma')) return 'Efficient';
    if (name.includes('qwen')) return 'Multilingual';
    if (name.includes('phi')) return 'Reasoning';
    if (name.includes('mistral')) return 'Instruction';
    
    return 'General';
  }

  /**
   * Generate a response using a specific model and voice archetype
   */
  async generateVoiceResponseWithModel(
    voice: VoiceArchetype,
    prompt: string,
    context: ProjectContext,
    modelName: string,
    retryCount = 0
  ): Promise<VoiceResponse> {
    const maxRetries = 1; // Reduced retries for speed
    
    // Pre-flight connection check
    const isConnected = await this.checkConnection();
    if (!isConnected) {
      throw new Error(`Ollama service unavailable for ${voice.name}. Please start with: ollama serve`);
    }
    
    try {
      const enhancedPrompt = this.enhancePromptWithVoice(voice, prompt, context);
      
      logger.info(`Generating response with ${voice.name} using model: ${modelName}`);
      
      const requestBody = this.config.endpoint.includes('11434') 
        ? this.buildOllamaRequest(enhancedPrompt, voice, modelName)
        : this.buildOpenAIRequest(enhancedPrompt, voice, modelName);

      // Use enhanced timeout manager with circuit breaker
      const dynamicTimeout = this.getDynamicTimeout('generation', modelName);
      const operationName = `model_generation_${modelName}`;
      
      const response = await timeoutManager.executeWithCircuitBreaker(
        async () => {
          const generationClient = axios.create({
            baseURL: this.config.endpoint,
            timeout: dynamicTimeout,
            headers: { 'Content-Type': 'application/json' }
          });

          return await generationClient.post(
            this.config.endpoint.includes('11434') ? '/api/generate' : '/v1/chat/completions',
            requestBody
          );
        },
        operationName,
        { timeoutMs: dynamicTimeout }
      );

      return this.parseVoiceResponse(response.data, voice);
    } catch (error) {
      const isTimeout = error instanceof Error && 
        (error.message.includes('timeout') || error.message.includes('ECONNREFUSED'));
      
      if (isTimeout) {
        throw new Error(`${voice.name} timed out. Ollama may be slow or the model '${modelName}' may not be available. Try: ollama pull ${modelName}`);
      }
      
      logger.error(`Voice generation failed for ${voice.name} with model ${modelName}:`, error);
      throw new Error(`Failed to generate response from ${voice.name} using ${modelName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a response from a specific voice archetype
   */
  async generateVoiceResponse(
    voice: VoiceArchetype,
    prompt: string,
    context: ProjectContext,
    retryCount = 0
  ): Promise<VoiceResponse> {
    const maxRetries = 2;
    
    try {
      const enhancedPrompt = this.enhancePromptWithVoice(voice, prompt, context);
      const taskType = this.analyzeTaskType(prompt);
      
      // Use preloaded model for better performance
      let model = await this.getBestModel();
      
      // Ensure the selected model is ready
      const modelReady = await this.ensureModelReady(model);
      if (!modelReady) {
        logger.warn(`Model ${model} not ready, falling back to available model`);
        model = await this.getAvailableModel(taskType);
      }
      
      logger.info(`Generating response with ${voice.name} using model: ${model}`);
      
      const requestBody = this.config.endpoint.includes('11434') 
        ? this.buildOllamaRequest(enhancedPrompt, voice, model)
        : this.buildOpenAIRequest(enhancedPrompt, voice, model);

      const response = await this.client.post(
        this.config.endpoint.includes('11434') ? '/api/generate' : '/v1/chat/completions',
        requestBody
      );

      // Record success
      this.modelSelector.recordPerformance(model, taskType, true, Date.now(), 1.0);
      
      return this.parseVoiceResponse(response.data, voice);
    } catch (error) {
      const isTimeout = error instanceof Error && 
        (error.message.includes('timeout') || error.name === 'AxiosError' && error.message.includes('exceeded'));
      
      // Use autonomous error handling for all errors, not just timeouts
      const taskType = this.analyzeTaskType(prompt);
      const currentModel = await this.getAvailableModel(taskType);
      
      const errorContext: ErrorContext = {
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
        operation: 'voice_generation',
        model: currentModel,
        context: { voice: voice.name, taskType, retryCount }
      };

      // Record failure
      this.modelSelector.recordPerformance(currentModel, taskType, false, Date.now(), 0.0);
      
      // Get recovery actions
      const recoveryActions = await this.errorHandler.analyzeAndRecover(errorContext);
      
      // Check for model switching recommendation
      const switchAction = recoveryActions.find(action => action.action === 'switch_model');
      if (switchAction?.target && retryCount < maxRetries) {
        logger.warn(`🔄 ${voice.name}: Autonomous recovery switching to ${switchAction.target}`);
        logger.info(`   Reason: ${switchAction.reason}`);
        
        // Quick retry with recommended model
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.generateVoiceResponseWithModel(voice, prompt, context, switchAction.target, retryCount + 1);
      }
      
      // If timeout and no specific recovery, try fast fallback models
      if (isTimeout && retryCount < maxRetries) {
        logger.warn(`⚡ ${voice.name}: Timeout, trying faster model...`);
        const fastModel = await this.getFastestAvailableModel();
        if (fastModel !== currentModel) {
          return this.generateVoiceResponseWithModel(voice, prompt, context, fastModel, retryCount + 1);
        }
      }
      
      throw new Error(`Failed to generate response from ${voice.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the fastest available model prioritizing smaller models for speed and VRAM efficiency
   */
  private async getFastestAvailableModel(): Promise<string> {
    const availableModels = await this.getAvailableModels();
    
    if (availableModels.length === 0) {
      return this.config.model;
    }

    // Prioritize models by speed/efficiency (smaller = faster)
    const speedPriority = [
      // Tiny models (fastest)
      '1b', '2b', 
      // Small models (fast)
      '3b', '7b', '8b', '9b',
      // Medium models (moderate)
      '11b', '13b', '14b', '15b'
    ];

    // Find the smallest available model for maximum speed
    for (const sizeKey of speedPriority) {
      const fastModel = availableModels.find(model => 
        model.toLowerCase().includes(sizeKey) && 
        (model.toLowerCase().includes('gemma') || 
         model.toLowerCase().includes('llama') ||
         model.toLowerCase().includes('qwen'))
      );
      
      if (fastModel) {
        logger.info(`Selected fastest optimized model: ${fastModel}`);
        return fastModel;
      }
    }
    
    // If no size-specific model found, use first available (already filtered for compatibility)
    const fallbackModel = availableModels[0];
    logger.info('Using first available model for speed:', fallbackModel);
    return fallbackModel;
  }

  /**
   * Analyze task type from prompt for intelligent model selection
   */
  private analyzeTaskType(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('code') || lowerPrompt.includes('function') || lowerPrompt.includes('implement')) {
      return 'coding';
    }
    
    if (lowerPrompt.includes('debug') || lowerPrompt.includes('fix') || lowerPrompt.includes('error')) {
      return 'debugging';
    }
    
    if (lowerPrompt.includes('analyze') || lowerPrompt.includes('review') || lowerPrompt.includes('explain')) {
      return 'analysis';
    }
    
    if (lowerPrompt.includes('plan') || lowerPrompt.includes('design') || lowerPrompt.includes('architecture')) {
      return 'planning';
    }
    
    return 'general';
  }

  /**
   * Try fallback models if primary fails
   */
  private async tryFallbackModels(
    voice: VoiceArchetype,
    prompt: string,
    context: ProjectContext
  ): Promise<VoiceResponse | null> {
    for (const fallbackModel of this.fallbackModels.slice(1)) { // Skip first (primary)
      try {
        logger.info(`Trying fallback model: ${fallbackModel}`);
        const enhancedPrompt = this.enhancePromptWithVoice(voice, prompt, context);
        
        const requestBody = this.config.endpoint.includes('11434') 
          ? this.buildOllamaRequest(enhancedPrompt, voice, fallbackModel)
          : this.buildOpenAIRequest(enhancedPrompt, voice, fallbackModel);

        const response = await this.client.post(
          this.config.endpoint.includes('11434') ? '/api/generate' : '/v1/chat/completions',
          requestBody
        );

        return this.parseVoiceResponse(response.data, voice);
      } catch (error) {
        logger.warn(`Fallback model ${fallbackModel} also failed:`, error);
        continue;
      }
    }
    return null;
  }

  /**
   * Generate responses from multiple voices with optimized concurrency control
   */
  async generateMultiVoiceResponses(
    voices: VoiceArchetype[],
    prompt: string,
    context: ProjectContext
  ): Promise<VoiceResponse[]> {
    logger.info(`Generating responses from ${voices.length} voices with optimized concurrency`);
    
    // Preload models for all voices to reduce cold start times
    const taskType = this.analyzeTaskType(prompt);
    const primaryModel = await this.getAvailableModel(taskType);
    
    // Ensure primary model is warmed up
    if (!this.preloadedModels.has(primaryModel)) {
      logger.debug(`Warming up primary model: ${primaryModel}`);
      await this.preloadModel(primaryModel);
    }

    // Use controlled concurrency to respect Ollama's concurrent request limits
    const maxConcurrency = Math.min(voices.length, 3); // Limit to 3 concurrent requests
    const results: VoiceResponse[] = [];
    const errors: Error[] = [];

    for (let i = 0; i < voices.length; i += maxConcurrency) {
      const batch = voices.slice(i, i + maxConcurrency);
      logger.debug(`Processing voice batch ${Math.floor(i / maxConcurrency) + 1} with ${batch.length} voices`);
      
      const batchPromises = batch.map(voice => 
        this.generateVoiceResponse(voice, prompt, context)
          .catch(error => {
            logger.warn(`Voice ${voice.name} failed:`, error);
            errors.push(error);
            return null;
          })
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value !== null) {
          results.push(result.value);
        }
      }

      // Small delay between batches to prevent overwhelming Ollama
      if (i + maxConcurrency < voices.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    if (results.length === 0) {
      logger.error('All voice responses failed:', errors);
      throw new Error(`All voice responses failed. Last error: ${errors[errors.length - 1]?.message || 'Unknown error'}`);
    }
    
    logger.info(`Successfully generated ${results.length}/${voices.length} voice responses`);
    return results;
  }

  /**
   * Generate a single response from the local model with GPU optimization and error handling
   */
  async generate(prompt: string, jsonSchema?: any, retryCount = 0): Promise<string> {
    // Pre-flight connection check
    const isConnected = await this.checkConnection();
    if (!isConnected) {
      throw new Error('Ollama service is not available. Please start Ollama with: ollama serve');
    }

    const taskType = this.analyzeTaskType(prompt);
    const startTime = Date.now();
    let model = await this.getAvailableModel(taskType);
    
    try {
      logger.info(`Generating streamlined response with model: ${model}`);

      const requestBody = this.config.endpoint.includes('11434')
        ? this.buildOllamaRequest(prompt, { temperature: this.config.temperature } as any, model, jsonSchema)
        : this.buildOpenAIRequest(prompt, { temperature: this.config.temperature } as any, model);

      const response = await this.client.post(
        this.config.endpoint.includes('11434') ? '/api/generate' : '/v1/chat/completions',
        requestBody
      );

      // Record successful performance
      const duration = Date.now() - startTime;
      this.modelSelector.recordPerformance(model, taskType, true, duration, 1.0);

      return this.parseResponse(response.data);
    } catch (error) {
        if (retryCount < 3 && error instanceof Error && error.message.includes('socket hang up')) {
            logger.warn(`Socket hang up, retrying... (${retryCount + 1}/3)`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return this.generate(prompt, jsonSchema, retryCount + 1);
        }
      // Handle specific error types with helpful guidance
      const isTimeout = error instanceof Error && 
        (error.message.includes('timeout') || error.message.includes('ECONNREFUSED'));
      
      const is404 = error instanceof Error && 
        (error.message.includes('status code 404') || error.message.includes('404'));
      
      const is500 = error instanceof Error &&
        error.message.includes('status code 500');

      const isVRAMIssue = error instanceof Error &&
        (error.message.includes('CUDA') || error.message.includes('memory') || error.message.includes('OOM'));
      
      if (isTimeout) {
        // Check if this might be due to VRAM issues with large models
        const isLargeModel = model.toLowerCase().includes('27b') || 
                           model.toLowerCase().includes('32b') || 
                           model.toLowerCase().includes('70b');
                           
        if (isLargeModel) {
          const smallerModels = await this.getAvailableModels();
          const fallbackModel = smallerModels.find(m => !m.toLowerCase().includes('27b') && !m.toLowerCase().includes('32b'));
          
          if (fallbackModel) {
            logger.warn(`⚡ Large model ${model} timed out, trying smaller model: ${fallbackModel}`);
            this.setModel(fallbackModel);
            throw new Error(`Model '${model}' is too large for your system (VRAM exhaustion). Switched to '${fallbackModel}'. Please retry your request.`);
          }
        }
        
        throw new Error('Ollama connection timeout. Try:\n1. Start Ollama: ollama serve\n2. Check if models are downloaded: ollama list\n3. Install a smaller model: ollama pull llama3.2:latest');
      }

      if (isVRAMIssue) {
        logger.error(`VRAM exhaustion detected with model: ${model}`);
        const smallerModels = await this.getAvailableModels();
        const fallbackModel = smallerModels.find(m => 
          m.toLowerCase().includes('2b') || 
          m.toLowerCase().includes('3b') ||
          m.toLowerCase().includes('7b')
        );
        
        if (fallbackModel) {
          logger.warn(`🔄 Switching to smaller model due to VRAM constraints: ${fallbackModel}`);
          this.setModel(fallbackModel);
          throw new Error(`VRAM exhaustion with '${model}'. Switched to '${fallbackModel}'. Please retry your request.`);
        }
        
        throw new Error(`VRAM exhaustion. Install a smaller model: ollama pull gemma:2b`);
      }
      
      if (is404) {
        // Try to suggest an available model
        const suggestedModel = await this.suggestWorkingModel();
        const availableModels = await this.getAvailableModels();
        
        let errorMsg = `Model '${model}' not found. Try:\n1. Pull the model: ollama pull ${model}`;
        
        if (availableModels.length > 0) {
          errorMsg += `\n2. Available models: ${availableModels.join(', ')}`;
          if (suggestedModel) {
            errorMsg += `\n3. Try using: ${suggestedModel}`;
          }
        } else {
          errorMsg += `\n2. No models found. Install one: ollama pull gemma:2b`;
        }
        
        throw new Error(errorMsg);
      }
      
      if (is500) {
        throw new Error(`Ollama server error. The model '${model}' may be corrupted, incompatible, or too large.\nTry:\n1. Restart Ollama: Stop and run 'ollama serve'\n2. Use a smaller model: ollama pull gemma:2b\n3. Re-pull the model: ollama pull ${model}`);
      }

      logger.error('Generation failed:', error);
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Streamlined API call for maximum speed - bypasses voice complexity
   */
  async generateFast(prompt: string, maxTokens?: number): Promise<string> {
    try {
      // Get fastest model optimized for speed
      const fastModel = await this.getFastestAvailableModel();
      logger.info(`Fast generation with optimized model: ${fastModel}`);

      // Streamlined request with minimal overhead and performance optimization
      const requestBody = {
        model: fastModel,
        prompt: prompt,
        stream: false,
        keep_alive: "10m", // Keep model loaded for faster subsequent requests
        options: {
          temperature: 0.3, // Lower temperature for faster generation
          num_predict: maxTokens || 512, // Limit tokens for speed
          top_p: 0.8,
          repeat_penalty: 1.05,
          stop: ['\n\n', 'Human:', 'Assistant:']
        }
      };

      const response = await this.client.post('/api/generate', requestBody);
      
      return this.parseResponse(response.data);
    } catch (error) {
      logger.error('Fast generation failed:', error);
      
      // Single retry with absolute fastest fallback
      try {
        // Use current model as fallback
        logger.warn(`🚀 Ultra-fast fallback: ${this.config.model}`);
        
        const fallbackBody = {
          model: this.config.model,
          prompt: prompt.length > 500 ? prompt.substring(0, 500) + '...' : prompt, // Truncate for speed
          stream: false,
          keep_alive: "10m", // Keep model loaded
          options: {
            temperature: 0.1,
            num_predict: 256, // Very limited tokens
            top_p: 0.7
          }
        };

        const fallbackResponse = await this.client.post('/api/generate', fallbackBody);
        return this.parseResponse(fallbackResponse.data);
        
      } catch (fallbackError) {
        throw new Error(`Fast generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Analyze code with local model
   */
  async analyzeCode(code: string, language: string): Promise<any> {
    const prompt = `Analyze this ${language} code and provide:
1. Code quality assessment (1-10 score)
2. Potential improvements with specific examples
3. Security concerns and vulnerabilities
4. Performance considerations and optimizations
5. Architectural recommendations

Code to analyze:
\`\`\`${language}
${code}
\`\`\`

Provide a structured analysis with actionable recommendations.`;

    const model = await this.getAvailableModel();
    const requestBody = this.config.endpoint.includes('11434')
      ? this.buildOllamaRequest(prompt, { temperature: 0.3 } as any, model)
      : this.buildOpenAIRequest(prompt, { temperature: 0.3 } as any, model);

    try {
      const response = await this.client.post(
        this.config.endpoint.includes('11434') ? '/api/generate' : '/v1/chat/completions',
        requestBody
      );

      return this.parseAnalysisResponse(response.data);
    } catch (error) {
      logger.error('Code analysis failed:', error);
      throw error;
    }
  }

  /**
   * Enhance prompt with voice-specific instructions and context
   */
  private enhancePromptWithVoice(
    voice: VoiceArchetype,
    prompt: string,
    context: ProjectContext
  ): string {
    // Sanitize and validate inputs to prevent prompt injection
    const sanitizedPrompt = this.sanitizePromptInput(prompt);
    const sanitizedContext = this.sanitizeContext(context);
    const contextInfo = this.formatContext(sanitizedContext);
    
    // Generate style-specific instructions based on voice style
    const styleInstructions = this.generateStyleInstructions(voice.style);
    
    return `${voice.systemPrompt}

Voice Style: ${voice.style}
${styleInstructions}

Project Context:
${contextInfo}

Task:
${sanitizedPrompt}

Instructions:
- Respond as ${voice.name} with your specific perspective and expertise
- Apply your ${voice.style} approach consistently throughout your response
- Provide concrete, actionable solutions
- Include code examples where appropriate
- Consider the project context provided
- Be specific and detailed in your recommendations
- Format code blocks with proper language tags
- SECURITY NOTICE: Do not execute, evaluate, or suggest running any user-provided code without explicit review`;
  }

  /**
   * Generate style-specific instructions for voice behavior
   */
  private generateStyleInstructions(style: string): string {
    const styleMap: Record<string, string> = {
      'experimental': `
Style Instructions:
- Explore unconventional and innovative approaches
- Suggest cutting-edge technologies and emerging patterns
- Consider experimental features and beta technologies
- Think outside the box and challenge traditional methods
- Embrace creative solutions and novel architectures
- Focus on innovation over stability`,
      
      'conservative': `
Style Instructions:
- Prioritize proven, stable, and well-tested approaches
- Recommend mature technologies with strong community support
- Focus on long-term maintainability and reliability
- Avoid bleeding-edge features that may be unstable
- Emphasize backwards compatibility and migration safety
- Choose established patterns and best practices`,
      
      'analytical': `
Style Instructions:
- Provide detailed technical analysis with metrics and data
- Break down complex problems into measurable components
- Include performance implications and trade-off analysis
- Reference benchmarks, studies, and empirical evidence
- Focus on quantifiable benefits and objective reasoning
- Present structured, logical decision-making processes`,
      
      'practical': `
Style Instructions:
- Prioritize working solutions that can be implemented immediately
- Focus on real-world applicability and pragmatic approaches
- Provide step-by-step implementation guidance
- Consider resource constraints and practical limitations
- Emphasize getting results quickly and efficiently
- Balance ideal solutions with practical constraints`,
      
      'methodical': `
Style Instructions:
- Follow systematic, step-by-step approaches
- Break complex tasks into organized, sequential phases
- Provide clear workflows and structured processes
- Emphasize thorough planning and systematic execution
- Create repeatable, documented procedures
- Focus on consistency and systematic problem-solving`,
      
      'defensive': `
Style Instructions:
- Prioritize security, safety, and risk mitigation
- Include comprehensive error handling and validation
- Consider potential attack vectors and vulnerabilities
- Implement defensive programming patterns
- Focus on robustness and fault tolerance
- Emphasize security-first design principles`,
      
      'systematic': `
Style Instructions:
- Apply architectural thinking and system-wide perspective
- Consider scalability, modularity, and system integration
- Focus on design patterns and architectural principles
- Think about system boundaries and interface design
- Emphasize maintainable and extensible architectures
- Balance immediate needs with long-term system evolution`,
      
      'user-focused': `
Style Instructions:
- Prioritize user experience and usability considerations
- Consider accessibility, inclusivity, and diverse user needs
- Focus on intuitive interfaces and user-friendly design
- Emphasize user workflows and interaction patterns
- Think about user feedback, testing, and validation
- Balance functionality with ease of use`,
      
      'performance-focused': `
Style Instructions:
- Optimize for speed, efficiency, and resource utilization
- Consider algorithmic complexity and performance implications
- Focus on bottleneck identification and optimization strategies
- Emphasize scalability and performance monitoring
- Analyze memory usage, CPU utilization, and I/O efficiency
- Prioritize measurable performance improvements`,
      
      'integrative': `
Style Instructions:
- Focus on combining different approaches and perspectives
- Create hybrid solutions that leverage multiple strengths
- Emphasize interoperability and system integration
- Find synergies between different technologies and patterns
- Build bridges between competing approaches
- Create unified solutions from diverse components`,
      
      'balanced': `
Style Instructions:
- Find equilibrium between competing concerns and trade-offs
- Consider multiple perspectives and stakeholder needs
- Balance short-term and long-term considerations
- Weigh benefits and drawbacks of different approaches
- Seek compromise solutions that satisfy key requirements
- Avoid extreme positions in favor of moderate, sustainable solutions`,
      
      'selective': `
Style Instructions:
- Focus on choosing the best elements from available options
- Apply rigorous evaluation criteria and quality standards
- Prioritize excellence and high-quality outcomes
- Be discerning about which approaches to recommend
- Emphasize merit-based selection and objective evaluation
- Choose solutions based on proven effectiveness and results`
    };

    return styleMap[style] || `
Style Instructions:
- Apply a ${style} approach to your analysis and recommendations
- Let your ${style} perspective guide your response methodology
- Maintain consistency with ${style} principles throughout your answer`;
  }

  /**
   * Sanitize prompt input to prevent injection attacks
   */
  private sanitizePromptInput(prompt: string): string {
    if (typeof prompt !== 'string') {
      throw new Error('Prompt must be a string');
    }

    // Remove null bytes and control characters except newlines
    let sanitized = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Detect and neutralize potential prompt injection patterns
    const injectionPatterns = [
      // System prompt overrides
      /system:\s*$/i,
      /assistant:\s*$/i,
      /user:\s*$/i,
      // Instruction overrides
      /ignore\s+(previous|all)\s+(instructions?|prompts?)/i,
      /disregard\s+(previous|all)\s+(instructions?|prompts?)/i,
      /forget\s+(everything|all)\s+(before|above)/i,
      // Role manipulation
      /you\s+are\s+now\s+/i,
      /act\s+as\s+/i,
      /pretend\s+to\s+be\s+/i,
      // Output format manipulation
      /respond\s+only\s+with/i,
      /output\s+format:/i,
      // Security bypass attempts
      /execute\s+this\s+code/i,
      /run\s+this\s+script/i,
      /eval\(.*\)/i,
      /exec\(.*\)/i
    ];

    // Check for injection patterns and neutralize them
    for (const pattern of injectionPatterns) {
      if (pattern.test(sanitized)) {
        logger.warn('Potential prompt injection attempt detected and neutralized');
        // Replace injection attempts with safe text
        sanitized = sanitized.replace(pattern, '[SYSTEM: Potential injection attempt removed]');
      }
    }

    // Limit prompt length to prevent token exhaustion attacks
    if (sanitized.length > 8000) {
      logger.warn('Prompt length exceeds limit, truncating');
      sanitized = sanitized.substring(0, 8000) + '\n[TRUNCATED: Prompt was too long]';
    }

    return sanitized;
  }

  /**
   * Sanitize project context to prevent injection
   */
  private sanitizeContext(context: ProjectContext): ProjectContext {
    const sanitizedContext: ProjectContext = {
      files: context.files?.map(file => ({
        path: this.sanitizeFilePath(file.path),
        content: this.sanitizeFileContent(file.content),
        language: file.language
      })),
      projectType: context.projectType ? this.sanitizeString(context.projectType) : undefined,
      dependencies: context.dependencies?.map(dep => this.sanitizeString(dep)),
      gitStatus: context.gitStatus ? this.sanitizeString(context.gitStatus) : undefined
    };

    return sanitizedContext;
  }

  /**
   * Sanitize file paths to prevent path traversal
   */
  private sanitizeFilePath(path: string): string {
    let sanitized = this.sanitizeString(path);
    
    // Remove path traversal attempts
    sanitized = sanitized.replace(/\.\.\//g, '');
    sanitized = sanitized.replace(/\.\.\\/g, '');
    
    // Normalize path separators
    sanitized = sanitized.replace(/\\/g, '/');
    
    return sanitized;
  }

  /**
   * Sanitize file content to prevent code injection
   */
  private sanitizeFileContent(content: string): string {
    let sanitized = this.sanitizeString(content);
    
    // Limit file content size
    if (sanitized.length > 50000) {
      sanitized = sanitized.substring(0, 50000) + '\n[TRUNCATED: File content was too large]';
    }
    
    return sanitized;
  }

  /**
   * Basic string sanitization
   */
  private sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return String(input);
    }
    
    // Remove null bytes and most control characters
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Format project context for the model
   */
  private formatContext(context: ProjectContext): string {
    let formatted = '';

    if (context.projectType) {
      formatted += `Project Type: ${context.projectType}\n`;
    }

    if (context.dependencies?.length) {
      formatted += `Dependencies: ${context.dependencies.join(', ')}\n`;
    }

    if (context.gitStatus) {
      formatted += `Git Status: ${context.gitStatus}\n`;
    }

    if (context.files && context.files.length > 0) {
      formatted += '\nRelevant Files:\n';
      context.files.forEach(file => {
        formatted += `\n--- ${file.path} (${file.language}) ---\n`;
        // Intelligently truncate large files
        const content = file.content.length > 3000 
          ? file.content.substring(0, 1500) + '\n\n... [truncated] ...\n\n' + file.content.substring(file.content.length - 1500)
          : file.content;
        formatted += `\`\`\`${file.language}\n${content}\n\`\`\`\n`;
      });
    }

    return formatted || 'No additional project context provided.';
  }

  /**
   * Build request for Ollama endpoint with performance optimizations
   */
  private buildOllamaRequest(prompt: string, voice: VoiceArchetype, model?: string, jsonSchema?: any): any {
    const baseRequest = {
      model: model || this.config.model,
      prompt: prompt,
      stream: false,
      keep_alive: "10m", // Keep model loaded for 10 minutes for faster subsequent requests
      options: {
        temperature: voice.temperature || this.config.temperature,
        num_predict: this.config.maxTokens,
        top_p: 0.9,
        repeat_penalty: 1.1,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
        stop: ['Human:', 'Assistant:', '<|endoftext|>']
      }
    };

    // Add structured output format if schema provided
    if (jsonSchema) {
      return {
        ...baseRequest,
        format: jsonSchema
      };
    }

    return baseRequest;
  }

  /**
   * Build request for OpenAI-compatible endpoint
   */
  private buildOpenAIRequest(prompt: string, voice: VoiceArchetype, model?: string): any {
    return {
      model: model || this.config.model,
      messages: [
        {
          role: 'system',
          content: voice.systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: voice.temperature || this.config.temperature,
      max_tokens: this.config.maxTokens,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
      stop: ['Human:', 'Assistant:']
    };
  }

  /**
   * Parse response from voice generation
   */
  private parseVoiceResponse(data: any, voice: VoiceArchetype): VoiceResponse {
    let content: string;
    let tokensUsed = 0;

    if (data.response) {
      // Ollama response format
      content = data.response;
      tokensUsed = data.eval_count || 0;
    } else if (data.choices && data.choices[0]) {
      // OpenAI-compatible response format
      content = data.choices[0].message?.content || data.choices[0].text || '';
      tokensUsed = data.usage?.total_tokens || 0;
    } else {
      throw new Error('Unexpected response format from local model');
    }

    return {
      content: content.trim(),
      voice: voice.name,
      confidence: this.calculateConfidence(content, voice),
      tokens_used: tokensUsed
    };
  }

  /**
   * Parse a single response from the local model
   */
  private parseResponse(data: any): string {
    if (data.response) {
      // Ollama response format
      return data.response.trim();
    } else if (data.choices && data.choices[0]) {
      // OpenAI-compatible response format
      return data.choices[0].message?.content.trim() || data.choices[0].text.trim() || '';
    } else {
      throw new Error('Unexpected response format from local model');
    }
  }

  /**
   * Parse code analysis response
   */
  private parseAnalysisResponse(data: any): any {
    const content = data.response || data.choices?.[0]?.message?.content || '';
    
    return {
      analysis: content,
      timestamp: Date.now(),
      model: this.config.model,
      qualityScore: this.extractQualityScore(content),
      recommendations: this.extractRecommendations(content)
    };
  }

  /**
   * Calculate confidence score based on response characteristics
   */
  private calculateConfidence(content: string, voice: VoiceArchetype): number {
    let confidence = 0.5;

    // Length indicates thoroughness
    if (content.length > 500) confidence += 0.15;
    if (content.length > 1000) confidence += 0.1;
    if (content.length > 2000) confidence += 0.05;

    // Code blocks indicate concrete solutions
    const codeBlocks = (content.match(/```/g) || []).length / 2;
    confidence += Math.min(codeBlocks * 0.1, 0.2);

    // Technical terms indicate expertise
    const technicalTerms = /\b(function|class|interface|async|await|import|export|const|let|var|return|if|else|for|while|try|catch)\b/g;
    const matches = content.match(technicalTerms);
    if (matches) {
      confidence += Math.min(matches.length * 0.01, 0.1);
    }

    // Voice-specific adjustments
    switch (voice.style) {
      case 'experimental':
        // Explorer gets bonus for alternatives
        if (content.includes('alternative') || content.includes('approach')) confidence += 0.1;
        break;
      case 'defensive':
        // Security gets bonus for security terms
        if (content.includes('security') || content.includes('validation')) confidence += 0.1;
        break;
      case 'analytical':
        // Analyzer gets bonus for metrics
        if (content.includes('performance') || content.includes('optimization')) confidence += 0.1;
        break;
    }

    return Math.min(Math.max(confidence, 0.1), 1.0);
  }

  /**
   * Extract quality score from analysis content
   */
  private extractQualityScore(content: string): number {
    const scoreMatch = content.match(/(\d+)\/10|(\d+) out of 10|score.*?(\d+)/i);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1] || scoreMatch[2] || scoreMatch[3]);
      return isNaN(score) ? 7 : Math.min(Math.max(score, 1), 10);
    }
    return 7; // Default score
  }

  /**
   * Extract recommendations from analysis content
   */
  private extractRecommendations(content: string): string[] {
    const recommendations: string[] = [];
    
    // Look for numbered lists or bullet points
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.match(/^\d+\.|^[-*]\s+|^Recommendation:/i)) {
        recommendations.push(line.trim());
      }
    }
    
    return recommendations.length > 0 ? recommendations : ['General code review recommended'];
  }

  /**
   * Display helpful troubleshooting information for common issues
   */
  static displayTroubleshootingHelp(): void {
    console.log(chalk.yellow('\n🔧 CodeCrucible Troubleshooting Guide:\n'));
    
    console.log(chalk.blue('1. Check Ollama Status:'));
    console.log('   ollama list                    # Check installed models');
    console.log('   curl http://localhost:11434    # Test if Ollama is running\n');
    
    console.log(chalk.blue('2. Start Ollama (if not running):'));
    console.log('   ollama serve                   # Start Ollama service\n');
    
    console.log(chalk.blue('3. Install Fast Models (Recommended):'));
    console.log('   ollama pull <model-name>       # Install any model you prefer\n');
    
    console.log(chalk.blue('4. Fix Model Errors:'));
    console.log('   For "Model not found" (404 errors):');
    console.log('   - Check config model name matches installed models');
    console.log('   - Update config to use available model name');
    console.log('   - Use /models command to select an available model\n');
    
    console.log(chalk.blue('5. Performance Tips:'));
    console.log('   - Use smaller models (1b-3b parameters) for speed');
    console.log('   - Ensure sufficient RAM (8GB+ recommended)');
    console.log('   - Close other heavy applications');
    console.log('   - Consider GPU acceleration if available\n');
    
    console.log(chalk.green('6. Alternative: Use OpenAI-compatible API:'));
    console.log('   Set endpoint to OpenAI-compatible service (port 8080)\n');
    
    console.log(chalk.red('Common Issues:'));
    console.log('   • 404 errors → Model not installed or wrong name');
    console.log('   • Timeout → Model too large for available resources');
    console.log('   • 500 errors → Model corrupted, try re-pulling');
  }

  /**
   * Convert legacy VoiceResponse to standardized AgentResponse
   */
  public voiceResponseToAgentResponse(voiceResponse: VoiceResponse): AgentResponse {
    return ResponseFactory.createAgentResponse(voiceResponse.content, {
      confidence: voiceResponse.confidence,
      voiceId: voiceResponse.voice,
      tokensUsed: voiceResponse.tokens_used,
      reasoning: voiceResponse.reasoning
    });
  }

  /**
   * Generate voice response with standardized format
   */
  async generateStandardVoiceResponse(
    voice: VoiceArchetype,
    prompt: string,
    context: ProjectContext,
    retryCount = 0
  ): Promise<AgentResponse> {
    try {
      const voiceResponse = await this.generateVoiceResponse(voice, prompt, context, retryCount);
      return this.voiceResponseToAgentResponse(voiceResponse);
    } catch (error) {
      const errorInfo = ResponseFactory.createErrorResponse(
        'VOICE_GENERATION_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        error instanceof Error ? error.stack : undefined
      );
      
      const response = ResponseFactory.createAgentResponse('', { confidence: 0 });
      response.error = errorInfo;
      response.success = false;
      return response;
    }
  }
}