/**
 * Tool System Interfaces
 *
 * These interfaces define contracts for tool execution and management,
 * breaking circular dependencies in the tool system.
 */

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: 'file' | 'git' | 'analysis' | 'generation' | 'research' | 'system';
  parameters: ToolParameterSchema;
  securityLevel: 'safe' | 'restricted' | 'dangerous';
  permissions: ToolPermission[];
}

export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, ToolParameter>;
  required: string[];
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  validation?: string; // regex pattern or validation rule
}

export interface ToolPermission {
  type: 'read' | 'write' | 'execute' | 'network' | 'system';
  resource: string; // file path, command name, etc.
  scope: 'file' | 'directory' | 'project' | 'system';
}

export interface ToolExecutionContext {
  sessionId: string;
  userId?: string;
  userAgent?: string;
  ipAddress?: string;
  workingDirectory: string;
  rootDirectory?: string;
  securityLevel: 'low' | 'medium' | 'high';
  permissions: ToolPermission[];
  environment: Record<string, string>;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ToolExecutionRequest {
  toolId: string;
  arguments: Record<string, unknown>;
  context: ToolExecutionContext;
  metadata?: Record<string, unknown>;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: Record<string, unknown>;
  executionTimeMs: number;
}

/**
 * Core Tool Interface
 */
export interface ITool {
  readonly definition: ToolDefinition;

  /**
   * Execute the tool with given arguments and context
   */
  execute: (
    args: Readonly<Record<string, unknown>>,
    context: Readonly<ToolExecutionContext>
  ) => Promise<ToolExecutionResult>;

  /**
   * Validate arguments against the tool's parameter schema
   */
  validateArguments: (
    args: Readonly<Record<string, unknown>>
  ) => { valid: boolean; errors?: string[] };

  /**
   * Check if the tool can be executed in the given context
   */
  canExecute: (context: Readonly<ToolExecutionContext>) => boolean;

  /**
   * Optionally add a decorator to the tool (may be a no-op for some implementations)
   */
  addDecorator?: (decorator: unknown) => ITool;
}

/**
 * Tool Registry Interface
 */
export interface IToolRegistry {
  /**
   * Register a tool
   */
  register: (tool: Readonly<ITool>) => void;

  /**
   * Get a tool by ID
   */
  getTool: (id: string) => ITool | undefined;

  /**
   * Get all registered tools
   */
  getAllTools: () => ITool[];

  /**
   * Get tools by category
   */
  getToolsByCategory: (category: string) => ITool[];

  /**
   * Search tools by name or description
   */
  searchTools: (query: string) => ITool[];
}

/**
 * Tool Executor Interface
 */
export interface IToolExecutor {
  /**
   * Execute a tool
   */
  execute: (request: Readonly<ToolExecutionRequest>) => Promise<ToolExecutionResult>;

  /**
   * Execute multiple tools in sequence
   */
  executeSequence: (requests: ReadonlyArray<Readonly<ToolExecutionRequest>>) => Promise<ToolExecutionResult[]>;

  /**
   * Execute multiple tools in parallel
   */
  executeParallel: (requests: ReadonlyArray<Readonly<ToolExecutionRequest>>) => Promise<ToolExecutionResult[]>;
}

/**
 * MCP (Model Context Protocol) System Interface
 */
export interface IMCPManager {
  /**
   * Get available MCP servers
   */
  getAvailableServers: () => Promise<MCPServerInfo[]>;

  /**
   * Start MCP servers
   */
  startServers: () => Promise<void>;

  /**
   * Stop MCP servers
   */
  stopServers: () => Promise<void>;

  /**
   * Get server status
   */
  getServerStatus: (serverId?: string) => Promise<Record<string, MCPServerStatus>>;

  /**
   * Execute a tool through MCP
   */
  executeMCPTool: (serverId: string, toolName: string, args: unknown) => Promise<unknown>;
}

export interface MCPServerInfo {
  id: string;
  name: string;
  description: string;
  status: MCPServerStatus;
  capabilities: string[];
  tools: ToolDefinition[];
}

export interface MCPServerStatus {
  status: 'connected' | 'disconnected' | 'error' | 'starting' | 'stopping';
  lastSeen?: Date;
  error?: string;
}
