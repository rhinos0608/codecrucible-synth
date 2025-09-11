/**
 * Provider Interfaces - Production Implementation
 * Comprehensive provider interface definitions for extensible provider system
 */

export enum ProviderStatus {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error',
  SHUTTING_DOWN = 'shutting_down',
  SHUTDOWN = 'shutdown',
}

export interface ProviderHealthCheck {
  isHealthy: boolean;
  lastCheckTime: number;
  errorCount: number;
  averageResponseTime: number;
  details?: Record<string, unknown>;
}

export interface IProvider {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly type: 'rust' | 'node' | 'python' | 'external';
  readonly capabilities: ProviderCapability[];

  initialize: () => Promise<void>;
  shutdown: () => Promise<void>;
  isAvailable: () => boolean;
  getStatus: () => ProviderStatus;
  getHealthCheck: () => Promise<ProviderHealthCheck>;

  // Lifecycle events
  onStatusChange?: (status: ProviderStatus) => void;
  onError?: (error: Readonly<Error>) => void;
  onHealthCheckFailed?: (details: unknown) => void;
}

export interface IRustProvider extends IProvider {
  executeRustFunction: (functionName: string, args: ReadonlyArray<unknown>) => Promise<unknown>;
  loadRustModule: (modulePath: string) => Promise<void>;
  getModuleInfo: (moduleName: string) => Promise<unknown>;
}

export interface ProviderMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  uptime: number;
  errorRate: number;
  lastRequestTime?: number;
}

export interface IProviderManager {
  registerProvider: (provider: Readonly<IProvider>) => Promise<void>;
  unregisterProvider: (id: string) => Promise<boolean>;
  getProvider: (id: string) => IProvider | undefined;
  listProviders: () => IProvider[];
  listProvidersByType: (type: string) => IProvider[];
  listProvidersByStatus: (status: ProviderStatus) => IProvider[];

  initializeAll: () => Promise<void>;
  initializeProvider: (id: string) => Promise<void>;
  shutdownAll: () => Promise<void>;
  shutdownProvider: (id: string) => Promise<void>;
  restartProvider: (id: string) => Promise<void>;

  // Health monitoring
  healthCheckAll: () => Promise<Map<string, ProviderHealthCheck>>;
  healthCheck: (id: string) => Promise<ProviderHealthCheck | undefined>;

  // Metrics
  getProviderMetrics: (id: string) => ProviderMetrics | undefined;
  getAllMetrics: () => Map<string, ProviderMetrics>;

  // Events
  on: (
    event:
      | 'provider-registered'
      | 'provider-unregistered'
      | 'provider-status-changed'
      | 'provider-error',
    callback: (data: Readonly<unknown>) => void
  ) => void;
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: 'rust' | 'node' | 'python' | 'external';
  version?: string;
  config: Record<string, unknown>;
  enabled: boolean;
  priority?: number; // Higher numbers get priority
  retryCount?: number;
  timeout?: number;
  healthCheckInterval?: number;
}

export interface ProviderCapability {
  name: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
  returnType: string;
}

