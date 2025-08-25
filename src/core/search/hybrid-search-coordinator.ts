/**
 * Hybrid Search Coordinator for CodeCrucible Synth
 * Intelligently routes queries between Vector RAG and Command-Line Search
 * Based on comprehensive research findings and performance optimization
 */

import { EventEmitter } from 'events';
import { Logger } from '../logger.js';
import { VectorRAGSystem, RAGQuery, RAGResult, ScoredDocument } from '../rag/vector-rag-system.js';
import {
  CommandLineSearchEngine,
  SearchOptions,
  SearchResult,
  CodePatternGenerator,
} from './command-line-search-engine.js';
import { AdvancedSearchCacheManager, CachedSearchExecutor } from './advanced-search-cache.js';
import { SearchErrorHandler } from './error-handler.js';
export interface HybridSearchConfig {
  // Routing thresholds and preferences
  routing: {
    exactPatternThreshold: number; // 0.8 = prefer ripgrep for 80% exact matches
    semanticSimilarityThreshold: number; // 0.6 = use RAG below this similarity
    performanceTimeoutMs: number; // 2000 = switch to faster method if slow
    memoryPressureThreshold: number; // 0.8 = use ripgrep if memory >80%
  };

  // Feature flags for gradual rollout
  featureFlags: {
    enableHybridRouting: boolean;
    enablePerformanceOptimization: boolean;
    enableFallbackMechanism: boolean;
    enableResultFusion: boolean;
  };

  // Performance monitoring
  monitoring: {
    enableMetrics: boolean;
    logRoutingDecisions: boolean;
    benchmarkComparisons: boolean;
  };
}

export interface SearchRoute {
  method: 'ripgrep' | 'rag' | 'hybrid' | 'fallback';
  confidence: number;
  reasoning: string;
  estimatedTime: number;
  estimatedMemory: number;
}

export interface HybridSearchMetrics {
  routingDecisions: Map<string, number>;
  performanceComparisons: {
    ripgrepAvgTime: number;
    ragAvgTime: number;
    hybridAvgTime: number;
  };
  accuracyScores: {
    ripgrepAccuracy: number;
    ragAccuracy: number;
    hybridAccuracy: number;
  };
  memoryUsage: {
    ripgrepMemory: number;
    ragMemory: number;
  };
}

/**
 * Core hybrid search coordinator that intelligently routes queries
 */
export class HybridSearchCoordinator extends EventEmitter {
  private logger: Logger;
  private config: HybridSearchConfig;
  private ragSystem?: VectorRAGSystem;
  private commandSearch: CommandLineSearchEngine;
  private metrics: HybridSearchMetrics;
  private advancedCache: AdvancedSearchCacheManager;
  private cachedExecutor: CachedSearchExecutor;
  private errorHandler: SearchErrorHandler;

  constructor(
    commandSearch: CommandLineSearchEngine,
    config: HybridSearchConfig,
    ragSystem?: VectorRAGSystem
  ) {
    super();
    this.logger = new Logger('HybridSearchCoordinator');
    this.config = config;
    this.commandSearch = commandSearch;
    this.ragSystem = ragSystem;

    // Initialize comprehensive error handling
    this.errorHandler = new SearchErrorHandler();
    this.setupErrorHandling();

    // Initialize advanced caching system
    this.advancedCache = new AdvancedSearchCacheManager({
      maxCacheSize: 1000,
      maxCacheAge: 5 * 60 * 1000, // 5 minutes
      enableFileHashTracking: true,
      enablePerformanceMetrics: true,
    });
    this.cachedExecutor = new CachedSearchExecutor(this.advancedCache);

    this.metrics = {
      routingDecisions: new Map(),
      performanceComparisons: {
        ripgrepAvgTime: 0,
        ragAvgTime: 0,
        hybridAvgTime: 0,
      },
      accuracyScores: {
        ripgrepAccuracy: 0,
        ragAccuracy: 0,
        hybridAccuracy: 0,
      },
      memoryUsage: {
        ripgrepMemory: 0,
        ragMemory: 0,
      },
    };
  }

