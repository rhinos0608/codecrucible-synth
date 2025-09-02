/**
 * System Bootstrap - Dependency Injection Orchestration
 * Breaks circular dependencies through controlled initialization
 *
 * Living Spiral Council Applied:
 * - Architect: Proper dependency order and lifecycle management
 * - Maintainer: Clear initialization phases and error handling
 * - Security Guardian: Secure service initialization and validation
 * - Performance Engineer: Optimized startup sequence and lazy loading
 * - Explorer: Extensible bootstrap process for new services
 */

import { DependencyContainer } from './dependency-container.js';
import {
  CLIENT_TOKEN,
  CLIENT_CONFIG_TOKEN,
  PROVIDER_REPOSITORY_TOKEN,
  HYBRID_ROUTER_TOKEN,
  CACHE_COORDINATOR_TOKEN,
  SECURITY_VALIDATOR_TOKEN,
  STREAMING_MANAGER_TOKEN,
  PERFORMANCE_MONITOR_TOKEN,
  SYNTHESIS_COORDINATOR_TOKEN,
  LOGGER_TOKEN,
  CONFIG_MANAGER_TOKEN,
} from './service-tokens.js';
import { logger } from '../logger.js';
import { IModelClient } from '../interfaces/client-interfaces.js';
import { startupOptimizer } from '../performance/startup-optimizer.js';

/**
 * Bootstrap configuration
 */
export interface BootstrapConfig {
  skipValidation?: boolean;
  enablePerformanceMonitoring?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  initializationTimeout?: number;
  environment?: 'development' | 'test' | 'production';
}

/**
 * Bootstrap result
 */
export interface BootstrapResult {
  container: DependencyContainer;
  client: IModelClient;
  initializationTime: number;
  servicesInitialized: string[];
  warnings: string[];
  errors: string[];
}

/**
 * System Bootstrap Implementation
 * Orchestrates dependency injection to break circular dependencies
 */
export class SystemBootstrap {
  private container: DependencyContainer;
  private config: BootstrapConfig;
  private initializationStartTime: number = 0;
  private warnings: string[] = [];
  private errors: string[] = [];
  private isBootstrapped: boolean = false;

  constructor(config: BootstrapConfig = {}) {
    this.config = {
      skipValidation: false,
      enablePerformanceMonitoring: true,
      logLevel: 'info',
      initializationTimeout: 30000, // 30 seconds
      environment: 'development',
      ...config,
    };

    this.container = new DependencyContainer();
  }

