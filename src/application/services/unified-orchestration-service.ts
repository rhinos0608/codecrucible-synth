/**
 * Unified Orchestration Service - Application Layer
 *
 * Moved from /src/core/services/unified-orchestration-service.ts
 * This belongs in the Application layer as it orchestrates domain services
 * and coordinates between different layers.
 */

import { EventEmitter } from 'events';
import { IEventBus } from '../../domain/interfaces/event-bus.js';
import { IUserInteraction } from '../../domain/interfaces/user-interaction.js';
import { UnifiedConfiguration } from '../../domain/interfaces/configuration.js';
import {
  UnifiedConfigurationManager,
  getUnifiedConfigurationManager,
} from '../../domain/config/config-manager.js';
import { UnifiedAgentSystem, ProjectContext } from '../../domain/services/unified-agent-system.js';
import { UnifiedServerSystem } from '../../domain/services/unified-server-system.js';
import { UnifiedSecurityValidator } from '../../domain/services/unified-security-validator.js';
import { UnifiedPerformanceSystem } from '../../domain/services/unified-performance-system.js';
import { createLogger } from '../../infrastructure/logging/logger-adapter.js';
import { PluginManager } from './plugin-manager.js';
import { CommandBus } from '../cqrs/command-bus.js';
import { AgentOperationHandler } from '../cqrs/handlers/agent-operation-handler.js';
import { PluginDispatchHandler } from '../cqrs/handlers/plugin-dispatch-handler.js';
import { discoverPlugins } from '../../infrastructure/plugins/plugin-loader.js';
import { CommandRegistry } from './command-registry.js';
import { RuntimeContext } from '../runtime/runtime-context.js';

// Interface for runtime context with optional Rust backend
interface RuntimeContextWithBackend extends RuntimeContext {
  rustBackend?: {
    isAvailable(): boolean;
    execute(request: unknown): Promise<unknown>;
  };
}

// Interface for systems that can accept Rust backend injection
interface BackendCapableSystem {
  rustBackend?: unknown;
}

export interface OrchestrationRequest {
  readonly id: string;
  readonly type:
    | 'analyze'
    | 'generate'
    | 'refactor'
    | 'test'
    | 'document'
    | 'debug'
    | 'optimize'
    | 'serve';
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

export interface OrchestrationResponse {
  id: string;
  success: boolean;
  result?: unknown;
  error?: string;
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
 * Central orchestration service that coordinates all system components.
 * This is the main application service that handles high-level requests
 * and routes them to appropriate domain services.
 */
export class UnifiedOrchestrationService extends EventEmitter {
  private config!: UnifiedConfiguration;
  private readonly eventBus: IEventBus;
  private readonly userInteraction: IUserInteraction;
  private readonly logger = createLogger('UnifiedOrchestrationService');
  private readonly runtimeContext?: RuntimeContext;

  // Domain services
  private readonly configManager: UnifiedConfigurationManager;
  private agentSystem!: UnifiedAgentSystem;
  private serverSystem!: UnifiedServerSystem;
  private securityValidator!: UnifiedSecurityValidator;
  private performanceSystem!: UnifiedPerformanceSystem;
  private pluginManager?: PluginManager;
  private commandBus?: CommandBus;
  private commandRegistry?: CommandRegistry;

  private initialized = false;
  private readonly activeRequests = new Map<string, OrchestrationRequest>();
  private readonly cleanupHandlers: Array<() => Promise<void> | void> = [];

  public registerCleanup(handler: () => Promise<void> | void): void {
    this.cleanupHandlers.push(handler);
  }

  public constructor(
    configManager: UnifiedConfigurationManager,
    eventBus: IEventBus,
    userInteraction: IUserInteraction,
    runtimeContext?: RuntimeContext
  ) {
    super();

    this.configManager = configManager;
    this.eventBus = eventBus;
    this.userInteraction = userInteraction;
    this.runtimeContext = runtimeContext;
    this.logger.info('UnifiedOrchestrationService initialized with dependency injection');

    this.setupEventHandlers();
  }