export class ProviderError extends Error {
  public constructor(
    message: string,
    public readonly providerId: string,
    public readonly operation: string,
    public readonly originalError?: Readonly<Error>
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class ProviderClient implements IProviderManager {
  private readonly providers: Map<string, IProvider> = new Map();
  private readonly metrics: Map<string, ProviderMetrics> = new Map();
  private readonly healthChecks: Map<string, ProviderHealthCheck> = new Map();
  private readonly eventListeners: Map<string, Array<(data: Readonly<unknown>) => void>> =
    new Map();
  private readonly healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  public constructor(private readonly config: ReadonlyArray<ProviderConfig>) {
    // Initialize event listener maps
    this.eventListeners.set('provider-registered', []);
    this.eventListeners.set('provider-unregistered', []);
    this.eventListeners.set('provider-status-changed', []);
    this.eventListeners.set('provider-error', []);
  }

  public initialize(): void {
    // Initialize all configured providers
    for (const config of this.config) {
      if (config.enabled) {
        try {
          this.initializeProviderFromConfig(config);
        } catch (error) {
          console.error(`Failed to initialize provider ${config.id}:`, error);
        }
      }
    }
  }

  public async registerProvider(provider: Readonly<IProvider>): Promise<void> {
    if (this.providers.has(provider.id)) {
      throw new ProviderError(
        `Provider ${provider.id} is already registered`,
        provider.id,
        'register'
      );
    }

    // Initialize metrics
    this.metrics.set(provider.id, {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      uptime: 0,
      errorRate: 0,
    });

    // Set up lifecycle callbacks
    if (provider.onStatusChange) {
      const originalCallback = provider.onStatusChange;
      // Register a listener that wraps the original callback and emits the event
      this.on('provider-status-changed', (data: Readonly<unknown>) => {
        const eventData = data as Readonly<{ providerId: string; status: ProviderStatus }>;
        if (eventData.providerId === provider.id) {
          originalCallback(eventData.status);
        }
      });
    }

    if (provider.onError) {
      const originalCallback = provider.onError;
      // Register a listener that wraps the original callback and emits the event
      this.on('provider-error', (data: Readonly<unknown>) => {
        const eventData = data as Readonly<{ providerId: string; error: Readonly<Error> }>;
        if (eventData.providerId === provider.id) {
          originalCallback(eventData.error);
        }
      });
    }

    this.providers.set(provider.id, provider);

    // Start health check monitoring
    this.startHealthCheckMonitoring(provider.id);

    this.emit('provider-registered', { providerId: provider.id, provider });
  }

  public async unregisterProvider(id: string): Promise<boolean> {
    const provider = this.providers.get(id);
    if (!provider) {
      return false;
    }

    try {
      await this.shutdownProvider(id);
      this.providers.delete(id);
      this.metrics.delete(id);
      this.healthChecks.delete(id);

      // Stop health check monitoring
      const healthCheckInterval = this.healthCheckIntervals.get(id);
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        this.healthCheckIntervals.delete(id);
      }

      this.emit('provider-unregistered', { providerId: id });
      return true;
    } catch (error) {
      throw new ProviderError(
        `Failed to unregister provider ${id}`,
        id,
        'unregister',
        error as Error
      );
    }
  }

  public getProvider(id: string): IProvider | undefined {
    return this.providers.get(id);
  }

  public listProviders(): IProvider[] {
    return Array.from(this.providers.values());
  }

  public listProvidersByType(type: Readonly<string>): IProvider[] {
    return this.listProviders().filter((p: Readonly<IProvider>) => p.type === type);
  }

  public listProvidersByStatus(status: Readonly<ProviderStatus>): IProvider[] {
    return this.listProviders().filter((p: Readonly<IProvider>) => p.getStatus() === status);
  }

  public async initializeAll(): Promise<void> {
    const initPromises = Array.from(this.providers.values()).map(
      async (provider: Readonly<IProvider>) => {
        try {
          await provider.initialize();
        } catch (error) {
          throw new ProviderError(
            `Failed to initialize provider ${provider.id}`,
            provider.id,
            'initialize',
            error as Error
          );
        }
      }
    );

    await Promise.allSettled(initPromises);
  }

  public async initializeProvider(id: string): Promise<void> {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new ProviderError(`Provider ${id} not found`, id, 'initialize');
    }

    const startTime = Date.now();
    try {
      await provider.initialize();
      this.updateMetrics(id, startTime, true);
    } catch (error) {
      this.updateMetrics(id, startTime, false);
      throw new ProviderError(
        `Failed to initialize provider ${id}`,
        id,
        'initialize',
        error as Error
      );
    }
  }

  public async shutdownAll(): Promise<void> {
    const shutdownPromises = Array.from(this.providers.values()).map(
      async (provider: Readonly<IProvider>) => {
        try {
          await provider.shutdown();
        } catch (error) {
          console.error(`Error shutting down provider ${provider.id}:`, error);
        }
      }
    );

    await Promise.allSettled(shutdownPromises);

    // Clear all health check intervals
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();
  }

  public async shutdownProvider(id: string): Promise<void> {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new ProviderError(`Provider ${id} not found`, id, 'shutdown');
    }

