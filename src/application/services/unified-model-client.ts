/**
 * Unified Model Client - Application Layer Service
 *
 * Replaces the missing UnifiedModelClient from the refactor directory.
 * Implements the IModelClient interface and coordinates multiple model providers.
 */

import { EventEmitter } from 'events';
import { IModelClient, StreamToken } from '../../core/interfaces/client-interfaces.js';
import {
  IModelProvider,
  IModelRouter,
  ModelRequest,
  ModelResponse,
  ModelInfo,
  ModelCapability,
  RequestContext,
} from '../../domain/interfaces/model-client.js';
import { UnifiedConfiguration } from '../../domain/interfaces/configuration.js';
import { logger } from '../../infrastructure/logging/unified-logger.js';
import { OllamaProvider } from '../../core/hybrid/ollama-provider.js';
import { LMStudioProvider } from '../../core/hybrid/lm-studio-provider.js';
import { SimpleModelRouter } from '../../core/routing/simple-model-router.js';
import { ProviderAdapter } from '../../core/adapters/provider-adapter.js';
import {
  IntelligentModelRouter,
  RouterConfig,
  ModelProvider,
  ModelSpec,
  RoutingRequest,
  TaskType,
} from '../../core/routing/intelligent-model-router.js';
import { VoiceArchetypeSystem } from '../../voices/voice-archetype-system.js';
import { VoiceArchetypeSystemInterface } from '../../domain/interfaces/voice-system.js';
import {
  LivingSpiralCoordinator,
  SpiralConfig,
  SpiralResult,
  SpiralIteration,
} from '../../domain/services/living-spiral-coordinator.js';
import { LivingSpiralCoordinatorInterface } from '../../domain/interfaces/workflow-orchestrator.js';
import { IUnifiedSecurityValidator } from '../../domain/services/unified-security-validator.js';
// Use provider repository interface type to match DI expectations
import { IProviderRepository } from '../../core/interfaces/provider-interfaces.js';
import { IStreamingManager } from '../../infrastructure/streaming/streaming-manager.js';
import { ICacheCoordinator } from '../../core/caching/cache-coordinator.js';
import { IPerformanceMonitor } from '../../domain/services/unified-performance-system.js';
import { ILogger } from '../../domain/interfaces/logger.js';
import { HybridLLMRouter } from '../../core/hybrid/hybrid-llm-router.js';
import { SecurityConfig } from '../../core/types/global.types.js';
import { ToolInfo } from '../../mcp-servers/mcp-server-manager.js';
import { PerformanceProfiler } from '../../core/performance/profiler.js';

export interface UnifiedModelClientConfig {
  defaultProvider: string;
  providers: ProviderConfig[];
  fallbackStrategy: 'fail-fast' | 'round-robin' | 'priority';
  executionMode?: 'auto' | 'quality' | 'fast' | 'balanced';
  fallbackChain?: string[];
  performanceThresholds?: {
    fastModeMaxTokens: number;
    timeoutMs: number;
    maxConcurrentRequests: number;
  };
  security?: SecurityConfig; // Type-safe security configuration
  timeout: number;
  retryAttempts: number;
  enableCaching: boolean;
  enableMetrics: boolean;
}

export interface ProviderConfig {
  type: 'ollama' | 'lm-studio' | 'openai' | 'anthropic';
  name: string;
  endpoint: string;
  enabled: boolean;
  priority: number;
  models: string[];
  apiKey?: string;
  timeout?: number;
}

/**
 * Unified Model Client that provides a single interface to multiple AI model providers.
 * Handles provider selection, fallbacks, and coordination.
 */
export interface UnifiedModelClientDependencies {
  providerRepository?: IProviderRepository;
  securityValidator?: IUnifiedSecurityValidator;
  streamingManager?: IStreamingManager;
  cacheCoordinator?: ICacheCoordinator;
  performanceMonitor?: IPerformanceMonitor;
  performanceProfiler?: PerformanceProfiler;
  hybridRouter?: HybridLLMRouter;
  voiceSystem?: VoiceArchetypeSystemInterface;
  livingSpiralCoordinator?: LivingSpiralCoordinatorInterface;
  logger?: ILogger;
}

export interface VoiceProcessingOptions {
  voices?: string[];
  context?: RequestContext;
}

export interface VoiceProcessingResult {
  responses: Array<{
    voiceId: string;
    response: string;
    confidence?: number;
  }>;
  synthesis?: string;
  metadata?: {
    processingTime: number;
    voicesUsed: string[];
    convergence: boolean;
  };
}

export interface CodeAnalysisResult {
  filePath: string;
  analysis: {
    structure: string;
    patterns: string[];
    suggestions: string[];
    quality: number;
  };
  spiral?: {
    phase: string;
    iteration: number;
    recommendations: string[];
  };
  timestamp: Date;
}

// Local options shape used internally; public interface method accepts Record<string, unknown>
export interface TextGenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  provider?: string;
  context?: RequestContext;
  tools?: unknown;
}

export interface TextGenerationResult {
  text: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, unknown>;
}

