import { CLIError } from './cli-output-manager.js';
import { existsSync, statSync } from 'fs';
import { extname } from 'path';

/**
 * CLI Argument Validator following industry best practices
 * 
 * Provides comprehensive validation for CLI arguments with proper error messages
 */
export class CLIArgumentValidator {
  /**
   * Validate voice selection arguments
   */
  static validateVoices(voices: string | undefined, availableVoices: string[]): void {
    if (!voices) return;

    if (voices === 'auto' || voices === 'all') return;

    const selectedVoices = voices.split(',').map(v => v.trim().toLowerCase());
    const invalidVoices = selectedVoices.filter(voice => !availableVoices.includes(voice));

    if (invalidVoices.length > 0) {
      throw CLIError.invalidArgument(
        'voices',
        `Unknown voice(s): ${invalidVoices.join(', ')}. Available voices: ${availableVoices.join(', ')}`
      );
    }
  }

  /**
   * Validate file path arguments
   */
  static validateFilePath(filePath: string | undefined, paramName: string, mustExist = true): void {
    if (!filePath) return;

    if (mustExist && !existsSync(filePath)) {
      throw CLIError.notFound(`File: ${filePath}`);
    }

    if (mustExist) {
      try {
        const stats = statSync(filePath);
        if (stats.isDirectory()) {
          throw CLIError.invalidArgument(
            paramName,
            `Expected a file but got a directory: ${filePath}`
          );
        }
      } catch (error) {
        if (error instanceof CLIError) throw error;
        throw CLIError.invalidArgument(paramName, `Cannot access file: ${filePath}`);
      }
    }
  }

  /**
   * Validate directory path arguments
   */
  static validateDirectoryPath(dirPath: string | undefined, paramName: string, mustExist = true): void {
    if (!dirPath) return;

    if (mustExist && !existsSync(dirPath)) {
      throw CLIError.notFound(`Directory: ${dirPath}`);
    }

    if (mustExist) {
      try {
        const stats = statSync(dirPath);
        if (!stats.isDirectory()) {
          throw CLIError.invalidArgument(
            paramName,
            `Expected a directory but got a file: ${dirPath}`
          );
        }
      } catch (error) {
        if (error instanceof CLIError) throw error;
        throw CLIError.invalidArgument(paramName, `Cannot access directory: ${dirPath}`);
      }
    }
  }

  /**
   * Validate numeric arguments with range checking
   */
  static validateNumeric(
    value: string | number | undefined,
    paramName: string,
    options: {
      min?: number;
      max?: number;
      integer?: boolean;
      required?: boolean;
    } = {}
  ): number | undefined {
    if (value === undefined || value === '') {
      if (options.required) {
        throw CLIError.invalidArgument(paramName, 'Value is required');
      }
      return undefined;
    }

    const num = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(num)) {
      throw CLIError.invalidArgument(paramName, `Must be a valid number, got: ${value}`);
    }

    if (options.integer && !Number.isInteger(num)) {
      throw CLIError.invalidArgument(paramName, `Must be an integer, got: ${value}`);
    }

    if (options.min !== undefined && num < options.min) {
      throw CLIError.invalidArgument(paramName, `Must be at least ${options.min}, got: ${num}`);
    }

    if (options.max !== undefined && num > options.max) {
      throw CLIError.invalidArgument(paramName, `Must be at most ${options.max}, got: ${num}`);
    }

