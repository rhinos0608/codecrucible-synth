// Core Type Definitions for CodeCrucible Synth
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
}

export interface ModelRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  provider?: string;
  abortSignal?: AbortSignal; // Add abort signal for request cancellation
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
      };
    };
  }>;
  // Properties used for complexity analysis
  context?: Record<string, JsonValue>;
  files?: string[];
}

export interface ModelResponse {
  content: string;
  model: string;
  provider?: string;
  metadata?: {
    tokens: number;
    latency: number;
    quality?: number;
  };
  tokens_used?: number;
  usage?: {
    totalTokens: number;
    promptTokens?: number;
    completionTokens?: number;
  };
  cached?: boolean;
  streamed?: boolean;
  processingTime?: number;
}

export interface ProjectContext {
  workingDirectory: string;
  config: Record<string, unknown>;
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
    type?: string;
  };
  output?: string;
  taskId?: string;
}

export interface SynthesisResponse {
  code: string;
  reasoning: string;
  quality: number;
}

export interface SynthesisResult {
  content: string;
  confidence?: number;
  voicesUsed: string[];
  voices?: string[];
  qualityScore: number;
  combinedCode?: string;
  convergenceReason?: string;
  lessonsLearned?: string[];
  iterations?: Array<{
    content: string;
    feedback: string;
    improvement: number;
  }>;
  writerVoice?: string;
  auditorVoice?: string;
  totalIterations?: number;
  finalQualityScore?: number;
  converged?: boolean;
  finalCode?: string;
  // Properties expected by conversation-store.ts and project-memory.ts
  synthesis?: string;
  latency?: number;
  modelUsed?: string;
  reasoning?: string;
}

// Security Types
export interface SecurityValidation {
  isValid: boolean;
  reason?: string;
  sanitizedInput?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface SecurityError extends Error {
  code: string;
  risk: string;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class SecurityError extends Error {
  public code: string;
  public risk: string;

  constructor(message: string, code: string = 'SECURITY_ERROR', risk: string = 'medium') {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.risk = risk;
  }
}

// CLI Types
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface CLIError extends Error {
  code: string;
  exitCode: number;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class CLIError extends Error {
  public code: string;
  public exitCode: number;

  constructor(message: string, exitCode: number, code: string = 'CLI_ERROR') {
    super(message);
    this.name = 'CLIError';
    this.code = code;
    this.exitCode = exitCode;
  }

  static timeout(operation: string): CLIError {
    return new CLIError(
      `Timeout occurred during ${operation}`,
      CLIExitCode.NETWORK_ERROR,
      'TIMEOUT'
    );
  }

  static networkError(message: string): CLIError {
    return new CLIError(`Network error: ${message}`, CLIExitCode.NETWORK_ERROR, 'NETWORK_ERROR');
  }
}

export enum CLIExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  INVALID_ARGS = 2,
  CONFIG_ERROR = 3,
  NETWORK_ERROR = 4,
  INVALID_INPUT = 5,
  EXECUTION_FAILED = 6,
  INITIALIZATION_FAILED = 7,
  AUTHENTICATION_REQUIRED = 8,
  AUTHENTICATION_FAILED = 9,
  PERMISSION_DENIED = 10,
  SECURITY_VIOLATION = 11,
  UNEXPECTED_ERROR = 99,
}

// LLM Provider Interfaces (moved from hybrid-model-client.ts)
export interface LLMProvider {
  name: string;
  endpoint: string;
  isAvailable(): Promise<boolean>;
  generateCode(prompt: string, options?: Record<string, unknown>): Promise<LLMResponse>;
  getCapabilities(): LLMCapabilities;
  getStatus(): Promise<LLMStatus>;
}

export interface LLMResponse {
  content: string;
  confidence: number;
  responseTime: number;
  model: string;
  provider: string;
  metadata?: Record<string, unknown>;
}

export interface LLMCapabilities {
  strengths: string[];
  optimalFor: string[];
  responseTime: string;
  contextWindow: number;
  supportsStreaming?: boolean;
  maxConcurrent?: number;
}

export interface LLMStatus {
  available: boolean;
  currentLoad: number;
  maxLoad: number;
  responseTime: number;
  errorRate: number;
  lastError?: string;
}

// Agent Types
export interface Task {
  id: string;
  type: string;
  description: string;
  capability?: string;
  input?: string;
  priority?: 'low' | 'medium' | 'high';
  estimatedTime?: number;
}

export interface ExecutionRequest {
  id: string;
  input: string;
  mode?: string;
  type?: string;
  priority?: string;
  maxTokens?: number;
  voice?: string;
  temperature?: number;
}

export interface Workflow {
  id: string;
  tasks: Task[];
  startTime: Date;
  endTime?: Date;
  results?: Record<string, unknown>;
  error?: string;
  request?: Record<string, unknown>;
  status?: 'pending' | 'running' | 'completed' | 'failed';
}

export interface ExecutionRequestExtended extends ExecutionRequest {
  type: string;
}

export interface ExecutionResponse {
  success: boolean;
  result: Record<string, unknown>;
  results?: Record<string, unknown>;
  workflowId?: string;
  executionTime?: number;
  error?: string;
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
    diff?: Record<string, unknown>;
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

export interface SpiralConfig {
  maxIterations: number;
  qualityThreshold?: number;
  voices?: string[];
  voiceSelectionStrategy?: 'adaptive' | 'fixed';
  enableAdaptiveLearning?: boolean;
  reflectionDepth?: 'shallow' | 'medium' | 'deep';
}

// Performance Types
export interface ProviderMetrics {
  requests: number;
  totalRequests: number;
  totalLatency: number;
  averageLatency: number;
  errorRate?: number;
  successRate: number;
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
    totalRequests: number;
    averageLatency: number;
  };
}

// Response Validator (placeholder)
export const ResponseValidator = {
  validate: (response: Record<string, unknown>) => ({ isValid: true, errors: [] }),
};

// Export classes for compatibility
export const UnifiedClientConfig = {} as Record<string, unknown>;
export const ModelRequest = {} as Record<string, unknown>;
export const ModelResponse = {} as Record<string, unknown>;
export const ProjectContext = {} as Record<string, unknown>;
export const AppConfig = {} as Record<string, unknown>;
export const AgentConfig = {} as Record<string, unknown>;
export const ExecutionResult = {} as Record<string, unknown>;
export const SynthesisResponse = {} as Record<string, unknown>;

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
  results?: Record<string, unknown>;
  error?: string;
}

// Update Task interface
export interface TaskExtended extends Task {
  priority?: 'low' | 'medium' | 'high';
}

// Export for compatibility
export const ExecutionMode = {} as Record<string, unknown>;

// Model client compatibility
export interface ModelClient {
  generate(request: Record<string, unknown>): Promise<Record<string, unknown>>;
  checkStatus(): Promise<boolean>;
}

// Common types to replace 'any' usage
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface JsonArray extends Array<JsonValue> {}

// Generic function types
export type TransformFunction<T, R> = (input: T) => R;
export type PredicateFunction<T> = (input: T) => boolean;
export type EvaluationFunction<T> = (input: T) => number;

// Configuration and context types
export interface ConfigurationObject extends Record<string, JsonValue> {}
export interface ExecutionContext {
  timestamp?: number;
  executionId?: string;
  [key: string]: JsonValue | undefined;
}

// Result and response types
export interface GenericResult<T = JsonValue> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, JsonValue>;
}

