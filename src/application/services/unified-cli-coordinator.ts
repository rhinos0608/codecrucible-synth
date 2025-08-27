/**
 * Unified CLI Coordinator - Application Layer
 * 
 * Coordinates and orchestrates all CLI specialized capabilities:
 * - Context intelligence and project analysis
 * - Performance optimization with lazy loading
 * - Error resilience and recovery systems
 * - User interface and interaction management
 * - Session management and workflow coordination
 * 
 * This eliminates the need for multiple CLI implementations by
 * providing a single coordinated interface that leverages all
 * specialized capabilities as needed.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { randomUUID } from 'crypto';
import { IWorkflowOrchestrator, WorkflowRequest, WorkflowResponse, WorkflowContext } from '../../domain/interfaces/workflow-orchestrator.js';
import { IUserInteraction } from '../../domain/interfaces/user-interaction.js';
import { IEventBus } from '../../domain/interfaces/event-bus.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { getDependencyContainer, UseCaseDependencies } from './dependency-container.js';
import { AnalysisRequest, GenerationRequest } from '../use-cases/index.js';

// Context Intelligence Integration
import { 
  ContextAwareCLIIntegration,
  ContextAwareOptions,
  ContextualPromptEnhancement,
  SmartSuggestion,
  NavigationContext,
  IntelligentCommand
} from '../../core/intelligence/context-aware-cli-integration.js';

// Performance Optimization Integration  
import {
  OptimizedContextAwareCLI,
  OptimizedContextOptions,
  QuickContextInfo
} from '../../core/intelligence/optimized-context-cli.js';

// Error Resilience Integration
import {
  ResilientCLIWrapper,
  ResilientOptions,
  OperationResult
} from '../../core/resilience/resilient-cli-wrapper.js';

// Session and Performance Types
export interface CLISession {
  id: string;
  workingDirectory: string;
  startTime: number;
  context: WorkflowContext;
  metrics: CLISessionMetrics;
}

export interface CLISessionMetrics {
  commandsExecuted: number;
  contextEnhancements: number;
  errorsRecovered: number;
  totalProcessingTime: number;
}

export interface UnifiedCLIOptions extends ContextAwareOptions, OptimizedContextOptions, ResilientOptions {
  enableContextIntelligence?: boolean;
  enablePerformanceOptimization?: boolean;
  enableErrorResilience?: boolean;
  sessionTimeout?: number;
  maxConcurrentOperations?: number;
  // Use case options
  includeTests?: boolean;
  includeDocumentation?: boolean;
  dryRun?: boolean;
}

export interface CLIOperationRequest {
  id: string;
  type: 'prompt' | 'analyze' | 'execute' | 'navigate' | 'suggest';
  input: string | any;
  options?: UnifiedCLIOptions;
  session?: CLISession;
}

export interface CLIOperationResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
  enhancements?: {
    contextAdded?: boolean;
    suggestions?: SmartSuggestion[];
    performanceOptimized?: boolean;
    errorsRecovered?: number;
  };
  metrics: {
    processingTime: number;
    contextConfidence: number;
    systemHealth: number;
  };
}

/**
 * Unified CLI Coordinator orchestrates all CLI capabilities
 */
export class UnifiedCLICoordinator extends EventEmitter {
  private orchestrator!: IWorkflowOrchestrator;
  private userInteraction!: IUserInteraction;
  private eventBus!: IEventBus;
  
  // Use Cases (via Dependency Injection)
  private useCases!: UseCaseDependencies;
  
  // Specialized CLI Components
  private contextAwareCLI: ContextAwareCLIIntegration;
  private optimizedContextCLI: OptimizedContextAwareCLI;
  private resilientWrapper: ResilientCLIWrapper;
  
  // Session Management
  private activeSessions: Map<string, CLISession> = new Map();
  private defaultOptions: UnifiedCLIOptions;
  private isInitialized = false;
  
  // Performance Tracking
  private operationCount = 0;
  private globalMetrics: CLISessionMetrics = {
    commandsExecuted: 0,
    contextEnhancements: 0,
    errorsRecovered: 0,
    totalProcessingTime: 0
  };

