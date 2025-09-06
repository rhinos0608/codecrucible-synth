/**
 * Typed Tool Identifiers
 *
 * Provides compile-time safety for tool identifiers across the entire system.
 * Eliminates runtime errors from using non-existent tool names.
 *
 * Strategy: Use TypeScript literal types to ensure tool IDs are validated at compile time.
 */

// ================================
// TOOL REGISTRY KEYS
// ================================

/**
 * Available tool registry keys - provides compile-time safety
 */
export type ToolRegistryKey =
  // Filesystem tools
  | 'filesystem_list'
  | 'filesystem_read'
  | 'filesystem_write'
  | 'filesystem_stats'
  // Git tools
  | 'git_status'
  | 'git_add'
  | 'git_commit'
  // System tools
  | 'execute_command'
  // Package management tools
  | 'npm_install'
  | 'npm_run'
  // External services
  | 'smithery_status'
  | 'smithery_refresh';

// ================================
// FUNCTION NAMES
// ================================

/**
 * Available tool function names - provides compile-time safety
 */
export type ToolFunctionName =
  // Filesystem operations
  | 'filesystem_list_directory'
  | 'filesystem_read_file'
  | 'filesystem_write_file'
  | 'filesystem_get_stats'
  // Git operations
  | 'git_status'
  | 'git_add'
  | 'git_commit'
  // System operations
  | 'execute_command'
  // Package management
  | 'npm_install'
  | 'npm_run'
  // External services
  | 'smithery_status'
  | 'smithery_refresh';

// ================================
// TOOL CATEGORIES
// ================================

/**
 * Tool categories for contextual filtering
 */
export type ToolCategory =
  | 'core'
  | 'filesystem'
  | 'development'
  | 'versionControl'
  | 'system'
  | 'external';

// ================================
// REGISTRY-TO-FUNCTION MAPPING
// ================================

/**
 * Type-safe mapping from registry keys to function names
 */
export type RegistryToFunctionMap = {
  filesystem_list: 'filesystem_list_directory';
  filesystem_read: 'filesystem_read_file';
  filesystem_write: 'filesystem_write_file';
  filesystem_stats: 'filesystem_get_stats';
  git_status: 'git_status';
  git_add: 'git_add';
  git_commit: 'git_commit';
  execute_command: 'execute_command';
  npm_install: 'npm_install';
  npm_run: 'npm_run';
  smithery_status: 'smithery_status';
  smithery_refresh: 'smithery_refresh';
};

// ================================
// TOOL DEFINITIONS WITH TYPES
// ================================

/**
 * Tool definition with typed identifiers
 */
export interface TypedToolDefinition {
  registryKey: ToolRegistryKey;
  functionName: ToolFunctionName;
  category: ToolCategory;
  description: string;
  isCore: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  aliases: string[];
}

/**
 * Complete tool catalog with type safety
 */
export const TYPED_TOOL_CATALOG: Record<ToolRegistryKey, TypedToolDefinition> = {
  // Filesystem tools
  filesystem_list: {
    registryKey: 'filesystem_list',
    functionName: 'filesystem_list_directory',
    category: 'filesystem',
    description: 'List files and directories in a specified path',
    isCore: true,
    riskLevel: 'low',
    aliases: ['list', 'ls', 'dir', 'list_directory', 'filesystem_ls', 'mcp_list_directory'],
  },

  filesystem_read: {
    registryKey: 'filesystem_read',
    functionName: 'filesystem_read_file',
    category: 'filesystem',
    description: 'Read the contents of a file from the filesystem',
    isCore: true,
    riskLevel: 'low',
    aliases: ['read', 'cat', 'read_file', 'filesystem_cat', 'mcp_read_file', 'file_read'],
  },

  filesystem_write: {
    registryKey: 'filesystem_write',
    functionName: 'filesystem_write_file',
    category: 'filesystem',
    description: 'Write content to a file in the filesystem',
    isCore: false,
    riskLevel: 'medium',
    aliases: ['write', 'save', 'write_file', 'filesystem_save', 'mcp_write_file', 'file_write'],
  },

  filesystem_stats: {
    registryKey: 'filesystem_stats',
    functionName: 'filesystem_get_stats',
    category: 'filesystem',
    description: 'Get file or directory statistics and metadata',
    isCore: true,
    riskLevel: 'low',
    aliases: ['stats', 'stat', 'info', 'file_info', 'filesystem_info', 'mcp_file_stats'],
  },

  // Git tools
  git_status: {
    registryKey: 'git_status',
    functionName: 'git_status',
    category: 'versionControl',
    description: 'Check git repository status',
    isCore: false,
    riskLevel: 'low',
    aliases: ['git-status', 'repo_status', 'mcp_git_status'],
  },

  git_add: {
    registryKey: 'git_add',
    functionName: 'git_add',
    category: 'versionControl',
    description: 'Add files to git staging area',
    isCore: false,
    riskLevel: 'medium',
    aliases: ['git-add', 'stage', 'mcp_git_add'],
  },

  git_commit: {
    registryKey: 'git_commit',
    functionName: 'git_commit',
    category: 'versionControl',
    description: 'Commit staged changes to git repository',
    isCore: false,
    riskLevel: 'medium',
    aliases: ['git-commit', 'commit', 'mcp_git_commit'],
  },

  // System tools
  execute_command: {
    registryKey: 'execute_command',
    functionName: 'execute_command',
    category: 'system',
    description: 'Execute system commands securely',
    isCore: false,
    riskLevel: 'high',
    aliases: ['exec', 'run', 'command', 'mcp_execute_command'],
  },

  // Package management
  npm_install: {
    registryKey: 'npm_install',
    functionName: 'npm_install',
    category: 'development',
    description: 'Install npm packages',
    isCore: false,
    riskLevel: 'medium',
    aliases: ['install', 'npm-install', 'mcp_npm_install'],
  },

  npm_run: {
    registryKey: 'npm_run',
    functionName: 'npm_run',
    category: 'development',
    description: 'Run npm scripts',
    isCore: false,
    riskLevel: 'medium',
    aliases: ['run', 'npm-run', 'mcp_npm_run'],
  },

  // External services
  smithery_status: {
    registryKey: 'smithery_status',
    functionName: 'smithery_status',
    category: 'external',
    description: 'Check Smithery registry status',
    isCore: false,
    riskLevel: 'low',
    aliases: ['smithery-status', 'mcp_smithery_status'],
  },

  smithery_refresh: {
    registryKey: 'smithery_refresh',
    functionName: 'smithery_refresh',
    category: 'external',
    description: 'Refresh Smithery registry connections',
    isCore: false,
    riskLevel: 'low',
    aliases: ['smithery-refresh', 'mcp_smithery_refresh'],
  },
};

