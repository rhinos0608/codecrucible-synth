/**
 * Tool Integration System
 * Converts internal tools to LLM function calling format and handles execution
 */

import { MCPServerManager } from '../../mcp-servers/mcp-server-manager.js';
import { FilesystemTools } from './filesystem-tools.js';
import { Logger } from '../logger.js';

const logger = new Logger('ToolIntegration');

export interface LLMFunction {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface ToolCall {
  function: {
    name: string;
    arguments: string;
  };
}

export class ToolIntegration {
  private mcpManager: MCPServerManager;
  private filesystemTools: FilesystemTools;
  protected availableTools: Map<string, any> = new Map();

  constructor(mcpManager: MCPServerManager) {
    this.mcpManager = mcpManager;
    this.filesystemTools = new FilesystemTools(mcpManager);
    this.initializeTools();
  }

  private initializeTools(): void {
    // Register filesystem tools
    const fsTools = this.filesystemTools.getTools();
    for (const tool of fsTools) {
      this.availableTools.set(tool.id, tool);
    }

    logger.info(`Initialized ${this.availableTools.size} tools for LLM integration`);
  }

  /**
   * Get all tools in LLM function calling format
   */
  getLLMFunctions(): LLMFunction[] {
    const functions: LLMFunction[] = [];

    for (const tool of this.availableTools.values()) {
      functions.push({
        type: 'function',
        function: {
          name: tool.id,
          description: tool.description,
          parameters: {
            type: 'object',
            properties: tool.inputSchema.properties || {},
            required: tool.inputSchema.required || [],
          },
        },
      });
    }

    return functions;
  }

  /**
   * Execute a tool call from the LLM
   */
  async executeToolCall(toolCall: ToolCall): Promise<any> {
    try {
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);

      logger.info(`Executing tool: ${functionName} with args:`, args);
      try {
        const availableToolsList = this.availableTools ? Array.from(this.availableTools.keys()).join(', ') : 'NO TOOLS';
        logger.info(`🔥 BASE TOOL INTEGRATION: Executing ${functionName}, available tools: ${availableToolsList}`);
      } catch (e) {
        logger.error(`🔥 BASE TOOL INTEGRATION: Error listing tools:`, e);
      }

      const tool = this.availableTools.get(functionName);
      if (!tool) {
        throw new Error(`Unknown tool: ${functionName}`);
      }

      const context = {
        startTime: Date.now(),
        userId: 'system',
        requestId: `tool_${Date.now()}`,
        environment: 'development',
      };

      const result = await tool.execute(args, context);

      logger.info(`Tool ${functionName} executed successfully:`, {
        success: result.success,
        executionTime: result.metadata?.executionTime,
      });

      return result;
    } catch (error) {
      logger.error(`Tool execution failed:`, error);
      throw error;
    }
  }

  /**
   * Get available tool names
   */
  getAvailableToolNames(): string[] {
    return Array.from(this.availableTools.keys());
  }

  /**
   * Check if a tool is available
   */
  hasToolFunction(functionName: string): boolean {
    return this.availableTools.has(functionName);
  }
}

// Export a global instance that can be used by the model client
let globalToolIntegration: ToolIntegration | null = null;

export function initializeGlobalToolIntegration(mcpManager: MCPServerManager): void {
  globalToolIntegration = new ToolIntegration(mcpManager);
}

export function getGlobalToolIntegration(): ToolIntegration | null {
  return globalToolIntegration;
}
