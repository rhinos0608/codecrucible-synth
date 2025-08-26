import { EventEmitter } from 'events';
import { logger } from '../core/logger.js';
import {
  ProjectContext,
  ModelRequest,
  ModelResponse,
  UnifiedClientConfig as BaseUnifiedClientConfig,
  MetricsData,
  ComplexityAnalysis,
  TaskType,
} from '../core/types.js';
import { IModelClient, StreamToken } from '../core/interfaces/client-interfaces.js';
import { SecurityValidator } from '../infrastructure/security/security-validator.js';
import { PerformanceMonitor } from '../utils/performance.js';

import { IntegratedCodeCrucibleSystem } from './integrated-system.js';

import { HardwareAwareModelSelector } from '../infrastructure/performance/hardware-aware-model-selector.js';
import { getGlobalToolIntegration } from '../infrastructure/tools/tool-integration.js';
import { getGlobalEnhancedToolIntegration } from '../infrastructure/tools/enhanced-tool-integration.js';
import { ActiveProcessManager, ActiveProcess } from '../infrastructure/performance/active-process-manager.js';
import { ProviderManager } from './provider-manager.js';
import { getErrorMessage, toError } from '../utils/error-utils.js';
import { createHash } from 'crypto';
import { StreamingManager } from '../core/streaming/streaming-manager.js';
import { CacheCoordinator, ICacheCoordinator } from '../core/caching/cache-coordinator.js';
import {
  VoiceSynthesisManager,
  IVoiceSynthesisManager,
} from '../core/voice-system/voice-synthesis-manager.js';
import {
  ProviderSelectionStrategy,
  IProviderSelectionStrategy,
  ExecutionMode as StrategyExecutionMode,
} from '../core/providers/provider-selection-strategy.js';
import {
  RequestExecutionManager,
  IRequestExecutionManager,
} from '../core/execution/request-execution-manager.js';
import { HealthStatusManager, IHealthStatusManager } from '../core/health/health-status-manager.js';
import {
  ConfigurationManager,
  IConfigurationManager,
} from '../core/config/configuration-manager.js';
import {
  RequestProcessingCoreManager,
  IRequestProcessingCoreManager,
} from '../core/processing/request-processing-core-manager.js';
import {
  ModelManagementManager,
  IModelManagementManager,
} from '../core/models/model-management-manager.js';
import {
  ResourceCleanupManager,
  IResourceCleanupManager,
} from '../core/cleanup/resource-cleanup-manager.js';
import {
  StreamProcessingManager,
  IStreamProcessingManager,
} from '../infrastructure/streaming/stream-processing-manager.js';
import { RequestHandler } from './request-handler.js';

export class UnifiedModelClient extends EventEmitter implements IModelClient {
  private config: any;
  private providerManager: ProviderManager;
  private performanceMonitor: PerformanceMonitor;
  private securityValidator: SecurityValidator;
  private activeRequests: Map<string, any> = new Map();
  private requestQueue: Array<any> = [];
  private isProcessingQueue = false;
  private cacheCoordinator: ICacheCoordinator;
  private hardwareSelector: HardwareAwareModelSelector;
  private processManager: ActiveProcessManager;
  private currentModel: string | null = null;
  private readonly HEALTH_CACHE_TTL = 30000; // 30 seconds
  private streamingManager: StreamingManager;
  private integratedSystem: IntegratedCodeCrucibleSystem | null = null;
  private hybridRouter: any | null = null;
  private lastMemoryWarningTime = 0;
  private abortController: AbortController;
  private isShuttingDown = false;
  private initialized = false;
  private voiceSynthesisManager: IVoiceSynthesisManager;
  private providerSelectionStrategy: IProviderSelectionStrategy;
  private requestExecutionManager: IRequestExecutionManager;
  private healthStatusManager: IHealthStatusManager;
  private configurationManager: IConfigurationManager;
  private requestProcessingCoreManager: IRequestProcessingCoreManager;
  private modelManagementManager: IModelManagementManager;
  private resourceCleanupManager: IResourceCleanupManager;
  private streamProcessingManager: StreamProcessingManager;
  private requestHandler: RequestHandler;

