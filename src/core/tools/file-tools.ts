import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { promises as fs } from 'fs';
import { join, relative, isAbsolute } from 'path';

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
    // Validate input parameters
    if (!args || !args.path || args.path.trim() === '') {
      return `Error: Path parameter is required for readFile tool. Received: ${JSON.stringify(args)}`;
    }

    const fullPath = this.resolvePath(args.path);
    
    // Check if file exists before trying to read
    try {
      await fs.access(fullPath);
    } catch (error) {
      return `Error: File not found at path '${args.path}' (resolved to '${fullPath}'). Please verify the file exists.`;
    }
    
    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      return `Error reading file '${args.path}': ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private resolvePath(path: string): string {
    // Convert to relative path to comply with MCP workspace restrictions
    let resolvedPath = path;
    
    // If path is absolute, convert to relative to working directory
    if (isAbsolute(path)) {
      try {
        resolvedPath = relative(this.agentContext.workingDirectory, path);
        // If relative path starts with '..' it's outside working directory
        if (resolvedPath.startsWith('..')) {
          throw new Error(`Path ${path} is outside working directory`);
        }
      } catch (error) {
        // Fallback to using the path as-is but log the issue
        console.warn(`⚠️  Path conversion warning: ${error instanceof Error ? error.message : 'Unknown error'}`);
        resolvedPath = path;
      }
    }
    
    // Join with working directory to ensure proper resolution
    return join(this.agentContext.workingDirectory, resolvedPath);
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
    // Convert to relative path to comply with MCP workspace restrictions
    let resolvedPath = path;
    
    // If path is absolute, convert to relative to working directory
    if (isAbsolute(path)) {
      try {
        resolvedPath = relative(this.agentContext.workingDirectory, path);
        // If relative path starts with '..' it's outside working directory
        if (resolvedPath.startsWith('..')) {
          throw new Error(`Path ${path} is outside working directory`);
        }
      } catch (error) {
        // Fallback to using the path as-is but log the issue
        console.warn(`⚠️  Path conversion warning: ${error instanceof Error ? error.message : 'Unknown error'}`);
        resolvedPath = path;
      }
    }
    
    // Join with working directory to ensure proper resolution
    return join(this.agentContext.workingDirectory, resolvedPath);
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
    // Convert to relative path to comply with MCP workspace restrictions
    let resolvedPath = path;
    
    // If path is absolute, convert to relative to working directory
    if (isAbsolute(path)) {
      try {
        resolvedPath = relative(this.agentContext.workingDirectory, path);
        // If relative path starts with '..' it's outside working directory
        if (resolvedPath.startsWith('..')) {
          throw new Error(`Path ${path} is outside working directory`);
        }
      } catch (error) {
        // Fallback to using the path as-is but log the issue
        console.warn(`⚠️  Path conversion warning: ${error instanceof Error ? error.message : 'Unknown error'}`);
        resolvedPath = path;
      }
    }
    
    // Join with working directory to ensure proper resolution
    return join(this.agentContext.workingDirectory, resolvedPath);
  }
}