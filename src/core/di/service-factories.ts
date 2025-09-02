/**
 * Service Factories for Unified Dependency Injection
 *
 * PURPOSE: Provide factory implementations for all major services
 * to enable proper dependency injection and eliminate circular dependencies
 *
 * ADDRESSES:
 * - Issue #1: Circular Dependencies (eliminated through proper factory pattern)
 * - Issue #2: Inconsistent Architectural Patterns (standardized factory pattern)
 * - Issue #3: Interface Misalignment (enforced through factory contracts)
 */

import { ServiceFactory, ServiceToken, SERVICE_TOKENS } from './unified-dependency-container.js';
import {
  IConfigurationService,
  ICacheService,
  IMCPService,
  IErrorService,
  IOrchestrationService,
  IModelSelectionService,
  IVoiceOrchestrationService,
  IIntegrationCoordinator,
  IBaseService,
  EnforceContract,
} from '../contracts/service-contracts.js';

// Import actual service implementations
import { UnifiedCacheService } from '../services/unified-cache-service.js';
import { UnifiedConfigService } from '../services/unified-config-service.js';
import { UnifiedErrorService } from '../services/unified-error-service.js';
import { UnifiedMCPConnectionService } from '../services/unified-mcp-connection-service.js';
import { UnifiedOrchestrationService } from '../services/unified-orchestration-service.js';

// Import domain services
import { ModelSelectionService } from '../../domain/services/model-selection-service.js';
import { VoiceOrchestrationService } from '../../domain/services/voice-orchestration-service.js';

// Import enhanced systems
import { IntelligentRoutingCoordinator } from '../routing/intelligent-routing-coordinator.js';
import { VoiceSystemIntegration2025 } from '../../voices/voice-system-integration-2025.js';
// import { EnhancedMCPIntegrationManager } from '../mcp/enhanced-mcp-integration-manager.js';
import { SystemIntegrationCoordinator } from '../integration/system-integration-coordinator.js';

import { logger } from '../logger.js';
import {
  IProviderSelectionStrategy,
  SelectionContext,
  SelectionResult,
  ProviderType,
} from '../providers/provider-selection-strategy.js';
import { PerformanceMonitor } from '../../utils/performance.js';

/**
 * Service Factory Registry
 * Maps service tokens to their factory implementations
 */
export class ServiceFactoryRegistry {
  private static instance: ServiceFactoryRegistry | null = null;
  private factories = new Map<string, ServiceFactory<any>>();

  private constructor() {
    this.registerBuiltInFactories();
  }

  static getInstance(): ServiceFactoryRegistry {
    if (!ServiceFactoryRegistry.instance) {
      ServiceFactoryRegistry.instance = new ServiceFactoryRegistry();
    }
    return ServiceFactoryRegistry.instance;
  }

  getFactory<T extends IBaseService>(token: ServiceToken<T>): ServiceFactory<T> | null {
    return this.factories.get(token.name) || null;
  }

  registerFactory<T extends IBaseService>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>
  ): void {
    this.factories.set(token.name, factory);
  }

  private registerBuiltInFactories(): void {
    // Core services
    this.factories.set(SERVICE_TOKENS.CACHE_SERVICE.name, new CacheServiceFactory());
    this.factories.set(SERVICE_TOKENS.CONFIG_SERVICE.name, new ConfigServiceFactory());
    this.factories.set(SERVICE_TOKENS.ERROR_SERVICE.name, new ErrorServiceFactory());
    this.factories.set(SERVICE_TOKENS.MCP_SERVICE.name, new MCPServiceFactory());
    this.factories.set(
      SERVICE_TOKENS.ORCHESTRATION_SERVICE.name,
      new OrchestrationServiceFactory()
    );

    // Domain services
    this.factories.set(
      SERVICE_TOKENS.MODEL_SELECTION_SERVICE.name,
      new ModelSelectionServiceFactory()
    );
    this.factories.set(
      SERVICE_TOKENS.VOICE_ORCHESTRATION_SERVICE.name,
      new VoiceOrchestrationServiceFactory()
    );

    // Enhanced systems
    this.factories.set(
      SERVICE_TOKENS.INTELLIGENT_ROUTING_COORDINATOR.name,
      new IntelligentRoutingCoordinatorFactory()
    );
    this.factories.set(
      SERVICE_TOKENS.VOICE_SYSTEM_INTEGRATION.name,
      new VoiceSystemIntegrationFactory()
    );
    // this.factories.set(SERVICE_TOKENS.ENHANCED_MCP_INTEGRATION.name, new EnhancedMCPIntegrationFactory());

    // Integration coordinator
    this.factories.set(
      SERVICE_TOKENS.SYSTEM_INTEGRATION_COORDINATOR.name,
      new SystemIntegrationCoordinatorFactory()
    );

    logger.info('📦 Registered built-in service factories');
  }
}

