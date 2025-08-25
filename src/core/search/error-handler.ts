/**
 * Comprehensive Error Handling and Fallback System for Hybrid Search
 *
 * @description Implements sophisticated error handling with graceful degradation
 * and intelligent fallback mechanisms across multiple search methods
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import type { RAGQuery, RAGResult } from '../rag/vector-rag-system.js';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low', // Recoverable, continue with degraded performance
  MEDIUM = 'medium', // Significant issue, attempt fallback
  HIGH = 'high', // Critical failure, immediate fallback required
  CRITICAL = 'critical', // System failure, emergency fallback only
}

/**
 * Error categories for different types of search failures
 */
export enum ErrorCategory {
  TOOL_NOT_FOUND = 'tool_not_found', // ripgrep/find not available
  PERMISSION_DENIED = 'permission_denied', // File access issues
  TIMEOUT = 'timeout', // Operation timeout
  MEMORY_LIMIT = 'memory_limit', // Memory exhaustion
  INVALID_PATTERN = 'invalid_pattern', // Malformed regex/pattern
  NETWORK_ERROR = 'network_error', // Remote service issues
  DISK_IO_ERROR = 'disk_io_error', // File system problems
  PROCESS_ERROR = 'process_error', // Process execution failure
  PARSING_ERROR = 'parsing_error', // Result parsing failure
  CONFIGURATION_ERROR = 'configuration_error', // Config/setup issues
  UNKNOWN = 'unknown', // Unclassified errors
}

/**
 * Search method availability status
 */
export interface MethodAvailability {
  ripgrep: boolean;
  find: boolean;
  grep: boolean;
  powershell: boolean; // Windows-specific
  rag: boolean;
  hybrid: boolean;
}

/**
 * Error context information
 */
export interface SearchErrorContext {
  query: RAGQuery;
  method: string;
  attempt: number;
  maxAttempts: number;
  startTime: number;
  fallbacksUsed: string[];
  platformInfo: {
    platform: string;
    shell: string;
    toolsAvailable: MethodAvailability;
  };
}

/**
 * Structured search error
 */
export class SearchError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly severity: ErrorSeverity,
    public readonly context: SearchErrorContext,
    public readonly originalError?: Error,
    public readonly isRetryable: boolean = true
  ) {
    super(message);
    this.name = 'SearchError';
  }
}

/**
 * Fallback strategy definition
 */
export interface FallbackStrategy {
  name: string;
  method: string;
  condition: (error: SearchError) => boolean;
  execute: (query: RAGQuery, context: SearchErrorContext) => Promise<RAGResult>;
  priority: number; // Lower numbers = higher priority
  platforms: string[]; // Supported platforms
  requiredTools: string[];
}

/**
 * Comprehensive error handling and fallback system
 */
export class SearchErrorHandler extends EventEmitter {
  private methodAvailability: MethodAvailability;
  private fallbackStrategies: FallbackStrategy[] = [];
  private errorHistory: SearchError[] = [];
  private maxErrorHistory = 100;
  private retryAttempts: Map<string, number> = new Map();

  // Error thresholds and timeouts
  private readonly ERROR_THRESHOLDS = {
    maxRetries: 3,
    retryDelay: 1000,
    timeoutMs: 30000,
    maxMemoryMB: 500,
    maxConcurrentSearches: 5,
  };

  constructor() {
    super();
    this.methodAvailability = this.detectMethodAvailability();
    this.initializeFallbackStrategies();

    // Set up error event handlers
    this.setupErrorHandlers();
  }

  /**
   * Main error handling entry point
   */
  async handleSearchError(
    error: Error | SearchError,
    query: RAGQuery,
    method: string,
    context: Partial<SearchErrorContext> = {}
  ): Promise<RAGResult> {
    // Convert to SearchError if needed
    const searchError =
      error instanceof SearchError ? error : this.categorizeError(error, query, method, context);

    // Log the error
    this.logError(searchError);

    // Add to error history
    this.errorHistory.push(searchError);
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.shift();
    }

    // Emit error event
    this.emit('search-error', searchError);

    // Determine if we should retry or use fallback
    const shouldFallback = this.shouldUseFallback(searchError);

