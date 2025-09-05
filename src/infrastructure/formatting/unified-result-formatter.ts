/**
 * Unified Result Formatter
 * 
 * Centralized formatting for tool results, responses, and outputs
 * Eliminates inconsistent formatting across the codebase
 * Provides rich, structured formatting with metadata extraction
 */

import { logger } from '../logging/unified-logger.js';
import { ToolExecutionResult } from '../types/tool-execution-types.js';

export interface FormattingOptions {
  includeMetadata?: boolean;
  maxDepth?: number;
  maxLength?: number;
  preferMarkdown?: boolean;
  showTimestamps?: boolean;
  collapseArrays?: boolean;
  highlightErrors?: boolean;
  format?: 'text' | 'json' | 'markdown' | 'html';
}

export interface FormattedResult {
  content: string;
  format: 'text' | 'json' | 'markdown' | 'html';
  metadata?: {
    originalType: string;
    extractionStrategy: string;
    hasWarnings: boolean;
    warnings: string[];
    processedAt: Date;
  };
}

export interface MultiToolFormattedResult extends FormattedResult {
  toolResults: Array<{
    toolName: string;
    success: boolean;
    content: string;
    metadata?: Record<string, any>;
  }>;
  summary: {
    totalTools: number;
    successCount: number;
    errorCount: number;
  };
}

/**
 * Centralized formatter for all tool results and responses
 */
export class UnifiedResultFormatter {
  private readonly maxDepthDefault = 10;
  private readonly maxLengthDefault = 50000;

  /**
   * Format a single result with comprehensive extraction strategies
   */
  formatResult(result: unknown, options: FormattingOptions = {}): FormattedResult {
    const {
      includeMetadata = false,
      maxDepth = this.maxDepthDefault,
      maxLength = this.maxLengthDefault,
      preferMarkdown = false,
      showTimestamps = false,
      highlightErrors = true,
      format = 'text'
    } = options;

    const warnings: string[] = [];
    let extractionStrategy = 'unknown';
    let content = '';

    try {
      const extractionResult = this.extractContent(result, maxDepth, maxLength, highlightErrors);
      content = extractionResult.content;
      extractionStrategy = extractionResult.strategy;
      warnings.push(...extractionResult.warnings);

      // Apply format-specific processing
      if (preferMarkdown && format === 'text') {
        content = this.enhanceWithMarkdown(content, result);
      }

      if (showTimestamps) {
        content = `[${new Date().toLocaleTimeString()}] ${content}`;
      }

      // Truncate if too long
      if (content.length > maxLength) {
        content = content.substring(0, maxLength - 3) + '...';
        warnings.push(`Content truncated to ${maxLength} characters`);
      }

    } catch (error) {
      content = `[Error formatting result: ${(error as Error).message}]`;
      extractionStrategy = 'error';
      warnings.push(`Formatting error: ${(error as Error).message}`);
    }

    const formattedResult: FormattedResult = {
      content,
      format,
      metadata: includeMetadata ? {
        originalType: typeof result,
        extractionStrategy,
        hasWarnings: warnings.length > 0,
        warnings,
        processedAt: new Date()
      } : undefined
    };

    return formattedResult;
  }

  /**
   * Format multiple tool results with summary and organization
   */
  formatMultipleToolResults(
    toolResults: any[], 
    toolCalls?: any[], 
    options: FormattingOptions = {}
  ): MultiToolFormattedResult {
    const { includeMetadata = false } = options;
    
    if (toolResults.length === 0) {
      return {
        content: 'Tool executed successfully but returned no data',
        format: 'text',
        toolResults: [],
        summary: { totalTools: 0, successCount: 0, errorCount: 0 }
      };
    }

    const formattedToolResults: MultiToolFormattedResult['toolResults'] = [];
    const contentParts: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    toolResults.forEach((result, index) => {
      const toolCall = toolCalls?.[index];
      const toolName = toolCall?.name || toolCall?.function?.name || `Tool ${index + 1}`;

      // Format individual result
      const formattedResult = this.formatResult(result, options);
      const hasError = this.isErrorResult(result);

      if (hasError) {
        errorCount++;
      } else {
        successCount++;
      }

      // Track tool result metadata
      formattedToolResults.push({
        toolName,
        success: !hasError,
        content: formattedResult.content,
        metadata: includeMetadata ? {
          resultType: typeof result,
          extractionStrategy: formattedResult.metadata?.extractionStrategy,
          warnings: formattedResult.metadata?.warnings,
          processedAt: formattedResult.metadata?.processedAt
        } : undefined
      });

      // Format content with proper separation for multiple tools
      if (toolResults.length > 1) {
        const statusIcon = hasError ? '❌' : '✅';
        contentParts.push(`${statusIcon} **${toolName}**\n${formattedResult.content}`);
      } else {
        contentParts.push(formattedResult.content);
      }
    });

    const content = contentParts.join('\n\n---\n\n');
    
    return {
      content,
      format: options.format || 'text',
      toolResults: formattedToolResults,
      summary: {
        totalTools: toolResults.length,
        successCount,
        errorCount
      },
      metadata: includeMetadata ? {
        originalType: 'array',
        extractionStrategy: 'multi-tool',
        hasWarnings: formattedToolResults.some(tr => tr.metadata?.warnings?.length > 0),
        warnings: formattedToolResults.flatMap(tr => tr.metadata?.warnings || []),
        processedAt: new Date()
      } : undefined
    };
  }

