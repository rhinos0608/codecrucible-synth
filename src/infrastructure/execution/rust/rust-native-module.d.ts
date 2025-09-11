// Type declarations for Rust native module

export interface RustExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  // NAPI exports use camelCase; keep snake_case optional for backwards compat
  executionTimeMs?: number;
  execution_time_ms?: number;
  performance_metrics?: string;
}

export interface RustExecutorOptions {
  securityLevel?: 'low' | 'medium' | 'high';
  capabilities?: string[];
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeoutMs?: number;
}

export class RustExecutor {
  static create(): RustExecutor;
  // Actual NAPI methods are synchronous; awaiting them is still safe in JS
  initialize(): boolean;
  executeFilesystem(operation: string, path: string, content?: string, options?: RustExecutorOptions): RustExecutionResult;
  executeCommand(command: string, args: string[], options?: RustExecutorOptions): RustExecutionResult;
  execute(toolId: string, args: string, options?: RustExecutorOptions): RustExecutionResult;
  getPerformanceMetrics(): string;
  resetPerformanceMetrics(): void;
  healthCheck(): string;
  getSupportedTools(): string[];
  getFilesystemOperations(): string[];
  getSupportedCommands(): string[];
  cleanup(): void;
  id: string;
}

export function createRustExecutor(): RustExecutor;
export function initLogging(logLevel?: string): Promise<void>;