    return num;
  }

  /**
   * Validate enum/choice arguments
   */
  static validateChoice<T extends string>(
    value: string | undefined,
    paramName: string,
    choices: readonly T[],
    required = false
  ): T | undefined {
    if (!value) {
      if (required) {
        throw CLIError.invalidArgument(
          paramName,
          `Value is required. Choices: ${choices.join(', ')}`
        );
      }
      return undefined;
    }

    if (!choices.includes(value as T)) {
      throw CLIError.invalidArgument(
        paramName,
        `Invalid choice '${value}'. Valid choices: ${choices.join(', ')}`
      );
    }

    return value as T;
  }

  /**
   * Validate output format
   */
  static validateOutputFormat(format: string | undefined): 'text' | 'json' | 'table' | undefined {
    return this.validateChoice(format, 'output', ['text', 'json', 'table'] as const);
  }

  /**
   * Validate synthesis mode
   */
  static validateSynthesisMode(mode: string | undefined): string | undefined {
    return this.validateChoice(
      mode,
      'mode',
      ['competitive', 'collaborative', 'iterative', 'consensus'] as const
    );
  }

  /**
   * Validate timeout values
   */
  static validateTimeout(timeout: string | number | undefined): number | undefined {
    if (!timeout) return undefined;

    const timeoutMs = this.validateNumeric(timeout, 'timeout', {
      min: 1000, // 1 second minimum
      max: 600000, // 10 minutes maximum
      integer: true
    });

    return timeoutMs;
  }

  /**
   * Validate model name format
   */
  static validateModelName(modelName: string | undefined): void {
    if (!modelName) return;

    // Basic model name validation - should not contain invalid characters
    const invalidChars = /[<>:"|?*\x00-\x1f]/;
    if (invalidChars.test(modelName)) {
      throw CLIError.invalidArgument(
        'model',
        'Model name contains invalid characters'
      );
    }

    // Should not be too long
    if (modelName.length > 200) {
      throw CLIError.invalidArgument(
        'model',
        'Model name is too long (max 200 characters)'
      );
    }
  }

  /**
   * Validate API key format (basic validation)
   */
  static validateApiKey(apiKey: string | undefined, provider?: string): void {
    if (!apiKey) return;

    // Basic length checks
    if (apiKey.length < 10) {
      throw CLIError.invalidArgument(
        'api-key',
        'API key appears to be too short'
      );
    }

    if (apiKey.length > 500) {
      throw CLIError.invalidArgument(
        'api-key',
        'API key is too long'
      );
    }

    // Provider-specific validation
    if (provider) {
      switch (provider.toLowerCase()) {
        case 'openai':
          if (!apiKey.startsWith('sk-')) {
            throw CLIError.invalidArgument(
              'api-key',
              'OpenAI API keys should start with "sk-"'
            );
          }
          break;
        case 'anthropic':
          if (!apiKey.startsWith('sk-ant-')) {
            throw CLIError.invalidArgument(
              'api-key',
              'Anthropic API keys should start with "sk-ant-"'
            );
          }
          break;
      }
    }
  }

  /**
   * Validate file extension for specific operations
   */
  static validateFileExtension(
    filePath: string | undefined,
    allowedExtensions: string[],
    operation: string
  ): void {
    if (!filePath) return;

    const ext = extname(filePath).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      throw CLIError.invalidArgument(
        'file',
        `${operation} operation only supports files with extensions: ${allowedExtensions.join(', ')}. Got: ${ext || 'no extension'}`
      );
    }
  }

  /**
   * Validate glob pattern syntax
   */
  static validateGlobPattern(pattern: string | undefined): void {
    if (!pattern) return;

    // Basic validation - check for dangerous patterns
    const dangerousPatterns = [
      /\.\.\//,  // Directory traversal
      /\/\.\.\//,  // Directory traversal
      /^\//,     // Absolute paths (could be dangerous)
    ];

    for (const dangerous of dangerousPatterns) {
      if (dangerous.test(pattern)) {
        throw CLIError.invalidArgument(
          'pattern',
          'Pattern contains potentially dangerous path traversal'
        );
      }
    }

    // Validate it's not too broad (could cause performance issues)
    if (pattern === '**' || pattern === '**/*' || pattern === '**/**') {
      throw CLIError.invalidArgument(
        'pattern',
        'Pattern is too broad. Please specify file extensions or more specific paths'
      );
    }
  }

  /**
   * Validate configuration key-value pairs
   */
  static validateConfigKeyValue(keyValue: string | undefined): { key: string; value: any } {
    if (!keyValue) {
      throw CLIError.invalidArgument('config', 'Key-value pair is required (format: key=value)');
    }

    const parts = keyValue.split('=');
    if (parts.length !== 2) {
      throw CLIError.invalidArgument(
        'config',
        'Invalid format. Use: key=value'
      );
    }

    const [key, valueStr] = parts;
    
    if (!key.trim()) {
      throw CLIError.invalidArgument('config', 'Key cannot be empty');
    }

    // Try to parse value as JSON, fallback to string
    let value: any;
    try {
      value = JSON.parse(valueStr);
    } catch {
      value = valueStr;
    }

    return { key: key.trim(), value };
  }

  /**
   * Validate that mutually exclusive options are not used together
   */
  static validateMutuallyExclusive(
    options: Record<string, any>,
    groups: string[][]
  ): void {
    for (const group of groups) {
      const activeOptions = group.filter(option => options[option]);
      if (activeOptions.length > 1) {
        throw CLIError.invalidArgument(
          'options',
          `Options ${activeOptions.join(', ')} are mutually exclusive`
        );
      }
    }
  }

  /**
   * Validate required dependencies between options
   */
  static validateDependencies(
    options: Record<string, any>,
    dependencies: Record<string, string[]>
  ): void {
    for (const [option, requiredOptions] of Object.entries(dependencies)) {
      if (options[option]) {
        const missingDeps = requiredOptions.filter(dep => !options[dep]);
        if (missingDeps.length > 0) {
          throw CLIError.invalidArgument(
            option,
            `Option requires: ${missingDeps.join(', ')}`
          );
        }
      }
    }
  }
}