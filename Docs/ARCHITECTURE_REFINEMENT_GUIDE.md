# Architecture Refinement Guide

## Executive Summary

This guide outlines strategic architectural improvements to transform CodeCrucible Synth from a monolithic TypeScript application into a modular, scalable, and maintainable system with clear separation of concerns and optional high-performance components.

## Current Architecture Analysis

### Strengths
- **Layered Architecture**: Clear Domain → Application → Infrastructure separation
- **Event-Driven Design**: Extensive use of EventEmitter for decoupling
- **Comprehensive DI**: Dependency injection container managing lifecycles
- **Security-First**: Multiple layers of validation and sandboxing

### Weaknesses
- **Circular Dependencies**: Some modules still have circular imports
- **Mock Proliferation**: Too many mock implementations scattered
- **Interface Drift**: Core interfaces diverging from implementations
- **Testing Complexity**: Difficult to test in isolation

## Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        API Gateway                           │
│                    (REST, GraphQL, gRPC)                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                  Orchestration Layer                         │
│           (TypeScript - Planning & Routing)                  │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Voice   │  │  Living  │  │  Council │  │   MCP    │   │
│  │ Synthesis│  │  Spiral  │  │  Engine  │  │  Manager │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Execution Layer                           │
│              (Pluggable: TS, Rust, WASM)                     │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   File   │  │  Command │  │   Test   │  │  Search  │   │
│  │ Executor │  │ Executor │  │  Runner  │  │  Engine  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   Infrastructure Layer                       │
│           (Providers, Storage, Monitoring)                   │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Core Refactoring (Week 1-2)

#### 1.1 Extract Core Domain
```typescript
// src/domain/core/index.ts
export * from './entities';
export * from './value-objects';
export * from './interfaces';
export * from './types';

// No imports from application or infrastructure layers
```

#### 1.2 Define Clear Boundaries
```typescript
// src/domain/boundaries/index.ts
export interface IExecutionBoundary {
  execute<T>(command: Command): Promise<Result<T>>;
}

export interface IQueryBoundary {
  query<T>(query: Query): Promise<Result<T>>;
}

export interface IEventBoundary {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): void;
}

// Application services implement these boundaries
export class ApplicationBoundary implements IExecutionBoundary, IQueryBoundary {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus
  ) {}
  
  async execute<T>(command: Command): Promise<Result<T>> {
    return this.commandBus.send(command);
  }
  
  async query<T>(query: Query): Promise<Result<T>> {
    return this.queryBus.send(query);
  }
}
```

#### 1.3 Implement CQRS Pattern
```typescript
// src/application/cqrs/command-bus.ts
export class CommandBus {
  private handlers = new Map<string, CommandHandler>();
  
  register<T extends Command>(
    commandType: string,
    handler: CommandHandler<T>
  ): void {
    this.handlers.set(commandType, handler);
  }
  
  async send<T>(command: Command): Promise<Result<T>> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      return Result.fail(`No handler for command: ${command.type}`);
    }
    
    try {
      // Add middleware pipeline here
      const result = await this.runMiddleware(command, handler);
      return Result.ok(result);
    } catch (error) {
      return Result.fail(error.message);
    }
  }
  
  private async runMiddleware(command: Command, handler: CommandHandler): Promise<any> {
    // Validation middleware
    await this.validateCommand(command);
    
    // Logging middleware
    logger.info(`Executing command: ${command.type}`);
    
    // Security middleware
    await this.checkPermissions(command);
    
    // Execute handler
    const result = await handler.handle(command);
    
    // Audit middleware
    await this.auditCommand(command, result);
    
    return result;
  }
}
```

### Phase 2: Modular Architecture (Week 3-4)

#### 2.1 Plugin System
```typescript
// src/core/plugins/plugin-system.ts
export interface IPlugin {
  name: string;
  version: string;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface IExecutorPlugin extends IPlugin {
  capabilities: string[];
  execute(operation: string, args: any): Promise<any>;
}

export class PluginManager {
  private plugins = new Map<string, IPlugin>();
  private executors = new Map<string, IExecutorPlugin>();
  
  async loadPlugin(plugin: IPlugin): Promise<void> {
    await plugin.initialize();
    this.plugins.set(plugin.name, plugin);
    
    // Register executor capabilities
    if (this.isExecutorPlugin(plugin)) {
      this.executors.set(plugin.name, plugin);
      this.registerCapabilities(plugin);
    }
    
    logger.info(`Loaded plugin: ${plugin.name} v${plugin.version}`);
  }
  
  private isExecutorPlugin(plugin: IPlugin): plugin is IExecutorPlugin {
    return 'execute' in plugin && 'capabilities' in plugin;
  }
  
  private registerCapabilities(plugin: IExecutorPlugin): void {
    for (const capability of plugin.capabilities) {
      this.capabilityMap.set(capability, plugin.name);
    }
  }
  
  async executeOperation(operation: string, args: any): Promise<any> {
    const pluginName = this.capabilityMap.get(operation);
    if (!pluginName) {
      throw new Error(`No plugin supports operation: ${operation}`);
    }
    
    const executor = this.executors.get(pluginName);
    return executor!.execute(operation, args);
  }
}
```

