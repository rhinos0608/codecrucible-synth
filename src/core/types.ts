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
}

// Re-export from domain types for compatibility
export type { UnifiedConfiguration } from '../domain/types/unified-types.js';