import { ModelRequest, StreamToken } from '../../domain/interfaces/model-client.js';
import { ProviderAdapter } from './provider-adapters.js';

export interface StreamingManager {
  stream(adapter: ProviderAdapter, request: ModelRequest): AsyncIterable<StreamToken>;
}

export class BasicStreamingManager implements StreamingManager {
  async *stream(adapter: ProviderAdapter, request: ModelRequest): AsyncIterable<StreamToken> {
    if (!adapter.stream) {
      const result = await adapter.request(request);
      yield {
        content: result.content,
        isComplete: true,
        metadata: { model: result.model },
        index: 0,
        timestamp: Date.now(),
      };
      return;
    }
    for await (const token of adapter.stream(request)) {
      yield token;
    }
  }
}
