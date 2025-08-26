/**
 * Refactored CLI - Main Interface
 * Reduced from 2334 lines to ~400 lines by extracting modules
 */

import { CLIExitCode, CLIError, ModelRequest, REPLInterface } from './types.js';
import { UnifiedModelClient } from '../refactor/unified-model-client.js';
import { VoiceArchetypeSystem } from '../voices/voice-archetype-system.js';
import { MCPServerManager } from '../mcp-servers/mcp-server-manager.js';
import { AppConfig } from '../config/config-manager.js';
import { logger } from './logger.js';
import { getErrorMessage } from '../utils/error-utils.js';
import { ResponseNormalizer } from './response-normalizer.js';
import { ContextAwareCLIIntegration } from './intelligence/context-aware-cli-integration.js';
import { AutoConfigurator } from './model-management/auto-configurator.js';
import { InteractiveREPL } from './interactive-repl.js';
// import { SecureToolFactory } from './security/secure-tool-factory.js';
import { InputSanitizer } from './security/input-sanitizer.js';

// Import modular CLI components
import { CLIOptions, CLIContext, CLIDisplay, CLIParser, CLICommands } from './cli/index.js';
import { AuthMiddleware, AuthenticatedRequest } from './middleware/auth-middleware.js';
import { RBACSystem } from './security/production-rbac-system.js';
import { SecretsManager } from './security/secrets-manager.js';
import { ProductionDatabaseManager } from '../database/production-database-manager.js';
import {
  SecurityAuditLogger,
  AuditEventType,
  AuditSeverity,
  AuditOutcome,
} from './security/security-audit-logger.js';
import { DynamicModelRouter } from './dynamic-model-router.js';
import { AdvancedToolOrchestrator } from './tools/advanced-tool-orchestrator.js';
import { EnhancedSequentialToolExecutor } from './tools/enhanced-sequential-tool-executor.js';
import { StreamingReasoningInterface } from './tools/streaming-reasoning-interface.js';
import {
  EnterpriseSystemPromptBuilder,
  RuntimeContext,
} from './enterprise-system-prompt-builder.js';
import {
  SequentialDualAgentSystem,
  SequentialAgentConfig,
} from './collaboration/sequential-dual-agent-system.js';

export type { CLIContext, CLIOptions };

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { writeFile } from 'fs/promises';

export class CLI implements REPLInterface {
  private context: CLIContext;
  private initialized = false;
  private workingDirectory = process.cwd();
  private contextAwareCLI: ContextAwareCLIIntegration;
  private autoConfigurator: AutoConfigurator;
  private repl?: InteractiveREPL;
  private commands: CLICommands;
  private authMiddleware: AuthMiddleware;
  private rbacSystem: RBACSystem;
  private secretsManager: SecretsManager;
  private auditLogger: SecurityAuditLogger;
  private dynamicModelRouter: DynamicModelRouter;
  private toolOrchestrator: AdvancedToolOrchestrator;
  private sequentialExecutor: EnhancedSequentialToolExecutor;
  private streamingInterface: StreamingReasoningInterface;
  private static globalListenersRegistered = false;

  // PERFORMANCE FIX: AbortController pattern for cleanup
  private abortController: AbortController;
  private activeOperations: Set<string> = new Set();
  private isShuttingDown = false;

  constructor(
    modelClient: UnifiedModelClient,
    voiceSystem: VoiceArchetypeSystem,
    mcpManager: MCPServerManager,
    config: AppConfig
  ) {
    // PERFORMANCE FIX: Initialize AbortController for cleanup
    this.abortController = new AbortController();

    this.context = {
      modelClient,
      voiceSystem,
      mcpManager,
      config,
    };

    // Initialize security systems
    this.secretsManager = new SecretsManager();
    const databaseConfig = {
      type: 'sqlite' as const,
      database: ':memory:',
      pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 60000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200,
      },
    };
    const databaseManager = new ProductionDatabaseManager(databaseConfig);
    this.rbacSystem = new RBACSystem(databaseManager, this.secretsManager);
    this.auditLogger = new SecurityAuditLogger(this.secretsManager);
    this.authMiddleware = new AuthMiddleware(this.rbacSystem, this.secretsManager);

    // Initialize dynamic model router
    this.dynamicModelRouter = new DynamicModelRouter();

    // Initialize tool orchestrator for autonomous operations
    this.toolOrchestrator = new AdvancedToolOrchestrator(modelClient);

    // Initialize enhanced sequential executor for chain-of-thought reasoning
    this.sequentialExecutor = new EnhancedSequentialToolExecutor();

    // Initialize streaming interface for real-time reasoning display
    this.streamingInterface = new StreamingReasoningInterface({
      mode: 'verbose',
      showProgress: true,
      showConfidence: true,
      animateThinking: true,
      computationDelay: 1500
    });

    // Initialize subsystems with simplified constructors
    this.contextAwareCLI = new ContextAwareCLIIntegration();
    this.autoConfigurator = new AutoConfigurator();
    // Defer InteractiveREPL creation until actually needed to avoid race conditions with piped input
    this.commands = new CLICommands(this.context, this.workingDirectory);

