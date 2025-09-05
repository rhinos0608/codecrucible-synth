/**
 * Unified CLI Coordinator - Fully Modular Architecture
 *
 * This is the completely refactored version that coordinates all CLI functionality
 * through modular components rather than monolithic implementation.
 * All complex logic has been extracted to specialized modules.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { randomUUID } from 'crypto';
import {
  IWorkflowOrchestrator,
  WorkflowContext,
} from '../../domain/interfaces/workflow-orchestrator.js';
import { IUserInteraction } from '../../domain/interfaces/user-interaction.js';
import { IEventBus } from '../../domain/interfaces/event-bus.js';
import { logger } from '../../infrastructure/logging/unified-logger.js';
import { EnterpriseSecurityFramework } from '../../infrastructure/security/enterprise-security-framework.js';

// Import all modular components
import { SessionManager, CLISession, CLISessionMetrics } from '../cli/session-manager.js';
import { NaturalLanguageProcessor } from '../cli/natural-language-processor.js';
import { WorkflowDisplayManager } from '../cli/workflow-display-manager.js';
import { MetricsCollector } from '../cli/metrics-collector.js';
import { UseCaseRouter } from '../cli/use-case-router.js';

// Import resilience components
import {
  ResilientCLIWrapper,
  ResilientOptions,
} from '../../infrastructure/resilience/resilient-cli-wrapper.js';
import { setupResilienceEvents } from './cli/resilience-manager.js';

// Re-export session types from modular components
export type { CLISession, CLISessionMetrics } from '../cli/session-manager.js';

// Define interfaces for backward compatibility
interface IntelligentCommand {
  command: string;
  description: string;
  examples: string[];
  contextRelevance: number;
  suggestedArgs: string[];
}

interface QuickContextInfo {
  available: boolean;
  basic: {
    type: string;
    language: string;
  };
  fullLoaded: boolean;
  loading: boolean;
  confidence: number;
}

export interface UnifiedCLIOptions extends ResilientOptions {
  enableContextIntelligence?: boolean;
  enablePerformanceOptimization?: boolean;
  enableErrorResilience?: boolean;
  sessionTimeout?: number;
  maxConcurrentOperations?: number;
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
    suggestions?: any[];
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
 * Unified CLI Coordinator - fully modularized implementation
 */
export class UnifiedCLICoordinator extends EventEmitter {
  private orchestrator!: IWorkflowOrchestrator;
  private userInteraction!: IUserInteraction;
  private eventBus!: IEventBus;

  // Security Framework
  private securityFramework: EnterpriseSecurityFramework;

  // Modular Components
  private sessionManager: SessionManager;
  private naturalLanguageProcessor: NaturalLanguageProcessor;
  private workflowDisplayManager: WorkflowDisplayManager;
  private metricsCollector: MetricsCollector;
  private useCaseRouter: UseCaseRouter;
  private resilientWrapper: ResilientCLIWrapper;

  private defaultOptions: UnifiedCLIOptions;
  private isInitialized = false;

