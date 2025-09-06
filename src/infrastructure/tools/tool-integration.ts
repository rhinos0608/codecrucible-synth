/**
 * Tool Integration System
 * Converts internal tools to LLM function calling format and handles execution
 */

import { MCPServerManager } from '../../mcp-servers/mcp-server-manager.js';
import { createDefaultToolRegistry, createLegacyToolRegistry } from './default-tool-registry.js';
import { createLogger } from '../logging/logger-adapter.js';
import { ToolDefinition, unifiedToolRegistry } from './unified-tool-registry.js';
import { normalizePath } from './path-normalizer.js';
import { inferDuration, inferRiskLevel } from './risk-scorer.js';
import { createToolAliasMapping, mapToMcpToolName, resolveToolName } from './tool-mapper.js';

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
  private readonly mcpManager: MCPServerManager;
  protected availableTools: Map<string, any> = new Map();
  private initializationPromise: Promise<void> | null = null;
  private isInitialized = false;
  private initializationFailed = false;
  private lastInitializationError: Error | null = null;
  private rustBackend: any | null = null;

  private readonly logger = createLogger('ToolIntegration');

  constructor(mcpManager: MCPServerManager, rustBackend?: any) {
    this.mcpManager = mcpManager;
    this.rustBackend = rustBackend ?? null;
    // Don't initialize synchronously - use lazy initialization
  }

  /**
   * Infer tool category from function name
   */
  private inferCategory(functionName: string): ToolDefinition['category'] {
    if (functionName.includes('filesystem') || functionName.includes('file')) return 'filesystem';
    if (functionName.includes('git')) return 'git';
    if (functionName.includes('command') || functionName.includes('execute')) return 'terminal';
    if (functionName.includes('npm') || functionName.includes('package')) return 'package';
    if (functionName.includes('smithery')) return 'external';
    return 'system';
  }

  /**
   * Map AI-facing parameter names to MCP server parameter names
   */
  private mapArgsForMcpTool(functionName: string, args: any): any {
    this.logger.info(`[ARGS DEBUG] Mapping args for ${functionName}:`, args);
    const mappedArgs = { ...args };

    // Parameter name mappings for different tools
    switch (functionName) {
      case 'filesystem_read_file':
        if (mappedArgs.file_path !== undefined) {
          mappedArgs.path = normalizePath(mappedArgs.file_path, this.logger);
          delete mappedArgs.file_path;
        }
        break;

      case 'filesystem_write_file':
        if (mappedArgs.file_path !== undefined) {
          mappedArgs.path = normalizePath(mappedArgs.file_path, this.logger);
          delete mappedArgs.file_path;
        }
        break;

      case 'filesystem_list_directory':
        if (mappedArgs.directory !== undefined) {
          mappedArgs.path = normalizePath(mappedArgs.directory, this.logger);
          delete mappedArgs.directory;
        }
        break;

      case 'filesystem_get_stats':
        if (mappedArgs.file_path !== undefined) {
          mappedArgs.path = normalizePath(mappedArgs.file_path, this.logger);
          delete mappedArgs.file_path;
        }
        break;

      // Git tools
      case 'git_status':
      case 'git_add':
      case 'git_commit':
        if (mappedArgs.path !== undefined) {
          mappedArgs.path = normalizePath(mappedArgs.path, this.logger);
        }
        break;
    }

    this.logger.info(`[ARGS DEBUG] Final mapped args for ${functionName}:`, mappedArgs);
    return mappedArgs;
  }

  /**
   * Lazy initialization with race condition protection and proper error handling
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // If previous initialization failed, provide clear error message
    if (this.initializationFailed && this.lastInitializationError) {
      this.logger.warn('Previous initialization failed, attempting retry', {
        previousError: this.lastInitializationError.message,
      });
      // Allow retry by resetting the failure flags
      this.initializationFailed = false;
      this.lastInitializationError = null;
    }

    if (this.initializationPromise) {
      this.logger.debug('Waiting for ongoing initialization to complete');
      return this.initializationPromise;
    }

    this.logger.debug('Starting tool system initialization');
    this.initializationPromise = this.initializeTools();
    try {
      await this.initializationPromise;
      this.logger.info('Tool system initialization completed successfully');
    } catch (error) {
      this.logger.error('Tool system initialization failed', error);
      // Reset promise to allow retry in different conditions
      this.initializationPromise = null;
      throw error;
    }
  }

  private async initializeTools(): Promise<void> {
    try {
      // Use the unified tool registry instead of manually building tools
      const toolRegistry = createLegacyToolRegistry({
        mcpManager: this.mcpManager,
        allowedOrigins: process.env.TOOL_ALLOWED_ORIGINS?.split(',') || ['local'],
        autoApproveTools: process.env.AUTO_APPROVE_TOOLS === 'true',
      });

      // Convert registry to our internal format
      this.availableTools.clear();
      for (const [key, tool] of toolRegistry.entries()) {
        // Convert ModelTool format to our internal tool format
        const internalTool = {
          id: tool.function.name, // Use function name as ID for AI tool calls
          name: tool.function.name,
          description: tool.function.description,
          inputSchema: {
            properties: tool.function.parameters.properties || {},
            required: tool.function.parameters.required || [],
          },
          // Execution will be handled by the unified tool system
          handler: null, // Will be resolved during execution
          // Add the missing execute method that delegates to MCP manager
          execute: async (args: any, context: any) => {
            const mcpToolName = mapToMcpToolName(tool.function.name);
            const mappedArgs = this.mapArgsForMcpTool(tool.function.name, args);
            return this.mcpManager.executeTool(mcpToolName, mappedArgs, context);
          },
        };
        this.availableTools.set(internalTool.id, internalTool);

        // DISABLED: Do not register with unified registry to prevent circular dependency
        // MCPServerManager already handles unified registry registration
        // The circular dependency was: ToolIntegration -> unifiedRegistry -> MCPManager -> unifiedRegistry -> loop
        /*
        const toolDefinition: ToolDefinition = {
          id: internalTool.id,
          name: internalTool.name, 
          description: internalTool.description,
          category: this.inferCategory(internalTool.name),
          aliases: [], // Could add category prefixes later
          inputSchema: internalTool.inputSchema,
          handler: async (args, context) => {
              const mcpToolName = mapToMcpToolName(internalTool.name);
            const mappedArgs = this.mapArgsForMcpTool(internalTool.name, args);
            return await this.mcpManager.executeTool(mcpToolName, mappedArgs, context);
          },
          security: {
            requiresApproval: false,
              riskLevel: inferRiskLevel(internalTool.name),
              allowedOrigins: ['local'],
            },
            performance: {
              estimatedDuration: inferDuration(internalTool.name),
              memoryUsage: 'low',
              cpuIntensive: false,
            },
        };
        unifiedToolRegistry.registerTool(toolDefinition);
        */
      }

      this.isInitialized = true;
      this.logger.info(
        `Initialized ${this.availableTools.size} tools using unified registry with type-safe architecture`
      );
    } catch (error) {
      this.logger.error('Failed to initialize tools:', error);
      this.initializationFailed = true;
      this.lastInitializationError = error as Error;
      // DO NOT mark as initialized - this allows the system to know tools are unavailable
      // and potentially retry under different conditions
      throw new Error(`Tool initialization failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get all tools in LLM function calling format with lazy initialization
   * Returns empty array if tools are unavailable rather than failing silently
   */
  async getLLMFunctions(): Promise<LLMFunction[]> {
    try {
      await this.ensureInitialized();
    } catch (error) {
      this.logger.warn('Tools unavailable for LLM functions:', error);
      return []; // Return empty array instead of failing
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

    this.logger.info(`Providing ${functions.length} tools to LLM for function calling`);
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

      // Debug the arguments type and value
      this.logger.info(`[DEBUG] Raw arguments:`, {
        type: typeof toolCall.function.arguments,
        value: toolCall.function.arguments,
        isString: typeof toolCall.function.arguments === 'string',
      });

      // Handle both string and object arguments with robust parsing
      let args: any;
      if (typeof toolCall.function.arguments === 'string') {
        try {
          args = JSON.parse(toolCall.function.arguments);

          // Check for multiple levels of JSON encoding (common with AI providers)
          let parseAttempts = 0;
          while (typeof args === 'string' && parseAttempts < 3) {
            parseAttempts++;
            this.logger.debug(
              `[ARGS DEBUG] Detected level-${parseAttempts} encoded JSON, parsing again`
            );

            try {
              const parsed = JSON.parse(args);
              args = parsed;
            } catch (innerError) {
              this.logger.warn(
                `[ARGS DEBUG] Failed to parse level-${parseAttempts} JSON, using previous level`
              );
              break; // Use the previous level if parsing fails
            }
          }

          if (parseAttempts > 0) {
            this.logger.info(
              `[ARGS DEBUG] Successfully decoded ${parseAttempts}-level JSON encoding`
            );
          }
        } catch (parseError) {
          this.logger.error(`Failed to parse arguments JSON:`, parseError);
          throw new Error(
            `Invalid JSON in tool arguments: ${parseError instanceof Error ? parseError.message : String(parseError)}`
          );
        }
      } else {
        // Arguments are already an object
        args = toolCall.function.arguments;
      }

      // Validate that args is an object (not a primitive)
      if (args === null || (typeof args !== 'object' && typeof args !== 'undefined')) {
        this.logger.warn(
          `[ARGS DEBUG] Arguments resolved to primitive type: ${typeof args}, wrapping in object`
        );
        args = { value: args }; // Wrap primitive values
      }

      this.logger.info(`Executing tool: ${functionName} with args:`, args);

      // Resolve tool name through alias mapping
      const resolvedToolName = resolveToolName(functionName, this.availableTools);
      if (!resolvedToolName) {
        const availableTools = Array.from(this.availableTools.keys());
        const aliasMapping = createToolAliasMapping(this.availableTools);
        const availableAliases = Object.keys(aliasMapping).filter(
          alias => alias !== aliasMapping[alias]
        );

        throw new Error(
          `Unknown tool: ${functionName}. Available tools: ${availableTools.join(', ')}${
            availableAliases.length > 0 ? `. Available aliases: ${availableAliases.join(', ')}` : ''
          }`
        );
      }

      const tool = this.availableTools.get(resolvedToolName);
      if (!tool) {
        throw new Error(`Tool resolution failed for: ${functionName} -> ${resolvedToolName}`);
      }

      const context = {
        startTime: Date.now(),
        userId: 'system',
        requestId: `tool_${Date.now()}`,
        environment: 'development',
      };

      const result = await tool.execute(args, context);

      // Log based on actual execution result status
      if (result.success !== false) {
        this.logger.info(
          `Tool ${functionName} (resolved: ${resolvedToolName}) executed successfully`,
          {
            success: result.success,
            executionTime: result.metadata?.executionTime,
            hasOutput: !!result.output,
            outputType: typeof result.output,
          }
        );
      } else {
        this.logger.warn(`Tool ${functionName} (resolved: ${resolvedToolName}) execution failed`, {
          success: result.success,
          error: result.error || 'Unknown error',
          executionTime: result.metadata?.executionTime,
          details: result.details,
        });
      }

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

  /**
   * Set the Rust backend for high-performance operations
   */
  setRustBackend(backend: any): void {
    this.rustBackend = backend;
    this.logger.info('Rust backend configured for high-performance tool operations');
  }

  /**
   * Get the current Rust backend
   */
  getRustBackend(): any | null {
    return this.rustBackend;
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
