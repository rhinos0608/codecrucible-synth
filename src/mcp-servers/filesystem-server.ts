/**
 * Filesystem MCP Server
 * Provides secure file system operations via MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../infrastructure/logging/logger.js';

interface FilesystemConfig {
  allowedPaths?: string[];
  blockedPaths?: string[];
  maxFileSize?: number;
  encoding?: BufferEncoding;
}

export class FilesystemMCPServer {
  private server: Server;
  private config: FilesystemConfig;
  private initialized: boolean = false;

  constructor(config: FilesystemConfig = {}) {
    this.config = {
      allowedPaths: config.allowedPaths || [process.cwd()],
      blockedPaths: config.blockedPaths || ['node_modules', '.git', '.env'],
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB default
      encoding: config.encoding || 'utf8',
    };

    this.server = new Server(
      {
        name: 'filesystem-mcp-server',
        version: '1.0.0',
        description: 'Secure filesystem operations via MCP protocol',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupRequestHandlers();
  }

  private setupRequestHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'read_file',
            description: 'Read the contents of a file',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path to read' },
                encoding: { type: 'string', description: 'File encoding (default: utf8)' },
              },
              required: ['path'],
            },
          },
          {
            name: 'write_file',
            description: 'Write content to a file',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path to write' },
                content: { type: 'string', description: 'Content to write' },
                encoding: { type: 'string', description: 'File encoding (default: utf8)' },
              },
              required: ['path', 'content'],
            },
          },
          {
            name: 'list_directory',
            description: 'List files in a directory',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Directory path' },
                recursive: { type: 'boolean', description: 'List recursively' },
              },
              required: ['path'],
            },
          },
          {
            name: 'create_directory',
            description: 'Create a directory',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Directory path to create' },
                recursive: { type: 'boolean', description: 'Create parent directories if needed' },
              },
              required: ['path'],
            },
          },
          {
            name: 'delete_file',
            description: 'Delete a file',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path to delete' },
              },
              required: ['path'],
            },
          },
          {
            name: 'file_stats',
            description: 'Get file statistics',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path' },
              },
              required: ['path'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'read_file':
            return await this.readFile(args.path, args.encoding);

          case 'write_file':
            return await this.writeFile(args.path, args.content, args.encoding);

          case 'list_directory':
            return await this.listDirectory(args.path, args.recursive);

          case 'create_directory':
            return await this.createDirectory(args.path, args.recursive);

          case 'delete_file':
            return await this.deleteFile(args.path);

          case 'file_stats':
            return await this.getFileStats(args.path);

          default:
            return {
              content: [{ type: 'text', text: `Unknown tool: ${name}` }],
              isError: true,
            };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Filesystem operation failed: ${errorMessage}`);
        return {
          content: [{ type: 'text', text: `Error: ${errorMessage}` }],
          isError: true,
        };
      }
    });
  }

  private isPathAllowed(targetPath: string): boolean {
    const normalizedPath = path.resolve(targetPath);
    
    // Check if path contains blocked patterns
    for (const blocked of this.config.blockedPaths!) {
      if (normalizedPath.includes(blocked)) {
        return false;
      }
    }

    // Check if path is within allowed paths
    for (const allowed of this.config.allowedPaths!) {
      const allowedPath = path.resolve(allowed);
      if (normalizedPath.startsWith(allowedPath)) {
        return true;
      }
    }

    return false;
  }

  private async readFile(filePath: string, encoding?: BufferEncoding) {
    if (!this.isPathAllowed(filePath)) {
      throw new Error(`Access denied: ${filePath}`);
    }

    const stats = await fs.stat(filePath);
    if (stats.size > this.config.maxFileSize!) {
      throw new Error(`File too large: ${stats.size} bytes`);
    }

    const content = await fs.readFile(filePath, encoding || this.config.encoding);
    return {
      content: [{ type: 'text', text: content.toString() }],
      isError: false,
    };
  }

  private async writeFile(filePath: string, content: string, encoding?: BufferEncoding) {
    if (!this.isPathAllowed(filePath)) {
      throw new Error(`Access denied: ${filePath}`);
    }

    await fs.writeFile(filePath, content, encoding || this.config.encoding);
    return {
      content: [{ type: 'text', text: `File written: ${filePath}` }],
      isError: false,
    };
  }

  private async listDirectory(dirPath: string, recursive?: boolean) {
    if (!this.isPathAllowed(dirPath)) {
      throw new Error(`Access denied: ${dirPath}`);
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const result: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        result.push(`[DIR] ${entry.name}`);
        if (recursive) {
          const subEntries = await this.listDirectory(fullPath, true);
          result.push(...subEntries.content[0].text.split('\n').map(line => `  ${line}`));
        }
      } else {
        result.push(`[FILE] ${entry.name}`);
      }
    }

    return {
      content: [{ type: 'text', text: result.join('\n') }],
      isError: false,
    };
  }

  private async createDirectory(dirPath: string, recursive?: boolean) {
    if (!this.isPathAllowed(dirPath)) {
      throw new Error(`Access denied: ${dirPath}`);
    }

    await fs.mkdir(dirPath, { recursive: recursive || false });
    return {
      content: [{ type: 'text', text: `Directory created: ${dirPath}` }],
      isError: false,
    };
  }

  private async deleteFile(filePath: string) {
    if (!this.isPathAllowed(filePath)) {
      throw new Error(`Access denied: ${filePath}`);
    }

    await fs.unlink(filePath);
    return {
      content: [{ type: 'text', text: `File deleted: ${filePath}` }],
      isError: false,
    };
  }

  private async getFileStats(filePath: string) {
    if (!this.isPathAllowed(filePath)) {
      throw new Error(`Access denied: ${filePath}`);
    }

    const stats = await fs.stat(filePath);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          size: stats.size,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          created: stats.birthtime,
          modified: stats.mtime,
          accessed: stats.atime,
        }, null, 2),
      }],
      isError: false,
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    logger.info('Filesystem MCP Server initialized');
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
    logger.info('Filesystem MCP Server shutdown');
  }

  getServer(): Server {
    return this.server;
  }
}