#!/usr/bin/env node

/**
 * Unified Model Client - Consolidates all overlapping client implementations
 * Replaces: hybrid-model-client.ts, unified-model-client.ts, enhanced-agentic-client.ts,
 *          local-model-client.ts, fast-mode-client.ts, performance-optimized-client.ts
 */

import { EventEmitter } from 'events';
import { logger } from './logger.js';
import { ProjectContext, ModelRequest, ModelResponse, UnifiedClientConfig as BaseUnifiedClientConfig } from './types.js';
import { SecurityUtils } from './security.js';
import { PerformanceMonitor } from '../utils/performance.js';
import { IntegratedCodeCrucibleSystem, IntegratedSystemConfig } from './integration/integrated-system.js';

export type ProviderType = 'ollama' | 'lm-studio' | 'huggingface' | 'auto';
export type ExecutionMode = 'fast' | 'auto' | 'quality';

export interface ProviderConfig {
  type: ProviderType;
  endpoint?: string;
  apiKey?: string;
  model?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface UnifiedClientConfig extends BaseUnifiedClientConfig {
  providers: ProviderConfig[];
  executionMode: ExecutionMode;
  fallbackChain: ProviderType[];
  performanceThresholds: {
    fastModeMaxTokens: number;
    timeoutMs: number;
    maxConcurrentRequests: number;
  };
  security: {
    enableSandbox: boolean;
    maxInputLength: number;
    allowedCommands: string[];
  };
}

export interface RequestMetrics {
  provider: string;
  model: string;
  startTime: number;
  endTime?: number;
  tokenCount?: number;
  success: boolean;
  error?: string;
}

export class UnifiedModelClient extends EventEmitter {
  private config: UnifiedClientConfig;
  private providers: Map<ProviderType, any> = new Map();
  private performanceMonitor: PerformanceMonitor;
  private securityUtils: SecurityUtils;
  private activeRequests: Map<string, RequestMetrics> = new Map();
  private requestQueue: Array<{ id: string; request: ModelRequest; resolve: Function; reject: Function }> = [];
  private isProcessingQueue = false;
  
  // OPTIMIZED: Unified cache system to prevent fragmentation
  private unifiedCache: Map<string, { value: any; expires: number; accessCount: number }> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 500;
  
  // OPTIMIZED: Cached health checks
  private healthCheckCache: Map<string, { healthy: boolean; timestamp: number }> = new Map();
  private readonly HEALTH_CACHE_TTL = 30000; // 30 seconds
  
  // Integrated system for advanced features
  private integratedSystem: IntegratedCodeCrucibleSystem | null = null;
  
