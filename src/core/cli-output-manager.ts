import chalk from 'chalk';
import { logger } from './logger.js';

/**
 * CLI Output Manager following industry best practices
 * 
 * Implements proper output separation:
 * - Command output -> stdout
 * - Command errors -> stderr  
 * - Progress reporting -> stderr (if TTY)
 * - Logging -> configurable (stderr by default)
 */
export class CLIOutputManager {
  private static instance: CLIOutputManager;
  private verboseMode = false;
  private quietMode = false;
  private outputFormat: 'text' | 'json' | 'table' = 'text';

  private constructor() {}

  static getInstance(): CLIOutputManager {
    if (!CLIOutputManager.instance) {
      CLIOutputManager.instance = new CLIOutputManager();
    }
    return CLIOutputManager.instance;
  }

  /**
   * Configure output manager
   */
  configure(options: {
    verbose?: boolean;
    quiet?: boolean;
    format?: 'text' | 'json' | 'table';
  }): void {
    this.verboseMode = options.verbose || false;
    this.quietMode = options.quiet || false;
    this.outputFormat = options.format || 'text';
  }

  /**
   * Primary command output - always goes to stdout
   */
  outputResult(data: any): void {
    if (this.quietMode) return;

    if (typeof data === 'string') {
      process.stdout.write(data + '\n');
    } else {
      switch (this.outputFormat) {
        case 'json':
          process.stdout.write(JSON.stringify(data, null, 2) + '\n');
          break;
        case 'table':
          this.outputTable(data);
          break;
        default:
          process.stdout.write(String(data) + '\n');
      }
    }
  }

  /**
   * Error output - always goes to stderr
   */
  outputError(message: string, exitCode?: number): void {
    process.stderr.write(chalk.red('❌ Error: ') + message + '\n');
    if (exitCode !== undefined) {
      process.exit(exitCode);
    }
  }

  /**
   * Warning output - goes to stderr
   */
  outputWarning(message: string): void {
    if (this.quietMode) return;
    process.stderr.write(chalk.yellow('⚠️  Warning: ') + message + '\n');
  }

  /**
   * Info/status messages - goes to stderr
   */
  outputInfo(message: string): void {
    if (this.quietMode) return;
    process.stderr.write(chalk.blue('ℹ️  ') + message + '\n');
  }

  /**
   * Success messages - goes to stderr
   */
  outputSuccess(message: string): void {
    if (this.quietMode) return;
    process.stderr.write(chalk.green('✅ ') + message + '\n');
  }

  /**
   * Debug messages - only in verbose mode, goes to stderr
   */
  outputDebug(message: string): void {
    if (!this.verboseMode || this.quietMode) return;
    process.stderr.write(chalk.gray('🔍 Debug: ') + message + '\n');
  }

  /**
   * Progress reporting - only to TTY stderr
   */
  outputProgress(message: string): void {
    if (this.quietMode || !process.stderr.isTTY) return;
    process.stderr.write(chalk.cyan('⏳ ') + message + '\n');
  }

  /**
   * Spinner-style progress - only to TTY stderr
   */
  startProgress(message: string): () => void {
    if (this.quietMode || !process.stderr.isTTY) {
      return () => {}; // No-op function
    }

    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    
    const interval = setInterval(() => {
      process.stderr.write(`\r${chalk.cyan(frames[i])} ${message}`);
      i = (i + 1) % frames.length;
    }, 80);

    return () => {
      clearInterval(interval);
      process.stderr.write('\r' + ' '.repeat(message.length + 3) + '\r');
    };
  }