  /**
   * Bootstrap the entire system
   */
  async bootstrap(): Promise<BootstrapResult> {
    if (this.isBootstrapped) {
      logger.debug('System already bootstrapped, skipping...');
      return {
        container: this.container,
        client: await this.container.resolveAsync<IModelClient>(CLIENT_TOKEN),
        initializationTime: 0,
        servicesInitialized: this.container.getRegisteredServices(),
        warnings: this.warnings,
        errors: this.errors,
      };
    }

    this.initializationStartTime = Date.now();

    try {
      logger.info('🚀 Starting optimized system bootstrap...');

      // Register startup optimization tasks
      startupOptimizer.reset();
      this.registerStartupTasks();

      // Execute optimized startup
      const startupResult = await startupOptimizer.executeOptimizedStartup();
      logger.info(
        `🚀 Startup optimization completed: ${startupResult.successCount}/${startupResult.totalTime}ms`
      );

      // Phase 1: Core infrastructure (no dependencies)
      await this.initializeCoreInfrastructure();

      // Phase 2: Configuration and utilities
      await this.initializeConfiguration();

      // Phase 3: Performance and monitoring
      await this.initializeMonitoring();

      // Phase 4: Security services
      await this.initializeSecurity();

      // Phase 5: Cache services
      await this.initializeCache();

      // Phase 6: Provider services
      await this.initializeProviders();

      // Phase 7: Routing services
      await this.initializeRouting();

      // Phase 8: Streaming services
      await this.initializeStreaming();

      // Phase 9: Main client (depends on all above)
      await this.initializeClient();

      // Phase 10: Application layer services (depends on client)
      await this.initializeSynthesisCoordinator();

      // Phase 11: Validation and health checks (deferred for faster startup)
      if (!this.config.skipValidation && this.config.environment !== 'development') {
        await this.validateSystemHealth();
      } else {
        logger.debug('Skipping system validation for faster startup');
      }

      const client = await this.container.resolveAsync<IModelClient>(CLIENT_TOKEN);
      const initializationTime = Date.now() - this.initializationStartTime;

      logger.info(`✅ System bootstrap completed in ${initializationTime}ms`);

      // Mark as successfully bootstrapped
      this.isBootstrapped = true;

      // Generate startup performance report
      const startupAnalytics = startupOptimizer.getStartupAnalytics();
      const recommendations = startupOptimizer.getOptimizationRecommendations();

      if (recommendations.length > 0) {
        logger.info('📊 Startup optimization recommendations:');
        recommendations.forEach((rec: string) => logger.info(`   - ${rec}`));
      }

      return {
        container: this.container,
        client,
        initializationTime,
        servicesInitialized: this.container.getRegisteredServices(),
        warnings: this.warnings,
        errors: this.errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errors.push(`Bootstrap failed: ${errorMessage}`);
      logger.error('❌ System bootstrap failed:', error);
      throw error;
    }
  }

  /**
   * Phase 1: Core infrastructure services (no dependencies)
   */
  private async initializeCoreInfrastructure(): Promise<void> {
    logger.debug('Phase 1: Initializing core infrastructure...');

    // Logger (already available as singleton)
    this.container.registerValue(LOGGER_TOKEN, logger);

    // Basic utilities
    this.container.register('error-utils', async () => import('../../utils/error-utils.js'), {
      lifecycle: 'singleton',
      lazy: true,
    });
  }

  /**
   * Phase 2: Configuration services
   */
  private async initializeConfiguration(): Promise<void> {
    logger.debug('Phase 2: Initializing configuration...');

    // Configuration manager
    this.container.register(
      CONFIG_MANAGER_TOKEN,
      async () => {
        const { ConfigManager } = await import('../../config/config-manager.js');
        return new ConfigManager();
      },
      { lifecycle: 'singleton', lazy: true }
    );

    // Client configuration (using factory pattern to avoid circular deps)
    this.container.register(
      CLIENT_CONFIG_TOKEN,
      container => {
        // Return default configuration without importing client.ts
        return {
          providers: [
            { type: 'ollama', endpoint: 'http://localhost:11434', timeout: 30000 }, // 30s timeout - appropriate for local operations
            { type: 'lm-studio', endpoint: 'ws://localhost:8080', timeout: 30000 }, // WebSocket endpoint for LM Studio SDK
          ],
          executionMode: 'auto',
          fallbackChain: ['ollama', 'lm-studio'],
          performanceThresholds: {
            maxResponseTime: 30000,
            maxConcurrentRequests: 3,
          },
          security: {
            enableSandbox: true,
            maxInputLength: 50000,
          },
        };
      },
      { lifecycle: 'singleton' }
    );
  }

  /**
   * Phase 3: Performance monitoring
   */
  private async initializeMonitoring(): Promise<void> {
    logger.debug('Phase 3: Initializing performance monitoring...');

    this.container.register(
      PERFORMANCE_MONITOR_TOKEN,
      async () => {
        const { PerformanceMonitor } = await import('../../utils/performance.js');
        return new PerformanceMonitor();
      },
      { lifecycle: 'singleton', lazy: true }
    );
  }

  /**
   * Phase 4: Security services
   */
  private async initializeSecurity(): Promise<void> {
    logger.debug('Phase 4: Initializing security services...');

    this.container.register(
      SECURITY_VALIDATOR_TOKEN,
      async container => {
        const { SecurityValidator } = await import(
          '../../infrastructure/security/security-validator.js'
        );
        const config = container.resolve(CLIENT_CONFIG_TOKEN);
        return new SecurityValidator(config.security);
      },
      {
        lifecycle: 'singleton',
        dependencies: [CLIENT_CONFIG_TOKEN.name],
        lazy: true,
      }
    );
  }

  /**
   * Phase 5: Cache services
   */
  private async initializeCache(): Promise<void> {
    logger.debug('Phase 5: Initializing cache services...');

    this.container.register(
      CACHE_COORDINATOR_TOKEN,
      async () => {
        const { CacheCoordinator } = await import('../caching/cache-coordinator.js');
        const coordinator = new CacheCoordinator();
        return coordinator;
      },
      { lifecycle: 'singleton' }
    );
  }

  /**
   * Phase 6: Provider services
   */
  private async initializeProviders(): Promise<void> {
    logger.debug('Phase 6: Initializing provider services...');

    this.container.register(
      PROVIDER_REPOSITORY_TOKEN,
      async container => {
        const { ProviderRepository } = await import('../providers/provider-repository.js');
        const config = container.resolve(CLIENT_CONFIG_TOKEN);
        const providerRepository = new ProviderRepository();

        // Initialize providers immediately during bootstrap for reliable operation
        // This ensures providers are available when needed for AI generation
        await providerRepository.initialize(config.providers || []);

        return providerRepository;
      },
      {
        lifecycle: 'singleton',
        lazy: false, // Remove lazy loading to ensure immediate initialization
        dependencies: [CLIENT_CONFIG_TOKEN.name],
      }
    );
  }

  /**
   * Phase 7: Routing services
   */
  private async initializeRouting(): Promise<void> {
    logger.debug('Phase 7: Initializing routing services...');

    this.container.register(
      HYBRID_ROUTER_TOKEN,
      async container => {
        const { HybridLLMRouter } = await import('../hybrid/hybrid-llm-router.js');
        const config = container.resolve(CLIENT_CONFIG_TOKEN);

        // Create hybrid config without circular dependencies
        const hybridConfig = {
          lmStudio: {
            endpoint: 'ws://localhost:8080',
            enabled: true,
            models: ['codellama:7b-instruct', 'qwen2.5-coder:7b'],
            maxConcurrent: 2,
            strengths: ['speed', 'lightweight', 'efficiency'],
          },
          ollama: {
            endpoint: 'http://localhost:11434',
            enabled: true,
            models: ['codellama:34b', 'qwen2.5:72b', 'deepseek-coder:8b'],
            maxConcurrent: 1,
            strengths: ['analysis', 'reasoning', 'security', 'architecture'],
          },
          routing: {
            defaultProvider: 'auto' as 'auto' | 'lm-studio' | 'ollama',
            escalationThreshold: 0.7,
            confidenceScoring: true,
            learningEnabled: true,
          },
        };

        return new HybridLLMRouter(hybridConfig);
      },
      {
        lifecycle: 'singleton',
        dependencies: [CLIENT_CONFIG_TOKEN.name],
        lazy: true,
      }
    );
  }

  /**
   * Phase 8: Streaming services
   */
  private async initializeStreaming(): Promise<void> {
    logger.debug('Phase 8: Initializing streaming services...');

    this.container.register(
      STREAMING_MANAGER_TOKEN,
      async container => {
        const { StreamingManager } = await import('../streaming/streaming-manager.js');
        const config = container.resolve(CLIENT_CONFIG_TOKEN);
        return new StreamingManager(config.streaming);
      },
      {
        lifecycle: 'singleton',
        dependencies: [CLIENT_CONFIG_TOKEN.name],
        lazy: true,
      }
    );
  }

  /**
   * Phase 9: Main client (depends on all above services)
   */
  private async initializeClient(): Promise<void> {
    logger.debug('Phase 9: Initializing main client...');

    this.container.register(
      CLIENT_TOKEN,
      async container => {
        // Import client class dynamically to avoid circular imports
        const { UnifiedModelClient } = await import('../../application/services/model-client.js');

        // Resolve all dependencies (await async ones properly)
        const config = container.resolve(CLIENT_CONFIG_TOKEN);
        const providerRepository = await container.resolveAsync(PROVIDER_REPOSITORY_TOKEN);
        const hybridRouter = await container.resolveAsync(HYBRID_ROUTER_TOKEN);
        const cacheCoordinator = await container.resolveAsync(CACHE_COORDINATOR_TOKEN);
        const securityValidator = await container.resolveAsync(SECURITY_VALIDATOR_TOKEN);
        const streamingManager = await container.resolveAsync(STREAMING_MANAGER_TOKEN);
        const performanceMonitor = await container.resolveAsync(PERFORMANCE_MONITOR_TOKEN);

        // Create client with all dependencies injected using new DI constructor
        const client = new UnifiedModelClient({
          adapters: [],
          defaultProvider: config.defaultProvider,
          providers: config.providers,
          fallbackStrategy: config.fallbackStrategy,
          timeout: config.timeout,
          retryAttempts: config.retryAttempts,
          enableCaching: config.enableCaching,
          enableMetrics: config.enableMetrics,
          requestProcessor: await container.resolveAsync('RequestProcessor'),
          responseHandler: await container.resolveAsync('ResponseHandler'),
          streamingManager: streamingManager,
        });

        return client;
      },
      {
        lifecycle: 'singleton',
        dependencies: [
          CLIENT_CONFIG_TOKEN.name,
          PROVIDER_REPOSITORY_TOKEN.name,
          HYBRID_ROUTER_TOKEN.name,
          CACHE_COORDINATOR_TOKEN.name,
          SECURITY_VALIDATOR_TOKEN.name,
          STREAMING_MANAGER_TOKEN.name,
          PERFORMANCE_MONITOR_TOKEN.name,
        ],
        lazy: true,
      }
    );
  }

  /**
   * Phase 10: Application layer services
   */
  private async initializeSynthesisCoordinator(): Promise<void> {
    logger.debug('Phase 10: Initializing SynthesisCoordinator...');

    this.container.register(
      SYNTHESIS_COORDINATOR_TOKEN,
      async container => {
        const { SynthesisCoordinator } = await import('../application/synthesis-coordinator.js');
        return new SynthesisCoordinator(container);
      },
      {
        lifecycle: 'singleton',
        dependencies: [
          CLIENT_TOKEN.name,
          HYBRID_ROUTER_TOKEN.name,
          CACHE_COORDINATOR_TOKEN.name,
          SECURITY_VALIDATOR_TOKEN.name,
          STREAMING_MANAGER_TOKEN.name,
          PERFORMANCE_MONITOR_TOKEN.name,
        ],
        lazy: true,
      }
    );
  }

  /**
   * Phase 11: System validation
   */
  private async validateSystemHealth(): Promise<void> {
    logger.debug('Phase 11: Validating system health...');

    // Validate dependency graph
    const validation = this.container.validateDependencyGraph();
    if (!validation.isValid) {
      const error = `Circular dependencies detected: ${validation.cycles.join(', ')}`;
      this.errors.push(error);
      throw new Error(error);
    }

    // Initialize eager services
    await this.container.initializeEagerServices();

    // Basic health check
    try {
      const client = this.container.resolve<IModelClient>(CLIENT_TOKEN);
      await client.initialize();
      logger.info('✅ Client initialization successful');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.warnings.push(`Client initialization warning: ${errorMessage}`);
      logger.warn('⚠️ Client initialization had issues:', error);
    }
  }

  /**
   * Get the dependency container
   */
  getContainer(): DependencyContainer {
    return this.container;
  }

  /**
   * Register startup optimization tasks
   */
  private registerStartupTasks(): void {
    // Critical path tasks
    startupOptimizer.registerTask({
      name: 'core_infrastructure',
      priority: 'critical',
      timeout: 5000,
      task: async () => await this.initializeCoreInfrastructure(),
    });

    startupOptimizer.registerTask({
      name: 'configuration',
      priority: 'critical',
      timeout: 5000,
      task: async () => await this.initializeConfiguration(),
    });

    // High priority parallel tasks
    startupOptimizer.registerTask({
      name: 'security_services',
      priority: 'high',
      timeout: 10000,
      task: async () => await this.initializeSecurity(),
    });

    startupOptimizer.registerTask({
      name: 'cache_services',
      priority: 'high',
      timeout: 10000,
      task: async () => await this.initializeCache(),
    });

    startupOptimizer.registerTask({
      name: 'monitoring_services',
      priority: 'high',
      timeout: 10000,
      task: async () => await this.initializeMonitoring(),
    });

    // Medium priority tasks
    startupOptimizer.registerTask({
      name: 'provider_services',
      priority: 'medium',
      timeout: 15000,
      task: async () => await this.initializeProviders(),
    });

    startupOptimizer.registerTask({
      name: 'routing_services',
      priority: 'medium',
      timeout: 15000,
      task: async () => await this.initializeRouting(),
    });

    startupOptimizer.registerTask({
      name: 'streaming_services',
      priority: 'medium',
      timeout: 15000,
      task: async () => await this.initializeStreaming(),
    });

    // Low priority (can fail without blocking)
    startupOptimizer.registerTask({
      name: 'client_initialization',
      priority: 'low',
      timeout: 20000,
      task: async () => await this.initializeClient(),
    });

    startupOptimizer.registerTask({
      name: 'synthesis_coordinator',
      priority: 'low',
      timeout: 20000,
      task: async () => await this.initializeSynthesisCoordinator(),
    });
  }

  /**
   * Shutdown the system
   */
  async shutdown(): Promise<void> {
    logger.info('🛑 Shutting down system...');
    await this.container.dispose();
    logger.info('✅ System shutdown completed');
  }
}

/**
 * Create and bootstrap the system
 */
export async function createSystem(config?: BootstrapConfig): Promise<BootstrapResult> {
  const bootstrap = new SystemBootstrap(config);
  return await bootstrap.bootstrap();
}

/**
 * Create system for testing with minimal dependencies
 */
export async function createTestSystem(): Promise<BootstrapResult> {
  return await createSystem({
    skipValidation: true,
    enablePerformanceMonitoring: false,
    logLevel: 'error',
    environment: 'test',
  });
}