  /**
   * Format ToolExecutionResult with structured output
   */
  formatToolExecutionResult(
    result: ToolExecutionResult, 
    options: FormattingOptions = {}
  ): FormattedResult {
    const { includeMetadata = true, highlightErrors = true } = options;

    if (!result.success && result.error) {
      const errorContent = highlightErrors 
        ? `❌ **Error**: ${result.error.message}\n\n${result.error.details ? `**Details**: ${JSON.stringify(result.error.details, null, 2)}\n\n` : ''}${result.error.stack ? `**Stack**: \`\`\`\n${result.error.stack}\n\`\`\`` : ''}`
        : `Error: ${result.error.message}`;

      return {
        content: errorContent,
        format: 'markdown',
        metadata: includeMetadata ? {
          originalType: 'ToolExecutionResult',
          extractionStrategy: 'error-result',
          hasWarnings: true,
          warnings: result.warnings || [],
          processedAt: new Date()
        } : undefined
      };
    }

    // Format successful result
    const dataFormatted = this.formatResult(result.data, options);
    let content = dataFormatted.content;

    // Add output content if different from data
    if (result.output?.content && result.output.content !== content) {
      content = result.output.content;
    }

    // Add metadata if requested
    if (includeMetadata && result.metadata) {
      const metadataLines: string[] = [];
      if (result.metadata.executionTime) {
        metadataLines.push(`⏱️ Execution time: ${result.metadata.executionTime}ms`);
      }
      if (result.metadata.resourcesAccessed?.length) {
        metadataLines.push(`📁 Resources: ${result.metadata.resourcesAccessed.join(', ')}`);
      }
      if (result.warnings?.length) {
        metadataLines.push(`⚠️ Warnings: ${result.warnings.join(', ')}`);
      }

      if (metadataLines.length > 0) {
        content += '\n\n' + metadataLines.join('\n');
      }
    }

    return {
      content,
      format: options.format || 'text',
      metadata: includeMetadata ? {
        originalType: 'ToolExecutionResult',
        extractionStrategy: 'structured-result',
        hasWarnings: (result.warnings?.length || 0) > 0,
        warnings: result.warnings || [],
        processedAt: new Date()
      } : undefined
    };
  }

  // Private helper methods

  /**
   * Extract content using comprehensive deep extraction strategies
   */
  private extractContent(
    result: unknown, 
    maxDepth: number, 
    maxLength: number,
    highlightErrors: boolean
  ): { content: string; strategy: string; warnings: string[] } {
    const warnings: string[] = [];

    // Prevent infinite recursion
    if (maxDepth <= 0) {
      return { content: '[Max depth reached]', strategy: 'depth-limited', warnings: ['Maximum extraction depth reached'] };
    }

    // Strategy 1: Handle primitives with enhanced type detection
    if (typeof result === 'string') {
      // Detect and format special string types
      if (result.startsWith('http://') || result.startsWith('https://')) {
        return { content: result, strategy: 'url-string', warnings };
      }
      if (result.includes('/') && (result.includes('.') || result.startsWith('/'))) {
        return { content: result, strategy: 'path-string', warnings };
      }
      if (result.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        return { content: result, strategy: 'iso-date-string', warnings };
      }
      return { content: result, strategy: 'string-direct', warnings };
    }

    if (typeof result === 'number' || typeof result === 'boolean') {
      return { content: String(result), strategy: 'primitive-conversion', warnings };
    }

    if (result === null || result === undefined) {
      return { content: '', strategy: 'null-empty', warnings };
    }

    // Strategy 2: Enhanced array handling with deep extraction
    if (Array.isArray(result)) {
      if (result.length === 0) {
        return { content: '[]', strategy: 'empty-array', warnings };
      }

      // Homogeneous string arrays
      if (result.every(item => typeof item === 'string')) {
        return { content: result.join('\n'), strategy: 'string-array-join', warnings };
      }

      // Homogeneous object arrays (common API response pattern)
      if (result.every(item => typeof item === 'object' && item !== null)) {
        return this.extractObjectArray(result, maxDepth - 1, maxLength, highlightErrors, warnings);
      }

      // Mixed arrays with intelligent formatting
      const formatted = result.map((item, index) => {
        const itemContent = this.extractContent(item, maxDepth - 1, maxLength / result.length, highlightErrors);
        const prefix = result.length > 10 ? `[${index}]` : `${index + 1}.`;
        return `${prefix} ${itemContent.content}`;
      }).join('\n');

      return { content: formatted, strategy: 'mixed-array-format', warnings };
    }

    // Strategy 3: Deep object extraction with specialized patterns
    if (typeof result === 'object' && result !== null) {
      const record = result as Record<string, unknown>;

      // Enhanced MCP-style responses with deep traversal
      const extractionResult = this.extractFromMCPPatterns(record, maxDepth, highlightErrors, warnings);
      if (extractionResult) return extractionResult;

      // API Response patterns
      const apiResult = this.extractFromAPIPatterns(record, maxDepth, maxLength, highlightErrors, warnings);
      if (apiResult) return apiResult;

      // Database/ORM result patterns
      const dbResult = this.extractFromDatabasePatterns(record, maxDepth, maxLength, highlightErrors, warnings);
      if (dbResult) return dbResult;

      // File system result patterns
      const fsResult = this.extractFromFileSystemPatterns(record, maxDepth, maxLength, highlightErrors, warnings);
      if (fsResult) return fsResult;

      // Error objects with enhanced detection
      const errorResult = this.extractFromErrorPatterns(record, highlightErrors, warnings);
      if (errorResult) return errorResult;

      // Generic object with intelligent key prioritization
      return this.extractFromGenericObject(record, maxDepth, maxLength, warnings);
    }

    // Strategy 4: Last resort with type information
    return { content: String(result), strategy: 'string-coercion', warnings: ['Used string coercion'] };
  }

  /**
   * Extract content from homogeneous object arrays
   */
  private extractObjectArray(
    array: any[], 
    maxDepth: number, 
    maxLength: number, 
    highlightErrors: boolean,
    warnings: string[]
  ): { content: string; strategy: string; warnings: string[] } {
    if (array.length === 0) {
      return { content: '[]', strategy: 'empty-object-array', warnings };
    }

    // Sample first object to determine structure
    const firstItem = array[0] as Record<string, unknown>;
    const keys = Object.keys(firstItem);
    
    // If objects have few keys, show as table
    if (keys.length <= 5 && array.length <= 20) {
      const formatted = array.map((item, index) => {
        const itemContent = this.extractContent(item, maxDepth, maxLength / array.length, highlightErrors);
        return `[${index}] ${itemContent.content}`;
      }).join('\n');
      
      return { content: formatted, strategy: 'object-array-table', warnings };
    }

    // For large arrays, show summary
    const summary = `Array of ${array.length} objects with keys: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`;
    const firstFew = array.slice(0, 3).map((item, index) => {
      const itemContent = this.extractContent(item, maxDepth, maxLength / 3, highlightErrors);
      return `[${index}] ${itemContent.content}`;
    }).join('\n');
    
    const content = `${summary}\n\nFirst ${Math.min(3, array.length)} items:\n${firstFew}`;
    if (array.length > 3) {
      warnings.push(`Showing first 3 of ${array.length} array items`);
    }
    
    return { content, strategy: 'object-array-summary', warnings };
  }

  /**
   * Extract from MCP-style patterns with deep traversal
   */
  private extractFromMCPPatterns(
    record: Record<string, unknown>, 
    maxDepth: number, 
    highlightErrors: boolean,
    warnings: string[]
  ): { content: string; strategy: string; warnings: string[] } | null {
    // Primary content properties
    const primaryProps = ['content', 'text', 'message', 'output', 'response', 'result'];
    for (const prop of primaryProps) {
      const value = record[prop];
      if (typeof value === 'string' && value.trim()) {
        return { content: value, strategy: `mcp-${prop}`, warnings };
      }
      
      // Deep traverse if property is object
      if (value && typeof value === 'object' && maxDepth > 1) {
        const deepResult = this.extractContent(value, maxDepth - 1, 10000, highlightErrors);
        if (deepResult.content && deepResult.content.trim()) {
          return { content: deepResult.content, strategy: `mcp-deep-${prop}`, warnings: [...warnings, ...deepResult.warnings] };
        }
      }
    }

    // Nested content patterns with enhanced detection
    if (record.content && typeof record.content === 'object') {
      const content = record.content as Record<string, unknown>;
      
      // Multi-level text extraction
      if (typeof content.text === 'string') {
        return { content: content.text, strategy: 'nested-content-text', warnings };
      }
      
      // Content arrays
      if (Array.isArray(content)) {
        const textContent = content
          .map(c => typeof c === 'object' && c !== null ? (c as any).text || (c as any).content : String(c))
          .filter(text => text && typeof text === 'string')
          .join('\n');
        
        if (textContent) {
          return { content: textContent, strategy: 'nested-content-array', warnings };
        }
      }
    }

    return null;
  }

  /**
   * Extract from common API response patterns
   */
  private extractFromAPIPatterns(
    record: Record<string, unknown>, 
    maxDepth: number, 
    maxLength: number,
    highlightErrors: boolean,
    warnings: string[]
  ): { content: string; strategy: string; warnings: string[] } | null {
    // REST API patterns
    if (record.data && typeof record.data === 'object') {
      const dataResult = this.extractContent(record.data, maxDepth - 1, maxLength, highlightErrors);
      return { content: dataResult.content, strategy: 'api-data', warnings: [...warnings, ...dataResult.warnings] };
    }

    // GraphQL patterns
    if (record.data && record.errors) {
      const dataResult = this.extractContent(record.data, maxDepth - 1, maxLength / 2, highlightErrors);
      const errorsResult = this.extractContent(record.errors, maxDepth - 1, maxLength / 2, highlightErrors);
      const content = `Data: ${dataResult.content}\n\nErrors: ${errorsResult.content}`;
      return { content, strategy: 'graphql-response', warnings: [...warnings, ...dataResult.warnings, ...errorsResult.warnings] };
    }

    // Paginated responses
    if (record.items && Array.isArray(record.items)) {
      const itemsResult = this.extractContent(record.items, maxDepth - 1, maxLength, highlightErrors);
      const metaInfo = [];
      if (record.total) metaInfo.push(`total: ${record.total}`);
      if (record.page) metaInfo.push(`page: ${record.page}`);
      if (record.limit) metaInfo.push(`limit: ${record.limit}`);
      
      const content = metaInfo.length > 0 
        ? `${itemsResult.content}\n\n[${metaInfo.join(', ')}]`
        : itemsResult.content;
        
      return { content, strategy: 'paginated-response', warnings: [...warnings, ...itemsResult.warnings] };
    }

    return null;
  }

  /**
   * Extract from database/ORM result patterns
   */
  private extractFromDatabasePatterns(
    record: Record<string, unknown>, 
    maxDepth: number, 
    maxLength: number,
    highlightErrors: boolean,
    warnings: string[]
  ): { content: string; strategy: string; warnings: string[] } | null {
    // Database query results
    if (record.rows && Array.isArray(record.rows)) {
      const rowsResult = this.extractContent(record.rows, maxDepth - 1, maxLength, highlightErrors);
      const metaInfo = [];
      if (record.rowCount) metaInfo.push(`${record.rowCount} rows`);
      if (record.command) metaInfo.push(`command: ${record.command}`);
      
      const content = metaInfo.length > 0 
        ? `${rowsResult.content}\n\n[${metaInfo.join(', ')}]`
        : rowsResult.content;
        
      return { content, strategy: 'database-result', warnings: [...warnings, ...rowsResult.warnings] };
    }

    // ORM model instances
    if (record._id || record.id) {
      const importantKeys = ['id', '_id', 'name', 'title', 'description', 'status', 'createdAt', 'updatedAt'];
      const displayData: Record<string, unknown> = {};
      
      for (const key of importantKeys) {
        if (record[key] !== undefined) {
          displayData[key] = record[key];
        }
      }
      
      const displayResult = this.extractContent(displayData, maxDepth - 1, maxLength, highlightErrors);
      return { content: displayResult.content, strategy: 'orm-model', warnings: [...warnings, ...displayResult.warnings] };
    }

    return null;
  }

  /**
   * Extract from file system patterns
   */
  private extractFromFileSystemPatterns(
    record: Record<string, unknown>, 
    maxDepth: number, 
    maxLength: number,
    highlightErrors: boolean,
    warnings: string[]
  ): { content: string; strategy: string; warnings: string[] } | null {
    // File stats objects
    if (record.size && record.mtime && record.isFile) {
      const fileInfo = [];
      if (record.name) fileInfo.push(`File: ${record.name}`);
      if (record.size) fileInfo.push(`Size: ${record.size} bytes`);
      if (record.mtime) fileInfo.push(`Modified: ${record.mtime}`);
      if (record.mode) fileInfo.push(`Mode: ${record.mode}`);
      
      return { content: fileInfo.join('\n'), strategy: 'file-stats', warnings };
    }

    // Directory listings
    if (record.files && Array.isArray(record.files)) {
      const filesResult = this.extractContent(record.files, maxDepth - 1, maxLength, highlightErrors);
      return { content: `Directory contents:\n${filesResult.content}`, strategy: 'directory-listing', warnings: [...warnings, ...filesResult.warnings] };
    }

    return null;
  }

  /**
   * Extract from error patterns with enhanced detection
   */
  private extractFromErrorPatterns(
    record: Record<string, unknown>, 
    highlightErrors: boolean,
    warnings: string[]
  ): { content: string; strategy: string; warnings: string[] } | null {
    // Standard error object
    if (record.error) {
      let errorContent = '';
      
      if (typeof record.error === 'string') {
        errorContent = record.error;
      } else if (typeof record.error === 'object' && record.error !== null) {
        const errorObj = record.error as any;
        const parts = [];
        if (errorObj.message) parts.push(`Message: ${errorObj.message}`);
        if (errorObj.code) parts.push(`Code: ${errorObj.code}`);
        if (errorObj.details) parts.push(`Details: ${JSON.stringify(errorObj.details)}`);
        errorContent = parts.join('\n');
      }
      
      const finalContent = highlightErrors ? `❌ Error\n${errorContent}` : errorContent;
      return { content: finalContent, strategy: 'error-object', warnings: [...warnings, 'Error result detected'] };
    }

    // Exception-like patterns
    if (record.message && record.stack) {
      const errorContent = `${record.message}\n\nStack trace:\n${record.stack}`;
      const finalContent = highlightErrors ? `❌ Exception\n${errorContent}` : errorContent;
      return { content: finalContent, strategy: 'exception-object', warnings: [...warnings, 'Exception detected'] };
    }

    return null;
  }

  /**
   * Extract from generic object with intelligent key prioritization
   */
  private extractFromGenericObject(
    record: Record<string, unknown>, 
    maxDepth: number, 
    maxLength: number,
    warnings: string[]
  ): { content: string; strategy: string; warnings: string[] } {
    // Prioritize human-readable keys
    const priorityKeys = [
      'title', 'name', 'label', 'description', 'summary', 'overview',
      'value', 'result', 'output', 'response', 'body', 'payload',
      'status', 'state', 'phase', 'progress'
    ];
    
    // Find the most important content first
    for (const key of priorityKeys) {
      const value = record[key];
      if (value && (typeof value === 'string' || typeof value === 'number') && String(value).trim()) {
        const otherKeys = Object.keys(record).filter(k => k !== key).slice(0, 3);
        const content = otherKeys.length > 0 
          ? `${key}: ${value}\n[Also contains: ${otherKeys.join(', ')}]`
          : `${key}: ${value}`;
        return { content, strategy: 'object-priority-key', warnings };
      }
    }

    // Fall back to JSON with depth limiting
    try {
      const json = this.limitedJsonStringify(record, maxDepth);
      return { content: json, strategy: 'json-fallback', warnings: [...warnings, 'Used JSON fallback'] };
    } catch (error) {
      warnings.push(`JSON stringify failed: ${(error as Error).message}`);
      return { content: '[Object]', strategy: 'object-fallback', warnings };
    }
  }

  /**
   * Enhanced markdown formatting
   */
  private enhanceWithMarkdown(content: string, originalResult: unknown): string {
    // Add code blocks for JSON-like content
    if (content.includes('{') && content.includes('}')) {
      return `\`\`\`json\n${content}\n\`\`\``;
    }

    // Add emphasis for error messages
    if (content.toLowerCase().includes('error')) {
      return `**${content}**`;
    }

    return content;
  }

  /**
   * Check if result represents an error
   */
  private isErrorResult(result: any): boolean {
    if (!result || typeof result !== 'object') return false;
    
    return !!(
      result.error ||
      result.success === false ||
      (typeof result.message === 'string' && result.message.toLowerCase().includes('error'))
    );
  }

  /**
   * JSON stringify with depth and circular reference protection
   */
  private limitedJsonStringify(obj: any, maxDepth: number): string {
    const seen = new WeakSet();

    const replacer = (key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    };

    return JSON.stringify(obj, replacer, 2);
  }
}

// Export singleton instance
export const unifiedResultFormatter = new UnifiedResultFormatter();