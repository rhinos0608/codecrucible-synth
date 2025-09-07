import type { IModelClient, ModelRequest, ModelResponse } from './model-client.js';

export interface IStreamingManager {
  stream(modelClient: IModelClient, request: ModelRequest): Promise<ModelResponse>;
}
