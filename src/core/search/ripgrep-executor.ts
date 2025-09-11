/**
 * Ripgrep Executor Module
 *
 * Handles secure execution of ripgrep processes with comprehensive
 * performance monitoring, resource limits, and error handling.
 */

import { ChildProcess, spawn } from 'child_process';
import { performance } from 'perf_hooks';
import { logger } from '../../infrastructure/logging/logger.js';
import { toErrorOrUndefined } from '../../utils/type-guards.js';

export interface RipgrepExecutionOptions {
  workspace: string;
  timeoutMs?: number;
  maxOutputSize?: number;
  maxMemoryMb?: number;
  useJson?: boolean;
  caseSensitive?: boolean;
  wholeWords?: boolean;
  includeFiles?: string[];
  excludeFiles?: string[];
  includeTypes?: string[];
  excludeTypes?: string[];
  contextLines?: number;
  maxDepth?: number;
  followSymlinks?: boolean;
  searchBinary?: boolean;
  multiline?: boolean;
  encoding?: 'utf8' | 'latin1' | 'auto';
}

export interface RipgrepExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  memoryUsed: number;
  linesProcessed: number;
  filesSearched: number;
  matchesFound: number;
  wasAborted: boolean;
  performance: {
    searchRate: number; // lines per second
    throughput: number; // MB per second
    efficiency: number; // matches per file ratio
  };
}

export interface RipgrepCommand {
  executable: string;
  args: string[];
  options: {
    cwd: string;
    signal?: AbortSignal;
    env?: Record<string, string>;
    stdio: ['ignore', 'pipe', 'pipe'];
  };
}

export class RipgrepExecutor {
  private static readonly DEFAULT_OPTIONS: Partial<RipgrepExecutionOptions> = {
    timeoutMs: 30000,
    maxOutputSize: 50 * 1024 * 1024, // 50MB
    maxMemoryMb: 512,
    useJson: true,
    caseSensitive: false,
    wholeWords: false,
    contextLines: 0,
    maxDepth: 100,
    followSymlinks: false,
    searchBinary: false,
    multiline: false,
    encoding: 'utf8',
  };

  private activeProcesses = new Map<string, ChildProcess>();
  private executionCount = 0;

  /**
   * Execute ripgrep with comprehensive options and monitoring
   */
  public async execute(
    query: string,
    options: RipgrepExecutionOptions
  ): Promise<RipgrepExecutionResult> {
    const executionId = `rg_${++this.executionCount}_${Date.now()}`;
    const opts = { ...RipgrepExecutor.DEFAULT_OPTIONS, ...options };
    const startTime = performance.now();

    try {
      // Build command
      const command = this.buildCommand(query, opts);

      // Execute with monitoring
      const result = await this.executeWithMonitoring(command, opts, executionId);

      // Calculate final metrics
      const duration = performance.now() - startTime;
      result.duration = duration;

      logger.debug('Ripgrep execution completed', {
        executionId,
        duration: Math.round(duration),
        matchesFound: result.matchesFound,
        filesSearched: result.filesSearched,
        searchRate: Math.round(result.performance.searchRate),
      });

      return result;
    } catch (error) {
      logger.error('Ripgrep execution failed', toErrorOrUndefined(error));
      throw error;
    } finally {
      this.activeProcesses.delete(executionId);
    }
  }

  /**
   * Execute multiple queries in parallel with resource management
   */
  public async executeParallel(
    queries: ReadonlyArray<{ query: string; options: RipgrepExecutionOptions }>,
    maxConcurrent = 3
  ): Promise<RipgrepExecutionResult[]> {
    const results: RipgrepExecutionResult[] = [];
    const executing: Promise<RipgrepExecutionResult>[] = [];

    for (const { query, options } of queries) {
      // Limit concurrent executions
      if (executing.length >= maxConcurrent) {
        // Wait for the first promise to resolve and remove it from executing
        const firstPromise = executing[0];
        const completedResult = await firstPromise;
        results.push(completedResult);
        // Remove the resolved promise from executing
        executing.splice(0, 1);
      }

      executing.push(this.execute(query, options));
    }

    // Wait for remaining executions
    const remaining = await Promise.all(executing);
    results.push(...remaining);

    return results;
  }

