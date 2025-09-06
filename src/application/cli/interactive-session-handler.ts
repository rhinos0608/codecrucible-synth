/**
 * Interactive Session Handler - Modularized REPL Functionality
 *
 * Extracted from UnifiedCLI to handle interactive session management:
 * - REPL (Read-Eval-Print Loop) functionality
 * - Interactive command processing and special commands
 * - Help and status display in interactive mode
 * - Session continuation and error handling
 */

import { IUserInteraction } from '../../domain/interfaces/user-interaction.js';
import { getErrorMessage } from '../../utils/error-utils.js';
import chalk from 'chalk';

export interface InteractiveSessionOptions {
  enableHelp?: boolean;
  enableStatus?: boolean;
  enableSuggestions?: boolean;
  defaultToDryRun?: boolean;
  showWelcomeMessage?: boolean;
}

export interface ProcessPromptFunction {
  (prompt: string, options?: Record<string, unknown>): Promise<string>;
}

export interface GetSuggestionsFunction {
  (): Promise<Array<{ command: string; description: string; relevance: number }>>;
}

export interface ShowStatusFunction {
  (): Promise<void>;
}

export interface ExecCommandFunction {
  (name: string, args: readonly unknown[]): Promise<unknown>;
}

/**
 * Handles interactive CLI session functionality (REPL)
 */
export class InteractiveSessionHandler {
  private readonly userInteraction: IUserInteraction;
  private readonly options: Required<InteractiveSessionOptions>;

  private processPrompt?: ProcessPromptFunction;
  private getSuggestions?: GetSuggestionsFunction;
  private showStatus?: ShowStatusFunction;
  private execCommand?: ExecCommandFunction;

  public constructor(
    userInteraction: Readonly<IUserInteraction>,
    options: Readonly<InteractiveSessionOptions> = {}
  ) {
    this.userInteraction = userInteraction;
    this.options = {
      enableHelp: options.enableHelp ?? true,
      enableStatus: options.enableStatus ?? true,
      enableSuggestions: options.enableSuggestions ?? true,
      defaultToDryRun: options.defaultToDryRun ?? true,
      showWelcomeMessage: options.showWelcomeMessage ?? true,
    };
  }

  /**
   * Set callback functions for interactive operations
   */
  public setCallbacks(
    callbacks: Readonly<{
      processPrompt?: ProcessPromptFunction;
      getSuggestions?: GetSuggestionsFunction;
      showStatus?: ShowStatusFunction;
      execCommand?: ExecCommandFunction;
    }>
  ): void {
    this.processPrompt = callbacks.processPrompt;
    this.getSuggestions = callbacks.getSuggestions;
    this.showStatus = callbacks.showStatus;
    this.execCommand = callbacks.execCommand;
  }

  /**
   * Start interactive REPL mode
   */
  public async startInteractive(
    contextInfo?: Readonly<{ type?: string; language?: string; confidence?: number }>
  ): Promise<void> {
    if (this.options.showWelcomeMessage) {
      await this.userInteraction.display('🚀 Starting interactive mode...', { type: 'info' });
      await this.userInteraction.display('Type "exit", "quit", or press Ctrl+C to quit.', {
        type: 'info',
      });

      // Show context info if available
      if (contextInfo?.type && contextInfo?.language) {
        await this.userInteraction.display(
          `📊 Project: ${contextInfo.type} (${contextInfo.language}) - Confidence: ${((contextInfo.confidence ?? 0) * 100).toFixed(0)}%`,
          { type: 'info' }
        );
      }
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

        const handled = await this.handleSpecialCommand(input.trim());
        if (handled) {
          continue;
        }

        // Process regular user input
        if (this.processPrompt) {
          // Interactive mode defaults to dry-run to avoid accidental writes
          const response = await this.processPrompt(input.trim(), {
            dryRun: this.options.defaultToDryRun,
          });
          await this.userInteraction.display(response);
        } else {
          await this.userInteraction.error('No prompt processor available');
        }
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
   * Handle special interactive commands
   */
  private async handleSpecialCommand(input: string): Promise<boolean> {
    // Help command
    if (input === 'help' || input === '.help') {
      if (this.options.enableHelp) {
        await this.showHelp();
        return true;
      }
    }

    // Status command
    if (input === 'status' || input === '.status') {
      if (this.options.enableStatus && this.showStatus) {
        await this.showStatus();
        return true;
      }
    }

    // Suggestions command
    if (input === 'suggestions' || input === '.suggestions') {
      if (this.options.enableSuggestions) {
        await this.showSuggestions();
        return true;
      }
    }

    // Commands listing
    if (input === 'commands' || input === '.commands') {
      await this.showCommands();
      return true;
    }

    // Exec command
    if (input.startsWith('exec ') || input.startsWith('.exec ')) {
      await this.handleExecCommand(input);
      return true;
    }

    return false;
  }

  /**
   * Handle exec command
   */
  private async handleExecCommand(input: string): Promise<void> {
    const line = input.replace(/^\.?exec\s+/, '');
    const [name, ...rest] = line.split(/\s+/);

    if (!name) {
      await this.userInteraction.error('Usage: exec <command> [args as JSON or tokens]');
      return;
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

    if (this.execCommand) {
      try {
        const result: unknown = await this.execCommand(name, args);
        await this.userInteraction.display(
          typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        );
      } catch (error) {
        await this.userInteraction.error(`Command execution failed: ${getErrorMessage(error)}`);
      }
    } else {
      await this.userInteraction.error('Command execution not available');
    }
  }

  /**
   * Show help information for interactive mode
   */
  private async showHelp(): Promise<void> {
    const help = `
${chalk.cyan('🤖 Interactive CLI Commands')}

${chalk.yellow('Special Commands:')}
  help, .help         - Show this help
  status, .status     - Show system status
  suggestions, .suggestions - Show intelligent suggestions
  commands, .commands - Show available plugin commands
  exec, .exec <cmd>   - Execute a plugin command
  exit, quit, .exit   - Exit interactive mode

${chalk.yellow('Tips:')}
  • Commands default to dry-run mode for safety
  • Use descriptive natural language for best results
  • File references with @ syntax are supported (e.g., @src/main.ts)
  • Type your request and press Enter to process

${chalk.yellow('Examples:')}
  "Analyze the main.ts file for potential issues"
  "Create a new React component for user profiles"
  "Explain how the authentication system works"
`;
    await this.userInteraction.display(help);
  }

  /**
   * Show intelligent suggestions
   */
  private async showSuggestions(): Promise<void> {
    if (!this.getSuggestions) {
      await this.userInteraction.display('Suggestions not available', { type: 'warn' });
      return;
    }

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
        output += '\n';
      });

      await this.userInteraction.display(output);
    } catch (error) {
      await this.userInteraction.error(`Failed to get suggestions: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Show available commands
   */
  private async showCommands(): Promise<void> {
    // This would integrate with the plugin system to show available commands
    await this.userInteraction.display('Command listing functionality would be integrated here');
  }
}

export default InteractiveSessionHandler;