  /**
   * Main search method with intelligent routing
   */
  async search(query: RAGQuery): Promise<RAGResult> {
    const startTime = Date.now();
    this.logger.info(`🔄 Hybrid search: "${query.query}" (type: ${query.queryType})`);

    try {
      // Generate cache key
      const searchKey = this.generateAdvancedCacheKey(query);

      // Use cached executor for automatic caching
      const result = await this.cachedExecutor.executeWithCache(
        searchKey,
        async () => {
          // Decide routing strategy
          const route = await this.decideRoute(query);
          this.logRoutingDecision(route, query);

          // Execute search based on route
          let result: RAGResult;
          switch (route.method) {
            case 'ripgrep':
              result = await this.executeRipgrepSearch(query, route);
              break;
            case 'rag':
              result = await this.executeRAGSearch(query, route);
              break;
            case 'hybrid':
              result = await this.executeHybridSearch(query, route);
              break;
            case 'fallback':
              result = await this.executeFallbackSearch(query, route);
              break;
            default:
              throw new Error(`Unknown routing method: ${route.method}`);
          }

          return result;
        },
        {
          searchMethod: 'hybrid',
          queryType: query.queryType ?? 'unknown',
          confidence: 0.8,
          filePaths: this.extractFilePathsFromQuery(query),
        }
      );

      // Update performance metrics
      const duration = Date.now() - startTime;
      this.updateMetrics('hybrid', duration, result);

      this.logger.info(`✅ Hybrid search completed in ${duration}ms`);
      this.emit('search:completed', { query, result, duration });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('❌ Hybrid search failed:', error);
      this.emit('search:failed', { query, error, duration });

      // Use comprehensive error handling
      if (this.config.featureFlags.enableFallbackMechanism) {
        try {
          return await this.errorHandler.handleSearchError(error as Error, query, 'hybrid', {
            attempt: 1,
            maxAttempts: 3,
            startTime,
          });
        } catch (fallbackError) {
          // If error handler fails, use basic fallback
          return this.executeFallbackSearch(query, {
            method: 'fallback',
            confidence: 0.1,
            reasoning: 'Error handler fallback',
            estimatedTime: 5000,
            estimatedMemory: 50,
          });
        }
      }

      throw error;
    }
  }

  /**
   * Intelligent routing decision based on query analysis
   */
  private async decideRoute(query: RAGQuery): Promise<SearchRoute> {
    if (!this.config.featureFlags.enableHybridRouting) {
      return {
        method: this.ragSystem ? 'rag' : 'ripgrep',
        confidence: 0.5,
        reasoning: 'Hybrid routing disabled',
        estimatedTime: 1000,
        estimatedMemory: 100,
      };
    }

    const queryAnalysis = this.analyzeQuery(query) as {
      hasExactPatterns: boolean;
      hasCodePatterns: boolean;
      hasSemanticIntent: boolean;
      complexity: 'low' | 'medium' | 'high';
      language?: string;
    };
    const systemAnalysis = await this.analyzeSystemState() as {
      memoryPressure: number;
      ragAvailable: boolean;
      ripgrepAvailable: boolean;
      recentPerformance: { ripgrep: number; rag: number };
    };

    // Decision matrix based on analysis
    const routingScore = this.calculateRoutingScore(queryAnalysis, systemAnalysis);

    if (routingScore.ripgrepScore > routingScore.ragScore && routingScore.ripgrepScore > 0.7) {
      return {
        method: 'ripgrep',
        confidence: routingScore.ripgrepScore,
        reasoning: `High exact pattern match confidence (${routingScore.ripgrepScore.toFixed(2)})`,
        estimatedTime: 200,
        estimatedMemory: 10,
      };
    }

    if (this.ragSystem && routingScore.ragScore > 0.6) {
      return {
        method: 'rag',
        confidence: routingScore.ragScore,
        reasoning: `Semantic search preferred (${routingScore.ragScore.toFixed(2)})`,
        estimatedTime: 1000,
        estimatedMemory: 200,
      };
    }

    // Use hybrid approach for complex queries
    if (this.ragSystem && this.config.featureFlags.enableResultFusion) {
      return {
        method: 'hybrid',
        confidence: Math.max(routingScore.ripgrepScore, routingScore.ragScore),
        reasoning: 'Combined approach for best results',
        estimatedTime: 1500,
        estimatedMemory: 150,
      };
    }

    // Fallback to available system
    return {
      method: this.ragSystem ? 'rag' : 'ripgrep',
      confidence: 0.4,
      reasoning: 'Default fallback routing',
      estimatedTime: 1000,
      estimatedMemory: 100,
    };
  }