#### 2.2 Feature Modules
```typescript
// src/features/code-generation/module.ts
export class CodeGenerationModule implements IFeatureModule {
  name = 'code-generation';
  
  register(container: DependencyContainer): void {
    // Register services
    container.register('CodeGenerator', CodeGenerator);
    container.register('TemplateEngine', TemplateEngine);
    
    // Register commands
    container.register('GenerateComponentCommand', GenerateComponentCommand);
    container.register('GenerateTestCommand', GenerateTestCommand);
    
    // Register tools
    container.register('CodeGenTool', {
      useFactory: (generator: CodeGenerator) => 
        new CodeGenerationTool(generator),
      inject: ['CodeGenerator']
    });
  }
  
  async initialize(): Promise<void> {
    // Load templates
    await this.loadTemplates();
    
    // Register with tool system
    const toolSystem = container.get<IToolSystem>('ToolSystem');
    toolSystem.registerTool('generate-code', container.get('CodeGenTool'));
  }
  
  getRoutes(): Route[] {
    return [
      { path: '/generate/component', handler: GenerateComponentHandler },
      { path: '/generate/test', handler: GenerateTestHandler }
    ];
  }
}

// Module loader
export class ModuleLoader {
  async loadModules(): Promise<void> {
    const modules = [
      new CodeGenerationModule(),
      new AnalysisModule(),
      new SecurityModule(),
      new VoiceModule()
    ];
    
    for (const module of modules) {
      module.register(this.container);
      await module.initialize();
      
      // Register routes if API server is enabled
      if (this.apiServer) {
        module.getRoutes().forEach(route => 
          this.apiServer.registerRoute(route)
        );
      }
    }
  }
}
```

### Phase 3: Event-Driven Architecture (Week 5-6)

#### 3.1 Event Sourcing
```typescript
// src/core/events/event-store.ts
export interface Event {
  id: string;
  type: string;
  aggregateId: string;
  version: number;
  timestamp: number;
  data: any;
  metadata?: EventMetadata;
}

export class EventStore {
  private events: Event[] = [];
  private snapshots = new Map<string, any>();
  
  async append(event: Event): Promise<void> {
    // Validate event
    this.validateEvent(event);
    
    // Store event
    this.events.push(event);
    
    // Publish to subscribers
    await this.eventBus.publish(event);
    
    // Update projections
    await this.updateProjections(event);
    
    // Check for snapshot
    if (this.shouldSnapshot(event.aggregateId)) {
      await this.createSnapshot(event.aggregateId);
    }
  }
  
  async getEvents(
    aggregateId: string,
    fromVersion?: number
  ): Promise<Event[]> {
    return this.events.filter(e => 
      e.aggregateId === aggregateId &&
      (!fromVersion || e.version > fromVersion)
    );
  }
  
  async getAggregate<T>(
    aggregateId: string,
    AggregateClass: new() => T
  ): Promise<T> {
    // Check for snapshot
    const snapshot = this.snapshots.get(aggregateId);
    
    let aggregate: T;
    let fromVersion = 0;
    
    if (snapshot) {
      aggregate = Object.assign(new AggregateClass(), snapshot.data);
      fromVersion = snapshot.version;
    } else {
      aggregate = new AggregateClass();
    }
    
    // Apply events
    const events = await this.getEvents(aggregateId, fromVersion);
    for (const event of events) {
      (aggregate as any).apply(event);
    }
    
    return aggregate;
  }
}
```

