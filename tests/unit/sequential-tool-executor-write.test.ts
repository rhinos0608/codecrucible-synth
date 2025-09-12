import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { SequentialToolExecutor } from '../../src/infrastructure/tools/sequential-tool-executor.js';
import { unifiedToolRegistry } from '../../src/infrastructure/tools/unified-tool-registry.js';

describe('SequentialToolExecutor file write', () => {
  it('writes a file using registry tool', async () => {
    const tmpFile = path.join(os.tmpdir(), 'sequential-executor-test.txt');

    unifiedToolRegistry.registerTool({
      id: 'filesystem_write_file',
      name: 'filesystem_write_file',
      description: 'Write content to a file',
      category: 'filesystem',
      aliases: [],
      inputSchema: {},
      handler: async (args: Readonly<Record<string, unknown>>): Promise<unknown> => {
        const filePath = args.file_path as string;
        const content = args.content as string;
        await fs.writeFile(filePath, content, 'utf8');
        return { success: true };
      },
      security: { requiresApproval: false, riskLevel: 'low', allowedOrigins: ['*'] },
      performance: { estimatedDuration: 0, memoryUsage: 'low', cpuIntensive: false },
    });

    const executor = new SequentialToolExecutor();

    const modelClient = {
      generateText: async () =>
        `THOUGHT: write file\nACTION: filesystem_write_file\nARGS: {"file_path":"${tmpFile}","content":"hello world"}\nCONFIDENCE: 0.9\nCOMPLETE: YES\nCONCLUSION: done`,
    };

    const availableTools = unifiedToolRegistry.getAllTools().map(def => ({
      name: def.name,
      function: { name: def.name, description: def.description },
    }));

    const result = await executor.executeWithReasoning(
      'write file',
      availableTools,
      modelClient,
      3
    );

    const content = await fs.readFile(tmpFile, 'utf8');
    expect(content).toBe('hello world');
    expect(result.success).toBe(true);
  });
});