  /**
   * Analyze query characteristics for routing decisions
   */
  private analyzeQuery(query: RAGQuery): {
    hasExactPatterns: boolean;
    hasCodePatterns: boolean;
    hasSemanticIntent: boolean;
    complexity: 'low' | 'medium' | 'high';
    language?: string;
  } {
    const queryText = query.query.toLowerCase();

    // Check for exact patterns
    const exactPatterns = [
      /^[a-zA-Z_][a-zA-Z0-9_]*$/, // Simple identifier
      /function\s+\w+/, // Function definition
      /class\s+\w+/, // Class definition
      /import\s+.*from/, // Import statement
      /\w+\.\w+/, // Method calls
    ];
    const hasExactPatterns = exactPatterns.some(pattern => pattern.test(queryText));

    // Check for code patterns
    const codeKeywords = [
      'function',
      'class',
      'interface',
      'import',
      'export',
      'const',
      'let',
      'var',
      'def',
      'struct',
      'trait',
    ];
    const hasCodePatterns = codeKeywords.some(keyword => queryText.includes(keyword));

    // Check for semantic intent
    const semanticIndicators = [
      'how to',
      'what is',
      'find all',
      'show me',
      'explain',
      'similar to',
      'related to',
    ];
    const hasSemanticIntent = semanticIndicators.some(indicator => queryText.includes(indicator));

    // Determine complexity
    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (query.query.length > 50) complexity = 'medium';
    if (query.query.includes('AND') ?? query.query.includes('OR') ?? query.filters)
      complexity = 'high';

    // Try to detect language
    const language = this.detectQueryLanguage(query.query);

    return {
      hasExactPatterns,
      hasCodePatterns,
      hasSemanticIntent,
      complexity,
      language,
    };
  }

  /**
   * Analyze current system state for routing decisions
   */
  private async analyzeSystemState(): Promise<{
    memoryPressure: number;
    ragAvailable: boolean;
    ripgrepAvailable: boolean;
    recentPerformance: { ripgrep: number; rag: number };
  }> {
    const memoryUsage = process.memoryUsage();
    const memoryPressure = memoryUsage.heapUsed / memoryUsage.heapTotal;

    // Check system availability
    const ragAvailable = this.ragSystem !== undefined;
    const ripgrepAvailable = await this.checkRipgrepAvailability();

    // Get recent performance metrics
    const recentPerformance = {
      ripgrep: this.metrics.performanceComparisons.ripgrepAvgTime,
      rag: this.metrics.performanceComparisons.ragAvgTime,
    };

    return {
      memoryPressure,
      ragAvailable,
      ripgrepAvailable,
      recentPerformance,
    };
  }

