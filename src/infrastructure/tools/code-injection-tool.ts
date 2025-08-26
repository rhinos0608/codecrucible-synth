import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { logger } from '../logger.js';
import { readFile, writeFile } from 'fs/promises';

export class CodeInjectionTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'codeInjection',
      description: 'Injects a code snippet into a file at a specified location.',
      category: 'File',
      parameters: z.object({
        filePath: z.string().describe('The absolute path to the file to modify.'),
        codeSnippet: z.string().describe('The code snippet to inject.'),
        lineNumber: z.number().optional().describe('The line number to insert the code at.'),
        marker: z.string().optional().describe('A unique marker string to insert the code after.'),
      }),
    });
  }

  async execute(params: {
    filePath: string;
    codeSnippet: string;
    lineNumber?: number;
    marker?: string;
  }): Promise<any> {
    try {
      const { filePath, codeSnippet, lineNumber, marker } = params;
      logger.info(`💉 Injecting code into: ${filePath}`);

      if (!lineNumber && !marker) {
        throw new Error('Either lineNumber or marker must be provided.');
      }

      const fileContent = await readFile(filePath, 'utf-8');
      const lines = fileContent.split('\n');

      if (lineNumber) {
        lines.splice(lineNumber - 1, 0, codeSnippet);
      } else if (marker) {
        const markerIndex = lines.findIndex(line => line.includes(marker));
        if (markerIndex === -1) {
          throw new Error(`Marker "${marker}" not found in file.`);
        }
        lines.splice(markerIndex + 1, 0, codeSnippet);
      }

      const newContent = lines.join('\n');
      await writeFile(filePath, newContent, 'utf-8');

      return { success: true, message: `Code injected into ${filePath}` };
    } catch (error) {
      logger.error('Code injection failed:', error);
      return {
        error: `Code injection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ...params,
      };
    }
  }
}
