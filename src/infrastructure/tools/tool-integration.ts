/**
 * Tool Integration System
 * Converts internal tools to LLM function calling format and handles execution
 */

import { MCPServerManager } from '../../mcp-servers/mcp-server-manager.js';
import { createDefaultToolRegistry, createLegacyToolRegistry } from './default-tool-registry.js';
import { createLogger } from '../logging/logger-adapter.js';
import { unifiedToolRegistry, ToolDefinition } from './unified-tool-registry.js';

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
   * Normalize file paths to ensure they are relative to the working directory
   */
  private normalizePath(filePath: string): string {
    if (typeof filePath !== 'string') {
      this.logger.info(`[PATH DEBUG] Non-string path:`, filePath);
      return filePath;
    }
    
    this.logger.info(`[PATH DEBUG] Original path: "${filePath}"`);
    
    // Handle git repository paths - convert to current directory
    if (filePath.includes('/project/') || filePath.includes('codecrucible')) {
      this.logger.info(`[PATH DEBUG] Git project path detected, converting to "."`);
      return '.';
    }
    
    // Convert absolute paths starting with "/" to relative paths
    if (filePath.startsWith('/')) {
      const relativePath = filePath.substring(1);
      const result = relativePath || '.';
      this.logger.info(`[PATH DEBUG] Absolute path converted: "${filePath}" → "${result}"`);
      return result;
    }
    
    // Ensure path starts with "./" for clarity if it's just a filename
    if (!filePath.startsWith('./') && !filePath.startsWith('../') && !filePath.includes('/') && filePath !== '.') {
      const result = './' + filePath;
      this.logger.info(`[PATH DEBUG] Filename prefixed: "${filePath}" → "${result}"`);
      return result;
    }
    
    this.logger.info(`[PATH DEBUG] Path unchanged: "${filePath}"`);
    return filePath;
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
   * Infer risk level from function name  
   */
  private inferRiskLevel(functionName: string): 'low' | 'medium' | 'high' | 'critical' {
    if (functionName.includes('write') || functionName.includes('execute') || functionName.includes('command')) {
      return 'high';
    }
    if (functionName.includes('git') || functionName.includes('npm')) {
      return 'medium';
    }
    return 'low';
  }
  
  /**
   * Infer estimated duration from function name
   */
  private inferDuration(functionName: string): number {
    if (functionName.includes('npm') || functionName.includes('execute')) return 5000; // 5 seconds
    if (functionName.includes('git')) return 2000; // 2 seconds  
    return 1000; // 1 second default
  }

  /**
   * Map AI-facing function names to actual MCP tool names
   */
  private mapToMcpToolName(functionName: string): string {
    const mapping: Record<string, string> = {
      // Filesystem tools
      'filesystem_read_file': 'read_file',
      'filesystem_write_file': 'write_file', 
      'filesystem_list_directory': 'list_directory',
      'filesystem_get_stats': 'get_stats',
      // Git tools
      'git_status': 'git_status',
      'git_add': 'git_add',
      'git_commit': 'git_commit',
      // System tools  
      'execute_command': 'execute_command',
      // Package manager tools
      'npm_install': 'npm_install',
      'npm_run': 'npm_run',
      // Smithery tools
      'smithery_status': 'smithery_status',
      'smithery_refresh': 'smithery_refresh',
    };

    return mapping[functionName] || functionName;
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
          mappedArgs.path = this.normalizePath(mappedArgs.file_path);
          delete mappedArgs.file_path;
        }
        break;
        
      case 'filesystem_write_file':
        if (mappedArgs.file_path !== undefined) {
          mappedArgs.path = this.normalizePath(mappedArgs.file_path);
          delete mappedArgs.file_path;
        }
        break;
        
      case 'filesystem_list_directory':
        if (mappedArgs.directory !== undefined) {
          mappedArgs.path = this.normalizePath(mappedArgs.directory);
          delete mappedArgs.directory;
        }
        break;
        
      case 'filesystem_get_stats':
        if (mappedArgs.file_path !== undefined) {
          mappedArgs.path = this.normalizePath(mappedArgs.file_path);
          delete mappedArgs.file_path;
        }
        break;
        
      // Git tools
      case 'git_status':
      case 'git_add':
      case 'git_commit':
        if (mappedArgs.path !== undefined) {
          mappedArgs.path = this.normalizePath(mappedArgs.path);
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
      throw new Error(
        `Tool system unavailable due to previous initialization failure: ${this.lastInitializationError.message}`
      );
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeTools();
    try {
      await this.initializationPromise;
    } catch (error) {
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
        autoApproveTools: process.env.AUTO_APPROVE_TOOLS === 'true'
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
            properties: tool.function.parameters?.properties || {},
            required: tool.function.parameters?.required || [],
          },
          // Execution will be handled by the unified tool system
          handler: null, // Will be resolved during execution
          // Add the missing execute method that delegates to MCP manager
          execute: async (args: any, context: any) => {
            const mcpToolName = this.mapToMcpToolName(tool.function.name);
            const mappedArgs = this.mapArgsForMcpTool(tool.function.name, args);
            return await this.mcpManager.executeTool(mcpToolName, mappedArgs, context);
          },
        };
        this.availableTools.set(internalTool.id, internalTool);
        
        // CRITICAL FIX: Register tool into unified registry for execution
        const toolDefinition: ToolDefinition = {
          id: internalTool.id,
          name: internalTool.name, 
          description: internalTool.description,
          category: this.inferCategory(internalTool.name),
          aliases: [], // Could add category prefixes later
          inputSchema: internalTool.inputSchema,
          handler: async (args, context) => {
            const mcpToolName = this.mapToMcpToolName(internalTool.name);
            const mappedArgs = this.mapArgsForMcpTool(internalTool.name, args);
            return await this.mcpManager.executeTool(mcpToolName, mappedArgs, context);
          },
          security: {
            requiresApproval: false,
            riskLevel: this.inferRiskLevel(internalTool.name),
            allowedOrigins: ['local'],
          },
          performance: {
            estimatedDuration: this.inferDuration(internalTool.name),
            memoryUsage: 'low',
            cpuIntensive: false,
          },
        };
        
        unifiedToolRegistry.registerTool(toolDefinition);
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
        isString: typeof toolCall.function.arguments === 'string'
      });
      
      // Handle both string and object arguments
      let args: any;
      if (typeof toolCall.function.arguments === 'string') {
        try {
          args = JSON.parse(toolCall.function.arguments);
          
          // Check for double-encoded JSON strings
          if (typeof args === 'string') {
            this.logger.info(`[DEBUG] Detected double-encoded JSON, parsing again`);
            args = JSON.parse(args);
          }
        } catch (parseError) {
          this.logger.error(`Failed to parse arguments JSON:`, parseError);
          throw new Error(`Invalid JSON in tool arguments: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
      } else {
        // Arguments are already an object
        args = toolCall.function.arguments;
      }

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
