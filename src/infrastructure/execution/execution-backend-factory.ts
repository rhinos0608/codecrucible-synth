import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../logging/logger.js';
import {
  ErrorCategory,
  ErrorFactory,
  ErrorHandler,
  ErrorSeverity,
  ServiceResponse,
} from '../error-handling/structured-error-system.js';
import type { BackendConfig, ExecutionOptions, ExecutionResult } from './execution-types.js';
import { ExecutionBackend } from './base-execution-backend.js';
import { DockerBackend } from './backends/docker-backend.js';
import { E2BBackend } from './backends/e2b-backend.js';
import { LocalE2BBackend } from './backends/local-e2b-backend.js';
import { FirecrackerBackend } from './backends/firecracker-backend.js';
import { PodmanBackend } from './backends/podman-backend.js';
import { LocalProcessBackend } from './backends/local-process-backend.js';

const execAsync = promisify(exec);

export class ExecutionBackendFactory {
  public static create(config: Readonly<BackendConfig>): ExecutionBackend {
    switch (config.type) {
      case 'docker':
        return new DockerBackend(config);
      case 'e2b':
        return new E2BBackend(config);
      case 'local_e2b':
        return new LocalE2BBackend(config);
      case 'local_process':
        return new LocalProcessBackend(config);
      case 'firecracker':
        return new FirecrackerBackend(config);
      case 'podman':
        return new PodmanBackend(config);
      default:
        throw new Error(`Unknown execution backend type: ${String(config.type)}`);
    }
  }

  public static async detectAvailable(): Promise<string[]> {
    const available: string[] = [];
    try {
      await execAsync('docker --version');
      available.push('docker');
    } catch {
      logger.debug('Docker not available');
    }
    try {
      await execAsync('podman --version');
      available.push('podman');
    } catch {
      logger.debug('Podman not available');
    }
    try {
      await execAsync('firecracker --version');
      available.push('firecracker');
    } catch {
      logger.debug('Firecracker not available');
    }
    if (process.env.E2B_API_KEY) {
      available.push('e2b');
    }
    available.push('local_process');
    return available;
  }
}

export class ExecutionManager {
  private readonly backends = new Map<string, ExecutionBackend>();
  private defaultBackend: string;

  public constructor(configs: ReadonlyArray<BackendConfig>, defaultBackend?: string) {
    if (configs.length === 0) {
      throw new Error('At least one execution backend must be configured');
    }
    for (const config of configs) {
      const backend = ExecutionBackendFactory.create(config);
      this.backends.set(config.type, backend);
    }
    this.defaultBackend = defaultBackend ?? configs[0].type;
    logger.info(`Execution manager initialized with ${configs.length} backends`, {
      backends: configs.map((c: Readonly<BackendConfig>) => c.type),
      default: this.defaultBackend,
    });
  }

  public async execute(
    command: string,
    options: Readonly<ExecutionOptions & { backend?: string }> = {}
  ): Promise<ServiceResponse<ExecutionResult>> {
    const backendType = options.backend ?? this.defaultBackend;
    const backend = this.backends.get(backendType);
    if (!backend) {
      return ErrorHandler.createErrorResponse(
        ErrorFactory.createError(
          `Unknown execution backend: ${backendType}`,
          ErrorCategory.CONFIGURATION,
          ErrorSeverity.HIGH,
          {
            userMessage: 'Invalid execution backend specified',
            suggestedActions: [`Use one of: ${Array.from(this.backends.keys()).join(', ')}`],
          }
        )
      );
    }
    return backend.execute(command, options);
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up all execution backends');
    await Promise.all(
      Array.from(this.backends.values()).map(async (backend: Readonly<ExecutionBackend>) =>
        backend.cleanup()
      )
    );
  }

  public getStatus(): { default: string; backends: Record<string, unknown> } {
    const status: { default: string; backends: Record<string, unknown> } = {
      default: this.defaultBackend,
      backends: {},
    };
    for (const [type, backend] of this.backends) {
      status.backends[type] = backend.getStatus();
    }
    return status;
  }

  public setDefaultBackend(type: string): void {
    if (!this.backends.has(type)) {
      throw new Error(`Backend ${type} is not configured`);
    }
    this.defaultBackend = type;
    logger.info(`Default execution backend set to: ${type}`);
  }

  public getAvailableBackends(): string[] {
    return Array.from(this.backends.keys());
  }
}
