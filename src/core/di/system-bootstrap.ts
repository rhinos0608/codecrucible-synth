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
  LOGGER_TOKEN,
  CONFIG_MANAGER_TOKEN,
} from './service-tokens.js';
import { logger } from '../logger.js';
import { IModelClient } from '../interfaces/client-interfaces.js';

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
    this.initializationStartTime = Date.now();

    try {
      logger.info('🚀 Starting system bootstrap...');

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

      // Phase 10: Validation and health checks
      if (!this.config.skipValidation) {
        await this.validateSystemHealth();
      }

      const client = this.container.resolve<IModelClient>(CLIENT_TOKEN);
      const initializationTime = Date.now() - this.initializationStartTime;

      logger.info(`✅ System bootstrap completed in ${initializationTime}ms`);

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
    this.container.register('error-utils', () => import('../../utils/error-utils.js'), {
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
            { type: 'ollama', endpoint: 'http://localhost:11434' },
            { type: 'lm-studio', endpoint: 'http://localhost:1234' },
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
        const { SecurityValidator } = await import('../security/security-validator.js');
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
        return new CacheCoordinator();
      },
      { lifecycle: 'singleton', lazy: true }
    );
  }

  /**
   * Phase 6: Provider services
   */
  private async initializeProviders(): Promise<void> {
    logger.debug('Phase 6: Initializing provider services...');

    this.container.register(
      PROVIDER_REPOSITORY_TOKEN,
      async () => {
        const { ProviderRepository } = await import('../providers/provider-repository.js');
        return new ProviderRepository();
      },
      { lifecycle: 'singleton', lazy: true }
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
            endpoint: 'http://localhost:1234',
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
        const { UnifiedModelClient } = await import('../client.js');

        // Resolve all dependencies
        const config = container.resolve(CLIENT_CONFIG_TOKEN);
        const providerRepository = container.resolve(PROVIDER_REPOSITORY_TOKEN);
        const hybridRouter = container.resolve(HYBRID_ROUTER_TOKEN);
        const cacheCoordinator = container.resolve(CACHE_COORDINATOR_TOKEN);
        const securityValidator = container.resolve(SECURITY_VALIDATOR_TOKEN);
        const streamingManager = container.resolve(STREAMING_MANAGER_TOKEN);
        const performanceMonitor = container.resolve(PERFORMANCE_MONITOR_TOKEN);

        // Create client with all dependencies injected using new DI constructor
        const client = new UnifiedModelClient(config, {
          providerRepository,
          securityValidator,
          streamingManager,
          cacheCoordinator,
          performanceMonitor,
          hybridRouter,
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
   * Phase 10: System validation
   */
  private async validateSystemHealth(): Promise<void> {
    logger.debug('Phase 10: Validating system health...');

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
