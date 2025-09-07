
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
import { ProjectContext, UnifiedAgentSystem } from '../../domain/services/unified-agent/index.js';
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
    isAvailable: () => boolean;
    execute: (request: unknown) => Promise<unknown>;
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
      this.registerCleanup((): void => {
        this.performanceSystem.shutdown();
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
            async (req: Readonly<OrchestrationRequest>): Promise<unknown> =>
              this.processAgentRequest(req)
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
          this.commandRegistry?.register(name, handler, { plugin: 'plugin' });
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

  public async processRequest(
    request: Readonly<OrchestrationRequest>
  ): Promise<OrchestrationResponse> {
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
      const resourceUsage = this.getResourceUsage();

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
          resourceUsage: this.getResourceUsage(),
        },
      };

      this.emit('request-failed', { request, response, error });
      this.logger.error(`Orchestration request failed: ${request.id}`, error);

      return response;
    } finally {
      this.activeRequests.delete(request.id);
    }
  }

  private async processAgentRequest(request: Readonly<OrchestrationRequest>): Promise<unknown> {
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
    return response.result as unknown;
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
  public async startServer(
    port: number = 3002,
    options?: Readonly<Record<string, unknown>>
  ): Promise<unknown> {
    const serverRequest: OrchestrationRequest = {
      id: `server-${Date.now()}`,
      type: 'serve',
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
    const analysisRequest: OrchestrationRequest = {
      id: `analysis-${Date.now()}`,
      type: 'analyze',
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


  public async processRequest(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    return this.engine.execute(request);

  // === Missing Interface Methods ===

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

  private totalRequestsProcessed = 0;
  private requestMetrics: Array<{ timestamp: number; responseTime: number; success: boolean }> = [];
  private readonly maxMetricsHistory = 1000;
  private readonly serviceStartTime = Date.now();

  private getTotalProcessedRequests(): number {
    return this.totalRequestsProcessed;
  }

  private getAverageResponseTime(): number {
    if (this.requestMetrics.length === 0) return 0;

    const totalTime = this.requestMetrics.reduce((sum, metric) => sum + metric.responseTime, 0);
    return totalTime / this.requestMetrics.length;
  }

  private getSuccessRate(): number {
    if (this.requestMetrics.length === 0) return 1.0;

    const successfulRequests = this.requestMetrics.filter(metric => metric.success).length;
    return successfulRequests / this.requestMetrics.length;
  }

  private getUptime(): number {
    return Date.now() - this.serviceStartTime;
  }

  private recordRequestMetric(responseTime: number, success: boolean): void {
    this.totalRequestsProcessed++;
    this.requestMetrics.push({
      timestamp: Date.now(),
      responseTime,
      success,
    });

    // Maintain circular buffer of metrics
    if (this.requestMetrics.length > this.maxMetricsHistory) {
      this.requestMetrics.shift();
    }
  }

  private combineResults(
    results: ReadonlyArray<unknown>,
    options: Readonly<Record<string, unknown>>
  ): string {
    if (results.length === 0) return '';

    const extractContent = (result: unknown): string => {
      if (typeof result === 'string') return result;
      if (typeof result === 'object' && result !== null) {
        const obj = result as Record<string, unknown>;

        // Try different property names for content
        const contentKeys = ['content', 'result', 'response', 'output', 'data', 'text'];
        for (const key of contentKeys) {
          if (typeof obj[key] === 'string' && obj[key]) {
            return obj[key];
          }
        }

        // If no string content found, try to extract meaningful info
        if (obj.error) return `Error: ${JSON.stringify(obj.error)}`;
        if (obj.message) return String(obj.message);

        // Last resort: stringify but clean it up
        const stringified = JSON.stringify(obj, null, 2);
        return stringified.length > 500 ? `${stringified.substring(0, 500)}...` : stringified;
      }
      return String(result);
    };

    const contents = results.map(extractContent).filter(content => content.trim().length > 0);

    const strategy = (options.synthesisStrategy as string) || 'intelligent';

    switch (strategy) {
      case 'concatenate':
        return contents.join('\n\n---\n\n');

      case 'merge':
        return this.mergeContentIntelligently(contents);

      case 'summarize':
        return this.summarizeContents(contents);

      case 'intelligent':
      default:
        return this.intelligentCombination(contents, results.length);
    }
  }

  private mergeContentIntelligently(contents: string[]): string {
    if (contents.length === 0) return '';
    if (contents.length === 1) return contents[0];

    // Group similar content types
    const codeBlocks: string[] = [];
    const explanations: string[] = [];
    const errors: string[] = [];
    const other: string[] = [];

    contents.forEach(content => {
      if (content.includes('```') || content.includes('function') || content.includes('class')) {
        codeBlocks.push(content);
      } else if (
        content.toLowerCase().includes('error') ||
        content.toLowerCase().includes('failed')
      ) {
        errors.push(content);
      } else if (content.length > 100) {
        explanations.push(content);
      } else {
        other.push(content);
      }
    });

    const sections: string[] = [];

    if (explanations.length > 0) {
      sections.push(`## Analysis\n${explanations.join('\n\n')}`);
    }

    if (codeBlocks.length > 0) {
      sections.push(`## Code Examples\n${codeBlocks.join('\n\n')}`);
    }

    if (other.length > 0) {
      sections.push(`## Additional Information\n${other.join('\n')}`);
    }

    if (errors.length > 0) {
      sections.push(`## Issues Encountered\n${errors.join('\n')}`);
    }

    return sections.join('\n\n');
  }

  private summarizeContents(contents: string[]): string {
    if (contents.length === 0) return '';
    if (contents.length === 1) return contents[0];

    const totalLength = contents.reduce((sum, content) => sum + content.length, 0);
    const avgLength = totalLength / contents.length;

    let summary = `Summary of ${contents.length} components (avg length: ${Math.round(avgLength)} chars):\n\n`;

    contents.forEach((content, index) => {
      const preview = content.length > 150 ? `${content.substring(0, 150)}...` : content;
      summary += `${index + 1}. ${preview}\n\n`;
    });

    return summary;
  }

  private intelligentCombination(contents: string[], totalResults: number): string {
    if (contents.length === 0) return 'No content generated from components.';

    const header = `Integrated analysis from ${totalResults} components:\n\n`;

    if (contents.length === 1) {
      return header + contents[0];
    }

    // Detect if results are complementary or redundant
    const uniqueWords = new Set<string>();
    const allWords: string[] = [];

    contents.forEach(content => {
      const words = content
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3);
      allWords.push(...words);
      words.forEach(word => uniqueWords.add(word));
    });

    const redundancyRatio = uniqueWords.size / allWords.length;

    if (redundancyRatio < 0.3) {
      // High redundancy - summarize
      return header + this.summarizeContents(contents);
    } else {
      // Low redundancy - merge intelligently
      return header + this.mergeContentIntelligently(contents);
    }
  }

  private extractMetadata(results: ReadonlyArray<unknown>): {
    componentsUsed: string[];
    totalProcessingTime: number;
  } {
    const componentsUsed = new Set<string>();
    let totalProcessingTime = 0;

    results.forEach((result: unknown) => {
      if (typeof result === 'object' && result !== null) {
        const r = result as {
          metadata?: {
            componentsUsed?: string | string[];
            processingTime?: number;
            component?: string;
            source?: string;
          };
          component?: string;
          source?: string;
        };

        // Extract component names from various locations
        if (r.metadata?.componentsUsed) {
          if (Array.isArray(r.metadata.componentsUsed)) {
            r.metadata.componentsUsed.forEach(comp => componentsUsed.add(comp));
          } else if (typeof r.metadata.componentsUsed === 'string') {
            componentsUsed.add(r.metadata.componentsUsed);
          }
        }

        if (r.metadata?.component) componentsUsed.add(r.metadata.component);
        if (r.metadata?.source) componentsUsed.add(r.metadata.source);
        if (r.component) componentsUsed.add(String(r.component));
        if (r.source) componentsUsed.add(String(r.source));

        // Extract processing time
        if (typeof r.metadata?.processingTime === 'number') {
          totalProcessingTime += r.metadata.processingTime;
        }
      }
    });

    return {
      componentsUsed: Array.from(componentsUsed).filter(comp => comp.length > 0),
      totalProcessingTime,
    };
  }

  private calculateCompleteness(results: unknown[]): number {
    if (results.length === 0) return 0;

    const substantialResults = results.filter((r: unknown) => {
      if (typeof r === 'string') return r.length > 50;

      if (typeof r === 'object' && r !== null) {
        const result = r as Record<string, unknown>;

        // Check various content properties
        const contentKeys = ['content', 'result', 'response', 'output', 'data', 'text'];
        for (const key of contentKeys) {
          const value = result[key];
          if (typeof value === 'string' && value.length > 50) return true;
          if (value && typeof value === 'object') {
            const stringified = JSON.stringify(value);
            if (stringified.length > 100) return true;
          }
        }

        // Consider successful results as substantial
        if (result.success === true || result.status === 'success') return true;
      }

      return false;
    });

    return substantialResults.length / results.length;
  }

  private calculateConsistency(results: unknown[]): number {
    if (results.length <= 1) return 1.0;

    // Analyze consistency across multiple dimensions
    let successConsistency = 0;
    let contentConsistency = 0;
    let formatConsistency = 0;

    // Check success/failure consistency
    const successStatuses = results.map((r: unknown) => {
      if (typeof r === 'object' && r !== null) {
        const result = r as { success?: boolean; status?: string; error?: unknown };
        return result.success === true || result.status === 'success' || !result.error;
      }
      return true; // Assume success if no clear indicator
    });

    const successCount = successStatuses.filter(s => s).length;
    successConsistency = Math.abs(successCount - results.length / 2) / (results.length / 2);

    // Check content length consistency
    const contentLengths = results.map((r: unknown) => {
      if (typeof r === 'string') return r.length;
      if (typeof r === 'object' && r !== null) {
        return JSON.stringify(r).length;
      }
      return 0;
    });

    if (contentLengths.length > 0) {
      const avgLength = contentLengths.reduce((sum, len) => sum + len, 0) / contentLengths.length;
      const variance =
        contentLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) /
        contentLengths.length;
      const standardDeviation = Math.sqrt(variance);
      contentConsistency = avgLength > 0 ? Math.max(0, 1 - standardDeviation / avgLength) : 0;
    }

    // Check format consistency (all strings, all objects, etc.)
    const types = results.map(r => typeof r);
    const uniqueTypes = new Set(types);
    formatConsistency = 1 - (uniqueTypes.size - 1) / Math.max(1, types.length - 1);

    // Weighted average of consistency metrics
    return successConsistency * 0.4 + contentConsistency * 0.4 + formatConsistency * 0.2;
  }

  private calculateAverageConfidence(results: unknown[]): number {
    if (results.length === 0) return 0.5;

    const confidenceValues = results
      .map((r: unknown) => {
        if (typeof r === 'object' && r !== null) {
          const result = r as {
            confidence?: number;
            score?: number;
            quality?: number;
            certainty?: number;
            reliability?: number;
          };

          // Try multiple confidence indicators
          return (
            result.confidence ??
            result.score ??
            result.quality ??
            result.certainty ??
            result.reliability ??
            null
          );
        }
        return null;
      })
      .filter((c): c is number => typeof c === 'number' && c >= 0 && c <= 1);

    if (confidenceValues.length === 0) {
      // Infer confidence from success indicators
      const successCount = results.filter((r: unknown) => {
        if (typeof r === 'object' && r !== null) {
          const result = r as { success?: boolean; error?: unknown; status?: string };
          return result.success === true || (!result.error && result.status !== 'error');
        }
        return true;
      }).length;

      return successCount / results.length;
    }

    return confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length;
  }

  public listPluginCommands(): Array<{
    name: string;
    description?: string;
    plugin?: string;
    version?: string;
    category?: string;
    parameters?: Array<{ name: string; type: string; required: boolean; description?: string }>;
  }> {
    if (!this.commandRegistry) {
      this.logger.warn('Command registry not initialized');
      return [];
    }

    try {
      return this.commandRegistry.list().map((c: unknown) => {
        const command = c as {
          name: string;
          meta?: {
            description?: string;
            plugin?: string;
            version?: string;
            category?: string;
            parameters?: Array<{
              name: string;
              type: string;
              required: boolean;
              description?: string;
            }>;
          };
        };

        return {
          name: command.name,
          description: command.meta?.description ?? 'No description available',
          plugin: command.meta?.plugin ?? 'unknown',
          version: command.meta?.version ?? '1.0.0',
          category: command.meta?.category ?? 'general',
          parameters: command.meta?.parameters ?? [],
        };
      });
    } catch (error) {
      this.logger.error('Error listing plugin commands:', error);
      return [];
    }
  }

  public async executePluginCommand(
    name: Readonly<string>,
    ...args: ReadonlyArray<unknown>
  ): Promise<unknown> {
    if (!this.commandRegistry) {
      throw new Error('Command registry not initialized');
    }

    const startTime = Date.now();

    try {
      this.logger.info(`Executing plugin command: ${name} with ${args.length} arguments`);

      // Validate command exists
      const commands = this.listPluginCommands();
      const command = commands.find((cmd: Readonly<{ name: string }>) => cmd.name === name);

      if (!command) {
        throw new Error(
          `Plugin command '${name}' not found. Available commands: ${commands.map((c: Readonly<{ name: string }>) => c.name).join(', ')}`
        );
      }

      // Execute the command
      const result = (await this.commandRegistry.execute(name, ...(args as unknown[]))) as unknown;

      const executionTime = Date.now() - startTime;
      this.logger.info(`Plugin command '${name}' executed successfully in ${executionTime}ms`);

      // Record metrics
      this.recordRequestMetric(executionTime, true);

      // Emit event for monitoring
      this.eventBus.emit('plugin:command_executed', {
        name,
        args: args.length,
        executionTime,
        success: true,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Plugin command '${name}' failed after ${executionTime}ms:`, error);

      // Record failed metrics
      this.recordRequestMetric(executionTime, false);

      // Emit error event
      this.eventBus.emit('plugin:command_failed', {
        name,
        args: args.length,
        executionTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });

      throw error;
    }
  }
}

// Factory function for easy creation
export function createUnifiedOrchestrationService(
  configManager: Readonly<UnifiedConfigurationManager>,
  eventBus: Readonly<IEventBus>,
  userInteraction: Readonly<IUserInteraction>
): UnifiedOrchestrationService {
  return new UnifiedOrchestrationService(
    configManager as UnifiedConfigurationManager,
    eventBus as IEventBus,
    userInteraction as IUserInteraction
  );
}

// New factory function that uses RuntimeContext for dependency injection
export function createUnifiedOrchestrationServiceWithContext(
  runtimeContext: Readonly<RuntimeContext>,
  configManager: Readonly<UnifiedConfigurationManager>,
  userInteraction: Readonly<IUserInteraction>
): UnifiedOrchestrationService {
  return new UnifiedOrchestrationService(
    configManager as UnifiedConfigurationManager,
    runtimeContext.eventBus,
    userInteraction as IUserInteraction,
    runtimeContext as RuntimeContext
  );
}