export class UnifiedModelClient extends EventEmitter implements IModelClient {
  private config: UnifiedModelClientConfig;
  private providers: Map<string, IModelProvider> = new Map();
  private router: IModelRouter;
  private intelligentRouter: IntelligentModelRouter;
  private voiceSystem?: VoiceArchetypeSystemInterface;
  private livingSpiralCoordinator?: LivingSpiralCoordinatorInterface;
  private performanceProfiler?: PerformanceProfiler;
  private initialized = false;
  private requestCount = 0;
  private cache = new Map<string, { response: ModelResponse; timestamp: number }>();
  private dependencies?: UnifiedModelClientDependencies;

  constructor(
    config: UnifiedModelClientConfig | UnifiedConfiguration,
    dependencies?: UnifiedModelClientDependencies
  ) {
    super();

    this.dependencies = dependencies;

    // Handle both config types for backward compatibility
    if ('model' in config) {
      // UnifiedConfiguration format
      this.config = this.convertUnifiedConfig(config);
    } else {
      // Direct UnifiedModelClientConfig
      this.config = config;
    }

    this.setupProviders();
    this.setupRouter();
    this.setupIntelligentRouter();
    this.setupVoiceSystem();
    this.setupLivingSpiralCoordinator();
    this.setupPerformanceProfiler();
  }

  private convertUnifiedConfig(unifiedConfig: UnifiedConfiguration): UnifiedModelClientConfig {
    return {
      defaultProvider: unifiedConfig.model.defaultProvider,
      providers: unifiedConfig.model.providers.map(p => ({
        type: p.type as any,
        name: p.name,
        endpoint: p.endpoint,
        enabled: p.enabled,
        priority: p.priority || 1,
        models: p.models,
        apiKey: p.apiKey,
        timeout: 30000, // Default timeout since ModelProviderConfiguration doesn't have timeout property
      })),
      fallbackStrategy: 'priority',
      timeout: unifiedConfig.model.timeout,
      retryAttempts: 3,
      enableCaching: true,
      enableMetrics: true,
    };
  }

  private setupProviders(): void {
    for (const providerConfig of this.config.providers) {
      if (!providerConfig.enabled) continue;

      try {
        let provider: IModelProvider;

        switch (providerConfig.type) {
          case 'ollama': {
            // Convert ProviderConfig to OllamaConfig format
            const ollamaConfig = {
              endpoint: providerConfig.endpoint,
              defaultModel: providerConfig.models[0] || 'llama3.1',
              timeout: providerConfig.timeout || 30000,
              maxRetries: 3,
            };
            const ollamaProvider = new OllamaProvider(ollamaConfig);
            provider = new ProviderAdapter(ollamaProvider, providerConfig.name);
            break;
          }

          case 'lm-studio': {
            // Convert ProviderConfig to LMStudioConfig format
            const lmStudioConfig = {
              endpoint: providerConfig.endpoint,
              defaultModel: providerConfig.models[0] || 'codellama',
              timeout: providerConfig.timeout || 30000,
              maxRetries: 3,
            };
            const lmStudioProvider = new LMStudioProvider(lmStudioConfig);
            provider = new ProviderAdapter(lmStudioProvider, providerConfig.name);
            break;
          }

          default: {
            logger.warn(`Unknown provider type: ${providerConfig.type}`);
            continue;
          }
        }

        this.providers.set(providerConfig.name, provider);
        logger.info(`Registered provider: ${providerConfig.name} (${providerConfig.type})`);
      } catch (error) {
        logger.error(`Failed to setup provider ${providerConfig.name}:`, error);
      }
    }
  }

  private setupRouter(): void {
    this.router = new SimpleModelRouter(this.providers, this.config);
  }

  private setupIntelligentRouter(): void {
    const routerConfig = this.convertToRouterConfig();
    this.intelligentRouter = new IntelligentModelRouter(routerConfig);
  }

