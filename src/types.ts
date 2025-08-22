export interface UnifiedClientConfig {
  endpoint?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  timeout?: number;
}

export interface ModelProvider {
  name: string;
  endpoint: string;
  models: string[];
  status: 'connected' | 'disconnected' | 'error';
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  voice?: 'explorer' | 'maintainer' | 'guardian';
  context?: Record<string, any>;
}

export interface GenerationResult {
  code: string;
  model: string;
  timestamp: string;
  analysis?: string;
  voice?: string;
  metadata?: Record<string, any>;
}

export interface CodebaseContext {
  projectType: string;
  framework?: string;
  languages: string[];
  dependencies: string[];
  fileStructure: Record<string, any>;
}

export interface AnalysisResult {
  overview: {
    files: number;
    lines: number;
    languages: Record<string, number>;
  };
  quality: {
    complexity: number;
    maintainability: string;
    coverage: string;
  };
  security: {
    vulnerabilities: number;
    issues: string[];
  };
  architecture: {
    patterns: string[];
    recommendations: string[];
  };
}

export interface VoiceArchetype {
  name: string;
  description: string;
  personality: string;
  specialization: string[];
  promptPrefix: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: any;
  error?: string;
}

export interface ExecutionContext {
  workspaceRoot: string;
  projectConfig: UnifiedClientConfig;
  activeModel: string;
  voiceArchetype?: VoiceArchetype;
  workflow: WorkflowStep[];
}

export type ExecutionMode = 'interactive' | 'autonomous' | 'guided' | 'silent';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type ModelType = 'code' | 'chat' | 'embedding' | 'vision';

// Legacy compatibility
export type ClientConfig = UnifiedClientConfig;
export type ModelInfo = { name: string; size: string; status: string };