  constructor(options: Partial<UnifiedCLIOptions> = {}) {
    super();
    
    // Initialize specialized CLI components
    this.contextAwareCLI = new ContextAwareCLIIntegration();
    this.optimizedContextCLI = new OptimizedContextAwareCLI();
    this.resilientWrapper = new ResilientCLIWrapper();
    
    // Set default options with all capabilities enabled
    this.defaultOptions = {
      enableContextIntelligence: true,
      enablePerformanceOptimization: true,
      enableErrorResilience: true,
      enableIntelligence: true,
      lazyLoading: true,
      preloadInBackground: true,
      quickStart: false,
      enableGracefulDegradation: true,
      retryAttempts: 3,
      timeoutMs: 30000,
      fallbackMode: 'basic',
      errorNotification: true,
      sessionTimeout: 300000, // 5 minutes
      maxConcurrentOperations: 10,
      ...options
    };

    this.setupComponentIntegration();
  }

  /**
   * Initialize the unified CLI coordinator
   */
  async initialize(dependencies: {
    orchestrator: IWorkflowOrchestrator;
    userInteraction: IUserInteraction;
    eventBus: IEventBus;
  }): Promise<void> {
    try {
      this.orchestrator = dependencies.orchestrator;
      this.userInteraction = dependencies.userInteraction;
      this.eventBus = dependencies.eventBus;

      // Initialize dependency container and use cases
      const container = getDependencyContainer();
      container.initialize(this.orchestrator);
      this.useCases = container.useCases;

      // Initialize all specialized components
      await this.initializeComponents();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      await this.userInteraction.display('Unified CLI Coordinator initialized successfully', { type: 'success' });
      logger.info('UnifiedCLICoordinator initialized with all capabilities enabled');
      
    } catch (error) {
      logger.error('Failed to initialize UnifiedCLICoordinator:', error);
      throw error;
    }
  }

  /**
   * Process a CLI operation with full coordination
   */
  async processOperation(request: CLIOperationRequest): Promise<CLIOperationResponse> {
    if (!this.isInitialized) {
      throw new Error('CLI Coordinator not initialized. Call initialize() first.');
    }

    const startTime = performance.now();
    const operationId = request.id || `op_${++this.operationCount}_${Date.now()}`;
    const options = { ...this.defaultOptions, ...request.options };

    try {
      // Use resilient execution wrapper for error handling
      const resilientResult = await this.resilientWrapper.executeWithRecovery(
        () => this.executeWithCoordination(request, options),
        {
          name: `CLI-${request.type}`,
          component: 'UnifiedCLICoordinator',
          critical: request.type === 'execute'
        },
        {
          enableGracefulDegradation: options.enableGracefulDegradation,
          retryAttempts: options.retryAttempts,
          timeoutMs: options.timeoutMs,
          fallbackMode: options.fallbackMode,
          errorNotification: options.errorNotification
        }
      );

      const processingTime = performance.now() - startTime;
      
      // Update metrics
      this.updateMetrics(request.session?.id, processingTime, resilientResult.metrics?.recoveryActions || 0);

      return {
        id: operationId,
        success: resilientResult.success,
        result: resilientResult.data,
        error: resilientResult.error,
        enhancements: {
          contextAdded: true, // We always try to add context
          performanceOptimized: true, // We always optimize
          errorsRecovered: resilientResult.metrics?.recoveryActions || 0
        },
        metrics: {
          processingTime,
          contextConfidence: 0.8, // Will be calculated dynamically
          systemHealth: this.calculateSystemHealth()
        }
      };

    } catch (error) {
      const processingTime = performance.now() - startTime;
      logger.error(`CLI operation ${operationId} failed:`, error);
      
      return {
        id: operationId,
        success: false,
        error: (error as Error).message,
        metrics: {
          processingTime,
          contextConfidence: 0,
          systemHealth: this.calculateSystemHealth()
        }
      };
    }
  }

