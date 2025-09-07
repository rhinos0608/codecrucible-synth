import { StreamingManager } from '../../../../src/application/services/orchestrator/streaming-manager.js';
import type {
  IModelClient,
  ModelRequest,
  ModelResponse,
} from '../../../../src/domain/interfaces/model-client.js';

jest.mock('../../../../src/application/services/orchestrator/streaming-handler.js', () => ({
  executeWithStreaming: jest.fn(async () => ({ content: 'ok' }) as ModelResponse),
}));

const { executeWithStreaming } = jest.requireMock(
  '../../../../src/application/services/orchestrator/streaming-handler.js'
) as { executeWithStreaming: jest.Mock };

describe('StreamingManager', () => {
  it('delegates to executeWithStreaming', async () => {
    const manager = new StreamingManager();
    const mockClient = {} as IModelClient;
    const request = { stream: true } as ModelRequest;
    await manager.stream(mockClient, request);
    expect(executeWithStreaming).toHaveBeenCalledWith(mockClient, request);
  });
});
