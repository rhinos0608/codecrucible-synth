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
  timestamp: number;
  index: number;
  isComplete: boolean;
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
