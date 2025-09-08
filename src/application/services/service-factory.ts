/**
 * Service Factory with Runtime Context Integration
 * Replaces global singletons with dependency injection using RuntimeContext
 * Part of architectural debt remediation
 */

import {
  RuntimeContext as BaseRuntimeContext,
  createRuntimeContext,
  disposeRuntimeContext,
  setConfigManager,
} from '../runtime/runtime-context.js';

import { RustExecutionBackend } from '../../infrastructure/execution/rust-executor/index.js';

interface RuntimeContext extends BaseRuntimeContext {
  rustBackend?: RustExecutionBackend;
}
import {
  UnifiedOrchestrationService,
  createUnifiedOrchestrationServiceWithContext,
} from '../../application/services/unified-orchestration-service.js';
import {
  UnifiedConfigurationManager,
  createUnifiedConfigurationManager,
} from '../../domain/config/config-manager.js';
import {
  ConfigurableResourceCoordinator,
  ResourceCoordinatorFactory,
} from '../../infrastructure/performance/configurable-resource-coordinator.js';
import { createLogger } from '../../infrastructure/logging/logger-adapter.js';
import type { ILogger } from '../../domain/interfaces/logger.js';
import { CLIUserInteraction } from '../../infrastructure/user-interaction/cli-user-interaction.js';
import { createEventBus } from '../../infrastructure/messaging/event-bus-factory.js';
import { MetricsCollector } from '../../infrastructure/observability/metrics-collector.js';
import { createUnifiedMetrics } from '../../infrastructure/observability/unified-metrics-adapter.js';
/* (removed duplicate import of RustExecutionBackend) */
import { unifiedToolRegistry } from '../../infrastructure/tools/unified-tool-registry.js';
import { setGlobalToolIntegrationRustBackend } from '../../infrastructure/tools/tool-integration.js';
import { ConcreteWorkflowOrchestrator } from './concrete-workflow-orchestrator.js';
import { StreamingManager } from './orchestrator/streaming-manager.js';
import { ToolExecutionRouter } from './orchestrator/tool-execution-router.js';
import { ProviderCapabilityRegistry } from './provider-capability-registry.js';
import type { IMcpManager } from '../../domain/interfaces/mcp-manager.js';

export interface ServiceFactoryConfig {
  correlationId?: string;
  configFilePath?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  resourceCoordinatorConfig?: {
    maxConcurrentOperations?: number;
    timeoutMs?: number;
    retryAttempts?: number;
  };
}

/**
 * Factory for creating services with proper dependency injection
 * Replaces singleton pattern with RuntimeContext-based dependency management
 */
export class ServiceFactory {
  private runtimeContext: RuntimeContext;
  private configManager?: UnifiedConfigurationManager;
  private resourceCoordinator?: ConfigurableResourceCoordinator;

  public constructor(
    private config: ServiceFactoryConfig = {},
    private logger: ILogger = createLogger('ServiceFactory')
  ) {
    // Observability primitives
    const metrics = new MetricsCollector({ enabled: true, retentionDays: 7, exportInterval: 0, exporters: [] });
    const eventBus = createEventBus({ enableProfiling: true, metrics });

    this.runtimeContext = createRuntimeContext({
      eventBus,
    }) as RuntimeContext;
    // Optionally expose unified metrics on the context in the future
    // (kept local for now to minimize API changes)
    void createUnifiedMetrics(metrics);
    // Initialize Rust execution backend asynchronously and attach to runtime context
    this.ensureRustBackend().catch(err => {
      this.logger.warn('Error initializing RustExecutionBackend in constructor', err);
    });
  }

  /**
   * Create a properly configured UnifiedOrchestrationService
   */
  public async createOrchestrationService(): Promise<UnifiedOrchestrationService> {
    // Ensure dependencies are created
    await this.ensureConfigManager();
    this.ensureResourceCoordinator();
    await this.ensureRustBackend();

    const userInteraction = new CLIUserInteraction();

    if (!this.configManager) {
      throw new Error('Failed to create configuration manager');
    }

    const service = createUnifiedOrchestrationServiceWithContext(
      this.runtimeContext,
      this.configManager,
      userInteraction
    );

    await service.initialize();
    return service;
  }

  /**
   * Create a ConcreteWorkflowOrchestrator with injected dependencies
   */
  public createWorkflowOrchestrator(mcpManager?: IMcpManager): ConcreteWorkflowOrchestrator {
    const streamingManager = new StreamingManager();
    const capabilityRegistry = new ProviderCapabilityRegistry();
    const toolExecutionRouter = new ToolExecutionRouter(
      (mcpManager ?? ({ executeTool: async () => null } as unknown)) as IMcpManager
    );
    return new ConcreteWorkflowOrchestrator(
      streamingManager,
      toolExecutionRouter,
      capabilityRegistry
    );
  }