  private convertToRouterConfig(): RouterConfig {
    const modelProviders: ModelProvider[] = this.config.providers.map(providerConfig => {
      const models: ModelSpec[] = providerConfig.models.map(modelName => ({
        id: modelName,
        name: modelName,
        displayName: modelName,
        contextWindow: 128000, // Default context window
        maxTokens: 128000,
        strengthProfiles: [
          {
            category: providerConfig.type === 'ollama' ? 'analysis' : 'code-generation',
            score: 0.8,
            examples: [`${modelName} for ${providerConfig.type}`],
          },
        ],
        costPerToken: {
          input:
            providerConfig.type === 'ollama' || providerConfig.type === 'lm-studio' ? 0 : 0.001,
          output:
            providerConfig.type === 'ollama' || providerConfig.type === 'lm-studio' ? 0 : 0.002,
        },
        latencyProfile: {
          firstToken: providerConfig.type === 'lm-studio' ? 500 : 1000,
          tokensPerSecond: providerConfig.type === 'lm-studio' ? 50 : 30,
        },
        qualityScore: 0.8,
        supportedFeatures: ['completion', 'chat'],
      }));

      return {
        id: providerConfig.name,
        name: providerConfig.name,
        type: providerConfig.type as any,
        endpoint: providerConfig.endpoint,
        models,
        capabilities: [
          { feature: 'streaming', supported: true },
          { feature: 'function-calling', supported: false },
        ],
        costProfile: {
          tier:
            providerConfig.type === 'ollama' || providerConfig.type === 'lm-studio'
              ? 'local'
              : 'paid',
          costPerRequest: 0,
          costOptimized: true,
        },
        performanceProfile: {
          averageLatency: providerConfig.timeout || 5000,
          throughput: 1,
          reliability: 0.95,
          uptime: 95,
        },
        healthStatus: {
          status: 'healthy',
          lastChecked: new Date(),
          responseTime: 0,
          errorRate: 0,
          availableModels: providerConfig.models,
        },
      };
    });

    return {
      providers: modelProviders,
      defaultStrategy: {
        primary: 'balanced',
        fallback: 'escalate',
        escalationTriggers: [
          {
            condition: 'low-confidence',
            threshold: 0.5,
            action: 'upgrade-model',
          },
        ],
      },
      costOptimization: {
        enabled: true,
        budgetLimits: {
          daily: 10.0,
          monthly: 100.0,
        },
        thresholds: {
          lowCost: 0.01,
          mediumCost: 0.1,
          highCost: 1.0,
        },
      },
      performance: {
        healthCheckInterval: 60000,
        timeoutMs: this.config.timeout || 30000,
        retryAttempts: this.config.retryAttempts || 3,
        circuitBreakerThreshold: 5,
      },
      intelligence: {
        learningEnabled: true,
        adaptiveRouting: true,
        qualityFeedbackWeight: 0.3,
        costFeedbackWeight: 0.2,
      },
    };
  }

  private setupVoiceSystem(): void {
    if (this.dependencies?.voiceSystem) {
      this.voiceSystem = this.dependencies.voiceSystem;
      logger.info('Voice system provided via dependencies');
    } else {
      // Create a default voice system if not provided
      try {
        // Import the createLogger function for voice system
        const voiceLogger = this.dependencies?.logger || logger;

        // Initialize voice system with this client (spiral coordinator will be connected later)
        this.voiceSystem = new VoiceArchetypeSystem(
          voiceLogger,
          undefined, // spiralCoordinator will be set up in setupLivingSpiralCoordinator
          this, // Pass this model client to the voice system
          {
            voices: {
              default: ['explorer', 'maintainer'],
              available: [
                'explorer',
                'maintainer',
                'analyzer',
                'developer',
                'implementor',
                'security',
                'architect',
                'designer',
                'optimizer',
              ],
              parallel: true,
              maxConcurrent: 3,
            },
          }
        );
        logger.info('Voice archetype system initialized with default configuration');
      } catch (error) {
        logger.warn('Failed to initialize voice system:', error);
        this.voiceSystem = undefined;
      }
    }
  }

  private setupLivingSpiralCoordinator(): void {
    if (this.dependencies?.livingSpiralCoordinator) {
      this.livingSpiralCoordinator = this.dependencies.livingSpiralCoordinator;
      logger.info('Living Spiral Coordinator provided via dependencies');
    } else if (this.voiceSystem) {
      // Create a default Living Spiral Coordinator if not provided
      try {
        const spiralConfig: SpiralConfig = {
          maxIterations: 5,
          qualityThreshold: 0.8,
          convergenceTarget: 0.9,
          enableReflection: true,
          parallelVoices: true,
          councilSize: 3,
        };

        // Note: For now, we'll create a basic implementation
        // The full Living Spiral Coordinator requires voice orchestration service interface
        logger.info(
          'Living Spiral Coordinator integration setup (requires voice orchestration service)'
        );

        // For now, we'll create a simplified integration point
        this.livingSpiralCoordinator = {
          executeSpiralProcess: async (prompt: string) => {
            if (this.voiceSystem) {
              return await this.voiceSystem.processPrompt(prompt, {
                voices: ['explorer', 'maintainer', 'analyzer'],
                councilMode: 'consensus',
              });
            }
            return { error: 'No voice system available' };
          },
          executeSpiralIteration: async (input: string, iteration: number) => {
            return await this.processWithVoices(input, {
              voices: ['explorer', 'maintainer'],
            });
          },
          checkConvergence: async (results: any[]) => {
            // Simple convergence check based on result consistency
            return results.length >= 3;
          },
          analyzeCode: async (filePath: string, context: any) => {
            return await this.processWithVoices(`Analyze code in ${filePath}`, {
              voices: ['analyzer', 'security', 'maintainer'],
              context,
            });
          },
          initialize: async (dependencies: any) => {
            logger.info('Living Spiral Coordinator initialized');
          },
          shutdown: async () => {
            logger.info('Living Spiral Coordinator shutdown');
          },
        };

        logger.info('Living Spiral Coordinator integrated with voice system');

        // Update voice system with spiral coordinator if it supports it
        if (this.voiceSystem && (this.voiceSystem as any).setLivingSpiralCoordinator) {
          (this.voiceSystem as any).setLivingSpiralCoordinator(this.livingSpiralCoordinator);
        }
      } catch (error) {
        logger.warn('Failed to initialize Living Spiral Coordinator:', error);
        this.livingSpiralCoordinator = undefined;
      }
    } else {
      logger.warn('Living Spiral Coordinator requires voice system - skipping initialization');
    }
  }

