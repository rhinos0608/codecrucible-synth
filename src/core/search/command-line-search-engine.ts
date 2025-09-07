/**
 * Command Line Search Engine - Full Modular Implementation
 * 
 * Orchestrates all search modules to provide comprehensive, secure,
 * and high-performance search capabilities with multiple strategies.
 */

import { performance } from 'perf_hooks';
import type { RAGQuery, RAGResult } from './types.js';
import { logger } from '../../infrastructure/logging/logger.js';

// Import all modular components
import { type SanitizedQuery, SearchQuerySanitizer } from './search-query-sanitizer.js';
import { type RipgrepExecutionOptions, RipgrepExecutor } from './ripgrep-executor.js';
import { type ParsedSearchResult, SearchResultParser } from './search-result-parser.js';
import { type SearchStrategy, SearchStrategyManager, type SearchStrategyOptions } from './search-strategy-manager.js';
import { FileFilterManager, type FileFilterOptions } from './file-filter-manager.js';
import { type CacheOptions, SearchCacheManager } from './search-cache-manager.js';

export interface CommandLineSearchOptions {
  enableCache?: boolean;
  cacheOptions?: CacheOptions;
  strategy?: SearchStrategy;
  strategyOptions?: SearchStrategyOptions;
  filterOptions?: FileFilterOptions;
  fallbackOnError?: boolean;
  maxRetries?: number;
  performanceMonitoring?: boolean;
  securityLevel?: 'low' | 'medium' | 'high';
}

export interface SearchExecutionMetrics {
  totalTime: number;
  sanitizationTime: number;
  executionTime: number;
  parsingTime: number;
  strategySelectionTime: number;
  cacheHit: boolean;
  retryCount: number;
  strategy: SearchStrategy;
  fallbackUsed: boolean;
}

export class CommandLineSearchEngine {
  private readonly ripgrepExecutor: RipgrepExecutor;
  private readonly cacheManager: SearchCacheManager;
  private readonly options: Required<CommandLineSearchOptions>;

  public constructor(
    private readonly workspace: string,
    private readonly timeoutMs: number = 30000,
    options: Readonly<CommandLineSearchOptions> = {}
  ) {
    this.options = {
      enableCache: true,
      cacheOptions: {},
      strategy: 'literal',
      strategyOptions: { strategy: 'literal' },
      filterOptions: {},
      fallbackOnError: true,
      maxRetries: 2,
      performanceMonitoring: true,
      securityLevel: 'medium',
      ...options,
    };

    this.ripgrepExecutor = new RipgrepExecutor();
    this.cacheManager = this.options.enableCache 
      ? new SearchCacheManager(this.options.cacheOptions) 
      : new SearchCacheManager({ maxEntries: 0 }); // Disabled cache
  }

