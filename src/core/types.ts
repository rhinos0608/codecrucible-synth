#!/usr/bin/env node

/**
 * Core Types - Consolidated type definitions
 * Replaces multiple scattered type files
 */

export interface ProjectContext {
  files: ProjectFile[];
  structure: ProjectStructure;
  metadata: ProjectMetadata;
  analysis?: ProjectAnalysis;
}

export interface ProjectFile {
  path: string;
  relativePath: string;
  content?: string;
  size: number;
  type: 'source' | 'config' | 'docs' | 'test' | 'asset' | 'other';
  language: string;
  lastModified: Date;
  hash?: string;
  lines?: number;
}

export interface ProjectStructure {
  directories: string[];
  entryPoints: string[];
  configFiles: string[];
  testDirectories: string[];
  documentationFiles: string[];
}

export interface ProjectMetadata {
  name: string;
  version?: string;
  description?: string;
  type: 'npm' | 'python' | 'generic';
  rootPath: string;
  languages: Record<string, number>;
  frameworks: string[];
  dependencies?: Record<string, string>;
}

export interface ProjectAnalysis {
  complexity: {
    total: number;
    average: number;
    files: Array<{ file: string; complexity: number }>;
  };
  quality: {
    score: number;
    issues: QualityIssue[];
  };
  security: {
    vulnerabilities: SecurityIssue[];
    riskLevel: 'low' | 'medium' | 'high';
  };
}

export interface QualityIssue {
  type: 'complexity' | 'duplication' | 'style' | 'performance';
  severity: 'info' | 'warning' | 'error';
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
}

export interface SecurityIssue {
  type: 'dependency' | 'code' | 'configuration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  file?: string;
  line?: number;
  description: string;
  recommendation: string;
}

export interface ModelRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  context?: ProjectContext;
  metadata?: Record<string, unknown>;
}

export interface ModelResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, unknown>;
  finishReason?: 'stop' | 'length' | 'timeout' | 'error';
}

export interface ClientConfig {
  timeout?: number;
  maxRetries?: number;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface ProviderMetrics {
  averageLatency: number;
  successRate: number;
  totalRequests: number;
  errorRate: number;
  lastError?: string;
}

export interface PerformanceMetrics {
  providers: Record<string, ProviderMetrics>;
  overall: {
    totalRequests: number;
    averageLatency: number;
    successRate: number;
    uptime: number;
  };
}

export interface SecurityValidation {
  isValid: boolean;
  reason?: string;
  sanitizedInput?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  duration: number;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface MCPServer {
  name: string;
  version: string;
  tools: MCPTool[];
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isConnected: () => boolean;
}

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

export interface Configuration {
  providers: {
    ollama: {
      endpoint: string;
      models: string[];
      timeout: number;
    };
    lmStudio: {
      endpoint: string;
      models: string[];
      timeout: number;
    };
    huggingface: {
      apiKey?: string;
      models: string[];
      timeout: number;
    };
  };
  execution: {
    mode: 'fast' | 'balanced' | 'thorough' | 'auto';
    maxConcurrentRequests: number;
    timeoutMs: number;
    enableFallback: boolean;
  };
  security: {
    enableSandbox: boolean;
    maxInputLength: number;
    allowedCommands: string[];
    scanDependencies: boolean;
  };
  performance: {
    enableMetrics: boolean;
    logSlowRequests: boolean;
    slowRequestThreshold: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableFile: boolean;
    maxLogSize: number;
    retentionDays: number;
  };
}

// Event types for the unified client
export interface ClientEvents {
  requestStart: { requestId: string; provider: string };
  requestComplete: { 
    requestId: string; 
    provider: string; 
    success: boolean; 
    error?: Error 
  };
  providerFailover: { 
    from: string; 
    to: string; 
    reason: string 
  };
  performanceAlert: { 
    provider: string; 
    metric: string; 
    value: number; 
    threshold: number 
  };
}

// Provider interface that all providers must implement
export interface ModelProvider {
  readonly name: string;
  readonly type: string;
  
  processRequest(request: ModelRequest, context?: ProjectContext): Promise<ModelResponse>;
  healthCheck(): Promise<boolean>;
  getModelName(): string;
  getCapabilities(): string[];
  shutdown?(): Promise<void>;
}

// Error types
export class CodeCrucibleError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CodeCrucibleError';
  }
}

export class ValidationError extends CodeCrucibleError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class ProviderError extends CodeCrucibleError {
  constructor(
    message: string,
    public readonly provider: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'PROVIDER_ERROR', { ...context, provider });
    this.name = 'ProviderError';
  }
}

export class TimeoutError extends CodeCrucibleError {
  constructor(
    message: string,
    public readonly timeoutMs: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'TIMEOUT_ERROR', { ...context, timeoutMs });
    this.name = 'TimeoutError';
  }
}

export class SecurityError extends CodeCrucibleError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SECURITY_ERROR', context);
    this.name = 'SecurityError';
  }
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Constants
export const DEFAULT_TIMEOUT = 30000;
export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_RETRIES = 3;

export const SUPPORTED_LANGUAGES = [
  'typescript', 'javascript', 'python', 'java', 'cpp', 'c', 'go', 'rust',
  'php', 'ruby', 'swift', 'kotlin', 'scala', 'dart', 'html', 'css', 'sql'
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const PROVIDER_TYPES = ['ollama', 'lm-studio', 'huggingface'] as const;
export type ProviderType = typeof PROVIDER_TYPES[number];

export const EXECUTION_MODES = ['fast', 'balanced', 'thorough', 'auto'] as const;
export type ExecutionMode = typeof EXECUTION_MODES[number];

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = typeof LOG_LEVELS[number];