  /**
   * Calculate routing scores for different search methods
   */
  private calculateRoutingScore(
    queryAnalysis: {
      hasExactPatterns: boolean;
      hasCodePatterns: boolean;
      hasSemanticIntent: boolean;
      complexity: 'low' | 'medium' | 'high';
      language?: string;
    },
    systemAnalysis: {
      memoryPressure: number;
      ragAvailable: boolean;
      ripgrepAvailable: boolean;
      recentPerformance: { ripgrep: number; rag: number };
    }
  ): { ripgrepScore: number; ragScore: number } {
    let ripgrepScore = 0;
    let ragScore = 0;

    // Ripgrep scoring
    if (queryAnalysis.hasExactPatterns) ripgrepScore += 0.4;
    if (queryAnalysis.hasCodePatterns) ripgrepScore += 0.3;
    if (queryAnalysis.complexity === 'low') ripgrepScore += 0.2;
    if (systemAnalysis.memoryPressure > this.config.routing.memoryPressureThreshold)
      ripgrepScore += 0.3;
    if (systemAnalysis.recentPerformance.ripgrep < systemAnalysis.recentPerformance.rag)
      ripgrepScore += 0.2;

    // RAG scoring
    if (queryAnalysis.hasSemanticIntent) ragScore += 0.5;
    if (queryAnalysis.complexity === 'high') ragScore += 0.3;
    if (!queryAnalysis.hasExactPatterns) ragScore += 0.2;
    if (systemAnalysis.ragAvailable && systemAnalysis.memoryPressure < 0.5) ragScore += 0.2;

    // Normalize scores
    ripgrepScore = Math.min(ripgrepScore, 1.0);
    ragScore = Math.min(ragScore, 1.0);

    return { ripgrepScore, ragScore };
  }

