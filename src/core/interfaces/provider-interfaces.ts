/**
 * Provider Interface Abstractions
 * Breaking circular dependencies in provider management
 *
 * Living Spiral Council Applied:
 * - Architect: Provider abstraction without implementation coupling
 * - Maintainer: Stable provider contracts for multiple implementations
 * - Security Guardian: Controlled provider access and validation
 * - Performance Engineer: Efficient provider selection and health monitoring
 */

// Core provider types without circular dependencies
export type ProviderType = 'ollama' | 'lm-studio' | 'huggingface' | 'auto';

// Provider configuration interface
export interface ProviderConfig {
  type: ProviderType;
  endpoint?: string;
  apiKey?: string;
  model?: string;
  timeout?: number;
  maxRetries?: number;
  enabled?: boolean;
  fallbackOrder?: number;
}

// Provider status interface
export interface ProviderStatus {
  type: ProviderType;
  isHealthy: boolean;
  isInitialized: boolean;
  lastHealthCheck: Date;
  errorCount: number;
  models: string[];
  endpoint: string;
}

// Provider initialization result
export interface ProviderInitResult {
  success: boolean;
  error?: Error;
  duration: number;
  provider?: IModelProvider;
}

// Core model provider interface - no client dependencies
export interface IModelProvider {
  // Core functionality
  processRequest(request: any): Promise<any>;
  healthCheck(): Promise<boolean>;

  // Model management
  supportsModel?(model: string): boolean;
  getAvailableModels?(): Promise<string[]>;
  switchModel?(modelName: string): Promise<void>;

  // Configuration
  getConfig(): ProviderConfig;
  updateConfig(config: Partial<ProviderConfig>): Promise<void>;

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

// Provider repository interface - no implementation dependencies
export interface IProviderRepository {
  // Lifecycle management
  initialize(configs: ProviderConfig[]): Promise<void>;
  shutdown(): Promise<void>;

  // Provider access
  getProvider(type: ProviderType): IModelProvider | undefined;
  getAvailableProviders(): Map<ProviderType, IModelProvider>;
  getAllProviders(): ProviderType[];

  // Health monitoring
  checkProviderHealth(type: ProviderType): Promise<boolean>;
  getProviderStatus(type: ProviderType): ProviderStatus | undefined;
  getAllProviderStatuses(): Map<ProviderType, ProviderStatus>;

  // Provider management
  enableProvider(type: ProviderType): Promise<void>;
  disableProvider(type: ProviderType): Promise<void>;
  switchProvider(from: ProviderType, to: ProviderType): Promise<void>;

  // Model management
  getAvailableModels(providerType?: ProviderType): Promise<string[]>;
  switchModel(providerType: ProviderType, modelName: string): Promise<void>;

  // Configuration
  updateProviderConfig(type: ProviderType, config: Partial<ProviderConfig>): Promise<void>;
  getProviderConfig(type: ProviderType): ProviderConfig | undefined;
}

// Provider factory interface for DI
export interface IProviderFactory {
  createProvider(config: ProviderConfig): Promise<IModelProvider>;
  createOllamaProvider(config: ProviderConfig): Promise<IModelProvider>;
  createLMStudioProvider(config: ProviderConfig): Promise<IModelProvider>;
  createHuggingFaceProvider(config: ProviderConfig): Promise<IModelProvider>;
}

// Provider events for decoupled communication
export interface ProviderEvents {
  providerInitialized: { type: ProviderType; provider: IModelProvider };
  providerFailed: { type: ProviderType; error: Error };
  providerHealthChanged: { type: ProviderType; isHealthy: boolean };
  providerEnabled: { type: ProviderType };
  providerDisabled: { type: ProviderType };
  modelSwitched: { type: ProviderType; model: string };
}

// Provider selection strategy interface
export interface IProviderSelector {
  selectProvider(
    request: any,
    availableProviders: Map<ProviderType, IModelProvider>
  ): IModelProvider | null;
  selectOptimalProvider(criteria: any): IModelProvider | null;
  getRankedProviders(request: any): IModelProvider[];
}

// Provider performance tracking
export interface IProviderPerformanceTracker {
  recordRequest(providerType: ProviderType, duration: number, success: boolean): void;
  getProviderMetrics(providerType: ProviderType): any;
  getPerformanceRanking(): ProviderType[];
  resetMetrics(providerType?: ProviderType): void;
}