  /**
   * Execute with full coordination using Use Cases (Clean Architecture)
   */
  private async executeWithCoordination(
    request: CLIOperationRequest,
    options: UnifiedCLIOptions
  ): Promise<any> {
    let result: any;
    let contextEnhancement: ContextualPromptEnhancement | null = null;

    // Phase 1: Context Intelligence (if enabled and applicable)
    if (options.enableContextIntelligence && typeof request.input === 'string') {
      try {
        if (options.enablePerformanceOptimization) {
          contextEnhancement = await this.optimizedContextCLI.enhancePromptWithContext(
            request.input,
            options
          );
        } else {
          contextEnhancement = await this.contextAwareCLI.enhancePromptWithContext(
            request.input,
            options
          );
        }
      } catch (error) {
        logger.warn('Context enhancement failed, proceeding without:', error);
      }
    }

    // Phase 2: Execute operation using appropriate Use Case
    result = await this.executeUseCase(request, contextEnhancement, options);

    // Phase 3: Post-processing and suggestions (if applicable)
    if (options.enableContextIntelligence && request.type === 'prompt') {
      try {
        const suggestions = await this.contextAwareCLI.generateSmartSuggestions(
          request.input as string,
          this.contextAwareCLI.getProjectIntelligence()!
        );
        
        if (suggestions && suggestions.length > 0) {
          result = {
            ...result,
            suggestions: suggestions.slice(0, 5),
            contextConfidence: contextEnhancement?.confidence || 0
          };
        }
      } catch (error) {
        logger.warn('Failed to generate suggestions:', error);
      }
    }

    return result;
  }

  /**
   * Execute appropriate use case based on request type
   */
  private async executeUseCase(
    request: CLIOperationRequest,
    contextEnhancement: ContextualPromptEnhancement | null,
    options: UnifiedCLIOptions
  ): Promise<any> {
    const enhancedInput = contextEnhancement?.enhancedPrompt || request.input;
    
    switch (request.type) {
      case 'analyze': {
        // Determine if it's file or directory analysis
        if (typeof request.input === 'string' && request.input.includes('/') && 
            !request.input.includes(' ')) {
          // Likely a file or directory path
          const analysisRequest: AnalysisRequest = {
            filePath: request.input.endsWith('/') ? undefined : request.input,
            directoryPath: request.input.endsWith('/') ? request.input : undefined,
            options: {
              depth: 3,
              includeTests: options.includeTests,
              includeDocumentation: options.includeDocumentation,
              outputFormat: 'structured'
            }
          };
          
          if (analysisRequest.directoryPath) {
            return await this.useCases.analyzeDirectoryUseCase.execute(analysisRequest);
          } else {
            return await this.useCases.analyzeFileUseCase.execute(analysisRequest);
          }
        } else {
          // General analysis request - use file analysis with content
          const analysisRequest: AnalysisRequest = {
            content: enhancedInput as string,
            options: {
              includeTests: options.includeTests,
              includeDocumentation: options.includeDocumentation,
              outputFormat: 'structured'
            }
          };
          return await this.useCases.analyzeFileUseCase.execute(analysisRequest);
        }
      }

      case 'prompt': {
        // Check if this is a code generation request
        if (this.isCodeGenerationRequest(enhancedInput as string)) {
          const generationRequest: GenerationRequest = {
            prompt: enhancedInput as string,
            context: this.extractGenerationContext(request),
            options: {
              includeTests: options.includeTests,
              includeDocumentation: options.includeDocumentation,
              dryRun: options.dryRun || false
            }
          };
          return await this.useCases.generateCodeUseCase.execute(generationRequest);
        } else {
          // Regular prompt - fallback to orchestrator
          return await this.executeViaOrchestrator(request, enhancedInput, options);
        }
      }

      case 'execute':
      case 'navigate':
      case 'suggest':
      default: {
        // Fallback to orchestrator for other operation types
        return await this.executeViaOrchestrator(request, enhancedInput, options);
      }
    }
  }

  /**
   * Check if a prompt is requesting code generation
   */
  private isCodeGenerationRequest(prompt: string): boolean {
    const generationKeywords = [
      'create', 'generate', 'write', 'build', 'implement', 'code', 'function',
      'class', 'component', 'module', 'script', 'program', 'develop'
    ];
    
    const lowerPrompt = prompt.toLowerCase();
    return generationKeywords.some(keyword => lowerPrompt.includes(keyword));
  }

  /**
   * Extract generation context from request
   */
  private extractGenerationContext(request: CLIOperationRequest): GenerationRequest['context'] {
    return {
      projectType: 'general',
      language: 'typescript', // Default, could be enhanced with project detection
      framework: undefined,
      existingFiles: []
    };
  }

