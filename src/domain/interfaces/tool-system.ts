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
  enum?: any[];
  default?: any;
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
  workingDirectory: string;
  securityLevel: 'low' | 'medium' | 'high';
  permissions: ToolPermission[];
  environment: Record<string, string>;
  timeoutMs?: number;
}

export interface ToolExecutionRequest {
  toolId: string;
  arguments: Record<string, any>;
  context: ToolExecutionContext;
  metadata?: Record<string, any>;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: Record<string, any>;
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
  execute(args: Record<string, any>, context: ToolExecutionContext): Promise<ToolExecutionResult>;

  /**
   * Validate arguments against the tool's parameter schema
   */
  validateArguments(args: Record<string, any>): { valid: boolean; errors?: string[] };

  /**
   * Check if the tool can be executed in the given context
   */
  canExecute(context: ToolExecutionContext): boolean;
}

/**
 * Tool Registry Interface
 */
export interface IToolRegistry {
  /**
   * Register a tool
   */
  register(tool: ITool): void;

  /**
   * Get a tool by ID
   */
  getTool(id: string): ITool | undefined;

  /**
   * Get all registered tools
   */
  getAllTools(): ITool[];

  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): ITool[];

  /**
   * Search tools by name or description
   */
  searchTools(query: string): ITool[];
}

/**
 * Tool Executor Interface
 */
export interface IToolExecutor {
  /**
   * Execute a tool
   */
  execute(request: ToolExecutionRequest): Promise<ToolExecutionResult>;

  /**
   * Execute multiple tools in sequence
   */
  executeSequence(requests: ToolExecutionRequest[]): Promise<ToolExecutionResult[]>;

  /**
   * Execute multiple tools in parallel
   */
  executeParallel(requests: ToolExecutionRequest[]): Promise<ToolExecutionResult[]>;
}

/**
 * MCP (Model Context Protocol) System Interface
 */
export interface IMCPManager {
  /**
   * Get available MCP servers
   */
  getAvailableServers(): Promise<MCPServerInfo[]>;

  /**
   * Start MCP servers
   */
  startServers(): Promise<void>;

  /**
   * Stop MCP servers
   */
  stopServers(): Promise<void>;

  /**
   * Get server status
   */
  getServerStatus(serverId?: string): Promise<Record<string, MCPServerStatus>>;

  /**
   * Execute a tool through MCP
   */
  executeMCPTool(serverId: string, toolName: string, args: any): Promise<any>;
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
