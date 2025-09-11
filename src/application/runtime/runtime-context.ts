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
  UnifiedResourceCoordinator,
  unifiedResourceCoordinator,
} from '../../infrastructure/performance/unified-resource-coordinator.js';
import { UnifiedSecurityValidator } from '../../domain/services/unified-security-validator.js';
import { UnifiedConfigurationManager } from '../../domain/config/config-manager.js';

interface Disposable {
  dispose: () => Promise<void> | void;
}

interface ListenerRemover {
  removeAllListeners: () => void;
}

function isDisposable(value: unknown): value is Disposable {
  return value !== null && typeof (value as Disposable).dispose === 'function';
}

function hasListenerRemover(value: unknown): value is ListenerRemover {
  return value !== null && typeof (value as ListenerRemover).removeAllListeners === 'function';
}

export interface RuntimeContext {
  eventBus: IEventBus;
  resourceCoordinator: UnifiedResourceCoordinator; // existing singleton wrapped for now
  securityValidator?: UnifiedSecurityValidator;
  configManager?: UnifiedConfigurationManager;
  // Optional concrete infrastructure runtime helpers (set by application layer)
  rustBackend?: unknown;
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

export function setConfigManager(
  context: RuntimeContext,
  configManager: UnifiedConfigurationManager
): void {
  context.configManager = configManager;
}

/**
 * Dispose a runtime context and release underlying resources
 */
export async function disposeRuntimeContext(context: RuntimeContext): Promise<void> {
  // Remove all event listeners to avoid leaks between tests or runs
  context.eventBus.removeAllListeners();

  const coordinator = context.resourceCoordinator;
  if (coordinator !== unifiedResourceCoordinator) {
    if (isDisposable(coordinator)) {
      await coordinator.dispose();
    } else if (hasListenerRemover(coordinator)) {
      coordinator.removeAllListeners();
    }
  }

  const { configManager } = context;
  if (configManager && hasListenerRemover(configManager)) {
    configManager.removeAllListeners();
  }
}
