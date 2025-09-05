import { ModelResponse } from '../../domain/interfaces/model-client.js';
import { logger } from '../../infrastructure/logging/unified-logger.js';

export interface ResponseHandler {
  parse(raw: any, provider: string): ModelResponse;
  handleError(error: unknown): never;
}

export class BasicResponseHandler implements ResponseHandler {
  parse(raw: any, provider: string): ModelResponse {
    logger.debug('ResponseHandler parsing response', {
      provider,
      responseType: typeof raw,
      hasContent: !!(raw?.content),
      hasResponse: !!(raw?.response),
      hasText: !!(raw?.text),
      isString: typeof raw === 'string',
    });
    
    // Handle direct ModelResponse objects
    if (raw && typeof raw === 'object' && 'content' in raw && 'model' in raw) {
      // Validate that content is not empty
      if (!raw.content || (typeof raw.content === 'string' && raw.content.trim().length === 0)) {
        logger.warn('ResponseHandler received ModelResponse with empty content', {
          provider,
          hasToolCalls: !!raw.toolCalls?.length,
          responseKeys: Object.keys(raw),
        });
        
        // If we have tool calls but no content, that's potentially valid
        if (!raw.toolCalls?.length) {
          throw new Error(`${provider} returned empty response content. The model may not be responding correctly.`);
        }
      }
      
      return raw as ModelResponse;
    }
    
    // Try to extract content from various response formats
    let content = '';
    if (typeof raw === 'string') {
      content = raw;
    } else if (raw && typeof raw === 'object') {
      content = raw.content || raw.text || raw.response || raw.message || '';
    } else {
      content = String(raw || '');
    }
    
    // Validate that we have meaningful content
    if (!content || content.trim().length === 0) {
      logger.error('ResponseHandler could not extract content from response', {
        provider,
        responseType: typeof raw,
        responseKeys: raw && typeof raw === 'object' ? Object.keys(raw) : 'N/A',
      });
      throw new Error(`${provider} returned no usable content. Check service availability and model configuration.`);
    }
    
    logger.debug('ResponseHandler extracted content', {
      provider,
      contentLength: content.length,
      contentPreview: content.substring(0, 100),
    });
    
    return {
      id: raw?.id || `resp_${Date.now()}`,
      content,
      model: raw?.model || 'unknown',
      provider,
      usage: raw?.usage,
      responseTime: raw?.responseTime,
      finishReason: raw?.finishReason,
      toolCalls: raw?.toolCalls,
    };
  }

  handleError(error: unknown): never {
    if (error instanceof Error) {
      logger.error('ResponseHandler error:', error);
      throw error;
    }
    const errorMessage = String(error);
    logger.error('ResponseHandler unknown error:', errorMessage);
    throw new Error(errorMessage);
  }
}
