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
  MetricsData,
  ComplexityAnalysis,
  TaskType,
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
import { HybridLLMRouter, HybridConfig, TaskComplexityMetrics } from './hybrid/hybrid-llm-router.js';
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
import { VoiceSynthesisManager, IVoiceSynthesisManager } from './voice-system/voice-synthesis-manager.js';
import { ProviderSelectionStrategy, IProviderSelectionStrategy, ExecutionMode as StrategyExecutionMode } from './providers/provider-selection-strategy.js';
import { RequestExecutionManager, IRequestExecutionManager } from './execution/request-execution-manager.js';
import { HealthStatusManager, IHealthStatusManager } from './health/health-status-manager.js';
import { ConfigurationManager, IConfigurationManager } from './config/configuration-manager.js';
import { RequestProcessingCoreManager, IRequestProcessingCoreManager } from './processing/request-processing-core-manager.js';
import { ModelManagementManager, IModelManagementManager } from './models/model-management-manager.js';
import { ResourceCleanupManager, IResourceCleanupManager } from './cleanup/resource-cleanup-manager.js';
import { StreamProcessingManager, IStreamProcessingManager } from './streaming/stream-processing-manager.js';

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
export type { ExecutionMode } from './execution/request-execution-manager.js';
export type ExecutionModeClient = 'fast' | 'auto' | 'quality';

// Import ExecutionMode for local use
import type { ExecutionMode } from './execution/request-execution-manager.js';

/**
 * Helper function to create default UnifiedClientConfig with streaming - delegated to ConfigurationManager
 */
export function createDefaultUnifiedClientConfig(
  overrides: Partial<UnifiedClientConfig> = {}
): UnifiedClientConfig {
  const configManager = new ConfigurationManager();
  return configManager.createDefaultUnifiedClientConfig(overrides);
}

// ProviderConfig moved to ProviderRepository

export interface UnifiedClientConfig extends BaseUnifiedClientConfig {
  providers: ProviderConfig[];
  executionMode: ExecutionModeClient;
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
    resolve: (value: ModelResponse) => void;
    reject: (reason?: Error) => void;
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

  // Extracted module managers
  private voiceSynthesisManager: IVoiceSynthesisManager;
  private providerSelectionStrategy: IProviderSelectionStrategy; 
  private requestExecutionManager: IRequestExecutionManager;
  private healthStatusManager: IHealthStatusManager;
  private configurationManager: IConfigurationManager;
  private requestProcessingCoreManager: IRequestProcessingCoreManager;
  private modelManagementManager: IModelManagementManager;
  private resourceCleanupManager: IResourceCleanupManager;
  private streamProcessingManager: IStreamProcessingManager;