/**
 * Cache Service Factory
 */
class CacheServiceFactory implements ServiceFactory<ICacheService> {
  async create(dependencies: Map<string, any>, config?: any): Promise<ICacheService> {
    logger.info('🏗️ Creating UnifiedCacheService');

    const cacheConfig = config || {
      maxSize: 1000,
      defaultTTL: 300000, // 5 minutes
      checkInterval: 60000, // 1 minute
      enableCompression: true,
      enableEncryption: false,
      layers: {
        memory: {
          enabled: true,
          maxSize: 1000,
          algorithm: 'lru',
        },
        redis: {
          enabled: false,
          host: 'localhost',
          port: 6379,
          db: 0,
          keyPrefix: 'codecrucible:',
        },
      },
    };

    const service = new UnifiedCacheService(cacheConfig);

    // Validate service implements contract
    if (!this.validateContract(service)) {
      throw new Error('UnifiedCacheService does not implement ICacheService contract');
    }

    return service;
  }

  private validateContract(service: any): service is ICacheService {
    return (
      typeof service.get === 'function' &&
      typeof service.set === 'function' &&
      typeof service.delete === 'function' &&
      typeof service.clear === 'function' &&
      typeof service.getCacheStats === 'function' &&
      typeof service.getHealth === 'function' &&
      typeof service.getMetrics === 'function'
    );
  }
}

/**
 * Configuration Service Factory
 */
class ConfigServiceFactory implements ServiceFactory<IConfigurationService> {
  async create(dependencies: Map<string, any>, config?: any): Promise<IConfigurationService> {
    logger.info('🏗️ Creating UnifiedConfigService');

    // Use the singleton config service or create a new one
    const { getUnifiedConfigurationManager } = await import('../../domain/services/unified-configuration-manager.js');
    const service = await getUnifiedConfigurationManager();

    if (!this.validateContract(service)) {
      throw new Error('UnifiedConfigService does not implement IConfigurationService contract');
    }

    return service as unknown as IConfigurationService;
  }

  private validateContract(service: any): service is IConfigurationService {
    return (
      typeof service.loadConfig === 'function' &&
      typeof service.getHealth === 'function' &&
      typeof service.getMetrics === 'function'
    );
  }
}

/**
 * Error Service Factory
 */
class ErrorServiceFactory implements ServiceFactory<IErrorService> {
  async create(dependencies: Map<string, any>, config?: any): Promise<IErrorService> {
    logger.info('🏗️ Creating UnifiedErrorService');

    const service = UnifiedErrorService.getInstance(config);

    if (!this.validateContract(service)) {
      throw new Error('UnifiedErrorService does not implement IErrorService contract');
    }

    return service as unknown as IErrorService;
  }

  private validateContract(service: any): service is IErrorService {
    return (
      typeof service.handleError === 'function' &&
      typeof service.attemptRecovery === 'function' &&
      typeof service.getErrorStats === 'function' &&
      typeof service.getHealth === 'function' &&
      typeof service.getMetrics === 'function'
    );
  }
}

