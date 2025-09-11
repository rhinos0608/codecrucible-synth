import { ModelTool } from '../../domain/interfaces/model-client.js';
import { IMcpManager } from '../../domain/interfaces/mcp-manager.js';
import { createDefaultToolRegistry } from './default-tool-registry.js';
import { CoreToolSuite } from './core-tools.js';

interface CentralToolRegistryOptions {
  mcpManager?: IMcpManager;
}

/**
 * Centralized tool registry combining default, core, and MCP tools.
 */
export function createCentralToolRegistry(
  options: CentralToolRegistryOptions = {}
): Map<string, ModelTool> {
  const registry = createDefaultToolRegistry(options);

  // Register core tool suite
  const coreSuite = new CoreToolSuite();
  for (const tool of coreSuite.getTools()) {
    const modelTool: ModelTool = {
      type: 'function',
      function: {
        name: tool.name ?? tool.id,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.inputSchema.properties ?? {},
          required: tool.inputSchema.required ?? [],
        },
      },
    };
    registry.set(modelTool.function.name, modelTool);
  }

  // TODO: Register MCP-provided tools when manager exposes discovery API
  if (options.mcpManager) {
    // Placeholder for future integration
  }

  return registry;
}