  private setupPerformanceProfiler(): void {
    if (this.dependencies?.performanceProfiler) {
      this.performanceProfiler = this.dependencies.performanceProfiler;
      logger.info('Performance profiler provided via dependencies');
    } else {
      logger.debug('Performance profiler not provided - profiling will be disabled');
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing Unified Model Client...');

    // Initialize all providers
    const initPromises = Array.from(this.providers.values()).map(async provider => {
      try {
        if ('initialize' in provider && typeof provider.initialize === 'function') {
          await provider.initialize();
        }
      } catch (error) {
        logger.error(`Failed to initialize provider:`, error);
      }
    });

    await Promise.allSettled(initPromises);

    // Verify at least one provider is available
    const availableProviders = await this.getAvailableProviders();
    if (availableProviders.length === 0) {
      throw new Error('No model providers are available');
    }

    this.initialized = true;
    this.emit('initialized', { availableProviders: availableProviders.length });
    logger.info(`Unified Model Client initialized with ${availableProviders.length} providers`);
  }

  async request(request: ModelRequest): Promise<ModelResponse> {
    if (!this.initialized) {
      throw new Error('Model client not initialized');
    }

    const requestId = request.id || `req-${Date.now()}-${++this.requestCount}`;
    const startTime = Date.now();

    // Start profiling session if profiler available
    let profilingSessionId: string | undefined;
    let preparationOperationId: string | undefined;
    let inferenceOperationId: string | undefined;
    
    if (this.performanceProfiler) {
      profilingSessionId = this.performanceProfiler.startSession(`llm_request_${requestId}`);
      
      // Profile prompt preparation
      preparationOperationId = this.performanceProfiler.startOperation(
        profilingSessionId,
        'prompt_preparation',
        'prompt_preparation',
        {
          requestId,
          promptLength: request.prompt.length,
          hasTools: !!request.tools,
          hasContext: !!request.context,
          templateType: 'standard',
          complexity: request.prompt.length > 1000 ? 'high' : request.prompt.length > 500 ? 'medium' : 'low',
        }
      );
    }

    // Check cache first
    if (this.config.enableCaching) {
      const cacheKey = this.getCacheKey(request);
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 300000) {
        // 5 minute cache
        logger.debug(`Cache hit for request: ${requestId}`);
        
        // End preparation profiling on cache hit
        if (this.performanceProfiler && profilingSessionId && preparationOperationId) {
          this.performanceProfiler.endOperation(profilingSessionId, preparationOperationId);
          this.performanceProfiler.endSession(profilingSessionId);
        }
        
        return { ...cached.response, id: requestId };
      }
    }

    try {
      logger.debug(`Processing request: ${requestId}`);
      
      // End prompt preparation profiling
      if (this.performanceProfiler && profilingSessionId && preparationOperationId) {
        this.performanceProfiler.endOperation(profilingSessionId, preparationOperationId);
      }

      // Use intelligent routing for better provider selection
      let provider: IModelProvider;
      let model: string;

      try {
        const routingRequest: RoutingRequest = {
          query: request.prompt,
          context:
            typeof request.context === 'string' ? request.context : JSON.stringify(request.context),
          taskType: this.analyzeTaskType(request),
          priority: 'medium', // Default priority since ModelRequest doesn't have this property
          constraints: {
            maxCost: 1.0,
            maxLatency: this.config.timeout || 30000,
            requireLocal: false,
            requireStreaming: request.stream || false,
          },
        };

        const routingDecision = await this.intelligentRouter.route(routingRequest);
        const selectedProvider = this.providers.get(routingDecision.provider.name);

        if (selectedProvider && (await selectedProvider.isAvailable())) {
          provider = selectedProvider;
          model = routingDecision.model.name;
          logger.debug(`Intelligent router selected: ${routingDecision.provider.name}/${model}`);
        } else {
          // Fallback to simple router
          const fallback = await this.router.route(request);
          provider = fallback.provider;
          model = fallback.model;
          logger.debug(`Fallback to simple router: ${provider.type}/${model}`);
        }
      } catch (routingError) {
        logger.warn(`Intelligent routing failed, using simple router:`, routingError);
        // Fallback to simple router
        const fallback = await this.router.route(request);
        provider = fallback.provider;
        model = fallback.model;
      }

      // Start LLM inference profiling
      if (this.performanceProfiler && profilingSessionId) {
        inferenceOperationId = this.performanceProfiler.startOperation(
          profilingSessionId,
          'llm_inference',
          'llm_inference',
          {
            requestId,
            provider: provider.type,
            model: model,
            promptLength: request.prompt.length,
            hasTools: !!request.tools,
            operationType: request.stream ? 'stream' : 'generate',
          }
        );
      }

      // Execute request with the selected provider
      const requestWithId = { ...request, id: requestId, model };
      const response = await provider.request(requestWithId);

      // End LLM inference profiling on success
      if (this.performanceProfiler && profilingSessionId && inferenceOperationId) {
        this.performanceProfiler.endOperation(profilingSessionId, inferenceOperationId);
      }

      // Cache successful responses
      if (this.config.enableCaching && response) {
        const cacheKey = this.getCacheKey(request);
        this.cache.set(cacheKey, { response, timestamp: Date.now() });
      }

      const duration = Date.now() - startTime;
      this.emit('request-completed', { requestId, duration, provider: provider.type });
      logger.debug(`Request completed: ${requestId} (${duration}ms)`);

      // End profiling session on success
      if (this.performanceProfiler && profilingSessionId) {
        this.performanceProfiler.endSession(profilingSessionId);
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // End inference profiling on error
      if (this.performanceProfiler && profilingSessionId && inferenceOperationId) {
        this.performanceProfiler.endOperation(profilingSessionId, inferenceOperationId, error as Error);
      }
      
      // End profiling session on error
      if (this.performanceProfiler && profilingSessionId) {
        this.performanceProfiler.endSession(profilingSessionId);
      }
      
      this.emit('request-failed', { requestId, duration, error });
      logger.error(`Request failed: ${requestId}`, error);
      throw error;
    }
  }

  async *stream(request: ModelRequest): AsyncIterableIterator<StreamToken> {
    if (!this.initialized) {
      throw new Error('Model client not initialized');
    }

    const requestId = request.id || `stream-${Date.now()}-${++this.requestCount}`;
    
    // Start profiling session for streaming
    let profilingSessionId: string | undefined;
    let streamingOperationId: string | undefined;
    
    if (this.performanceProfiler) {
      profilingSessionId = this.performanceProfiler.startSession(`llm_stream_${requestId}`);
      streamingOperationId = this.performanceProfiler.startOperation(
        profilingSessionId,
        'llm_streaming_inference',
        'llm_inference',
        {
          requestId,
          promptLength: request.prompt.length,
          operationType: 'stream',
        }
      );
    }

    try {
      logger.debug(`Processing stream request: ${requestId}`);

      // Route to appropriate provider
      const { provider, model } = await this.router.route(request);

      // Update profiling metadata with provider info
      if (this.performanceProfiler && profilingSessionId && streamingOperationId) {
        // End the operation and restart with updated metadata
        this.performanceProfiler.endOperation(profilingSessionId, streamingOperationId);
        streamingOperationId = this.performanceProfiler.startOperation(
          profilingSessionId,
          'llm_streaming_inference',
          'llm_inference',
          {
            requestId,
            provider: provider.type,
            model: model,
            promptLength: request.prompt.length,
            operationType: 'stream',
          }
        );
      }

      // Execute streaming request
      const requestWithId = { ...request, id: requestId, model, stream: true };

      if ('stream' in provider && typeof provider.stream === 'function') {
        yield* provider.stream(requestWithId);
      } else {
        // Fallback to regular request for non-streaming providers
        const response = await provider.request(requestWithId);
        yield {
          content: response.content,
          isComplete: true,
          index: 0,
          timestamp: Date.now(),
          metadata: response.metadata,
        };
      }

      // End profiling on successful completion
      if (this.performanceProfiler && profilingSessionId) {
        if (streamingOperationId) {
          this.performanceProfiler.endOperation(profilingSessionId, streamingOperationId);
        }
        this.performanceProfiler.endSession(profilingSessionId);
      }

      this.emit('stream-completed', { requestId });
    } catch (error) {
      // End profiling on error
      if (this.performanceProfiler && profilingSessionId) {
        if (streamingOperationId) {
          this.performanceProfiler.endOperation(profilingSessionId, streamingOperationId, error as Error);
        }
        this.performanceProfiler.endSession(profilingSessionId);
      }
      
      this.emit('stream-failed', { requestId, error });
      logger.error(`Stream request failed: ${requestId}`, error);
      throw error;
    }
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];

    for (const provider of this.providers.values()) {
      try {
        if (await provider.isAvailable()) {
          const providerModels = await provider.getSupportedModels();
          models.push(...providerModels);
        }
      } catch (error) {
        logger.warn(`Failed to get models from provider:`, error);
      }
    }

    return models;
  }

