/**
 * Search Result Parser Module
 * 
 * Handles parsing of search results from various formats (JSON, plain text, XML)
 * with support for different search tools and output structures.
 */

import { logger } from '../../infrastructure/logging/logger.js';
import type { Document } from './types.js';

export interface ParsedSearchResult {
  documents: Document[];
  metadata: SearchResultMetadata;
  statistics: SearchStatistics;
  warnings: string[];
}

export interface SearchResultMetadata {
  parser: string;
  format: 'json' | 'plain' | 'xml' | 'structured';
  tool: 'ripgrep' | 'grep' | 'ag' | 'git-grep' | 'findstr' | 'custom';
  parseTime: number;
  confidence: number;
  totalLines: number;
  validEntries: number;
  skippedEntries: number;
}

export interface SearchStatistics {
  totalMatches: number;
  uniqueFiles: number;
  averageMatchesPerFile: number;
  longestMatch: number;
  shortestMatch: number;
  fileTypes: Record<string, number>;
  directories: Record<string, number>;
}

export interface RipgrepJsonEntry {
  type: 'match' | 'context' | 'begin' | 'end' | 'summary';
  data?: {
    path?: { text: string };
    lines?: { text: string };
    line_number?: number;
    absolute_offset?: number;
    submatches?: Array<{
      match: { text: string };
      start: number;
      end: number;
    }>;
  };
}

export interface PlainTextMatch {
  filePath: string;
  lineNumber: number;
  content: string;
  context?: {
    before: string[];
    after: string[];
  };
}

export interface ParserOptions {
  maxFilePathLength?: number;
  maxContentLength?: number;
  includeContext?: boolean;
  deduplicateResults?: boolean;
  normalizeWhitespace?: boolean;
  extractMetadata?: boolean;
  validatePaths?: boolean;
}

export class SearchResultParser {
  private static readonly DEFAULT_OPTIONS: ParserOptions = {
    maxFilePathLength: 1000,
    maxContentLength: 10000,
    includeContext: true,
    deduplicateResults: true,
    normalizeWhitespace: true,
    extractMetadata: true,
    validatePaths: true,
  };