  /**
   * Execute via orchestrator (fallback for non-use-case operations)
   */
  private async executeViaOrchestrator(
    request: CLIOperationRequest,
    enhancedInput: string | any,
    options: UnifiedCLIOptions
  ): Promise<any> {
    const workflowRequest: WorkflowRequest = {
      id: request.id,
      type: this.mapOperationType(request.type),
      payload: {
        input: enhancedInput,
        originalInput: request.input,
        options
      },
      context: request.session?.context,
      metadata: {
        coordinatorVersion: '2.0.0-clean-architecture',
        capabilities: {
          contextIntelligence: options.enableContextIntelligence,
          performanceOptimized: options.enablePerformanceOptimization,
          errorResilience: options.enableErrorResilience
        }
      }
    };

    const workflowResponse = await this.orchestrator.processRequest(workflowRequest);
    
    if (!workflowResponse.success) {
      throw workflowResponse.error || new Error('Workflow execution failed');
    }

    return workflowResponse.result;
  }

  /**
   * Create a new CLI session
   */
  async createSession(workingDirectory: string = process.cwd()): Promise<CLISession> {
    const sessionId = randomUUID();
    const context: WorkflowContext = {
      sessionId,
      workingDirectory,
      permissions: ['read', 'write', 'execute'],
      securityLevel: 'medium'
    };

    const session: CLISession = {
      id: sessionId,
      workingDirectory,
      startTime: performance.now(),
      context,
      metrics: {
        commandsExecuted: 0,
        contextEnhancements: 0,
        errorsRecovered: 0,
        totalProcessingTime: 0
      }
    };

    this.activeSessions.set(sessionId, session);
    
    // Initialize context intelligence for this session
    try {
      await this.contextAwareCLI.initialize(workingDirectory, this.defaultOptions);
      await this.optimizedContextCLI.quickInitialize(workingDirectory, this.defaultOptions);
    } catch (error) {
      logger.warn(`Failed to initialize context intelligence for session ${sessionId}:`, error);
    }

    this.eventBus.emit('session:created', { sessionId, workingDirectory });
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): CLISession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Close a session and cleanup resources
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      const duration = performance.now() - session.startTime;
      logger.info(`Closing CLI session ${sessionId} after ${duration.toFixed(2)}ms`);
      
