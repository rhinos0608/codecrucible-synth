import { ModelTool } from '../../domain/interfaces/model-client.js';
import { unifiedToolRegistry, ToolDefinition } from './unified-tool-registry.js';
import { createLogger } from '../logging/logger-adapter.js';

const logger = createLogger('DefaultToolRegistry');

interface ToolRegistryOptions {
  mcpManager?: any;
  allowedOrigins?: string[];
  autoApproveTools?: boolean;
}

export function createDefaultToolRegistry(
  options: ToolRegistryOptions = {}
): Map<string, ModelTool> {
  const { mcpManager, allowedOrigins, autoApproveTools } = options;
  const origins = allowedOrigins || (process.env.TOOL_ALLOWED_ORIGINS || 'local').split(',');
  const autoApprove = autoApproveTools ?? process.env.AUTO_APPROVE_TOOLS === 'true';

  const registry = new Map<string, ModelTool>();

  // Filesystem tools
  registry.set('filesystem_list', {
    type: 'function',
    function: {
      name: 'filesystem_list_directory',
      description: 'List files and directories in a specified path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The directory path to list contents for' },
        },
        required: ['path'],
      },
    },
  });

  registry.set('filesystem_read', {
    type: 'function',
    function: {
      name: 'filesystem_read_file',
      description: 'Read the contents of a file from the filesystem',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'The path to the file to read' },
        },
        required: ['file_path'],
      },
    },
  });

  registry.set('filesystem_write', {
    type: 'function',
    function: {
      name: 'filesystem_write_file',
      description: 'Write content to a file on the filesystem',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'The path where to write the file' },
          content: { type: 'string', description: 'The content to write to the file' },
        },
        required: ['file_path', 'content'],
      },
    },
  });

  registry.set('filesystem_stats', {
    type: 'function',
    function: {
      name: 'filesystem_get_stats',
      description: 'Get file or directory statistics (size, modified time, etc.)',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'The path to get statistics for' },
        },
        required: ['file_path'],
      },
    },
  });

  // Git tools
  registry.set('git_status', {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Check the git repository status',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  });

  registry.set('git_add', {
    type: 'function',
    function: {
      name: 'git_add',
      description: 'Stage files for commit',
      parameters: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of file paths to stage',
          },
        },
        required: ['files'],
      },
    },
  });

  registry.set('git_commit', {
    type: 'function',
    function: {
      name: 'git_commit',
      description: 'Commit staged changes with a message',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'The commit message' },
        },
        required: ['message'],
      },
    },
  });

  // Terminal tools
  registry.set('execute_command', {
    type: 'function',
    function: {
      name: 'execute_command',
      description: 'Execute a terminal command safely',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The command to execute' },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Command arguments',
            default: [],
          },
        },
        required: ['command'],
      },
    },
  });

  // Package manager tools
  registry.set('npm_install', {
    type: 'function',
    function: {
      name: 'npm_install',
      description: 'Install an npm package',
      parameters: {
        type: 'object',
        properties: {
          packageName: { type: 'string', description: 'The package name to install' },
          dev: { type: 'boolean', description: 'Install as dev dependency', default: false },
        },
        required: ['packageName'],
      },
    },
  });

  registry.set('npm_run', {
    type: 'function',
    function: {
      name: 'npm_run',
      description: 'Run an npm script',
      parameters: {
        type: 'object',
        properties: {
          scriptName: { type: 'string', description: 'The npm script name to run' },
        },
        required: ['scriptName'],
      },
    },
  });

  // Smithery tools
  registry.set('smithery_status', {
    type: 'function',
    function: {
      name: 'smithery_status',
      description: 'Get Smithery registry status and available tools',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  });

  registry.set('smithery_refresh', {
    type: 'function',
    function: {
      name: 'smithery_refresh',
      description: 'Refresh Smithery servers and tools',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  });

  registerToolsWithUnifiedRegistry(registry, {
    mcpManager,
    allowedOrigins: origins,
    autoApproveTools: autoApprove,
  });

  logger.info(`Tool registry initialized with ${registry.size} tools`);
  return registry;
}

function registerToolsWithUnifiedRegistry(
  toolRegistry: Map<string, ModelTool>,
  deps: { mcpManager?: any; allowedOrigins: string[]; autoApproveTools: boolean }
): void {
  for (const [toolId, modelTool] of toolRegistry.entries()) {
    try {
      const toolDefinition: ToolDefinition = {
        id: toolId,
        name: modelTool.function?.name || toolId,
        description: modelTool.function?.description || `Execute ${toolId}`,
        category: determineToolCategory(toolId),
        aliases: [modelTool.function?.name || toolId],
        inputSchema: modelTool.function?.parameters || { type: 'object', properties: {} },
        handler: async (args: Readonly<Record<string, unknown>>) => {
          if (deps.mcpManager && typeof deps.mcpManager.executeTool === 'function') {
            return await deps.mcpManager.executeTool(toolId, args);
          }
          throw new Error(`MCP manager not available for tool execution: ${toolId}`);
        },
        security: {
          requiresApproval: requiresApproval(toolId, deps.autoApproveTools),
          riskLevel: getRiskLevel(toolId),
          allowedOrigins: deps.allowedOrigins,
        },
        performance: {
          estimatedDuration: getEstimatedDuration(toolId),
          memoryUsage: 'medium',
          cpuIntensive: toolId.includes('execute_command'),
        },
      };

      unifiedToolRegistry.registerTool(toolDefinition);
      logger.debug(`Registered tool with UnifiedToolRegistry: ${toolId}`);
    } catch (error) {
      logger.warn(`Failed to register tool ${toolId} with UnifiedToolRegistry:`, error as Error);
    }
  }
}

function determineToolCategory(toolId: string): ToolDefinition['category'] {
  if (toolId.startsWith('filesystem_')) return 'filesystem';
  if (toolId.startsWith('git_')) return 'git';
  if (toolId === 'execute_command') return 'terminal';
  if (toolId.startsWith('npm_')) return 'package';
  if (toolId.includes('smithery')) return 'external';
  return 'system';
}

function requiresApproval(toolId: string, autoApprove: boolean): boolean {
  if (autoApprove) return false;
  return toolId === 'execute_command' || toolId.includes('write') || toolId.includes('commit');
}

function getRiskLevel(toolId: string): 'low' | 'medium' | 'high' | 'critical' {
  if (toolId === 'execute_command') return 'high';
  if (toolId.includes('write') || toolId.includes('commit')) return 'medium';
  return 'low';
}

function getEstimatedDuration(toolId: string): number {
  if (toolId === 'execute_command') return 5000;
  if (toolId.includes('npm_')) return 30000;
  return 1000;
}