  /**
   * Parse search results with auto-detection of format
   */
  public static parse(
    output: string,
    tool: SearchResultMetadata['tool'] = 'ripgrep',
    options: ParserOptions = {}
  ): ParsedSearchResult {
    const startTime = performance.now();
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const warnings: string[] = [];

    try {
      // Auto-detect format
      const format = this.detectFormat(output);
      
      let result: ParsedSearchResult;
      
      switch (format) {
        case 'json':
          result = this.parseJsonFormat(output, tool, opts);
          break;
        case 'plain':
          result = this.parsePlainTextFormat(output, tool, opts);
          break;
        case 'structured':
          result = this.parseStructuredFormat(output, tool, opts);
          break;
        default:
          logger.warn('Unknown search result format, falling back to plain text');
          result = this.parsePlainTextFormat(output, tool, opts);
      }

      // Post-processing
      if (opts.deduplicateResults) {
        result.documents = this.deduplicateDocuments(result.documents);
      }

      if (opts.normalizeWhitespace) {
        result.documents = this.normalizeWhitespace(result.documents);
      }

      // Update metadata
      result.metadata.parseTime = performance.now() - startTime;
      result.metadata.format = format === 'unknown' ? 'plain' : format;
      result.warnings.push(...warnings);

      // Calculate final statistics
      result.statistics = this.calculateStatistics(result.documents);

      return result;
    } catch (error) {
      logger.error('Search result parsing failed', { error, outputLength: output.length });
      
      // Return empty result with error info
      return {
        documents: [],
        metadata: {
          parser: 'SearchResultParser',
          format: 'plain',
          tool,
          parseTime: performance.now() - startTime,
          confidence: 0,
          totalLines: output.split('\n').length,
          validEntries: 0,
          skippedEntries: 0,
        },
        statistics: this.getEmptyStatistics(),
        warnings: [`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  /**
   * Parse ripgrep JSON format specifically
   */
  public static parseRipgrepJson(output: string, options: ParserOptions = {}): ParsedSearchResult {
    return this.parseJsonFormat(output, 'ripgrep', options);
  }

  /**
   * Parse plain text grep-like format
   */
  public static parsePlainTextGrep(output: string, options: ParserOptions = {}): ParsedSearchResult {
    return this.parsePlainTextFormat(output, 'grep', options);
  }

  /**
     * Detect the format of search output
     */
    private static detectFormat(output: string): 'json' | 'plain' | 'structured' | 'unknown' {
      if (!output?.trim()) return 'unknown';
  
      const [firstLine] = output.trim().split('\n');
      
      // Check for JSON format
      if (firstLine.startsWith('{') && firstLine.includes('"type"')) {
        try {
          JSON.parse(firstLine);
          return 'json';
        } catch {
          // Not valid JSON
        }
      }
  
      // Check for structured format (XML-like)
      if (firstLine.includes('<') && firstLine.includes('>')) {
        return 'structured';
      }
  
      // Check for typical grep format (filename:line:content)
      if (firstLine.includes(':') && firstLine.split(':').length >= 3) {
        return 'plain';
      }
  
      return 'plain'; // Default fallback
    }

  /**
   * Parse JSON format (primarily ripgrep --json)
   */
  private static parseJsonFormat(
    output: string,
    tool: SearchResultMetadata['tool'],
    options: ParserOptions
  ): ParsedSearchResult {
    const documents: Document[] = [];
    const warnings: string[] = [];
    const lines = output.trim().split('\n');
    let validEntries = 0;
    let skippedEntries = 0;

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line) as unknown as RipgrepJsonEntry;
        
        if (entry.type === 'match' && entry.data) {
          const { path, lines: lineData, line_number } = entry.data;
          
          if (path?.text && lineData?.text) {
            const filePath = this.validateAndTruncatePath(path.text, options);
            const content = this.validateAndTruncateContent(lineData.text, options);
            
            if (filePath && content) {
              documents.push({
                filePath,
                content: `Line ${line_number || '?'}: ${content}`,
                metadata: {
                  lineNumber: line_number,
                  absoluteOffset: entry.data.absolute_offset,
                  submatches: entry.data.submatches?.map(sm => ({
                    text: sm.match.text,
                    start: sm.start,
                    end: sm.end,
                  })),
                },
              });
              validEntries++;
            } else {
              skippedEntries++;
              if (!filePath) warnings.push('Invalid file path skipped');
              if (!content) warnings.push('Invalid content skipped');
            }
          }
        }
      } catch (parseError) {
        skippedEntries++;
        logger.debug('Skipped malformed JSON line', { line: line.slice(0, 100) });
      }
    }

    return {
      documents,
      metadata: {
        parser: 'SearchResultParser',
        format: 'json',
        tool,
        parseTime: 0, // Will be set by caller
        confidence: validEntries / (validEntries + skippedEntries) || 0,
        totalLines: lines.length,
        validEntries,
        skippedEntries,
      },
      statistics: this.getEmptyStatistics(), // Will be calculated by caller
      warnings,
    };
  }

  /**
   * Parse plain text format (grep-like output)
   */
  private static parsePlainTextFormat(
    output: string,
    tool: SearchResultMetadata['tool'],
    options: ParserOptions
  ): ParsedSearchResult {
    const documents: Document[] = [];
    const warnings: string[] = [];
    const lines = output.trim().split('\n');
    let validEntries = 0;
    let skippedEntries = 0;

    for (const line of lines) {
      if (!line.trim()) continue;

      const match = this.parsePlainTextLine(line);
      if (match) {
        const filePath = this.validateAndTruncatePath(match.filePath, options);
        const content = this.validateAndTruncateContent(match.content, options);
        
        if (filePath && content) {
          documents.push({
            filePath,
            content: `Line ${match.lineNumber}: ${content}`,
            metadata: {
              lineNumber: match.lineNumber,
              context: match.context,
            },
          });
          validEntries++;
        } else {
          skippedEntries++;
        }
      } else {
        skippedEntries++;
        logger.debug('Could not parse plain text line', { line: line.slice(0, 100) });
      }
    }

    return {
      documents,
      metadata: {
        parser: 'SearchResultParser',
        format: 'plain',
        tool,
        parseTime: 0,
        confidence: validEntries / (validEntries + skippedEntries) || 0,
        totalLines: lines.length,
        validEntries,
        skippedEntries,
      },
      statistics: this.getEmptyStatistics(),
      warnings,
    };
  }

  /**
   * Parse structured format (XML-like or other structured formats)
   */
  private static parseStructuredFormat(
    output: string,
    tool: SearchResultMetadata['tool'],
    options: ParserOptions
  ): ParsedSearchResult {
    // Placeholder for future structured format support
    logger.warn('Structured format parsing not yet implemented, falling back to plain text');
    return this.parsePlainTextFormat(output, tool, options);
  }

  /**
   * Parse a single plain text line into a match
   */
  private static parsePlainTextLine(line: string): PlainTextMatch | null {
    // Try different common formats
    
    // Format: filename:line:content
    let match = line.match(/^([^:]+):(\d+):(.+)$/);
    if (match) {
      return {
        filePath: match[1],
        lineNumber: parseInt(match[2], 10),
        content: match[3],
      };
    }

    // Format: filename:line:column:content
    match = line.match(/^([^:]+):(\d+):(\d+):(.+)$/);
    if (match) {
      return {
        filePath: match[1],
        lineNumber: parseInt(match[2], 10),
        content: match[4],
      };
    }

    // Format: filename(line): content
    match = line.match(/^([^(]+)\((\d+)\):\s*(.+)$/);
    if (match) {
      return {
        filePath: match[1],
        lineNumber: parseInt(match[2], 10),
        content: match[3],
      };
    }

    return null;
  }

  /**
   * Validate and truncate file paths
   */
  private static validateAndTruncatePath(path: string, options: ParserOptions): string | null {
    if (!path || typeof path !== 'string') return null;
    
    if (options.validatePaths) {
      // Basic path validation
      if (path.includes('\0') || path.includes('\n') || path.includes('\r')) {
        return null;
      }
    }

      const maxLength = typeof options.maxFilePathLength === 'number' ? options.maxFilePathLength : 1000;
      return path.length > maxLength
        ? path.slice(0, maxLength)
        : path;
    }
  
  /**
   * Validate and truncate content
   */
  private static validateAndTruncateContent(content: string, options: Readonly<ParserOptions>): string | null {
    if (!content || typeof content !== 'string') return null;
  
    const maxLength = typeof options.maxContentLength === 'number' ? options.maxContentLength : 10000;
    return content.length > maxLength
      ? `${content.slice(0, maxLength)}...`
      : content;
  }

  /**
   * Remove duplicate documents
   */
  private static deduplicateDocuments(documents: Document[]): Document[] {
    const seen = new Set<string>();
    return documents.filter(doc => {
      const key = `${doc.filePath}:${doc.content}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Normalize whitespace in document content
   */
  private static normalizeWhitespace(documents: Document[]): Document[] {
    return documents.map(doc => ({
      ...doc,
      content: doc.content.replace(/\s+/g, ' ').trim(),
    }));
  }

  /**
   * Calculate comprehensive statistics
   */
  private static calculateStatistics(documents: Document[]): SearchStatistics {
    if (documents.length === 0) return this.getEmptyStatistics();

    const uniqueFiles = new Set(documents.map(doc => doc.filePath));
    const fileTypes: Record<string, number> = {};
    const directories: Record<string, number> = {};
    
    let longestMatch = 0;
    let shortestMatch = Infinity;

    for (const doc of documents) {
      // File extension
      const ext = doc.filePath.split('.').pop()?.toLowerCase() || 'unknown';
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;

      // Directory
      const dir = doc.filePath.split('/').slice(0, -1).join('/') || '/';
      directories[dir] = (directories[dir] || 0) + 1;

      // Content length
      const contentLength = doc.content.length;
      longestMatch = Math.max(longestMatch, contentLength);
      shortestMatch = Math.min(shortestMatch, contentLength);
    }

    return {
      totalMatches: documents.length,
      uniqueFiles: uniqueFiles.size,
      averageMatchesPerFile: documents.length / uniqueFiles.size,
      longestMatch: longestMatch || 0,
      shortestMatch: shortestMatch === Infinity ? 0 : shortestMatch,
      fileTypes,
      directories,
    };
  }

  /**
   * Get empty statistics structure
   */
  private static getEmptyStatistics(): SearchStatistics {
    return {
      totalMatches: 0,
      uniqueFiles: 0,
      averageMatchesPerFile: 0,
      longestMatch: 0,
      shortestMatch: 0,
      fileTypes: {},
      directories: {},
    };
  }
}