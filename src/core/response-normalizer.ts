import { logger } from './logger.js';
import { ModelResponse } from './types.js';

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
  static normalizeToString(input: any): string {
    if (!input && input !== 0 && input !== false) return '';
    
    // Handle Buffer types (primary cause of "string 58" issue)
    if (Buffer.isBuffer(input)) {
      logger.debug('ResponseNormalizer: Converting Buffer to string', {
        bufferLength: input.length,
        preview: input.toString('utf8').substring(0, 50)
      });
      return input.toString('utf8');
    }
    
    // Handle ArrayBuffer
    if (input instanceof ArrayBuffer) {
      logger.debug('ResponseNormalizer: Converting ArrayBuffer to string', {
        bufferLength: input.byteLength
      });
      return Buffer.from(input).toString('utf8');
    }
    
    // Handle Uint8Array and other typed arrays
    if (input && typeof input === 'object' && input.constructor && 
        (input.constructor === Uint8Array || input.constructor.name.endsWith('Array'))) {
      logger.debug('ResponseNormalizer: Converting typed array to string', {
        arrayType: input.constructor.name,
        length: input.length
      });
      return Buffer.from(input).toString('utf8');
    }
    
    // Handle complex objects (serialize to JSON)
    if (typeof input === 'object' && input !== null) {
      try {
        const serialized = JSON.stringify(input, null, 2);
        logger.debug('ResponseNormalizer: Serialized object to JSON', {
          originalType: typeof input,
          serializedLength: serialized.length
        });
        return serialized;
      } catch (error) {
        logger.warn('ResponseNormalizer: Failed to serialize object, using String()', {
          error: error instanceof Error ? error.message : 'Unknown error',
          inputType: typeof input
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
      resultLength: result.length
    });
    return result;
  }

  /**
   * Normalize a complete ModelResponse object
   * Ensures all text fields are properly normalized
   */
  static normalizeResponse(response: ModelResponse): ModelResponse {
    const normalized = {
      ...response,
      content: this.normalizeToString(response.content)
    };

    // Normalize error field if it exists
    if (response.error) {
      normalized.error = this.normalizeToString(response.error);
    }

    logger.debug('ResponseNormalizer: Normalized complete response', {
      contentType: typeof response.content,
      normalizedContentLength: normalized.content.length,
      hadErrorField: !!response.error
    });

    return normalized;
  }

  /**
   * Normalize tool execution results
   * Special handling for MCP tool outputs which are often complex objects
   */
  static normalizeToolResult(result: any): string {
    if (!result) return '';

    // Handle tool results with nested content structures
    const content = result.output?.content || result.content || result.output || result;
    
    // Apply standard normalization
    const normalized = this.normalizeToString(content);
    
    logger.debug('ResponseNormalizer: Normalized tool result', {
      hasOutput: !!result.output,
      hasContent: !!result.content,
      originalType: typeof content,
      normalizedLength: normalized.length
    });
    
    return normalized;
  }

  /**
   * Validate that a normalized response is actually a string
   * Safety check to catch any normalization failures
   */
  static validateNormalization(input: any, normalized: string): boolean {
    const isValid = typeof normalized === 'string' && normalized.length > 0;
    
    if (!isValid) {
      logger.error('ResponseNormalizer: Normalization validation failed', {
        inputType: typeof input,
        normalizedType: typeof normalized,
        normalizedLength: normalized?.length || 0,
        inputPreview: String(input).substring(0, 100)
      });
    }
    
    return isValid;
  }
}