  /**
   * Create a configuration manager with dependency injection
   */
  public async createConfigurationManager(): Promise<UnifiedConfigurationManager> {
    if (!this.configManager) {
      const { eventBus } = this.runtimeContext;

      this.configManager = await createUnifiedConfigurationManager({
        logger: this.logger,
        configFilePath: this.config.configFilePath,
        eventBus,
      });
      setConfigManager(this.runtimeContext, this.configManager);
    }
    return this.configManager;
  }

  /**
   * Create a resource coordinator with dependency injection
   */
  public createResourceCoordinator(): ConfigurableResourceCoordinator {
    if (!this.resourceCoordinator) {
      this.resourceCoordinator = ResourceCoordinatorFactory.createHighPerformance();

      // Note: RuntimeContext doesn't have setResourceCoordinator,
      // this is just storing for later disposal
    }

    if (!this.resourceCoordinator) {
      throw new Error('Failed to create resource coordinator');
    }

    return this.resourceCoordinator;
  }

  /**
   * Get the runtime context for this factory
   */
  getRuntimeContext(): RuntimeContext {
    return this.runtimeContext;
  }

  /**
   * Cleanup and dispose of all managed resources
   */
  async dispose(): Promise<void> {
    if (this.resourceCoordinator) {
      if (typeof this.resourceCoordinator.dispose === 'function') {
        await this.resourceCoordinator.dispose();
      }
      this.resourceCoordinator = undefined;
    }

    await disposeRuntimeContext(this.runtimeContext);
    this.configManager = undefined;
  }

  // Private helper methods

  private async ensureConfigManager(): Promise<void> {
    if (!this.configManager) {
      await this.createConfigurationManager();
    }
  }

  private ensureResourceCoordinator(): void {
    if (!this.resourceCoordinator) {
      this.createResourceCoordinator();
    }
  }

  private async ensureRustBackend(): Promise<void> {
    try {
      // Attempt to create and initialize the RustExecutionBackend
      const rustBackend = new RustExecutionBackend();
      if (typeof rustBackend.initialize === 'function') {
        await rustBackend.initialize();
      }

      this.runtimeContext.rustBackend = rustBackend;

      // Also expose the backend to the unified tool registry so tool handlers can use it
      try {
        unifiedToolRegistry.setRustBackend(rustBackend);
        // Also set the backend on the global ToolIntegration if present
        setGlobalToolIntegrationRustBackend(rustBackend);
      } catch (e) {
        this.logger?.warn('Failed to set rustBackend on unifiedToolRegistry', e);
      }

      this.logger?.info('RustExecutionBackend initialized and attached to RuntimeContext');
    } catch (err) {
      this.logger?.warn('Failed to create or initialize RustExecutionBackend', err);
      this.logger?.info('RustExecutionBackend not available; TypeScript fallback will be used');
    }
  }
}

/**
 * Convenience factory functions for common service creation patterns
 */

/**
 * Create a fully configured orchestration service for production use
 */
export async function createProductionOrchestrationService(
  config: ServiceFactoryConfig = {}
): Promise<{
  service: UnifiedOrchestrationService;
  factory: ServiceFactory;
}> {
  const factory = new ServiceFactory({
    correlationId: config.correlationId || `prod-${Date.now()}`,
    logLevel: config.logLevel || 'info',
    ...config,
  });

  const service = await factory.createOrchestrationService();

  return { service, factory };
}

/**
 * Create a test-friendly orchestration service with mocked dependencies
 */
export async function createTestOrchestrationService(config: ServiceFactoryConfig = {}): Promise<{
  service: UnifiedOrchestrationService;
  factory: ServiceFactory;
  context: RuntimeContext;
}> {
  const factory = new ServiceFactory({
    correlationId: config.correlationId || `test-${Date.now()}`,
    logLevel: config.logLevel || 'debug',
    ...config,
  });

  const service = await factory.createOrchestrationService();
  const context = factory.getRuntimeContext();

  return { service, factory, context };
}

/**
 * Migration helper: Create service with RuntimeContext for existing code
 */
export async function migrateToRuntimeContext(
  existingService: Readonly<UnifiedOrchestrationService>,
  config: Readonly<ServiceFactoryConfig> = {}
): Promise<{
  newService: UnifiedOrchestrationService;
  factory: ServiceFactory;
  cleanup: () => Promise<void>;
}> {
  const factory = new ServiceFactory({
    correlationId: config.correlationId || `migration-${Date.now()}`,
    ...config,
  });

  const newService = await factory.createOrchestrationService();

  const cleanup = async () => {
    await existingService.shutdown();
    await factory.dispose();
  };

  return { newService, factory, cleanup };
}
