import { ModelResponse } from '../../domain/interfaces/model-client.js';
import { logger } from '../../infrastructure/logging/unified-logger.js';

export interface ResponseHandler {
  parse: (raw: unknown, provider: string) => ModelResponse;
  handleError: (error: unknown) => never;
}

export class BasicResponseHandler implements ResponseHandler {
  public parse(raw: unknown, provider: string): ModelResponse {
    const hasProp = <T extends object>(obj: T, prop: string): boolean =>
      Object.prototype.hasOwnProperty.call(obj, prop);

    logger.debug('ResponseHandler parsing response', {
      provider,
      responseType: typeof raw,
      hasContent: typeof raw === 'object' && raw !== null && hasProp(raw, 'content'),
      hasResponse: typeof raw === 'object' && raw !== null && hasProp(raw, 'response'),
      hasText: typeof raw === 'object' && raw !== null && hasProp(raw, 'text'),
      isString: typeof raw === 'string',
    });

    // Handle direct ModelResponse objects
    if (
      raw &&
      typeof raw === 'object' &&
      hasProp(raw, 'content') &&
      hasProp(raw, 'model')
    ) {
      const contentVal =
        typeof (raw as { content?: unknown }).content === 'string'
          ? (raw as { content?: string }).content
          : undefined;

      // Validate that content is not empty
      if (
        !(raw as { content?: unknown }).content ||
        (typeof contentVal === 'string' && contentVal.trim().length === 0)
      ) {
        logger.warn('ResponseHandler received ModelResponse with empty content', {
          provider,
          hasToolCalls:
            typeof (raw as { toolCalls?: unknown[] }).toolCalls !== 'undefined' &&
            Array.isArray((raw as { toolCalls?: unknown[] }).toolCalls) &&
            ((raw as { toolCalls?: unknown[] }).toolCalls?.length ?? 0) > 0,
          responseKeys: Object.keys(raw),
        });

        // If we have tool calls but no content, that's potentially valid
        if (
          !(
            typeof (raw as { toolCalls?: unknown[] }).toolCalls !== 'undefined' &&
            Array.isArray((raw as { toolCalls?: unknown[] }).toolCalls) &&
            ((raw as { toolCalls?: unknown[] }).toolCalls?.length ?? 0) > 0
          )
        ) {
          throw new Error(
            `${provider} returned empty response content. The model may not be responding correctly.`
          );
        }
      }

      return raw as ModelResponse;
    }

    // Try to extract content from various response formats
    let content = '';
    if (typeof raw === 'string') {
      content = raw;
    } else if (raw && typeof raw === 'object') {
      // Use type assertion to index signature for safe property access
      const rawObj = raw as Record<string, unknown>;

      // Handle nested message objects
      if (
        typeof rawObj.message === 'object' &&
        rawObj.message !== null
      ) {
        const msg = rawObj.message as Record<string, unknown>;
        content =
          (typeof msg.content === 'string' && msg.content) ||
          (typeof msg.text === 'string' && msg.text) ||
          (typeof msg.response === 'string' && msg.response) ||
          '';
      } else {
        content =
          (typeof rawObj.content === 'string' && rawObj.content) ||
          (typeof rawObj.text === 'string' && rawObj.text) ||
          (typeof rawObj.response === 'string' && rawObj.response) ||
          (typeof rawObj.message === 'string' && rawObj.message) ||
          '';
      }

      // If content is still an object, try to extract from it
      if (content && typeof content === 'object') {
        const contentObj = content as Record<string, unknown>;
        content =
          (typeof contentObj.content === 'string' && contentObj.content) ||
          (typeof contentObj.text === 'string' && contentObj.text) ||
          (typeof contentObj.response === 'string' && contentObj.response) ||
          JSON.stringify(content);
      }
    } else {
      content = String(raw || '');
    }

    // Validate that we have meaningful content - but allow empty content if tool calls are present
    if (!content || content.trim().length === 0) {
      let hasToolCalls = false;
      if (raw && typeof raw === 'object') {
        const rawObj = raw as Record<string, unknown>;
        if (
          Array.isArray(rawObj.toolCalls) &&
          rawObj.toolCalls.length > 0
        ) {
          hasToolCalls = true;
        }
      }

      if (hasToolCalls) {
        logger.debug('ResponseHandler: empty content but tool calls present - proceeding', {
          provider,
          toolCallCount:
            (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).toolCalls))
              ? ((raw as Record<string, unknown>).toolCalls as unknown[]).length
              : 0,
        });
        content = ''; // Explicitly set to empty string for tool-only responses
      } else {
        logger.error('ResponseHandler could not extract content from response', {
          provider,
          responseType: typeof raw,
          responseKeys: raw && typeof raw === 'object' ? Object.keys(raw) : 'N/A',
        });
        throw new Error(
          `${provider} returned no usable content. Check service availability and model configuration.`
        );
      }
    }

    logger.debug('ResponseHandler extracted content', {
      provider,
      contentLength: content.length,
      contentPreview: content.substring(0, 100),
    });

    const rawObj = (raw ?? {}) as Record<string, unknown>;

    return {
      id: typeof rawObj.id === 'string' ? rawObj.id : `resp_${Date.now()}`,
      content,
      model: typeof rawObj.model === 'string' ? rawObj.model : 'unknown',
      provider,
      usage: rawObj.usage as ModelResponse['usage'],
      responseTime: rawObj.responseTime as ModelResponse['responseTime'],
      finishReason: rawObj.finishReason as ModelResponse['finishReason'],
      toolCalls: rawObj.toolCalls as ModelResponse['toolCalls'],
    };
  }

  public handleError(error: unknown): never {
    if (error instanceof Error) {
      logger.error('ResponseHandler error:', error);
      throw error;
    }
    const errorMessage = String(error);
    logger.error('ResponseHandler unknown error:', errorMessage);
    throw new Error(errorMessage);
  }
}