  constructor(config: any, injectedDependencies?: any) {
    super();
    this.setMaxListeners(50);
    this.abortController = new AbortController();
    this.configurationManager =
      injectedDependencies?.configurationManager || new ConfigurationManager();
    this.config = {
      endpoint: 'http://localhost:11434',
      ...this.getDefaultConfig(),
      ...config,
    };
    this.performanceMonitor = injectedDependencies?.performanceMonitor || new PerformanceMonitor();
    this.securityValidator =
      injectedDependencies?.securityValidator ||
      new SecurityValidator({
        allowExecutableCommands: !this.config.security?.enableSandbox,
        maxInputLength: this.config.security?.maxInputLength || 10000,
      });
    this.hardwareSelector = new HardwareAwareModelSelector();
    this.processManager = new ActiveProcessManager();
    this.streamingManager =
      injectedDependencies?.streamingManager || new StreamingManager(config.streaming);

    // Use injected provider repository or create new ProviderManager
    if (injectedDependencies?.providerRepository) {
      // Create a wrapper ProviderManager that uses the injected repository
      this.providerManager = {
        getProviderRepository: () => injectedDependencies.providerRepository,
        getProviders: () => injectedDependencies.providerRepository.getAvailableProviders(),
        initialize: async () => {}, // Already initialized in DI system
        createProvider: async (config: any) => {
          throw new Error('Provider creation not supported with injected repository');
        }, // Not needed when using injected repository
        getProvider: (type: string) => injectedDependencies.providerRepository.getProvider(type),
      } as any; // TypeScript workaround for partial interface implementation
    } else {
      this.providerManager = new ProviderManager();
    }

    this.cacheCoordinator = injectedDependencies?.cacheCoordinator || new CacheCoordinator();
    this.voiceSynthesisManager =
      injectedDependencies?.voiceSynthesisManager ||
      new VoiceSynthesisManager(undefined, async (request: any) => this.processRequest(request));
    this.providerSelectionStrategy =
      injectedDependencies?.providerSelectionStrategy ||
      new ProviderSelectionStrategy(
        {
          fallbackChain: this.config.fallbackChain,
          selectionStrategy: 'balanced',
          timeoutMs: this.config.performanceThresholds?.timeoutMs || 110000, // Optimized for Ollama
          maxRetries: 3,
        },
        this.performanceMonitor
      );
    this.requestExecutionManager =
      injectedDependencies?.requestExecutionManager ||
      new RequestExecutionManager(
        {
          maxConcurrentRequests: this.config.performanceThresholds?.maxConcurrentRequests || 1, // CRITICAL: Ollama rate limiting
          defaultTimeout: this.config.performanceThresholds?.timeoutMs || 110000, // Optimized for Ollama
          complexityTimeouts: {
            simple: 1800000, // 30 minutes - industry standard
            medium: 3600000, // 1 hour - industry standard
            complex: 7200000, // 2 hours - industry standard
          },
          memoryThresholds: {
            low: 100,
            medium: 500,
            high: 1000,
          },
        },
        this.processManager,
        this.providerManager.getProviderRepository()
      );
    this.healthStatusManager =
      injectedDependencies?.healthStatusManager ||
      new HealthStatusManager(
        this.providerManager.getProviderRepository(),
        this.cacheCoordinator,
        this.performanceMonitor,
        {
          healthCheckTimeoutMs: 5000,
          overallTimeoutMs: 15000,
          cacheTtlMs: 30000,
        }
      );
    this.requestProcessingCoreManager =
      injectedDependencies?.requestProcessingCoreManager ||
      new RequestProcessingCoreManager({
        maxConcurrentRequests: this.config.performanceThresholds?.maxConcurrentRequests || 1, // CRITICAL: Ollama rate limiting
        defaultTimeoutMs: this.config.performanceThresholds?.timeoutMs || 180000,
        memoryThresholds: {
          base: 50,
          lengthMultiplier: 0.01,
          complexityMultiplier: 30,
        },
      });
    this.modelManagementManager =
      injectedDependencies?.modelManagementManager ||
      new ModelManagementManager(
        {
          endpoint: this.config.endpoint || 'http://localhost:11434',
          defaultModel: 'llama2',
          requestTimeoutMs: this.config.performanceThresholds?.timeoutMs || 30000,
        },
        this.makeRequest.bind(this),
        this.generate.bind(this)
      );
    this.resourceCleanupManager =
      injectedDependencies?.resourceCleanupManager ||
      new ResourceCleanupManager({
        shutdownTimeoutMs: 10000,
        gracefulShutdown: true,
      });
    this.streamProcessingManager =
      injectedDependencies?.streamProcessingManager ||
      new StreamProcessingManager(
        this.securityValidator,
        this.cacheCoordinator,
        this.streamingManager,
        async (request, context) => this.processRequest(request, context),
        () => this.generateRequestId(),
        {
          validateSecurity: true,
          enableCaching: true,
          requestTimeoutMs: 30000,
        }
      );
    this.requestHandler = new RequestHandler(this);
    this.registerCleanupResources();
    if (injectedDependencies?.hybridRouter) {
      this.hybridRouter = injectedDependencies.hybridRouter;
      logger.info('🚀 Using injected Hybrid LLM Router');
    } else {
      this.initializeHybridRouter();
    }
    this.setupModelSwitchingEvents();
  }

