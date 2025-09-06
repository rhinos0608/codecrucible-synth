/**
 * Model Domain Entity
 * Pure business logic for AI model management
 *
 * Living Spiral Council Applied:
 * - Domain-driven design with pure business entities
 * - No external dependencies or infrastructure concerns
 * - Business rules for model selection and health monitoring
 */

import { ModelName, ProviderType } from '../value-objects/voice-values.js';

/**
 * Model Entity - Core business object representing an AI model
 */
export class Model {
  private readonly _name: ModelName;
  private readonly _providerType: ProviderType;
  private readonly _capabilities: readonly string[];
  private readonly _parameters: ModelParameters;
  private _isHealthy: boolean;
  private _isEnabled: boolean;
  private _lastHealthCheck: Date;
  private _errorCount: number;

  constructor(
    name: ModelName,
    providerType: ProviderType,
    capabilities: string[],
    parameters: ModelParameters,
    isHealthy: boolean = true,
    isEnabled: boolean = true
  ) {
    this.validateInputs(capabilities, parameters);

    this._name = name;
    this._providerType = providerType;
    this._capabilities = Object.freeze([...capabilities]);
    this._parameters = parameters;
    this._isHealthy = isHealthy;
    this._isEnabled = isEnabled;
    this._lastHealthCheck = new Date();
    this._errorCount = 0;
  }

  // Getters
  get name(): ModelName {
    return this._name;
  }

  get providerType(): ProviderType {
    return this._providerType;
  }

  get capabilities(): readonly string[] {
    return this._capabilities;
  }

  get parameters(): ModelParameters {
    return this._parameters;
  }

  get isHealthy(): boolean {
    return this._isHealthy;
  }

  get isEnabled(): boolean {
    return this._isEnabled;
  }

  get lastHealthCheck(): Date {
    return new Date(this._lastHealthCheck);
  }

  get errorCount(): number {
    return this._errorCount;
  }

  // Business methods

  /**
   * Check if this model can handle a specific capability
   */
  hasCapability(capability: string): boolean {
    return this._capabilities.includes(capability.toLowerCase());
  }

  /**
   * Check if this model is available for processing
   */
  isAvailable(): boolean {
    return this._isEnabled && this._isHealthy;
  }

  /**
   * Record a successful health check
   */
  recordHealthCheckSuccess(): Model {
    return new Model(
      this._name,
      this._providerType,
      [...this._capabilities],
      this._parameters,
      true,
      this._isEnabled
    );
  }

  /**
   * Record a failed health check
   */
  recordHealthCheckFailure(): Model {
    const newModel = new Model(
      this._name,
      this._providerType,
      [...this._capabilities],
      this._parameters,
      false,
      this._isEnabled
    );
    newModel._errorCount = this._errorCount + 1;
    newModel._lastHealthCheck = new Date();
    return newModel;
  }

  /**
   * Enable this model for processing
   */
  enable(): Model {
    if (this._isEnabled) {
      return this;
    }
    return new Model(
      this._name,
      this._providerType,
      [...this._capabilities],
      this._parameters,
      this._isHealthy,
      true
    );
  }

  /**
   * Disable this model from processing
   */
  disable(): Model {
    if (!this._isEnabled) {
      return this;
    }
    return new Model(
      this._name,
      this._providerType,
      [...this._capabilities],
      this._parameters,
      this._isHealthy,
      false
    );
  }

