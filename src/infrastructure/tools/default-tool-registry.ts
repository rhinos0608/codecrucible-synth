import { ModelTool } from '../../domain/interfaces/model-client.js';
import { createLogger } from '../logging/logger-adapter.js';
import {
  TYPED_TOOL_CATALOG,
  ToolRegistryKey,
  TypedToolIdentifiers,
} from './typed-tool-identifiers.js';
import { IMcpManager } from '../../domain/interfaces/mcp-manager.js';

const logger = createLogger('DefaultToolRegistry');

interface ToolRegistryOptions {
  mcpManager?: IMcpManager;
  allowedOrigins?: string[];
  autoApproveTools?: boolean;
}

/**
 * Create parameter definitions for each tool type
 */
function createParametersForTool(registryKey: ToolRegistryKey): {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
} {
  switch (registryKey) {
    case 'filesystem_list':
      return {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The directory path to list contents for' },
        },
        required: ['path'],
      };

    case 'filesystem_read':
      return {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'The path to the file to read' },
        },
        required: ['file_path'],
      };

    case 'filesystem_write':
      return {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'The path where to write the file' },
          content: { type: 'string', description: 'The content to write to the file' },
        },
        required: ['file_path', 'content'],
      };

    case 'filesystem_stats':
      return {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'The path to get statistics for' },
        },
        required: ['file_path'],
      };

    case 'git_status':
      return {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Repository path (optional, defaults to cwd)' },
        },
        required: [],
      };

    case 'git_add':
      return {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files to add to staging',
          },
          path: { type: 'string', description: 'Repository path (optional, defaults to cwd)' },
        },
        required: ['files'],
      };

    case 'git_commit':
      return {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Commit message' },
          path: { type: 'string', description: 'Repository path (optional, defaults to cwd)' },
        },
        required: ['message'],
      };

    case 'execute_command':
      return {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The command to execute' },
          args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' },
          working_directory: {
            type: 'string',
            description: 'Working directory for command execution',
          },
        },
        required: ['command'],
      };

    case 'npm_install':
      return {
        type: 'object',
        properties: {
          packages: {
            type: 'array',
            items: { type: 'string' },
            description: 'Packages to install',
          },
          dev: { type: 'boolean', description: 'Install as dev dependencies' },
          path: { type: 'string', description: 'Project path (optional, defaults to cwd)' },
        },
        required: [],
      };

    case 'npm_run':
      return {
        type: 'object',
        properties: {
          script: { type: 'string', description: 'NPM script name to run' },
          path: { type: 'string', description: 'Project path (optional, defaults to cwd)' },
        },
        required: ['script'],
      };

    case 'smithery_status':
      return {
        type: 'object',
        properties: {},
        required: [],
      };

    case 'smithery_refresh':
      return {
        type: 'object',
        properties: {},
        required: [],
      };

    default: {
      // Type-safe exhaustive check - will cause compile error if new tools are added without parameters
      const _exhaustiveCheck: never = registryKey;
      return {
        type: 'object',
        properties: {},
        required: [],
      };
    }
  }
}

/**
 * Type-safe tool registry creation with compile-time validation
 */
export function createDefaultToolRegistry(
  _options: ToolRegistryOptions = {}
): Map<ToolRegistryKey, ModelTool> {
  const registry = new Map<ToolRegistryKey, ModelTool>();

  // Helper function to create ModelTool from typed definition
  const createModelTool = (registryKey: ToolRegistryKey): ModelTool => {
    const toolDef = TYPED_TOOL_CATALOG[registryKey];
    return {
      type: 'function',
      function: {
        name: toolDef.functionName,
        description: toolDef.description,
        parameters: createParametersForTool(registryKey),
      },
    };
  };

  // Register all tools using typed identifiers
  const allToolKeys = TypedToolIdentifiers.getAllRegistryKeys();
  for (const toolKey of allToolKeys) {
    registry.set(toolKey, createModelTool(toolKey));
  }

  // Note: Unified registry integration removed to avoid type conflicts during refactoring

  // Log registry statistics
  const statistics = TypedToolIdentifiers.getToolStatistics();
  logger.info(`[DefaultToolRegistry] Tool registry initialized with typed identifiers`, {
    totalTools: statistics.totalTools,
    coreTools: statistics.coreTools,
    byCategory: statistics.byCategory,
    byRiskLevel: statistics.byRiskLevel,
    registrySize: registry.size,
  });

  return registry;
}

/**
 * Type-safe tool lookup functions
 */
export class DefaultToolRegistryHelpers {
  /**
   * Get tool by registry key (type-safe)
   */
  public static getTool(
    registry: ReadonlyMap<ToolRegistryKey, ModelTool>,
    key: ToolRegistryKey
  ): ModelTool | undefined {
    return registry.get(key);
  }

  /**
   * Check if registry contains tool (type-safe)
   */
  public static hasTool(
    registry: ReadonlyMap<ToolRegistryKey, ModelTool>,
    key: ToolRegistryKey
  ): boolean {
    return registry.has(key);
  }

  /**
   * Get all tool keys from registry (type-safe)
   */
  public static getAllKeys(registry: ReadonlyMap<ToolRegistryKey, ModelTool>): ToolRegistryKey[] {
    return Array.from(registry.keys());
  }

  /**
   * Get tools by category (type-safe)
   */
  public static getToolsByCategory(
    registry: ReadonlyMap<ToolRegistryKey, ModelTool>,
    category: string
  ): Array<{ key: ToolRegistryKey; tool: ModelTool }> {
    const result: Array<{ key: ToolRegistryKey; tool: ModelTool }> = [];

    for (const [key, tool] of registry.entries()) {
      if (TYPED_TOOL_CATALOG[key].category === category) {
        result.push({ key, tool });
      }
    }

    return result;
  }

  /**
   * Find registry key by function name (type-safe)
   */
  public static findKeyByFunctionName(functionName: string): ToolRegistryKey | null {
    for (const [key, toolDef] of Object.entries(TYPED_TOOL_CATALOG)) {
      if (toolDef.functionName === functionName) {
        return key as ToolRegistryKey;
      }
    }
    return null;
  }

  /**
   * Validate tool registration completeness
   */
  public static validateRegistry(registry: ReadonlyMap<ToolRegistryKey, ModelTool>): {
    isValid: boolean;
    missingTools: ToolRegistryKey[];
    extraTools: string[];
  } {
    const expectedKeys = TypedToolIdentifiers.getAllRegistryKeys();
    const actualKeys = Array.from(registry.keys());

    const missingTools = expectedKeys.filter(key => !registry.has(key));
    const extraTools = actualKeys.filter(key => !TypedToolIdentifiers.isValidRegistryKey(key));

    return {
      isValid: missingTools.length === 0 && extraTools.length === 0,
      missingTools,
      extraTools,
    };
  }
}

/**
 * Legacy compatibility - convert typed registry to string-keyed registry
 */
export function createLegacyToolRegistry(
  options: ToolRegistryOptions = {}
): Map<string, ModelTool> {
  const typedRegistry = createDefaultToolRegistry(options);
  const legacyRegistry = new Map<string, ModelTool>();

  for (const [key, tool] of typedRegistry.entries()) {
    legacyRegistry.set(key, tool);
  }

  logger.debug(
    `[DefaultToolRegistry] Created legacy compatibility registry with ${legacyRegistry.size} tools`
  );
  return legacyRegistry;
}
