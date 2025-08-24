/**
 * Dependency Injection Container - Living Spiral Architecture Foundation
 * Resolves circular dependencies through interface abstraction and service registration
 *
 * Council Perspectives Applied:
 * - Architect: Clean separation of concerns with dependency inversion
 * - Maintainer: Easy service registration and lifecycle management
 * - Security Guardian: Controlled service access and initialization
 * - Performance Engineer: Lazy loading and singleton optimization
 * - Explorer: Extensible plugin architecture for new services
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';

// Service lifecycle management
export type ServiceLifecycle = 'transient' | 'singleton' | 'scoped';

// Service factory function type
export type ServiceFactory<T = any> = (container: DependencyContainer) => T | Promise<T>;

// Service registration options
export interface ServiceOptions {
  lifecycle?: ServiceLifecycle;
  lazy?: boolean;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

// Service token for type-safe service registration
export interface ServiceToken<T = any> {
  name: string;
  type?: new (...args: any[]) => T;
}

// Service registration metadata
interface ServiceRegistration<T = any> {
  token: string;
  factory: ServiceFactory<T>;
  options: ServiceOptions;
  instance?: T;
  initialized: boolean;
  dependencies: string[];
}

// Dependency resolution context
interface ResolutionContext {
  path: string[];
  scope: DependencyScope | null;
}

// Scoped dependency management
export class DependencyScope {
  private scopedInstances = new Map<string, any>();
  private parent: DependencyContainer;

  constructor(parent: DependencyContainer) {
    this.parent = parent;
  }

  resolve<T>(token: string | ServiceToken<T>): T {
    const tokenName = typeof token === 'string' ? token : token.name;

    // Check if already resolved in this scope
    if (this.scopedInstances.has(tokenName)) {
      return this.scopedInstances.get(tokenName);
    }

    // Resolve from parent and cache in scope
    const instance = this.parent.resolve(token, { scope: this });
    this.scopedInstances.set(tokenName, instance);
    return instance;
  }

  dispose(): void {
    // Dispose all scoped instances that have dispose methods
    for (const [tokenName, instance] of this.scopedInstances) {
      if (instance && typeof instance.dispose === 'function') {
        try {
          instance.dispose();
        } catch (error) {
          logger.warn(`Error disposing service ${tokenName}:`, error);
        }
      }
    }
    this.scopedInstances.clear();
  }
}

/**
 * Dependency Injection Container Implementation
 * Provides service registration, resolution, and lifecycle management
 */
export class DependencyContainer extends EventEmitter {
  private services = new Map<string, ServiceRegistration>();
  private resolutionStack: string[] = [];
  private initializationOrder: string[] = [];
  private isDisposed = false;

  constructor() {
    super();
    this.setMaxListeners(100); // Allow many service registrations
  }

  /**
   * Register a service with the container
   */
  register<T>(
    token: string | ServiceToken<T>,
    factory: ServiceFactory<T>,
    options: ServiceOptions = {}
  ): void {
    if (this.isDisposed) {
      throw new Error('Cannot register services on disposed container');
    }

    const tokenName = typeof token === 'string' ? token : token.name;

    if (this.services.has(tokenName)) {
      logger.warn(`Service ${tokenName} is already registered. Replacing registration.`);
    }

    const registration: ServiceRegistration<T> = {
      token: tokenName,
      factory,
      options: {
        lifecycle: 'singleton',
        lazy: true,
        dependencies: [],
        ...options,
      },
      initialized: false,
      dependencies: options.dependencies || [],
    };

    this.services.set(tokenName, registration);
    this.emit('serviceRegistered', { token: tokenName, options });

    logger.debug(`Registered service: ${tokenName} (${registration.options.lifecycle})`);
  }

  /**
   * Register a class as a service with automatic dependency injection
   */
  registerClass<T>(
    token: string | ServiceToken<T>,
    constructor: new (...args: any[]) => T,
    dependencies: string[] = [],
    options: ServiceOptions = {}
  ): void {
    const factory: ServiceFactory<T> = container => {
      const resolvedDependencies = dependencies.map(dep => container.resolve(dep));
      return new constructor(...resolvedDependencies);
    };

    this.register(token, factory, {
      ...options,
      dependencies,
    });
  }

  /**
   * Register a value as a singleton service
   */
  registerValue<T>(token: string | ServiceToken<T>, value: T): void {
    const factory: ServiceFactory<T> = () => value;
    this.register(token, factory, { lifecycle: 'singleton', lazy: false });
  }