#### 3.2 Saga Pattern
```typescript
// src/core/sagas/saga-manager.ts
export abstract class Saga {
  abstract handle(event: Event): Promise<Command[]>;
}

export class CodeGenerationSaga extends Saga {
  async handle(event: Event): Promise<Command[]> {
    const commands: Command[] = [];
    
    switch(event.type) {
      case 'ComponentRequested':
        commands.push(
          new AnalyzeRequirementsCommand(event.data),
          new GenerateCodeCommand(event.data),
          new ValidateCodeCommand(event.data)
        );
        break;
        
      case 'CodeGenerated':
        commands.push(
          new FormatCodeCommand(event.data),
          new RunTestsCommand(event.data)
        );
        break;
        
      case 'TestsFailed':
        commands.push(
          new FixCodeCommand(event.data),
          new RegenerateTestsCommand(event.data)
        );
        break;
    }
    
    return commands;
  }
}

export class SagaManager {
  private sagas = new Map<string, Saga>();
  
  register(eventType: string, saga: Saga): void {
    this.sagas.set(eventType, saga);
  }
  
  async handleEvent(event: Event): Promise<void> {
    const saga = this.sagas.get(event.type);
    if (!saga) return;
    
    const commands = await saga.handle(event);
    
    for (const command of commands) {
      await this.commandBus.send(command);
    }
  }
}
```

### Phase 4: Microservices Ready (Week 7-8)

#### 4.1 Service Boundaries
```typescript
// src/services/boundaries.ts
export interface IServiceBoundary {
  name: string;
  version: string;
  health(): Promise<HealthStatus>;
}

export interface ICodeService extends IServiceBoundary {
  generate(request: GenerateRequest): Promise<GenerateResponse>;
  analyze(request: AnalyzeRequest): Promise<AnalyzeResponse>;
}

export interface IExecutionService extends IServiceBoundary {
  execute(request: ExecuteRequest): Promise<ExecuteResponse>;
  cancel(taskId: string): Promise<void>;
}

// Service implementation
export class CodeService implements ICodeService {
  name = 'code-service';
  version = '1.0.0';
  
  constructor(
    private generator: CodeGenerator,
    private analyzer: CodeAnalyzer
  ) {}
  
  async health(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      timestamp: Date.now(),
      checks: {
        generator: await this.generator.health(),
        analyzer: await this.analyzer.health()
      }
    };
  }
  
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    // Add tracing
    const span = tracer.startSpan('generate-code');
    
    try {
      const result = await this.generator.generate(request);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }
}
```

#### 4.2 Service Mesh Integration
```typescript
// src/infrastructure/service-mesh/mesh-adapter.ts
export class ServiceMeshAdapter {
  private consul: Consul;
  
  async registerService(service: IServiceBoundary): Promise<void> {
    await this.consul.agent.service.register({
      name: service.name,
      id: `${service.name}-${process.pid}`,
      port: this.port,
      check: {
        http: `http://localhost:${this.port}/health`,
        interval: '10s'
      },
      tags: [
        `version:${service.version}`,
        'env:production'
      ]
    });
  }
  
  async discoverService(name: string): Promise<ServiceEndpoint[]> {
    const services = await this.consul.health.service(name);
    
    return services.map(s => ({
      host: s.Service.Address,
      port: s.Service.Port,
      metadata: s.Service.Tags
    }));
  }
  
  async createCircuitBreaker(
    service: string
  ): Promise<CircuitBreaker> {
    return new CircuitBreaker({
      timeout: 3000,
      errorThreshold: 50,
      resetTimeout: 30000,
      onOpen: () => logger.warn(`Circuit opened for ${service}`),
      onHalfOpen: () => logger.info(`Circuit half-open for ${service}`)
    });
  }
}
```

### Phase 5: Observability (Week 9-10)

#### 5.1 Distributed Tracing
```typescript
// src/infrastructure/tracing/tracer.ts
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

export class TracingSystem {
  private provider: NodeTracerProvider;
  
  initialize(): void {
    this.provider = new NodeTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'codecrucible',
        [SemanticResourceAttributes.SERVICE_VERSION]: version
      })
    });
    
    // Add Jaeger exporter
    const exporter = new JaegerExporter({
      endpoint: 'http://localhost:14268/api/traces'
    });
    
    this.provider.addSpanProcessor(
      new BatchSpanProcessor(exporter)
    );
    
    // Register globally
    this.provider.register();
  }
  
  createTracer(name: string): Tracer {
    return trace.getTracer(name);
  }
}

// Usage in services
export class TracedService {
  private tracer: Tracer;
  
  constructor() {
    this.tracer = tracingSystem.createTracer('my-service');
  }
  
