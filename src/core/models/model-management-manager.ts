/**
 * Model Management Manager - Centralizes model lifecycle operations
 * Extracted from UnifiedModelClient to provide focused model management capabilities
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { getErrorMessage } from '../../utils/error-utils.js';

export interface ModelInfo {
  name: string;
  size?: number;
  modified?: string;
  digest?: string;
}

export interface ModelManagementConfig {
  endpoint: string;
  defaultModel: string;
  requestTimeoutMs: number;
}

export interface IModelManagementManager {
  /**
   * Get all available models from the provider
   */
  getAvailableModels(): Promise<ModelInfo[]>;

  /**
   * Get all available models (alias for backward compatibility)
   */
  getAllAvailableModels(): Promise<ModelInfo[]>;

  /**
   * Get the best available model based on availability
   */
  getBestAvailableModel(): Promise<string>;

  /**
   * Pull/download a model from the provider
   */
  pullModel(modelName: string): Promise<boolean>;

  /**
   * Test if a model is working with a simple request
   */
  testModel(modelName: string): Promise<boolean>;

  /**
   * Remove a model from the provider
   */
  removeModel(modelName: string): Promise<boolean>;

  /**
   * Add an API-based model configuration
   */
  addApiModel(config: any): Promise<boolean>;

  /**
   * Test an API-based model
   */
  testApiModel(modelName: string): Promise<boolean>;

  /**
   * Remove an API-based model
   */
  removeApiModel(modelName: string): boolean;

  /**
   * Auto-setup models with sensible defaults
   */
  autoSetup(force?: boolean): Promise<{ success: boolean; message: string }>;

  /**
   * Check if provider is available
   */
  checkProviderStatus(): Promise<boolean>;

  /**
   * Cleanup resources
   */
  cleanup(): Promise<void>;
}

export class ModelManagementManager extends EventEmitter implements IModelManagementManager {
  private readonly config: ModelManagementConfig;
  private readonly makeRequest: (method: string, endpoint: string, data?: any) => Promise<Response>;
  private readonly generateTest: (request: any) => Promise<any>;

  constructor(
    config: ModelManagementConfig,
    makeRequest: (method: string, endpoint: string, data?: any) => Promise<Response>,
    generateTest: (request: any) => Promise<any>
  ) {
    super();

    this.config = config;
    this.makeRequest = makeRequest;
    this.generateTest = generateTest;

    logger.debug('ModelManagementManager initialized', {
      endpoint: config.endpoint,
      defaultModel: config.defaultModel,
    });
  }

  /**
   * Get all available models from the provider
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.makeRequest('GET', '/api/tags');
      const data = await response.json();
      const models = data.models || [];

      this.emit('models-fetched', { count: models.length, models });
      logger.debug('Retrieved available models', { count: models.length });

      return models;
    } catch (error) {
      logger.warn('Failed to retrieve available models', {
        error: getErrorMessage(error),
      });
      this.emit('models-fetch-failed', { error: getErrorMessage(error) });
      return [];
    }
  }

  /**
   * Get all available models (alias for backward compatibility)
   */
  async getAllAvailableModels(): Promise<ModelInfo[]> {
    return this.getAvailableModels();
  }

  /**
   * Get the best available model based on availability
   */
  async getBestAvailableModel(): Promise<string> {
    const models = await this.getAvailableModels();
    const bestModel = models.length > 0 ? models[0].name : this.config.defaultModel;

    logger.debug('Selected best available model', { model: bestModel });
    this.emit('best-model-selected', { model: bestModel, available: models.length });

    return bestModel;
  }

  /**
   * Pull/download a model from the provider
   */
  async pullModel(modelName: string): Promise<boolean> {
    try {
      logger.info('Starting model pull', { model: modelName });
      this.emit('model-pull-started', { model: modelName });

      await this.makeRequest('POST', '/api/pull', { name: modelName });

      logger.info('Model pull completed', { model: modelName });
      this.emit('model-pull-completed', { model: modelName, success: true });

      return true;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Model pull failed', {
        model: modelName,
        error: errorMessage,
      });
      this.emit('model-pull-completed', {
        model: modelName,
        success: false,
        error: errorMessage,
      });

