/**
 * RuntimeContext
 * Central aggregated context passed explicitly (rather than via mutable globals)
 * to reduce hidden coupling and improve test isolation.
 *
 * This is an initial, incremental introduction – existing global access patterns
 * remain for backward compatibility. Over time, consumers should prefer
 * injecting this object over importing singletons or using global setters.
 */
import { IEventBus } from '../../domain/interfaces/event-bus.js';
import {
  unifiedResourceCoordinator,
  UnifiedResourceCoordinator,
} from '../../infrastructure/performance/unified-resource-coordinator.js';
import { UnifiedSecurityValidator } from '../../domain/services/unified-security-validator.js';
import { UnifiedConfigurationManager } from '../../domain/config/config-manager.js';

export interface RuntimeContext {
  eventBus: IEventBus;
  resourceCoordinator: UnifiedResourceCoordinator; // existing singleton wrapped for now
  securityValidator?: UnifiedSecurityValidator;
  configManager?: UnifiedConfigurationManager;
}

export interface CreateRuntimeContextOptions {
  eventBus: IEventBus;
  securityValidator?: UnifiedSecurityValidator;
  configManager?: UnifiedConfigurationManager;
  resourceCoordinator?: UnifiedResourceCoordinator; // allow override for tests
}

export function createRuntimeContext(opts: CreateRuntimeContextOptions): RuntimeContext {
  return {
    eventBus: opts.eventBus,
    resourceCoordinator: opts.resourceCoordinator ?? unifiedResourceCoordinator,
    securityValidator: opts.securityValidator,
    configManager: opts.configManager,
  };
}

/**
 * Helper to create a lightweight test context with a mock / stub event bus.
 * (Can be used by future unit tests without wiring full system.)
 */
export function createTestRuntimeContext(eventBus: IEventBus): RuntimeContext {
  return createRuntimeContext({ eventBus });
}

/**
 * Dispose a runtime context and release underlying resources
 */
export async function disposeRuntimeContext(context: RuntimeContext): Promise<void> {
  // Remove all event listeners to avoid leaks between tests or runs
  context.eventBus.removeAllListeners();

  // Attempt to dispose the resource coordinator if it provides a dispose method
  const coordinator: any = context.resourceCoordinator as any;
  if (typeof coordinator?.dispose === 'function') {
    await coordinator.dispose();
  } else if (typeof coordinator?.removeAllListeners === 'function') {
    coordinator.removeAllListeners();
  }

  // Clean up configuration manager listeners if present
  const configManager: any = context.configManager;
  if (typeof configManager?.removeAllListeners === 'function') {
    configManager.removeAllListeners();
  }
}
