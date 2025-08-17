
// Core Type Definitions for CodeCrucible Synth
export interface UnifiedClientConfig {
  endpoint: string;
  providers: Array<{
    type: 'ollama' | 'lm-studio' | 'huggingface';
    endpoint: string;
    models?: string[];
  }>;
  defaultModel?: string;
  executionMode: 'auto' | 'fast' | 'quality';
  fallbackChain: Array<'ollama' | 'lm-studio' | 'huggingface'>;
  performanceThresholds: {
    maxLatency: number;
    minQuality: number;
  };
  security: {
    enableValidation: boolean;
    maxTokens: number;
  };
}

export interface ModelRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ModelResponse {
  content: string;
  model: string;
  provider: string;
  metadata: {
    tokens: number;
    latency: number;
    quality?: number;
  };
}

export interface ProjectContext {
  workingDirectory: string;
  config: any;
  files: Array<{
    path: string;
    content: string;
    type: string;
    language?: string;
  }>;
  structure?: {
    directories: string[];
    fileTypes: Record<string, number>;
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

export interface ExecutionResult {
  success: boolean;
  content: string;
  metadata: {
    model: string;
    tokens: number;
    latency: number;
  };
  output?: string;
}

export interface SynthesisResponse {
  code: string;
  reasoning: string;
  quality: number;
}

// Security Types
export interface SecurityValidation {
  isValid: boolean;
  reason?: string;
  sanitizedInput?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface SecurityError extends Error {
  code: string;
  risk: string;
}

// CLI Types
export interface CLIError extends Error {
  code: string;
  exitCode: number;
}

export enum CLIExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  INVALID_ARGS = 2,
  CONFIG_ERROR = 3,
  NETWORK_ERROR = 4
}

// Agent Types
export interface Task {
  id: string;
  type: string;
  description: string;
  capability?: string;
  input?: string;
}

export interface Workflow {
  id: string;
  tasks: Task[];
  startTime: Date;
  endTime?: Date;
  results?: any;
  error?: string;
  request?: any;
}

export interface ExecutionRequest {
  type: string;
  input: string;
  mode?: string;
}

export interface ExecutionResponse {
  success: boolean;
  result: any;
  workflowId?: string;
  executionTime?: number;
}

// Voice Archetype Types
export interface VoiceConfig {
  name: string;
  prompt: string;
  temperature: number;
  model: string;
}

export interface IterativeResult {
  content: string;
  iterations: Array<{
    content: string;
    feedback: string;
    improvement: number;
    iteration?: number;
    qualityScore?: number;
    diff?: any;
    code?: string;
    auditFeedback?: string;
  }>;
  finalCode?: string;
  writerVoice?: string;
  auditorVoice?: string;
  totalIterations?: number;
  finalQualityScore?: number;
  converged?: boolean;
}

export interface SynthesisResult {
  content: string;
  voicesUsed?: string[];
  qualityScore?: number;
  combinedCode?: string;
  reasoning?: string;
}

export interface SpiralConfig {
  maxIterations: number;
  qualityThreshold?: number;
  voices: string[];
}

// Performance Types
export interface ProviderMetrics {
  requests: number;
  totalLatency: number;
  averageLatency: number;
  errorRate?: number;
  lastError?: string;
}

export interface PerformanceMetrics {
  timestamp: Date;
  totalRequests: number;
  averageLatency: number;
  errorRate: number;
  providers?: Record<string, ProviderMetrics>;
  overall?: {
    successRate: number;
    uptime: number;
  };
}

// Response Validator (placeholder)
export const ResponseValidator = {
  validate: (response: any) => ({ isValid: true, errors: [] })
};

// Export classes for compatibility
export const UnifiedClientConfig = {} as any;
export const ModelRequest = {} as any;
export const ModelResponse = {} as any;
export const ProjectContext = {} as any;
export const AppConfig = {} as any;
export const AgentConfig = {} as any;
export const ExecutionResult = {} as any;
export const SynthesisResponse = {} as any;


// Additional types for agent system
export interface ExecutionMode {
  type: 'auto' | 'fast' | 'quality';
  timeout?: number;
}

// Update Workflow interface
export interface WorkflowExtended extends Workflow {
  status?: 'pending' | 'running' | 'completed' | 'failed';
}

// Update ExecutionResponse interface  
export interface ExecutionResponseExtended extends ExecutionResponse {
  results?: any;
  error?: string;
}

// Update Task interface
export interface TaskExtended extends Task {
  priority?: 'low' | 'medium' | 'high';
}

// Export for compatibility
export const ExecutionMode = {} as any;

// Model client compatibility
export interface ModelClient {
  generate(request: any): Promise<any>;
  checkStatus(): Promise<boolean>;
}
