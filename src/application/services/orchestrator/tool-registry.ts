import { ModelTool } from '../../../domain/interfaces/model-client.js';
import { IMcpManager } from '../../../domain/interfaces/mcp-manager.js';
import { createDefaultToolRegistry } from '../../../infrastructure/tools/default-tool-registry.js';
import { logger } from '../../../infrastructure/logging/logger.js';
import { toReadonlyRecord } from '../../../utils/type-guards.js';

/**
 * Wrapper around MCP tool registry with simple caching.
 */
export class ToolRegistry {
  private registryCache: Map<string, ModelTool> | null = null;

  public constructor(private readonly mcpManager?: Readonly<IMcpManager>) {}

  private initializeRegistry(): Map<string, ModelTool> {
    if (!this.registryCache) {
      this.registryCache = createDefaultToolRegistry({ mcpManager: this.mcpManager });
    }
    return this.registryCache;
  }

  public async getToolsForModel(userQuery?: string): Promise<ModelTool[]> {
    if (!this.mcpManager) {
      return Promise.resolve([]);
    }

    try {
      const registry = this.initializeRegistry();
      const allTools = Array.from(registry.values());

      // If no user query provided, return essential tools only
      if (!userQuery || userQuery.trim().length === 0) {
        const essentialTools = this.getEssentialTools(registry);
        logger.info(`🎯 No query context - providing ${essentialTools.length} essential tools`);
        return await Promise.resolve(essentialTools);
      }

      // Apply contextual filtering based on user query
      const filteredTools = this.filterToolsByContext(userQuery, allTools);

      logger.info(
        `🎯 Contextual filtering: ${filteredTools.length}/${allTools.length} tools selected for query context`
      );

      return await Promise.resolve(filteredTools);
    } catch (error) {
      logger.warn('Failed to get MCP tools for model:', toReadonlyRecord(error));
      const registry = this.initializeRegistry();
      return Promise.resolve(
        ['filesystem_list', 'filesystem_read']
          .map(key => registry.get(key))
          .filter((tool): tool is ModelTool => Boolean(tool))
      );
    }
  }

  /**
   * Get essential tools that are commonly needed
   */
  private getEssentialTools(registry: Map<string, ModelTool>): ModelTool[] {
    const essentialToolNames = [
      'filesystem_read_file',
      'filesystem_list_directory',
      'filesystem_get_file_info',
      'filesystem_write_file',
    ];

    return essentialToolNames.map(name => registry.get(name)).filter(Boolean) as ModelTool[];
  }

  /**
   * Filter tools based on user query context
   */
  private filterToolsByContext(userQuery: string, allTools: ModelTool[]): ModelTool[] {
    const queryLower = userQuery.toLowerCase();
    const context = this.analyzeQueryContext(queryLower);

    return allTools.filter(tool => this.isToolRelevantForContext(tool, context));
  }

  /**
   * Analyze user query to determine context categories
   */
  private analyzeQueryContext(queryLower: string): Set<string> {
    const contexts = new Set<string>();

    // Always include filesystem as most queries need file access
    contexts.add('filesystem');

    // File operations
    if (
      this.matchesPatterns(queryLower, [
        'read',
        'write',
        'create',
        'delete',
        'modify',
        'edit',
        'file',
        'folder',
        'directory',
        'analyze',
        'check',
        'examine',
        'look at',
        'show me',
        'list',
      ])
    ) {
      contexts.add('filesystem');
    }

    // Git operations
    if (
      this.matchesPatterns(queryLower, [
        'git',
        'commit',
        'branch',
        'merge',
        'pull',
        'push',
        'status',
        'log',
        'diff',
        'repository',
        'repo',
        'version control',
      ])
    ) {
      contexts.add('git');
    }

    // Terminal/system operations
    if (
      this.matchesPatterns(queryLower, [
        'run',
        'execute',
        'command',
        'terminal',
        'shell',
        'bash',
        'npm',
        'node',
        'install',
        'build',
        'test',
        'start',
        'stop',
        'process',
      ])
    ) {
      contexts.add('terminal');
    }

    // Package management
    if (
      this.matchesPatterns(queryLower, [
        'package',
        'dependency',
        'npm',
        'yarn',
        'install',
        'update',
        'upgrade',
        'requirements',
        'dependencies',
        'node_modules',
      ])
    ) {
      contexts.add('packages');
    }

    // Development/coding tasks
    if (
      this.matchesPatterns(queryLower, [
        'code',
        'function',
        'class',
        'method',
        'variable',
        'import',
        'export',
        'typescript',
        'javascript',
        'python',
        'refactor',
        'optimize',
      ])
    ) {
      contexts.add('development');
    }

    // Server/network operations
    if (
      this.matchesPatterns(queryLower, [
        'server',
        'port',
        'http',
        'api',
        'endpoint',
        'request',
        'response',
        'curl',
        'fetch',
        'network',
        'connection',
      ])
    ) {
      contexts.add('server');
    }

    // If no specific context detected, include common contexts
    if (contexts.size === 1) {
      // Only filesystem
      contexts.add('development');
      contexts.add('terminal');
    }

    return contexts;
  }

  /**
   * Check if query matches any of the given patterns
   */
  private matchesPatterns(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => text.includes(pattern));
  }

  /**
   * Determine if a tool is relevant for the given contexts
   */
  private isToolRelevantForContext(tool: ModelTool, contexts: Set<string>): boolean {
    const toolName = tool.function.name.toLowerCase();

    // Essential filesystem tools are always included
    if (toolName.startsWith('filesystem_') && contexts.has('filesystem')) {
      return true;
    }

    // Git tools
    if (toolName.startsWith('git_') && contexts.has('git')) {
      return true;
    }

    // Terminal tools
    if (
      (toolName.startsWith('terminal_') ||
        toolName.startsWith('execute_') ||
        toolName.includes('command')) &&
      contexts.has('terminal')
    ) {
      return true;
    }

    // Package management tools
    if (
      (toolName.includes('package') ||
        toolName.includes('npm') ||
        toolName.includes('dependency')) &&
      contexts.has('packages')
    ) {
      return true;
    }

    // Server/network tools
    if (
      (toolName.includes('server') ||
        toolName.includes('http') ||
        toolName.includes('curl') ||
        toolName.includes('fetch')) &&
      contexts.has('server')
    ) {
      return true;
    }

    // Development-specific tools
    if (
      contexts.has('development') &&
      (toolName.includes('code') ||
        toolName.includes('format') ||
        toolName.includes('lint') ||
        toolName.includes('analyze'))
    ) {
      return true;
    }

    // Default: exclude tools that don't match any context
    return false;
  }

  getAllAvailableTools(): string[] {
    const registry = this.initializeRegistry();
    return Array.from(registry.keys());
  }
}

export default ToolRegistry;
