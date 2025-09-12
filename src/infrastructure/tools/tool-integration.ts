/**
 * Tool Integration System
 * Converts internal tools to LLM function calling format and handles execution
 */

import { MCPServerManager } from '../../mcp-servers/mcp-server-manager.js';
import { unifiedToolRegistry } from './unified-tool-registry.js';
import { FilesystemTools } from './filesystem-tools.js';
import type { ConsolidatedRustSystem } from '../execution/rust/index.js';
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
// Use the ConsolidatedRustSystem for type safety
export type RustExecutionBackend = Readonly<ConsolidatedRustSystem>;

export interface ToolDefinition<TArgs = Record<string, unknown>, TResult = ToolExecutionResult> {
  id: string;
  // Some tool providers also expose a human/callable name distinct from id (e.g., filesystem_read_file)
  // We keep it optional to avoid breaking existing implementers.
  // When present, we will expose this as the LLM-facing function name and also register it for lookup.
  name?: string;
  description: string;
  inputSchema: {
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: Readonly<TArgs>, context: Readonly<ToolExecutionContext>) => Promise<TResult>;
}

export class ToolIntegration {
  private readonly mcpManager: MCPServerManager;
  // Store as read-only to prevent accidental mutation and fix assignability
  private rustBackend: Readonly<ConsolidatedRustSystem> | null;
  private filesystemTools: FilesystemTools;
  private isInitialized: boolean = false;
  private availableTools: Map<string, ToolDefinition> = new Map();
  private logger = console;

  public constructor(mcpManager: MCPServerManager, rustBackend?: Readonly<ConsolidatedRustSystem>) {
    this.mcpManager = mcpManager;
    this.rustBackend = rustBackend ?? null;
    this.filesystemTools = new FilesystemTools();
  }

  private normalizeFunctionName(name: string): string[] {
    const variants = new Set<string>();
    const base = name.trim();
    const lower = base.toLowerCase();
    const underscore = lower.replace(/[\s-]+/g, '_');
    const noFileSuffix = underscore.replace(/_file$/, '');
    const noMcpPrefix = underscore.replace(/^mcp_/, '');

    const withFsPrefix = (n: string) => (n.startsWith('filesystem_') ? n : `filesystem_${n}`);
    const withFilePrefix = (n: string) => (n.startsWith('file_') ? n : `file_${n}`);

    [base, lower, underscore, noFileSuffix, noMcpPrefix].forEach(v => variants.add(v));
    [underscore, noFileSuffix, noMcpPrefix].forEach(v => {
      variants.add(withFsPrefix(v));
      variants.add(withFilePrefix(v));
    });

    return Array.from(variants);
  }

