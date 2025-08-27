/**
 * Unified Configuration Interface
 * 
 * Single source of truth for all configuration across the application.
 * Replaces the 3 competing configuration systems with a unified approach.
 */

export interface UnifiedConfiguration {
  // Core Application Settings
  app: AppConfiguration;
  
  // Model and Provider Settings
  model: ModelConfiguration;
  
  // Security Settings
  security: SecurityConfiguration;
  
  // Performance Settings
  performance: PerformanceConfiguration;
  
  // Voice System Settings
  voices: VoiceConfiguration;
  
  // Tool System Settings
  tools: ToolConfiguration;
  
  // Infrastructure Settings
  infrastructure: InfrastructureConfiguration;
}

export interface AppConfiguration {
  name: string;
  version: string;
  environment: 'development' | 'production' | 'testing';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  workingDirectory?: string;
}

export interface ModelConfiguration {
  // Default provider and model
  defaultProvider: 'ollama' | 'lm-studio' | 'huggingface' | 'auto';
  defaultModel?: string;
  
  // Provider configurations
  providers: ModelProviderConfiguration[];
  
  // Fallback chain
  fallbackChain: string[];
  
  // Execution mode
  executionMode: 'auto' | 'fast' | 'quality';
  
  // Request settings
  timeout: number;
  maxRetries: number;
  temperature: number;
  maxTokens: number;
}

export interface ModelProviderConfiguration {
  type: 'ollama' | 'lm-studio' | 'huggingface' | 'auto';
  name: string;
  endpoint: string;
  apiKey?: string;
  enabled: boolean;
  priority: number;
  models: string[];
  capabilities: ModelCapability[];
}

export interface ModelCapability {
  type: 'completion' | 'chat' | 'tools' | 'vision' | 'code';
  supported: boolean;
}

export interface SecurityConfiguration {
  // Sandbox settings
  enableSandbox: boolean;
  sandboxTimeout: number;
  
  // Input validation
  maxInputLength: number;
  enableInputSanitization: boolean;
  
  // Command execution
  allowedCommands: string[];
  blockedCommands: string[];
  
  // File access
  allowedPaths: string[];
  restrictedPaths: string[];
  
  // Security level
  securityLevel: 'low' | 'medium' | 'high';
  
  // Audit settings
  enableAuditLogging: boolean;
  auditLogPath?: string;
}

export interface PerformanceConfiguration {
  // Concurrency
  maxConcurrentRequests: number;
  requestQueueSize: number;
  
  // Timeouts
  defaultTimeout: number;
  fastModeMaxTokens: number;
  
  // Memory management
  enableMemoryOptimization: boolean;
  memoryThresholdMB: number;
  
  // Caching
  enableCaching: boolean;
  cacheSize: number;
  cacheTTL: number;
  
  // Hardware optimization
  enableHardwareAcceleration: boolean;
  preferGPU: boolean;
}

export interface VoiceConfiguration {
  // Default voices
  defaultVoices: string[];
  availableVoices: string[];
  
  // Concurrency
  parallelVoices: boolean;
  maxConcurrentVoices: number;
  
  // Voice-specific settings
  voiceSettings: Record<string, VoiceSettings>;
  
  // Council settings
  enableCouncilMode: boolean;
  councilDecisionThreshold: number;
}

export interface VoiceSettings {
  enabled: boolean;
  priority: number;
  specialization: string[];
  contextLimit: number;
}

export interface ToolConfiguration {
  // Tool discovery
  enableToolDiscovery: boolean;
  toolDirectories: string[];
  
  // Tool execution
  enableParallelExecution: boolean;
  maxConcurrentTools: number;
  defaultToolTimeout: number;
  
  // MCP settings
  enableMCPServers: boolean;
  mcpServerConfigs: MCPServerConfiguration[];
  
  // Security
  enableToolSandboxing: boolean;
  toolSecurityLevel: 'low' | 'medium' | 'high';
}

export interface MCPServerConfiguration {
  id: string;
  name: string;
  enabled: boolean;
  type: 'filesystem' | 'git' | 'terminal' | 'package-manager' | 'external';
  config: Record<string, any>;
}

export interface InfrastructureConfiguration {
  // Database
  database: DatabaseConfiguration;
  
  // Streaming
  streaming: StreamingConfiguration;
  
  // Monitoring
  monitoring: MonitoringConfiguration;
  
  // External integrations
  integrations: IntegrationConfiguration;
}

export interface DatabaseConfiguration {
  type: 'sqlite' | 'postgresql' | 'memory';
  path?: string;
  connectionString?: string;
  inMemory: boolean;
  enableMigrations: boolean;
}

export interface StreamingConfiguration {
  enabled: boolean;
  bufferSize: number;
  flushInterval: number;
  chunkSize: number;
  timeout: number;
}

export interface MonitoringConfiguration {
  enableMetrics: boolean;
  enableTracing: boolean;
  enableProfiling: boolean;
  metricsEndpoint?: string;
  healthCheckInterval: number;
}

export interface IntegrationConfiguration {
  smithery: SmitheryConfiguration;
  e2b: E2BConfiguration;
}

export interface SmitheryConfiguration {
  enabled: boolean;
  apiKey?: string;
  autoDiscovery: boolean;
  servers: string[];
}

export interface E2BConfiguration {
  enabled: boolean;
  apiKey?: string;
  sandboxTemplate?: string;
}

/**
 * Configuration validation result
 */
export interface ConfigurationValidation {
  isValid: boolean;
  errors: ConfigurationError[];
  warnings: ConfigurationWarning[];
  sanitized?: UnifiedConfiguration;
}

export interface ConfigurationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ConfigurationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

/**
 * Configuration source types for the hierarchy
 */
export type ConfigurationSource = 
  | 'default'
  | 'file'
  | 'environment'
  | 'cli-args'
  | 'runtime';

export interface ConfigurationSourceInfo {
  source: ConfigurationSource;
  priority: number;
  timestamp: Date;
  path?: string;
}