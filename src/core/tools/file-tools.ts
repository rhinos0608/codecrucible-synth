import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { promises as fs } from 'fs';
import { join } from 'path';

const ReadFileSchema = z.object({
  path: z.string().describe('The path to the file to read.'),
});

export class ReadFileTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'readFile',
      description: 'Reads the contents of a file.',
      category: 'File System',
      parameters: ReadFileSchema,
    });
  }

  async execute(args: z.infer<typeof ReadFileSchema>): Promise<string> {
    const fullPath = this.resolvePath(args.path);
    return await fs.readFile(fullPath, 'utf-8');
  }

  private resolvePath(path: string): string {
    // If path is absolute, use it as-is; otherwise join with working directory
    if (path.match(/^[a-zA-Z]:\\/) || path.startsWith('/')) {
      return path;
    }
    return join(this.agentContext.workingDirectory, path);
  }
}

const WriteFileSchema = z.object({
  path: z.string().describe('The path to the file to write.'),
  content: z.string().describe('The content to write to the file.'),
});

export class WriteFileTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'writeFile',
      description: 'Writes content to a file.',
      category: 'File System',
      parameters: WriteFileSchema,
    });
  }

  async execute(args: z.infer<typeof WriteFileSchema>): Promise<void> {
    const fullPath = this.resolvePath(args.path);
    await fs.writeFile(fullPath, args.content);
  }

  private resolvePath(path: string): string {
    // If path is absolute, use it as-is; otherwise join with working directory
    if (path.match(/^[a-zA-Z]:\\/) || path.startsWith('/')) {
      return path;
    }
    return join(this.agentContext.workingDirectory, path);
  }
}

const ListFilesSchema = z.object({
  path: z.string().optional().default('.').describe('The path to the directory to list. Defaults to current directory.'),
});

export class ListFilesTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'listFiles',
      description: 'Lists the files in a directory.',
      category: 'File System',
      parameters: ListFilesSchema,
    });
  }

  async execute(args: z.infer<typeof ListFilesSchema>): Promise<string[]> {
    const fullPath = this.resolvePath(args.path || '.');
    return await fs.readdir(fullPath);
  }

  private resolvePath(path: string): string {
    // If path is absolute, use it as-is; otherwise join with working directory
    if (path.match(/^[a-zA-Z]:\\/) || path.startsWith('/')) {
      return path;
    }
    return join(this.agentContext.workingDirectory, path);
  }
}