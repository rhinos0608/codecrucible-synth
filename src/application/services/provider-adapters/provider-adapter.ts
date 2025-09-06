import {
  ModelRequest,
  ModelResponse,
  StreamToken,
} from '../../../domain/interfaces/model-client.js';

export interface ProviderAdapter {
  readonly name: string;
  request(req: ModelRequest): Promise<ModelResponse>;
  stream?(req: ModelRequest): AsyncIterable<StreamToken>;
  getModels?(): Promise<string[]>;
}
