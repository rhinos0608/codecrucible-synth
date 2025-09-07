/**
 * Unified CLI Coordinator - Fully Modular Architecture
 *
 * This is the completely refactored version that coordinates all CLI functionality
 * through modular components rather than monolithic implementation.
 * All complex logic has been extracted to specialized modules.
 */

import { EventEmitter } from 'events';
import { IWorkflowOrchestrator } from '../../domain/interfaces/workflow-orchestrator.js';
import { IUserInteraction } from '../../domain/interfaces/user-interaction.js';
import { IEventBus } from '../../domain/interfaces/event-bus.js';
import { logger } from '../../infrastructure/logging/unified-logger.js';
import { EnterpriseSecurityFramework } from '../../infrastructure/security/enterprise-security-framework.js';

// Import all modular components
import { CLISession, SessionManager } from '../cli/session-manager.js';
import { WorkflowDisplayManager } from '../cli/workflow-display-manager.js';
import { MetricsCollector } from '../cli/metrics-collector.js';
import { UseCaseRouter } from '../cli/use-case-router.js';

// Import resilience components
import {
  ResilientCLIWrapper,
  ResilientOptions,
} from '../../infrastructure/resilience/resilient-cli-wrapper.js';
import { CLIResilienceManager } from './cli/resilience-manager.js';
import { CLICommandParser, ICLIParser } from './cli/command-parser.js';
import { CLIOrchestrator, ICLIOrchestrator } from './cli/cli-orchestrator.js';

// Re-export session types from modular components
export type { CLISession, CLISessionMetrics } from '../cli/session-manager.js';

// Define interfaces for backward compatibility

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
  input: unknown;
  options?: UnifiedCLIOptions;
  session?: CLISession;
}

