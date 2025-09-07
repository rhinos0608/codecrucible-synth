/**
 * Search Strategy Manager Module
 * 
 * Manages different search strategies and approaches including regex,
 * literal, fuzzy matching, semantic search, and hybrid approaches.
 */

import type { RAGQuery } from './types.js';
import type { RipgrepExecutionOptions } from './ripgrep-executor.js';

export type SearchStrategy = 
  | 'literal' // Exact string matching
  | 'regex' // Regular expression search
  | 'fuzzy' // Fuzzy/approximate matching
  | 'semantic' // AI-powered semantic search
  | 'hybrid' // Combination of approaches
  | 'contextual' // Context-aware search
  | 'structural'; // AST-based code structure search

export interface SearchStrategyOptions {
  strategy: SearchStrategy;
  fuzzyTolerance?: number; // 0-1, higher = more fuzzy
  semanticThreshold?: number; // 0-1, semantic similarity threshold  
  includeContext?: boolean; // Include surrounding context
  caseInsensitive?: boolean;
  wholeWords?: boolean;
  multiline?: boolean;
  maxResults?: number;
  rankResults?: boolean; // Rank by relevance
  expandQuery?: boolean; // Auto-expand query terms
  useWordBoundaries?: boolean;
  includeSynonyms?: boolean; // Include synonyms in search
  structuralDepth?: number; // For structural search depth
}

export interface SearchStrategyResult {
  strategy: SearchStrategy;
  confidence: number;
  estimatedAccuracy: number;
  recommendedOptions: RipgrepExecutionOptions;
  queryModifications: string[];
  fallbackStrategies: SearchStrategy[];
  metadata: {
    complexity: 'low' | 'medium' | 'high';
    performance: 'fast' | 'medium' | 'slow';
    accuracy: 'low' | 'medium' | 'high';
    resourceUsage: 'light' | 'medium' | 'heavy';
  };
}

export class SearchStrategyManager {
  private static readonly STRATEGY_PROFILES: Record<SearchStrategy, SearchStrategyResult['metadata']> = {
    literal: { complexity: 'low', performance: 'fast', accuracy: 'high', resourceUsage: 'light' },
    regex: { complexity: 'medium', performance: 'medium', accuracy: 'high', resourceUsage: 'medium' },
    fuzzy: { complexity: 'high', performance: 'slow', accuracy: 'medium', resourceUsage: 'heavy' },
    semantic: { complexity: 'high', performance: 'slow', accuracy: 'high', resourceUsage: 'heavy' },
    hybrid: { complexity: 'high', performance: 'medium', accuracy: 'high', resourceUsage: 'heavy' },
    contextual: { complexity: 'medium', performance: 'medium', accuracy: 'high', resourceUsage: 'medium' },
    structural: { complexity: 'high', performance: 'medium', accuracy: 'high', resourceUsage: 'medium' },
  };

  /**
   * Determine the best search strategy based on query analysis
   */
  public static determineStrategy(
    query: RAGQuery,
    options: Partial<SearchStrategyOptions> = {}
  ): SearchStrategyResult {
    const analysis = this.analyzeQuery(query);
    
    // Strategy selection logic based on query characteristics
    let recommendedStrategy: SearchStrategy;
    let confidence: number;
    
    if (analysis.hasRegexPatterns && options.strategy !== 'literal') {
      recommendedStrategy = 'regex';
      confidence = 0.9;
    } else if (analysis.isCodeQuery && !analysis.hasRegexPatterns) {
      recommendedStrategy = 'structural';
      confidence = 0.8;
    } else if (analysis.isNaturalLanguage) {
      recommendedStrategy = 'semantic';
      confidence = 0.85;
    } else if (analysis.isFuzzyQuery || query.query.includes('~')) {
      recommendedStrategy = 'fuzzy';
      confidence = 0.75;
    } else if (analysis.needsContext) {
      recommendedStrategy = 'contextual';
      confidence = 0.7;
    } else {
      recommendedStrategy = 'literal';
      confidence = 0.95;
    }

    // Override with explicit strategy if provided
    if (options.strategy) {
      recommendedStrategy = options.strategy;
      confidence *= 0.8; // Slight reduction for forced strategy
    }

    return {
      strategy: recommendedStrategy,
      confidence,
      estimatedAccuracy: this.estimateAccuracy(recommendedStrategy, analysis),
      recommendedOptions: this.buildRipgrepOptions(recommendedStrategy, query, options),
      queryModifications: this.getQueryModifications(recommendedStrategy, query, options),
      fallbackStrategies: this.getFallbackStrategies(recommendedStrategy),
      metadata: this.STRATEGY_PROFILES[recommendedStrategy],
    };
  }

