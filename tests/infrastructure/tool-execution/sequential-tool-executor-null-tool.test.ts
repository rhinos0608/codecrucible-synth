import {
  SequentialToolExecutor,
  Tool,
  ModelClient,
} from '../../../src/infrastructure/tools/sequential-tool-executor.js';

describe('SequentialToolExecutor null tool handling', () => {
  it('retries reasoning when no tool is selected and then stops after max retries', async () => {
    const executor = new SequentialToolExecutor();
    const mockGenerateText = jest
      .fn<
        Promise<string>,
        [string, { temperature?: number; maxTokens?: number; tools?: unknown[] }]
      >()
      .mockResolvedValueOnce(
        'THOUGHT: t1\nACTION: NONE\nARGS: {}\nCONFIDENCE: 0.5\nCOMPLETE: NO\nCONCLUSION: N/A'
      )
      .mockResolvedValueOnce(
        'THOUGHT: t2\nACTION: NONE\nARGS: {}\nCONFIDENCE: 0.5\nCOMPLETE: NO\nCONCLUSION: N/A'
      )
      .mockResolvedValueOnce(
        'THOUGHT: t3\nACTION: NONE\nARGS: {}\nCONFIDENCE: 0.5\nCOMPLETE: NO\nCONCLUSION: N/A'
      );

    const modelClient: ModelClient = { generateText: mockGenerateText };
    const tools: Tool[] = [
      { name: 'dummy_tool', function: { name: 'dummy_tool', description: '' } },
    ];

    const result = await executor.executeWithReasoning('do something', tools, modelClient, 10);

    expect(mockGenerateText).toHaveBeenCalledTimes(3);
    const conclusion = result.reasoningChain[result.reasoningChain.length - 1];
    expect(conclusion.type).toBe('conclusion');
    expect(conclusion.content).toContain('No tool selected after retries');
  });

  it('retries once and executes tool when second reasoning selects a tool', async () => {
    const executor = new SequentialToolExecutor();
    const mockGenerateText = jest
      .fn<
        Promise<string>,
        [string, { temperature?: number; maxTokens?: number; tools?: unknown[] }]
      >()
      .mockResolvedValueOnce(
        'THOUGHT: first\nACTION: NONE\nARGS: {}\nCONFIDENCE: 0.5\nCOMPLETE: NO\nCONCLUSION: N/A'
      )
      .mockResolvedValueOnce(
        'THOUGHT: second\nACTION: dummy_tool\nARGS: {"value":1}\nCONFIDENCE: 0.9\nCOMPLETE: YES\nCONCLUSION: done'
      );

    const modelClient: ModelClient = { generateText: mockGenerateText };
    const tools: Tool[] = [
      { name: 'dummy_tool', function: { name: 'dummy_tool', description: '' } },
    ];

    const executeSpy = jest
      .spyOn(
        executor as unknown as {
          executeToolWithRetries: (
            tool: Tool,
            args: unknown,
            available: readonly Tool[]
          ) => Promise<{ result: unknown; success: boolean }>;
        },
        'executeToolWithRetries'
      )
      .mockResolvedValue({ result: 'ok', success: true });

    const result = await executor.executeWithReasoning('do something', tools, modelClient, 10);

    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    expect(executeSpy).toHaveBeenCalled();
    expect(result.success).toBe(true);

    executeSpy.mockRestore();
  });
});
