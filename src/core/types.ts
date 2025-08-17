// Essential Types for CodeCrucible System
// Core configuration and client types
export interface UnifiedClientConfig {
  endpoint?: string;
  apiKey?: string;
  model?: string;
  timeout?: number;
  maxTokens?: number;
  temperature?: number;
  providers?: string[];
  defaultModel?: string;
  skipModelPreload?: boolean;
}

export interface ModelRequest {
  prompt: string;
  model?: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  };
}

export interface ModelResponse {
  content: string;
  model: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface ProjectContext {
  workingDirectory: string;
  files: Array<{
    path: string;
    content: string;
    type: string;
  }>;
  config: AppConfig;
  metadata?: Record<string, any>;
}

export interface AppConfig {
  model: {
    endpoint: string;
    name: string;
    timeout: number;
    maxTokens: number;
    temperature: number;
    providers?: string[];
  };
  autonomous?: {
    enableStartupAnalysis?: boolean;
  };
}

export interface ClientConfig {
  endpoint: string;
  timeout?: number;
  maxRetries?: number;
}

// Agent and execution types
export interface AgentConfig {
  enabled: boolean;
  mode: "auto" | "fast" | "balanced" | "thorough";
  maxConcurrency: number;
  enableCaching: boolean;
  enableMetrics: boolean;
  enableSecurity: boolean;
}

export interface AgentContext {
  modelClient: any;
  workingDirectory: string;
  config: AgentConfig;
}

export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
  taskId?: string;
  executionTime?: number;
}

export interface ExecutionRequest {
  prompt: string;
  context?: Record<string, any>;
  options?: Record<string, any>;
}

export interface ExecutionResponse {
  content: string;
  success: boolean;
  metadata?: Record<string, any>;
}

export enum ExecutionMode {
  AUTO = "auto",
  FAST = "fast",
  BALANCED = "balanced",
  THOROUGH = "thorough"
}

export interface Task {
  id: string;
  type: string;
  description: string;
  priority: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  metadata?: Record<string, any>;
}

export interface Workflow {
  id: string;
  name: string;
  tasks: Task[];
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface AgentDependencies {
  context: AgentContext;
  workingDirectory: string;
}

export interface VoiceEnabledConfig extends AgentConfig {
  voice?: {
    enabled: boolean;
    archetype: string;
  };
}

export interface BaseAgentConfig {
  name: string;
  type: string;
  enabled: boolean;
}

export interface BaseAgentOutput {
  content: string;
  metadata?: Record<string, any>;
  success: boolean;
}

// CLI and response types
export interface SpiralConfig {
  maxIterations: number;
  convergenceThreshold: number;
  adaptiveLearning: boolean;
}

export interface SynthesisResponse {
  content: string;
  metadata: Record<string, any>;
  confidence: number;
}

export interface CLIError extends Error {
  exitCode: number;
}

export enum CLIExitCode {
  SUCCESS = 0,
  ERROR = 1,
  INVALID_ARGS = 2,
  MODEL_ERROR = 3,
  FILE_ERROR = 4
}

// Security types
export interface SecurityValidation {
  isValid: boolean;
  issues: string[];
  score: number;
}

export interface SecurityError extends Error {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Performance types
export interface PerformanceMetrics {
  duration: number;
  tokenCount: number;
  memoryUsage: number;
  requestCount: number;
}

export interface ProviderMetrics {
  totalRequests: number;
  successRate: number;
  averageLatency: number;
  errorCount: number;
}

// Legacy compatibility types
export interface ModelClient {
  generate(prompt: string): Promise<string>;
  checkStatus(): Promise<boolean>;
}

export interface LocalModelClient extends ModelClient {
  endpoint: string;
  timeout: number;
}

export interface FastModeClient {
  generateFast(prompt: string): Promise<string>;
}

export interface AgentOrchestrator {
  processRequest(request: string): Promise<ExecutionResult>;
}

export interface AutonomousClaudeAgent {
  process(input: string): Promise<any>;
}

export interface MultiLLMProvider {
  getProviders(): string[];
  selectBest(): Promise<string>;
}

export interface RAGSystem {
  search(query: string): Promise<any[]>;
}

export interface ClaudeCodeInspiredReasoning {
  analyze(input: string): Promise<any>;
}

// Voice system types
export interface SynthesisResult {
  content: string;
  archetype: string;
  confidence: number;
}

export interface IterativeResult {
  iterations: Array<{
    content: string;
    feedback: string;
    improvement: number;
  }>;
  final: string;
  convergence: boolean;
}

// Tool and formatter types
export interface StructuredResponseFormatter {
  format(content: string): string;
  formatWithHeader(content: string, title: string): string;
}

export interface ExecutionError extends Error {
  code: string;
  context: Record<string, any>;
}

// Default exports for backwards compatibility
export default {
  UnifiedClientConfig,
  ModelRequest,
  ModelResponse,
  ProjectContext,
  AppConfig,
  AgentConfig,
  ExecutionResult,
  SynthesisResponse,
  CLIExitCode
};
