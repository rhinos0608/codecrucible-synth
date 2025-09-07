import { createLogger } from '../../infrastructure/logging/logger-adapter.js';
import type { RuntimeContext } from '../runtime/runtime-context.js';
import { EventCoordinator } from './event-coordinator.js';
import { ExecutionMonitor } from './execution-monitor.js';
import { ErrorRecovery } from './error-recovery.js';
import { WorkflowEngine } from './workflow-engine.js';
import { TaskScheduler } from './task-scheduler.js';
import { ResourceAllocator } from './resource-allocator.js';
import { StateManager } from './state-manager.js';
import { DependencyResolver, type DependencyHandler } from './dependency-resolver.js';
import type { OrchestrationRequest, OrchestrationResponse } from './orchestration-types.js';

/**
 * Slim orchestrator that composes workflow modules and exposes high-level
 * orchestration APIs.
 */
export class UnifiedOrchestrationService {
  private readonly logger = createLogger('UnifiedOrchestrationService');

  public constructor(
    private readonly engine: WorkflowEngine,
    private readonly dependencies: DependencyResolver
  ) {}

  public async initialize(): Promise<void> {
    this.logger.info('UnifiedOrchestrationService initialized');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('UnifiedOrchestrationService shutting down');
  }

  public async processRequest(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    return this.engine.execute(request);
  }

  public registerPlugin(name: string, handler: DependencyHandler): void {
    this.dependencies.register(name, handler);
  }

  public async executePluginCommand(name: string, ...args: unknown[]): Promise<unknown> {
    const handler = this.dependencies.resolve(name);
    if (!handler) {
      throw new Error(`Plugin command not found: ${name}`);
    }
    return handler(...args);
  }
}

/**
 * Factory to create a unified orchestration service from runtime context.
 */
export function createUnifiedOrchestrationServiceWithContext(
  _context: RuntimeContext
): UnifiedOrchestrationService {
  const events = new EventCoordinator();
  const scheduler = new TaskScheduler();
  const resources = new ResourceAllocator();
  const state = new StateManager();
  const monitor = new ExecutionMonitor(events);
  const recovery = new ErrorRecovery(events);
  const dependencies = new DependencyResolver();
  const engine = new WorkflowEngine({
    scheduler,
    resources,
    state,
    events,
    monitor,
    recovery,
  });

  return new UnifiedOrchestrationService(engine, dependencies);
}

export type { OrchestrationRequest, OrchestrationResponse } from './orchestration-types.js';