    try {
      await provider.shutdown();
    } catch (error) {
      throw new ProviderError(`Failed to shutdown provider ${id}`, id, 'shutdown', error as Error);
    }
  }

  public async restartProvider(id: string): Promise<void> {
    await this.shutdownProvider(id);
    await this.initializeProvider(id);
  }

  public async healthCheckAll(): Promise<Map<string, ProviderHealthCheck>> {
    const results = new Map<string, ProviderHealthCheck>();

    const checkPromises = Array.from(this.providers.entries()).map(
      async ([id, provider]: readonly [string, Readonly<IProvider>]) => {
        try {
          const healthCheck = await provider.getHealthCheck();
          results.set(id, healthCheck);
          this.healthChecks.set(id, healthCheck);
        } catch (error) {
          const failedCheck: ProviderHealthCheck = {
            isHealthy: false,
            lastCheckTime: Date.now(),
            errorCount: (this.healthChecks.get(id)?.errorCount ?? 0) + 1,
            averageResponseTime: 0,
            details: { error: error instanceof Error ? error.message : 'Unknown error' },
          };
          results.set(id, failedCheck);
          this.healthChecks.set(id, failedCheck);
        }
      }
    );

    await Promise.allSettled(checkPromises);
    return results;
  }

  public async healthCheck(id: string): Promise<ProviderHealthCheck | undefined> {
    const provider = this.providers.get(id);
    if (!provider) {
      return undefined;
    }

    try {
      const healthCheck = await provider.getHealthCheck();
      this.healthChecks.set(id, healthCheck);
      return healthCheck;
    } catch (error) {
      const failedCheck: ProviderHealthCheck = {
        isHealthy: false,
        lastCheckTime: Date.now(),
        errorCount: (this.healthChecks.get(id)?.errorCount ?? 0) + 1,
        averageResponseTime: 0,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
      this.healthChecks.set(id, failedCheck);
      return failedCheck;
    }
  }

  public getProviderMetrics(id: string): ProviderMetrics | undefined {
    return this.metrics.get(id);
  }

  public getAllMetrics(): Map<string, ProviderMetrics> {
    return new Map(this.metrics);
  }

  public on(
    event:
      | 'provider-registered'
      | 'provider-unregistered'
      | 'provider-status-changed'
      | 'provider-error',
    callback: (data: Readonly<unknown>) => void
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.push(callback);
    }
  }

  public async executeProviderMethod(
    providerId: string,
    method: string,
    args: ReadonlyArray<unknown>
  ): Promise<unknown> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new ProviderError(`Provider ${providerId} not found`, providerId, method);
    }

    if (!provider.isAvailable()) {
      throw new ProviderError(`Provider ${providerId} is not available`, providerId, method);
    }

    const startTime = Date.now();
    try {
      // Use type assertion and runtime check for method existence and callability
      const fn = (provider as unknown as Record<string, unknown>)[method];
      if (typeof fn !== 'function') {
        throw new ProviderError(
          `Method ${method} does not exist on provider ${providerId}`,
          providerId,
          method
        );
      }
      const result = await (fn as (...args: ReadonlyArray<unknown>) => unknown)(...args);
      this.updateMetrics(providerId, startTime, true);
      return result;
    } catch (error) {
      this.updateMetrics(providerId, startTime, false);
      throw new ProviderError(
        `Provider ${providerId} method ${method} failed`,
        providerId,
        method,
        error as Error
      );
    }
  }

  private initializeProviderFromConfig(config: Readonly<ProviderConfig>): void {
    // This would be implemented based on the specific provider factory system
    // For now, this is a placeholder that would create providers based on config
    console.log(`Would initialize provider ${config.id} of type ${config.type}`);
  }

  private startHealthCheckMonitoring(providerId: Readonly<string>): void {
    const config = this.config.find((c: Readonly<ProviderConfig>) => c.id === providerId);
    const interval = config?.healthCheckInterval ?? 30000; // Default 30 seconds

    const healthCheckInterval = setInterval(() => {
      void this.healthCheck(providerId);
    }, interval);

    this.healthCheckIntervals.set(providerId, healthCheckInterval);
  }

  private updateMetrics(providerId: string, startTime: number, success: boolean): void {
    const metrics = this.metrics.get(providerId);
    if (!metrics) return;

    const responseTime = Date.now() - startTime;
    const totalRequests = metrics.totalRequests + 1;

    metrics.totalRequests = totalRequests;
    metrics.averageResponseTime =
      (metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
    metrics.lastRequestTime = Date.now();

    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    metrics.errorRate = (metrics.failedRequests / totalRequests) * 100;
  }

  private emit(event: string, data: Readonly<unknown>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}