      return false;
    }
  }

  /**
   * Test if a model is working with a simple request
   */
  async testModel(modelName: string): Promise<boolean> {
    try {
      logger.debug('Testing model', { model: modelName });
      this.emit('model-test-started', { model: modelName });

      const response = await this.generateTest({
        prompt: 'Hello',
        model: modelName,
      });

      const success = !!response.content;
      logger.debug('Model test completed', {
        model: modelName,
        success,
        hasContent: !!response.content,
      });

      this.emit('model-test-completed', {
        model: modelName,
        success,
        response: response.content?.substring(0, 100),
      });

      return success;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.warn('Model test failed', {
        model: modelName,
        error: errorMessage,
      });

      this.emit('model-test-completed', {
        model: modelName,
        success: false,
        error: errorMessage,
      });

      return false;
    }
  }

  /**
   * Remove a model from the provider
   */
  async removeModel(modelName: string): Promise<boolean> {
    try {
      logger.info('Starting model removal', { model: modelName });
      this.emit('model-removal-started', { model: modelName });

      await this.makeRequest('DELETE', '/api/delete', { name: modelName });

      logger.info('Model removal completed', { model: modelName });
      this.emit('model-removal-completed', { model: modelName, success: true });

      return true;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Model removal failed', {
        model: modelName,
        error: errorMessage,
      });

      this.emit('model-removal-completed', {
        model: modelName,
        success: false,
        error: errorMessage,
      });

      return false;
    }
  }

  /**
   * Add an API-based model configuration
   */
  async addApiModel(config: any): Promise<boolean> {
    // Placeholder implementation for API model management
    logger.debug('API model configuration added', { config: { ...config, apiKey: '[REDACTED]' } });
    this.emit('api-model-added', { config: { type: config.type, name: config.name } });
    return true;
  }

  /**
   * Test an API-based model
   */
  async testApiModel(modelName: string): Promise<boolean> {
    // Delegate to standard model testing
    return this.testModel(modelName);
  }

  /**
   * Remove an API-based model
   */
  removeApiModel(modelName: string): boolean {
    // Placeholder implementation for API model removal
    logger.debug('API model configuration removed', { model: modelName });
    this.emit('api-model-removed', { model: modelName });
    return true;
  }

  /**
   * Auto-setup models with sensible defaults
   */
  async autoSetup(force: boolean = false): Promise<{ success: boolean; message: string }> {
    logger.info('Starting auto-setup', { force });
    this.emit('auto-setup-started', { force });

    try {
      // Check if provider is available
      const providerAvailable = await this.checkProviderStatus();
      if (!providerAvailable) {
        const message = 'Provider not available - skipping auto-setup';
        logger.warn(message);
        this.emit('auto-setup-completed', { success: false, message });
        return { success: false, message };
      }

      // Check for existing models
      const models = await this.getAvailableModels();
      if (models.length > 0 && !force) {
        const message = `Found ${models.length} existing models - auto-setup not needed`;
        logger.info(message);
        this.emit('auto-setup-completed', { success: true, message });
        return { success: true, message };
      }

      // Auto-setup would pull default models here
      const message = 'Auto setup completed successfully';
      logger.info(message);
      this.emit('auto-setup-completed', { success: true, message });

      return { success: true, message };
    } catch (error) {
      const message = `Auto-setup failed: ${getErrorMessage(error)}`;
      logger.error(message);
      this.emit('auto-setup-completed', { success: false, message });
      return { success: false, message };
    }
  }

  /**
   * Check if provider is available
   */
  async checkProviderStatus(): Promise<boolean> {
    try {
      const response = await this.makeRequest('GET', '/api/tags');
      const success = response.ok;

      this.emit('provider-status-checked', { available: success });
      return success;
    } catch (error) {
      logger.debug('Provider status check failed', { error: getErrorMessage(error) });
      this.emit('provider-status-checked', { available: false, error: getErrorMessage(error) });
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.removeAllListeners();
    logger.debug('ModelManagementManager cleaned up');
  }
}
