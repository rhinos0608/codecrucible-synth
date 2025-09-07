/**
 * Unified CLI - Backward Compatible Interface
 *
 * This replaces the complex 25k+ token main CLI with a clean interface
 * that leverages the UnifiedCLICoordinator. Preserves all existing functionality
 * while eliminating complexity and circular dependencies.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { randomUUID } from 'crypto';
import { REPLInterface } from '../../domain/types/index.js';
import {
  CLIOperationRequest,
  CLISession,
  UnifiedCLICoordinator,
  UnifiedCLIOptions,
} from '../services/unified-cli-coordinator.js';
import { IWorkflowOrchestrator } from '../../domain/interfaces/workflow-orchestrator.js';
import { IUserInteraction } from '../../domain/interfaces/user-interaction.js';
import { IEventBus, getGlobalEventBus } from '../../domain/interfaces/event-bus.js';
import { ILogger } from '../../domain/interfaces/logger.js';
import { CLIUserInteraction } from '../../infrastructure/user-interaction/cli-user-interaction.js';
import { createLogger } from '../../infrastructure/logging/logger-adapter.js';
import { getErrorMessage } from '../../utils/error-utils.js';
import { cleanupApprovalManager } from '../../infrastructure/security/approval-modes-manager.js';
import chalk from 'chalk';
import { enrichContext, formatOutput, parseCommand, routeThroughTools } from '../cli/index.js';
import { ApprovalHandler } from '../cli/approval-handler.js';
import { InteractiveSessionHandler } from '../cli/interactive-session-handler.js';
import { createUnifiedOrchestrationServiceWithContext } from '../services/unified-orchestration-service.js';
import type { UnifiedConfigurationManager as DomainUnifiedConfigurationManager } from '../../domain/config/config-manager.js';

// NOTE: Some service type declaration files may be missing or RuntimeContext may not be exported
// from the original module; declare minimal local types here to avoid compile errors while keeping
// the runtime behavior unchanged. These are intentionally lightweight and can be replaced with
// upstream types when those modules are available.
export interface UnifiedConfigurationManager {
  get: <T = unknown>(key: string) => Promise<T | undefined>;
  set: <T = unknown>(key: string, value: T) => Promise<void>;
  has: (key: string) => Promise<boolean>;
  // add other methods as required by the coordinator when types become available
}

export interface UnifiedResourceCoordinator {
  acquireResource: (name: string) => Promise<unknown>;
  releaseResource: (name: string) => Promise<void>;
  listResources: () => Promise<string[]>;
  // add other methods as required by the coordinator when types become available
}

export interface RuntimeContext {
  workspaceRoot?: string;
  env?: Record<string, string | undefined>;
  // eventBus and resourceCoordinator may be provided at runtime; type them loosely here
  eventBus?: IEventBus;
  resourceCoordinator?: UnifiedResourceCoordinator;
}

export interface CLIOptions {
  verbose?: boolean;
  stream?: boolean;
  contextAware?: boolean;
  autonomousMode?: boolean;
  performance?: boolean;
  resilience?: boolean;
}

export interface CLIContext {
  workingDirectory: string;
  sessionId?: string;
  options: CLIOptions;
  startTime: number;
}

/**
 * Unified CLI - Clean interface using UnifiedCLICoordinator
 */
export class UnifiedCLI extends EventEmitter implements REPLInterface {
  private readonly coordinator: UnifiedCLICoordinator;
  private readonly userInteraction: IUserInteraction;
  private readonly eventBus: IEventBus;
  private readonly logger: ILogger;

  // Modular components
  private readonly approvalHandler: ApprovalHandler;
  private readonly interactiveSessionHandler: InteractiveSessionHandler;

  private readonly context: CLIContext;
  private currentSession: CLISession | null = null;
  private initialized = false;
  private coordinatorInitializedHandler?: () => void;
  private coordinatorCriticalHandler?: (data: unknown) => void;
  private coordinatorOverloadHandler?: (data: unknown) => void;
  private sigintHandler?: () => Promise<void>;
  private sigtermHandler?: () => Promise<void>;
  private _sigintWrapper?: () => void;
  private _sigtermWrapper?: () => void;