/**
 * MCP Service Factory
 */
class MCPServiceFactory implements ServiceFactory<IMCPService> {
  async create(dependencies: Map<string, any>, config?: any): Promise<IMCPService> {
    logger.info('🏗️ Creating UnifiedMCPConnectionService');

    const service = UnifiedMCPConnectionService.getInstance();

    if (!this.validateContract(service)) {
      throw new Error('UnifiedMCPConnectionService does not implement IMCPService contract');
    }

    return service as unknown as IMCPService;
  }

  private validateContract(service: any): service is IMCPService {
    return (
      typeof service.connect === 'function' &&
      typeof service.disconnect === 'function' &&
      typeof service.listTools === 'function' &&
      typeof service.executeTool === 'function' &&
      typeof service.getConnectionStatus === 'function' &&
      typeof service.getHealth === 'function' &&
      typeof service.getMetrics === 'function'
    );
  }
}

/**
 * Orchestration Service Factory
 */
class OrchestrationServiceFactory implements ServiceFactory<IOrchestrationService> {
  async create(dependencies: Map<string, any>, config?: any): Promise<IOrchestrationService> {
    logger.info('🏗️ Creating UnifiedOrchestrationService');

    const service = UnifiedOrchestrationService.getInstance();

    if (!this.validateContract(service)) {
      throw new Error(
        'UnifiedOrchestrationService does not implement IOrchestrationService contract'
      );
    }

    return service as unknown as IOrchestrationService;
  }

  private validateContract(service: any): service is IOrchestrationService {
    return (
      typeof service.orchestrateTools === 'function' &&
      typeof service.executeWorkflow === 'function' &&
      typeof service.coordinateAgents === 'function' &&
      typeof service.getOptimizationRecommendations === 'function' &&
      typeof service.getHealth === 'function' &&
      typeof service.getMetrics === 'function'
    );
  }
}

/**
 * Model Selection Service Factory
 */
class ModelSelectionServiceFactory implements ServiceFactory<IModelSelectionService> {
  async create(dependencies: Map<string, any>, config?: any): Promise<IModelSelectionService> {
    logger.info('🏗️ Creating ModelSelectionService');

    // ModelSelectionService may need dependencies - check for them
    const configService = dependencies.get(SERVICE_TOKENS.CONFIG_SERVICE.name);

    // Create a mock model repository since we don't have the actual one registered
    const mockModelRepository = {
      findById: async (): Promise<null> => null,
      findByCapability: async (): Promise<any[]> => [],
      getAvailableModels: async (): Promise<any[]> => [],
      validateModel: async (): Promise<boolean> => true,
      findByNameAndProvider: async (): Promise<null> => null,
      findAll: async (): Promise<any[]> => [],
      findByProvider: async (): Promise<any[]> => [],
      findByCapabilities: async (): Promise<any[]> => [],
      findAvailableModels: async (): Promise<any[]> => [],
      findSuitableModels: async (): Promise<any[]> => [],
      save: async (): Promise<void> => {},
      saveAll: async (): Promise<void> => {},
      delete: async (): Promise<void> => {},
      update: async (): Promise<void> => {},
      findBest: async (): Promise<null> => null,
      count: async (): Promise<number> => 0,
      exists: async (): Promise<boolean> => false,
      countAvailable: async (): Promise<number> => 0,
      getModelsByProvider: async (): Promise<Map<string, any>> => new Map(),
    };

    const service = new ModelSelectionService(mockModelRepository);

    if (!this.validateContract(service)) {
      throw new Error('ModelSelectionService does not implement IModelSelectionService contract');
    }

    return service as unknown as IModelSelectionService;
  }

  private validateContract(service: any): service is IModelSelectionService {
    return (
      typeof service.selectModel === 'function' &&
      typeof service.listAvailableModels === 'function' &&
      typeof service.validateModelCapabilities === 'function' &&
      typeof service.getModelPerformanceMetrics === 'function' &&
      typeof service.getHealth === 'function' &&
      typeof service.getMetrics === 'function'
    );
  }
}

