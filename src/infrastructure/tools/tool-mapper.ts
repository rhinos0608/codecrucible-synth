/**
 * Mapping utilities between AI-facing tool names and MCP tool identifiers.
 * Extracted from ToolIntegration for reuse.
 */
export function mapToMcpToolName(functionName: string): string {
  const mapping: Record<string, string> = {
    // Filesystem tools
    filesystem_read_file: 'read_file',
    filesystem_write_file: 'write_file',
    filesystem_list_directory: 'list_directory',
    filesystem_get_stats: 'get_stats',
    // Git tools
    git_status: 'git_status',
    git_add: 'git_add',
    git_commit: 'git_commit',
    // System tools
    execute_command: 'execute_command',
    // Package manager tools
    npm_install: 'npm_install',
    npm_run: 'npm_run',
    // Smithery tools
    smithery_status: 'smithery_status',
    smithery_refresh: 'smithery_refresh',
  };

  return mapping[functionName] || functionName;
}

export function createToolAliasMapping(
  availableTools: ReadonlyMap<string, unknown>
): Record<string, string> {
  const aliases: Record<string, string> = {};

  aliases.filesystem_read_file = 'filesystem_read_file';
  aliases.read_file = 'filesystem_read_file';

  aliases.filesystem_write_file = 'filesystem_write_file';
  aliases.write_file = 'filesystem_write_file';

  aliases.filesystem_list_directory = 'filesystem_list_directory';
  aliases.list_directory = 'filesystem_list_directory';

  aliases.filesystem_get_stats = 'filesystem_get_stats';
  aliases.get_stats = 'filesystem_get_stats';

  for (const [toolId] of availableTools) {
    aliases[toolId] = toolId;
    if (toolId.includes('_')) {
      const shortName = toolId.split('_').slice(1).join('_');
      if (shortName) {
        aliases[shortName] = toolId;
      }
    }
  }
  return aliases;
}

export function resolveToolName(
  functionName: string,
  availableTools: ReadonlyMap<string, unknown>
): string | null {
  if (availableTools.has(functionName)) {
    return functionName;
  }
  const aliasMapping = createToolAliasMapping(availableTools);
  const resolvedName = aliasMapping[functionName];
  if (resolvedName && availableTools.has(resolvedName)) {
    return resolvedName;
  }
  const mcpName = mapToMcpToolName(functionName);
  for (const [toolId] of availableTools) {
    if (mapToMcpToolName(toolId) === mcpName) {
      return toolId;
    }
  }
  return null;
}