  /**
   * Build multiple search strategies for a hybrid approach
   */
  public static buildHybridStrategy(
    query: RAGQuery,
    options: Partial<SearchStrategyOptions> = {}
  ): SearchStrategyResult[] {
    const primary = this.determineStrategy(query, options);
    const fallbacks = primary.fallbackStrategies.map(strategy => 
      this.determineStrategy(query, { ...options, strategy })
    );

    return [primary, ...fallbacks.slice(0, 2)]; // Primary + 2 fallbacks
  }

  /**
   * Convert search strategy to ripgrep execution options
   */
  public static toRipgrepOptions(
    strategy: SearchStrategy,
    query: RAGQuery,
    options: Partial<SearchStrategyOptions> = {}
  ): RipgrepExecutionOptions {
    return this.buildRipgrepOptions(strategy, query, options);
  }

  /**
   * Analyze query characteristics
   */
  private static analyzeQuery(query: Readonly<RAGQuery>): {
    hasRegexPatterns: boolean;
    isCodeQuery: boolean;
    isNaturalLanguage: boolean;
    isFuzzyQuery: boolean;
    needsContext: boolean;
    complexity: 'low' | 'medium' | 'high';
    estimatedMatches: 'few' | 'many' | 'extensive';
  } {
    const q = query.query.toLowerCase();
    
    const hasRegexPatterns = /[()[\]{}*+?^$|\\]/.test(query.query);
    const isCodeQuery = /\b(function|class|const|let|var|import|export|if|for|while)\b/.test(q) ||
                       query.query.includes('()') || query.query.includes('{}') || query.query.includes('[]');
    const isNaturalLanguage = /\b(what|how|where|when|why|which|who|find|search|show|list)\b/.test(q) ||
                              query.query.split(' ').length > 5;
    const isFuzzyQuery = query.query.includes('~') || query.query.includes('?');
    const needsContext = /\b(around|near|before|after|context|surrounding)\b/.test(q) ||
                        query.includeContext === true;

    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (hasRegexPatterns || isCodeQuery) complexity = 'medium';
    if (isNaturalLanguage || needsContext) complexity = 'high';

    let estimatedMatches: 'few' | 'many' | 'extensive' = 'few';
    if (query.query.length < 5 || /\b(the|and|or|a|an|in|on|at)\b/.test(q)) {
      estimatedMatches = 'extensive';
    } else if (query.query.length < 15) {
      estimatedMatches = 'many';
    }

    return {
      hasRegexPatterns,
      isCodeQuery,
      isNaturalLanguage,
      isFuzzyQuery,
      needsContext,
      complexity,
      estimatedMatches,
    };
  }

