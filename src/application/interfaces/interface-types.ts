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

// Export empty objects for compatibility
export const UnifiedClientConfig = {} as Record<string, unknown>;
export const ModelRequest = {} as Record<string, unknown>;
export const ModelResponse = {} as Record<string, unknown>;
export const ProjectContext = {} as Record<string, unknown>;
export const AppConfig = {} as Record<string, unknown>;
export const AgentConfig = {} as Record<string, unknown>;
export const ExecutionResult = {} as Record<string, unknown>;
export const SynthesisResponse = {} as Record<string, unknown>;
export const ExecutionMode = {} as Record<string, unknown>;