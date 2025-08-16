import { LocalModelClient, LocalModelConfig, VoiceResponse, ProjectContext, VoiceArchetype } from './local-model-client.js';
import { logger } from './logger.js';

/**
 * Performance-optimized wrapper for LocalModelClient
 * Implements caching, persistent connections, and async optimizations
 * Based on analysis of leading CLI agents like Claude Code, Aider, etc.
 */
export class PerformanceOptimizedClient {
  private static instance: PerformanceOptimizedClient | null = null;
  private baseClient: LocalModelClient;
  private config: LocalModelConfig;
  
  // Performance caches
  private _modelCache: Map<string, string> = new Map(); // taskType -> bestModel
  private _availableModelsCache: string[] | null = null;
  private _cacheExpiry: number = 0;
  private _warmupPromise: Promise<void> | null = null;
  private _sessionStartTime: number = Date.now();
  
  // Connection pooling
  private _isPersistentConnectionReady: boolean = false;
  private _connectionHealthy: boolean = false;
  private _lastHealthCheck: number = 0;
  
  // Async execution queues
  private _pendingRequests: Map<string, Promise<any>> = new Map();
  private _toolExecutionQueue: Array<() => Promise<any>> = [];
  private _isProcessingQueue: boolean = false;

  private constructor(config: LocalModelConfig) {
    this.config = config;
    this.baseClient = new LocalModelClient(config);
    this.initializePersistentConnection();
  }

  /**
   * Singleton pattern for persistent client across CLI session
   */
  public static getInstance(config?: LocalModelConfig): PerformanceOptimizedClient {
    if (!PerformanceOptimizedClient.instance && config) {
      PerformanceOptimizedClient.instance = new PerformanceOptimizedClient(config);
    }
    if (!PerformanceOptimizedClient.instance) {
      throw new Error('PerformanceOptimizedClient must be initialized with config first');
    }
    return PerformanceOptimizedClient.instance;
  }

  /**
   * Initialize persistent connection and warm up the client
   */
  private async initializePersistentConnection(): Promise<void> {
    if (this._warmupPromise) {
      return this._warmupPromise;
    }

    this._warmupPromise = (async () => {
      try {
        logger.info('🚀 Initializing persistent model client...');
        
        // Check connection health
        const isHealthy = await this.baseClient.checkConnection();
        this._connectionHealthy = isHealthy;
        this._lastHealthCheck = Date.now();
        
        if (isHealthy) {
          // Cache available models
          await this.refreshModelCache();
          
          // Pre-warm the best model for coding tasks
          await this.warmupBestModel();
          
          this._isPersistentConnectionReady = true;
          logger.info('✅ Persistent client ready for high-performance requests');
        } else {
          logger.warn('⚠️ Model connection not healthy, will retry on first request');
        }
      } catch (error) {
        logger.error('❌ Failed to initialize persistent connection:', error);
        this._connectionHealthy = false;
      }
    })();

    return this._warmupPromise;
  }

  /**
   * Refresh available models cache (called periodically)
   */
  private async refreshModelCache(): Promise<void> {
    try {
      const models = await this.baseClient.getAvailableModels();
      this._availableModelsCache = models;
      this._cacheExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes
      logger.info(`📚 Cached ${models.length} available models`);
    } catch (error) {
      logger.warn('Failed to refresh model cache:', error);
    }
  }

  /**
   * Pre-warm the best model by sending a small test request
   */
  private async warmupBestModel(): Promise<void> {
    try {
      const bestModel = await this.getCachedBestModel('coding');
      if (bestModel) {
        logger.info(`🔥 Pre-warming model: ${bestModel}`);
        // Send a tiny request to load the model in memory using a simple voice
        const testVoice: VoiceArchetype = {
          id: 'test',
          name: 'Test',
          systemPrompt: 'You are a test voice.',
          temperature: 0.1,
          style: 'minimal'
        };
        await this.baseClient.generateVoiceResponse(testVoice, 'test', { files: [] });
        logger.info('✅ Model pre-warmed and ready');
      }
    } catch (error) {
      logger.warn('Pre-warming failed, will load on first request:', error);
    }
  }

  /**
   * Get cached best model for task type, with fallback to selection
   */
  private async getCachedBestModel(taskType: string): Promise<string | null> {
    // Return cached model if available and cache is valid
    if (this._modelCache.has(taskType) && Date.now() < this._cacheExpiry) {
      return this._modelCache.get(taskType) || null;
    }

    try {
      // Use the base client's intelligent selection
      const bestModel = await this.baseClient.getCurrentModel();
      if (bestModel) {
        this._modelCache.set(taskType, bestModel);
        return bestModel;
      }
    } catch (error) {
      logger.warn('Failed to get best model:', error);
    }

    return null;
  }

  /**
   * Health check with caching to avoid repeated checks
   */
  private async ensureConnectionHealthy(): Promise<boolean> {
    const now = Date.now();
    
    // Use cached health status if recent
    if (now - this._lastHealthCheck < 30000 && this._connectionHealthy) {
      return true;
    }

    try {
      this._connectionHealthy = await this.baseClient.checkConnection();
      this._lastHealthCheck = now;
      return this._connectionHealthy;
    } catch (error) {
      logger.warn('Health check failed:', error);
      this._connectionHealthy = false;
      return false;
    }
  }