      this.activeSessions.delete(sessionId);
      this.eventBus.emit('session:closed', { sessionId, duration });
    }
  }

  /**
   * Get intelligent command suggestions
   */
  async getIntelligentCommands(context?: string): Promise<IntelligentCommand[]> {
    const commands: IntelligentCommand[] = [];
    
    try {
      // Get commands from context-aware CLI
      const contextCommands = await this.contextAwareCLI.getIntelligentCommands(context);
      commands.push(...contextCommands);
      
      // Get optimized commands if available
      const optimizedCommands = await this.optimizedContextCLI.getIntelligentCommands(context);
      commands.push(...optimizedCommands);
      
      // Deduplicate and sort by relevance
      const uniqueCommands = commands.reduce((acc, cmd) => {
        const existing = acc.find(c => c.command === cmd.command);
        if (!existing || existing.contextRelevance < cmd.contextRelevance) {
          acc = acc.filter(c => c.command !== cmd.command);
          acc.push(cmd);
        }
        return acc;
      }, [] as IntelligentCommand[]);
      
      return uniqueCommands.sort((a, b) => b.contextRelevance - a.contextRelevance);
      
    } catch (error) {
      logger.warn('Failed to get intelligent commands:', error);
      return [];
    }
  }

  /**
   * Get navigation context for current session
   */
  async getNavigationContext(sessionId?: string): Promise<NavigationContext | null> {
    try {
      return await this.contextAwareCLI.getNavigationContext();
    } catch (error) {
      logger.warn('Failed to get navigation context:', error);
      return null;
    }
  }

  /**
   * Get quick context status
   */
  async getQuickContextStatus(): Promise<QuickContextInfo> {
    try {
      return await this.optimizedContextCLI.getContextStatus();
    } catch (error) {
      logger.warn('Failed to get context status:', error);
      return {
        available: false,
        basic: null,
        fullLoaded: false,
        loading: false,
        confidence: 0
      };
    }
  }

  /**
   * Get comprehensive system metrics
   */
  getSystemMetrics(): any {
    const systemHealth = this.resilientWrapper.getSystemHealth();
    const contextMetrics = this.contextAwareCLI.getMetrics();
    const optimizedMetrics = this.optimizedContextCLI.getMetrics();

    return {
      coordinator: {
        activeSessions: this.activeSessions.size,
        operationCount: this.operationCount,
        globalMetrics: this.globalMetrics
      },
      systemHealth,
      contextIntelligence: contextMetrics,
      performanceOptimization: optimizedMetrics,
      capabilities: {
        contextIntelligence: this.defaultOptions.enableContextIntelligence,
        performanceOptimization: this.defaultOptions.enablePerformanceOptimization,
        errorResilience: this.defaultOptions.enableErrorResilience
      }
    };
  }

  /**
   * Initialize all specialized components
   */
  private async initializeComponents(): Promise<void> {
    // Context awareness initialization will happen per session
    // Resilient wrapper is already initialized in constructor
    
    // Set up component event forwarding
    this.contextAwareCLI.on('initialized', (data) => {
      this.emit('context:initialized', data);
    });
    
    this.resilientWrapper.on('critical_error', (data) => {
      this.emit('error:critical', data);
    });
    
    this.resilientWrapper.on('system_overload', (data) => {
      this.emit('error:overload', data);
    });
  }

  /**
   * Setup integration between components
   */
  private setupComponentIntegration(): void {
    // Forward events between components for coordination
    this.contextAwareCLI.on('project:analyzed', (data) => {
      // Trigger optimized CLI to preload if needed
      this.optimizedContextCLI.loadFullIntelligence(false);
    });
  }

  /**
   * Map CLI operation types to workflow types
   */
  private mapOperationType(type: CLIOperationRequest['type']): WorkflowRequest['type'] {
    const mapping: Record<CLIOperationRequest['type'], WorkflowRequest['type']> = {
      'prompt': 'prompt',
      'analyze': 'analysis',
      'execute': 'tool-execution',
      'navigate': 'analysis',
      'suggest': 'analysis'
    };
    return mapping[type] || 'prompt';
  }

  /**
   * Update session and global metrics
   */
  private updateMetrics(sessionId?: string, processingTime?: number, errorsRecovered?: number): void {
    if (sessionId) {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.metrics.commandsExecuted++;
        session.metrics.contextEnhancements++;
        if (errorsRecovered) session.metrics.errorsRecovered += errorsRecovered;
        if (processingTime) session.metrics.totalProcessingTime += processingTime;
      }
    }

    // Update global metrics
    this.globalMetrics.commandsExecuted++;
    this.globalMetrics.contextEnhancements++;
    if (errorsRecovered) this.globalMetrics.errorsRecovered += errorsRecovered;
    if (processingTime) this.globalMetrics.totalProcessingTime += processingTime;
  }

  /**
   * Calculate overall system health
   */
  private calculateSystemHealth(): number {
    const systemHealth = this.resilientWrapper.getSystemHealth();
    const contextStatus = this.optimizedContextCLI.getMetrics();
    
    // Combine various health indicators
    let health = 1.0;
    
    if (systemHealth.errorStats?.recentErrors > 5) health -= 0.2;
    if (this.activeSessions.size > this.defaultOptions.maxConcurrentOperations!) health -= 0.1;
    if (contextStatus?.isInitialized === false) health -= 0.1;
    
    return Math.max(0, health);
  }

  /**
   * Shutdown and cleanup all resources
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down UnifiedCLICoordinator');
    
    // Close all active sessions
    const sessionIds = Array.from(this.activeSessions.keys());
    await Promise.all(sessionIds.map(id => this.closeSession(id)));
    
    // Shutdown specialized components
    this.resilientWrapper.shutdown();
    this.optimizedContextCLI.shutdown();
    
    // Clear caches and cleanup
    this.contextAwareCLI.clearProjectCache();
    this.removeAllListeners();
    
    this.isInitialized = false;
  }
}

export default UnifiedCLICoordinator;