  /**
   * Get singleton instance
   * @deprecated Use createUnifiedOrchestrationServiceWithContext instead
   */
  public static async getInstance(options?: {
    configManager?: UnifiedConfigurationManager;
    eventBus?: IEventBus;
    userInteraction?: IUserInteraction;
  }): Promise<UnifiedOrchestrationService> {
    // Create dependencies if not provided
    const configManager = options?.configManager || (await getUnifiedConfigurationManager());

    // Import dependencies to avoid circular imports
    const { EventBus } = await import('../../infrastructure/messaging/event-bus.js');
    const { CLIUserInteraction } = await import(
      '../../infrastructure/user-interaction/cli-user-interaction.js'
    );

    const eventBus = options?.eventBus ?? new EventBus();
    const userInteraction = options?.userInteraction ?? new CLIUserInteraction();

    const service = new UnifiedOrchestrationService(configManager, eventBus, userInteraction);
    await service.initialize();
    return service;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.logger.info('Initializing Unified Orchestration Service...');

      // Initialize configuration
      await this.configManager.initialize();
      this.config = this.configManager.getConfiguration();

      // Initialize domain services
      const securityLogger = createLogger('UnifiedSecurityValidator');
      const performanceLogger = createLogger('UnifiedPerformanceSystem');

      this.securityValidator = new UnifiedSecurityValidator(securityLogger);
      this.performanceSystem = new UnifiedPerformanceSystem(performanceLogger, this.eventBus);
      this.registerCleanup(async (): Promise<void> => {
        await this.performanceSystem.shutdown();
      });

      // Initialize agent system
      this.agentSystem = new UnifiedAgentSystem(
        this.config,
        this.eventBus,
        this.userInteraction,
        this.securityValidator,
        this.performanceSystem
      );
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
      this.commandBus.register(new PluginDispatchHandler(this.commandRegistry) as any);
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
            async (req): Promise<unknown> => this.processAgentRequest(req)
          ) as any
        );
      }

      // Initialize Plugin System
      this.pluginManager = new PluginManager({
        registerCommand: (name: string, handler: Function) => {
          this.commandRegistry?.register(name, handler as (...args: any[]) => any, {
            plugin: 'plugin',
          });
          this.eventBus.emit('plugin:command_registered', { name });
        },
      });

      // Use project root resolution to avoid deep relative paths
      const projectRoot = new URL('../../..', import.meta.url).pathname;
      const pluginDirs = [
        // runtime compiled plugins
        `${projectRoot}/dist/plugins`,
        // source plugins for dev mode
        `${projectRoot}/src/plugins`,
      ];
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

  async processRequest(request: OrchestrationRequest): Promise<OrchestrationResponse> {
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

      switch (request.type) {
        case 'analyze':
        case 'generate':
        case 'refactor':
        case 'test':
        case 'document':
        case 'debug':
        case 'optimize':
          if (!this.commandBus) throw new Error('Command bus not initialized');
          result = await this.commandBus.execute({
            type: `agent:${request.type}`,
            payload: { request },
          });
          componentsUsed.push('AgentSystem');
          break;

        case 'serve':
          result = await this.processServerRequest(request);
          componentsUsed.push('ServerSystem');
          break;

        default:
          throw new Error('Unsupported request type');
      }

      const processingTime = Date.now() - startTime;
      const resourceUsage = await this.getResourceUsage();

      const response: OrchestrationResponse = {
        id: request.id,
        success: true,
        result,
        metadata: {
          processingTime,
          componentsUsed,
          resourceUsage,
        },
      };

      this.emit('request-completed', { request, response });
      return response;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      const response: OrchestrationResponse = {
        id: request.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          processingTime,
          componentsUsed: [],
          resourceUsage: await this.getResourceUsage(),
        },
      };

      this.emit('request-failed', { request, response, error });
      this.logger.error(`Orchestration request failed: ${request.id}`, error);