  /**
   * Execute ripgrep-based search
   */
  private async executeRipgrepSearch(query: RAGQuery, route: SearchRoute): Promise<RAGResult> {
    const startTime = Date.now();

    // Convert RAGQuery to SearchOptions
    const searchOptions: SearchOptions = {
      query: this.optimizeQueryForRipgrep(query),
      fileTypes: this.extractFileTypes(query),
      regex: this.shouldUseRegex(query),
      contextLines: { context: query.contextWindow ?? 3 },
      maxResults: query.maxResults ?? 50,
      timeout: this.config.routing.performanceTimeoutMs,
    };

    try {
      const searchResults = await this.commandSearch.searchInFiles(searchOptions);

      // Convert to RAG format
      const scoredDocuments: ScoredDocument[] = searchResults.map(result => ({
        document: {
          id: result.file,
          content: result.match,
          metadata: {
            filePath: result.file,
            language: this.detectFileLanguage(result.file),
            fileType: this.getFileExtension(result.file),
            lastModified: new Date(),
            size: result.match.length,
            hash: this.generateQuickHash(result.match),
            semanticType: 'code' as const,
          },
        },
        score: result.score / 100, // Normalize to 0-1
        highlightedContent: result.match,
      }));

      const queryTime = Date.now() - startTime;

      return {
        documents: scoredDocuments,
        totalFound: scoredDocuments.length,
        queryTime,
        retrievalMethod: 'ripgrep_exact',
        reranked: false,
        debugInfo: {
          vectorSearchTime: 0,
          rerankTime: 0,
          candidatesConsidered: searchResults.length,
        },
      };
    } catch (error) {
      this.logger.error('Ripgrep search failed:', error);

      // Use comprehensive error handling
      if (this.config.featureFlags.enableFallbackMechanism) {
        try {
          return await this.errorHandler.handleSearchError(error as Error, query, 'ripgrep', {
            attempt: 1,
            maxAttempts: 2,
            startTime,
          });
        } catch (fallbackError) {
          // If error handler fails and RAG available, try RAG
          if (this.ragSystem) {
            this.logger.info('Error handler failed, falling back to RAG search');
            return this.executeRAGSearch(query, route);
          }
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  /**
   * Execute RAG-based search
   */
  private async executeRAGSearch(query: RAGQuery, route: SearchRoute): Promise<RAGResult> {
    if (!this.ragSystem) {
      throw new Error('RAG system not available');
    }

    try {
      return await this.ragSystem.query(query);
    } catch (error) {
      this.logger.error('RAG search failed:', error);

      // Use comprehensive error handling
      if (this.config.featureFlags.enableFallbackMechanism) {
        try {
          return await this.errorHandler.handleSearchError(error as Error, query, 'rag', {
            attempt: 1,
            maxAttempts: 2,
            startTime: Date.now(),
          });
        } catch (fallbackError) {
          // If error handler fails, try ripgrep as last resort
          this.logger.info('Error handler failed, falling back to ripgrep search');
          return this.executeRipgrepSearch(query, route);
        }
      }

      throw error;
    }
  }

  /**
   * Execute hybrid search combining both methods
   */
  private async executeHybridSearch(query: RAGQuery, route: SearchRoute): Promise<RAGResult> {
    const startTime = Date.now();

    try {
      // Execute both searches in parallel
      const [ripgrepResults, ragResults] = await Promise.allSettled([
        this.executeRipgrepSearch(query, route),
        this.ragSystem ? this.executeRAGSearch(query, route) : Promise.reject('No RAG system'),
      ]);

      // Merge and deduplicate results
      const mergedResults = this.mergeSearchResults(
        ripgrepResults.status === 'fulfilled' ? ripgrepResults.value : null,
        ragResults.status === 'fulfilled' ? ragResults.value : null
      );

      const queryTime = Date.now() - startTime;

      return {
        ...mergedResults,
        queryTime,
        retrievalMethod: 'hybrid_ripgrep_rag',
        reranked: true,
      };
    } catch (error) {
      this.logger.error('Hybrid search failed:', error);
      return this.executeFallbackSearch(query, route);
    }
  }

  /**
   * Execute fallback search when other methods fail
   */
  private async executeFallbackSearch(query: RAGQuery, route: SearchRoute): Promise<RAGResult> {
    this.logger.warn('Executing fallback search');

    // Try the most reliable method available
    if (this.ragSystem) {
      try {
        return await this.ragSystem.query({ ...query, queryType: 'semantic' });
      } catch (error) {
        this.logger.error('RAG fallback failed:', error);
      }
    }

    // Last resort: basic ripgrep search
    try {
      return await this.executeRipgrepSearch(query, route);
    } catch (error) {
      this.logger.error('Ripgrep fallback failed:', error);

      // Return empty result rather than throwing
      return {
        documents: [],
        totalFound: 0,
        queryTime: Date.now(),
        retrievalMethod: 'fallback_empty',
        reranked: false,
      };
    }
  }

  /**
   * Merge results from multiple search methods
   */
  private mergeSearchResults(
    ripgrepResult: RAGResult | null,
    ragResult: RAGResult | null
  ): Omit<RAGResult, 'queryTime' | 'retrievalMethod'> {
    const allDocuments: ScoredDocument[] = [];

    // Add ripgrep results with source annotation
    if (ripgrepResult) {
      ripgrepResult.documents.forEach(doc => {
        allDocuments.push({
          ...doc,
          score: doc.score * 0.9, // Slight preference for exact matches
          relevanceExplanation: `Exact match via ripgrep (score: ${doc.score.toFixed(2)})`,
        });
      });
    }

    // Add RAG results with source annotation
    if (ragResult) {
      ragResult.documents.forEach(doc => {
        // Check for duplicates based on file path and content similarity
        const duplicate = allDocuments.find(
          existing =>
            existing.document.metadata.filePath === doc.document.metadata.filePath &&
            this.calculateContentSimilarity(existing.document.content, doc.document.content) > 0.8
        );

        if (!duplicate) {
          allDocuments.push({
            ...doc,
            score: doc.score * 0.8, // Slight penalty for semantic matches
            relevanceExplanation: `Semantic match via RAG (score: ${doc.score.toFixed(2)})`,
          });
        } else {
          // Merge scores for duplicates
          duplicate.score = Math.max(duplicate.score, doc.score * 0.8);
          duplicate.relevanceExplanation += ` + semantic confirmation`;
        }
      });
    }

    // Sort by combined score
    allDocuments.sort((a, b) => b.score - a.score);

    return {
      documents: allDocuments.slice(0, 50), // Limit results
      totalFound: allDocuments.length,
      reranked: true,
    };
  }

  /**
   * Helper methods for query optimization and analysis
   */
  private optimizeQueryForRipgrep(query: RAGQuery): string {
    let optimized = query.query;

    // Convert natural language to patterns when possible
    if (query.query.toLowerCase().includes('function named')) {
      const match = query.query.match(/function named (\w+)/i);
      if (match) {
        optimized = CodePatternGenerator.generateFunctionPattern(match[1]);
      }
    }

    if (query.query.toLowerCase().includes('class called')) {
      const match = query.query.match(/class called (\w+)/i);
      if (match) {
        optimized = CodePatternGenerator.generateClassPattern(match[1]);
      }
    }

    return optimized;
  }

  private extractFileTypes(query: RAGQuery): string[] | undefined {
    if (query.filters) {
      const languageFilter = query.filters.find(f => f.field === 'language');
      if (languageFilter && typeof languageFilter.value === 'string') {
        return this.getLanguageExtensions(languageFilter.value);
      }
    }
    return undefined;
  }

  private shouldUseRegex(query: RAGQuery): boolean {
    // Use regex for code patterns, literal for simple strings
    return (
      query.query.includes('*') ||
      query.query.includes('\\w') ||
      query.query.includes('(') ||
      query.query.includes('[')
    );
  }

  private detectQueryLanguage(query: string): string | undefined {
    const languageKeywords = {
      typescript: ['interface', 'type', 'namespace', 'declare'],
      javascript: ['var', 'let', 'const', 'require'],
      python: ['def', 'class', 'import', 'from'],
      java: ['public', 'class', 'interface', 'package'],
      rust: ['fn', 'struct', 'impl', 'use', 'mod'],
      go: ['func', 'package', 'import', 'type'],
    };

    for (const [language, keywords] of Object.entries(languageKeywords)) {
      if (keywords.some(keyword => query.includes(keyword))) {
        return language;
      }
    }

    return undefined;
  }

  private detectFileLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      js: 'javascript',
      py: 'python',
      java: 'java',
      rs: 'rust',
      go: 'go',
      cpp: 'cpp',
      c: 'c',
    };
    return languageMap[ext ?? ''] ?? 'unknown';
  }

  private getFileExtension(filePath: string): string {
    return filePath.split('.').pop() ?? '';
  }

  private getLanguageExtensions(language: string): string[] {
    const extensions: Record<string, string[]> = {
      typescript: ['ts', 'tsx'],
      javascript: ['js', 'jsx', 'mjs'],
      python: ['py'],
      java: ['java'],
      rust: ['rs'],
      go: ['go'],
    };
    return extensions[language] ?? [];
  }

  private generateQuickHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private calculateContentSimilarity(content1: string, content2: string): number {
    // Simple Jaccard similarity for content comparison
    const set1 = new Set(content1.toLowerCase().split(/\W+/));
    const set2 = new Set(content2.toLowerCase().split(/\W+/));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  private async checkRipgrepAvailability(): Promise<boolean> {
    try {
      await this.commandSearch.searchInFiles({
        query: 'test',
        maxResults: 1,
        timeout: 1000,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Advanced caching helper methods
   */
  private generateAdvancedCacheKey(query: RAGQuery): string {
    return JSON.stringify({
      query: query.query,
      type: query.queryType,
      filters: query.filters,
      maxResults: query.maxResults,
      contextWindow: query.contextWindow,
    });
  }

  private extractFilePathsFromQuery(query: RAGQuery): string[] {
    const filePaths: string[] = [];

    // Extract file paths from filters if present
    if (query.filters) {
      for (const filter of query.filters) {
        if (filter.field === 'filePath' && typeof filter.value === 'string') {
          filePaths.push(filter.value);
        } else if (filter.field === 'filePath' && Array.isArray(filter.value)) {
          filePaths.push(...filter.value);
        }
      }
    }

    return filePaths;
  }

  /**
   * Cache management methods
   */
  async clearCache(): Promise<void> {
    await this.advancedCache.clearCache();
    this.logger.info('🧠 Advanced cache cleared');
  }

  async invalidateCacheByPattern(pattern: {
    filePattern?: RegExp;
    queryPattern?: RegExp;
    searchMethod?: string;
  }): Promise<number> {
    const invalidatedCount = await this.advancedCache.invalidateByPattern(pattern);
    this.logger.info(`🧠 Invalidated ${invalidatedCount} cache entries`);
    return invalidatedCount;
  }

  getCacheStats() {
    return this.advancedCache.getStats();
  }

  /**
   * Metrics and monitoring methods
   */
  private logRoutingDecision(route: SearchRoute, query: RAGQuery): void {
    if (this.config.monitoring.logRoutingDecisions) {
      this.logger.info(
        `🎯 Routing decision: ${route.method} (confidence: ${route.confidence.toFixed(2)}, reason: ${route.reasoning})`
      );
    }

    this.metrics.routingDecisions.set(
      route.method,
      (this.metrics.routingDecisions.get(route.method) ?? 0) + 1
    );
  }

  private updateMetrics(method: string, duration: number, result: RAGResult): void {
    if (!this.config.monitoring.enableMetrics) return;

    // Update performance metrics
    const currentAvg =
      this.metrics.performanceComparisons[
        `${method}AvgTime` as keyof typeof this.metrics.performanceComparisons
      ] ?? 0;
    const newAvg = currentAvg * 0.9 + duration * 0.1; // Exponential moving average

    if (method === 'ripgrep') {
      this.metrics.performanceComparisons.ripgrepAvgTime = newAvg;
    } else if (method === 'rag') {
      this.metrics.performanceComparisons.ragAvgTime = newAvg;
    } else if (method === 'hybrid') {
      this.metrics.performanceComparisons.hybridAvgTime = newAvg;
    }

    // Update memory usage (simplified)
    const memUsage = process.memoryUsage();
    if (method === 'ripgrep') {
      this.metrics.memoryUsage.ripgrepMemory = memUsage.heapUsed / 1024 / 1024; // MB
    } else if (method === 'rag') {
      this.metrics.memoryUsage.ragMemory = memUsage.heapUsed / 1024 / 1024; // MB
    }
  }

  /**
   * Public API methods
   */
  getMetrics(): HybridSearchMetrics {
    return { ...this.metrics };
  }

  getConfig(): HybridSearchConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<HybridSearchConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('🔧 Hybrid search config updated');
  }

  /**
   * Setup comprehensive error handling integration
   */
  private setupErrorHandling(): void {
    // Forward error handler events
    this.errorHandler.on('search-error', error => {
      this.emit('search:error', error);
      this.updateErrorMetrics(error);
    });

    this.errorHandler.on('fallback-success', event => {
      this.emit('search:fallback-success', event);
      this.logger.info(`Fallback strategy '${event.fallbackStrategy}' succeeded`);
    });

    this.errorHandler.on('fallback-exhausted', error => {
      this.emit('search:fallback-exhausted', error);
      this.logger.error('All fallback strategies exhausted');
    });

    this.errorHandler.on('search-retry', event => {
      this.emit('search:retry', event);
      this.logger.info(`Retrying search (attempt ${event.attempt})`);
    });
  }

  /**
   * Update error metrics for monitoring
   */
  private updateErrorMetrics(error: unknown): void {
    // This integrates with existing metrics system
    const errorType = (error && typeof error === 'object' && 'category' in error 
      ? (error as { category: string }).category 
      : null) ?? 'unknown';
    const currentCount = this.metrics.routingDecisions.get(`error_${errorType}`) ?? 0;
    this.metrics.routingDecisions.set(`error_${errorType}`, currentCount + 1);
  }

  /**
   * Get comprehensive error statistics
   */
  getErrorStatistics(): unknown {
    return this.errorHandler.getErrorStatistics();
  }

  /**
   * Clear error history for monitoring
   */
  clearErrorHistory(): void {
    this.errorHandler.clearHistory();
  }

  async shutdown(): Promise<void> {
    await this.advancedCache.shutdown();
    this.logger.info('🔄 Hybrid search coordinator shut down');
  }
}
