/**
 * Search Query Sanitizer Module
 * 
 * Handles comprehensive input sanitization and validation for search queries
 * to prevent command injection, path traversal, and other security issues.
 */

import { logger } from '../../infrastructure/logging/logger.js';

export interface SanitizedQuery {
  sanitized: string;
  original: string;
  isValid: boolean;
  warnings: string[];
  metadata: {
    hasRegex: boolean;
    hasWildcards: boolean;
    complexity: 'low' | 'medium' | 'high';
    estimatedRisk: 'safe' | 'moderate' | 'high';
  };
}

export interface SanitizationOptions {
  maxLength?: number;
  allowRegex?: boolean;
  allowWildcards?: boolean;
  allowSpecialChars?: boolean;
  strictMode?: boolean;
}

export class SearchQuerySanitizer {
  private static readonly DEFAULT_OPTIONS: SanitizationOptions = {
    maxLength: 1000,
    allowRegex: true,
    allowWildcards: true,
    allowSpecialChars: false,
    strictMode: false,
  };

  private static readonly DANGEROUS_PATTERNS = [
    /[;&|`$(){}[\]]/g, // Shell metacharacters
    /\.\./g, // Path traversal
    /[\r\n]/g, // Newlines
    /\\\\/g, // Excessive backslashes
  ];

  private static readonly REGEX_PATTERNS = [
    /[()[\]{}*+?^$|\\]/, // Common regex metacharacters
    /\(\?:/, // Non-capturing groups
    /\(\?=/, // Lookaheads
    /\(\?!/, // Negative lookaheads
  ];

  private static readonly WILDCARD_PATTERNS = [
    /\*/, // Asterisk wildcard
    /\?/, // Question mark wildcard
  ];

  /**
   * Sanitize a search query with comprehensive validation
   */
  public static sanitize(
    query: string, 
    options: SanitizationOptions = {}
  ): SanitizedQuery {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const warnings: string[] = [];
    let sanitized = query;

    // Basic validation
    if (!query || typeof query !== 'string') {
      return {
        sanitized: '',
        original: query,
        isValid: false,
        warnings: ['Invalid query type - expected string'],
        metadata: {
          hasRegex: false,
          hasWildcards: false,
          complexity: 'low',
          estimatedRisk: 'safe',
        },
      };
    }

    // Length check
    if (typeof opts.maxLength === 'number' && query.length > opts.maxLength) {
      sanitized = query.slice(0, opts.maxLength);
      warnings.push(`Query truncated to ${opts.maxLength} characters`);
    }

    // Detect regex patterns
    const hasRegex = (this.REGEX_PATTERNS as ReadonlyArray<RegExp>).some((pattern: Readonly<RegExp>) => pattern.test(sanitized));
    if (hasRegex && !opts.allowRegex) {
      sanitized = sanitized.replace(/[[\](){}*+?^$|\\]/g, '\\$&');
      warnings.push('Regex patterns escaped due to security policy');
    }

    // Detect wildcards
    const hasWildcards = (this.WILDCARD_PATTERNS as ReadonlyArray<RegExp>).some((pattern: Readonly<RegExp>) => pattern.test(sanitized));
    if (hasWildcards && !opts.allowWildcards) {
      sanitized = sanitized.replace(/[*?]/g, '\\$&');
      warnings.push('Wildcards escaped due to security policy');
    }

    // Remove dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, '');
        warnings.push('Removed potentially dangerous characters');
      }
    }

    // Special character handling
    if (!opts.allowSpecialChars) {
      const beforeLength = sanitized.length;
      sanitized = sanitized.replace(/[^\w\s\-_.]/g, '');
      if (sanitized.length !== beforeLength) {
        warnings.push('Special characters removed');
      }
    }

    // Strict mode additional checks
    if (opts.strictMode) {
      // Remove any Unicode control characters
      sanitized = sanitized.replace(/[\\x00-\\x1F\\x7F-\\x9F]/g, '');
      // Limit to printable ASCII if strict
      sanitized = sanitized.replace(/[^\x20-\x7E]/g, '');
      if (sanitized !== query) {
        warnings.push('Non-printable characters removed in strict mode');
      }
    }

    // Final cleanup
    sanitized = sanitized.trim();

    // Complexity analysis
    const complexity = this.analyzeComplexity(sanitized);
    const estimatedRisk = this.estimateRisk(sanitized, hasRegex, warnings);

    const result: SanitizedQuery = {
      sanitized,
      original: query,
      isValid: sanitized.length > 0,
      warnings,
      metadata: {
        hasRegex,
        hasWildcards,
        complexity,
        estimatedRisk,
      },
    };

    if (warnings.length > 0) {
      logger.debug('Query sanitization warnings:', { query: query.slice(0, 100), warnings });
    }

    return result;
  }

  /**
   * Validate a query for specific search contexts
   */
  public static validateForContext(
    query: string, 
    context: 'code' | 'documentation' | 'logs' | 'general'
  ): SanitizedQuery {
    const contextOptions: Record<string, SanitizationOptions> = {
      code: {
        maxLength: 2000,
        allowRegex: true,
        allowWildcards: true,
        allowSpecialChars: true, // Code searches need special chars
        strictMode: false,
      },
      documentation: {
        maxLength: 500,
        allowRegex: false,
        allowWildcards: true,
        allowSpecialChars: false,
        strictMode: false,
      },
      logs: {
        maxLength: 1000,
        allowRegex: true,
        allowWildcards: true,
        allowSpecialChars: true,
        strictMode: false,
      },
      general: {
        maxLength: 200,
        allowRegex: false,
        allowWildcards: false,
        allowSpecialChars: false,
        strictMode: true,
      },
    };

    return this.sanitize(query, contextOptions[context]);
  }

  /**
   * Check if a query is potentially dangerous
   */
  public static isDangerous(query: string): boolean {
    if (!query || typeof query !== 'string') return false;
    
    // Check for command injection patterns
    const dangerousCommands = [
      /rm\s+-rf/i,
      /sudo\s+/i,
      /curl\s+/i,
      /wget\s+/i,
      /bash\s+/i,
      /sh\s+/i,
      /exec\s*\(/i,
      /system\s*\(/i,
      /`.*`/, // Backtick execution
      /\$\([^)]*\)/, // Command substitution
    ];

    return dangerousCommands.some((pattern: Readonly<RegExp>) => pattern.test(query));
  }

  /**
   * Analyze query complexity
   */
  private static analyzeComplexity(query: string): 'low' | 'medium' | 'high' {
    if (query.length < 10) return 'low';
    
    let complexityScore = 0;
    
    // Length factor
    complexityScore += Math.min(query.length / 50, 2);
    
    // Regex complexity
    if (/[[\](){}*+?^$|\\]/.test(query)) complexityScore += 2;
    if (query.includes('(?:')) complexityScore += 3; // Non-capturing groups
    if (query.includes('(?=') || query.includes('(?!')) complexityScore += 4; // Lookaheads
    
    // Special patterns
    if (/\\\w/.test(query)) complexityScore += 1; // Escaped characters
    if (query.split('|').length > 2) complexityScore += 2; // Multiple alternatives
    
    if (complexityScore <= 2) return 'low';
    if (complexityScore <= 5) return 'medium';
    return 'high';
  }

  /**
   * Estimate security risk level
   */
  private static estimateRisk(
    query: string, 
    hasRegex: boolean, 
    warnings: string[]
  ): 'safe' | 'moderate' | 'high' {
    if (this.isDangerous(query)) return 'high';
    if (warnings.length > 3) return 'high';
    if (hasRegex && query.length > 500) return 'moderate';
    if (warnings.length > 0) return 'moderate';
    return 'safe';
  }

  /**
   * Generate search-optimized query variations
   */
  public static generateQueryVariations(sanitizedQuery: SanitizedQuery): string[] {
    const variations: string[] = [sanitizedQuery.sanitized];
    const base = sanitizedQuery.sanitized.toLowerCase();

    // Add case variations
    if (base !== sanitizedQuery.sanitized) {
      variations.push(base);
      variations.push(sanitizedQuery.sanitized.toUpperCase());
    }

    // Add word boundary variations for code searches
    if (sanitizedQuery.metadata.hasRegex) {
      variations.push(`\\b${base}\\b`);
    }

    // Add partial match variations
    const words = base.split(/\s+/);
    if (words.length > 1) {
      variations.push(...words.filter(word => word.length > 2));
    }

    return [...new Set(variations)]; // Remove duplicates
  }
}