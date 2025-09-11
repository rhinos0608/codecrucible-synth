/**
 * Tool Integration System
 * Converts internal tools to LLM function calling format and handles execution
 */

import { MCPServerManager } from '../../mcp-servers/mcp-server-manager.js';
import { FilesystemTools } from './filesystem-tools.js';
import type { RustExecutionBackend as RealRustExecutionBackend } from '../execution/rust-executor/rust-execution-backend.js';
import {
  ToolExecutionContext,
  ToolExecutionResult,
} from '../../domain/interfaces/tool-execution.js';

export interface LLMFunction {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

// (Removed from here; will be placed inside the ToolIntegration class below)

export interface ToolCall {
  function: {
    name: string;
    arguments: string;
  };
}
// Use the real RustExecutionBackend type for type safety
export type RustExecutionBackend = Readonly<RealRustExecutionBackend>;

export interface ToolDefinition<TArgs = Record<string, unknown>, TResult = ToolExecutionResult> {
  id: string;
  description: string;
  inputSchema: {
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: Readonly<TArgs>, context: Readonly<ToolExecutionContext>) => Promise<TResult>;
}

export class ToolIntegration {
  private readonly mcpManager: MCPServerManager;
  private rustBackend: RustExecutionBackend | null;
  private filesystemTools: FilesystemTools;
  private isInitialized: boolean = false;
  private availableTools: Map<string, ToolDefinition> = new Map();
  private logger = console;

  public constructor(mcpManager: MCPServerManager, rustBackend?: Readonly<RustExecutionBackend>) {
    this.mcpManager = mcpManager;
    this.rustBackend = rustBackend ?? null;
    this.filesystemTools = new FilesystemTools();
  }

  /**
   * Ensures that tools are initialized before use.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeTools();
    }
  }

  /**
   * Allows setting or updating the Rust backend after construction.
   */
  public setRustBackend(backend: Readonly<RustExecutionBackend>): void {
    this.rustBackend = backend;
    if (typeof this.filesystemTools.setRustBackend === 'function') {
      // Cast to the correct type for FilesystemTools
      this.filesystemTools.setRustBackend(backend as RealRustExecutionBackend);
      this.logger.info('Rust backend updated via setRustBackend');
    }
  }
  /* Duplicate constructor removed; logic merged into the main constructor above */

  private async initializeTools(): Promise<void> {
    try {
      // Initialize filesystem tools with proper backend delegation
      // If an injected rustBackend exists, attach it to filesystem tools
      if (this.rustBackend) {
        try {
          this.filesystemTools.setRustBackend(this.rustBackend as RealRustExecutionBackend);
          this.logger.info('Injected Rust execution backend attached to filesystem tools');
        } catch (error) {
          this.logger.warn('Failed to attach injected Rust backend to filesystem tools', error);
        }
      }
      const fsTools = this.filesystemTools.getTools();
      for (const tool of fsTools) {
        if (tool?.id) {
          // Ensure inputSchema has 'properties' (and optionally 'required')
          const inputSchema = tool.inputSchema as
            | { properties: Record<string, unknown>; required?: string[] }
            | undefined;
          const safeTool = {
            ...tool,
            inputSchema: {
              properties: inputSchema?.properties ?? {},
              required: inputSchema?.required ?? [],
            },
          };
          this.availableTools.set(tool.id, safeTool);
        }
      }

      this.isInitialized = true;
      this.logger.info(
        `Initialized ${this.availableTools.size} tools for LLM integration with Rust-first architecture`
      );
    } catch (error) {
      this.logger.error('Failed to initialize tools:', error);
      throw new Error(
        `Tool initialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  /**
   * Get all tools in LLM function calling format with lazy initialization
   */
  public async getLLMFunctions(): Promise<LLMFunction[]> {
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
            properties: tool.inputSchema.properties,
            required: tool.inputSchema.required ?? [],
          },
        },
      });
    }

    return functions;
  }

  /**
   * Synchronous version for backward compatibility (returns cached results)
   */
  public getLLMFunctionsCached(): LLMFunction[] {
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
            properties: tool.inputSchema.properties,
            required: tool.inputSchema.required ?? [],
          },
        },
      });
    }

    return functions;
  }

  /**
   * Execute a tool call from the LLM with lazy initialization
   */
  public async executeToolCall(toolCall: Readonly<ToolCall>): Promise<ToolExecutionResult> {
    await this.ensureInitialized();

    try {
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

      this.logger.info(`Executing tool: ${functionName} with args:`, args);

      const tool = this.availableTools.get(functionName);
      if (!tool) {
        const availableTools = Array.from(this.availableTools.keys());
        throw new Error(
          `Unknown tool: ${functionName}. Available tools: ${availableTools.join(', ')}`
        );
      }

      const context: ToolExecutionContext = {
        userId: 'system',
        sessionId: `session_${Date.now()}`,
        requestId: `tool_${Date.now()}`,
        environment: { NODE_ENV: 'development' },
        toolName: functionName,
        executionMode: 'sync',
      };

      const result: ToolExecutionResult = await tool.execute(args, context);

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
  public async getAvailableToolNames(): Promise<string[]> {
    await this.ensureInitialized();
    return Array.from(this.availableTools.keys());
  }

  /**
   * Synchronous version for backward compatibility
   */
  public getAvailableToolNamesCached(): string[] {
    if (!this.isInitialized) {
      return [];
    }
    return Array.from(this.availableTools.keys());
  }

  /**
   * Check if a tool is available with lazy initialization
   */
  public async hasToolFunction(functionName: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.availableTools.has(functionName);
  }

  /**
   * Synchronous version for backward compatibility
   */
  public hasToolFunctionCached(functionName: string): boolean {
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

export function setGlobalToolIntegrationRustBackend(backend: RustExecutionBackend): void {
  if (globalToolIntegration) {
    try {
      // Attach if method exists
      if (
        typeof (
          globalToolIntegration as unknown as { setRustBackend?: (b: RustExecutionBackend) => void }
        ).setRustBackend === 'function'
      ) {
        (
          globalToolIntegration as unknown as { setRustBackend: (b: RustExecutionBackend) => void }
        ).setRustBackend(backend);
      }
    } catch (e) {
      // ignore
    }
  }
}
