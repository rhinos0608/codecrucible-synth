import {
  IModelClient,
  ModelRequest,
  ModelResponse,
  StreamToken,
} from '../../../domain/interfaces/model-client.js';
import { createLogger } from '../../../infrastructure/logging/logger-adapter.js';

const logger = createLogger('StreamingHandler');

/**
 * Execute a model request using streaming and provide real-time token output.
 */
export async function executeWithStreaming(
  modelClient: IModelClient,
  modelRequest: ModelRequest
): Promise<ModelResponse> {
  let accumulatedContent = '';
  let tokenCount = 0;
  const startTime = Date.now();

  try {
    const response = await modelClient.streamRequest(modelRequest, (token: StreamToken) => {
      tokenCount++;

      if (token.content) {
        process.stdout.write(token.content);
        accumulatedContent += token.content;
      }
    });

    if (accumulatedContent) {
      process.stdout.write('\n');
    }

    // Ensure response content is properly populated
    if (!response.content && accumulatedContent) {
      response.content = accumulatedContent;
    }

    const duration = Date.now() - startTime;
    logger.debug('Streaming completed', {
      tokenCount,
      contentLength: accumulatedContent.length,
      duration,
      hasToolCalls: !!response.toolCalls?.length,
    });

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Streaming failed', {
      error: error instanceof Error ? error.message : String(error),
      tokenCount,
      duration,
    });
    throw error;
  }
}

export default executeWithStreaming;
