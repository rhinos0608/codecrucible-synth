import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { RustProviderClient } from '../../../../src/infrastructure/rust/rust-provider-client.js';

describe('RustProviderClient', () => {
  let client: RustProviderClient;
  let getRustModule: jest.Mock;
  let isHealthy: jest.Mock;

  beforeEach(() => {
    client = new RustProviderClient();
    getRustModule = jest.fn();
    isHealthy = jest.fn(() => true);
    // @ts-expect-error overriding for tests
    client.bridgeManager = { getRustModule, isHealthy };
  });

  it('executes file operations via rust module', async () => {
    const mockResponse = { success: true, result: 'ok' };
    const rustModule = {
      executeFilesystem: jest.fn().mockResolvedValue(mockResponse),
    };
    getRustModule.mockReturnValue(rustModule);

    const request = {
      type: 'file-operation',
      operation: 'read',
      path: '/tmp/file.txt',
      content: null,
      options: { encoding: 'utf8' },
    };

    const result = await client.execute(request);
    expect(rustModule.executeFilesystem).toHaveBeenCalledWith('read', '/tmp/file.txt', null, {
      encoding: 'utf8',
    });
    expect(result).toBe(mockResponse);
  });

  it('executes code analysis via rust module', async () => {
    const mockResponse = { success: true, result: { lines: 10 } };
    const rustModule = { execute: jest.fn().mockResolvedValue(mockResponse) };
    getRustModule.mockReturnValue(rustModule);

    const request = { type: 'code-analysis', code: 'let x = 1;' };
    const result = await client.execute(request);

    expect(rustModule.execute).toHaveBeenCalledWith(
      'code-analysis',
      JSON.stringify(request),
      undefined
    );
    expect(result).toBe(mockResponse);
  });

  it('executes compute task via rust module', async () => {
    const mockResponse = { success: true, result: 'done', execution_time_ms: 42 };
    const rustModule = { execute: jest.fn().mockResolvedValue(mockResponse) };
    getRustModule.mockReturnValue(rustModule);

    const request = { type: 'compute-task', taskId: '123', payload: { n: 5 } };
    const result = await client.execute(request);

    expect(rustModule.execute).toHaveBeenCalledWith(
      'compute-task',
      JSON.stringify(request),
      undefined
    );
    expect(result).toBe(mockResponse);
  });
});
