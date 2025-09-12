/**
 * Tool Registration Service
 *
 * Bridges the gap between typed tool definitions and actual MCP server implementations.
 * Registers all tools with the UnifiedToolRegistry with proper handlers that delegate
 * to the MCP server implementations.
 */

import { createLogger } from '../logging/logger-adapter.js';
import {
  unifiedToolRegistry,
  ToolDefinition,
  ToolExecutionContext as BaseToolExecutionContext,
  ToolExecutionResult,
} from './unified-tool-registry.js';

// Extend the base context to include recursion prevention flag
interface ExtendedToolExecutionContext extends BaseToolExecutionContext {
  _isFromToolRegistry?: boolean;
}
import {
  TYPED_TOOL_CATALOG,
  ToolRegistryKey,
  TypedToolIdentifiers,
} from './typed-tool-identifiers.js';
import { IMcpManager } from '../../domain/interfaces/mcp-manager.js';
import { mcpServerRegistry } from '../../mcp-servers/core/mcp-server-registry.js';

const logger = createLogger('ToolRegistrationService');

/**
 * Tool Registration Service - connects typed definitions to MCP implementations
 */
export class ToolRegistrationService {
  private mcpManager: IMcpManager | undefined;
  private initialized = false;

  /**
   * Set the MCP manager for delegating tool execution
   */
  public setMcpManager(mcpManager: IMcpManager): void {
    this.mcpManager = mcpManager;
  }

  /**
   * Register all typed tools with the unified registry
   */
  public async registerAllTools(): Promise<void> {
    if (this.initialized) {
      logger.debug('Tools already registered, skipping');
      return;
    }

    logger.info('Starting tool registration process...');

    const allToolKeys = TypedToolIdentifiers.getAllRegistryKeys();
    let successCount = 0;
    let errorCount = 0;

    for (const toolKey of allToolKeys) {
      try {
        await this.registerTool(toolKey);
        successCount++;
      } catch (error) {
        errorCount++;
        logger.error(`Failed to register tool ${toolKey}:`, error);
      }
    }

    this.initialized = true;
    logger.info(`Tool registration completed: ${successCount} succeeded, ${errorCount} failed`);
  }

  /**
   * Register a single tool with the unified registry
   */
  private async registerTool(toolKey: ToolRegistryKey): Promise<void> {
    const toolDef = TYPED_TOOL_CATALOG[toolKey];

    // Create a ToolDefinition for the UnifiedToolRegistry
    const unifiedToolDef: ToolDefinition = {
      id: toolKey,
      name: toolDef.functionName,
      description: toolDef.description,
      category: this.mapCategoryToUnifiedCategory(toolDef.category),
      aliases: [...toolDef.aliases],
      inputSchema: this.createInputSchemaForTool(toolKey),
      handler: this.createHandlerForTool(toolKey),
      security: {
        requiresApproval: toolDef.riskLevel === 'high',
        riskLevel:
          toolDef.riskLevel === 'high' ? 'high' : toolDef.riskLevel === 'medium' ? 'medium' : 'low',
        allowedOrigins: ['*'], // Allow all origins for now
      },
      performance: {
        estimatedDuration: this.getEstimatedDuration(toolKey),
        memoryUsage: toolKey.startsWith('filesystem_') ? 'medium' : 'low',
        cpuIntensive: toolKey === 'execute_command',
      },
    };

    unifiedToolRegistry.registerTool(unifiedToolDef);
    logger.debug(`Registered tool: ${toolKey} -> ${toolDef.functionName}`);
  }

  /**
   * Map typed tool category to unified registry category
   */
  private mapCategoryToUnifiedCategory(
    category: string
  ): 'filesystem' | 'git' | 'terminal' | 'network' | 'package' | 'external' | 'system' {
    switch (category) {
      case 'filesystem':
        return 'filesystem';
      case 'versionControl':
        return 'git';
      case 'development':
        return 'package';
      case 'system':
        return 'terminal';
      case 'external':
        return 'external';
      default:
        return 'system';
    }
  }

