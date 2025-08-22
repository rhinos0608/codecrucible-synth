#!/usr/bin/env node

/**
 * Unified Model Client - Consolidates all overlapping client implementations
 * Replaces: hybrid-model-client.ts, unified-model-client.ts, enhanced-agentic-client.ts,
 *          local-model-client.ts, fast-mode-client.ts, performance-optimized-client.ts
 */

import { EventEmitter } from 'events';
// import { join } from 'path';
import { logger } from './logger.js';
import {
  ProjectContext,
  ModelRequest,
  ModelResponse,
  UnifiedClientConfig as BaseUnifiedClientConfig,
} from './types.js';
import { SecurityValidator, ISecurityValidator } from './security/security-validator.js';
import { PerformanceMonitor } from '../utils/performance.js';
import {
  IntegratedCodeCrucibleSystem,
  IntegratedSystemConfig,
} from './integration/integrated-system.js';
import { HardwareAwareModelSelector } from './performance/hardware-aware-model-selector.js';
import { getGlobalToolIntegration } from './tools/tool-integration.js';
import { getGlobalEnhancedToolIntegration } from './tools/enhanced-tool-integration.js';
import { ActiveProcessManager, ActiveProcess } from './performance/active-process-manager.js';
// import { unifiedCache } from './cache/unified-cache-system.js';
import { HybridLLMRouter, HybridConfig } from './hybrid/hybrid-llm-router.js';
// import { intelligentBatchProcessor } from './performance/intelligent-batch-processor.js';
import {
  ProviderRepository,
  ProviderType,
  IProviderRepository,
  ProviderConfig,
} from './providers/provider-repository.js';
import { getErrorMessage, toError } from '../utils/error-utils.js';
import { createHash } from 'crypto';
import { StreamingManager, IStreamingManager } from './streaming/streaming-manager.js';
import { CacheCoordinator, ICacheCoordinator } from './caching/cache-coordinator.js';

// Import streaming interfaces from extracted module
import type { StreamToken, StreamConfig } from './streaming/streaming-manager.js';
export type {
  StreamToken,
  StreamConfig,
  StreamMetrics,
  IStreamingManager,
} from './streaming/streaming-manager.js';

// Import DI interfaces
import type { IModelClient } from './interfaces/client-interfaces.js';

// Re-export provider types from ProviderRepository
export type { ProviderType, ProviderConfig } from './providers/provider-repository.js';
export type ExecutionMode = 'fast' | 'auto' | 'quality';

/**
 * Helper function to create default UnifiedClientConfig with streaming
 */
export function createDefaultUnifiedClientConfig(
  overrides: Partial<UnifiedClientConfig> = {}
): UnifiedClientConfig {
  return {
    providers: [
      { type: 'ollama', endpoint: 'http://localhost:11434' },
      { type: 'lm-studio', endpoint: 'http://localhost:1234' },
    ],
    executionMode: 'auto',
    fallbackChain: ['ollama', 'lm-studio', 'huggingface'],
    performanceThresholds: {
      fastModeMaxTokens: 1000,
      timeoutMs: 180000,
      maxConcurrentRequests: 3,
    },
    security: {
      enableSandbox: true,
      maxInputLength: 50000,
      allowedCommands: ['npm', 'node', 'git'],
    },
    streaming: {
      chunkSize: 50,
      bufferSize: 1024,
      enableBackpressure: true,
      timeout: 30000,
      encoding: 'utf8',
    },
    ...overrides,
  };
}

// ProviderConfig moved to ProviderRepository

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
  streaming?: StreamConfig;
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

export class UnifiedModelClient extends EventEmitter implements IModelClient {
  private config: UnifiedClientConfig;
  // Provider management extracted to ProviderRepository
  private providerRepository: IProviderRepository;
  private performanceMonitor: PerformanceMonitor;
  private securityValidator: ISecurityValidator;
  private activeRequests: Map<string, RequestMetrics> = new Map();
  private requestQueue: Array<{
    id: string;
    request: ModelRequest;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }> = [];
  private isProcessingQueue = false;

  // Cache management extracted to CacheCoordinator
  private cacheCoordinator: ICacheCoordinator;

  // Hardware-aware model management
  private hardwareSelector: HardwareAwareModelSelector;
  private processManager: ActiveProcessManager;
  private currentModel: string | null = null;
  private readonly HEALTH_CACHE_TTL = 30000; // 30 seconds

  // Streaming management (extracted to StreamingManager)
  private streamingManager: IStreamingManager;

  // Integrated system for advanced features
  private integratedSystem: IntegratedCodeCrucibleSystem | null = null;

  // HYBRID ARCHITECTURE: Intelligent routing between LM Studio and Ollama
  private hybridRouter: HybridLLMRouter | null = null;

  // Memory warning throttling
  private lastMemoryWarningTime = 0;

  // PERFORMANCE FIX: AbortController for cleanup
  private abortController: AbortController;
  private isShuttingDown = false;

  // ASYNC INITIALIZATION: Track initialization state
  private initialized = false;

  constructor(
    config: UnifiedClientConfig,
    // DI-enabled constructor with optional injected dependencies
    injectedDependencies?: {
      providerRepository?: IProviderRepository;
      securityValidator?: ISecurityValidator;
      streamingManager?: IStreamingManager;
      cacheCoordinator?: ICacheCoordinator;
      performanceMonitor?: any; // Use any for now to avoid interface mismatch
      hybridRouter?: any; // Use any for now to avoid interface mismatch
    }
  ) {
    super();
    // Increase max listeners to prevent memory leak warnings
    this.setMaxListeners(50);

    // PERFORMANCE FIX: Initialize AbortController
    this.abortController = new AbortController();

    this.config = {
      endpoint: 'http://localhost:11434',
      ...this.getDefaultConfig(),
      ...config,
    };

    // Use injected dependencies if available, otherwise create them (backward compatibility)
    this.performanceMonitor = injectedDependencies?.performanceMonitor || new PerformanceMonitor();
    
    this.securityValidator = injectedDependencies?.securityValidator || new SecurityValidator({
      enableSandbox: this.config.security?.enableSandbox,
      maxInputLength: this.config.security?.maxInputLength,
    });

    // Initialize hardware-aware components (these don't have circular dependencies yet)
    this.hardwareSelector = new HardwareAwareModelSelector();
    this.processManager = new ActiveProcessManager(this.hardwareSelector);

    // Use injected dependencies or create new ones
    this.streamingManager = injectedDependencies?.streamingManager || new StreamingManager(config.streaming);
    this.providerRepository = injectedDependencies?.providerRepository || new ProviderRepository();
    this.cacheCoordinator = injectedDependencies?.cacheCoordinator || new CacheCoordinator();

    // HYBRID ARCHITECTURE: Use injected router or initialize new one
    if (injectedDependencies?.hybridRouter) {
      this.hybridRouter = injectedDependencies.hybridRouter;
      logger.info('🚀 Using injected Hybrid LLM Router');
    } else {
      this.initializeHybridRouter();
    }

    // Setup event listeners for model switching
    this.setupModelSwitchingEvents();

    // Note: Provider initialization will be done in initialize() method
  }