/**
 * Voice Orchestration Service Factory
 */
class VoiceOrchestrationServiceFactory implements ServiceFactory<IVoiceOrchestrationService> {
  async create(dependencies: Map<string, any>, config?: any): Promise<IVoiceOrchestrationService> {
    logger.info('🏗️ Creating VoiceOrchestrationService');

    // VoiceOrchestrationService may need model selection dependency
    const modelSelectionService = dependencies.get(SERVICE_TOKENS.MODEL_SELECTION_SERVICE.name);

    // Create a mock voice repository since we don't have the actual one registered
    const mockVoiceRepository = {
      findById: async (): Promise<null> => null,
      findByExpertise: async (): Promise<any[]> => [],
      getAvailableVoices: async (): Promise<any[]> => [],
      validateVoice: async (): Promise<boolean> => true,
      findAll: async (): Promise<any[]> => [],
      findEnabledVoices: async (): Promise<any[]> => [],
      findSuitableVoices: async (): Promise<any[]> => [],
      save: async (): Promise<void> => {},
      saveAll: async (): Promise<void> => {},
      delete: async (): Promise<void> => {},
      deleteById: async (): Promise<void> => {},
      update: async (): Promise<void> => {},
      findBest: async (): Promise<null> => null,
      count: async (): Promise<number> => 0,
      countEnabled: async (): Promise<number> => 0,
      exists: async (): Promise<boolean> => false,
      disable: async (): Promise<void> => {},
    };

    const service = new VoiceOrchestrationService(mockVoiceRepository);

    if (!this.validateContract(service)) {
      throw new Error(
        'VoiceOrchestrationService does not implement IVoiceOrchestrationService contract'
      );
    }

    return service as unknown as IVoiceOrchestrationService;
  }

  private validateContract(service: any): service is IVoiceOrchestrationService {
    return (
      typeof service.selectVoices === 'function' &&
      typeof service.orchestrateMultiVoice === 'function' &&
      typeof service.listAvailableVoices === 'function' &&
      typeof service.getVoiceCapabilities === 'function' &&
      typeof service.getVoicePerformanceMetrics === 'function' &&
      typeof service.getHealth === 'function' &&
      typeof service.getMetrics === 'function'
    );
  }
}

/**
 * Intelligent Routing Coordinator Factory
 */
class IntelligentRoutingCoordinatorFactory implements ServiceFactory<any> {
  async create(dependencies: Map<string, any>, config?: any): Promise<any> {
    logger.info('🏗️ Creating IntelligentRoutingCoordinator');

    // Get required dependencies
    const modelSelectionService = dependencies.get(SERVICE_TOKENS.MODEL_SELECTION_SERVICE.name);
    const voiceOrchestrationService = dependencies.get(
      SERVICE_TOKENS.VOICE_ORCHESTRATION_SERVICE.name
    );

    if (!modelSelectionService || !voiceOrchestrationService) {
      throw new Error(
        'IntelligentRoutingCoordinator requires ModelSelectionService and VoiceOrchestrationService'
      );
    }

    // Create mock dependencies for IntelligentRoutingCoordinator
    const mockProviderStrategy: IProviderSelectionStrategy = {
      selectProvider: (context: SelectionContext): SelectionResult => ({
        provider: 'ollama' as ProviderType,
        reason: 'Mock selection for testing',
        confidence: 0.8,
        fallbackChain: ['ollama', 'lm-studio'] as ProviderType[],
      }),
      createFallbackChain: (
        primaryProvider: ProviderType,
        context: SelectionContext
      ): ProviderType[] => ['ollama', 'lm-studio'] as ProviderType[],
      validateProviderForContext: (provider: ProviderType, context: SelectionContext): boolean =>
        true,
    };

    const mockHybridRouter = {
      config: {} as any,
      taskHistory: new Map(),
      currentLoads: { lmStudio: 0, ollama: 0 },
      routingDecisionCache: new Map(),
      performanceMetrics: new Map(),
      routeTask: async () => ({
        selectedLLM: 'lm-studio' as const,
        confidence: 0.8,
        reasoning: 'mock',
        fallbackStrategy: 'mock',
        estimatedResponseTime: 100,
      }),
      route: async () => ({ provider: 'mock', model: 'mock-model', confidence: 0.8 }),
      // EventEmitter methods
      on: () => {},
      off: () => {},
      emit: () => true,
      setMaxListeners: () => {},
      // Other methods that might be expected
      analyzeTaskComplexity: () => 'low' as any,
      recordTaskPerformance: () => {},
      getRoutingStats: () => ({ totalTasks: 0, routingAccuracy: 0.8 }),
      clearCache: () => {},
      updateConfig: () => {},
    } as any;

    // Create actual PerformanceMonitor instance
    const performanceMonitor = new PerformanceMonitor();

    const service = new IntelligentRoutingCoordinator(
      modelSelectionService,
      voiceOrchestrationService,
      mockProviderStrategy,
      mockHybridRouter,
      performanceMonitor
    );

    // Initialize the service with dependencies if needed
    if (service.initialize) {
      await service.initialize();
    }

    return service;
  }
}

