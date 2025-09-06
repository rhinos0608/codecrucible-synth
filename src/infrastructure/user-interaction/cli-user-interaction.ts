/**
 * CLI User Interaction Implementation
 *
 * This implementation provides concrete user interaction capabilities
 * that can be injected into tools and other systems, breaking circular dependencies.
 */

import {
  IUserInteraction,
  DisplayOptions,
  PromptOptions,
} from '../../domain/interfaces/user-interaction.js';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import inquirer from 'inquirer';

export class CLIUserInteraction implements IUserInteraction {
  private currentSpinner: Ora | null = null;
  private _isVerbose: boolean;

  constructor(options: { verbose?: boolean } = {}) {
    this._isVerbose = options.verbose ?? false;
  }

  async display(message: string, options: DisplayOptions = {}): Promise<void> {
    // Stop any current spinner
    if (this.currentSpinner) {
      this.currentSpinner.stop();
      this.currentSpinner = null;
    }

    const prefix = options.prefix || '';
    const formattedMessage = this.formatMessage(message, options.type, prefix);

    if (options.stream) {
      // CRITICAL FIX: For streaming output, ensure proper finalization
      process.stdout.write(formattedMessage);

      // Ensure the output is flushed and finalized properly
      if (options.final || message.trim().length === 0 || message.endsWith('\n')) {
        process.stdout.write('\n');
      }

      // Force flush to prevent output buffering issues
      if (process.stdout.isTTY) {
        process.stdout.cursorTo(0);
      }
    } else {
      // Use stderr for non-user output to separate from responses
      if (options.type === 'debug' || options.type === 'verbose') {
        console.error(formattedMessage); // Logs go to stderr
      } else {
        console.log(formattedMessage); // User responses go to stdout
      }
    }
  }

  async warn(message: string): Promise<void> {
    await this.display(message, { type: 'warn' });
  }

  async error(message: string): Promise<void> {
    await this.display(message, { type: 'error' });
  }

  async success(message: string): Promise<void> {
    await this.display(message, { type: 'success' });
  }

  async progress(message: string, progress?: number): Promise<void> {
    if (progress !== undefined) {
      // Show progress with percentage
      const progressBar = this.createProgressBar(progress);
      await this.display(`${message} ${progressBar}`, { type: 'info' });
    } else {
      // Show spinner for indeterminate progress
      if (this.currentSpinner) {
        this.currentSpinner.text = message;
      } else {
        this.currentSpinner = ora(message).start();
      }
    }
  }

  async prompt(question: string, options: PromptOptions = {}): Promise<string> {
    // Stop any current spinner
    if (this.currentSpinner) {
      this.currentSpinner.stop();
      this.currentSpinner = null;
    }

    const inquirerOptions: any = {
      type: 'input',
      name: 'answer',
      message: question,
      default: options.defaultValue,
    };

    if (options.validation) {
      inquirerOptions.validate = (input: string) => {
        if (options.required && !input.trim()) {
          return 'This field is required';
        }

        if (options.validation) {
          const result = options.validation(input);
          if (result === true) return true;
          if (typeof result === 'string') return result;
          return 'Invalid input';
        }

        return true;
      };
    }

    const answers = await inquirer.prompt([inquirerOptions]);
    return answers.answer;
  }

  async confirm(question: string): Promise<boolean> {
    // Stop any current spinner
    if (this.currentSpinner) {
      this.currentSpinner.stop();
      this.currentSpinner = null;
    }

    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: question,
        default: false,
      },
    ]);

    return answers.confirmed;
  }

  async select(question: string, choices: string[]): Promise<string> {
    // Stop any current spinner
    if (this.currentSpinner) {
      this.currentSpinner.stop();
      this.currentSpinner = null;
    }

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: question,
        choices,
      },
    ]);

    return answers.selected;
  }

  /**
   * Stop any active progress indicators
   */
  stopProgress(): void {
    if (this.currentSpinner) {
      this.currentSpinner.stop();
      this.currentSpinner = null;
    }
  }

  /**
   * Set verbose mode
   */
  setVerbose(verbose: boolean): void {
    this._isVerbose = verbose;
  }

  private formatMessage(message: string, type?: string, prefix?: string): string {
    let formatted = message;

    // Add prefix if provided
    if (prefix) {
      formatted = `${prefix} ${formatted}`;
    }

    // Apply color based on type
    switch (type) {
      case 'error':
        formatted = chalk.red(`❌ ${formatted}`);
        break;
      case 'warn':
        formatted = chalk.yellow(`⚠️  ${formatted}`);
        break;
      case 'success':
        formatted = chalk.green(`✅ ${formatted}`);
        break;
      case 'info':
      default:
        formatted = chalk.blue(`ℹ️  ${formatted}`);
        break;
    }

    return formatted;
  }

  private createProgressBar(progress: number): string {
    const barLength = 20;
    const completed = Math.round((progress / 100) * barLength);
    const remaining = barLength - completed;

    const completedBar = '█'.repeat(completed);
    const remainingBar = '░'.repeat(remaining);

    return chalk.green(`[${completedBar}${remainingBar}] ${progress.toFixed(1)}%`);
  }
}
