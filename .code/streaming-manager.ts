import type {
  IModelClient,
  ModelRequest,
  ModelResponse,
} from '../../../domain/interfaces/model-client.js';
import type { IStreamingManager } from '../../../domain/interfaces/streaming-manager.js';
import { executeWithStreaming } from './streaming-handler.js';

/**
 * StreamingManager delegates streaming execution for model requests.
 */
export class StreamingManager implements IStreamingManager {
  async stream(modelClient: IModelClient, request: ModelRequest): Promise<ModelResponse> {
    return executeWithStreaming(modelClient, request);
  }
}

