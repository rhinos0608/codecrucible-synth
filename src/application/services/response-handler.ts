import { ModelResponse } from '../../domain/interfaces/model-client.js';

export interface ResponseHandler {
  parse(raw: any, provider: string): ModelResponse;
  handleError(error: unknown): never;
}

export class BasicResponseHandler implements ResponseHandler {
  parse(raw: any, provider: string): ModelResponse {
    if (raw && typeof raw === 'object' && 'content' in raw && 'model' in raw) {
      return raw as ModelResponse;
    }
    return {
      id: raw?.id || `resp_${Date.now()}`,
      content: raw?.text || raw?.response || String(raw),
      model: raw?.model || 'unknown',
      provider,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-throw-literal
  handleError(error: unknown): never {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error));
  }
}