  /**
   * Main search method with full modular orchestration
   */
  public async search(query: Readonly<RAGQuery>): Promise<RAGResult> {
    const startTime = performance.now();
    const metrics: Partial<SearchExecutionMetrics> = {
      retryCount: 0,
      cacheHit: false,
      fallbackUsed: false,
    };

    try {
      // Phase 1: Check cache
      if (this.options.enableCache) {
        const cached = this.cacheManager.get(query);
        if (cached) {
          metrics.cacheHit = true;
          metrics.totalTime = performance.now() - startTime;
          
          logger.debug('Cache hit for search query', { 
            query: query.query.slice(0, 50),
            totalTime: metrics.totalTime,
          });

          return this.convertToRAGResult(cached, metrics as SearchExecutionMetrics);
        }
      }

      // Phase 2: Query sanitization
      const sanitizationStart = performance.now();
      const sanitizedQuery = this.sanitizeQuery(query);
      metrics.sanitizationTime = performance.now() - sanitizationStart;

      if (!sanitizedQuery.isValid) {
        logger.warn('Query failed sanitization', { 
          query: query.query.slice(0, 100),
          warnings: sanitizedQuery.warnings,
        });
        return this.createEmptyResult(metrics as SearchExecutionMetrics);
      }

      // Phase 3: Strategy selection
      const strategyStart = performance.now();
      const strategyResult = SearchStrategyManager.determineStrategy(query, this.options.strategyOptions);
      metrics.strategy = strategyResult.strategy;
      metrics.strategySelectionTime = performance.now() - strategyStart;

      logger.debug('Search strategy selected', {
        strategy: strategyResult.strategy,
        confidence: strategyResult.confidence,
        estimatedAccuracy: strategyResult.estimatedAccuracy,
      });

      // Phase 4: Execute search with retries and fallbacks
      const result = await this.executeWithRetries(
        query,
        sanitizedQuery,
        strategyResult,
        metrics
      );

      // Phase 5: Cache successful results
      if (this.options.enableCache && result.documents.length > 0) {
        this.cacheManager.set(query, result);
      }

      metrics.totalTime = performance.now() - startTime;

      if (this.options.performanceMonitoring) {
        this.logPerformanceMetrics(query, metrics as SearchExecutionMetrics);
      }

      return this.convertToRAGResult(result, metrics as SearchExecutionMetrics);

    } catch (error) {
      metrics.totalTime = performance.now() - startTime;
      logger.error('Search execution failed', { 
        error, 
        query: query.query.slice(0, 100),
        workspace: this.workspace,
        metrics,
      });

      return this.createEmptyResult(metrics as SearchExecutionMetrics, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Execute multiple queries in parallel
   */
  public async searchMultiple(queries: ReadonlyArray<Readonly<RAGQuery>>): Promise<RAGResult[]> {
    const promises = queries.map(async (query: Readonly<RAGQuery>) => this.search(query));
    return Promise.all(promises);
  }

  /**
   * Get search engine status and performance stats
   */
  public getStatus(): {
    activeSearches: number;
    cacheSize: number;
    workspace: string;
    configuration: CommandLineSearchOptions;
  } {
    return {
      activeSearches: this.ripgrepExecutor.getActiveCount(),
      cacheSize: this.cacheManager.getCacheSize(),
      workspace: this.workspace,
      configuration: this.options,
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.ripgrepExecutor.abortAll();
  }

  // Private methods

  private sanitizeQuery(query: RAGQuery): SanitizedQuery {
    const context = this.determineQueryContext(query);
    
    return SearchQuerySanitizer.validateForContext(
      query.query,
      context
    );
  }

  private determineQueryContext(query: RAGQuery): 'code' | 'documentation' | 'logs' | 'general' {
    // Simple heuristics to determine context
    if (query.query.includes('function') || query.query.includes('class') || query.query.includes('()')) {
      return 'code';
    }
    if (query.query.includes('error') || query.query.includes('exception') || query.query.includes('failed')) {
      return 'logs';
    }
    if (query.query.includes('TODO') || query.query.includes('FIXME') || query.query.includes('README')) {
      return 'documentation';
    }
    return 'general';
  }

  private async executeWithRetries(
    query: RAGQuery,
    sanitizedQuery: SanitizedQuery,
    strategyResult: any,
    metrics: Partial<SearchExecutionMetrics>
  ): Promise<ParsedSearchResult> {
    let lastError: Error | null = null;
    
    // Try primary strategy
    try {
      return await this.executeSingleSearch(query, sanitizedQuery, strategyResult, metrics);
    } catch (error) {
      lastError = error as Error;
      logger.debug('Primary strategy failed, trying fallbacks', { 
        strategy: strategyResult.strategy,
        error: lastError.message,
      });
    }

    // Try fallback strategies if enabled
    if (this.options.fallbackOnError) {
      for (const fallbackStrategy of strategyResult.fallbackStrategies.slice(0, 2)) {
        try {
          const fallbackStrategyResult = SearchStrategyManager.determineStrategy(
            query, 
            { ...this.options.strategyOptions, strategy: fallbackStrategy }
          );
          
          const result = await this.executeSingleSearch(query, sanitizedQuery, fallbackStrategyResult, metrics);
          metrics.fallbackUsed = true;
          metrics.strategy = fallbackStrategy;
          
          logger.info('Fallback strategy succeeded', { 
            originalStrategy: strategyResult.strategy,
            fallbackStrategy,
          });
          
          return result;
        } catch (error) {
          logger.debug('Fallback strategy failed', { 
            strategy: fallbackStrategy,
            error: (error as Error).message,
          });
          lastError = error as Error;
        }
      }
    }

    throw lastError || new Error('All search strategies failed');
  }

  private async executeSingleSearch(
    query: RAGQuery,
    sanitizedQuery: SanitizedQuery,
    strategyResult: any,
    metrics: Partial<SearchExecutionMetrics>
  ): Promise<ParsedSearchResult> {
    // Build execution options
    let ripgrepOptions: RipgrepExecutionOptions = {
      workspace: this.workspace,
      timeoutMs: this.timeoutMs,
      ...strategyResult.recommendedOptions,
    };

    // Apply file filtering
    const filteredOptions = FileFilterManager.applyFilters(ripgrepOptions as unknown as Record<string, unknown>, this.options.filterOptions);
    ripgrepOptions = { ...ripgrepOptions, ...filteredOptions };

    // Execute ripgrep
    const executionStart = performance.now();
    const executionResult = await this.ripgrepExecutor.execute(
      sanitizedQuery.sanitized,
      ripgrepOptions
    );
    metrics.executionTime = performance.now() - executionStart;

    // Parse results
    const parsingStart = performance.now();
    const parsedResult = SearchResultParser.parse(
      executionResult.stdout,
      'ripgrep',
      {
        maxFilePathLength: 500,
        maxContentLength: 2000,
        deduplicateResults: true,
        normalizeWhitespace: true,
      }
    );
    metrics.parsingTime = performance.now() - parsingStart;

    // Store execution metrics for later use
    (parsedResult as any).executionMetrics = {
      searchRate: executionResult.performance.searchRate,
      throughput: executionResult.performance.throughput,
      efficiency: executionResult.performance.efficiency,
      memoryUsed: executionResult.memoryUsed,
      filesSearched: executionResult.filesSearched,
    };

    return parsedResult;
  }

  private convertToRAGResult(
    parsedResult: ParsedSearchResult,
    metrics: SearchExecutionMetrics
  ): RAGResult {
    return {
      documents: parsedResult.documents,
      metadata: {
        searchMethod: 'ripgrep',
        confidence: parsedResult.metadata.confidence,
        strategy: metrics.strategy,
        executionTime: metrics.totalTime,
        cacheHit: metrics.cacheHit,
        fallbackUsed: metrics.fallbackUsed,
        warnings: parsedResult.warnings,
        statistics: parsedResult.statistics,
        performance: (parsedResult as any).executionMetrics,
      },
    };
  }

  private createEmptyResult(
    metrics: SearchExecutionMetrics,
    error?: Error
  ): RAGResult {
    return {
      documents: [],
      metadata: {
        searchMethod: 'ripgrep',
        confidence: 0,
        strategy: metrics.strategy || 'unknown',
        executionTime: metrics.totalTime || 0,
        cacheHit: false,
        fallbackUsed: false,
        error: error?.message,
        warnings: ['Search returned no results'],
      },
    };
  }

  private logPerformanceMetrics(query: RAGQuery, metrics: SearchExecutionMetrics): void {
    logger.info('Search performance metrics', {
      query: query.query.slice(0, 50),
      totalTime: Math.round(metrics.totalTime),
      sanitizationTime: Math.round(metrics.sanitizationTime || 0),
      strategySelectionTime: Math.round(metrics.strategySelectionTime || 0),
      executionTime: Math.round(metrics.executionTime || 0),
      parsingTime: Math.round(metrics.parsingTime || 0),
      strategy: metrics.strategy,
      cacheHit: metrics.cacheHit,
      fallbackUsed: metrics.fallbackUsed,
      retryCount: metrics.retryCount,
    });
  }
}
