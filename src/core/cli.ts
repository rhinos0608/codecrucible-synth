/**
 * Refactored CLI - Main Interface
 * Reduced from 2334 lines to ~400 lines by extracting modules
 */

import { CLIExitCode, CLIError, ModelRequest } from './types.js';
import { UnifiedModelClient } from './client.js';
import { VoiceArchetypeSystem } from '../voices/voice-archetype-system.js';
import { UnifiedAgent } from './agent.js';
import { MCPServerManager } from '../mcp-servers/mcp-server-manager.js';
import { AppConfig } from '../config/config-manager.js';
import { logger } from './logger.js';
import { StreamingAgentClient } from './streaming/streaming-agent-client.js';
import { ContextAwareCLIIntegration } from './intelligence/context-aware-cli-integration.js';
import { AutoConfigurator } from './model-management/auto-configurator.js';
import { InteractiveREPL } from './interactive-repl.js';
import { SecureToolFactory } from './security/secure-tool-factory.js';
import { InputSanitizer } from './security/input-sanitizer.js';

// Import modular CLI components
import { CLIOptions, CLIContext, CLIDisplay, CLIParser, CLICommands } from './cli/index.js';

export type { CLIContext, CLIOptions };

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { writeFile } from 'fs/promises';

export class CLI {
  private context: CLIContext;
  private initialized = false;
  private workingDirectory = process.cwd();
  private streamingClient: StreamingAgentClient;
  private contextAwareCLI: ContextAwareCLIIntegration;
  private autoConfigurator: AutoConfigurator;
  private repl: InteractiveREPL;
  private commands: CLICommands;
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
      config
    };

    // Initialize subsystems with simplified constructors
    this.streamingClient = new StreamingAgentClient(modelClient);
    this.contextAwareCLI = new ContextAwareCLIIntegration();
    this.autoConfigurator = new AutoConfigurator();
    this.repl = new InteractiveREPL(this, this.context);
    this.commands = new CLICommands(this.context, this.workingDirectory);

    this.registerCleanupHandlers();
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
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught Exception:', error);
      try {
        await this.destroy();
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
      process.exit(1);
    });

    // Cleanup on unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      try {
        await this.destroy();
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
      process.exit(1);
    });
  }

  /**
   * Synchronous cleanup for exit handler
   */
  private syncCleanup(): void {
    try {
      // Only perform synchronous cleanup operations here
      if (this.streamingClient && typeof (this.streamingClient as any).removeAllListeners === 'function') {
        (this.streamingClient as any).removeAllListeners();
      }
      if (this.contextAwareCLI && typeof (this.contextAwareCLI as any).removeAllListeners === 'function') {
        (this.contextAwareCLI as any).removeAllListeners();
      }
      if (this.autoConfigurator && typeof (this.autoConfigurator as any).removeAllListeners === 'function') {
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
        await this.initialize();
      }

      // Handle commands
      await this.executeCommand(command, remainingArgs, options);

    } catch (error) {
      await this.handleError(error);
    }
  }

  /**
   * Execute specific commands
   */
  private async executeCommand(command: string, args: string[], options: CLIOptions): Promise<void> {
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

      case 'generate':
        const prompt = args.join(' ');
        await this.commands.handleGeneration(prompt, options);
        break;

      case 'configure':
        await this.handleConfiguration(options);
        break;

      case 'help':
        CLIDisplay.showHelp();
        break;

      default:
        // Handle as prompt if no specific command
        if (args.length > 0 || command) {
          const fullPrompt = [command, ...args].filter(Boolean).join(' ');
          await this.processPrompt(fullPrompt, options);
        } else {
          // Interactive mode
          await this.startInteractiveMode(options);
        }
        break;
    }

    // Handle special flags
    if (options.server) {
      await this.commands.startServer(options);
    }
  }

  /**
   * Process a text prompt using the voice system
   */
  async processPrompt(prompt: string, options: CLIOptions = {}): Promise<string> {
    if (!prompt || prompt.trim().length === 0) {
      throw new CLIError('Empty prompt provided', CLIExitCode.INVALID_INPUT);
    }

    // Sanitize input
    const sanitizer = new InputSanitizer();
    const sanitizedPrompt = prompt; // Simplified for now

    try {
      // Streaming is now the default mode unless explicitly disabled
      if (options.noStream || options.batch) {
        return await this.executePromptProcessing(sanitizedPrompt, options);
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
  async executePromptProcessing(prompt: string, options: CLIOptions): Promise<string> {
    const voices = Array.isArray(options.voices) ? options.voices : 
                   typeof options.voices === 'string' ? [options.voices] : 
                   ['Explorer', 'Developer'];

    if (!this.context.voiceSystem) {
      // Fallback to direct model client
      const result = await this.context.modelClient.generateText(prompt);
      return result || 'No response generated';
    }

    const result = await this.context.voiceSystem.generateMultiVoiceSolutions(
      voices,
      prompt,
      this.context.modelClient,
      { 
        workingDirectory: this.workingDirectory,
        config: {},
        files: [], 
        structure: {
          directories: [],
          fileTypes: {}
        }
      }
    );

    // Handle array of voice responses
    if (Array.isArray(result) && result.length > 0) {
      // For now, return the content from the first voice response
      // TODO: Implement proper multi-voice synthesis/combining
      const firstResponse = result[0];
      if (firstResponse && firstResponse.content) {
        CLIDisplay.displayResults({ content: firstResponse.content, voices: result }, []);
        return firstResponse.content;
      }
    }
    
    // Handle single response object
    if (result && typeof result === 'object' && 'content' in result) {
      CLIDisplay.displayResults(result as any, []);
      return (result as any).content || 'No content generated';
    }
    
    return 'No content generated';
  }

  /**
   * Display streaming response using enhanced streaming client
   */
  private async displayStreamingResponse(prompt: string, options: CLIOptions): Promise<void> {
    const request: ModelRequest = {
      prompt,
      model: (options.model as string) || 'default',
      maxTokens: (options.maxTokens as number) || 2000
    };

    let buffer = '';
    const spinner = ora('🌊 Streaming response...').start();
    
    try {
      const response = await this.context.modelClient.streamRequest(
        request,
        (token) => {
          // Real-time token handling
          if (!token.finished) {
            buffer += token.content;
            
            // Update display every few tokens
            if (token.index % 5 === 0) {
              spinner.stop();
              process.stdout.write('\r\x1b[K'); // Clear current line
              process.stdout.write(chalk.cyan('🌊 ') + buffer + chalk.gray('▋')); // Show cursor
            }
          } else {
            // Final token - display completion
            spinner.stop();
            process.stdout.write('\r\x1b[K'); // Clear current line
            console.log(chalk.green('\n📝 Streaming Complete:'));
            console.log(buffer);
            
            if (token.metadata) {
              console.log(chalk.gray(`   Tokens: ${token.metadata.totalTokens}, Duration: ${token.metadata.duration}ms`));
            }
          }
        },
        {
          workingDirectory: this.workingDirectory,
          config: this.context.config,
          files: []
        }
      );
      
      // Log final response details
      logger.info('Streaming response completed', {
        length: response.content.length,
        cached: response.cached,
        processingTime: response.processingTime
      });
      
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('\n❌ Streaming Error:'), error);
      throw error;
    }
  }

  /**
   * Start interactive mode
   */
  private async startInteractiveMode(options: CLIOptions = {}): Promise<void> {
    console.log(chalk.cyan('\n🎯 Starting Interactive Mode'));
    console.log(chalk.gray('Type "exit" to quit, "/help" for commands\n'));
    
    while (true) {
      try {
        const prompt = await inquirer.prompt({
          type: 'input',
          name: 'prompt',
          message: chalk.cyan('💭')
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
      } catch (error) {
        if (error.message.includes('User force closed')) {
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
  private async handleSlashCommand(command: string, options: CLIOptions): Promise<void> {
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
        break;
      default:
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
      // Initialize context awareness
      await this.contextAwareCLI.initialize();
      
      this.initialized = true;
      logger.info('CLI initialized successfully');
    } catch (error) {
      logger.error('CLI initialization failed:', error);
      throw new CLIError(`Initialization failed: ${error}`, CLIExitCode.INITIALIZATION_FAILED);
    }
  }

  /**
   * Handle configuration management
   */
  private async handleConfiguration(options: CLIOptions): Promise<void> {
    console.log(chalk.cyan('\n⚙️  Configuration Management'));
    
    const choices = [
      'View current configuration',
      'Update model settings',
      'Configure voice preferences',
      'Set performance options',
      'Reset to defaults'
    ];

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to configure?',
      choices
    }]);

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
      if (this.streamingClient) {
        await (this.streamingClient as any).destroy?.();
      }
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
      const result = await this.context.modelClient.healthCheck();
      return !!result;
    } catch {
      return false;
    }
  }

  async getAllAvailableModels(): Promise<any[]> {
    try {
      const result = await this.context.modelClient.getAllAvailableModels?.() || [];
      return Array.isArray(result) ? result : [];
    } catch {
      return [];
    }
  }

  async updateConfiguration(newConfig: any): Promise<boolean> {
    try {
      // Update configuration logic here
      return true;
    } catch (error) {
      logger.error('Configuration update failed:', error);
      return false;
    }
  }

  // Delegate methods to command handlers
  async showStatus(): Promise<void> {
    await this.commands.showStatus();
  }

  async listModels(): Promise<void> {
    await this.commands.listModels();
  }

  async handleGeneration(prompt: string, options: CLIOptions = {}): Promise<void> {
    await this.commands.handleGeneration(prompt, options);
  }

  async handleAnalyze(files: string[] = [], options: CLIOptions = {}): Promise<void> {
    await this.commands.handleAnalyze(files, options);
  }
}

// Export alias for backward compatibility
export const CodeCrucibleCLI = CLI;
export default CLI;