  public constructor(options: Readonly<CLIOptions> = {}) {
    super();

    // Create context
    this.context = {
      workingDirectory: process.cwd(),
      options: {
        verbose: false,
        stream: false,
        contextAware: true,
        autonomousMode: false,
        performance: true,
        resilience: true,
        ...options,
      },
      startTime: performance.now(),
    };

    // Initialize user interaction, event bus, and logger
    this.userInteraction = new CLIUserInteraction({ verbose: this.context.options.verbose });
    this.eventBus = getGlobalEventBus();
    this.logger = createLogger('UnifiedCLI');

    // Create simplified coordinator with proper options
    const coordinatorOptions: UnifiedCLIOptions = {
      enableGracefulDegradation: true,
      retryAttempts: 3,
      timeoutMs: 30000,
      fallbackMode: 'basic',
      errorNotification: this.context.options.verbose || false,
      enableContextIntelligence: this.context.options.contextAware,
      enablePerformanceOptimization: this.context.options.performance,
      enableErrorResilience: this.context.options.resilience,
    };

    this.coordinator = new UnifiedCLICoordinator(coordinatorOptions);

    // Initialize modular components
    this.approvalHandler = new ApprovalHandler(this.userInteraction);
    this.interactiveSessionHandler = new InteractiveSessionHandler(this.userInteraction, {
      enableHelp: true,
      enableStatus: true,
      enableSuggestions: true,
      defaultToDryRun: true,
      showWelcomeMessage: true,
    });

    // Set up callbacks for interactive session handler
    this.interactiveSessionHandler.setCallbacks({
      processPrompt: async (prompt: string, options?: Readonly<Record<string, unknown>>) =>
        this.processPrompt(prompt, options),
      getSuggestions: async () => {
        const suggestions = await this.getSuggestions();
        return suggestions.map((s: Readonly<{ command: string; description: string; relevance: number }>) => ({
          command: s.command,
          description: s.description,
          relevance: s.relevance,
        }));
      },
      showStatus: async () => { await this.showStatus(); },
      execCommand: async (name: string, args: readonly unknown[]) =>
        this.execCommand(name, Array.from(args)),
    });

    this.setupEventHandlers();
  }


  /**
   * Execute a plugin command by name with arguments.
   */
  public async execCommand(name: string, args: unknown[]): Promise<unknown> {
    // Define an extended session interface to include missing properties with proper types
    interface ExtendedCLISession extends CLISession {
      configurationManager: Readonly<DomainUnifiedConfigurationManager>;
      resourceCoordinator: UnifiedResourceCoordinator;
    }
    // Retrieve runtimeContext and configurationManager from coordinator/session as required
    const session = this.currentSession;
    const context = session?.context;
    const extendedSession = session as ExtendedCLISession | null;
    const configurationManager: Readonly<DomainUnifiedConfigurationManager> | undefined = extendedSession?.configurationManager;
    const resourceCoordinator: UnifiedResourceCoordinator | undefined = extendedSession?.resourceCoordinator;
    if (!session || !context || !configurationManager || !resourceCoordinator) {
      throw new Error('Current session, context, configuration manager, or resource coordinator is not available.');
    }
    // Ensure runtimeContext has required properties: eventBus, resourceCoordinator
    // Ensure eventBus is always defined for runtimeContext to satisfy type requirements
    const runtimeContext: Readonly<RuntimeContext> = {
      ...context,
      eventBus: this.eventBus,
      resourceCoordinator,
    };

    if (!runtimeContext.eventBus) {
      throw new Error('EventBus is required in runtimeContext but was not provided.');
    }

    const svc = createUnifiedOrchestrationServiceWithContext(
      runtimeContext as unknown as import('../runtime/runtime-context').RuntimeContext,
      configurationManager,
      this.userInteraction
    );
    return svc.executePluginCommand(name, ...args);
  }