/**
 * Voice System Integration Factory
 */
class VoiceSystemIntegrationFactory implements ServiceFactory<any> {
  async create(dependencies: Map<string, any>, config?: any): Promise<any> {
    logger.info('🏗️ Creating VoiceSystemIntegration2025');

    // Voice system config
    const voiceConfig = config || {
      useOptimizedSystem: true,
      fallbackToLegacy: true,
      enableDynamicSelection: true,
      enableModeOptimization: true,
      enableHierarchicalMemory: true,
      enableAdvancedCoordination: true,
      enablePerformanceAnalytics: true,
      maxConcurrentVoices: 3,
      cacheSize: 100,
      metricsRetentionDays: 30,
      qualityThreshold: 0.7,
      performanceThreshold: 5000,
      costThreshold: 0.1,
      enableLivingSpiralIntegration: true,
      enableHotSwapping: true,
      enableAutoOptimization: true,
    };

    const service = new VoiceSystemIntegration2025(null, voiceConfig);

    // Initialize if method exists
    if (service.initialize) {
      await service.initialize();
    }

    return service;
  }
}

/**
 * System Integration Coordinator Factory
 */
class SystemIntegrationCoordinatorFactory implements ServiceFactory<IIntegrationCoordinator> {
  async create(dependencies: Map<string, any>, config?: any): Promise<IIntegrationCoordinator> {
    logger.info('🏗️ Creating SystemIntegrationCoordinator');

    // This is a singleton, so get the instance
    const service = SystemIntegrationCoordinator.getInstance();

    if (!this.validateContract(service)) {
      throw new Error(
        'SystemIntegrationCoordinator does not implement IIntegrationCoordinator contract'
      );
    }

    return service as unknown as IIntegrationCoordinator;
  }

  private validateContract(service: any): service is IIntegrationCoordinator {
    return (
      typeof service.coordinateRequest === 'function' &&
      typeof service.getSystemsHealth === 'function' &&
      typeof service.acquireResource === 'function' &&
      typeof service.releaseResource === 'function' &&
      typeof service.getHealth === 'function' &&
      typeof service.getMetrics === 'function'
    );
  }
}

// Export the singleton factory registry
export const serviceFactoryRegistry = ServiceFactoryRegistry.getInstance();

// Convenience function to get a factory
export function getServiceFactory<T extends IBaseService>(
  token: ServiceToken<T>
): ServiceFactory<T> | null {
  return serviceFactoryRegistry.getFactory(token);
}

// Factory registration function
export function registerServiceFactory<T extends IBaseService>(
  token: ServiceToken<T>,
  factory: ServiceFactory<T>
): void {
  serviceFactoryRegistry.registerFactory(token, factory);
}
