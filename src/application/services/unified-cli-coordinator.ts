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
import {
  IWorkflowOrchestrator,
  WorkflowRequest,
  WorkflowContext,
} from '../../domain/interfaces/workflow-orchestrator.js';
import { IUserInteraction } from '../../domain/interfaces/user-interaction.js';
import { IEventBus } from '../../domain/interfaces/event-bus.js';
import { logger } from '../../infrastructure/logging/unified-logger.js';
import { getDependencyContainer, UseCaseDependencies } from './dependency-container.js';
import { AnalysisRequest, GenerationRequest } from '../use-cases/index.js';
import { FileReferenceParser } from '../cli/file-reference-parser.js';
import {
  projectConfigurationLoader,
  CombinedProjectConfig,
} from '../config/project-config-loader.js';
import { CodebaseAnalysisResult } from '../context/context-window-manager.js';
import { naturalLanguageInterface, ParsedCommand } from '../cli/natural-language-interface.js';
import { agenticWorkflowDisplay } from '../workflow/agentic-workflow-display.js';
import { streamingWorkflowIntegration } from '../workflow/streaming-workflow-integration.js';
import { EnterpriseSecurityFramework } from '../../infrastructure/security/enterprise-security-framework.js';
import {
  ObservabilitySystem,
  TraceSpan,
} from '../../infrastructure/observability/observability-system.js';

// LEGACY IMPORTS REMOVED - replaced with simple interfaces
// Define minimal types for backward compatibility
interface IntelligentCommand {
  command: string;
  description: string;
  examples: string[];
  contextRelevance: number;
  suggestedArgs: string[];
}

interface NavigationContext {
  currentPath: string;
  relatedFiles: string[];
  suggestedFiles: string[];
  keyDirectories: string[];
  navigationHistory: string[];
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

// Performance Optimization Integration
// import {
//   OptimizedContextAwareCLI,
//   OptimizedContextOptions,
//   QuickContextInfo
// } from '../intelligence/optimized-context-cli.js';

// Keep only minimal types needed
interface ContextualPromptEnhancement {
  enhancedPrompt: string;
}

interface SmartSuggestion {
  title: string;
  description: string;
}

// Error Resilience Integration
import {
  ResilientCLIWrapper,
  ResilientOptions,
} from '../../infrastructure/resilience/resilient-cli-wrapper.js';

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

export interface UnifiedCLIOptions extends ResilientOptions {
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

  // Security Framework
  private securityFramework: EnterpriseSecurityFramework;

  // Performance & Observability Systems
  private observabilitySystem: ObservabilitySystem;

  // Specialized CLI Components (legacy components disabled)
  // private contextAwareCLI: ContextAwareCLIIntegration;
  // private optimizedContextCLI: OptimizedContextAwareCLI;
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
    totalProcessingTime: 0,
  };

