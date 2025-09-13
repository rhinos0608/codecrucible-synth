import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import * as path from 'path';
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
import { IEventBus } from '../../domain/interfaces/event-bus.js';
import { IUserInteraction } from '../../domain/interfaces/user-interaction.js';
import { UnifiedConfiguration } from '../../domain/interfaces/configuration.js';
import {
  UnifiedConfigurationManager,
  getUnifiedConfigurationManager,
} from '../../domain/config/config-manager.js';
import { ProjectContext, UnifiedAgentSystem } from '../../domain/services/unified-agent/index.js';
import {
  UnifiedServerSystem,
  type MCPServerInfo,
} from '../../domain/services/unified-server-system.js';
import { type IUnifiedSecurityValidator } from '../../domain/interfaces/security-validator.js';
import { UnifiedSecurityValidator } from '../../infrastructure/security/unified-security-validator.js';
import { UnifiedPerformanceSystem } from '../../domain/services/unified-performance-system.js';
import { PluginManager } from './plugin-manager.js';
import { CommandBus } from '../cqrs/command-bus.js';
import { AgentOperationHandler } from '../cqrs/handlers/agent-operation-handler.js';
import { PluginDispatchHandler } from '../cqrs/handlers/plugin-dispatch-handler.js';
import { discoverPlugins } from '../../infrastructure/plugins/plugin-loader.js';
import { CommandRegistry } from './command-registry.js';
import { OrchestrationRequest, OrchestrationResponse } from './orchestration-types.js';
import { HealthMonitor } from '../../domain/services/mcp-discovery/health-monitor.js';
import { MetricsCollector } from '../../domain/services/mcp-discovery/metrics-collector.js';
import {
  type MCPServerProfile,
  ServerProfileStatus,
} from '../../domain/services/mcp-discovery/discovery-types.js';

// Re-export types for external consumption
export type { OrchestrationRequest, OrchestrationResponse } from './orchestration-types.js';

/**
 * Unified Orchestration Service - Application Layer
 *
 * Moved from /src/core/services/unified-orchestration-service.ts
 * This belongs in the Application layer as it orchestrates domain services
 * and coordinates between different layers.
 */

// Interface for runtime context with optional Rust backend
interface RuntimeContextWithBackend extends RuntimeContext {
  rustBackend?: {
    isAvailable: () => boolean;
    execute: (request: unknown) => Promise<unknown>;
  };
}

// Interface for systems that can accept Rust backend injection
interface BackendCapableSystem {
  rustBackend?: unknown;
}

// Extended orchestration interfaces - using base types from orchestration-types.js
interface ExtendedOrchestrationRequest extends OrchestrationRequest {
  readonly input: string | object;
  options?: {
    mode?: 'fast' | 'balanced' | 'thorough';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    timeout?: number;
    streaming?: boolean;
    collaborative?: boolean;
  };
  context?: {
    workingDirectory?: string;
    projectType?: string;
    language?: string[];
    frameworks?: string[];
  };
}

interface ExtendedOrchestrationResponse extends OrchestrationResponse {
  metadata: {
    processingTime: number;
    componentsUsed: string[];
    resourceUsage: {
      memory: number;
      cpu: number;
    };
  };
}

/**
 * Slim orchestrator that composes workflow modules and exposes high-level
 * orchestration APIs.
 */
export class UnifiedOrchestrationService extends EventEmitter {
  private readonly logger = createLogger('UnifiedOrchestrationService');

  // Core service properties
  private initialized = false;
  private readonly activeRequests = new Map<string, OrchestrationRequest>();
  private readonly cleanupHandlers: (() => void | Promise<void>)[] = [];
  private readonly startTime = Date.now();

  // Real metrics tracking
  private totalProcessedRequests = 0;
  private totalFailedRequests = 0;
  private responseTimeSum = 0;
  private responseTimes: number[] = [];

  // Service dependencies
  private configManager!: UnifiedConfigurationManager;
  private config!: UnifiedConfiguration;
  private eventBus!: IEventBus;
  private userInteraction!: IUserInteraction;
  private runtimeContext!: RuntimeContext;

  // Domain services
  private securityValidator!: IUnifiedSecurityValidator;
  private performanceSystem!: UnifiedPerformanceSystem;
  private agentSystem!: UnifiedAgentSystem;
  private serverSystem!: UnifiedServerSystem;
  private readonly healthMonitor = new HealthMonitor();
  private readonly metricsCollector = new MetricsCollector();

