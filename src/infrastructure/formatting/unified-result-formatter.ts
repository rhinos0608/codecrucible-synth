/**
 * Unified Result Formatter
 *
 * Centralized formatting for tool results, responses, and outputs
 * Eliminates inconsistent formatting across the codebase
 * Provides rich, structured formatting with metadata extraction
 */

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
    metadata?: Record<string, unknown>;
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
  private readonly maxDepthDefault = 25; // FIXED: Increased from 10 to 25 for deeper extraction
  private readonly maxLengthDefault = 50000;

  /**
   * Format a single result with comprehensive extraction strategies
   */
  public formatResult(result: Readonly<unknown>, options: Readonly<FormattingOptions> = {}): FormattedResult {
    const {
      includeMetadata = false,
      maxDepth = this.maxDepthDefault,
      maxLength = this.maxLengthDefault,
      preferMarkdown = false,
      showTimestamps = false,
      highlightErrors = true,
      format = 'text',
    } = options;

    const warnings: string[] = [];
    let extractionStrategy = 'unknown';
    let content = '';

    try {
      const { content: extractedContent, strategy, warnings: extractionWarnings } = this.extractContent(result, maxDepth, maxLength, highlightErrors);
      content = extractedContent;
      extractionStrategy = strategy;
      warnings.push(...extractionWarnings);

      // Apply format-specific processing
      if (preferMarkdown && format === 'text') {
        content = this.enhanceWithMarkdown(content, result);
      }

      if (showTimestamps) {
        content = `[${new Date().toLocaleTimeString()}] ${content}`;
      }

      // Truncate if too long
      if (content.length > maxLength) {
        content = `${content.substring(0, maxLength - 3)}...`;
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
      metadata: includeMetadata
        ? {
            originalType: typeof result,
            extractionStrategy,
            hasWarnings: warnings.length > 0,
            warnings: warnings.map(w => String(w)),
            processedAt: new Date(),
          }
        : undefined,
    };

    return formattedResult;
  }

  /**
   * Format multiple tool results with summary and organization
   */
  public formatMultipleToolResults(
    toolResults: readonly unknown[],
    toolCalls?: readonly { name?: string; function?: { name?: string } }[],
    options: Readonly<FormattingOptions> = {}
  ): MultiToolFormattedResult {
    const { includeMetadata = false } = options;

    if (toolResults.length === 0) {
      return {
        content: 'Tool executed successfully but returned no data',
        format: 'text',
        toolResults: [],
        summary: { totalTools: 0, successCount: 0, errorCount: 0 },
      };
    }

    const formattedToolResults: MultiToolFormattedResult['toolResults'] = [];
    const contentParts: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    toolResults.forEach((result, index) => {
      const toolCall = toolCalls?.[index];
      let toolName = `Tool ${index + 1}`;
      if (toolCall && typeof toolCall === 'object') {
        if ('name' in toolCall && typeof toolCall.name === 'string') {
          toolName = toolCall.name;
        } else if (
          'function' in toolCall &&
          toolCall.function &&
          typeof toolCall.function === 'object' &&
          'name' in toolCall.function &&
          typeof toolCall.function.name === 'string'
        ) {
          toolName = toolCall.function.name;
        }
      }

      // Format individual result
      const formattedResult = this.formatResult(result as Readonly<unknown>, options);
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
        metadata: includeMetadata
          ? {
              resultType: typeof result,
              extractionStrategy: formattedResult.metadata?.extractionStrategy,
              warnings: formattedResult.metadata?.warnings,
              processedAt: formattedResult.metadata?.processedAt,
            }
          : undefined,
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
      format: options.format ?? 'text',
      toolResults: formattedToolResults,
      summary: {
        totalTools: toolResults.length,
        successCount,
        errorCount,
      },
      metadata: includeMetadata
        ? {
            originalType: 'array',
            extractionStrategy: 'multi-tool',
            hasWarnings: (formattedToolResults as readonly typeof formattedToolResults[number][]).some(tr => Array.isArray(tr.metadata?.warnings) && tr.metadata.warnings.length > 0),
            warnings: (formattedToolResults as readonly typeof formattedToolResults[number][]).flatMap(tr => tr.metadata?.warnings as string[]),
            processedAt: new Date(),
          }
        : undefined,
    };
  }

  /**
   * Format ToolExecutionResult with structured output
   */
  public formatToolExecutionResult(
    result: Readonly<ToolExecutionResult>,
    options: Readonly<FormattingOptions> = {}
  ): FormattedResult {
    const { includeMetadata = true, highlightErrors = true } = options;

    if (!result.success && result.error) {
      const errorContent = highlightErrors
        ? `❌ **Error**: ${result.error.message}\n\n${result.error.details ? `**Details**: ${JSON.stringify(result.error.details, null, 2)}\n\n` : ''}${result.error.stack ? `**Stack**: \`\`\`\n${result.error.stack}\n\`\`\`` : ''}`
        : `Error: ${result.error.message}`;

      return {
        content: errorContent,
        format: 'markdown',
        metadata: includeMetadata
          ? {
              originalType: 'ToolExecutionResult',
              extractionStrategy: 'error-result',
              hasWarnings: true,
              warnings: result.warnings ?? [],
              processedAt: new Date(),
            }
          : undefined,
      };
    }

    // Format successful result
    const { content: dataContent } = this.formatResult(result.data as Readonly<unknown>, options);
    let content = dataContent;

    // Add output content if different from data
    const { content: outputContent } = result.output ?? {};
    if (outputContent && outputContent !== content) {
      content = outputContent;
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
                content += `
        
        ${metadataLines.join('\n')}`;
      }
    }

    return {
      content,
      format: options.format ?? 'text',
      metadata: includeMetadata
        ? {
            originalType: 'ToolExecutionResult',
            extractionStrategy: 'structured-result',
            hasWarnings: (result.warnings?.length ?? 0) > 0,
            warnings: result.warnings ?? [],
            processedAt: new Date(),
          }
        : undefined,
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

    // FIXED: Better handling when depth limit is reached
    if (maxDepth <= 0) {
      // Try to extract at least basic information even at max depth
      if (typeof result === 'string') {
        return {
          content: result.substring(0, 200) + (result.length > 200 ? '...' : ''),
          strategy: 'depth-limited-string',
          warnings: ['Maximum extraction depth reached'],
        };
      }
      if (typeof result === 'number' || typeof result === 'boolean') {
        return {
          content: String(result),
          strategy: 'depth-limited-primitive',
          warnings: ['Maximum extraction depth reached'],
        };
      }
      if (result === null || result === undefined) {
        return {
          content: '',
          strategy: 'depth-limited-null',
          warnings: ['Maximum extraction depth reached'],
        };
      }
      if (Array.isArray(result)) {
        return {
          content: `[Array with ${result.length} items]`,
          strategy: 'depth-limited-array',
          warnings: ['Maximum extraction depth reached'],
        };
      }
      if (typeof result === 'object') {
        const keys = Object.keys(result).slice(0, 5);
        return {
          content: `{Object with keys: ${keys.join(', ')}${Object.keys(result).length > 5 ? '...' : ''}}`,
          strategy: 'depth-limited-object',
          warnings: ['Maximum extraction depth reached'],
        };
      }
      return {
        content: '[Max depth reached - complex structure]',
        strategy: 'depth-limited-fallback',
        warnings: ['Maximum extraction depth reached'],
      };
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
      const formatted = result
        .map((item, index) => {
          const itemContent = this.extractContent(
            item,
            maxDepth - 1,
            maxLength / result.length,
            highlightErrors
          );
          const prefix = result.length > 10 ? `[${index}]` : `${index + 1}.`;
          return `${prefix} ${itemContent.content}`;
        })
        .join('\n');

      return { content: formatted, strategy: 'mixed-array-format', warnings };
    }

    // Strategy 3: Deep object extraction with specialized patterns
    if (typeof result === 'object') {
      const record = result as Record<string, unknown>;

      // Enhanced MCP-style responses with deep traversal
      const extractionResult = this.extractFromMCPPatterns(
        record,
        maxDepth,
        highlightErrors,
        warnings
      );
      if (extractionResult) return extractionResult;

      // API Response patterns
      const apiResult = this.extractFromAPIPatterns(
        record,
        maxDepth,
        maxLength,
        highlightErrors,
        warnings
      );
      if (apiResult) return apiResult;

      // Database/ORM result patterns
      const dbResult = this.extractFromDatabasePatterns(
        record,
        maxDepth,
        maxLength,
        highlightErrors,
        warnings
      );
      if (dbResult) return dbResult;

      // File system result patterns
      const fsResult = this.extractFromFileSystemPatterns(
        record,
        maxDepth,
        maxLength,
        highlightErrors,
        warnings
      );
      if (fsResult) return fsResult;

      // Error objects with enhanced detection
      const errorResult = this.extractFromErrorPatterns(record, highlightErrors, warnings);
      if (errorResult) return errorResult;

      // Generic object with intelligent key prioritization
      return this.extractFromGenericObject(record, maxDepth, warnings);
    }

    // Strategy 4: Last resort with type information
    return {
      content: String(result),
      strategy: 'string-coercion',
      warnings: ['Used string coercion'],
    };
  }

  /**
   * Extract content from homogeneous object arrays
   */
  private extractObjectArray(
    array: readonly unknown[],
    maxDepth: number,
    maxLength: number,
    highlightErrors: boolean,
    warnings: readonly string[]
  ): { content: string; strategy: string; warnings: string[] } {
    const mutableWarnings: string[] = [...warnings];

    if (array.length === 0) {
      return { content: '[]', strategy: 'empty-object-array', warnings: mutableWarnings };
    }

    // Sample first object to determine structure
    const firstItem = array[0] as Record<string, unknown>;
    const keys = Object.keys(firstItem);

    // If objects have few keys, show as table
    if (keys.length <= 5 && array.length <= 20) {
      const formatted = array
        .map((item, index) => {
          const itemContent = this.extractContent(
            item,
            maxDepth,
            maxLength / array.length,
            highlightErrors
          );
          return `[${index}] ${itemContent.content}`;
        })
        .join('\n');

      return { content: formatted, strategy: 'object-array-table', warnings: mutableWarnings };
    }

    // For large arrays, show summary
    const summary = `Array of ${array.length} objects with keys: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`;
    const firstFew = array
      .slice(0, 3)
      .map((item, index) => {
        const itemContent = this.extractContent(item, maxDepth, maxLength / 3, highlightErrors);
        return `[${index}] ${itemContent.content}`;
      })
      .join('\n');

    const content = `${summary}\n\nFirst ${Math.min(3, array.length)} items:\n${firstFew}`;
    if (array.length > 3) {
      mutableWarnings.push(`Showing first 3 of ${array.length} array items`);
    }

    return { content, strategy: 'object-array-summary', warnings: mutableWarnings };
  }

  /**
   * Extract from MCP-style patterns with deep traversal
   */
  private extractFromMCPPatterns(
    record: Readonly<Record<string, unknown>>,
    maxDepth: number,
    highlightErrors: boolean,
    warnings: readonly string[]
  ): { content: string; strategy: string; warnings: string[] } | null {
    // Primary content properties
    const primaryProps = ['content', 'text', 'message', 'output', 'response', 'result'];
    for (const prop of primaryProps) {
      const value = record[prop];
      if (typeof value === 'string' && value.trim()) {
        return { content: value, strategy: `mcp-${prop}`, warnings: [...warnings] };
      }

      // Deep traverse if property is object
      if (value && typeof value === 'object' && maxDepth > 1) {
        const deepResult = this.extractContent(value, maxDepth - 1, 10000, highlightErrors);
        if (deepResult.content.trim()) {
          return {
            content: deepResult.content,
            strategy: `mcp-deep-${prop}`,
            warnings: [...warnings, ...deepResult.warnings],
          };
        }
      }
    }

    // Nested content patterns with enhanced detection
    if (record.content && typeof record.content === 'object') {
      const content = record.content as Record<string, unknown>;

      // Multi-level text extraction
      if (typeof content.text === 'string') {
        return { content: content.text, strategy: 'nested-content-text', warnings: [...warnings] };
      }

      // Content arrays
      if (Array.isArray(content)) {
        const textContent = content
          .map((c: unknown) => {
            if (typeof c === 'object' && c !== null) {
              const obj = c as Record<string, unknown>;
              if (typeof obj.text === 'string') {
                return obj.text;
              }
              if (typeof obj.content === 'string') {
                return obj.content;
              }
              return '';
            }
            return String(c);
          })
          .filter((text: string) => text && typeof text === 'string')
          .join('\n');

        if (textContent) {
          return { content: textContent, strategy: 'nested-content-array', warnings: [...warnings] };
        }
      }
    }

    return null;
  }

  /**
   * Extract from common API response patterns
   */
  private extractFromAPIPatterns(
    record: Readonly<Record<string, unknown>>,
    maxDepth: number,
    maxLength: number,
    highlightErrors: boolean,
    warnings: readonly string[]
  ): { content: string; strategy: string; warnings: string[] } | null {
    // OpenAI-compatible API patterns (LM Studio, OpenAI, etc.)
    interface OpenAIChoice {
      message?: { content?: string };
      text?: string;
      delta?: { content?: string };
      [key: string]: unknown;
    }

    if (
      record.choices &&
      Array.isArray(record.choices) &&
      record.choices.length > 0
    ) {
      const [choiceRaw] = record.choices as unknown[];
      const choice: OpenAIChoice =
        typeof choiceRaw === 'object' && choiceRaw !== null ? (choiceRaw as OpenAIChoice) : {};

      // Handle message.content pattern
      if (
        choice.message &&
        typeof choice.message === 'object' &&
        'content' in choice.message
      ) {
        const content =
          typeof choice.message.content === 'string'
            ? choice.message.content
            : String(choice.message.content);
        return { content, strategy: 'openai-message-content', warnings: [...warnings] };
      }

      // Handle direct text in choice
      if (typeof choice.text === 'string' && choice.text.trim()) {
        return { content: choice.text, strategy: 'openai-choice-text', warnings: [...warnings] };
      }

      // Handle delta content (streaming responses)
      if (
        choice.delta &&
        typeof choice.delta === 'object' &&
        'content' in choice.delta
      ) {
        const content =
          typeof choice.delta.content === 'string'
            ? choice.delta.content
            : String(choice.delta.content);
        return { content, strategy: 'openai-delta-content', warnings: [...warnings] };
      }

      // Fallback: extract from the choice object
      const choiceResult = this.extractContent(choice, maxDepth - 1, maxLength, highlightErrors);
      if (choiceResult.content.trim()) {
        return {
          content: choiceResult.content,
          strategy: 'openai-choice-fallback',
          warnings: [...warnings, ...choiceResult.warnings],
        };
      }
    }

    // REST API patterns
    if (record.data && typeof record.data === 'object') {
      const dataResult = this.extractContent(record.data, maxDepth - 1, maxLength, highlightErrors);
      return {
        content: dataResult.content,
        strategy: 'api-data',
        warnings: [...warnings, ...dataResult.warnings],
      };
    }

    // GraphQL patterns
    if (record.data && record.errors) {
      const dataResult = this.extractContent(
        record.data,
        maxDepth - 1,
        maxLength / 2,
        highlightErrors
      );
      const errorsResult = this.extractContent(
        record.errors,
        maxDepth - 1,
        maxLength / 2,
        highlightErrors
      );
      const content = `Data: ${dataResult.content}\n\nErrors: ${errorsResult.content}`;
      return {
        content,
        strategy: 'graphql-response',
        warnings: [...warnings, ...dataResult.warnings, ...errorsResult.warnings],
      };
    }

    // Paginated responses
    if (record.items && Array.isArray(record.items)) {
      const itemsResult = this.extractContent(
        record.items,
        maxDepth - 1,
        maxLength,
        highlightErrors
      );
      const metaInfo = [];
      if (typeof record.total === 'string' || typeof record.total === 'number' || typeof record.total === 'boolean') metaInfo.push(`total: ${record.total}`);
      if (typeof record.page === 'string' || typeof record.page === 'number' || typeof record.page === 'boolean') metaInfo.push(`page: ${record.page}`);
      if (typeof record.limit === 'string' || typeof record.limit === 'number' || typeof record.limit === 'boolean') metaInfo.push(`limit: ${record.limit}`);

      const content =
        metaInfo.length > 0
          ? `${itemsResult.content}\n\n[${metaInfo.join(', ')}]`
          : itemsResult.content;

      return {
        content,
        strategy: 'paginated-response',
        warnings: [...warnings, ...itemsResult.warnings],
      };
    }

    return null;
  }

  /**
   * Extract from database/ORM result patterns
   */
  private extractFromDatabasePatterns(
    record: Readonly<Record<string, unknown>>,
    maxDepth: number,
    maxLength: number,
    highlightErrors: boolean,
    warnings: readonly string[]
  ): { content: string; strategy: string; warnings: string[] } | null {
    // Database query results
    if (record.rows && Array.isArray(record.rows)) {
      const rowsResult = this.extractContent(record.rows, maxDepth - 1, maxLength, highlightErrors);
      const metaInfo = [];
      if (typeof record.rowCount === 'string' || typeof record.rowCount === 'number' || typeof record.rowCount === 'boolean') metaInfo.push(`${record.rowCount} rows`);
      if (typeof record.command === 'string' || typeof record.command === 'number' || typeof record.command === 'boolean') metaInfo.push(`command: ${record.command}`);

      const content =
        metaInfo.length > 0
          ? `${rowsResult.content}\n\n[${metaInfo.join(', ')}]`
          : rowsResult.content;

      return {
        content,
        strategy: 'database-result',
        warnings: [...warnings, ...rowsResult.warnings],
      };
    }

    // ORM model instances
    if (record._id || record.id) {
      const importantKeys = [
        'id',
        '_id',
        'name',
        'title',
        'description',
        'status',
        'createdAt',
        'updatedAt',
      ];
      const displayData: Record<string, unknown> = {};

      for (const key of importantKeys) {
        if (record[key] !== undefined) {
          displayData[key] = record[key];
        }
      }

      const displayResult = this.extractContent(
        displayData,
        maxDepth - 1,
        maxLength,
        highlightErrors
      );
      return {
        content: displayResult.content,
        strategy: 'orm-model',
        warnings: [...warnings, ...displayResult.warnings],
      };
    }

    return null;
  }

  /**
   * Extract from file system patterns
   */
  private extractFromFileSystemPatterns(
    record: Readonly<Record<string, unknown>>,
    maxDepth: number,
    maxLength: number,
    highlightErrors: boolean,
    warnings: readonly string[]
  ): { content: string; strategy: string; warnings: string[] } | null {
    // File stats objects
    if (
      typeof record.size === 'number' &&
      record.mtime !== undefined &&
      typeof record.isFile === 'boolean' &&
      record.isFile
    ) {
      const fileInfo: string[] = [];
      if (typeof record.name === 'string') fileInfo.push(`File: ${record.name}`);
      fileInfo.push(`Size: ${record.size} bytes`);
      fileInfo.push(`Modified: ${String(record.mtime)}`);
      if (record.mode !== undefined) fileInfo.push(`Mode: ${String(record.mode)}`);

      return { content: fileInfo.join('\n'), strategy: 'file-stats', warnings: [...warnings] };
    }

    // Directory listings
    if (record.files && Array.isArray(record.files)) {
      const filesResult = this.extractContent(
        record.files,
        maxDepth - 1,
        maxLength,
        highlightErrors
      );
      return {
        content: `Directory contents:\n${filesResult.content}`,
        strategy: 'directory-listing',
        warnings: [...warnings, ...filesResult.warnings],
      };
    }

    return null;
  }

  /**
   * Extract from error patterns with enhanced detection
   */
  private extractFromErrorPatterns(
    record: Readonly<Record<string, unknown>>,
    highlightErrors: boolean,
    warnings: readonly string[]
  ): { content: string; strategy: string; warnings: string[] } | null {
    // Standard error object
    if (record.error) {
      let errorContent = '';

      if (typeof record.error === 'string') {
        errorContent = record.error;
      } else if (typeof record.error === 'object') {
        const errorObj = record.error as { message?: unknown; code?: unknown; details?: unknown };
        const parts: string[] = [];
        if ('message' in errorObj && errorObj.message !== undefined) parts.push(`Message: ${String(errorObj.message)}`);
        if ('code' in errorObj && errorObj.code !== undefined) parts.push(`Code: ${String(errorObj.code)}`);
        if ('details' in errorObj && errorObj.details !== undefined) parts.push(`Details: ${JSON.stringify(errorObj.details)}`);
        errorContent = parts.join('\n');
      }

      const finalContent = highlightErrors ? `❌ Error\n${errorContent}` : errorContent;
      return {
        content: finalContent,
        strategy: 'error-object',
        warnings: [...warnings, 'Error result detected'],
      };
    }

    // Exception-like patterns
    if (record.message && record.stack) {
      const errorContent = `${String(record.message)}\n\nStack trace:\n${String(record.stack)}`;
      const finalContent = highlightErrors ? `❌ Exception\n${errorContent}` : errorContent;
      return {
        content: finalContent,
        strategy: 'exception-object',
        warnings: [...warnings, 'Exception detected'],
      };
    }

    return null;
  }

  /**
   * Extract from generic object with intelligent key prioritization
   */
  private extractFromGenericObject(
    record: Readonly<Record<string, unknown>>,
    maxDepth: number,
    warnings: readonly string[]
  ): { content: string; strategy: string; warnings: string[] } {
    // Prioritize human-readable keys
    const priorityKeys = [
      'title',
      'name',
      'label',
      'description',
      'summary',
      'overview',
      'value',
      'result',
      'output',
      'response',
      'body',
      'payload',
      'status',
      'state',
      'phase',
      'progress',
    ];

    // Find the most important content first
    for (const key of priorityKeys) {
      const value = record[key];
      if (
        value &&
        (typeof value === 'string' || typeof value === 'number') &&
        String(value).trim()
      ) {
        const otherKeys = Object.keys(record)
          .filter(k => k !== key)
          .slice(0, 3);
        const content =
          otherKeys.length > 0
            ? `${key}: ${value}\n[Also contains: ${otherKeys.join(', ')}]`
            : `${key}: ${value}`;
        // Make a mutable copy of warnings before returning
        return { content, strategy: 'object-priority-key', warnings: [...warnings] };
      }
    }

    // Fall back to JSON with depth limiting
    const mutableWarnings: string[] = [...warnings];
    try {
      const json = this.limitedJsonStringify(record, maxDepth);
      return {
        content: json,
        strategy: 'json-fallback',
        warnings: [...mutableWarnings, 'Used JSON fallback'],
      };
    } catch (error) {
      const message = (error && typeof error === 'object' && 'message' in error)
        ? String((error as { message?: unknown }).message)
        : String(error);
      mutableWarnings.push(`JSON stringify failed: ${message}`);
      return { content: '[Object]', strategy: 'object-fallback', warnings: mutableWarnings };
    }
  }

  /**
   * Enhanced markdown formatting
   */
  private enhanceWithMarkdown(content: string, _originalResult: unknown): string {
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
  private isErrorResult(result: unknown): boolean {
    if (!result || typeof result !== 'object') return false;

    const obj = result as { error?: unknown; success?: unknown; message?: unknown };

    return !!(
      ('error' in obj && obj.error !== undefined) ||
      ('success' in obj && obj.success === false) ||
      ('message' in obj &&
        typeof obj.message === 'string' &&
        obj.message.toLowerCase().includes('error'))
    );
  }

  /**
   * JSON stringify with depth and circular reference protection
   */
  private limitedJsonStringify(obj: unknown, _maxDepth: number): string {
    const seen = new WeakSet();

    const replacer = (_key: string, value: unknown): unknown => {
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
