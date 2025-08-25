/**
 * Filesystem Tools for AI Model Function Calling
 * Provides secure file system operations that AI models can use
 */

import {
  Tool,
  ToolCategory,
  ToolMetadata,
  ToolContext,
  ToolResult,
} from './advanced-tool-orchestrator.js';
import { MCPServerManager } from '../../mcp-servers/mcp-server-manager.js';
import { Logger } from '../logger.js';
import { join, relative, resolve } from 'path';

const logger = new Logger('FilesystemTools');

export class FilesystemTools {
  private mcpManager: MCPServerManager;

  constructor(mcpManager: MCPServerManager) {
    this.mcpManager = mcpManager;
  }

  /**
   * Get all filesystem tools
   */
  getTools(): Tool[] {
    return [
      this.createReadFileTool(),
      this.createWriteFileTool(),
      this.createListDirectoryTool(),
      this.createFileStatsTool(),
      this.createFindFilesTool(),
    ];
  }

  private createReadFileTool(): Tool {
    return {
      id: 'filesystem_read_file',
      name: 'Read File',
      description: 'Read the contents of a text file',
      category: ToolCategory.FILE_SYSTEM,
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file to read (relative to project root)',
          },
        },
        required: ['filePath'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          filePath: { type: 'string' },
          size: { type: 'number' },
        },
      },
      execute: async (input: any, context: ToolContext): Promise<ToolResult> => {
        try {
          // CRITICAL FIX: Input validation to prevent undefined errors
          if (!input || typeof input !== 'object') {
            throw new Error(`Invalid input object: ${JSON.stringify(input)}`);
          }
          if (!input.filePath) {
            throw new Error(`Missing required parameter 'filePath' in input: ${JSON.stringify(input)}`);
          }

          const absolutePath = this.resolvePath(input.filePath);
          const content = await this.mcpManager.readFileSecure(absolutePath);

          return {
            toolId: 'filesystem_read_file',
            success: true,
            output: {
              content,
              filePath: input.filePath,
              size: content.length,
            },
            metadata: {
              executionTime: Date.now() - Date.now(),
              memoryUsed: content.length,
              cost: 1,
              version: '1.0.0',
            },
          };
        } catch (error) {
          return {
            toolId: 'filesystem_read_file',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            metadata: {
              executionTime: Date.now() - Date.now(),
              memoryUsed: 0,
              cost: 1,
              version: '1.0.0',
            },
          };
        }
      },
      metadata: this.createMetadata('filesystem', 1, 100, 0.95),
    };
  }

  private createWriteFileTool(): Tool {
    return {
      id: 'filesystem_write_file',
      name: 'Write File',
      description: 'Write content to a text file',
      category: ToolCategory.FILE_SYSTEM,
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file to write (relative to project root)',
          },
          content: {
            type: 'string',
            description: 'Content to write to the file',
          },
        },
        required: ['filePath', 'content'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          filePath: { type: 'string' },
          bytesWritten: { type: 'number' },
        },
      },
      execute: async (input: any, context: ToolContext): Promise<ToolResult> => {
        try {
          const absolutePath = this.resolvePath(input.filePath);
          await this.mcpManager.writeFileSecure(absolutePath, input.content);

          return {
            toolId: 'filesystem_write_file',
            success: true,
            output: {
              success: true,
              filePath: input.filePath,
              bytesWritten: input.content.length,
            },
            metadata: {
              executionTime: 200,
              memoryUsed: input.content.length,
              cost: 2,
              version: '1.0.0',
            },
          };
        } catch (error) {
          return {
            toolId: 'filesystem_write_file',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            metadata: {
              executionTime: 100,
              memoryUsed: 0,
              cost: 2,
              version: '1.0.0',
            },
          };
        }
      },
      metadata: this.createMetadata('filesystem', 2, 200, 0.95, ['filesystem_read_file']),
    };
  }

  private createListDirectoryTool(): Tool {
    return {
      id: 'filesystem_list_directory',
      name: 'List Directory',
      description: 'List files and directories in a given path',
      category: ToolCategory.FILE_SYSTEM,
      inputSchema: {
        type: 'object',
        properties: {
          dirPath: {
            type: 'string',
            description:
              'Path to the directory to list (relative to project root, defaults to current directory)',
            default: '.',
          },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: { type: 'string' },
          },
          dirPath: { type: 'string' },
        },
      },
      execute: async (input: any, context: ToolContext): Promise<ToolResult> => {
        try {
          const dirPath = input.dirPath || '.';
          const absolutePath = this.resolvePath(dirPath);
          const files = await this.mcpManager.listDirectorySecure(absolutePath);

          return {
            toolId: 'filesystem_list_directory',
            success: true,
            output: {
              files,
              dirPath,
            },
            metadata: {
              executionTime: 50,
              memoryUsed: files.length * 50,
              cost: 1,
              version: '1.0.0',
            },
          };
        } catch (error) {
          return {
            toolId: 'filesystem_list_directory',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            metadata: {
              executionTime: 50,
              memoryUsed: 0,
              cost: 1,
              version: '1.0.0',
            },
          };
        }
      },
      metadata: this.createMetadata('filesystem', 1, 50, 0.98),
    };
  }

  private createFileStatsTool(): Tool {
    return {
      id: 'filesystem_file_stats',
      name: 'Get File Stats',
      description: 'Get detailed information about a file or directory',
      category: ToolCategory.FILE_SYSTEM,
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file or directory',
          },
        },
        required: ['filePath'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          exists: { type: 'boolean' },
          isFile: { type: 'boolean' },
          isDirectory: { type: 'boolean' },
          size: { type: 'number' },
          modified: { type: 'string' },
        },
      },
      execute: async (input: any, context: ToolContext): Promise<ToolResult> => {
        try {
          const absolutePath = this.resolvePath(input.filePath);
          const stats = await this.mcpManager.getFileStats(absolutePath);

          return {
            toolId: 'filesystem_file_stats',
            success: true,
            output: stats,
            metadata: {
              executionTime: 30,
              memoryUsed: 100,
              cost: 1,
              version: '1.0.0',
            },
          };
        } catch (error) {
          return {
            toolId: 'filesystem_file_stats',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            metadata: {
              executionTime: 30,
              memoryUsed: 0,
              cost: 1,
              version: '1.0.0',
            },
          };
        }
      },
      metadata: this.createMetadata('filesystem', 1, 30, 0.99),
    };
  }

  private createFindFilesTool(): Tool {
    return {
      id: 'filesystem_find_files',
      name: 'Find Files',
      description: 'Find files matching a pattern in the project',
      category: ToolCategory.FILE_SYSTEM,
      inputSchema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'File pattern to search for (e.g., "*.ts", "src/**/*.js")',
          },
          directory: {
            type: 'string',
            description: 'Directory to search in (defaults to project root)',
            default: '.',
          },
        },
        required: ['pattern'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: { type: 'string' },
          },
          count: { type: 'number' },
        },
      },
      execute: async (input: any, context: ToolContext): Promise<ToolResult> => {
        const startTime = Date.now();
        try {
          const directory = input.directory || '.';
          const absolutePath = this.resolvePath(directory);
          const files = await this.findFiles(absolutePath, input.pattern);

          return {
            toolId: 'filesystem_find_files',
            success: true,
            output: {
              files,
              count: files.length,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              memoryUsed: files.length * 100,
              cost: 3,
              version: '1.0.0',
            },
          };
        } catch (error) {
          return {
            toolId: 'filesystem_find_files',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            metadata: {
              executionTime: Date.now() - startTime,
              memoryUsed: 0,
              cost: 3,
              version: '1.0.0',
            },
          };
        }
      },
      metadata: this.createMetadata('filesystem', 3, 500, 0.9, ['filesystem_list_directory']),
    };
  }

  private resolvePath(inputPath: string): string {
    // CRITICAL FIX: Input validation to prevent undefined errors
    if (!inputPath || typeof inputPath !== 'string') {
      const error = `Invalid file path: ${inputPath} (type: ${typeof inputPath})`;
      logger.error(`❌ FILESYSTEM TOOLS: ${error}`);
      throw new Error(error);
    }

    // Resolve relative to current working directory
    if (inputPath.startsWith('./') || inputPath.startsWith('../') || !inputPath.startsWith('/')) {
      return resolve(process.cwd(), inputPath);
    }
    return inputPath;
  }

  private async findFiles(directory: string, pattern: string): Promise<string[]> {
    // Simple file finding implementation
    // In a production system, you'd use a more sophisticated glob library
    const files: string[] = [];
    const items = await this.mcpManager.listDirectorySecure(directory);

    for (const item of items) {
      const itemPath = join(directory, item);

      try {
        const stats = await this.mcpManager.getFileStats(itemPath);

        if (stats.isFile && this.matchesPattern(item, pattern)) {
          files.push(relative(process.cwd(), itemPath));
        } else if (stats.isDirectory && !item.startsWith('.')) {
          // Recursively search subdirectories
          const subFiles = await this.findFiles(itemPath, pattern);
          files.push(...subFiles);
        }
      } catch (error) {
        // Skip items we can't access
        continue;
      }
    }

    return files;
  }

  private matchesPattern(filename: string, pattern: string): boolean {
    // Simple pattern matching - convert glob-like pattern to regex
    const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filename);
  }

  private createMetadata(
    category: string,
    cost: number,
    latency: number,
    reliability: number,
    dependencies: string[] = []
  ): ToolMetadata {
    return {
      version: '1.0.0',
      author: 'CodeCrucible Synth',
      tags: [category, 'filesystem', 'file-operations'],
      cost,
      latency,
      reliability,
      dependencies,
      conflictsWith: [],
      capabilities: [
        {
          type: 'read',
          scope: 'filesystem',
          permissions: ['filesystem:read', 'path:resolve'],
        },
        {
          type: 'write',
          scope: 'filesystem',
          permissions: ['filesystem:write', 'path:resolve'],
        },
      ],
      requirements: [{ type: 'resource', value: 'filesystem', optional: false }],
    };
  }
}

// Add getFileStats method to MCPServerManager if it doesn't exist
declare module '../../mcp-servers/mcp-server-manager.js' {
  interface MCPServerManager {
    getFileStats(filePath: string): Promise<{
      exists: boolean;
      isFile: boolean;
      isDirectory: boolean;
      size: number;
      modified: string;
    }>;
  }
}
