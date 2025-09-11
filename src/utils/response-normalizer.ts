import { logger } from '../infrastructure/logging/logger.js';
import { ModelResponse } from '../domain/interfaces/model-client.js';
import { toErrorOrUndefined } from './type-guards.js';

/**
 * ResponseNormalizer - Unified utility for ensuring all responses are properly formatted
 *
 * Addresses the critical "string 58" buffer serialization issues by:
 * - Converting Buffer objects to UTF-8 strings
 * - Handling ArrayBuffer and typed arrays
 * - Standardizing object serialization
 * - Providing consistent error handling
 *
 * Based on Coding Grimoire principles: Security-first, maintainable, explicit
 */
export class ResponseNormalizer {
  /**
   * Normalize any input to a proper string representation
   * CRITICAL: This prevents "string 58" display issues from Buffer objects
   */
  public static normalizeToString(input: unknown): string {
    if (input === undefined || input === null || (typeof input === 'number' && isNaN(input)))
      return '';
    if (input === '' || input === 0 || input === false) return String(input);

    // Handle Buffer types (primary cause of "string 58" issue)
    if (Buffer.isBuffer(input)) {
      logger.debug('ResponseNormalizer: Converting Buffer to string', {
        bufferLength: input.length,
        preview: input.toString('utf8').substring(0, 50),
      });
      return input.toString('utf8');
    }

    // Handle ArrayBuffer
    if (input instanceof ArrayBuffer) {
      logger.debug('ResponseNormalizer: Converting ArrayBuffer to string', {
        bufferLength: input.byteLength,
      });
      return Buffer.from(input).toString('utf8');
    }

    // Handle Uint8Array and other typed arrays
    if (
      typeof input === 'object' &&
      typeof (input as { constructor?: unknown }).constructor === 'function'
    ) {
      const ctor = (input as { constructor: { name: string } }).constructor;
      const ctorName = ctor.name;
      if (ctor === Uint8Array || (typeof ctorName === 'string' && ctorName.endsWith('Array'))) {
        logger.debug('ResponseNormalizer: Converting typed array to string', {
          arrayType: ctorName,
          length: (input as { length?: number }).length ?? 0,
        });
        return Buffer.from(input as ArrayLike<number>).toString('utf8');
      }
    }

    // Handle complex objects (serialize to JSON)
    if (typeof input === 'object') {
      try {
        const serialized = JSON.stringify(input, null, 2);
        logger.debug('ResponseNormalizer: Serialized object to JSON', {
          originalType: typeof input,
          serializedLength: serialized.length,
        });
        return serialized;
      } catch (error) {
        logger.warn('ResponseNormalizer: Failed to serialize object, using String()', {
          error: error instanceof Error ? error.message : 'Unknown error',
          inputType: typeof input,
        });
        return String(input);
      }
    }

    // Handle primitives
    if (typeof input === 'string') {
      return input;
    }

    // Final fallback - convert to string
    const result = String(input);
    logger.debug('ResponseNormalizer: Converted primitive to string', {
      originalType: typeof input,
      resultLength: result.length,
    });
    return result;
  }

  /**
   * Normalize a complete ModelResponse object
   * Ensures all text fields are properly normalized
   */
  public static normalizeResponse(response: Readonly<ModelResponse>): ModelResponse {
    const normalized = {
      ...response,
      content: this.normalizeToString(response.content),
    };

    // Normalize error field if it exists
    if (response.error) {
      normalized.error = this.normalizeToString(response.error);
    }

    logger.debug('ResponseNormalizer: Normalized complete response', {
      contentType: typeof response.content,
      normalizedContentLength: normalized.content.length,
      hadErrorField: !!response.error,
    });

    return normalized;
  }

  /**
   * Normalize tool execution results
   * Special handling for MCP tool outputs which are often complex objects
   */
  public static normalizeToolResult(result: unknown): string {
    if (!result) return '';

    // Type guard for object with possible output/content fields
    const isObject = (val: unknown): val is { [key: string]: unknown } =>
      typeof val === 'object' && val !== null;

    let content: unknown = result;
    if (isObject(result)) {
      if (isObject(result.output) && 'content' in result.output) {
        const { content: outputContent } = result.output as { content?: unknown };
        content = outputContent;
      } else if ('content' in result) {
        const { content: resultContent } = result as { content?: unknown };
        content = resultContent;
      } else if ('output' in result) {
        content = (result as { output?: unknown }).output;
      }
    }

    // Apply standard normalization
    const normalized = this.normalizeToString(content);

    logger.debug('ResponseNormalizer: Normalized tool result', {
      hasOutput: isObject(result) && 'output' in result,
      hasContent: isObject(result) && 'content' in result,
      originalType: typeof content,
      normalizedLength: normalized.length,
    });

    return normalized;
  }

  /**
   * Validate that a normalized response is actually a string
   * Safety check to catch any normalization failures
   */
  public static validateNormalization(input: unknown, normalized: string): boolean {
    const isValid = typeof normalized === 'string' && normalized.length > 0;

    if (!isValid) {
      logger.error('ResponseNormalizer: Normalization validation failed');
    }

    return isValid;
  }
}