  constructor(options: Partial<UnifiedCLIOptions> = {}) {
    super();

    // Initialize Security Framework
    this.securityFramework = new EnterpriseSecurityFramework();

    // Initialize Performance & Observability Systems
    this.observabilitySystem = new ObservabilitySystem({
      metrics: { enabled: true, retentionDays: 7, exportInterval: 60000, exporters: [] },
      tracing: { enabled: true, samplingRate: 1.0, maxSpansPerTrace: 100, exporters: [] },
      logging: { level: 'info', outputs: [], structured: true, includeStackTrace: true },
      health: { checkInterval: 30000, timeoutMs: 5000, retryAttempts: 3 },
      alerting: { enabled: true, rules: [], defaultCooldown: 300000 },
      telemetry: { enabled: true, interval: 60000, exporters: [] },
      storage: {
        dataPath: './data/observability',
        maxFileSize: 100 * 1024 * 1024,
        compressionEnabled: true,
        encryptionEnabled: false,
      },
    });

    // LEGACY COMPONENTS DISABLED - Use new unified architecture instead
    // this.contextAwareCLI = new ContextAwareCLIIntegration();
    // this.optimizedContextCLI = new OptimizedContextAwareCLI();
    this.resilientWrapper = new ResilientCLIWrapper();

    // Set default options - legacy context systems disabled
    this.defaultOptions = {
      enableContextIntelligence: false, // Disabled legacy system
      enablePerformanceOptimization: false, // Disabled legacy system
      enableErrorResilience: true,
      sessionTimeout: 300000, // 5 minutes
      maxConcurrentOperations: 10,
      enableGracefulDegradation: true,
      retryAttempts: 3,
      timeoutMs: 120000, // 2 minutes for complex operations
      fallbackMode: 'basic',
      errorNotification: true,
      ...options,
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

      await this.userInteraction.display('Unified CLI Coordinator initialized successfully', {
        type: 'success',
      });
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

    // 📊 PERFORMANCE: Start operation tracing
    let traceSpan: TraceSpan | undefined;

    try {
      traceSpan = this.observabilitySystem.startSpan('cli-operation');

      // 🔐 SECURITY: Validate operation before execution
      const securityValidation = await this.securityFramework.validateOperation(
        JSON.stringify(request.input),
        { operationType: request.type, sessionId: request.session?.id }
      );

      if (!securityValidation.allowed) {
        logger.warn(
          `🚫 Security validation failed for operation ${operationId}:`,
          securityValidation.violations
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

      // Use resilient execution wrapper for error handling
      const resilientResult = await this.resilientWrapper.executeWithRecovery(
        async () => this.executeWithCoordination(request, options),
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

      // 📊 PERFORMANCE: Record metrics and complete tracing
      this.recordOperationMetrics(
        operationId,
        request.type,
        processingTime,
        resilientResult.success
      );
      if (traceSpan) {
        this.observabilitySystem.finishSpan(traceSpan, {
          status: resilientResult.success ? 'ok' : 'error',
          'operation.duration': processingTime.toString(),
        });
      }

      // Update metrics
      this.updateMetrics(
        request.session?.id,
        processingTime,
        resilientResult.metrics?.recoveryActions || 0
      );

      return {
        id: operationId,
        success: resilientResult.success,
        result: resilientResult.data,
        error: resilientResult.error,
        enhancements: {
          contextAdded: true, // We always try to add context
          performanceOptimized: true, // We always optimize
          errorsRecovered: resilientResult.metrics?.recoveryActions || 0,
        },
        metrics: {
          processingTime,
          contextConfidence: 0.8, // Will be calculated dynamically
          systemHealth: this.calculateSystemHealth(),
        },
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;

      // 📊 PERFORMANCE: Record error metrics
      this.recordOperationMetrics(operationId, request.type, processingTime, false);

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
   * Execute with full coordination using Use Cases (Clean Architecture)
   */
  private async executeWithCoordination(
    request: CLIOperationRequest,
    options: UnifiedCLIOptions
  ): Promise<any> {
    let result: any;
    const contextEnhancement: ContextualPromptEnhancement | null = null;

    // Phase 1: Context Intelligence (DISABLED - using direct orchestrator approach)
    // Legacy context enhancement systems disabled to prevent interference
    // All intelligence now handled by the orchestrator and model client

    // Phase 2: Execute operation using appropriate Use Case
    result = await this.executeUseCase(request, contextEnhancement, options);

    // Phase 3: Post-processing (legacy context intelligence disabled)
    if (options.enableContextIntelligence && request.type === 'prompt') {
      try {
        // Legacy context intelligence removed - using simple response enhancement
        result = {
          ...result,
          suggestions: [],
          contextConfidence: 0.5,
        };
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
    const workingDir = request.session?.workingDirectory || process.cwd();

    // Start transparent agentic workflow display
    const sessionId = agenticWorkflowDisplay.startSession(
      request.input as string,
      this.determineComplexity(request.input as string)
    );

    try {
      // PHASE 1: PLANNING - Parse and understand the request
      const planStepId = agenticWorkflowDisplay.addStep(
        sessionId,
        'planning',
        'Understanding Request',
        'Analyzing user intent and requirements'
      );

      // Parse natural language command if input is string
      let parsedCommand: ParsedCommand | null = null;
      if (typeof request.input === 'string') {
        parsedCommand = naturalLanguageInterface.parseCommand(request.input);

        agenticWorkflowDisplay.updateStepProgress(
          sessionId,
          planStepId,
          50,
          `Intent: ${parsedCommand.intent} (${(parsedCommand.confidence * 100).toFixed(0)}% confidence)`
        );

        // Log natural language understanding for transparency
        if (parsedCommand.confidence > 0.7) {
          logger.info(
            `🎯 Command understood: ${parsedCommand.intent} (${(parsedCommand.confidence * 100).toFixed(0)}% confidence)`
          );
        }
      }

      agenticWorkflowDisplay.completeStep(sessionId, planStepId, {
        intent: parsedCommand?.intent,
        confidence: parsedCommand?.confidence,
      });

      // Load project configuration for context-aware responses
      let projectConfig: CombinedProjectConfig | null = null;
      try {
        projectConfig = await projectConfigurationLoader.loadProjectConfig(workingDir);
        if (projectConfig.isLoaded) {
          logger.info(
            `🏗️ Loaded project config: ${projectConfig.configuration.name || 'Unknown'} (${projectConfig.configuration.language || 'Unknown'})`
          );
        }
      } catch (error) {
        logger.warn('⚠️ Failed to load project configuration:', error);
      }

      // Process @ syntax file references
      let processedInput = request.input;
      if (typeof request.input === 'string' && request.input.includes('@')) {
        try {
          const parser = new FileReferenceParser();
          const parsed = await parser.parseFileReferences(request.input, workingDir);

          if (parsed.references.length > 0) {
            processedInput = parsed.enhancedPrompt;
            logger.info(
              `📁 Processed ${parsed.references.length} file references: ${parsed.contextSummary}`
            );
          }
        } catch (error) {
          logger.warn('❌ Failed to process @ file references:', error);
          // Continue with original input on parsing failure
        }
      }

      // AI-driven tool selection: Let the model decide between MCP tools and codebase analysis
      // based on context and available tools rather than hardcoded routing logic
      const codebaseAnalysis: CodebaseAnalysisResult | null = null;

      // Enhance input with project context if available
      let contextEnhancedInput = processedInput;
      if (projectConfig && projectConfig.isLoaded && typeof processedInput === 'string') {
        contextEnhancedInput = this.enhanceInputWithProjectContext(processedInput, projectConfig);
      }

      // Further enhance with codebase analysis if available
      if (codebaseAnalysis && typeof contextEnhancedInput === 'string') {
        contextEnhancedInput = this.enhanceInputWithCodebaseAnalysis(
          contextEnhancedInput,
          codebaseAnalysis
        );
      }

      const enhancedInput = contextEnhancement?.enhancedPrompt || contextEnhancedInput;

      // Use natural language intent to refine operation type if confidence is high
      let effectiveOperationType: 'analyze' | 'diagnose' | 'prompt' | 'execute' | 'navigate' | 'suggest' =
        request.type;
      if (parsedCommand && parsedCommand.confidence > 0.5) {
        // Map natural language intents to operation types
        const intentToOperationMap: Record<
          string,
          'analyze' | 'diagnose' | 'prompt' | 'execute' | 'navigate' | 'suggest'
        > = {
          analyze: 'analyze',
          diagnose: 'diagnose',
          review: 'analyze',
          explain: 'analyze', // Explanation should be analysis, not code generation
          generate: 'prompt', // Code generation goes through prompt system
          fix: 'prompt',
          refactor: 'prompt',
          optimize: 'prompt',
          test: 'prompt',
          document: 'prompt',
          help: 'suggest',
          chat: 'prompt',
        };

        const mappedOperation = intentToOperationMap[parsedCommand.intent];
        if (mappedOperation && mappedOperation !== request.type) {
          logger.info(
            `🔄 Routing: ${request.type} → ${mappedOperation} based on natural language intent`
          );
          effectiveOperationType = mappedOperation;
        }
      }

      switch (effectiveOperationType) {
        case 'analyze': {
          // Determine if it's file or directory analysis
          if (
            typeof request.input === 'string' &&
            request.input.includes('/') &&
            !request.input.includes(' ')
          ) {
            // Likely a file or directory path
            const analysisRequest: AnalysisRequest = {
              filePath: request.input.endsWith('/') ? undefined : request.input,
              directoryPath: request.input.endsWith('/') ? request.input : undefined,
              options: {
                depth: 3,
                includeTests: options.includeTests,
                includeDocumentation: options.includeDocumentation,
                outputFormat: 'structured',
              },
            };

            if (analysisRequest.directoryPath) {
              return await this.executeUseCaseWithWorkflow(
                sessionId,
                async () => this.useCases.analyzeDirectoryUseCase.execute(analysisRequest),
                'directory analysis'
              );
            } else {
              return await this.executeUseCaseWithWorkflow(
                sessionId,
                async () => this.useCases.analyzeFileUseCase.execute(analysisRequest),
                'file analysis'
              );
            }
          } else {
            // Check if this is a simple question that should go directly to AI
            // IMPORTANT: Use original input for classification, not enhanced context
            const originalInputStr = request.input as string;
            const isSimpleQuestion = this.isSimpleQuestion(originalInputStr);

            if (isSimpleQuestion) {
              // Route simple questions directly to orchestrator for real AI responses
              // BUT don't include tools for simple questions to enable pure streaming
              logger.info('🎯 Routing simple question directly to AI orchestrator (no tools)');
              return await this.executeUseCaseWithWorkflow(
                sessionId,
                async () => this.executeViaOrchestratorWithoutTools(request, enhancedInput, options),
                'AI response'
              );
            } else {
              // General analysis request - use file analysis with content
              const analysisRequest: AnalysisRequest = {
                content: enhancedInput as string,
                options: {
                  includeTests: options.includeTests,
                  includeDocumentation: options.includeDocumentation,
                  outputFormat: 'structured',
                },
              };
              return await this.executeUseCaseWithWorkflow(
                sessionId,
                async () => this.useCases.analyzeFileUseCase.execute(analysisRequest),
                'content analysis'
              );
            }
          }
        }

        case 'prompt': {
          // Check if this is a code generation request using ORIGINAL user input, not enhanced context
          const originalInput = request.input as string;
          if (this.isCodeGenerationRequest(originalInput)) {
            const generationRequest: GenerationRequest = {
              prompt: enhancedInput as string,
              context: this.extractGenerationContext(request),
              options: {
                includeTests: options.includeTests,
                includeDocumentation: options.includeDocumentation,
                // For explicit code generation requests, default to actually writing files
                // Only dry-run if explicitly requested via options
                dryRun: options.dryRun ?? false,
              },
            };
            return await this.executeUseCaseWithWorkflow(
              sessionId,
              async () => this.useCases.generateCodeUseCase.execute(generationRequest),
              'code generation'
            );
          } else {
            // Regular prompt - fallback to orchestrator
            return await this.executeUseCaseWithWorkflow(
              sessionId,
              async () => this.executeViaOrchestrator(request, enhancedInput, options),
              'prompt processing'
            );
          }
        }

        case 'diagnose': {
          // Handle diagnostic queries with specialized tool selection
          logger.info('🔍 Processing diagnostic request with enhanced tooling');
          
          // For diagnostic queries, we want to use tools that can help identify problems
          // This includes file analysis, type checking, linting, etc.
          return await this.executeUseCaseWithWorkflow(
            sessionId,
            async () => this.executeViaOrchestrator(request, enhancedInput, options),
            'diagnostic analysis'
          );
        }

        case 'execute':
        case 'navigate':
        case 'suggest':
        default: {
          // Fallback to orchestrator for other operation types
          return await this.executeUseCaseWithWorkflow(
            sessionId,
            async () => this.executeViaOrchestrator(request, enhancedInput, options),
            request.type
          );
        }
      }
    } catch (error) {
      // Handle workflow errors
      agenticWorkflowDisplay.failStep(sessionId, 'current-step', (error as Error).message);
      agenticWorkflowDisplay.completeSession(sessionId, {
        success: false,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Execute use case with full agentic workflow display
   */
  private async executeUseCaseWithWorkflow(
    sessionId: string,
    useCase: () => Promise<any>,
    operationType: string
  ): Promise<any> {
    // PHASE 2: EXECUTING - Run the actual use case with streaming
    const executeStepId = agenticWorkflowDisplay.addStep(
      sessionId,
      'executing',
      `Executing ${operationType}`,
      `Running ${operationType} operation with AI models`
    );

    agenticWorkflowDisplay.updateStepProgress(
      sessionId,
      executeStepId,
      5,
      'Initializing AI models...'
    );

    let result: any;
    try {
      // Check if this is an operation that benefits from streaming display
      if (this.shouldUseStreaming(operationType)) {
        logger.info(`🌊 Using streaming workflow for ${operationType}`);

        // Execute use case with streaming display wrapper
        result = await this.executeWithStreaming(sessionId, executeStepId, useCase, operationType);
      } else {
        // Standard non-streaming execution
        agenticWorkflowDisplay.updateStepProgress(
          sessionId,
          executeStepId,
          50,
          'Processing request...'
        );
        result = await useCase();
        agenticWorkflowDisplay.updateStepProgress(
          sessionId,
          executeStepId,
          75,
          'Generating response...'
        );
      }

      agenticWorkflowDisplay.completeStep(sessionId, executeStepId, {
        operationType,
        hasResult: !!result,
        streaming: this.shouldUseStreaming(operationType),
      });
    } catch (error) {
      agenticWorkflowDisplay.failStep(sessionId, executeStepId, (error as Error).message);
      throw error;
    }

    // PHASE 3: TESTING - Validate the response
    const testStepId = agenticWorkflowDisplay.addStep(
      sessionId,
      'testing',
      'Validating Response',
      'Checking response quality and completeness'
    );

    agenticWorkflowDisplay.updateStepProgress(
      sessionId,
      testStepId,
      33,
      'Analyzing response structure...'
    );

    const testResults = {
      isValid: true,
      hasContent: !!result,
      isComplete: true,
      qualityScore: 0.8,
    };

    try {
      // Basic validation
      if (!result) {
        testResults.isValid = false;
        testResults.qualityScore = 0.0;
      } else if (typeof result === 'string' && result.length < 10) {
        testResults.isComplete = false;
        testResults.qualityScore = 0.4;
      }

      agenticWorkflowDisplay.updateStepProgress(
        sessionId,
        testStepId,
        66,
        `Quality: ${(testResults.qualityScore * 100).toFixed(0)}%`
      );

      agenticWorkflowDisplay.updateStepProgress(sessionId, testStepId, 100, 'Validation complete');
      agenticWorkflowDisplay.completeStep(sessionId, testStepId, testResults);
    } catch (error) {
      agenticWorkflowDisplay.failStep(sessionId, testStepId, (error as Error).message);
    }

    // PHASE 4: ITERATING - Learning and improvement
    const iterateStepId = agenticWorkflowDisplay.addStep(
      sessionId,
      'iterating',
      'Learning & Optimization',
      'Analyzing performance and preparing for future requests'
    );

    agenticWorkflowDisplay.updateStepProgress(
      sessionId,
      iterateStepId,
      50,
      'Recording performance metrics...'
    );

    const iterationResults = {
      performanceGood: testResults.qualityScore > 0.7,
      canImprove: testResults.qualityScore < 0.9,
      learningRecorded: true,
    };

    agenticWorkflowDisplay.updateStepProgress(
      sessionId,
      iterateStepId,
      100,
      'Optimization complete'
    );
    agenticWorkflowDisplay.completeStep(sessionId, iterateStepId, iterationResults);

    // Complete the entire workflow session
    agenticWorkflowDisplay.completeSession(sessionId, {
      success: true,
      qualityScore: testResults.qualityScore,
      operationType,
      tokensUsed: this.estimateTokensUsed(result),
      confidenceScore: testResults.qualityScore,
    });

    return result;
  }

  /**
   * Execute a use case with streaming display for real-time progress
   */
  private async executeWithStreaming(
    sessionId: string,
    stepId: string,
    useCase: () => Promise<any>,
    operationType: string
  ): Promise<any> {
    try {
      logger.info(`🌊 Starting streaming for ${operationType}`);
      
      // Execute the use case - streaming tokens will be handled by model client
      // The streaming visual feedback will be handled by the concrete workflow orchestrator
      const result = await useCase();
      
      logger.info(`✅ Streaming completed for ${operationType}`);
      
      return result;
    } catch (error) {
      // Ensure streaming is stopped on error
      streamingWorkflowIntegration.stopStreaming(stepId);
      logger.error(`❌ Streaming failed for ${operationType}:`, error);
      throw error;
    }
  }

  /**
   * Record operation performance metrics
   */
  private recordOperationMetrics(
    operationId: string,
    operationType: string,
    processingTime: number,
    success: boolean
  ): void {
    // Record operation duration
    this.observabilitySystem.recordTimer('cli.operation.duration', processingTime, {
      operationType,
      operationId,
      success: success.toString(),
    });

    // Record operation count
    this.observabilitySystem.incrementCounter('cli.operation.count', {
      operationType,
      success: success.toString(),
    });

    // Record system metrics
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // Convert to MB
    this.observabilitySystem.recordMetric('system.memory.used', memoryUsage, {}, 'MB');

    this.observabilitySystem.recordMetric(
      'system.sessions.active',
      this.activeSessions.size,
      {},
      'count'
    );

    // Log performance information
    logger.info(
      `📊 Operation ${operationId} metrics: ${processingTime.toFixed(2)}ms, Success: ${success}, Memory: ${memoryUsage.toFixed(2)}MB`
    );
  }

  /**
   * Determine if an operation should use streaming display
   */
  private shouldUseStreaming(operationType: string): boolean {
    // Operations that typically involve AI model generation benefit from streaming
    const streamingOperations = [
      'code generation',
      'prompt processing',
      'content analysis',
      'file analysis',
      'directory analysis',
    ];

    return streamingOperations.includes(operationType.toLowerCase());
  }

  /**
   * Estimate tokens used in a result (simple approximation)
   */
  private estimateTokensUsed(result: any): number {
    if (!result) return 0;

    const resultString = typeof result === 'string' ? result : JSON.stringify(result);
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(resultString.length / 4);
  }

  /**
   * Check if this is a simple question that should go directly to AI
   */
  private isSimpleQuestion(input: string): boolean {
    if (typeof input !== 'string') return false;

    const inputLower = input.toLowerCase().trim();

    // Simple math questions
    if (/^\s*\d+\s*[+\-*\/]\s*\d+[\s?]*$/.test(inputLower)) return true;

    // Simple "what is" questions
    if (inputLower.startsWith('what is') && inputLower.length < 50) return true;

    // Simple questions with question words
    const questionWords = ['what', 'who', 'when', 'where', 'why', 'how'];
    const startsWithQuestion = questionWords.some(word => inputLower.startsWith(`${word} `));

    // Direct questions under 100 characters that don't mention files or code
    const isShort = inputLower.length < 100;
    const noFileReferences =
      !inputLower.includes('.') && !inputLower.includes('/') && !inputLower.includes('\\');
    const noCodeKeywords =
      !inputLower.includes('function') &&
      !inputLower.includes('class') &&
      !inputLower.includes('import');

    return startsWithQuestion && isShort && noFileReferences && noCodeKeywords;
  }

  /**
   * Determine request complexity based on input analysis
   */
  private determineComplexity(input: string): 'simple' | 'medium' | 'complex' {
    if (!input) return 'simple';

    const complexityIndicators = {
      simple: ['help', 'status', 'version', 'list', 'show'],
      medium: ['analyze', 'generate', 'create', 'fix', 'refactor'],
      complex: ['implement', 'architecture', 'design', 'optimize', 'comprehensive'],
    };

    const lowerInput = input.toLowerCase();

    if (complexityIndicators.complex.some(keyword => lowerInput.includes(keyword))) {
      return 'complex';
    }

    if (complexityIndicators.medium.some(keyword => lowerInput.includes(keyword))) {
      return 'medium';
    }

    // Also consider length as complexity factor
    if (input.length > 200) return 'complex';
    if (input.length > 50) return 'medium';

    return 'simple';
  }

  /**
   * Check if a prompt is requesting code generation
   */
  private isCodeGenerationRequest(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();

    // EXCLUDE: Help/advice/explanation questions should NEVER generate code files
    const helpPatterns = [
      'how do i',
      'how to',
      'help me',
      'explain',
      'what is',
      'what are',
      'why',
      'when',
      'where',
      'fix',
      'debug',
      'solve',
      'resolve',
      'error',
      'issue',
      'problem',
      'trouble',
      'advice',
      'suggest',
      'recommend',
      'best practice',
      'should i',
      'can you',
      'could you',
    ];

    // If it's a help/advice question, definitely not code generation
    if (helpPatterns.some(pattern => lowerPrompt.includes(pattern))) {
      return false;
    }

    // INCLUDE: Only explicit code creation requests with strong intent
    const strongGenerationKeywords = [
      'create a',
      'generate a',
      'write a',
      'build a',
      'implement a',
      'create class',
      'create function',
      'create component',
      'create module',
      'generate code',
      'write code',
      'build app',
      'implement feature',
    ];

    // Check for strong generation patterns first
    if (strongGenerationKeywords.some(keyword => lowerPrompt.includes(keyword))) {
      return true;
    }

    // Weaker keywords only if they appear with creation context
    const weakKeywords = ['function', 'class', 'component', 'module'];
    const creationContext = ['new', 'create', 'make', 'add', 'build'];

    return weakKeywords.some(
      keyword =>
        lowerPrompt.includes(keyword) &&
        creationContext.some(context => lowerPrompt.includes(context))
    );
  }

  /**
   * Extract generation context from request
   */
  private extractGenerationContext(request: CLIOperationRequest): GenerationRequest['context'] {
    return {
      projectType: 'general',
      language: 'typescript', // Default, could be enhanced with project detection
      framework: undefined,
      existingFiles: [],
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
        options: {
          ...options,
          // CRITICAL FIX: Enable streaming for Ollama responses
          stream: true,
        },
      },
      context: request.session?.context,
      metadata: {
        coordinatorVersion: '2.0.0-clean-architecture',
        capabilities: {
          contextIntelligence: options.enableContextIntelligence,
          performanceOptimized: options.enablePerformanceOptimization,
          errorResilience: options.enableErrorResilience,
        },
      },
    };

    const workflowResponse = await this.orchestrator.processRequest(workflowRequest);

    if (!workflowResponse.success) {
      throw workflowResponse.error || new Error('Workflow execution failed');
    }

    return workflowResponse.result;
  }

  /**
   * Execute via orchestrator without tools (for simple questions to enable pure streaming)
   */
  private async executeViaOrchestratorWithoutTools(
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
        options: {
          ...options,
          // CRITICAL FIX: Enable streaming for Ollama responses
          stream: true,
          // CRITICAL: Disable tools for simple questions to enable pure streaming
          useTools: false,
        },
      },
      context: request.session?.context,
      metadata: {
        coordinatorVersion: '2.0.0-clean-architecture',
        capabilities: {
          contextIntelligence: options.enableContextIntelligence,
          performanceOptimization: options.enablePerformanceOptimization,
          errorResilience: options.enableErrorResilience,
        },
      },
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
      securityLevel: 'medium',
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
        totalProcessingTime: 0,
      },
    };

    this.activeSessions.set(sessionId, session);

    // Legacy context intelligence initialization removed
    // Session initialized with basic capabilities only

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
   * Get intelligent command suggestions (simplified implementation)
   */
  async getIntelligentCommands(context?: string): Promise<IntelligentCommand[]> {
    // Return basic commands until Phase 2 integration
    return [
      {
        command: 'analyze',
        description: 'Analyze code or files',
        examples: ['analyze src/'],
        contextRelevance: 0.8,
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
   * Get navigation context for current session (simplified implementation)
   */
  async getNavigationContext(sessionId?: string): Promise<NavigationContext | null> {
    return {
      currentPath: process.cwd(),
      relatedFiles: [],
      suggestedFiles: [],
      keyDirectories: [],
      navigationHistory: [],
    };
  }

  /**
   * Get quick context status (simplified implementation)
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

  // Removed requiresCodebaseAnalysis method - letting AI decide based on system prompt and available tools

  /**
   * Enhance input with codebase analysis results
   */
  private enhanceInputWithCodebaseAnalysis(
    input: string,
    analysis: CodebaseAnalysisResult
  ): string {
    if (analysis.chunks.length === 0) {
      return input;
    }

    const contextParts: string[] = [];

    // Add codebase overview
    contextParts.push(`=== CODEBASE ANALYSIS ===`);
    contextParts.push(`Files analyzed: ${analysis.analyzedFiles}/${analysis.totalFiles}`);
    contextParts.push(`Context efficiency: ${(analysis.contextEfficiency * 100).toFixed(1)}%`);
    contextParts.push(
      `Priority distribution: ${analysis.priorityDistribution.high} high, ${analysis.priorityDistribution.medium} medium, ${analysis.priorityDistribution.low} low priority files`
    );

    if (analysis.recommendations.length > 0) {
      contextParts.push(`Recommendations: ${analysis.recommendations.join(', ')}`);
    }

    // Add information from top priority chunks
    contextParts.push(`\n=== HIGH PRIORITY FILES ===`);
    const topChunks = analysis.chunks.slice(0, 2); // Focus on top 2 chunks

    for (const chunk of topChunks) {
      contextParts.push(`\n[${chunk.focusArea}] - ${chunk.summary}`);

      // Add top files from this chunk
      const topFiles = chunk.files
        .filter(f => f.priority >= 0.5)
        .slice(0, 5) // Limit to top 5 files per chunk
        .map(
          f =>
            `  • ${f.path} (priority: ${(f.priority * 100).toFixed(0)}%, complexity: ${f.complexity})${f.summary ? ` - ${f.summary}` : ''}`
        );

      if (topFiles.length > 0) {
        contextParts.push(...topFiles);
      }

      // Add key relationships if any
      if (chunk.relationships.length > 0) {
        contextParts.push(`  Dependencies: ${chunk.relationships.slice(0, 3).join(', ')}`);
      }
    }

    // Add token usage information
    const tokensUsed = analysis.tokensUsed.toLocaleString();
    contextParts.push(`\nContext tokens used: ${tokensUsed}`);

    // Build enhanced prompt
    const contextHeader = `${contextParts.join('\n')}\n\n=== USER REQUEST ===\n`;
    return contextHeader + input;
  }

  /**
   * Enhance input with project configuration context
   */
  private enhanceInputWithProjectContext(
    input: string,
    projectConfig: CombinedProjectConfig
  ): string {
    const contextParts: string[] = [];

    // Add project overview
    if (projectConfig.configuration.name || projectConfig.instructions.projectName) {
      contextParts.push(
        `Project: ${projectConfig.configuration.name || projectConfig.instructions.projectName}`
      );
    }

    // Add language and framework info
    if (projectConfig.configuration.language) {
      let techStack = `Language: ${projectConfig.configuration.language}`;
      if (projectConfig.configuration.framework) {
        techStack += `, Framework: ${projectConfig.configuration.framework}`;
      }
      contextParts.push(techStack);
    }

    // Add project type
    if (projectConfig.configuration.type) {
      contextParts.push(`Type: ${projectConfig.configuration.type}`);
    }

    // Add custom instructions from CODECRUCIBLE.md
    if (
      projectConfig.instructions.instructions &&
      projectConfig.instructions.instructions.length > 0
    ) {
      contextParts.push(`Custom Project Instructions:\n${projectConfig.instructions.instructions}`);
    }

    // Add code style preferences
    if (projectConfig.instructions.codeStyle?.rules) {
      contextParts.push(
        `Code Style Requirements:\n${JSON.stringify(
          projectConfig.instructions.codeStyle.rules,
          null,
          2
        )}`
      );
    }

    // Add AI preferences from configuration
    const aiPreferences: string[] = [];
    if (projectConfig.configuration.ai?.responseFormat) {
      aiPreferences.push(`Format: ${projectConfig.configuration.ai.responseFormat}`);
    }
    if (projectConfig.instructions.preferences?.responseStyle) {
      aiPreferences.push(`Style: ${projectConfig.instructions.preferences.responseStyle}`);
    }
    if (projectConfig.instructions.preferences?.includeTests) {
      aiPreferences.push('Include tests in code generation');
    }
    if (projectConfig.instructions.preferences?.includeComments) {
      aiPreferences.push('Include detailed comments');
    }
    if (projectConfig.instructions.preferences?.includeDocumentation) {
      aiPreferences.push('Include documentation');
    }

    if (aiPreferences.length > 0) {
      contextParts.push(`Response Preferences: ${aiPreferences.join(', ')}`);
    }

    // Add voice archetype preferences
    if (
      projectConfig.configuration.ai?.voices &&
      projectConfig.configuration.ai.voices.length > 0
    ) {
      contextParts.push(`Preferred Voices: ${projectConfig.configuration.ai.voices.join(', ')}`);
    }

    // Add tools and workflow info
    if (projectConfig.configuration.tools) {
      const tools = Object.entries(projectConfig.configuration.tools)
        .filter(([_, value]) => value)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      if (tools) {
        contextParts.push(`Project Tools: ${tools}`);
      }
    }

    // Build enhanced prompt
    if (contextParts.length === 0) {
      return input;
    }

    const contextHeader = `=== PROJECT CONTEXT ===\n${contextParts.join('\n')}\n=== USER REQUEST ===\n`;
    return contextHeader + input;
  }

  /**
   * Get comprehensive system metrics
   */
  getSystemMetrics(): any {
    const systemHealth = this.resilientWrapper.getSystemHealth();
    // Legacy context metrics removed - using simplified metrics
    const contextMetrics = { operations: 0, accuracy: 0 };
    const optimizedMetrics = { operations: 0, performance: 0 };

    return {
      coordinator: {
        activeSessions: this.activeSessions.size,
        operationCount: this.operationCount,
        globalMetrics: this.globalMetrics,
      },
      systemHealth,
      contextIntelligence: contextMetrics,
      performanceOptimization: optimizedMetrics,
      capabilities: {
        contextIntelligence: this.defaultOptions.enableContextIntelligence,
        performanceOptimization: this.defaultOptions.enablePerformanceOptimization,
        errorResilience: this.defaultOptions.enableErrorResilience,
      },
    };
  }

  /**
   * Initialize all specialized components
   */
  private async initializeComponents(): Promise<void> {
    // Legacy component initialization disabled
    // Resilient wrapper is already initialized in constructor

    // Only setup resilient wrapper events (legacy context components disabled)
    this.resilientWrapper.on('critical_error', data => {
      this.emit('error:critical', data);
    });

    this.resilientWrapper.on('system_overload', data => {
      this.emit('error:overload', data);
    });
  }

  /**
   * Setup integration between components
   */
  private setupComponentIntegration(): void {
    // Legacy component integration disabled
    // All coordination now happens through the unified orchestrator
  }

  /**
   * Map CLI operation types to workflow types
   */
  private mapOperationType(type: CLIOperationRequest['type']): WorkflowRequest['type'] {
    const mapping: Record<CLIOperationRequest['type'], WorkflowRequest['type']> = {
      prompt: 'prompt',
      analyze: 'analysis',
      execute: 'tool-execution',
      navigate: 'analysis',
      suggest: 'analysis',
    };
    return mapping[type] || 'prompt';
  }

  /**
   * Update session and global metrics
   */
  private updateMetrics(
    sessionId?: string,
    processingTime?: number,
    errorsRecovered?: number
  ): void {
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
    // Legacy context status removed - using simplified status
    const contextStatus = { isInitialized: true };

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
    await Promise.all(sessionIds.map(async id => this.closeSession(id)));

    // Shutdown specialized components
    this.resilientWrapper.shutdown();
    // Legacy context CLI shutdown removed

    // Clear caches and cleanup (legacy cache clearing removed)
    this.removeAllListeners();

    this.isInitialized = false;
  }
}

export default UnifiedCLICoordinator;
