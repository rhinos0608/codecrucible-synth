/**
 * Core Domain Types - Compatibility Stub
 *
 * This provides core types that were removed during refactoring
 * to maintain backward compatibility.
 *
 * @deprecated Use unified-types.ts instead
 */

export interface StreamToken {
  content: string;
  timestamp?: number;
  index?: number;
  isComplete?: boolean;
  metadata?: Record<string, any>;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ModelCapability {
  type: string;
  supported: boolean;
}

export interface ExecutionContext {
  workingDirectory: string;
  environment: 'development' | 'production' | 'test';
  userId?: string;
  sessionId: string;
}

// Re-export types from unified-types for backward compatibility
export type {
  ModelRequest,
  ModelResponse,
  ProjectContext,
  ExecutionResult
} from './unified-types.js';

// Additional types for backward compatibility
export type ExecutionMode = 'sync' | 'async' | 'streaming' | 'batch';

export interface SynthesisResponse {
  success: boolean;
  result?: any;
  error?: string;
  metadata: {
    timestamp: string;
    duration: number;
    voicesInvolved: string[];
    phase: string;
  };
}
