/**
 * Model Repository Interface
 * Domain layer contract for model persistence and management
 *
 * Living Spiral Council Applied:
 * - Pure domain interface with no implementation details
 * - Repository pattern for decoupled data access
 * - Business-focused method signatures for model management
 */

import { Model } from '../entities/model.js';
import { ProviderType } from '../value-objects/voice-values.js';

/**
 * Model Repository Interface
 * Defines the contract for model persistence without implementation details
 */
export interface IModelRepository {
  /**
   * Find a model by its name and provider
   */
  findByNameAndProvider: (
    name: string,
    providerType: Readonly<ProviderType>
  ) => Promise<Model | null>;

  /**
   * Find all models
   */
  findAll: () => Promise<Model[]>;

  /**
   * Find models by provider type
   */
  findByProvider: (providerType: Readonly<ProviderType>) => Promise<Model[]>;

  /**
   * Find models with specific capabilities
   */
  findByCapabilities: (capabilities: ReadonlyArray<string>) => Promise<Model[]>;

  /**
   * Find available models (healthy and enabled)
   */
  findAvailableModels: () => Promise<Model[]>;

  /**
   * Find models suitable for a request
   */
  findSuitableModels: (
    request: Readonly<{
      requiredCapabilities?: ReadonlyArray<string>;
      preferredSize?: 'small' | 'medium' | 'large';
      maxLatency?: number;
      qualityThreshold?: number;
    }>
  ) => Promise<Model[]>;

  /**
   * Save a model (create or update)
   */
  save: (model: Readonly<Model>) => Promise<void>;

  /**
   * Save multiple models in a transaction
   */
  saveAll: (models: ReadonlyArray<Readonly<Model>>) => Promise<void>;

  /**
   * Delete a model
   */
  delete: (name: Readonly<string>, providerType: Readonly<ProviderType>) => Promise<void>;

  /**
   * Check if a model exists
   */
  exists: (name: Readonly<string>, providerType: Readonly<ProviderType>) => Promise<boolean>;

  /**
   * Get count of total models
   */
  count: () => Promise<number>;

  /**
   * Get count of available models
   */
  countAvailable: () => Promise<number>;

  /**
   * Get models grouped by provider
   */
  getModelsByProvider: () => Promise<Map<string, Model[]>>;
}

/**
 * Model Query Interface
 * For complex model queries with filtering and sorting
 */
export interface ModelQuery {
  providerTypes?: ProviderType[];
  capabilities?: string[];
  isHealthy?: boolean;
  isEnabled?: boolean;
  maxLatency?: number;
  minQualityRating?: number;
  sizeCategory?: 'small' | 'medium' | 'large';
  isMultimodal?: boolean;
  sortBy?: 'name' | 'provider' | 'quality' | 'latency' | 'lastHealthCheck';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Extended Model Repository Interface
 * For advanced querying and management capabilities
 */
export interface IAdvancedModelRepository extends IModelRepository {
  /**
   * Find models using complex query criteria
   */
  findByQuery: (query: Readonly<ModelQuery>) => Promise<Model[]>;

  /**
   * Find the best model for a given request
   */
  findBestMatch: (
    request: Readonly<{
      readonly requiredCapabilities?: ReadonlyArray<string>;
      readonly preferredSize?: 'small' | 'medium' | 'large';
      readonly maxLatency?: number;
      readonly qualityThreshold?: number;
      readonly excludedProviders?: ReadonlyArray<ProviderType>;
    }>
  ) => Promise<Model | null>;

  /**
   * Get model performance statistics
   */
  getPerformanceStats: (
    name: Readonly<string>,
    providerType: Readonly<ProviderType>
  ) => Promise<ModelPerformanceStats | null>;

  /**
   * Get all model performance statistics
   */
  getAllPerformanceStats: () => Promise<ModelPerformanceStats[]>;

  /**
   * Update model health status
   */
  updateHealthStatus: (
    name: Readonly<string>,
    providerType: Readonly<ProviderType>,
    isHealthy: Readonly<boolean>
  ) => Promise<void>;

  /**
   * Bulk update model enabled status
   */
  /**
   * Bulk update model enabled status
   */
  bulkUpdateEnabled: (
    modelIds: ReadonlyArray<Readonly<{ name: string; provider: ProviderType }>>,
    enabled: boolean
  ) => Promise<void>;

  /**
   * Record model usage
   */
  recordUsage: (
    name: Readonly<string>,
    providerType: Readonly<ProviderType>,
    success: boolean,
    latency: number
  ) => Promise<void>;

  /**
   * Get model recommendations based on usage patterns
   */
  getRecommendations: (
    context: Readonly<{
      taskType?: string;
      historicalPreference?: boolean;
      performanceWeight?: number;
    }>
  ) => Promise<Model[]>;
}

/**
 * Model Performance Statistics
 */
export interface ModelPerformanceStats {
  modelName: string;
  providerType: string;
  totalRequests: number;
  successfulRequests: number;
  successRate: number;
  averageLatency: number;
  medianLatency: number;
  p95Latency: number;
  lastUsed: Date;
  averageQualityRating: number;
  totalErrors: number;
  errorRate: number;
  uptimePercentage: number;
}

/**
 * Model Repository Events
 * Domain events that can be published by repository implementations
 */
export interface ModelRepositoryEvents {
  modelRegistered: { model: Model };
  modelUpdated: { model: Model; previousVersion?: Model };
  modelRemoved: { modelName: string; providerType: string };
  modelHealthChanged: { modelName: string; providerType: string; isHealthy: boolean };
  modelEnabled: { modelName: string; providerType: string };
  modelDisabled: { modelName: string; providerType: string };
  modelUsageRecorded: {
    modelName: string;
    providerType: string;
    success: boolean;
    latency: number;
  };
}
