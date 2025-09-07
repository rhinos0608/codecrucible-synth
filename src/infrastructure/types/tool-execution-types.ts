/**
 * Tool Execution Type Definitions
 *
 * Provides strict typing for tool execution to replace 'any' usage
 * Follows domain-driven design with comprehensive type safety
 */

export interface ToolExecutionArgs {
  // Common file system arguments
  path?: string;
  directory?: string;
  filePath?: string;
  content?: string;
  recursive?: boolean;
  encoding?: BufferEncoding;

  // Git operation arguments
  repository?: string;
  branch?: string;
  commitMessage?: string;

  // Command execution arguments
  command?: string;
  args?: string[];
  workingDirectory?: string;

  // Search and query arguments
  query?: string;
  pattern?: string;
  includeHidden?: boolean;

  // Generic extensibility for tool-specific args
  // Allow additional tool-specific arguments; use 'unknown' to avoid 'any' and require runtime checks before use
  [key: string]: unknown;
}

export interface ToolExecutionContext {
  // User and session context
  userId?: string;
  sessionId?: string;
  requestId?: string;

  // Execution environment
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeout?: number;

  // Security context
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  allowedOperations?: string[];
  restrictedPaths?: string[];

  // Tool-specific metadata
  toolName?: string;
  executionMode?: 'sync' | 'async' | 'stream';

  // Generic extensibility
  metadata?: Record<string, unknown>;
}

export interface ToolExecutionResult<T = unknown> {
  success: boolean;
  data?: T;
  output?: {
    content?: string;
    format?: 'text' | 'json' | 'binary' | 'stream';
    encoding?: BufferEncoding;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    stack?: string;
  };
  metadata?: {
    executionTime?: number;
    memoryUsage?: number;
    resourcesAccessed?: string[];
    warnings?: string[];
    toolName?: string; // Track which tool was executed
    requestId?: string; // Track request correlation
  };
  warnings?: string[];
}

// Specific result types for common tools
export interface FileOperationResult extends ToolExecutionResult<string> {
  data?: string; // File content
  metadata?: {
    fileSize?: number;
    lastModified?: Date;
    permissions?: string;
    encoding?: BufferEncoding;
  } & ToolExecutionResult['metadata'];
}

export interface DirectoryListingResult extends ToolExecutionResult<string[]> {
  data?: string[]; // File/directory names
  metadata?: {
    totalItems?: number;
    directories?: number;
    files?: number;
    totalSize?: number;
  } & ToolExecutionResult['metadata'];
}

export interface CommandExecutionResult extends ToolExecutionResult<string> {
  data?: string; // Command output
  metadata?: {
    exitCode?: number;
    stderr?: string;
    pid?: number;
    executionTime?: number;
  } & ToolExecutionResult['metadata'];
}

export interface GitOperationResult extends ToolExecutionResult<string> {
  data?: string; // Git output
  metadata?: {
    branch?: string;
    commit?: string;
    changes?: string[];
    repository?: string;
  } & ToolExecutionResult['metadata'];
}

// Tool registry types
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description?: string;
        required?: boolean;
        default?: unknown;
      }
    >;
    required?: string[];
  };
  handler: (
    args: Readonly<ToolExecutionArgs>,
    context: Readonly<ToolExecutionContext>
  ) => Promise<ToolExecutionResult>;
}

// Tool execution statistics
export interface ToolExecutionStats {
  totalExecutions: number;
  successCount: number;
  errorCount: number;
  averageExecutionTime: number;
  lastExecuted?: Date;
  mostCommonErrors: Array<{
    code: string;
    count: number;
  }>;
}

// Tool execution options
export interface ToolExecutionOptions {
  timeout?: number;
  retryAttempts?: number;
  validateArgs?: boolean;
  captureOutput?: boolean;
  logExecution?: boolean;
  securityLevel?: 'strict' | 'moderate' | 'permissive';
}

// Union types for different tool categories
export type FileSystemToolArgs = Pick<
  ToolExecutionArgs,
  'path' | 'directory' | 'filePath' | 'content' | 'recursive' | 'encoding'
>;
export type GitToolArgs = Pick<
  ToolExecutionArgs,
  'repository' | 'branch' | 'commitMessage' | 'path'
>;
export type CommandToolArgs = Pick<ToolExecutionArgs, 'command' | 'args' | 'workingDirectory'>;
export type SearchToolArgs = Pick<
  ToolExecutionArgs,
  'query' | 'pattern' | 'path' | 'includeHidden'
>;

// Type guards for runtime type checking
export function isFileOperationResult(result: Readonly<ToolExecutionResult>): result is FileOperationResult {
  return result.success && typeof result.data === 'string';
}

export function isDirectoryListingResult(
  result: Readonly<ToolExecutionResult>
): result is DirectoryListingResult {
  return result.success && Array.isArray(result.data);
}

export function isCommandExecutionResult(
  result: Readonly<ToolExecutionResult>
): result is CommandExecutionResult {
  return result.success && typeof result.data === 'string' && 'exitCode' in (result.metadata ?? {});
}

export function isGitOperationResult(result: Readonly<ToolExecutionResult>): result is GitOperationResult {
  return result.success && typeof result.data === 'string' && 'commit' in (result.metadata ?? {});
}