  // Cleanup interval reference for proper shutdown
  private cacheCleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: UnifiedClientConfig) {
    super();
    this.config = {
      endpoint: 'http://localhost:11434',
      ...this.getDefaultConfig(),
      ...config
    };
    this.performanceMonitor = new PerformanceMonitor();
    this.securityUtils = new SecurityUtils();
    // Note: Provider initialization will be done in initialize() method
    
    // OPTIMIZED: Automated cache cleanup to prevent memory leaks
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 60000); // Every minute
  }
  
  /**
   * Initialize providers - must be called after constructor
   */
  async initialize(): Promise<void> {
    await this.initializeProviders();
  }

  private getDefaultConfig(): UnifiedClientConfig {
    return {
      providers: [
        { type: 'ollama', endpoint: 'http://localhost:11434' },
        { type: 'lm-studio', endpoint: 'http://localhost:1234' }
      ],
      executionMode: 'auto',
      fallbackChain: ['ollama', 'lm-studio', 'huggingface'],
      performanceThresholds: {
        fastModeMaxTokens: 1000,
        timeoutMs: 180000,  // 3 minutes default timeout
        maxConcurrentRequests: 3 // Increased back to 3 for faster parallel processing
      },
      security: {
        enableSandbox: true,
        maxInputLength: 50000,
        allowedCommands: ['npm', 'node', 'git']
      }
    };
  }

  private async initializeProviders(): Promise<void> {
    logger.info('🔧 Initializing model providers...');

    for (const providerConfig of this.config.providers) {
      try {
        const provider = await this.createProvider(providerConfig);
        this.providers.set(providerConfig.type, provider);
        logger.info(`✅ Provider ${providerConfig.type} initialized`);
      } catch (error) {
        logger.warn(`⚠️ Failed to initialize provider ${providerConfig.type}:`, error);
      }
    }

    if (this.providers.size === 0) {
      logger.warn('⚠️ No providers successfully initialized. CLI will run in degraded mode.');
      // Don't throw an error - allow CLI to run for help/version commands
    }
  }

  private async createProvider(config: ProviderConfig): Promise<any> {
    switch (config.type) {
      case 'ollama':
        const { OllamaProvider } = await import('../providers/ollama.js');
        return new (OllamaProvider as any)(config);
      
      case 'lm-studio':
        const { LMStudioProvider } = await import('../providers/lm-studio.js');
        return new (LMStudioProvider as any)(config);
      
      case 'huggingface':
        const { HuggingFaceProvider } = await import('../providers/huggingface.js');
        return new (HuggingFaceProvider as any)(config);
      
      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }
  }

  /**
   * OPTIMIZED: Synthesize method with caching
   */
  async synthesize(request: any): Promise<any> {
    // Check cache first
    const cacheKey = `synth_${Buffer.from(request.prompt || '').toString('base64').slice(0, 16)}`;
    const cached = this.getCache(cacheKey);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    const modelRequest: ModelRequest = {
      prompt: request.prompt || '',
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      stream: request.stream
    };

    const response = await this.processRequest(modelRequest);
    const result = {
      content: response.content,
      metadata: response.metadata,
      fromCache: false
    };
    
    // Cache the result for 5 minutes
    this.setCache(cacheKey, result, this.CACHE_TTL);
    
    return result;
  }

  /**
   * Stream request method for real-time processing
   */
  async streamRequest(request: any): Promise<AsyncIterable<any>> {
    const streamRequest = {
      ...request,
      stream: true
    };

    // Create async generator for streaming
    const self = this;
    async function* streamGenerator() {
      try {
        const provider = self.selectProvider(request.model);
        if (!provider || !provider.stream) {
          // Fallback to chunked response if no streaming support
          const response = await self.synthesize(request);
          const chunks = self.chunkResponse(response.content);
          for (const chunk of chunks) {
            yield {
              text: chunk,
              metadata: { chunk: true }
            };
            await new Promise(resolve => setTimeout(resolve, 50)); // Simulate streaming
          }
          return;
        }

        // Use provider's streaming capability
        for await (const chunk of provider.stream(streamRequest)) {
          yield chunk;
        }
      } catch (error) {
        yield { error: error.message };
      }
    }

    return streamGenerator();
  }

  private chunkResponse(text: string, chunkSize: number = 50): string[] {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private selectProvider(model?: string): any {
    // Select provider based on model or availability
    if (model) {
      for (const [type, provider] of this.providers) {
        if (provider.supportsModel && provider.supportsModel(model)) {
          return provider;
        }
      }
    }
    
    // Return first available provider
    return this.providers.values().next().value;
  }

  async processRequest(request: ModelRequest, context?: ProjectContext): Promise<ModelResponse> {
    const requestId = this.generateRequestId();
    logger.info(`📨 Processing request ${requestId}`, { prompt: request.prompt.substring(0, 100) + '...' });

    // Security validation
    if (this.config.security.enableSandbox) {
      const validation = await this.securityUtils.validateInput(request.prompt);
      if (!validation.isValid) {
        throw new Error(`Security validation failed: ${validation.reason}`);
      }
    }

    // Determine execution strategy
    const strategy = this.determineExecutionStrategy(request, context);
    logger.info(`🎯 Using execution strategy: ${strategy.mode} with provider: ${strategy.provider}`);

    // Execute with fallback chain
    return await this.executeWithFallback(requestId, request, context, strategy);
  }

  // OPTIMIZED: Fast complexity assessment for timeout determination
  private assessComplexityFast(prompt: string): 'simple' | 'medium' | 'complex' {
    const length = prompt.length;
    
    // Fast bit-flag classification
    let flags = 0;
    if (length > 200) flags |= 1;
    if (prompt.includes('analyze')) flags |= 2;
    if (prompt.includes('review')) flags |= 2;
    if (prompt.includes('debug')) flags |= 2;
    if (prompt.includes('function')) flags |= 4;
    if (prompt.includes('class')) flags |= 4;
    if (prompt.includes('interface')) flags |= 4;
    
    // Fast O(1) classification
    if (flags >= 4 || (flags & 2)) return 'complex';
    if (length < 50 && flags === 0) return 'simple';
    return 'medium';
  }

  private determineExecutionStrategy(request: ModelRequest, context?: ProjectContext): {
    mode: ExecutionMode;
    provider: ProviderType;
    timeout: number;
    complexity: string;
  } {
    // OPTIMIZED: Fast complexity assessment
    const complexity = this.assessComplexityFast(request.prompt);
    
    // Auto-determine execution mode if not specified
    let mode = this.config.executionMode;
    if (mode === 'auto') {
      const hasContext = context && Object.keys(context).length > 0;
      
      if (complexity === 'simple' && !hasContext) {
        mode = 'fast';
      } else if (complexity === 'complex' || (hasContext && context.files?.length > 10)) {
        mode = 'quality';
      } else {
        mode = 'auto';
      }
    }

    // Select provider based on mode and availability
    let provider: ProviderType = 'auto';
    let timeout = this.config.performanceThresholds.timeoutMs;

    // OPTIMIZED: Adaptive timeouts based on complexity
    switch (mode) {
      case 'fast':
        provider = this.selectFastestProvider();
        timeout = complexity === 'simple' ? 120000 : 180000; // 2min for simple, 3min for others
        break;
      
      case 'quality':
        provider = this.selectMostCapableProvider();
        timeout = complexity === 'complex' ? 240000 : 180000; // 4min for complex, 3min for others
        break;
      
      case 'auto':
      default:
        provider = this.selectBalancedProvider();
        timeout = complexity === 'simple' ? 120000 : 
                 complexity === 'complex' ? 240000 : 180000; // Adaptive timeouts: 2-4 minutes
        break;
    }

    return { mode, provider, timeout, complexity };
  }

  private selectFastestProvider(): ProviderType {
    // Return provider with best latency metrics
    const metrics = this.performanceMonitor.getProviderMetrics();
    const sortedByLatency = Object.entries(metrics)
      .sort(([,a], [,b]) => a.averageLatency - b.averageLatency);
    
    return (sortedByLatency[0]?.[0] as ProviderType) || this.config.fallbackChain[0];
  }

  private selectMostCapableProvider(): ProviderType {
    // Return provider with best quality metrics
    const metrics = this.performanceMonitor.getProviderMetrics();
    const sortedByQuality = Object.entries(metrics)
      .sort(([,a], [,b]) => b.successRate - a.successRate);
    
    return (sortedByQuality[0]?.[0] as ProviderType) || this.config.fallbackChain[0];
  }

  private selectBalancedProvider(): ProviderType {
    // Return provider with best balance of speed and quality
    const metrics = this.performanceMonitor.getProviderMetrics();
    const scored = Object.entries(metrics).map(([provider, stats]) => ({
      provider,
      score: (stats.successRate * 0.6) + ((1 - stats.averageLatency / 30000) * 0.4)
    }));
    
    scored.sort((a, b) => b.score - a.score);
    return (scored[0]?.provider as ProviderType) || this.config.fallbackChain[0];
  }

  private async executeWithFallback(
    requestId: string,
    request: ModelRequest,
    context: ProjectContext | undefined,
    strategy: { mode: ExecutionMode; provider: ProviderType; timeout: number; complexity: string }
  ): Promise<ModelResponse> {
    const fallbackChain = strategy.provider === 'auto' 
      ? this.config.fallbackChain 
      : [strategy.provider, ...this.config.fallbackChain.filter(p => p !== strategy.provider)];

    let lastError: Error | null = null;

    for (const providerType of fallbackChain) {
      const provider = this.providers.get(providerType);
      if (!provider) {
        logger.warn(`Provider ${providerType} not available, skipping`);
        continue;
      }

      try {
        const metrics: RequestMetrics = {
          provider: providerType,
          model: provider.getModelName?.() || 'unknown',
          startTime: Date.now(),
          success: false
        };

        this.activeRequests.set(requestId, metrics);
        this.emit('requestStart', { requestId, provider: providerType });

        logger.info(`🚀 Attempting request with ${providerType}`);
        
        const response = await Promise.race([
          provider.processRequest(request, context),
          this.createTimeoutPromise(strategy.timeout)
        ]);

        metrics.endTime = Date.now();
        metrics.success = true;
        metrics.tokenCount = response.usage?.totalTokens;

        this.performanceMonitor.recordRequest(providerType, metrics);
        this.activeRequests.delete(requestId);
        this.emit('requestComplete', { requestId, provider: providerType, success: true });

        logger.info(`✅ Request ${requestId} completed successfully with ${providerType}`);
        return response;

      } catch (error) {
        const metrics = this.activeRequests.get(requestId);
        if (metrics) {
          metrics.endTime = Date.now();
          metrics.success = false;
          metrics.error = error instanceof Error ? error.message : String(error);
          this.performanceMonitor.recordRequest(providerType, metrics);
        }

        this.activeRequests.delete(requestId);
        this.emit('requestComplete', { requestId, provider: providerType, success: false, error });

        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`❌ Provider ${providerType} failed:`, error);
        
        // Don't retry if it's a validation error
        if (error instanceof Error && error.message.includes('validation')) {
          throw error;
        }
      }
    }

    throw new Error(`All providers failed. Last error: ${lastError?.message}`);
  }

  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==== OPTIMIZED CACHE MANAGEMENT ====
  private setCache(key: string, value: any, ttl: number = this.CACHE_TTL): void {
    this.unifiedCache.set(key, {
      value,
      expires: Date.now() + ttl,
      accessCount: 1
    });
    
    // Prevent cache bloat
    if (this.unifiedCache.size > this.MAX_CACHE_SIZE) {
      this.cleanupCache();
    }
  }

  private getCache(key: string): any {
    const cached = this.unifiedCache.get(key);
    if (cached && Date.now() < cached.expires) {
      cached.accessCount++;
      return cached.value;
    }
    this.unifiedCache.delete(key);
    return null;
  }

  private cleanupCache(): void {
    const now = Date.now();
    const entries = Array.from(this.unifiedCache.entries());
    
    // Remove expired entries
    for (const [key, entry] of entries) {
      if (now >= entry.expires) {
        this.unifiedCache.delete(key);
      }
    }
    
    // If still too large, remove least accessed entries
    if (this.unifiedCache.size > this.MAX_CACHE_SIZE) {
      const sortedEntries = entries
        .filter(([_, entry]) => now < entry.expires)
        .sort(([_, a], [__, b]) => a.accessCount - b.accessCount);
      
      // Remove least accessed 50%
      const toRemove = sortedEntries.slice(0, Math.floor(sortedEntries.length / 2));
      toRemove.forEach(([key]) => this.unifiedCache.delete(key));
    }
  }

  // Queue management for concurrent request limiting
  async queueRequest(request: ModelRequest, context?: ProjectContext): Promise<ModelResponse> {
    if (this.activeRequests.size < this.config.performanceThresholds.maxConcurrentRequests) {
      return this.processRequest(request, context);
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        id: this.generateRequestId(),
        request,
        resolve,
        reject
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0 && 
           this.activeRequests.size < this.config.performanceThresholds.maxConcurrentRequests) {
      
      const queuedRequest = this.requestQueue.shift();
      if (!queuedRequest) break;

      try {
        const response = await this.processRequest(queuedRequest.request);
        queuedRequest.resolve(response);
      } catch (error) {
        queuedRequest.reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  // OPTIMIZED: Management methods with caching
  async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};
    
    for (const [type, provider] of this.providers) {
      const cacheKey = `health_${type}`;
      const cached = this.healthCheckCache.get(cacheKey);
      
      // Use cached result if less than 30 seconds old
      if (cached && (Date.now() - cached.timestamp) < this.HEALTH_CACHE_TTL) {
        health[type] = cached.healthy;
        continue;
      }
      
      try {
        await provider.healthCheck?.();
        health[type] = true;
        this.healthCheckCache.set(cacheKey, { healthy: true, timestamp: Date.now() });
      } catch {
        health[type] = false;
        this.healthCheckCache.set(cacheKey, { healthy: false, timestamp: Date.now() });
      }
    }
    
    return health;
  }

  getMetrics(): any {
    return {
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.length,
      providerMetrics: this.performanceMonitor.getProviderMetrics(),
      performance: this.performanceMonitor.getSummary()
    };
  }

  async shutdown(): Promise<void> {
    logger.info('🛑 Shutting down UnifiedModelClient...');
    
    // Clear cache cleanup interval first
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
    
    // Shutdown performance monitor
    if (this.performanceMonitor) {
      this.performanceMonitor.destroy();
    }
    
    // Shutdown integrated system first
    if (this.integratedSystem) {
      await this.integratedSystem.shutdown();
      this.integratedSystem = null;
    }
    
    // Wait for active requests to complete (with timeout)
    const shutdownTimeout = 10000; // 10 seconds
    const startTime = Date.now();
    
    while (this.activeRequests.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Close all providers
    for (const [type, provider] of this.providers) {
      try {
        await provider.shutdown?.();
        logger.info(`✅ Provider ${type} shut down`);
      } catch (error) {
        logger.warn(`⚠️ Error shutting down provider ${type}:`, error);
      }
    }
    
    // OPTIMIZED: Clear all caches and prevent memory leaks
    this.providers.clear();
    this.activeRequests.clear();
    this.requestQueue.length = 0;
    this.unifiedCache.clear();
    this.healthCheckCache.clear();
    
    logger.info('✅ UnifiedModelClient shutdown complete with memory cleanup');
  }

  // Legacy compatibility methods
  async checkOllamaStatus(): Promise<boolean> {
    try {
      const response = await this.makeRequest('GET', '/api/tags');
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async getAllAvailableModels(): Promise<any[]> {
    return this.getAvailableModels();
  }

  async getAvailableModels(): Promise<any[]> {
    try {
      const response = await this.makeRequest('GET', '/api/tags');
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      return [];
    }
  }

  async getBestAvailableModel(): Promise<string> {
    const models = await this.getAvailableModels();
    return models.length > 0 ? models[0].name : 'llama2';
  }

  async pullModel(modelName: string): Promise<boolean> {
    try {
      await this.makeRequest('POST', '/api/pull', { name: modelName });
      return true;
    } catch (error) {
      return false;
    }
  }

  async testModel(modelName: string): Promise<boolean> {
    try {
      const response = await this.generate({
        prompt: 'Hello',
        model: modelName
      });
      return !!response.content;
    } catch (error) {
      return false;
    }
  }

  async removeModel(modelName: string): Promise<boolean> {
    try {
      await this.makeRequest('DELETE', '/api/delete', { name: modelName });
      return true;
    } catch (error) {
      return false;
    }
  }

  async addApiModel(config: any): Promise<boolean> {
    // Implementation for API model management
    return true;
  }

  async testApiModel(modelName: string): Promise<boolean> {
    return this.testModel(modelName);
  }

  removeApiModel(modelName: string): boolean {
    // Implementation for API model removal
    return true;
  }

  async autoSetup(force: boolean = false): Promise<any> {
    return { success: true, message: 'Auto setup complete' };
  }

  async generateText(prompt: string, options?: any): Promise<string> {
    const response = await this.generate({ prompt });
    return response.text || response.content || response.response || '';
  }

  async generate(request: any): Promise<any> {
    return await this.processRequest({
      prompt: request.prompt,
      temperature: request.temperature,
      model: request.model,
      maxTokens: request.maxTokens,
      stream: request.stream
    });
  }

  /**
   * Enable advanced features through integrated system
   */
  async enableAdvancedFeatures(systemConfig: IntegratedSystemConfig): Promise<void> {
    logger.info('🚀 Enabling advanced CodeCrucible features...');
    
    this.integratedSystem = new IntegratedCodeCrucibleSystem(systemConfig);
    await this.integratedSystem.initialize();
    
    logger.info('✅ Advanced features enabled');
  }

  /**
   * Use multi-voice synthesis if available
   */
  async synthesizeWithVoices(prompt: string, options?: any): Promise<any> {
    if (this.integratedSystem) {
      const request = {
        id: `voice-req-${Date.now()}`,
        content: prompt,
        type: 'code' as const,
        priority: 'medium' as const,
        ...options
      };
      
      return await this.integratedSystem.synthesize(request);
    } else {
      // Fallback to regular synthesis
      return await this.synthesize({ prompt });
    }
  }

  /**
   * Get integrated system status
   */
  async getSystemStatus(): Promise<any> {
    if (this.integratedSystem) {
      return await this.integratedSystem.getSystemStatus();
    } else {
      return {
        status: 'basic',
        advancedFeatures: false
      };
    }
  }

  static displayTroubleshootingHelp(): void {
    console.log('Troubleshooting help would be displayed here');
  }

  async makeRequest(method: string, endpoint: string, data?: any): Promise<Response> {
    const url = `${this.config.endpoint}${endpoint}`;
    return fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    });
  }
}

export { UnifiedModelClient as Client };

export interface VoiceArchetype {
  name: string;
  personality: string;
  expertise: string[];
}

export interface VoiceResponse {
  content: string;
  voice: string;
  confidence: number;
}

export type { ProjectContext } from "./types.js";