  /**
   * Calculate suitability score for a given request
   * Business rule: Match capabilities and performance characteristics
   */
  calculateSuitabilityScore(request: {
    requiredCapabilities?: string[];
    preferredSize?: 'small' | 'medium' | 'large';
    maxLatency?: number;
    qualityThreshold?: number;
  }): number {
    if (!this.isAvailable()) {
      return 0;
    }

    let score = 0.2; // Base availability score

    // Capability matching (40% of score)
    if (request.requiredCapabilities) {
      const matchingCapabilities = request.requiredCapabilities.filter(cap =>
        this.hasCapability(cap)
      );
      score += (matchingCapabilities.length / request.requiredCapabilities.length) * 0.4;
    }

    // Size preference (20% of score)
    if (request.preferredSize) {
      const sizeMatch = this.matchesSizePreference(request.preferredSize);
      score += sizeMatch * 0.2;
    }

    // Performance characteristics (20% of score)
    if (request.maxLatency) {
      const latencyScore = this.calculateLatencyScore(request.maxLatency);
      score += latencyScore * 0.2;
    }

    // Health and reliability (remaining score)
    const reliabilityScore = this.calculateReliabilityScore();
    score += reliabilityScore * 0.2;

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Get model configuration for external systems
   */
  toConfig(): ModelConfiguration {
    return {
      name: this._name.value,
      providerType: this._providerType.value,
      capabilities: [...this._capabilities],
      parameters: {
        maxTokens: this._parameters.maxTokens,
        contextWindow: this._parameters.contextWindow,
        isMultimodal: this._parameters.isMultimodal,
        estimatedLatency: this._parameters.estimatedLatency,
        qualityRating: this._parameters.qualityRating,
      },
      isHealthy: this._isHealthy,
      isEnabled: this._isEnabled,
      lastHealthCheck: this._lastHealthCheck.toISOString(),
      errorCount: this._errorCount,
    };
  }

  /**
   * Create Model from configuration
   */
  static fromConfig(config: ModelConfiguration): Model {
    const model = new Model(
      ModelName.create(config.name),
      ProviderType.create(config.providerType),
      config.capabilities,
      config.parameters,
      config.isHealthy,
      config.isEnabled
    );
    model._lastHealthCheck = new Date(config.lastHealthCheck);
    model._errorCount = config.errorCount;
    return model;
  }

  // Private helper methods

  private matchesSizePreference(preferredSize: string): number {
    const modelSize = this.determineModelSize();
    return modelSize === preferredSize ? 1.0 : 0.5;
  }

  private determineModelSize(): string {
    if (this._parameters.maxTokens < 4000) return 'small';
    if (this._parameters.maxTokens < 16000) return 'medium';
    return 'large';
  }

  private calculateLatencyScore(maxLatency: number): number {
    if (this._parameters.estimatedLatency <= maxLatency) {
      return 1.0;
    }
    // Graceful degradation for slightly higher latency
    const ratio = maxLatency / this._parameters.estimatedLatency;
    return Math.max(0.0, ratio);
  }

  private calculateReliabilityScore(): number {
    if (this._errorCount === 0) return 1.0;
    if (this._errorCount <= 2) return 0.8;
    if (this._errorCount <= 5) return 0.6;
    return 0.4;
  }

  private validateInputs(capabilities: string[], parameters: ModelParameters): void {
    if (!capabilities || capabilities.length === 0) {
      throw new Error('Model must have at least one capability');
    }

    if (capabilities.some(cap => !cap || cap.trim().length === 0)) {
      throw new Error('All capabilities must be non-empty strings');
    }

    if (parameters.maxTokens <= 0) {
      throw new Error('Model max tokens must be positive');
    }

    if (parameters.contextWindow <= 0) {
      throw new Error('Model context window must be positive');
    }

    if (parameters.estimatedLatency < 0) {
      throw new Error('Model estimated latency cannot be negative');
    }

    if (parameters.qualityRating < 0 || parameters.qualityRating > 1) {
      throw new Error('Model quality rating must be between 0 and 1');
    }
  }
}

/**
 * Model Parameters Value Object
 */
export interface ModelParameters {
  maxTokens: number;
  contextWindow: number;
  isMultimodal: boolean;
  estimatedLatency: number; // milliseconds
  qualityRating: number; // 0-1 scale
}

/**
 * Model configuration interface for external systems
 */
export interface ModelConfiguration {
  name: string;
  providerType: string;
  capabilities: string[];
  parameters: ModelParameters;
  isHealthy: boolean;
  isEnabled: boolean;
  lastHealthCheck: string;
  errorCount: number;
}

/**
 * Model factory for common model types
 */
export class ModelFactory {
  /**
   * Create a coding-specialized model
   */
  static createCodingModel(name: string, providerType: string, parameters: ModelParameters): Model {
    return new Model(
      ModelName.create(name),
      ProviderType.create(providerType),
      ['code-generation', 'code-analysis', 'debugging', 'refactoring'],
      parameters
    );
  }

  /**
   * Create a general-purpose model
   */
  static createGeneralModel(
    name: string,
    providerType: string,
    parameters: ModelParameters
  ): Model {
    return new Model(
      ModelName.create(name),
      ProviderType.create(providerType),
      ['text-generation', 'analysis', 'reasoning', 'conversation'],
      parameters
    );
  }

  /**
   * Create a multimodal model
   */
  static createMultimodalModel(
    name: string,
    providerType: string,
    parameters: ModelParameters
  ): Model {
    const multimodalParams = { ...parameters, isMultimodal: true };
    return new Model(
      ModelName.create(name),
      ProviderType.create(providerType),
      ['text-generation', 'image-analysis', 'multimodal-reasoning'],
      multimodalParams
    );
  }
}
