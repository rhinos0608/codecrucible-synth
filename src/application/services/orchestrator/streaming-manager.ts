import {
  IModelClient,
  ModelRequest,
  ModelResponse,
} from '../../../domain/interfaces/model-client.js';
import { executeWithStreaming } from './streaming-handler.js';

/**
 * StreamingManager delegates streaming execution for model requests.
 */
export class StreamingManager {
  async stream(modelClient: IModelClient, request: ModelRequest): Promise<ModelResponse> {
    return executeWithStreaming(modelClient, request);
  }
}
