/**
 * Package Manager MCP Server
 * Provides basic package management operations via MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from '../infrastructure/logging/logger.js';
import { ToolExecutionArgs } from '../domain/interfaces/tool-execution.js';
import { ToolCallResponse } from './smithery-mcp-server.js';

const execAsync = promisify(exec);

interface PackageManagerConfig {
  workingDirectory?: string;
  allowedManagers?: string[];
  defaultManager?: string;
}

export class PackageManagerMCPServer {
  private readonly server: Server;
  private readonly config: PackageManagerConfig;
  private initialized = false;

  public constructor(config: Readonly<PackageManagerConfig> = {}) {
    this.config = {
      workingDirectory: config.workingDirectory ?? process.cwd(),
      allowedManagers: config.allowedManagers ?? ['npm'],
      defaultManager: config.defaultManager ?? 'npm',
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
    this.server.setRequestHandler(ListToolsRequestSchema, () => {
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

      interface InstallPackageArgs {
        name: string;
        manager?: string;
      }

      switch (name) {
        case 'install_package': {
          const typedArgs = args as unknown as InstallPackageArgs;
          const result = await this.installPackage(
            typedArgs.name,
            typedArgs.manager
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

  public initialize(): void {
    if (this.initialized) return;
    logger.info('Package Manager MCP Server initialized');
    this.initialized = true;
  }

  public shutdown(): void {
    logger.info('Package Manager MCP Server shutdown');
  }

  public getServer(): Server {
    return this.server;
  }

  /**
   * Call a tool directly (for internal use)
   */
  public async callTool(
    toolName: string,
    args: Readonly<ToolExecutionArgs>
  ): Promise<ToolCallResponse> {
    interface InstallPackageArgs {
      name: string;
      manager?: string;
    }

    switch (toolName) {
      case 'install_package': {
        const { name, manager } = args as unknown as InstallPackageArgs;
        const result = await this.installPackage(String(name), manager ? String(manager) : undefined);
        return {
          content: [{ type: 'text', text: result.stdout || result.stderr || '' }],
        };
      }
      case 'list_installed': {
        const result = await this.listInstalled();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async installPackage(
    name: string,
    manager?: string
  ): Promise<{ stdout: string; stderr: string }> {
    const pkgManager = manager ?? this.config.defaultManager;
    if (!this.config.allowedManagers?.includes(pkgManager ?? '')) {
      throw new Error(`Package manager ${pkgManager} not allowed`);
    }

    const command = `${pkgManager} install ${name}`;
    const { stdout, stderr }: { stdout: string; stderr: string } = await execAsync(command, {
      cwd: this.config.workingDirectory,
    });

    return { stdout, stderr };
  }

  private async listInstalled(): Promise<{ dependencies: Record<string, string>; devDependencies: Record<string, string> }> {
    const pkgPath = path.join(this.config.workingDirectory ?? process.cwd(), 'package.json');
    let file: string;
    let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    try {
      file = await fs.readFile(pkgPath, 'utf8');
    } catch (err) {
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.error(`package.json not found at ${pkgPath}`);
        throw new Error(`package.json not found at ${pkgPath}`);
      } else if (err instanceof Error) {
        logger.error(`Error reading package.json at ${pkgPath}: ${err.message}`);
        throw new Error(`Error reading package.json at ${pkgPath}: ${err.message}`);
      } else {
        logger.error(`Unknown error reading package.json at ${pkgPath}`);
        throw new Error(`Unknown error reading package.json at ${pkgPath}`);
      }
    }
    try {
      pkg = JSON.parse(file) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Invalid JSON in package.json at ${pkgPath}: ${message}`);
      throw new Error(`Invalid JSON in package.json at ${pkgPath}: ${message}`);
    }
    return {
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
    };
  }
}

export default PackageManagerMCPServer;
