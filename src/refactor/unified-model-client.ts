
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
import { SecurityValidator, ISecurityValidator } from '../core/security/security-validator.js';
import { PerformanceMonitor } from '../utils/performance.js';

import {
  IntegratedCodeCrucibleSystem,
  IntegratedSystemConfig,
} from './integrated-system.js';

import { HardwareAwareModelSelector } from '../core/performance/hardware-aware-model-selector.js';
import { getGlobalToolIntegration } from '../core/tools/tool-integration.js';
import { getGlobalEnhancedToolIntegration } from '../core/tools/enhanced-tool-integration.js';
import { ActiveProcessManager, ActiveProcess } from '../core/performance/active-process-manager.js';
import { ProviderManager } from './provider-manager.js';
import { getErrorMessage, toError } from '../utils/error-utils.js';
import { createHash } from 'crypto';
import { StreamingManager, IStreamingManager } from '../core/streaming/streaming-manager.js';
import { CacheCoordinator, ICacheCoordinator } from '../core/caching/cache-coordinator.js';
import { VoiceSynthesisManager, IVoiceSynthesisManager } from '../core/voice-system/voice-synthesis-manager.js';
import { ProviderSelectionStrategy, IProviderSelectionStrategy, ExecutionMode as StrategyExecutionMode } from '../core/providers/provider-selection-strategy.js';
import { RequestExecutionManager, IRequestExecutionManager } from '../core/execution/request-execution-manager.js';
import { HealthStatusManager, IHealthStatusManager } from '../core/health/health-status-manager.js';
import { ConfigurationManager, IConfigurationManager } from '../core/config/configuration-manager.js';
import { RequestProcessingCoreManager, IRequestProcessingCoreManager } from '../core/processing/request-processing-core-manager.js';
import { ModelManagementManager, IModelManagementManager } from '../core/models/model-management-manager.js';
import { ResourceCleanupManager, IResourceCleanupManager } from '../core/cleanup/resource-cleanup-manager.js';
import { StreamProcessingManager, IStreamProcessingManager } from '../core/streaming/stream-processing-manager.js';
import { RequestHandler } from './request-handler.js';

export class UnifiedModelClient extends EventEmitter {
  private config: any;
  private providerManager: ProviderManager;
  private performanceMonitor: PerformanceMonitor;
  private securityValidator: ISecurityValidator;
  private activeRequests: Map<string, any> = new Map();
  private requestQueue: Array<any> = [];
  private isProcessingQueue = false;
  private cacheCoordinator: ICacheCoordinator;
  private hardwareSelector: HardwareAwareModelSelector;
  private processManager: ActiveProcessManager;
  private currentModel: string | null = null;
  private readonly HEALTH_CACHE_TTL = 30000; // 30 seconds
  private streamingManager: IStreamingManager;
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
  private streamProcessingManager: IStreamProcessingManager;
  private requestHandler: RequestHandler;

  constructor(config: any, injectedDependencies?: any) {
    super();
    this.setMaxListeners(50);
    this.abortController = new AbortController();
    this.configurationManager = injectedDependencies?.configurationManager || new ConfigurationManager();
    this.config = {
      endpoint: 'http://localhost:11434',
      ...this.getDefaultConfig(),
      ...config,
    };
    this.performanceMonitor = injectedDependencies?.performanceMonitor || new PerformanceMonitor();
    this.securityValidator =
      injectedDependencies?.securityValidator ||
      new SecurityValidator({
        enableSandbox: this.config.security?.enableSandbox,
        maxInputLength: this.config.security?.maxInputLength,
      });
    this.hardwareSelector = new HardwareAwareModelSelector();
    this.processManager = new ActiveProcessManager(this.hardwareSelector);
    this.streamingManager =
      injectedDependencies?.streamingManager || new StreamingManager(config.streaming);
    this.providerManager = new ProviderManager();
    this.cacheCoordinator = injectedDependencies?.cacheCoordinator || new CacheCoordinator();
    this.voiceSynthesisManager = injectedDependencies?.voiceSynthesisManager || new VoiceSynthesisManager(
      undefined, 
      (request: any) => this.processRequest(request)
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
}
