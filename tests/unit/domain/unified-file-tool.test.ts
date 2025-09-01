import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { UnifiedFileTool } from '../../../src/domain/tools/unified-file-tool.js';
import { ToolExecutionContext } from '../../../src/domain/interfaces/tool-system.js';

let rootDir: string;
let outsideFile: string;
let context: ToolExecutionContext;
let tool: UnifiedFileTool;

beforeAll(async () => {
  rootDir = await fs.mkdtemp(join(tmpdir(), 'uft-root-'));
  await fs.writeFile(join(rootDir, 'inside.txt'), 'inside');
  outsideFile = join(rootDir, '..', 'outside.txt');
  await fs.writeFile(outsideFile, 'outside');

  tool = new UnifiedFileTool({ workingDirectory: rootDir });
  context = {
    sessionId: 'test',
    workingDirectory: rootDir,
    rootDirectory: rootDir,
    securityLevel: 'low',
    permissions: [],
    environment: {},
  };
});

afterAll(async () => {
  await fs.rm(rootDir, { recursive: true, force: true });
  await fs.rm(outsideFile, { force: true });
});

describe('UnifiedFileTool path restrictions', () => {
  test('allows access within root directory', async () => {
    const result = await tool.execute({ operation: 'read', path: 'inside.txt' }, context);
    expect(result.success).toBe(true);
  });

  test('rejects access outside root directory', async () => {
    const result = await tool.execute({ operation: 'read', path: outsideFile }, context);
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('outside of root directory');
  });
});
