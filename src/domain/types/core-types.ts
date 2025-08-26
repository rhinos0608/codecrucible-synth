// Core Domain Type Definitions for CodeCrucible Synth
// Migrated from src/core/types.ts - Domain layer types only

export interface StreamToken {
  content: string;
  finished?: boolean;
  index: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ModelRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  provider?: string;
  abortSignal?: AbortSignal;
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
  context?: Record<string, JsonValue>;
  files?: string[];
  taskType?: TaskType;
}

export interface ModelResponse {
  content: string;
  model: string;
  provider?: string;
  error?: string;
  toolCalls?: any[];
  metadata?: {
    tokens: number;
    latency: number;
    quality?: number;
    hybridRouting?: any;
    selectedProvider?: string;
    toolExecuted?: boolean;
    toolResults?: any[];
    fromBatch?: boolean;
    cacheHit?: boolean;
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
  llmUsed?: string;
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
  synthesis?: string;
  latency?: number;
  modelUsed?: string;
  reasoning?: string;
}

// Agent Domain Types
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

export interface ExecutionResponse {
  success: boolean;
  result: Record<string, unknown>;
  results?: Record<string, unknown>;
  workflowId?: string;
  executionTime?: number;
  error?: string;
}

// Voice Archetype Domain Types
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

// Performance Domain Types
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

// LLM Provider Domain Types
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

// Common Domain Types
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface JsonArray extends Array<JsonValue> {}

// Generic function types
export type TransformFunction<T, R> = (input: T) => R;
export type PredicateFunction<T> = (input: T) => boolean;
export type EvaluationFunction<T> = (input: T) => number;

// Configuration and context domain types
export interface ConfigurationObject extends Record<string, JsonValue> {}

export interface ExecutionContext {
  timestamp?: number;
  executionId?: string;
  [key: string]: JsonValue | undefined;
}

// Result and response domain types
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

// Workflow domain types
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

// Tool domain types
export interface ToolArguments extends Record<string, JsonValue> {}
export interface ToolResult<T = JsonValue> extends GenericResult<T> {}

// Memory and caching domain types
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

// Analysis domain types
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

// Event and message domain types
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

// Task analysis and complexity domain types
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

// Extended interfaces for compatibility
export interface ExecutionRequestExtended extends ExecutionRequest {
  type: string;
}

export interface ExecutionResponseExtended extends ExecutionResponse {
  results?: Record<string, unknown>;
  error?: string;
}

export interface WorkflowExtended extends Workflow {
  status?: 'pending' | 'running' | 'completed' | 'failed';
}

export interface TaskExtended extends Task {
  priority?: 'low' | 'medium' | 'high';
}

// Execution Mode Domain Type
export interface ExecutionMode {
  type: 'auto' | 'fast' | 'quality';
  timeout?: number;
}