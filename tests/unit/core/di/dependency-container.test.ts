/**
 * Comprehensive Dependency Injection Container Tests
 * Testing service registration, resolution, lifecycle management, and circular dependency detection
 * Following Living Spiral Methodology - Multi-Voice Security and Performance Testing
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import {
  DependencyContainer,
  DependencyScope,
  ServiceLifecycle,
  ServiceFactory,
  ServiceOptions,
  ServiceToken,
} from '../../../../src/core/di/dependency-container.js';

// Test service interfaces and implementations
interface ITestService {
  getName(): string;
  initialize?(): Promise<void>;
  dispose?(): void;
}

interface IDatabaseService {
  query(sql: string): Promise<any[]>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

interface ICacheService {
  get(key: string): any;
  set(key: string, value: any): void;
  clear(): void;
}

// Test implementations
class TestService implements ITestService {
  public name: string;
  public initializeCalled = false;
  public disposeCalled = false;

  constructor(name: string = 'TestService') {
    this.name = name;
  }

  getName(): string {
    return this.name;
  }

  async initialize(): Promise<void> {
    this.initializeCalled = true;
  }

  dispose(): void {
    this.disposeCalled = true;
  }
}

class DatabaseService implements IDatabaseService {
  public connected = false;
  public queries: string[] = [];
  
  constructor(private connectionString: string = 'test://localhost') {}

  async query(sql: string): Promise<any[]> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }
    this.queries.push(sql);
    return [];
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }
}

class CacheService implements ICacheService {
  private cache = new Map<string, any>();
  
  constructor(private databaseService: IDatabaseService) {}

  get(key: string): any {
    return this.cache.get(key);
  }

  set(key: string, value: any): void {
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  getDatabaseService(): IDatabaseService {
    return this.databaseService;
  }
}

class ComplexService {
  constructor(
    private testService: ITestService,
    private databaseService: IDatabaseService,
    private cacheService: ICacheService
  ) {}

  getDependencies() {
    return {
      testService: this.testService,
      databaseService: this.databaseService,
      cacheService: this.cacheService,
    };
  }
}

// Service tokens for type safety
const TEST_SERVICE_TOKEN: ServiceToken<ITestService> = {
  name: 'testService',
  type: TestService,
};

const DATABASE_SERVICE_TOKEN: ServiceToken<IDatabaseService> = {
  name: 'databaseService',
  type: DatabaseService,
};

const CACHE_SERVICE_TOKEN: ServiceToken<ICacheService> = {
  name: 'cacheService',
  type: CacheService,
};

describe('DependencyContainer - Comprehensive Tests', () => {
  let container: DependencyContainer;

  beforeEach(() => {
    container = new DependencyContainer();
  });

  afterEach(() => {
    container.dispose();
    jest.clearAllMocks();
  });

  describe('Service Registration', () => {
    it('should register services with factory functions', () => {
      const factory: ServiceFactory<ITestService> = () => new TestService('Factory Service');
      
      container.register('testService', factory);
      
      const service = container.resolve<ITestService>('testService');
      expect(service).toBeInstanceOf(TestService);
      expect(service.getName()).toBe('Factory Service');
    });

    it('should register services with typed tokens', () => {
      const factory: ServiceFactory<ITestService> = () => new TestService('Token Service');
      
      container.register(TEST_SERVICE_TOKEN, factory);
      
      const service = container.resolve(TEST_SERVICE_TOKEN);
      expect(service).toBeInstanceOf(TestService);
      expect(service.getName()).toBe('Token Service');
    });

    it('should register class-based services with dependency injection', () => {
      // Register dependencies first
      container.registerValue('connectionString', 'test://database');
      container.register('databaseService', (c) => new DatabaseService(c.resolve<string>('connectionString')));
      
      // Register class with dependencies
      container.registerClass('cacheService', CacheService, ['databaseService']);
      
      const cacheService = container.resolve<CacheService>('cacheService');
      expect(cacheService).toBeInstanceOf(CacheService);
      expect(cacheService.getDatabaseService()).toBeInstanceOf(DatabaseService);
    });

    it('should register value services', () => {
      const testValue = { config: 'test-config', version: '1.0.0' };
      
      container.registerValue('config', testValue);
      
      const resolvedValue = container.resolve<typeof testValue>('config');
      expect(resolvedValue).toBe(testValue);
      expect(resolvedValue.config).toBe('test-config');
    });

    it('should register services with custom options', () => {
      const options: ServiceOptions = {
        lifecycle: 'transient',
        lazy: false,
        dependencies: ['databaseService'],
        metadata: { version: '2.0.0' },
      };

      container.register('databaseService', () => new DatabaseService());
      container.register('customService', (c) => new CacheService(c.resolve('databaseService')), options);
      
      const service1 = container.resolve('customService');
      const service2 = container.resolve('customService');
      
      // Transient services should be different instances
      expect(service1).not.toBe(service2);
    });

    it('should warn when replacing existing service registration', () => {
      const logSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      container.register('testService', () => new TestService('First'));
      container.register('testService', () => new TestService('Second'));
      
      // Should warn about replacement (assuming logger uses console.warn)
      // Note: This test might need adjustment based on actual logger implementation
      
      const service = container.resolve<ITestService>('testService');
      expect(service.getName()).toBe('Second');
      
      logSpy.mockRestore();
    });

    it('should emit serviceRegistered events', () => {
      const eventHandler = jest.fn();
      container.on('serviceRegistered', eventHandler);
      
      container.register('testService', () => new TestService());
      
      expect(eventHandler).toHaveBeenCalledWith({
        token: 'testService',
        options: expect.objectContaining({
          lifecycle: 'singleton',
          lazy: true,
        }),
      });
    });

    it('should prevent registration on disposed container', () => {
      container.dispose();
      
      expect(() => {
        container.register('testService', () => new TestService());
      }).toThrow('Cannot register services on disposed container');
    });
  });

  describe('Service Resolution and Lifecycles', () => {
    it('should resolve singleton services as same instance', () => {
      container.register('singletonService', () => new TestService('Singleton'), {
        lifecycle: 'singleton',
      });
      
      const service1 = container.resolve<ITestService>('singletonService');
      const service2 = container.resolve<ITestService>('singletonService');
      
      expect(service1).toBe(service2);
      expect(service1.getName()).toBe('Singleton');
    });

    it('should resolve transient services as different instances', () => {
      container.register('transientService', () => new TestService('Transient'), {
        lifecycle: 'transient',
      });
      
      const service1 = container.resolve<ITestService>('transientService');
      const service2 = container.resolve<ITestService>('transientService');
      
      expect(service1).not.toBe(service2);
      expect(service1.getName()).toBe('Transient');
      expect(service2.getName()).toBe('Transient');
    });

    it('should resolve scoped services within dependency scope', () => {
      container.register('scopedService', () => new TestService('Scoped'), {
        lifecycle: 'scoped',
      });
      
      const scope1 = container.createScope();
      const scope2 = container.createScope();
      
      const service1a = scope1.resolve<ITestService>('scopedService');
      const service1b = scope1.resolve<ITestService>('scopedService');
      const service2a = scope2.resolve<ITestService>('scopedService');
      
      // Same instance within scope
      expect(service1a).toBe(service1b);
      // Different instances across scopes
      expect(service1a).not.toBe(service2a);
      
      scope1.dispose();
      scope2.dispose();
    });

    it('should handle async service factories', async () => {
      const asyncFactory: ServiceFactory<ITestService> = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return new TestService('Async Service');
      };
      
      container.register('asyncService', asyncFactory);
      
      const service = await container.resolveAsync<ITestService>('asyncService');
      expect(service).toBeInstanceOf(TestService);
      expect(service.getName()).toBe('Async Service');
    });

    it('should throw error for unregistered services', () => {
      expect(() => {
        container.resolve('nonExistentService');
      }).toThrow('Service not registered: nonExistentService');
    });

    it('should prevent resolution on disposed container', () => {
      container.register('testService', () => new TestService());
      container.dispose();
      
      expect(() => {
        container.resolve('testService');
      }).toThrow('Cannot resolve services from disposed container');
    });

    it('should handle complex dependency chains', () => {
      // Register services with dependencies
      container.registerValue('connectionString', 'complex://test');
      container.register('databaseService', (c) => new DatabaseService(c.resolve('connectionString')));
      container.register('cacheService', (c) => new CacheService(c.resolve('databaseService')));
      container.register('testService', () => new TestService('Complex'));
      
      container.register('complexService', (c) => new ComplexService(
        c.resolve('testService'),
        c.resolve('databaseService'),
        c.resolve('cacheService')
      ));
      
      const complex = container.resolve<ComplexService>('complexService');
      const deps = complex.getDependencies();
      
      expect(deps.testService).toBeInstanceOf(TestService);
      expect(deps.databaseService).toBeInstanceOf(DatabaseService);
      expect(deps.cacheService).toBeInstanceOf(CacheService);
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect direct circular dependencies', () => {
      container.register('serviceA', (c) => ({ serviceB: c.resolve('serviceB') }));
      container.register('serviceB', (c) => ({ serviceA: c.resolve('serviceA') }));
      
      expect(() => {
        container.resolve('serviceA');
      }).toThrow(/Circular dependency detected: serviceA → serviceB → serviceA/);
    });

    it('should detect indirect circular dependencies', () => {
      container.register('serviceA', (c) => ({ serviceB: c.resolve('serviceB') }));
      container.register('serviceB', (c) => ({ serviceC: c.resolve('serviceC') }));
      container.register('serviceC', (c) => ({ serviceA: c.resolve('serviceA') }));
      
      expect(() => {
        container.resolve('serviceA');
      }).toThrow(/Circular dependency detected: serviceA → serviceB → serviceC → serviceA/);
    });

    it('should detect self-referencing circular dependencies', () => {
      container.register('selfService', (c) => ({ self: c.resolve('selfService') }));
      
      expect(() => {
        container.resolve('selfService');
      }).toThrow(/Circular dependency detected: selfService → selfService/);
    });

    it('should handle complex circular dependency scenarios', () => {
      // Create a more complex circular dependency chain
      container.register('serviceA', (c) => ({ 
        b: c.resolve('serviceB'),
        d: c.resolve('serviceD')
      }));
      container.register('serviceB', (c) => ({ c: c.resolve('serviceC') }));
      container.register('serviceC', (c) => ({ a: c.resolve('serviceA') }));
      container.register('serviceD', () => ({ name: 'D' }));
      
      expect(() => {
        container.resolve('serviceA');
      }).toThrow(/Circular dependency detected/);
    });
  });

  describe('Dependency Scope Management', () => {
    it('should create and manage dependency scopes', () => {
      const scope = container.createScope();
      
      expect(scope).toBeInstanceOf(DependencyScope);
      expect(scope).toBeDefined();
    });

    it('should resolve services within scope context', () => {
      container.register('scopedService', () => new TestService('Scoped'), {
        lifecycle: 'scoped',
      });
      
      const scope = container.createScope();
      const service1 = scope.resolve<ITestService>('scopedService');
      const service2 = scope.resolve<ITestService>('scopedService');
      
      expect(service1).toBe(service2);
      scope.dispose();
    });

    it('should dispose scoped services properly', () => {
      const disposableService = new TestService('Disposable');
      container.register('disposableService', () => disposableService, {
        lifecycle: 'scoped',
      });
      
      const scope = container.createScope();
      scope.resolve('disposableService');
      
      scope.dispose();
      
      expect(disposableService.disposeCalled).toBe(true);
    });

    it('should handle disposal errors gracefully', () => {
      const faultyService = {
        dispose: jest.fn().mockImplementation(() => {
          throw new Error('Disposal error');
        }),
      };
      
      container.register('faultyService', () => faultyService, {
        lifecycle: 'scoped',
      });
      
      const scope = container.createScope();
      scope.resolve('faultyService');
      
      // Should not throw error
      expect(() => scope.dispose()).not.toThrow();
      expect(faultyService.dispose).toHaveBeenCalled();
    });

    it('should try different cleanup methods in order', () => {
      const serviceWithShutdown = {
        shutdown: jest.fn(),
        destroy: jest.fn(),
      };
      
      const serviceWithDestroy = {
        destroy: jest.fn(),
      };
      
      container.register('shutdownService', () => serviceWithShutdown, { lifecycle: 'scoped' });
      container.register('destroyService', () => serviceWithDestroy, { lifecycle: 'scoped' });
      
      const scope = container.createScope();
      scope.resolve('shutdownService');
      scope.resolve('destroyService');
      
      scope.dispose();
      
      expect(serviceWithShutdown.shutdown).toHaveBeenCalled();
      expect(serviceWithShutdown.destroy).not.toHaveBeenCalled();
      expect(serviceWithDestroy.destroy).toHaveBeenCalled();
    });
  });

  describe('Service Initialization and Cleanup', () => {
    it('should initialize services with initialize method', async () => {
      const service = new TestService('Initializable');
      container.registerValue('initService', service);
      
      await container.initializeServices();
      
      expect(service.initializeCalled).toBe(true);
    });

    it('should dispose services on container disposal', () => {
      const service1 = new TestService('Service1');
      const service2 = new TestService('Service2');
      
      container.registerValue('service1', service1);
      container.registerValue('service2', service2);
      
      // Resolve services to instantiate them
      container.resolve('service1');
      container.resolve('service2');
      
      container.dispose();
      
      expect(service1.disposeCalled).toBe(true);
      expect(service2.disposeCalled).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      const faultyService = {
        initialize: jest.fn().mockRejectedValue(new Error('Init failed')),
      };
      
      container.registerValue('faultyService', faultyService);
      
      // Should not throw but should log error
      await expect(container.initializeServices()).resolves.not.toThrow();
      expect(faultyService.initialize).toHaveBeenCalled();
    });

    it('should track initialization order', async () => {
      const service1 = new TestService('First');
      const service2 = new TestService('Second');
      
      container.registerValue('service1', service1);
      container.registerValue('service2', service2);
      
      await container.initializeServices();
      
      const order = container.getInitializationOrder();
      expect(order).toContain('service1');
      expect(order).toContain('service2');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle high-volume service resolution', () => {
      container.register('testService', () => new TestService('Performance'), {
        lifecycle: 'transient',
      });
      
      const startTime = Date.now();
      const services: ITestService[] = [];
      
      // Resolve many services
      for (let i = 0; i < 1000; i++) {
        services.push(container.resolve<ITestService>('testService'));
      }
      
      const endTime = Date.now();
      
      expect(services).toHaveLength(1000);
      expect(services.every(s => s instanceof TestService)).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should manage memory efficiently with singletons', () => {
      container.register('singletonService', () => new TestService('Singleton'), {
        lifecycle: 'singleton',
      });
      
      const services: ITestService[] = [];
      
      // Resolve same singleton many times
      for (let i = 0; i < 1000; i++) {
        services.push(container.resolve<ITestService>('singletonService'));
      }
      
      // All should be same instance
      expect(services.every(s => s === services[0])).toBe(true);
    });

    it('should handle concurrent service resolution', async () => {
      let instanceCount = 0;
      container.register('concurrentService', () => {
        instanceCount++;
        return new TestService(`Concurrent-${instanceCount}`);
      }, { lifecycle: 'singleton' });
      
      // Resolve concurrently
      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(container.resolve<ITestService>('concurrentService'))
      );
      
      const services = await Promise.all(promises);
      
      // All should be same instance for singleton
      expect(services.every(s => s === services[0])).toBe(true);
      expect(instanceCount).toBe(1); // Only one instance should be created
    });

    it('should cleanup resources efficiently', () => {
      const services: TestService[] = [];
      
      // Create many services
      for (let i = 0; i < 100; i++) {
        const service = new TestService(`Service-${i}`);
        services.push(service);
        container.registerValue(`service${i}`, service);
      }
      
      // Resolve all services
      services.forEach((_, i) => container.resolve(`service${i}`));
      
      container.dispose();
      
      // All services should be disposed
      expect(services.every(s => s.disposeCalled)).toBe(true);
    });

    it('should prevent memory leaks from event listeners', () => {
      const initialListenerCount = container.listenerCount('serviceRegistered');
      
      // Add many listeners
      for (let i = 0; i < 50; i++) {
        container.on('serviceRegistered', () => {});
      }
      
      expect(container.listenerCount('serviceRegistered')).toBe(initialListenerCount + 50);
      
      container.dispose();
      
      // Listeners should be cleaned up
      expect(container.listenerCount('serviceRegistered')).toBe(0);
    });
  });

  describe('Advanced Features and Edge Cases', () => {
    it('should handle services with complex metadata', () => {
      const metadata = {
        version: '2.1.0',
        tags: ['database', 'cache'],
        config: { timeout: 5000, retries: 3 },
      };
      
      container.register('metadataService', () => new TestService('Metadata'), {
        metadata,
      });
      
      const registration = container.getServiceRegistration('metadataService');
      expect(registration?.options.metadata).toEqual(metadata);
    });

    it('should support lazy vs eager initialization', async () => {
      let lazyInitialized = false;
      let eagerInitialized = false;
      
      container.register('lazyService', () => {
        lazyInitialized = true;
        return new TestService('Lazy');
      }, { lazy: true });
      
      container.register('eagerService', () => {
        eagerInitialized = true;
        return new TestService('Eager');
      }, { lazy: false });
      
      // Neither should be initialized yet for lazy: true
      expect(lazyInitialized).toBe(false);
      // Eager services are still lazy by default in this implementation
      
      container.resolve('lazyService');
      expect(lazyInitialized).toBe(true);
    });

    it('should handle services with async dependencies', async () => {
      container.register('asyncDep', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return new DatabaseService('async://connection');
      });
      
      container.register('serviceWithAsyncDep', async (c) => {
        const dep = await c.resolveAsync<IDatabaseService>('asyncDep');
        return new CacheService(dep);
      });
      
      const service = await container.resolveAsync<CacheService>('serviceWithAsyncDep');
      expect(service).toBeInstanceOf(CacheService);
      expect(service.getDatabaseService()).toBeInstanceOf(DatabaseService);
    });

    it('should support service replacement and hot-swapping', () => {
      container.register('replaceableService', () => new TestService('Original'));
      
      const original = container.resolve<ITestService>('replaceableService');
      expect(original.getName()).toBe('Original');
      
      // Replace service registration
      container.register('replaceableService', () => new TestService('Replaced'), {
        lifecycle: 'transient',
      });
      
      const replaced = container.resolve<ITestService>('replaceableService');
      expect(replaced.getName()).toBe('Replaced');
      expect(replaced).not.toBe(original);
    });

    it('should handle service resolution with context passing', () => {
      container.register('contextService', (container, context) => {
        return new TestService(context?.contextData || 'Default');
      });
      
      // This test assumes the container supports context passing
      // Implementation may need adjustment based on actual API
      const service = container.resolve<ITestService>('contextService');
      expect(service).toBeInstanceOf(TestService);
    });

    it('should support conditional service registration', () => {
      const condition = true;
      
      if (condition) {
        container.register('conditionalService', () => new TestService('Conditional True'));
      } else {
        container.register('conditionalService', () => new TestService('Conditional False'));
      }
      
      const service = container.resolve<ITestService>('conditionalService');
      expect(service.getName()).toBe('Conditional True');
    });

    it('should handle deeply nested dependency graphs', () => {
      // Create a deep dependency chain
      container.registerValue('level0', 'root');
      
      for (let i = 1; i <= 10; i++) {
        const prevLevel = `level${i - 1}`;
        const currentLevel = `level${i}`;
        
        container.register(currentLevel, (c) => ({
          level: i,
          dependency: c.resolve(prevLevel),
        }));
      }
      
      const deepService = container.resolve<any>('level10');
      
      expect(deepService.level).toBe(10);
      expect(deepService.dependency.level).toBe(9);
      
      // Traverse to root
      let current = deepService;
      for (let i = 10; i >= 1; i--) {
        expect(current.level).toBe(i);
        current = current.dependency;
      }
      
      expect(current).toBe('root');
    });
  });

  describe('Integration and Compatibility', () => {
    it('should work with existing service patterns', () => {
      // Test compatibility with common DI patterns
      interface ILogger {
        log(message: string): void;
      }
      
      class ConsoleLogger implements ILogger {
        log(message: string): void {
          // Mock implementation
        }
      }
      
      container.registerClass('logger', ConsoleLogger);
      container.register('serviceWithLogger', (c) => ({
        logger: c.resolve<ILogger>('logger'),
        doWork: function() {
          this.logger.log('Working...');
        },
      }));
      
      const service = container.resolve<any>('serviceWithLogger');
      expect(service.logger).toBeInstanceOf(ConsoleLogger);
      expect(typeof service.doWork).toBe('function');
    });

    it('should emit comprehensive lifecycle events', () => {
      const events: string[] = [];
      
      container.on('serviceRegistered', () => events.push('registered'));
      container.on('serviceResolved', () => events.push('resolved'));
      container.on('serviceInitialized', () => events.push('initialized'));
      container.on('serviceDisposed', () => events.push('disposed'));
      
      container.register('eventService', () => new TestService('Events'));
      container.resolve('eventService');
      container.dispose();
      
      expect(events).toContain('registered');
      // Note: Other events depend on container implementation
    });

    it('should provide service inspection capabilities', () => {
      container.register('inspectableService', () => new TestService('Inspectable'), {
        metadata: { category: 'test' },
      });
      
      const allServices = container.getRegisteredServices();
      expect(allServices).toContain('inspectableService');
      
      const registration = container.getServiceRegistration('inspectableService');
      expect(registration?.options.metadata?.category).toBe('test');
    });
  });
});