  // IModelClient interface implementation
  async processRequest(request: ModelRequest, context?: ProjectContext): Promise<ModelResponse> {
    return this.requestHandler.processRequest(request, context);
  }

  async streamRequest(
    request: ModelRequest,
    onToken: (token: StreamToken) => void,
    context?: ProjectContext
  ): Promise<ModelResponse> {
    return this.streamProcessingManager.processStreamRequest(request, onToken, context);
  }

  async generateText(prompt: string, options?: any): Promise<string> {
    const request: ModelRequest = {
      prompt,
      ...options,
    };
    const response = await this.processRequest(request);
    return response.content;
  }

  async generateVoiceResponse(prompt: string, voiceId: string, options: any): Promise<any> {
    logger.debug('UnifiedModelClient.generateVoiceResponse called', {
      promptLength: prompt.length,
      voiceId,
      options: { temperature: options.temperature, model: options.model }
    });

    const request: ModelRequest = {
      prompt,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      ...options
    };
    
    const response = await this.processRequest(request);
    logger.debug('UnifiedModelClient.generateVoiceResponse completed', {
      contentLength: response?.content?.length || 0
    });
    
    return response;
  }

  async synthesize(request: ModelRequest): Promise<ModelResponse> {
    // Use voice synthesis to generate a response using multiple perspectives
    const voices = ['explorer', 'developer', 'architect']; // Default voices
    const perspectiveResult = await this.voiceSynthesisManager.synthesizeVoicePerspectives(
      voices,
      request.prompt,
      {
        /* temperature: request.temperature */
      }
    );

    return {
      content: perspectiveResult.content,
      model: request.model || 'multi-voice',
      provider: 'voice-synthesis',
      metadata: {
        tokens: perspectiveResult.content.length / 4, // Rough token estimate
        latency: 0,
        // voices: perspectiveResult.voices // Remove invalid property
      },
    };
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const cachedStatus = this.healthStatusManager.getCachedHealthStatus();
    return cachedStatus || {};
  }

  getProviders(): Map<string, any> {
    return this.providerManager.getProviders();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    // Initialize providers with config
    await this.providerManager.initializeProviders(this.config.providers || []);
    await this.integratedSystem?.initialize();
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    await this.resourceCleanupManager.shutdown();
  }

  async destroy(): Promise<void> {
    await this.shutdown();
  }

  // Additional methods needed by existing code
  async checkHealth(): Promise<Record<string, boolean>> {
    return this.healthCheck();
  }

  async getAllAvailableModels(): Promise<any[]> {
    return this.modelManagementManager.getAllAvailableModels();
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    return this.processRequest(request);
  }

  getCurrentModel(): string | null {
    return this.currentModel;
  }

  getProcessManager(): ActiveProcessManager {
    return this.processManager;
  }

  getRequestExecutionManager(): IRequestExecutionManager {
    return this.requestExecutionManager;
  }

  getRequestProcessingCoreManager(): IRequestProcessingCoreManager {
    return this.requestProcessingCoreManager;
  }

  getActiveRequests(): Map<string, any> {
    return this.activeRequests;
  }

  getProviderManager(): ProviderManager {
    return this.providerManager;
  }

  async initializeProvidersAsync(): Promise<void> {
    await this.providerManager.initialize();
  }

  generateRequestId(): string {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }

  // Missing methods that RequestHandler and other components expect
  getCacheCoordinator(): ICacheCoordinator {
    return this.cacheCoordinator;
  }

  getHybridRouter(): any {
    return this.hybridRouter;
  }

  getStreamingManager(): StreamingManager {
    return this.streamingManager;
  }

  getSecurityValidator(): SecurityValidator {
    return this.securityValidator;
  }