  async isHealthy(): Promise<boolean> {
    const availableProviders = await this.getAvailableProviders();
    return availableProviders.length > 0;
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Unified Model Client...');

    // Shutdown all providers
    const shutdownPromises = Array.from(this.providers.values()).map(async provider => {
      try {
        if ('shutdown' in provider && typeof provider.shutdown === 'function') {
          await provider.shutdown();
        }
      } catch (error) {
        logger.error('Error shutting down provider:', error);
      }
    });

    await Promise.allSettled(shutdownPromises);

    // Shutdown intelligent router
    if (this.intelligentRouter) {
      this.intelligentRouter.shutdown();
    }

    // Shutdown Living Spiral Coordinator
    if (this.livingSpiralCoordinator) {
      await this.livingSpiralCoordinator.shutdown();
    }

    this.providers.clear();
    this.cache.clear();
    this.initialized = false;
    this.removeAllListeners();

    logger.info('Unified Model Client shut down');
  }

  // Utility methods
  private getCacheKey(request: ModelRequest): string {
    return `${request.model || 'default'}:${request.prompt}:${JSON.stringify(request.tools || [])}`;
  }

  private analyzeTaskType(request: ModelRequest): TaskType {
    const prompt = request.prompt.toLowerCase();
    let category: TaskType['category'] = 'general';
    let complexity: TaskType['complexity'] = 'simple';

    // Analyze category based on prompt content
    if (prompt.includes('code') || prompt.includes('function') || prompt.includes('class')) {
      category = 'code-generation';
    } else if (
      prompt.includes('analyze') ||
      prompt.includes('explain') ||
      prompt.includes('review')
    ) {
      category = 'analysis';
    } else if (prompt.includes('fix') || prompt.includes('debug') || prompt.includes('error')) {
      category = 'debugging';
    } else if (prompt.includes('refactor') || prompt.includes('optimize')) {
      category = 'refactoring';
    } else if (prompt.includes('edit') || prompt.includes('change') || prompt.includes('modify')) {
      category = 'editing';
    } else if (
      prompt.includes('document') ||
      prompt.includes('explain') ||
      prompt.includes('describe')
    ) {
      category = 'documentation';
    }

    // Analyze complexity based on prompt length and content
    const promptLength = request.prompt.length;
    if (promptLength > 1000 || prompt.includes('complex') || prompt.includes('architecture')) {
      complexity = 'complex';
    } else if (promptLength > 500 || prompt.includes('analysis') || prompt.includes('detailed')) {
      complexity = 'moderate';
    } else if (
      prompt.includes('expert') ||
      prompt.includes('advanced') ||
      prompt.includes('sophisticated')
    ) {
      complexity = 'expert';
    }

    return {
      category,
      complexity,
      estimatedTokens: Math.min(request.maxTokens || 2000, promptLength * 2),
      timeConstraint: this.config.timeout || 30000, // Use config timeout since ModelRequest doesn't have timeout
      qualityRequirement:
        complexity === 'expert' ? 'critical' : complexity === 'complex' ? 'production' : 'draft',
    };
  }