  /**
   * Resolve a service by token (synchronous)
   */
  resolve<T>(token: string | ServiceToken<T>, context: { scope?: DependencyScope } = {}): T {
    if (this.isDisposed) {
      throw new Error('Cannot resolve services from disposed container');
    }

    const tokenName = typeof token === 'string' ? token : token.name;
    const registration = this.services.get(tokenName);

    if (!registration) {
      throw new Error(`Service not registered: ${tokenName}`);
    }

    // Check for circular dependencies
    if (this.resolutionStack.includes(tokenName)) {
      const cycle = [...this.resolutionStack, tokenName].join(' → ');
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    // Handle different lifecycles - return Promise for async factories
    switch (registration.options.lifecycle) {
      case 'singleton':
        return this.resolveSingletonSync(registration, context);

      case 'scoped':
        if (context.scope) {
          return context.scope.resolve(tokenName);
        }
        // Fall through to transient if no scope provided
        return this.resolveTransientSync(registration, context);

      case 'transient':
        return this.resolveTransientSync(registration, context);

      default:
        throw new Error(`Unknown lifecycle: ${registration.options.lifecycle}`);
    }
  }

  /**
   * Resolve a service asynchronously
   * ENHANCED: Properly handles async factories by using async resolution path
   */
  async resolveAsync<T>(
    token: string | ServiceToken<T>,
    context: { scope?: DependencyScope } = {}
  ): Promise<T> {
    if (this.isDisposed) {
      throw new Error('Cannot resolve services from disposed container');
    }

    const tokenName = typeof token === 'string' ? token : token.name;
    const registration = this.services.get(tokenName);

    if (!registration) {
      throw new Error(`Service not registered: ${tokenName}`);
    }

    // Check for circular dependencies
    if (this.resolutionStack.includes(tokenName)) {
      const cycle = [...this.resolutionStack, tokenName].join(' → ');
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    // Handle different lifecycles using ASYNC resolution path
    switch (registration.options.lifecycle) {
      case 'singleton':
        return await this.resolveSingleton(registration, context);

      case 'scoped':
        if (context.scope) {
          const result = context.scope.resolve(tokenName);
          return result && typeof (result as any).then === 'function'
            ? await (result as any)
            : (result as T);
        }
        // Fall through to transient if no scope provided
        return await this.resolveTransient(registration, context);

      case 'transient':
        return await this.resolveTransient(registration, context);

      default:
        throw new Error(`Unknown lifecycle: ${registration.options.lifecycle}`);
    }
  }

  /**
   * Create a new dependency scope
   */
  createScope(): DependencyScope {
    return new DependencyScope(this);
  }

  /**
   * Check if a service is registered
   */
  isRegistered(token: string | ServiceToken): boolean {
    const tokenName = typeof token === 'string' ? token : token.name;
    return this.services.has(tokenName);
  }

  /**
   * Get all registered service names
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get service registration metadata
   */
  getServiceInfo(token: string | ServiceToken): ServiceOptions | null {
    const tokenName = typeof token === 'string' ? token : token.name;
    const registration = this.services.get(tokenName);
    return registration ? registration.options : null;
  }

  /**
   * Initialize all eager services
   */
  async initializeEagerServices(): Promise<void> {
    const eagerServices = Array.from(this.services.entries())
      .filter(([_, reg]) => !reg.options.lazy)
      .map(([token, _]) => token);

    for (const token of eagerServices) {
      try {
        await this.resolveAsync(token);
        this.initializationOrder.push(token);
      } catch (error) {
        logger.error(`Failed to initialize eager service ${token}:`, error);
        throw error;
      }
    }

    this.emit('eagerServicesInitialized', { services: eagerServices });
  }

  /**
   * Dispose the container and all singleton instances
   */
  async dispose(): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    this.emit('disposing');

    // Dispose singleton instances in reverse initialization order
    const disposalOrder = [...this.initializationOrder].reverse();

    for (const token of disposalOrder) {
      const registration = this.services.get(token);

      if (registration?.instance && typeof registration.instance.dispose === 'function') {
        try {
          await registration.instance.dispose();
        } catch (error) {
          logger.warn(`Error disposing service ${token}:`, error);
        }
      }
    }

    this.services.clear();
    this.resolutionStack = [];
    this.initializationOrder = [];
    this.removeAllListeners();

    this.emit('disposed');
  }

  /**
   * Resolve singleton service (synchronous - may return Promise for async factories)
   */
  private resolveSingletonSync<T>(
    registration: ServiceRegistration<T>,
    context: { scope?: DependencyScope }
  ): T {
    if (registration.instance) {
      return registration.instance;
    }

    registration.instance = this.createInstanceSync(registration, context);

    if (!this.initializationOrder.includes(registration.token)) {
      this.initializationOrder.push(registration.token);
    }

    return registration.instance;
  }

  /**
   * Resolve singleton service (async)
   */
  private async resolveSingleton<T>(
    registration: ServiceRegistration<T>,
    context: { scope?: DependencyScope }
  ): Promise<T> {
    if (registration.instance) {
      // If instance is a Promise, await it
      if (registration.instance && typeof (registration.instance as any).then === 'function') {
        return await (registration.instance as unknown as Promise<T>);
      }
      return registration.instance;
    }

    registration.instance = await this.createInstance(registration, context);

    if (!this.initializationOrder.includes(registration.token)) {
      this.initializationOrder.push(registration.token);
    }

    return registration.instance;
  }

  /**
   * Resolve transient service (synchronous)
   */
  private resolveTransientSync<T>(
    registration: ServiceRegistration<T>,
    context: { scope?: DependencyScope }
  ): T {
    return this.createInstanceSync(registration, context);
  }

  /**
   * Resolve transient service (async)
   */
  private async resolveTransient<T>(
    registration: ServiceRegistration<T>,
    context: { scope?: DependencyScope }
  ): Promise<T> {
    return await this.createInstance(registration, context);
  }

  /**
   * Create service instance using factory (synchronous - may return Promise)
   */
  private createInstanceSync<T>(
    registration: ServiceRegistration<T>,
    context: { scope?: DependencyScope }
  ): T {
    this.resolutionStack.push(registration.token);

    try {
      const instance = registration.factory(this);
      registration.initialized = true;

      this.emit('serviceResolved', {
        token: registration.token,
        lifecycle: registration.options.lifecycle,
      });

      return instance as T;
    } catch (error) {
      logger.error(`Error creating instance for service ${registration.token}:`, error);
      throw error;
    } finally {
      this.resolutionStack.pop();
    }
  }

  /**
   * Create service instance using factory (async)
   * FIXED: Now properly handles async factory functions that return Promises
   */
  private async createInstance<T>(
    registration: ServiceRegistration<T>,
    context: { scope?: DependencyScope }
  ): Promise<T> {
    this.resolutionStack.push(registration.token);

    try {
      const instance = registration.factory(this);

      // FIX: Properly await async factories that return Promises
      const resolvedInstance =
        instance && typeof (instance as any).then === 'function'
          ? await (instance as any)
          : instance;

      registration.initialized = true;

      this.emit('serviceResolved', {
        token: registration.token,
        lifecycle: registration.options.lifecycle,
      });

      return resolvedInstance as T;
    } catch (error) {
      logger.error(`Error creating instance for service ${registration.token}:`, error);
      throw error;
    } finally {
      this.resolutionStack.pop();
    }
  }

  /**
   * Validate service dependency graph for circular dependencies
   */
  validateDependencyGraph(): { isValid: boolean; cycles: string[] } {
    const cycles: string[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (token: string, path: string[] = []): boolean => {
      if (recursionStack.has(token)) {
        cycles.push([...path, token].join(' → '));
        return true;
      }

      if (visited.has(token)) {
        return false;
      }

      visited.add(token);
      recursionStack.add(token);

      const registration = this.services.get(token);
      if (registration) {
        for (const dependency of registration.dependencies) {
          if (hasCycle(dependency, [...path, token])) {
            return true;
          }
        }
      }

      recursionStack.delete(token);
      return false;
    };

    for (const token of this.services.keys()) {
      if (!visited.has(token)) {
        hasCycle(token);
      }
    }

    return {
      isValid: cycles.length === 0,
      cycles: cycles,
    };
  }
}

/**
 * Global dependency container instance
 */
export const globalContainer = new DependencyContainer();

/**
 * Service token factory for type-safe registration
 */
export function createServiceToken<T>(name: string): ServiceToken<T> {
  return { name };
}

/**
 * Decorator for automatic service registration
 */
export function Injectable(token: string, options: ServiceOptions = {}) {
  return function <T extends new (...args: any[]) => any>(constructor: T) {
    // This would be used with a metadata reflection system
    // For now, it serves as documentation
    return constructor;
  };
}