  constructor(options: Partial<UnifiedCLIOptions> = {}) {
    super();

    // Initialize Security Framework
    this.securityFramework = new EnterpriseSecurityFramework();

    // Initialize Modular Components
    this.sessionManager = new SessionManager({
      sessionTimeout: options.sessionTimeout || 300000,
      maxConcurrentSessions: options.maxConcurrentOperations || 10,
    });

    this.naturalLanguageProcessor = new NaturalLanguageProcessor({
      enableDeepAnalysis: options.enableContextIntelligence !== false,
      confidenceThreshold: 0.7,
      complexityAnalysis: true,
    });

    this.workflowDisplayManager = new WorkflowDisplayManager({
      enableRealTimeUpdates: true,
      enableStreamingDisplay: true,
      showProgressBars: true,
      verboseLogging: options.enableContextIntelligence || false,
    });

    this.metricsCollector = new MetricsCollector({
      enableDetailedMetrics: options.enablePerformanceOptimization !== false,
      enableSystemMonitoring: true,
      metricsRetentionMs: 3600000, // 1 hour
      healthCheckIntervalMs: 30000, // 30 seconds
    });

    this.useCaseRouter = new UseCaseRouter();
    this.resilientWrapper = new ResilientCLIWrapper();

    // Set default options
    this.defaultOptions = {
      enableContextIntelligence: options.enableContextIntelligence !== false,
      enablePerformanceOptimization: options.enablePerformanceOptimization !== false,
      enableErrorResilience: true,
      sessionTimeout: 300000,
      maxConcurrentOperations: 10,
      enableGracefulDegradation: true,
      retryAttempts: 3,
      timeoutMs: parseInt(process.env.CLI_TIMEOUT_MS || '300000', 10),
      fallbackMode: 'basic',
      errorNotification: true,
      ...options,
    };
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

      // Initialize modular components
      this.sessionManager.initialize(this.eventBus);
      await this.useCaseRouter.initialize(this.orchestrator);

      // Initialize resilience policies
      setupResilienceEvents(this.resilientWrapper, this);

      this.isInitialized = true;
      this.emit('initialized');

      await this.userInteraction.display('Unified CLI Coordinator initialized successfully', {
        type: 'success',
      });
      logger.info('UnifiedCLICoordinator initialized with modular architecture');
    } catch (error) {
      logger.error('Failed to initialize UnifiedCLICoordinator:', error);
      throw error;
    }
  }

  /**
   * Process a CLI operation using modular components
   */
  async processOperation(request: CLIOperationRequest): Promise<CLIOperationResponse> {
    if (!this.isInitialized) {
      throw new Error('CLI Coordinator not initialized. Call initialize() first.');
    }

    const startTime = performance.now();
    const operationId = request.id || randomUUID();
    const options = { ...this.defaultOptions, ...request.options };

    // Start operation tracking
    const traceSpan = this.metricsCollector.startOperation(operationId, request.type, {
      sessionId: request.session?.id,
    });

    try {
      // Security validation
      const securityValidation = await this.securityFramework.validateOperation(
        JSON.stringify(request.input),
        { operationType: request.type, sessionId: request.session?.id }
      );

      if (!securityValidation.allowed) {
        logger.warn(
          `🚫 Security validation failed for operation ${operationId}:`,
          securityValidation.violations
        );

        this.metricsCollector.recordOperation(
          operationId,
          false,
          `Security validation failed: ${securityValidation.violations.join(', ')}`,
          undefined,
          traceSpan
        );

        return {
          id: operationId,
          success: false,
          error: `Security validation failed: ${securityValidation.violations.join(', ')}`,
          metrics: {
            processingTime: performance.now() - startTime,
            contextConfidence: 0,
            systemHealth: this.calculateSystemHealth(),
          },
        };
      }

      logger.info(
        `🔐 Security validation passed (Risk score: ${securityValidation.riskScore.toFixed(2)})`
      );

      // Use resilient execution with modular routing
      const resilientResult = await this.resilientWrapper.executeWithRecovery(
        async () => {
          // Convert CLISession to required format for UseCaseRouter
          const routerRequest = {
            ...request,
            session: request.session
              ? {
                  id: request.session.id,
                  workingDirectory: request.session.workingDirectory || process.cwd(),
                  context: request.session.context || {
                    sessionId: request.session.id,
                    workingDirectory: request.session.workingDirectory || process.cwd(),
                    permissions: ['read', 'write', 'execute'],
                    securityLevel: 'medium' as const,
                  },
                }
              : undefined,
          };

          return await this.useCaseRouter.executeOperation(routerRequest);
        },
        {
          name: `CLI-${request.type}`,
          component: 'UnifiedCLICoordinator',
          critical: request.type === 'execute',
        },
        {
          enableGracefulDegradation: options.enableGracefulDegradation,
          retryAttempts: options.retryAttempts,
          timeoutMs: options.timeoutMs,
          fallbackMode: options.fallbackMode,
          errorNotification: options.errorNotification,
        }
      );

      const processingTime = performance.now() - startTime;

      // Record operation completion
      this.metricsCollector.recordOperation(
        operationId,
        resilientResult.success,
        resilientResult.error,
        { recoveryActions: resilientResult.metrics?.recoveryActions || 0 },
        traceSpan
      );

      // Update session metrics if session exists
      if (request.session?.id) {
        this.sessionManager.updateSessionMetrics(request.session.id, {
          commandsExecuted: 1,
          contextEnhancements: 1,
          errorsRecovered: resilientResult.metrics?.recoveryActions || 0,
          totalProcessingTime: processingTime,
        });
      }

      return {
        id: operationId,
        success: resilientResult.success,
        result: resilientResult.data,
        error: resilientResult.error,
        enhancements: {
          contextAdded: true,
          performanceOptimized: true,
          errorsRecovered: resilientResult.metrics?.recoveryActions || 0,
        },
        metrics: {
          processingTime,
          contextConfidence: 0.8,
          systemHealth: this.calculateSystemHealth(),
        },
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;

      // Record error metrics
      this.metricsCollector.recordOperation(
        operationId,
        false,
        (error as Error).message,
        undefined,
        traceSpan
      );

      logger.error(`CLI operation ${operationId} failed:`, error);

      return {
        id: operationId,
        success: false,
        error: (error as Error).message,
        metrics: {
          processingTime,
          contextConfidence: 0,
          systemHealth: this.calculateSystemHealth(),
        },
      };
    }
  }

  /**
   * Create a new CLI session - delegates to SessionManager
   */
  async createSession(workingDirectory: string = process.cwd()): Promise<CLISession> {
    const session = await this.sessionManager.createSession(workingDirectory);
    
    // Ensure session has all required properties
    if (!session.workingDirectory) {
      session.workingDirectory = workingDirectory;
    }
    if (!session.context) {
      session.context = {
        sessionId: session.id,
        workingDirectory: workingDirectory,
        permissions: ['read', 'write', 'execute'],
        securityLevel: 'medium',
      };
    }
    if (!session.metrics) {
      session.metrics = {
        commandsExecuted: 0,
        contextEnhancements: 0,
        errorsRecovered: 0,
        totalProcessingTime: 0,
      };
    }
    
    return session;
  }

  /**
   * Get session by ID - delegates to SessionManager
   */
  getSession(sessionId: string): CLISession | null {
    return this.sessionManager.getSession(sessionId) || null;
  }

  /**
   * Close a session - delegates to SessionManager
   */
  async closeSession(sessionId: string): Promise<void> {
    this.sessionManager.endSession(sessionId);
  }

  /**
   * Get intelligent command suggestions
   */
  async getIntelligentCommands(context?: string): Promise<IntelligentCommand[]> {
    // Return basic commands - this could be enhanced with actual intelligence
    return [
      {
        command: 'analyze',
        description: 'Analyze code or files',
        examples: ['analyze src/', 'analyze main.ts'],
        contextRelevance: 0.8,
        suggestedArgs: [],
      },
      {
        command: 'generate',
        description: 'Generate code',
        examples: ['generate component UserProfile'],
        contextRelevance: 0.7,
        suggestedArgs: [],
      },
      {
        command: 'help',
        description: 'Show help information',
        examples: ['help'],
        contextRelevance: 0.6,
        suggestedArgs: [],
      },
    ];
  }

  /**
   * Get quick context status
   */
  async getQuickContextStatus(): Promise<QuickContextInfo> {
    return {
      available: true,
      basic: {
        type: 'TypeScript',
        language: 'TypeScript',
      },
      fullLoaded: false,
      loading: false,
      confidence: 0.8,
    };
  }

  /**
   * Get system metrics using modular components
   */
  getSystemMetrics(): any {
    const systemHealth = this.resilientWrapper.getSystemHealth();
    const sessionStats = this.sessionManager.getSessionStats();
    const metricsSummary = this.metricsCollector.getMetricsSummary();

    return {
      coordinator: {
        activeSessions: sessionStats.activeSessions,
        operationCount: metricsSummary.totalOperations,
        globalMetrics: {
          commandsExecuted: sessionStats.totalCommandsExecuted,
          contextEnhancements: sessionStats.totalCommandsExecuted, // Approximation
          errorsRecovered: sessionStats.totalErrorsRecovered,
          totalProcessingTime: sessionStats.totalProcessingTime,
        },
      },
      systemHealth,
      contextIntelligence: { operations: metricsSummary.totalOperations, accuracy: 0.8 },
      performanceOptimization: { operations: metricsSummary.totalOperations, performance: 0.9 },
      capabilities: {
        contextIntelligence: this.defaultOptions.enableContextIntelligence,
        performanceOptimization: this.defaultOptions.enablePerformanceOptimization,
        errorResilience: this.defaultOptions.enableErrorResilience,
      },
    };
  }

  /**
   * Calculate overall system health
   */
  private calculateSystemHealth(): number {
    const systemHealth = this.resilientWrapper.getSystemHealth();
    const metricsHealth = this.metricsCollector.isSystemHealthy();

    let health = 1.0;

    if (systemHealth.errorStats?.recentErrors && systemHealth.errorStats.recentErrors > 5) {
      health -= 0.2;
    }
    if (!metricsHealth) {
      health -= 0.3;
    }

    return Math.max(0, health);
  }

  /**
   * Shutdown and cleanup all resources
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down UnifiedCLICoordinator');

    // Shutdown all modular components
    await this.sessionManager.shutdown();
    await this.workflowDisplayManager.shutdown();
    await this.metricsCollector.shutdown();
    this.resilientWrapper.shutdown();

    // Remove all listeners
    this.removeAllListeners();

    this.isInitialized = false;
    logger.info('UnifiedCLICoordinator shutdown complete');
  }
}

export default UnifiedCLICoordinator;