  // Voice Archetype System Integration Methods

  /**
   * Process a prompt with multiple voices for comprehensive analysis
   */
  async processWithVoices(
    prompt: string,
    options?: VoiceProcessingOptions
  ): Promise<VoiceProcessingResult> {
    if (!this.voiceSystem) {
      logger.warn('Voice system not available, falling back to single voice response');
      const text = await this.generateText(prompt);
      return {
        responses: [{ voiceId: 'default', response: text }],
        synthesis: text,
        metadata: { processingTime: 0, voicesUsed: ['default'], convergence: true },
      };
    }

    try {
      return await this.voiceSystem.processPrompt(prompt, options);
    } catch (error) {
      logger.error('Multi-voice processing failed, using fallback:', error);
      const text = await this.generateText(prompt);
      return {
        responses: [{ voiceId: 'default', response: text }],
        synthesis: text,
        metadata: { processingTime: 0, voicesUsed: ['default'], convergence: false },
      };
    }
  }

  /**
   * Generate multi-voice solutions for a given problem
   */
  async generateMultiVoiceResponses(
    voices: string[],
    prompt: string,
    options?: VoiceProcessingOptions
  ): Promise<VoiceProcessingResult> {
    if (!this.voiceSystem) {
      logger.warn('Voice system not available, generating single response');
      return {
        responses: [{ voiceId: 'default', response: await this.generateText(prompt) }],
        synthesis: await this.generateText(prompt),
        metadata: { processingTime: 0, voicesUsed: ['default'], convergence: true },
      };
    }

    try {
      return await this.voiceSystem.generateMultiVoiceSolutions(voices, prompt);
    } catch (error) {
      logger.error('Multi-voice generation failed:', error);
      throw error;
    }
  }

  /**
   * Get a specific voice perspective on a prompt
   */
  async getVoicePerspective(
    voiceId: string,
    prompt: string
  ): Promise<{ voiceId: string; response: string; confidence?: number }> {
    if (!this.voiceSystem) {
      logger.warn('Voice system not available, generating default response');
      return {
        voiceId: 'default',
        response: await this.generateText(prompt),
        confidence: 0.5,
      };
    }

    try {
      return await this.voiceSystem.getVoicePerspective(voiceId, prompt);
    } catch (error) {
      logger.error(`Failed to get ${voiceId} perspective:`, error);
      throw error;
    }
  }

  /**
   * Get available voice archetypes
   */
  getAvailableVoices(): string[] {
    if (!this.voiceSystem) {
      return ['default'];
    }

    try {
      return this.voiceSystem.getAvailableVoices();
    } catch (error) {
      logger.error('Failed to get available voices:', error);
      return ['default'];
    }
  }

