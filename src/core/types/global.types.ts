/**
 * Global Type Definitions - Enterprise Grade Type Safety
 * Following the Grimoire's Prime Directive: "Recursion Before Code"
 */

// Eliminate all 'any' types with proper type definitions
export type UnknownRecord = Record<string, unknown>;
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export interface JsonArray extends Array<JsonValue> {}

// Model client types replacing 'any'
export interface ModelClient {
  generateVoiceResponse(
    prompt: string,
    voiceId: string,
    options: ModelOptions
  ): Promise<ModelResponse>;
  processRequest(request: ModelRequest): Promise<ModelResponse>;
  generateResponse(prompt: string, options?: ModelOptions): Promise<ModelResponse>;
  getCapabilities(): ModelCapabilities;
}

export interface ModelOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  timeout?: number;
}

export interface ModelRequest {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  context?: string[];
}

export interface ModelResponse {
  content: string;
  text?: string;
  response?: string;
  confidence?: number;
  tokensUsed?: number;
  model?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ModelCapabilities {
  maxTokens: number;
  supportedModels: string[];
  features: string[];
  rateLimit?: number;
}

// Error types for comprehensive error handling
export class ApplicationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApplicationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class SecurityError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'SECURITY_ERROR', 403, details);
    this.name = 'SecurityError';
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'NOT_FOUND', 404, details);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, details);
    this.name = 'RateLimitError';
  }
}

// Result type for functional error handling
export type Result<T, E = Error> = { success: true; value: T } | { success: false; error: E };

export function Ok<T>(value: T): Result<T> {
  return { success: true, value };
}

export function Err<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

// Async result type
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// Voice system types
export interface Voice {
  id: string;
  name: string;
  style: string;
  temperature: number;
  systemPrompt: string;
  prompt: string;
}

export interface VoiceConfig {
  voices: {
    default: string[];
    available: string[];
    parallel: boolean;
    maxConcurrent: number;
  };
}

// Performance monitoring types
export interface PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface HealthStatus {
  healthy: boolean;
  checks: HealthCheck[];
  timestamp: Date;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  metrics?: Record<string, number>;
}

// Configuration types
export interface ApplicationConfig {
  environment: 'development' | 'staging' | 'production';
  port: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  security: SecurityConfig;
  monitoring: MonitoringConfig;
  features: FeatureFlags;
}

export interface SecurityConfig {
  enableRateLimit: boolean;
  maxRequestsPerMinute: number;
  enableCors: boolean;
  corsOrigins: string[];
  encryptionKey?: string;
  jwtSecret?: string;
}

export interface MonitoringConfig {
  enableMetrics: boolean;
  enableTracing: boolean;
  enableLogging: boolean;
  metricsPort?: number;
  tracingEndpoint?: string;
}

export interface FeatureFlags {
  [key: string]: boolean | string | number;
}

// Repository pattern types
export interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
}

// Event types
export interface DomainEvent {
  id: string;
  type: string;
  timestamp: Date;
  payload: unknown;
  metadata: {
    correlationId?: string;
    causationId?: string;
    userId?: string;
  };
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

// Type guards
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}
