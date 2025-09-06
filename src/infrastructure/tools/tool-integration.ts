/**
 * Tool Integration System
 * Converts internal tools to LLM function calling format and handles execution
 */

import { MCPServerManager } from '../../mcp-servers/mcp-server-manager.js';
import { FilesystemTools } from './filesystem-tools.js';
import { createLogger } from '../logging/logger-adapter.js';

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
  private filesystemTools: FilesystemTools | null = null;
  protected availableTools: Map<string, any> = new Map();
  private initializationPromise: Promise<void> | null = null;
  private isInitialized = false;
  private rustBackend: any | null = null;

  private readonly logger = createLogger('ToolIntegration');

  constructor(mcpManager: MCPServerManager, rustBackend?: any) {
    this.mcpManager = mcpManager;
    this.rustBackend = rustBackend ?? null;
    // Don't initialize synchronously - use lazy initialization
  }

  /**
   * Lazy initialization with race condition protection
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeTools();
    await this.initializationPromise;
  }

  private async initializeTools(): Promise<void> {
    try {
      // Initialize filesystem tools with proper backend delegation
      this.filesystemTools = new FilesystemTools();

      // Set MCP manager as fallback
      if (this.mcpManager) {
        this.filesystemTools.setMCPManager(this.mcpManager);
      }

      // If an injected rustBackend exists, attach it to filesystem tools
      if (this.rustBackend) {
        try {
          this.filesystemTools.setRustBackend(this.rustBackend);
          this.logger.info('Injected Rust execution backend attached to filesystem tools');
        } catch (error) {
          this.logger.warn('Failed to attach injected Rust backend to filesystem tools', error);
        }
      }

      // Register filesystem tools
      const fsTools = this.filesystemTools.getTools();
      for (const tool of fsTools) {
        this.availableTools.set(tool.id, tool);
      }

      this.isInitialized = true;
      this.logger.info(
        `Initialized ${this.availableTools.size} tools for LLM integration with Rust-first architecture`
      );
    } catch (error) {
      this.logger.error('Failed to initialize tools:', error);
      // Don't throw - allow system to continue without tools
      this.isInitialized = true; // Mark as initialized to prevent retry loops
    }
  }

  /**
   * Get all tools in LLM function calling format with lazy initialization
   */
  async getLLMFunctions(): Promise<LLMFunction[]> {
    await this.ensureInitialized();

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
   * Synchronous version for backward compatibility (returns cached results)
   */
  getLLMFunctionsCached(): LLMFunction[] {
    if (!this.isInitialized) {
      this.logger.warn('Tools not initialized yet, returning empty functions list');
      return [];
    }

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
   * Execute a tool call from the LLM with lazy initialization
   */
  async executeToolCall(toolCall: ToolCall): Promise<any> {
    await this.ensureInitialized();

    try {
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);

      this.logger.info(`Executing tool: ${functionName} with args:`, args);

      const tool = this.availableTools.get(functionName);
      if (!tool) {
        const availableTools = Array.from(this.availableTools.keys());
        throw new Error(
          `Unknown tool: ${functionName}. Available tools: ${availableTools.join(', ')}`
        );
      }

      const context = {
        startTime: Date.now(),
        userId: 'system',
        requestId: `tool_${Date.now()}`,
        environment: 'development',
      };

      const result = await tool.execute(args, context);

      this.logger.info(`Tool ${functionName} executed successfully:`, {
        success: result.success,
        executionTime: result.metadata?.executionTime,
      });

      return result;
    } catch (error) {
      this.logger.error(`Tool execution failed:`, error);
      throw error;
    }
  }

  /**
   * Get available tool names with lazy initialization
   */
  async getAvailableToolNames(): Promise<string[]> {
    await this.ensureInitialized();
    return Array.from(this.availableTools.keys());
  }

  /**
   * Synchronous version for backward compatibility
   */
  getAvailableToolNamesCached(): string[] {
    if (!this.isInitialized) {
      return [];
    }
    return Array.from(this.availableTools.keys());
  }

  /**
   * Check if a tool is available with lazy initialization
   */
  async hasToolFunction(functionName: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.availableTools.has(functionName);
  }

  /**
   * Synchronous version for backward compatibility
   */
  hasToolFunctionCached(functionName: string): boolean {
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

// Allow application code to inject a rust backend into the global instance later
export function setGlobalToolIntegrationRustBackend(backend: any): void {
  if (globalToolIntegration) {
    try {
      // @ts-ignore - attach if method exists
      if (typeof (globalToolIntegration as any).setRustBackend === 'function') {
        (globalToolIntegration as any).setRustBackend(backend);
      }
    } catch (e) {
      // ignore
    }
  }
}