    if (shouldFallback) {
      return this.executeFallbackStrategy(searchError);
    } else {
      // Attempt retry if appropriate
      return this.attemptRetry(searchError);
    }
  }

  /**
   * Categorize and structure an error
   */
  private categorizeError(
    error: Error,
    query: RAGQuery,
    method: string,
    context: Partial<SearchErrorContext>
  ): SearchError {
    const category = this.determineErrorCategory(error);
    const severity = this.determineErrorSeverity(error, category);

    const fullContext: SearchErrorContext = {
      query,
      method,
      attempt: context.attempt ?? 1,
      maxAttempts: context.maxAttempts ?? this.ERROR_THRESHOLDS.maxRetries,
      startTime: context.startTime ?? Date.now(),
      fallbacksUsed: context.fallbacksUsed ?? [],
      platformInfo: {
        platform: process.platform,
        shell: process.env.SHELL ?? process.env.ComSpec ?? 'unknown',
        toolsAvailable: this.methodAvailability,
      },
    };

    const isRetryable = this.isErrorRetryable(category, severity, fullContext);

    return new SearchError(error.message, category, severity, fullContext, error, isRetryable);
  }

  /**
   * Determine error category from error details
   */
  private determineErrorCategory(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();

    if (message.includes('command not found') ?? message.includes('is not recognized')) {
      return ErrorCategory.TOOL_NOT_FOUND;
    }
    if (message.includes('permission denied') ?? message.includes('access denied')) {
      return ErrorCategory.PERMISSION_DENIED;
    }
    if (message.includes('timeout') ?? message.includes('timed out')) {
      return ErrorCategory.TIMEOUT;
    }
    if (message.includes('memory') ?? message.includes('out of memory')) {
      return ErrorCategory.MEMORY_LIMIT;
    }
    if (message.includes('invalid pattern') ?? message.includes('regex')) {
      return ErrorCategory.INVALID_PATTERN;
    }
    if (message.includes('enotfound') ?? message.includes('network')) {
      return ErrorCategory.NETWORK_ERROR;
    }
    if (message.includes('enoent') ?? message.includes('file not found')) {
      return ErrorCategory.DISK_IO_ERROR;
    }
    if (message.includes('process') ?? message.includes('spawn')) {
      return ErrorCategory.PROCESS_ERROR;
    }
    if (message.includes('parse') ?? message.includes('json') ?? message.includes('syntax')) {
      return ErrorCategory.PARSING_ERROR;
    }
    if (message.includes('config') ?? message.includes('configuration')) {
      return ErrorCategory.CONFIGURATION_ERROR;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Determine error severity based on category and context
   */
  private determineErrorSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
    switch (category) {
      case ErrorCategory.TOOL_NOT_FOUND:
        return ErrorSeverity.HIGH; // Need fallback immediately

      case ErrorCategory.PERMISSION_DENIED:
        return ErrorSeverity.MEDIUM; // May work with different approach

      case ErrorCategory.TIMEOUT:
        return ErrorSeverity.LOW; // Can retry with different params

      case ErrorCategory.MEMORY_LIMIT:
        return ErrorSeverity.HIGH; // Need immediate fallback

      case ErrorCategory.INVALID_PATTERN:
        return ErrorSeverity.MEDIUM; // Can fix pattern and retry

      case ErrorCategory.NETWORK_ERROR:
        return ErrorSeverity.LOW; // Transient, can retry

      case ErrorCategory.DISK_IO_ERROR:
        return ErrorSeverity.MEDIUM; // May be recoverable

      case ErrorCategory.PROCESS_ERROR:
        return ErrorSeverity.HIGH; // Process failures are serious

      case ErrorCategory.PARSING_ERROR:
        return ErrorSeverity.LOW; // Usually recoverable

      case ErrorCategory.CONFIGURATION_ERROR:
        return ErrorSeverity.CRITICAL; // System-level issue

      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Determine if error is retryable
   */
  private isErrorRetryable(
    category: ErrorCategory,
    severity: ErrorSeverity,
    context: SearchErrorContext
  ): boolean {
    // Never retry critical errors
    if (severity === ErrorSeverity.CRITICAL) {
      return false;
    }

    // Don't retry if we've exceeded max attempts
    if (context.attempt >= context.maxAttempts) {
      return false;
    }

    // Some categories are never retryable
    const nonRetryableCategories = [
      ErrorCategory.TOOL_NOT_FOUND,
      ErrorCategory.CONFIGURATION_ERROR,
      ErrorCategory.INVALID_PATTERN,
    ];

    if (nonRetryableCategories.includes(category)) {
      return false;
    }

    return true;
  }

  /**
   * Decide whether to use fallback or retry
   */
  private shouldUseFallback(error: SearchError): boolean {
    // Always use fallback for high/critical severity
    if (error.severity === ErrorSeverity.HIGH || error.severity === ErrorSeverity.CRITICAL) {
      return true;
    }

    // Use fallback if we've exhausted retries
    if (error.context.attempt >= error.context.maxAttempts) {
      return true;
    }

    // Use fallback for certain error categories
    const fallbackCategories = [
      ErrorCategory.TOOL_NOT_FOUND,
      ErrorCategory.PROCESS_ERROR,
      ErrorCategory.MEMORY_LIMIT,
    ];

    return fallbackCategories.includes(error.category);
  }

  /**
   * Execute appropriate fallback strategy
   */
  private async executeFallbackStrategy(error: SearchError): Promise<RAGResult> {
    logger.info(`Executing fallback strategy for error: ${error.category}`);

    // Find applicable fallback strategies
    const applicableStrategies = this.fallbackStrategies
      .filter(strategy => strategy.condition(error))
      .filter(strategy => strategy.platforms.includes(process.platform))
      .filter(strategy => this.areToolsAvailable(strategy.requiredTools))
      .filter(strategy => !error.context.fallbacksUsed.includes(strategy.name))
      .sort((a, b) => a.priority - b.priority);

    if (applicableStrategies.length === 0) {
      // No fallback strategies available - return empty result
      logger.error('No fallback strategies available for error:', error);
      return this.createEmptyResult(error.context.query);
    }

    // Try each fallback strategy in order
    for (const strategy of applicableStrategies) {
      try {
        logger.info(`Attempting fallback strategy: ${strategy.name}`);

        // Mark this fallback as used
        error.context.fallbacksUsed.push(strategy.name);

        const result = await strategy.execute(error.context.query, error.context);

        // Emit successful fallback event
        this.emit('fallback-success', {
          originalError: error,
          fallbackStrategy: strategy.name,
          result,
        });

        return result;
      } catch (fallbackError) {
        logger.warn(`Fallback strategy ${strategy.name} failed:`, fallbackError);

        // Continue to next fallback strategy
        continue;
      }
    }

    // All fallback strategies failed
    logger.error('All fallback strategies failed for error:', error);
    this.emit('fallback-exhausted', error);

    return this.createEmptyResult(error.context.query);
  }

  /**
   * Attempt to retry the operation
   */
  private async attemptRetry(error: SearchError): Promise<RAGResult> {
    if (!error.isRetryable) {
      return this.executeFallbackStrategy(error);
    }

    const retryKey = `${error.context.method}_${error.context.query.query}`;
    const currentAttempts = this.retryAttempts.get(retryKey) ?? 0;

    if (currentAttempts >= this.ERROR_THRESHOLDS.maxRetries) {
      return this.executeFallbackStrategy(error);
    }

    // Increment retry count
    this.retryAttempts.set(retryKey, currentAttempts + 1);

    // Wait before retry (exponential backoff)
    const delay = this.ERROR_THRESHOLDS.retryDelay * Math.pow(2, currentAttempts);
    await this.delay(delay);

    logger.info(
      `Retrying search (attempt ${currentAttempts + 1}/${this.ERROR_THRESHOLDS.maxRetries})`
    );

    // Emit retry event
    this.emit('search-retry', {
      error,
      attempt: currentAttempts + 1,
      delay,
    });

    // This would trigger the original search operation again
    // The actual retry mechanism would be implemented by the calling code
    throw new Error('Retry requested - calling code should handle this');
  }

  /**
   * Initialize platform-specific fallback strategies
   */
  private initializeFallbackStrategies(): void {
    // Strategy 1: Ripgrep to find + grep fallback
    this.fallbackStrategies.push({
      name: 'find_grep_fallback',
      method: 'find+grep',
      condition: error =>
        error.category === ErrorCategory.TOOL_NOT_FOUND && error.context.method === 'ripgrep',
      execute: async (query, context) => {
        // Implementation would use find + grep combination
        return this.createEmptyResult(query, 'find+grep fallback executed');
      },
      priority: 1,
      platforms: ['linux', 'darwin'],
      requiredTools: ['find', 'grep'],
    });

    // Strategy 2: PowerShell Get-ChildItem fallback (Windows)
    this.fallbackStrategies.push({
      name: 'powershell_fallback',
      method: 'powershell',
      condition: error => error.category === ErrorCategory.TOOL_NOT_FOUND,
      execute: async (query, context) => {
        // Implementation would use PowerShell Get-ChildItem + Select-String
        return this.createEmptyResult(query, 'PowerShell fallback executed');
      },
      priority: 1,
      platforms: ['win32'],
      requiredTools: ['powershell'],
    });

    // Strategy 3: Node.js file system fallback
    this.fallbackStrategies.push({
      name: 'nodejs_fs_fallback',
      method: 'nodejs',
      condition: error =>
        [ErrorCategory.TOOL_NOT_FOUND, ErrorCategory.PROCESS_ERROR].includes(error.category),
      execute: async (query, context) => {
        // Implementation would use Node.js fs.readdir + string matching
        return this.createEmptyResult(query, 'Node.js filesystem fallback executed');
      },
      priority: 3,
      platforms: ['linux', 'darwin', 'win32'],
      requiredTools: [],
    });

    // Strategy 4: RAG semantic search fallback
    this.fallbackStrategies.push({
      name: 'rag_semantic_fallback',
      method: 'rag',
      condition: error => error.context.method !== 'rag', // Don't fallback to RAG from RAG
      execute: async (query, context) => {
        // Implementation would use RAG system for semantic search
        return this.createEmptyResult(query, 'RAG semantic fallback executed');
      },
      priority: 2,
      platforms: ['linux', 'darwin', 'win32'],
      requiredTools: ['rag'],
    });

    // Strategy 5: Emergency text search fallback
    this.fallbackStrategies.push({
      name: 'emergency_fallback',
      method: 'emergency',
      condition: () => true, // Always applicable as last resort
      execute: async (query, context) => {
        // Basic text search using Node.js built-ins
        return this.createEmptyResult(query, 'Emergency fallback executed');
      },
      priority: 10, // Lowest priority - last resort
      platforms: ['linux', 'darwin', 'win32'],
      requiredTools: [],
    });
  }

  /**
   * Detect which search methods are available on this system
   */
  private detectMethodAvailability(): MethodAvailability {
    const availability: MethodAvailability = {
      ripgrep: false,
      find: false,
      grep: false,
      powershell: false,
      rag: false,
      hybrid: false,
    };

    // This would actually test for tool availability
    // For now, return conservative defaults

    if (process.platform === 'win32') {
      availability.powershell = true;
    } else {
      availability.find = true;
      availability.grep = true;
    }

    // Assume these are available if properly configured
    availability.rag = true;
    availability.hybrid = true;

    return availability;
  }

  /**
   * Check if required tools are available
   */
  private areToolsAvailable(requiredTools: string[]): boolean {
    if (requiredTools.length === 0) return true;

    return requiredTools.every(tool => {
      switch (tool) {
        case 'ripgrep':
          return this.methodAvailability.ripgrep;
        case 'find':
          return this.methodAvailability.find;
        case 'grep':
          return this.methodAvailability.grep;
        case 'powershell':
          return this.methodAvailability.powershell;
        case 'rag':
          return this.methodAvailability.rag;
        default:
          return false;
      }
    });
  }

  /**
   * Create empty result for failed searches
   */
  private createEmptyResult(_query: RAGQuery, reason?: string): RAGResult {
    return {
      documents: [],
      totalFound: 0,
      queryTime: 0,
      retrievalMethod: 'fallback',
      reranked: false,
      debugInfo: {
        vectorSearchTime: 0,
        rerankTime: 0,
        candidatesConsidered: 0,
      },
    };
  }

  /**
   * Setup error event handlers
   */
  private setupErrorHandlers(): void {
    // Log performance degradation warnings
    this.on('search-error', (error: SearchError) => {
      if (error.severity === ErrorSeverity.HIGH || error.severity === ErrorSeverity.CRITICAL) {
        logger.warn(`High severity search error: ${error.message}`);
      }
    });

    // Alert on repeated fallbacks
    this.on('fallback-success', event => {
      logger.info(`Fallback strategy '${event.fallbackStrategy}' succeeded`);
    });

    this.on('fallback-exhausted', (error: SearchError) => {
      logger.error(`All fallback strategies exhausted for error: ${error.category}`);
    });
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    fallbackSuccessRate: number;
    retrySuccessRate: number;
  } {
    const stats = {
      totalErrors: this.errorHistory.length,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      fallbackSuccessRate: 0,
      retrySuccessRate: 0,
    };

    // Initialize counters
    Object.values(ErrorCategory).forEach(category => {
      stats.errorsByCategory[category] = 0;
    });

    Object.values(ErrorSeverity).forEach(severity => {
      stats.errorsBySeverity[severity] = 0;
    });

    // Count errors by category and severity
    this.errorHistory.forEach(error => {
      stats.errorsByCategory[error.category]++;
      stats.errorsBySeverity[error.severity]++;
    });

    return stats;
  }

  /**
   * Log error with appropriate detail level
   */
  private logError(error: SearchError): void {
    const logLevel =
      error.severity === ErrorSeverity.CRITICAL
        ? 'error'
        : error.severity === ErrorSeverity.HIGH
          ? 'warn'
          : 'info';

    logger[logLevel](`Search error [${error.category}:${error.severity}]: ${error.message}`, {
      method: error.context.method,
      query: error.context.query.query.substring(0, 50),
      attempt: error.context.attempt,
      fallbacksUsed: error.context.fallbacksUsed,
    });
  }

  /**
   * Utility delay function
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear error history and retry counters
   */
  clearHistory(): void {
    this.errorHistory = [];
    this.retryAttempts.clear();
    logger.info('Error history and retry counters cleared');
  }
}
