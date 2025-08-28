/**
 * Interactive REPL Mode for CodeCrucible Synth
 * Provides a continuous interactive session like Claude
 */

import * as readline from 'readline';
import chalk from 'chalk';
import { REPLInterface } from '../domain/types/unified-types.js';
import { CLIContext } from './cli/cli-types.js';
import { CLI } from '../application/interfaces/cli.js';
import { logger } from './logger.js';
import { getErrorMessage } from '../utils/error-utils.js';

export class InteractiveREPL {
  private rl: readline.Interface;
  private cli: CLI;
  private context: CLIContext;
  private logger: typeof logger;
  private isProcessing = false;
  private history: string[] = [];
  private currentModel: string = '';

  constructor(cli: CLI, context: CLIContext) {
    this.cli = cli;
    this.context = context;
    this.logger = logger;

    // Create readline interface for interactive input
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('\nCC> '),
      historySize: 100,
      removeHistoryDuplicates: true,
    });

    this.setupEventHandlers();
    this.currentModel = context.config?.model?.name || 'qwen2.5-coder:7b';
  }

  /**
   * Start the interactive REPL session
   */
  async start(): Promise<void> {
    // Show welcome banner
    this.showBanner();

    // Show initial status
    await this.showQuickStatus();

    // Start the REPL
    this.rl.prompt();
  }

  /**
   * Show welcome banner
   */
  private showBanner(): void {
    console.log(chalk.blue('\n╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue('║                CodeCrucible Synth                        ║'));
    console.log(chalk.blue('║          Interactive AI Coding Assistant                     ║'));
    console.log(chalk.blue('║                                                              ║'));
    console.log(chalk.blue('║  Type "help" for commands, "exit" to quit                   ║'));
    console.log(chalk.blue('╚══════════════════════════════════════════════════════════════╝'));
  }

  /**
   * Show quick status info
   */
  private async showQuickStatus(): Promise<void> {
    console.log(chalk.gray(`\n📊 Model: ${chalk.white(this.currentModel)}`));
    console.log(chalk.gray(`🔧 Tools: ${chalk.green('Enabled')} (filesystem, git, terminal)`));
    console.log(chalk.gray(`💾 Context: ${chalk.white(process.cwd())}\n`));
  }

  /**
   * Setup event handlers for the REPL
   */
  private setupEventHandlers(): void {
    // Handle each line of input
    this.rl.on('line', async (input: string) => {
      const trimmedInput = input.trim();

      // Skip empty input
      if (!trimmedInput) {
        this.rl.prompt();
        return;
      }

      // Add to history
      this.history.push(trimmedInput);

      // Handle special commands
      if (this.isSpecialCommand(trimmedInput)) {
        await this.handleSpecialCommand(trimmedInput);
      } else {
        // Process as normal prompt
        await this.processPrompt(trimmedInput);
      }
    });

    // Handle Ctrl+C
    this.rl.on('SIGINT', () => {
      if (this.isProcessing) {
        console.log(chalk.yellow('\n⚠️ Interrupting current task...'));
        this.isProcessing = false;
        this.rl.prompt();
      } else {
        this.handleExit();
      }
    });

    // Handle close event
    this.rl.on('close', () => {
      this.handleExit();
    });
  }

  /**
   * Check if input is a special command
   */
  private isSpecialCommand(input: string): boolean {
    const commands = ['help', 'exit', 'quit', 'clear', 'status', 'models', 'history', 'reset'];
    const firstWord = input.split(' ')[0].toLowerCase();
    return commands.includes(firstWord);
  }

  /**
   * Handle special REPL commands
   */
  private async handleSpecialCommand(input: string): Promise<void> {
    const [command, ...args] = input.split(' ');
    const cmd = command.toLowerCase();

    switch (cmd) {
      case 'help':
        this.showHelp();
        break;

      case 'exit':
      case 'quit':
        this.handleExit();
        return;

      case 'clear':
        console.clear();
        this.showBanner();
        break;

      case 'status':
        await this.cli.showStatus();
        break;

      case 'models':
        await this.cli.listModels();
        break;

      case 'history':
        this.showHistory();
        break;

      case 'reset':
        console.log(chalk.yellow('🔄 Resetting conversation context...'));
        // Reset context if needed
        console.log(chalk.green('✅ Context reset'));
        break;

      default:
        console.log(chalk.red(`Unknown command: ${cmd}`));
    }

    this.rl.prompt();
  }

  /**
   * Show REPL help
   */
  private showHelp(): void {
    console.log(chalk.cyan('\n📚 Interactive Commands:'));
    console.log('  help                 Show this help message');
    console.log('  exit/quit            Exit the interactive session');
    console.log('  clear                Clear the screen');
    console.log('  status               Show system status');
    console.log('  models               List available models');
    console.log('  history              Show command history');
    console.log('  reset                Reset conversation context');
    console.log();
    console.log(chalk.cyan('💡 Usage Tips:'));
    console.log('  - Just type your request naturally, like chatting');
    console.log('  - The AI has access to filesystem tools when needed');
    console.log('  - Use Ctrl+C to interrupt a running task');
    console.log('  - Press Ctrl+C twice to exit');
  }

  /**
   * Process a normal prompt
   */
  private async processPrompt(prompt: string): Promise<void> {
    this.isProcessing = true;

    try {
      console.log(chalk.gray('🤔 Processing...\n'));

      // Check if this is a codebase analysis request
      if (this.isCodebaseAnalysisRequest(prompt)) {
        console.log(chalk.blue('🔍 Direct codebase analysis mode activated'));
        await this.executeDirectCodebaseAnalysis(prompt);
      } else {
        // Pass other prompts to the CLI for processing
        await this.cli.executePromptProcessing(prompt, {
          stream: true,
          autonomous: true,
          contextAware: true,
        });
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error(chalk.red('❌ Error:'), errorMessage);
    } finally {
      this.isProcessing = false;
      this.rl.prompt();
    }
  }

  /**
   * Check if this is a codebase analysis request
   */
  private isCodebaseAnalysisRequest(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();
    return (
      lowerPrompt.includes('analyze this codebase') ||
      lowerPrompt.includes('analyze the codebase') ||
      lowerPrompt.includes('audit this codebase') ||
      lowerPrompt.includes('audit the codebase') ||
      (lowerPrompt.includes('analyze') && lowerPrompt.includes('project')) ||
      (lowerPrompt.includes('analyze') && lowerPrompt.includes('code')) ||
      lowerPrompt.includes('comprehensive audit') ||
      lowerPrompt.includes('thorough audit')
    );
  }

  /**
   * Execute direct codebase analysis in interactive mode
   */
  private async executeDirectCodebaseAnalysis(prompt: string): Promise<void> {
    try {
      const { simpleCodebaseAnalyzer } = await import('./simple-codebase-analyzer.js');

      console.log(chalk.gray('Using conflict-free direct analysis...'));
      console.log(chalk.yellow('⏳ This may take 1-2 minutes for comprehensive analysis\n'));

      const result = await simpleCodebaseAnalyzer.analyzeCurrentProject();

      if (result.success) {
        console.log(chalk.green('\n✅ Codebase Analysis Complete'));
        console.log(chalk.blue('═'.repeat(80)));
        console.log(result.content);
        console.log(chalk.blue('═'.repeat(80)));

        console.log(chalk.gray(`\n📊 Analysis Statistics:`));
        console.log(chalk.gray(`   Duration: ${(result.metadata.duration / 1000).toFixed(1)}s`));
        console.log(chalk.gray(`   Response length: ${result.metadata.responseLength} characters`));
        console.log(
          chalk.gray(
            `   Project items analyzed: ${result.metadata.projectStructure.split('\n').length}`
          )
        );
      } else {
        console.error(chalk.red('❌ Direct codebase analysis failed:'), result.error);
        console.log(
          chalk.yellow('🔄 You can try rephrasing your request or use a simpler prompt.')
        );
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error(chalk.red('Failed to load direct analyzer:'), errorMessage);
    }
  }

  /**
   * Show command history
   */
  private showHistory(): void {
    console.log(chalk.cyan('\n📜 Command History:'));
    this.history.slice(-10).forEach((cmd, idx) => {
      console.log(chalk.gray(`  ${idx + 1}. ${cmd}`));
    });
  }

  /**
   * Handle exit
   */
  private handleExit(): void {
    console.log(chalk.cyan('\n👋 Goodbye!'));
    this.rl.close();

    // Don't call process.exit in test environments
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.rl.close();
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup(): Promise<void> {
    return new Promise(resolve => {
      if (this.rl) {
        this.rl.close();
      }
      resolve();
    });
  }
}
