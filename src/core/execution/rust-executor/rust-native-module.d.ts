// Type declarations for Rust native module

export interface RustExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  execution_time_ms: number;
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
  initialize(): Promise<boolean>;
  executeFilesystem(operation: string, path: string, content?: string, options?: RustExecutorOptions): Promise<RustExecutionResult>;
  executeCommand(command: string, args: string[], options?: RustExecutorOptions): Promise<RustExecutionResult>;
  execute(toolId: string, args: string, options?: RustExecutorOptions): Promise<RustExecutionResult>;
  getPerformanceMetrics(): Promise<string>;
  resetPerformanceMetrics(): Promise<void>;
  healthCheck(): Promise<string>;
  getSupportedTools(): string[];
  getFilesystemOperations(): string[];
  getSupportedCommands(): string[];
  cleanup(): Promise<void>;
  getId(): string;
}

export function createRustExecutor(): RustExecutor;
export function initLogging(logLevel?: string): Promise<void>;