      return response;
    } finally {
      this.activeRequests.delete(request.id);
    }
  }

  private async processAgentRequest(request: OrchestrationRequest): Promise<unknown> {
    // Map OrchestrationRequest types to AgentRequest types
    const typeMapping: Record<OrchestrationRequest['type'], string> = {
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
      type: typeMapping[request.type] as
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
          requirements: [request.type],
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
    return response.result;
  }

  private async processServerRequest(request: OrchestrationRequest): Promise<{
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

  private async validateRequest(request: OrchestrationRequest): Promise<void> {
    // Validate request structure
    if (!request.id || !request.type || request.input === undefined) {
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
      permissions: ['orchestration', request.type],
      metadata: {
        requestType: request.type,
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

  // Service management methods
  async startServer(port: number = 3002, options?: Record<string, unknown>): Promise<unknown> {
    const serverRequest: OrchestrationRequest = {
      id: `server-${Date.now()}`,
      type: 'serve',
      input: { port, ...options },
      options: { priority: 'high' },
    };

    return await this.processRequest(serverRequest);
  }

  async stopServer(): Promise<void> {
    if (this.serverSystem) {
      await this.serverSystem.stopAllServers();
    }
  }

  async processAnalysis(input: string, options?: Record<string, unknown>): Promise<unknown> {
    const analysisRequest: OrchestrationRequest = {
      id: `analysis-${Date.now()}`,
      type: 'analyze',
      input,
      options,
    };

    const response = await this.processRequest(analysisRequest);
    return response.result;
  }

  async processGeneration(input: string, options?: Record<string, unknown>): Promise<unknown> {
    const generationRequest: OrchestrationRequest = {
      id: `generation-${Date.now()}`,
      type: 'generate',
      input,
      options,
    };

    const response = await this.processRequest(generationRequest);
    return response.result;
  }

  // System status and metrics
  getSystemStatus(): {
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
        agentSystem: this.agentSystem ? this.agentSystem.getSystemStats() : null,
        serverSystem: this.serverSystem ? this.serverSystem.getSystemMetrics() : null,
        securityValidator: this.securityValidator?.isInitialized || false,
        performanceSystem: this.performanceSystem
          ? this.performanceSystem.getSystemMetrics()
          : null,
      },
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Unified Orchestration Service...');

    try {
      // Cancel active requests
      for (const [id, request] of this.activeRequests.entries()) {
        this.logger.warn(`Cancelling active request: ${id}`);
        this.emit('request-cancelled', request);
      }
      this.activeRequests.clear();

      // Cleanup handlers
      for (const handler of this.cleanupHandlers) {
        try {
          await handler();
        } catch (err) {
          this.logger.error('Error in cleanup handler during shutdown:', err);
        }
      }

      this.initialized = false;
      this.emit('shutdown');
      this.removeAllListeners();

      this.logger.info('Unified Orchestration Service shut down successfully');
    } catch (error) {
      this.logger.error('Error during orchestration service shutdown:', error);
      throw error;
    }
  }

  // === Missing Interface Methods ===

  /**
   * Get performance statistics for the orchestration service
   */
  getPerformanceStats(): {
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

    const performanceStats = this.performanceSystem
      ? this.performanceSystem.getMetrics()
      : this.getBasicPerformanceStats();

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
  synthesizeIntegratedResult(
    results: unknown[],
    options: Record<string, unknown> = {}
  ): {
    success: boolean;
    content?: string;
    confidence?: number;
    error?: string;
    synthesis?: unknown;
    timestamp: number;
  } & Record<string, unknown> {
    this.logger.info('Synthesizing integrated result from components');

    if (!results || results.length === 0) {
      return {
        success: false,
        error: 'No results to synthesize',
        synthesis: null,
        timestamp: Date.now(),
      };
    }

    try {
      // Aggregate successful results
      const successfulResults = results.filter(r => r && (r as any)?.success !== false);
      const failedResults = results.filter(r => !r || (r as any)?.success === false);

      // Calculate confidence based on success rate
      const confidence = successfulResults.length / results.length;

      // Synthesize the main result
      const synthesizedContent = this.combineResults(successfulResults, options);

      // Extract metadata from all results
      const metadata = this.extractMetadata(results);

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

  // === Helper Methods for Interface Implementation ===

  private getBasicPerformanceStats(): {
    enabled: boolean;
    message: string;
    basicStats: {
      memoryUsage: NodeJS.MemoryUsage;
      uptime: number;
      timestamp: number;
    };
  } {
    return {
      enabled: false,
      message: 'Performance system not available',
      basicStats: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        timestamp: Date.now(),
      },
    };
  }

  private getTotalProcessedRequests(): number {
    // In a real implementation, this would track actual request counts
    return 0;
  }

  private getAverageResponseTime(): number {
    // In a real implementation, this would calculate actual average
    return 0;
  }

  private getSuccessRate(): number {
    // In a real implementation, this would calculate actual success rate
    return 1.0;
  }

  private getUptime(): number {
    return process.uptime() * 1000; // Convert to milliseconds
  }

  private combineResults(results: unknown[], options: Record<string, unknown>): string {
    // Simple combination strategy - in a real implementation this would be more sophisticated
    const contents = results
      .map(
        r => (r as any)?.content || (r as any)?.result || (r as any)?.response || JSON.stringify(r)
      )
      .filter(c => c && typeof c === 'string');

    if (options.synthesisStrategy === 'concatenate') {
      return contents.join('\n\n---\n\n');
    }

    // Default: extract key insights
    return `Integrated analysis based on ${results.length} components:\n\n${contents.join('\n\n')}`;
  }

  private extractMetadata(results: unknown[]): {
    componentsUsed: string[];
    totalProcessingTime: number;
  } {
    const componentsUsed: string[] = [];
    let totalProcessingTime = 0;

    results.forEach((result: unknown) => {
      const r = result as {
        metadata?: {
          componentsUsed?: string[];
          processingTime?: number;
        };
      };
      if (r.metadata?.componentsUsed) {
        componentsUsed.push(...r.metadata.componentsUsed);
      }
      if (r.metadata?.processingTime) {
        totalProcessingTime += r.metadata.processingTime;
      }
    });

    return {
      componentsUsed: [...new Set(componentsUsed)], // Remove duplicates
      totalProcessingTime,
    };
  }

  private calculateCompleteness(results: unknown[]): number {
    // Simple heuristic - percentage of results that have substantial content
    const substantialResults = results.filter((r: unknown) => {
      const result = r as {
        content?: string;
        result?: unknown;
      };
      return (
        (result.content && result.content.length > 100) ||
        (result.result && JSON.stringify(result.result).length > 100)
      );
    });
    return results.length > 0 ? substantialResults.length / results.length : 0;
  }

  private calculateConsistency(_results: unknown[]): number {
    return 0.8;
  }

  private calculateAverageConfidence(results: unknown[]): number {
    const confidenceValues = results
      .map((r: unknown) => {
        const result = r as {
          confidence?: number;
          score?: number;
        };
        return result.confidence || result.score || 0.5;
      })
      .filter((c: unknown): c is number => typeof c === 'number');
    return confidenceValues.length > 0
      ? confidenceValues.reduce((sum: number, c: number) => sum + c, 0) / confidenceValues.length
      : 0.5;
  }

  listPluginCommands() {
    if (!this.commandRegistry) return [];
    try {
      return this.commandRegistry.list().map((c: unknown) => {
        const command = c as {
          name: string;
          meta?: {
            description?: string;
            plugin?: string;
            version?: string;
          };
        };
        return {
          name: command.name,
          description: command.meta?.description,
          plugin: command.meta?.plugin,
          version: command.meta?.version,
        };
      });
    } catch {
      return [];
    }
  }

  async executePluginCommand(name: string, ...args: unknown[]): Promise<unknown> {
    if (!this.commandRegistry) throw new Error('Command registry not initialized');
    return this.commandRegistry.execute(name, ...args);
  }
}

// Factory function for easy creation
export function createUnifiedOrchestrationService(
  configManager: UnifiedConfigurationManager,
  eventBus: IEventBus,
  userInteraction: IUserInteraction
): UnifiedOrchestrationService {
  return new UnifiedOrchestrationService(configManager, eventBus, userInteraction);
}

// New factory function that uses RuntimeContext for dependency injection
export function createUnifiedOrchestrationServiceWithContext(
  runtimeContext: RuntimeContext,
  configManager: UnifiedConfigurationManager,
  userInteraction: IUserInteraction
): UnifiedOrchestrationService {
  return new UnifiedOrchestrationService(
    configManager,
    runtimeContext.eventBus,
    userInteraction,
    runtimeContext
  );
}