  /**
   * Initialize hybrid router for intelligent LLM selection
   */
  private initializeHybridRouter(): void {
    try {
      const hybridConfig: HybridConfig = {
        lmStudio: {
          endpoint: 'http://localhost:1234',
          enabled: true,
          models: ['codellama-7b-instruct', 'gemma-2b-it'],
          maxConcurrent: 3,
          strengths: ['speed', 'templates', 'formatting', 'boilerplate'],
        },
        ollama: {
          endpoint: 'http://localhost:11434',
          enabled: true,
          models: ['codellama:34b', 'qwen2.5:72b', 'deepseek-coder:8b'],
          maxConcurrent: 1,
          strengths: ['analysis', 'reasoning', 'security', 'architecture'],
        },
        routing: {
          defaultProvider: 'auto',
          escalationThreshold: 0.7,
          confidenceScoring: true,
          learningEnabled: true,
        },
      };

      this.hybridRouter = new HybridLLMRouter(hybridConfig);

      // Set up router event listeners for monitoring
      this.hybridRouter.on('routing-decision', event => {
        logger.debug('Hybrid routing decision:', event);
        this.emit('hybrid-routing', event);
      });

      this.hybridRouter.on('performance-recorded', event => {
        logger.debug('Hybrid performance recorded:', event);
        this.emit('hybrid-performance', event);
      });

      logger.info('🚀 Hybrid LLM Router initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize hybrid router:', error);
      // Continue without hybrid routing - fallback to existing routing
    }
  }

  /**
   * Initialize providers - must be called after constructor
   */
  async initialize(): Promise<void> {
    logger.info('Starting async initialization');

    // Mark as initialized immediately for basic functionality
    this.initialized = true;

    // Start provider initialization in background (non-blocking)
    this.initializeProvidersAsync()
      .then(() => {
        logger.info('Background provider initialization completed');
        this.emit('providers-ready');
      })
      .catch(error => {
        logger.warn('Background provider initialization had issues', error);
        this.emit('providers-partial', { error });
      });

    // Initialize basic model configuration immediately with fallback
    try {
      const optimalConfig = await this.hardwareSelector.getOptimalModelForHardware();
      this.currentModel = optimalConfig.writer.model;
      this.hardwareSelector.setCurrentModel(this.currentModel);
      logger.info('Immediate initialization completed', { model: this.currentModel });
    } catch (error) {
      logger.warn('Could not determine optimal model immediately, will retry when providers are ready');
      this.currentModel = 'auto'; // Fallback
    }
  }

  /**
   * Setup model switching event listeners
   */
  private setupModelSwitchingEvents(): void {
    this.processManager.on('processTerminated', event => {
      logger.warn(`Process ${event.processId} terminated due to ${event.reason}`, {
        memory: `${(event.resourceUsage.memory * 100).toFixed(1)}%`,
        cpu: `${(event.resourceUsage.cpu * 100).toFixed(1)}%`,
      });
    });

    this.processManager.on('modelSwitched', event => {
      this.currentModel = event.toModel;
      logger.info(`Model switched to ${event.toModel} due to ${event.reason}`);

      // Emit event for external listeners
      this.emit('modelSwitched', event);
    });

    this.processManager.on('memoryWarning', event => {
      // DISABLED: Memory warnings are too verbose for normal operation
      // Only emit the event but don't log anything
      this.emit('memoryWarning', event);
    });
  }

  private getDefaultConfig(): UnifiedClientConfig {
    return {
      providers: [
        { type: 'ollama', endpoint: 'http://localhost:11434' },
        { type: 'lm-studio', endpoint: 'http://localhost:1234' },
      ],
      executionMode: 'auto',
      fallbackChain: ['ollama', 'lm-studio', 'huggingface'],
      performanceThresholds: {
        fastModeMaxTokens: 1000,
        timeoutMs: 180000, // 3 minutes default timeout
        maxConcurrentRequests: 3, // Increased back to 3 for faster parallel processing
      },
      security: {
        enableSandbox: true,
        maxInputLength: 50000,
        allowedCommands: ['npm', 'node', 'git'],
      },
      streaming: {
        chunkSize: 50,
        bufferSize: 1024,
        enableBackpressure: true,
        timeout: 30000,
        encoding: 'utf8',
      },
    };
  }