// ================================
// UTILITY FUNCTIONS
// ================================

/**
 * Type-safe tool identifier utilities
 */
export class TypedToolIdentifiers {
  /**
   * Get all available tool registry keys
   */
  static getAllRegistryKeys(): ToolRegistryKey[] {
    return Object.keys(TYPED_TOOL_CATALOG) as ToolRegistryKey[];
  }

  /**
   * Get all available function names
   */
  static getAllFunctionNames(): ToolFunctionName[] {
    return Object.values(TYPED_TOOL_CATALOG).map(tool => tool.functionName);
  }

  /**
   * Get function name from registry key (type-safe)
   */
  static getFunctionName<K extends ToolRegistryKey>(registryKey: K): RegistryToFunctionMap[K] {
    const tool = TYPED_TOOL_CATALOG[registryKey];
    return tool.functionName as RegistryToFunctionMap[K];
  }

  /**
   * Get tool definition by registry key (type-safe)
   */
  static getToolDefinition(registryKey: ToolRegistryKey): TypedToolDefinition {
    return TYPED_TOOL_CATALOG[registryKey];
  }

  /**
   * Get tools by category (type-safe)
   */
  static getToolsByCategory(category: ToolCategory): TypedToolDefinition[] {
    return Object.values(TYPED_TOOL_CATALOG).filter(tool => tool.category === category);
  }

  /**
   * Get core tools (type-safe)
   */
  static getCoreTools(): TypedToolDefinition[] {
    return Object.values(TYPED_TOOL_CATALOG).filter(tool => tool.isCore);
  }

  /**
   * Get tools by risk level (type-safe)
   */
  static getToolsByRiskLevel(riskLevel: 'low' | 'medium' | 'high'): TypedToolDefinition[] {
    return Object.values(TYPED_TOOL_CATALOG).filter(tool => tool.riskLevel === riskLevel);
  }

  /**
   * Validate registry key at runtime (with type guard)
   */
  static isValidRegistryKey(key: string): key is ToolRegistryKey {
    return key in TYPED_TOOL_CATALOG;
  }

  /**
   * Validate function name at runtime (with type guard)
   */
  static isValidFunctionName(name: string): name is ToolFunctionName {
    return Object.values(TYPED_TOOL_CATALOG).some(tool => tool.functionName === name);
  }

  /**
   * Find registry key by alias (type-safe)
   */
  static findRegistryKeyByAlias(alias: string): ToolRegistryKey | null {
    const tool = Object.values(TYPED_TOOL_CATALOG).find(tool => tool.aliases.includes(alias));
    return tool ? tool.registryKey : null;
  }

  /**
   * Get all aliases for a registry key (type-safe)
   */
  static getAliases(registryKey: ToolRegistryKey): string[] {
    return TYPED_TOOL_CATALOG[registryKey].aliases;
  }

  /**
   * Get tool statistics for debugging
   */
  static getToolStatistics() {
    const tools = Object.values(TYPED_TOOL_CATALOG);
    const categories = [...new Set(tools.map(t => t.category))];
    const riskLevels = [...new Set(tools.map(t => t.riskLevel))];

    return {
      totalTools: tools.length,
      coreTools: tools.filter(t => t.isCore).length,
      categories: categories.length,
      riskLevels: riskLevels.length,
      byCategory: categories.map(cat => ({
        category: cat,
        count: tools.filter(t => t.category === cat).length,
      })),
      byRiskLevel: riskLevels.map(risk => ({
        riskLevel: risk,
        count: tools.filter(t => t.riskLevel === risk).length,
      })),
    };
  }
}

// ================================
// STRICT VALIDATION TYPES
// ================================

/**
 * Type that only accepts valid tool identifiers - prevents typos at compile time
 */
export type StrictToolRegistryKey = keyof typeof TYPED_TOOL_CATALOG;

/**
 * Type that only accepts valid function names - prevents typos at compile time
 */
export type StrictToolFunctionName = TypedToolDefinition['functionName'];

/**
 * Helper type for tool registration - ensures type safety
 */
export interface TypeSafeToolRegistration {
  registryKey: ToolRegistryKey;
  functionName: ToolFunctionName;
  // Ensures registry key and function name match
  _typeCheck: RegistryToFunctionMap[ToolRegistryKey] extends ToolFunctionName ? true : never;
}

// ================================
// EXPORTS
// ================================

export { TYPED_TOOL_CATALOG as ToolCatalog };