  /**
   * Create input schema for a tool based on its registry key
   */
  private createInputSchemaForTool(toolKey: ToolRegistryKey): Record<string, unknown> {
    // Base schema structure
    const baseSchema = {
      type: 'object',
      properties: {},
      required: [],
    };

    switch (toolKey) {
      case 'filesystem_list':
        return {
          ...baseSchema,
          properties: {
            path: { type: 'string', description: 'Directory path to list' },
          },
          required: ['path'],
        };

      case 'filesystem_read':
        return {
          ...baseSchema,
          properties: {
            file_path: { type: 'string', description: 'File path to read' },
          },
          required: ['file_path'],
        };

      case 'filesystem_write':
        return {
          ...baseSchema,
          properties: {
            file_path: { type: 'string', description: 'File path to write' },
            content: { type: 'string', description: 'Content to write' },
          },
          required: ['file_path', 'content'],
        };

      case 'filesystem_stats':
        return {
          ...baseSchema,
          properties: {
            file_path: { type: 'string', description: 'File path to get stats for' },
          },
          required: ['file_path'],
        };

      case 'git_status':
        return {
          ...baseSchema,
          properties: {
            path: { type: 'string', description: 'Repository path (optional)' },
          },
        };

      case 'git_add':
        return {
          ...baseSchema,
          properties: {
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Files to add',
            },
            path: { type: 'string', description: 'Repository path (optional)' },
          },
          required: ['files'],
        };

      case 'git_commit':
        return {
          ...baseSchema,
          properties: {
            message: { type: 'string', description: 'Commit message' },
            path: { type: 'string', description: 'Repository path (optional)' },
          },
          required: ['message'],
        };

      case 'execute_command':
        return {
          ...baseSchema,
          properties: {
            command: { type: 'string', description: 'Command to execute' },
            args: {
              type: 'array',
              items: { type: 'string' },
              description: 'Command arguments',
            },
            workingDirectory: { 
              type: 'string', 
              description: 'Working directory - MUST use absolute paths. Use project root or resolve paths relative to it. Example: resolve_project_root() or process.cwd()' 
            },
          },
          required: ['command'],
        };

      case 'npm_install':
        return {
          ...baseSchema,
          properties: {
            packages: {
              type: 'array',
              items: { type: 'string' },
              description: 'Packages to install',
            },
            dev: { type: 'boolean', description: 'Install as dev dependencies' },
            path: { type: 'string', description: 'Project path' },
          },
        };

      case 'npm_run':
        return {
          ...baseSchema,
          properties: {
            script: { type: 'string', description: 'Script to run' },
            path: { type: 'string', description: 'Project path' },
          },
          required: ['script'],
        };

      case 'smithery_status':
      case 'smithery_refresh':
        return baseSchema;

      default:
        return baseSchema;
    }
  }

  /**
   * Create a handler function for a tool that delegates directly to MCP servers
   * FIXED: Avoid recursive calls to MCPServerManager.executeTool by calling servers directly
   */
  private createHandlerForTool(toolKey: ToolRegistryKey) {
    return async (
      args: Readonly<Record<string, unknown>>,
      context?: ExtendedToolExecutionContext
    ): Promise<unknown> => {
      // Map tool registry key to actual MCP server and tool name
      const serverInfo = this.mapToMcpServer(toolKey);
      const mcpArgs = this.mapArgsToMcpFormat(toolKey, args);

      logger.debug(
        `Executing tool directly via MCP server: ${toolKey} -> ${serverInfo.serverId}:${serverInfo.toolName}`,
        {
          originalArgs: args,
          mappedArgs: mcpArgs,
        }
      );

      try {
        // FIXED: Call MCP server directly instead of going through MCPServerManager.executeTool
        // This prevents the circular dependency where ToolRegistrationService -> MCPServerManager -> UnifiedToolRegistry -> ToolRegistrationService
        const server = await mcpServerRegistry.getServer(serverInfo.serverId);

        if (!server || typeof server !== 'object') {
          throw new Error(`MCP server ${serverInfo.serverId} not available`);
        }

        // Check if server has callTool method (direct MCP server call)
        if ('callTool' in server && typeof (server as any).callTool === 'function') {
          const result = await (server as any).callTool(serverInfo.toolName, mcpArgs);

          // Handle different result formats from MCP servers
          if (result && typeof result === 'object' && 'content' in result) {
            // Standard MCP response format
            if (result.isError) {
              throw new Error(
                Array.isArray(result.content)
                  ? result.content.map((c: any) => c.text).join('\n')
                  : 'Tool execution failed'
              );
            }
            return Array.isArray(result.content)
              ? result.content.map((c: any) => c.text).join('\n')
              : result.content;
          }

          return result;
        }

        // Fallback to direct method calls on server if available
        const methodName = this.getDirectMethodName(toolKey);
        if (
          methodName &&
          methodName in server &&
          typeof (server as any)[methodName] === 'function'
        ) {
          return await (server as any)[methodName](mcpArgs);
        }

        // Last resort removed to avoid potential recursion through unified registry

        throw new Error(
          `No execution method available for tool ${toolKey} on server ${serverInfo.serverId}`
        );
      } catch (error) {
        logger.error(`Direct MCP server call failed for ${toolKey}:`, error);
        throw error;
      }
    };
  }

  /**
   * Map tool registry key to MCP server and tool name
   * FIXED: New method to support direct server routing
   */
  private mapToMcpServer(toolKey: ToolRegistryKey): { serverId: string; toolName: string } {
    switch (toolKey) {
      case 'filesystem_list':
        return { serverId: 'filesystem', toolName: 'list_directory' };
      case 'filesystem_read':
        return { serverId: 'filesystem', toolName: 'read_file' };
      case 'filesystem_write':
        return { serverId: 'filesystem', toolName: 'write_file' };
      case 'filesystem_stats':
        return { serverId: 'filesystem', toolName: 'file_stats' };
      case 'git_status':
        return { serverId: 'git', toolName: 'git_status' };
      case 'git_add':
        return { serverId: 'git', toolName: 'git_add' };
      case 'git_commit':
        return { serverId: 'git', toolName: 'git_commit' };
      case 'execute_command':
        return { serverId: 'terminal', toolName: 'run_command' };
      case 'npm_install':
        return { serverId: 'packageManager', toolName: 'npm_install' };
      case 'npm_run':
        return { serverId: 'packageManager', toolName: 'npm_run' };
      case 'smithery_status':
        return { serverId: 'smithery', toolName: 'smithery_status' };
      case 'smithery_refresh':
        return { serverId: 'smithery', toolName: 'smithery_refresh' };
      default:
        return { serverId: 'filesystem', toolName: toolKey };
    }
  }

  /**
   * Get direct method name for server calls (fallback)
   */
  private getDirectMethodName(toolKey: ToolRegistryKey): string | null {
    switch (toolKey) {
      case 'filesystem_list':
        return 'listDirectorySecure';
      case 'filesystem_read':
        return 'readFileSecure';
      case 'filesystem_write':
        return 'writeFileSecure';
      case 'execute_command':
        return 'runCommand';
      default:
        return null;
    }
  }

  /**
   * Map tool registry key to actual MCP server tool name
   * DEPRECATED: Use mapToMcpServer instead
   */
  private mapToMcpToolName(toolKey: ToolRegistryKey): string {
    switch (toolKey) {
      case 'filesystem_list':
        return 'list_directory';
      case 'filesystem_read':
        return 'read_file';
      case 'filesystem_write':
        return 'write_file';
      case 'filesystem_stats':
        return 'file_stats';
      case 'git_status':
        return 'git_status';
      case 'git_add':
        return 'git_add';
      case 'git_commit':
        return 'git_commit';
      case 'execute_command':
        return 'execute_command';
      case 'npm_install':
        return 'npm_install';
      case 'npm_run':
        return 'npm_run';
      case 'smithery_status':
        return 'smithery_status';
      case 'smithery_refresh':
        return 'smithery_refresh';
      default:
        return toolKey;
    }
  }

  /**
   * Map arguments to MCP server format
   */
  private mapArgsToMcpFormat(
    toolKey: ToolRegistryKey,
    args: Readonly<Record<string, unknown>>
  ): Record<string, unknown> {
    const mapped: Record<string, unknown> = { ...args };

    // Handle argument key mapping
    switch (toolKey) {
      case 'filesystem_read':
      case 'filesystem_write':
      case 'filesystem_stats':
        // Map file_path -> path for MCP servers
        if (mapped.file_path) {
          mapped.path = mapped.file_path;
          delete mapped.file_path;
        }
        break;

      // Other tools use args as-is
      default:
        break;
    }

    return mapped;
  }

  /**
   * Get estimated duration for tool execution
   */
  private getEstimatedDuration(toolKey: ToolRegistryKey): number {
    switch (toolKey) {
      case 'filesystem_read':
        return 500;
      case 'filesystem_write':
        return 1000;
      case 'filesystem_list':
        return 300;
      case 'filesystem_stats':
        return 200;
      case 'git_status':
        return 1000;
      case 'git_add':
        return 1500;
      case 'git_commit':
        return 2000;
      case 'execute_command':
        return 5000;
      case 'npm_install':
        return 30000;
      case 'npm_run':
        return 10000;
      case 'smithery_status':
        return 2000;
      case 'smithery_refresh':
        return 3000;
      default:
        return 1000;
    }
  }

  /**
   * Get registration status
   */
  public getRegistrationStatus(): {
    initialized: boolean;
    availableTools: string[];
    mcpManagerConnected: boolean;
  } {
    return {
      initialized: this.initialized,
      availableTools: unifiedToolRegistry.getAvailableToolNames(),
      mcpManagerConnected: !!this.mcpManager,
    };
  }
}

// Export singleton instance
export const toolRegistrationService = new ToolRegistrationService();