  /**
   * Initialize the CLI with workflow orchestrator
   */
  public async initialize(orchestrator: Readonly<IWorkflowOrchestrator>): Promise<UnifiedCLI> {
    try {
      // Initialize the coordinator
      await this.coordinator.initialize({
        orchestrator,
        userInteraction: this.userInteraction,
        eventBus: this.eventBus,
      });

      // Create initial session
      this.currentSession = await this.coordinator.createSession(this.context.workingDirectory);
      this.context.sessionId = this.currentSession.id;

      this.initialized = true;

      if (this.context.options.verbose) {
        await this.userInteraction.display('Unified CLI initialized successfully', {
          type: 'success',
        });
      }

      this.emit('initialized');
      this.logger.info('UnifiedCLI initialized successfully');
      return this;
    } catch (error) {
      this.logger.error('Failed to initialize UnifiedCLI:', error);
      throw error;
    }
  }

  /**
   * Process a user prompt
   */
  public async processPrompt(
    prompt: string,
    options: Readonly<Record<string, unknown>> = {}
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error('CLI not initialized. Call initialize() first.');
    }

    try {
      const request = parseCommand(
        prompt,
        {
          enableContextIntelligence: Boolean(this.context.options.contextAware),
          enablePerformanceOptimization: Boolean(this.context.options.performance),
          enableErrorResilience: Boolean(this.context.options.resilience),
          // Required properties from ResilientOptions with defaults
          enableGracefulDegradation: true,
          retryAttempts: 3,
          timeoutMs: 300000, // 5 minutes
          fallbackMode: 'basic' as const,
          errorNotification: true,
          ...this.context.options,
          ...options,
        },
        this.currentSession
      );

      const enriched = enrichContext(request);

      const response = await routeThroughTools(this.coordinator, enriched);

      if (response.success) {
        if (this.context.options.verbose && response.enhancements) {
          const enhancements: string[] = [];
          if (response.enhancements.contextAdded) enhancements.push('context-enhanced');
          if (response.enhancements.performanceOptimized)
            enhancements.push('performance-optimized');
          if (response.enhancements.errorsRecovered && response.enhancements.errorsRecovered > 0) {
            enhancements.push(`${response.enhancements.errorsRecovered} errors recovered`);
          }

          if (enhancements.length > 0) {
            await this.userInteraction.display(`✨ Enhanced: ${enhancements.join(', ')}`, {
              type: 'info',
            });
          }
        }

        return formatOutput(response.result);
      } else {
        throw new Error(response.error ?? 'Processing failed');
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      await this.userInteraction.error(`Error processing prompt: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Analyze a file
   */
  public async analyzeFile(
    filePath: string,
    options: Readonly<Record<string, unknown>> = {}
  ): Promise<unknown> {
    if (!this.initialized) {
      throw new Error('CLI not initialized. Call initialize() first.');
    }

    try {
      const request: CLIOperationRequest = {
        id: randomUUID(),
        type: 'analyze',
        input: filePath,
        options: {
          enableGracefulDegradation: true,
          retryAttempts: 3,
          timeoutMs: 30000,
          fallbackMode: 'basic',
          errorNotification: this.context.options.verbose || false,
          enableContextIntelligence: this.context.options.contextAware,
          enablePerformanceOptimization: this.context.options.performance,
          enableErrorResilience: this.context.options.resilience,
          ...this.context.options,
          ...options,
        },
        session: this.currentSession ?? undefined,
      };

      const response = await this.coordinator.processOperation(request);

      if (response.success) {
        return response.result;
      } else {
        throw new Error(response.error ?? 'Analysis failed');
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      await this.userInteraction.error(`File analysis failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Execute a tool
   */
  public async executeTool(
    toolName: string,
    args: Readonly<Record<string, unknown>> = {},
    options: Readonly<Record<string, unknown>> = {}
  ): Promise<unknown> {
    if (!this.initialized) {
      throw new Error('CLI not initialized. Call initialize() first.');
    }

    try {
      const request: CLIOperationRequest = {
        id: randomUUID(),
        type: 'execute',
        input: { toolName, args },
        options: {
          enableGracefulDegradation: true,
          retryAttempts: 3,
          timeoutMs: 30000,
          fallbackMode: 'basic',
          errorNotification: this.context.options.verbose || false,
          enableContextIntelligence: this.context.options.contextAware,
          enablePerformanceOptimization: this.context.options.performance,
          enableErrorResilience: this.context.options.resilience,
          ...this.context.options,
          ...options,
        },
        session: this.currentSession ?? undefined,
      };

      const response = await this.coordinator.processOperation(request);

      if (response.success) {
        return response.result;
      } else {
        throw new Error(response.error ?? 'Tool execution failed');
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      await this.userInteraction.error(`Tool execution failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get intelligent command suggestions
   */
  public async getSuggestions(context?: string): Promise<
    ReadonlyArray<{
      command: string;
      description: string;
      examples: ReadonlyArray<string>;
      relevance: number;
    }>
  > {
    if (!this.initialized) {
      return [];
    }

    try {
      const commands: ReadonlyArray<{
        command: string;
        description: string;
        examples: ReadonlyArray<string>;
        contextRelevance: number;
      }> = await (this.coordinator.getIntelligentCommands as (context?: string) => Promise<ReadonlyArray<{
        command: string;
        description: string;
        examples: ReadonlyArray<string>;
        contextRelevance: number;
      }>>)(context);
      return commands.map(
        (
          cmd: Readonly<{
            command: string;
            description: string;
            examples: ReadonlyArray<string>;
            contextRelevance: number;
          }>
        ) => ({
          command: cmd.command,
          description: cmd.description,
          examples: cmd.examples,
          relevance: cmd.contextRelevance,
        })
      );
    } catch (error) {
      this.logger.warn('Failed to get suggestions:', error);
      return [];
    }
  }

  /**
   * Start interactive REPL mode
   */
  public async startInteractive(): Promise<void> {
    if (!this.currentSession) {
      this.currentSession = await this.coordinator.createSession(this.context.workingDirectory);
      this.context.sessionId = this.currentSession.id;
    }

    // Get context information for display
    let contextInfo: { type?: string; language?: string; confidence?: number } = {};
    try {
      const contextStatus = this.coordinator.getQuickContextStatus();
      contextInfo = {
        type: contextStatus.basic.type,
        language: contextStatus.basic.language,
        confidence: contextStatus.confidence,
      };
    } catch (error) {
      // Silent fail for context status
    }

    // Delegate to InteractiveSessionHandler
    await this.interactiveSessionHandler.startInteractive(contextInfo);
  }

  /**
   * Run CLI with command line arguments
   */
  public async run(args: ReadonlyArray<string>): Promise<void> {
    if (!this.initialized) {
      throw new Error('CLI not initialized. Call initialize() first.');
    }

    try {
      if (args.length === 0) {
        // No arguments provided. If stdin is not a TTY (piped input),
        // read from stdin once and process as a single prompt.
        if (!process.stdin.isTTY) {
          const input: string = await new Promise<string>(resolve => {
            let data = '';
            try {
              process.stdin.setEncoding('utf8');
            } catch {
              // ignore
            }
            process.stdin.on('data', (chunk: Readonly<Buffer> | string) => {
              data += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
            });
            process.stdin.on('end', () => {
              resolve(data);
            });
            process.stdin.on('error', () => {
              resolve(data);
            });
          });

          const prompt = input.trim();
          if (prompt.length === 0) {
            // Nothing was piped; fall back to interactive.
            await this.startInteractive();
            return;
          }

          // For piped, default to safe behavior but ensure output is shown.
          const response = await this.processPrompt(prompt, { dryRun: true });
          await this.userInteraction.display(response);
          return;
        }

        // No args and stdin is a TTY -> interactive mode
        await this.startInteractive();
        return;
      }

      // Parse command line arguments
      const [command, ...remainingArgs] = args;

      switch (command) {
        case 'interactive':
        case '-i':
        case '--interactive':
          await this.startInteractive();
          break;

        case 'analyze':
        case '--analyze': {
          if (remainingArgs.length === 0) {
            await this.userInteraction.error('analyze command requires a file path');
            return;
          }

          // Check approval for file analysis
          const analyzeApproval = await this.checkOperationApproval(
            'analyze_file',
            `Analyze file: ${remainingArgs[0]}`,
            'low',
            false
          );

          if (!analyzeApproval.approved) {
            await this.userInteraction.error(`Analysis not approved: ${analyzeApproval.reason}`);
            return;
          }

          const result = await this.analyzeFile(remainingArgs[0]);
          await this.userInteraction.display(JSON.stringify(result, null, 2));
          break;
        }

        case 'status':
        case '--status': {
          // Check approval for status check (low risk, read-only operation)
          const statusApproval = await this.checkOperationApproval(
            'show_status',
            'Display system status and configuration',
            'low',
            false
          );

          if (!statusApproval.approved) {
            await this.userInteraction.error(`Status check not approved: ${statusApproval.reason}`);
            return;
          }

          await this.showStatus();
          break;
        }

        case 'help':
        case '--help':
        case '-h':
          await this.showHelp();
          break;

        case 'approvals':
        case '--approvals':
          await this.handleApprovalsCommand(remainingArgs);
          break;

        default: {
          // Treat as a prompt. Support simple flags: --write/-w and --dry-run
          const writeFlag = args.includes('--write') || args.includes('-w');
          const dryRunFlag = args.includes('--dry-run');
          const promptArgs = args.filter(a => a !== '--write' && a !== '-w' && a !== '--dry-run');
          const prompt = promptArgs.join(' ');

          // Determine if this is likely a code generation request
          const isCodeGeneration = this.isLikelyCodeGeneration(prompt);

          // For code generation, default to writing files unless --dry-run is explicitly set
          // For other prompts, default to dry-run unless --write is explicitly set
          let dryRunOption: boolean;
          if (dryRunFlag) {
            dryRunOption = true; // Explicit --dry-run always takes precedence
          } else if (writeFlag) {
            dryRunOption = false; // Explicit --write always takes precedence
          } else if (isCodeGeneration) {
            dryRunOption = false; // Code generation defaults to writing files
          } else {
            dryRunOption = true; // Other prompts default to dry-run for safety
          }

          // Check approval for prompt processing
          const approved = await this.checkOperationApproval(
            'process_prompt',
            `Process user prompt: ${prompt}`,
            isCodeGeneration ? 'medium' : 'low',
            !dryRunOption
          );

          if (!approved.approved) {
            await this.userInteraction.error(`Operation not approved: ${approved.reason}`);
            return;
          }

          const response = await this.processPrompt(prompt, { dryRun: dryRunOption });
          await this.userInteraction.display(response);
          break;
        }
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      await this.userInteraction.error(`CLI error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Check operation approval using ApprovalHandler
   */
  private async checkOperationApproval(
    operation: string,
    description: string,
    riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    hasWriteAccess: boolean = false
  ): Promise<{ approved: boolean; reason?: string }> {
    return this.approvalHandler.checkOperationApproval({
      operation,
      description,
      riskLevel,
      hasWriteAccess,
      workingDirectory: process.cwd(),
    });
  }

  /**
   * Handle approval mode commands
   */
  private async handleApprovalsCommand(args: string[]): Promise<void> {
    await this.approvalHandler.handleApprovalsCommand(args);
  }

  /**
   * Show help information
   */
  private async showHelp(): Promise<void> {
    const help = `
${chalk.cyan('🤖 Unified CLI - AI-Powered Development Assistant')}

${chalk.yellow('Usage:')}
  Interactive mode: Start without arguments or use -i, --interactive
  Single command:   Provide your request as arguments
  File analysis:    analyze <filepath>
  Status check:     status

${chalk.yellow('Interactive Commands:')}
  help, .help         - Show this help
  status, .status     - Show system status
  suggestions, .suggestions - Show intelligent suggestions
  exit, quit, .exit   - Exit interactive mode

${chalk.yellow('Features:')}
  ✨ Context-aware responses based on your project
  🚀 Performance-optimized with lazy loading
  🛡️  Error resilience with automatic recovery
  🧠 Multi-voice AI collaboration
  📊 Project intelligence and analysis

${chalk.yellow('Examples:')}
  crucible "Analyze this function for performance issues"
  crucible analyze src/main.ts
  crucible "Create a new React component for user login"
  crucible interactive
`;
    await this.userInteraction.display(help);
  }

  /**
   * Check if a prompt is likely a code generation request
   */
  private isLikelyCodeGeneration(prompt: string): boolean {
    return this.approvalHandler.isLikelyCodeGeneration(prompt);
  }

  /**
   * Show system status
   */
  public async showStatus(): Promise<void> {
    try {
      const metrics = this.coordinator.getSystemMetrics();
      const contextStatus = this.coordinator.getQuickContextStatus();

      const status = `
${chalk.cyan('📊 System Status')}

${chalk.yellow('Sessions:')}
  Active Sessions: ${metrics.coordinator.activeSessions}
  Operations Processed: ${metrics.coordinator.operationCount}
  
${chalk.yellow('Context Intelligence:')}
  Available: ${contextStatus.available ? '✅' : '❌'}
  Confidence: ${(contextStatus.confidence * 100).toFixed(0)}%
  Full Analysis: ${contextStatus.fullLoaded ? '✅' : '⏳'}
  
${chalk.yellow('System Health:')}
  Overall: ${metrics.systemHealth.isHealthy ? '✅' : '⚠️'} ${(metrics.systemHealth.healthScore * 100).toFixed(0)}%
  Error Recovery: ${metrics.coordinator.globalMetrics.errorsRecovered} recovered
  
${chalk.yellow('Capabilities:')}
  Context Intelligence: ${metrics.capabilities.contextIntelligence ? '✅' : '❌'}
  Performance Optimization: ${metrics.capabilities.performanceOptimization ? '✅' : '❌'}
  Error Resilience: ${metrics.capabilities.errorResilience ? '✅' : '❌'}
`;
      await this.userInteraction.display(status);
    } catch (error) {
      await this.userInteraction.error(`Failed to get status: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Show intelligent suggestions
   */
  private async showSuggestions(): Promise<void> {
    try {
      const suggestions = await this.getSuggestions();

      if (suggestions.length === 0) {
        await this.userInteraction.display('No suggestions available at this time.', {
          type: 'info',
        });
        return;
      }

      let output = `\n${chalk.cyan('💡 Intelligent Suggestions:')}\n`;

      suggestions.slice(0, 8).forEach((suggestion, index) => {
        const relevanceBar = '█'.repeat(Math.ceil(suggestion.relevance * 10));
        output += `\n${chalk.green(`${index + 1}.`)} ${suggestion.command}`;
        output += `\n   ${suggestion.description}`;
        output += `\n   ${chalk.gray(`Relevance: ${relevanceBar} ${(suggestion.relevance * 100).toFixed(0)}%`)}`;
        if (suggestion.examples && suggestion.examples.length > 0) {
          output += `\n   ${chalk.dim(`Example: ${suggestion.examples[0]}`)}`;
        }
        output += '\n';
      });

      await this.userInteraction.display(output);
    } catch (error) {
      await this.userInteraction.error(`Failed to get suggestions: ${getErrorMessage(error)}`);
    }
  }

  /**
   * List available models
   */
  public async listModels(): Promise<void> {
    try {
      // Mock model list until coordinator method is implemented
      interface Model { name: string; description?: string; provider?: string }
      const models: Model[] = [
        { name: 'qwen2.5-coder:7b', description: 'Fast coding model', provider: 'Ollama' },
        { name: 'deepseek-coder:8b', description: 'Advanced reasoning model', provider: 'Ollama' },
        { name: 'llama3.2:3b', description: 'General purpose model', provider: 'Ollama' },
      ];

      if (models.length === 0) {
        await this.userInteraction.display('No models available.', { type: 'warn' });
        return;
      }

      let output = `\n${chalk.cyan('🤖 Available Models:')}\n`;
      models.forEach((model: Model, index: number) => {
        output += `\n${chalk.green(`${index + 1}.`)} ${model.name}`;
        if (model.description) {
          output += `\n   ${model.description}`;
        }
        if (model.provider) {
          output += `\n   ${chalk.gray(`Provider: ${model.provider}`)}`;
        }
      });

      await this.userInteraction.display(output);
    } catch (error) {
      await this.userInteraction.error(`Failed to list models: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Execute prompt processing (alias for processPrompt for backward compatibility)
   */
  public async executePromptProcessing(
    prompt: string,
    options: Readonly<Record<string, unknown>> = {}
  ): Promise<string> {
    return this.processPrompt(prompt, options);
  }

  /**
   * Get current session
   */
  public getCurrentSession(): CLISession | null {
    return this.currentSession;
  }

  /**
   * Get system metrics
   */
  public getMetrics(): ReturnType<UnifiedCLICoordinator['getSystemMetrics']> {
    return this.coordinator.getSystemMetrics();
  }

  /**
   * Shutdown and cleanup
   */
  public shutdown(): void {
    if (this.currentSession) {
      this.coordinator.closeSession(this.currentSession.id);
      this.currentSession = null;
    }

    this.coordinator.shutdown();
    this.cleanupEventHandlers();

    // Cleanup modular components
    this.approvalHandler.cleanup();
    cleanupApprovalManager();

    const sessionDuration = performance.now() - this.context.startTime;
    this.logger.info(`UnifiedCLI session ended after ${sessionDuration.toFixed(2)}ms`);

    this.initialized = false;
    this.removeAllListeners();
  }

  public dispose(): void {
    this.shutdown();
  }

  private cleanupEventHandlers(): void {
    if (this.coordinatorInitializedHandler) {
      this.coordinator.off('initialized', this.coordinatorInitializedHandler);
    }
    if (this.coordinatorCriticalHandler) {
      this.coordinator.off('error:critical', this.coordinatorCriticalHandler);
    }
    if (this.coordinatorOverloadHandler) {
    if (this._sigintWrapper) {
      process.off('SIGINT', this._sigintWrapper);
    }
    if (this._sigtermWrapper) {
      process.off('SIGTERM', this._sigtermWrapper);
    }
      if (this._sigtermWrapper) {
        process.off('SIGTERM', this._sigtermWrapper);
      }
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Forward coordinator events
    this.coordinatorInitializedHandler = (): void => {
      this.emit('coordinator:initialized');
    };
    this.coordinator.on('initialized', this.coordinatorInitializedHandler);

    this.coordinatorCriticalHandler = (data: unknown): void => {
      this.emit('error:critical', data);
      this.logger.error('Critical error in CLI coordinator:', data);
    };
    this.coordinator.on('error:critical', this.coordinatorCriticalHandler);

    this.coordinatorOverloadHandler = (data: unknown): void => {
      this.emit('error:overload', data);
      this.logger.warn('System overload in CLI coordinator:', data);
    };
    this.coordinator.on('error:overload', this.coordinatorOverloadHandler);

    // Handle process termination
    // Wrap async handlers in a synchronous function for process.on/off
    this.sigintHandler = async (): Promise<void> => {
      await this.userInteraction.display('\n👋 Shutting down gracefully...');
      this.shutdown();
    };
    const sigintWrapper: () => void = () => {
      // Call the async handler, but don't await since process.on expects a sync function
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.sigintHandler?.();
    };
    process.on('SIGINT', sigintWrapper);

    this.sigtermHandler = async (): Promise<void> => {
      this.shutdown();
      process.exit(0);
    };
    const sigtermWrapper: () => void = () => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.sigtermHandler?.();
    };
    process.on('SIGTERM', sigtermWrapper);

    // Store wrappers for removal
    this._sigintWrapper = sigintWrapper;
    this._sigtermWrapper = sigtermWrapper;
  }

  // REPLInterface implementation
  public async start(): Promise<void> {
    await this.startInteractive();
  }

  public async stop(): Promise<void> {
    this.shutdown();
  }

  public async processCommand(command: string): Promise<string> {
    return this.processPrompt(command);
  }

  public async read(): Promise<string> {
    return this.userInteraction.prompt('🤖 > ');
  }

  public async eval(input: string): Promise<string> {
    return this.processPrompt(input);
  }

  public async print(output: string): Promise<void> {
    await this.userInteraction.display(output);
  }

  public async loop(): Promise<void> {
    await this.startInteractive();
  }

  // (removed duplicate showHelp; primary help exists earlier in file)
}

export default UnifiedCLI;