  /**
   * Build ripgrep options for a specific strategy
   */
  private static buildRipgrepOptions(
    strategy: SearchStrategy,
    query: RAGQuery,
    options: Partial<SearchStrategyOptions>
  ): RipgrepExecutionOptions {
    const baseOptions: RipgrepExecutionOptions = {
      workspace: '',
      useJson: true,
      caseSensitive: !options.caseInsensitive,
      wholeWords: options.wholeWords,
      contextLines: options.includeContext ? 3 : 0,
      multiline: options.multiline,
    };

    switch (strategy) {
      case 'literal':
        return {
          ...baseOptions,
          caseSensitive: false, // More forgiving for literal searches
          wholeWords: false,
        };

      case 'regex':
        return {
          ...baseOptions,
          caseSensitive: true, // Respect case in regex
          multiline: true,
        };

      case 'fuzzy':
        return {
          ...baseOptions,
          caseSensitive: false,
          wholeWords: false,
          // Note: ripgrep doesn't have native fuzzy support
          // This would need post-processing
        };

      case 'semantic':
        return {
          ...baseOptions,
          caseSensitive: false,
          contextLines: 5, // More context for semantic analysis
          includeTypes: ['txt', 'md', 'rst', 'doc'], // Text-heavy files
        };

      case 'structural':
        return {
          ...baseOptions,
          includeTypes: ['js', 'ts', 'py', 'java', 'cpp', 'c', 'rs', 'go', 'rb'],
          caseSensitive: true,
          wholeWords: true,
        };

      case 'contextual':
        return {
          ...baseOptions,
          contextLines: 10,
          caseSensitive: false,
        };

      case 'hybrid':
        return {
          ...baseOptions,
          contextLines: 5,
          caseSensitive: false,
        };

      default:
        return baseOptions;
    }
  }

  /**
   * Get query modifications for a strategy
   */
  private static getQueryModifications(
    strategy: SearchStrategy,
    query: RAGQuery,
    options: Partial<SearchStrategyOptions>
  ): string[] {
    const modifications: string[] = [];
    const originalQuery = query.query;

    switch (strategy) {
      case 'regex':
        if (!originalQuery.includes('\\b') && options.useWordBoundaries) {
          modifications.push(`\\b${originalQuery}\\b`);
        }
        break;

      case 'fuzzy':
        // Generate fuzzy variations
        modifications.push(originalQuery);
        if (originalQuery.length > 3) {
          modifications.push(`${originalQuery.slice(0, -1)}.*`); // Prefix match
          modifications.push(`.*${originalQuery.slice(1)}`); // Suffix match
        }
        break;

      case 'semantic':
        modifications.push(originalQuery);
        if (options.includeSynonyms) {
          // Placeholder for synonym expansion
          modifications.push(`(${originalQuery}|similar_term|related_term)`);
        }
        break;

      case 'structural':
        // Add code-specific patterns
        if (!originalQuery.includes('(') && !originalQuery.includes(')')) {
          modifications.push(`${originalQuery}\\s*\\(`); // Function calls
          modifications.push(`${originalQuery}\\s*=`); // Variable assignments
        }
        break;

      default:
        modifications.push(originalQuery);
    }

    return modifications;
  }

  /**
   * Get fallback strategies for a primary strategy
   */
  private static getFallbackStrategies(primary: SearchStrategy): SearchStrategy[] {
    const fallbacks: Record<SearchStrategy, SearchStrategy[]> = {
      semantic: ['contextual', 'fuzzy', 'literal'],
      structural: ['regex', 'literal', 'contextual'],
      fuzzy: ['literal', 'regex', 'contextual'],
      regex: ['literal', 'fuzzy'],
      contextual: ['literal', 'regex'],
      hybrid: ['literal', 'regex', 'contextual'],
      literal: ['regex', 'fuzzy'],
    };

    return fallbacks[primary] || ['literal'];
  }

  /**
   * Estimate accuracy for a strategy given query analysis
   */
  private static estimateAccuracy(
    strategy: SearchStrategy,
    analysis: ReturnType<typeof SearchStrategyManager.analyzeQuery>
  ): number {
    let baseAccuracy = 0.8;

    // Adjust based on query characteristics
    if (strategy === 'regex' && analysis.hasRegexPatterns) baseAccuracy = 0.95;
    if (strategy === 'structural' && analysis.isCodeQuery) baseAccuracy = 0.9;
    if (strategy === 'semantic' && analysis.isNaturalLanguage) baseAccuracy = 0.85;
    if (strategy === 'literal' && !analysis.hasRegexPatterns && !analysis.isNaturalLanguage) {
      baseAccuracy = 0.95;
    }

    // Penalize mismatched strategies
    if (strategy === 'literal' && analysis.hasRegexPatterns) baseAccuracy = 0.4;
    if (strategy === 'regex' && !analysis.hasRegexPatterns) baseAccuracy = 0.6;

    return Math.min(0.99, Math.max(0.1, baseAccuracy));
  }
}