  constructor(
    config: UnifiedClientConfig,
    // DI-enabled constructor with optional injected dependencies
    injectedDependencies?: {
      providerRepository?: IProviderRepository;
      securityValidator?: ISecurityValidator;
      streamingManager?: IStreamingManager;
      cacheCoordinator?: ICacheCoordinator;
      performanceMonitor?: PerformanceMonitor;
      hybridRouter?: HybridLLMRouter;
      voiceSynthesisManager?: IVoiceSynthesisManager;
      providerSelectionStrategy?: IProviderSelectionStrategy;
      requestExecutionManager?: IRequestExecutionManager;
      healthStatusManager?: IHealthStatusManager;
      configurationManager?: IConfigurationManager;
      requestProcessingCoreManager?: IRequestProcessingCoreManager;
      modelManagementManager?: IModelManagementManager;
      resourceCleanupManager?: IResourceCleanupManager;
      streamProcessingManager?: IStreamProcessingManager;
    }
  ) {
    super();
    // Increase max listeners to prevent memory leak warnings
    this.setMaxListeners(50);

    // PERFORMANCE FIX: Initialize AbortController
    this.abortController = new AbortController();

    // Initialize configuration manager first to avoid undefined reference
    this.configurationManager = injectedDependencies?.configurationManager || new ConfigurationManager();

    this.config = {
      endpoint: 'http://localhost:11434',
      ...this.getDefaultConfig(),
      ...config,
    };

    // Use injected dependencies if available, otherwise create them (backward compatibility)
    this.performanceMonitor = injectedDependencies?.performanceMonitor || new PerformanceMonitor();

    this.securityValidator =
      injectedDependencies?.securityValidator ||
      new SecurityValidator({
        enableSandbox: this.config.security?.enableSandbox,
        maxInputLength: this.config.security?.maxInputLength,
      });

    // Initialize hardware-aware components (these don't have circular dependencies yet)
    this.hardwareSelector = new HardwareAwareModelSelector();
    this.processManager = new ActiveProcessManager(this.hardwareSelector);

    // Use injected dependencies or create new ones
    this.streamingManager =
      injectedDependencies?.streamingManager || new StreamingManager(config.streaming);
    this.providerRepository = injectedDependencies?.providerRepository || new ProviderRepository();
    this.cacheCoordinator = injectedDependencies?.cacheCoordinator || new CacheCoordinator();

    // Initialize extracted managers
    this.voiceSynthesisManager = injectedDependencies?.voiceSynthesisManager || new VoiceSynthesisManager(
      undefined, // voiceArchetypeSystem - not available yet
      (request: any) => this.processRequest(request) // Pass processRequest method
    );
    
    this.providerSelectionStrategy = injectedDependencies?.providerSelectionStrategy || new ProviderSelectionStrategy(
      {
        fallbackChain: this.config.fallbackChain,
        selectionStrategy: 'balanced',
        timeoutMs: this.config.performanceThresholds?.timeoutMs || 30000,
        maxRetries: 3,
      },
      this.performanceMonitor
    );

    this.requestExecutionManager = injectedDependencies?.requestExecutionManager || new RequestExecutionManager(
      {
        maxConcurrentRequests: this.config.performanceThresholds?.maxConcurrentRequests || 3,
        defaultTimeout: this.config.performanceThresholds?.timeoutMs || 30000,
        complexityTimeouts: {
          simple: 10000,
          medium: 30000,
          complex: 60000,
        },
        memoryThresholds: {
          low: 100,
          medium: 500,
          high: 1000,
        },
      },
      this.processManager,
      this.providerRepository
    );

    this.healthStatusManager = injectedDependencies?.healthStatusManager || new HealthStatusManager(
      this.providerRepository,
      this.cacheCoordinator,
      this.performanceMonitor,
      {
        healthCheckTimeoutMs: 5000,
        overallTimeoutMs: 15000,
        cacheTtlMs: 30000,
      }
    );

    // Already initialized above

    this.requestProcessingCoreManager = injectedDependencies?.requestProcessingCoreManager || new RequestProcessingCoreManager({
      maxConcurrentRequests: this.config.performanceThresholds?.maxConcurrentRequests || 3,
      defaultTimeoutMs: this.config.performanceThresholds?.timeoutMs || 180000,
      memoryThresholds: {
        base: 50,
        lengthMultiplier: 0.01,
        complexityMultiplier: 30,
      },
    });

    this.modelManagementManager = injectedDependencies?.modelManagementManager || new ModelManagementManager(
      {
        endpoint: this.config.endpoint || 'http://localhost:11434',
        defaultModel: 'llama2',
        requestTimeoutMs: this.config.performanceThresholds?.timeoutMs || 30000,
      },
      this.makeRequest.bind(this),
      this.generate.bind(this)
    );

    this.resourceCleanupManager = injectedDependencies?.resourceCleanupManager || new ResourceCleanupManager({
      shutdownTimeoutMs: 10000,
      gracefulShutdown: true,
    });

    this.streamProcessingManager = injectedDependencies?.streamProcessingManager || new StreamProcessingManager(
      this.securityValidator,
      this.cacheCoordinator,
      this.streamingManager,
      (request, context) => this.processRequest(request, context),
      () => this.generateRequestId(),
      {
        validateSecurity: true,
        enableCaching: true,
        requestTimeoutMs: 30000,
      }
    );

    // Register resources for cleanup
    this.registerCleanupResources();

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
      logger.warn(
        'Could not determine optimal model immediately, will retry when providers are ready'
      );
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
    return this.configurationManager.getDefaultConfig();
  }

