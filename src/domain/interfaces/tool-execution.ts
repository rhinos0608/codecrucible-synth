/**
 * Domain-level Tool Execution Interface Definitions
 *
 * Pure domain interfaces with no infrastructure dependencies
 * Following layered architecture - Domain layer must not import Infrastructure
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
  [key: string]: unknown;
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
    toolName?: string;
    requestId?: string;
  };
  warnings?: string[];
}
