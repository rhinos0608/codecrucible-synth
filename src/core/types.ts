/**
 * Legacy Core Types - Compatibility Stub
 *
 * This is a minimal stub to maintain backward compatibility
 * during the architectural migration.
 *
 * @deprecated These types have been moved to domain/types
 */

// Basic legacy type exports for backward compatibility
export interface ExecutionRequest {
  id: string;
  type: string;
  input: string | object;
  context?: any;
  // Legacy compatibility properties
  mode?: 'fast' | 'balanced' | 'thorough';
}

export interface ExecutionResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
  // Legacy compatibility properties
  workflowId?: string;
  results?: any;
  executionTime?: number;
}

export interface Task {
  id: string;
  type: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface Workflow {
  id: string;
  tasks: Task[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  // Legacy compatibility properties
  request?: ExecutionRequest;
  startTime?: number;
  endTime?: number;
  results?: any[];
}

export interface ProjectContext {
  rootPath: string;
  dependencies: string[];
  structure: any;
  documentation: string[];
  files?: string[];
}

// CLI Error handling types
export class CLIError extends Error {
  constructor(
    message: string,
    public exitCode: CLIExitCode = CLIExitCode.GeneralError,
    public details?: any
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

export enum CLIExitCode {
  Success = 0,
  GeneralError = 1,
  InvalidArguments = 2,
  NetworkError = 3,
  AuthenticationError = 4,
  PermissionDenied = 5,
  FileNotFound = 6,
  ConfigurationError = 7,
  TimeoutError = 8,
  InternalError = 9,
  AUTHENTICATION_REQUIRED = 10,
  AUTHENTICATION_FAILED = 11,
}

// Re-export from domain types for compatibility
export type {
  UnifiedConfiguration,
  ModelRequest,
  ModelResponse,
} from '../domain/types/unified-types.js';