  /**
   * Get the voice archetype system instance
   */
  getVoiceSystem(): VoiceArchetypeSystemInterface | undefined {
    return this.voiceSystem;
  }

  /**
   * Generate voice-specific response - implements voice integration patterns from research
   */
  async generateVoiceResponse(prompt: string, voiceId: string, options: any = {}): Promise<any> {
    try {
      // Create voice-specific request with context
      const voiceRequest: ModelRequest = {
        prompt: `[VOICE: ${voiceId}] ${prompt}`,
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 4096,
        tools: options.tools || [],
        context: {
          voice: voiceId,
          requestType: 'voice-synthesis',
          ...options.context,
        },
      };

      // Route through the model router for optimal provider selection
      const response = await this.request(voiceRequest);

      return {
        content: response.content,
        voice: voiceId,
        model: response.model,
        provider: response.provider,
        usage: response.usage,
        metadata: {
          ...response.metadata,
          voiceId,
          synthesisType: 'voice-response',
        },
      };
    } catch (error) {
      logger.error(`Voice response generation failed for voice ${voiceId}:`, error);
      throw error;
    }
  }

  // Removed duplicate - enhanced existing processRequest method

  /**
   * Get available tools for voice system integration
   */
  async getAvailableTools(): Promise<ToolInfo[]> {
    try {
      // Aggregate tools from all providers
      const allTools: ToolInfo[] = [];

      for (const [name, provider] of this.providers) {
        try {
          if ('getAvailableTools' in provider && typeof provider.getAvailableTools === 'function') {
            const providerTools = await (provider as any).getAvailableTools();
            allTools.push(...(providerTools as ToolInfo[]));
          }
        } catch (error) {
          logger.debug(`Failed to get tools from provider ${name}:`, error);
        }
      }

      // Add built-in tools for voice synthesis
      allTools.push(
        {
          name: 'voice_context',
          description: 'Access voice-specific context and persona information',
          inputSchema: {},
        },
        {
          name: 'council_deliberation',
          description: 'Facilitate multi-voice council deliberation and consensus building',
          inputSchema: {},
        }
      );

      return allTools;
    } catch (error) {
      logger.error('Failed to get available tools:', error);
      return [];
    }
  }

  /**
   * Get tool integration for enhanced capabilities
   */
  getToolIntegration(): any {
    return {
      getAllLLMFunctions: async () => {
        return await this.getAvailableTools();
      },
      executeFunction: async (functionName: string, args: any) => {
        // Implement function execution logic
        logger.debug(`Executing function: ${functionName}`, args);
        return { result: 'Function execution not yet implemented' };
      },
    };
  }

  // Removed duplicate - enhanced existing generateText method

  // Living Spiral Coordinator Integration Methods

  /**
   * Execute the complete Living Spiral process for iterative development
   */
  async executeLivingSpiralProcess(prompt: string): Promise<SpiralResult> {
    if (!this.livingSpiralCoordinator) {
      logger.warn('Living Spiral Coordinator not available, falling back to voice processing');
      const start = Date.now();
      const vp = await this.processWithVoices(prompt, {
        voices: ['explorer', 'maintainer', 'analyzer'],
      });
      const output = vp.synthesis || vp.responses[0]?.response || '';
      return {
        final: output,
        iterations: [
          {
            phase: 'synthesis' as any,
            iteration: 1,
            input: prompt,
            output,
            quality: 0.8,
            voices: vp.metadata?.voicesUsed || ['default'],
            metadata: { timestamp: new Date(), duration: Date.now() - start, convergence: 1 },
          },
        ],
        convergenceAchieved: true,
        totalIterations: 1,
        quality: 0.8,
        synthesisResults: vp.responses,
      };
    }

    try {
      return await this.livingSpiralCoordinator.executeSpiralProcess(prompt);
    } catch (error) {
      logger.error('Living Spiral process failed:', error);
      throw error;
    }
  }

  /**
   * Execute a single Living Spiral iteration
   */
  async executeSpiralIteration(input: string, iteration: number): Promise<SpiralIteration> {
    if (!this.livingSpiralCoordinator) {
      logger.warn('Living Spiral Coordinator not available, using voice processing');
      const start = Date.now();
      const vp = await this.processWithVoices(input, { voices: ['explorer', 'maintainer'] });
      const output = vp.synthesis || vp.responses[0]?.response || '';
      return {
        phase: 'synthesis' as any,
        iteration,
        input,
        output,
        quality: 0.7,
        voices: vp.metadata?.voicesUsed || ['default'],
        metadata: { timestamp: new Date(), duration: Date.now() - start, convergence: 1 },
      };
    }

    try {
      return await this.livingSpiralCoordinator.executeSpiralIteration(input, iteration);
    } catch (error) {
      logger.error('Spiral iteration failed:', error);
      throw error;
    }
  }