  // Application services
  private commandBus!: CommandBus;
  private commandRegistry!: CommandRegistry;
  private pluginManager!: PluginManager;

  public constructor(
    private readonly engine: WorkflowEngine,
    private readonly dependencies: DependencyResolver,
    runtimeContext: RuntimeContext,
    eventBus: IEventBus,
    userInteraction: IUserInteraction
  ) {
    super();
    this.runtimeContext = runtimeContext;
    this.eventBus = eventBus;
    this.userInteraction = userInteraction;
    // configManager will be initialized in the initialize() method
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.logger.info('Initializing Unified Orchestration Service...');

      // Initialize configuration manager
      this.configManager = await getUnifiedConfigurationManager();
      await this.configManager.initialize();
      this.config = this.configManager.getConfiguration();

      // Initialize domain services
      const securityLogger = createLogger('UnifiedSecurityValidator');
      const performanceLogger = createLogger('UnifiedPerformanceSystem');

      this.securityValidator = new UnifiedSecurityValidator(securityLogger);
      this.performanceSystem = new UnifiedPerformanceSystem(performanceLogger, this.eventBus);
      this.registerCleanup((): void => {
        this.performanceSystem.shutdown();
      });

      // Initialize agent system
      this.agentSystem = new UnifiedAgentSystem();
      await this.agentSystem.initialize();
      this.registerCleanup((): void => {
        void this.agentSystem.shutdown();
      });

      // Inject concrete runtime dependencies (from application layer) into domain instances
      // Inject Rust backend if available via RuntimeContext
      try {
        const runtimeContext = this.runtimeContext as RuntimeContextWithBackend;
        const rustBackend = runtimeContext?.rustBackend;
        if (rustBackend) {
          // Attach to domain systems so they can pick it up when constructing executors
          (this.agentSystem as BackendCapableSystem).rustBackend = rustBackend;
        }
      } catch (e) {
        // Non-fatal: if injection fails, domain systems will use TypeScript fallbacks
        this.logger.warn('Failed to inject rustBackend into agentSystem', e);
      }

      // Initialize server system
      const serverLogger = createLogger('UnifiedServerSystem');
      this.serverSystem = new UnifiedServerSystem(
        serverLogger,
        this.config,
        this.eventBus,
        this.userInteraction,
        this.securityValidator,
        this.performanceSystem
      );
      this.registerCleanup(async (): Promise<void> => {
        await this.serverSystem.stopAllServers();
      });

      const initialMcpServers = this.serverSystem.getMCPServers();
      await Promise.all(
        initialMcpServers.map(async serverInfo => {
          const profile = this.toServerProfile(serverInfo);
          await this.healthMonitor.checkHealth(profile);
          this.metricsCollector.record(profile, 'startup', 1);
        })
      );

      // Also inject rust backend into server system if available
      try {
        const runtimeContext = this.runtimeContext as RuntimeContextWithBackend;
        const rustBackend = runtimeContext?.rustBackend;
        if (rustBackend) {
          (this.serverSystem as BackendCapableSystem).rustBackend = rustBackend;
        }
      } catch (e) {
        this.logger.warn('Failed to inject rustBackend into serverSystem', e);
      }

      // Initialize CQRS: command bus and register agent operation handlers
      this.commandBus = new CommandBus();
      this.commandRegistry = new CommandRegistry(this.commandBus);
      // register generic plugin dispatch
      this.commandBus.register(
        new PluginDispatchHandler(this.commandRegistry) as unknown as Readonly<
          import('../cqrs/command-bus.js').CommandHandler<unknown, unknown>
        >
      );
      const agentOps: Array<OrchestrationRequest['type']> = [
        'analyze',
        'generate',
        'refactor',
        'test',
        'document',
        'debug',
        'optimize',
      ];
      for (const op of agentOps) {
        this.commandBus.register(
          new AgentOperationHandler(
            `agent:${op}`,
            async (req: Readonly<OrchestrationRequest>): Promise<unknown> => {
              const extendedReq: ExtendedOrchestrationRequest = {
                ...req,
                input: req.payload || req.command || '',
              };
              return this.processAgentRequest(extendedReq);
            }
          ) as unknown as Readonly<
            import('../cqrs/command-bus.js').CommandHandler<unknown, unknown>
          >
        );
      }

      // Initialize Plugin System
      this.pluginManager = new PluginManager({
        registerCommand: (
          name: Readonly<string>,
          handler: (...args: ReadonlyArray<unknown>) => unknown
        ): void => {
          // Register with command bus for execution
          this.commandRegistry?.register(name, handler, { plugin: 'plugin' });

          // Also expose via dependency resolver so executePluginCommand works
          this.registerPlugin(name, async (...args: unknown[]) => {
            return Promise.resolve(handler(...args));
          });

          this.eventBus.emit('plugin:command_registered', { name });
        },
      });

      // Use project root resolution to avoid deep relative paths
      const { resolvePluginDirectories } = await import(
        '../../infrastructure/plugins/plugin-path-resolver.js'
      );
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const projectRoot = path.resolve(__dirname, '../../..');
      const pluginDirs = resolvePluginDirectories({ cwd: projectRoot });
      const factories = await discoverPlugins(pluginDirs);
      await this.pluginManager.loadFromFactories(factories);
      await this.pluginManager.initializeAll();
      await this.pluginManager.startAll();

      this.initialized = true;
      this.emit('initialized');
      this.logger.info('Unified Orchestration Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Unified Orchestration Service:', error);
      throw error;
    }
  }

  public async processRequest(
    request: Readonly<ExtendedOrchestrationRequest>
  ): Promise<ExtendedOrchestrationResponse> {
    if (!this.initialized) {
      throw new Error('Orchestration service not initialized');
    }

    const startTime = Date.now();
    this.activeRequests.set(request.id, request);

    try {
      this.logger.info(`Processing orchestration request: ${request.id} (${request.type})`);

      // Validate input
      await this.validateRequest(request);

      // Route to appropriate service
      let result: unknown;
      const componentsUsed: string[] = [];

      switch (request.command) {
        case 'analyze':
        case 'generate':
        case 'refactor':
        case 'test':
        case 'document':
        case 'debug':
        case 'optimize':
          if (!this.commandBus) throw new Error('Command bus not initialized');
          result = await this.commandBus.execute({
            type: `agent:${request.command}`,
            payload: { request },
          });
          componentsUsed.push('AgentSystem');
          break;

        case 'serve':
          result = await this.processServerRequest(request);
          componentsUsed.push('ServerSystem');
          break;

        default:
          throw new Error(`Unsupported request command: ${request.command}`);
      }

      const processingTime = Date.now() - startTime;
      const resourceUsage = this.getResourceUsage();

      const response: ExtendedOrchestrationResponse = {
        id: request.id,
        success: true,
        result,
        error: undefined,
        metadata: {
          processingTime,
          componentsUsed,
          resourceUsage,
        },
      };

      this.emit('request-completed', { request, response });

      // Track successful request metrics
      this.totalProcessedRequests++;
      this.responseTimeSum += processingTime;
      this.responseTimes.push(processingTime);

      return response;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      const response: ExtendedOrchestrationResponse = {
        id: request.id,
        success: false,
        result: undefined,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          processingTime,
          componentsUsed: [],
          resourceUsage: this.getResourceUsage(),
        },
      };

      this.emit('request-failed', { request, response, error });
      this.logger.error(`Orchestration request failed: ${request.id}`, error);

      // Track failed request metrics
      this.totalProcessedRequests++;
      this.totalFailedRequests++;
      this.responseTimeSum += processingTime;
      this.responseTimes.push(processingTime);

      return response;
    } finally {
      this.activeRequests.delete(request.id);
    }
  }

  private async processAgentRequest(
    request: Readonly<ExtendedOrchestrationRequest>
  ): Promise<unknown> {
    // Map command types to AgentRequest types - using command field from base interface
    const typeMapping: Record<string, string> = {
      analyze: 'analyze',
      generate: 'generate',
      refactor: 'refactor',
      test: 'test',
      document: 'document',
      debug: 'debug',
      optimize: 'optimize',
      serve: 'file-operation', // Map serve to file-operation since serve isn't supported by AgentRequest
    };

    const agentRequest = {
      id: request.id,
      type: typeMapping[request.command] as
        | 'analyze'
        | 'generate'
        | 'refactor'
        | 'test'
        | 'document'
        | 'debug'
        | 'optimize'
        | 'research'
        | 'git-operation'
        | 'file-operation'
        | 'collaborate',
      input: typeof request.input === 'string' ? request.input : JSON.stringify(request.input),
      priority: request.options?.priority || 'medium',
      constraints: {
        maxExecutionTime: request.options?.timeout,
        securityLevel: 'high' as const,
      },
      preferences: {
        mode: request.options?.mode || 'balanced',
        outputFormat: 'structured' as const,
        includeReasoning: true,
        verboseLogging: false,
        interactiveMode: false,
      },
      context: this.createProjectContext(request.context),
    };

    if (request.options?.collaborative) {
      // Use multiple agents for collaborative processing
      const agents = this.agentSystem.getAllAgents();
      const suitableAgents = agents.slice(0, 3); // Limit to 3 agents for collaboration

      if (suitableAgents.length > 1) {
        const collaborativeTask = {
          id: request.id,
          description:
            typeof request.input === 'string' ? request.input : JSON.stringify(request.input),
          requirements: [request.type, request.command].filter(
            (req): req is string => req !== undefined
          ),
          expectedOutput: 'Collaborative response',
          coordination: {
            type: 'parallel' as const,
            participants: suitableAgents.map(a => a.id),
            coordination: 'peer-to-peer' as const,
            conflictResolution: 'majority-vote' as const,
          },
        };

        const collaborativeResponse = await suitableAgents[0].collaborate(
          suitableAgents,
          collaborativeTask
        );
        return collaborativeResponse.result;
      }
    }

    const response = await this.agentSystem.processRequest(agentRequest);
    return response.result as unknown;
  }

  private async processServerRequest(request: ExtendedOrchestrationRequest): Promise<{
    message: string;
    config: unknown;
    status: unknown;
  }> {
    const serverOptions = request.input as {
      port?: number;
      host?: string;
      cors?: boolean;
      corsOrigins?: string[];
      auth?: {
        enabled?: boolean;
        tokens?: string[];
      };
      maxConnections?: number;
      timeout?: number;
    };

    const serverConfig = {
      port: serverOptions.port || 3002,
      host: serverOptions.host || '0.0.0.0',
      cors: {
        enabled: serverOptions.cors !== false,
        origins: serverOptions.corsOrigins || ['*'],
        credentials: false,
      },
      authentication: {
        enabled: serverOptions.auth?.enabled || false,
        strategy: 'bearer' as const,
        tokens: serverOptions.auth?.tokens,
      },
      websocket: {
        enabled: true,
        path: '/socket.io',
      },
      mcp: {
        enabled: true,
        discoveryPath: '/mcp',
        toolsPath: '/mcp/tools',
      },
      maxConnections: serverOptions.maxConnections || 100,
      timeout: serverOptions.timeout || 30000,
      bodyLimit: '10mb',
      compression: true,
      logging: true,
    };

    await this.serverSystem.startServer('hybrid', serverConfig);

    return {
      message: 'Server started successfully',
      config: serverConfig,
      status: this.serverSystem.getAllServerStatus(),
    };
  }

  private async validateRequest(request: ExtendedOrchestrationRequest): Promise<void> {
    // Validate request structure
    if (!request.id || !request.command || request.input === undefined) {
      throw new Error('Invalid request: missing required fields');
    }

    // Security validation
    const inputString =
      typeof request.input === 'string' ? request.input : JSON.stringify(request.input);

    const validation = await this.securityValidator.validateInput(inputString, {
      sessionId: request.id,
      requestId: request.id,
      userAgent: 'CodeCrucible-OrchestrationService',
      ipAddress: '127.0.0.1',
      timestamp: new Date(),
      operationType: 'orchestration-input',
      environment: 'development',
      permissions: ['orchestration', request.command],
      metadata: {
        requestType: request.command,
        timestamp: Date.now(),
      },
    });

    if (!validation.isValid) {
      const violationMessages = validation.violations.map(v => v.message);
      throw new Error(`Security validation failed: ${violationMessages.join(', ')}`);
    }

    // Performance constraints
    if (request.options?.timeout && request.options.timeout > 300000) {
      // 5 minutes max
      throw new Error('Request timeout too high');
    }
  }

  private createProjectContext(context?: {
    workingDirectory?: string;
    language?: string[];
    frameworks?: string[];
  }): ProjectContext {
    // Create a minimal ProjectContext with defaults for missing properties
    return {
      rootPath: context?.workingDirectory || process.cwd(),
      language: context?.language || ['typescript'],
      frameworks: context?.frameworks || [],
      dependencies: new Map(),
      structure: {
        directories: [],
        files: new Map(),
        entryPoints: [],
        testDirectories: [],
        configFiles: [],
      },
      documentation: {
        readme: [],
        guides: [],
        api: [],
        examples: [],
        changelog: [],
      },
    };
  }

  private getResourceUsage(): { memory: number; cpu: number } {
    const memUsage = process.memoryUsage();
    return {
      memory: memUsage.heapUsed / 1024 / 1024, // MB
      cpu: process.cpuUsage().system / 1000000, // Approximate CPU usage
    };
  }

  // Service management methods
  public async startServer(
    port: number = 3002,
    options?: Readonly<Record<string, unknown>>
  ): Promise<unknown> {
    const serverRequest: ExtendedOrchestrationRequest = {
      id: `server-${Date.now()}`,
      command: 'serve',
      input: { port, ...options },
      options: { priority: 'high' },
    };

    return this.processRequest(serverRequest);
  }

  public async stopServer(): Promise<void> {
    await this.serverSystem.stopAllServers();
  }

  public async processAnalysis(
    input: string,
    options?: Readonly<Record<string, unknown>>
  ): Promise<unknown> {
    const analysisRequest: ExtendedOrchestrationRequest = {
      id: `analysis-${Date.now()}`,
      command: 'analyze',
      input,
      options,
    };

    const response = await this.processRequest(analysisRequest);
    return response.result;
  }

  public async processGeneration(
    input: string,
    options?: Readonly<Record<string, unknown>>
  ): Promise<unknown> {
    const generationRequest: ExtendedOrchestrationRequest = {
      id: `generation-${Date.now()}`,
      command: 'generate',
      input,
      options,
    };

    const response = await this.processRequest(generationRequest);
    return response.result;
  }

  // System status and metrics
  public getSystemStatus(): {
    initialized: boolean;
    activeRequests: number;
    components: {
      agentSystem: unknown;
      serverSystem: unknown;
      securityValidator: boolean;
      performanceSystem: unknown;
    };
  } {
    return {
      initialized: this.initialized,
      activeRequests: this.activeRequests.size,
      components: {
        agentSystem: this.agentSystem.getSystemStats(),
        serverSystem: this.serverSystem.getSystemMetrics(),
        securityValidator: this.securityValidator.isInitialized || false,
        performanceSystem: this.performanceSystem.getSystemMetrics(),
      },
    };
  }

  public async shutdown(): Promise<void> {
    this.logger.info('UnifiedOrchestrationService shutting down');
  }

  // === Missing Interface Methods ===

  /**
   * Register a cleanup handler for shutdown
   */
  private registerCleanup(handler: () => void | Promise<void>): void {
    this.cleanupHandlers.push(handler);
  }

  /**
   * Setup event handlers for system events
   */
  private setupEventHandlers(): void {
    this.eventBus.on('system:shutdown', (): void => {
      void this.shutdown();
    });

    // Forward important events
    this.eventBus.on('agent:request', data => this.emit('agent-request', data));
    this.eventBus.on('server:request', data => this.emit('server-request', data));
    this.eventBus.on('security:violation', data => this.emit('security-violation', data));
    this.eventBus.on('performance:warning', data => this.emit('performance-warning', data));
  }

  /**
   * Get performance statistics for the orchestration service
   */
  public getPerformanceStats(): {
    orchestrationMetrics: {
      activeRequests: number;
      totalProcessed: number;
      averageResponseTime: number;
      successRate: number;
    };
    systemStatus: {
      initialized: boolean;
      uptime: number;
      memoryUsage: NodeJS.MemoryUsage;
      timestamp: number;
    };
  } & Record<string, unknown> {
    this.logger.debug('Getting performance stats');

    const performanceStats = this.performanceSystem.getMetrics();

    return {
      ...performanceStats,
      orchestrationMetrics: {
        activeRequests: this.activeRequests.size,
        totalProcessed: this.getTotalProcessedRequests(),
        averageResponseTime: this.getAverageResponseTime(),
        successRate: this.getSuccessRate(),
      },
      systemStatus: {
        initialized: this.initialized,
        uptime: this.getUptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Synthesize integrated result from multiple components
   */
  public synthesizeIntegratedResult(
    results: ReadonlyArray<unknown>,
    options: Readonly<Record<string, unknown>> = {}
  ): {
    success: boolean;
    content?: string;
    confidence?: number;
    error?: string;
    synthesis?: unknown;
    timestamp: number;
  } & Record<string, unknown> {
    this.logger.info('Synthesizing integrated result from components');

    if (results.length === 0) {
      return {
        success: false,
        error: 'No results to synthesize',
        synthesis: null,
        timestamp: Date.now(),
      };
    }

    try {
      // Define an interface for result objects
      interface SynthesisResult {
        success?: boolean;
        [key: string]: unknown;
      }

      // Aggregate successful results
      const successfulResults = results.filter(
        (r): r is SynthesisResult =>
          !!r && typeof r === 'object' && (r as SynthesisResult).success !== false
      );
      const failedResults = results.filter(
        (r): r is SynthesisResult =>
          !r || (typeof r === 'object' && (r as SynthesisResult).success === false)
      );

      // Calculate confidence based on success rate
      const confidence = successfulResults.length / results.length;

      // Synthesize the main result
      const synthesizedContent = this.combineResults(successfulResults, options);

      // Extract metadata from all results
      const metadata = this.extractMetadata([...results]);

      const synthesis = {
        success: true,
        content: synthesizedContent,
        confidence,
        componentsUsed: metadata.componentsUsed,
        processingTime: metadata.totalProcessingTime,
        qualityMetrics: {
          completeness: this.calculateCompleteness(successfulResults),
          consistency: this.calculateConsistency(successfulResults),
          accuracy: confidence,
        },
        statistics: {
          totalInputs: results.length,
          successfulInputs: successfulResults.length,
          failedInputs: failedResults.length,
          averageConfidence: this.calculateAverageConfidence(successfulResults),
        },
        timestamp: Date.now(),
      };

      this.logger.info(`Synthesis completed with ${confidence * 100}% confidence`);
      return synthesis;
    } catch (error) {
      this.logger.error('Error during result synthesis:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown synthesis error',
        synthesis: null,
        timestamp: Date.now(),
      };
    }
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

  private toServerProfile(info: MCPServerInfo): MCPServerProfile {
    return {
      id: info.id,
      name: info.name,
      description: info.description,
      vendor: undefined,
      version: info.version,
      capabilities: [],
      performance: {
        averageLatency: 0,
        throughput: 0,
        concurrentConnectionLimit: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        errorRate: 0,
        uptime: 0,
      },
      reliability: {
        availabilityScore: 1,
        mttr: 0,
        mtbf: 0,
        errorCount: 0,
        successRate: 1,
        consecutiveFailures: 0,
      },
      compatibility: {
        protocolVersions: [],
        requiredFeatures: [],
        optionalFeatures: [],
        platformSupport: [],
        dependencies: [],
      },
      cost: undefined,
      lastSeen: info.lastPing ?? new Date(),
      status: info.status === 'active' ? ServerProfileStatus.ACTIVE : ServerProfileStatus.INACTIVE,
    };
  }

  // === Helper Methods for Performance Stats ===

  private getTotalProcessedRequests(): number {
    return this.totalProcessedRequests;
  }

  private getAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;
    return this.responseTimeSum / this.responseTimes.length;
  }

  private getSuccessRate(): number {
    const total = this.totalProcessedRequests;
    if (total === 0) return 1.0;
    const successful = total - this.totalFailedRequests;
    return successful / total;
  }

  private getUptime(): number {
    return Date.now() - this.startTime;
  }

  // === Helper Methods for Result Synthesis ===

  private combineResults(
    results: readonly unknown[],
    _options: Readonly<Record<string, unknown>>
  ): string {
    // Simple combination - in a real implementation this would be more sophisticated
    return results.map(r => (typeof r === 'string' ? r : JSON.stringify(r))).join('\n\n');
  }

  private extractMetadata(results: readonly unknown[]): {
    componentsUsed: string[];
    totalProcessingTime: number;
  } {
    // Simple metadata extraction - in a real implementation this would analyze result metadata
    return {
      componentsUsed: ['UnifiedOrchestrationService'],
      totalProcessingTime: 0,
    };
  }

  private calculateCompleteness(results: readonly unknown[]): number {
    // Simple completeness calculation
    return results.length > 0 ? 1.0 : 0.0;
  }

  private calculateConsistency(results: readonly unknown[]): number {
    // Simple consistency calculation
    return results.length > 0 ? 1.0 : 0.0;
  }

  private calculateAverageConfidence(results: readonly unknown[]): number {
    // Simple confidence calculation
    return results.length > 0 ? 0.8 : 0.0;
  }
}

/**
 * Factory to create a unified orchestration service from runtime context.
 */
export function createUnifiedOrchestrationServiceWithContext(
  context: RuntimeContext,
  eventBus: IEventBus,
  userInteraction: IUserInteraction
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

  return new UnifiedOrchestrationService(engine, dependencies, context, eventBus, userInteraction);
}
