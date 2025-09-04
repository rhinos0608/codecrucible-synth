/**
 * Local Terminal MCP Server
 * Replaces unreliable Smithery external terminal-controller with local implementation
 * Based on 2024-2025 MCP best practices and specification updates
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../infrastructure/logging/logger.js';
import { InputSanitizer } from '../infrastructure/security/input-sanitizer.js';

const execAsync = promisify(exec);

interface TerminalResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  command: string;
}

class LocalTerminalServer {
  private server: Server;
  private allowedCommands: Set<string>;
  private blockedCommands: Set<string>;

  constructor() {
    this.server = new Server(
      {
        name: 'local-terminal-server',
        version: '1.0.0',
        description: 'Local terminal server with security validation and command execution',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Configure allowed/blocked commands based on security requirements
    this.allowedCommands = new Set([
      'npm',
      'node',
      'git',
      'ls',
      'cat',
      'pwd',
      'echo',
      'mkdir',
      'touch',
      'grep',
      'find',
      'head',
      'tail',
      'wc',
      'sort',
      'uniq',
      'tree',
      'tsc',
      'tsx',
      'eslint',
      'prettier',
      'jest',
      'mocha',
      'vitest',
    ]);

    this.blockedCommands = new Set([
      'rm',
      'del',
      'sudo',
      'su',
      'chmod',
      'chown',
      'kill',
      'killall',
      'shutdown',
      'reboot',
      'halt',
      'format',
      'fdisk',
      'dd',
      'mkfs',
    ]);

    this.setupRequestHandlers();
  }

  private setupRequestHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'execute_command',
            description: 'Execute a terminal command with security validation',
            inputSchema: {
              type: 'object',
              properties: {
                command: {
                  type: 'string',
                  description: 'The command to execute',
                },
                timeout: {
                  type: 'number',
                  description: 'Timeout in milliseconds (default: 30000)',
                  default: 30000,
                },
                workingDirectory: {
                  type: 'string',
                  description: 'Working directory for command execution',
                },
              },
              required: ['command'],
            },
          },
          {
            name: 'read_file',
            description: 'Read the contents of a file',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Path to the file to read',
                },
              },
              required: ['file_path'],
            },
          },
          {
            name: 'write_file',
            description: 'Write content to a file',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Path to the file to write',
                },
                content: {
                  type: 'string',
                  description: 'Content to write to the file',
                },
              },
              required: ['file_path', 'content'],
            },
          },
          {
            name: 'list_directory',
            description: 'List contents of a directory',
            inputSchema: {
              type: 'object',
              properties: {
                directory_path: {
                  type: 'string',
                  description: 'Path to the directory to list',
                },
              },
              required: ['directory_path'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'execute_command':
            return await this.executeCommand(args);
          case 'read_file':
            return await this.readFile(args);
          case 'write_file':
            return await this.writeFile(args);
          case 'list_directory':
            return await this.listDirectory(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`Local terminal MCP error for ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
                tool: name,
                args,
              }),
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async executeCommand(args: any): Promise<any> {
    const { command, timeout = 30000, workingDirectory } = args;

    // Security validation
    const sanitizationResult = InputSanitizer.sanitizePrompt(command);
    if (!sanitizationResult.isValid) {
      throw new Error(
        `Command blocked by security validation: ${sanitizationResult.violations.join(', ')}`
      );
    }

    // Additional command-level validation
    const commandParts = command.trim().split(/\s+/);
    const mainCommand = commandParts[0]?.toLowerCase();

    if (this.blockedCommands.has(mainCommand)) {
      throw new Error(`Command '${mainCommand}' is not allowed for security reasons`);
    }

    // Check if command is in allowed list or starts with allowed command
    const isAllowed =
      this.allowedCommands.has(mainCommand) ||
      Array.from(this.allowedCommands).some(
        allowed => mainCommand.startsWith(allowed) || command.includes(allowed)
      );

    if (!isAllowed && !this.isCompilationCommand(command)) {
      logger.warn(`Command '${mainCommand}' not in allowed list, proceeding with caution`);
    }

    const startTime = Date.now();

    try {
      const execOptions: any = {
        timeout,
        maxBuffer: 1024 * 1024 * 5, // 5MB buffer
        encoding: 'utf8',
      };

      if (workingDirectory) {
        // Validate working directory
        const dirValidation = InputSanitizer.validateFilePath(workingDirectory);
        if (!dirValidation.isValid) {
          throw new Error(`Working directory blocked: ${dirValidation.violations.join(', ')}`);
        }
        execOptions.cwd = workingDirectory;
      }

      const result = await execAsync(command, execOptions);
      const duration = Date.now() - startTime;

      const terminalResult: TerminalResult = {
        stdout: result.stdout?.toString() || '',
        stderr: result.stderr?.toString() || '',
        exitCode: 0,
        duration,
        command,
      };

      logger.info(`Local terminal executed: ${command} (${duration}ms)`);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(terminalResult, null, 2),
          },
        ],
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      const terminalResult: TerminalResult = {
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        exitCode: error.code || 1,
        duration,
        command,
      };

      logger.warn(`Local terminal command failed: ${command} (${duration}ms)`, error);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(terminalResult, null, 2),
          },
        ],
      };
    }
  }

  private async readFile(args: any): Promise<any> {
    const { file_path } = args;

    // Validate file path with AI-friendly preprocessing
    const validation = InputSanitizer.validateFilePath(file_path);
    if (!validation.isValid) {
      logger.warn(
        `File path validation failed for "${file_path}": ${validation.violations.join(', ')} - attempting fallback with processed path "${validation.sanitized}"`
      );

      // Try with the sanitized/processed path instead of blocking
      if (validation.sanitized && validation.sanitized !== file_path) {
        logger.info(`Attempting file read with processed path: ${validation.sanitized}`);
        try {
          const content = await fs.readFile(validation.sanitized, 'utf-8');
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  content,
                  path: validation.sanitized,
                  original_path: file_path,
                  size: content.length,
                  note: 'Path was automatically processed from AI-generated format',
                }),
              },
            ],
          };
        } catch (fallbackError) {
          logger.warn(`Fallback with processed path also failed: ${fallbackError}`);
        }
      }

      throw new Error(
        `File path blocked: ${validation.violations.join(', ')} - tried original: "${file_path}" and processed: "${validation.sanitized}"`
      );
    }

    try {
      const content = await fs.readFile(file_path, 'utf-8');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              content,
              path: file_path,
              size: content.length,
            }),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  private async writeFile(args: any): Promise<any> {
    const { file_path, content } = args;

    // Validate file path with AI-friendly preprocessing
    const validation = InputSanitizer.validateFilePath(file_path);
    if (!validation.isValid) {
      logger.warn(
        `Write path validation failed for "${file_path}": ${validation.violations.join(', ')} - attempting fallback with processed path "${validation.sanitized}"`
      );

      // Try with the sanitized/processed path instead of blocking
      if (validation.sanitized && validation.sanitized !== file_path) {
        logger.info(`Attempting file write with processed path: ${validation.sanitized}`);
        try {
          const dir = path.dirname(validation.sanitized);
          await fs.mkdir(dir, { recursive: true });
          await fs.writeFile(validation.sanitized, content, 'utf-8');
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  path: validation.sanitized,
                  original_path: file_path,
                  size: content.length,
                  note: 'Path was automatically processed from AI-generated format',
                }),
              },
            ],
          };
        } catch (fallbackError) {
          logger.warn(`Fallback write with processed path also failed: ${fallbackError}`);
        }
      }

      throw new Error(
        `Write path blocked: ${validation.violations.join(', ')} - tried original: "${file_path}" and processed: "${validation.sanitized}"`
      );
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(file_path);
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(file_path, content, 'utf-8');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              path: file_path,
              size: content.length,
            }),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  private async listDirectory(args: any): Promise<any> {
    const { directory_path } = args;

    // Validate directory path
    const validation = InputSanitizer.validateFilePath(directory_path);
    if (!validation.isValid) {
      throw new Error(`Directory path blocked: ${validation.violations.join(', ')}`);
    }

    try {
      const entries = await fs.readdir(directory_path, { withFileTypes: true });

      const items = entries.map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        isSymlink: entry.isSymbolicLink(),
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              path: directory_path,
              items,
              count: items.length,
            }),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to list directory: ${error.message}`);
    }
  }

  private isCompilationCommand(command: string): boolean {
    const compilationIndicators = [
      'node-gyp',
      'gyp',
      'make',
      'gcc',
      'clang',
      'tsc',
      'npm run build',
      'npm install',
      'yarn install',
      'pnpm install',
      'webpack',
      'rollup',
      'babel',
      'esbuild',
      'vite build',
      'cmake',
      'meson',
      'ninja',
    ];

    return compilationIndicators.some(indicator =>
      command.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  async start(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      logger.info('Local terminal MCP server started successfully');
    } catch (error) {
      logger.error('Failed to start local terminal MCP server:', error);
      throw error;
    }
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new LocalTerminalServer();
  server.start().catch(console.error);
}

export { LocalTerminalServer };
