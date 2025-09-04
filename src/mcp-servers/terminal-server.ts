/**
 * Terminal MCP Server
 * Provides secure terminal operations via MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { exec, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { logger } from '../infrastructure/logging/logger.js';

const execAsync = promisify(exec);

interface TerminalConfig {
  workingDirectory?: string;
  allowedCommands?: string[];
  blockedCommands?: string[];
  timeout?: number;
  maxOutputSize?: number;
  environment?: Record<string, string>;
}

interface TerminalResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  command: string;
}

export class TerminalMCPServer {
  private server: Server;
  private config: TerminalConfig;
  private initialized: boolean = false;
  private activeProcesses: Map<string, ChildProcess> = new Map();

  constructor(config: TerminalConfig = {}) {
    this.config = {
      workingDirectory: config.workingDirectory || process.cwd(),
      allowedCommands: config.allowedCommands || [
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
        'curl',
        'wget',
        'python',
        'python3',
        'pip',
        'pip3',
        'cargo',
        'rustc',
        'go',
      ],
      blockedCommands: config.blockedCommands || [
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
        'mount',
      ],
      timeout: config.timeout || 30000, // 30 seconds default
      maxOutputSize: config.maxOutputSize || 1000000, // 1MB default
      environment: config.environment || {},
    };

    this.server = new Server(
      {
        name: 'terminal-mcp-server',
        version: '1.0.0',
        description: 'Secure terminal operations via MCP protocol',
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
            name: 'run_command',
            description: 'Execute a command in the terminal',
            inputSchema: {
              type: 'object',
              properties: {
                command: { type: 'string', description: 'Command to execute' },
                args: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Command arguments',
                },
                workingDirectory: { type: 'string', description: 'Working directory' },
                timeout: { type: 'number', description: 'Timeout in milliseconds' },
                captureOutput: { type: 'boolean', description: 'Capture and return output' },
              },
              required: ['command'],
            },
          },
          {
            name: 'run_script',
            description: 'Execute a script (bash, python, etc.)',
            inputSchema: {
              type: 'object',
              properties: {
                script: { type: 'string', description: 'Script content' },
                interpreter: {
                  type: 'string',
                  description: 'Script interpreter (bash, python, node)',
                },
                workingDirectory: { type: 'string', description: 'Working directory' },
                timeout: { type: 'number', description: 'Timeout in milliseconds' },
              },
              required: ['script', 'interpreter'],
            },
          },
          {
            name: 'get_environment',
            description: 'Get environment variables',
            inputSchema: {
              type: 'object',
              properties: {
                variable: { type: 'string', description: 'Specific variable name' },
              },
            },
          },
          {
            name: 'set_working_directory',
            description: 'Set the working directory for commands',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Directory path' },
              },
              required: ['path'],
            },
          },
          {
            name: 'list_processes',
            description: 'List running processes started by this server',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'kill_process',
            description: 'Kill a running process',
            inputSchema: {
              type: 'object',
              properties: {
                processId: { type: 'string', description: 'Process ID to kill' },
              },
              required: ['processId'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;
      const typedArgs = args as Record<string, any>;

      try {
        switch (name) {
          case 'run_command':
            return await this.runCommand(
              typedArgs.command as string,
              typedArgs.args as string[],
              typedArgs.workingDirectory as string,
              typedArgs.timeout as number,
              typedArgs.captureOutput !== false
            );

          case 'run_script':
            return await this.runScript(
              typedArgs.script as string,
              typedArgs.interpreter as string,
              typedArgs.workingDirectory as string,
              typedArgs.timeout as number
            );

          case 'get_environment':
            return await this.getEnvironment(typedArgs.variable as string);

          case 'set_working_directory':
            return await this.setWorkingDirectory(typedArgs.path as string);

          case 'list_processes':
            return await this.listProcesses();

          case 'kill_process':
            return await this.killProcess(typedArgs.processId as string);

          default:
            return {
              content: [{ type: 'text', text: `Unknown tool: ${name}` }],
              isError: true,
            };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Terminal operation failed: ${errorMessage}`);
        return {
          content: [{ type: 'text', text: `Error: ${errorMessage}` }],
          isError: true,
        };
      }
    });
  }

  private isCommandAllowed(command: string): boolean {
    const baseCommand = command.split(' ')[0].toLowerCase();

    // Check blocked commands first
    for (const blocked of this.config.blockedCommands!) {
      if (baseCommand.includes(blocked) || command.toLowerCase().includes(blocked)) {
        return false;
      }
    }

    // Check if command is in allowed list
    return this.config.allowedCommands!.some(
      allowed =>
        baseCommand === allowed.toLowerCase() || baseCommand.startsWith(allowed.toLowerCase())
    );
  }

  private async executeCommand(
    command: string,
    args: string[] = [],
    workingDirectory?: string,
    timeout?: number
  ): Promise<TerminalResult> {
    const startTime = Date.now();
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;

    if (!this.isCommandAllowed(fullCommand)) {
      throw new Error(`Command not allowed: ${command}`);
    }

    const execOptions = {
      cwd: workingDirectory || this.config.workingDirectory,
      timeout: timeout || this.config.timeout,
      maxBuffer: this.config.maxOutputSize,
      env: { ...process.env, ...this.config.environment },
    };

    try {
      const { stdout, stderr } = await execAsync(fullCommand, execOptions);
      return {
        stdout,
        stderr,
        exitCode: 0,
        duration: Date.now() - startTime,
        command: fullCommand,
      };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1,
        duration: Date.now() - startTime,
        command: fullCommand,
      };
    }
  }

  async runCommand(
    command: string,
    args: string[] = [],
    workingDirectory?: string,
    timeout?: number,
    captureOutput = true
  ) {
    const result = await this.executeCommand(command, args, workingDirectory, timeout);

    if (!captureOutput) {
      return {
        content: [{ type: 'text', text: `Command executed: ${result.command}` }],
        isError: result.exitCode !== 0,
      };
    }

    const output = [
      `Command: ${result.command}`,
      `Duration: ${result.duration}ms`,
      `Exit Code: ${result.exitCode}`,
      '',
      'STDOUT:',
      result.stdout || '(no output)',
      '',
      'STDERR:',
      result.stderr || '(no errors)',
    ].join('\n');

    return {
      content: [{ type: 'text', text: output }],
      isError: result.exitCode !== 0,
    };
  }

  async runScript(
    script: string,
    interpreter: string,
    workingDirectory?: string,
    timeout?: number
  ) {
    if (!this.isCommandAllowed(interpreter)) {
      throw new Error(`Interpreter not allowed: ${interpreter}`);
    }

    // Create temporary file with script content
    const fs = await import('fs/promises');
    const os = await import('os');
    const tempDir = os.tmpdir();
    const scriptExt =
      interpreter === 'python' || interpreter === 'python3'
        ? '.py'
        : interpreter === 'node'
          ? '.js'
          : interpreter === 'bash'
            ? '.sh'
            : '.txt';
    const scriptPath = path.join(tempDir, `script_${Date.now()}${scriptExt}`);

    try {
      await fs.writeFile(scriptPath, script, 'utf8');

      const result = await this.executeCommand(
        interpreter,
        [scriptPath],
        workingDirectory,
        timeout
      );

      // Clean up temporary file
      await fs.unlink(scriptPath);

      const output = [
        `Script: ${interpreter} ${scriptPath}`,
        `Duration: ${result.duration}ms`,
        `Exit Code: ${result.exitCode}`,
        '',
        'STDOUT:',
        result.stdout || '(no output)',
        '',
        'STDERR:',
        result.stderr || '(no errors)',
      ].join('\n');

      return {
        content: [{ type: 'text', text: output }],
        isError: result.exitCode !== 0,
      };
    } catch (error) {
      // Clean up on error
      try {
        await fs.unlink(scriptPath);
      } catch {} // Ignore cleanup errors
      throw error;
    }
  }

  async getEnvironment(variable?: string) {
    if (variable) {
      const value = process.env[variable];
      return {
        content: [{ type: 'text', text: value ? `${variable}=${value}` : `${variable} not set` }],
        isError: !value,
      };
    } else {
      const envVars = Object.entries(process.env)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      return {
        content: [{ type: 'text', text: envVars }],
        isError: false,
      };
    }
  }

  async setWorkingDirectory(dirPath: string) {
    try {
      const fs = await import('fs/promises');
      await fs.access(dirPath); // Check if directory exists

      this.config.workingDirectory = path.resolve(dirPath);
      return {
        content: [
          { type: 'text', text: `Working directory set to: ${this.config.workingDirectory}` },
        ],
        isError: false,
      };
    } catch (error) {
      throw new Error(`Invalid directory: ${dirPath}`);
    }
  }

  async listProcesses() {
    const processList = Array.from(this.activeProcesses.entries()).map(
      ([id, process]) => `${id}: PID ${process.pid} (${process.killed ? 'killed' : 'running'})`
    );

    return {
      content: [
        {
          type: 'text',
          text: processList.length > 0 ? processList.join('\n') : 'No active processes',
        },
      ],
      isError: false,
    };
  }

  async killProcess(processId: string) {
    const process = this.activeProcesses.get(processId);
    if (!process) {
      return {
        content: [{ type: 'text', text: `Process ${processId} not found` }],
        isError: true,
      };
    }

    try {
      process.kill('SIGTERM');
      this.activeProcesses.delete(processId);
      return {
        content: [{ type: 'text', text: `Process ${processId} terminated` }],
        isError: false,
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to kill process ${processId}` }],
        isError: true,
      };
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    logger.info('Terminal MCP Server initialized');
  }

  async shutdown(): Promise<void> {
    // Kill all active processes
    for (const [_id, process] of this.activeProcesses) {
      try {
        process.kill('SIGTERM');
      } catch {} // Ignore errors during shutdown
    }
    this.activeProcesses.clear();

    this.initialized = false;
    logger.info('Terminal MCP Server shutdown');
  }

  getServer(): Server {
    return this.server;
  }

  /**
   * Call a tool directly (for internal use)
   */
  async callTool(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'run_command':
        return this.runCommand(
          args.command,
          args.args || [],
          args.workingDirectory,
          args.timeout,
          args.captureOutput !== false
        );
      case 'run_script':
        return this.runScript(
          args.content,
          args.interpreter || 'bash',
          args.workingDirectory,
          args.timeout
        );
      case 'get_environment':
        return this.getEnvironment(args.variable);
      case 'set_working_directory':
        return this.setWorkingDirectory(args.path);
      case 'list_processes':
        return this.listProcesses();
      case 'kill_process':
        return this.killProcess(args.processId);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