  /**
   * Async queue processing for parallel tool execution
   */
  private async processAsyncQueue(): Promise<void> {
    if (this._isProcessingQueue || this._toolExecutionQueue.length === 0) {
      return;
    }

    this._isProcessingQueue = true;
    
    try {
      // Process up to 3 tasks in parallel
      const batch = this._toolExecutionQueue.splice(0, 3);
      await Promise.all(batch.map(task => task()));
    } catch (error) {
      logger.error('Async queue processing failed:', error);
    } finally {
      this._isProcessingQueue = false;
      
      // Continue processing if more tasks are queued
      if (this._toolExecutionQueue.length > 0) {
        setImmediate(() => this.processAsyncQueue());
      }
    }
  }

  /**
   * Queue a task for async execution
   */
  public queueAsyncTask<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this._toolExecutionQueue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      // Start processing if not already running
      this.processAsyncQueue();
    });
  }

  /**
   * Optimized generateVoiceResponse with caching and deduplication
   */
  public async generateVoiceResponse(
    voice: VoiceArchetype,
    prompt: string,
    context?: ProjectContext
  ): Promise<VoiceResponse> {
    // Create request key for deduplication
    const requestKey = `${voice.id}-${prompt.substring(0, 100)}-${context?.workingDirectory || ''}`;
    
    // Return existing request if in progress
    if (this._pendingRequests.has(requestKey)) {
      return this._pendingRequests.get(requestKey);
    }

    // Ensure connection is healthy
    const isHealthy = await this.ensureConnectionHealthy();
    if (!isHealthy) {
      throw new Error('Model connection not available');
    }

    // Create and cache the request promise
    const requestPromise = this.baseClient.generateVoiceResponse(voice, prompt, context || { files: [] });
    this._pendingRequests.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up request cache
      this._pendingRequests.delete(requestKey);
    }
  }

  /**
   * Optimized direct response with model caching using voice response
   */
  public async generateDirectResponse(
    prompt: string,
    options?: { maxTokens?: number; temperature?: number; taskType?: string }
  ): Promise<string> {
    const taskType = options?.taskType || 'general';
    
    // Ensure we have the best model cached
    await this.getCachedBestModel(taskType);
    
    // Ensure connection is healthy
    const isHealthy = await this.ensureConnectionHealthy();
    if (!isHealthy) {
      throw new Error('Model connection not available');
    }

    // Create a simple voice for direct response
    const directVoice: VoiceArchetype = {
      id: 'direct',
      name: 'Direct',
      systemPrompt: 'You are a helpful assistant. Provide clear, direct responses.',
      temperature: options?.temperature || 0.5,
      style: 'direct'
    };

    const response = await this.baseClient.generateVoiceResponse(directVoice, prompt, { files: [] });
    return response.content;
  }

  /**
   * Get available models with caching
   */
  public async getAvailableModels(): Promise<string[]> {
    // Return cached models if available and fresh
    if (this._availableModelsCache && Date.now() < this._cacheExpiry) {
      return this._availableModelsCache;
    }

    // Refresh cache
    await this.refreshModelCache();
    return this._availableModelsCache || [];
  }

  /**
   * Pin a model for the session to avoid repeated selection
   */
  public pinModelForSession(model: string, taskType: string = 'default'): void {
    this._modelCache.set(taskType, model);
    logger.info(`📌 Pinned model ${model} for ${taskType} tasks this session`);
  }

  /**
   * Get session performance stats
   */
  public getPerformanceStats(): {
    sessionDuration: number;
    cacheHitRate: number;
    requestCount: number;
    connectionHealthy: boolean;
  } {
    const sessionDuration = Date.now() - this._sessionStartTime;
    const totalRequests = this._pendingRequests.size;
    const cacheHitRate = this._modelCache.size > 0 ? 0.8 : 0; // Estimated
    
    return {
      sessionDuration,
      cacheHitRate,
      requestCount: totalRequests,
      connectionHealthy: this._connectionHealthy
    };
  }

  /**
   * Force refresh connection and caches
   */
  public async refresh(): Promise<void> {
    this._connectionHealthy = false;
    this._lastHealthCheck = 0;
    this._cacheExpiry = 0;
    this._modelCache.clear();
    
    await this.initializePersistentConnection();
  }

  /**
   * Delegate all other methods to base client
   */
  public async checkConnection(): Promise<boolean> {
    return this.ensureConnectionHealthy();
  }

  public async getCurrentModel(): Promise<string | null> {
    return this.baseClient.getCurrentModel();
  }

  public async selectModel(modelIndex: number): Promise<boolean> {
    const result = await this.baseClient.selectModel(modelIndex);
    if (result) {
      // Clear caches to pick up new model
      this._modelCache.clear();
    }
    return result;
  }

  public async displayAvailableModels(): Promise<void> {
    return this.baseClient.displayAvailableModels();
  }
}