import { logger } from '../../infrastructure/logging/logger.js';

export interface OllamaOptions {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  num_ctx?: number;
  num_predict?: number;
  repeat_penalty?: number;
  seed?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: OllamaTool[];
  format?: 'json';
  raw?: boolean;
  taskType?: string;
  timeout?: number;
  model?: string;
  contextLength?: number;
  [key: string]: unknown;
}

export interface OllamaRequest {
  model?: string;
  prompt?: string;
  messages?: OllamaMessage[];
  options?: OllamaOptions;
  tools?: OllamaTool[];
  format?: 'json';
  stream?: boolean;
  id?: string;
  onStreamingToken?: (token: string, metadata?: OllamaStreamingMetadata) => void;
  taskType?: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  num_ctx?: number;
  timeout?: number;
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  images?: string[];
  tool_calls?: OllamaToolCall[];
}

export interface OllamaToolCall {
  id?: string;
  type?: 'function';
  function: {
    name: string;
    arguments: string | Record<string, unknown>;
  };
}

export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters?: {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
  name?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message?: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  response?: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaStreamingMetadata {
  model?: string;
  totalDuration?: number;
  loadDuration?: number;
  promptEvalCount?: number;
  promptEvalDuration?: number;
  evalCount?: number;
  evalDuration?: number;
  context?: number[];
  [key: string]: unknown;
}

export interface ParsedToolCall {
  id?: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface FunctionSpec {
  name: string;
  description: string;
  parameters?: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface OllamaModel {
  name: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: {
    format?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaModelList {
  models: OllamaModel[];
}

export interface OllamaConfig {
  endpoint: string;
  defaultModel: string;
  timeout: number;
  maxRetries: number;
}

export function parseEnvInt(
  envVar: string,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  const value = process.env[envVar];
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    logger.warn(`Invalid environment variable ${envVar}=${value}, using default: ${defaultValue}`);
    return defaultValue;
  }

  if (min !== undefined && parsed < min) {
    logger.warn(`Environment variable ${envVar}=${parsed} below minimum ${min}, using minimum`);
    return min;
  }

  if (max !== undefined && parsed > max) {
    logger.warn(`Environment variable ${envVar}=${parsed} above maximum ${max}, using maximum`);
    return max;
  }

  return parsed;
}