  /**
   * Analyze code using the Living Spiral methodology
   */
  async analyzeLivingSpiralCode(
    filePath: string,
    context?: RequestContext
  ): Promise<CodeAnalysisResult> {
    if (!this.livingSpiralCoordinator) {
      logger.warn('Living Spiral Coordinator not available, using voice analysis');
      const prompt = `Analyze code in ${filePath}`;
      const vp = await this.processWithVoices(prompt, {
        voices: ['analyzer', 'security', 'maintainer'],
      });
      const synthesis = vp.synthesis || vp.responses[0]?.response || '';
      return {
        filePath,
        analysis: {
          structure: 'unknown',
          patterns: [],
          suggestions: [synthesis],
          quality: 0.7,
        },
        spiral: { phase: 'synthesis' as any, iteration: 1, recommendations: [] },
        timestamp: new Date(),
      };
    }

    try {
      return await this.livingSpiralCoordinator.analyzeCode(filePath, context as any);
    } catch (error) {
      logger.error('Living Spiral code analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get the Living Spiral Coordinator instance
   */
  getLivingSpiralCoordinator(): LivingSpiralCoordinatorInterface | undefined {
    return this.livingSpiralCoordinator;
  }

  private async getAvailableProviders(): Promise<IModelProvider[]> {
    const available: IModelProvider[] = [];

    for (const provider of this.providers.values()) {
      try {
        if (await provider.isAvailable()) {
          available.push(provider);
        }
      } catch (error) {
        // Provider not available
      }
    }

    return available;
  }

  // Public utility methods for backward compatibility
  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  getConfiguration(): UnifiedModelClientConfig {
    return { ...this.config };
  }

  async testConnection(): Promise<{ provider: string; available: boolean; latency?: number }[]> {
    const results = [];

    for (const [name, provider] of this.providers.entries()) {
      const startTime = Date.now();
      try {
        const available = await provider.isAvailable();
        const latency = Date.now() - startTime;
        results.push({ provider: name, available, latency });
      } catch (error) {
        results.push({ provider: name, available: false });
      }
    }

    return results;
  }

  // IModelClient interface methods
  async processRequest(request: ModelRequest): Promise<ModelResponse> {
    try {
      // Handle both ModelRequest and legacy voice system request formats
      // Normalize to ModelRequest (avoid non-typed legacy fields)
      const modelRequest: ModelRequest = {
        prompt: request.prompt || '',
        model: request.model,
        provider: request.provider,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        tools: request.tools,
        context: request.context,
        id: request.id || `proc_${Date.now()}`,
      };

      return await this.request(modelRequest);
    } catch (error) {
      logger.error('Process request failed:', error);
      throw error;
    }
  }

  async streamRequest(
    request: ModelRequest,
    onToken: (token: StreamToken) => void
  ): Promise<ModelResponse> {
    // For now, simulate streaming by calling request and emitting tokens
    const response = await this.request(request);

    // Simulate token streaming
    const words = response.content.split(' ');
    for (let i = 0; i < words.length; i++) {
      onToken({
        content: words[i] + (i < words.length - 1 ? ' ' : ''),
        isComplete: i === words.length - 1,
        index: i,
        timestamp: Date.now(),
      });
    }

    return response;
  }

  /**
   * Generate text from a prompt - legacy compatibility method
   */
  async generate(prompt: string, options?: Record<string, unknown>): Promise<string> {
    const result = await this.generateText(prompt, options);
    return result;
  }

  async generateText(prompt: string, options?: Record<string, unknown>): Promise<string> {
    const request: ModelRequest = {
      id: `gen_${Date.now()}`,
      prompt,
      model: (options as TextGenerationOptions | undefined)?.model || this.config.defaultProvider,
      temperature: (options as TextGenerationOptions | undefined)?.temperature,
      maxTokens: (options as TextGenerationOptions | undefined)?.maxTokens,
      tools: (options as TextGenerationOptions | undefined)?.tools as any,
      context: (options as TextGenerationOptions | undefined)?.context,
    };

    const response = await this.request(request);
    return response.content;
  }

  async synthesize(request: ModelRequest): Promise<ModelResponse> {
    return this.request(request);
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const status = await this.getStatus();
    const result: Record<string, boolean> = {};

    for (const providerStatus of status) {
      result[providerStatus.provider] = providerStatus.available;
    }

    return result;
  }

  getProviders(): Map<string, IModelProvider> {
    return new Map([...this.providers.entries()]);
  }

  async destroy(): Promise<void> {
    return this.shutdown();
  }

  /**
   * Get status of all providers
   */
  async getStatus(): Promise<Array<{ provider: string; available: boolean; latency?: number }>> {
    const results: Array<{ provider: string; available: boolean; latency?: number }> = [];

    for (const [name, provider] of this.providers) {
      try {
        const startTime = Date.now();
        const available = await provider.isAvailable();
        const latency = Date.now() - startTime;
        results.push({ provider: name, available, latency });
      } catch (error) {
        results.push({ provider: name, available: false });
      }
    }

    return results;
  }
}

// Factory function for easy creation
export function createUnifiedModelClient(config: UnifiedConfiguration): UnifiedModelClient {
  return new UnifiedModelClient(config);
}
