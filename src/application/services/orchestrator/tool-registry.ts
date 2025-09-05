import { ModelTool } from '../../../domain/interfaces/model-client.js';
import { createDefaultToolRegistry } from '../../../infrastructure/tools/default-tool-registry.js';
import { logger } from '../../../infrastructure/logging/logger.js';

/**
 * Interface for MCP Manager.
 * TODO: Replace with actual type or expand as needed.
 */
interface McpManager {
  // Define expected methods/properties here as needed
}

/**
 * Wrapper around MCP tool registry with simple caching.
 */
export class ToolRegistry {
  private registryCache: Map<string, ModelTool> | null = null;

  constructor(private readonly mcpManager?: McpManager) {}

  private initializeRegistry(): Map<string, ModelTool> {
    if (!this.registryCache) {
      this.registryCache = createDefaultToolRegistry({ mcpManager: this.mcpManager });
    }
    return this.registryCache;
  }

  async getToolsForModel(userQuery?: string): Promise<ModelTool[]> {
    if (!this.mcpManager) {
      return [];
    }
    try {
      const registry = this.initializeRegistry();
      const allTools = Array.from(registry.values());
      logger.info(
        `🎯 Providing all ${allTools.length} available tools to AI for intelligent selection`
      );
      return allTools;
    } catch (error) {
      logger.warn('Failed to get MCP tools for model:', error);
      const registry = this.initializeRegistry();
      return ['filesystem_list', 'filesystem_read'].map(key => registry.get(key)!).filter(Boolean);
    }
  }

  getAllAvailableTools(): string[] {
    const registry = this.initializeRegistry();
    return Array.from(registry.keys());
  }
}

export default ToolRegistry;
