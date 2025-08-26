// Application Interface Types
// Migrated from src/core/types.ts - Application layer interfaces

export interface REPLInterface {
  showStatus(): void;
  listModels(): void;
  executePromptProcessing(prompt: string, options?: any): Promise<any>;
}

// Model client interface
export interface ModelClient {
  generate(request: Record<string, unknown>): Promise<Record<string, unknown>>;
  checkStatus(): Promise<boolean>;
}

// Response Validator (placeholder)
export const ResponseValidator = {
  validate: (response: Record<string, unknown>) => ({ isValid: true, errors: [] }),
};

// Re-export types from domain layer
export type {
  ModelRequest,
  ModelResponse,
  ProjectContext,
  ExecutionResult,
  SynthesisResponse,
  ExecutionMode,
} from '../../domain/types/core-types.js';

export type {
  UnifiedClientConfig,
  AppConfig,
  AgentConfig,
} from '../../infrastructure/config/config-types.js';