  async operation(request: Request): Promise<Response> {
    const span = this.tracer.startSpan('operation', {
      attributes: {
        'request.id': request.id,
        'request.type': request.type
      }
    });
    
    try {
      const result = await this.doWork(request);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ 
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      throw error;
    } finally {
      span.end();
    }
  }
}
```

#### 5.2 Metrics Collection
```typescript
// src/infrastructure/metrics/metrics-system.ts
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

export class MetricsSystem {
  private meterProvider: MeterProvider;
  private meters = new Map<string, Meter>();
  
  initialize(): void {
    const exporter = new PrometheusExporter({
      port: 9090,
      endpoint: '/metrics'
    });
    
    this.meterProvider = new MeterProvider({
      exporter,
      interval: 1000
    });
  }
  
  createMeter(name: string): Meter {
    if (!this.meters.has(name)) {
      const meter = this.meterProvider.getMeter(name);
      this.meters.set(name, meter);
    }
    return this.meters.get(name)!;
  }
  
  // Pre-defined metrics
  createStandardMetrics(meter: Meter): StandardMetrics {
    return {
      requestCount: meter.createCounter('requests_total', {
        description: 'Total number of requests'
      }),
      
      requestDuration: meter.createHistogram('request_duration_ms', {
        description: 'Request duration in milliseconds'
      }),
      
      activeConnections: meter.createUpDownCounter('active_connections', {
        description: 'Number of active connections'
      }),
      
      errorRate: meter.createCounter('errors_total', {
        description: 'Total number of errors'
      })
    };
  }
}
```

## Migration Strategy

### Step 1: Parallel Development
- Keep existing system running
- Build new architecture alongside
- Use feature flags for gradual rollout

### Step 2: Incremental Migration
```typescript
// src/migration/adapter.ts
export class LegacyAdapter {
  constructor(
    private legacy: LegacySystem,
    private modern: ModernSystem
  ) {}
  
  async handle(request: Request): Promise<Response> {
    // Check feature flag
    if (await this.shouldUseModern(request)) {
      return this.modern.handle(request);
    }
    
    // Fallback to legacy
    return this.legacy.handle(request);
  }
  
  private async shouldUseModern(request: Request): Promise<boolean> {
    // Gradual rollout logic
    const rolloutPercentage = await this.getConfig('modern.rollout');
    const hash = this.hashRequest(request);
    
    return (hash % 100) < rolloutPercentage;
  }
}
```

### Step 3: Data Migration
```typescript
// scripts/migrate-data.ts
export class DataMigrator {
  async migrate(): Promise<void> {
    // Migrate in batches
    const batchSize = 1000;
    let offset = 0;
    
    while (true) {
      const batch = await this.legacy.getBatch(offset, batchSize);
      if (batch.length === 0) break;
      
      // Transform and validate
      const transformed = batch.map(item => this.transform(item));
      const validated = transformed.filter(item => this.validate(item));
      
      // Write to new system
      await this.modern.writeBatch(validated);
      
      offset += batchSize;
      
      // Progress tracking
      console.log(`Migrated ${offset} items`);
    }
  }
}
```

## Testing Strategy

### Contract Testing
```typescript
// tests/contracts/code-service.contract.test.ts
describe('Code Service Contract', () => {
  test('should generate code', async () => {
    const request: GenerateRequest = {
      type: 'component',
      name: 'Button',
      props: ['onClick', 'label']
    };
    
    const response = await codeService.generate(request);
    
    expect(response).toMatchSchema(GenerateResponseSchema);
    expect(response.code).toContain('export const Button');
  });
});
```

### Chaos Engineering
```typescript
// tests/chaos/resilience.test.ts
describe('System Resilience', () => {
  test('should handle service failure', async () => {
    // Kill a service
    await chaosMonkey.killService('code-service');
    
    // System should still respond
    const response = await system.request({
      type: 'generate',
      fallback: true
    });
    
    expect(response.degraded).toBe(true);
    expect(response.result).toBeDefined();
  });
});
```

## Success Metrics

1. **Modularity**: Plugin system supporting 10+ plugins
2. **Scalability**: Handle 1000 req/s with <100ms p99
3. **Reliability**: 99.9% uptime with graceful degradation
4. **Observability**: Full tracing coverage, <1min MTTR
5. **Developer Experience**: <5min to add new feature

## Conclusion

This architectural refinement transforms CodeCrucible Synth into a production-ready, scalable system while maintaining backward compatibility and enabling gradual migration. The modular design allows teams to work independently while the event-driven architecture provides flexibility for future growth.