  inferTaskType(prompt: string): string {
    // Simple task type inference based on keywords
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes('analyze') || lowerPrompt.includes('review')) return 'analysis';
    if (lowerPrompt.includes('create') || lowerPrompt.includes('generate')) return 'generation';
    if (lowerPrompt.includes('refactor') || lowerPrompt.includes('improve')) return 'refactoring';
    if (lowerPrompt.includes('debug') || lowerPrompt.includes('fix')) return 'debug';
    if (lowerPrompt.includes('document') || lowerPrompt.includes('explain')) return 'documentation';
    if (lowerPrompt.includes('test') || lowerPrompt.includes('unit')) return 'testing';
    return 'general';
  }

  analyzeComplexity(request: ModelRequest): any {
    const complexity = {
      score: Math.min(request.prompt.length / 100, 10),
      level:
        request.prompt.length < 200
          ? 'simple'
          : request.prompt.length < 1000
            ? 'medium'
            : 'complex',
      factors: {
        promptLength: request.prompt.length,
        hasContext: !!request.context,
        hasFiles: !!request.files?.length,
        fileCount: request.files?.length || 0,
      },
    };
    return complexity;
  }

  convertToTaskMetrics(request: ModelRequest): any {
    return {
      complexity: this.analyzeComplexity(request),
      taskType: this.inferTaskType(request.prompt),
      estimatedTokens: Math.ceil(request.prompt.length / 4),
    };
  }

  modelSupportsTools(model?: string): boolean {
    // Most modern models support function calling
    return true;
  }

  assessQuality(response: string): number {
    // Simple quality assessment based on response characteristics
    if (!response || response.length < 10) return 0.1;
    if (response.length > 100 && response.includes('\n')) return 0.8;
    return 0.6;
  }

  determineExecutionStrategy(request: ModelRequest): any {
    const complexity = this.analyzeComplexity(request);

    // Create proper ExecutionStrategy object
    const strategy = {
      mode: 'balanced',
      provider: 'ollama',
      timeout: 30000,
      complexity: complexity.level,
    };

    // Industry-standard timeouts for CLI AI agents (30min - 2 hours)
    if (complexity.level === 'simple') {
      strategy.mode = 'fast';
      strategy.timeout = 1800000; // 30 minutes - industry standard for simple tasks
    } else if (complexity.level === 'complex') {
      strategy.mode = 'thorough';
      strategy.timeout = 7200000; // 2 hours - industry standard for complex analysis
    } else {
      strategy.timeout = 3600000; // 1 hour - industry standard for balanced tasks
    }

    // Adjust based on request characteristics (but keep long-running)
    if (request.stream) {
      strategy.mode = 'fast';
      strategy.timeout = Math.max(strategy.timeout, 1800000); // Minimum 30 minutes
    }

    if (request.tools && request.tools.length > 0) {
      strategy.provider = 'lm-studio';
      strategy.timeout = Math.max(strategy.timeout, 3600000); // Minimum 1 hour for tool usage
    }

    return strategy;
  }

  estimateMemoryUsage(request: ModelRequest): number {
    return Math.max(50, request.prompt.length * 0.01);
  }

  getProcessType(request: ModelRequest): string {
    return this.inferTaskType(request.prompt);
  }

  getRequestPriority(request: ModelRequest): 'low' | 'medium' | 'high' {
    const complexity = this.analyzeComplexity(request);
    if (complexity.level === 'simple') return 'low';
    if (complexity.level === 'medium') return 'medium';
    return 'high';
  }

  async getProjectStructure(projectRoot: string): Promise<string> {
    // Simple project structure analysis
    try {
      const { readdir, stat } = await import('fs/promises');
      const { join } = await import('path');

      const items = await readdir(projectRoot);
      const structure = [];

      for (const item of items.slice(0, 20)) {
        // Limit to first 20 items
        try {
          const itemPath = join(projectRoot, item);
          const stats = await stat(itemPath);
          const type = stats.isDirectory() ? 'directory' : 'file';
          structure.push(`${type}: ${item}`);
        } catch (error) {
          // Skip items we can't read
        }
      }

      return `Project structure for ${projectRoot}:\n${structure.join('\n')}`;
    } catch (error) {
      return `Unable to read project structure: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  async makeRequest(request: any): Promise<any> {
    return this.requestHandler.makeRequest(request);
  }

  getConfig(): any {
    return this.config;
  }

  getDefaultConfig(): any {
    return {
      providers: [
        {
          type: 'auto',
          endpoint: 'http://localhost:11434',
        },
      ],
      executionMode: 'auto' as const,
      fallbackChain: ['ollama', 'lm-studio', 'auto'] as const,
      performanceThresholds: {
        fastModeMaxTokens: 1000,
        timeoutMs: 30000,
        maxConcurrentRequests: 3,
      },
      security: {
        enableSandbox: true,
        maxInputLength: 10000,
        allowedCommands: ['npm', 'node', 'git'],
      },
    };
  }

  // Property getters for backward compatibility
  get providerRepository(): any {
    return this.providerManager;
  }

  private registerCleanupResources(): void {
    // Setup cleanup handlers
    process.on('SIGINT', async () => this.shutdown());
    process.on('SIGTERM', async () => this.shutdown());
  }

  private initializeHybridRouter(): void {
    // Initialize hybrid router if available
    try {
      // This would be set up with actual hybrid router if available
      this.hybridRouter = null;
    } catch (error) {
      logger.warn('Hybrid router not available, continuing without it');
    }
  }

  private setupModelSwitchingEvents(): void {
    this.on('modelSwitch', (newModel: string) => {
      this.currentModel = newModel;
      logger.info(`Switched to model: ${newModel}`);
    });
  }
}