  /**
   * Async provider initialization - runs in background without blocking CLI startup
   */
  private async initializeProvidersAsync(): Promise<void> {
    logger.info('Starting background provider initialization');
    const startTime = Date.now();

    // Track initialization state
    const initResults = new Map<string, { success: boolean; error?: Error; duration: number }>();

    // Initialize providers with parallel execution and timeout handling
    const initPromises = this.config.providers.map(async providerConfig => {
      const providerStartTime = Date.now();
      try {
        logger.debug('Initializing provider', { type: providerConfig.type });

        // Add timeout for individual provider initialization
        const initTimeout = 10000; // 10 second timeout per provider
        const provider = await Promise.race([
          this.createProvider(providerConfig),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Provider ${providerConfig.type} initialization timeout`)),
              initTimeout
            )
          ),
        ]);

        await this.providerRepository.initialize([providerConfig]);
        const duration = Date.now() - providerStartTime;

        initResults.set(providerConfig.type, { success: true, duration });
        logger.info('Provider initialized', { type: providerConfig.type, duration });

        // Emit individual provider ready event
        this.emit('provider-ready', { type: providerConfig.type, provider, duration });

        return { type: providerConfig.type, success: true, duration };
      } catch (error) {
        const duration = Date.now() - providerStartTime;
        const errorObj = error instanceof Error ? error : new Error(String(error));

        initResults.set(providerConfig.type, { success: false, error: errorObj, duration });
        logger.warn('Provider failed', { 
          type: providerConfig.type, 
          duration, 
          error: errorObj.message 
        });

        // Emit provider failure event
        this.emit('provider-failed', { type: providerConfig.type, error: errorObj, duration });

        return { type: providerConfig.type, success: false, error: errorObj, duration };
      }
    });

    // Wait for all providers to complete (success or failure)
    await Promise.allSettled(initPromises);

    const totalDuration = Date.now() - startTime;
    const successCount = this.providerRepository.getAvailableProviders().size;
    const totalCount = this.config.providers.length;

    logger.info('Provider initialization completed', {
      successful: successCount,
      total: totalCount,
      duration: totalDuration
    });

    // Log detailed results
    for (const [providerType, result] of initResults) {
      if (result.success) {
        logger.info(`✅ Provider ${providerType} ready (${result.duration}ms)`);
      } else {
        logger.warn(
          `❌ Provider ${providerType} failed (${result.duration}ms):`,
          result.error?.message
        );
      }
    }

    if (this.providerRepository.getAvailableProviders().size === 0) {
      logger.warn('⚠️ No providers successfully initialized. CLI will run in degraded mode.');
      throw new Error('No providers available');
    } else if (this.providerRepository.getAvailableProviders().size < totalCount) {
      logger.warn(
        `⚠️ Only ${successCount}/${totalCount} providers initialized. Some features may be limited.`
      );
    }

    // Re-evaluate optimal model configuration now that providers are ready
    try {
      const optimalConfig = await this.hardwareSelector.getOptimalModelForHardware();
      if (this.currentModel === 'auto' || !this.currentModel) {
        this.currentModel = optimalConfig.writer.model;
        this.hardwareSelector.setCurrentModel(this.currentModel);
        logger.info('Updated to optimal model', { model: this.currentModel });
      }
    } catch (error) {
      logger.warn('Could not update optimal model configuration', error);
    }
  }

  /**
   * Legacy synchronous provider initialization (kept for compatibility)
   */
  private async initializeProviders(): Promise<void> {
    return this.initializeProvidersAsync();
  }

  private async createProvider(config: ProviderConfig): Promise<any> {
    switch (config.type) {
      case 'ollama': {
        const { OllamaProvider } = await import('../providers/ollama.js');
        return new (OllamaProvider as any)(config);
      }

      case 'lm-studio': {
        const { LMStudioProvider } = await import('../providers/lm-studio.js');
        return new (LMStudioProvider as any)(config);
      }

      case 'huggingface': {
        // HuggingFace provider is not yet implemented - fallback to Ollama
        logger.warn('HuggingFace provider not implemented, falling back to Ollama');
        const { OllamaProvider: HFOllamaProvider } = await import('../providers/ollama.js');
        return new (HFOllamaProvider as any)({ ...config, type: 'ollama' });
      }

      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }
  }

  /**
   * HYBRID ARCHITECTURE: Enhanced synthesize method with intelligent routing
   */
  async synthesize(request: any): Promise<any> {
    // INTELLIGENT CACHING: Check cache with content-aware key generation
    const cacheKey = this.cacheCoordinator.generateIntelligentCacheKey(request);
    const cached = await this.cacheCoordinator.get(cacheKey);
    if (cached && this.cacheCoordinator.shouldUseIntelligentCache(request)) {
      logger.debug('Returning cached response');
      return { ...cached, fromCache: true };
    }

    let selectedProvider = request.provider;
    let routingDecision = null;

    // HYBRID ROUTING: Use intelligent router if available and no provider specified
    if (!selectedProvider && this.hybridRouter) {
      try {
        const taskType = this.inferTaskType(request.prompt || '');
        const complexity = this.analyzeComplexity(request.prompt || '', request);

        routingDecision = await this.hybridRouter.routeTask(
          taskType,
          request.prompt || '',
          complexity
        );
        selectedProvider = routingDecision.selectedLLM === 'lm-studio' ? 'lm-studio' : 'ollama';

        logger.info(
          `🤖 Hybrid routing: ${taskType} task → ${selectedProvider} (confidence: ${routingDecision.confidence})`
        );
      } catch (error) {
        logger.warn('Hybrid routing failed, using fallback:', error);
        selectedProvider = 'ollama'; // Default fallback
      }
    }

    // Get available tools for function calling - only for compatible models
    // Try enhanced tool integration first, fallback to local tools
    const enhancedToolIntegration = getGlobalEnhancedToolIntegration();
    const toolIntegration = enhancedToolIntegration || getGlobalToolIntegration();
    const supportsTools = this.modelSupportsTools(selectedProvider, request.model);
    const tools = supportsTools && toolIntegration ? toolIntegration.getLLMFunctions() : [];

    // DEBUG: Log tool integration status
    logger.debug('Tool debug info', {
      provider: selectedProvider,
      model: request.model,
      supportsTools
    });
    logger.debug('Tool integration status', { hasIntegration: !!toolIntegration, toolCount: tools.length });
    if (tools.length > 0) {
      logger.debug('Available tools', { tools: tools.map(t => t.function.name) });
    }

    const modelRequest: ModelRequest = {
      prompt: request.prompt || '',
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      stream: request.stream,
      provider: selectedProvider,
      tools: tools,
      abortSignal: request.abortSignal, // Add abort signal for timeout handling
    };

    const startTime = Date.now();
    const response = await this.processRequestWithHybrid(modelRequest, routingDecision);
    const responseTime = Date.now() - startTime;

    // Record performance for hybrid learning
    if (routingDecision && this.hybridRouter) {
      const requestId = this.generateRequestId();
      this.hybridRouter.recordPerformance(requestId, {
        success: !!response.content,
        responseTime,
        qualityScore: this.assessQuality(response.content),
        taskType: this.inferTaskType(request.prompt || ''),
        errorType: response.error ? 'generation-failed' : undefined,
      });
    }

    const result = {
      content: response.content,
      metadata: {
        ...response.metadata,
        hybridRouting: routingDecision,
        provider: selectedProvider,
        responseTime,
      },
      fromCache: false,
    };

    // INTELLIGENT CACHING: Cache with content-aware TTL
    if (this.cacheCoordinator.shouldUseIntelligentCache(request)) {
      this.cacheCoordinator.set(cacheKey, result);
      logger.debug('Response cached with intelligent TTL');
    }

    return result;
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
      for (const [, provider] of this.providerRepository.getAvailableProviders()) {
        if (provider.supportsModel && provider.supportsModel(model)) {
          return provider;
        }
      }
    }

    // Return first available provider
    return this.providerRepository.getAvailableProviders().values().next().value;
  }

  async processRequest(request: ModelRequest, context?: ProjectContext): Promise<ModelResponse> {
    logger.debug('processRequest started');

    // PERFORMANCE: Temporarily bypass semantic cache to fix hanging
    logger.debug('Bypassing semantic cache (disabled for debugging)');
    // const cacheKey = `${request.prompt}::${request.model || 'default'}`;
    // const cachedResponse = await semanticCache.getCachedResponse(
    //   request.prompt,
    //   context?.files?.map(f => f.path) || []
    // );
    logger.debug('Cache bypass complete');
    const requestId = this.generateRequestId();
    logger.info(`📨 Processing request ${requestId}`, {
      prompt: request.prompt.substring(0, 100) + '...',
    });

    // CRITICAL SECURITY: ALWAYS validate input - cannot be bypassed
    logger.debug('Starting security validation');
    const validation = await this.securityValidator.validateRequest(request);
    logger.debug('Security validation complete');
    if (!validation.isValid) {
      throw new Error(`Security validation failed: ${validation.reason}`);
    }

    // Use sanitized input if available
    if (validation.sanitizedInput) {
      request.prompt = validation.sanitizedInput;
    }

    // Determine execution strategy
    const strategy = this.determineExecutionStrategy(request, context);
    logger.info(
      `🎯 Using execution strategy: ${strategy.mode} with provider: ${strategy.provider}`
    );

    // Register process with active process manager
    const estimatedMemory = this.estimateMemoryUsage(request);
    const process = this.processManager.registerProcess({
      type: this.getProcessType(request),
      modelName: this.currentModel || 'unknown',
      estimatedMemoryUsage: estimatedMemory,
      priority: this.getRequestPriority(request),
      promise: Promise.resolve(), // Will be updated below
    });

    try {
      // Execute with fallback chain and register abort signal
      const resultPromise = this.executeWithFallback(
        requestId,
        request,
        context,
        strategy,
        process.abortController.signal
      );

      // Update the process promise
      process.promise = resultPromise;

      const result = await resultPromise;

      // Unregister successful process
      this.processManager.unregisterProcess(process.id);

      return result;
    } catch (error) {
      // Unregister failed process
      this.processManager.unregisterProcess(process.id);

      // Check if error was due to abort signal
      if (process.abortController.signal.aborted) {
        throw new Error('Request terminated due to resource constraints');
      }

      throw error;
    }
  }

  /**
   * Stream request with real-time token delivery
   * Phase 3: Real-time streaming implementation
   */
  async streamRequest(
    request: ModelRequest,
    onToken: (token: StreamToken) => void,
    context?: ProjectContext
  ): Promise<ModelResponse> {
    const requestId = this.generateRequestId();
    logger.info(`🌊 Streaming request ${requestId}`, {
      prompt: request.prompt.substring(0, 100) + '...',
    });

    // CRITICAL SECURITY: ALWAYS validate input - cannot be bypassed
    const validation = await this.securityValidator.validateRequest(request);
    if (!validation.isValid) {
      throw new Error(`Security validation failed: ${validation.reason}`);
    }

    // Use sanitized input if available
    if (validation.sanitizedInput) {
      request.prompt = validation.sanitizedInput;
    }

    // Check semantic cache first
    const promptKey = `ai:prompt:${createHash('sha256').update(request.prompt).digest('hex')}`;
    const cachedResponse = await this.cacheCoordinator.get(promptKey);

    if (cachedResponse?.hit) {
      logger.debug('Cache hit for streaming request', {
        source: cachedResponse.source,
        similarity: cachedResponse.similarity,
      });

      // Stream cached response progressively using StreamingManager
      await this.streamingManager.startStream(cachedResponse.value, onToken, this.config.streaming);

      return {
        content: cachedResponse.value,
        model: request.model || this.currentModel || 'cached',
        cached: true,
        processingTime: 0,
        streamed: true,
      } as ModelResponse;
    }

    // Determine execution strategy for streaming
    const strategy = this.determineExecutionStrategy(request, context);
    logger.info(`🌊 Streaming strategy: ${strategy.mode} with provider: ${strategy.provider}`);

    // Register process with active process manager
    const estimatedMemory = this.estimateMemoryUsage(request);
    const process = this.processManager.registerProcess({
      type: 'streaming',
      modelName: this.currentModel || 'unknown',
      estimatedMemoryUsage: estimatedMemory,
      priority: this.getRequestPriority(request),
      promise: Promise.resolve(),
    });

    try {
      let fullResponse = '';
      const startTime = Date.now();

      // Real provider integration for streaming
      let responseContent: string;

      try {
        // Use hybrid routing to get real response from available providers
        if (!this.hybridRouter) {
          throw new Error('Hybrid router not initialized');
        }
        const routingDecision = await this.hybridRouter.routeTask(
          'code_generation',
          request.prompt,
          {
            requiresDeepAnalysis: false,
            estimatedProcessingTime: 10000,
          }
        );
        const providerResponse = await this.processRequestWithHybrid(request, routingDecision);
        responseContent = providerResponse.content || '';

        if (!responseContent) {
          throw new Error('Provider returned empty content');
        }
      } catch (error) {
        // Graceful fallback to available providers
        logger.warn('Primary provider failed, attempting fallback', error);
        const availableProviders = this.providerRepository.getAvailableProviders();
        const fallbackProviderType = availableProviders.keys().next().value;

        if (fallbackProviderType) {
          const fallbackProvider = this.providerRepository.getProvider(fallbackProviderType);
          if (fallbackProvider) {
            const fallbackResponse = await fallbackProvider.processRequest(request, context);
            responseContent =
              fallbackResponse.content || 'Unable to generate response - all providers unavailable';
          } else {
            responseContent =
              'No AI providers are currently available. Please check your configuration.';
          }
        } else {
          responseContent =
            'No AI providers are currently available. Please check your configuration.';
        }
      }

      // Stream the real response using StreamingManager
      await this.streamingManager.startStream(
        responseContent,
        (token: StreamToken) => {
          fullResponse += token.content;
          onToken(token);
        },
        this.config.streaming
      );

      const finalResponse: ModelResponse = {
        content: fullResponse,
        model: strategy.provider || this.currentModel || 'unknown',
        cached: false,
        processingTime: Date.now() - startTime,
        streamed: true,
      };

      // Cache the successful streaming response (temporarily disabled due to TS error)
      // TODO: Fix cache metadata structure and re-enable caching

      // Unregister successful process
      this.processManager.unregisterProcess(process.id);

      logger.info(`✅ Streaming completed for request ${requestId}`, {
        responseLength: fullResponse.length,
        processingTime: finalResponse.processingTime,
      });

      return finalResponse;
    } catch (error) {
      // Unregister failed process
      this.processManager.unregisterProcess(process.id);

      // Check if error was due to abort signal
      if (process.abortController.signal.aborted) {
        throw new Error('Streaming request terminated due to resource constraints');
      }

      logger.error(`❌ Streaming failed for request ${requestId}:`, error);
      throw error;
    }
  }

  /**
   * Estimate memory usage for a request
   */
  private estimateMemoryUsage(request: ModelRequest): number {
    const baseMemory = 50; // Base memory in MB
    const promptLength = request.prompt.length;

    // Estimate based on prompt length and complexity
    let estimatedMemory = baseMemory;

    if (promptLength > 1000) estimatedMemory += 20;
    if (promptLength > 5000) estimatedMemory += 50;
    if (promptLength > 10000) estimatedMemory += 100;

    // Add memory for complex operations
    if (request.prompt.includes('analyze') || request.prompt.includes('review')) {
      estimatedMemory += 30;
    }
    if (request.prompt.includes('generate') || request.prompt.includes('create')) {
      estimatedMemory += 40;
    }

    return estimatedMemory;
  }

  /**
   * Determine process type based on request
   */
  private getProcessType(request: ModelRequest): ActiveProcess['type'] {
    const prompt = request.prompt.toLowerCase();

    if (prompt.includes('analyze') || prompt.includes('review')) {
      return 'analysis';
    }
    if (prompt.includes('generate') || prompt.includes('create') || prompt.includes('write')) {
      return 'generation';
    }
    if (prompt.includes('stream')) {
      return 'streaming';
    }

    return 'model_inference';
  }

  /**
   * Determine request priority
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getRequestPriority(request: ModelRequest): ActiveProcess['priority'] {
    // Default to medium priority
    // Could be enhanced with explicit priority in request
    return 'medium';
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
    if (flags >= 4 || flags & 2) return 'complex';
    if (length < 50 && flags === 0) return 'simple';
    return 'medium';
  }

  private determineExecutionStrategy(
    request: ModelRequest,
    context?: ProjectContext
  ): {
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
        timeout = complexity === 'simple' ? 120000 : complexity === 'complex' ? 240000 : 180000; // Adaptive timeouts: 2-4 minutes
        break;
    }

    return { mode, provider, timeout, complexity };
  }

  private selectFastestProvider(): ProviderType {
    // Return provider with best latency metrics
    const metrics = this.performanceMonitor.getProviderMetrics();
    const sortedByLatency = Object.entries(metrics).sort(
      ([, a], [, b]) => a.averageLatency - b.averageLatency
    );

    return (sortedByLatency[0]?.[0] as ProviderType) || this.config.fallbackChain[0];
  }

  private selectMostCapableProvider(): ProviderType {
    // Return provider with best quality metrics
    const metrics = this.performanceMonitor.getProviderMetrics();
    const sortedByQuality = Object.entries(metrics).sort(
      ([, a], [, b]) => b.successRate - a.successRate
    );

    return (sortedByQuality[0]?.[0] as ProviderType) || this.config.fallbackChain[0];
  }

  private selectBalancedProvider(): ProviderType {
    // Return provider with best balance of speed and quality
    const metrics = this.performanceMonitor.getProviderMetrics();
    const scored = Object.entries(metrics).map(([provider, stats]) => ({
      provider,
      score: stats.successRate * 0.6 + (1 - stats.averageLatency / 30000) * 0.4,
    }));

    scored.sort((a, b) => b.score - a.score);
    return (scored[0]?.provider as ProviderType) || this.config.fallbackChain[0];
  }

  private modelSupportsTools(provider: ProviderType, model?: string): boolean {
    // Only enable tools for specific models that support function calling
    if (provider === 'lm-studio') {
      return true; // LM Studio generally supports OpenAI-compatible function calling
    }

    if (provider === 'ollama') {
      // If no specific model provided, assume auto-selection will pick a supported model
      if (!model) {
        logger.debug('No specific model provided, assuming auto-selection will pick supported model');
        return true; // Trust that auto-selection picks qwen2.5-coder which supports tools
      }

      // Only certain Ollama models support function calling
      const model_name = model.toLowerCase();
      // Models that support function calling (update this list as needed)
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

  private async executeWithFallback(
    requestId: string,
    request: ModelRequest,
    context: ProjectContext | undefined,
    strategy: { mode: ExecutionMode; provider: ProviderType; timeout: number; complexity: string },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    abortSignal?: AbortSignal
  ): Promise<ModelResponse> {
    const fallbackChain =
      strategy.provider === 'auto'
        ? this.config.fallbackChain
        : [strategy.provider, ...this.config.fallbackChain.filter(p => p !== strategy.provider)];

    let lastError: Error | null = null;

    for (const providerType of fallbackChain) {
      const provider = this.providerRepository.getProvider(providerType);
      if (!provider) {
        logger.warn(`Provider ${providerType} not available, skipping`);
        continue;
      }

      try {
        const metrics: RequestMetrics = {
          provider: providerType,
          model: provider.getModelName?.() || 'unknown',
          startTime: Date.now(),
          success: false,
        };

        this.activeRequests.set(requestId, metrics);
        this.emit('requestStart', { requestId, provider: providerType });

        logger.info(`🚀 Attempting request with ${providerType}`);

        const response = await Promise.race([
          provider.processRequest(request, context),
          this.createTimeoutPromise(strategy.timeout),
        ]);

        metrics.endTime = Date.now();
        metrics.success = true;
        metrics.tokenCount = response.usage?.totalTokens;

        this.performanceMonitor.recordRequest(providerType, metrics);
        this.activeRequests.delete(requestId);
        this.emit('requestComplete', { requestId, provider: providerType, success: true });

        logger.info(`✅ Request ${requestId} completed successfully with ${providerType}`);

        // PERFORMANCE: Cache successful response
        const responseKey = `ai:response:${createHash('sha256').update(request.prompt).digest('hex')}`;
        this.cacheCoordinator.set(responseKey, response.content || response.text || '', {
          ttl: 3600,
          metadata: {
            cachedAt: Date.now(),
            requestType: 'general',
            hitCount: 0,
          },
        });

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

  // Cache management delegated to CacheCoordinator

  // Cache key generation delegated to CacheCoordinator

  // Cache methods delegated to CacheCoordinator

  /**
   * Get enhanced cache statistics - delegated to CacheCoordinator
   */
  getCacheStats() {
    return this.cacheCoordinator.getCacheStats();
  }

  /**
   * Get intelligent cache statistics - delegated to CacheCoordinator
   */
  getIntelligentCacheStats() {
    return this.cacheCoordinator.getIntelligentCacheStats();
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
        reject,
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (
      this.requestQueue.length > 0 &&
      this.activeRequests.size < this.config.performanceThresholds.maxConcurrentRequests
    ) {
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

    for (const [type, provider] of this.providerRepository.getAvailableProviders()) {
      const cacheKey = `health_${type}`;

      // Use cached result if available
      if (this.cacheCoordinator.isHealthCheckCached(cacheKey, 30000)) {
        const healthCheckCache = this.cacheCoordinator.getHealthCheckCache();
        const cached = healthCheckCache.get(cacheKey);
        health[type] = cached?.healthy || false;
        continue;
      }

      try {
        await provider.healthCheck?.();
        health[type] = true;
        this.cacheCoordinator.setHealthCheck(cacheKey, true);
      } catch {
        health[type] = false;
        this.cacheCoordinator.setHealthCheck(cacheKey, false);
      }
    }

    return health;
  }

  getMetrics(): any {
    return {
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.length,
      providerMetrics: this.performanceMonitor.getProviderMetrics(),
      performance: this.performanceMonitor.getSummary(),
    };
  }

  async shutdown(): Promise<void> {
    logger.info('🛑 Shutting down UnifiedModelClient...');

    // LRU cache cleanup is handled automatically

    // Shutdown performance monitor
    if (this.performanceMonitor) {
      this.performanceMonitor.destroy();
    }

    // Emergency shutdown of active processes
    if (this.processManager) {
      await this.processManager.emergencyShutdown();
      this.processManager.destroy();
    }

    // Shutdown hardware selector
    if (this.hardwareSelector) {
      this.hardwareSelector.destroy();
    }

    // Shutdown integrated system first
    if (this.integratedSystem) {
      await this.integratedSystem.shutdown();
      this.integratedSystem = null;
    }

    // Wait for active requests to complete (with timeout)
    const shutdownTimeout = 10000; // 10 seconds
    const startTime = Date.now();

    while (this.activeRequests.size > 0 && Date.now() - startTime < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Close all providers
    for (const [type, provider] of this.providerRepository.getAvailableProviders()) {
      try {
        await provider.shutdown?.();
        logger.info(`✅ Provider ${type} shut down`);
      } catch (error) {
        logger.warn(`⚠️ Error shutting down provider ${type}:`, error);
      }
    }

    // OPTIMIZED: Clear all caches and prevent memory leaks
    await this.providerRepository.shutdown();
    this.activeRequests.clear();
    this.requestQueue.length = 0;
    this.cacheCoordinator.clear();

    logger.info('✅ UnifiedModelClient shutdown complete with memory cleanup');
  }

  // Streaming methods removed - now handled by StreamingManager

  // Stream ID generation moved to StreamingManager

  // Streaming metrics moved to StreamingManager

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
        model: modelName,
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async addApiModel(config: any): Promise<boolean> {
    // Implementation for API model management
    return true;
  }

  async testApiModel(modelName: string): Promise<boolean> {
    return this.testModel(modelName);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  removeApiModel(modelName: string): boolean {
    // Implementation for API model removal
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async autoSetup(force: boolean = false): Promise<any> {
    return { success: true, message: 'Auto setup complete' };
  }

  async generateText(prompt: string, options?: any): Promise<string> {
    const timeout = options?.timeout || 30000; // Increased to 30s for complex operations

    logger.debug('generateText called', { timeout });

    // Use AbortController for proper request cancellation
    const abortController = new AbortController();

    const timeoutId = setTimeout(() => {
      logger.warn('Timeout triggered - aborting request');
      abortController.abort();
    }, timeout);

    try {
      const response = await this.generate({
        prompt,
        abortSignal: abortController.signal,
        ...options,
      });

      clearTimeout(timeoutId);
      logger.debug('generateText completed successfully');
      return response.text || response.content || response.response || '';
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (abortController.signal.aborted) {
        const fallbackMessage = `Request timed out after ${timeout}ms. Please try a simpler request or check your AI model connection.`;
        logger.warn('generateText request aborted due to timeout');
        return fallbackMessage;
      }

      const errorMessage = getErrorMessage(error);
      logger.error('generateText error', error);

      // Graceful error handling with helpful messages
      if (errorMessage.includes('ECONNREFUSED')) {
        return 'AI model server unavailable. Please ensure Ollama or LM Studio is running.';
      }

      throw error;
    }
  }

  async generate(request: any): Promise<any> {
    // Use synthesize method which includes tool integration and hybrid routing
    return await this.synthesize({
      prompt: request.prompt,
      temperature: request.temperature,
      model: request.model,
      maxTokens: request.maxTokens,
      stream: request.stream,
      abortSignal: request.abortSignal, // Pass through abort signal for timeout handling
    });
  }

  /**
   * Get all available providers for model management
   */
  getProviders(): Map<string, any> {
    return this.providerRepository.getAvailableProviders();
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
        ...options,
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
        advancedFeatures: false,
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
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * HYBRID ARCHITECTURE: Infer task type from prompt content
   */
  private inferTaskType(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    // Fast tasks - simple operations
    if (
      lowerPrompt.includes('format') ||
      lowerPrompt.includes('template') ||
      lowerPrompt.includes('boilerplate') ||
      lowerPrompt.includes('edit') ||
      lowerPrompt.includes('fix typo') ||
      lowerPrompt.includes('simple')
    ) {
      return 'template';
    }

    // Analysis tasks - complex reasoning
    if (
      lowerPrompt.includes('analyze') ||
      lowerPrompt.includes('review') ||
      lowerPrompt.includes('audit') ||
      lowerPrompt.includes('debug') ||
      lowerPrompt.includes('explain') ||
      lowerPrompt.includes('architecture')
    ) {
      return 'analysis';
    }

    // Security tasks - specialized analysis
    if (
      lowerPrompt.includes('security') ||
      lowerPrompt.includes('vulnerability') ||
      lowerPrompt.includes('exploit') ||
      lowerPrompt.includes('sanitize')
    ) {
      return 'security';
    }

    // Planning tasks - strategic thinking
    if (
      lowerPrompt.includes('plan') ||
      lowerPrompt.includes('design') ||
      lowerPrompt.includes('strategy') ||
      lowerPrompt.includes('roadmap')
    ) {
      return 'planning';
    }

    // Generation tasks - balanced complexity
    if (
      lowerPrompt.includes('generate') ||
      lowerPrompt.includes('create') ||
      lowerPrompt.includes('implement') ||
      lowerPrompt.includes('build')
    ) {
      return 'generate';
    }

    // Default to generate for unknown patterns
    return 'generate';
  }

  /**
   * HYBRID ARCHITECTURE: Analyze task complexity
   */
  private analyzeComplexity(prompt: string, request: any): any {
    const promptLength = prompt.length;
    const hasContext = request.context && Object.keys(request.context).length > 0;
    const hasFiles = request.files && request.files.length > 0;

    let complexityScore = 0;

    // Length-based scoring
    if (promptLength > 100) complexityScore += 1;
    if (promptLength > 500) complexityScore += 2;
    if (promptLength > 1000) complexityScore += 3;

    // Context-based scoring
    if (hasContext) complexityScore += 2;
    if (hasFiles) complexityScore += request.files.length;

    // Content-based scoring
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes('multiple files')) complexityScore += 3;
    if (lowerPrompt.includes('refactor') || lowerPrompt.includes('architecture'))
      complexityScore += 4;
    if (lowerPrompt.includes('performance') || lowerPrompt.includes('optimize'))
      complexityScore += 3;
    if (lowerPrompt.includes('security') || lowerPrompt.includes('vulnerability'))
      complexityScore += 4;

    // Determine complexity level
    let level: 'simple' | 'medium' | 'complex';
    if (complexityScore <= 2) level = 'simple';
    else if (complexityScore <= 6) level = 'medium';
    else level = 'complex';

    return {
      score: complexityScore,
      level,
      factors: {
        promptLength,
        hasContext,
        hasFiles,
        fileCount: request.files?.length || 0,
      },
      estimatedTime: level === 'simple' ? '4-6s' : level === 'medium' ? '8-10s' : '12s+',
    };
  }

  /**
   * HYBRID ARCHITECTURE: Process request with hybrid routing
   */
  private async processRequestWithHybrid(request: any, routingDecision: any): Promise<any> {
    const selectedProvider = request.provider || 'ollama';

    try {
      // Get the appropriate provider
      const provider = this.providerRepository.getProvider(selectedProvider);
      if (!provider) {
        throw new Error(`Provider ${selectedProvider} not available`);
      }

      // DEBUG: Log request before sending to provider
      console.log(
        `🔧 HYBRID DEBUG: Sending to ${selectedProvider}, tools=${request.tools?.length || 0}`
      );
      if (request.tools?.length > 0) {
        console.log(
          `🔧 HYBRID DEBUG: Tool names: ${request.tools.map((t: any) => t.function?.name || t.name || 'unnamed').join(', ')}`
        );
      }

      // Process the request
      const response = await provider.processRequest(request);

      // Check if response contains tool calls that need to be executed
      if (response.toolCalls && response.toolCalls.length > 0) {
        console.log(`🔧 TOOL EXECUTION: Found ${response.toolCalls.length} tool calls to execute`);

        const enhancedToolIntegration = getGlobalEnhancedToolIntegration();
        const toolIntegration = enhancedToolIntegration || getGlobalToolIntegration();
        if (toolIntegration) {
          try {
            const toolResults = [];

            // Execute each tool call
            for (const toolCall of response.toolCalls) {
              console.log(`🔧 Executing tool: ${toolCall.name || toolCall.function?.name}`);

              // Convert to expected format if needed
              const formattedToolCall = {
                function: {
                  name: toolCall.name || toolCall.function?.name,
                  arguments: JSON.stringify(
                    toolCall.arguments || toolCall.function?.arguments || {}
                  ),
                },
              };

              const result = await toolIntegration.executeToolCall(formattedToolCall);
              console.log(`🔧 Tool result:`, JSON.stringify(result, null, 2));
              toolResults.push(result);
            }

            // If we have tool results, format them into a readable response
            if (toolResults.length > 0) {
              const firstResult = toolResults[0];

              if (firstResult.success && firstResult.output) {
                // Return the actual tool result as the content
                const content = firstResult.output.content || firstResult.output;
                response.content = content;
                response.metadata = {
                  ...response.metadata,
                  toolExecuted: true,
                  toolResults: toolResults.map(r => ({
                    success: r.success,
                    executionTime: r.metadata?.executionTime,
                  })),
                };
              } else {
                response.content = `Tool execution failed: ${firstResult.error || 'Unknown error'}`;
              }
            }
          } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);
            console.error('🔧 Tool execution error:', errorMessage);
            response.content = `Tool execution error: ${errorMessage}`;
          }
        } else {
          console.warn('🔧 Tool integration not available for execution');
        }
      }

      // Add hybrid routing metadata
      if (response.metadata) {
        response.metadata.hybridRouting = routingDecision;
        response.metadata.selectedProvider = selectedProvider;
      }

      return response;
    } catch (error) {
      logger.error(`Hybrid processing failed with ${selectedProvider}:`, error);

      // Fallback to alternative provider if available
      const fallbackProvider = selectedProvider === 'lm-studio' ? 'ollama' : 'lm-studio';
      const fallback = this.providerRepository.getProvider(fallbackProvider);

      if (fallback) {
        logger.info(`Falling back to ${fallbackProvider}`);
        const fallbackResponse = await fallback.processRequest(request);

        if (fallbackResponse.metadata) {
          fallbackResponse.metadata.hybridRouting = {
            ...routingDecision,
            fallbackUsed: true,
            originalProvider: selectedProvider,
            actualProvider: fallbackProvider,
          };
        }

        return fallbackResponse;
      }

      throw error;
    }
  }

  /**
   * HYBRID ARCHITECTURE: Assess response quality
   */
  private assessQuality(content: string): number {
    if (!content || typeof content !== 'string') {
      return 0.1;
    }

    let qualityScore = 0.5; // Base score

    // Length assessment
    const length = content.length;
    if (length > 50) qualityScore += 0.1;
    if (length > 200) qualityScore += 0.1;
    if (length > 500) qualityScore += 0.1;

    // Structure assessment
    if (content.includes('```')) qualityScore += 0.1; // Has code blocks
    if (content.includes('\n')) qualityScore += 0.05; // Multi-line
    if (content.match(/^[A-Z]/)) qualityScore += 0.05; // Starts with capital

    // Content quality indicators
    if (content.includes('function') || content.includes('class')) qualityScore += 0.1;
    if (content.includes('//') || content.includes('/*') || content.includes('#'))
      qualityScore += 0.1;
    if (content.includes('import') || content.includes('export')) qualityScore += 0.05;

    // Negative indicators
    if (content.includes('error') || content.includes('failed')) qualityScore -= 0.1;
    if (content.includes('sorry') || content.includes('cannot')) qualityScore -= 0.2;
    if (content.length < 20) qualityScore -= 0.3;

    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, qualityScore));
  }

  /**
   * HYBRID ARCHITECTURE: Generate unique request ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 9);
    return `req_${timestamp}_${randomStr}`;
  }

  /**
   * Voice System API: Generate response using a specific voice archetype
   * @param prompt The input prompt
   * @param voiceId The voice archetype ID (e.g., 'explorer', 'security', 'maintainer')
   * @param options Additional options including temperature and system prompt
   * @returns Voice-specific response with metadata
   */
  async generateVoiceResponse(prompt: string, voiceId: string, options?: any): Promise<any> {
    try {
      logger.info(`🎭 Generating voice response for voice: ${voiceId}`);

      // Get voice configuration if VoiceArchetypeSystem is available
      let voicePrompt = prompt;
      const voiceTemperature = options?.temperature || 0.7;

      // Try to get voice-specific configuration
      if (options?.systemPrompt) {
        voicePrompt = `${options.systemPrompt}\n\n${prompt}`;
      } else {
        // Add voice personality prefix based on voiceId
        const voicePersonalities: Record<string, string> = {
          explorer:
            'As an innovative Explorer voice focused on creative solutions and new possibilities:\n',
          maintainer:
            'As a conservative Maintainer voice focused on stability and best practices:\n',
          security:
            'As a Security-focused voice prioritizing safety and vulnerability prevention:\n',
          architect: 'As an Architecture voice focused on system design and scalability:\n',
          developer: 'As a Developer voice focused on practical implementation:\n',
          analyzer: 'As an Analyzer voice focused on data-driven insights:\n',
          optimizer: 'As an Optimizer voice focused on performance and efficiency:\n',
          designer: 'As a Designer voice focused on user experience:\n',
          implementor: 'As an Implementor voice focused on execution:\n',
          guardian: 'As a Guardian voice ensuring quality and standards:\n',
        };

        const personality = voicePersonalities[voiceId.toLowerCase()] || '';
        voicePrompt = personality + prompt;
      }

      // Use processRequest with voice-enhanced prompt
      const response = await this.processRequest({
        prompt: voicePrompt,
        temperature: voiceTemperature,
        ...options,
      });

      // Format response with voice metadata
      return {
        content: response.content || (response as any).response,
        voiceId: voiceId,
        metadata: {
          ...response.metadata,
          processingTime: (response.metadata as any)?.processingTime || Date.now(),
          model: (response.metadata as any)?.model || this.currentModel,
          voiceStyle: voiceId,
        },
      };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      logger.error(`Failed to generate voice response for ${voiceId}:`, errorMessage);
      throw new Error(`Voice not found or failed: ${voiceId} - ${errorMessage}`);
    }
  }

  /**
   * Voice System API: Generate responses from multiple voices
   * @param voices Array of voice IDs to use
   * @param prompt The input prompt
   * @param options Options including parallel processing settings
   * @returns Multiple voice responses with metadata
   */
  async generateMultiVoiceResponses(voices: string[], prompt: string, options?: any): Promise<any> {
    try {
      logger.info(`🎭 Generating multi-voice responses for ${voices.length} voices`);

      // Validate inputs
      if (!voices || voices.length === 0) {
        throw new Error('Invalid input: voices and prompt are required');
      }
      if (!prompt) {
        throw new Error('Invalid input: voices and prompt are required');
      }

      const responses = [];
      const skippedVoices = [];
      const processedVoices = [];
      const startTime = Date.now();

      // Filter out invalid voices
      const validVoices = voices.filter(v => {
        if (!v || v.trim() === '') {
          skippedVoices.push(v);
          return false;
        }
        return true;
      });

      // Process voices either in parallel or sequentially
      if (options?.parallel !== false) {
        // Parallel processing (default)
        const maxConcurrent = options?.maxConcurrent || 3;
        const chunks = [];

        // Split voices into chunks for controlled parallelism
        for (let i = 0; i < validVoices.length; i += maxConcurrent) {
          chunks.push(validVoices.slice(i, i + maxConcurrent));
        }

        // Process each chunk in parallel
        for (const chunk of chunks) {
          const chunkPromises = chunk.map(async voiceId => {
            try {
              const response = await this.generateVoiceResponse(prompt, voiceId, options);
              processedVoices.push(voiceId);
              return {
                voiceId,
                content: response.content,
                confidence: this.assessQuality(response.content),
              };
            } catch (error: unknown) {
              const errorMessage = getErrorMessage(error);
              logger.warn(`Voice ${voiceId} failed: ${errorMessage}`);
              skippedVoices.push(voiceId);
              return null;
            }
          });

          const chunkResults = await Promise.all(chunkPromises);
          responses.push(...chunkResults.filter(r => r !== null));
        }
      } else {
        // Sequential processing
        for (const voiceId of validVoices) {
          try {
            const response = await this.generateVoiceResponse(prompt, voiceId, options);
            responses.push({
              voiceId,
              content: response.content,
              confidence: this.assessQuality(response.content),
            });
            processedVoices.push(voiceId);
          } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);
            logger.warn(`Voice ${voiceId} failed: ${errorMessage}`);
            skippedVoices.push(voiceId);
          }
        }
      }

      const endTime = Date.now();

      return {
        responses,
        metadata: {
          totalProcessingTime: endTime - startTime,
          parallelExecution: options?.parallel !== false,
          processedVoices,
          skippedVoices: skippedVoices.length > 0 ? skippedVoices : undefined,
        },
      };
    } catch (error: unknown) {
      logger.error('Failed to generate multi-voice responses:', getErrorMessage(error));
      throw toError(error);
    }
  }

  /**
   * Voice System API: Synthesize multiple voice perspectives into unified response
   * @param voices Array of voice IDs to synthesize
   * @param prompt The input prompt
   * @param options Synthesis options including mode and conflict resolution
   * @returns Synthesized response with individual perspectives and consensus
   */
  async synthesizeVoicePerspectives(voices: string[], prompt: string, options?: any): Promise<any> {
    try {
      logger.info(`🎭 Synthesizing perspectives from ${voices.length} voices`);

      // First, get all voice responses
      const multiVoiceResult = await this.generateMultiVoiceResponses(voices, prompt, {
        ...options,
        parallel: true,
      });

      const voicePerspectives = multiVoiceResult.responses;

      // Analyze perspectives for agreements and disagreements
      const agreements: string[] = [];
      const disagreements: any[] = [];

      // Simple consensus analysis (can be enhanced with NLP)
      const commonTerms = new Map<string, number>();
      const perspectives = new Map<string, Set<string>>();

      // Extract key points from each voice
      voicePerspectives.forEach((vp: any) => {
        const keyPoints = this.extractKeyPoints(vp.content);
        perspectives.set(vp.voiceId, new Set(keyPoints));

        // Count common terms
        keyPoints.forEach(point => {
          commonTerms.set(point, (commonTerms.get(point) || 0) + 1);
        });
      });

      // Find agreements (mentioned by majority of voices)
      const majorityThreshold = Math.ceil(voices.length / 2);
      commonTerms.forEach((count, term) => {
        if (count >= majorityThreshold) {
          agreements.push(term);
        }
      });

      // Find disagreements (unique perspectives)
      const synthesisMode = options?.synthesisMode || 'consensus';

      // Create synthesized content based on mode
      let synthesizedContent = '';
      let councilDecision = null;

      switch (synthesisMode) {
        case 'consensus':
          synthesizedContent = this.synthesizeConsensus(voicePerspectives, agreements);
          break;

        case 'debate':
          synthesizedContent = this.synthesizeDebate(voicePerspectives, agreements, disagreements);
          break;

        case 'hierarchical':
          synthesizedContent = this.synthesizeHierarchical(voicePerspectives, voices);
          break;

        case 'democratic':
          synthesizedContent = this.synthesizeDemocratic(voicePerspectives);
          break;

        case 'council': {
          const councilResult = this.synthesizeCouncil(voicePerspectives, prompt);
          synthesizedContent = councilResult.content;
          councilDecision = councilResult.decision;
          break;
        }

        default:
          synthesizedContent = this.synthesizeConsensus(voicePerspectives, agreements);
      }

      // Calculate overall confidence
      const avgConfidence =
        voicePerspectives.reduce((sum: number, vp: any) => sum + vp.confidence, 0) /
        voicePerspectives.length;

      // Add weights to perspectives
      const weightedPerspectives = voicePerspectives.map((vp: any) => ({
        ...vp,
        weight: 1 / voices.length, // Equal weight by default
      }));

      return {
        synthesizedResponse: {
          content: synthesizedContent,
          consensus: {
            agreements,
            disagreements:
              disagreements.length > 0
                ? disagreements
                : [
                    {
                      topic: 'Implementation approach',
                      perspectives: Object.fromEntries(
                        voicePerspectives.map((vp: any) => [
                          vp.voiceId,
                          vp.content.substring(0, 100),
                        ])
                      ),
                    },
                  ],
          },
          confidence: avgConfidence,
          councilDecision: councilDecision,
          synthesisMode: synthesisMode,
        },
        voicePerspectives: weightedPerspectives,
        metadata: {
          synthesisMethod: synthesisMode,
          processingTime: multiVoiceResult.metadata.totalProcessingTime,
          voiceCount: voices.length,
          conflictResolutionMethod: options?.conflictResolution || 'weighted',
          debateRounds: synthesisMode === 'debate' ? 3 : undefined,
        },
      };
    } catch (error: unknown) {
      logger.error('Failed to synthesize voice perspectives:', getErrorMessage(error));
      throw toError(error);
    }
  }

  /**
   * Helper: Extract key points from text
   */
  private extractKeyPoints(text: string): string[] {
    const points: string[] = [];

    // Extract sentences containing key terms
    const keyTerms = ['should', 'must', 'recommend', 'important', 'critical', 'need', 'require'];
    const sentences = text.split(/[.!?]/).filter(s => s.trim());

    sentences.forEach(sentence => {
      if (keyTerms.some(term => sentence.toLowerCase().includes(term))) {
        // Extract the main point (simplified)
        const point = sentence.trim().substring(0, 50);
        if (point) points.push(point);
      }
    });

    return points;
  }

  /**
   * Helper: Synthesize consensus view
   */
  private synthesizeConsensus(perspectives: any[], agreements: string[]): string {
    let synthesis = 'Based on multi-voice analysis:\n\n';

    if (agreements.length > 0) {
      synthesis += 'Key agreements:\n';
      agreements.forEach(agreement => {
        synthesis += `• ${agreement}\n`;
      });
      synthesis += '\n';
    }

    synthesis += 'Synthesized recommendation:\n';
    synthesis += perspectives
      .map(p => p.content)
      .join('\n\n')
      .substring(0, 500);

    return synthesis;
  }

  /**
   * Helper: Synthesize debate format
   */
  private synthesizeDebate(
    perspectives: any[],
    agreements: string[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    disagreements: any[]
  ): string {
    let synthesis = 'After considering multiple perspectives through debate:\n\n';

    synthesis += 'Points of Agreement:\n';
    agreements.forEach(a => (synthesis += `• ${a}\n`));

    synthesis += '\nPoints of Contention:\n';
    perspectives.forEach(p => {
      synthesis += `\n${p.voiceId} perspective: ${p.content.substring(0, 200)}...\n`;
    });

    synthesis += '\nResolution: A balanced approach considering all viewpoints is recommended.';

    return synthesis;
  }

  /**
   * Helper: Synthesize hierarchical view
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private synthesizeHierarchical(perspectives: any[], voices: string[]): string {
    // Priority order for voices
    const priority = ['security', 'architect', 'maintainer', 'developer', 'explorer'];

    const sortedPerspectives = perspectives.sort((a, b) => {
      const aPriority = priority.indexOf(a.voiceId.toLowerCase());
      const bPriority = priority.indexOf(b.voiceId.toLowerCase());
      return aPriority - bPriority;
    });

    let synthesis = 'Hierarchical synthesis (by priority):\n\n';
    sortedPerspectives.forEach(p => {
      synthesis += `${p.voiceId}: ${p.content.substring(0, 200)}...\n\n`;
    });

    return synthesis;
  }

  /**
   * Helper: Synthesize democratic view
   */
  private synthesizeDemocratic(perspectives: any[]): string {
    // Equal weight to all voices
    let synthesis = 'Democratic synthesis (equal weight to all voices):\n\n';

    const combined = perspectives.map(p => p.content).join(' ');
    synthesis += combined.substring(0, 500);

    return synthesis;
  }

  /**
   * Helper: Synthesize council decision
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private synthesizeCouncil(perspectives: any[], prompt: string): any {
    const votes: Record<string, string> = {};
    const conditions: string[] = [];

    // Analyze each voice's stance
    perspectives.forEach((p: any) => {
      const content = p.content.toLowerCase();
      if (content.includes('caution') || content.includes('careful') || content.includes('risk')) {
        votes[p.voiceId] = 'CAUTION';
        if (content.includes('monitor')) conditions.push('Set up monitoring');
      } else if (
        content.includes('proceed') ||
        content.includes('go ahead') ||
        content.includes('implement')
      ) {
        votes[p.voiceId] = 'PROCEED';
      } else {
        votes[p.voiceId] = 'NEUTRAL';
      }
    });

    // Determine overall recommendation
    const voteCount = Object.values(votes);
    const proceedCount = voteCount.filter(v => v === 'PROCEED').length;
    const cautionCount = voteCount.filter(v => v === 'CAUTION').length;

    let recommendation = 'NEUTRAL';
    if (proceedCount > cautionCount) {
      recommendation = 'PROCEED';
    } else if (cautionCount > proceedCount) {
      recommendation = 'PROCEED_WITH_CAUTION';
      conditions.push('Enable feature flags', 'Prepare rollback plan');
    } else {
      recommendation = 'REQUIRE_MORE_ANALYSIS';
    }

    return {
      content: `Council recommends: ${recommendation}\n\nConditions:\n${conditions.map(c => `• ${c}`).join('\n')}`,
      decision: {
        recommendation,
        votes,
        conditions,
      },
    };
  }

  /**
   * MEMORY LEAK FIX: Destroy client and cleanup all resources
   */
  async destroy(): Promise<void> {
    try {
      // Clean up persistent cache (auto-saves on destroy)
      if (this.cacheCoordinator) {
        console.log('🗃️ Saving cache before shutdown...');
        this.cacheCoordinator.destroy();
      }

      // Clean up hardware selector
      if (this.hardwareSelector) {
        await this.hardwareSelector.destroy();
      }

      // Clean up process manager
      if (this.processManager) {
        await this.processManager.destroy();
      }

      // Clean up streaming manager
      if (this.streamingManager) {
        await this.streamingManager.cleanup();
      }

      // Clean up integrated system
      if (this.integratedSystem) {
        await this.integratedSystem.shutdown();
      }

      // Clear active requests
      this.activeRequests.clear();
      this.requestQueue = [];

      // Health check cache cleared by CacheCoordinator.destroy()

      // Remove all event listeners
      this.removeAllListeners();

      logger.info('UnifiedModelClient destroyed successfully');
    } catch (error: unknown) {
      logger.error('Error during UnifiedModelClient destruction:', getErrorMessage(error));
      throw toError(error);
    }
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

export type { ProjectContext } from './types.js';
