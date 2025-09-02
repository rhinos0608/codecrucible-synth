import { ModelRequest } from '../../domain/interfaces/model-client.js';

export interface RequestProcessor {
  process(request: ModelRequest): ModelRequest;
}

export class BasicRequestProcessor implements RequestProcessor {
  process(request: ModelRequest): ModelRequest {
    if (!request.prompt && (!request.messages || request.messages.length === 0)) {
      throw new Error('ModelRequest requires a prompt or messages');
    }
    const processed: ModelRequest = {
      ...request,
      temperature: request.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? 1024,
    };
    if (processed.prompt) {
      processed.prompt = processed.prompt.trim();
    }
    return processed;
  }
}
