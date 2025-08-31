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
  UnifiedConfiguration as UnifiedClientConfig,
  AppConfiguration as AppConfig,
} from '../../domain/interfaces/configuration.js';

// Agent configuration based on legacy config structure
export interface AgentConfig {
  enabled: boolean;
  mode: 'fast' | 'balanced' | 'thorough' | 'auto';
  maxConcurrency: number;
  enableCaching: boolean;
  enableMetrics: boolean;
  enableSecurity: boolean;
}