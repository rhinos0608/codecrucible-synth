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
import { UnifiedAgentSystem } from '../../domain/services/unified-agent-system.js';
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

export interface OrchestrationRequest {
  id: string;
  type: 'analyze' | 'generate' | 'refactor' | 'test' | 'document' | 'debug' | 'optimize' | 'serve';
  input: string | object;
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
  result?: any;
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
  private config: UnifiedConfiguration;
  private eventBus: IEventBus;
  private userInteraction: IUserInteraction;
  private logger = createLogger('UnifiedOrchestrationService');
  private runtimeContext?: RuntimeContext;

  // Domain services
  private configManager: UnifiedConfigurationManager;
  private agentSystem: UnifiedAgentSystem;
  private serverSystem: UnifiedServerSystem;
  private securityValidator: UnifiedSecurityValidator;
  private performanceSystem: UnifiedPerformanceSystem;
  private pluginManager?: PluginManager;
  private commandBus?: CommandBus;
  private commandRegistry?: CommandRegistry;

  private initialized = false;
  private activeRequests = new Map<string, OrchestrationRequest>();

  constructor(
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
  static async getInstance(options?: {
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

    const eventBus = options?.eventBus || new EventBus();
    const userInteraction = options?.userInteraction || new CLIUserInteraction();

    const service = new UnifiedOrchestrationService(configManager, eventBus, userInteraction);
    await service.initialize();
    return service;
  }

  async initialize(): Promise<void> {
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

      // Initialize agent system
      this.agentSystem = new UnifiedAgentSystem(
        this.config,
        this.eventBus,
        this.userInteraction,
        this.securityValidator,
        this.performanceSystem
      );
      await this.agentSystem.initialize();

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

      // Initialize CQRS: command bus and register agent operation handlers
      this.commandBus = new CommandBus();
      this.commandRegistry = new CommandRegistry(this.commandBus);
      // register generic plugin dispatch
      this.commandBus.register(new PluginDispatchHandler(this.commandRegistry));
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
          new AgentOperationHandler(`agent:${op}`, req => this.processAgentRequest(req))
        );
      }

      // Initialize Plugin System
      this.pluginManager = new PluginManager({
        registerCommand: (name: string, handler: Function) => {
          this.commandRegistry?.register(name, handler as any, { plugin: 'plugin' });
          this.eventBus.emit('plugin:command_registered', { name });
        },
      });

      const pluginDirs = [
        // runtime compiled plugins
        new URL('../../../dist/plugins', import.meta.url).pathname,
        // source plugins for dev mode
        new URL('../../../src/plugins', import.meta.url).pathname,
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
      let result: any;
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

  private async processAgentRequest(request: OrchestrationRequest): Promise<any> {
    const agentRequest = {
      id: request.id,
      type: request.type as any,
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

  private async processServerRequest(request: OrchestrationRequest): Promise<any> {
    const serverOptions = request.input as any;

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

  private createProjectContext(context?: any): any {
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
        files: new Map(),
        apiDocs: new Map(),
        readmeFiles: [],
        changelogFiles: [],
      },
    };
  }

  private async getResourceUsage(): Promise<{ memory: number; cpu: number }> {
    const memUsage = process.memoryUsage();
    return {
      memory: memUsage.heapUsed / 1024 / 1024, // MB
      cpu: process.cpuUsage().system / 1000000, // Approximate CPU usage
    };
  }

  private setupEventHandlers(): void {
    this.eventBus.on('system:shutdown', async () => this.shutdown());

    // Forward important events
    this.eventBus.on('agent:request', data => this.emit('agent-request', data));
    this.eventBus.on('server:request', data => this.emit('server-request', data));
    this.eventBus.on('security:violation', data => this.emit('security-violation', data));
    this.eventBus.on('performance:warning', data => this.emit('performance-warning', data));
  }

  // Service management methods
  async startServer(port: number = 3002, options?: any): Promise<any> {
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

  async processAnalysis(input: string, options?: any): Promise<any> {
    const analysisRequest: OrchestrationRequest = {
      id: `analysis-${Date.now()}`,
      type: 'analyze',
      input,
      options,
    };

    const response = await this.processRequest(analysisRequest);
    return response.result;
  }

  async processGeneration(input: string, options?: any): Promise<any> {
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
      agentSystem: any;
      serverSystem: any;
      securityValidator: boolean;
      performanceSystem: any;
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

      // Shutdown components
      if (this.agentSystem) {
        await this.agentSystem.shutdown();
      }

      if (this.serverSystem) {
        await this.serverSystem.stopAllServers();
      }

      if (this.performanceSystem) {
        await this.performanceSystem.shutdown();
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
  getPerformanceStats(): any {
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
  async synthesizeIntegratedResult(results: any[], options: any = {}): Promise<any> {
    this.logger.info('Synthesizing integrated result from components');

    if (!results || results.length === 0) {
      return {
        success: false,
        error: 'No results to synthesize',
        synthesis: null,
      };
    }

    try {
      // Aggregate successful results
      const successfulResults = results.filter(r => r && r.success !== false);
      const failedResults = results.filter(r => !r || r.success === false);

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

  private getBasicPerformanceStats(): any {
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

  private combineResults(results: any[], options: any): string {
    // Simple combination strategy - in a real implementation this would be more sophisticated
    const contents = results
      .map(r => r.content || r.result || r.response || JSON.stringify(r))
      .filter(c => c && typeof c === 'string');

    if (options.synthesisStrategy === 'concatenate') {
      return contents.join('\n\n---\n\n');
    }

    // Default: extract key insights
    return `Integrated analysis based on ${results.length} components:\n\n${contents.join('\n\n')}`;
  }

  private extractMetadata(results: any[]): any {
    const componentsUsed: string[] = [];
    let totalProcessingTime = 0;

    results.forEach(result => {
      if (result.metadata?.componentsUsed) {
        componentsUsed.push(...result.metadata.componentsUsed);
      }
      if (result.metadata?.processingTime) {
        totalProcessingTime += result.metadata.processingTime;
      }
    });

    return {
      componentsUsed: [...new Set(componentsUsed)], // Remove duplicates
      totalProcessingTime,
    };
  }

  private calculateCompleteness(results: any[]): number {
    // Simple heuristic - percentage of results that have substantial content
    const substantialResults = results.filter(
      r =>
        (r.content && r.content.length > 100) || (r.result && JSON.stringify(r.result).length > 100)
    );
    return results.length > 0 ? substantialResults.length / results.length : 0;
  }

  private calculateConsistency(results: any[]): number {
    // Simple heuristic - for now return a default value
    // In a real implementation, this would analyze similarity between results
    return 0.8;
  }

  private calculateAverageConfidence(results: any[]): number {
    const confidenceValues = results
      .map(r => r.confidence || r.score || 0.5)
      .filter(c => typeof c === 'number');

    return confidenceValues.length > 0
      ? confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length
      : 0.5;
  }

  // === Plugin Command Registry Bridge ===

  listPluginCommands(): Array<{
    name: string;
    description?: string;
    plugin?: string;
    version?: string;
  }> {
    if (!this.commandRegistry) return [];
    try {
      return this.commandRegistry.list().map(c => ({
        name: c.name,
        description: c.meta?.description,
        plugin: c.meta?.plugin,
        version: c.meta?.version,
      }));
    } catch {
      return [];
    }
  }

  async executePluginCommand(name: string, ...args: any[]): Promise<any> {
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
    runtimeContext.getEventBus(),
    userInteraction,
    runtimeContext
  );
}
