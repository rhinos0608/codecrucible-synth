/**
 * Package Manager MCP Server
 * Provides basic package management operations via MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from '../infrastructure/logging/logger.js';

const execFileAsync = promisify(execFile);

interface PackageManagerConfig {
  workingDirectory?: string;
  allowedManagers?: string[];
  defaultManager?: string;
}

interface InstallPackageArgs {
  name: string;
  manager?: string;
}

interface InstallPackageResult {
  stdout: string;
  stderr: string;
}

interface ListInstalledResult {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export class PackageManagerMCPServer {
  private server: Server;
  private config: PackageManagerConfig;
  private initialized = false;

  constructor(config: PackageManagerConfig = {}) {
    this.config = {
      workingDirectory: config.workingDirectory || process.cwd(),
      allowedManagers: config.allowedManagers || ['npm'],
      defaultManager: config.defaultManager || 'npm',
    };

    this.server = new Server(
      {
        name: 'package-manager-mcp-server',
        version: '1.0.0',
        description: 'Package management operations via MCP protocol',
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
            name: 'install_package',
            description: 'Install a package using the configured package manager',
            inputSchema: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Package name to install' },
                manager: { type: 'string', description: 'Package manager to use' },
              },
              required: ['name'],
            },
          },
          {
            name: 'list_installed',
            description: 'List installed dependencies from package.json',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'install_package': {
          const result = await this.installPackage(
            (args as InstallPackageArgs).name,
            (args as InstallPackageArgs).manager
          );
          return {
            content: [{ type: 'text', text: result.stdout || result.stderr || '' }],
          };
        }
        case 'list_installed': {
          const result = await this.listInstalled();
          return {
            content: [
              {
                type: 'json',
                json: result,
              },
            ],
          };
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    logger.info('Package Manager MCP Server initialized');
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    logger.info('Package Manager MCP Server shutdown');
  }

  getServer(): Server {
    return this.server;
  }

  /**
   * Call a tool directly (for internal use)
   */
  async callTool(
    toolName: 'install_package',
    args: InstallPackageArgs
  ): Promise<InstallPackageResult>;
  async callTool(toolName: 'list_installed'): Promise<ListInstalledResult>;
  async callTool(
    toolName: string,
    args?: InstallPackageArgs
  ): Promise<InstallPackageResult | ListInstalledResult> {
    switch (toolName) {
      case 'install_package':
        if (!args) {
          throw new Error("Missing arguments for 'install_package'");
        }
        return this.installPackage(args.name, args.manager);
      case 'list_installed':
        return this.listInstalled();
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async installPackage(name: string, manager?: string): Promise<InstallPackageResult> {
    const pkgManager = manager || this.config.defaultManager!;
    if (!this.config.allowedManagers!.includes(pkgManager)) {
      throw new Error(`Package manager ${pkgManager} not allowed`);
    }

    if (!/^[\w@./-]+$/.test(name)) {
      throw new Error(`Invalid package name: ${name}`);
    }

    const { stdout, stderr } = await execFileAsync(pkgManager, ['install', name], {
      cwd: this.config.workingDirectory,
    });

    return { stdout, stderr };
  }

  private async listInstalled(): Promise<ListInstalledResult> {
    const pkgPath = path.join(this.config.workingDirectory!, 'package.json');
    let file: string;
    let pkg: PackageJson;
    try {
      file = await fs.readFile(pkgPath, 'utf8');
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        logger.error(`package.json not found at ${pkgPath}`);
        throw new Error(`package.json not found at ${pkgPath}`);
      } else {
        logger.error(`Error reading package.json at ${pkgPath}: ${error.message}`);
        throw new Error(`Error reading package.json at ${pkgPath}: ${error.message}`);
      }
    }
    try {
      pkg = JSON.parse(file) as PackageJson;
    } catch (err) {
      const error = err as Error;
      logger.error(`Invalid JSON in package.json at ${pkgPath}: ${error.message}`);
      throw new Error(`Invalid JSON in package.json at ${pkgPath}: ${error.message}`);
    }
    return {
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
    };
  }
}

export default PackageManagerMCPServer;
