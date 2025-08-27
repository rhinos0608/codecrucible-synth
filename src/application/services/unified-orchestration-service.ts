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
import { UnifiedConfigurationManager } from '../../domain/services/unified-configuration-manager.js';
import { UnifiedAgentSystem } from '../../domain/services/unified-agent-system.js';
import { UnifiedServerSystem } from '../../domain/services/unified-server-system.js';
import { UnifiedSecurityValidator } from '../../domain/services/unified-security-validator.js';
import { UnifiedPerformanceSystem } from '../../domain/services/unified-performance-system.js';
import { createLogger } from '../../infrastructure/logging/logger-adapter.js';

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
  
  // Domain services
  private configManager: UnifiedConfigurationManager;
  private agentSystem: UnifiedAgentSystem;
  private serverSystem: UnifiedServerSystem;
  private securityValidator: UnifiedSecurityValidator;
  private performanceSystem: UnifiedPerformanceSystem;
  
  private initialized = false;
  private activeRequests = new Map<string, OrchestrationRequest>();
  
  constructor(
    configManager: UnifiedConfigurationManager,
    eventBus: IEventBus,
    userInteraction: IUserInteraction
  ) {
    super();
    
    this.configManager = configManager;
    this.eventBus = eventBus;
    this.userInteraction = userInteraction;
    this.logger.info('UnifiedOrchestrationService initialized');
    
    this.setupEventHandlers();
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
          result = await this.processAgentRequest(request);
          componentsUsed.push('AgentSystem');
          break;
          
        case 'serve':
          result = await this.processServerRequest(request);
          componentsUsed.push('ServerSystem');
          break;
          
        default:
          throw new Error(`Unsupported request type: ${request.type}`);
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
          resourceUsage
        }
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
          resourceUsage: await this.getResourceUsage()
        }
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
      input: request.input,
      priority: request.options?.priority || 'medium',
      constraints: {
        maxExecutionTime: request.options?.timeout,
        securityLevel: 'high' as const
      },
      preferences: {
        mode: request.options?.mode || 'balanced',
        outputFormat: 'structured' as const,
        includeReasoning: true,
        verboseLogging: false,
        interactiveMode: false
      },
      context: this.createProjectContext(request.context)
    };
    
    if (request.options?.collaborative) {
      // Use multiple agents for collaborative processing
      const agents = this.agentSystem.getAllAgents();
      const suitableAgents = agents.slice(0, 3); // Limit to 3 agents for collaboration
      
      if (suitableAgents.length > 1) {
        const collaborativeTask = {
          id: request.id,
          description: typeof request.input === 'string' ? request.input : JSON.stringify(request.input),
          requirements: [request.type],
          expectedOutput: 'Collaborative response',
          coordination: {
            type: 'parallel' as const,
            participants: suitableAgents.map(a => a.id),
            coordination: 'peer-to-peer' as const,
            conflictResolution: 'majority-vote' as const
          }
        };
        
        const collaborativeResponse = await suitableAgents[0].collaborate(suitableAgents, collaborativeTask);
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
        credentials: false
      },
      authentication: {
        enabled: serverOptions.auth?.enabled || false,
        strategy: 'bearer' as const,
        tokens: serverOptions.auth?.tokens
      },
      websocket: {
        enabled: true,
        path: '/socket.io'
      },
      mcp: {
        enabled: true,
        discoveryPath: '/mcp',
        toolsPath: '/mcp/tools'
      },
      maxConnections: serverOptions.maxConnections || 100,
      timeout: serverOptions.timeout || 30000,
      bodyLimit: '10mb',
      compression: true,
      logging: true
    };
    
    await this.serverSystem.startServer('hybrid', serverConfig);
    
    return {
      message: 'Server started successfully',
      config: serverConfig,
      status: this.serverSystem.getAllServerStatus()
    };
  }
  
  private async validateRequest(request: OrchestrationRequest): Promise<void> {
    // Validate request structure
    if (!request.id || !request.type || request.input === undefined) {
      throw new Error('Invalid request: missing required fields');
    }
    
    // Security validation
    const inputString = typeof request.input === 'string' 
      ? request.input 
      : JSON.stringify(request.input);
      
    const validation = await this.securityValidator.validateInput(
      inputString, 
      {
        sessionId: request.id,
        operationType: 'input',
        environment: 'development',
        permissions: ['orchestration', request.type],
        metadata: {
          requestType: request.type,
          timestamp: Date.now()
        }
      }
    );
    
    if (!validation.isValid) {
      const violationMessages = validation.violations.map(v => v.message);
      throw new Error(`Security validation failed: ${violationMessages.join(', ')}`);
    }
    
    // Performance constraints
    if (request.options?.timeout && request.options.timeout > 300000) { // 5 minutes max
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
        configFiles: []
      },
      documentation: {
        files: new Map(),
        apiDocs: new Map(),
        readmeFiles: [],
        changelogFiles: []
      }
    };
  }

  private async getResourceUsage(): Promise<{ memory: number; cpu: number }> {
    const memUsage = process.memoryUsage();
    return {
      memory: memUsage.heapUsed / 1024 / 1024, // MB
      cpu: process.cpuUsage().system / 1000000 // Approximate CPU usage
    };
  }
  
  private setupEventHandlers(): void {
    this.eventBus.on('system:shutdown', () => this.shutdown());
    
    // Forward important events
    this.eventBus.on('agent:request', (data) => this.emit('agent-request', data));
    this.eventBus.on('server:request', (data) => this.emit('server-request', data));
    this.eventBus.on('security:violation', (data) => this.emit('security-violation', data));
    this.eventBus.on('performance:warning', (data) => this.emit('performance-warning', data));
  }
  
  // Service management methods
  async startServer(port: number = 3002, options?: any): Promise<any> {
    const serverRequest: OrchestrationRequest = {
      id: `server-${Date.now()}`,
      type: 'serve',
      input: { port, ...options },
      options: { priority: 'high' }
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
      options
    };
    
    const response = await this.processRequest(analysisRequest);
    return response.result;
  }
  
  async processGeneration(input: string, options?: any): Promise<any> {
    const generationRequest: OrchestrationRequest = {
      id: `generation-${Date.now()}`,
      type: 'generate',
      input,
      options
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
        performanceSystem: this.performanceSystem ? this.performanceSystem.getSystemMetrics() : null
      }
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
}

// Factory function for easy creation
export function createUnifiedOrchestrationService(
  configManager: UnifiedConfigurationManager,
  eventBus: IEventBus,
  userInteraction: IUserInteraction
): UnifiedOrchestrationService {
  return new UnifiedOrchestrationService(configManager, eventBus, userInteraction);
}