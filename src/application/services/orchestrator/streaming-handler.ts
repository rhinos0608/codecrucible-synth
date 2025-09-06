import {
  IModelClient,
  ModelRequest,
  ModelResponse,
  StreamToken,
} from '../../../domain/interfaces/model-client.js';
import { logger } from '../../../infrastructure/logging/logger.js';

/**
 * Execute a model request using streaming and provide real-time token output.
 */
export async function executeWithStreaming(
  modelClient: IModelClient,
  modelRequest: ModelRequest
): Promise<ModelResponse> {
  let displayedContent = '';
  let tokenCount = 0;

  const response = await modelClient.streamRequest(modelRequest, (token: StreamToken) => {
    tokenCount++;
    logger.debug(`📝 Token ${tokenCount}: "${token.content}" (complete: ${token.isComplete})`);
    // Display all tokens with content, including the final one
    if (token.content) {
      process.stdout.write(token.content);
      displayedContent += token.content;
    }
  });

  if (displayedContent) {
    process.stdout.write('\n');
  }

  // CRITICAL DEBUG: Log the complete response structure to understand tool calls preservation
  logger.info('🔍 DEBUGGING: Streaming handler received response:', {
    responseKeys: Object.keys(response || {}),
    hasToolCalls: !!response.toolCalls,
    toolCallsLength: response.toolCalls?.length || 0,
    responseContent: response.content || 'NO CONTENT',
    responseContentLength: (response.content || '').length,
    displayedContentLength: displayedContent.length,
  });

  if (response.toolCalls && response.toolCalls.length > 0) {
    logger.info('🔧 DEBUGGING: Tool calls detected in streaming response:', {
      toolCalls: response.toolCalls.map(tc => ({ id: tc.id, functionName: tc.function?.name })),
    });
  }

  logger.info(
    `✅ Streaming response completed: ${tokenCount} tokens, ${displayedContent.length} chars total, final content length: ${response.content?.length || 0}`
  );

  if (!response.content && displayedContent) {
    logger.info('🔧 Fixing response content from displayed content');
    response.content = displayedContent;
  }

  return response;
}

export default executeWithStreaming;