  /**
   * Abort all active ripgrep processes
   */
  public abortAll(): void {
    for (const [executionId, process] of this.activeProcesses) {
      try {
        process.kill('SIGTERM');
        logger.debug('Aborted ripgrep process', { executionId });
      } catch (error) {
        logger.warn('Failed to abort ripgrep process', { executionId, error });
      }
    }
    this.activeProcesses.clear();
  }

  /**
   * Get active process count
   */
  public getActiveCount(): number {
    return this.activeProcesses.size;
  }

  /**
   * Build ripgrep command with all options
   */
  private buildCommand(query: string, options: RipgrepExecutionOptions): RipgrepCommand {
    const args: string[] = [];

    // Output format
    if (options.useJson) {
      args.push('--json');
    }

    // Search behavior
    if (options.caseSensitive) {
      args.push('--case-sensitive');
    } else {
      args.push('--ignore-case');
    }

    if (options.wholeWords) {
      args.push('--word-regexp');
    }

    if (options.multiline) {
      args.push('--multiline');
      args.push('--multiline-dotall');
    }

    // Context
    if (options.contextLines && options.contextLines > 0) {
      args.push('--context', options.contextLines.toString());
    }

    // File filtering
    if (options.includeTypes?.length) {
      options.includeTypes.forEach(type => {
        args.push('--type', type);
      });
    }

    if (options.excludeTypes?.length) {
      options.excludeTypes.forEach(type => {
        args.push('--type-not', type);
      });
    }

    if (options.includeFiles?.length) {
      options.includeFiles.forEach(pattern => {
        args.push('--glob', pattern);
      });
    }

    if (options.excludeFiles?.length) {
      options.excludeFiles.forEach(pattern => {
        args.push('--glob', `!${pattern}`);
      });
    }

    // Search depth
    if (options.maxDepth && options.maxDepth > 0) {
      args.push('--max-depth', options.maxDepth.toString());
    }

    // Symlinks
    if (options.followSymlinks) {
      args.push('--follow');
    }

    // Binary files
    if (!options.searchBinary) {
      args.push('--text');
    }

    // Encoding
    if (options.encoding && options.encoding !== 'auto') {
      args.push('--encoding', options.encoding);
    }

    // Performance optimizations
    args.push('--no-heading'); // Faster parsing
    args.push('--no-filename'); // Less output when not needed
    args.push('--line-number'); // Always include line numbers

    // Add the query
    args.push(query);

    return {
      executable: 'rg',
      args,
      options: {
        cwd: options.workspace,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          RIPGREP_CONFIG_PATH: '', // Disable config file
        },
      },
    };
  }

  /**
   * Execute command with comprehensive monitoring
   */
  private async executeWithMonitoring(
    command: Readonly<RipgrepCommand>,
    options: Readonly<RipgrepExecutionOptions>,
    executionId: string
  ): Promise<RipgrepExecutionResult> {
    return new Promise((resolve, reject) => {
      // Setup abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, options.timeoutMs ?? 0);

      // Launch process
      const child = spawn(command.executable, command.args, {
        ...command.options,
        signal: controller.signal,
      });

      this.activeProcesses.set(executionId, child);

      let stdout = '';
      let stderr = '';
      let outputSize = 0;
      let wasAborted = false;

      // Monitor stdout
      child.stdout.on('data', (data: Readonly<Buffer>) => {
        const chunk = data.toString();
        outputSize += chunk.length;

        // Check output size limit
        if (outputSize > (options.maxOutputSize ?? 0)) {
          child.kill('SIGTERM');
          wasAborted = true;
          reject(new Error(`Output size limit exceeded: ${options.maxOutputSize} bytes`));
          return;
        }

        stdout += chunk;
      });

      // Monitor stderr
      child.stderr.on('data', (data: Readonly<Buffer>) => {
        stderr += data.toString();
      });

      // Handle process completion
      child.on('close', code => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(executionId);

        const result: RipgrepExecutionResult = {
          stdout,
          stderr,
          exitCode: code ?? -1,
          duration: 0, // Will be set by caller
          memoryUsed: 0, // TODO: Implement memory monitoring
          linesProcessed: this.countLines(stdout),
          filesSearched: this.countFiles(stdout),
          matchesFound: this.countMatches(stdout),
          wasAborted,
          performance: this.calculatePerformanceMetrics(stdout, 0), // Duration set later
        };

        if (code === 0 || code === 1) {
          // 0 = found, 1 = not found (both valid)
          resolve(result);
        } else {
          reject(new Error(`ripgrep exited with code ${code}: ${stderr}`));
        }
      });

      // Handle process errors
      child.on('error', (error: Readonly<Error>) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(executionId);

        if (error.name === 'AbortError') {
          wasAborted = true;
          reject(new Error(`Search timeout after ${options.timeoutMs}ms`));
        } else {
          reject(new Error(`Process execution failed: ${error.message}`));
        }
      });

      // Handle abort signal
      controller.signal.addEventListener('abort', () => {
        wasAborted = true;
        if (!child.killed) {
          child.kill('SIGTERM');
        }
      });
    });
  }

  /**
   * Count lines in output for performance metrics
   */
  private countLines(output: string): number {
    if (!output) return 0;
    return output.split('\n').length - 1;
  }

  /**
   * Count files in output for metrics
   */
  private countFiles(output: string): number {
    if (!output) return 0;
    const files = new Set<string>();

    interface RipgrepMatch {
      type: 'match';
      data?: {
        path?: {
          text?: string;
        };
      };
    }

    function isMatchType(obj: unknown): obj is RipgrepMatch {
      return (
        typeof obj === 'object' &&
        obj !== null &&
        (obj as { type?: string }).type === 'match' &&
        typeof (obj as { data?: unknown }).data === 'object' &&
        (obj as { data?: unknown }).data !== null &&
        typeof (obj as { data?: { path?: unknown } }).data?.path === 'object' &&
        (obj as { data?: { path?: unknown } }).data?.path !== null &&
        typeof (obj as { data?: { path?: { text?: unknown } } }).data?.path?.text === 'string'
      );
    }

    for (const line of output.split('\n')) {
      try {
        const parsed: unknown = JSON.parse(line);
        if (isMatchType(parsed)) {
          const filePath = parsed.data?.path?.text;
          if (filePath) {
            files.add(filePath);
          }
        }
      } catch {
        // Not JSON, skip
      }
    }

    return files.size;
  }

  /**
   * Count matches in output
   */
  private countMatches(output: string): number {
    if (!output) return 0;
    let matches = 0;

    for (const line of output.split('\n')) {
      try {
        const parsed: unknown = JSON.parse(line);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'type' in parsed &&
          (parsed as { type?: unknown }).type === 'match'
        ) {
          matches++;
        }
      } catch {
        // Not JSON, assume plain text format
        if (line.includes(':')) {
          matches++;
        }
      }
    }

    return matches;
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(
    output: string,
    duration: number
  ): {
    searchRate: number;
    throughput: number;
    efficiency: number;
  } {
    const lines = this.countLines(output);
    const files = this.countFiles(output);
    const matches = this.countMatches(output);

    const searchRate = duration > 0 ? lines / (duration / 1000) : 0;
    const throughput = duration > 0 ? output.length / 1024 / 1024 / (duration / 1000) : 0;
    const efficiency = files > 0 ? matches / files : 0;

    return {
      searchRate: Math.round(searchRate),
      throughput: Math.round(throughput * 100) / 100,
      efficiency: Math.round(efficiency * 1000) / 1000,
    };
  }
}
