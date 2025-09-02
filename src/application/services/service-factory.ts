/**
 * Service Factory with Runtime Context Integration
 * Replaces global singletons with dependency injection using RuntimeContext
 * Part of architectural debt remediation
 */

import { RuntimeContext, createRuntimeContext } from '../runtime/runtime-context.js';
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
import { CLIUserInteraction } from '../../infrastructure/user-interaction/cli-user-interaction.js';
import { EventBus } from '../../infrastructure/messaging/event-bus.js';

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

  constructor(private config: ServiceFactoryConfig = {}) {
    this.runtimeContext = createRuntimeContext({
      eventBus: new EventBus(),
    });
  }

  /**
   * Create a properly configured UnifiedOrchestrationService
   */
  async createOrchestrationService(): Promise<UnifiedOrchestrationService> {
    // Ensure dependencies are created
    await this.ensureConfigManager();
    await this.ensureResourceCoordinator();

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
   * Create a configuration manager with dependency injection
   */
  async createConfigurationManager(): Promise<UnifiedConfigurationManager> {
    if (!this.configManager) {
      const logger = createLogger('ConfigurationManager'); // TODO: Get logger from context
      const eventBus = this.runtimeContext.eventBus;

      this.configManager = await createUnifiedConfigurationManager({
        logger,
        configFilePath: this.config.configFilePath,
        eventBus,
      });
    }
    return this.configManager;
  }

  /**
   * Create a resource coordinator with dependency injection
   */
  async createResourceCoordinator(): Promise<ConfigurableResourceCoordinator> {
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
      // ConfigurableResourceCoordinator doesn't have shutdown method in current implementation
      // Just clean up reference
      this.resourceCoordinator = undefined;
    }

    // TODO: Implement proper cleanup for RuntimeContext
    // await this.runtimeContext.dispose();
  }

  // Private helper methods

  private async ensureConfigManager(): Promise<void> {
    if (!this.configManager) {
      await this.createConfigurationManager();
    }
  }

  private async ensureResourceCoordinator(): Promise<void> {
    if (!this.resourceCoordinator) {
      await this.createResourceCoordinator();
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
  existingService: UnifiedOrchestrationService,
  config: ServiceFactoryConfig = {}
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
