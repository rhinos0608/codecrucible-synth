// Infrastructure Configuration Types
// Migrated from src/core/types.ts - Infrastructure configuration only

export interface UnifiedClientConfig {
  endpoint?: string;
  providers: Array<{
    type: 'ollama' | 'lm-studio' | 'huggingface' | 'auto';
    endpoint?: string;
    apiKey?: string;
    model?: string;
    timeout?: number;
    maxRetries?: number;
  }>;
  defaultModel?: string;
  executionMode: 'auto' | 'fast' | 'quality';
  fallbackChain: Array<'ollama' | 'lm-studio' | 'huggingface' | 'auto'>;
  performanceThresholds: {
    fastModeMaxTokens: number;
    timeoutMs: number;
    maxConcurrentRequests: number;
  };
  security: {
    enableSandbox: boolean;
    maxInputLength: number;
    allowedCommands: string[];
  };
  streaming?: {
    enabled?: boolean;
    bufferSize?: number;
    flushInterval?: number;
    chunkSize?: number;
    timeout?: number;
  };
}

export interface AppConfig {
  llm: {
    provider: string;
    model: string;
    endpoint: string;
  };
  features: {
    voiceArchetypes: boolean;
    agenticMode: boolean;
  };
}

export interface AgentConfig {
  voices: string[];
  maxIterations: number;
  qualityThreshold: number;
}