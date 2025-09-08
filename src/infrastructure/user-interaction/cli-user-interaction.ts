/**
 * CLI User Interaction Implementation
 *
 * This implementation provides concrete user interaction capabilities
 * that can be injected into tools and other systems, breaking circular dependencies.
 */

import {
  DisplayOptions,
  IUserInteraction,
  PromptOptions,
} from '../../domain/interfaces/user-interaction.js';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import inquirer from 'inquirer';

export class CLIUserInteraction implements IUserInteraction {
  private currentSpinner: Ora | null = null;
  private _isVerbose: boolean = false;

  public constructor(options: Readonly<{ verbose?: boolean }> = {}) {
    this._isVerbose = options.verbose ?? false;
  }

  public async display(message: string, options: Readonly<DisplayOptions> = {}): Promise<void> {
    // Stop any current spinner
    if (this.currentSpinner) {
      this.currentSpinner.stop();
      this.currentSpinner = null;
    }

    const prefix = options.prefix ?? '';
    const formattedMessage = this.formatMessage(message, options.type, prefix);

    if (options.stream) {
      // CRITICAL FIX: For streaming output, ensure proper finalization
      process.stdout.write(formattedMessage);

      // Ensure the output is flushed and finalized properly
      if ((options.final ?? false) || message.trim().length === 0 || message.endsWith('\n')) {
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
  public async warn(message: string): Promise<void> {
    await this.display(message, { type: 'warn' });
  }

  public async error(message: string): Promise<void> {
    await this.display(message, { type: 'error' });
  }

  public async success(message: string): Promise<void> {
    await this.display(message, { type: 'success' });
  }

  public async progress(message: string, progress?: number): Promise<void> {
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

  public async prompt(
    question: string,
    options: Readonly<PromptOptions> = {}
  ): Promise<string> {
    // Stop any current spinner
    if (this.currentSpinner) {
      this.currentSpinner.stop();
      this.currentSpinner = null;
    }

    const inquirerOptions = {
      type: 'input',
      name: 'answer',
      message: question,
      default: options.defaultValue,
      validate: (input: string): string | boolean => {
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
      }
    };

    // Cast to any to avoid strict Inquirer generic typing issues across versions
    const answers = await (inquirer as any).prompt([{ ...(inquirerOptions as any) }]);
    return answers.answer;
  }

  public async confirm(question: string): Promise<boolean> {
    // Stop any current spinner
    if (this.currentSpinner) {
      this.currentSpinner.stop();
      this.currentSpinner = null;
    }

    const confirmAnswers: { confirmed: boolean } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: question,
        default: false,
      },
    ]);

    return confirmAnswers.confirmed;
  }

  public async select(question: string, choices: readonly string[]): Promise<string> {
    // Stop any current spinner
    if (this.currentSpinner) {
      this.currentSpinner.stop();
      this.currentSpinner = null;
    }

    const selectAnswers: { selected: string } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: question,
        choices: [...choices], // Create a mutable copy for inquirer
      },
    ]);

    return selectAnswers.selected;
  }

  /**
   * Stop any active progress indicators
   */
  public stopProgress(): void {
    if (this.currentSpinner) {
      this.currentSpinner.stop();
      this.currentSpinner = null;
    }
  }

  /**
   * Set verbose mode
   */
  public setVerbose(verbose: boolean): void {
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