  private suggestTools(input: string, limit = 3): string[] {
    const names = Array.from(this.availableTools.keys());
    const distance = (a: string, b: string): number => {
      const dp: number[][] = Array.from({ length: b.length + 1 }, () => Array(a.length + 1).fill(0));
      for (let i = 0; i <= a.length; i++) dp[0][i] = i;
      for (let j = 0; j <= b.length; j++) dp[j][0] = j;
      for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          dp[j][i] = Math.min(dp[j][i - 1] + 1, dp[j - 1][i] + 1, dp[j - 1][i - 1] + cost);
        }
      }
      return dp[b.length][a.length];
    };
    return names
      .map(n => ({ n, d: distance(input.toLowerCase(), n.toLowerCase()) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, limit)
      .map(x => x.n);
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
  public setRustBackend(backend: Readonly<ConsolidatedRustSystem>): void {
    this.rustBackend = backend;
    if (typeof this.filesystemTools.setRustBackend === 'function') {
      // Cast to the correct type for FilesystemTools
      this.filesystemTools.setRustBackend(backend as ConsolidatedRustSystem);
      this.logger.info('Rust backend updated via setRustBackend');
    }
  }
  /* Duplicate constructor removed; logic merged into the main constructor above */

  private async initializeTools(): Promise<void> {
    try {
      // Initialize filesystem tools with proper backend delegation

      // Always wire the MCP manager for fallback operations
      this.filesystemTools.setMCPManager(this.mcpManager);
      this.logger.info('MCP manager attached to filesystem tools');

      // If an injected rustBackend exists, attach it to filesystem tools
      if (this.rustBackend) {
        try {
          // Pass a mutable view to FilesystemTools when wiring
          this.filesystemTools.setRustBackend(this.rustBackend as ConsolidatedRustSystem);
          this.logger.info('Injected Rust execution backend attached to filesystem tools');
        } catch (error) {
          this.logger.warn('Failed to attach injected Rust backend to filesystem tools', error);
        }
      }
      const fsTools = this.filesystemTools.getTools();
      for (const tool of fsTools) {
        if (tool?.id) {
          // Normalize input schema
          const inputSchema = tool.inputSchema as
            | { properties: Record<string, unknown>; required?: string[] }
            | undefined;
          const safeTool: ToolDefinition = {
            id: tool.id,
            // Preserve a callable name when provided by the underlying tool (e.g., filesystem_read_file)
            name: (tool as unknown as { name?: string })?.name,
            description: tool.description,
            inputSchema: {
              properties: inputSchema?.properties ?? {},
              required: inputSchema?.required ?? [],
            },
            execute: tool.execute as ToolDefinition['execute'],
          };
          // Register under both id and name to align LLM function names and executor lookup
          this.availableTools.set(safeTool.id, safeTool);
          if (safeTool.name && safeTool.name !== safeTool.id) {
            this.availableTools.set(safeTool.name, safeTool);
          }
        }
      }

      // Register core tool suite (bash, file, grep, glob, agent)
      try {
        const { CoreToolSuite } = await import('./core-tools.js');
        const coreTools = new CoreToolSuite().getTools();
        for (const tool of coreTools) {
          if (!tool?.id) continue;
          const inputSchema = tool.inputSchema as
            | { properties: Record<string, unknown>; required?: string[] }
            | undefined;
          const safeTool: ToolDefinition = {
            id: tool.id,
            name: (tool as unknown as { name?: string }).name ?? tool.id,
            description: tool.description,
            inputSchema: {
              properties: inputSchema?.properties ?? {},
              required: inputSchema?.required ?? [],
            },
            execute: tool.execute as ToolDefinition['execute'],
          };
          this.availableTools.set(safeTool.id, safeTool);
          this.availableTools.set(safeTool.name!, safeTool);
        }
      } catch (err) {
        this.logger.warn('Failed to load CoreToolSuite', err);
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

    const seen = new Set<string>();
    const functions: LLMFunction[] = [];

    for (const tool of this.availableTools.values()) {
      // Prefer the callable name when available (e.g., filesystem_read_file); fallback to id
      const callable = (tool as { name?: string }).name || tool.id;
      if (seen.has(callable)) continue;
      seen.add(callable);
      functions.push({
        type: 'function',
        function: {
          name: callable,
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
          // Prefer the callable name if available to align with what LLM will call
          name: (tool as unknown as { name?: string }).name || tool.id,
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
      // Parse args robustly
      const rawArgs = toolCall.function.arguments;
      let args: Record<string, unknown> = {};
      if (typeof rawArgs === 'string') {
        try {
          args = rawArgs ? JSON.parse(rawArgs) : {};
        } catch {
          args = { $raw: rawArgs };
        }
      } else if (rawArgs && typeof rawArgs === 'object') {
        args = rawArgs as Record<string, unknown>;
      }

      this.logger.info(`Executing tool (MCP preferred): ${functionName} with args:`, args);

      // Preferred path: JSON-RPC 2.0 through MCP manager
      try {
        const mcpResult = await this.mcpManager.executeTool(functionName, args, {
          sessionId: `tool_${Date.now()}`,
          toolName: functionName,
          executionMode: 'sync',
        } as unknown as ToolExecutionContext);
        if (mcpResult && typeof mcpResult === 'object' && 'success' in mcpResult) {
          return mcpResult as ToolExecutionResult;
        }
      } catch (mcpError) {
        this.logger.warn('MCP tool execution failed; falling back to internal handlers', mcpError);
      }

      // Lookup by callable name first, then by id fallback with normalization variants
      let tool = this.availableTools.get(functionName);
      if (!tool) {
        for (const v of this.normalizeFunctionName(functionName)) {
          tool = this.availableTools.get(v);
          if (tool) break;
        }
      }

      if (!tool) {
        // As a last resort, try unified registry resolution (wider alias support)
        try {
          const registryResult = await unifiedToolRegistry.executeTool(functionName, args, {
            sessionId: `session_${Date.now()}`,
            requestId: `tool_${Date.now()}`,
          });
          if (registryResult.success) {
            return {
              success: true,
              data: registryResult.data,
              metadata: {
                executionTime: registryResult.metadata?.executionTime ?? undefined,
                toolName: functionName,
                requestId: `tool_${Date.now()}`,
              },
            };
          }
        } catch (e) {
          // ignore, proceed to suggestions
        }

        // Telemetry: record unknown tool attempt
        try {
          unifiedToolRegistry.incrementUnknownToolAttempt(functionName);
        } catch {}

        const availableTools = Array.from(this.availableTools.keys());
        const suggestions = this.suggestTools(functionName, 3);
        const message = suggestions.length
          ? `Unknown tool: ${functionName}. Did you mean: ${suggestions.join(', ')}?`
          : `Unknown tool: ${functionName}. Available: ${availableTools.slice(0, 20).join(', ')}...`;
        this.logger.warn(message);
        throw new Error(message);
      }

      const context: ToolExecutionContext = {
        userId: 'system',
        sessionId: `session_${Date.now()}`,
        requestId: `tool_${Date.now()}`,
        environment: { NODE_ENV: 'development' },
        toolName: functionName,
        executionMode: 'sync',
      } as unknown as ToolExecutionContext;

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
    const names = new Set<string>();
    for (const t of this.availableTools.values()) {
      names.add((t as unknown as { name?: string }).name || t.id);
    }
    return Array.from(names);
  }

  /**
   * Synchronous version for backward compatibility
   */
  public getAvailableToolNamesCached(): string[] {
    if (!this.isInitialized) {
      return [];
    }
    const names = new Set<string>();
    for (const t of this.availableTools.values()) {
      names.add((t as unknown as { name?: string }).name || t.id);
    }
    return Array.from(names);
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

export function setGlobalToolIntegrationRustBackend(backend: ConsolidatedRustSystem): void {
  if (globalToolIntegration) {
    try {
      // Attach if method exists
      if (
        typeof (
          globalToolIntegration as unknown as {
            setRustBackend?: (b: ConsolidatedRustSystem) => void;
          }
        ).setRustBackend === 'function'
      ) {
        (
          globalToolIntegration as unknown as {
            setRustBackend: (b: ConsolidatedRustSystem) => void;
          }
        ).setRustBackend(backend);
      }
    } catch (e) {
      // ignore
    }
  }
}
