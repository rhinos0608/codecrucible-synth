
import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { logger } from '../logger.js';
import { writeFile } from 'fs/promises';

export class CodeWriterTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'codeWriter',
      description: 'Writes a complete file with the given content.',
      category: 'File',
      parameters: z.object({
        filePath: z.string().describe('The absolute path to the file to write.'),
        content: z.string().describe('The content to write to the file.'),
      }),
    });
  }

  async execute(params: { filePath: string; content: string }): Promise<any> {
    try {
      const { filePath, content } = params;
      logger.info(`✍️ Writing code to: ${filePath}`);

      await writeFile(filePath, content, 'utf-8');

      return { success: true, message: `Code written to ${filePath}` };
    } catch (error) {
      logger.error('Code writing failed:', error);
      return {
        error: `Code writing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ...params,
      };
    }
  }
}