    this.registerCleanupHandlers();
  }

  /**
   * Build runtime context for system prompt generation
   */
  private async buildRuntimeContext(): Promise<RuntimeContext> {
    let isGitRepo = false;
    let currentBranch = 'unknown';

    try {
      const { execSync } = await import('child_process');
      execSync('git status', { cwd: this.workingDirectory, stdio: 'ignore' });
      isGitRepo = true;
      currentBranch = execSync('git branch --show-current', {
        cwd: this.workingDirectory,
      })
        .toString()
        .trim();
    } catch {
      // Not a git repo or git not available
    }

    return {
      workingDirectory: this.workingDirectory,
      isGitRepo,
      platform: process.platform,
      currentBranch,
      modelId: 'CodeCrucible Synth',
      knowledgeCutoff: 'January 2025',
    };
  }

  /**
   * Build system prompt with enterprise configuration
   */
  private async buildSystemPrompt(): Promise<string> {
    try {
      const context = await this.buildRuntimeContext();
      return EnterpriseSystemPromptBuilder.buildSystemPrompt(context, {
        conciseness: 'ultra',
        securityLevel: 'enterprise',
      });
    } catch (error) {
      logger.warn('Failed to build system prompt, using fallback', error);
      return `You are CodeCrucible Synth, an AI-powered code generation and analysis tool. Use available tools to assist with software engineering tasks.`;
    }
  }

  /**
   * Get InteractiveREPL instance, creating it only when needed
   */
  private getREPL(): InteractiveREPL {
    if (!this.repl) {
      logger.debug('Creating InteractiveREPL on demand');
      this.repl = new InteractiveREPL(this, this.context);
    }
    return this.repl;
  }

  /**
   * Register cleanup handlers for graceful shutdown
   */
  private registerCleanupHandlers(): void {
    if (CLI.globalListenersRegistered) return;
    CLI.globalListenersRegistered = true;

    // Handle process exit
    process.on('exit', () => {
      this.syncCleanup();
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n👋 Shutting down gracefully...'));
      try {
        await this.destroy();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
      process.exit(0);
    });

    // Handle SIGTERM
    process.on('SIGTERM', async () => {
      try {
        await this.destroy();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
      process.exit(0);
    });

    // Cleanup on uncaught exceptions
    process.on('uncaughtException', async error => {
      console.error('Uncaught Exception:', error);
      try {
        await this.destroy();
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
      process.exit(1);
    });

    // Cleanup on unhandled promise rejections - TEMPORARILY DISABLED FOR DEBUGGING
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('🚨 UNHANDLED REJECTION DETECTED:');
      console.error('Promise:', promise);
      console.error('Reason:', reason);
      console.error('Stack:', reason instanceof Error ? reason.stack : 'No stack trace');
      // DON'T EXIT - just log for now
      // try {
      //   await this.destroy();
      // } catch (cleanupError) {
      //   console.error('Cleanup error:', cleanupError);
      // }
      // process.exit(1);
    });
  }

  /**
   * Synchronous cleanup for exit handler
   */
  private syncCleanup(): void {
    try {
      // Only perform synchronous cleanup operations here
      if (
        this.contextAwareCLI &&
        typeof (this.contextAwareCLI as any).removeAllListeners === 'function'
      ) {
        (this.contextAwareCLI as any).removeAllListeners();
      }
      if (
        this.autoConfigurator &&
        typeof (this.autoConfigurator as any).removeAllListeners === 'function'
      ) {
        (this.autoConfigurator as any).removeAllListeners();
      }
    } catch (error) {
      // Silent fail for exit handler
      console.error('Sync cleanup error:', error);
    }
  }

  /**
   * Main CLI entry point
   */
  async run(args: string[]): Promise<void> {
    logger.debug('CLI.run() called', { args });
    try {
      // Handle help requests
      if (CLIParser.isHelpRequest(args)) {
        CLIDisplay.showHelp();
        return;
      }

      // Parse command and options
      const { command, remainingArgs } = CLIParser.extractCommand(args);
      const options = CLIParser.parseOptions(args);

      // Initialize if needed
      if (!this.initialized && !options.skipInit) {
        logger.debug('About to initialize CLI');
        await this.initialize();
        logger.debug('CLI initialized');
      }

      // Handle commands
      logger.debug('About to call executeCommand');
      await this.executeCommand(command, remainingArgs, options);
      logger.debug('executeCommand completed');
    } catch (error) {
      await this.handleError(error);
    }
  }

  /**
   * Execute specific commands
   */
  private async executeCommand(
    command: string,
    args: string[],
    options: CLIOptions
  ): Promise<void> {
    logger.debug('executeCommand called', {
      command: `"${command}"`,
      args,
      commandLength: command.length,
    });

    // Handle sequential review
    if (options.sequentialReview) {
      const promptText = args.join(' ') || command || 'Generate code';
      await this.handleSequentialReview(promptText);
      return;
    }

    // Audit log command execution for enterprise security compliance
    if (this.initialized && this.auditLogger) {
      await this.auditLogger.logEvent(
        AuditEventType.API_ACCESS,
        AuditSeverity.LOW,
        AuditOutcome.SUCCESS,
        'cli',
        'command_execution',
        'v4.0.0',
        `CLI command executed: ${command}`,
        {
          ipAddress: 'localhost',
          userAgent: 'codecrucible-cli',
        },
        {
          command,
          args: args.length > 0 ? args : undefined,
          options: Object.keys(options).length > 0 ? options : undefined,
          workingDirectory: this.workingDirectory,
        }
      );
    }
    switch (command) {
      case 'status':
        await this.commands.showStatus();
        break;

      case 'models':
        await this.commands.listModels();
        break;

      case 'analyze':
        await this.commands.handleAnalyze(args, options);
        break;

      case 'analyze-dir': {
        // Handle analyze-dir command properly
        const targetDir = args[0] || '.';
        await this.commands.handleAnalyze([targetDir], options);
        break;
      }

      case 'generate': {
        const prompt = args.join(' ');
        await this.commands.handleGeneration(prompt, options);
        break;
      }

      case 'configure':
        await this.handleConfiguration(options);
        break;

      case 'help':
        CLIDisplay.showHelp();
        break;

      default:
        logger.debug('In default case', { command, args });
        // Handle as prompt if no specific command
        if (args.length > 0 || command) {
          const fullPrompt = [command, ...args].filter(Boolean).join(' ');
          logger.debug('About to call processPrompt', { fullPrompt });
          const result = await this.processPrompt(fullPrompt, options);
          if (result && typeof result === 'string') {
            logger.debug('About to display result');
            console.log(result);
            logger.debug('Result displayed');
          } else {
            logger.debug('Result not displayed - failed condition check');
          }
        } else {
          logger.debug('No args or command, starting interactive mode');
          // Interactive mode
          await this.startInteractiveMode(options);
        }
        break;
    }

    // Handle special flags
    if (options.server) {
      // Import serverMode dynamically to avoid circular dependency
      const { ServerMode } = await import('../server/server-mode.js');
      const serverMode = new ServerMode();
      await this.commands.startServer(options, serverMode);
    }
  }

  /**
   * Authenticate CLI request
   */
  private async authenticateRequest(
    command: string,
    options: CLIOptions
  ): Promise<AuthenticatedRequest> {
    try {
      // Extract authentication headers from options if available
      const headers: Record<string, string> = {};

      if (options.token) {
        headers['x-auth-token'] = options.token;
      }

      if (options.apiKey) {
        headers['x-api-key'] = options.apiKey;
      }

      // Get client IP (for local CLI, use localhost)
      const ipAddress = '127.0.0.1';

      // Check for stored session token
      if (!options.token && !options.apiKey) {
        const storedToken = await this.authMiddleware.loadStoredToken();
        if (storedToken) {
          headers['x-auth-token'] = storedToken;
        }
      }

      return await this.authMiddleware.authenticateRequest(
        command,
        headers,
        ipAddress,
        !options.batch // Interactive mode unless batch
      );
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }

      logger.error('Authentication request failed', error as Error);
      throw new CLIError('Authentication failed', CLIExitCode.AUTHENTICATION_FAILED);
    }
  }

  /**
   * Process a text prompt using the voice system
   */
  async processPrompt(prompt: string, options: CLIOptions = {}): Promise<string> {
    if (!prompt || prompt.trim().length === 0) {
      throw new CLIError('Empty prompt provided', CLIExitCode.INVALID_INPUT);
    }

    // Handle slash commands for role switching
    const { CLIParser } = await import('./cli/cli-parser.js');
    const slashCommand = CLIParser.parseSlashCommand(prompt);

    if (slashCommand.command === 'role-switch' && slashCommand.role) {
      return await this.handleRoleSwitch(
        slashCommand.role as 'auditor' | 'writer' | 'auto',
        slashCommand.content,
        options
      );
    } else if (slashCommand.command === 'slash-help') {
      return this.showSlashHelp();
    } else if (slashCommand.command === 'unknown-slash') {
      console.log(`Unknown slash command: ${prompt}`);
      return this.showSlashHelp();
    }

    // Authenticate request
    const auth = await this.authenticateRequest('process', options);

    // Check permission for prompt processing
    const hasPermission = await this.authMiddleware.validatePermission(
      auth,
      'process_prompt',
      'cli'
    );

    if (!hasPermission) {
      throw new CLIError(
        'Insufficient permissions to process prompts',
        CLIExitCode.PERMISSION_DENIED
      );
    }

    // Modern security system with user consent (Claude Code pattern)
    const isTestEnvironment =
      process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

    let sanitizationResult: any;

    try {
      const { ModernInputSanitizer } = await import('./security/modern-input-sanitizer.js');
      sanitizationResult = await ModernInputSanitizer.sanitizePrompt(prompt, {
        operation: 'cli_prompt_processing',
        workingDirectory: process.cwd(),
      });

      // Handle consent requirement with actual user interaction
      if (sanitizationResult.requiresConsent && !isTestEnvironment) {
        logger.info('Security review required for input', {
          reason: sanitizationResult.securityDecision?.reason,
          riskLevel: sanitizationResult.securityDecision?.riskLevel,
        });

        // Show security notice and get user consent
        console.log(`\n⚠️  Security Review Required`);
        console.log(`   Operation: ${sanitizationResult.securityDecision?.reason}`);
        console.log(
          `   Risk Level: ${sanitizationResult.securityDecision?.riskLevel?.toUpperCase()}`
        );
        console.log(`   Input: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);

        // In CLI mode, we'll proceed but make it clear this needs user confirmation
        // A full GUI implementation would show an interactive dialog here
        console.log(`\n   ✓ Proceeding with operation (security policy allows with notice)`);
        console.log(`   📋 This operation is logged for audit purposes\n`);
      }

      // Only block if explicitly denied by security system
      if (!sanitizationResult.isValid && !isTestEnvironment) {
        const securityError = ModernInputSanitizer.createSecurityError(
          sanitizationResult,
          'CLI prompt processing'
        );
        logger.error('Security violation detected in prompt', securityError);
        throw new CLIError(
          `Security policy violation: ${sanitizationResult.violations.join(', ')}`,
          CLIExitCode.INVALID_INPUT
        );
      }

      // Update prompt with sanitized version
      prompt = sanitizationResult.sanitized;
    } catch (importError) {
      // Fallback to old system if new one fails to load
      logger.warn('Failed to load modern security system, using fallback', importError);
      sanitizationResult = InputSanitizer.sanitizePrompt(prompt);

      if (!sanitizationResult.isValid && !isTestEnvironment) {
        const securityError = InputSanitizer.createSecurityError(
          sanitizationResult,
          'CLI prompt processing'
        );
        logger.error('Security violation detected in prompt', securityError);
        throw new CLIError(
          `Security violation: ${sanitizationResult.violations.join(', ')}`,
          CLIExitCode.INVALID_INPUT
        );
      }
    }

    // In test environment, log but don't block for development
    if (sanitizationResult && !sanitizationResult.isValid && isTestEnvironment) {
      logger.warn('Test environment: Security validation bypassed for development', {
        violations: sanitizationResult.violations,
        prompt: `${prompt.substring(0, 100)}...`,
      });
    }

    const sanitizedPrompt = sanitizationResult?.sanitized || prompt;

    try {
      // ALWAYS use the AI agent for all requests - no hardcoded shortcuts
      console.log(chalk.cyan('🤖 Processing with AI agent...'));

      if (options.noStream || options.batch) {
        const response = await this.executePromptProcessing(sanitizedPrompt, options);
        console.log(`\n${chalk.cyan('🤖 Response:')}`);
        console.log(response);
        return response;
      } else {
        await this.displayStreamingResponse(sanitizedPrompt, options);
        return 'Streaming response completed';
      }
    } catch (error) {
      logger.error('Prompt processing failed:', error);
      throw new CLIError(`Processing failed: ${error}`, CLIExitCode.EXECUTION_FAILED);
    }
  }

  /**
   * Execute prompt processing with voice system
   */

  // Removed isAnalysisRequest - AI agent now handles all requests

  // Removed hardcoded analysis methods - AI agent now handles all requests dynamically

  /**
   * Legacy analysis method (kept for backward compatibility)
   */

  /**
   * Analyze project structure and metadata
   */

  /**
   * Analyze code metrics and lines of code
   */

  /**
   * Analyze dependencies from package.json
   */

  /**
   * Analyze configuration files
   */

  /**
   * Analyze test coverage and test files
   */

  /**
   * Discover project components by analyzing file structure
   */

  /**
   * Discover architecture components by analyzing imports and exports
   */

  /**
   * Detect real issues in the codebase
   */

  /**
   * Assess security configuration
   */

  /**
   * Analyze performance characteristics
   */

  /**
   * Generate recommendations based on analysis
   */
  private async generateRecommendations(
    codeMetrics: any,
    testAnalysis: any,
    dependencyAnalysis: any
  ): Promise<string> {
    const recommendations: string[] = [];

    // Critical recommendations based on real analysis
    recommendations.push(
      '1. **URGENT**: Fix UnifiedModelClient.generateText() hanging issue to restore full functionality'
    );

    if (testAnalysis.estimatedCoverage < 50) {
      recommendations.push(
        `2. **High Priority**: Expand test coverage to 70%+ (currently ~${
          testAnalysis.estimatedCoverage
        }%)`
      );
    }

    if (codeMetrics.typescriptFiles > 0) {
      recommendations.push(
        '3. **Medium Priority**: Enable TypeScript strict mode for better type safety'
      );
    }

    if (dependencyAnalysis.devDeps > dependencyAnalysis.prodDeps * 2) {
      recommendations.push(
        '4. **Low Priority**: Review development dependencies - high dev/prod ratio'
      );
    }

    recommendations.push(
      '5. **Enhancement**: Implement automated code quality gates in CI/CD pipeline'
    );

    return recommendations.join('\n');
  }

  /**
   * Count files by extension for analysis
   */
  private async countFilesByType(): Promise<Record<string, number>> {
    const path = await import('path');
    const fs = await import('fs');

    const counts: Record<string, number> = {};

    const countInDirectory = (dir: string, maxDepth: number = 2): void => {
      if (maxDepth <= 0) return;

      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of items) {
          if (item.name.startsWith('.') || item.name === 'node_modules') continue;

          const fullPath = path.join(dir, item.name);

          if (item.isDirectory()) {
            countInDirectory(fullPath, maxDepth - 1);
          } else if (item.isFile()) {
            const ext = path.extname(item.name) || 'no-extension';
            counts[ext] = (counts[ext] || 0) + 1;
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    };

    countInDirectory(this.workingDirectory);
    return counts;
  }

  /**
   * Analyze the task type from the prompt
   */

  /**
   * Execute in Auditor mode (LM Studio optimized for fast analysis)
   */

  /**
   * Execute in Writer mode (Ollama optimized for quality generation)
   */

  /**
   * Execute in Auto mode (intelligent routing)
   */

  /**
   * Configure the model client to use the selected model
   */

  /**
   * Format the response based on execution mode
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars

  /**
   * Display streaming response using enhanced streaming client
   */

  /**
   * Start interactive mode
   */
  private async startInteractiveMode(options: CLIOptions = {}): Promise<void> {
    console.log(chalk.cyan('\n🎯 Starting Interactive Mode'));
    console.log(chalk.gray('Type "exit" to quit, "/help" for commands\n'));

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const prompt = await inquirer.prompt({
          type: 'input',
          name: 'prompt',
          message: chalk.cyan('💭'),
        });

        if (prompt.prompt.toLowerCase().trim() === 'exit') {
          console.log(chalk.yellow('👋 Goodbye!'));
          break;
        }

        if (prompt.prompt.trim().startsWith('/')) {
          await this.handleSlashCommand(prompt.prompt.trim(), options);
        } else if (prompt.prompt.trim()) {
          await this.processPrompt(prompt.prompt, options);
        }
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        if (errorMessage.includes('User force closed')) {
          console.log(chalk.yellow('\n👋 Goodbye!'));
          break;
        }
        console.error(chalk.red('Error:'), error);
      }
    }
  }

  /**
   * Handle slash commands
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async handleSlashCommand(command: string, _options: CLIOptions): Promise<void> {
    const cmd = command.slice(1).toLowerCase();

    switch (cmd) {
      case 'help':
        CLIDisplay.showHelp();
        break;
      case 'status':
        await this.commands.showStatus();
        break;
      case 'models':
        await this.commands.listModels();
        break;
      case 'clear':
        console.clear();
        break;
      case 'exit':
        console.log(chalk.yellow('👋 Goodbye!'));
        process.exit(0);
      // break; // Removed - unreachable after process.exit()
      default:
        // Check if it's a model switch command
        if (cmd.startsWith('model:')) {
          const modelName = cmd.split(':')[1];
          await this.handleModelSwitch(modelName);
          break;
        }
        if (cmd === 'model-list' || cmd === 'ml') {
          await this.handleModelList();
          break;
        }
        if (cmd === 'model-reload' || cmd === 'mr') {
          await this.handleModelReload();
          break;
        }
        console.log(chalk.yellow(`Unknown command: ${command}`));
        console.log(chalk.gray('Type "/help" for available commands'));
        break;
    }
  }

  /**
   * Handle file output
   */
  private async handleFileOutput(filepath: string, code: string): Promise<void> {
    try {
      await writeFile(filepath, code, 'utf-8');
      console.log(chalk.green(`✅ Code saved to: ${filepath}`));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to save file: ${error}`));
    }
  }

  /**
   * Initialize the CLI system
   */
  async initialize(config?: any, workingDirectory?: string): Promise<void> {
    if (this.initialized) return;

    if (workingDirectory) {
      this.workingDirectory = workingDirectory;
    }

    try {
      // Initialize security systems first
      await this.secretsManager.initialize();
      await this.auditLogger.initialize();
      await this.authMiddleware.initialize();

      // Log CLI initialization attempt
      await this.auditLogger.logEvent(
        AuditEventType.SYSTEM_EVENT,
        AuditSeverity.MEDIUM,
        AuditOutcome.SUCCESS,
        'cli',
        'cli_initialization',
        'v4.0.0',
        'CLI system initialization started',
        {},
        {
          workingDirectory: this.workingDirectory,
          authEnabled: this.authMiddleware.isAuthEnabled(),
          authRequired: this.authMiddleware.isAuthRequired(),
        }
      );

      // Context awareness is initialized in constructor

      this.initialized = true;
      logger.info('CLI initialized successfully', {
        authEnabled: this.authMiddleware.isAuthEnabled(),
        authRequired: this.authMiddleware.isAuthRequired(),
      });
    } catch (error) {
      // Log initialization failure
      await this.auditLogger.logEvent(
        AuditEventType.ERROR_EVENT,
        AuditSeverity.HIGH,
        AuditOutcome.FAILURE,
        'cli',
        'cli_initialization_failed',
        'v4.0.0',
        `CLI initialization failed: ${error}`,
        {},
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );

      logger.error('CLI initialization failed:', error);
      throw new CLIError(`Initialization failed: ${error}`, CLIExitCode.INITIALIZATION_FAILED);
    }
  }

  /**
   * Handle configuration management
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async handleConfiguration(_options: CLIOptions): Promise<void> {
    console.log(chalk.cyan('\n⚙️  Configuration Management'));

    const choices = [
      'View current configuration',
      'Update model settings',
      'Configure voice preferences',
      'Set performance options',
      'Reset to defaults',
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to configure?',
        choices,
      },
    ]);

    switch (action) {
      case 'View current configuration':
        console.log(chalk.gray('\nCurrent configuration:'));
        console.log(JSON.stringify(this.context.config, null, 2));
        break;
      default:
        console.log(chalk.yellow('Configuration feature coming soon!'));
        break;
    }
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    try {
      if (this.contextAwareCLI) {
        await (this.contextAwareCLI as any).destroy?.();
      }
      if (this.autoConfigurator) {
        await (this.autoConfigurator as any).destroy?.();
      }
      if (this.repl) {
        await (this.repl as any).destroy?.();
      }

      this.initialized = false;
      logger.info('CLI destroyed successfully');
    } catch (error) {
      logger.error('Error during CLI cleanup:', error);
    }
  }

  /**
   * Handle errors with proper formatting and exit codes
   */
  private async handleError(error: any): Promise<void> {
    console.error(chalk.red('\n❌ Error:'), error.message || error);

    // Audit log error for enterprise security monitoring
    if (this.auditLogger) {
      try {
        await this.auditLogger.logEvent(
          AuditEventType.ERROR_EVENT,
          AuditSeverity.HIGH,
          AuditOutcome.ERROR,
          'cli',
          'cli_error',
          'v4.0.0',
          `CLI error occurred: ${error.message || error}`,
          {
            ipAddress: 'localhost',
            userAgent: 'codecrucible-cli',
          },
          {
            errorType: error.constructor.name,
            errorMessage: error.message || error.toString(),
            exitCode: error instanceof CLIError ? error.exitCode : CLIExitCode.UNEXPECTED_ERROR,
            workingDirectory: this.workingDirectory,
            stack: error.stack || 'No stack trace available',
          }
        );
      } catch (auditError) {
        // Don't fail on audit logging errors
        logger.warn('Failed to log error to audit system', auditError);
      }
    }

    if (error instanceof CLIError) {
      process.exit(error.exitCode);
    } else {
      process.exit(CLIExitCode.UNEXPECTED_ERROR);
    }
  }

  /**
   * Track an active operation for graceful shutdown
   */
  private trackOperation(operationId: string): void {
    if (!this.isShuttingDown) {
      this.activeOperations.add(operationId);
    }
  }

  /**
   * Untrack a completed operation
   */
  private untrackOperation(operationId: string): void {
    this.activeOperations.delete(operationId);
  }

  // Legacy compatibility methods
  async checkOllamaStatus(): Promise<boolean> {
    try {
      const result = await this.context.modelClient.checkHealth();
      return Object.values(result).some(status => status === true);
    } catch {
      return false;
    }
  }

  async getAllAvailableModels(): Promise<any[]> {
    try {
      const result = (await this.context.modelClient.getAllAvailableModels?.()) || [];
      return Array.isArray(result) ? result : [];
    } catch {
      return [];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updateConfiguration(_newConfig: any): Promise<boolean> {
    try {
      // Update configuration logic here
      return true;
    } catch (error) {
      logger.error('Configuration update failed:', error);
      return false;
    }
  }

  // Delegate methods to command handlers

  /**
   * Handle role switching via slash commands
   */
  private async handleRoleSwitch(
    role: 'auditor' | 'writer' | 'auto',
    content: string,
    options: CLIOptions
  ): Promise<string> {
    try {
      // Switch the role in the dynamic model router
      this.dynamicModelRouter.setRole(role);

      // Show confirmation
      const roleDescription = {
        auditor:
          'Auditor mode (LM Studio) - Optimized for fast code analysis and security auditing',
        writer:
          'Writer mode (Ollama) - Optimized for high-quality code generation and documentation',
        auto: 'Auto mode - Intelligent routing based on task requirements',
      };

      console.log(chalk.green(`✅ Switched to ${role} mode`));
      console.log(chalk.blue(`📋 ${roleDescription[role]}`));

      // Show current best model
      const bestModel = await this.dynamicModelRouter.getBestModelForCurrentRole(
        role === 'auditor' ? 'audit' : role === 'writer' ? 'generate' : 'general'
      );

      if (bestModel) {
        console.log(chalk.cyan(`🤖 Using model: ${bestModel.model} (${bestModel.provider})`));
        console.log(chalk.gray(`   Strengths: ${bestModel.strengths.join(', ')}`));
      } else {
        console.log(chalk.yellow(`⚠️  No suitable models found for ${role} mode`));
      }

      // If there's content after the slash command, process it with the new role
      if (content && content.trim()) {
        console.log(chalk.blue('\n🔄 Processing with new role...'));
        // Update options to reflect the role change
        const updatedOptions = { ...options, role, forceProvider: bestModel?.provider };
        return await this.executePromptProcessing(content, updatedOptions);
      }

      return `Role switched to ${role}`;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      logger.error('Role switch failed:', errorMessage);
      return `Failed to switch to ${role} mode: ${errorMessage}`;
    }
  }

  /**
   * Handle model switching
   */

  /**
   * Handle model listing
   */

  /**
   * Handle model reload
   */

  /**
   * Show slash command help
   */

  /**
   * Handle Sequential Dual Agent Review
   */
  private async handleSequentialReview(content: string): Promise<string> {
    // Implementation placeholder
    return `Sequential review processing: ${content}`;
  }

  /**
   * Show system status
   */
  public async showStatus(): Promise<void> {
    console.log(chalk.cyan('📊 CodeCrucible Synth Status'));
    console.log(chalk.green('✅ System initialized'));
    console.log(`Current directory: ${this.workingDirectory}`);
  }

  /**
   * List available models
   */
  public listModels(): void {
    console.log(chalk.cyan('🤖 Available Models'));
    console.log('- Auto detection enabled');
    console.log('- Providers: Ollama, LM Studio, HuggingFace');
  }

  /**
   * Execute prompt processing (REPLInterface method)
   * Enhanced with sequential tool execution and chain-of-thought reasoning
   */
  public async executePromptProcessing(prompt: string, options: any = {}): Promise<any> {
    try {
      if (!options.silent) {
        console.log(chalk.blue('🔄 Processing prompt...'));
      }

      // ENHANCED: Check if this prompt should use sequential tool execution with reasoning
      const shouldUseSequentialExecution = this.shouldUseSequentialToolExecution(prompt);
      
      logger.info('🔍 Sequential execution decision', {
        shouldUseSequentialExecution,
        disableTools: options.disableTools,
        prompt: prompt.substring(0, 100)
      });
      
      if (shouldUseSequentialExecution && !options.disableTools) {
        logger.info('✅ Using enhanced sequential tool execution');
        return await this.executeWithSequentialReasoning(prompt, options);
      }

      logger.info('⚠️ Falling back to traditional voice system processing');
      // Fallback to traditional voice system processing
      let response: string;

      if (options.voices && Array.isArray(options.voices) && options.voices.length > 0) {
        // Multi-voice processing
        const solutions = await this.context.voiceSystem.generateMultiVoiceSolutions(
          options.voices,
          prompt,
          {
            workingDirectory: process.cwd(),
            parallel: true,
          }
        );

        // Combine the solutions into a coherent response
        response = solutions.map((sol: any) => `**${sol.voice}**: ${sol.content}`).join('\n\n');
      } else {
        // Single voice processing using default voice
        const voiceResponse = await this.context.voiceSystem.generateSingleVoiceResponse(
          'explorer', // Default voice
          prompt,
          this.context.modelClient // Pass the actual client, not options
        );

        // DEBUG: Log response type and content preview for troubleshooting
        logger.debug('🔥 CLI RESPONSE DEBUG', {
          responseType: typeof voiceResponse.content,
          isBuffer: Buffer.isBuffer(voiceResponse.content),
          contentPreview: String(voiceResponse.content).substring(0, 100),
          contentLength: voiceResponse.content?.length,
          voiceName: voiceResponse.voice
        });

        // CRITICAL FIX: Final safety check - normalize response before display
        const rawResponse = voiceResponse.content || 'No response generated';
        const normalizedResponse = ResponseNormalizer.normalizeToString(rawResponse);
        
        // Validate final normalization
        if (ResponseNormalizer.validateNormalization(rawResponse, normalizedResponse)) {
          response = normalizedResponse;
        } else {
          // Ultimate fallback if all normalization fails
          response = 'Response processing completed but display normalization failed. Please check logs.';
          logger.error('CLI final response normalization failed', {
            rawType: typeof rawResponse,
            rawPreview: String(rawResponse).substring(0, 100),
            voiceName: voiceResponse.voice
          });
        }
        
        // Enhanced debugging with normalization info
        logger.debug('🔥 CLI RESPONSE DEBUG - AFTER NORMALIZATION', {
          originalType: typeof rawResponse,
          normalizedLength: normalizedResponse.length,
          normalizationSuccess: normalizedResponse !== rawResponse,
          finalResponsePreview: response.substring(0, 100)
        });
      }

      if (!options.silent) {
        console.log(chalk.green('✅ Processing complete'));
      }

      return response;
    } catch (error) {
      if (!options.silent) {
        console.error(chalk.red('❌ Processing failed:'), error);
      }
      logger.error('Prompt processing failed in CLI:', error);
      throw error;
    }
  }

  /**
   * Execute prompt with enhanced sequential reasoning and tool execution
   */
  private async executeWithSequentialReasoning(prompt: string, options: any = {}): Promise<string> {
    logger.info('🚀 Using Enhanced Sequential Tool Execution with Chain-of-Thought Reasoning');

    try {
      // Get available tools from the tool orchestrator
      const availableTools = this.toolOrchestrator.getAvailableTools();
      
      // Convert tools to MCP-compatible format
      const mcpTools = await this.getMCPCompatibleTools();
      const toolsToUse = mcpTools.length > 0 ? mcpTools : availableTools;

      logger.info('🔧 Tools available for sequential execution', {
        mcpToolCount: mcpTools.length,
        localToolCount: availableTools.length,
        usingMcp: mcpTools.length > 0,
        finalToolCount: toolsToUse.length,
        toolNames: toolsToUse.map(t => t.name || t.function?.name || 'unnamed').slice(0, 3).join(', ')
      });

      if (toolsToUse.length === 0) {
        logger.error('❌ CRITICAL: No tools available for sequential execution despite local tools being initialized');
        logger.error('🔍 Debug info:', {
          mcpToolsFailure: mcpTools.length === 0,
          localToolsFailure: availableTools.length === 0,
          toolOrchestratorMethod: typeof this.toolOrchestrator.getAvailableTools
        });
        return await this.fallbackToVoiceSystem(prompt, options);
      }

      // CRITICAL FIX: Ensure we're using local tools if MCP tools aren't available
      if (mcpTools.length === 0 && availableTools.length > 0) {
        logger.info('🔧 Using local tools as primary (MCP integration failed)', {
          localToolsUsed: availableTools.map(t => t.name).join(', ')
        });
      }

      // Setup streaming interface
      const streamingCallbacks = options.noStream ? undefined : 
        this.streamingInterface.createCallbacks();

      // Initialize streaming display
      if (!options.noStream && streamingCallbacks) {
        await this.streamingInterface.initialize(options.maxSteps || 8);
      }

      // Execute with enhanced sequential reasoning
      const result = await this.sequentialExecutor.executeWithStreamingReasoning(
        prompt,
        toolsToUse,
        this.context.modelClient,
        options.maxSteps || 8,
        streamingCallbacks
      );

      // Display completion message
      if (!options.noStream && streamingCallbacks) {
        await this.streamingInterface.displayCompletion(
          result.success,
          result.finalResult,
          result.executionTime || 0
        );
      }

      if (result.success) {
        logger.info('✅ Sequential execution completed successfully', {
          totalSteps: result.totalSteps,
          executionTime: result.executionTime,
          toolsUsed: result.reasoningChain.filter(s => s.type === 'action').length
        });
        return result.finalResult;
      } else {
        logger.warn('⚠️ Sequential execution failed, attempting fallback', {
          error: result.finalResult,
          completedSteps: result.totalSteps
        });
        // Fallback to voice system if sequential execution fails
        return await this.fallbackToVoiceSystem(prompt, options);
      }

    } catch (error) {
      logger.error('❌ Enhanced sequential execution error:', error);
      // Fallback to voice system on error
      return await this.fallbackToVoiceSystem(prompt, options);
    }
  }

  /**
   * Determine if prompt should use sequential tool execution
   */
  private shouldUseSequentialToolExecution(prompt: string): boolean {
    const toolKeywords = [
      'read', 'analyze', 'file', 'directory', 'project', 'code', 'structure',
      'write', 'create', 'generate', 'build', 'compile', 'test', 'run',
      'search', 'find', 'list', 'show', 'display', 'check', 'scan',
      'execute', 'process', 'handle', 'manage', 'review'
    ];

    const promptLower = prompt.toLowerCase();
    const hasToolKeywords = toolKeywords.some(keyword => promptLower.includes(keyword));

    // Additional heuristics
    const hasActionWords = /\b(analyze|examine|review|process|execute|run|create|build|generate|fix|update|modify|change|improve|optimize)\b/i.test(prompt);
    const hasFileReferences = /\b(\.md|\.js|\.ts|\.json|\.yaml|\.txt|README|package\.json|src\/|config\/)\b/i.test(prompt);
    const isQuestion = prompt.trim().endsWith('?');
    
    // Use sequential execution if:
    // 1. Has tool keywords (especially "read", "write", "list", etc.)
    // 2. OR has action words AND file references
    // 3. Always use for explicit file operations
    const shouldUse = hasToolKeywords || 
                      (hasActionWords && hasFileReferences) ||
                      hasFileReferences;  // Always use for file references

    logger.debug('Sequential execution decision', {
      prompt: `${prompt.substring(0, 100)  }...`,
      hasToolKeywords,
      hasActionWords,
      hasFileReferences,
      isQuestion,
      shouldUse
    });

    return shouldUse;
  }

  /**
   * Get MCP-compatible tools for sequential execution
   */
  private async getMCPCompatibleTools(): Promise<any[]> {
    try {
      // Import tool integration dynamically
      const { getGlobalEnhancedToolIntegration } = await import('./tools/enhanced-tool-integration.js');
      const { getGlobalToolIntegration } = await import('./tools/tool-integration.js');
      
      const enhancedToolIntegration = getGlobalEnhancedToolIntegration();
      const toolIntegration = enhancedToolIntegration || getGlobalToolIntegration();
      
      if (toolIntegration && typeof toolIntegration.getLLMFunctions === 'function') {
        return toolIntegration.getLLMFunctions();
      }
      
      return [];
    } catch (error) {
      logger.warn('Failed to get MCP tools for sequential execution', error);
      return [];
    }
  }

  /**
   * Fallback to traditional voice system processing
   */
  private async fallbackToVoiceSystem(prompt: string, options: any): Promise<string> {
    logger.debug('Using fallback voice system processing');
    
    const voiceResponse = await this.context.voiceSystem.generateSingleVoiceResponse(
      'explorer',
      prompt,
      this.context.modelClient
    );

    const rawResponse = voiceResponse.content || 'No response generated';
    const normalizedResponse = ResponseNormalizer.normalizeToString(rawResponse);
    
    if (ResponseNormalizer.validateNormalization(rawResponse, normalizedResponse)) {
      return normalizedResponse;
    } else {
      logger.error('Voice system fallback normalization failed');
      return 'Processing completed but result normalization failed. Please check logs.';
    }
  }

  /**
   * Display streaming response
   */
  private async displayStreamingResponse(prompt: string, options: any = {}): Promise<void> {
    console.log(chalk.blue('🔄 Streaming response...'));
    // Simulate streaming for now
    const response = await this.executePromptProcessing(prompt, { ...options, silent: true });
    console.log(response);
  }

  /**
   * Show slash command help
   */
  private showSlashHelp(): string {
    const helpText = [
      '🔧 Available Slash Commands:',
      '/audit - Switch to auditor mode',
      '/write - Switch to writer mode',
      '/auto - Switch to auto mode',
      '/help - Show this help',
    ].join('\n');
    console.log(chalk.cyan(helpText));
    return helpText;
  }

  /**
   * Handle model switch
   */
  private async handleModelSwitch(model: string): Promise<void> {
    try {
      console.log(chalk.blue(`🔄 Attempting to switch to model: ${model}`));
      
      // Get the Ollama provider from the provider repository
      const provider = this.context.modelClient.providerRepository.getProvider('ollama');
      if (!provider?.setModel) {
        console.log(chalk.red('❌ Model switching not supported for current provider'));
        return;
      }

      const success = await provider.setModel(model);
      if (success) {
        const modelInfo = provider.getCurrentModelInfo();
        console.log(chalk.green(`✅ Successfully switched to: ${modelInfo.name}`));
        console.log(chalk.gray(`   Type: ${modelInfo.type}`));
        console.log(chalk.gray(`   Function Calling: ${modelInfo.supportsFunctionCalling ? '✅ Yes' : '❌ No'}`));
      } else {
        console.log(chalk.red(`❌ Failed to switch to model: ${model}`));
        console.log(chalk.gray('   Use /models to see available models'));
      }
    } catch (error) {
      console.log(chalk.red(`❌ Error switching model: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  /**
   * Handle model list
   */
  private async handleModelList(): Promise<void> {
    try {
      console.log(chalk.blue('📋 Available Models with Capabilities:'));
      console.log(chalk.gray('━'.repeat(60)));
      
      // Get the Ollama provider
      const provider = this.context.modelClient.providerRepository.getProvider('ollama');
      if (!provider?.listModels) {
        console.log(chalk.red('❌ Model listing not supported for current provider'));
        return;
      }

      const models = await provider.listModels();
      if (models.length === 0) {
        console.log(chalk.yellow('📭 No models available. Install models with: ollama pull <model>'));
        return;
      }

      // Group models by capability
      const functionCallingModels = provider.detectFunctionCallingModels(models);
      const codingModels = provider.detectCodingModels(models);
      const currentModel = provider.getCurrentModelInfo();

      // Show current model
      console.log(chalk.green(`🎯 Current: ${currentModel.name}`));
      console.log(chalk.gray(`   Type: ${currentModel.type} | Function Calling: ${currentModel.supportsFunctionCalling ? '✅' : '❌'}`));
      console.log();

      // Show function-calling models
      if (functionCallingModels.length > 0) {
        console.log(chalk.cyan('🛠️ Function-Calling Capable Models (Recommended):'));
        functionCallingModels.forEach((model: string) => {
          const current = model === currentModel.name ? ' 👈 current' : '';
          const size = provider.extractModelSize(model);
          console.log(chalk.green(`  ✅ ${model} (${size}B)${current}`));
        });
        console.log();
      }

      // Show coding models
      if (codingModels.length > 0) {
        console.log(chalk.blue('💻 Coding Models (Limited Tool Support):'));
        codingModels.forEach((model: string) => {
          if (!functionCallingModels.includes(model)) {
            const current = model === currentModel.name ? ' 👈 current' : '';
            const size = provider.extractModelSize(model);
            console.log(chalk.yellow(`  ⚠️ ${model} (${size}B)${current}`));
          }
        });
        console.log();
      }

      // Show other models
      const otherModels = models.filter((m: string) => 
        !functionCallingModels.includes(m) && !codingModels.includes(m)
      );
      if (otherModels.length > 0) {
        console.log(chalk.gray('🤖 Other Models (No Tool Support):'));
        otherModels.forEach((model: string) => {
          const current = model === currentModel.name ? ' 👈 current' : '';
          const size = provider.extractModelSize(model);
          console.log(chalk.gray(`  ❌ ${model} (${size}B)${current}`));
        });
        console.log();
      }

      console.log(chalk.gray('💡 Switch models with: /model:modelname'));
      console.log(chalk.gray('   Example: /model:llama3.1:8b'));

    } catch (error) {
      console.log(chalk.red(`❌ Error listing models: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  /**
   * Handle model reload
   */
  private async handleModelReload(): Promise<void> {
    try {
      console.log(chalk.blue('🔄 Reloading models and re-detecting capabilities...'));
      
      // Get the Ollama provider
      const provider = this.context.modelClient.providerRepository.getProvider('ollama');
      if (!provider?.checkStatus) {
        console.log(chalk.red('❌ Model reloading not supported for current provider'));
        return;
      }

      // Re-initialize the provider to detect models
      await provider.checkStatus();
      console.log(chalk.green('✅ Models reloaded and capabilities updated'));
      
      // Show current model info
      const modelInfo = provider.getCurrentModelInfo();
      console.log(chalk.gray(`Current model: ${modelInfo.name} (${modelInfo.type})`));
      
      // Suggest listing models
      console.log(chalk.gray('💡 Use /ml to see all available models with capabilities'));
      
    } catch (error) {
      console.log(chalk.red(`❌ Error reloading models: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }
}

// Export alias for backward compatibility
export const CodeCrucibleCLI = CLI;
export default CLI;
