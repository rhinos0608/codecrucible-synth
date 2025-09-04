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
import {
  ApprovalModesManager,
  Permission,
  cleanupApprovalManager,
  getApprovalManager,
} from '../../infrastructure/security/approval-modes-manager.js';
import chalk from 'chalk';

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
  // Removed unused orchestrator property
  private readonly userInteraction: IUserInteraction;
  private readonly eventBus: IEventBus;
  private readonly logger: ILogger;

  private readonly context: CLIContext;
  private currentSession: CLISession | null = null;
  private initialized = false;
  private coordinatorInitializedHandler?: () => void;
  private coordinatorCriticalHandler?: (data: unknown) => void;
  private coordinatorOverloadHandler?: (data: unknown) => void;
  private sigintHandler?: () => Promise<void>;
  private sigtermHandler?: () => Promise<void>;

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
    this.setupEventHandlers();
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
      const request: CLIOperationRequest = {
        id: randomUUID(),
        type: 'prompt',
        input: prompt,
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

        return this.formatResponse(response.result);
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
        return response.result as unknown;
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
        return response.result as unknown;
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
      }> = await this.coordinator.getIntelligentCommands(context);
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

    await this.userInteraction.display('🚀 Starting interactive mode...', { type: 'info' });
    await this.userInteraction.display('Type "exit", "quit", or press Ctrl+C to quit.', {
      type: 'info',
    });

    // Show quick context status if available
    try {
      const contextStatus = await this.coordinator.getQuickContextStatus();
      if (contextStatus.basic) {
        await this.userInteraction.display(
          `📊 Project: ${contextStatus.basic.type} (${contextStatus.basic.language}) - Confidence: ${(contextStatus.confidence * 100).toFixed(0)}%`,
          { type: 'info' }
        );
      }
    } catch (error) {
      // Silent fail for context status
    }

    let running = true;
    while (running) {
      try {
        const input = await this.userInteraction.prompt('🤖 > ');

        if (['exit', 'quit', '.exit', '.quit'].includes(input.trim().toLowerCase())) {
          running = false;
          continue;
        }

        if (input.trim() === '') {
          continue;
        }

        // Special commands
        if (input.trim() === 'help' || input.trim() === '.help') {
          await this.showHelp();
          continue;
        }

        if (input.trim() === 'status' || input.trim() === '.status') {
          await this.showStatus();
          continue;
        }

        if (input.trim() === 'suggestions' || input.trim() === '.suggestions') {
          await this.showSuggestions();
          continue;
        }

        // Plugin command registry helpers
        if (input.trim() === 'commands' || input.trim() === '.commands') {
          await this.showCommands();
          continue;
        }

        if (input.trim().startsWith('exec ') || input.trim().startsWith('.exec ')) {
          const line = input.trim().replace(/^\.?exec\s+/, '');
          const [name, ...rest] = line.split(/\s+/);
          if (!name) {
            await this.userInteraction.error('Usage: exec <command> [args as JSON or tokens]');
            continue;
          }
          let args: unknown[] = [];
          const joined = rest.join(' ');
          if (joined) {
            try {
              // Try JSON array or single JSON value
              const parsed: unknown = JSON.parse(joined);
              args = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              args = rest;
            }
          }
          const result: unknown = await this.execCommand(name, args);
          await this.userInteraction.display(
            typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          );
          continue;
        }

        // Interactive mode defaults to dry-run to avoid accidental writes
        const response = await this.processPrompt(input.trim(), { dryRun: true });
        await this.userInteraction.display(response);
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        await this.userInteraction.error(`Error: ${errorMessage}`);

        // Ask if user wants to continue
        const continueSession = await this.userInteraction.confirm('Continue session?');
        if (!continueSession) {
          running = false;
        }
      }
    }

    await this.userInteraction.display('👋 Interactive session ended.', { type: 'success' });
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
            process.stdin.on('data', (chunk: Buffer | string) => {
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
   * Check operation approval using ApprovalModesManager
   */
  private async checkOperationApproval(
    operation: string,
    description: string,
    riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    hasWriteAccess: boolean = false
  ): Promise<{ approved: boolean; reason?: string }> {
    const approvalManager = getApprovalManager();

    // Determine required permissions based on operation
    const permissions: Permission[] = [];

    if (hasWriteAccess) {
      permissions.push(ApprovalModesManager.permissions.writeWorkingDir());
    } else {
      permissions.push(ApprovalModesManager.permissions.readWorkingDir());
    }

    // Add execute permission for command operations
    if (operation.includes('execute') || operation.includes('command')) {
      permissions.push(ApprovalModesManager.permissions.executeWorkingDir());
    }

    const request = ApprovalModesManager.createRequest(
      operation,
      description,
      permissions,
      {
        workingDirectory: process.cwd(),
        enterpriseCompliance: true,
      },
      riskLevel
    );

    return await approvalManager.requestApproval(request);
  }

  /**
   * Handle approval mode commands
   */
  private async handleApprovalsCommand(args: string[]): Promise<void> {
    const approvalManager = getApprovalManager();

    if (args.length === 0) {
      // Show current approval mode and statistics
      const stats = approvalManager.getStats();
      await this.userInteraction.display(`
${chalk.cyan('🔒 Approval System Status')}

${chalk.yellow('Current Mode:')} ${chalk.green(stats.currentMode)}
${chalk.yellow('Cached Rules:')} ${stats.cachedRules}
${chalk.yellow('Session Approvals:')} ${stats.sessionApprovals}

${chalk.yellow('Available Modes:')}
  • auto - Automatic approval for safe operations
  • read-only - Only read operations allowed
  • full-access - All operations approved (except critical)
  • interactive - Always prompt for approval
  • enterprise-audit - Strict compliance with audit trail
  • voice-collaborative - Optimized for multi-voice collaboration

${chalk.gray('Usage:')} approvals <mode> | approvals status | approvals clear
      `);
      return;
    }

    const command = args[0].toLowerCase();

    switch (command) {
      case 'status': {
        const stats = approvalManager.getStats();
        await this.userInteraction.display(JSON.stringify(stats, null, 2));
        break;
      }

      case 'clear': {
        approvalManager.clearCache();
        await this.userInteraction.display(chalk.green('✅ Approval cache cleared'));
        break;
      }

      case 'auto':
      case 'read-only':
      case 'full-access':
      case 'interactive':
      case 'enterprise-audit':
      case 'voice-collaborative':
        try {
          approvalManager.setMode(command as any);
          await this.userInteraction.display(chalk.green(`✅ Approval mode set to: ${command}`));
        } catch (error) {
          await this.userInteraction.error(
            `Failed to set approval mode: ${getErrorMessage(error)}`
          );
        }
        break;

      default:
        await this.userInteraction.error(
          `Unknown approval command: ${command}. Use 'approvals' for help.`
        );
    }
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
    const lowerPrompt = prompt.toLowerCase();

    // EXCLUDE: Help/advice/explanation questions should NOT be treated as code generation
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

    // INCLUDE: Strong code generation indicators
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

    // Check for strong generation patterns
    if (strongGenerationKeywords.some(keyword => lowerPrompt.includes(keyword))) {
      return true;
    }

    // Weaker keywords only if they appear with creation context
    const weakKeywords = ['function', 'class', 'component', 'module', 'interface'];
    const creationContext = ['new', 'create', 'make', 'add', 'build'];

    return weakKeywords.some(
      keyword =>
        lowerPrompt.includes(keyword) &&
        creationContext.some(context => lowerPrompt.includes(context))
    );
  }

  /**
   * Show system status
   */
  public async showStatus(): Promise<void> {
    try {
      const metrics = this.coordinator.getSystemMetrics();
      const contextStatus = await this.coordinator.getQuickContextStatus();

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
      const models = [
        { name: 'qwen2.5-coder:7b', description: 'Fast coding model', provider: 'Ollama' },
        { name: 'deepseek-coder:8b', description: 'Advanced reasoning model', provider: 'Ollama' },
        { name: 'llama3.2:3b', description: 'General purpose model', provider: 'Ollama' },
      ];

      if (models.length === 0) {
        await this.userInteraction.display('No models available.', { type: 'warn' });
        return;
      }

      let output = `\n${chalk.cyan('🤖 Available Models:')}\n`;
      models.forEach((model: any, index: number) => {
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
  public async executePromptProcessing(prompt: string, options: any = {}): Promise<string> {
    return await this.processPrompt(prompt, options);
  }

  /**
   * Get current session
   */
  getCurrentSession(): CLISession | null {
    return this.currentSession;
  }

  /**
   * Get system metrics
   */
  getMetrics(): any {
    return this.coordinator.getSystemMetrics();
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.currentSession) {
      await this.coordinator.closeSession(this.currentSession.id);
      this.currentSession = null;
    }

    await this.coordinator.shutdown();
    this.cleanupEventHandlers();

    // Cleanup singleton instances
    cleanupApprovalManager();

    const sessionDuration = performance.now() - this.context.startTime;
    this.logger.info(`UnifiedCLI session ended after ${sessionDuration.toFixed(2)}ms`);

    this.initialized = false;
    this.removeAllListeners();
  }

  async dispose(): Promise<void> {
    await this.shutdown();
  }

  private cleanupEventHandlers(): void {
    if (this.coordinatorInitializedHandler) {
      this.coordinator.off('initialized', this.coordinatorInitializedHandler);
      this.coordinatorInitializedHandler = undefined;
    }
    if (this.coordinatorCriticalHandler) {
      this.coordinator.off('error:critical', this.coordinatorCriticalHandler);
      this.coordinatorCriticalHandler = undefined;
    }
    if (this.coordinatorOverloadHandler) {
      this.coordinator.off('error:overload', this.coordinatorOverloadHandler);
      this.coordinatorOverloadHandler = undefined;
    }
    if (this.sigintHandler) {
      process.off('SIGINT', this.sigintHandler);
      this.sigintHandler = undefined;
    }
    if (this.sigtermHandler) {
      process.off('SIGTERM', this.sigtermHandler);
      this.sigtermHandler = undefined;
    }
  }

  /**
   * Format response for display with ultra-concise patterns
   */
  private formatResponse(result: any): string {
    let formattedResult = '';

    if (typeof result === 'string') {
      formattedResult = result;
    } else {
      formattedResult = this.formatComplexResult(result);
    }

    // Apply Claude Code ultra-concise communication patterns
    return this.applyCLIConciseness(formattedResult);
  }

  private formatComplexResult(result: any): string {
    if (result && typeof result === 'object') {
      // Handle code generation results
      if (result.generated && Array.isArray(result.generated.files)) {
        const files = result.generated.files;
        let output = `${result.generated.summary || 'Generated output'}\n`;
        if (files.length > 0) {
          output += '\nFiles:\n';
          files.forEach((f: any) => {
            const size = typeof f.content === 'string' ? `${f.content.length} chars` : '';
            output += `- ${f.path} (${f.type}${size ? `, ${size}` : ''})\n`;
          });
          // If only a single fallback file was produced, show a short preview
          if (files.length === 1 && String(files[0].path).startsWith('generated-code')) {
            const preview =
              typeof files[0].content === 'string' ? files[0].content.slice(0, 600) : '';
            if (preview) {
              output += '\nPreview (not saved by default):\n';
              output += `\`\`\`\n${preview}${files[0].content.length > 600 ? '\n...\n' : '\n'}\`\`\`\n`;
            }
          }
        }
        return output.trim();
      }
      // Handle structured analysis results
      if (result.analysis && typeof result.analysis === 'object') {
        let output = '';

        if (result.analysis.summary) {
          output += `${result.analysis.summary}\n\n`;
        }

        if (
          result.analysis.insights &&
          Array.isArray(result.analysis.insights) &&
          result.analysis.insights.length > 0
        ) {
          output += '💡 Key Insights:\n';
          result.analysis.insights.forEach((insight: string) => {
            output += `• ${insight}\n`;
          });
          output += '\n';
        }

        if (
          result.analysis.recommendations &&
          Array.isArray(result.analysis.recommendations) &&
          result.analysis.recommendations.length > 0
        ) {
          output += '🔧 Recommendations:\n';
          result.analysis.recommendations.forEach((rec: string) => {
            output += `• ${rec}\n`;
          });
          output += '\n';
        }

        return output.trim();
      }

      if (result.response) {
        return result.response;
      }

      if (result.content) {
        return result.content;
      }

      if (result.suggestions && Array.isArray(result.suggestions)) {
        let output = result.message || result.result || '';
        if (result.suggestions.length > 0) {
          output += '\n\n💡 Suggestions:\n';
          result.suggestions.forEach((suggestion: any, index: number) => {
            output += `${index + 1}. ${suggestion.title || suggestion.description || suggestion}\n`;
          });
        }
        return output;
      }

      return JSON.stringify(result, null, 2);
    }

    return String(result);
  }

  /**
   * Apply Claude Code ultra-concise communication patterns to CLI responses
   */
  private applyCLIConciseness(content: string): string {
    if (!content || typeof content !== 'string') return content;

    // Remove verbose CLI-specific patterns
    content = content
      // Remove status confirmations
      .replace(/\b(successfully|completed successfully|operation completed)\b\s*/gi, '')
      // Remove CLI pleasantries
      .replace(/\b(please find|you can find|the following|as follows)\b\s*/gi, '')
      // Remove redundant descriptions
      .replace(/\b(the result is|the output is|here's the result)\b\s*/gi, '')
      // Remove unnecessary status updates
      .replace(/\b(processing|working|analyzing)\.\.\.\s*/gi, '')
      // Simplify common CLI patterns
      .replace(/generated output/gi, 'Generated')
      .replace(/key insights:/gi, 'Insights:')
      .replace(/recommendations:/gi, 'Actions:')
      .replace(/suggestions:/gi, 'Options:');

    // Apply direct response patterns for CLI
    content = content
      // Direct file operations
      .replace(/files created:/gi, 'Created:')
      .replace(/files modified:/gi, 'Modified:')
      .replace(/files analyzed:/gi, 'Analyzed:')
      // Direct status reports
      .replace(/system status:/gi, 'Status:')
      .replace(/current state:/gi, 'State:')
      .replace(/available options:/gi, 'Options:');

    // Ultra-concise error and success patterns
    content = content
      .replace(/error occurred:/gi, 'Error:')
      .replace(/warning:/gi, 'Warning:')
      .replace(/information:/gi, 'Info:')
      .replace(/success:/gi, '✅')
      .replace(/failed:/gi, '❌')
      .replace(/completed:/gi, '✅');

    // Remove CLI fluff and keep only essential information
    content = content
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .replace(/\s{2,}/g, ' ') // Max 1 consecutive space
      .replace(/^\s*\n/gm, '') // Remove lines with only whitespace
      .trim();

    // Apply line length limits for CLI readability (aim for <80 chars where possible)
    const lines = content.split('\n');
    const processedLines = lines.map(line => {
      if (line.length > 120) {
        // For very long lines, try to break at logical points
        return this.breakLongLine(line);
      }
      return line;
    });

    return processedLines.join('\n');
  }

  /**
   * Break long CLI lines at logical points
   */
  private breakLongLine(line: string): string {
    if (line.length <= 120) return line;

    // Don't break code blocks or JSON
    if (line.includes('```') || line.trim().startsWith('{') || line.trim().startsWith('[')) {
      return line;
    }

    // Break at logical separators
    const breakPoints = [', ', ' - ', ' | ', ' and ', ' or ', ' but '];
    for (const breakPoint of breakPoints) {
      const index = line.indexOf(breakPoint, 80);
      if (index > 0 && index < 120) {
        return `${line.substring(0, index + breakPoint.length).trim()}\n  ${line
          .substring(index + breakPoint.length)
          .trim()}`;
      }
    }

    return line; // Return as-is if no good break point found
  }

  private async showCommands(): Promise<void> {
    try {
      const { UnifiedOrchestrationService } = await import(
        '../services/unified-orchestration-service.js'
      );
      const svc = await UnifiedOrchestrationService.getInstance();
      const cmds = svc.listPluginCommands();
      if (!cmds.length) {
        await this.userInteraction.display('No plugin commands registered.');
        return;
      }
      const lines = cmds.map(c => `- ${c.name}${c.description ? `: ${c.description}` : ''}`);
      await this.userInteraction.display(['Available commands:', ...lines].join('\n'));
    } catch (err) {
      await this.userInteraction.error(`Failed to list commands: ${getErrorMessage(err)}`);
    }
  }

  private async execCommand(name: string, args: any[]): Promise<any> {
    const { UnifiedOrchestrationService } = await import(
      '../services/unified-orchestration-service.js'
    );
    const svc = await UnifiedOrchestrationService.getInstance();
    return svc.executePluginCommand(name, ...(args || []));
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Forward coordinator events
    this.coordinatorInitializedHandler = () => {
      this.emit('coordinator:initialized');
    };
    this.coordinator.on('initialized', this.coordinatorInitializedHandler);

    this.coordinatorCriticalHandler = data => {
      this.emit('error:critical', data);
      this.logger.error('Critical error in CLI coordinator:', data);
    };
    this.coordinator.on('error:critical', this.coordinatorCriticalHandler);

    this.coordinatorOverloadHandler = data => {
      this.emit('error:overload', data);
      this.logger.warn('System overload in CLI coordinator:', data);
    };
    this.coordinator.on('error:overload', this.coordinatorOverloadHandler);

    // Handle process termination
    this.sigintHandler = async () => {
      await this.userInteraction.display('\n👋 Shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    };
    process.on('SIGINT', this.sigintHandler);

    this.sigtermHandler = async () => {
      await this.shutdown();
      process.exit(0);
    };
    process.on('SIGTERM', this.sigtermHandler);
  }

  // REPLInterface implementation
  async start(): Promise<void> {
    await this.startInteractive();
  }

  async stop(): Promise<void> {
    await this.shutdown();
  }

  async processCommand(command: string): Promise<string> {
    return await this.processPrompt(command);
  }

  async read(): Promise<string> {
    return await this.userInteraction.prompt('🤖 > ');
  }

  async eval(input: string): Promise<string> {
    return await this.processPrompt(input);
  }

  async print(output: string): Promise<void> {
    await this.userInteraction.display(output);
  }

  async loop(): Promise<void> {
    await this.startInteractive();
  }

  // (removed duplicate showHelp; primary help exists earlier in file)
}

export default UnifiedCLI;