export interface CLIOperationResponse {
  id: string;
  success: boolean;
  result?: unknown;
  error?: string;
  enhancements?: {
    contextAdded?: boolean;
    suggestions?: unknown[];
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
interface SystemHealth {
  isHealthy: boolean;
  healthScore: number;
  errorStats?: {
    recentErrors: number;
  };
  [key: string]: unknown;
}

interface SessionStats {
  activeSessions: number;
  totalCommandsExecuted: number;
  totalErrorsRecovered: number;
  totalProcessingTime: number;
}

interface MetricsSummary {
  totalOperations: number;
}

interface SystemMetrics {
  coordinator: {
    activeSessions: number;
    operationCount: number;
    globalMetrics: {
      commandsExecuted: number;
      contextEnhancements: number;
      errorsRecovered: number;
      totalProcessingTime: number;
    };
  };
  systemHealth: SystemHealth;
  contextIntelligence: {
    operations: number;
    accuracy: number;
  };
  performanceOptimization: {
    operations: number;
    performance: number;
  };
  capabilities: {
    contextIntelligence?: boolean;
    performanceOptimization?: boolean;
    errorResilience?: boolean;
  };
}

export class UnifiedCLICoordinator extends EventEmitter {
  private orchestrator!: IWorkflowOrchestrator;
  private userInteraction!: IUserInteraction;
  private eventBus!: IEventBus;

  // Security Framework
  private readonly securityFramework: EnterpriseSecurityFramework;

  // Modular Components
  private readonly sessionManager: SessionManager;
  private readonly workflowDisplayManager: WorkflowDisplayManager;
  private readonly metricsCollector: MetricsCollector;
  private readonly useCaseRouter: UseCaseRouter;
  private readonly resilientWrapper: ResilientCLIWrapper;
  private readonly parser: ICLIParser;
  private readonly resilienceManager: CLIResilienceManager;
  private readonly cliOrchestrator: ICLIOrchestrator;

  private readonly defaultOptions: UnifiedCLIOptions;
  private isInitialized = false;

  public constructor(
    options: Readonly<Partial<UnifiedCLIOptions>> = {},
    deps: Readonly<{
      parser?: ICLIParser;
      resilienceManager?: CLIResilienceManager;
      orchestrator?: ICLIOrchestrator;
    }> = {}
  ) {
    super();

    // Initialize Security Framework
    this.securityFramework = new EnterpriseSecurityFramework();

    // Initialize Modular Components
    this.sessionManager = new SessionManager({
      sessionTimeout: options.sessionTimeout ?? 300000,
      maxConcurrentSessions: options.maxConcurrentOperations ?? 10,
    });

    this.workflowDisplayManager = new WorkflowDisplayManager({
      enableRealTimeUpdates: true,
      enableStreamingDisplay: true,
      showProgressBars: true,
      verboseLogging: options.enableContextIntelligence ?? false,
    });

    this.metricsCollector = new MetricsCollector({
      enableDetailedMetrics: options.enablePerformanceOptimization !== false,
      enableSystemMonitoring: true,
      metricsRetentionMs: 3600000,
      healthCheckIntervalMs: 30000,
    });

    this.useCaseRouter = new UseCaseRouter();

    this.parser = deps.parser ?? new CLICommandParser();
    this.resilienceManager =
      deps.resilienceManager ?? new CLIResilienceManager(new ResilientCLIWrapper());
    this.resilientWrapper = this.resilienceManager.getWrapper();

    this.cliOrchestrator =
      deps.orchestrator ??
      new CLIOrchestrator({
        securityFramework: this.securityFramework,
        metricsCollector: this.metricsCollector,
        resilientWrapper: this.resilientWrapper,
        useCaseRouter: this.useCaseRouter,
        sessionManager: this.sessionManager,
        calculateSystemHealth: this.calculateSystemHealth.bind(this),
      });

    this.resilienceManager.wire(this);

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
  public async initialize(dependencies: {
    readonly orchestrator: IWorkflowOrchestrator;
    readonly userInteraction: IUserInteraction;
    readonly eventBus: IEventBus;
  }): Promise<void> {
    try {
      this.orchestrator = dependencies.orchestrator;
      this.userInteraction = dependencies.userInteraction;
      this.eventBus = dependencies.eventBus;

      // Initialize modular components
      this.sessionManager.initialize(this.eventBus);
      this.useCaseRouter.initialize(this.orchestrator);

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
  public async processOperation(
    request: Readonly<CLIOperationRequest>
  ): Promise<CLIOperationResponse> {
    if (!this.isInitialized) {
      throw new Error('CLI Coordinator not initialized. Call initialize() first.');
    }
    const options = { ...this.defaultOptions, ...request.options };
    return this.cliOrchestrator.processOperation(request, options);
  }

  public async executeFromArgs(args: readonly string[]): Promise<CLIOperationResponse> {
    const request = this.parser.parse(args);
    return this.processOperation(request);
  }

  /**
   * Create a new CLI session - delegates to SessionManager
   */
  public async createSession(workingDirectory: string = process.cwd()): Promise<CLISession> {
    const session = await this.sessionManager.createSession(workingDirectory);

    // Ensure session has all required properties
    if (!session.workingDirectory) {
      session.workingDirectory = workingDirectory;
    }
    if (!session.context) {
      session.context = {
        sessionId: session.id,
        workingDirectory,
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
  public getSession(sessionId: string): CLISession | null {
    return this.sessionManager.getSession(sessionId) ?? null;
  }

  /**
   * Close a session - delegates to SessionManager
   */
  public closeSession(sessionId: string): void {
    this.sessionManager.endSession(sessionId);
  }

  /**
   * Get system metrics using modular components
   */
  public getSystemMetrics(): SystemMetrics {
    const rawSystemHealth = this.resilientWrapper.getSystemHealth();
    const sessionStats: SessionStats = this.sessionManager.getSessionStats();
    const metricsSummary: MetricsSummary = this.metricsCollector.getMetricsSummary();

    // Transform raw system health to expected format
    const systemHealth: SystemHealth = this.transformSystemHealth(rawSystemHealth);

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
   * Transform raw system health data to expected SystemHealth format
   */
  private transformSystemHealth(rawHealth: any): SystemHealth {
    // Handle different possible formats of system health data
    if (rawHealth && typeof rawHealth === 'object') {
      const isHealthy =
        rawHealth.status === 'healthy' ||
        rawHealth.isHealthy === true ||
        (rawHealth.errorRate !== undefined && rawHealth.errorRate < 0.1);

      let healthScore: number;
      if (typeof rawHealth.healthScore === 'number') {
        healthScore = Math.max(0, Math.min(1, rawHealth.healthScore));
      } else if (rawHealth.status === 'healthy') {
        healthScore = 0.9;
      } else if (rawHealth.status === 'degraded') {
        healthScore = 0.6;
      } else if (rawHealth.status === 'critical') {
        healthScore = 0.3;
      } else if (
        typeof rawHealth.recoveryRate === 'number' &&
        typeof rawHealth.errorRate === 'number'
      ) {
        // Calculate health score based on error and recovery rates
        healthScore = Math.max(
          0.1,
          Math.min(1.0, rawHealth.recoveryRate * 0.7 + (1 - rawHealth.errorRate) * 0.3)
        );
      } else {
        healthScore = isHealthy ? 0.8 : 0.4;
      }

      return {
        isHealthy,
        healthScore,
        errorStats: {
          recentErrors: rawHealth.errorStats?.recentErrors ?? rawHealth.totalErrors ?? 0,
        },
        ...rawHealth, // Include any additional properties
      };
    }

    // Fallback if no valid health data
    return {
      isHealthy: true,
      healthScore: 0.8,
      errorStats: {
        recentErrors: 0,
      },
    };
  }

  /**
   * Get quick context status
   */
  public getQuickContextStatus(): QuickContextInfo {
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

  // Duplicate getSystemMetrics method removed to resolve duplicate implementation error.

  /**
   * Calculate overall system health
   */
  private calculateSystemHealth(): number {
    const systemHealth = this.resilientWrapper.getSystemHealth() as SystemHealth;
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
   * Get intelligent command suggestions based on context
   */
  public async getIntelligentCommands(context?: string): Promise<
    ReadonlyArray<{
      command: string;
      description: string;
      examples: ReadonlyArray<string>;
      contextRelevance: number;
    }>
  > {
    // Basic implementation - could be enhanced with AI-powered suggestions
    return [
      {
        command: 'analyze',
        description: 'Analyze code files for patterns and insights',
        examples: ['analyze src/', 'analyze --type=dependencies'],
        contextRelevance: context ? 0.8 : 0.5,
      },
      {
        command: 'generate',
        description: 'Generate code based on specifications',
        examples: ['generate component MyComponent', 'generate test MyModule'],
        contextRelevance: context ? 0.7 : 0.4,
      },
      {
        command: 'status',
        description: 'Show current system and project status',
        examples: ['status', 'status --verbose'],
        contextRelevance: 0.9,
      },
    ];
  }

  /**
   * Shutdown and cleanup all resources
   */
  public shutdown(): void {
    logger.info('Shutting down UnifiedCLICoordinator');

    // Shutdown all modular components
    this.sessionManager.shutdown();
    this.workflowDisplayManager.shutdown();
    this.metricsCollector.shutdown();
    this.resilientWrapper.shutdown();

    // Remove all listeners
    this.removeAllListeners();

    this.isInitialized = false;
    logger.info('UnifiedCLICoordinator shutdown complete');
  }
}

export default UnifiedCLICoordinator;