  /**
   * Output data in table format
   */
  private outputTable(data: any): void {
    if (Array.isArray(data)) {
      if (data.length === 0) {
        process.stdout.write('No data to display\n');
        return;
      }

      const headers = Object.keys(data[0]);
      const maxWidths = headers.map(header => {
        const values = data.map(row => String(row[header] || ''));
        return Math.max(header.length, ...values.map(v => v.length));
      });

      // Header
      const headerRow = headers.map((header, i) => 
        header.padEnd(maxWidths[i])
      ).join(' | ');
      process.stdout.write(headerRow + '\n');
      
      // Separator
      const separator = maxWidths.map(width => '-'.repeat(width)).join('-|-');
      process.stdout.write(separator + '\n');

      // Data rows
      data.forEach(row => {
        const dataRow = headers.map((header, i) => 
          String(row[header] || '').padEnd(maxWidths[i])
        ).join(' | ');
        process.stdout.write(dataRow + '\n');
      });
    } else {
      // Single object
      Object.entries(data).forEach(([key, value]) => {
        process.stdout.write(`${key}: ${value}\n`);
      });
    }
  }

  /**
   * Helper for consistent help output
   */
  outputHelp(helpText: string): void {
    process.stderr.write(helpText + '\n');
  }

  /**
   * Helper for consistent usage output
   */
  outputUsage(usageText: string): void {
    process.stderr.write('Usage: ' + usageText + '\n');
  }

  /**
   * Helper for examples output
   */
  outputExamples(examples: Array<{ description: string; command: string }>): void {
    process.stderr.write('\nExamples:\n\n');
    examples.forEach(example => {
      process.stderr.write(chalk.gray(`  ${example.description}:\n`));
      process.stderr.write(chalk.green(`    ${example.command}\n\n`));
    });
  }
}

/**
 * Standard CLI exit codes following POSIX conventions
 */
export enum CLIExitCode {
  SUCCESS = 0,           // Command completed successfully
  GENERAL_ERROR = 1,     // General error
  MISUSE = 2,           // Misuse of shell command (invalid arguments, etc.)
  NOT_FOUND = 3,        // Resource not found (following Azure CLI convention)
  PERMISSION_DENIED = 4, // Permission denied
  TIMEOUT = 5,          // Operation timed out  
  NETWORK_ERROR = 6,    // Network connectivity issues
  CONFIG_ERROR = 7,     // Configuration error
  AUTHENTICATION_ERROR = 8, // Authentication failed
  VALIDATION_ERROR = 9,  // Input validation error
  INTERRUPTED = 130     // Interrupted by user (Ctrl+C)
}

/**
 * CLI Error class with proper exit codes and error types
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public exitCode: CLIExitCode = CLIExitCode.GENERAL_ERROR,
    public errorType: string = 'GeneralError'
  ) {
    super(message);
    this.name = 'CLIError';
  }

  /**
   * Factory methods for common error types
   */
  static notFound(resource: string): CLIError {
    return new CLIError(
      `Resource not found: ${resource}`,
      CLIExitCode.NOT_FOUND,
      'ResourceNotFound'
    );
  }

  static invalidArgument(argument: string, reason?: string): CLIError {
    const message = reason 
      ? `Invalid argument '${argument}': ${reason}`
      : `Invalid argument: ${argument}`;
    return new CLIError(message, CLIExitCode.MISUSE, 'InvalidArgument');
  }

  static configurationError(message: string): CLIError {
    return new CLIError(
      `Configuration error: ${message}`,
      CLIExitCode.CONFIG_ERROR,
      'ConfigurationError'
    );
  }

  static networkError(message: string): CLIError {
    return new CLIError(
      `Network error: ${message}`,
      CLIExitCode.NETWORK_ERROR,
      'NetworkError'
    );
  }

  static timeout(operation: string): CLIError {
    return new CLIError(
      `Operation timed out: ${operation}`,
      CLIExitCode.TIMEOUT,
      'TimeoutError'
    );
  }

  static authenticationError(message?: string): CLIError {
    return new CLIError(
      message || 'Authentication failed',
      CLIExitCode.AUTHENTICATION_ERROR,
      'AuthenticationError'
    );
  }

  static validationError(message: string): CLIError {
    return new CLIError(
      `Validation error: ${message}`,
      CLIExitCode.VALIDATION_ERROR,
      'ValidationError'
    );
  }
}

/**
 * Global output manager instance
 */
export const cliOutput = CLIOutputManager.getInstance();