export interface ProcessingResult<T = JsonValue> extends GenericResult<T> {
  processingTime?: number;
  iterations?: number;
}

// Workflow and orchestration types
export interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  config?: ConfigurationObject;
}

export interface WorkflowContext {
  nodeId: string;
  history: Array<{
    nodeId: string;
    timestamp: number;
    result: JsonValue;
  }>;
  metrics?: Record<string, JsonValue>;
}

// Tool and MCP types
export interface ToolArguments extends Record<string, JsonValue> {}
export interface ToolResult<T = JsonValue> extends GenericResult<T> {}

// Memory and caching types
export interface MemoryItem {
  id: string;
  content: JsonValue;
  timestamp: number;
  importance?: number;
  metadata?: Record<string, JsonValue>;
}

export interface CacheEntry<T = JsonValue> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number;
}

// Analysis and metrics types
export interface AnalysisResult {
  type: string;
  results: Record<string, JsonValue>;
  recommendations?: string[];
  score?: number;
}

export interface MetricsData {
  timestamp: number;
  values: Record<string, number>;
  metadata?: Record<string, JsonValue>;
}

// Event and message types
export interface EventData extends Record<string, JsonValue> {
  type: string;
  timestamp: number;
}

export interface MessageData {
  from: string;
  to?: string;
  content: JsonValue;
  timestamp: number;
  metadata?: Record<string, JsonValue>;
}

// Task analysis and complexity types
export interface ComplexityAnalysis {
  score: number;
  level: 'simple' | 'medium' | 'complex';
  factors: {
    promptLength: number;
    hasContext: boolean;
    hasFiles: boolean;
    fileCount: number;
  };
  estimatedTime: string;
}

export type TaskType = 
  | 'analysis'
  | 'generation' 
  | 'refactoring'
  | 'debug'
  | 'documentation'
  | 'testing'
  | 'optimization'
  | 'general'
  | 'template'
  | 'security'
  | 'planning'
  | 'generate';