  private registerCleanupResources(): void {
    // Register resources in cleanup priority order
    this.resourceCleanupManager.registerResource({
      name: 'CacheCoordinator',
      priority: 1,
      cleanup: () => this.cacheCoordinator?.destroy(),
    });

    this.resourceCleanupManager.registerResource({
      name: 'HardwareSelector',
      priority: 2,
      cleanup: async () => this.hardwareSelector?.destroy(),
    });

    this.resourceCleanupManager.registerResource({
      name: 'ProcessManager', 
      priority: 3,
      cleanup: async () => this.processManager?.destroy(),
    });

    this.resourceCleanupManager.registerResource({
      name: 'StreamingManager',
      priority: 4,
      cleanup: async () => this.streamingManager?.cleanup(),
    });

    this.resourceCleanupManager.registerResource({
      name: 'HealthStatusManager',
      priority: 5,
      cleanup: async () => this.healthStatusManager?.cleanup(),
    });

    this.resourceCleanupManager.registerResource({
      name: 'IntegratedSystem',
      priority: 6,
      cleanup: async () => this.integratedSystem?.shutdown(),
    });

    this.resourceCleanupManager.registerResource({
      name: 'ProviderRepository',
      priority: 7,
      cleanup: async () => this.providerRepository?.shutdown(),
    });
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
          error: errorObj.message,
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
      duration: totalDuration,
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
  async synthesize(request: ModelRequest): Promise<ModelResponse> {
    // INTELLIGENT CACHING: Check cache with content-aware key generation
    const cacheKey = this.cacheCoordinator.generateIntelligentCacheKey(request);
    const cached = await this.cacheCoordinator.get(cacheKey);
    if (cached && this.cacheCoordinator.shouldUseIntelligentCache(request)) {
      logger.debug('Returning cached response');
      return { 
        ...cached, 
        cached: true,
        model: cached.model || 'unknown',
        provider: cached.provider || 'unknown'
      } as ModelResponse;
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
          this.convertToTaskMetrics(complexity, request)
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
    const supportsTools = this.modelSupportsTools((selectedProvider || 'ollama') as ProviderType, request.model);
    const tools = supportsTools && toolIntegration ? toolIntegration.getLLMFunctions() : [];

    // DEBUG: Log tool integration status
    logger.debug('Tool debug info', {
      provider: selectedProvider,
      model: request.model,
      supportsTools,
    });
    logger.debug('Tool integration status', {
      hasIntegration: !!toolIntegration,
      toolCount: tools.length,
    });
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

    const result: ModelResponse = {
      content: response.content,
      model: response.model || 'unknown',
      provider: selectedProvider as string,
      metadata: {
        tokens: response.metadata?.tokens || 0,
        latency: responseTime,
        quality: response.metadata?.quality,
      },
      usage: response.usage,
      cached: false,
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

  private selectProvider(model?: string): ProviderConfig | null {
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
   * Estimate memory usage for a request - delegated to RequestProcessingCoreManager
   */
  private estimateMemoryUsage(request: ModelRequest): number {
    return this.requestProcessingCoreManager.estimateMemoryUsage(request);
  }

  /**
   * Determine process type based on request - delegated to RequestProcessingCoreManager
   */
  private getProcessType(request: ModelRequest): ActiveProcess['type'] {
    return this.requestProcessingCoreManager.getProcessType(request);
  }

  /**
   * Determine request priority - delegated to RequestProcessingCoreManager
   */
  private getRequestPriority(request: ModelRequest): ActiveProcess['priority'] {
    return this.requestProcessingCoreManager.getRequestPriority(request);
  }

  // OPTIMIZED: Fast complexity assessment for timeout determination - delegated to RequestProcessingCoreManager
  private assessComplexityFast(prompt: string): 'simple' | 'medium' | 'complex' {
    return this.requestProcessingCoreManager.assessComplexityFast(prompt);
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
    return this.requestProcessingCoreManager.determineExecutionStrategy(
      request, 
      context, 
      this.config.executionMode
    );
  }

  private selectFastestProvider(): ProviderType {
    return this.providerSelectionStrategy.selectProvider({ prioritizeSpeed: true }).provider;
  }

  private selectMostCapableProvider(): ProviderType {
    return this.providerSelectionStrategy.selectProvider({ complexity: 'complex' }).provider;
  }

  private selectBalancedProvider(): ProviderType {
    return this.providerSelectionStrategy.selectProvider({}).provider;
  }

  private modelSupportsTools(provider: ProviderType, model?: string): boolean {
    return this.providerSelectionStrategy.validateProviderForContext(provider, { 
      requiresTools: true, 
      model 
    });
  }

  private async executeWithFallback(
    requestId: string,
    request: ModelRequest,
    context: ProjectContext | undefined,
    strategy: { mode: ExecutionMode; provider: ProviderType; timeout: number; complexity: string },
    abortSignal?: AbortSignal
  ): Promise<ModelResponse> {
    return this.requestExecutionManager.executeWithFallback(
      requestId,
      request,
      context,
      strategy,
      abortSignal
    );
  }

  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return this.requestProcessingCoreManager.createTimeoutPromise(timeoutMs);
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

  // Queue management for concurrent request limiting - delegated to RequestProcessingCoreManager
  async queueRequest(request: ModelRequest, context?: ProjectContext): Promise<ModelResponse> {
    return this.requestProcessingCoreManager.queueRequest(
      request,
      this.activeRequests.size,
      (req, ctx) => this.processRequest(req, ctx),
      context
    );
  }

  // OPTIMIZED: Management methods with caching - delegated to HealthStatusManager
  async healthCheck(): Promise<Record<string, boolean>> {
    return this.healthStatusManager.healthCheck();
  }

  getMetrics(): MetricsData {
    return this.healthStatusManager.getMetrics(this.activeRequests.size, this.requestQueue.length);
  }

  async shutdown(): Promise<void> {
    logger.info('🛑 Shutting down UnifiedModelClient...');
    
    // Wait for active operations to complete
    await this.resourceCleanupManager.waitForActiveOperations(
      () => this.activeRequests.size,
      10000
    );

    // Clear request queue
    this.resourceCleanupManager.clearRequestQueue(
      this.requestQueue as Array<{ reject: (error: Error) => void }>,
      'System shutting down'
    );

    // Perform graceful shutdown of all registered resources
    await this.resourceCleanupManager.shutdown();

    // Clear remaining collections
    this.activeRequests.clear();
    this.requestQueue.length = 0;
    this.cacheCoordinator.clear();

    logger.info('✅ UnifiedModelClient shutdown complete');
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
    return this.modelManagementManager.getAllAvailableModels();
  }

  async getAvailableModels(): Promise<any[]> {
    return this.modelManagementManager.getAvailableModels();
  }

  async getBestAvailableModel(): Promise<string> {
    return this.modelManagementManager.getBestAvailableModel();
  }

  async pullModel(modelName: string): Promise<boolean> {
    return this.modelManagementManager.pullModel(modelName);
  }

  async testModel(modelName: string): Promise<boolean> {
    return this.modelManagementManager.testModel(modelName);
  }

  async removeModel(modelName: string): Promise<boolean> {
    return this.modelManagementManager.removeModel(modelName);
  }

  async addApiModel(config: any): Promise<boolean> {
    return this.modelManagementManager.addApiModel(config);
  }

  async testApiModel(modelName: string): Promise<boolean> {
    return this.modelManagementManager.testApiModel(modelName);
  }

  removeApiModel(modelName: string): boolean {
    return this.modelManagementManager.removeApiModel(modelName);
  }

  async autoSetup(force: boolean = false): Promise<any> {
    return this.modelManagementManager.autoSetup(force);
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
    logger.info('Troubleshooting help would be displayed here');
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
  private inferTaskType(prompt: string): TaskType {
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
  private analyzeComplexity(prompt: string, request: ModelRequest): ComplexityAnalysis {
    const promptLength = prompt.length;
    const hasContext = !!(request.context && Object.keys(request.context).length > 0);
    const hasFiles = !!(request.files && request.files.length > 0);

    let complexityScore = 0;

    // Length-based scoring
    if (promptLength > 100) complexityScore += 1;
    if (promptLength > 500) complexityScore += 2;
    if (promptLength > 1000) complexityScore += 3;

    // Context-based scoring
    if (hasContext) complexityScore += 2;
    if (hasFiles) complexityScore += request.files?.length || 0;

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
   * Convert ComplexityAnalysis to TaskComplexityMetrics for hybrid router
   */
  private convertToTaskMetrics(complexity: ComplexityAnalysis, request: ModelRequest): TaskComplexityMetrics {
    return {
      linesOfCode: complexity.factors.promptLength / 50, // Rough approximation
      fileCount: complexity.factors.fileCount,
      hasMultipleFiles: complexity.factors.fileCount > 1,
      requiresDeepAnalysis: complexity.level === 'complex',
      isTemplateGeneration: complexity.level === 'simple',
      hasSecurityImplications: (request.prompt || '').toLowerCase().includes('security'),
      estimatedProcessingTime: complexity.level === 'simple' ? 5 : complexity.level === 'medium' ? 8 : 12,
    };
  }

  /**
   * HYBRID ARCHITECTURE: Process request with hybrid routing
   */
  private async processRequestWithHybrid(request: any, routingDecision: any): Promise<any> {
    const selectedProvider = request.provider || 'ollama';

    try {
      // Ensure providers are initialized before attempting to use them
      const availableProviders = this.providerRepository.getAvailableProviders();
      if (availableProviders.size === 0) {
        logger.warn('No providers available, attempting to initialize');
        await this.initializeProvidersAsync();
      }
      
      // Get the appropriate provider
      const provider = this.providerRepository.getProvider(selectedProvider);
      if (!provider) {
        throw new Error(`Provider ${selectedProvider} not available`);
      }

      // DEBUG: Log request before sending to provider
      logger.debug('Hybrid debug: Sending to provider', {
        provider: selectedProvider,
        toolCount: request.tools?.length || 0,
      });
      if (request.tools?.length > 0) {
        logger.debug('Hybrid debug: Tool names', {
          toolNames: request.tools.map((t: any) => t.function?.name || t.name || 'unnamed'),
        });
      }

      // Process the request with timeout handling
      const processRequest = async () => {
        if (request.abortSignal?.aborted) {
          throw new Error('Request was aborted');
        }
        return await provider.processRequest(request);
      };

      // Add timeout protection at provider level
      const response = await Promise.race([
        processRequest(),
        new Promise((_, reject) => {
          if (request.abortSignal) {
            request.abortSignal.addEventListener('abort', () => {
              reject(new Error('Request timed out'));
            });
          }
        })
      ]);

      // Check if response contains tool calls that need to be executed
      if (response.toolCalls && response.toolCalls.length > 0) {
        logger.debug('Tool execution: Found tool calls', { count: response.toolCalls.length });

        const enhancedToolIntegration = getGlobalEnhancedToolIntegration();
        const toolIntegration = enhancedToolIntegration || getGlobalToolIntegration();
        if (toolIntegration) {
          try {
            const toolResults = [];

            // Execute each tool call
            for (const toolCall of response.toolCalls) {
              logger.debug('Executing tool', {
                toolName: toolCall.name || toolCall.function?.name,
              });

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
              logger.debug('Tool result', { result });
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
            logger.error('Tool execution error', error);
            response.content = `Tool execution error: ${errorMessage}`;
          }
        } else {
          logger.warn('Tool integration not available for execution');
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
    return this.voiceSynthesisManager.generateVoiceResponse(prompt, voiceId, options);
  }

  /**
   * Voice System API: Generate responses from multiple voices
   * @param voices Array of voice IDs to use
   * @param prompt The input prompt
   * @param options Options including parallel processing settings
   * @returns Multiple voice responses with metadata
   */
  async generateMultiVoiceResponses(voices: string[], prompt: string, options?: any): Promise<any> {
    return this.voiceSynthesisManager.generateMultiVoiceResponses(voices, prompt, options);
  }

  /**
   * Voice System API: Synthesize multiple voice perspectives into unified response
   * @param voices Array of voice IDs to synthesize
   * @param prompt The input prompt
   * @param options Synthesis options including mode and conflict resolution
   * @returns Synthesized response with individual perspectives and consensus
   */
  async synthesizeVoicePerspectives(voices: string[], prompt: string, options?: any): Promise<any> {
    return this.voiceSynthesisManager.synthesizeVoicePerspectives(voices, prompt, options);
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
   * Check health status of the client and providers
   */
  async checkHealth(): Promise<{ status: string; details: any }> {
    return this.healthStatusManager.checkHealth(this.initialized);
  }

  /**
   * MEMORY LEAK FIX: Destroy client and cleanup all resources
   */
  async destroy(): Promise<void> {
    try {
      // Emergency cleanup of all registered resources
      await this.resourceCleanupManager.destroy();

      // Clear remaining collections
      this.activeRequests.clear();
      this.requestQueue = [];

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
